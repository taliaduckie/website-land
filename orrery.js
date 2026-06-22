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
  const CYAN_SHADOW = {r:22, g:48, b:56}; // slightly cyan shadow tint
  function hexRgb(h){ h=h.replace('#',''); return {r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16)}; }
  function rgba(c,a){ return 'rgba('+(c.r|0)+','+(c.g|0)+','+(c.b|0)+','+(a===undefined?1:a)+')'; }
  function lighten(c,f){ return {r:c.r+(255-c.r)*f, g:c.g+(255-c.g)*f, b:c.b+(255-c.b)*f}; }
  function darken(c,f){ return {r:c.r*(1-f), g:c.g*(1-f), b:c.b*(1-f)}; }
  function mix(a,b,t){ return {r:a.r+(b.r-a.r)*t, g:a.g+(b.g-a.g)*t, b:a.b+(b.b-a.b)*t}; }

  /* ---------- build runtime model from content.js (SITE) ---------- */
  const SUN = {
    label: SITE.sun.label,
    desc:  SITE.sun.desc,
    color: hexRgb(SITE.sun.color),
    r:     SITE.sun.r
  };

  const PLANETS = SITE.planets.map(p=>({
    name:p.name, desc:p.desc, color:hexRgb(p.color), r:p.r,
    a:p.a, e:p.e, period:p.period, rot:p.rot,
    moons: p.moons.map(m=>({
      name:m.name, dr:m.dr, period:m.period, e:m.e, rot:m.rot,
      body:m.body, href:m.href||'#',
      angle:m.rot, r: 7.2 + m.dr*0.012
    }))
  }));

  // precompute orbit semi-minor + initial angles + a slightly tinted material color for moons
  PLANETS.forEach(p=>{
    p.b = p.a * Math.sqrt(1 - p.e*p.e);
    p.angle = p.rot * 1.7; // staggered phases
    p.angSpeed = (Math.PI*2)/p.period;
    p.wx = 0; p.wy = 0;
    p.moons.forEach(m=>{
      m.b = m.dr * Math.sqrt(1 - m.e*m.e);
      m.angSpeed = (Math.PI*2)/m.period;
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
    PLANETS.forEach(p=>{ systemExtent = Math.max(systemExtent, p.a*(1+p.e) + p.r); });
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
  for(let i=0;i<150;i++){
    scatter.push({ fx:Math.random(), fy:Math.random(), r:0.3+Math.random()*0.9, a:0.04+Math.random()*0.12 });
  }

  // real constellation asterisms — stars in local 0..1 space (y down), edges by index.
  // placed at fractional anchors, faintly, well away from the centre where the sun sits.
  const CONSTELLATIONS = [
    { // Orion
      ax:0.15, ay:0.26, scale:0.16, rot:0.05,
      stars:[[0.30,0.15],[0.62,0.18],[0.40,0.50],[0.50,0.53],[0.60,0.56],[0.34,0.88],[0.70,0.85]],
      edges:[[0,1],[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]]
    },
    { // Ursa Major (Big Dipper)
      ax:0.83, ay:0.19, scale:0.21, rot:-0.06,
      stars:[[0.62,0.20],[0.62,0.42],[0.45,0.47],[0.46,0.27],[0.32,0.30],[0.18,0.37],[0.05,0.47]],
      edges:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]]
    },
    { // Cassiopeia (W)
      ax:0.80, ay:0.80, scale:0.17, rot:0.04,
      stars:[[0.05,0.30],[0.28,0.62],[0.50,0.25],[0.72,0.64],[0.95,0.28]],
      edges:[[0,1],[1,2],[2,3],[3,4]]
    },
    { // Cygnus (Northern Cross)
      ax:0.17, ay:0.76, scale:0.16, rot:-0.05,
      stars:[[0.50,0.05],[0.50,0.55],[0.50,0.95],[0.15,0.50],[0.85,0.45]],
      edges:[[0,1],[1,2],[3,1],[1,4]]
    },
    { // Lyra
      ax:0.50, ay:0.11, scale:0.09, rot:0.0,
      stars:[[0.50,0.08],[0.35,0.45],[0.64,0.50],[0.40,0.88],[0.69,0.92]],
      edges:[[0,1],[0,2],[1,3],[2,4],[3,4]]
    }
  ];

  function buildBackground(){
    if(!W || !H) return;
    bgCanvas.width = W*DPR; bgCanvas.height = H*DPR;
    bgctx.setTransform(DPR,0,0,DPR,0,0);

    // deep desaturated blue night sky
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

    // constellations (very, very faint lines + slightly brighter star dots)
    const minDim = Math.min(W,H);
    CONSTELLATIONS.forEach(c=>{
      const size = c.scale*minDim, ax = c.ax*W, ay = c.ay*H;
      const cos = Math.cos(c.rot||0), sin = Math.sin(c.rot||0);
      const pts = c.stars.map(([lx,ly])=>{
        const dx = lx-0.5, dy = ly-0.5;
        return { x: ax + (dx*cos - dy*sin)*size, y: ay + (dx*sin + dy*cos)*size };
      });
      bgctx.strokeStyle = 'rgba(150,170,205,0.06)';
      bgctx.lineWidth = 1;
      bgctx.beginPath();
      c.edges.forEach(([i,j])=>{ bgctx.moveTo(pts[i].x,pts[i].y); bgctx.lineTo(pts[j].x,pts[j].y); });
      bgctx.stroke();
      pts.forEach(p=>{
        bgctx.beginPath();
        bgctx.arc(p.x, p.y, 1.2, 0, Math.PI*2);
        bgctx.fillStyle = 'rgba(214,222,238,0.28)';
        bgctx.fill();
      });
    });
  }

  function resize(){
    DPR = Math.min(window.devicePixelRatio||1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    computeFit();
    buildBackground();
    if(mode==='system'){ target.scale=fitScale; target.cx=0; target.cy=0; }
    else if(focused){ target.scale = planetFocusScale(focused); }
  }
  window.addEventListener('resize', resize);

  /* ---------- projection ---------- */
  function toScreen(wx,wy){
    return { x: W/2 + (wx-view.cx)*view.scale, y: H/2 + (wy-view.cy)*view.scale };
  }
  function toWorld(sx,sy){
    return { x: (sx-W/2)/view.scale + view.cx, y: (sy-H/2)/view.scale + view.cy };
  }

  /* ---------- state ---------- */
  let mode = 'system';          // 'system' | 'planet'
  let focused = null;           // focused planet
  let focusTargetScale = 1;
  let hoverObj = null;          // {type, obj, parent?}
  let lastT = performance.now();

  /* ---------- drawing a material body (no glow) ---------- */
  function drawBody(x,y,r,base,alpha){
    if(alpha<=0) return;
    // light direction = toward sun (origin)
    let dx = -x, dy = -y, len = Math.hypot(dx,dy)||1;
    const nx = dx/len, ny = dy/len;
    const hlx = x + nx*r*0.5, hly = y + ny*r*0.5;

    const g = ctx.createRadialGradient(hlx,hly, r*0.06, x, y, r*1.18);
    g.addColorStop(0,   rgba(lighten(base,0.42), alpha));
    g.addColorStop(0.42,rgba(base, alpha));
    g.addColorStop(0.82,rgba(darken(base,0.46), alpha));
    g.addColorStop(1,   rgba(mix(darken(base,0.72), CYAN_SHADOW, 0.5), alpha));
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = g; ctx.fill();

    // cool terminator shadow on the far side, clipped (material, not glowy)
    ctx.save();
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.clip();
    const shx = x - nx*r*0.55, shy = y - ny*r*0.55;
    const sg = ctx.createRadialGradient(shx,shy, r*0.1, shx,shy, r*1.85);
    sg.addColorStop(0,   rgba(mix(darken(base,0.78), CYAN_SHADOW, 0.6), 0.85*alpha));
    sg.addColorStop(0.6, rgba(CYAN_SHADOW, 0));
    ctx.fillStyle = sg; ctx.fillRect(x-r,y-r,r*2,r*2);
    ctx.restore();

    // faint dark rim for solidity
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.lineWidth = Math.max(0.6, 1.1/view.scale);
    ctx.strokeStyle = rgba(darken(base,0.6), 0.45*alpha);
    ctx.stroke();
  }

  function drawSun(){
    const r = SUN.r, base = SUN.color;
    // material warm body, off-center highlight, limb darkening, no halo
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
    ctx.lineWidth = 1.1/view.scale;
    ctx.strokeStyle = 'rgba(150,120,80,'+(0.16*alpha)+')';
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

    // ease camera
    const k = 1 - Math.pow(0.0009, dt); // smooth, frame-rate independent
    view.scale += (target.scale - view.scale)*k;
    view.cx    += (target.cx    - view.cx)*k;
    view.cy    += (target.cy    - view.cy)*k;
  }

  /* ---------- render ---------- */
  function render(){
    ctx.setTransform(DPR,0,0,DPR,0,0);
    // warm dark background (deep amber-black) — subtle radial, no stars/particles
    const bg = ctx.createRadialGradient(W*0.5, H*0.46, 0, W*0.5, H*0.5, Math.max(W,H)*0.75);
    bg.addColorStop(0, '#1d150d');
    bg.addColorStop(0.55, '#181109');
    bg.addColorStop(1, '#0f0a06');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // focus progress 0..1 (drives moon fade + dimming of other planets)
    let prog = 0;
    if(focused){
      prog = (view.scale - fitScale) / (focusTargetScale - fitScale);
      prog = Math.max(0, Math.min(1, prog));
    }
    const otherAlpha = focused ? (1 - prog*0.92) : 1;

    // world-space pass
    ctx.save();
    ctx.translate(W/2,H/2);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.cx, -view.cy);

    // planet orbit rings
    PLANETS.forEach(p=>{
      const a = (p===focused) ? prog*0.5 + (1-prog)*1 : otherAlpha;
      drawOrbit(p.a,p.b,p.rot, a*0.9);
    });

    drawSun();

    // planets
    PLANETS.forEach(p=>{
      const a = (p===focused) ? 1 : otherAlpha;
      drawBody(p.wx,p.wy,p.r,p.color,a);
    });

    // focused planet's moons (orbits + bodies), faded in by prog
    if(focused && prog>0.02){
      ctx.save();
      ctx.translate(focused.wx, focused.wy);
      focused.moons.forEach(m=>{
        drawOrbit(m.dr,m.b,m.rot, prog*0.85);
      });
      ctx.restore();
      focused.moons.forEach(m=>{
        drawBody(m.wx,m.wy,m.r,m.color,prog);
      });
    }
    ctx.restore();

    // screen-space labels
    drawLabels(prog, otherAlpha);
  }

  function drawLabels(prog, otherAlpha){
    ctx.textAlign='center';
    ctx.textBaseline='top';

    // sun label (centerpiece)
    {
      const s = toScreen(0,0);
      const a = (focused ? otherAlpha : 1);
      ctx.font = '700 italic 19px "IM Fell English", serif';
      ctx.fillStyle = rgba(hexRgb('#e9ddcc'), 0.78*a);
      ctx.fillText(SUN.label, s.x, s.y + SUN.r*view.scale + 12);
    }

    // planet labels
    PLANETS.forEach(p=>{
      if(focused && p!==focused){
        if(otherAlpha<=0.04) return;
      }
      const s = toScreen(p.wx,p.wy);
      const hovered = hoverObj && hoverObj.obj===p;
      let a;
      if(p===focused) a = prog;
      else a = otherAlpha * (hovered ? 0.98 : 0.34);
      if(a<=0.03) return;
      ctx.font = (hovered?'700 ':'400 ') + Math.round(15 + p.r*0.10) + 'px "IM Fell English", serif';
      ctx.fillStyle = rgba(hexRgb('#e9ddcc'), a);
      ctx.fillText(p.name, s.x, s.y + p.r*view.scale + 10);
    });

    // moon labels (only when focused)
    if(focused && prog>0.25){
      focused.moons.forEach(m=>{
        const s = toScreen(m.wx,m.wy);
        const hovered = hoverObj && hoverObj.obj===m;
        ctx.font = (hovered?'700 ':'400 ') + '13px "IM Fell English", serif';
        ctx.fillStyle = rgba(hexRgb('#d9cbb6'), prog*(hovered?1:0.66));
        ctx.fillText(m.name, s.x, s.y + m.r*view.scale + 8);
      });
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
    const w = toWorld(sx,sy);
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
    if(Math.hypot(w.x, w.y) <= SUN.r*1.1) return {type:'sun', obj:SUN};
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
    let wx,wy,r;
    if(hoverObj.type==='sun'){ wx=0;wy=0;r=SUN.r; }
    else { wx=o.wx; wy=o.wy; r=o.r; }
    const s = toScreen(wx,wy);
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
    // position card near moon, clamped to viewport
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
  moonPanel.querySelector('.m-close').addEventListener('click', closeMoon);
  mLink.addEventListener('click', e=>{ if(mLink.getAttribute('href')==='#') e.preventDefault(); });

  function openAbout(){ closeMoon(); aboutPanel.classList.add('show'); hintEl.style.opacity='0'; setHover(null); }
  function closeAbout(){ aboutPanel.classList.remove('show'); if(mode==='system') hintEl.style.opacity='0.7'; }
  aboutPanel.querySelector('.a-close').addEventListener('click', closeAbout);

  // fill the About card from content.js
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

  function handleClick(sx,sy){
    const hit = hitTest(sx,sy);
    if(!hit){
      if(moonPanel.classList.contains('show')) closeMoon();
      else if(aboutPanel.classList.contains('show')) closeAbout();
      return;
    }
    if(hit.type==='planet' && mode==='system'){ focusPlanet(hit.obj); }
    else if(hit.type==='moon'){ openMoon(hit.obj, hit.parent); }
    else if(hit.type==='planet' && mode==='planet'){ /* already focused */ }
    else if(hit.type==='sun'){ if(mode==='planet') pullBack(); else openAbout(); }
  }

  /* pointer / touch handling (mouse: move=hover; touch: hold=hover, tap=click) */
  let down=null, holdTimer=null, holdActive=false, moved=false;
  const HOLD_MS=300, MOVE_TOL=12;

  canvas.addEventListener('pointermove', e=>{
    if(e.pointerType==='mouse'){
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
    if(e.pointerType==='mouse') setHover(null);
  });

  backBtn.addEventListener('click', pullBack);

  window.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      if(moonPanel.classList.contains('show')) closeMoon();
      else if(aboutPanel.classList.contains('show')) closeAbout();
      else if(mode==='planet') pullBack();
    }
  });

  /* ---------- boot ---------- */
  function boot(){
    buildAbout();
    resize();
    view.scale = fitScale; target.scale = fitScale;
    view.cx=0; view.cy=0; target.cx=0; target.cy=0;
    lastT = performance.now();
    requestAnimationFrame(frame);
  }
  boot();
})();