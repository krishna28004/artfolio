// Local SQL runtime only. Minimal Auth/Storage fixtures do not implement hosted services.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const modulePath = process.env.PGLITE_MODULE_PATH;
const { PGlite } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : '@electric-sql/pglite');
const repo = process.env.ARTFOLIO_REPOSITORY || resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrations = resolve(repo, 'supabase/migrations');
const files = readdirSync(migrations).filter(f => f.endsWith('.sql')).sort();
const bootstrap = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text); GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role; GRANT ALL ON storage.objects TO anon,authenticated,service_role; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_public_objects ON storage.objects USING(true) WITH CHECK(true);
CREATE SCHEMA auth; CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);`;
export async function createDatabase(stopBefore) {
  const db = await PGlite.create();
  await db.exec(bootstrap);
  try {
    for (const file of files) {
      if (file === stopBefore) break;
      await db.transaction(tx => tx.exec(readFileSync(resolve(migrations, file), 'utf8')));
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}

export { files, repo };
