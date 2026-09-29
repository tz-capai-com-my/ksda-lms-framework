// Framework-owned deterministic runtime identity. Does not import, approve or activate content.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const paths=[];
async function visit(dir){
 for(const item of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,item.name);
  if(item.isDirectory())await visit(path);
  else if(item.isFile() && /\.(tsx?|css|json|mjs|sql)$/.test(item.name) && relative(root,path)!=='app/learn/reading-build.ts')paths.push(path);
 }
}
await visit(resolve(root,'app'));
await visit(resolve(root,'config'));
// Local fallback course definitions and video configuration also affect mission semantics.
await visit(resolve(root,'content/ksda'));
await visit(resolve(root,'worker'));
await visit(resolve(root,'build'));
await visit(resolve(root,'supabase/migrations'));
await visit(resolve(root,'supabase/functions'));
for (const name of ['proxy.ts','package.json','package-lock.json','vite.config.ts','next.config.ts','tsconfig.json']) paths.push(resolve(root,name));
const manifest=await Promise.all(paths.sort((a,b)=>relative(root,a).localeCompare(relative(root,b),'en')).map(async path=>({path:relative(root,path).split('\\').join('/'),sha256:sha256(await readFile(path))})));
const codeHash=sha256(JSON.stringify(manifest));
await writeFile(resolve(root,'content/reading-code-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(resolve(root,'app/learn/reading-build.ts'),'// Framework-owned runtime identity. Regenerate content release bindings after runtime changes.\nexport const READING_CODE_HASH = '+JSON.stringify(codeHash)+';\n');
console.log(JSON.stringify({code_hash:codeHash,files:manifest.length,publication:false}));
