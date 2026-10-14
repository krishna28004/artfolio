// Read-only diagnostics for a separately confirmed disposable project.
// This never applies migrations, creates fixture rows/users, sends mail or starts payments.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const required=["ARTFOLIO_TEST_SUPABASE_URL","ARTFOLIO_TEST_SUPABASE_ANON_KEY","ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY","ARTFOLIO_TEST_PROJECT_REF"];
const missing=required.filter(name=>!process.env[name]);
if(missing.length){console.error("BLOCKED: missing configuration names:",missing.join(", "));process.exit(2);}
if(process.env.ARTFOLIO_TEST_DISPOSABLE_CONFIRMED!=="true"){console.error("BLOCKED: disposable-project confirmation is required.");process.exit(2);}
let url;
try{url=new URL(process.env.ARTFOLIO_TEST_SUPABASE_URL);}catch{console.error("BLOCKED: invalid dedicated project URL.");process.exit(2);}
if(url.protocol!=="https:"||url.hostname!==process.env.ARTFOLIO_TEST_PROJECT_REF+".supabase.co"||url.username||url.password||url.search||url.hash||url.pathname!=="/"){console.error("BLOCKED: dedicated project identity does not match.");process.exit(2);}
function keyRole(key){try{return JSON.parse(Buffer.from(key.split(".")[1],"base64url")).role;}catch{return null;}}
const publicKey=process.env.ARTFOLIO_TEST_SUPABASE_ANON_KEY,serviceKey=process.env.ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY;
if(!(publicKey.startsWith("sb_publishable_")||keyRole(publicKey)==="anon")||!(serviceKey.startsWith("sb_secret_")||keyRole(serviceKey)==="service_role")){console.error("BLOCKED: expected public and server-only key roles were not verified.");process.exit(2);}
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const anon=createClient(url.href,publicKey,options),service=createClient(url.href,serviceKey,options);
let passed=0,failed=0,unverified=0;
async function check(name,fn){try{const verified=await fn();if(verified===false){unverified++;console.log("NOT VERIFIED",name);}else{passed++;console.log("PASS",name);}}catch(error){failed++;const code=String(error?.code||"ASSERTION");console.error("FAIL",name,"code:",/^[A-Z0-9_]{1,40}$/.test(code)?code:"UNAVAILABLE");}}
function requireResult(condition){if(!condition)throw Object.assign(new Error("check failed"),{code:"ASSERTION"});}
const tables=["commissions","commission_files","commission_events","notification_jobs","payment_events","commission_refunds","payments","audit_logs","quote_templates","exhibition_settings","artwork_views"];
for(const table of tables)await check("anonymous read restriction: "+table,async()=>{
 const field=table==="payment_events"?"event_id":"id";
 const valid=await service.from(table).select(field,{head:true,count:"exact"}).limit(0);if(valid.error)throw valid.error;
 const result=await anon.from(table).select(field).limit(1);
 if(result.error){requireResult(result.error.code==="42501");return;}
 requireResult(result.data?.length===0);
 // Empty source tables cannot demonstrate that RLS actually hides a populated record.
 return typeof valid.count==="number"&&valid.count>0;
});
await check("published catalog remains visible",async()=>{
 const result=await anon.from("artworks").select("id,publication_status").limit(1000);if(result.error)throw result.error;
 requireResult(Array.isArray(result.data)&&result.data.every(a=>a.publication_status==="published"));
 return result.data.length>0;
});
await check("draft and archived fixture records are hidden",async()=>{
 for(const state of ["draft","archived"]){
  const baseline=await service.from("artworks").select("id",{head:true,count:"exact"}).eq("publication_status",state).limit(0);if(baseline.error)throw baseline.error;
  const result=await anon.from("artworks").select("id").eq("publication_status",state).limit(1);if(result.error)throw result.error;
  requireResult(result.data?.length===0);if(!baseline.count)return false;
 }
});
await check("bucket metadata: commission private / artwork public",async()=>{
 const privateBucket=await service.storage.getBucket("commission-private"),publicBucket=await service.storage.getBucket("artworks-public");
 if(privateBucket.error)throw privateBucket.error;if(publicBucket.error)throw publicBucket.error;
 requireResult(privateBucket.data?.public===false&&publicBucket.data?.public===true);
});
for(const [name,args] of [["commission_business_metrics",{}],["commission_unread_counts",{}],["is_owner_session_active",{p_session_id:randomUUID(),p_user_id:randomUUID()}]])await check("restricted read RPC: "+name,async()=>{
 const read=await service.rpc(name,args);if(read.error)throw read.error;if(name==="is_owner_session_active")requireResult(read.data===false);
 const call=await anon.rpc(name,args);requireResult(["42501","PGRST202"].includes(call.error?.code));
});
console.log(JSON.stringify({passed,failed,unverified,scope:"read-only disposable preflight; no authenticated-user, object download/upload, real MFA, payment, mail or concurrency verification"}));
if(failed)process.exitCode=1;else if(unverified)process.exitCode=2;