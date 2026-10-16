// Synthetic populated baseline: never reads or connects to production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabase, files, repo } from '../supabase/verification/local-postgres-fixture.mjs';

const firstPending = '20261011000000_commission_reference_public_id.sql';
const pending = files.slice(files.indexOf(firstPending));
assert.equal(pending.length, 11, 'review the production upgrade inventory before changing it');
const db = await createDatabase(firstPending);
try {
  const id = randomUUID();
  await db.query(`INSERT INTO public.commissions
    (id,idempotency_key,name,email,size,budget,message,status)
    VALUES ($1,$2,'Synthetic Collector','collector@example.invalid','A4','test','Synthetic request','pending')`,
  [id, `test-${id}`]);
  const originalArtworks = await db.query('SELECT id,title,description,image_url FROM public.artworks ORDER BY id');

  await db.transaction(async tx => {
    for (const file of pending) {
      await tx.exec(readFileSync(resolve(repo, 'supabase/migrations', file), 'utf8'));
    }
  });

  const commission = await db.query('SELECT id,email,status,request_reference FROM public.commissions WHERE id=$1', [id]);
  assert.equal(commission.rows.length, 1);
  assert.equal(commission.rows[0].email, 'collector@example.invalid');
  assert.equal(commission.rows[0].status, 'pending');
  assert.match(commission.rows[0].request_reference, /^AF-[0-9A-F]{12}$/);
  const artworks = await db.query('SELECT id,title,description,image_url FROM public.artworks ORDER BY id');
  assert.deepEqual(artworks.rows, originalArtworks.rows);

  await db.transaction(async tx => {
    await tx.query("SELECT public.set_exhibition_publication(true,'synthetic-test')");
    const missing = await tx.query('SELECT count(*) AS count FROM public.artworks WHERE wall_identifier IS NOT NULL AND (position_3d IS NULL OR rotation_3d IS NULL)');
    assert.equal(Number(missing.rows[0].count), 0);
  });
  console.log('PASS synthetic populated-baseline upgrade: eleven forward migrations preserve a pending commission and catalog content');
} finally { await db.close(); }
