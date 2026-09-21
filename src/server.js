import {createApp} from './app.js';
import {createDatabase} from './db.js';
import {configuration} from './config.js';
const config=configuration();
if(process.env.NODE_ENV==='production'&&(!config.origin.startsWith('https://')||!config.googleClientId||!config.googleClientSecret))throw new Error('Production requires HTTPS and Google Workspace OAuth.');
const db=await createDatabase({env:process.env,purpose:'runtime'});
const server=createApp({db,config}).listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('Platinum Bleu dashboard listening.'));
process.on('SIGTERM',()=>server.close(async()=>{await db?.close();process.exit(0);}));
