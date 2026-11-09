// Bounce-off test driver: one browser, one player, the screen only. Time moves only when the player waits.
import { chromium } from '/home/user/hyphae/node_modules/@playwright/test/index.mjs'
import http from 'node:http'
import { appendFileSync } from 'node:fs'
const PORT=+process.env.PORT, UI=process.env.UI||'', OUT=process.env.OUT
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1})
const p=await ctx.newPage()
const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.clock.install()
await p.goto('file://'+(process.env.DIST||'/home/user/hyphae/dist')+'/index.html'+(UI?'?ui='+UI:''))
await p.clock.runFor(1500)
let n=0
const rec=(o)=>appendFileSync(OUT+'/trace.jsonl',JSON.stringify(o)+'\n')
async function st(){return await p.evaluate(()=>{const s=HY.state.state;return {act:s.act,t:Math.round(s.t)}})}
async function run(ms){for(let left=ms;left>0;left-=1000)await p.clock.fastForward(Math.min(1000,left));await p.clock.runFor(600)}
const H={
 async look(){const f=`${OUT}/s${String(++n).padStart(3,'0')}.png`;await p.screenshot({path:f});const s=await st();rec({k:'look',f,...s});const snd=await p.evaluate(()=>HY.feel&&HY.feel.nowPlaying?HY.feel.nowPlaying():'unknown').catch(()=>'unknown');return f+'\nplayed '+Math.floor(s.t/60)+' min\nyou hear: '+snd},
 async buttons(){return await p.evaluate(()=>[...document.querySelectorAll('button,[role=button],[role=tab]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&getComputedStyle(e).visibility!=='hidden'}).map(e=>{const r=e.getBoundingClientRect();return `${Math.round(r.left+r.width/2)},${Math.round(r.top+r.height/2)} "${(e.innerText||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').slice(0,60)}"${e.disabled?' (disabled)':''}`}).join('\n'))},
 async tap(q){const k=Math.max(1,Math.min(50,+q.n||1));for(let i=0;i<k;i++){await p.touchscreen.tap(+q.x,+q.y);await p.clock.runFor(+q.gap||300)}rec({k:'tap',x:+q.x,y:+q.y,n:k,...await st()});return 'tapped '+k},
 async hold(q){const c=await ctx.newCDPSession(p);const tp=[{x:+q.x,y:+q.y}];await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:tp});await p.clock.runFor(Math.min(+q.ms||1500,20000));await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.clock.runFor(300);rec({k:'hold',x:+q.x,y:+q.y,...await st()});return 'held'},
 async swipe(q){const c=await ctx.newCDPSession(p);const x0=+q.x0,y0=+q.y0,x1=+q.x1,y1=+q.y1;await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});for(let i=1;i<=10;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/10,y:y0+(y1-y0)*i/10}]});await p.clock.runFor(16)}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.clock.runFor(400);return 'swiped'},
 async wait(q){const s=Math.max(1,Math.min(1800,+q.s||10));await run(s*1000);const r=await st();rec({k:'wait',s,...r});return 'waited '+s+'s; played '+Math.floor(r.t/60)+' min'},
 async away(q){const sec=Math.max(120,Math.min(43200,+q.s||3600));await p.evaluate(x=>{const st=HY.state.state;st.wallClock=HY.state.now()-x;HY.loop.reconcileOffline()},sec);await p.clock.runFor(1500);const r=await st();rec({k:'away',s:sec,...r});return 'you closed the app for '+Math.round(sec/60)+' min and reopened it; game clock now '+Math.floor(r.t/60)+' min'},
 async quit(q){const r=await st();rec({k:'quit',why:q.why||'',...r});return 'recorded'},
 async listen(){return await p.evaluate(()=>HY.feel&&HY.feel.nowPlaying?HY.feel.nowPlaying():'unknown')},
 async errors(){return errs.join('\n')||'(none)'},
}
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');const q=Object.fromEntries(u.searchParams);const f=H[u.pathname.slice(1)];try{res.end(String(f?await f(q):'unknown command'))}catch(e){res.end('FAIL '+e.message)}}).listen(PORT,()=>console.log('ready '+PORT))
