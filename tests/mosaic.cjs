const assert = require('node:assert/strict');
const fs = require('node:fs');
(async()=>{
 const {layoutMosaic}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(__dirname+'/../assets/js/mosaic-layout.js','utf8')).toString('base64'));
 const fixture=Array.from({length:18},(_,i)=>({id:String(i),size:['small','medium','large'][i%3],orientation:i%3===1?'portrait':'landscape'}));
 function check(items,width,limit){
  const r=layoutMosaic(items,width,limit);assert.equal(r.tiles.length,items.length);assert.equal(new Set(r.tiles.map(t=>t.item.id)).size,items.length);
  for(const a of r.tiles){assert(a.width>0&&a.height>0);assert(a.x>=-1e-6&&a.x+a.width<=width+1e-6);assert(a.y>=0&&a.y+a.height<=r.height+1e-6);assert(a.item.orientation==='portrait'?a.height>a.width:a.width>a.height,`Lost ${a.item.orientation} shape`);
   for(const b of r.tiles){if(a===b)continue;assert(a.x+a.width<=b.x+1e-6||b.x+b.width<=a.x+1e-6||a.y+a.height<=b.y+1e-6||b.y+b.height<=a.y+1e-6,'overlap')}
  }
  // Every point is within half a gutter of a rectangle. This detects holes
  // independently of the engine's recursive partition implementation.
  if(items.length) for(let y=0;y<=r.height;y+=7)for(let x=0;x<=width;x+=7)assert(r.tiles.some(t=>x>=t.x-6.5001&&x<=t.x+t.width+6.5001&&y>=t.y-6.5001&&y<=t.y+t.height+6.5001),`Hole at ${x},${y}`);
  const columns=Math.min(Math.max(1,limit),Math.max(1,Math.floor((width+13)/233)));
  for(const a of r.tiles)assert(r.tiles.filter(b=>b.y<=a.y+1e-6&&b.y+b.height>a.y+1e-6).length<=columns,'Row limit exceeded');
  const order=r.tiles.slice().sort((a,b)=>Math.round(a.y-b.y)||a.x-b.x);
  order.forEach((r,i)=>assert(Math.abs(r.item.index-i)<=5,'Excessive date reordering'));
  return r;
 }
 const started=performance.now();
 for(const width of [320,600,1100,1800])for(const limit of [1,3,8])check(fixture,width,limit);
 check([],1000,3);check([{id:'one',size:'large',orientation:'portrait'}],1000,3);
 check(fixture.map(t=>({...t,orientation:'portrait'})),1100,3);
 check(fixture.map(t=>({...t,orientation:'landscape'})),1100,3);
 const mixed=check([{id:'portrait',size:'large',orientation:'portrait'},...Array.from({length:3},(_,i)=>({id:'landscape'+i,size:'small',orientation:'landscape'}))],1100,3);
 assert(mixed.tiles.some(a=>mixed.tiles.some(b=>a.item.orientation!==b.item.orientation&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y))), 'Mixed orientations must sit side by side');

 console.log(`PASS: mosaic orientation, full coverage, non-overlap, mixed-height packing, and bounded date reordering (${Math.round(performance.now()-started)} ms).`);
})().catch(e=>{console.error(e);process.exit(1)});
