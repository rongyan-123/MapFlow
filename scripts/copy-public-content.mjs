import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const content=JSON.parse(await readFile(new URL('src/content/publicContent.json',root),'utf8'));
if(content.schemaVersion!==1||!content.agentGuide.length||!content.learningGuide.length)throw new Error('Public content is incomplete');
const ids=content.agentGuide.map(section=>section.id);
if(new Set(ids).size!==ids.length||ids.some(id=>!/^[a-z0-9-]+$/.test(id)))throw new Error('Public guide identifiers must be unique and URL-safe');
await mkdir(new URL('public/',root),{recursive:true});
await writeFile(new URL('public/public-content.json',root),JSON.stringify(content));
for(const [source,target] of [['src/ui/public/public-site.css','public-site.css'],['src/ui/public/public-site.js','public-site.js']]){
  await writeFile(new URL('public/'+target,root),await readFile(new URL(source,root)));
}
console.log('Shared public content and reading assets ready at '+fileURLToPath(new URL('public/',root)));
