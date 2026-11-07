import { chromium } from '/home/user/hyphae/node_modules/@playwright/test/index.mjs'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
const D='/home/user/hyphae/dist/'
const srv=createServer((q,r)=>{const n=q.url.split('?')[0].replace(/^\/+/,'')||'index.html';try{const b=readFileSync(D+n);r.writeHead(200,{'content-type':n.endsWith('.html')?'text/html':'application/octet-stream'});r.end(b)}catch{r.writeHead(404);r.end()}}).listen(0)
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const profile=JSON.parse(process.argv[2]), CAP=+process.argv[3]||4*3600, OUT=process.argv[4]
const c=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://127.0.0.1:${srv.address().port}/index.test.html?ui=d`); await p.waitForTimeout(1200)
await p.evaluate(()=>{ HY.loop.stop&&HY.loop.stop(); HY.state.reset&&HY.state.reset() })
const rows=[]
for(let i=0;i<CAP/60;i++){
  const r=await p.evaluate(o=>{const s=HY.state.state, pj=HY.projects; const b0=s.proj.bought.length
    HY.debug.play(60,o); const s2=HY.state.state
    const vis=pj.visible?pj.visible().filter(x=>!pj.isBought(x.id)).map(x=>x.id):[]
    const b1=s.proj.bought.length
    return {m:Math.round(s2.t/60),act:s2.act,tips:s2.a1&&s2.a1.tips,patches:s2.a1&&s2.a1.patches,rep:s2.a1&&+(+s2.a1.netRep).toFixed(1),
      g:+s2.res.biomass, min:+s2.res.minerals, sig:+s2.res.signal, anast:!!(s2.proj&&s2.proj.flags&&s2.proj.flags.anastomosis), ap:!!(s2.proj&&s2.proj.flags&&s2.proj.flags.action_potential),
      bought:b1-b0, vis:vis.length, decideVis:vis.indexOf('decide')>=0, apVis:vis.indexOf('action_potential')>=0, anVis:vis.indexOf('anastomosis')>=0}},profile)
  await p.evaluate(()=>{try{HY.ui.render(HY.state.state)}catch(e){}}); await p.waitForTimeout(30)
  r.next=await p.evaluate(()=>{const n=document.querySelector('.next');return n?n.innerText.trim():''})
  rows.push(r); if(r.act!==1) break
}
writeFileSync(OUT,JSON.stringify({profile,rows,errs:errs.slice(0,3)}))
console.log(rows.length,'min', 'act', rows.at(-1).act, errs.slice(0,2))
await b.close(); srv.close()
