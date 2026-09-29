// LOCAL VISUAL/INTERACTION FIXTURE ONLY. Never deploy this server.
// Uses the real built worker and optional example bytes, synthetic identities,
// an in-memory HTTP database adapter and blocked external transports.
// Run after build: node tests/fixture-server.mjs [port, default 0].
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {register,syncBuiltinESMExports} from 'node:module';
import net from 'node:net';
import dns from 'node:dns';
import {createHash} from 'node:crypto';
register('./cloudflare-workers-loader.mjs',import.meta.url);
const root=resolve(import.meta.dirname,'..'),clientRoot=resolve(root,'dist/client');
const exampleRoot=resolve(root,'examples/capai-community-reading');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const [bundle,catalogue]=await Promise.all([json(resolve(exampleRoot,'bundle.json')),json(resolve(root,'config/course-catalogue.json'))]);
const delivery=bundle.releases.find(r=>r.id===bundle.delivery_id);
if(!delivery)throw Error('Build the optional example package before starting this fixture.');
const manifest=JSON.parse(delivery.manifest_text);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const {READING_CODE_HASH}=await import('../app/learn/reading-build.ts');
if(delivery.code_hash!==READING_CODE_HASH)throw Error('EXAMPLE_CODE_HASH_STALE: regenerate code identity/examples, then rebuild.');
process.env.SUPABASE_URL='https://frameworkexample.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_offline_fixture';
process.env.KSDA_READING_DELIVERY_ENABLED='true';
// Never use inherited application/provider credentials, even if present.
for(const name of Object.keys(process.env))if(/(?:SUPABASE|CAPAI|SMTP|DATABASE|CLOUDFLARE|KSDA_ADMIN)/.test(name)&&!['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'].includes(name))delete process.env[name];
const user={id:'00000000-0000-4000-8000-000000000123',aud:'authenticated',role:'authenticated',email:'visual-fixture@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
const profile={user_id:user.id,display_name:'Local visual fixture',preferred_language:'en',onboarding_completed:true,account_status:'active'};
const courses=catalogue.map((c,i)=>({id:`00000000-0000-4000-8000-${String(i+101).padStart(12,'0')}`,slug:c.databaseSlug,title:c.title,short_description:c.outcome,experience_style:'mission',access_type:'free',status:'published',sort_order:i+1,localSlug:c.slug}));
const enrolments=courses.map(c=>({user_id:user.id,course_id:c.id,status:'active'}));
const progress=courses.map(c=>({user_id:user.id,course_id:c.id,current_mission:'1',progress_percentage:0,last_activity_at:null,completed_at:null}));
const markers=new Map(),revisions=new Map(),photos=new Map();
function contained(base,relative){const path=resolve(base,relative);if(!path.startsWith(base+sep))throw Error('PATH_OUTSIDE_FIXTURE');return path;}
for(const r of bundle.revisions){const text=await readFile(contained(exampleRoot,r.file),'utf8');if(hash(text)!==r.revision_hash)throw Error('REVISION_CHANGED');revisions.set(r.mission_id,{...r,payload_text:text});}
for(const p of bundle.photos){const bytes=await readFile(contained(exampleRoot,p.file));if(hash(bytes)!==p.sha256)throw Error('PHOTO_CHANGED');photos.set(p.asset_id,{...p,body:bytes.toString('base64')});}
const emptyMarkers=()=>({reviewed:{},last_block_id:null,updated_at:null});
function eligible(mission){
 const entry=manifest.missions.find(m=>m.mission_id===mission),course=courses.find(c=>c.localSlug===entry?.course_key);
 if(!entry||!course)return false;
 const order=manifest.missions.filter(m=>m.course_key===entry.course_key).findIndex(m=>m.mission_id===mission)+1;
 return order<=Number(progress.find(p=>p.course_id===course.id)?.current_mission??0);
}
function rowsResponse(rows,request,url){
 const selected=rows.filter(row=>[...url.searchParams].every(([k,v])=>['select','order','limit','offset'].includes(k)||v.startsWith('eq.')&&String(row[k])===v.slice(3)||v.startsWith('in.(')&&v.slice(4,-1).split(',').map(x=>x.replace(/^"|"$/g,'')).includes(String(row[k]))));
 const cols=url.searchParams.get('select'),data=selected.map(row=>cols&&cols!=='*'?Object.fromEntries(cols.split(',').map(k=>[k,row[k]])):{...row});
 return request.headers.get('accept')?.includes('application/vnd.pgrst.object+json')?(data.length===1?Response.json(data[0]):Response.json({code:'PGRST116',message:'Fixture row missing',details:`${data.length} rows`},{status:406})):Response.json(data);
}
const denied=()=>Response.json({code:'42501',message:'Synthetic fixture access denied'},{status:403});
globalThis.fetch=async(input,init)=>{
 const request=new Request(input,init),url=new URL(request.url);
 if(url.origin!==process.env.SUPABASE_URL)throw Error('FIXTURE_EXTERNAL_NETWORK_BLOCKED');
 if(request.headers.get('authorization')!=='Bearer local-visual-fixture-token')return denied();
 if(url.pathname==='/auth/v1/user')return Response.json(user);
 const table=url.pathname.replace('/rest/v1/','');
 if(table==='profiles'&&request.method==='GET')return rowsResponse([profile],request,url);
 if(table==='courses'&&request.method==='GET')return rowsResponse(courses,request,url);
 if(table==='module_enrolments'&&request.method==='GET')return rowsResponse(enrolments,request,url);
 if(table==='module_progress'&&request.method==='GET')return rowsResponse(progress,request,url);
 if(table==='module_progress'&&request.method==='PATCH'){
  const values=await request.json();
  if(Object.keys(values).some(k=>!['current_mission','progress_percentage','last_activity_at','completed_at'].includes(k)))return denied();
  const row=progress.find(p=>url.searchParams.get('user_id')==='eq.'+user.id&&url.searchParams.get('course_id')==='eq.'+p.course_id&&url.searchParams.get('current_mission')==='eq.'+p.current_mission&&url.searchParams.get('progress_percentage')==='eq.'+p.progress_percentage);
  if(!row)return Response.json(null);
  Object.assign(row,values);return Response.json({...row});
 }
 if(table.startsWith('rpc/ksda_reading_')){
  const p=await request.json();
  if(p.p_scope!=='learner'||p.p_release&&p.p_release!==delivery.id)return denied();
  if(table==='rpc/ksda_reading_delivery'){
   if(!p.p_mission)return Response.json({...delivery,release_id:delivery.id,publication_active:true,progress_scope:'learner'});
   const r=revisions.get(p.p_mission);if(!r||!eligible(p.p_mission))return denied();
   return Response.json({...delivery,release_id:delivery.id,status:'approved',payload_text:r.payload_text,revision_hash:r.revision_hash,block_ids:r.block_ids,publication_active:true,progress_scope:'learner',progress:markers.get(p.p_mission)??emptyMarkers()});
  }
  if(table==='rpc/ksda_reading_delivery_asset'){
   const a=photos.get(p.p_asset);if(!a||!eligible(a.mission_id))return denied();
   return Response.json({body:a.body,encoding:'base64',hash:a.sha256,expected_hash:a.sha256,mime:a.mime,width:a.width,height:a.height,code_hash:delivery.code_hash});
  }
  if(table==='rpc/ksda_reading_delivery_progress'){
   const r=revisions.get(p.p_mission);if(!r||!eligible(p.p_mission)||p.p_revision!==r.revision_hash)return denied();
   if(!p.p_reviewed||Object.entries(p.p_reviewed).some(([key,val])=>!r.block_ids.includes(key)||!['self_confirmed','viewport_dwell'].includes(val))||p.p_last!==null&&!r.block_ids.includes(p.p_last))return denied();
   const saved=markers.get(p.p_mission)??emptyMarkers();Object.assign(saved.reviewed,p.p_reviewed);saved.last_block_id=p.p_last;saved.updated_at=new Date().toISOString();markers.set(p.p_mission,saved);return Response.json(saved);
  }
 }
 throw Error('UNEXPECTED_FIXTURE_REQUEST '+request.method+' '+url.pathname);
};
// Block accidental unmocked network access below fetch as well. Listening remains loopback-only.
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(){throw Error('FIXTURE_OUTBOUND_SOCKET_BLOCKED');};
const lookup=dns.lookup;
dns.lookup=function(host,...args){if(host!=='127.0.0.1')throw Error('FIXTURE_EXTERNAL_DNS_BLOCKED');return lookup.call(this,host,...args);};
syncBuiltinESMExports();
const worker=(await import('../dist/server/index.js')).default;
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon'};
async function assetResponse(request){
 const url=new URL(request.url),rel=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=contained(clientRoot,rel||'index.html');
 try{if(!(await stat(file)).isFile())return null;return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]??'application/octet-stream'}});}catch{return null;}
}
const bindings={ASSETS:{fetch:async request=>(await assetResponse(request))??new Response('Not found',{status:404})}},ctx={waitUntil(p){p.catch(()=>{});},passThroughOnException(){}};
const port=Number(process.argv[2]??0);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Port must be 0–65535');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let address;
const server=createServer(async(req,res)=>{
 try{
  if(req.headers.host!==address){res.writeHead(403);res.end('Loopback fixture host required');return;}
  const url=new URL(req.url,'http://'+address);
  if(url.pathname==='/__fixture'){
   const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local KSDA fixture</title><body><h1>Local interaction fixture</h1><p>Synthetic automatic login. No real provider or database. State lives in this process only. Selecting a mission positions its synthetic progress for review.</p><ul>'+manifest.missions.map(m=>'<li><a href="/__fixture/select?mission='+encodeURIComponent(m.mission_id)+'">'+escape(m.course_key+' · '+m.mission_id+' · '+m.title.en)+'</a></li>').join('')+'</ul></body></html>';
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
  }
  if(url.pathname==='/__fixture/select'){
   const mission=url.searchParams.get('mission'),m=manifest.missions.find(m=>m.mission_id===mission),course=courses.find(c=>c.localSlug===m?.course_key);if(!m||!course){res.writeHead(404);res.end('Unknown fixture mission');return;}
   const ordered=manifest.missions.filter(x=>x.course_key===m.course_key),index=ordered.findIndex(x=>x.mission_id===mission);Object.assign(progress.find(p=>p.course_id===course.id),{current_mission:String(index+1),progress_percentage:Math.floor(100*index/ordered.length),completed_at:null});
   res.writeHead(303,{Location:'/learn/courses/'+encodeURIComponent(course.localSlug)+'/missions/'+encodeURIComponent(mission),'Cache-Control':'no-store'});res.end();return;
  }
  let body=Buffer.alloc(0);for await(const chunk of req){body=Buffer.concat([body,chunk]);if(body.length>16384){res.writeHead(413);res.end();return;}}
  const session={access_token:'local-visual-fixture-token',refresh_token:'local-visual-fixture-refresh',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user};
  const cookie='sb-frameworkexample-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
  const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  headers.set('cookie',(req.headers.cookie?req.headers.cookie+'; ':'')+cookie);
  const request=new Request(url,{method:req.method,headers,...(body.length?{body}:{} )});
  const response=await assetResponse(request)??await worker.fetch(request,bindings,ctx);
  res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));
  res.setHeader('Set-Cookie',cookie+'; Path=/; SameSite=Lax; Max-Age=86400');
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-KSDA-Fixture','synthetic-local-only');
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'none'; form-action 'self'; base-uri 'none'");
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Fixture request failed:',error.message);res.writeHead(500,{'Content-Type':'text/plain'});res.end('Local fixture error; inspect the fixture terminal.');}
});
server.listen(port,'127.0.0.1',()=>{address='127.0.0.1:'+server.address().port;console.log('LOCAL FIXTURE ONLY: http://'+address+'/__fixture');console.log('Synthetic account; no external network, provider login or durable data. Stop with Ctrl+C.');});
process.on('SIGINT',()=>{net.Socket.prototype.connect=connect;server.close(()=>process.exit(0));});
