/* karta-3-placering.js — Segmentering v2 + placering v5 (teknisk designstudie, prototyp).
 * Ändrar inget i spelet, ingen färgkorrigering, ingen produktionskod.
 *
 * v5 (2026-11-27): byggd mot de BESKURNA landskaps-stickers (design/stickers/trim/) på karta-kandidat-4.png.
 *  * Bättre kantutnyttjande: INTERN-kant-marginal (liten, EDGECORE) skild från KUST-värn.
 *    - intern kant (terrass/gråkant/zongräns): zon-dt ≥ w·EDGECORE/2 + SAFE_INT (litet) → byggnader
 *      får nå kanterna; mjuka ytor/vägar/vegetation får korsa interna terrasskanter.
 *    - kust (öns yttre gräns): islandDT-koll på HELA markavtrycket (centrum + nedre hörn + front) OCH
 *      på byggnadens övre del (bakre kust) → ingen sprajt skjuter ut i havet eller upp över siluetten.
 *  * Lloyd över HELA den byggbara ytan (vc inkl. intern marginalremsa) → kantpunkter dras INTE inåt.
 *  * Beskurna bilder → naturlig höjd/proportion per typ (ingen bredd-normalisering). Per-TYP-ankare (GEO).
 *  * 0 kärnkollisioner, alla N placerade, minimalt havsspill. Dimensionerat för 12–16 byggnader/område.
 *
 * KVAR: stabil inkrementell placering (§5) — nya byggnader ska inte flytta befintliga.
 * Se design/KARTA-PLACERING-SLUTLIG-UNDERLAG.md.
 */
export const ZCODE = { aker:1, skog:2, tundra:3, stad:4 };
// KÄRN-fot (fasta objekt) / sprite-bredd — styr KOLLISION (fasta objekt möts ej).
export const CORE   = { aker:0.50, skog:0.50, tundra:0.46, stad:0.52 };
// INTERN-kant-förankring / sprite-bredd — mindre än CORE: centrum får ligga nära terrass-/gråkant
// (mjuk utbredning korsar kanten). Styr bara avstånd till INTERN kant, inte kollision, inte kust.
export const EDGECORE = { aker:0.34, skog:0.30, tundra:0.34, stad:0.30 };
export const EDGE_FRAC = 0.26;   // kust: centrum ≥ EDGE_FRAC·w från havet
export const ZCOL  = { aker:'#E7C24C', skog:'#3F8F4A', tundra:'#D98A3C', stad:'#8A8F96' };
export const CAPS  = [1,4,8,12,16,20];
// Per-TYP-geometri från beskärningen (design/stickers/trim/_geometri.json): ankare + proportion.
export const GEO = {
  aker_smutsig:{ay:0.866,aspect:1.278}, aker_standard:{ay:0.813,aspect:1.423}, aker_gron:{ay:0.836,aspect:1.100},
  skog_smutsig:{ay:0.850,aspect:1.164}, skog_standard:{ay:0.838,aspect:1.042}, skog_gron:{ay:0.831,aspect:1.001},
  tundra_smutsig:{ay:0.863,aspect:1.352}, tundra_standard:{ay:0.839,aspect:0.995}, tundra_gron:{ay:0.894,aspect:1.019},
  stad_smutsig:{ay:0.827,aspect:1.227}, stad_standard:{ay:0.816,aspect:1.326}, stad_gron:{ay:0.828,aspect:1.094},
};
const VARIANTS = ['smutsig','standard','gron'];
// per-zon representativa värden (variant-oberoende → stabil placering, säkrast = tallest/lägst anchor)
export const ZREP = (()=>{ const r={}; for(const z of Object.keys(ZCODE)){
  const ks=VARIANTS.map(v=>`${z}_${v}`); const asp=ks.map(k=>GEO[k].aspect), anc=ks.map(k=>GEO[k].ay);
  r[z]={aspectMin:Math.min(...asp), anchor:anc.reduce((a,b)=>a+b,0)/anc.length}; } return r; })();

const YC = 0.70;                 // iso-djupkompression
const GAP = 1.0;                 // glapp mellan kärnor
const SAFE_INT = 3;              // intern-kant-marginal (px) — liten
const COAST_MARGIN = 3;          // kust-marginal (px) för markavtryck/topp
const HARMONY = [0.90, 1.08];    // storleksspann kring medianen mellan zoner (mild harmoni)

function rgb2hsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;
  if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
  return[h,mx?d/mx:0,mx];}

// 0 hav/transp · 1 åker · 2 skog · 3 tundra · 4 stad · 5 klippa/sand · 6 träd/veg/vägg
export function classify(r,g,b,a){
  if(a<50) return 0;
  const [h,s,v]=rgb2hsv(r,g,b), R=r/255,B=b/255;
  if(h>=78 && h<=172){
    if(s>=0.22 && v>=0.32 && v<=0.86) return 2;
    return 6;
  }
  if(s>=0.26 && v>=0.44){
    if(h>=36 && h<=68) return 1;
    if(h>=12 && h<38)  return 3;
  }
  if(s>=0.30 && v>=0.30 && v<0.44){
    if(h>=38 && h<=68) return 1;
    if(h>=12 && h<40)  return 3;
  }
  if(s<0.16){
    if(B>=R-4/255 && v>=0.30 && v<=0.90) return 4;
    return 5;
  }
  return 6;
}

export function distanceTransform(mask, W, H){
  const INF=1e9, d=new Float32Array(W*H);
  for(let i=0;i<W*H;i++) d[i]=mask[i]?INF:0;
  const D=1, Dd=1.41421356;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x; if(!mask[i])continue; let v=d[i];
    if(x>0)        v=Math.min(v,d[i-1]+D);
    if(y>0)        v=Math.min(v,d[i-W]+D);
    if(x>0&&y>0)   v=Math.min(v,d[i-W-1]+Dd);
    if(x<W-1&&y>0) v=Math.min(v,d[i-W+1]+Dd);
    d[i]=v; }
  for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){ const i=y*W+x; if(!mask[i])continue; let v=d[i];
    if(x<W-1)        v=Math.min(v,d[i+1]+D);
    if(y<H-1)        v=Math.min(v,d[i+W]+D);
    if(x<W-1&&y<H-1) v=Math.min(v,d[i+W+1]+Dd);
    if(x>0&&y<H-1)   v=Math.min(v,d[i+W-1]+Dd);
    d[i]=v; }
  return d;
}

function dilate(m,W,H){ const o=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ let v=0;
    for(let j=-1;j<=1&&!v;j++)for(let i=-1;i<=1;i++){const nx=x+i,ny=y+j; if(nx>=0&&ny>=0&&nx<W&&ny<H&&m[ny*W+nx]){v=1;break;}}
    o[y*W+x]=v; } return o; }
function erode(m,W,H){ const o=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ let v=1;
    for(let j=-1;j<=1&&v;j++)for(let i=-1;i<=1;i++){const nx=x+i,ny=y+j; if(nx<0||ny<0||nx>=W||ny>=H||!m[ny*W+nx]){v=0;break;}}
    o[y*W+x]=v; } return o; }
function zoneMask(cls, code, W, H){
  let m=new Uint8Array(W*H); for(let i=0;i<W*H;i++) m[i]=cls[i]===code?1:0;
  for(let k=0;k<4;k++) m=dilate(m,W,H); for(let k=0;k<4;k++) m=erode(m,W,H);
  m=erode(m,W,H); m=dilate(m,W,H);
  return m;
}

export function segment(data, W, H){
  const n=W*H, cls=new Uint8Array(n); let land=0;
  for(let i=0;i<n;i++){ const c=classify(data[i*4],data[i*4+1],data[i*4+2],data[i*4+3]); cls[i]=c; if(c)land++; }
  const im=new Uint8Array(n); for(let i=0;i<n;i++) im[i]=cls[i]?1:0;
  const islandDT=distanceTransform(im,W,H);
  const zones={};
  for(const [name,code] of Object.entries(ZCODE)){
    const m=zoneMask(cls,code,W,H); const dt=distanceTransform(m,W,H);
    let usable=0; for(let i=0;i<n;i++) if(dt[i]>=SAFE_INT) usable++;
    zones[name]={code,mask:m,dt,usablePx:usable};
  }
  return {cls,zones,islandDT,land,frame:n,W,H};
}

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Kust-/topp-villkor: hela nedre markavtrycket + övre delen innanför kusten. Variant-oberoende.
export function coastProbesFor(w, z, islandDT, W, H){
  const hrep=w/ZREP[z].aspectMin, front=(ZREP[z].anchor-0.5)*hrep, halfw=0.42*w, topUp=0.62*hrep;
  const P=[[0,front],[-halfw,front*0.45],[halfw,front*0.45],[-halfw,0],[halfw,0],
           [0,-topUp],[-halfw*0.6,-topUp*0.9],[halfw*0.6,-topUp*0.9]];
  return (x,y)=>{ for(const [dx,dy] of P){ const px=(x+dx)|0, py=(y+dy)|0;
      if(px<0||py<0||px>=W||py>=H) return false; if(islandDT[py*W+px]<COAST_MARGIN) return false; } return true; };
}

// Poisson-disk blue-noise. need = intern-kant; edge = kust (centrum); extra = kust/topp-villkor.
export function poisson(zone, islandDT, W, H, footR, minDist, edge, seed=1, extra=null){
  const dt=zone.dt, rng=mulberry32(seed), need=footR+SAFE_INT;
  const cell=Math.max(2,minDist/Math.SQRT2), gw=Math.ceil(W/cell), gh=Math.ceil(H/cell);
  const grid=new Int32Array(gw*gh).fill(-1), pts=[], active=[]; const md2=minDist*minDist;
  const ok=(x,y)=>{ if(x<0||y<0||x>=W||y>=H)return false; const ix=x|0,iy=y|0;
    if(dt[iy*W+ix]<need||islandDT[iy*W+ix]<edge)return false;
    if(extra && !extra(x,y)) return false;
    const cx=(x/cell)|0, cy=(y/cell)|0;
    for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const nx=cx+i,ny=cy+j; if(nx<0||ny<0||nx>=gw||ny>=gh)continue;
      const p=grid[ny*gw+nx]; if(p>=0){const dx=pts[p][0]-x, dy=(pts[p][1]-y)/YC; if(dx*dx+dy*dy<md2)return false;}}
    return true; };
  const push=p=>{const id=pts.length;pts.push(p);active.push(id);grid[((p[1]/cell)|0)*gw+((p[0]/cell)|0)]=id;};
  const grow=()=>{ while(active.length){
    const ai=(rng()*active.length)|0, base=pts[active[ai]]; let found=false;
    for(let t=0;t<26;t++){ const ang=rng()*6.2831853, rad=minDist*(1+rng());
      const x=base[0]+Math.cos(ang)*rad, y=base[1]+Math.sin(ang)*rad*YC;
      if(ok(x,y)){push([x,y]);found=true;break;} }
    if(!found) active.splice(ai,1);
  } };
  const stepScan=Math.max(3,(minDist*0.6)|0);
  for(let pass=0; pass<4000; pass++){
    let seedPt=null;
    for(let y=2;y<H&&!seedPt;y+=stepScan)for(let x=2;x<W;x+=stepScan) if(dt[y*W+x]>=need && islandDT[y*W+x]>=edge && ok(x+rng()*2,y+rng()*2)) seedPt=[x+rng()*2,y+rng()*2];
    if(!seedPt) break;
    push(seedPt); grow();
  }
  return pts;
}

export function farthestN(pts, n){
  if(pts.length<=n) return pts.map(p=>[p[0],p[1]]);
  let cx=0,cy=0; for(const p of pts){cx+=p[0];cy+=p[1];} cx/=pts.length; cy/=pts.length;
  let start=0,bd=Infinity; pts.forEach((p,i)=>{const dx=p[0]-cx,dy=(p[1]-cy)/YC,d=dx*dx+dy*dy; if(d<bd){bd=d;start=i;}});
  const used=new Uint8Array(pts.length), chosen=[start]; used[start]=1;
  const mind=new Float64Array(pts.length).fill(Infinity);
  while(chosen.length<n){ const last=pts[chosen[chosen.length-1]]; let pick=-1,pd=-1;
    for(let i=0;i<pts.length;i++){ if(used[i])continue;
      const dx=pts[i][0]-last[0],dy=(pts[i][1]-last[1])/YC,d=dx*dx+dy*dy; if(d<mind[i])mind[i]=d;
      if(mind[i]>pd){pd=mind[i];pick=i;} }
    if(pick<0)break; used[pick]=1; chosen.push(pick); }
  return chosen.map(i=>[pts[i][0],pts[i][1]]);
}

// Lloyd över HELA ytan: flytt accepteras bara om giltig (intern-kant + kust/topp) och ej krock →
// kantpunkters tyngdpunkt (vc inkl. marginalremsa) håller dem ute mot kanterna.
function lloyd(pts, vc, minDist, valid, iters){
  let P=pts.map(p=>[p[0],p[1]]); const md2=minDist*minDist, n=P.length;
  for(let it=0;it<iters;it++){
    const sx=new Float64Array(n), sy=new Float64Array(n), cnt=new Int32Array(n);
    for(let v=0;v<vc.length;v++){ const vx=vc[v][0],vy=vc[v][1]; let best=0,bd=Infinity;
      for(let i=0;i<n;i++){const dx=vx-P[i][0],dy=(vy-P[i][1])/YC,d=dx*dx+dy*dy; if(d<bd){bd=d;best=i;}}
      sx[best]+=vx; sy[best]+=vy; cnt[best]++; }
    const nP=P.map((p,i)=> cnt[i]? [sx[i]/cnt[i], sy[i]/cnt[i]] : [p[0],p[1]]);
    for(let i=0;i<n;i++){ let okm=valid(nP[i][0],nP[i][1]);
      if(okm) for(let j=0;j<n;j++){ if(i===j)continue; const dx=nP[i][0]-nP[j][0],dy=(nP[i][1]-nP[j][1])/YC; if(dx*dx+dy*dy<md2){okm=false;break;} }
      if(!okm) nP[i]=P[i]; }
    P=nP;
  }
  return P;
}
// dra en ogiltig punkt mot ökande islandDT (inåt) tills giltig
function pullInside(x, y, islandDT, W, H, valid, steps=60){
  if(valid(x,y)) return [x,y];
  for(let s=0;s<steps;s++){ let bD=(x>=0&&y>=0&&x<W&&y<H)?islandDT[(y|0)*W+(x|0)]:-1, best=null;
    for(const [dx,dy] of [[3,0],[-3,0],[0,3],[0,-3],[2,2],[-2,2],[2,-2],[-2,-2]]){
      const nx=x+dx,ny=y+dy,ix=nx|0,iy=ny|0; if(ix>=0&&iy>=0&&ix<W&&iy<H&&islandDT[iy*W+ix]>bD){bD=islandDT[iy*W+ix];best=[nx,ny];} }
    if(!best) break; x=best[0]; y=best[1]; if(valid(x,y)) break; }
  return [x,y];
}
function resolveCollisions(pts, minDist, valid, passes=40){
  const P=pts.map(p=>[p[0],p[1]]), md=minDist;
  for(let pass=0;pass<passes;pass++){ let moved=false;
    for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
      let dx=P[i][0]-P[j][0], dy=(P[i][1]-P[j][1])/YC, d=Math.hypot(dx,dy);
      if(d<md){ if(d<1e-6){dx=1;dy=0;d=1;} const pu=(md-d)/2+0.6, ux=dx/d, uy=dy/d*YC;
        const ni=[P[i][0]+ux*pu,P[i][1]+uy*pu], nj=[P[j][0]-ux*pu,P[j][1]-uy*pu];
        if(valid(ni[0],ni[1]))P[i]=ni; if(valid(nj[0],nj[1]))P[j]=nj; moved=true; } }
    if(!moved)break; }
  return P;
}

function fitCount(zone, islandDT, W, H, zoneName, Ws, seed){
  const extra=coastProbesFor(Ws,zoneName,islandDT,W,H);
  return poisson(zone,islandDT,W,H,Ws*EDGECORE[zoneName]/2,Ws*CORE[zoneName]*GAP,Ws*EDGE_FRAC,seed,extra).length;
}
export function sizeForZone(seg, zoneName, N, wMin, wMax, seed){
  const {W,H,zones,islandDT}=seg, z=zones[zoneName];
  const fits=Ws=>fitCount(z,islandDT,W,H,zoneName,Ws,seed)>=N;
  if(!fits(wMin)) return wMin;
  if(fits(wMax)) return wMax;
  let lo=wMin, hi=wMax;
  for(let i=0;i<16;i++){ const mid=(lo+hi)/2; if(fits(mid))lo=mid; else hi=mid; }
  return lo;
}

// full placering för last N. {Ws:{zon:px}, foots, fit}.
export function placeForLoad(seg, N, wMin, wMax){
  const {W,H,zones,islandDT}=seg, foots={}, fit={}, Ws={};
  const raw={}; for(const z of Object.keys(ZCODE)){ const seed=101+N*7+z.charCodeAt(0); raw[z]=sizeForZone(seg,z,N,wMin,wMax,seed); }
  const sorted=Object.values(raw).sort((a,b)=>a-b), med=(sorted[1]+sorted[2])/2;
  for(const z of Object.keys(ZCODE)){
    const seed=101+N*7+z.charCodeAt(0), zone=zones[z], dt=zone.dt;
    let w=Math.max(HARMONY[0]*med, Math.min(HARMONY[1]*med, raw[z]));
    let extra=coastProbesFor(w,z,islandDT,W,H);
    let pool=poisson(zone,islandDT,W,H,w*EDGECORE[z]/2,w*CORE[z]*GAP,w*EDGE_FRAC,seed,extra);
    while(pool.length<N && w>wMin){ w=Math.max(wMin,w*0.93); extra=coastProbesFor(w,z,islandDT,W,H);
      pool=poisson(zone,islandDT,W,H,w*EDGECORE[z]/2,w*CORE[z]*GAP,w*EDGE_FRAC,seed,extra); }
    const needEdge=w*EDGECORE[z]/2+SAFE_INT, minDist=w*CORE[z]*GAP, edge=w*EDGE_FRAC;
    const valid=(x,y)=>{const ix=x|0,iy=y|0; if(ix<0||iy<0||ix>=W||iy>=H)return false;
      if(dt[iy*W+ix]<needEdge||islandDT[iy*W+ix]<edge)return false; return extra(x,y);};
    let ch=farthestN(pool,N).map(p=>pullInside(p[0],p[1],islandDT,W,H,valid));
    const vc=[]; for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){ const i=y*W+x; if(dt[i]>=SAFE_INT && islandDT[i]>=edge) vc.push([x,y]); }
    if(ch.length>=2 && vc.length>ch.length){
      ch=lloyd(ch,vc,minDist,valid,6);
      ch=ch.map(p=>pullInside(p[0],p[1],islandDT,W,H,valid));
      ch=resolveCollisions(ch,minDist,valid,40);
    }
    ch.sort((a,b)=>a[1]-b[1]);
    Ws[z]=w; foots[z]=ch; fit[z]=ch.length;
  }
  return {Ws, foots, fit};
}
