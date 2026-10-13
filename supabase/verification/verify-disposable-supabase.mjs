// Read-only checks against an explicitly identified disposable Supabase project.
// Does not apply migrations, create users, send email, or initiate payments.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
const required=['ARTFOLIO_TEST_SUPABASE_URL','ARTFOLIO_TEST_SUPABASE_ANON_KEY','ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY','ARTFOLIO_TEST_PROJECT_REF'];
const missing=required.filter(name=>!process.env[name]);
if(missing.length) { console.error('BLOCKED: missing configuration names:', missing.join(', ')); process.exit(2); }
const url=new URL(process.env.ARTFOLIO_TEST_SUPABASE_URL);
if(url.protocol!=='https:' || url.hostname!==process.env.ARTFOLIO_TEST_PROJECT_REF+'.supabase.co' || url.username || url.password) {
  console.error('BLOCKED: disposable project identity must match the dedicated HTTPS project URL.'); process.exit(2);
}
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const anon=createClient(url.href,process.env.ARTFOLIO_TEST_SUPABASE_ANON_KEY,options);
const service=createClient(url.href,process.env.ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY,options);
let passed=0,failed=0;
async function check(name,fn) {
  try { await fn(); passed++; console.log('PASS',name); }
  catch(error) { failed++; console.error('FAIL',name,'code:',error.code||'ASSERTION'); }
}
function requireResult(condition) { if(!condition) throw Object.assign(new Error('check failed'),{code:'ASSERTION'}); }
const tables=['commissions','commission_files','commission_events','notification_jobs','payment_events','commission_refunds','payments','audit_logs','quote_templates','exhibition_settings','artwork_views'];
for(const table of tables) await check('service schema and anonymous exposure sanity check: '+table,async()=>{
  const valid=await service.from(table).select(table==='payment_events'?'event_id':'id').limit(1);
  if(valid.error) throw valid.error;
  const anonymous=await anon.from(table).select(table==='payment_events'?'event_id':'id').limit(1);
  requireResult(anonymous.error?.code==='42501'||(!anonymous.error&&anonymous.data?.length===0));
});
await check('anonymous catalog contains published artworks only',async()=>{
  const result=await anon.from('artworks').select('id,publication_status').limit(1000);
  if(result.error) throw result.error;
  requireResult(Array.isArray(result.data)&&result.data.every(art=>art.publication_status==='published'));
});
await check('commission bucket is private and artwork bucket is public',async()=>{
  const privateBucket=await service.storage.getBucket('commission-private');
  const publicBucket=await service.storage.getBucket('artworks-public');
  if(privateBucket.error) throw privateBucket.error; if(publicBucket.error) throw publicBucket.error;
  requireResult(privateBucket.data?.public===false&&publicBucket.data?.public===true);
});
for(const [name,args] of [
  ['commission_business_metrics',{}],['commission_unread_counts',{}],
  ['is_owner_session_active',{p_session_id:randomUUID(),p_user_id:randomUUID()}],
]) await check('restricted read RPC: '+name,async()=>{
  const read=await service.rpc(name,args); if(read.error) throw read.error;
  if(name==='is_owner_session_active') requireResult(read.data===false);
  const publicCall=await anon.rpc(name,args);
  requireResult(['42501','PGRST202'].includes(publicCall.error?.code));
});
console.log(JSON.stringify({passed,failed,scope:'read-only disposable Supabase preflight; storage-object/MFA/payment/email workflows remain separate live checks'}));
if(failed) process.exitCode=1;
