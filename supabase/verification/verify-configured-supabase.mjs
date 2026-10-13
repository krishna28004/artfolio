// Read-only diagnostics. Logs names/statuses only, never URLs, keys or returned rows.
import { createClient } from '@supabase/supabase-js';
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const missing=required.filter(name=>!process.env[name]);
if(missing.length) { console.error('BLOCKED: missing variable names:',missing.join(', ')); process.exit(2); }
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let publicKey=key.startsWith('sb_publishable_');
try { publicKey ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon'; } catch { /* unsupported key format */ }
if(!publicKey) { console.error('BLOCKED: public client key has an unverified or privileged role.'); process.exit(2); }
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let issues=0;
for(const table of ['artworks','commissions','commission_files','commission_events','notification_jobs','payment_events','commission_refunds','quote_templates','artwork_views']) {
  const field=table==='payment_events'?'event_id':table==='artwork_views'?'id,ip_hash,viewed_at':'id';
  const {error,count}=await client.from(table).select(field,{head:true,count:'exact'}).limit(0);
  if(error) console.log(table, 'REQUEST_REJECTED', error.code||'NETWORK_OR_SERVICE_ERROR');
  else if(table==='artworks') console.log(table,'CATALOG_READ_REACHABLE');
  else if(count>0) { console.log(table,'ANONYMOUS_ROWS_VISIBLE'); issues++; }
  else console.log(table,'NO_ANONYMOUS_ROWS_OBSERVED');
}
const {error}=await client.from('artworks').select('publication_status,sale_status,draft_wall_identifier').limit(0);
console.log('ARTWORK_PUBLICATION_SCHEMA',error?'NOT_VERIFIED':'COLUMNS_AVAILABLE',error?.code||'');
console.log('SERVICE_ROLE_CONFIGURATION',process.env.SUPABASE_SERVICE_ROLE_KEY?'SET':'MISSING');
console.log('OWNER_CONFIGURATION',process.env.ADMIN_EMAIL?'SET':'MISSING');
console.log('SCOPE','read-only anon diagnostics; empty tables do not prove RLS and rejected requests do not prove migrations exist');
if(issues) process.exitCode=1;
