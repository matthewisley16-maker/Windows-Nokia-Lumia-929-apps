(function () {
  "use strict";

  var APP_VER = "1.4.0.0";
  var PK = "freepaint.projects.v2";
  var PW = 1920, PH = 1080;           // paper units, 16:9
  var SIZES = [6, 14, 28, 52];
  var SIZE_LABEL = ["S", "M", "L", "XL"];
  var FPS_PRESET = [5, 8, 10, 12, 15, 24, 30];
  var FPS_MIN = 1, FPS_MAX = 60;
  var HANDLE_R = 13;                   // selection rotate handle, screen px
  var FILL_W = 960, FILL_H = 540;      // raster the bucket floods (half the paper)
  var FILL_TOL = 42;                   // colour distance treated as the same area
  var COLOURS = ["#111111", "#37474f", "#e53935", "#fb8c00", "#fdd835",
                 "#43a047", "#00acc1", "#1e88e5", "#8e24aa", "#6d4c41"];

  var EMPTY_THUMB = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function nowMs() { return +new Date(); }
  function isOn(el) { return !!el && el.className.indexOf("on") >= 0; }
  function setScreen(el, on) { el.className = on ? "screen on" : "screen"; }
  function setOverlay(el, on) { el.className = on ? "overlay on" : "overlay"; }

  var home = $("home"), editor = $("editor"), grid = $("grid"),
      emptyhint = $("emptyhint"), bar = $("bar"), stage = $("stage"),
      paper = $("paper"), sizesBox = $("sizes"), animBox = $("anim"),
      thumbsBox = $("thumbs"), fstat = $("fstat"), cprev = $("cprev"),
      zoombadge = $("zoombadge"), newsheet = $("newsheet"), pname = $("pname"),
      saveSheet = $("sheet"), shot = $("shot"), sheetNote = $("sheetnote"),
      wheelsheet = $("wheelsheet"), wheelCv = $("wheel"), wprev = $("wprev"),
      whex = $("whex"), diag = $("diag"), diagText = $("diagtext"),
      jsfail = $("jsfail"), toastEl = $("toast"), playBtn = $("bplay"),
      fpsBtn = $("bfps"), onionBtn = $("bonion"),
      menuBox = $("barmenu"), barChev = $("barchev"), barTitle = $("bartitle"),
      fpsSheet = $("fpsheet"), fpsValue = $("fpsvalue"), fpsRange = $("fpsrange"),
      fpsPresets = $("fpspresets"), confirmSheet = $("confirmsheet"),
      cTitle = $("ctitle"), cMsg = $("cmsg"), cOk = $("cok"),
      exportSheet = $("exportsheet"), exportNote = $("exportnote"),
      exportStatus = $("exportstatus"), exFrames = $("exframes"), exMp4 = $("exmp4");

  var pctx = paper.getContext("2d");
  var layer = document.createElement("canvas");
  var lctx = layer.getContext("2d");

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 1, H = 1, PWpix = 1, PHpix = 1, baseScale = 1;

  var projects = [];
  var proj = null;
  var frameIdx = 0;
  var tool = "pen";
  var color = COLOURS[0];
  var sizeIdx = 1;
  var defaultFps = 10;
  var onion = true;
  var menuOpen = true;
  var framesOpen = false;
  var playing = false;
  var playTimer = null;
  var view = { z: 1, tx: 0, ty: 0 };

  var curStroke = null;
  var lastPt = null;
  var sel = null, selDrag = null, lasso = null, undoSnap = null, pendingConfirm = null;
  var armed = false;
  var armTimer = null;
  var toastTimer = null;

  var pointers = {};
  var pinch = null;
  var tap = null;
  var hits = { p: 0, t: 0, m: 0, last: "none" };

  /* ================= colour maths ================= */

  function hsvToRgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function rgbToHsv(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 0) {
      if (mx === r) { h = 60 * (((g - b) / d) % 6); }
      else if (mx === g) { h = 60 * (((b - r) / d) + 2); }
      else { h = 60 * (((r - g) / d) + 4); }
    }
    if (h < 0) { h += 360; }
    return [h, mx === 0 ? 0 : d / mx, mx / 255];
  }

  function hex2rgb(hex) {
    var s = hex.replace("#", "");
    return [parseInt(s.substr(0, 2), 16), parseInt(s.substr(2, 2), 16), parseInt(s.substr(4, 2), 16)];
  }

  function rgb2hex(rgb) {
    var s = "#", i, v;
    for (i = 0; i < 3; i++) {
      v = clamp(rgb[i], 0, 255).toString(16);
      s += v.length < 2 ? "0" + v : v;
    }
    return s;
  }

  var hue = 0, sat = 0, val = 0.07;

  /* ================= paper rendering ================= */

  function isFlip() { return !!proj && proj.type === "flip"; }
  function strokesNow() { return proj ? proj.frames[frameIdx].strokes : []; }
  function viewScale() { return baseScale * view.z; }

  function applyView(g) {
    var s = viewScale();
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.tx, dpr * view.ty);
  }

  function strokeStyleFor(g, s) {
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = s.size;
    g.strokeStyle = s.color;
    g.fillStyle = s.color;
    g.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  }

  function paint(g, s) {
    var p = s.pts, i, n = p.length, mx, my;
    if (n < 1) { return; }
    strokeStyleFor(g, s);
    if (n === 1) {
      g.beginPath();
      g.arc(p[0].x, p[0].y, s.size / 2, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "source-over";
      return;
    }
    g.beginPath();
    if (n === 2) {
      g.moveTo(p[0].x, p[0].y);
      g.lineTo(p[1].x, p[1].y);
    } else {
      g.moveTo(p[0].x, p[0].y);
      for (i = 1; i < n - 1; i++) {
        mx = (p[i].x + p[i + 1].x) / 2;
        my = (p[i].y + p[i + 1].y) / 2;
        g.quadraticCurveTo(p[i].x, p[i].y, mx, my);
      }
      g.lineTo(p[n - 1].x, p[n - 1].y);
    }
    g.stroke();
    g.globalCompositeOperation = "source-over";
  }

  function paintAll(g, strokes) {
    var i;
    for (i = 0; i < strokes.length; i++) { paint(g, strokes[i]); }
    g.globalCompositeOperation = "source-over";
  }

  function framesFills(fr) {
    if (!fr.fills) { fr.fills = []; }
    return fr.fills;
  }

  // A fill is a half-resolution mask: transparent everywhere except the
  // flooded region, so it can sit above or below ink depending on when it was
  // made. New fills keep their canvas; loaded ones decode from the saved PNG.
  function drawFill(g, f) {
    var src = f._cv, img = f._img, w;
    if (!src) {
      if (!f.d) { return; }
      if (!img) {
        img = new Image();
        img.onload = function () { if (proj) { renderFull(); } };
        img.src = f.d;
        f._img = img;
      }
      w = img.naturalWidth || img.width;
      if (!img.complete || !w) { return; }
      src = img;
    }
    g.drawImage(src, 0, 0, PW, PH);
  }

  function drawContent(g, fr) {
    var ops = fr.op || "", fills = fr.fills || [], i, ch, si = 0, fi = 0;
    if (ops) {
      for (i = 0; i < ops.length; i++) {
        ch = ops.charAt(i);
        if (ch === "f") {
          if (fi < fills.length) { drawFill(g, fills[fi]); }
          fi++;
        } else {
          if (si < fr.strokes.length) { paint(g, fr.strokes[si]); }
          si++;
        }
      }
    }
    for (; fi < fills.length; fi++) { drawFill(g, fills[fi]); }
    for (; si < fr.strokes.length; si++) { paint(g, fr.strokes[si]); }
    g.globalCompositeOperation = "source-over";
  }

  function present() {
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.globalCompositeOperation = "source-over";
    pctx.globalAlpha = 1;
    pctx.fillStyle = "#070a0c";
    pctx.fillRect(0, 0, PWpix, PHpix);
    applyView(pctx);
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(0, 0, PW, PH);
    if (onion && isFlip() && frameIdx > 0 && !playing) {
      pctx.globalAlpha = 0.18;
      drawContent(pctx, proj.frames[frameIdx - 1]);
      pctx.globalAlpha = 1;
    }
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.drawImage(layer, 0, 0);
    if (lasso) { drawLassoUi(); }
    else if (sel && sel.idx.length) { drawSelUi(); }
  }

  function renderFull() {
    if (!proj) { return; }
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, PWpix, PHpix);
    applyView(lctx);
    drawContent(lctx, proj.frames[frameIdx]);
    present();
    updateUndo();
  }

  function drawDot(s, p) {
    applyView(lctx);
    strokeStyleFor(lctx, s);
    lctx.beginPath();
    lctx.arc(p.x, p.y, s.size / 2, 0, Math.PI * 2);
    lctx.fill();
    lctx.globalCompositeOperation = "source-over";
  }

  function drawSegment(s, a, b) {
    applyView(lctx);
    strokeStyleFor(lctx, s);
    lctx.beginPath();
    lctx.moveTo(a.x, a.y);
    lctx.lineTo(b.x, b.y);
    lctx.stroke();
    lctx.globalCompositeOperation = "source-over";
  }

  /* ================= layout and view ================= */

  function layout() {
    if (!proj) { return; }
    var bh = bar.offsetHeight || 80;
    stage.style.top = bh + "px";
    var r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    PWpix = Math.max(1, Math.round(W * dpr));
    PHpix = Math.max(1, Math.round(H * dpr));
    paper.width = PWpix;
    paper.height = PHpix;
    layer.width = PWpix;
    layer.height = PHpix;
    baseScale = Math.max(W / PW, H / PH);
    clampPan();
    renderFull();
    updateZoomBadge();
  }

  function clampPan() {
    var s = viewScale(), pw = PW * s, ph = PH * s;
    view.tx = pw <= W ? (W - pw) / 2 : clamp(view.tx, W - pw, 0);
    view.ty = ph <= H ? (H - ph) / 2 : clamp(view.ty, H - ph, 0);
  }

  function updateZoomBadge() {
    zoombadge.textContent = Math.round(view.z * 100) + "%";
  }

  function zoomBy(f) {
    if (!proj) { return; }
    var s0 = viewScale(), cx = W / 2, cy = H / 2;
    var pmx = (cx - view.tx) / s0, pmy = (cy - view.ty) / s0;
    view.z = clamp(view.z * f, 1, 8);
    var s = viewScale();
    view.tx = cx - pmx * s;
    view.ty = cy - pmy * s;
    clampPan();
    renderFull();
    updateZoomBadge();
  }

  function zoomFit() {
    view.z = 1;
    view.tx = 0;
    view.ty = 0;
    clampPan();
    renderFull();
    updateZoomBadge();
  }

  function paperPointOf(clientX, clientY) {
    var r = paper.getBoundingClientRect(), s = viewScale();
    return {
      x: clamp((clientX - r.left - view.tx) / s, 0, PW),
      y: clamp((clientY - r.top - view.ty) / s, 0, PH)
    };
  }

  function insideStage(clientX, clientY) {
    var r = paper.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right &&
           clientY >= r.top && clientY <= r.bottom;
  }

  function uiBlocked() {
    return isOn(newsheet) || isOn(wheelsheet) || isOn(saveSheet) ||
           isOn(diag) || isOn(fpsSheet) || isOn(confirmSheet) || isOn(exportSheet);
  }

  /* ================= drawing ================= */

  function setTool(name) {
    tool = name;
    var bs = bar.getElementsByTagName("button"), i, t;
    for (i = 0; i < bs.length; i++) {
      t = bs[i].getAttribute("data-tool");
      if (t) { bs[i].className = t === name ? "tool on" : "tool"; }
    }
    if (name !== "select") {
      sel = null;
      lasso = null;
      selDrag = null;
    }
    updateBarTitle();
    if (name === "select" && proj) {
      toast("Loop around the strokes you want, then drag to move");
    }
    if (name === "bucket" && proj) {
      toast("Tap inside a shape to fill it");
    }
    renderFull();
  }

  function setColor(hex) {
    var rgb = hex2rgb(hex), hsv;
    color = hex;
    hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    hue = hsv[0];
    sat = hsv[1];
    val = hsv[2];
    if (cprev) { cprev.style.background = hex; }
    if (wprev) { wprev.style.background = hex; }
    if (whex) { whex.textContent = hex; }
    updateBarTitle();
    drawWheel();
  }

  function startStrokeAt(p) {
    if (!proj || playing || pinch || tool === "select" || tool === "bucket") { return; }
    undoSnap = null;
    var s = {
      color: tool === "eraser" ? "#ffffff" : color,
      size: SIZES[sizeIdx] * (tool === "eraser" ? 3 : 1),
      erase: tool === "eraser",
      pts: [p]
    };
    strokesNow().push(s);
    curStroke = s;
    lastPt = p;
    drawDot(s, p);
    present();
    updateUndo();
  }

  function extendStrokeAt(p) {
    if (!curStroke) { return; }
    if (lastPt && Math.abs(p.x - lastPt.x) < 0.7 && Math.abs(p.y - lastPt.y) < 0.7) { return; }
    curStroke.pts.push(p);
    drawSegment(curStroke, lastPt, p);
    lastPt = p;
    present();
  }

  function endStroke() {
    if (!curStroke) { return; }
    if (proj) {
      var fr = proj.frames[frameIdx];
      fr.op = (fr.op || "") + "s";
    }
    curStroke = null;
    lastPt = null;
    bumpRev();
    updateUndo();
  }

  function cancelStroke() {
    if (!curStroke) { return; }
    var strokes = strokesNow();
    if (strokes.length && strokes[strokes.length - 1] === curStroke) {
      strokes.pop();
    }
    curStroke = null;
    lastPt = null;
    renderFull();
  }

  function updateUndo() {
    var bs = bar.getElementsByTagName("button"), i;
    var fr = proj ? proj.frames[frameIdx] : null;
    var has = !!fr && (fr.strokes.length > 0 ||
      (fr.fills && fr.fills.length > 0) || !!undoSnap);
    for (i = 0; i < bs.length; i++) {
      if (bs[i].getAttribute("data-act") === "undo") {
        bs[i].className = has ? "tool" : "tool off";
        bs[i].disabled = !has;
      }
    }
  }

  function clearFrame() {
    if (!proj || playing) { return; }
    strokesNow().length = 0;
    if (proj.frames[frameIdx].fills) { proj.frames[frameIdx].fills.length = 0; }
    proj.frames[frameIdx].op = "";
    curStroke = null;
    sel = null;
    undoSnap = null;
    bumpRev();
    renderFull();
    updateFrames();
  }

  function undoFrame() {
    if (!proj) { return; }
    var fr = proj.frames[frameIdx], op = fr.op || "", fills = fr.fills || [];
    var last = op.charAt(op.length - 1);
    if (last === "f" && fills.length) {
      fills.pop();
      fr.op = op.slice(0, -1);
    } else if (last === "s" && fr.strokes.length) {
      fr.strokes.pop();
      fr.op = op.slice(0, -1);
    } else if (fr.strokes.length) {
      fr.strokes.pop();
    } else if (fills.length) {
      fills.pop();
    } else {
      return;
    }
    sel = null;
    bumpRev();
    renderFull();
    updateFrames();
  }

  /* ================= bucket fill ================= */

  // Scanline flood fill over the half-res render of the current frame.
  function floodMask(fw, fh, sx, sy, near) {
    var vis = new Uint8Array(fw * fh);
    var stack = [sx, sy], x, y, w, up, down;
    while (stack.length) {
      y = stack.pop();
      x = stack.pop();
      if (x < 0 || x >= fw || y < 0 || y >= fh) { continue; }
      w = y * fw + x;
      if (vis[w] || !near(x, y)) { continue; }
      while (x > 0) {
        w = y * fw + x - 1;
        if (vis[w] || !near(x - 1, y)) { break; }
        x--;
      }
      w = y * fw + x;
      up = false;
      down = false;
      while (x < fw && !vis[w] && near(x, y)) {
        vis[w] = 1;
        if (y > 0) {
          if (!up && !vis[w - fw] && near(x, y - 1)) {
            stack.push(x, y - 1);
            up = true;
          } else if (up && (vis[w - fw] || !near(x, y - 1))) {
            up = false;
          }
        }
        if (y < fh - 1) {
          if (!down && !vis[w + fw] && near(x, y + 1)) {
            stack.push(x, y + 1);
            down = true;
          } else if (down && (vis[w + fw] || !near(x, y + 1))) {
            down = false;
          }
        }
        x++;
        w++;
      }
    }
    return vis;
  }

  // Grow the mask by one pixel so anti-aliased stroke edges do not leave a
  // white halo between the ink and the fill.
  function growMask(mask, fw, fh) {
    var out = new Uint8Array(fw * fh), x, y, i;
    for (y = 0; y < fh; y++) {
      for (x = 0; x < fw; x++) {
        i = y * fw + x;
        if (mask[i] ||
            (x > 0 && mask[i - 1]) || (x < fw - 1 && mask[i + 1]) ||
            (y > 0 && mask[i - fw]) || (y < fh - 1 && mask[i + fw])) {
          out[i] = 1;
        }
      }
    }
    return out;
  }

  function bucketAt(p) {
    if (!proj || playing || pinch) { return; }
    var fr = proj.frames[frameIdx], fw = FILL_W, fh = FILL_H;
    var c = document.createElement("canvas"), g, d, sx, sy, at, tr, tg, tb, rgb;
    var mask, out, mark, i, j;
    c.width = fw;
    c.height = fh;
    g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, fw, fh);
    g.setTransform(fw / PW, 0, 0, fh / PH, 0, 0);
    drawContent(g, fr);
    g.setTransform(1, 0, 0, 1, 0, 0);
    sx = clamp(Math.round(p.x * fw / PW), 0, fw - 1);
    sy = clamp(Math.round(p.y * fh / PH), 0, fh - 1);
    try {
      d = g.getImageData(0, 0, fw, fh).data;
    } catch (e) {
      toast("The bucket cannot read this canvas");
      return;
    }
    at = (sy * fw + sx) * 4;
    tr = d[at];
    tg = d[at + 1];
    tb = d[at + 2];
    rgb = hex2rgb(color);
    if (Math.abs(tr - rgb[0]) <= 8 && Math.abs(tg - rgb[1]) <= 8 &&
        Math.abs(tb - rgb[2]) <= 8) {
      toast("Already " + color);
      return;
    }
    function near(x, y) {
      var k = (y * fw + x) * 4;
      return Math.abs(d[k] - tr) <= FILL_TOL &&
             Math.abs(d[k + 1] - tg) <= FILL_TOL &&
             Math.abs(d[k + 2] - tb) <= FILL_TOL;
    }
    mask = growMask(floodMask(fw, fh, sx, sy, near), fw, fh);
    out = g.createImageData(fw, fh);
    mark = out.data;
    j = 0;
    for (i = 0; i < fw * fh; i++) {
      if (mask[i]) {
        mark[i * 4] = rgb[0];
        mark[i * 4 + 1] = rgb[1];
        mark[i * 4 + 2] = rgb[2];
        mark[i * 4 + 3] = 255;
        j++;
      }
    }
    if (!j) {
      toast("Nothing to fill there");
      return;
    }
    var mc = document.createElement("canvas"), f;
    mc.width = fw;
    mc.height = fh;
    mc.getContext("2d").putImageData(out, 0, 0);
    f = { c: color, d: "", _cv: mc };
    try { f.d = mc.toDataURL("image/png"); } catch (e2) { f.d = ""; }
    framesFills(fr).push(f);
    fr.op = (fr.op || "") + "f";
    bumpRev();
    renderFull();
    updateUndo();
    updateFrames();
    saveStore();
    toast("Filled");
  }

  /* ================= select / move / rotate ================= */

  function bumpRev() {
    if (!proj) { return; }
    var fr = proj.frames[frameIdx];
    if (fr) { fr.rev = (fr.rev || 0) + 1; }
  }

  function snapFrame() {
    var st = strokesNow(), out = [], i;
    for (i = 0; i < st.length; i++) { out.push(cloneStroke(st[i])); }
    return out;
  }

  function pointInPoly(x, y, poly) {
    var i, j, inside = false, xi, yi, xj, yj;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      xi = poly[i].x; yi = poly[i].y;
      xj = poly[j].x; yj = poly[j].y;
      if (((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function strokeBox(s) {
    var i, p, h = s.size / 2;
    var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    if (!s.pts.length) { return { x0: 0, y0: 0, x1: 0, y1: 0 }; }
    for (i = 0; i < s.pts.length; i++) {
      p = s.pts[i];
      if (p.x < b.x0) { b.x0 = p.x; }
      if (p.x > b.x1) { b.x1 = p.x; }
      if (p.y < b.y0) { b.y0 = p.y; }
      if (p.y > b.y1) { b.y1 = p.y; }
    }
    b.x0 -= h; b.y0 -= h; b.x1 += h; b.y1 += h;
    return b;
  }

  function selBounds() {
    if (!proj || !sel || !sel.idx.length) { return null; }
    var st = strokesNow(), i, b, any = false;
    var o = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    for (i = 0; i < sel.idx.length; i++) {
      b = st[sel.idx[i]] ? strokeBox(st[sel.idx[i]]) : null;
      if (!b) { continue; }
      any = true;
      if (b.x0 < o.x0) { o.x0 = b.x0; }
      if (b.y0 < o.y0) { o.y0 = b.y0; }
      if (b.x1 > o.x1) { o.x1 = b.x1; }
      if (b.y1 > o.y1) { o.y1 = b.y1; }
    }
    return any ? o : null;
  }

  function selUi() {
    var b = selBounds();
    if (!b) { return null; }
    var s = viewScale();
    var sx0 = b.x0 * s + view.tx, sy0 = b.y0 * s + view.ty;
    var sx1 = b.x1 * s + view.tx, sy1 = b.y1 * s + view.ty;
    var hy = sy0 - 30;
    if (hy < HANDLE_R + 4) { hy = HANDLE_R + 4; }
    return { sx0: sx0, sy0: sy0, sx1: sx1, sy1: sy1,
             hx: (sx0 + sx1) / 2, hy: hy };
  }

  function drawLassoUi() {
    if (!lasso || lasso.pts.length < 2) { return; }
    var s = viewScale(), i, p;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.globalAlpha = 1;
    pctx.globalCompositeOperation = "source-over";
    pctx.beginPath();
    p = lasso.pts[0];
    pctx.moveTo(p.x * s + view.tx, p.y * s + view.ty);
    for (i = 1; i < lasso.pts.length; i++) {
      p = lasso.pts[i];
      pctx.lineTo(p.x * s + view.tx, p.y * s + view.ty);
    }
    pctx.closePath();
    pctx.lineWidth = 1.5;
    if (pctx.setLineDash) { pctx.setLineDash([6, 4]); }
    pctx.strokeStyle = "#00c853";
    pctx.stroke();
    if (pctx.setLineDash) { pctx.setLineDash([]); }
  }

  function drawSelUi() {
    var u = selUi();
    if (!u) { return; }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.globalAlpha = 1;
    pctx.globalCompositeOperation = "source-over";
    pctx.lineWidth = 1.5;
    if (pctx.setLineDash) { pctx.setLineDash([6, 4]); }
    pctx.strokeStyle = "#00c853";
    pctx.strokeRect(u.sx0, u.sy0, Math.max(2, u.sx1 - u.sx0), Math.max(2, u.sy1 - u.sy0));
    pctx.beginPath();
    pctx.moveTo(u.hx, u.sy0);
    pctx.lineTo(u.hx, u.hy + HANDLE_R - 2);
    pctx.stroke();
    if (pctx.setLineDash) { pctx.setLineDash([]); }
    pctx.beginPath();
    pctx.arc(u.hx, u.hy, HANDLE_R, 0, Math.PI * 2);
    pctx.fillStyle = "#00a846";
    pctx.fill();
    pctx.lineWidth = 1.5;
    pctx.strokeStyle = "#eafff2";
    pctx.stroke();
    pctx.beginPath();
    pctx.arc(u.hx, u.hy, 5.5, -Math.PI * 0.95, Math.PI * 0.55);
    pctx.lineWidth = 2;
    pctx.strokeStyle = "#04120a";
    pctx.stroke();
  }

  function beginLasso(p) {
    sel = null;
    lasso = { pts: [p] };
    renderFull();
  }

  function lassoAdd(p) {
    if (!lasso) { return; }
    var last = lasso.pts[lasso.pts.length - 1], s = viewScale();
    var dx = (p.x - last.x) * s, dy = (p.y - last.y) * s;
    if ((dx * dx + dy * dy) < 49) { return; }
    if (lasso.pts.length > 320) { return; }
    lasso.pts.push(p);
    present();
  }

  function selectFromLasso() {
    var poly = lasso ? lasso.pts : [], st = strokesNow(), idx = [];
    var i, k, s, n, b, cx, cy;
    lasso = null;
    if (poly.length >= 4) {
      for (i = 0; i < st.length; i++) {
        s = st[i];
        if (!s.pts.length) { continue; }
        n = 0;
        for (k = 0; k < s.pts.length; k++) {
          if (pointInPoly(s.pts[k].x, s.pts[k].y, poly)) { n++; }
        }
        if (n && n / s.pts.length >= 0.34) { idx.push(i); continue; }
        b = strokeBox(s);
        cx = (b.x0 + b.x1) / 2;
        cy = (b.y0 + b.y1) / 2;
        if (pointInPoly(cx, cy, poly)) { idx.push(i); }
      }
    }
    sel = idx.length ? { idx: idx } : null;
    renderFull();
    if (idx.length) {
      toast(idx.length === 1 ? "1 piece selected" : idx.length + " pieces selected");
    }
  }

  function beginSelDrag(mode, p) {
    var b = selBounds();
    if (!b) { return; }
    undoSnap = snapFrame();
    selDrag = {
      mode: mode, lx: p.x, ly: p.y,
      cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2
    };
    selDrag.la = Math.atan2(p.y - selDrag.cy, p.x - selDrag.cx);
  }

  function moveSelDrag(p) {
    if (!selDrag || !sel) { return; }
    var st = strokesNow(), i, k, s, b, dx, dy, a, da, cos, sin, lx, ly, lo, hi;
    if (selDrag.mode === "move") {
      b = selBounds();
      if (!b) { return; }
      lo = -b.x0;
      hi = PW - b.x1;
      dx = hi < lo ? 0 : clamp(p.x - selDrag.lx, lo, hi);
      lo = -b.y0;
      hi = PH - b.y1;
      dy = hi < lo ? 0 : clamp(p.y - selDrag.ly, lo, hi);
      selDrag.lx = p.x;
      selDrag.ly = p.y;
      if (!dx && !dy) { return; }
      for (i = 0; i < sel.idx.length; i++) {
        s = st[sel.idx[i]];
        if (!s) { continue; }
        for (k = 0; k < s.pts.length; k++) {
          s.pts[k].x += dx;
          s.pts[k].y += dy;
        }
      }
    } else {
      a = Math.atan2(p.y - selDrag.cy, p.x - selDrag.cx);
      da = a - selDrag.la;
      if (!da) { return; }
      cos = Math.cos(da);
      sin = Math.sin(da);
      for (i = 0; i < sel.idx.length; i++) {
        s = st[sel.idx[i]];
        if (!s) { continue; }
        for (k = 0; k < s.pts.length; k++) {
          lx = s.pts[k].x - selDrag.cx;
          ly = s.pts[k].y - selDrag.cy;
          s.pts[k].x = selDrag.cx + lx * cos - ly * sin;
          s.pts[k].y = selDrag.cy + lx * sin + ly * cos;
        }
      }
      selDrag.la = a;
    }
    renderFull();
  }

  function selGestureEnd() {
    if (selDrag) {
      selDrag = null;
      bumpRev();
      renderFull();
      return true;
    }
    if (lasso) {
      selectFromLasso();
      return true;
    }
    return false;
  }

  function cancelGestures() {
    cancelStroke();
    if (lasso) { lasso = null; renderFull(); }
    if (selDrag) { selDrag = null; renderFull(); }
  }

  function gestureActive() { return !!(curStroke || selDrag || lasso); }

  function stageDown(p) {
    if (!proj || playing || pinch) { return; }
    if (tool === "bucket") { bucketAt(p); return; }
    if (tool !== "select") { startStrokeAt(p); return; }
    var u = selUi(), s, sp, dx, dy;
    if (u) {
      s = viewScale();
      sp = { x: p.x * s + view.tx, y: p.y * s + view.ty };
      dx = sp.x - u.hx;
      dy = sp.y - u.hy;
      if (Math.sqrt(dx * dx + dy * dy) <= HANDLE_R + 12) {
        beginSelDrag("rotate", p);
        return;
      }
      if (sp.x >= u.sx0 && sp.x <= u.sx1 && sp.y >= u.sy0 && sp.y <= u.sy1) {
        beginSelDrag("move", p);
        return;
      }
    }
    beginLasso(p);
  }

  function stageMove(p) {
    if (selDrag) { moveSelDrag(p); return; }
    if (lasso) { lassoAdd(p); return; }
    if (curStroke) { extendStrokeAt(p); }
  }

  /* ================= gestures ================= */

  function countPointers() {
    var n = 0, k;
    for (k in pointers) { if (pointers.hasOwnProperty(k)) { n++; } }
    return n;
  }

  function twoPointers() {
    var a = null, b = null, k;
    for (k in pointers) {
      if (pointers.hasOwnProperty(k)) {
        if (!a) { a = pointers[k]; } else if (!b) { b = pointers[k]; }
      }
    }
    return (a && b) ? [a, b] : null;
  }

  function beginPinch() {
    var two = twoPointers(), dx, dy, mx, my, s = viewScale();
    if (!two) { return; }
    dx = two[1].x - two[0].x;
    dy = two[1].y - two[0].y;
    mx = (two[0].x + two[1].x) / 2;
    my = (two[0].y + two[1].y) / 2;
    var r = paper.getBoundingClientRect();
    pinch = {
      d0: Math.max(1, Math.sqrt(dx * dx + dy * dy)),
      z0: view.z,
      pmx: (mx - r.left - view.tx) / s,
      pmy: (my - r.top - view.ty) / s
    };
  }

  function updatePinch() {
    var two = twoPointers(), dx, dy, d, mx, my, s;
    if (!two || !pinch) { return; }
    dx = two[1].x - two[0].x;
    dy = two[1].y - two[0].y;
    d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    mx = (two[0].x + two[1].x) / 2;
    my = (two[0].y + two[1].y) / 2;
    view.z = clamp(pinch.z0 * (d / pinch.d0), 1, 8);
    s = viewScale();
    var r = paper.getBoundingClientRect();
    view.tx = (mx - r.left) - pinch.pmx * s;
    view.ty = (my - r.top) - pinch.pmy * s;
    clampPan();
    renderFull();
    updateZoomBadge();
  }

  function pointerDown(e) {
    if (uiBlocked()) { return; }
    var id = e.pointerId === undefined ? 1 : e.pointerId;
    hits.p++;
    hits.last = "pointerdown" + (e.pointerType ? ":" + e.pointerType : "");
    pointers[id] = { x: e.clientX, y: e.clientY };
    var n = countPointers();
    tap = { x: e.clientX, y: e.clientY, t: nowMs() };
    if (n === 1) {
      if (insideStage(e.clientX, e.clientY)) {
        if (e.preventDefault) { e.preventDefault(); }
        stageDown(paperPointOf(e.clientX, e.clientY));
      }
    } else if (n === 2) {
      cancelGestures();
      if (e.preventDefault) { e.preventDefault(); }
      beginPinch();
    }
  }

  function pointerMove(e) {
    if (uiBlocked()) { return; }
    var id = e.pointerId === undefined ? 1 : e.pointerId;
    if (!pointers[id]) { return; }
    pointers[id] = { x: e.clientX, y: e.clientY };
    if (countPointers() >= 2 && pinch) {
      if (e.preventDefault) { e.preventDefault(); }
      updatePinch();
      return;
    }
    if (gestureActive()) {
      if (e.preventDefault) { e.preventDefault(); }
      stageMove(paperPointOf(e.clientX, e.clientY));
    }
  }

  function pointerUp(e) {
    var id = e.pointerId === undefined ? 1 : e.pointerId;
    var had = pointers[id];
    delete pointers[id];
    if (countPointers() < 2) { pinch = null; }
    if (countPointers() === 0) { endStroke(); selGestureEnd(); }
    if (had && e.pointerType !== "mouse") {
      synthTap(e.clientX, e.clientY);
    }
  }

  function pointerCancel(e) {
    var id = e.pointerId === undefined ? 1 : e.pointerId;
    delete pointers[id];
    if (countPointers() === 0) {
      cancelGestures();
      endStroke();
      pinch = null;
    } else if (countPointers() < 2) {
      pinch = null;
    }
  }

  function synthTap(x, y) {
    if (!tap) { return; }
    var dx = x - tap.x, dy = y - tap.y;
    var moved = Math.sqrt(dx * dx + dy * dy);
    if (moved > 16 || nowMs() - tap.t > 900) { return; }
    var el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    invokeFrom(el);
  }

  function wirePointerInput() {
    if (window.PointerEvent || navigator.msPointerEnabled) {
      var down = window.PointerEvent ? "pointerdown" : "MSPointerDown";
      var move = window.PointerEvent ? "pointermove" : "MSPointerMove";
      var up = window.PointerEvent ? "pointerup" : "MSPointerUp";
      var canc = window.PointerEvent ? "pointercancel" : "MSPointerCancel";
      document.addEventListener(down, pointerDown, false);
      document.addEventListener(move, pointerMove, false);
      document.addEventListener(up, pointerUp, false);
      document.addEventListener(canc, pointerCancel, false);
      return;
    }

    // No pointer events: touch and mouse separately.
    document.addEventListener("touchstart", function (e) {
      if (uiBlocked() || !e.touches || !e.touches.length) { return; }
      hits.t++;
      hits.last = "touchstart";
      tap = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: nowMs() };
      pointers[1] = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (e.touches.length >= 2) {
        cancelGestures();
        pointers[2] = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        beginPinch();
      } else if (insideStage(e.touches[0].clientX, e.touches[0].clientY)) {
        if (e.preventDefault) { e.preventDefault(); }
        stageDown(paperPointOf(e.touches[0].clientX, e.touches[0].clientY));
      }
    }, false);

    document.addEventListener("touchmove", function (e) {
      if (uiBlocked() || !e.touches) { return; }
      if (e.touches.length >= 2 && pinch) {
        pointers[1] = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        pointers[2] = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        if (e.preventDefault) { e.preventDefault(); }
        updatePinch();
        return;
      }
      if (gestureActive()) {
        if (e.preventDefault) { e.preventDefault(); }
        stageMove(paperPointOf(e.touches[0].clientX, e.touches[0].clientY));
      }
    }, false);

    document.addEventListener("touchend", function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      pointers = {};
      pinch = null;
      endStroke();
      selGestureEnd();
      if (t) { synthTap(t.clientX, t.clientY); }
    }, false);

    document.addEventListener("mousedown", function (e) {
      if (uiBlocked() || e.button !== 0) { return; }
      hits.m++;
      hits.last = "mousedown";
      tap = { x: e.clientX, y: e.clientY, t: nowMs() };
      pointers[1] = { x: e.clientX, y: e.clientY };
      if (insideStage(e.clientX, e.clientY)) {
        if (e.preventDefault) { e.preventDefault(); }
        stageDown(paperPointOf(e.clientX, e.clientY));
      }
    }, false);

    document.addEventListener("mousemove", function (e) {
      if (gestureActive()) { stageMove(paperPointOf(e.clientX, e.clientY)); }
    }, false);

    document.addEventListener("mouseup", function () {
      pointers = {};
      endStroke();
      selGestureEnd();
    }, false);
  }

  /* ================= actions ================= */

  var lastInvoke = { el: null, t: 0 };

  function invokeFrom(el) {
    if (!el) { return; }
    var node = el, del = null, act = null, card = null, i;
    for (i = 0; i < 12 && node && node !== document.body; i++) {
      if (!del && node.getAttribute && node.getAttribute("data-del")) { del = node; }
      if (!act && node.getAttribute && node.getAttribute("data-act")) { act = node; }
      if (!card && node.getAttribute && node.getAttribute("data-id")) { card = node; }
      node = node.parentNode;
    }
    var target = del || act || card;
    if (!target) { return; }

    var t = nowMs();
    if (lastInvoke.el === target && t - lastInvoke.t < 250) { return; }
    lastInvoke.el = target;
    lastInvoke.t = t;

    if (del) { removeProject(del.getAttribute("data-del")); return; }
    if (act) { doAction(act.getAttribute("data-act"), act); return; }
    openProject(card.getAttribute("data-id"));
  }

  function doAction(name, el) {
    if (!name) { return; }
    if (name === "menu") { setMenu(!menuOpen); return; }
    if (name === "fpsstep" && el) {
      applyFps((proj ? proj.fps : defaultFps) + parseInt(el.getAttribute("data-d"), 10), false);
      return;
    }
    if (name === "fpsset" && el) {
      applyFps(parseInt(el.getAttribute("data-v"), 10), false);
      return;
    }
    if (name === "fpsdone") {
      if (proj) { saveStore(); }
      setOverlay(fpsSheet, false);
      return;
    }
    if (name === "confirmyes") { runConfirm(); return; }
    if (name === "confirmno") {
      pendingConfirm = null;
      setOverlay(confirmSheet, false);
      return;
    }
    if (name === "settype" && el) {
      var opts = newsheet.getElementsByTagName("button"), j;
      for (j = 0; j < opts.length; j++) {
        if (opts[j].getAttribute("data-type")) {
          opts[j].className = opts[j] === el ? "typeopt on" : "typeopt";
        }
      }
      return;
    }
    if (name === "setsize" && el) {
      setSize(parseInt(el.getAttribute("data-size"), 10));
      return;
    }
    if (name === "tool" && el) {
      setTool(el.getAttribute("data-tool"));
      return;
    }
    if (name === "gotoframe" && el) {
      goFrame(parseInt(el.getAttribute("data-i"), 10));
      return;
    }
    if (name === "info") { paintDiag(); setOverlay(diag, true); return; }
    if (name === "closediag") { setOverlay(diag, false); return; }
    if (name === "new") { openNewSheet(); return; }
    if (name === "cancelnew") { setOverlay(newsheet, false); return; }
    if (name === "create") { createProject(); return; }
    if (name === "home") { leaveEditor(); return; }
    if (name === "wheel") { drawWheel(); setOverlay(wheelsheet, true); return; }
    if (name === "closewheel") { setOverlay(wheelsheet, false); return; }
    if (name === "closesheet") { setOverlay(saveSheet, false); return; }
    if (!proj) { return; }

    if (name === "undo") {
      if (playing) { return; }
      if (undoSnap) {
        proj.frames[frameIdx].strokes = undoSnap;
        undoSnap = null;
        sel = null;
        bumpRev();
        renderFull();
        updateFrames();
        return;
      }
      undoFrame();
      return;
    }
    if (name === "clear") {
      if (playing || !strokesNow().length) { return; }
      if (!armed) {
        armed = true;
        el.textContent = "Sure?";
        el.className = "tool on";
        armTimer = setTimeout(disarm, 2600);
        return;
      }
      disarm();
      clearFrame();
      return;
    }
    if (name === "save") { doSave(); return; }
    if (name === "export") { openExportSheet(); return; }
    if (name === "closeexport") { setOverlay(exportSheet, false); return; }
    if (name === "exportpng") { exportPNG(false); return; }
    if (name === "exportframes") { exportPNG(true); return; }
    if (name === "exportmp4") { exportMP4(); return; }
    if (name === "frames") {
      framesOpen = !framesOpen;
      animBox.className = framesOpen ? "on" : "";
      el.className = framesOpen ? "tool on" : "tool";
      layout();
      return;
    }
    if (name === "zoomin") { zoomBy(1.35); return; }
    if (name === "zoomout") { zoomBy(1 / 1.35); return; }
    if (name === "zoomfit") { zoomFit(); return; }
    if (name === "newframe") { addFrame(false); return; }
    if (name === "copyframe") { addFrame(true); return; }
    if (name === "delframe") { deleteFrame(); return; }
    if (name === "play") { playing ? stopPlay() : startPlay(); return; }
    if (name === "fps") { openFpsSheet(); return; }
    if (name === "onion") {
      onion = !onion;
      onionBtn.className = onion ? "tool sm on" : "tool sm";
      renderFull();
      return;
    }
  }

  function updateBarTitle() {
    if (!barTitle) { return; }
    var t = tool === "select" ? "Select" :
      (tool === "eraser" ? "Eraser" : (tool === "bucket" ? "Bucket" : "Pen"));
    if (tool === "bucket") {
      barTitle.textContent = t + " \u00b7 " + color;
      return;
    }
    barTitle.textContent = t + " \u00b7 " + SIZE_LABEL[sizeIdx] +
      (tool === "eraser" ? "" : " \u00b7 " + color);
  }

  function setMenu(open) {
    menuOpen = !!open;
    if (menuBox) { menuBox.style.display = menuOpen ? "block" : "none"; }
    if (barChev) {
      barChev.textContent = menuOpen ? "\u25B2" : "\u25BC";
      barChev.title = menuOpen ? "Hide menu" : "Show menu";
    }
    layout();
  }

  function markFpsPresets() {
    if (!fpsPresets || !proj) { return; }
    var bs = fpsPresets.getElementsByTagName("button"), i, v;
    for (i = 0; i < bs.length; i++) {
      v = parseInt(bs[i].getAttribute("data-v"), 10);
      bs[i].className = v === proj.fps ? "chip on" : "chip";
    }
  }

  function applyFps(v, save) {
    if (!proj) { return; }
    proj.fps = clamp(Math.round(v), FPS_MIN, FPS_MAX);
    defaultFps = proj.fps;
    if (fpsValue) { fpsValue.textContent = String(proj.fps); }
    if (fpsRange) { fpsRange.value = String(proj.fps); }
    if (fpsBtn) { fpsBtn.textContent = proj.fps + " fps"; }
    markFpsPresets();
    if (save) { saveStore(); }
  }

  function openFpsSheet() {
    if (!proj) { return; }
    stopPlay();
    applyFps(proj.fps, false);
    setOverlay(fpsSheet, true);
  }

  function buildFpsPresets() {
    if (!fpsPresets) { return; }
    fpsPresets.textContent = "";
    var i, b;
    for (i = 0; i < FPS_PRESET.length; i++) {
      b = document.createElement("button");
      b.className = "chip";
      b.setAttribute("data-act", "fpsset");
      b.setAttribute("data-v", String(FPS_PRESET[i]));
      b.textContent = String(FPS_PRESET[i]);
      fpsPresets.appendChild(b);
    }
  }

  function askConfirm(title, msg, okLabel, fn) {
    pendingConfirm = fn;
    if (cTitle) { cTitle.textContent = title; }
    if (cMsg) { cMsg.textContent = msg; }
    if (cOk) { cOk.textContent = okLabel; }
    setOverlay(confirmSheet, true);
  }

  function runConfirm() {
    var fn = pendingConfirm;
    pendingConfirm = null;
    setOverlay(confirmSheet, false);
    if (fn) { fn(); }
  }

  function disarm() {
    armed = false;
    var bs = bar.getElementsByTagName("button"), i;
    if (armTimer) { clearTimeout(armTimer); armTimer = null; }
    for (i = 0; i < bs.length; i++) {
      if (bs[i].getAttribute("data-act") === "clear") {
        bs[i].textContent = "Clear";
        bs[i].className = "tool";
      }
    }
  }

  /* ================= projects ================= */

  function serialise(p) {
    return {
      id: p.id, n: p.name, t: p.type, f: p.fps, u: p.updated, th: p.thumb || "",
      fr: p.frames.map(function (fr) {
        return fr.strokes.map(function (s) {
          var pts = [], i;
          for (i = 0; i < s.pts.length; i++) {
            pts.push(Math.round(s.pts[i].x), Math.round(s.pts[i].y));
          }
          return { c: s.color, w: s.size, e: s.erase ? 1 : 0, p: pts };
        });
      }),
      fx: p.frames.map(function (fr) {
        return (fr.fills || []).map(function (f) { return { c: f.c, d: f.d }; });
      }),
      fo: p.frames.map(function (fr) { return fr.op || ""; })
    };
  }

  function deserialise(o) {
    return {
      id: o.id, name: o.n, type: o.t === "flip" ? "flip" : "paint",
      fps: clamp(o.f || 10, FPS_MIN, FPS_MAX), updated: o.u || 0, thumb: o.th || "",
      frames: (o.fr && o.fr.length ? o.fr : [[]]).map(function (f, fi) {
        return {
          strokes: (f || []).map(function (s) {
            var pts = [], i;
            for (i = 0; i < s.p.length; i += 2) {
              pts.push({ x: s.p[i], y: s.p[i + 1] });
            }
            return { color: s.c, size: s.w, erase: !!s.e, pts: pts };
          }),
          fills: ((o.fx && o.fx[fi]) || []).map(function (x) {
            return { c: x.c, d: x.d };
          }),
          op: (o.fo && o.fo[fi]) || ""
        };
      })
    };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(PK), o;
      if (!raw) { return; }
      o = JSON.parse(raw);
      if (o && o.projects && o.projects.length) {
        projects = o.projects.map(deserialise);
      }
    } catch (e) {
      projects = [];
    }
    if (!projects.length) {
      projects = [];
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(PK, JSON.stringify({
        v: 2,
        projects: projects.map(serialise)
      }));
      return true;
    } catch (e) {
      toast("Could not save: device storage is full");
      return false;
    }
  }

  function newId() {
    return "p" + nowMs() + Math.floor(Math.random() * 1000);
  }

  function openNewSheet() {
    if (pname) {
      pname.value = "Project " + (projects.length + 1);
      try { pname.focus(); pname.select(); } catch (e) { void e; }
    }
    var opts = newsheet.getElementsByTagName("button"), i;
    for (i = 0; i < opts.length; i++) {
      if (opts[i].getAttribute("data-type")) {
        opts[i].className = opts[i].getAttribute("data-type") === "paint" ? "typeopt on" : "typeopt";
      }
    }
    setOverlay(newsheet, true);
  }

  function chosenType() {
    var opts = newsheet.getElementsByTagName("button"), i;
    for (i = 0; i < opts.length; i++) {
      if (opts[i].getAttribute("data-type") && opts[i].className.indexOf("on") >= 0) {
        return opts[i].getAttribute("data-type");
      }
    }
    return "paint";
  }

  function createProject() {
    var name = (pname && pname.value ? pname.value : "Untitled").replace(/^\s+|\s+$/g, "");
    if (!name) { name = "Untitled"; }
    var p = {
      id: newId(), name: name, type: chosenType(), fps: defaultFps,
      updated: nowMs(), thumb: "", frames: [{ strokes: [], fills: [], op: "" }]
    };
    projects.unshift(p);
    saveStore();
    setOverlay(newsheet, false);
    openProject(p.id);
  }

  function removeProject(id) {
    var p = findProject(id);
    if (!p) { return; }
    askConfirm("Delete project?",
      "\"" + p.name + "\" and all of its frames will be removed. This cannot be undone.",
      "Delete project",
      function () {
        var i;
        for (i = 0; i < projects.length; i++) {
          if (projects[i].id === id) { projects.splice(i, 1); break; }
        }
        saveStore();
        renderHome();
        toast("Project deleted");
      });
  }

  function findProject(id) {
    var i;
    for (i = 0; i < projects.length; i++) {
      if (projects[i].id === id) { return projects[i]; }
    }
    return null;
  }

  function openProject(id) {
    var p = findProject(id);
    if (!p) { return; }
    proj = p;
    frameIdx = 0;
    framesOpen = false;
    playing = false;
    sel = null;
    lasso = null;
    selDrag = null;
    undoSnap = null;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    view.z = 1;
    view.tx = 0;
    view.ty = 0;
    animBox.className = "";
    setScreen(home, false);
    setScreen(editor, true);
    setFlipUi();
    buildSizes();
    setColor(color);
    layout();
    updateFrames();
    applyFps(p.fps, false);
    updateBarTitle();
  }

  function setFlipUi() {
    var bs = editor.getElementsByTagName("button"), i;
    for (i = 0; i < bs.length; i++) {
      if (bs[i].getAttribute("data-act") === "frames") {
        bs[i].style.display = isFlip() ? "inline-block" : "none";
      }
      if (bs[i].getAttribute("data-act") === "play") {
        bs[i].style.display = isFlip() ? "inline-block" : "none";
      }
    }
    if (!isFlip()) {
      animBox.className = "";
      framesOpen = false;
    }
  }

  function leaveEditor() {
    if (!proj) { return; }
    captureThumb();
    proj.updated = nowMs();
    saveStore();
    stopPlay();
    proj = null;
    setScreen(editor, false);
    setScreen(home, true);
    renderHome();
  }

  function captureThumb() {
    if (!proj) { return; }
    try {
      var tw = 192, th = 108;
      var c = document.createElement("canvas");
      c.width = tw; c.height = th;
      var g = c.getContext("2d"), s = tw / PW;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, tw, th);
      g.setTransform(s, 0, 0, s, 0, 0);
      drawContent(g, proj.frames[frameIdx]);
      proj.thumb = c.toDataURL("image/jpeg", 0.55);
    } catch (e) {
      proj.thumb = "";
    }
  }

  function relTime(ts) {
    var d = nowMs() - ts;
    if (!ts) { return "new"; }
    if (d < 60000) { return "just now"; }
    if (d < 3600000) { return Math.round(d / 60000) + " min ago"; }
    if (d < 86400000) { return Math.round(d / 3600000) + " h ago"; }
    return Math.round(d / 86400000) + " d ago";
  }

  function renderHome() {
    var i, p, type, card, thumb, meta, nameEl, subEl, del, plus, newBtn;
    while (grid.firstChild) { grid.removeChild(grid.firstChild); }
    for (i = 0; i < projects.length; i++) {
      p = projects[i];
      type = p.type === "flip" ? "Flipbook" : "Painting";
      card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-id", p.id);
      thumb = document.createElement("span");
      thumb.className = "thumb";
      thumb.style.backgroundImage = "url(" + (p.thumb || EMPTY_THUMB) + ")";
      meta = document.createElement("span");
      meta.className = "meta";
      nameEl = document.createElement("b");
      nameEl.textContent = p.name;
      subEl = document.createElement("span");
      subEl.textContent = type + " · " +
        (p.type === "flip" ? p.frames.length + " frames · " : "") +
        relTime(p.updated);
      meta.appendChild(nameEl);
      meta.appendChild(subEl);
      del = document.createElement("button");
      del.className = "del";
      del.setAttribute("data-del", p.id);
      del.title = "Delete";
      del.textContent = "×";
      card.appendChild(thumb);
      card.appendChild(meta);
      card.appendChild(del);
      grid.appendChild(card);
    }
    newBtn = document.createElement("button");
    newBtn.className = "newcard";
    newBtn.setAttribute("data-act", "new");
    plus = document.createElement("b");
    plus.textContent = "+";
    newBtn.appendChild(plus);
    newBtn.appendChild(document.createTextNode("New project"));
    grid.appendChild(newBtn);
    emptyhint.style.display = projects.length ? "none" : "block";
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ================= frames ================= */

  function frameThumb(fr) {
    var sig = fr.strokes.length + ":" + (fr.fills ? fr.fills.length : 0) +
      ":" + (fr.rev || 0);
    if (fr._c && fr._sig === sig) { return fr._c; }
    var c = document.createElement("canvas"), g, s;
    c.width = 40; c.height = 23;
    g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 40, 23);
    s = 40 / PW;
    g.setTransform(s, 0, 0, s, 0, 0);
    drawContent(g, fr);
    fr._c = c;
    fr._sig = sig;
    return c;
  }

  function updateFrames() {
    if (!proj) { return; }
    fstat.textContent = (frameIdx + 1) + " / " + proj.frames.length;
    if (!isFlip()) { thumbsBox.textContent = ""; return; }
    thumbsBox.textContent = "";
    var i, b, c;
    for (i = 0; i < proj.frames.length; i++) {
      b = document.createElement("button");
      b.className = "thumbf" + (i === frameIdx ? " on" : "");
      b.setAttribute("data-act", "gotoframe");
      b.setAttribute("data-i", String(i));
      c = frameThumb(proj.frames[i]);
      b.appendChild(c);
      thumbsBox.appendChild(b);
    }
  }

  function goFrame(i) {
    if (!proj || i < 0 || i >= proj.frames.length) { return; }
    stopPlay();
    frameIdx = i;
    curStroke = null;
    sel = null;
    undoSnap = null;
    renderFull();
    updateFrames();
  }

  function addFrame(copy) {
    if (!proj || !isFlip()) { return; }
    var src = proj.frames[frameIdx];
    var strokes = copy ? src.strokes.map(cloneStroke) : [];
    var fills = copy ? (src.fills || []).map(cloneFill) : [];
    proj.frames.splice(frameIdx + 1, 0, {
      strokes: strokes, fills: fills, op: copy ? (src.op || "") : "", rev: 0
    });
    frameIdx++;
    undoSnap = null;
    sel = null;
    renderFull();
    updateFrames();
  }

  function cloneStroke(s) {
    var pts = [], i;
    for (i = 0; i < s.pts.length; i++) {
      pts.push({ x: s.pts[i].x, y: s.pts[i].y });
    }
    return { color: s.color, size: s.size, erase: s.erase, pts: pts };
  }

  function cloneFill(f) {
    return { c: f.c, d: f.d, _cv: f._cv };
  }

  function deleteFrame() {
    if (!proj || !isFlip()) { return; }
    if (proj.frames.length < 2) { toast("A flipbook needs at least one frame"); return; }
    proj.frames.splice(frameIdx, 1);
    if (frameIdx >= proj.frames.length) { frameIdx = proj.frames.length - 1; }
    sel = null;
    undoSnap = null;
    renderFull();
    updateFrames();
  }

  function startPlay() {
    if (!proj || !isFlip() || proj.frames.length < 2) { return; }
    playing = true;
    playBtn.textContent = "Stop";
    playBtn.className = "tool sm on";
    (function tick() {
      if (!playing) { return; }
      frameIdx = (frameIdx + 1) % proj.frames.length;
      renderFull();
      fstat.textContent = (frameIdx + 1) + " / " + proj.frames.length;
      playTimer = setTimeout(tick, Math.round(1000 / clamp(proj.fps || 10, FPS_MIN, FPS_MAX)));
    })();
  }

  function stopPlay() {
    playing = false;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    if (playBtn) {
      playBtn.textContent = "Play";
      playBtn.className = "tool sm";
    }
  }

  /* ================= export / save ================= */

  function exportURL() {
    var tw = 1280, th = 720;
    var c = document.createElement("canvas");
    c.width = tw; c.height = th;
    var g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, tw, th);
    g.setTransform(tw / PW, 0, 0, th / PH, 0, 0);
    drawContent(g, proj.frames[frameIdx]);
    return c.toDataURL("image/png");
  }

  function doSave() {
    stopPlay();
    captureThumb();
    proj.updated = nowMs();
    if (saveStore()) { toast("Project saved"); }
    try {
      shot.src = exportURL();
    } catch (e) {
      shot.alt = "could not export this drawing";
    }
    sheetNote.textContent = isFlip()
      ? ("Frame " + (frameIdx + 1) + " of " + proj.frames.length + " is shown below.")
      : "";
    setOverlay(saveSheet, true);
  }

  /* ================= export ================= */

  var exportBusy = false;

  function setExportStatus(msg) {
    if (exportStatus) { exportStatus.textContent = msg; }
  }

  function isWinRT() {
    try {
      return !!(window.Windows && Windows.Storage && Windows.Storage.KnownFolders &&
                Windows.Storage.KnownFolders.picturesLibrary);
    } catch (e) { return false; }
  }

  function canMakeMP4() {
    if (isWinRT()) {
      try {
        return !!(Windows.Media && Windows.Media.Editing &&
                  Windows.Media.Editing.MediaComposition &&
                  Windows.Media.Editing.MediaClip);
      } catch (e) { return false; }
    }
    try {
      return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
    } catch (e) { return false; }
  }

  function safeName() {
    var n = proj ? String(proj.name || "FreePaint") : "FreePaint";
    n = n.replace(/[\\\/:*?"<>|]/g, "_").replace(/\s+$/, "");
    if (!n) { n = "FreePaint"; }
    if (n.length > 40) { n = n.slice(0, 40); }
    return n;
  }

  function frameFileName(i, total, prefix) {
    var n = i + 1;
    while (String(n).length < String(total).length || String(n).length < 3) { n = "0" + n; }
    return (prefix || "frame_") + n + ".png";
  }

  function exportCanvas(fr, w, h) {
    var c = document.createElement("canvas"), g;
    c.width = w;
    c.height = h;
    g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.setTransform(w / PW, 0, 0, h / PH, 0, 0);
    drawContent(g, fr);
    return c;
  }

  // Fills saved earlier decode as images; make sure they are ready before a
  // frame is rasterised, otherwise an export could miss a colour layer.
  function preloadFills(frames) {
    var jobs = [], i, j, fs;
    function job(f) {
      return new Promise(function (resolve) {
        if (f._cv) { resolve(); return; }
        if (f._img && f._img.complete && (f._img.naturalWidth || f._img.width)) {
          resolve();
          return;
        }
        var img = new Image();
        img.onload = function () { resolve(); };
        img.onerror = function () { resolve(); };
        img.src = f.d;
        f._img = img;
      });
    }
    for (i = 0; i < frames.length; i++) {
      fs = frames[i].fills || [];
      for (j = 0; j < fs.length; j++) { jobs.push(job(fs[j])); }
    }
    return Promise.all(jobs);
  }

  function pngBytes(c) {
    var url = c.toDataURL("image/png");
    var b64 = url.slice(url.indexOf(",") + 1);
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n), i;
    for (i = 0; i < n; i++) { out[i] = bin.charCodeAt(i); }
    return out;
  }

  // WinRT byte[] is a plain array in the JavaScript projection.
  function byteArray(u8) {
    var out = new Array(u8.length), i;
    for (i = 0; i < u8.length; i++) { out[i] = u8[i]; }
    return out;
  }

  function downloadURL(name, url) {
    try {
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) { a.parentNode.removeChild(a); }
      }, 500);
      return true;
    } catch (e) { return false; }
  }

  function exportPicturesFolder() {
    return Windows.Storage.KnownFolders.picturesLibrary
      .createFolderAsync("FreePaint", Windows.Storage.CreationCollisionOption.openIfExists);
  }

  function writeWinRTFile(folder, name, bytes) {
    return folder.createFileAsync(name, Windows.Storage.CreationCollisionOption.replaceExisting)
      .then(function (file) {
        return Windows.Storage.FileIO.writeBytesAsync(file, byteArray(bytes))
          .then(function () { return file; });
      });
  }

  function exportPNG(all) {
    if (!proj || exportBusy) { return; }
    exportBusy = true;
    setExportStatus("Preparing...");
    var frames = all ? proj.frames : [proj.frames[frameIdx]];
    var name = safeName();
    preloadFills(frames).then(function () {
      if (isWinRT()) {
        return exportPicturesFolder().then(function (folder) {
          if (!all) {
            return writeWinRTFile(folder, name + ".png",
              pngBytes(exportCanvas(frames[0], 1920, 1080))).then(function (f) {
                return "Pictures\\FreePaint\\" + f.name;
              });
          }
          return folder.createFolderAsync(name, Windows.Storage.CreationCollisionOption.openIfExists)
            .then(function (sub) {
              var i = 0;
              function next() {
                if (i >= frames.length) { return sub; }
                setExportStatus("Saving frame " + (i + 1) + " of " + frames.length + "...");
                var file = frameFileName(i, frames.length);
                return writeWinRTFile(sub, file, pngBytes(exportCanvas(frames[i], 1920, 1080)))
                  .then(function () { i++; return next(); });
              }
              return next().then(function () {
                return "Pictures\\FreePaint\\" + name;
              });
            });
        });
      }
      if (!all) {
        downloadURL(name + ".png", exportCanvas(frames[0], 1920, 1080).toDataURL("image/png"));
        return "Downloads";
      }
      var i = 0;
      function nextDownload() {
        if (i >= frames.length) { return "Downloads"; }
        setExportStatus("Downloading frame " + (i + 1) + " of " + frames.length + "...");
        downloadURL(name + "_" + frameFileName(i, frames.length, "").replace(".png", "") + ".png",
          exportCanvas(frames[i], 1920, 1080).toDataURL("image/png"));
        i++;
        return new Promise(function (res) { setTimeout(res, 260); }).then(nextDownload);
      }
      return nextDownload();
    }).then(function (where) {
      exportBusy = false;
      setExportStatus("Saved to " + where);
      toast("Exported");
    }, function (err) {
      exportBusy = false;
      setExportStatus("Export failed: " + ((err && err.message) || err));
      toast("Export failed");
    });
  }

  function transcodeOk(reason) {
    if (reason === 0) { return true; }
    try { return reason === Windows.Media.Transcoding.TranscodeFailureReason.none; }
    catch (e) { return false; }
  }

  function mp4WinRT(frames) {
    var temp = Windows.Storage.ApplicationData.current.temporaryFolder;
    var sub = null, files = [];
    var ticks = Math.max(1, Math.round(10000000 / clamp(proj.fps || 10, FPS_MIN, FPS_MAX)));
    var w = 1280, h = 720;
    return temp.createFolderAsync("FreePaintExport", Windows.Storage.CreationCollisionOption.openIfExists)
      .then(function (f) { sub = f; return sub.getFilesAsync(); })
      .then(function (old) {
        var i = 0;
        function wipe() {
          if (i >= old.length) { return; }
          return old[i].deleteAsync().then(function () { i++; return wipe(); });
        }
        return wipe();
      })
      .then(function () {
        var i = 0;
        function one() {
          if (i >= frames.length) { return files; }
          setExportStatus("Rendering frame " + (i + 1) + " of " + frames.length + "...");
          return writeWinRTFile(sub, frameFileName(i, frames.length, "f") ,
            pngBytes(exportCanvas(frames[i], w, h))).then(function (file) {
              files.push(file);
              i++;
              return one();
            });
        }
        return one();
      })
      .then(function () {
        setExportStatus("Making the video...");
        var clips = [], i;
        for (i = 0; i < files.length; i++) {
          clips.push(Windows.Media.Editing.MediaClip.createFromImageFileAsync(files[i], ticks));
        }
        return Promise.all(clips);
      })
      .then(function (clips) {
        var comp = new Windows.Media.Editing.MediaComposition(), i;
        for (i = 0; i < clips.length; i++) { comp.clips.append(clips[i]); }
        return exportPicturesFolder().then(function (folder) {
          return folder.createFileAsync(safeName() + ".mp4",
            Windows.Storage.CreationCollisionOption.replaceExisting).then(function (out) {
              return new Promise(function (resolve, reject) {
                var op = comp.renderToFileAsync(out);
                op.then(function (reason) {
                  if (transcodeOk(reason)) { resolve(out.name); }
                  else { reject(new Error("render error " + reason)); }
                }, function (e) { reject(e); });
              });
            });
        });
      })
      .then(function (fileName) { return "Pictures\\FreePaint\\" + fileName; });
  }

  function mp4Browser(frames) {
    var mimes = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9",
                 "video/webm;codecs=vp8", "video/webm"];
    var mime = "", i;
    for (i = 0; i < mimes.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(mimes[i])) { mime = mimes[i]; break; }
      } catch (e) { }
    }
    if (!mime) { return Promise.reject(new Error("no video recorder")); }
    var w = 1280, h = 720;
    var c = document.createElement("canvas"), stream, rec, chunks = [];
    c.width = w;
    c.height = h;
    var g = c.getContext("2d");
    var fps = clamp(proj.fps || 10, FPS_MIN, FPS_MAX);
    try { stream = c.captureStream(fps); } catch (e) { return Promise.reject(e); }
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
    } catch (e) { return Promise.reject(e); }
    return new Promise(function (resolve, reject) {
      var i = 0, timer = null;
      function draw() {
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, w, h);
        g.setTransform(w / PW, 0, 0, h / PH, 0, 0);
        drawContent(g, frames[i]);
      }
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size) { chunks.push(e.data); }
      };
      rec.onerror = function (e) { reject(e.error || e); };
      rec.onstop = function () {
        var ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
        var blob = new Blob(chunks, { type: mime.split(";")[0] });
        var url = URL.createObjectURL(blob);
        var name = safeName() + "." + ext;
        downloadURL(name, url);
        setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { } }, 30000);
        resolve(name + " (" + ext.toUpperCase() + ")");
      };
      rec.start();
      draw();
      timer = setInterval(function () {
        i++;
        if (i >= frames.length) {
          clearInterval(timer);
          setTimeout(function () { try { rec.stop(); } catch (e) { reject(e); } }, 150);
          return;
        }
        draw();
      }, Math.round(1000 / fps));
      setTimeout(function () {
        if (i === 0) { clearInterval(timer); try { rec.stop(); } catch (e) { } }
      }, 15000);
    });
  }

  function exportMP4() {
    if (!proj || exportBusy) { return; }
    if (!isFlip() || proj.frames.length < 2) {
      setExportStatus("A video needs at least two frames.");
      return;
    }
    if (!canMakeMP4()) {
      setExportStatus("MP4 is not available on this device; PNG frames still work.");
      return;
    }
    exportBusy = true;
    setExportStatus("Preparing...");
    preloadFills(proj.frames).then(function () {
      return isWinRT() ? mp4WinRT(proj.frames) : mp4Browser(proj.frames);
    }).then(function (where) {
      exportBusy = false;
      setExportStatus("Saved to " + where);
      toast("Video exported");
    }, function (err) {
      exportBusy = false;
      setExportStatus("MP4 failed: " + ((err && err.message) || err));
      toast("MP4 export failed");
    });
  }

  function openExportSheet() {
    if (!proj) { return; }
    stopPlay();
    if (exFrames) { exFrames.style.display = isFlip() ? "block" : "none"; }
    if (exMp4) { exMp4.style.display = isFlip() ? "block" : "none"; }
    if (exportNote) {
      exportNote.textContent = isWinRT()
        ? "Files are written to Pictures\\FreePaint on the phone."
        : "Files download from the browser. MP4 needs MediaRecorder, which the phone's browser does not have.";
    }
    setExportStatus(isFlip() && !canMakeMP4()
      ? "MP4 is not available on this device; PNG frames still work."
      : "");
    exportBusy = false;
    setOverlay(exportSheet, true);
  }

  /* ================= colour wheel ================= */

  var wheelState = { size: 420, cx: 210, cy: 210, rOut: 200, rIn: 152, sq: 196 };
  var wheelCtx = wheelCv.getContext("2d");

  function drawWheel() {
    if (!wheelCtx) { return; }
    var w = wheelState, i, a, rgb;
    wheelCtx.setTransform(1, 0, 0, 1, 0, 0);
    wheelCtx.clearRect(0, 0, w.size, w.size);

    wheelCtx.lineWidth = w.rOut - w.rIn;
    wheelCtx.lineCap = "butt";
    for (i = 0; i < 360; i++) {
      a = (i - 0.6) * Math.PI / 180;
      wheelCtx.beginPath();
      wheelCtx.arc(w.cx, w.cy, (w.rOut + w.rIn) / 2, a, a + Math.PI / 180 * 1.4);
      wheelCtx.strokeStyle = "hsl(" + i + ",100%,50%)";
      wheelCtx.stroke();
    }

    var x0 = w.cx - w.sq / 2, y0 = w.cy - w.sq / 2;
    rgb = hsvToRgb(hue, 1, 1);
    var grad = wheelCtx.createLinearGradient(x0, 0, x0 + w.sq, 0);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, rgb2hex(rgb));
    wheelCtx.fillStyle = grad;
    wheelCtx.fillRect(x0, y0, w.sq, w.sq);
    var black = wheelCtx.createLinearGradient(0, y0, 0, y0 + w.sq);
    black.addColorStop(0, "rgba(0,0,0,0)");
    black.addColorStop(1, "rgba(0,0,0,1)");
    wheelCtx.fillStyle = black;
    wheelCtx.fillRect(x0, y0, w.sq, w.sq);

    // marker for the current colour
    var ang = hue * Math.PI / 180;
    var mr = (w.rOut + w.rIn) / 2;
    wheelCtx.beginPath();
    wheelCtx.arc(w.cx + Math.cos(ang) * mr, w.cy + Math.sin(ang) * mr, 9, 0, Math.PI * 2);
    wheelCtx.lineWidth = 3;
    wheelCtx.strokeStyle = "#ffffff";
    wheelCtx.stroke();
    wheelCtx.beginPath();
    wheelCtx.arc(x0 + sat * w.sq, y0 + (1 - val) * w.sq, 7, 0, Math.PI * 2);
    wheelCtx.stroke();

    if (wprev) { wprev.style.background = color; }
    if (whex) { whex.textContent = color; }
  }

  function wheelPick(clientX, clientY) {
    var r = wheelCv.getBoundingClientRect();
    var sx = (clientX - r.left) * (wheelState.size / Math.max(1, r.width));
    var sy = (clientY - r.top) * (wheelState.size / Math.max(1, r.height));
    var w = wheelState, dx = sx - w.cx, dy = sy - w.cy;
    var dist = Math.sqrt(dx * dx + dy * dy), x0 = w.cx - w.sq / 2, y0 = w.cy - w.sq / 2;
    if (dist <= w.rOut && dist >= w.rIn) {
      hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      // A hue on its own is invisible if the colour is still grey or black.
      if (sat < 0.12) { sat = 1; }
      if (val < 0.2) { val = 1; }
    } else if (sx >= x0 && sx <= x0 + w.sq && sy >= y0 && sy <= y0 + w.sq) {
      sat = clamp((sx - x0) / w.sq, 0, 1);
      val = clamp(1 - (sy - y0) / w.sq, 0, 1);
    } else {
      return;
    }
    setColor(rgb2hex(hsvToRgb(hue, sat, val)));
  }

  function wireWheel() {
    var dragging = false;
    function down(e) {
      dragging = true;
      if (e.preventDefault) { e.preventDefault(); }
      if (e.stopPropagation) { e.stopPropagation(); }
      wheelPick(e.clientX, e.clientY);
    }
    function move(e) {
      if (!dragging) { return; }
      if (e.preventDefault) { e.preventDefault(); }
      if (e.stopPropagation) { e.stopPropagation(); }
      wheelPick(e.clientX, e.clientY);
    }
    function up() { dragging = false; }

    if (window.PointerEvent || navigator.msPointerEnabled) {
      var d = window.PointerEvent ? "pointerdown" : "MSPointerDown";
      var m = window.PointerEvent ? "pointermove" : "MSPointerMove";
      var u = window.PointerEvent ? "pointerup" : "MSPointerUp";
      wheelCv.addEventListener(d, down, false);
      document.addEventListener(m, move, false);
      document.addEventListener(u, up, false);
    } else {
      wheelCv.addEventListener("mousedown", down, false);
      document.addEventListener("mousemove", move, false);
      document.addEventListener("mouseup", up, false);
      wheelCv.addEventListener("touchstart", down, false);
      wheelCv.addEventListener("touchmove", move, false);
      document.addEventListener("touchend", up, false);
    }
  }

  /* ================= size chips / diagnostics ================= */

  function buildSizes() {
    sizesBox.textContent = "";
    var i, b;
    for (i = 0; i < SIZES.length; i++) {
      b = document.createElement("button");
      b.className = "sz" + (i === sizeIdx ? " on" : "");
      b.setAttribute("data-act", "setsize");
      b.setAttribute("data-size", String(i));
      b.textContent = SIZE_LABEL[i];
      sizesBox.appendChild(b);
    }
  }

  function setSize(i) {
    sizeIdx = clamp(i, 0, SIZES.length - 1);
    var bs = sizesBox.getElementsByTagName("button"), j;
    for (j = 0; j < bs.length; j++) {
      bs[j].className = "sz" + (j === sizeIdx ? " on" : "");
    }
    updateBarTitle();
  }

  function paintDiag() {
    if (!diagText) { return; }
    var d = document.documentElement, r = stage.getBoundingClientRect();
    var lines = [
      "build        " + APP_VER,
      "project      " + (proj ? proj.name + " (" + proj.type + ")" : "none"),
      "frames       " + (proj ? (frameIdx + 1) + " / " + proj.frames.length : "-"),
      "strokes      " + (proj ? strokesNow().length : 0),
      "fps          " + (proj ? (proj.fps || 10) : "-"),
      "selected     " + (sel ? sel.idx.length : 0) +
        "  tool " + tool + "  menu " + (menuOpen ? "open" : "closed"),
      "innerW/H     " + window.innerWidth + " x " + window.innerHeight,
      "doc client   " + d.clientWidth + " x " + d.clientHeight,
      "stage        " + Math.round(r.width) + " x " + Math.round(r.height),
      "paper bitmap " + paper.width + " x " + paper.height,
      "dpr          " + window.devicePixelRatio,
      "zoom         " + Math.round(view.z * 100) + "%",
      "screen       " + screen.width + " x " + screen.height,
      "pointer " + (window.PointerEvent ? "yes" : "no") +
        "  msPointer " + (navigator.msPointerEnabled ? "yes" : "no") +
        "  touch " + (("ontouchstart" in window) ? "yes" : "no"),
      "events       ptr " + hits.p + "  touch " + hits.t + "  mouse " + hits.m,
      "last event   " + hits.last
    ];
    diagText.textContent = lines.join("\n");
  }

  function toast(msg) {
    if (!toastEl) { return; }
    toastEl.textContent = msg;
    toastEl.className = "on";
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      toastEl.className = "";
      toastTimer = null;
    }, 2200);
  }

  /* ================= boot ================= */

  function bootFail(name, e) {
    var d = document.getElementById("errbar"), j = jsfail;
    if (j) { j.style.display = "none"; }
    var detail = ((e && e.message) || e) +
      " (line " + ((e && (e.lineNumber || e.line)) || "?") + ")";
    if (window.__fpShowError) {
      window.__fpShowError("FreePaint stopped at " + name + ": " + detail, "");
      return;
    }
    if (d) {
      d.style.display = "block";
      d.textContent = "FreePaint stopped at " + name + ": " + detail;
    }
  }

  function bootRun(name, fn) {
    window.__fpStep = name;
    try { fn(); } catch (e) { bootFail(name, e); return false; }
    return true;
  }

  bootRun("screens", function () {
    setScreen(home, true);
    setScreen(editor, false);
  });
  bootRun("storage", loadStore);
  bootRun("home screen", renderHome);
  bootRun("size chips", buildSizes);
  bootRun("colour", function () { setColor(color); });
  if (jsfail) { jsfail.style.display = "none"; }

  bootRun("buttons", function () {
    document.addEventListener("click", function (e) {
      invokeFrom(e.target || e.srcElement);
    }, false);
  });
  bootRun("touch input", wirePointerInput);
  bootRun("colour wheel", wireWheel);

  bootRun("fps control", function () {
    buildFpsPresets();
    if (fpsRange) {
      var readFps = function () { applyFps(parseInt(fpsRange.value, 10), false); };
      fpsRange.addEventListener("change", readFps, false);
      fpsRange.addEventListener("input", readFps, false);
    }
    if (fpsBtn) { fpsBtn.textContent = defaultFps + " fps"; }
  });
  bootRun("menu", function () { setMenu(true); });
  if (barTitle) { updateBarTitle(); }

  window.onresize = function () { layout(); };
  window.onorientationchange = function () { setTimeout(layout, 250); };

  setInterval(function () {
    if (!proj) { return; }
    var r = stage.getBoundingClientRect();
    if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) { layout(); }
  }, 600);

  window.__fpStep = "ready";
  window.__fpBooted = true;
})();
