// Executes repository SQL in an in-memory PostgreSQL engine. No remote connections.
// Auth/Storage service schemas are minimal fixtures, not the actual Supabase services.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabase, files, repo } from './local-postgres-fixture.mjs';
const migrations = resolve(repo, 'supabase/migrations');
let passed = 0, failed = 0;
const db = await createDatabase();
const query = (sql, params = []) => db.query(sql, params);
const row = async (sql, params = []) => (await query(sql, params)).rows[0];
const value = async (sql, params = []) => Object.values(await row(sql, params))[0];
const count = async (table, id) => Number(await value(`SELECT count(*) FROM public.${table} WHERE commission_id=$1`, [id]));
async function asRole(role, sql, params = []) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  return db.transaction(async tx => { await tx.exec(`SET LOCAL ROLE ${role}`); return tx.query(sql, params); });
}
async function rejects(fn, pattern) { await assert.rejects(fn, pattern); }
async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failed++; console.error('FAIL', name, '-', error.message); }
}
async function commission(status = 'pending', quote = false) {
  const id = randomUUID();
  await query(`INSERT INTO public.commissions(id,idempotency_key,name,email,size,budget,message,status,price,
    request_reference,quote_version,accepted_quote_version,quote_scope,quote_terms,revision_allowance,expires_at)
    VALUES($1::uuid,$1::text,'Test Collector','collector@example.invalid','A3','test','Test inquiry',$2,10000,
    $3,$4,$5,'One original portrait','One revision before release',1,now()+interval '1 day')`,
    [id,status,'AF-TEST-'+id,quote ? 1 : 0,quote && status !== 'quote_sent' ? 1 : null]);
  return id;
}
const transition = (id, status, next, action, actor = 'owner') => query(
  `SELECT public.apply_commission_transition($1,$2,0,$3,$4,$5,$5,'Test update','{}','{}','owner@example.invalid','owner')`,
  [id,status,next,action,actor]);
try {
  console.log('LOCAL ONLY', await value('SELECT version()'));
  console.log('MIGRATIONS EXECUTED', files.length);
  await check('all migration files execute and bucket metadata preserves privacy', async () => {
    assert.equal(await value("SELECT public FROM storage.buckets WHERE id='commission-private'"), false);
    assert.equal(await value("SELECT public FROM storage.buckets WHERE id='artworks-public'"), true);
    assert.equal(Number(await value('SELECT count(*) FROM public.artworks')), 10);
  });
  await check('anon and authenticated roles see published catalog only and cannot write it', async () => {
    await query("INSERT INTO public.artworks(id,title,image_url,publication_status) VALUES('local-draft','Draft','/test.png','draft'),('local-archived','Archived','/test.png','archived')");
    for (const role of ['anon','authenticated']) {
      const result = await asRole(role, 'SELECT id FROM public.artworks');
      assert.equal(result.rows.length, 10);
      assert.ok(!result.rows.some(r => r.id.startsWith('local-')));
      await rejects(() => asRole(role,"INSERT INTO public.artworks(id,title,image_url) VALUES('unauthorized','No','/test.png')"), /row-level security|permission denied/);
      assert.equal((await asRole(role,'SELECT id FROM public.commissions')).rows.length, 0);
    }
  });
  await check('private tables and all privileged RPCs reject public roles', async () => {
    for (const role of ['anon','authenticated']) {
      for (const table of ['commission_files','commission_events','notification_jobs','payment_events','commission_refunds','quote_templates','artwork_views']) {
        await rejects(() => asRole(role, `SELECT * FROM public.${table}`), /permission denied/);
      }
      const privileges = await query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege($1,p.oid,'EXECUTE')`, [role]);
      assert.deepEqual(privileges.rows, []);
    }
  });
  await check('submission retries produce exactly one event/audit and two notices', async () => {
    const id = await commission();
    const first = await asRole('service_role','SELECT public.ensure_commission_submission_events($1,$2)',[id,'owner@example.invalid']);
    const second = await asRole('service_role','SELECT public.ensure_commission_submission_events($1,$2)',[id,'owner@example.invalid']);
    assert.deepEqual(first.rows, second.rows);
    assert.equal(await count('commission_events',id),1); assert.equal(await count('notification_jobs',id),2);
    assert.equal(Number(await value('SELECT count(*) FROM public.audit_logs WHERE target_id=$1',[id])),1);
  });
  await check('quote acceptance rejects null/stale values and commits acceptance plus notice', async () => {
    const id = await commission('quote_sent',true);
    for (const [version,hash,expires] of [[null,'a'.repeat(64),new Date(Date.now()+3600000)],[1,null,new Date(Date.now()+3600000)],[1,'a'.repeat(64),null],[2,'a'.repeat(64),new Date(Date.now()+3600000)]]) {
      await rejects(() => query('SELECT public.accept_commission_quote_with_notice($1,$2,$3,$4,$5)',[id,version,hash,expires,'owner@example.invalid']),/quote_not_acceptable/);
    }
    assert.equal(await value('SELECT status FROM public.commissions WHERE id=$1',[id]),'quote_sent');
    await query("SELECT public.accept_commission_quote_with_notice($1,1,$2,now()+interval '1 hour','owner@example.invalid')",[id,'a'.repeat(64)]);
    assert.equal(await value('SELECT status FROM public.commissions WHERE id=$1',[id]),'approved');
    assert.equal(await count('commission_events',id),1); assert.equal(await count('notification_jobs',id),1);
  });
  await check('captured payment mismatch and duplicate callbacks cannot corrupt ledger or progress', async () => {
    const id = await commission('approved',true), order='order-'+id, payment='pay-'+id;
    await query("SELECT public.attach_commission_order($1,$2,10000,'INR')",[id,order]);
    await rejects(() => query("SELECT public.record_commission_capture($1,$2,$3,10001,'INR')",[id,order,payment]),/capture_mismatch/);
    await rejects(() => query("SELECT public.record_commission_capture($1,$2,$3,10000,'USD')",[id,order,payment]),/capture_mismatch/);
    await query("SELECT public.record_commission_capture($1,$2,$3,10000,'INR',NULL,$4)",[id,order,payment,'capture-'+id]);
    await query("SELECT public.record_commission_capture($1,$2,$3,10000,'INR',NULL,$4)",[id,order,payment,'capture-'+id]);
    await query("UPDATE public.commissions SET status='in_progress' WHERE id=$1",[id]);
    await query("SELECT public.record_commission_capture($1,$2,$3,10000,'INR')",[id,order,payment]);
    assert.equal(await count('payments',id),1); assert.equal(await count('commission_events',id),1);
    assert.equal(await count('notification_jobs',id),1); assert.equal(await value('SELECT status FROM public.commissions WHERE id=$1',[id]),'in_progress');
  });
  await check('partial/full and late/duplicate refunds retain confirmed financial state', async () => {
    const id=await commission('approved',true), order='refund-order-'+id, payment='refund-pay-'+id;
    await query("SELECT public.attach_commission_order($1,$2,10000,'INR')",[id,order]);
    await query("SELECT public.record_commission_capture($1,$2,$3,10000,'INR')",[id,order,payment]);
    async function refund(event, refund, amount, processed) {
      await query("INSERT INTO public.payment_events(event_id,event_type) VALUES($1,'refund.processed') ON CONFLICT DO NOTHING",[event]);
      return value('SELECT public.record_commission_refund($1,$2,$3,$4,$5)',[event,refund,payment,amount,processed]);
    }
    const rid='refund-'+id;
    assert.equal(await refund('event-1-'+id,rid,2500,true),'partially_refunded');
    assert.equal(await refund('event-2-'+id,rid,2500,false),'initiated');
    assert.equal(await value('SELECT status FROM public.commission_refunds WHERE razorpay_refund_id=$1',[rid]),'processed');
    assert.equal(await value('SELECT status FROM public.payments WHERE commission_id=$1',[id]),'captured');
    assert.equal(await refund('event-3-'+id,'remaining-'+id,7500,true),'fully_refunded');
    assert.equal(await value('SELECT status FROM public.payments WHERE commission_id=$1',[id]),'refunded');
    await rejects(() => refund('event-over-'+id,'over-'+id,1,true),/refund_total_exceeds_capture/);
    assert.equal(await count('commission_refunds',id),2);
    assert.equal(await count('notification_jobs',id),3);
  });
  await check('failed release rolls back files, status, event, audit and notice together', async () => {
    const id=await commission('ready_for_delivery');
    await query("INSERT INTO public.commission_files(commission_id,kind,storage_path,file_name,content_type,size_bytes) VALUES($1,'deliverable',$2,'final.png','image/png',100)",[id,'deliverable/'+id]);
    await db.exec(`CREATE FUNCTION public.fail_test_delivery_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='deliver' THEN RAISE EXCEPTION 'forced_audit_failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_test_delivery BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.fail_test_delivery_audit();`);
    await rejects(() => query("SELECT public.release_commission_deliverables($1,'owner')",[id]),/forced_audit_failure/);
    assert.equal(await value('SELECT delivered_at FROM public.commission_files WHERE commission_id=$1',[id]),null);
    assert.equal(await value('SELECT status FROM public.commissions WHERE id=$1',[id]),'ready_for_delivery');
    assert.equal(await count('commission_events',id),0); assert.equal(await count('notification_jobs',id),0);
    await db.exec('DROP TRIGGER fail_test_delivery ON public.audit_logs; DROP FUNCTION public.fail_test_delivery_audit();');
    await query("SELECT public.release_commission_deliverables($1,'owner')",[id]);
    assert.equal(await value('SELECT status FROM public.commissions WHERE id=$1',[id]),'delivered');
    assert.ok(await value('SELECT delivered_at FROM public.commission_files WHERE commission_id=$1',[id]));
    assert.equal(await count('commission_events',id),1); assert.equal(await count('notification_jobs',id),1);
  });
  await check('revision allowance is enforced on the actual customer event name', async () => {
    const id=await commission('in_progress');
    await query('UPDATE public.commissions SET revision_allowance=0 WHERE id=$1',[id]);
    await rejects(() => transition(id,'in_progress','revision_requested','revision_requested','customer'), /revision_allowance_exhausted/);
    assert.equal(await value('SELECT status FROM public.commissions WHERE id=$1',[id]),'in_progress');
  });
  await check('read acknowledgements preserve customer messages arriving after the displayed snapshot', async () => {
    const id=await commission();
    const old=await row("INSERT INTO public.commission_events(commission_id,actor_type,event_type,created_at) VALUES($1,'customer','message',now()-interval '1 hour') RETURNING created_at",[id]);
    await query("INSERT INTO public.commission_events(commission_id,actor_type,event_type) VALUES($1,'customer','message')",[id]);
    await query('SELECT public.mark_commission_owner_read($1,$2)',[id,old.created_at]);
    assert.equal(Number(await value('SELECT unread_count FROM public.commission_unread_counts() WHERE commission_id=$1',[id])),1);
    await rejects(() => query("SELECT public.mark_commission_owner_read($1,now()+interval '1 day')",[id]),/invalid_read_boundary/);
    assert.equal(Number(await value('SELECT unread_count FROM public.commission_unread_counts() WHERE commission_id=$1',[id])),1);
  });
  await check('stale state writes fail without events or notices', async () => {
    const id=await commission('in_progress');
    await rejects(() => transition(id,'paid','ready_for_delivery','ready'), /commission_changed/);
    assert.equal(await count('commission_events',id),0); assert.equal(await count('notification_jobs',id),0);
  });
  await check('private reference claims are one-time and cannot move across commissions', async () => {
    const a=await commission(),b=await commission(),file=randomUUID(),hash='a'.repeat(64);
    await query("INSERT INTO public.commission_files(id,kind,storage_path,file_name,content_type,size_bytes,claim_hash) VALUES($1,'reference',$2,'ref.png','image/png',100,$3)",[file,'ref/'+file,hash]);
    const claims=JSON.stringify([{id:file,hash}]);
    await query('SELECT public.attach_commission_references($1,$2)',[a,claims]);
    await query('SELECT public.attach_commission_references($1,$2)',[a,claims]);
    await rejects(() => query('SELECT public.attach_commission_references($1,$2)',[b,claims]),/invalid_file_claim/);
    assert.equal(await value('SELECT commission_id FROM public.commission_files WHERE id=$1',[file]),a);
  });
  await check('template writes are audited and inaccessible to public clients', async () => {
    const inserted=await asRole('service_role',"INSERT INTO public.quote_templates(title,scope,terms) VALUES('Test','Original portrait scope','Revision and release terms') RETURNING id");
    const id=inserted.rows[0].id;
    await asRole('service_role','DELETE FROM public.quote_templates WHERE id=$1',[id]);
    assert.equal(Number(await value("SELECT count(*) FROM public.audit_logs WHERE target_id=$1 AND target_type='quote_template'",[id])),2);
  });
  await check('exhibition publication swaps staged placements atomically and unpublishes', async () => {
    const a='luminous-veil',b='the-dreamer';
    const slots=await query('SELECT id,draft_wall_identifier FROM public.artworks WHERE id IN ($1,$2) ORDER BY id',[a,b]);
    const first=slots.rows.find(r=>r.id===a).draft_wall_identifier, second=slots.rows.find(r=>r.id===b).draft_wall_identifier;
    await query('UPDATE public.artworks SET draft_wall_identifier=NULL WHERE id IN ($1,$2)',[a,b]);
    await query('UPDATE public.artworks SET draft_wall_identifier=$2 WHERE id=$1',[a,second]);
    await query('UPDATE public.artworks SET draft_wall_identifier=$2 WHERE id=$1',[b,first]);
    await asRole('service_role',"SELECT public.set_exhibition_publication(true,'owner')");
    assert.equal(await value('SELECT wall_identifier FROM public.artworks WHERE id=$1',[a]),second);
    await asRole('service_role',"SELECT public.set_exhibition_publication(false,'owner')");
    assert.equal(await value("SELECT is_published FROM public.exhibition_settings WHERE id='main'"),false);
  });
  await check('session activity is bound to owner, expiry and row existence', async () => {
    const session=randomUUID(),owner=randomUUID();
    await query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[session,owner]);
    const active=()=>asRole('service_role','SELECT public.is_owner_session_active($1,$2) AS active',[session,owner]);
    assert.equal((await active()).rows[0].active,true);
    assert.equal((await asRole('service_role','SELECT public.is_owner_session_active($1,$2) AS active',[session,randomUUID()])).rows[0].active,false);
    await query("UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=$1",[session]);
    assert.equal((await active()).rows[0].active,false);
    await query('DELETE FROM auth.sessions WHERE id=$1',[session]);
    assert.equal((await active()).rows[0].active,false);
    await rejects(() => asRole('anon','SELECT public.is_owner_session_active($1,$2)',[session,owner]),/permission denied/);
  });
  await check('narrow telemetry remediation closes public and column grants while preserving the service role', async () => {
    await db.exec("GRANT SELECT ON public.artwork_views TO PUBLIC; GRANT SELECT(ip_hash) ON public.artwork_views TO anon; CREATE POLICY extra_test_reader ON public.artwork_views FOR SELECT USING(true);");
    await query("INSERT INTO public.artwork_views(artwork_id,ip_hash) VALUES('luminous-veil','synthetic-test-hash')");
    assert.equal((await asRole('anon','SELECT ip_hash FROM public.artwork_views')).rows.length,1);
    await db.exec(readFileSync(resolve(repo,'supabase/verification/telemetry-access-remediation.sql'),'utf8'));
    await rejects(() => asRole('anon','SELECT ip_hash FROM public.artwork_views'),/permission denied/);
    await asRole('service_role',"INSERT INTO public.artwork_views(artwork_id,ip_hash) VALUES('luminous-veil','synthetic-service-test')");
    assert.equal((await asRole('service_role','SELECT id FROM public.artwork_views')).rows.length,2);
  });
  await check('read-only inventory works before and after publication columns exist', async () => {
    const sql=readFileSync(resolve(repo,'supabase/verification/pre-migration-inventory.sql'),'utf8');
    await db.exec(sql);
    const prior=await createDatabase('20261011030000_artwork_publication.sql');
    try { await prior.exec(sql); } finally { await prior.close(); }
  });
  await check('a failed migration transaction leaves its schema unchanged', async () => {
    const local=await createDatabase('20261011030000_artwork_publication.sql');
    try {
      await local.query("INSERT INTO public.artworks(id,title,image_url,wall_identifier) VALUES('collision','Collision','/test.png','main-west-1')");
      await rejects(() => local.transaction(tx=>tx.exec(readFileSync(resolve(migrations,'20261011030000_artwork_publication.sql'),'utf8'))), /duplicate key|unique index/);
      const columns=await local.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='artworks' AND column_name='publication_status'");
      assert.equal(columns.rows.length,0);
    } finally { await local.close(); }
  });
} finally { await db.close(); }
console.log(JSON.stringify({ passed, failed, migrations: files.length, engine: 'PGlite PostgreSQL', scope: 'local SQL with synthetic Auth/Storage schemas; no live services or multi-connection concurrency' }));
if (failed) process.exitCode=1;
