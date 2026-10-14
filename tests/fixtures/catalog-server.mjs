import { createServer } from "node:http";
import { artworks } from "../../src/features/artwork/data/artworks.ts";
let mode = "legacy";
const rows = artworks.map((a,i)=>({id:a.id,title:a.title,artist:a.artist,year:a.year,description:a.description,image_url:a.imageUrl,image_urls:[a.imageUrl],thumbnail_url:a.imageUrl,texture_url:a.textureUrl,medium:a.medium,dimensions:a.dimensions,price:a.price,category:a.category,is_available:a.isAvailable,sale_status:a.isAvailable?"available":"not_for_sale",publication_status:"published",wall_identifier:a.wallIdentifier,position_3d:a.position3D,rotation_3d:a.rotation3D,display_order:i,created_at:"2024-01-01T00:00:00Z"}));
createServer((req,res)=>{
  const url=new URL(req.url,"http://127.0.0.1:3102");
  res.setHeader("Content-Type","application/json");
  if(url.pathname==="/fixture"){
    const next=url.searchParams.get("mode");if(["legacy","modern","empty","failure"].includes(next))mode=next;
    res.end(JSON.stringify({mode}));return;
  }
  if(req.method!=="GET"||!url.pathname.startsWith("/rest/v1/")){res.writeHead(404);res.end("{}");return;}
  const table=url.pathname.split("/").at(-1),probe=url.searchParams.get("select")==="publication_status";
  if(mode==="failure"||mode==="legacy"&&probe){res.writeHead(400);res.end(JSON.stringify({code:mode==="failure"?"42501":"42703",message:"Synthetic fixture failure"}));return;}
  let data=table==="artworks"?(mode==="empty"||probe?[]:rows.map(a=>{if(mode!=="legacy")return {...a,publication_status:a.display_order===8?"draft":a.display_order===9?"archived":"published"};const copy={...a};delete copy.publication_status;delete copy.sale_status;delete copy.image_urls;return copy;})):table==="exhibition_settings"?[{id:"main",is_published:true}]:[];
  for(const [field,value] of url.searchParams)if(value.startsWith("eq."))data=data.filter(a=>String(a[field])===value.slice(3));
  res.setHeader("Content-Range",data.length?"0-"+(data.length-1)+"/"+data.length:"*/0");
  res.end(JSON.stringify(req.headers.accept?.includes("vnd.pgrst.object+json")?data[0]||null:data));
}).listen(3102,"127.0.0.1",()=>console.log("Local synthetic catalog fixture ready; no hosted service connection."));