"use strict";
/* orrery.js, which reads the SITE object from content.js.
   content should be changed elsewhere tho. */
(function(){
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const tipEl = document.getElementById('tip');
  const tipName = tipEl.querySelector('.t-name');
  const tipDesc = tipEl.querySelector('.t-desc');
  const moonPanel = document.getElementById('moonPanel');
  const mDomain = moonPanel.querySelector('.m-domain');
  const mTitle = moonPanel.querySelector('.m-title');
  const mBody = moonPanel.querySelector('.m-body');
  const mLink = moonPanel.querySelector('.m-link');
  const aboutPanel = document.getElementById('aboutPanel');
  const backBtn = document.getElementById('backBtn');
  const hintEl = document.getElementById('hint');

  /* ---------- color helpers (muted velvia-adjacent palette) ---------- */
  const SHADOW = {r:34, g:28, b:25}; // neutral (faintly warm) shadow — keeps bodies material, not cool/recessed
  function hexRgb(h){ h=h.replace('#',''); return {r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16)}; }
  function rgba(c,a){ return 'rgba('+(c.r|0)+','+(c.g|0)+','+(c.b|0)+','+(a===undefined?1:a)+')'; }
  function lighten(c,f){ return {r:c.r+(255-c.r)*f, g:c.g+(255-c.g)*f, b:c.b+(255-c.b)*f}; }
  function darken(c,f){ return {r:c.r*(1-f), g:c.g*(1-f), b:c.b*(1-f)}; }
  function mix(a,b,t){ return {r:a.r+(b.r-a.r)*t, g:a.g+(b.g-a.g)*t, b:a.b+(b.b-a.b)*t}; }
  // bebb deterministic PRNG so patterns are stable across frames (seeded per planet)
  function rng(seed){ let s=(seed*2654435761)%2147483647; if(s<=0) s+=2147483646; return ()=>{ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
  // url-safe slug for deep links, e.g. "AI thoughts" -> "ai-thoughts"
  function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

  /* ---------- build runtime model from content.js (SITE) ---------- */
  const SUN = {
    label: SITE.sun.label,
    desc:  SITE.sun.desc,
    color: hexRgb(SITE.sun.color),
    r:     SITE.sun.r
  };

  const PLANETS = SITE.planets.map((p,idx)=>({
    name:p.name, desc:p.desc, color:hexRgb(p.color), r:p.r, slug:slugify(p.name),
    a:p.a, e:p.e, period:p.period, rot:p.rot,
    pattern: p.pattern || 'glass', seed: idx+1,   // all planets glassy by default; set pattern:'none' to disable
    ring: p.ring ? {
      inner: p.ring.inner!=null ? p.ring.inner : 1.4,
      outer: p.ring.outer!=null ? p.ring.outer : 2.1,
      tilt:  p.ring.tilt!=null  ? p.ring.tilt  : 0.33,
      angle: p.ring.angle!=null ? p.ring.angle : -0.5,
      alpha: p.ring.alpha!=null ? p.ring.alpha : 1,   // 0..1 overall ring opacity
      color: hexRgb(p.ring.color || '#bfae8c')
    } : null,
    moons: p.moons.map(m=>({
      name:m.name, dr:m.dr, period:m.period, e:m.e, rot:m.rot,
      body:m.body, href:m.href||'#', slug:slugify(m.name),
      angle:m.rot, r: 7.2 + m.dr*0.012
    }))
  }));

  // precompute orbit semi-minor + initial angles + a slightly tinted material color for moons
  const ORBIT_SPEED = 1;   // global speed for all orbits (1 = original, lower = calmer)
  PLANETS.forEach(p=>{
    p.b = p.a * Math.sqrt(1 - p.e*p.e);
    p.angle = p.rot * 1.7; // staggered phases
    p.angSpeed = (Math.PI*2)/p.period * ORBIT_SPEED;
    p.wx = 0; p.wy = 0;
    p.moons.forEach(m=>{
      m.b = m.dr * Math.sqrt(1 - m.e*m.e);
      m.angSpeed = (Math.PI*2)/m.period * ORBIT_SPEED;
      m.color = mix(p.color, {r:150,g:138,b:122}, 0.45); // muted stone with domain tint
      m.wx=0; m.wy=0;
    });
  });

  /* ---------- viewport / camera ---------- */
  let W=0, H=0, DPR=1;
  let fitScale=1;
  const view = { scale:1, cx:0, cy:0 };          // current
  const target = { scale:1, cx:0, cy:0 };        // eased toward
  let systemExtent = 600;

  function computeFit(){
    systemExtent = 0;
    PLANETS.forEach(p=>{ const er = p.ring ? p.r*p.ring.outer : p.r; systemExtent = Math.max(systemExtent, p.a*(1+p.e) + er); });
    fitScale = Math.min(W,H) / (2*(systemExtent + 48)) * 0.96;
  }
  function planetFocusScale(p){
    let maxMoon = 0;
    p.moons.forEach(m=>{ maxMoon = Math.max(maxMoon, m.dr*(1+m.e) + m.r); });
    return Math.min(W,H) / (2*(maxMoon + p.r + 36)) * 0.82;
  }

  /* ---------- night-sky background (prebaked to an offscreen canvas) ---------- */
  const bgCanvas = document.createElement('canvas');
  const bgctx = bgCanvas.getContext('2d');

  // sparse scattered stars (fixed fractional positions so they never twinkle/jump)
  const scatter = [];
  for(let i=0;i<320;i++){
    scatter.push({ fx:Math.random(), fy:Math.random(), r:0.3+Math.random()*0.9, a:0.04+Math.random()*0.13 });
  }

  // real constellation asterisms — stars in local 0..1 space (y down), edges by index.
  // placed at fractional anchors, faintly, well away from the centre where the sun sits.
  const CONSTELLATIONS = [
    { // Orion
      ax:0.10, ay:0.32, scale:0.16, rot:0.05,
      stars:[[0.30,0.15],[0.62,0.18],[0.40,0.50],[0.50,0.53],[0.60,0.56],[0.34,0.88],[0.70,0.85]],
      edges:[[0,1],[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]]
    },
    { // Ursa Major (Big Dipper)
      ax:0.70, ay:0.33, scale:0.18, rot:-0.06,
      stars:[[0.62,0.20],[0.62,0.42],[0.45,0.47],[0.46,0.27],[0.32,0.30],[0.18,0.37],[0.05,0.47]],
      edges:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]]
    },
    { // Cassiopeia (W)
      ax:0.92, ay:0.70, scale:0.17, rot:0.04,
      stars:[[0.05,0.30],[0.28,0.62],[0.50,0.25],[0.72,0.64],[0.95,0.28]],
      edges:[[0,1],[1,2],[2,3],[3,4]]
    },
    { // Cygnus (Northern Cross)
      ax:0.74, ay:0.87, scale:0.16, rot:-0.05,
      stars:[[0.50,0.05],[0.50,0.55],[0.50,0.95],[0.15,0.50],[0.85,0.45]],
      edges:[[0,1],[1,2],[3,1],[1,4]]
    },
    { // Lyra
      ax:0.49, ay:0.31, scale:0.09, rot:0.0,
      stars:[[0.50,0.08],[0.35,0.45],[0.64,0.50],[0.40,0.88],[0.69,0.92]],
      edges:[[0,1],[0,2],[1,3],[2,4],[3,4]]
    },
    { // Scorpius
      ax:0.53, ay:0.91, scale:0.18, rot:0.03,
      stars:[[0.12,0.10],[0.26,0.20],[0.40,0.30],[0.47,0.46],[0.52,0.62],[0.62,0.74],[0.74,0.77],[0.82,0.66]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]]
    },
    { // Leo
      ax:0.08, ay:0.49, scale:0.17, rot:-0.04,
      stars:[[0.18,0.72],[0.20,0.52],[0.27,0.36],[0.40,0.30],[0.47,0.42],[0.40,0.55],[0.64,0.58],[0.88,0.66]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[5,6],[6,7],[7,0]]
    },
    { // Gemini
      ax:0.93, ay:0.53, scale:0.16, rot:0.05,
      stars:[[0.30,0.10],[0.55,0.12],[0.34,0.35],[0.58,0.35],[0.30,0.62],[0.52,0.60],[0.24,0.85],[0.62,0.82]],
      edges:[[0,2],[2,4],[4,6],[1,3],[3,5],[5,7],[2,3],[4,5]]
    },
    { // Taurus
      ax:0.29, ay:0.09, scale:0.15, rot:0.0,
      stars:[[0.50,0.55],[0.40,0.48],[0.30,0.38],[0.18,0.20],[0.58,0.48],[0.70,0.38],[0.85,0.22]],
      edges:[[0,1],[1,2],[2,3],[0,4],[4,5],[5,6]]
    },
    { // Pegasus + Andromeda chain
      ax:0.53, ay:0.12, scale:0.16, rot:-0.03,
      stars:[[0.30,0.22],[0.68,0.20],[0.70,0.58],[0.32,0.60],[0.90,0.12],[0.82,0.40]],
      edges:[[0,1],[1,2],[2,3],[3,0],[1,5],[5,4]]
    },
    { // Bootes (kite)
      ax:0.93, ay:0.34, scale:0.15, rot:0.04,
      stars:[[0.50,0.92],[0.34,0.62],[0.30,0.38],[0.50,0.18],[0.70,0.34],[0.66,0.60]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,5]]
    },
    { // Crux (Southern Cross)
      ax:0.93, ay:0.91, scale:0.07, rot:0.0,
      stars:[[0.50,0.05],[0.50,0.95],[0.15,0.55],[0.85,0.45]],
      edges:[[0,1],[2,3]]
    },
    { // Ursa Minor (Little Dipper)
      ax:0.94, ay:0.14, scale:0.15, rot:0.06,
      stars:[[0.20,0.85],[0.32,0.66],[0.44,0.48],[0.56,0.40],[0.68,0.30],[0.70,0.52],[0.58,0.60]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]]
    },
    { // Draco (winding)
      ax:0.31, ay:0.68, scale:0.18, rot:0.0,
      stars:[[0.10,0.80],[0.22,0.62],[0.30,0.45],[0.42,0.35],[0.55,0.40],[0.60,0.55],[0.52,0.68],[0.62,0.78],[0.78,0.72],[0.86,0.55],[0.78,0.40]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,8]]
    },
    { // Cepheus (house)
      ax:0.34, ay:0.28, scale:0.11, rot:-0.05,
      stars:[[0.50,0.10],[0.20,0.40],[0.25,0.80],[0.75,0.80],[0.80,0.40]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,0]]
    },
    { // Perseus
      ax:0.31, ay:0.53, scale:0.14, rot:0.04,
      stars:[[0.50,0.10],[0.45,0.35],[0.40,0.55],[0.30,0.75],[0.55,0.65],[0.65,0.80],[0.58,0.45]],
      edges:[[0,1],[1,2],[2,3],[2,4],[4,5],[1,6]]
    },
    { // Auriga (pentagon)
      ax:0.74, ay:0.09, scale:0.13, rot:0.0,
      stars:[[0.50,0.08],[0.78,0.35],[0.66,0.75],[0.30,0.78],[0.20,0.38]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,0]]
    },
    { // Sagittarius (teapot)
      ax:0.30, ay:0.87, scale:0.16, rot:0.02,
      stars:[[0.20,0.40],[0.35,0.30],[0.45,0.45],[0.30,0.55],[0.55,0.35],[0.60,0.55],[0.45,0.60],[0.70,0.25]],
      edges:[[0,1],[1,2],[2,3],[3,0],[1,4],[4,5],[5,2],[5,6],[4,7]]
    },
    { // Canis Major
      ax:0.11, ay:0.90, scale:0.13, rot:-0.04,
      stars:[[0.40,0.30],[0.55,0.45],[0.45,0.60],[0.30,0.55],[0.65,0.70],[0.50,0.80],[0.70,0.40]],
      edges:[[0,1],[1,2],[2,3],[3,0],[2,4],[4,5],[1,6]]
    },
    { // Corona Borealis (arc)
      ax:0.52, ay:0.70, scale:0.08, rot:0.0,
      stars:[[0.10,0.50],[0.20,0.35],[0.35,0.28],[0.50,0.30],[0.65,0.38],[0.78,0.50],[0.88,0.66]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]
    },
    { // Hercules (keystone)
      ax:0.72, ay:0.48, scale:0.12, rot:0.03,
      stars:[[0.40,0.35],[0.60,0.32],[0.66,0.55],[0.44,0.58],[0.30,0.18],[0.74,0.16],[0.24,0.78],[0.80,0.80]],
      edges:[[0,1],[1,2],[2,3],[3,0],[0,4],[1,5],[3,6],[2,7]]
    },
    { // Aquarius
      ax:0.07, ay:0.13, scale:0.14, rot:0.0,
      stars:[[0.15,0.40],[0.35,0.35],[0.50,0.45],[0.55,0.30],[0.68,0.40],[0.80,0.55],[0.60,0.60]],
      edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[2,6]]
    },
    { // Delphinus (small)
      ax:0.50, ay:0.49, scale:0.05, rot:0.0,
      stars:[[0.40,0.30],[0.55,0.22],[0.62,0.38],[0.48,0.46],[0.55,0.62]],
      edges:[[0,1],[1,2],[2,3],[3,0],[3,4]]
    },
    { // Aquila (eagle)
      ax:0.07, ay:0.70, scale:0.12, rot:0.03,
      stars:[[0.50,0.45],[0.50,0.20],[0.50,0.70],[0.28,0.40],[0.72,0.50],[0.20,0.30],[0.80,0.60]],
      edges:[[1,0],[0,2],[3,0],[0,4],[5,3],[4,6]]
    },
    { // Corvus (the crow)
      ax:0.71, ay:0.71, scale:0.10, rot:-0.04,
      stars:[[0.30,0.20],[0.65,0.25],[0.72,0.65],[0.38,0.70],[0.20,0.45]],
      edges:[[0,1],[1,2],[2,3],[3,0],[3,4]]
    }
  ];

  function buildBackground(){
    if(!W || !H) return;
    bgCanvas.width = W*DPR; bgCanvas.height = H*DPR;
    bgctx.setTransform(DPR,0,0,DPR,0,0);

    // darrrrk desaturated blue night sky
    const g = bgctx.createRadialGradient(W*0.5, H*0.42, 0, W*0.5, H*0.5, Math.max(W,H)*0.85);
    g.addColorStop(0,    '#0d1626');
    g.addColorStop(0.55, '#0a101e');
    g.addColorStop(1,    '#05080f');
    bgctx.fillStyle = g; bgctx.fillRect(0,0,W,H);

    // scattered faint stars
    scatter.forEach(s=>{
      bgctx.beginPath();
      bgctx.arc(s.fx*W, s.fy*H, s.r, 0, Math.PI*2);
      bgctx.fillStyle = 'rgba(205,214,230,'+s.a+')';
      bgctx.fill();
    });

    // (constellations are drawn live each frame in drawConstellations so they can react to the cursor)
  }

  // precompute constellation star positions (screen px) + a per-star opacity that we lerp
  let constPlaced = false;
  function constLocalRadius(c){    // half-size as a fraction of minDim
    let m=0;
    for(const s of c.stars){ const dx=s[0]-0.5, dy=s[1]-0.5; m=Math.max(m, Math.hypot(dx,dy)); }
    return m * c.scale;
  }
  // scatter constellations to random, non-overlapping anchors (once, at first layout)
  function placeConstellations(){
    const minDim = Math.min(W,H), pad = 10;
    const order = CONSTELLATIONS.map(c=>({ c, r: constLocalRadius(c)*minDim }))
                                .sort((a,b)=> b.r - a.r);   // place the biggest first
    const done = [];
    for(const it of order){
      const r = it.r;
      const minX=r+pad, maxX=Math.max(r+pad, W-r-pad);
      const minY=r+pad, maxY=Math.max(r+pad, H-r-pad);
      let bx=W*0.5, by=H*0.5;
      for(let a=0;a<500;a++){
        const relax = a>300 ? 0.55 : 1;   // loosen spacing if it gets hard to fit
        const x = minX + Math.random()*(maxX-minX);
        const y = minY + Math.random()*(maxY-minY);
        let good = true;
        for(const p of done){ if(Math.hypot(x-p.x,y-p.y) < (r+p.r)*relax + pad){ good=false; break; } }
        if(good){ bx=x; by=y; break; }
      }
      done.push({ x:bx, y:by, r });
      it.c.ax = bx/W; it.c.ay = by/H;
    }
    constPlaced = true;
  }

  function buildConstellations(){
    if(!constPlaced) placeConstellations();
    constItems = [];
    const minDim = Math.min(W,H);
    CONSTELLATIONS.forEach(c=>{
      const size = c.scale*minDim, ax = c.ax*W, ay = c.ay*H;
      const cos = Math.cos(c.rot||0), sin = Math.sin(c.rot||0);
      const pts = c.stars.map(([lx,ly])=>{
        const dx = lx-0.5, dy = ly-0.5;
        return { bx: ax + (dx*cos - dy*sin)*size, by: ay + (dx*sin + dy*cos)*size, op: 0.16 };
      });
      constItems.push({ pts, edges: c.edges });
    });
  }

  function resize(){
    DPR = Math.min(window.devicePixelRatio||1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    cometCanvas.width = W*DPR; cometCanvas.height = H*DPR;
    cometCanvas.style.width = W+'px'; cometCanvas.style.height = H+'px';
    computeFit();
    buildBackground();
    buildConstellations();
    if(mode==='system'){ target.scale=fitScale; target.cx=0; target.cy=0; }
    else if(focused){ target.scale = planetFocusScale(focused); }
  }
  window.addEventListener('resize', resize);

  /* projection timeeeee */
  function toScreen(wx,wy,ox,oy){
    return { x: W/2 + (ox||0) + (wx-view.cx)*view.scale, y: H/2 + (oy||0) + (wy-view.cy)*view.scale };
  }
  function toWorld(sx,sy,ox,oy){
    return { x: (sx-W/2-(ox||0))/view.scale + view.cx, y: (sy-H/2-(oy||0))/view.scale + view.cy };
  }

  /* ---------- state ---------- */
  let mode = 'system';          // 'system' | 'planet'
  let focused = null;           // focused planet
  let focusTargetScale = 1;
  let hoverObj = null;          // {type, obj, parent?}
  let lastT = performance.now();

  /* ---------- pointer / parallax / comet state ---------- */
  const mouse = { x:0, y:0, active:false };
  let pmx=0, pmy=0, pmtx=0, pmty=0;                  // parallax: smoothed + target, each in [-1,1]
  const PX_BG=2, PX_SUN=3, PX_RING=4, PX_PLANET=6;  // max screen-px shift per depth layer
  const par = { bg:{x:0,y:0}, sun:{x:0,y:0}, ring:{x:0,y:0}, planet:{x:0,y:0} };
  let constItems = [];          // live constellation geometry (screen px) for cursor activation
  const trail = [];             // comet-trail points {x,y,life}
  const cometCanvas = document.getElementById('comet');
  const cctx = cometCanvas.getContext('2d');

  function applyWorld(offx,offy){ // world transform for a layer shifted by (offx,offy) screen px
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.translate(W/2+offx, H/2+offy);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.cx, -view.cy);
  }

  /* ---------- drawing a material body (no glow) ---------- */
  // "blown-glass ?" surface: marbled translucent streaks + a small glossy sheen,
  // all clipped to the body. det. per seed so it doesn't shimmer.
  function drawGlass(x,y,r,base,alpha,seed){
    const rnd = rng(seed);
    let dx=-x, dy=-y, len=Math.hypot(dx,dy)||1; const nx=dx/len, ny=dy/len;
    ctx.save();
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.clip();
    // swirling glassy streaks
    for(let i=0;i<7;i++){
      const ang = rnd()*Math.PI;
      const rx = r*(0.45+rnd()*0.75), ry = r*(0.12+rnd()*0.38);
      const ox = (rnd()-0.5)*r*0.6, oy = (rnd()-0.5)*r*0.6;
      ctx.beginPath();
      ctx.ellipse(x+ox, y+oy, rx, ry, ang, 0, Math.PI*2);
      ctx.lineWidth = r*(0.03+rnd()*0.06);
      const tint = (i%2===0) ? lighten(base,0.32) : darken(base,0.34);
      ctx.strokeStyle = rgba(tint, 0.085*alpha);
      ctx.stroke();
    }
    // glossy sheen toward the lit side
    const hx = x + nx*r*0.42, hy = y + ny*r*0.42;
    const sheen = ctx.createRadialGradient(hx,hy, 0, hx,hy, r*0.62);
    sheen.addColorStop(0, 'rgba(255,251,242,'+(0.18*alpha)+')');
    sheen.addColorStop(1, 'rgba(255,251,242,0)');
    ctx.fillStyle = sheen; ctx.fillRect(x-r,y-r,r*2,r*2);
    ctx.restore();
  }

  function drawBody(x,y,r,base,alpha,opts){
    if(alpha<=0) return;
    // soft colored bloom around the galactic bods 
    const gl = ctx.createRadialGradient(x,y, r*0.82, x,y, r*1.95);
    gl.addColorStop(0, rgba(lighten(base,0.22), 0.17*alpha));
    gl.addColorStop(1, rgba(lighten(base,0.22), 0));
    ctx.beginPath(); ctx.arc(x,y, r*1.95, 0, Math.PI*2);
    ctx.fillStyle = gl; ctx.fill();
    // light direction = toward sun (origin)
    let dx = -x, dy = -y, len = Math.hypot(dx,dy)||1;
    const nx = dx/len, ny = dy/len;
    const hlx = x + nx*r*0.5, hly = y + ny*r*0.5;

    const g = ctx.createRadialGradient(hlx,hly, r*0.06, x, y, r*1.18);
    g.addColorStop(0,   rgba(lighten(base,0.52), alpha));
    g.addColorStop(0.42,rgba(base, alpha));
    g.addColorStop(0.82,rgba(darken(base,0.30), alpha));
    g.addColorStop(1,   rgba(mix(darken(base,0.50), SHADOW, 0.15), alpha));
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = g; ctx.fill();

    // terminator shadow on the far side, clipped (material, not glowy)
    ctx.save();
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.clip();
    const shx = x - nx*r*0.55, shy = y - ny*r*0.55;
    const sg = ctx.createRadialGradient(shx,shy, r*0.1, shx,shy, r*1.85);
    sg.addColorStop(0,   rgba(mix(darken(base,0.55), SHADOW, 0.18), 0.45*alpha));
    sg.addColorStop(0.6, rgba(SHADOW, 0));
    ctx.fillStyle = sg; ctx.fillRect(x-r,y-r,r*2,r*2);
    ctx.restore();

    if(opts && opts.pattern==='glass') drawGlass(x,y,r,base,alpha,opts.seed||1);

    // faint dark rim for solidity
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.lineWidth = Math.max(0.6, 1.1/view.scale);
    ctx.strokeStyle = rgba(darken(base,0.6), 0.45*alpha);
    ctx.stroke();
  }

  // a saturn-style ring: (not uranus!!) 'back' half drawn before the body, 'front' half after,
  // so the planet correctly occludes the far arc
  function drawRingHalf(x,y,r,alpha,ring,half){
    alpha *= (ring.alpha!=null ? ring.alpha : 1);
    const ro = r*ring.outer, ri = r*ring.inner, sq = ring.tilt, ang = ring.angle;
    const BIG = ro*3;
    ctx.save();
    // clip to the near/far half plane, split along ring's axis
    ctx.translate(x,y); ctx.rotate(ang);
    ctx.beginPath();
    if(half==='front') ctx.rect(-BIG, 0, BIG*2, BIG);
    else               ctx.rect(-BIG, -BIG, BIG*2, BIG);
    ctx.clip();
    ctx.rotate(-ang); ctx.translate(-x,-y);
    // annulus hehe (outer ellipse minus inner ellipse via even-odd)
    ctx.beginPath();
    ctx.ellipse(x,y, ro, ro*sq, ang, 0, Math.PI*2);
    ctx.ellipse(x,y, ri, ri*sq, ang, 0, Math.PI*2);
    ctx.fillStyle = rgba(ring.color, 0.42*alpha);
    ctx.fill('evenodd');
    // lil bit of edge definition
    ctx.beginPath();
    ctx.ellipse(x,y, ro, ro*sq, ang, 0, Math.PI*2);
    ctx.lineWidth = Math.max(0.5, 1/view.scale);
    ctx.strokeStyle = rgba(darken(ring.color,0.45), 0.28*alpha);
    ctx.stroke();
    ctx.restore();
  }
  function drawRingedBody(x,y,r,base,alpha,ring,opts){
    drawRingHalf(x,y,r,alpha,ring,'back');
    drawBody(x,y,r,base,alpha,opts);
    drawRingHalf(x,y,r,alpha,ring,'front');
  }

  function drawSun(){
    const r = SUN.r, base = SUN.color;
    // material warm body, off-center highlight, limb darkening, no halo (i can see ur halooooo)
    const g = ctx.createRadialGradient(-r*0.28, -r*0.28, r*0.05, 0, 0, r*1.12);
    g.addColorStop(0,   rgba(lighten(base,0.55),1));
    g.addColorStop(0.45,rgba(base,1));
    g.addColorStop(0.85,rgba(darken(base,0.32),1));
    g.addColorStop(1,   rgba(darken(base,0.55),1));
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
    ctx.lineWidth = Math.max(0.6,1/view.scale);
    ctx.strokeStyle = rgba(darken(base,0.45),0.5);
    ctx.stroke();
  }

  function drawOrbit(a,b,rot, alpha){
    if(alpha<=0) return;
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0,0,a,b,0,0,Math.PI*2);
    ctx.lineWidth = 1.5/view.scale;
    ctx.strokeStyle = 'rgba(180,160,124,'+(0.20*alpha)+')';
    ctx.shadowColor = 'rgba(198,174,130,'+(0.55*alpha)+')';
    ctx.shadowBlur = 7;
    ctx.stroke();
    // second soft pass to bloom the glow a little
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(180,160,124,'+(0.10*alpha)+')';
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- positions ---------- */
  function ellipsePos(a,b,angle,rot){
    const ex = a*Math.cos(angle), ey = b*Math.sin(angle);
    const c = Math.cos(rot), s = Math.sin(rot);
    return { x: ex*c - ey*s, y: ex*s + ey*c };
  }

  function isPlanetPaused(p){
    if(p===focused) return true;
    if(hoverObj && hoverObj.type==='planet' && hoverObj.obj===p) return true;
    return false;
  }
  function isMoonPaused(m){
    return hoverObj && hoverObj.type==='moon' && hoverObj.obj===m;
  }

  function update(dt){
    PLANETS.forEach(p=>{
      if(!isPlanetPaused(p)) p.angle += p.angSpeed*dt;
      const pos = ellipsePos(p.a,p.b,p.angle,p.rot);
      p.wx = pos.x; p.wy = pos.y;
      p.moons.forEach(m=>{
        if(!isMoonPaused(m)) m.angle += m.angSpeed*dt;
        const mp = ellipsePos(m.dr,m.b,m.angle,m.rot);
        m.wx = p.wx + mp.x; m.wy = p.wy + mp.y;
      });
    });

    // keep camera locked onto the (frozen) focused planet
    if(focused){ target.cx = focused.wx; target.cy = focused.wy; }

    // ease camera shit
    const k = 1 - Math.pow(0.0009, dt); // smooth, frame-rate independent
    view.scale += (target.scale - view.scale)*k;
    view.cx    += (target.cx    - view.cx)*k;
    view.cy    += (target.cy    - view.cy)*k;

    // parallax: lerp the smoothed mouse toward target (the lag is what makes it feel physical)
    if(!mouse.active){ pmtx=0; pmty=0; }
    pmx += (pmtx-pmx)*0.05; pmy += (pmty-pmy)*0.05;
    par.bg.x=pmx*PX_BG;         par.bg.y=pmy*PX_BG;
    par.sun.x=pmx*PX_SUN;       par.sun.y=pmy*PX_SUN;
    par.ring.x=pmx*PX_RING;     par.ring.y=pmy*PX_RING;
    par.planet.x=pmx*PX_PLANET; par.planet.y=pmy*PX_PLANET;

    // comet trail evaporates — multiplicative life decay, drop the faint tail
    for(let i=trail.length-1;i>=0;i--){ trail[i].life *= 0.9; if(trail[i].life < 0.03) trail.splice(i,1); }
  }

  /* ---------- render ---------- */
  function render(){
    // background layer (parallax par.bg) — fill base first so the shifted blit never seams
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#05080f'; ctx.fillRect(0,0,W*DPR,H*DPR);
    ctx.drawImage(bgCanvas, par.bg.x*DPR, par.bg.y*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);

    // live constellation layer (reacts to the cursor), rides the background parallax
    drawConstellations();

    // focus progress 0..1 (drives moon fade + dimming of other planets)
    let prog = 0;
    if(focused){
      prog = (view.scale - fitScale) / (focusTargetScale - fitScale);
      prog = Math.max(0, Math.min(1, prog));
    }
    const otherAlpha = focused ? (1 - prog*0.92) : 1;

    // orbit-rings layer (parallax par.ring)
    // this is taking FOREVER wauhgh
    applyWorld(par.ring.x, par.ring.y);
    PLANETS.forEach(p=>{
      const a = (p===focused) ? prog*0.5 + (1-prog)*1 : otherAlpha;
      drawOrbit(p.a,p.b,p.rot, a*0.9);
    });
    if(focused && prog>0.02){
      ctx.save();
      ctx.translate(focused.wx, focused.wy);
      focused.moons.forEach(m=>{ drawOrbit(m.dr,m.b,m.rot, prog*0.85); });
      ctx.restore();
    }

    // sun layer (parallax par.sun)
    applyWorld(par.sun.x, par.sun.y);
    drawSun();

    // planets + moons layer (parallax par.planet — the largest shift, reads as nearest)
    applyWorld(par.planet.x, par.planet.y);
    PLANETS.forEach(p=>{
      const a = (p===focused) ? 1 : otherAlpha;
      const opts = p.pattern ? {pattern:p.pattern, seed:p.seed} : null;
      if(p.ring) drawRingedBody(p.wx,p.wy,p.r,p.color,a,p.ring,opts);
      else drawBody(p.wx,p.wy,p.r,p.color,a,opts);
    });
    if(focused && prog>0.02){
      focused.moons.forEach(m=>{ drawBody(m.wx,m.wy,m.r,m.color,prog); });
    }

    // screen-space labels
    ctx.setTransform(DPR,0,0,DPR,0,0);
    drawLabels(prog, otherAlpha);

    // comet overlay (its own canvas, on top)
    drawComet();
  }

  // constellations: each star's opacity eases toward a target set by cursor proximity;
  // a line brightens with the dimmer of its two endpoints. No snap, just slow notice.
  function drawConstellations(){
    const ox = par.bg.x, oy = par.bg.y;
    ctx.lineWidth = 1;
    for(const item of constItems){
      const pts = item.pts;
      for(const p of pts){
        let tgt = 0.16;
        if(mouse.active){
          const d = Math.hypot((p.bx+ox)-mouse.x, (p.by+oy)-mouse.y);
          if(d < 90) tgt = 0.16 + (0.7-0.16)*(1 - d/90); // inverse-distance up to ~0.7
        }
        p.op += (tgt - p.op)*0.08; // slow lerp toward target
      }
      for(const e of item.edges){
        const a = pts[e[0]], b = pts[e[1]];
        const la = Math.min(a.op, b.op)*0.5;
        ctx.strokeStyle = 'rgba(150,170,205,'+la+')';
        ctx.beginPath(); ctx.moveTo(a.bx+ox,a.by+oy); ctx.lineTo(b.bx+ox,b.by+oy); ctx.stroke();
      }
      for(const p of pts){
        ctx.beginPath(); ctx.arc(p.bx+ox, p.by+oy, 1.2, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(214,222,238,'+p.op+')'; ctx.fill();
      }
    }
  }

  // comet trail: soft evaporating blobs, white with a faint warm-yellow tint
  function drawComet(){
    cctx.setTransform(DPR,0,0,DPR,0,0);
    cctx.clearRect(0,0,W,H);
    for(const t of trail){
      const rad = Math.max(0.1, 7*t.life);
      const g = cctx.createRadialGradient(t.x,t.y,0, t.x,t.y, rad);
      g.addColorStop(0, 'rgba(255,250,236,'+(0.5*t.life)+')');
      g.addColorStop(1, 'rgba(255,250,236,0)');
      cctx.fillStyle = g;
      cctx.beginPath(); cctx.arc(t.x,t.y,rad,0,Math.PI*2); cctx.fill();
    }
  }

  function drawLabels(prog, otherAlpha){
    ctx.textAlign='center';
    ctx.textBaseline='top';

    // sun label (centerpiece) — rides the sun layer's parallax
    {
      const s = toScreen(0,0,par.sun.x,par.sun.y);
      const a = (focused ? otherAlpha : 1);
      ctx.font = '700 italic 15px "IM Fell English", serif';
      ctx.fillStyle = rgba(hexRgb('#f6f3ee'), 0.78*a);
      ctx.fillText(SUN.label, s.x, s.y + SUN.r*view.scale + 12);
    }

    // planet labels — only the hovered planet (paused) or the focused planet
    PLANETS.forEach(p=>{
      const hovered = hoverObj && hoverObj.obj===p;
      let a = 0;
      if(p===focused) a = prog;
      else if(hovered) a = otherAlpha;
      if(a<=0.03) return;
      const s = toScreen(p.wx,p.wy,par.planet.x,par.planet.y);
      ctx.font = '700 ' + Math.round(15 + p.r*0.10) + 'px "IM Fell English", serif';
      ctx.fillStyle = rgba(hexRgb('#f6f3ee'), a);
      ctx.fillText(p.name, s.x, s.y + p.r*view.scale + 10);
    });

    // moon labels — only the hovered (paused) moon
    if(focused && prog>0.25 && hoverObj && hoverObj.type==='moon'){
      const m = hoverObj.obj;
      const s = toScreen(m.wx,m.wy,par.planet.x,par.planet.y);
      ctx.font = '700 13px "IM Fell English", serif';
      ctx.fillStyle = rgba(hexRgb('#ece6dc'), prog);
      ctx.fillText(m.name, s.x, s.y + m.r*view.scale + 8);
    }
  }

  /* ---------- main loop ---------- */
  function frame(now){
    let dt = (now-lastT)/1000; lastT = now;
    if(dt>0.05) dt=0.05; // clamp after tab-switch
    update(dt);
    render();
    if(hoverObj) positionTip();
    requestAnimationFrame(frame);
  }

  /* ---------- hit testing ---------- */
  function hitTest(sx,sy){
    const w = toWorld(sx,sy,par.planet.x,par.planet.y); // planets/moons live in the planet layer
    if(focused){
      // moons of focused planet first
      for(const m of focused.moons){
        const rr = Math.max(m.r, 14/view.scale); // generous touch target
        if(Math.hypot(w.x-m.wx, w.y-m.wy) <= rr*1.25) return {type:'moon', obj:m, parent:focused};
      }
      const pr = Math.max(focused.r, 16/view.scale);
      if(Math.hypot(w.x-focused.wx, w.y-focused.wy) <= pr) return {type:'planet', obj:focused};
      return null;
    }
    // system view: planets, then sun
    let best=null, bestD=Infinity;
    for(const p of PLANETS){
      const rr = Math.max(p.r, 18/view.scale);
      const d = Math.hypot(w.x-p.wx, w.y-p.wy);
      if(d<=rr*1.2 && d<bestD){ best={type:'planet',obj:p}; bestD=d; }
    }
    if(best) return best;
    const ws = toWorld(sx,sy,par.sun.x,par.sun.y); // sun sits in its own layer
    if(Math.hypot(ws.x, ws.y) <= SUN.r*1.1) return {type:'sun', obj:SUN};
    return null;
  }

  /* ---------- tooltip ---------- */
  function showTip(obj){
    tipName.textContent = obj.name || obj.label || '';
    tipDesc.textContent = obj.desc || '';
    tipDesc.style.display = obj.desc ? '' : 'none';
    tipEl.classList.add('show');
  }
  function hideTip(){ tipEl.classList.remove('show'); }
  function positionTip(){
    if(!hoverObj) return;
    const o = hoverObj.obj;
    let wx,wy,r,off;
    if(hoverObj.type==='sun'){ wx=0;wy=0;r=SUN.r; off=par.sun; }
    else { wx=o.wx; wy=o.wy; r=o.r; off=par.planet; }
    const s = toScreen(wx,wy,off.x,off.y);
    tipEl.style.left = s.x + 'px';
    tipEl.style.top  = (s.y - r*view.scale - 14) + 'px';
  }

  /* ---------- interactions ---------- */
  function setHover(obj){
    if(obj===hoverObj || (obj && hoverObj && obj.obj===hoverObj.obj)) {
      hoverObj = obj; return;
    }
    hoverObj = obj;
    if(obj){
      canvas.style.cursor = 'pointer';
      showTip(obj.type==='sun'?SUN:obj.obj);
      positionTip();
    } else {
      canvas.style.cursor = 'default';
      hideTip();
    }
  }

  function focusPlanet(p){
    mode='planet'; focused=p;
    closeMoon();
    focusTargetScale = planetFocusScale(p);
    target.scale = focusTargetScale;
    target.cx = p.wx; target.cy = p.wy;
    backBtn.classList.add('show');
    hintEl.style.opacity = '0';
    setHover(null);
  }
  function pullBack(){
    mode='system'; focused=null;
    target.scale = fitScale; target.cx=0; target.cy=0;
    backBtn.classList.remove('show');
    closeMoon();
    hintEl.style.opacity = '0.7';
    setHover(null);
  }

  function openMoon(m, parent){
    mDomain.textContent = parent.name;
    mTitle.textContent = m.name;
    mBody.textContent = m.body;
    mLink.href = m.href || '#';
    moonPanel.classList.add('show');
    // position card near moon (clamped to view)
    const s = toScreen(m.wx,m.wy);
    const cw = moonPanel.offsetWidth || 320, ch = moonPanel.offsetHeight || 200;
    let left = s.x + 24, top = s.y - ch/2;
    if(left + cw > W-16) left = s.x - cw - 24;
    if(left < 16) left = Math.min(W-cw-16, Math.max(16,(W-cw)/2));
    top = Math.max(16, Math.min(H-ch-16, top));
    moonPanel.style.left = left+'px';
    moonPanel.style.top = top+'px';
  }
  function closeMoon(){ moonPanel.classList.remove('show'); }
  moonPanel.querySelector('.m-close').addEventListener('click', ()=>writeHash(focused?focused.slug:''));
  mLink.addEventListener('click', e=>{ if(mLink.getAttribute('href')==='#') e.preventDefault(); });

  function openAbout(){ closeMoon(); aboutPanel.classList.add('show'); hintEl.style.opacity='0'; setHover(null); }
  function closeAbout(){ aboutPanel.classList.remove('show'); if(mode==='system') hintEl.style.opacity='0.7'; }
  aboutPanel.querySelector('.a-close').addEventListener('click', ()=>writeHash(''));

  // fill the about card from content.js
  function buildAbout(){
    const a = SITE.sun.about || {};
    const kickerEl = aboutPanel.querySelector('.a-kicker');
    kickerEl.textContent = a.kicker || '';
    kickerEl.style.display = a.kicker ? '' : 'none';
    aboutPanel.querySelector('.a-name').textContent = a.name || '';
    const bodyEl = aboutPanel.querySelector('.a-body');
    bodyEl.innerHTML = '';
    (a.paragraphs||[]).forEach(txt=>{
      const p = document.createElement('p'); p.textContent = txt; bodyEl.appendChild(p);
    });
    const linksEl = aboutPanel.querySelector('.a-links');
    linksEl.innerHTML = '';
    (a.links||[]).forEach(l=>{
      const el = document.createElement('a');
      el.className = 'a-link'; el.href = l.href || '#';
      el.innerHTML = l.label + ' &rarr;';
      if((l.href||'#')==='#') el.addEventListener('click', e=>e.preventDefault());
      linksEl.appendChild(el);
    });
  }

  // build the persistent corner links from content.js (SITE.social)
  function buildSocial(){
    const el = document.getElementById('social');
    if(!el) return;
    el.innerHTML = '';
    (SITE.social||[]).forEach(l=>{
      const a = document.createElement('a');
      a.href = l.href || '#';
      a.textContent = l.label;
      a.target = '_blank'; a.rel = 'noopener';
      if((l.href||'#')==='#') a.addEventListener('click', e=>e.preventDefault());
      el.appendChild(a);
    });
  }

  /* ---------- deep links (URL hash <-> state) ----------
     #ai-thoughts            -> that planet focused
     #ai-thoughts/eval-design-> that planet + a moon card open
     #about                  -> the about card open
     empty                   -> the full system view
     Navigation goes through writeHash so the back/forward buttons work. */
  function currentHash(){ return decodeURIComponent(location.hash.replace(/^#/,'')); }
  function writeHash(h){
    const target = h || '';
    if(currentHash() !== target){
      if(target) location.hash = '#'+target;                       // pushes a history entry
      else history.replaceState(null, '', location.pathname + location.search); // clears the hash
    }
    applyHashState();
  }
  function applyHashState(){
    const h = currentHash();
    const slash = h.indexOf('/');
    const pslug = slash<0 ? h : h.slice(0,slash);
    const mslug = slash<0 ? '' : h.slice(slash+1);
    if(!h){
      if(aboutPanel.classList.contains('show')) closeAbout();
      if(moonPanel.classList.contains('show')) closeMoon();
      if(focused) pullBack();
      return;
    }
    if(pslug==='about'){
      if(focused) pullBack();
      closeMoon();
      if(!aboutPanel.classList.contains('show')) openAbout();
      return;
    }
    const p = PLANETS.find(x=>x.slug===pslug);
    if(!p){ writeHash(''); return; }                               // unknown slug -> system
    if(aboutPanel.classList.contains('show')) closeAbout();
    if(focused!==p) focusPlanet(p);
    const m = mslug ? p.moons.find(x=>x.slug===mslug) : null;
    if(m) openMoon(m, p); else closeMoon();
  }
  window.addEventListener('hashchange', applyHashState);

  function handleClick(sx,sy){
    const hit = hitTest(sx,sy);
    if(!hit){
      if(moonPanel.classList.contains('show')) writeHash(focused?focused.slug:'');
      else if(aboutPanel.classList.contains('show')) writeHash('');
      return;
    }
    if(hit.type==='planet' && mode==='system'){ writeHash(hit.obj.slug); }
    else if(hit.type==='moon'){ writeHash(hit.parent.slug + '/' + hit.obj.slug); }
    else if(hit.type==='planet' && mode==='planet'){ /* already focused */ }
    else if(hit.type==='sun'){ writeHash(mode==='planet' ? '' : 'about'); }
  }

  /* pointer / touch handling (mouse: move=hover; touch: hold=hover, tap=click) */
  let down=null, holdTimer=null, holdActive=false, moved=false;
  const HOLD_MS=300, MOVE_TOL=12;

  // mouse move feeds three things: parallax target, the comet trail, and hover
  function onMouseMove(x,y){
    mouse.x=x; mouse.y=y; mouse.active=true;
    pmtx = Math.max(-1, Math.min(1, (x - W/2)/(W/2)));
    pmty = Math.max(-1, Math.min(1, (y - H/2)/(H/2)));
    trail.push({x, y, life:1});
    if(trail.length > 12) trail.shift();
  }

  canvas.addEventListener('pointermove', e=>{
    if(e.pointerType==='mouse'){
      onMouseMove(e.clientX, e.clientY);
      setHover(hitTest(e.clientX, e.clientY));
      return;
    }
    // touch
    if(down){
      const dist = Math.hypot(e.clientX-down.x, e.clientY-down.y);
      if(dist>MOVE_TOL){ moved=true; if(holdTimer){clearTimeout(holdTimer);holdTimer=null;} }
    }
    if(holdActive){ setHover(hitTest(e.clientX, e.clientY)); }
  });

  canvas.addEventListener('pointerdown', e=>{
    down = {x:e.clientX, y:e.clientY, t:performance.now()};
    moved=false; holdActive=false;
    if(e.pointerType!=='mouse'){
      holdTimer = setTimeout(()=>{
        holdActive=true;
        setHover(hitTest(down.x, down.y)); // touch-and-hold == hover (pauses orbit)
      }, HOLD_MS);
    }
  });

  canvas.addEventListener('pointerup', e=>{
    if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    const wasHold = holdActive;
    const small = down && Math.hypot(e.clientX-down.x, e.clientY-down.y) <= MOVE_TOL;
    if(wasHold){
      // releasing a hold ends the hover (resumes orbit)
      if(e.pointerType!=='mouse') setHover(null);
    } else if(small && !moved){
      handleClick(e.clientX, e.clientY); // tap / mouse click
    }
    holdActive=false; down=null;
  });
  canvas.addEventListener('pointercancel', ()=>{
    if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}
    holdActive=false; down=null; setHover(null);
  });
  canvas.addEventListener('pointerleave', e=>{
    if(e.pointerType==='mouse'){ setHover(null); mouse.active=false; } // parallax eases back, constellations relax
  });

  backBtn.addEventListener('click', ()=>writeHash(''));

  window.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      if(moonPanel.classList.contains('show')) writeHash(focused?focused.slug:'');
      else if(aboutPanel.classList.contains('show')) writeHash('');
      else if(mode==='planet') writeHash('');
    }
  });

  /* boot ur boot */
  function boot(){
    buildAbout();
    buildSocial();
    resize();
    view.scale = fitScale; target.scale = fitScale;
    view.cx=0; view.cy=0; target.cx=0; target.cy=0;
    update(0);          // set initial body positions so a deep-link focus has a valid target
    applyHashState();   // honor an incoming #planet / #planet/moon / #about link on load
    lastT = performance.now();
    requestAnimationFrame(frame);
  }
  boot();
})();