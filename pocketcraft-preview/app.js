/* PocketCraft - a Minecraft-style block world for Windows 10 Mobile.
   Runs inside the UWP HTML app host on the Lumia 929 (EdgeHTML), so this file
   is ES5 only and lives in an external script: the host does not run inline
   script tags inside packaged HTML. */
(function () {
  'use strict';

  /* ------------------------------------------------------------- constants */

  var N = 30;              // world is N x N columns
  var H = 14;              // world height in blocks
  var SEA = 4;             // water fills up to this level
  var STORE = 'pocketcraft.world.v1';

  var AIR = 0;
  var GRASS = 1, DIRT = 2, STONE = 3, LOG = 4, LEAF = 5, SAND = 6,
      PLANK = 7, BRICK = 8, GLASS = 9, WATER = 10, COBBLE = 11;

  var TYPES = [
    null,
    { n: 'Grass',  top: '#6fbf4a', side: '#8a5a34', a: 1 },
    { n: 'Dirt',   top: '#8a5a34', side: '#7a4d2b', a: 1 },
    { n: 'Stone',  top: '#a4a8ad', side: '#8d9196', a: 1 },
    { n: 'Wood',   top: '#b98f57', side: '#6f4b2a', a: 1 },
    { n: 'Leaves', top: '#5aa845', side: '#438034', a: 1 },
    { n: 'Sand',   top: '#e8d8a4', side: '#d6c288', a: 1 },
    { n: 'Planks', top: '#c9a26b', side: '#b08b57', a: 1 },
    { n: 'Brick',  top: '#b05a45', side: '#96483a', a: 1 },
    { n: 'Glass',  top: '#d7f2fa', side: '#b7dde8', a: 0.42 },
    { n: 'Water',  top: '#3f8ad8', side: '#2f6fbe', a: 0.70 },
    { n: 'Cobble', top: '#94979b', side: '#7c7f83', a: 1 }
  ];

  function shade(hex, f) {
    var r = Math.round(parseInt(hex.substr(1, 2), 16) * f);
    var g = Math.round(parseInt(hex.substr(3, 2), 16) * f);
    var b = Math.round(parseInt(hex.substr(5, 2), 16) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  (function () {
    for (var i = 1; i < TYPES.length; i++) {
      var t = TYPES[i];
      if (!t) { continue; }
      t.topC = t.top;
      t.rightC = shade(t.side, 0.80);
      t.leftC = shade(t.side, 0.60);
    }
  })();

  /* ----------------------------------------------------------------- state */

  var world = new Uint8Array(N * N * H);
  var view = new Uint8Array(N * N * H);
  var rot = 0;
  var seed = 1;
  var mode = 'build';
  var sel = GRASS;

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var hotbar = document.getElementById('hotbar');
  var selName = document.getElementById('selName');
  var hint = document.getElementById('hint');

  var tileW = 40, tileH = 20, blockH = 24;
  var panX = 0, panY = 0, zoom = 1;
  var cx = 0, cy = 0;

  var PK_MAX = 26000;
  var pkPts = new Float32Array(PK_MAX * 8);
  var pkMeta = new Int16Array(PK_MAX * 4);
  var pkCount = 0;

  /* ---------------------------------------------------------------- arrays */

  function idx(x, y, z) { return (z * N + y) * N + x; }

  function worldToView(x, y) {
    if (rot === 0) { return { x: x, y: y }; }
    if (rot === 1) { return { x: y, y: N - 1 - x }; }
    if (rot === 2) { return { x: N - 1 - x, y: N - 1 - y }; }
    return { x: N - 1 - y, y: x };
  }

  function viewToWorld(x, y) {
    if (rot === 0) { return { x: x, y: y }; }
    if (rot === 1) { return { x: N - 1 - y, y: x }; }
    if (rot === 2) { return { x: N - 1 - x, y: N - 1 - y }; }
    return { x: y, y: N - 1 - x };
  }

  function rebuildView() {
    var vx, vy, z, v, w;
    for (vy = 0; vy < N; vy++) {
      for (vx = 0; vx < N; vx++) {
        v = worldToView(vx, vy);          /* v is the world cell for this view cell */
        for (z = 0; z < H; z++) {
          view[idx(vx, vy, z)] = world[idx(v.x, v.y, z)];
        }
      }
    }
  }

  /* ----------------------------------------------------------- generation */

  var perm = null;

  function makePerm(s) {
    perm = new Uint8Array(256);
    var i, j, t;
    for (i = 0; i < 256; i++) { perm[i] = i; }
    var st = (s ^ 0x9e3779b9) >>> 0;
    for (i = 255; i > 0; i--) {
      st = (Math.floor(st * 1664525) + 1013904223) >>> 0;
      j = st % (i + 1);
      t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
  }

  function lcg(s) {
    var t = s >>> 0;
    return function () {
      t = (Math.floor(t * 1664525) + 1013904223) >>> 0;
      return t / 4294967296;
    };
  }

  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf);
    var v = yf * yf * (3 - 2 * yf);
    function g(a, b) { return perm[(a + perm[b & 255]) & 255] / 255; }
    var n00 = g(xi, yi), n10 = g(xi + 1, yi);
    var n01 = g(xi, yi + 1), n11 = g(xi + 1, yi + 1);
    var a = n00 + (n10 - n00) * u;
    var b = n01 + (n11 - n01) * u;
    return a + (b - a) * v;
  }

  function generate(s) {
    seed = s >>> 0;
    makePerm(seed);
    world = new Uint8Array(N * N * H);
    var x, y, z, h, b;

    for (y = 0; y < N; y++) {
      for (x = 0; x < N; x++) {
        h = 3 + vnoise(x * 0.14, y * 0.14) * 3.2 +
                vnoise(x * 0.33 + 40, y * 0.33 + 90) * 1.4;
        h = Math.round(h);
        if (h < 1) { h = 1; }
        if (h > H - 5) { h = H - 5; }

        for (z = 0; z < h; z++) {
          if (z < h - 3) { b = STONE; }
          else if (z < h - 1) { b = DIRT; }
          else { b = (h <= SEA + 1) ? SAND : GRASS; }
          world[idx(x, y, z)] = b;
        }
        for (z = h; z < SEA; z++) { world[idx(x, y, z)] = WATER; }
      }
    }

    /* trees */
    var rnd = lcg(seed ^ 0x5f3759df);
    var i, dx, dy, dz, th, top, lx, ly, lz;
    for (i = 0; i < 90; i++) {
      x = 2 + Math.floor(rnd() * (N - 4));
      y = 2 + Math.floor(rnd() * (N - 4));
      top = -1;
      for (z = H - 1; z >= 0; z--) {
        b = world[idx(x, y, z)];
        if (b !== AIR && b !== WATER) { top = z; break; }
      }
      if (top < SEA + 1 || world[idx(x, y, top)] !== GRASS) { continue; }
      if (top + 7 >= H) { continue; }
      th = 4 + Math.floor(rnd() * 2);

      for (z = 1; z <= th; z++) { world[idx(x, y, top + z)] = LOG; }
      for (dx = -2; dx <= 2; dx++) {
        for (dy = -2; dy <= 2; dy++) {
          for (dz = -1; dz <= 1; dz++) {
            if (Math.abs(dx) === 2 && Math.abs(dy) === 2 && dz === 1) { continue; }
            lx = x + dx; ly = y + dy; lz = top + th + dz;
            if (lx < 0 || ly < 0 || lz < 0 || lx >= N || ly >= N || lz >= H) { continue; }
            if (world[idx(lx, ly, lz)] === AIR) { world[idx(lx, ly, lz)] = LEAF; }
          }
        }
      }
    }
    rebuildView();
  }

  /* ------------------------------------------------------------ save/load */

  function packWorld(arr) {
    var s = '', i, j, end, part;
    for (i = 0; i < arr.length; i += 4096) {
      end = Math.min(i + 4096, arr.length);
      part = '';
      for (j = i; j < end; j++) { part += String.fromCharCode(arr[j]); }
      s += part;
    }
    return btoa(s);
  }

  function unpackWorld(str, arr) {
    var bin = atob(str), i;
    if (bin.length !== arr.length) { return false; }
    for (i = 0; i < bin.length; i++) { arr[i] = bin.charCodeAt(i); }
    return true;
  }

  function save() {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({
        v: 1,
        seed: seed,
        rot: rot,
        sel: sel,
        blocks: packWorld(world)
      }));
    } catch (e) { /* storage full or disabled: the world still works */ }
  }

  var saveTimer = null;
  function scheduleSave() {
    if (saveTimer) { clearTimeout(saveTimer); }
    saveTimer = setTimeout(function () { saveTimer = null; save(); }, 500);
  }

  function load() {
    var raw = null, o, tmp;
    try { raw = window.localStorage.getItem(STORE); } catch (e) { return false; }
    if (!raw) { return false; }
    try { o = JSON.parse(raw); } catch (e) { return false; }
    if (!o || o.v !== 1 || !o.blocks) { return false; }
    tmp = new Uint8Array(N * N * H);
    try { if (!unpackWorld(o.blocks, tmp)) { return false; } } catch (e) { return false; }
    world = tmp;
    seed = o.seed >>> 0;
    rot = (o.rot | 0) % 4;
    sel = o.sel || GRASS;
    if (!TYPES[sel]) { sel = GRASS; }
    rebuildView();
    return true;
  }

  /* ---------------------------------------------------------------- camera */

  function updateCamera() {
    var tw = tileW * zoom, th = tileH * zoom, bh = blockH * zoom;
    cx = canvas.width / 2 + panX;
    cy = canvas.height * 0.5 - (N * th) / 2 + 3.6 * bh + panY;
    void tw;
  }

  function layout() {
    var cssW = Math.max(240, window.innerWidth || 360);
    var cssH = Math.max(320, window.innerHeight || 640);
    var dpr = window.devicePixelRatio || 1;
    var k = Math.min(dpr, Math.max(1, 760 / cssW));

    canvas.width = Math.round(cssW * k);
    canvas.height = Math.round(cssH * k);

    tileW = canvas.width * 0.062;
    tileH = tileW * 0.5;
    blockH = tileW * 0.60;
    ctx.lineWidth = 1;

    updateCamera();
    render();
  }

  /* ---------------------------------------------------------------- render */

  function poly4(ax, ay, bx, by, cx2, cy2, dx, dy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx2, cy2);
    ctx.lineTo(dx, dy);
    ctx.closePath();
  }

  function paint(col, a) {
    if (a < 1) { ctx.globalAlpha = a; }
    ctx.fillStyle = col;
    ctx.fill();
    if (a >= 1) {
      ctx.strokeStyle = col;
      ctx.stroke();
    } else {
      ctx.globalAlpha = 1;
    }
  }

  function pkpush(ax, ay, bx, by, cx2, cy2, dx, dy, vx, vy, z, face) {
    if (pkCount >= PK_MAX) { return; }
    var o = pkCount * 8, m = pkCount * 4;
    pkPts[o] = ax; pkPts[o + 1] = ay;
    pkPts[o + 2] = bx; pkPts[o + 3] = by;
    pkPts[o + 4] = cx2; pkPts[o + 5] = cy2;
    pkPts[o + 6] = dx; pkPts[o + 7] = dy;
    pkMeta[m] = vx; pkMeta[m + 1] = vy; pkMeta[m + 2] = z; pkMeta[m + 3] = face;
    pkCount++;
  }

  function render() {
    var W = canvas.width, Hh = canvas.height;
    var sky = ctx.createLinearGradient(0, 0, 0, Hh);
    sky.addColorStop(0, '#6fa8ff');
    sky.addColorStop(0.5, '#a9ceff');
    sky.addColorStop(1, '#e2f0ff');
    ctx.globalAlpha = 1;
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Hh);

    pkCount = 0;
    var tw = tileW * zoom, th = tileH * zoom, bh = blockH * zoom;
    var ox = cx, oy = cy;
    var s, vx, vy, z, b, topZ, a0, a1, x0, y0, above, east, south, t;
    var ax, ay, bx, by, cx2, cy2, dx, dy;

    for (s = 0; s <= 2 * N - 2; s++) {
      a0 = s - (N - 1); if (a0 < 0) { a0 = 0; }
      a1 = s; if (a1 > N - 1) { a1 = N - 1; }

      for (vx = a0; vx <= a1; vx++) {
        vy = s - vx;
        x0 = ox + (vx - vy) * tw * 0.5;
        if (x0 < -tw * 1.6 || x0 > W + tw * 1.6) { continue; }

        topZ = -1;
        for (z = H - 1; z >= 0; z--) {
          if (view[(z * N + vy) * N + vx]) { topZ = z; break; }
        }
        if (topZ < 0) { continue; }

        for (z = 0; z <= topZ; z++) {
          b = view[(z * N + vy) * N + vx];
          if (!b) { continue; }

          above = (z + 1 < H) ? view[((z + 1) * N + vy) * N + vx] : 0;
          east  = (vx + 1 < N) ? view[(z * N + vy) * N + (vx + 1)] : 0;
          south = (vy + 1 < N) ? view[(z * N + (vy + 1)) * N + vx] : 0;
          t = TYPES[b];

          y0 = oy + (vx + vy) * th * 0.5 - (z + 1) * bh;
          ax = x0;              ay = y0;
          bx = x0 + tw * 0.5;   by = y0 + th * 0.5;
          cx2 = x0;             cy2 = y0 + th;
          dx = x0 - tw * 0.5;   dy = y0 + th * 0.5;

          if (!above) {
            poly4(ax, ay, bx, by, cx2, cy2, dx, dy);
            paint(t.topC, t.a);
            pkpush(ax, ay, bx, by, cx2, cy2, dx, dy, vx, vy, z, 0);
          }
          if (!east) {
            poly4(bx, by, cx2, cy2, cx2, cy2 + bh, bx, by + bh);
            paint(t.rightC, t.a);
            pkpush(bx, by, cx2, cy2, cx2, cy2 + bh, bx, by + bh, vx, vy, z, 1);
          }
          if (!south) {
            poly4(dx, dy, cx2, cy2, cx2, cy2 + bh, dx, dy + bh);
            paint(t.leftC, t.a);
            pkpush(dx, dy, cx2, cy2, cx2, cy2 + bh, dx, dy + bh, vx, vy, z, 2);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------- picking */

  function inTri(px, py, ax, ay, bx, by, cx2, cy2) {
    var d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    var d2 = (px - cx2) * (by - cy2) - (bx - cx2) * (py - cy2);
    var d3 = (px - ax) * (cy2 - ay) - (cx2 - ax) * (py - ay);
    var neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    var pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos);
  }

  function hit(px, py) {
    var i, o;
    for (i = pkCount - 1; i >= 0; i--) {
      o = i * 8;
      if (inTri(px, py, pkPts[o], pkPts[o + 1], pkPts[o + 2], pkPts[o + 3],
                pkPts[o + 4], pkPts[o + 5])) { return i; }
      if (inTri(px, py, pkPts[o], pkPts[o + 1], pkPts[o + 4], pkPts[o + 5],
                pkPts[o + 6], pkPts[o + 7])) { return i; }
    }
    return -1;
  }

  function setBlock(x, y, z, b) {
    if (x < 0 || y < 0 || z < 0 || x >= N || y >= N || z >= H) { return; }
    world[idx(x, y, z)] = b;
    var v = worldToView(x, y);
    view[idx(v.x, v.y, z)] = b;
    scheduleSave();
    render();
  }

  function act(px, py) {
    var i = hit(px, py);
    if (i < 0) { return; }

    var m = i * 4;
    var vx = pkMeta[m], vy = pkMeta[m + 1], z = pkMeta[m + 2], f = pkMeta[m + 3];
    var w = viewToWorld(vx, vy);
    var nvx = vx, nvy = vy, nz = z, nw;

    if (mode === 'break') {
      if (z > 0) { setBlock(w.x, w.y, z, AIR); }
      return;
    }

    if (f === 0) { nz = z + 1; }
    else if (f === 1) { nvx = vx + 1; }
    else { nvy = vy + 1; }

    if (nvx < 0 || nvy < 0 || nvx >= N || nvy >= N || nz >= H) { return; }
    nw = viewToWorld(nvx, nvy);
    if (world[idx(nw.x, nw.y, nz)] === AIR) { setBlock(nw.x, nw.y, nz, sel); }
  }

  /* --------------------------------------------------------------- pointer */

  function toCanvas(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var cw = canvas.width / (r.width || 1);
    var ch = canvas.height / (r.height || 1);
    return { x: (clientX - r.left) * cw, y: (clientY - r.top) * ch };
  }

  function evPos(e) {
    var t = e;
    if (e.touches && e.touches.length) { t = e.touches[0]; }
    else if (e.changedTouches && e.changedTouches.length) { t = e.changedTouches[0]; }
    return toCanvas(t.clientX || 0, t.clientY || 0);
  }

  var down = false, moved = false;
  var lastX = 0, lastY = 0, startX = 0, startY = 0;

  function onDown(e) {
    var p = evPos(e);
    down = true;
    moved = false;
    startX = p.x; startY = p.y;
    lastX = p.x; lastY = p.y;
    if (e.preventDefault && e.type !== 'mousedown') { e.preventDefault(); }
  }

  function onMove(e) {
    if (!down) { return; }
    var p = evPos(e);
    if (!moved && (Math.abs(p.x - startX) + Math.abs(p.y - startY) > 14)) { moved = true; }
    if (moved) {
      panX += p.x - lastX;
      panY += p.y - lastY;
      lastX = p.x; lastY = p.y;
      updateCamera();
      render();
      if (e.preventDefault) { e.preventDefault(); }
    }
  }

  function onUp(e) {
    if (!down) { return; }
    down = false;
    if (!moved) {
      var p = evPos(e);
      act(p.x, p.y);
    }
  }

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', onDown, false);
    canvas.addEventListener('pointermove', onMove, false);
    canvas.addEventListener('pointerup', onUp, false);
    canvas.addEventListener('pointercancel', function () { down = false; }, false);
  } else {
    canvas.addEventListener('mousedown', onDown, false);
    window.addEventListener('mousemove', onMove, false);
    window.addEventListener('mouseup', onUp, false);
    canvas.addEventListener('touchstart', onDown, false);
    window.addEventListener('touchmove', onMove, false);
    window.addEventListener('touchend', onUp, false);
  }

  /* ------------------------------------------------------------------- ui */

  function buildHotbar() {
    var i, el, inner;
    hotbar.innerHTML = '';
    for (i = 1; i < TYPES.length; i++) {
      if (!TYPES[i]) { continue; }
      el = document.createElement('button');
      el.className = 'slot' + (i === sel ? ' on' : '');
      el.setAttribute('data-id', String(i));
      inner = document.createElement('i');
      inner.style.background = TYPES[i].top;
      el.appendChild(inner);
      var cap = document.createElement('span');
      cap.textContent = TYPES[i].n;
      el.appendChild(cap);
      hotbar.appendChild(el);
    }
    selName.textContent = TYPES[sel].n;
  }

  hotbar.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== hotbar && !el.getAttribute('data-id')) { el = el.parentNode; }
    if (!el || el === hotbar) { return; }
    var id = parseInt(el.getAttribute('data-id'), 10);
    if (!TYPES[id]) { return; }
    sel = id;
    var slots = hotbar.childNodes, i;
    for (i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (s.className && s.className.indexOf('slot') === 0) {
        s.className = 'slot' + (parseInt(s.getAttribute('data-id'), 10) === sel ? ' on' : '');
      }
    }
    selName.textContent = TYPES[sel].n;
    scheduleSave();
  }, false);

  function setMode(m) {
    mode = m;
    document.getElementById('modeBuild').className = 'mode' + (m === 'build' ? ' on' : '');
    document.getElementById('modeBreak').className = 'mode' + (m === 'break' ? ' on' : '');
  }

  document.getElementById('modeBuild').addEventListener('click', function () { setMode('build'); }, false);
  document.getElementById('modeBreak').addEventListener('click', function () { setMode('break'); }, false);

  document.getElementById('zoomIn').addEventListener('click', function () {
    zoom = Math.min(1.8, zoom * 1.22); updateCamera(); render();
  }, false);
  document.getElementById('zoomOut').addEventListener('click', function () {
    zoom = Math.max(0.5, zoom / 1.22); updateCamera(); render();
  }, false);

  document.getElementById('btnRotate').addEventListener('click', function () {
    rot = (rot + 1) % 4;
    rebuildView();
    render();
    scheduleSave();
  }, false);

  function openSheet(id) { document.getElementById(id).className = 'overlay on'; }
  function closeSheet(id) { document.getElementById(id).className = 'overlay'; }

  document.getElementById('sheetOk').addEventListener('click', function () { closeSheet('sheet'); }, false);
  document.getElementById('newNo').addEventListener('click', function () { closeSheet('confirm'); }, false);
  document.getElementById('btnNew').addEventListener('click', function () { openSheet('confirm'); }, false);

  document.getElementById('newYes').addEventListener('click', function () {
    closeSheet('confirm');
    generate((Math.floor(Math.random() * 2147483646) + 1) >>> 0);
    panX = 0; panY = 0; zoom = 1;
    updateCamera();
    render();
    save();
  }, false);

  document.getElementById('btnInfo').addEventListener('click', function () {
    var s = window.__pcStats ? window.__pcStats() : {};
    var lines = [];
    lines.push('PocketCraft 1.0.0.0');
    lines.push('canvas   ' + s.width + ' x ' + s.height + '  (device pixel ratio ' +
      (window.devicePixelRatio || 1) + ')');
    lines.push('world    ' + N + ' x ' + N + ' x ' + H + '  seed ' + s.seed);
    lines.push('blocks   ' + s.blocks + '  faces drawn ' + s.faces);
    lines.push('zoom     ' + (s.zoom ? s.zoom.toFixed(2) : '1.00') + '   rotation ' + s.rot);
    lines.push('storage  ' + (s.storage ? 'available' : 'unavailable'));
    lines.push('');
    lines.push('checks: ' + (s.probe || '(none)'));
    lines.push('');
    lines.push(navigator.userAgent || '');
    document.getElementById('sheetText').textContent = lines.join('\n');
    openSheet('sheet');
  }, false);

  /* -------------------------------------------------------------- start up */

  function countBlocks() {
    var n = 0, i;
    for (i = 0; i < world.length; i++) { if (world[i]) { n++; } }
    return n;
  }

  window.__pcStats = function () {
    var storage = false;
    try {
      window.localStorage.setItem('pocketcraft.probe', '1');
      window.localStorage.removeItem('pocketcraft.probe');
      storage = true;
    } catch (e) { storage = false; }
    return {
      width: canvas.width, height: canvas.height,
      faces: pkCount, blocks: countBlocks(),
      seed: seed, rot: rot, zoom: zoom, sel: sel, mode: mode,
      storage: storage, probe: window.__pcProbe || ''
    };
  };

  if (!load()) {
    generate((Math.floor(Math.random() * 2147483646) + 1) >>> 0);
  }

  buildHotbar();
  setMode('build');
  layout();

  window.addEventListener('resize', function () { layout(); }, false);

  setTimeout(function () { hint.className = 'off'; }, 8000);

  window.__pcBooted = true;
})();
