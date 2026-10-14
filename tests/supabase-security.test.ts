import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { verifyAdminAuth, _setAuthClientFactoryForTesting } from "../src/features/admin/utils/auth.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { GET as fileGET } from "../src/app/api/commission/file/[id]/route.ts";
import { POST as ownerAction } from "../src/app/api/admin/commission-action/route.ts";
import { POST as createArtwork } from "../src/app/api/admin/artworks/route.ts";
import { PATCH as patchArtwork, DELETE as archiveArtwork } from "../src/app/api/admin/artworks/[id]/route.ts";
import { notificationRecipientAllowed, queueCommissionNotice } from "../src/features/commission/server/notifications.ts";
import { hashAccessToken, accessCookieName } from "../src/features/commission/server/customer-access.ts";
import { POST as webhook } from "../src/app/api/payment/webhook/route.ts";
import { computeHmacSha256 } from "../src/shared/utils/crypto.ts";
import { getClientIp, checkDistributedRateLimit } from "../src/shared/utils/rate-limit.ts";
import { logSecurityFailure } from "../src/shared/utils/security-log.ts";
import { GET as ownerList } from "../src/app/api/admin/commissions/route.ts";
process.env.ADMIN_EMAIL = "owner@example.test";
process.env.ADMIN_API_SECRET = "isolated-local-security-admin-secret";
delete process.env.ADMIN_NOTIFICATION_EMAIL;
const ownerId=randomUUID(),sessionId=randomUUID();
type Options={confirmed?:boolean;email?:string;aal?:string;active?:boolean;claimsOwner?:string;claimsSession?:string;claimsError?:boolean;sessionError?:boolean};
function authFixture(options:Options={}){
 const o={confirmed:true,email:process.env.ADMIN_EMAIL,aal:"aal2",active:true,claimsOwner:ownerId,claimsSession:sessionId,...options};
 _setAuthClientFactoryForTesting((async()=>({auth:{
  async getUser(){return{data:{user:{id:ownerId,email:o.email,email_confirmed_at:o.confirmed?"2026-01-01":null}},error:null};},
  mfa:{async getAuthenticatorAssuranceLevel(){return{data:{currentLevel:o.aal},error:null};}},
  async getClaims(){return{data:{claims:{sub:o.claimsOwner,session_id:o.claimsSession,aal:o.aal}},error:o.claimsError?{}:null};},
 }})) as never);
 _setAdminInstanceForTesting({async rpc(name:string,args:Record<string,unknown>){
  assert.equal(name,"is_owner_session_active");assert.equal(args.p_user_id,ownerId);assert.equal(args.p_session_id,sessionId);
  return{data:o.active,error:o.sessionError?{}:null};
 }} as never);
}
afterEach(()=>{_setAuthClientFactoryForTesting(null);_setAdminInstanceForTesting(null);delete process.env.ADMIN_NOTIFICATION_EMAIL;});
const ownerRequest=(route:string,body:object={})=>new NextRequest("http://localhost"+route,{method:"POST",headers:{"content-type":"application/json","x-admin-key":process.env.ADMIN_API_SECRET!},body:JSON.stringify(body)});
test("verified owner AAL2 and active session are authorized",async()=>{authFixture();assert.equal((await verifyAdminAuth()).authorized,true);});
test("unconfirmed and foreign users cannot impersonate owner metadata",async()=>{
 for(const o of [{confirmed:false},{email:"attacker@example.test"}]){authFixture(o);assert.equal((await verifyAdminAuth()).authorized,false);}
});
test("AAL1 session cannot read privileged records, while bootstrap remains scoped",async()=>{
 authFixture({aal:"aal1"});assert.equal((await verifyAdminAuth()).authorized,false);
 assert.equal((await verifyAdminAuth(undefined,{requireMfa:false})).authorized,true);
 const response=await ownerList(new NextRequest("http://localhost/api/admin/commissions?status=auth"));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true});
});
test("revoked or unverifiable owner sessions fail even during MFA bootstrap",async()=>{
 for(const o of [{active:false},{sessionError:true},{claimsError:true},{claimsOwner:randomUUID()},{claimsSession:"forged"}]){
  authFixture(o);assert.equal((await verifyAdminAuth(undefined,{requireMfa:false})).authorized,false);
 }
});
test("API key callers cannot bypass cross-origin mutation checks",async()=>{
 const request=new NextRequest("http://localhost/api/admin/commission-action",{method:"POST",headers:{"x-admin-key":process.env.ADMIN_API_SECRET!,origin:"https://attacker.example"}});
 assert.equal((await verifyAdminAuth(request)).authorized,false);
 assert.equal((await verifyAdminAuth(ownerRequest("/api/admin/commission-action"))).authorized,true);
});
function downloadFixture(released:boolean,pathOverride?:string){
 const id=randomUUID(),fileId=randomUUID(),hash=hashAccessToken("isolated-customer-proof");
 let signed=0;
 _setAuthClientFactoryForTesting((async()=>({auth:{async getUser(){return{data:{user:null},error:null};}}})) as never);
 _setAdminInstanceForTesting({from(table:string){
  const data=table==="commission_files"?{id:fileId,commission_id:id,kind:"deliverable",delivered_at:released?"2026-01-01":null,storage_path:pathOverride||"deliveries/"+id+"/"+fileId+".png"}:{id,tracking_token_hash:hash,status:"revision_requested"};
  const q={select(){return q;},eq(){return q;},update(){return q;},async maybeSingle(){return{data,error:null};},then(resolve:(x:unknown)=>unknown){return Promise.resolve({data,error:null}).then(resolve);}};
  return q;
 },storage:{from(){return{async createSignedUrl(){signed++;return{data:{signedUrl:"https://example.test/private-signed-fixture"},error:null};}};}}} as never);
 return {id,fileId,signed:()=>signed,req:()=>new NextRequest("http://localhost/api/commission/file/"+fileId+"?commissionId="+id,{headers:{cookie:accessCookieName(id)+"="+hash}})};
}
test("revision stage does not expose a newly staged deliverable",async()=>{
 const f=downloadFixture(false);assert.equal((await fileGET(f.req(),{params:Promise.resolve({id:f.fileId})})).status,403);assert.equal(f.signed(),0);
});
test("previously released deliverable remains available during revision",async()=>{
 const f=downloadFixture(true);const response=await fileGET(f.req(),{params:Promise.resolve({id:f.fileId})});
 assert.equal(response.status,307);assert.equal(f.signed(),1);assert.equal(response.headers.get("cache-control"),"private, no-store");
});
test("authorized customers still cannot sign unsafe or cross-commission storage paths",async()=>{
 for(const path of ["../private.png","deliveries/"+randomUUID()+"/"+randomUUID()+".png"]){
  const f=downloadFixture(true,path);assert.equal((await fileGET(f.req(),{params:Promise.resolve({id:f.fileId})})).status,404);assert.equal(f.signed(),0);
 }
});
test("caller actor/email fields do not authorize an owner action",async()=>{
 authFixture({email:"attacker@example.test"});
 const req=new NextRequest("http://localhost/api/admin/commission-action",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:randomUUID(),action:"start",actor:"owner",email:process.env.ADMIN_EMAIL})});
 assert.equal((await ownerAction(req)).status,401);
});
test("owner delivery invokes one atomic release RPC and no direct status/file writes",async()=>{
 const id=randomUUID();let name="";const q={select(){return q;},eq(){return q;},async maybeSingle(){return{data:{id,status:"ready_for_delivery",email:"collector@example.test",quote_version:1},error:null};},then(resolve:(x:unknown)=>unknown){return Promise.resolve({count:1,error:null}).then(resolve);}};
 _setAdminInstanceForTesting({from(){return q;},async rpc(n:string){name=n;return{data:randomUUID(),error:null};}} as never);
 assert.equal((await ownerAction(ownerRequest("/api/admin/commission-action",{id,action:"deliver"}))).status,200);
 assert.equal(name,"release_commission_deliverables");
});
test("new artwork defaults to draft and creation does not overwrite an existing record",async()=>{
 let saved:Record<string,unknown>={};
 _setAdminInstanceForTesting({from(table:string){return{insert(row:Record<string,unknown>){if(table==="artworks")saved=row;return{select(){return{async single(){return{data:row,error:null};}};}};}};}} as never);
 const response=await createArtwork(ownerRequest("/api/admin/artworks",{id:"local-new-art",title:"New artwork",imageUrl:"https://example.test/image.png"}));
 assert.equal(response.status,200);assert.equal(saved.publication_status,"draft");
});
test("archive changes publication, not just sale availability",async()=>{
 let updated:Record<string,unknown>={};
 const q={select(){return q;},eq(){return q;},update(row:Record<string,unknown>){updated=row;return q;},async single(){return{data:updated,error:null};},insert(){return Promise.resolve({error:null});}};
 _setAdminInstanceForTesting({from(){return q;}} as never);
 const request=new NextRequest("http://localhost/api/admin/artworks/local",{method:"DELETE",headers:{"x-admin-key":process.env.ADMIN_API_SECRET!}});
 assert.equal((await archiveArtwork(request,{params:Promise.resolve({id:"local"})})).status,200);assert.equal(updated.publication_status,"archived");assert.equal(updated.is_available,false);
});
test("invalid artwork fields are rejected before a privileged update",async()=>{
 _setAdminInstanceForTesting({from(){throw Error("database-must-not-be-called");}} as never);
 const req=new NextRequest("http://localhost/api/admin/artworks/local",{method:"PATCH",headers:{"x-admin-key":process.env.ADMIN_API_SECRET!,"content-type":"application/json"},body:JSON.stringify({publicationStatus:"private-ish",priceInRupees:-1})});
 assert.equal((await patchArtwork(req,{params:Promise.resolve({id:"local"})})).status,400);
});
test("notification destinations require exact customer or configured owner identity",()=>{
 assert.equal(notificationRecipientAllowed("customer","collector@example.test","collector@example.test"),true);
 assert.equal(notificationRecipientAllowed("owner","owner@example.test","collector@example.test"),true);
 for(const recipient of ["attacker@example.test","collector@example.test,bcc@example.test","collector@example.test\r\nBcc:x@example.test"]){
  assert.equal(notificationRecipientAllowed("customer",recipient,"collector@example.test"),false);
 }
 assert.equal(notificationRecipientAllowed("unknown","owner@example.test","collector@example.test"),false);
});
test("notification queue rejects a customer address swap before inserting an outbox job",async()=>{
 let writes=0;const q={select(){return q;},eq(){return q;},async maybeSingle(){return{data:{email:"collector@example.test"},error:null};},async upsert(){writes++;return{error:null};}};
 _setAdminInstanceForTesting({from(){return q;}} as never);
 assert.equal(await queueCommissionNotice(randomUUID(),randomUUID(),"attacker@example.test","customer"),false);assert.equal(writes,0);
});
test("signed financial payload determines webhook identity, not the unsigned event header", async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET="isolated-local-webhook-secret";
  const receipts=new Map<string,Record<string,unknown>>();
  _setAdminInstanceForTesting({from(table:string){
    let id="";
    const q={select(){return q;},eq(_field:string,value:string){id=value;return q;},
      async maybeSingle(){return {data:table==="payment_events"?receipts.get(id)||null:null,error:null};},
      async insert(row:Record<string,unknown>){const key=String(row.event_id);if(receipts.has(key))return{error:{code:"23505"}};receipts.set(key,{...row});return{error:null};},
      update(row:Record<string,unknown>){Object.assign(q,{changes:row});return q;},changes:{} as Record<string,unknown>,
      then(resolve:(value:unknown)=>unknown){if(receipts.has(id))Object.assign(receipts.get(id)!,q.changes);return Promise.resolve({error:null}).then(resolve);},
    };return q;
  }} as never);
  const send=async(payment:string,header:string)=>{
    const body=JSON.stringify({event:"payment.failed",payload:{payment:{entity:{id:payment,order_id:"order-"+payment,amount:10000,currency:"INR"}}}});
    return webhook(new Request("http://localhost/api/payment/webhook",{method:"POST",headers:{"x-razorpay-event-id":header,"x-razorpay-signature":computeHmacSha256(body,process.env.RAZORPAY_WEBHOOK_SECRET!)},body}));
  };
  assert.equal((await send("first-payment","shared-header")).status,200);
  assert.equal((await send("first-payment","different-header")).status,200);
  assert.equal(receipts.size,1);
  assert.equal((await send("second-payment","shared-header")).status,200);
  assert.equal(receipts.size,2);
});
test("forged webhook signatures fail before any privileged lookup", async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET="isolated-local-webhook-secret";
  _setAdminInstanceForTesting({from(){throw Error("no-database-access-before-signature");}} as never);
  const response=await webhook(new Request("http://localhost/api/payment/webhook",{method:"POST",headers:{"x-razorpay-signature":"forged"},body:"{}"}));
  assert.equal(response.status,403);
});
test("production IP attribution ignores arbitrary forwarded headers outside trusted ingress", () => {
  const mode=process.env.NODE_ENV,vercel=process.env.VERCEL;
  Object.assign(process.env,{NODE_ENV:"production"});delete process.env.VERCEL;
  try {
    assert.equal(getClientIp(new Request("http://localhost",{headers:{"x-forwarded-for":"192.0.2.1"}})),"untrusted-client");
    process.env.VERCEL="1";
    assert.equal(getClientIp(new Request("http://localhost",{headers:{"x-vercel-forwarded-for":"192.0.2.2","x-forwarded-for":"192.0.2.99"}})),"192.0.2.2");
    assert.equal(getClientIp(new Request("http://localhost",{headers:{"x-vercel-forwarded-for":"192.0.2.2, 192.0.2.99"}})),"untrusted-client");
  } finally {
    if(mode===undefined)Reflect.deleteProperty(process.env,"NODE_ENV");else Object.assign(process.env,{NODE_ENV:mode});
    if(vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=vercel;
  }
});
test("production limiter cannot silently fall back to per-process memory",async()=>{
 const mode=process.env.NODE_ENV;Object.assign(process.env,{NODE_ENV:"production"});
 try {assert.equal((await checkDistributedRateLimit("isolated-security",50,3600000)).success,false);}
 finally {if(mode===undefined)Reflect.deleteProperty(process.env,"NODE_ENV");else Object.assign(process.env,{NODE_ENV:mode});}
});
test("security logging excludes private messages, input and token-shaped details",()=>{
 const original=console.error;const output:unknown[][]=[];
 console.error=(...args:unknown[])=>{output.push(args);};
 try {logSecurityFailure("[OWNER_ACTION] private-input-sentinel",{code:"42501",message:"private-token-sentinel",details:"private-url-sentinel"});}
 finally {console.error=original;}
 const serialized=JSON.stringify(output);assert.ok(serialized.includes("42501"));assert.ok(!serialized.includes("private"));
});