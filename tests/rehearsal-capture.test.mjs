import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkCapture } from '../scripts/verify-rehearsal-capture.mjs';
import { buildRehearsalSql } from '../scripts/prepare-rehearsal-sql.mjs';

const ref = 'abcdefghijklmnopqrst';
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'artfolio-recovery-'));
  function json(name, value) { writeFileSync(join(dir, name), JSON.stringify(value)); }
  for (const name of ['roles.sql','schema.sql','data.sql'])
    writeFileSync(join(dir, name), '-- synthetic fixture\n-- PostgreSQL database dump complete\n');
  writeFileSync(join(dir, 'history_schema.sql'), '-- supabase_migrations synthetic fixture\n-- PostgreSQL database dump complete\n');
  writeFileSync(join(dir, 'history_data.sql'), 'COPY supabase_migrations.schema_migrations (version, statements, name) FROM stdin;\n20260923000000\t\\N\tfixture\n\\.\n-- PostgreSQL database dump complete\n');
  json('target-project.json', { projectName:'artfolio-rehearsal',projectRef:ref,branch:'main',dashboardConfirmedAt:'synthetic',confirmedDisposable:true,productionProjectDifferent:true,migrationHistoryExists:true });
  json('tool-versions.json', { supabase:'fixture',docker:'fixture',psql:'fixture' });
  json('migration-source-manifest.json', buildRehearsalSql().manifest);
  json('storage-inventory.json', { projectRef:ref,checkedAt:'synthetic',policiesReviewed:true,buckets:
    ['artworks-public','artworks-private','commission-private'].map(id => ({ id,exists:false,public:null,objectCount:0 })) });
  json('hosted-config.json', { projectRef:ref,checkedAt:'synthetic',reviewed:Object.fromEntries(
    ['authProviders','signupRecovery','redirects','emailTemplatesLimits','mfa','sessions','edgeFunctions','secretsPresence','schedulesWebhooks']
      .map(key => [key,true])) });
  return { dir, json };
}
test('complete synthetic capture seals and detects later byte changes', () => {
  const { dir } = fixture();
  assert.equal(checkCapture(dir, { createManifest:true }).status, 'INTEGRITY VERIFIED; RESTORE NOT VERIFIED');
  assert.equal(checkCapture(dir).issues.length, 0);
  assert.deepEqual(checkCapture(dir).capturedHistoryVersions, ['20260923000000']);
  assert.equal(checkCapture(dir).migrationHistoryAlignment, 'RECONCILIATION REQUIRED');
  assert.match(checkCapture(dir, { createManifest:true }).issues.join(' '), /already exists/);
  writeFileSync(join(dir,'data.sql'), '-- changed fixture\n');
  assert.match(checkCapture(dir).issues.join(' '), /SHA-256 mismatch/);
});
test('missing Storage bytes keep capture incomplete', () => {
  const { dir, json } = fixture();
  json('storage-inventory.json', { projectRef:ref,checkedAt:'synthetic',policiesReviewed:true,buckets:[
    { id:'artworks-public',exists:true,public:true,objectCount:1,restrictionsReviewed:true,fileSizeLimit:null,allowedMimeTypes:null },
    { id:'artworks-private',exists:false,public:null,objectCount:0 },
    { id:'commission-private',exists:false,public:null,objectCount:0 },
  ] });
  assert.match(checkCapture(dir).issues.join(' '), /encrypted path map|Storage byte manifest/);
});
test('missing Storage policy review blocks sealing', () => {
  const { dir, json } = fixture();
  json('storage-inventory.json', { projectRef:ref,checkedAt:'synthetic',policiesReviewed:false,buckets:
    ['artworks-public','artworks-private','commission-private'].map(id => ({ id,exists:false,public:null,objectCount:0 })) });
  assert.match(checkCapture(dir, { createManifest:true }).issues.join(' '), /Storage inventory identity/);
});
test('credential-like metadata is rejected without revealing its content', () => {
  const { dir, json } = fixture();
  json('tool-versions.json', { supabase:'fixture',docker:'fixture',psql:'fixture', databaseUrl:'postgresql://REDACTED' });
  const result = checkCapture(dir);
  assert.match(result.issues.join(' '), /Credential-like text/);
  assert.doesNotMatch(JSON.stringify(result), /REDACTED/);
});
test('verified absence of migration history uses evidence instead of invented rows', () => {
  const { dir, json } = fixture();
  rmSync(join(dir, 'history_schema.sql'));
  rmSync(join(dir, 'history_data.sql'));
  json('target-project.json', { projectName:'artfolio-rehearsal',projectRef:ref,branch:'main',dashboardConfirmedAt:'synthetic',confirmedDisposable:true,productionProjectDifferent:true,migrationHistoryExists:false });
  json('history-absence.json', { projectRef:ref,checkedAt:'synthetic',historyExists:false });
  const result = checkCapture(dir, { createManifest:true });
  assert.equal(result.status, 'INTEGRITY VERIFIED; RESTORE NOT VERIFIED');
  assert.equal(result.capturedHistoryCount, 0);
});
test('untrusted manifest paths cannot read outside the capture', () => {
  const { dir, json } = fixture();
  assert.equal(checkCapture(dir, { createManifest:true }).issues.length, 0);
  json('SHA256SUMS.json', [{ name:'../outside.txt',sha256:'0'.repeat(64) }]);
  assert.match(checkCapture(dir).issues.join(' '), /Manifest file inventory differs/);
  json('SHA256SUMS.json', [{ name:'C:\\outside.txt',sha256:'0'.repeat(64) }]);
  assert.match(checkCapture(dir).issues.join(' '), /Manifest file inventory differs/);
});
test('truncated export blocks manifest sealing', () => {
  const { dir } = fixture();
  writeFileSync(join(dir, 'data.sql'), '-- incomplete SQL\n');
  const result = checkCapture(dir, { createManifest:true });
  assert.equal(result.status, 'INCOMPLETE');
  assert.match(result.issues.join(' '), /completion marker/);
});
test('symlink artifacts block manifest sealing when the OS permits links', t => {
  const { dir } = fixture();
  try { symlinkSync(join(dir, 'roles.sql'), join(dir, 'extra-link.sql')); }
  catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('OS denied symlink creation'); return; }
    throw error;
  }
  assert.match(checkCapture(dir, { createManifest:true }).issues.join(' '), /unsupported file type/);
});
