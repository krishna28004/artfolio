// Creates an empty, unique local capture folder. Never connects to a service.
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRehearsalSql } from './prepare-rehearsal-sql.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const at = process.argv.indexOf('--output-dir');
if (at < 0 || !process.argv[at + 1]) {
  console.error('Usage: node scripts/prepare-rehearsal-capture.mjs --output-dir <NEW_ABSOLUTE_DIR>');
  process.exit(2);
}
const output = process.argv[at + 1];
if (!isAbsolute(output)) throw Error('An absolute output path is required');
const directory = resolve(output);
if (!/^capture-\d{8}-\d{6}(?:-[a-z0-9]+)?$/.test(basename(directory)))
  throw Error('Capture directory name must include a timestamp: capture-YYYYMMDD-HHMMSS');
const rel = relative(repo, directory);
if (rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)))
  throw Error('Capture artifacts must be outside the repository');
let realParent;
try { realParent = realpathSync(dirname(directory)); }
catch { throw Error('Capture parent directory is unavailable'); }
const realRepo = realpathSync(repo);
const realRel = relative(realRepo, realParent);
if (realRel === '' || (realRel !== '..' && !realRel.startsWith('..' + sep) && !isAbsolute(realRel)))
  throw Error('Capture parent resolves inside the repository');
try { mkdirSync(directory, { recursive: false }); }
catch { throw Error('Capture directory already exists or cannot be created'); }
writeFileSync(resolve(directory, '.gitignore'), '*\n', { flag: 'wx' });
function write(name, value) {
  writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
write('migration-source-manifest.json', buildRehearsalSql().manifest);
write('target-project.json', {
  projectName: 'artfolio-rehearsal', projectRef: '', branch: '', dashboardConfirmedAt: '',
  confirmedDisposable: false, productionProjectDifferent: false, migrationHistoryExists: null,
});
write('tool-versions.json', { supabase: '', docker: '', psql: '' });
write('storage-inventory.json', {
  projectRef: '', checkedAt: '', policiesReviewed: false,
  buckets: ['artworks-public', 'artworks-private', 'commission-private'].map(id =>
    ({ id, exists: null, public: null, objectCount: null, restrictionsReviewed: false,
      fileSizeLimit: null, allowedMimeTypes: null })),
});
write('hosted-config.json', {
  projectRef: '', checkedAt: '', reviewed: {
    authProviders: false, signupRecovery: false, redirects: false,
    emailTemplatesLimits: false, mfa: false, sessions: false,
    edgeFunctions: false, secretsPresence: false, schedulesWebhooks: false,
  },
});
console.log(JSON.stringify({ scope: 'LOCAL ONLY', created: directory, state: 'INCOMPLETE',
  migrations: buildRehearsalSql().manifest.length }));
