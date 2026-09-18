import {createApp} from './app.js';
import {createDatabase} from './db.js';
import {configuration} from './config.js';
const config=configuration();
if(process.env.NODE_ENV==='production'&&(!config.origin.startsWith('https://')||!process.env.DATABASE_URL||!config.googleClientId||!config.googleClientSecret))throw new Error('Production requires HTTPS, PostgreSQL, and Google Workspace OAuth.');
const db=createDatabase(process.env.DATABASE_URL);
if(process.env.NODE_ENV==='production'){
 const {rows:[role]}=await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
 const {rows:[ownership]}=await db.query("SELECT count(*)::int AS owned FROM pg_tables WHERE schemaname='public' AND tableowner=current_user");
 if(role?.rolsuper||role?.rolbypassrls||ownership?.owned)throw new Error('Production requires a separate non-owner runtime database role without RLS bypass.');
}
const server=createApp({db,config}).listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('Platinum Bleu dashboard listening.'));
process.on('SIGTERM',()=>server.close(async()=>{await db?.close();process.exit(0);}));
