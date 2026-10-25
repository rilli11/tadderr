// Backend لموقع لجنة التنظيم — Node.js بدون أي مكتبات خارجية.
// التشغيل:  node server.js   (PORT=3000 DATA=./data/db.json افتراضيًا)
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=+process.env.PORT||3000,FILE=process.env.DATA||path.join(__dirname,'data','db.json'),PUB=fs.existsSync(path.join(__dirname,'public'))?path.join(__dirname,'public'):__dirname;
fs.mkdirSync(path.dirname(FILE),{recursive:true});
let DB={};try{DB=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
let timer=null;const flush=()=>{clearTimeout(timer);timer=setTimeout(()=>{const t=FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(DB));fs.renameSync(t,FILE)},150)};
const clients=new Set();const emit=c=>{for(const r of clients)r.write('data: '+JSON.stringify({c})+'\n\n')};
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const body=req=>new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>5e6){req.destroy();no(new Error('big'))}});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch(e){no(e)}});});
const okName=s=>/^[\w\-.]{1,64}$/.test(s);
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,PUT,PATCH,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 try{const u=new URL(req.url,'http://x'),p=u.pathname;
  if(p==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});res.write(':ok\n\n');clients.add(res);const hb=setInterval(()=>res.write(':hb\n\n'),25000);req.on('close',()=>{clients.delete(res);clearInterval(hb)});return}
  if(p==='/api/health')return send(res,200,{ok:true,collections:Object.keys(DB).length});
  const m=p.match(/^\/api\/c\/([^/]+)(?:\/(.+))?$/);
  if(m){const col=decodeURIComponent(m[1]),id=m[2]&&decodeURIComponent(m[2]);if(!okName(col))return send(res,400,{error:'bad collection'});
   const C=DB[col]||(DB[col]={});
   if(req.method==='GET'){if(!id)return send(res,200,Object.entries(C).map(([i,d])=>({id:i,data:d})));return C[id]?send(res,200,{id,data:C[id]}):send(res,404,{error:'not found'})}
   if(!id)return send(res,400,{error:'id required'});
   if(req.method==='PUT'){C[id]=await body(req);flush();emit(col);return send(res,200,{ok:1})}
   if(req.method==='PATCH'){if(!C[id])return send(res,404,{error:'not found'});Object.assign(C[id],await body(req));flush();emit(col);return send(res,200,{ok:1})}
   if(req.method==='DELETE'){delete C[id];flush();emit(col);return send(res,200,{ok:1})}
   return send(res,405,{error:'method'})}
  if(p==='/api/export'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="backup.json"'});return res.end(JSON.stringify(DB))}
  let f=path.normalize(path.join(PUB,p==='/'?'index.html':p));if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('404')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)
 }catch(e){send(res,500,{error:String(e.message||e)})}
}).listen(PORT,()=>console.log('الموقع يعمل على http://localhost:'+PORT+'  ·  البيانات: '+FILE));
process.on('SIGINT',()=>{try{fs.writeFileSync(FILE,JSON.stringify(DB))}catch(e){}process.exit()});
