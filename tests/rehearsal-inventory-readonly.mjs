// Syntax and read-only transaction rehearsal against the in-memory SQL fixture.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabase, repo } from '../supabase/verification/local-postgres-fixture.mjs';

const file = resolve(repo, 'supabase/verification/PRE_MIGRATION_READINESS_CHECKLIST.md');
const text = readFileSync(file, 'utf8');
const gateB = text.split('## Gate B')[1]?.split('## Gate C')[0];
assert.ok(gateB, 'Gate B must exist');
const sections = [...gateB.matchAll(/```sql\s*([\s\S]*?)```/g)].map(x => x[1].trim());
assert.equal(sections.length, 7, 'review any change to the seven inventory sections');
for (const sql of sections) {
  assert.match(sql, /BEGIN TRANSACTION READ ONLY;/);
  assert.match(sql, /COMMIT;\s*$/);
  const uncommented = sql.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(uncommented, /\b(?:INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|DROP\s+|ALTER\s+|CREATE\s+)\b/i);
}
const original = readFileSync(resolve(repo, 'supabase/verification/pre-migration-inventory.sql'), 'utf8');
assert.match(original, /BEGIN TRANSACTION READ ONLY;/);
assert.match(original, /COMMIT;\s*$/);
assert.doesNotMatch(original.replace(/^\s*--.*$/gm, ''), /\b(?:INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|DROP\s+|ALTER\s+|CREATE\s+)\b/i);
const db = await createDatabase();
try {
  for (let index = 0; index < sections.length; index++) {
    await db.exec(sections[index]);
    console.log('PASS local read-only inventory section', index + 1);
  }
  await db.exec(original);
  console.log('PASS local original inventory SQL');
} finally { await db.close(); }
