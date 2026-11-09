import { chromium } from '/home/user/hyphae/node_modules/@playwright/test/index.mjs'
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const T=+process.argv[2]||1500
const p=await (await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage()
await p.goto('file:///home/user/hyphae/dist/index.html'); await p.waitForTimeout(1000)
await p.evaluate(t=>HY.debug.play(t,{lookEvery:20,tapDuty:0.6,seed:3}),T)
const tabs=await p.evaluate(()=>[...document.querySelectorAll('.dnav-tab')].map(e=>e.innerText.trim()))
for (const tab of tabs) {
  await p.evaluate(n=>[...document.querySelectorAll('.dnav-tab')].find(e=>e.innerText.trim()===n).click(),tab)
  await p.waitForTimeout(400)
  const samples=[]
  for (let i=0;i<40;i++){ // 40 x 1.5s of game time, idle
    await p.evaluate(()=>{HY.debug.play(1.5,{tapsPerSec:0,buy:false})}); await p.waitForTimeout(120)
    samples.push(await p.evaluate(()=>{const o={};const L=document.querySelector('.ledger');o['#ledgerH']=L?Math.round(L.getBoundingClientRect().height):0
      for(const e of document.querySelectorAll('button,[role=button]')){const r=e.getBoundingClientRect();if(!(r.width>0&&r.bottom>0&&r.top<innerHeight))continue;const k=(e.innerText||e.getAttribute('aria-label')||'?').replace(/\s+/g,' ').replace(/[0-9.,]+/g,'#').replace(/[▓▒░]+/g,'').slice(0,40);let kk=k,n=2;while(o[kk]!==undefined)kk=k+'·'+(n++);o[kk]=Math.round(r.top)}return o}))
  }
  const keys=new Set(samples.flatMap(s=>Object.keys(s))); const moves=[]
  for(const k of keys){const v=samples.map(s=>s[k]).filter(x=>x!==undefined);const range=Math.max(...v)-Math.min(...v);const flips=v.filter((x,i)=>i&&x!==v[i-1]).length;const gone=samples.length-v.length;if(range>2||gone&&gone<samples.length)moves.push(`${range}px ${flips} moves ${gone?gone+' absent ':''}"${k}"`)}
  console.log('TAB',tab,'@',T,'\n  '+(moves.sort((a,b)=>parseInt(b)-parseInt(a)).slice(0,12).join('\n  ')||'stable'))
}
await b.close()
