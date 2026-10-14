// Read-only diagnostics. Names/statuses only; no URLs, keys, returned rows or provider messages.
import { createClient } from "@supabase/supabase-js";
const required=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const missing=required.filter(name=>!process.env[name]);
if(missing.length){console.error("BLOCKED: missing variable names:",missing.join(", "));process.exit(2);}
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let publicKey=key.startsWith("sb_publishable_");
try{publicKey ||= JSON.parse(Buffer.from(key.split(".")[1],"base64url")).role==="anon";}catch{/* unsupported format */}
if(!publicKey){console.error("BLOCKED: public client key role was not verified.");process.exit(2);}
let client;
try{client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}catch{console.error("BLOCKED: invalid public Supabase configuration.");process.exit(2);}
const code=error=>/^[A-Z0-9_]{1,40}$/.test(error?.code||"")?error.code:"NETWORK_OR_SERVICE_ERROR";
let issues=0;
for(const table of ["artworks","commissions","commission_files","commission_events","notification_jobs","payment_events","commission_refunds","quote_templates"]){
 const field=table==="payment_events"?"event_id":"id";
 const probe=await client.from(table).select(field).limit(0);
 if(probe.error){console.log(table,"REQUEST_REJECTED",code(probe.error));continue;}
 const result=await client.from(table).select(field,{head:true,count:"exact"}).limit(0);
 if(result.error)console.log(table,"COUNT_NOT_VERIFIED",code(result.error));
 else if(table==="artworks")console.log(table,"CATALOG_READ_REACHABLE");
 else if(result.count>0){console.log(table,"ANONYMOUS_ROWS_VISIBLE");issues++;}
 else console.log(table,"NO_ANONYMOUS_ROWS_OBSERVED_NOT_PROOF_OF_RLS");
}
for(const field of ["id","artwork_id","ip_hash","viewed_at"]){
 const probe=await client.from("artwork_views").select(field).limit(0);
 if(probe.error)console.log("artwork_views."+field,"REQUEST_REJECTED",code(probe.error));
 else{
  const count=await client.from("artwork_views").select(field,{head:true,count:"exact"}).limit(0);
  if(count.error)console.log("artwork_views."+field,"COUNT_NOT_VERIFIED",code(count.error));
  else if(count.count>0){console.log("artwork_views."+field,"ANONYMOUS_ROWS_VISIBLE");issues++;}
  else console.log("artwork_views."+field,"READ_PRIVILEGE_PRESENT_RLS_NOT_VERIFIED");
 }
}
for(const field of ["publication_status","sale_status","draft_wall_identifier"]){
 const {error}=await client.from("artworks").select(field).limit(0);
 console.log("artworks."+field,error?"COLUMN_NOT_VERIFIED":"COLUMN_AVAILABLE",error?code(error):"");
}
console.log("SERVICE_ROLE_CONFIGURATION",process.env.SUPABASE_SERVICE_ROLE_KEY?"SET":"MISSING");
console.log("OWNER_CONFIGURATION",process.env.ADMIN_EMAIL?"SET":"MISSING");
console.log("SCOPE","read-only anon diagnostics; no authenticated-role, table/column grant inventory, Storage/Auth or hosted migration verification");
if(issues)process.exitCode=1;