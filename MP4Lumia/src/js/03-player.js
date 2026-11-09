/* MP4Lumia — the player: playback, transport controls, resume, error handling,
   demo library for browser previews, file activation and boot. */
(function () {
  "use strict";

  var A = window.MP4;
  var S = A.S, P = A.P;
  var $ = A.$, esc = A.esc, icon = A.icon;
  var fmtTime = A.fmtTime, fmtDur = A.fmtDur, fmtSize = A.fmtSize;
  var resLabel = A.resLabel, byId = A.byId, clamp = A.clamp, now = A.now;

  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  var pl = {
    item: null,
    hideTimer: null,
    lastSave: 0,
    dragging: false,
    pendingSeek: 0,
    controls: true,
    ended: false,
    durProbe: false
  };

  /* --------------------------------------------------------------- helpers */

  function subLine(it) {
    var bits = [];
    if (it.ext) bits.push(it.ext.toUpperCase());
    var r = resLabel(it);
    if (r) bits.push(r);
    var d = fmtDur(it.duration);
    if (d) bits.push(d);
    return bits.join(" \u00b7 ");
  }

  function setClasses() {
    var box = $("player"), vid = $("vid");
    var cls = "player open";
    if (pl.controls) cls += " controls";
    if (!vid || vid.paused) cls += " paused";
    if (pl.ended) cls += " ended";
    box.className = cls;
  }

  function showControls(on) {
    pl.controls = on !== false;
    setClasses();
    if (pl.hideTimer) { clearTimeout(pl.hideTimer); pl.hideTimer = null; }
    if (pl.controls && !pl.ended) {
      pl.hideTimer = setTimeout(function () {
        var vid = $("vid");
        if (vid && !vid.paused) { pl.controls = false; setClasses(); }
      }, 3400);
    }
  }

  function poke() { showControls(true); }

  /* ------------------------------------------------------------ resolution */

  function resolveUrl(it) {
    if (it.demo) return demoClipUrl();
    if (A.urls[it.id]) return Promise.resolve(A.urls[it.id]);

    if (P.winrt) {
      return A.getFile(it).then(function (file) {
        if (!file) throw new Error("missing");
        return file.openAsync(Windows.Storage.FileAccessMode.read).then(function (stream) {
          if (!window.MSApp || !MSApp.createBlobFromRandomAccessStream) throw new Error("no blob api");
          var blob = MSApp.createBlobFromRandomAccessStream(A.mimeFor(it.ext), stream);
          var url = URL.createObjectURL(blob);
          A.urls[it.id] = url;
          return url;
        });
      });
    }

    var f = A.files[it.id];
    if (!f) return Promise.reject(new Error("missing"));
    var u = URL.createObjectURL(f);
    A.urls[it.id] = u;
    return Promise.resolve(u);
  }

  /* ---------------------------------------------------------------- player */

  function openPlayer(id, startAt) {
    var it = byId(id);
    if (!it) return;
    if (pl.item && pl.item.id !== id) saveProgress(true);

    pl.item = it;
    pl.ended = false;
    pl.pendingSeek = 0;
    pl.durProbe = false;
    S.playerId = id;
    it.lastOpened = now();

    $("ptitle").textContent = it.title || it.name;
    $("psub").textContent = subLine(it);
    $("perr").className = "perr";
    $("pend").className = "pend";
    $("pload").className = "pload";
    $("pfit").setAttribute("data-on", "0");
    $("pfit").className = "pbtn ptext";

    var vid = $("vid");
    try { vid.pause(); } catch (e) { }
    try { vid.removeAttribute("src"); vid.load(); } catch (e) { }
    vid.style.transform = "";

    pl.controls = true;
    setClasses();

    var resume = 0;
    if (typeof startAt === "number") resume = startAt;
    else if (S.set.resume && !it.watched) resume = it.position || 0;
    if (resume > 0 && it.duration && resume > it.duration - 5) resume = 0;
    pl.pendingSeek = resume;

    $("pload").className = "pload on";
    resolveUrl(it).then(function (url) {
      if (S.playerId !== id) { return; }
      var speed = isFinite(S.set.speed) && S.set.speed > 0 ? S.set.speed : 1;
      updateSpeedLabel();
      vid.defaultPlaybackRate = speed;
      vid.src = url;
      // Assigning src resets playbackRate, so the remembered speed goes on after it.
      try { vid.playbackRate = speed; } catch (e) { }
      try {
        var p = vid.play();
        if (p && p.then) p.then(null, function () { setClasses(); });
      } catch (e) { setClasses(); }
      updateUi();
      poke();
    }, function (err) {
      if (S.playerId !== id) return;
      var msg;
      if (err && err.message === "missing") {
        msg = "This file is no longer available. It may have been moved or deleted, or its permission expired.";
      } else {
        msg = "Could not open this video. " + (err && err.message ? err.message : "");
      }
      showError(msg);
    });
  }

  function closePlayer() {
    var vid = $("vid");
    saveProgress(true);
    try { vid.pause(); } catch (e) { }
    try { vid.removeAttribute("src"); vid.load(); } catch (e) { }
    vid.style.transform = "";
    pl.item = null;
    pl.ended = false;
    S.playerId = null;
    if (pl.hideTimer) { clearTimeout(pl.hideTimer); pl.hideTimer = null; }
    $("player").className = "player";
    $("perr").className = "perr";
    $("pend").className = "pend";
    A.saveLib();
    A.paint();
  }

  function togglePlay() {
    var vid = $("vid");
    if (!vid || !pl.item) return;
    if (vid.paused) {
      var p = vid.play();
      if (p && p.then) p.then(null, function () { });
    } else {
      vid.pause();
      saveProgress(true);
    }
    poke();
  }

  function seekBy(delta) {
    var vid = $("vid");
    if (!vid || !isFinite(vid.duration)) return;
    var t = clamp((vid.currentTime || 0) + delta, 0, Math.max(0, vid.duration - 0.4));
    try { vid.currentTime = t; } catch (e) { }
    if (pl.ended) { pl.ended = false; $("pend").className = "pend"; }
    updateUi();
    poke();
  }

  function seekToRatio(r) {
    var vid = $("vid");
    if (!vid || !isFinite(vid.duration) || vid.duration <= 0) return;
    var t = clamp(vid.duration * r, 0, Math.max(0, vid.duration - 0.2));
    try { vid.currentTime = t; } catch (e) { }
    pl.ended = false;
    $("pend").className = "pend";
    updateUi();
  }

  function cycleSpeed() {
    var cur = S.set.speed || 1, i = SPEEDS.indexOf(cur);
    var next = SPEEDS[(i + 1) % SPEEDS.length];
    S.set.speed = next;
    A.saveSettings();
    var vid = $("vid");
    if (vid) {
      try { vid.defaultPlaybackRate = next; vid.playbackRate = next; } catch (e) { }
    }
    updateSpeedLabel();
    A.toast("Playback speed " + next + "\u00d7");
    poke();
  }

  function updateSpeedLabel() {
    var el = $("pspeed");
    if (el) el.textContent = (S.set.speed || 1) + "\u00d7";
  }

  function toggleFit() {
    var btn = $("pfit");
    var on = btn.getAttribute("data-on") === "1";
    btn.setAttribute("data-on", on ? "0" : "1");
    btn.className = "pbtn ptext" + (on ? "" : " on");
    applyFit();
    A.toast(on ? "Fit to screen" : "Fill the screen");
    poke();
  }

  function applyFit() {
    var vid = $("vid"), stage = $("pstage"), btn = $("pfit");
    if (!vid || !stage || !btn) return;
    if (btn.getAttribute("data-on") !== "1" || !vid.videoWidth || !vid.videoHeight) {
      vid.style.transform = "";
      return;
    }
    var cw = stage.clientWidth || 360, ch = stage.clientHeight || 640;
    var ar = vid.videoWidth / vid.videoHeight;
    var dw = Math.min(cw, ch * ar);
    var dh = dw / ar;
    var scale = Math.max(cw / dw, ch / dh);
    vid.style.transform = "scale(" + scale.toFixed(3) + ")";
    vid.style.transformOrigin = "50% 50%";
  }

  function updateUi() {
    var vid = $("vid"), it = pl.item;
    var dur = (vid && isFinite(vid.duration) && vid.duration > 0) ? vid.duration : (it ? it.duration : 0);
    var pos = vid ? (vid.currentTime || 0) : 0;
    var p = dur ? clamp((pos / dur) * 100, 0, 100) : 0;

    var cur = $("pcur"); if (cur) cur.textContent = fmtTime(pos);
    var durEl = $("pdur"); if (durEl) durEl.textContent = fmtTime(dur);
    if (!pl.dragging) {
      var fill = $("pfill"); if (fill) fill.style.width = p + "%";
      var knob = $("pknob"); if (knob) knob.style.left = p + "%";
    }
    try {
      if (vid && vid.buffered && vid.buffered.length && dur) {
        var b = vid.buffered.end(vid.buffered.length - 1);
        $("pbuf").style.width = clamp((b / dur) * 100, 0, 100) + "%";
      }
    } catch (e) { }

    var playing = vid && !vid.paused;
    $("ptoggle").innerHTML = playing ? icon("pause", "ico-fill") : icon("play", "ico-fill");
    $("pbig").innerHTML = playing ? icon("pause", "ico-fill") : icon("play", "ico-fill");
    setClasses();
  }

  function showError(msg) {
    $("perrmsg").textContent = msg;
    $("perr").className = "perr open";
    $("pload").className = "pload";
    pl.controls = true;
    setClasses();
  }

  function saveProgress(force) {
    var vid = $("vid"), it = pl.item;
    if (!it) return;
    if (!vid || !isFinite(vid.duration) || vid.duration <= 0) {
      if (force) A.saveLibSoon();
      return;
    }
    var pos = vid.currentTime || 0;
    if (pl.ended || pos >= vid.duration - 3) {
      it.watched = true;
      it.position = 0;
    } else if (pos > 3) {
      it.position = pos;
    } else {
      it.position = 0;
    }
    if (!it.duration) it.duration = vid.duration;
    if (!it.videoW && vid.videoWidth) {
      it.videoW = vid.videoWidth;
      it.videoH = vid.videoHeight;
    }
    it.lastOpened = now();
    A.saveLibSoon();
    pl.lastSave = now();
  }

  function playerAction(name) {
    switch (name) {
      case "player-close": closePlayer(); break;
      case "player-toggle": togglePlay(); break;
      case "player-back10": seekBy(-10); break;
      case "player-fwd10": seekBy(10); break;
      case "player-speed": cycleSpeed(); break;
      case "player-fit": toggleFit(); break;
      case "player-surface":
        if (pl.controls) showControls(false);
        else poke();
        break;
      case "player-replay":
        pl.ended = false;
        $("pend").className = "pend";
        var vid = $("vid");
        if (vid) { try { vid.currentTime = 0; } catch (e) { } var p = vid.play(); if (p && p.then) p.then(null, function () { }); }
        poke();
        break;
      case "player-end-close": closePlayer(); break;
      case "player-error-external":
        if (pl.item) A.openExternal(pl.item);
        break;
      case "player-error-close": closePlayer(); break;
    }
  }

  /* ------------------------------------------------------------ seek drag */

  function wireSeek() {
    var seek = $("pseek");
    if (!seek) return;
    var vid = $("vid");
    var docMove = null, docUp = null;

    function ratioAt(clientX) {
      var r = seek.getBoundingClientRect();
      if (!r.width) return 0;
      return clamp((clientX - r.left) / r.width, 0, 1);
    }

    function preview(clientX) {
      var r = ratioAt(clientX);
      var dur = vid && isFinite(vid.duration) ? vid.duration : 0;
      $("pfill").style.width = (r * 100) + "%";
      $("pknob").style.left = (r * 100) + "%";
      $("pcur").textContent = fmtTime(dur * r);
    }

    function down(e) {
      if (!pl.item) return;
      pl.dragging = true;
      seek.className = "pseek on";
      try { seek.setPointerCapture(e.pointerId); } catch (err) { }
      preview(e.clientX);
      docMove = function (ev) { if (pl.dragging) preview(ev.clientX); };
      docUp = function (ev) {
        if (!pl.dragging) return;
        pl.dragging = false;
        seek.className = "pseek";
        seekToRatio(ratioAt(ev.clientX));
        cleanup();
        poke();
      };
      document.addEventListener("pointermove", docMove, false);
      document.addEventListener("pointerup", docUp, false);
      document.addEventListener("pointercancel", docUp, false);
      e.preventDefault();
    }

    function cleanup() {
      if (docMove) document.removeEventListener("pointermove", docMove, false);
      if (docUp) {
        document.removeEventListener("pointerup", docUp, false);
        document.removeEventListener("pointercancel", docUp, false);
      }
      docMove = null; docUp = null;
    }

    if (window.PointerEvent) {
      seek.addEventListener("pointerdown", down, false);
    } else {
      seek.addEventListener("mousedown", function (e) {
        down({ clientX: e.clientX, pointerId: 1, preventDefault: function () { e.preventDefault(); } });
      }, false);
    }
  }

  /* --------------------------------------------------------------- wiring */

  function wireVideo() {
    var vid = $("vid");
    if (!vid) return;

    function applyMeta() {
      var it = pl.item;
      if (it) {
        if ((!it.duration || !isFinite(it.duration)) && isFinite(vid.duration) && vid.duration > 0) {
          it.duration = vid.duration;
        }
        if (!it.videoW) { it.videoW = vid.videoWidth; it.videoH = vid.videoHeight; }
      }
      var target = pl.pendingSeek > 0 ? pl.pendingSeek : 0;
      pl.pendingSeek = 0;
      if (target > 0 && isFinite(vid.duration) && target < vid.duration - 1) {
        try { vid.currentTime = target; } catch (e) { }
      } else if (vid.currentTime > 1e6) {
        try { vid.currentTime = 0; } catch (e) { }
      }
      $("pload").className = "pload";
      var sp = isFinite(S.set.speed) && S.set.speed > 0 ? S.set.speed : 1;
      if (vid.playbackRate !== sp) { try { vid.playbackRate = sp; } catch (e) { } }
      applyFit();
      updateUi();
    }

    vid.addEventListener("loadedmetadata", function () {
      // Some containers report no duration at all (MediaRecorder WebM, a few
      // broken MKVs). Seeking far past the end makes the engine work it out;
      // if that fails, applyMeta still runs and the timeline stays live.
      if ((!isFinite(vid.duration) || vid.duration === 0) && !pl.durProbe) {
        pl.durProbe = true;
        try { vid.currentTime = 1e7; } catch (e) { }
        setTimeout(applyMeta, 450);
        return;
      }
      applyMeta();
    }, false);

    vid.addEventListener("durationchange", function () {
      if (pl.durProbe && isFinite(vid.duration) && vid.duration > 0) pl.durProbe = false;
    }, false);

    vid.addEventListener("timeupdate", function () {
      updateUi();
      if (now() - pl.lastSave > 2500) saveProgress(false);
    }, false);

    vid.addEventListener("progress", function () { updateUi(); }, false);
    vid.addEventListener("play", function () { $("pload").className = "pload"; setClasses(); updateUi(); }, false);
    vid.addEventListener("playing", function () { $("pload").className = "pload"; setClasses(); }, false);
    vid.addEventListener("pause", function () { saveProgress(true); setClasses(); updateUi(); }, false);
    vid.addEventListener("waiting", function () { $("pload").className = "pload on"; }, false);
    vid.addEventListener("canplay", function () { $("pload").className = "pload"; }, false);

    vid.addEventListener("ended", function () {
      pl.ended = true;
      var it = pl.item;
      if (it) { it.watched = true; it.position = 0; }
      A.saveLib();
      $("pends").textContent = it ? (it.title || it.name) : "";
      $("pend").className = "pend open";
      pl.controls = true;
      setClasses();
      updateUi();
      A.schedulePaint();
    }, false);

    vid.addEventListener("error", function () {
      var code = 0;
      try { code = vid.error ? vid.error.code : 0; } catch (e) { code = 0; }
      var msg;
      if (code === 4) {
        msg = "This file uses a codec the phone's media engine cannot decode. MP4/H.264 with AAC audio plays everywhere; for this file try Movies & TV, or convert it to H.264 + AAC.";
      } else if (code === 3) {
        msg = "The video data is damaged or incomplete, so it could not be decoded.";
      } else if (code === 2) {
        msg = "The file could not be read. It may have been moved, or its permission expired.";
      } else {
        msg = "This video could not be played.";
      }
      if (pl.item && pl.item.demo) msg = "Demo preview: the sample clip could not be generated in this browser.";
      showError(msg);
    }, false);
  }

  function wireKeys() {
    document.addEventListener("keydown", function (e) {
      if (!S.playerId) return;
      var k = e.key || "";
      if (k === " " || k === "Spacebar") { e.preventDefault(); togglePlay(); }
      else if (k === "ArrowLeft") { e.preventDefault(); seekBy(-10); }
      else if (k === "ArrowRight") { e.preventDefault(); seekBy(10); }
      else if (k === "Escape") { e.preventDefault(); closePlayer(); }
      else if (k === "f" || k === "F") { toggleFit(); }
    }, false);
  }

  /* ------------------------------------------------------------------ demo */

  var DEMO = [
    { t: "The Glass Shore",    ext: "mkv", dur: 6420, size: 4.3, c: ["#123a4a", "#04121a"], pos: 1420, fav: true },
    { t: "Midnight Signal",    ext: "mp4", dur: 5310, size: 2.1, c: ["#3a1140", "#0b0414"], pos: 620 },
    { t: "Solar Drift",        ext: "mkv", dur: 7380, size: 6.8, c: ["#5a2a08", "#170a02"], fav: true },
    { t: "Paper Moons",        ext: "avi", dur: 4980, size: 1.4, c: ["#123c2c", "#04140e"] },
    { t: "Nokia Nights",       ext: "mp4", dur: 3120, size: 0.9, c: ["#0d2b52", "#03080f"], fav: true },
    { t: "Static Bloom",       ext: "wmv", dur: 4260, size: 1.1, c: ["#40121f", "#12040a"], pos: 2100 },
    { t: "The Long Road North",ext: "mkv", dur: 8100, size: 7.2, c: ["#1c2c14", "#060a04"], watched: true },
    { t: "Ember",              ext: "mov", dur: 3900, size: 1.8, c: ["#4a1b06", "#150601"] },
    { t: "Velocity",           ext: "ts",  dur: 5640, size: 3.9, c: ["#0a2f46", "#02101a"] },
    { t: "Hidden Frequencies", ext: "mp4", dur: 6840, size: 3.1, c: ["#2b1a4a", "#080416"], fav: true },
    { t: "Afterglow",          ext: "3gp", dur: 2280, size: 0.3, c: ["#43240a", "#120901"], pos: 410 },
    { t: "Monsoon",            ext: "mkv", dur: 6780, size: 5.4, c: ["#0f3038", "#03100f"] }
  ];

  var demoArts = {};
  var demoClipP = null;

  function startDemo() {
    if (S.demo) { A.setView("home"); return; }
    S.demo = true;
    S.lib = [];
    for (var i = 0; i < DEMO.length; i++) {
      var d = DEMO[i];
      S.lib.push({
        id: "demo" + i,
        key: "demo" + i,
        name: d.t.replace(/ /g, ".") + "." + d.ext,
        title: d.t,
        ext: d.ext,
        size: Math.round(d.size * 1024 * 1024 * 1024),
        path: "",
        folder: "Demo library",
        dateAdded: now() - i * 86400000,
        modified: now() - i * 86400000,
        duration: d.dur,
        videoW: 1920,
        videoH: 1080,
        position: d.pos || 0,
        lastOpened: now() - i * 3600000,
        watched: !!d.watched,
        fav: !!d.fav,
        demo: true,
        c1: d.c[0],
        c2: d.c[1]
      });
    }
    A.setView("home");
    A.toast("Demo library \u2014 " + DEMO.length + " sample titles");
    // Render the sample clip while the user browses, so Play is instant.
    demoClipUrl().then(function () { }, function () { });
  }

  function wrapText(g, text, x, y, maxW, lineH) {
    var words = text.split(" "), line = "", lines = [], i;
    for (i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (g.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (i = 0; i < lines.length; i++) g.fillText(lines[i], x, y + i * lineH);
    return y + lines.length * lineH;
  }

  function demoPoster(it) {
    if (demoArts[it.id]) return demoArts[it.id];
    try {
      var c = document.createElement("canvas");
      c.width = 480; c.height = 270;
      var g = c.getContext("2d");
      var grad = g.createLinearGradient(0, 0, 480, 270);
      grad.addColorStop(0, it.c1 || "#123a4a");
      grad.addColorStop(1, it.c2 || "#04121a");
      g.fillStyle = grad;
      g.fillRect(0, 0, 480, 270);

      // soft light sweep
      var rg = g.createRadialGradient(360, 60, 10, 360, 60, 300);
      rg.addColorStop(0, "rgba(255,255,255,0.20)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, 480, 270);

      g.fillStyle = "rgba(255,255,255,0.90)";
      g.font = "600 13px 'Segoe UI', Arial, sans-serif";
      g.fillText("MP4LUMIA", 28, 40);

      g.font = "700 34px 'Segoe UI', Arial, sans-serif";
      g.fillStyle = "#ffffff";
      wrapText(g, it.title, 28, 168, 340, 38);

      g.font = "500 14px 'Segoe UI', Arial, sans-serif";
      g.fillStyle = "rgba(255,255,255,0.62)";
      g.fillText((it.ext || "").toUpperCase() + "  \u00b7  " + resLabel(it), 28, 240);

      // play ring
      g.strokeStyle = "rgba(255,255,255,0.75)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(424, 210, 22, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.moveTo(418, 199);
      g.lineTo(433, 210);
      g.lineTo(418, 221);
      g.closePath();
      g.fill();

      var url = c.toDataURL("image/jpeg", 0.82);
      demoArts[it.id] = url;
      return url;
    } catch (e) {
      return null;
    }
  }

  function demoClipUrl() {
    if (demoClipP) return demoClipP;
    demoClipP = new Promise(function (resolve, reject) {
      try {
        if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
          reject(new Error("no recorder"));
          return;
        }
        var c = document.createElement("canvas");
        c.width = 640; c.height = 360;
        var g = c.getContext("2d");
        var stream = c.captureStream(24);
        var types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
        var mime = "";
        for (var i = 0; i < types.length; i++) {
          if (window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) {
            mime = types[i]; break;
          }
        }
        var rec;
        try {
          rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1200000 })
                     : new MediaRecorder(stream);
        } catch (err) {
          rec = new MediaRecorder(stream);
        }
        var chunks = [];
        var stopped = false;
        function stopRec() {
          if (stopped) return;
          stopped = true;
          try { rec.stop(); } catch (e) { }
        }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          try {
            var blob = new Blob(chunks, { type: "video/webm" });
            resolve(URL.createObjectURL(blob));
          } catch (e) { reject(e); }
        };
        var t0 = now();
        var DURATION = 12;
        function frame() {
          var t = (now() - t0) / 1000;
          var hue = 210 + Math.sin(t / 3) * 40;
          var grad = g.createLinearGradient(0, 0, 640, 360);
          grad.addColorStop(0, "hsl(" + hue + ",55%,18%)");
          grad.addColorStop(1, "hsl(" + (hue + 40) + ",65%,7%)");
          g.fillStyle = grad;
          g.fillRect(0, 0, 640, 360);

          var cx = 320 + Math.cos(t * 0.8) * 90;
          var cy = 180 + Math.sin(t * 1.2) * 40;
          var rg = g.createRadialGradient(cx, cy, 8, cx, cy, 150);
          rg.addColorStop(0, "rgba(229,9,20,0.55)");
          rg.addColorStop(1, "rgba(229,9,20,0)");
          g.fillStyle = rg;
          g.fillRect(0, 0, 640, 360);

          g.fillStyle = "rgba(255,255,255,0.92)";
          g.font = "700 30px 'Segoe UI', Arial, sans-serif";
          g.fillText("MP4Lumia", 40, 70);
          g.font = "500 15px 'Segoe UI', Arial, sans-serif";
          g.fillStyle = "rgba(255,255,255,0.6)";
          g.fillText("demo clip \u00b7 " + t.toFixed(1) + "s", 40, 98);

          g.fillStyle = "rgba(255,255,255,0.9)";
          g.beginPath();
          g.arc(320, 190, 46, 0, Math.PI * 2);
          g.globalAlpha = 0.14;
          g.fill();
          g.globalAlpha = 1;
          g.beginPath();
          g.moveTo(306, 168);
          g.lineTo(344, 190);
          g.lineTo(306, 212);
          g.closePath();
          g.fill();

          g.fillStyle = "rgba(255,255,255,0.25)";
          g.fillRect(40, 322, 560, 4);
          g.fillStyle = "#e50914";
          g.fillRect(40, 322, 560 * (t / DURATION), 4);

          if (t < DURATION) requestAnimationFrame(frame);
          else stopRec();
        }
        rec.start();
        frame();
        setTimeout(stopRec, (DURATION + 2) * 1000);
      } catch (e) { reject(e); }
    });
    return demoClipP;
  }

  /* ------------------------------------------------------------ activation */

  var activationSeen = false;

  function initActivation() {
    if (!P.winrt) return;
    try {
      Windows.UI.WebUI.WebUIApplication.addEventListener("activated", function (args) {
        try {
          if (args && args.kind === Windows.ApplicationModel.Activation.ActivationKind.file &&
              args.files && args.files.length) {
            var list = A.toArray(args.files);
            var added = A.addFiles(list, true);
            var first = added.length ? added[0] : null;
            if (first) {
              A.toast("Opening \u201c" + (first.title || first.name) + "\u201d");
              openPlayer(first.id);
            } else if (args.files.length) {
              A.toast("That video is already in your library");
            }
          }
        } catch (e) { }
      });
      activationSeen = true;
    } catch (e) { }

    try {
      Windows.UI.WebUI.WebUIApplication.addEventListener("suspending", function () {
        saveProgress(true);
        A.saveLib();
      });
    } catch (e) { }
  }

  /* ------------------------------------------------------------------ boot */

  function init() {
    A.loadSettings();
    A.loadLib();
    A.applyTheme();
    A.watchSystemTheme();
    wireVideo();
    wireSeek();
    wireKeys();
    A.paintTabs();
    A.setView("home");
    initActivation();

    if (/[?&]demo\b/.test(location.search)) {
      setTimeout(startDemo, 80);
    }

    window.addEventListener("beforeunload", function () {
      if (pl.item) saveProgress(true);
      A.saveLib();
    }, false);

    window.addEventListener("resize", function () { if (pl.item) applyFit(); }, false);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && pl.item) saveProgress(true);
    }, false);

    // Let the page shell hide its boot placeholder.
    try { document.body.className += " booted"; } catch (e) { }
    window.MP4_READY = true;
  }

  A.openPlayer = openPlayer;
  A.closePlayer = closePlayer;
  A.playerAction = playerAction;
  A.startDemo = startDemo;
  A.demoPoster = demoPoster;
  A.saveProgress = saveProgress;

  init();
})();
