// Offline configuration review only. No SDK, fetch, sockets or remote commands.
import {readFileSync} from "node:fs";
const names=["ARTFOLIO_TEST_PROJECT_REF","ARTFOLIO_TEST_SUPABASE_URL","ARTFOLIO_TEST_SUPABASE_ANON_KEY","ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const missing=names.filter(n=>!process.env[n]);
const result={scope:"OFFLINE ONLY",missing,disposableConfirmed:process.env.ARTFOLIO_TEST_DISPOSABLE_CONFIRMED==="true",commissionsDisabled:process.env.ARTFOLIO_COMMISSIONS_ENABLED==="false",paymentsDisabled:process.env.ARTFOLIO_PAYMENTS_ENABLED==="false",urlRefMatches:false,separateFromDefaultConfig:false,keyRoleFormats:false,keyProjectClaimsMatch:false};
function role(key){try{return JSON.parse(Buffer.from(key.split(".")[1],"base64url"));}catch{return null;}}
if(!missing.length){
 try{
  const url=new URL(process.env.ARTFOLIO_TEST_SUPABASE_URL);
  result.urlRefMatches=url.protocol==="https:"&&url.hostname===process.env.ARTFOLIO_TEST_PROJECT_REF+".supabase.co"&&url.pathname==="/"&&!url.username&&!url.password&&!url.search&&!url.hash;
  const publicKey=process.env.ARTFOLIO_TEST_SUPABASE_ANON_KEY,secretKey=process.env.ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY;
  const p=role(publicKey),s=role(secretKey);
  result.keyRoleFormats=(publicKey.startsWith("sb_publishable_")||p?.role==="anon")&&(secretKey.startsWith("sb_secret_")||s?.role==="service_role");
  result.keyProjectClaimsMatch=(!p?.ref||p.ref===process.env.ARTFOLIO_TEST_PROJECT_REF)&&(!s?.ref||s.ref===process.env.ARTFOLIO_TEST_PROJECT_REF);
  let current="";
  try{current=readFileSync(".env.local","utf8").match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^"'\s]+)/m)?.[1]||"";}catch{/* absent default config */}
  result.separateFromDefaultConfig=!!current&&new URL(current).hostname!==url.hostname;
 }catch{/* retain failed boolean checks, never print provider/config values */}
}
console.log(JSON.stringify(result,null,2));
console.log("Dashboard name/reference/branch and actual privileges remain MANUAL CHECKS. This does not authorize SQL execution.");
if(missing.length||!result.disposableConfirmed||!result.commissionsDisabled||!result.paymentsDisabled||!result.urlRefMatches||!result.separateFromDefaultConfig||!result.keyRoleFormats||!result.keyProjectClaimsMatch)process.exitCode=2;
