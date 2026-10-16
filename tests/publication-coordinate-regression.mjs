// Local PostgreSQL fixture only. Exercise the actual forward migration.
import assert from 'node:assert/strict';
import { createDatabase } from '../supabase/verification/local-postgres-fixture.mjs';

const db = await createDatabase();
const id = 'luminous-veil';
const position = [7.5, 1.8, -4.25];
const rotation = [0, 0.4, 0];
async function geometry() {
  const result = await db.query('SELECT wall_identifier,draft_wall_identifier,position_3d,rotation_3d FROM public.artworks WHERE id=$1', [id]);
  return result.rows[0];
}
try {
  await db.query('UPDATE public.artworks SET position_3d=$1::jsonb,rotation_3d=$2::jsonb WHERE id=$3',
    [JSON.stringify(position), JSON.stringify(rotation), id]);
  for (const publish of [true, true, false, true]) {
    await db.query('SELECT public.set_exhibition_publication($1,$2)', [publish, 'local-regression']);
    const row = await geometry();
    assert.equal(row.wall_identifier, 'main-west-1');
    assert.equal(row.draft_wall_identifier, 'main-west-1');
    assert.deepEqual(row.position_3d, position);
    assert.deepEqual(row.rotation_3d, rotation);
  }
  const anonymous = await db.query("SELECT has_function_privilege('anon','public.set_exhibition_publication(boolean,text)','EXECUTE') AS allowed");
  assert.equal(anonymous.rows[0].allowed, false);
  console.log('PASS local publication regression: 15-migration sequence preserves custom geometry across publish/hide/republish and denies anon execution');
} finally { await db.close(); }
