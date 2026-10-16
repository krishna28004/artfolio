// Prepare a local review artifact only. No remote client or database command.
import {readFileSync,readdirSync,writeFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export const expectedMigrations=[
 "20260923000000_initial_schema.sql",
 "20260924000000_production_schema_and_seed.sql",
 "20260924010000_secure_commission_rls.sql",
 "20260924020000_fix_payment_constraints.sql",
 "20261011000000_commission_reference_public_id.sql",
 "20261011010000_private_commission_workflow.sql",
 "20261011020000_atomic_deliverable_release.sql",
 "20261011030000_artwork_publication.sql",
 "20261011040000_artist_workspace.sql",
 "20261013000000_owner_session_revocation.sql",
 "20261013010000_rehearsal_security_hardening.sql",
 "20261014000000_commission_availability.sql",
 "20261015000000_owner_portal_login_controls.sql",
 "20261016000000_preserve_exhibition_coordinates.sql",
 "20261016010000_secure_legacy_public_tables.sql",
];
export function buildRehearsalSql(){
 const directory=resolve(root,"supabase/migrations");
 const actual=readdirSync(directory).filter(name=>name.endsWith(".sql")).sort();
 if(JSON.stringify(actual)!==JSON.stringify(expectedMigrations))throw Error("Migration inventory changed; review the explicit order before preparing SQL.");
 const manifest=[];
 const guard=[
  "-- PREPARED ONLY. No remote execution authorized by this file.",
  "BEGIN;",
  "DO $preflight$",
  "BEGIN",
  " IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) THEN RAISE EXCEPTION 'fresh_empty_public_schema_required'; END IF;",
  " IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regclass('auth.sessions') IS NULL THEN RAISE EXCEPTION 'supabase_system_schema_required'; END IF;",
  " IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='auth' AND table_name='sessions' AND column_name IN ('id','user_id','not_after','created_at'))<>4 THEN RAISE EXCEPTION 'auth_session_columns_required'; END IF;",
  " IF NOT has_table_privilege(current_user,'auth.sessions','SELECT') THEN RAISE EXCEPTION 'migration_owner_requires_auth_session_read'; END IF;",
  " IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))<>3 THEN RAISE EXCEPTION 'supabase_roles_required'; END IF;",
  "END $preflight$;",
 ].join("\n");
 const blocks=expectedMigrations.map(name=>{
  const bytes=readFileSync(resolve(directory,name));
  manifest.push({name,sha256:createHash("sha256").update(bytes).digest("hex")});
  return "\n-- Migration: "+name+"\n"+bytes.toString("utf8").replace(/^\uFEFF/,"");
 });
 const sql=guard+blocks.join("\n")+"\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n";
 return{sql,manifest};
}
if(process.argv[1]&&resolve(process.argv[1]).toLowerCase()===fileURLToPath(import.meta.url).toLowerCase()){
 const index=process.argv.indexOf("--output");
 if(index<0||!process.argv[index+1]){console.error("Usage: node scripts/prepare-rehearsal-sql.mjs --output <LOCAL_FILE>");process.exit(2);}
 const output=resolve(process.argv[index+1]);
 const prepared=buildRehearsalSql();
 writeFileSync(output,prepared.sql,"utf8");
 writeFileSync(output+".manifest.json",JSON.stringify(prepared.manifest,null,2),"utf8");
 console.log(JSON.stringify({scope:"LOCAL FILE PREPARATION ONLY",migrations:prepared.manifest.length,sha256:createHash("sha256").update(prepared.sql).digest("hex")}));
}
