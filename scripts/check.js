import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const directory of ['src','scripts','public'])for(const name of await readdir(new URL('../'+directory+'/',import.meta.url)))if(name.endsWith('.js')){const path=new URL('../'+directory+'/'+name,import.meta.url);const result=spawnSync(process.execPath,['--check',fileURLToPath(path)],{stdio:'inherit'});if(result.status!==0)process.exit(1);}
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');for(const asset of ['app.js','styles.css','favicon.svg']){await readFile(new URL('../public/'+asset,import.meta.url));if(!html.includes('/'+asset))throw new Error('Missing asset reference: '+asset);}console.log('JavaScript syntax and entrypoint assets verified.');
