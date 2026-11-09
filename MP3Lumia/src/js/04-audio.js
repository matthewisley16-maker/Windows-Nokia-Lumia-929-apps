/* MP3Lumia — playback and the equaliser. Two <audio> decks feed one Web Audio
   graph: per-deck gain (for crossfade) -> preamp -> ten biquad bands -> limiter
   -> analyser -> master volume. Works on EdgeHTML's Web Audio implementation and
   degrades to plain playback if createMediaElementSource is missing. */
(function () {
  "use strict";

  var A = window.MP3;
  var S = A.S;
  var $ = A.$, clamp = A.clamp, now = A.now, toast = A.toast;

  var FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  var FREQ_LABEL = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

  /* Ten bands: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz. Values in dB. */
  var PRESETS = {
    "Flat":          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Normal":        [1, 0.5, 0, 0, 0, 0, 0.5, 1, 1.5, 1],
    "Spotify":       [3, 2.5, 1, 0, -0.5, -0.5, 0, 1.5, 2.5, 3],
    "Spotify Punch": [4.5, 3.5, 1.5, 0, -1, -0.5, 0.5, 2, 3.5, 4.5],
    "Bass":          [8, 6, 3, 1, 0, 0, 0, 0, -1, -1],
    "Mids":          [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
    "Highs":         [-1, -1, -1, 0, 0, 0, 1, 3, 5, 6],
    "Bass Boost":    [9, 7, 4, 1, 0, 0, 0, 0, 0, -1],
    "Treble Boost":  [0, 0, 0, 0, 0, 1, 2, 3.5, 5.5, 6.5],
    "Loudness":      [6, 4, 1, -1, -1.5, -1, 0, 2, 4, 5],
    "V-Shape":       [6, 5, 3, 0, -1.5, -1.5, 0, 2, 4, 5],
    "Warm":          [5, 4, 2, 1, 0, -1, -1, -1, -1, -1],
    "Bright":        [-2, -1, 0, 0, 0, 1, 2, 3, 4, 5],
    "Rock":          [5, 4, 2, 0, -1, -1, 0.5, 2, 3.5, 4],
    "Pop":           [-1, 0.5, 1.5, 2.5, 3, 2, 0.5, -0.5, -1, -1.5],
    "Rap":           [7, 6, 3, 1, -1, -1.5, 0, 1, 2, 2.5],
    "Hip-Hop":       [6, 5, 2, 0.5, -1, -1, 0, 1, 2.5, 3],
    "R&B":           [5, 4, 1, 0, -1, -1, 0.5, 2, 3, 3.5],
    "Electronic":    [5, 4, 1, 0, -1, 0.5, 1.5, 2.5, 3.5, 4],
    "Dance":         [6, 5, 3, 1, 0, 0.5, 1.5, 2, 3, 3.5],
    "House":         [5, 4, 2, 0.5, 0, 0.5, 1, 2, 3, 3],
    "Trance":        [4, 3, 1, 0, 0, 1, 2, 3, 4, 4],
    "Club":          [6, 5, 3, 1, 0, 0, 1.5, 2.5, 3, 2],
    "Live":          [3, 2, 1, 0, 0, 0.5, 1, 2, 2.5, 2],
    "Jazz":          [3, 2, 1, 1.5, 0, -1, -0.5, 1, 2, 2.5],
    "Classical":     [3, 2, 1, 0, -0.5, -1, -0.5, 1, 2, 3],
    "Piano":         [2, 1.5, 1, 1.5, 2, 1.5, 1, 1.5, 1.5, 1],
    "Guitar":        [2, 1, 0, 1.5, 2, 1.5, 1.5, 2, 1, 0],
    "Acoustic":      [2, 1.5, 0.5, 1, 1.5, 1, 1.5, 2, 1.5, 1],
    "Vocal":         [-2, -1, 0, 1, 2, 3.5, 4, 3, 1.5, 0],
    "Podcast":       [-4, -3, -1, 2, 3.5, 3.5, 2, 0.5, 0, -1],
    "Audiobook":     [-5, -3, 0, 2, 3, 3, 2, 1, 0, -2],
    "Lo-Fi":         [3, 2, 1, -1, -2, -1, 0, -1, -3, -4],
    "Headphones":    [4, 3, 1, 0, -1, -0.5, 0, 1.5, 2.5, 2.5],
    "Small Speakers": [3, 2, 2, 2, 1, 0, -1, -2, -2, -2]
  };

  var decks = [
    { el: null, gain: null, ready: false },
    { el: null, gain: null, ready: false }
  ];

  var au = {
    ctx: null, graph: false, eqBroken: false, bands: [], preamp: null,
    limiter: null, analyser: null, master: null, freq: null,
    active: 0, track: null, queue: [], index: -1, label: "",
    fading: false, fadeTimer: null, loading: false,
    sleepTimer: null, sleepEnd: false, sleepAt: 0,
    lastFadeCheck: 0, eqBypassed: false
  };

  function transport() { if (A.paintTransport) A.paintTransport(); }
  function nowChanged() { if (A.refreshPlayback) A.refreshPlayback(); }

  function dbToGain(db) { return Math.pow(10, db / 20); }
  function gainToDb(g) { return g > 0 ? 20 * Math.log(g) / Math.LN10 : -100; }

  function rampParam(param, value, seconds) {
    try {
      var t = au.ctx.currentTime;
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(value, t + Math.max(0.01, seconds || 0.05));
    } catch (e) {
      try { param.value = value; } catch (e2) { }
    }
  }

  /* ---------------------------------------------------------------- graph */

  function initGraph() {
    if (au.graph || au.eqBroken) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { au.eqBroken = true; return; }

    decks[0].el = $("deckA");
    decks[1].el = $("deckB");
    if (!decks[0].el || !decks[1].el) { au.eqBroken = true; return; }

    var ctx = null;
    try { ctx = new Ctx({ latencyHint: "playback" }); } catch (e0) { ctx = null; }
    if (!ctx) {
      try { ctx = new Ctx(); } catch (e1) { au.eqBroken = true; return; }
    }

    try {
      var sum = ctx.createGain();
      sum.gain.value = 1;

      for (var i = 0; i < 2; i++) {
        var src = ctx.createMediaElementSource(decks[i].el);
        var g = ctx.createGain();
        g.gain.value = i === 0 ? 1 : 0;
        src.connect(g);
        g.connect(sum);
        decks[i].gain = g;
      }

      var pre = ctx.createGain();
      pre.gain.value = 1;
      sum.connect(pre);

      var node = pre, bands = [], band;
      for (i = 0; i < FREQS.length; i++) {
        band = ctx.createBiquadFilter();
        band.type = i === 0 ? "lowshelf" : (i === FREQS.length - 1 ? "highshelf" : "peaking");
        band.frequency.value = FREQS[i];
        band.Q.value = 1.1;
        band.gain.value = 0;
        node.connect(band);
        node = band;
        bands.push(band);
      }

      var limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 4;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;

      var analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;

      var master = ctx.createGain();
      master.gain.value = effectiveVolume();

      node.connect(limiter);
      limiter.connect(analyser);
      analyser.connect(master);
      master.connect(ctx.destination);

      au.ctx = ctx;
      au.bands = bands;
      au.preamp = pre;
      au.limiter = limiter;
      au.analyser = analyser;
      au.master = master;
      au.freq = new Uint8Array(analyser.frequencyBinCount);
      au.graph = true;

      try {
        var onCtxState = function () {
          if (ctx.state === "suspended" && isPlaying()) {
            setTimeout(function () {
              if (isPlaying()) { try { ctx.resume(); } catch (eState) { } }
            }, 80);
          }
        };
        if (ctx.addEventListener) ctx.addEventListener("statechange", onCtxState);
        else ctx.onstatechange = onCtxState;
      } catch (eStateAdd) { }

      applyEQ();
      applyVolume();
      applyNormalize();
    } catch (e) {
      au.eqBroken = true;
      au.graph = false;
    }
  }

  function ensureContext() {
    initGraph();
    if (au.ctx && au.ctx.state === "suspended") {
      try { au.ctx.resume(); } catch (e) { }
    }
  }

  /* --------------------------------------------------------------- volume */

  function effectiveVolume() {
    if (S.set.muted) return 0;
    return clamp(S.set.volume, 0, 1);
  }

  function applyVolume() {
    var v = effectiveVolume();
    if (au.graph && au.master) rampParam(au.master.gain, v, 0.05);
    for (var i = 0; i < 2; i++) {
      if (!decks[i].el) continue;
      try { decks[i].el.volume = au.graph ? 1 : v; } catch (e) { }
    }
    transport();
  }

  function setVolume(v) {
    S.set.volume = clamp(v, 0, 1);
    if (S.set.volume > 0) S.set.muted = false;
    A.saveSettings();
    applyVolume();
  }

  function toggleMute() {
    S.set.muted = !S.set.muted;
    A.saveSettings();
    applyVolume();
    toast(S.set.muted ? "Muted" : "Volume " + Math.round(S.set.volume * 100) + "%");
  }

  /* ------------------------------------------------------------------- eq */

  function applyNormalize() {
    if (!au.graph || !au.preamp) return;
    var gain = S.set.preamp;
    if (S.set.normalize && au.track && isFinite(au.track.replayGain) && au.track.replayGain) {
      gain += clamp(au.track.replayGain, -12, 12);
    }
    gain = clamp(gain, -24, 12);
    rampParam(au.preamp.gain, dbToGain(gain), 0.08);

    if (au.limiter) {
      try {
        if (S.set.limiter) {
          au.limiter.threshold.value = -6;
          au.limiter.ratio.value = 12;
        } else {
          au.limiter.threshold.value = 0;
          au.limiter.ratio.value = 1;
        }
      } catch (e) { }
    }
  }

  function applyEQ() {
    if (!au.graph) return;
    var flat = true, db, i;
    for (i = 0; i < au.bands.length; i++) {
      db = S.set.eqOn ? clamp(S.set.eq[i], -12, 12) : 0;
      if (Math.abs(db) > 0.01) flat = false;
      rampParam(au.bands[i].gain, db, 0.05);
    }
    routeEQ(flat);
    applyNormalize();
  }

  function routeEQ(bypass) {
    if (!au.graph || !au.preamp || !au.bands.length || bypass === au.eqBypassed) return;
    if (bypass) {
      try { au.preamp.disconnect(au.bands[0]); } catch (e) { }
      try { au.preamp.connect(au.limiter); } catch (e2) { }
      au.eqBypassed = true;
    } else {
      try { au.preamp.disconnect(au.limiter); } catch (e3) { }
      try { au.preamp.connect(au.bands[0]); } catch (e4) { }
      au.eqBypassed = false;
    }
  }

  function setEQBand(i, db) {
    if (i < 0 || i >= 10) return;
    S.set.eq[i] = clamp(parseFloat(db) || 0, -12, 12);
    S.set.eqOn = true;
    S.set.eqPreset = "Custom";
    A.saveSettings();
    applyEQ();
    if (A.refreshEQ) A.refreshEQ();
  }

  function setPreamp(db) {
    S.set.preamp = clamp(parseFloat(db) || 0, -12, 12);
    A.saveSettings();
    applyNormalize();
    if (A.refreshEQ) A.refreshEQ();
  }

  function setPreset(name) {
    var values = PRESETS[name];
    if (!values && S.set.eqCustom[name]) values = S.set.eqCustom[name];
    if (!values) return false;
    S.set.eq = values.slice(0);
    S.set.eqOn = true;
    S.set.eqPreset = name;
    A.saveSettings();
    applyEQ();
    if (A.refreshEQ) A.refreshEQ();
    return true;
  }

  function resetEQ() {
    S.set.eq = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    S.set.preamp = 0;
    S.set.eqOn = true;
    S.set.eqPreset = "Flat";
    A.saveSettings();
    applyEQ();
    if (A.refreshEQ) A.refreshEQ();
  }

  function savePreset(name) {
    name = String(name || "").replace(/^\s+|\s+$/g, "");
    if (!name) return false;
    S.set.eqCustom[name] = S.set.eq.slice(0);
    S.set.eqPreset = name;
    A.saveSettings();
    if (A.refreshEQ) A.refreshEQ();
    toast('Preset "' + name + '" saved');
    return true;
  }

  function deletePreset(name) {
    if (!S.set.eqCustom[name]) return;
    delete S.set.eqCustom[name];
    if (S.set.eqPreset === name) S.set.eqPreset = "Flat";
    A.saveSettings();
    if (A.refreshEQ) A.refreshEQ();
  }

  function presetNames() {
    var out = [], k;
    for (k in PRESETS) if (PRESETS.hasOwnProperty(k)) out.push(k);
    for (k in S.set.eqCustom) if (S.set.eqCustom.hasOwnProperty(k)) out.push(k);
    return out;
  }

  /* ------------------------------------------------------------- playback */

  function activeDeck() { return decks[au.active]; }

  function isPlaying() {
    var d = activeDeck();
    return !!(d && d.el && !d.el.paused && !d.el.ended);
  }

  function currentTrack() { return au.track; }
  function currentId() { return au.track ? au.track.id : null; }

  function setSrc(deck, url) {
    var el = deck.el;
    try { el.pause(); } catch (e) { }
    try { el.removeAttribute("src"); el.load(); } catch (e2) { }
    el.src = url;
    if (au.graph) deck.gain.gain.value = 0;
    try { el.load(); } catch (e3) { }
  }

  function playCurrent(startAt) {
    var t = A.byId(au.queue[au.index]);
    if (!t) {
      // A removed track: skip forward until something exists.
      for (var i = au.index + 1; i < au.queue.length; i++) {
        if (A.byId(au.queue[i])) { au.index = i; t = A.byId(au.queue[i]); break; }
      }
      if (!t) { transport(); return; }
    }

    au.loading = true;
    ensureContext();

    A.playableUrl(t).then(function (url) {
      au.track = t;
      au.fading = false;
      if (au.fadeTimer) { clearTimeout(au.fadeTimer); au.fadeTimer = null; }

      var deck = activeDeck();
      var other = decks[1 - au.active];
      if (other.el && !other.el.paused) { try { other.el.pause(); } catch (e) { } }
      if (au.graph) other.gain.gain.value = 0;

      setSrc(deck, url);
      if (startAt > 0) {
        try { deck.el.currentTime = startAt; } catch (e2) { }
      }
      if (au.graph) rampParam(deck.gain.gain, 1, 0.08);
      try {
        var p = deck.el.play();
        if (p && p.catch) p.catch(function () { transport(); });
      } catch (e3) { }

      setTimeout(function () {
        if (au.ctx && au.ctx.state === "suspended") {
          try { au.ctx.resume(); } catch (e4) { }
        }
      }, 0);

      au.loading = false;
      A.bumpPlay(t);
      applyNormalize();
      saveQueue();
      nowChanged();
      transport();
    }, function () {
      au.loading = false;
      toast("Cannot play \u201c" + (t.title || t.name) + "\u201d \u2014 the file is missing or unreadable");
      transport();
    });
  }

  function toggle() {
    ensureContext();
    if (!au.track) {
      if (!S.lib.length) { toast("Add some music first"); return; }
      var all = A.sortTracks(S.lib, S.set.sortSongs || "title");
      playContext(idsOf(all), 0, "Your library");
      return;
    }
    var el = activeDeck().el;
    if (!el) return;
    if (!el.getAttribute("src")) { playCurrent(); return; }
    if (el.paused) {
      try {
        var p = el.play();
        if (p && p.catch) p.catch(function () { });
      } catch (e) { }
      if (au.ctx && au.ctx.state === "suspended") { try { au.ctx.resume(); } catch (e2) { } }
    } else {
      el.pause();
    }
    transport();
    updateMediaSession();
  }

  function play() { if (!isPlaying()) toggle(); }
  function pause() { if (isPlaying()) toggle(); }

  function idsOf(list) {
    var out = [], i;
    for (i = 0; i < list.length; i++) out.push(list[i].id);
    return out;
  }

  function shuffleArray(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function playContext(ids, startIndex, label) {
    var clean = [], i;
    for (i = 0; i < ids.length; i++) if (A.byId(ids[i])) clean.push(ids[i]);
    if (!clean.length) { toast("Nothing to play"); return; }

    var idx = clamp(startIndex || 0, 0, clean.length - 1);
    var order = clean.slice(0);

    if (S.set.shuffle && order.length > 1) {
      var first = order[idx];
      var rest = order.slice(0, idx).concat(order.slice(idx + 1));
      shuffleArray(rest);
      order = [first].concat(rest);
      idx = 0;
    }

    au.queue = order;
    au.index = idx;
    au.label = label || "Your library";
    playCurrent();
  }

  function nextIndex(auto) {
    if (!au.queue.length) return -1;
    if (auto && S.set.repeat === "one") return au.index;
    var i = au.index + 1;
    if (i >= au.queue.length) {
      if (S.set.repeat === "all") return 0;
      return -1;
    }
    return i;
  }

  function advance(auto) {
    var i = nextIndex(auto);
    if (i < 0) { au.track = au.track; transport(); return; }
    if (i === au.index) {
      try { activeDeck().el.currentTime = 0; } catch (e) { }
      var p = activeDeck().el.play();
      if (p && p.catch) p.catch(function () { });
      transport();
      return;
    }
    au.index = i;
    playCurrent();
  }

  function next() { advance(false); }

  function prev() {
    var el = activeDeck().el;
    if (el && el.currentTime > 3) {
      try { el.currentTime = 0; } catch (e) { }
      transport();
      return;
    }
    if (au.index > 0) {
      au.index--;
      playCurrent();
    } else if (au.queue.length) {
      try { el.currentTime = 0; } catch (e) { }
      transport();
    }
  }

  function seekRatio(r) {
    var el = activeDeck().el;
    if (!el || !isFinite(el.duration) || el.duration <= 0) return;
    try { el.currentTime = clamp(r, 0, 1) * el.duration; } catch (e) { }
    transport();
  }

  function seekTo(sec) {
    var el = activeDeck().el;
    if (!el || !isFinite(el.duration)) return;
    try { el.currentTime = clamp(sec, 0, Math.max(0, el.duration - 0.1)); } catch (e) { }
    transport();
  }

  function seekBy(delta) {
    var el = activeDeck().el;
    if (!el) return;
    seekTo((el.currentTime || 0) + delta);
  }

  /* --------------------------------------------------------------- shuffle */

  function toggleShuffle() {
    S.set.shuffle = !S.set.shuffle;
    A.saveSettings();
    if (S.set.shuffle && au.queue.length > 1) {
      var first = au.queue[au.index];
      var rest = au.queue.slice(au.index + 1);
      shuffleArray(rest);
      au.queue = au.queue.slice(0, au.index + 1).concat(rest);
      saveQueue();
    }
    toast("Shuffle " + (S.set.shuffle ? "on" : "off"));
    transport();
  }

  function cycleRepeat() {
    var order = ["off", "all", "one"];
    var i = order.indexOf(S.set.repeat);
    S.set.repeat = order[(i + 1) % order.length];
    A.saveSettings();
    toast(S.set.repeat === "off" ? "Repeat off" :
          (S.set.repeat === "all" ? "Repeat all" : "Repeat one"));
    transport();
  }

  /* ------------------------------------------------------------- crossfade */

  function maybeCrossfade(el) {
    var cf = parseInt(S.set.crossfade, 10) || 0;
    if (!cf) return;
    if (au.fading || au.loading) return;
    if (S.set.repeat === "one") return;
    if (!isFinite(el.duration) || el.duration <= 0) return;
    if (au.index + 1 >= au.queue.length) return;
    var remaining = el.duration - el.currentTime;
    if (remaining > cf || remaining < 0.25) return;

    var nt = A.byId(au.queue[au.index + 1]);
    if (!nt) return;

    var otherIndex = 1 - au.active;
    var od = decks[otherIndex].el;
    var oldIndex = au.active;

    au.fading = true;
    A.playableUrl(nt).then(function (url) {
      if (!au.fading) return;
      try { od.pause(); } catch (e) { }
      od.src = url;
      if (au.graph) decks[otherIndex].gain.gain.value = 0;
      try {
        var p = od.play();
        if (p && p.catch) p.catch(function () { });
      } catch (e2) { }

      var fadeSec = Math.min(cf, 12);
      au.index++;
      au.track = nt;
      au.active = otherIndex;
      A.bumpPlay(nt);
      applyNormalize();
      saveQueue();
      nowChanged();

      if (au.graph) {
        rampParam(decks[oldIndex].gain.gain, 0, fadeSec);
        rampParam(decks[otherIndex].gain.gain, 1, fadeSec);
      }

      if (au.fadeTimer) clearTimeout(au.fadeTimer);
      au.fadeTimer = setTimeout(function () {
        try { decks[oldIndex].el.pause(); } catch (e3) { }
        if (au.graph) {
          try { decks[oldIndex].gain.gain.value = 0; } catch (e4) { }
          try { decks[au.active].gain.gain.value = 1; } catch (e5) { }
        }
        au.fading = false;
        au.fadeTimer = null;
        transport();
      }, fadeSec * 1000 + 150);
    }, function () {
      au.fading = false;
    });
  }

  /* ------------------------------------------------------------- queue api */

  function addNext(id) {
    if (!A.byId(id)) return;
    if (!au.queue.length) { playContext([id], 0, "Queue"); return; }
    var existing = au.queue.indexOf(id);
    if (existing >= 0) au.queue.splice(existing, 1);
    var at = au.index + 1;
    if (existing >= 0 && existing <= au.index) at = au.index;
    au.queue.splice(at, 0, id);
    saveQueue();
    toast("Playing next");
    if (A.refreshQueue) A.refreshQueue();
  }

  function addLast(id) {
    if (!A.byId(id)) return;
    if (!au.queue.length) { playContext([id], 0, "Queue"); return; }
    var existing = au.queue.indexOf(id);
    if (existing >= 0) au.queue.splice(existing, 1);
    au.queue.push(id);
    if (existing >= 0 && existing <= au.index) au.index--;
    saveQueue();
    toast("Added to queue");
    if (A.refreshQueue) A.refreshQueue();
  }

  function queueRemove(i) {
    if (i < 0 || i >= au.queue.length) return;
    var wasCurrent = i === au.index;
    au.queue.splice(i, 1);
    if (i < au.index) au.index--;
    if (wasCurrent) {
      if (au.queue.length) {
        au.index = clamp(au.index, 0, au.queue.length - 1);
        playCurrent();
      } else {
        au.track = null;
        au.index = -1;
        stopAll();
      }
    }
    saveQueue();
    if (A.refreshQueue) A.refreshQueue();
    transport();
  }

  function queueMove(i, dir) {
    var j = i + dir;
    if (i < 0 || j < 0 || i >= au.queue.length || j >= au.queue.length) return;
    var tmp = au.queue[i];
    au.queue[i] = au.queue[j];
    au.queue[j] = tmp;
    if (au.index === i) au.index = j;
    else if (au.index === j) au.index = i;
    saveQueue();
    if (A.refreshQueue) A.refreshQueue();
  }

  function queueClear() {
    var cur = au.queue[au.index];
    au.queue = cur ? [cur] : [];
    au.index = cur ? 0 : -1;
    saveQueue();
    if (A.refreshQueue) A.refreshQueue();
    toast("Queue cleared");
  }

  function queuePlay(i) {
    if (i < 0 || i >= au.queue.length) return;
    au.index = i;
    playCurrent();
    if (A.refreshQueue) A.refreshQueue();
  }

  function queueDrop(id) {
    var changed = false, i;
    for (i = au.queue.length - 1; i >= 0; i--) {
      if (au.queue[i] === id && i !== au.index) { au.queue.splice(i, 1); changed = true; if (i < au.index) au.index--; }
    }
    if (changed) saveQueue();
  }

  function stopAll() {
    for (var i = 0; i < 2; i++) {
      if (!decks[i].el) continue;
      try { decks[i].el.pause(); } catch (e) { }
      if (au.graph) { try { decks[i].gain.gain.value = i === au.active ? 1 : 0; } catch (e2) { } }
    }
  }

  function saveQueue() {
    A.saveJson("mp3lumia.queue.v1", {
      queue: au.queue, index: au.index, label: au.label
    });
  }

  function restoreQueue() {
    var q = A.loadJson("mp3lumia.queue.v1", null);
    if (!q || !q.queue || !q.queue.length) return;
    au.queue = q.queue;
    au.index = clamp(q.index || 0, 0, q.queue.length - 1);
    au.label = q.label || "Your library";
    au.track = A.byId(au.queue[au.index]);
    if (au.track) transport();
  }

  function upcoming() {
    var out = [], i;
    for (i = au.index + 1; i < au.queue.length; i++) {
      var t = A.byId(au.queue[i]);
      if (t) out.push({ index: i, track: t });
    }
    return out;
  }

  /* ----------------------------------------------------------- sleep timer */

  function clearSleep() {
    if (au.sleepTimer) { clearTimeout(au.sleepTimer); au.sleepTimer = null; }
    au.sleepEnd = false;
    au.sleepAt = 0;
  }

  function sleepSet(minutes) {
    clearSleep();
    if (!minutes) {
      S.set.sleepMinutes = 0;
      A.saveSettings();
      toast("Sleep timer off");
      if (A.refreshSettings) A.refreshSettings();
      return;
    }
    S.set.sleepMinutes = minutes;
    A.saveSettings();
    if (minutes === "end") {
      au.sleepEnd = true;
      toast("Sleep timer: stop at the end of this track");
    } else {
      var ms = minutes * 60000;
      au.sleepAt = now() + ms;
      au.sleepTimer = setTimeout(function () {
        au.sleepTimer = null;
        fadeOutAndPause();
        toast("Sleep timer: playback stopped");
      }, ms);
      toast("Sleep timer: " + minutes + " minutes");
    }
    if (A.refreshSettings) A.refreshSettings();
  }

  function fadeOutAndPause() {
    if (au.graph && au.master) rampParam(au.master.gain, 0, 1.4);
    setTimeout(function () {
      stopAll();
      au.sleepEnd = false;
      au.sleepAt = 0;
      if (au.graph && au.master) rampParam(au.master.gain, effectiveVolume(), 0.2);
      transport();
    }, 1500);
  }

  /* ------------------------------------------------------------- media api */

  var mediaKey = "";

  function updateMediaSession() {
    updateNativeMedia();
    if (!navigator.mediaSession) return;
    try {
      var t = au.track;
      if (t && window.MediaMetadata) {
        var art = A.artFor(t.id);
        var key = [t.id, t.title, t.artist, t.album, art ? "art" : ""].join("|");
        if (key !== mediaKey) {
          var meta = {
            title: t.title || t.name,
            artist: t.artist || "Unknown Artist",
            album: t.album || ""
          };
          if (art) meta.artwork = [{ src: art, sizes: "400x400" }];
          try { navigator.mediaSession.metadata = new MediaMetadata(meta); mediaKey = key; } catch (e) { }
        }
      }
      try { navigator.mediaSession.playbackState = isPlaying() ? "playing" : "paused"; } catch (e2) { }
      if (navigator.mediaSession.setPositionState) {
        var el = activeDeck().el;
        if (el && isFinite(el.duration) && el.duration > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: el.duration,
              position: Math.min(el.currentTime, el.duration),
              playbackRate: el.playbackRate || 1
            });
          } catch (e3) { }
        }
      }
    } catch (e) { }
  }

  function wireMediaSession() {
    if (!navigator.mediaSession || !navigator.mediaSession.setActionHandler) return;
    var handlers = {
      play: function () { play(); },
      pause: function () { pause(); },
      previoustrack: function () { prev(); },
      nexttrack: function () { next(); },
      seekbackward: function (d) { seekBy(-(d && d.seekOffset ? d.seekOffset : 10)); },
      seekforward: function (d) { seekBy(d && d.seekOffset ? d.seekOffset : 10); },
      seekto: function (d) { if (d && d.seekTime !== undefined) seekTo(d.seekTime); }
    };
    for (var k in handlers) if (handlers.hasOwnProperty(k)) {
      try { navigator.mediaSession.setActionHandler(k, handlers[k]); } catch (e) { }
    }
  }

  var smtc = null;
  var smtcWired = false;
  var smtcKey = "";

  function nativeMediaControls() {
    if (smtc) return smtc;
    if (!window.Windows || !Windows.Media || !Windows.Media.SystemMediaTransportControls) return null;
    try {
      smtc = Windows.Media.SystemMediaTransportControls.getForCurrentView();
      if (!smtc) return null;
      try {
        smtc.isEnabled = true;
        smtc.isPlayEnabled = true;
        smtc.isPauseEnabled = true;
        smtc.isStopEnabled = false;
        smtc.isNextEnabled = true;
        smtc.isPreviousEnabled = true;
      } catch (e) { }
    } catch (e2) { smtc = null; }
    return smtc;
  }

  function wireNativeMedia() {
    var c = nativeMediaControls();
    if (!c || smtcWired) return;
    try {
      c.addEventListener("buttonpressed", function (args) {
        var B = Windows.Media.SystemMediaTransportControlsButton;
        var b = args && args.button;
        if (b === B.play) play();
        else if (b === B.pause || b === B.stop) pause();
        else if (b === B.next) next();
        else if (b === B.previous) prev();
        else return;
        if (args) args.handled = true;
      });
      smtcWired = true;
    } catch (e) { }
  }

  function updateNativeMedia() {
    var c = nativeMediaControls();
    if (!c) return;
    try {
      var t = au.track;
      var key = (t ? [t.id, t.title, t.artist, t.album, t.albumArtist].join("|") : "") +
        "|" + (isPlaying() ? "playing" : "paused");
      if (key === smtcKey) return;
      if (t) {
        var du = c.displayUpdater;
        if (du) {
          try { du.type = Windows.Media.MediaPlaybackType.music; } catch (e) { }
          var mp = du.musicProperties;
          if (mp) {
            mp.title = t.title || t.name || "";
            mp.artist = t.artist || "";
            mp.albumTitle = t.album || "";
            mp.albumArtist = t.albumArtist || t.artist || "";
          }
          du.update();
        }
      }
      c.playbackStatus = isPlaying() ?
        Windows.Media.MediaPlaybackStatus.playing :
        Windows.Media.MediaPlaybackStatus.paused;
      smtcKey = key;
    } catch (e2) { }
  }

  /* ---------------------------------------------------------------- events */

  function tick(el, deckIndex) {
    if (deckIndex !== au.active) return;
    transport();
    maybeCrossfade(el);
    if (au.sleepEnd && el.duration && el.currentTime >= el.duration - 0.35) {
      au.sleepEnd = false;
      fadeOutAndPause();
    }
    if (now() - au.lastFadeCheck > 4000) {
      au.lastFadeCheck = now();
      updateMediaSession();
    }
  }

  function onEnded(deckIndex) {
    if (deckIndex !== au.active || au.fading) return;
    if (au.sleepEnd) {
      au.sleepEnd = false;
      stopAll();
      transport();
      toast("Sleep timer: playback stopped");
      return;
    }
    if (S.set.repeat === "one") {
      var el = activeDeck().el;
      try { el.currentTime = 0; } catch (e) { }
      var p = el.play();
      if (p && p.catch) p.catch(function () { });
      return;
    }
    var i = nextIndex(true);
    if (i < 0) {
      transport();
      toast("End of queue");
      return;
    }
    au.index = i;
    playCurrent();
  }

  function wireDecks() {
    decks[0].el = $("deckA");
    decks[1].el = $("deckB");
    for (var i = 0; i < 2; i++) {
      (function (idx) {
        var el = decks[idx].el;
        if (!el) return;
        el.preload = "auto";
        el.addEventListener("timeupdate", function () { tick(el, idx); }, false);
        el.addEventListener("ended", function () { onEnded(idx); }, false);
        el.addEventListener("play", function () { transport(); updateMediaSession(); }, false);
        el.addEventListener("pause", function () { transport(); updateMediaSession(); }, false);
        el.addEventListener("waiting", function () { if (idx === au.active) transport(); }, false);
        el.addEventListener("canplay", function () { if (idx === au.active) transport(); }, false);
        el.addEventListener("loadedmetadata", function () {
          if (idx !== au.active) return;
          var t = au.track;
          if (t && (!t.duration || !isFinite(t.duration)) && isFinite(el.duration) && el.duration > 0) {
            t.duration = el.duration;
            A.saveLibSoon();
            if (A.refreshPlayback) A.refreshPlayback();
          }
          transport();
        }, false);
        el.addEventListener("error", function () {
          if (idx !== au.active) return;
          var t = au.track;
          toast("Cannot play \u201c" + (t ? (t.title || t.name) : "track") + "\u201d \u2014 unsupported or damaged file");
          transport();
        }, false);
      })(i);
    }
  }

  /* ------------------------------------------------------------------- api */

  function analyserData() {
    if (!au.graph || !au.analyser) return null;
    try {
      au.analyser.getByteFrequencyData(au.freq);
      return au.freq;
    } catch (e) { return null; }
  }

  function eqAvailable() { return !au.eqBroken; }

  A.position = function () {
    var el = activeDeck().el;
    var dur = el && isFinite(el.duration) && el.duration > 0 ? el.duration : (au.track ? (au.track.duration || 0) : 0);
    return { pos: el ? (el.currentTime || 0) : 0, dur: dur };
  };
  A.reapply = function () { applyEQ(); applyVolume(); };
  A.resumeAudio = function () {
    if (!au.ctx || au.ctx.state !== "suspended") return;
    try {
      var p = au.ctx.resume();
      if (p && p.catch) p.catch(function () { });
    } catch (e) { }
  };
  A.playContext = playContext;
  A.toggle = toggle;
  A.play = play;
  A.pause = pause;
  A.next = next;
  A.prev = prev;
  A.advance = advance;
  A.seekRatio = seekRatio;
  A.seekTo = seekTo;
  A.seekBy = seekBy;
  A.isPlaying = isPlaying;
  A.currentTrack = currentTrack;
  A.currentId = currentId;
  A.idsOf = idsOf;
  A.setVolume = setVolume;
  A.toggleMute = toggleMute;
  A.toggleShuffle = toggleShuffle;
  A.cycleRepeat = cycleRepeat;
  A.setEQBand = setEQBand;
  A.setPreamp = setPreamp;
  A.setPreset = setPreset;
  A.resetEQ = resetEQ;
  A.savePreset = savePreset;
  A.deletePreset = deletePreset;
  A.presetNames = presetNames;
  A.EQ_PRESETS = PRESETS;
  A.EQ_FREQS = FREQS;
  A.EQ_LABELS = FREQ_LABEL;
  A.eqAvailable = eqAvailable;
  A.analyserData = analyserData;
  A.addNext = addNext;
  A.addLast = addLast;
  A.queueRemove = queueRemove;
  A.queueMove = queueMove;
  A.queueClear = queueClear;
  A.queuePlay = queuePlay;
  A.queueDrop = queueDrop;
  A.upcoming = upcoming;
  A.sleepSet = sleepSet;
  A.sleepClear = clearSleep;
  A.sleepAt = function () { return au.sleepAt; };
  A.updateMediaSession = updateMediaSession;
  A.audioQueue = function () { return { queue: au.queue, index: au.index, label: au.label }; };

  A.initAudio = function () {
    wireDecks();
    initGraph();
    wireMediaSession();
    wireNativeMedia();
    restoreQueue();
    applyVolume();
  };

  A.audioState = function () {
    return {
      graph: au.graph,
      eqBroken: au.eqBroken,
      label: au.label,
      active: au.active,
      fading: au.fading,
      eqBypassed: au.eqBypassed,
      context: au.ctx ? au.ctx.state : "none"
    };
  };
})();
