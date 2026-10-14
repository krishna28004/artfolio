// Offline integrity and coverage check for a future rehearsal capture.
// This module has no provider SDK, network calls, or database connection.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRehearsalSql } from './prepare-rehearsal-sql.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const realRepo = realpathSync(repo);
const sqlFiles = ['roles.sql', 'schema.sql', 'data.sql'];
const jsonFiles = ['target-project.json', 'tool-versions.json', 'storage-inventory.json',
  'hosted-config.json', 'migration-source-manifest.json'];
const buckets = ['artworks-public', 'artworks-private', 'commission-private'];
const secretPattern = /(?:postgres(?:ql)?:\/\/|sb_(?:secret|publishable)_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|(?:password|service.?role.?key|access.?token|database.?url)\s*[=:]\s*\S+)/i;

function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function inside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}
function readJson(path, issues) {
  try {
    const raw = readFileSync(path, 'utf8');
    if (secretPattern.test(raw)) issues.push('Credential-like text found in a metadata file');
    return JSON.parse(raw);
  } catch {
    issues.push('Missing or unreadable metadata file: ' + path.split(/[\\/]/).at(-1));
    return null;
  }
}
function listFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const type = lstatSync(join(dir, entry.name));
    if (type.isDirectory()) return listFiles(join(dir, entry.name), name);
    // Reject links, junctions and unusual file types rather than omitting them from the seal.
    if (!type.isFile()) throw Error('Capture contains an unsupported file type');
    return [name];
  }).sort();
}
function safeManifestName(name) {
  return typeof name === 'string' && name.length > 0 && !name.includes('\\') &&
    name.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
function regularNonempty(path) {
  try { return lstatSync(path).isFile() && lstatSync(path).size > 0; } catch { return false; }
}
function completeSqlExport(path, issues) {
  if (!regularNonempty(path)) return;
  try {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    if (!/^-- PostgreSQL database(?: cluster)? dump complete\s*$/i.test(source.trimEnd().split(/\r?\n/).at(-1)))
      issues.push('SQL export has no PostgreSQL completion marker: ' + path.split(/[\\/]/).at(-1));
  } catch { issues.push('SQL export is not readable UTF-8: ' + path.split(/[\\/]/).at(-1)); }
}
function parseHistory(path, issues, data = false) {
  if (!regularNonempty(path)) return null;
  try {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    if (!source.includes('supabase_migrations')) issues.push('Migration history export does not name supabase_migrations');
    if (!data) return null;
    const normalized = source.replaceAll('"', '');
    const block = normalized.match(/COPY\s+supabase_migrations\.schema_migrations\s*\([^)]*\)\s+FROM stdin;\r?\n([\s\S]*?)\r?\n\\\./i);
    if (!block) { issues.push('Migration history data has no readable COPY block'); return null; }
    const lines = block[1].trim() ? block[1].split(/\r?\n/) : [];
    const versions = lines.map(line => line.split('\t')[0]);
    if (versions.some(version => !/^\d{14}$/.test(version)) || new Set(versions).size !== versions.length)
      issues.push('Migration history has invalid or duplicate versions');
    return versions;
  } catch { issues.push('Migration history export is not readable UTF-8'); }
  return null;
}
export function checkCapture(dir, { createManifest = false } = {}) {
  const issues = [];
  if (!isAbsolute(dir)) return { status: 'INCOMPLETE', issues: ['An absolute capture path is required'] };
  const absolute = resolve(dir);
  if (inside(repo, absolute)) return { status: 'INCOMPLETE', issues: ['Capture directory must be outside the Artfolio repository'] };
  if (!existsSync(absolute) || !lstatSync(absolute).isDirectory())
    return { status: 'INCOMPLETE', issues: ['Capture directory does not exist'] };
  if (inside(realRepo, realpathSync(absolute)))
    return { status: 'INCOMPLETE', issues: ['Capture directory resolves inside the Artfolio repository'] };
  for (const name of [...sqlFiles, ...jsonFiles]) {
    if (!regularNonempty(join(absolute, name))) issues.push('Missing or empty artifact: ' + name);
  }
  for (const name of sqlFiles) completeSqlExport(join(absolute, name), issues);
  const target = readJson(join(absolute, 'target-project.json'), issues);
  if (target && (!/^[a-z0-9]{20}$/.test(target.projectRef || '') ||
      target.projectName !== 'artfolio-rehearsal' || !target.branch || !target.dashboardConfirmedAt ||
      target.confirmedDisposable !== true || target.productionProjectDifferent !== true ||
      typeof target.migrationHistoryExists !== 'boolean'))
    issues.push('Target identity record is incomplete');
  const versions = readJson(join(absolute, 'tool-versions.json'), issues);
  if (versions && (!versions.supabase || !versions.docker || !versions.psql))
    issues.push('Tool version record is incomplete');
  const sourceManifest = readJson(join(absolute, 'migration-source-manifest.json'), issues);
  if (sourceManifest && JSON.stringify(sourceManifest) !== JSON.stringify(buildRehearsalSql().manifest))
    issues.push('Source migration hashes or order differ from the repository');
  let capturedHistory = null;
  if (target?.migrationHistoryExists === true) {
    for (const name of ['history_schema.sql', 'history_data.sql'])
      if (!regularNonempty(join(absolute, name))) issues.push('Missing or empty artifact: ' + name);
    for (const name of ['history_schema.sql', 'history_data.sql']) completeSqlExport(join(absolute, name), issues);
    parseHistory(join(absolute, 'history_schema.sql'), issues);
    capturedHistory = parseHistory(join(absolute, 'history_data.sql'), issues, true);
  } else if (target?.migrationHistoryExists === false) {
    const absence = readJson(join(absolute, 'history-absence.json'), issues);
    if (absence && (absence.projectRef !== target.projectRef || !absence.checkedAt || absence.historyExists !== false))
      issues.push('Migration history absence evidence is incomplete');
    if (['history_schema.sql', 'history_data.sql'].some(name => existsSync(join(absolute, name))))
      issues.push('History dumps conflict with recorded history absence');
    capturedHistory = [];
  }
  const storage = readJson(join(absolute, 'storage-inventory.json'), issues);
  if (storage) {
    if (storage.projectRef !== target?.projectRef || !storage.checkedAt || storage.policiesReviewed !== true ||
        !Array.isArray(storage.buckets) ||
        JSON.stringify(storage.buckets.map(x => x.id).sort()) !== JSON.stringify([...buckets].sort())) {
      issues.push('Storage inventory identity or bucket set is incomplete');
    } else {
      for (const bucket of storage.buckets) {
        if (typeof bucket.exists !== 'boolean' || !Number.isSafeInteger(bucket.objectCount) || bucket.objectCount < 0 ||
            (bucket.exists && (typeof bucket.public !== 'boolean' || bucket.restrictionsReviewed !== true ||
              !(bucket.fileSizeLimit === null || (Number.isSafeInteger(bucket.fileSizeLimit) && bucket.fileSizeLimit >= 0)) ||
              !(bucket.allowedMimeTypes === null || (Array.isArray(bucket.allowedMimeTypes) &&
                bucket.allowedMimeTypes.every(x => typeof x === 'string'))))) ||
            (!bucket.exists && bucket.objectCount !== 0))
          issues.push('Storage inventory has an unknown state for ' + bucket.id);
      }
      if (storage.buckets.some(x => x.objectCount > 0)) {
        const objects = readJson(join(absolute, 'storage-objects.json'), issues);
        if (!regularNonempty(join(absolute, 'storage-path-map.enc')))
          issues.push('Nonempty Storage requires an encrypted path map');
        if (!objects || !Array.isArray(objects.objects)) issues.push('Storage byte manifest is missing');
        else {
          const names = new Set();
          for (const bucket of storage.buckets) {
            if (objects.objects.filter(x => x.bucket === bucket.id).length !== bucket.objectCount)
              issues.push('Storage byte count differs for ' + bucket.id);
          }
          for (const obj of objects.objects) {
            if (!buckets.includes(obj.bucket) || !/^[0-9a-f-]{36}\.bin$/.test(obj.localName || '') ||
                !/^[0-9a-f]{64}$/.test(obj.sha256 || '')) {
              issues.push('Storage byte manifest has an unsafe local filename'); continue;
            }
            const key = obj.bucket + '/' + obj.localName;
            if (names.has(key)) { issues.push('Storage byte manifest repeats a local file'); continue; }
            names.add(key);
            const path = join(absolute, 'storage-objects', obj.bucket, obj.localName);
            if (!regularNonempty(path) || sha(readFileSync(path)) !== obj.sha256)
              issues.push('Storage byte missing or hash mismatch');
          }
        }
      }
    }
  }
  const hosted = readJson(join(absolute, 'hosted-config.json'), issues);
  if (hosted && (!hosted.checkedAt || hosted.projectRef !== target?.projectRef ||
      !['authProviders','signupRecovery','redirects','emailTemplatesLimits','mfa','sessions','edgeFunctions','secretsPresence','schedulesWebhooks']
        .every(key => hosted.reviewed?.[key] === true)))
    issues.push('Hosted configuration checklist is incomplete');
  const manifestPath = join(absolute, 'SHA256SUMS.json');
  if (createManifest) {
    if (issues.length) return { status: 'INCOMPLETE', issues };
    if (existsSync(manifestPath)) return { status: 'INCOMPLETE', issues: ['Manifest already exists; never overwrite a capture'] };
    let files;
    try { files = listFiles(absolute).filter(name => name !== 'SHA256SUMS.json'); }
    catch { return { status: 'INCOMPLETE', issues: ['Capture contains an unsupported file type'] }; }
    if (files.some(name => secretPattern.test(name)))
      return { status: 'INCOMPLETE', issues: ['Credential-like text found in an artifact filename'] };
    const hashes = files.map(name => ({ name, sha256: sha(readFileSync(join(absolute, name))) }));
    writeFileSync(manifestPath, JSON.stringify(hashes, null, 2) + '\n', { flag: 'wx' });
  }
  const manifest = readJson(manifestPath, issues);
  if (manifest) {
    let actual;
    try { actual = listFiles(absolute).filter(name => name !== 'SHA256SUMS.json'); }
    catch { issues.push('Capture contains an unsupported file type'); actual = []; }
    if (!Array.isArray(manifest) || !manifest.every(x => safeManifestName(x?.name)) ||
        JSON.stringify(manifest.map(x => x.name)) !== JSON.stringify(actual))
      issues.push('Manifest file inventory differs from capture');
    else for (const item of manifest) {
      if (sha(readFileSync(join(absolute, item.name))) !== item.sha256)
        issues.push('SHA-256 mismatch in capture');
    }
  }
  const sourceVersions = buildRehearsalSql().manifest.map(item => item.name.slice(0, 14));
  const migrationHistoryAlignment = capturedHistory === null ? 'UNKNOWN' :
    capturedHistory.length === 0 ? 'EMPTY' :
      JSON.stringify(capturedHistory.toSorted()) === JSON.stringify(sourceVersions) ? 'SOURCE_VERSION_SET_MATCH' :
        'RECONCILIATION REQUIRED';
  return { status: issues.length ? 'INCOMPLETE' : 'INTEGRITY VERIFIED; RESTORE NOT VERIFIED',
    issues, sourceMigrationCount: buildRehearsalSql().manifest.length,
    capturedHistoryCount: capturedHistory?.length ?? null,
    capturedHistoryVersions: capturedHistory ?? [], migrationHistoryAlignment };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--dir');
  if (at < 0 || !process.argv[at + 1]) { console.error('Usage: node scripts/verify-rehearsal-capture.mjs --dir <ABSOLUTE_CAPTURE_DIR> [--create-manifest]'); process.exit(2); }
  const result = checkCapture(process.argv[at + 1], { createManifest: process.argv.includes('--create-manifest') });
  console.log(JSON.stringify(result, null, 2));
  if (result.issues.length) process.exitCode = 2;
}
