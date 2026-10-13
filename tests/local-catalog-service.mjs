// Local test adapter for published catalog browser checks. Never connects to Supabase.
import { createServer } from 'node:http';
import { createDatabase } from '../supabase/verification/local-postgres-fixture.mjs';
const db=await createDatabase();
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:3102');
  const table=url.pathname.split('/').at(-1);
  const allowed=['artworks','exhibition_settings','artwork_views'];
  const role=req.headers.apikey==='artfolio-local-service-fixture'?'service_role':'anon';
  res.setHeader('Content-Type','application/json');
  if(!url.pathname.startsWith('/rest/v1/')||!allowed.includes(table)||!['GET','HEAD'].includes(req.method)){
    res.writeHead(404);res.end(JSON.stringify({code:'LOCAL_READONLY_FIXTURE'}));return;
  }
  try {
    const params=[],filters=[];
    for(const field of ['id','publication_status','artwork_id','ip_hash']){
      const filter=url.searchParams.get(field);
      if(filter?.startsWith('eq.')) {params.push(filter.slice(3));filters.push(field+'=$'+params.length);}
    }
    const where=filters.length?' WHERE '+filters.join(' AND '):'';
    const data=await db.transaction(async tx=>{
      await tx.exec('SET LOCAL ROLE '+role);
      return tx.query('SELECT * FROM public.'+table+where+(table==='artworks'?' ORDER BY display_order,created_at DESC':''),params);
    });
    const rows=data.rows;
    res.setHeader('Content-Range',rows.length?'0-'+(rows.length-1)+'/'+rows.length:'*/0');
    res.writeHead(200);
    const result=req.headers.accept?.includes('vnd.pgrst.object+json')?rows[0]||null:rows;
    res.end(req.method==='HEAD'?'':JSON.stringify(result));
  } catch(error) { res.writeHead(400);res.end(JSON.stringify({code:error.code||'FIXTURE_ERROR',message:'Local fixture request failed'})); }
});
server.listen(3102,'127.0.0.1',()=>console.log('Local PostgreSQL catalog fixture listening on loopback; no hosted services connected.'));
async function close(){server.close();await db.close();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
