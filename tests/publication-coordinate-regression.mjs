// Local PostgreSQL fixture only. The replacement function exists in memory for review.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabase, repo } from '../supabase/verification/local-postgres-fixture.mjs';

const stopBefore = '20261013010000_rehearsal_security_hardening.sql';
const migration = readFileSync(resolve(repo, 'supabase/migrations/20261011030000_artwork_publication.sql'), 'utf8');
const functionSql = migration.match(/CREATE OR REPLACE FUNCTION public\.set_exhibition_publication\([\s\S]*?END \$\$;/)?.[0];
assert.ok(functionSql, 'publication function must be present');
const clearing = /SET wall_identifier = NULL,\s*position_3d = NULL,\s*rotation_3d = NULL,\s*updated_at = now\(\)/;
assert.match(functionSql, clearing, 'review the function before updating this regression');
const proposed = functionSql.replace(clearing, 'SET wall_identifier = NULL, updated_at = now()');
const db = await createDatabase(stopBefore);
const id = 'luminous-veil';
const position = [7.5, 1.8, -4.25];
const rotation = [0, 0.4, 0];
async function geometry() {
  const result = await db.query('SELECT wall_identifier,position_3d,rotation_3d FROM public.artworks WHERE id=$1', [id]);
  return result.rows[0];
}
try {
  await db.query('UPDATE public.artworks SET position_3d=$1::jsonb,rotation_3d=$2::jsonb WHERE id=$3',
    [JSON.stringify(position), JSON.stringify(rotation), id]);
  await db.query("SELECT public.set_exhibition_publication(true,'local-regression')");
  let row = await geometry();
  assert.equal(row.wall_identifier, 'main-west-1');
  assert.equal(row.position_3d, null, 'current function destroys a custom position');
  assert.equal(row.rotation_3d, null, 'current function destroys a custom rotation');

  await db.exec(proposed);
  await db.query('UPDATE public.artworks SET position_3d=$1::jsonb,rotation_3d=$2::jsonb WHERE id=$3',
    [JSON.stringify(position), JSON.stringify(rotation), id]);
  for (const publish of [true, true, false, true]) {
    await db.query('SELECT public.set_exhibition_publication($1,$2)', [publish, 'local-regression']);
    row = await geometry();
    assert.equal(row.wall_identifier, 'main-west-1');
    assert.deepEqual(row.position_3d, position);
    assert.deepEqual(row.rotation_3d, rotation);
  }
  console.log('PASS local publication regression: current coordinate loss reproduced; proposed in-memory fix preserves geometry across publish/hide/republish');
} finally { await db.close(); }
