/* MP3Lumia — boot, actions, keyboard shortcuts, file import and the demo
   library. This is the last module: it wires the interface to the playback and
   library engines. */
(function () {
  "use strict";

  var A = window.MP3;
  var S = A.S;
  var $ = A.$, esc = A.esc, icon = A.icon, clamp = A.clamp;

  var pendingAdd = null;

  /* ------------------------------------------------------------- helpers */

  function actNode(node) {
    while (node && node !== document) {
      if (node.getAttribute && node.getAttribute("data-act")) return node;
      node = node.parentNode;
    }
    return null;
  }

  function data(el, name) { return el.getAttribute("data-" + name) || ""; }

  function playList(key, shuffle) {
    var l = A.listFor(key);
    if (!l || !l.ids.length) { A.toast("Nothing to play here"); return; }
    if (shuffle) {
      if (!S.set.shuffle) { S.set.shuffle = true; A.saveSettings(); }
      A.playContext(l.ids, Math.floor(Math.random() * l.ids.length), l.label);
    } else {
      A.playContext(l.ids, 0, l.label);
    }
    if (A.paintTransport) A.paintTransport();
  }

  function importRefs(refs) {
    if (!refs || !refs.length) return;
    if (S.demo) resetDemo();
    var res = A.addRefs(refs);
    if (!res.added.length) {
      A.toast(res.skipped ? "Already in your library" : "No audio files found");
      return;
    }
    A.toast("Adding " + res.added.length + (res.added.length === 1 ? " song" : " songs") + "\u2026");
    if (S.route.name !== "library") A.setView("library", null, true);
    setTimeout(function () {
      if (S.route.name === "library") A.render();
    }, 500);
  }

  function resetDemo() {
    S.demo = false;
    S.lib = [];
    S.likes = [];
    S.history = [];
    S.counts = {};
    S.playlists = [];
    A.saveLib();
    A.savePlaylists();
    A.saveState();
  }

  function addFiles() {
    A.pickFiles().then(importRefs, function (err) {
      A.toast("Could not open the file picker");
    });
  }

  function addFolder() {
    A.pickFolder().then(importRefs, function () {
      A.toast("Could not open that folder");
    });
  }

  function scanLibrary() {
    A.scanMusicLibrary().then(importRefs, function () {
      A.toast("The Music folder is only available in the installed app");
    });
  }

  function likeAll(list) {
    var i, added = 0;
    for (i = 0; i < list.length; i++) {
      if (!A.isLiked(list[i].id)) { A.toggleLike(list[i].id); added++; }
    }
    A.toast(added ? "Saved " + added + " songs" : "Already saved");
    A.render();
  }

  /* --------------------------------------------------------------- actions */

  function handle(act, el) {
    var id = data(el, "id");
    var key = data(el, "l");
    var i;

    switch (act) {
      case "tab":
        A.setView(data(el, "tab"));
        break;
      case "back":
        A.back();
        break;
      case "add-menu":
        A.showAddMenu();
        break;
      case "add-files":
        A.closeSheet();
        addFiles();
        break;
      case "add-folder":
        A.closeSheet();
        addFolder();
        break;
      case "scan-library":
        A.closeSheet();
        scanLibrary();
        break;
      case "demo":
        startDemo();
        break;
      case "clear-library":
        A.showConfirm("Clear library", "Remove every song, like and history entry from MP3Lumia? The audio files stay on the device.", "confirm-clear");
        break;
      case "confirm-clear":
        A.clearLibrary();
        A.closeSheet();
        A.setView("home");
        A.toast("Library cleared");
        break;
      case "tab-search":
        A.setView("search");
        break;
      case "lib-tab":
        A.setLibTab(data(el, "tab"));
        A.render();
        break;
      case "search-filter":
        A.setSearchFilter(data(el, "f"));
        A.refreshSearch();
        break;
      case "search-clear":
        A.clearSearch();
        break;
      case "play-tap": {
        var l = A.listFor(key);
        if (!l) break;
        A.playContext(l.ids, parseInt(data(el, "i"), 10) || 0, l.label);
        A.paintTransport();
        break;
      }
      case "play-list":
        playList(key, false);
        break;
      case "shuffle-list":
        playList(key, true);
        break;
      case "play-songs":
        playList("lib:songs", false);
        break;
      case "shuffle-songs":
        playList("lib:songs", true);
        break;
      case "open-album":
        A.closeSheet();
        A.setView("album", id);
        break;
      case "open-artist":
        A.closeSheet();
        A.setView("artist", id);
        break;
      case "open-playlist":
        A.closeSheet();
        A.setView("playlist", id);
        break;
      case "open-liked":
        A.closeSheet();
        A.setView("liked");
        break;
      case "open-genre":
        A.closeSheet();
        A.setView("genre", data(el, "name"));
        break;
      case "open-queue":
        A.showQueue();
        break;
      case "toggle":
        A.toggle();
        break;
      case "next":
        A.next();
        break;
      case "prev":
        A.prev();
        break;
      case "shuffle":
        A.toggleShuffle();
        break;
      case "repeat":
        A.cycleRepeat();
        break;
      case "mute":
        A.toggleMute();
        break;
      case "np-open":
        A.openNowPlaying();
        break;
      case "np-close":
        A.closeNowPlaying();
        break;
      case "np-artist":
        A.closeNowPlaying();
        if (A.artist(id)) A.setView("artist", id);
        else A.toast("Artist not found");
        break;
      case "np-album":
        A.closeNowPlaying();
        if (A.album(id)) A.setView("album", id);
        else A.toast("Album not found");
        break;
      case "like":
        var liked = A.toggleLike(id);
        A.toast(liked ? "Saved to Liked Songs" : "Removed from Liked Songs");
        A.refreshPlayback();
        A.render();
        if (A.sheetKind() === "track") A.showTrackMenu(id);
        break;
      case "track-menu":
        A.showTrackMenu(id);
        break;
      case "album-menu":
        A.showAlbumMenu(id);
        break;
      case "edit-track":
        A.showTrackMeta(id);
        break;
      case "edit-album":
        A.showAlbumMeta(id);
        break;
      case "save-track-meta":
        A.saveTrackMeta(id);
        break;
      case "save-album-meta":
        A.saveAlbumMeta(id);
        break;
      case "playlist-menu":
        A.showPlaylistMenu(id);
        break;
      case "add-next":
        A.addNext(id);
        A.closeSheet();
        break;
      case "add-queue":
        A.addLast(id);
        A.closeSheet();
        break;
      case "add-to-playlist":
        A.showAddToPlaylist(id);
        break;
      case "playlist-add":
        if (A.addToPlaylist(data(el, "pl"), data(el, "id"))) {
          A.toast("Added to playlist");
        } else {
          A.toast("Already in that playlist");
        }
        A.closeSheet();
        break;
      case "new-playlist":
        pendingAdd = data(el, "add") || null;
        if (!pendingAdd) {
          var sheet = el.getAttribute("data-act");
          if (sheet === "new-playlist") pendingAdd = null;
        }
        A.showNewPlaylist();
        break;
      case "create-playlist": {
        var input = $("plname");
        var name = input ? input.value : "";
        if (!name.replace(/\s/g, "")) { A.toast("Give the playlist a name"); break; }
        var editId = data(el, "edit");
        if (editId) {
          A.renamePlaylist(editId, name);
          A.toast("Playlist renamed");
          A.closeSheet();
          A.setView("playlist", editId);
        } else {
          var p = A.newPlaylist(name);
          if (pendingAdd) A.addToPlaylist(p.id, pendingAdd);
          pendingAdd = null;
          A.closeSheet();
          A.setView("playlist", p.id);
          A.toast("Playlist created");
        }
        A.render();
        break;
      }
      case "rename-playlist":
        A.showNewPlaylist(id);
        break;
      case "delete-playlist":
        A.showConfirm("Delete playlist", "Remove this playlist? The songs stay in your library.", "confirm-delete-playlist", ' data-id="' + id + '"');
        break;
      case "confirm-delete-playlist":
        A.deletePlaylist(data(el, "id"));
        A.closeSheet();
        A.setView("library");
        A.toast("Playlist deleted");
        break;
      case "playlist-play":
        playList("pl:" + id, false);
        A.closeSheet();
        break;
      case "like-album": {
        var al = A.album(id);
        if (al) likeAll(al.tracks);
        A.closeSheet();
        break;
      }
      case "like-artist": {
        var ar = A.artist(id);
        if (ar) likeAll(ar.tracks);
        A.closeSheet();
        break;
      }
      case "queue-album": {
        var alb = A.album(id);
        if (alb) {
          for (i = 0; i < alb.tracks.length; i++) A.addLast(alb.tracks[i].id);
          A.toast("Album added to queue");
        }
        A.closeSheet();
        break;
      }
      case "menu-album":
        A.closeSheet();
        A.setView("album", id);
        break;
      case "menu-artist":
        A.closeSheet();
        A.setView("artist", id);
        break;
      case "menu-track-album": {
        var t1 = A.byId(id);
        A.closeSheet();
        if (t1) A.setView("album", A.hashStr(t1.albumArtist.toLowerCase() + "|" + t1.album.toLowerCase()));
        break;
      }
      case "menu-track-artist": {
        var t2 = A.byId(id);
        A.closeSheet();
        if (t2 && A.groups) {
          for (i = 0; i < A.groups.artists.length; i++) {
            if (A.groups.artists[i].name === t2.artist) { A.setView("artist", A.groups.artists[i].id); break; }
          }
        }
        break;
      }
      case "remove-from-playlist":
        if (A.removeFromPlaylist(data(el, "pl"), id)) A.toast("Removed from playlist");
        A.closeSheet();
        A.render();
        break;
      case "remove-track":
        A.removeTrack(id);
        A.closeSheet();
        A.toast("Removed from library \u2014 the file is untouched");
        break;
      case "queue":
        A.showQueue();
        break;
      case "queue-play":
        A.queuePlay(parseInt(data(el, "i"), 10));
        break;
      case "queue-remove":
        A.queueRemove(parseInt(data(el, "i"), 10));
        break;
      case "queue-up":
        A.queueMove(parseInt(data(el, "i"), 10), -1);
        break;
      case "queue-down":
        A.queueMove(parseInt(data(el, "i"), 10), 1);
        break;
      case "queue-clear":
        A.queueClear();
        break;
      case "eq":
        A.showEQ();
        break;
      case "lyrics":
        A.showLyrics(id);
        break;
      case "eq-preset":
        A.setPreset(data(el, "name"));
        break;
      case "eq-del":
        A.deletePreset(data(el, "name"));
        A.showEQ();
        A.toast("Preset deleted");
        break;
      case "preamp":
        A.setPreamp((S.set.preamp || 0) + (parseFloat(data(el, "d")) || 0));
        break;
      case "eq-reset":
        A.resetEQ();
        break;
      case "eq-toggle":
        S.set.eqOn = !S.set.eqOn;
        A.saveSettings();
        A.reapply();
        A.showEQ();
        break;
      case "eq-save": {
        var eqname = $("eqname");
        if (eqname) {
          A.savePreset(eqname.value);
          A.showEQ();
        }
        break;
      }
      case "setting": {
        var k = data(el, "key");
        if (k === "normalize" || k === "limiter" || k === "visualizer") {
          S.set[k] = !S.set[k];
          A.saveSettings();
          A.reapply();
          A.render();
          if (k === "visualizer" && A.nowPlayingOpen()) A.viewNowPlaying();
        }
        break;
      }
      case "sleep":
        A.sleepSet(data(el, "min") === "end" ? "end" : parseInt(data(el, "min"), 10) || 0);
        A.render();
        break;
      case "theme-set":
        S.set.theme = data(el, "theme");
        A.saveSettings();
        A.applyTheme();
        A.render();
        break;
      case "theme-cycle":
        A.cycleTheme();
        break;
      case "sheet-close":
        A.closeSheet();
        break;
      case "sheet-keep":
        break;
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------- events */

  function bindEvents() {
    document.addEventListener("click", function (e) {
      var el = actNode(e.target);
      if (!el) return;
      var act = el.getAttribute("data-act");
      if (act === "sheet-keep") return;
      handle(act, el);
    }, false);

    document.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.id === "q") { A.onSearchInput(t.value); return; }
      if (t.getAttribute("data-eq") !== null) {
        A.setEQBand(parseInt(t.getAttribute("data-eq"), 10), t.value);
        return;
      }
      if (t.getAttribute("data-preamp") !== null) {
        A.setPreamp(t.value);
        return;
      }
      var act = t.getAttribute("data-act");
      if (act === "volume") {
        A.setVolume(parseInt(t.value, 10) / 100);
        return;
      }
      if (act === "crossfade") {
        S.set.crossfade = parseInt(t.value, 10) || 0;
        A.saveSettings();
        var v = $("cfval");
        if (v) v.textContent = S.set.crossfade ? S.set.crossfade + "s" : "Off";
      }
    }, false);

    document.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.id === "sortsongs") {
        S.set.sortSongs = t.value;
        A.saveSettings();
        A.render();
      }
    }, false);

    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName ? e.target.tagName : "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      var k = e.key || "";

      if (k === "Escape") {
        if (A.sheetKind()) A.closeSheet();
        else if (A.nowPlayingOpen()) A.closeNowPlaying();
        return;
      }
      if (k === " " || k === "Spacebar" || e.keyCode === 32) {
        if (A.sheetKind()) return;
        e.preventDefault();
        A.toggle();
        return;
      }
      if (k === "ArrowRight") { e.preventDefault(); A.seekBy(5); return; }
      if (k === "ArrowLeft") { e.preventDefault(); A.seekBy(-5); return; }
      if (k === "ArrowUp") {
        e.preventDefault();
        A.setVolume((S.set.volume || 0) + 0.05);
        return;
      }
      if (k === "ArrowDown") {
        e.preventDefault();
        A.setVolume((S.set.volume || 0) - 0.05);
        return;
      }
      if (k === "n" || k === "N") { A.next(); return; }
      if (k === "p" || k === "P") { A.prev(); return; }
      if (k === "s" || k === "S") { A.toggleShuffle(); return; }
      if (k === "r" || k === "R") { A.cycleRepeat(); return; }
      if (k === "m" || k === "M") { A.toggleMute(); return; }
      if (k === "/") { e.preventDefault(); A.setView("search"); setTimeout(function () { var q = $("q"); if (q) q.focus(); }, 120); }
    }, false);

    /* Drag and drop folders or files onto the window. */
    window.addEventListener("dragover", function (e) {
      e.preventDefault();
      try { e.dataTransfer.dropEffect = "copy"; } catch (err) { }
    }, false);

    window.addEventListener("drop", function (e) {
      e.preventDefault();
      var dt = e.dataTransfer;
      if (!dt) return;
      var items = dt.items, entries = [], i;
      if (items && items.length) {
        for (i = 0; i < items.length; i++) {
          if (items[i].kind !== "file") continue;
          if (items[i].webkitGetAsEntry) {
            var en = items[i].webkitGetAsEntry();
            if (en) entries.push(en);
          }
        }
      }
      if (entries.length && entries[0].isDirectory !== undefined) {
        walkEntries(entries).then(function (files) {
          importRefs(files);
        }, function () { A.toast("Could not read those files"); });
      } else if (dt.files) {
        var out = [];
        for (i = 0; i < dt.files.length; i++) out.push(dt.files[i]);
        importRefs(out);
      }
    }, false);

    window.addEventListener("beforeunload", function () {
      A.saveLib();
      A.saveState();
    }, false);

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { A.saveLib(); A.saveState(); }
      else if (A.resumeAudio) A.resumeAudio();
    }, false);
  }

  function walkEntries(entries) {
    var files = [];
    function readFile(fileEntry) {
      return new Promise(function (resolve) {
        fileEntry.file(function (f) { files.push(f); resolve(); }, function () { resolve(); });
      });
    }
    function readDir(dirEntry) {
      return new Promise(function (resolve) {
        var reader = dirEntry.createReader();
        var all = [];
        function batch() {
          reader.readEntries(function (list) {
            if (!list.length) {
              var chain = Promise.resolve();
              all.forEach(function (en) {
                chain = chain.then(function () {
                  if (en.isFile) return readFile(en);
                  if (en.isDirectory) return readDir(en);
                });
              });
              chain.then(resolve, resolve);
            } else {
              all = all.concat(A.toArray(list));
              batch();
            }
          }, function () { resolve(); });
        }
        batch();
      });
    }
    var chain = Promise.resolve();
    entries.forEach(function (en) {
      chain = chain.then(function () {
        if (en.isFile) return readFile(en);
        if (en.isDirectory) return readDir(en);
      });
    });
    return chain.then(function () { return files; });
  }

  /* ------------------------------------------------------------- demo data */

  var DEMO = [
    { name: "Neon Skyline", artist: "Aurora Lane", genre: "Synthwave", c1: "#1b2a5e", c2: "#081026",
      tracks: ["Neon Skyline", "Midnight Drive", "City Lights"] },
    { name: "Paper Planes", artist: "The Quiet Hours", genre: "Indie", c1: "#4a2a10", c2: "#160a04",
      tracks: ["Paper Planes", "Slow Motion", "Afterglow"] },
    { name: "Low Light", artist: "Kestrel", genre: "Ambient", c1: "#0d3a34", c2: "#03110f",
      tracks: ["Low Light", "Harbour", "Static"] },
    { name: "Golden Static", artist: "Aurora Lane", genre: "Synthwave", c1: "#5a3a06", c2: "#1a0f02",
      tracks: ["Golden Static", "Cassette", "Daybreak"] },
    { name: "Northbound", artist: "Mira Vale", genre: "Folk", c1: "#22304a", c2: "#080c14",
      tracks: ["Northbound", "Pine", "Riverbed"] }
  ];

  var demoArts = {};
  var demoUrls = {};

  function demoArt(al) {
    if (demoArts[al.name]) return demoArts[al.name];
    try {
      var c = document.createElement("canvas");
      c.width = 420; c.height = 420;
      var g = c.getContext("2d");
      var grad = g.createLinearGradient(0, 0, 420, 420);
      grad.addColorStop(0, al.c1);
      grad.addColorStop(1, al.c2);
      g.fillStyle = grad;
      g.fillRect(0, 0, 420, 420);

      var i;
      for (i = 0; i < 7; i++) {
        g.beginPath();
        g.arc(70 + i * 52, 120 + (i % 3) * 90, 78, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,255,255," + (0.03 + i * 0.008) + ")";
        g.fill();
      }
      g.strokeStyle = "rgba(255,255,255,0.26)";
      g.lineWidth = 2;
      for (i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(210, 210, 40 + i * 26, 0.6 + i, 2.2 + i);
        g.stroke();
      }
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.font = "700 26px 'Segoe UI', Arial, sans-serif";
      g.fillText(al.name.length > 18 ? al.name.slice(0, 18) + "\u2026" : al.name, 30, 348);
      g.font = "500 15px 'Segoe UI', Arial, sans-serif";
      g.fillStyle = "rgba(255,255,255,0.62)";
      g.fillText(al.artist, 30, 374);
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.font = "600 11px 'Segoe UI', Arial, sans-serif";
      g.fillText("MP3LUMIA DEMO", 30, 42);

      var url = c.toDataURL("image/jpeg", 0.86);
      demoArts[al.name] = url;
      return url;
    } catch (e) { return null; }
  }

  function demoWav(track) {
    if (demoUrls[track.id]) return demoUrls[track.id];
    var sr = 22050;
    var dur = track.duration || 20;
    var n = Math.floor(sr * dur);
    var samples = new Float32Array(n);
    var seed = parseInt(A.hashStr(track.id), 36) % 4;
    var PROG = [
      [220.00, 277.18, 329.63],
      [174.61, 220.00, 261.63],
      [130.81, 164.81, 196.00],
      [196.00, 246.94, 293.66]
    ];
    var i, t, bar, chord, k, s, stepT, mel, noise, fade;

    for (i = 0; i < n; i++) {
      t = i / sr;
      bar = Math.floor(t / 4);
      chord = PROG[(seed + bar) % PROG.length];
      s = 0;
      for (k = 0; k < 3; k++) s += Math.sin(2 * Math.PI * chord[k] * t + k * 0.7) * 0.15;
      s += Math.sin(2 * Math.PI * (chord[0] / 2) * t) * 0.20;
      stepT = t * 2 - Math.floor(t * 2);
      mel = chord[(Math.floor(t * 2) + 1) % 3] * 2;
      s += Math.sin(2 * Math.PI * mel * t) * 0.13 * Math.exp(-stepT * 4);
      noise = Math.sin(i * 12.9898) * 43758.5453;
      noise = noise - Math.floor(noise);
      s += (noise - 0.5) * 0.05 * Math.exp(-stepT * 18);
      fade = Math.min(1, t / 0.5, (dur - t) / 0.9);
      samples[i] = clamp(s * Math.max(0, fade) * 0.85, -0.97, 0.97);
    }

    var buffer = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buffer);
    function str(off, text) {
      var j;
      for (j = 0; j < text.length; j++) v.setUint8(off + j, text.charCodeAt(j));
    }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
    str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) v.setInt16(44 + i * 2, samples[i] * 32767, true);

    var url = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
    var p = Promise.resolve(url);
    demoUrls[track.id] = p;
    return p;
  }

  function startDemo() {
    resetDemo();
    S.demo = true;

    var i, j, k, al, art, id;
    var all = [];
    var day = 86400000;

    for (i = 0; i < DEMO.length; i++) {
      al = DEMO[i];
      art = demoArt(al);
      for (j = 0; j < al.tracks.length; j++) {
        id = "demo" + i + "-" + j;
        var dur = 20 + (j % 3) * 2;
        var t = {
          id: id,
          name: al.artist + " - " + al.tracks[j] + ".mp3",
          path: "Demo\\" + al.name + "\\" + al.tracks[j] + ".mp3",
          ext: "mp3",
          size: 4700000 + i * 250000 + j * 90000,
          dateAdded: A.now() - (i * 3 + j) * day,
          modified: A.now() - (i * 3 + j) * day,
          duration: dur,
          title: al.tracks[j],
          artist: al.artist,
          albumArtist: al.artist,
          album: al.name,
          genre: al.genre,
          year: 2024 - (i % 3),
          trackNo: j + 1,
          trackTotal: al.tracks.length,
          discNo: 1,
          composer: "",
          replayGain: 0,
          lastPlayed: 0,
          tagged: true,
          demo: true,
          art: art
        };
        all.push(t);
        S.lib.push(t);
      }
    }

    A.rebuildGroups();

    for (i = 0; i < all.length; i++) {
      if (i % 5 === 0) S.likes.push(all[i].id);
    }
    var order = [7, 3, 11, 0, 12, 5, 2];
    for (i = 0; i < order.length; i++) {
      S.history.push({ id: all[order[i] % all.length].id, at: A.now() - i * 3600000 });
      S.counts[all[order[i] % all.length].id] = 6 - i;
    }

    var p1 = A.newPlaylist("Late Night Drive");
    var picks = [0, 1, 2, 9, 10, 11];
    for (i = 0; i < picks.length; i++) A.addToPlaylist(p1.id, all[picks[i] % all.length].id);

    var p2 = A.newPlaylist("Focus");
    var picks2 = [6, 7, 8, 12, 13];
    for (i = 0; i < picks2.length; i++) A.addToPlaylist(p2.id, all[picks2[i] % all.length].id);

    A.saveLib();
    A.saveState();
    A.savePlaylists();
    A.setView("home");
    A.render();
    A.toast("Demo library \u2014 " + all.length + " sample tracks");
  }

  /* --------------------------------------------------------------- winrt */

  function initActivation() {
    if (!A.P.winrt) return;
    try {
      Windows.UI.WebUI.WebUIApplication.addEventListener("activated", function (args) {
        try {
          if (args && args.kind === Windows.ApplicationModel.Activation.ActivationKind.file &&
              args.files && args.files.length) {
            var refs = A.toArray(args.files);
            var res = A.addRefs(refs);
            if (res.added.length) {
              A.setView("library");
              A.playContext([res.added[0].id], 0, "Opened file");
            }
          }
        } catch (e) { }
      });
      Windows.UI.WebUI.WebUIApplication.addEventListener("suspending", function () {
        A.saveLib();
        A.saveState();
      });
    } catch (e) { }
  }

  /* ----------------------------------------------------------------- boot */

  function init() {
    A.loadSettings();
    A.loadLib();
    A.loadPlaylists();
    A.loadState();
    A.rebuildGroups();
    A.applyTheme();
    A.watchSystemTheme();

    A.paint = A.render;
    A.initAudio();
    A.render();
    bindEvents();
    initActivation();

    if (/[?&]demo\b/.test(location.search)) {
      setTimeout(startDemo, 80);
    }

    try { document.body.className += " booted"; } catch (e) { }
    window.MP3_READY = true;
    window.MP3Demo = startDemo;
    A.startDemo = startDemo;
    A.demoAudio = demoWav;
  }

  window.MP3_DEBUG = { startDemo: startDemo };

  init();
})();
