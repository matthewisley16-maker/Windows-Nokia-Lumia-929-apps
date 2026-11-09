/* MP3Lumia — core: helpers, icons, state, storage, the Windows Runtime platform
   layer and the album-art cache. Concatenated with the other src/js modules into
   a single app.js by tools\pack-app.ps1.

   Written in ES5 on purpose: the installed app runs on the Lumia's EdgeHTML
   engine, which has no arrow functions, template literals, CSS variables or
   grid. */
(function () {
  "use strict";

  var VERSION = "1.0.0.0";
  var LS_LIB = "mp3lumia.library.v1";
  var LS_SET = "mp3lumia.settings.v1";
  var LS_PL = "mp3lumia.playlists.v1";
  var LS_ST = "mp3lumia.state.v1";
  var LS_Q = "mp3lumia.queue.v1";

  var AUDIO_EXT = ["mp3", "m4a", "m4b", "aac", "flac", "wav", "ogg", "oga", "opus",
                   "wma", "aif", "aiff", "alac", "amr", "weba", "mp2", "mpga"];

  var MIME = {
    mp3: "audio/mpeg", mp2: "audio/mpeg", mpga: "audio/mpeg",
    m4a: "audio/mp4", m4b: "audio/mp4", alac: "audio/mp4",
    aac: "audio/aac", flac: "audio/flac", wav: "audio/wav",
    ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg",
    wma: "audio/x-ms-wma", aif: "audio/aiff", aiff: "audio/aiff",
    amr: "audio/amr", weba: "audio/webm"
  };

  var ICONS = {
    home:     '<path d="M3 10.6L12 3l9 7.6V21h-6v-6H9v6H3z"/>',
    search:   '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>',
    library:  '<path d="M4 4v16M9 4v16"/><path d="M14.5 4.8l4.6 15.1"/>',
    gear:     '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>',
    play:     '<path d="M7.5 4.5l12 7.5-12 7.5z"/>',
    pause:    '<path d="M7.5 4.5h3.2v15H7.5zM13.3 4.5h3.2v15h-3.2z"/>',
    prev:     '<path d="M6 5v14"/><path d="M19 5.5L9 12l10 6.5z"/>',
    next:     '<path d="M18 5v14"/><path d="M5 5.5L15 12 5 18.5z"/>',
    shuffle:  '<path d="M4 6.5h3.2l9.6 11H20"/><path d="M4 17.5h3.2l9.6-11H20"/><path d="M17.2 3.4L20 6.5l-2.8 3.1M17.2 14.4L20 17.5l-2.8 3.1"/>',
    repeat:   '<path d="M4.5 9.5V8a2.5 2.5 0 0 1 2.5-2.5h11"/><path d="M15.6 3l3 3-3 3"/><path d="M19.5 14.5V16a2.5 2.5 0 0 1-2.5 2.5H6"/><path d="M8.4 21l-3-3 3-3"/>',
    heart:    '<path d="M12 20.3S4.5 15.6 4.5 10.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 3.2c0 5.2-7.5 9.9-7.5 9.9z"/>',
    queue:    '<path d="M4 7h11M4 12h11M4 17h7"/><path d="M18 11.5v7.2"/><circle cx="16.2" cy="19.4" r="1.9"/><path d="M18 11.5l3-1.2v4"/>',
    eq:       '<path d="M5 4v6M5 15v5M12 4v10M12 19v1M19 4v2M19 11v9"/><circle cx="5" cy="12.5" r="1.6"/><circle cx="12" cy="16.5" r="1.6"/><circle cx="19" cy="8.5" r="1.6"/>',
    lyrics:   '<path d="M4 4.5h16v12H9.5L5 20.5v-4H4z"/><path d="M8 8.5h8M8 12h5"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    more:     '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
    close:    '<path d="M6 6l12 12M18 6L6 18"/>',
    down:     '<path d="M5 9l7 7 7-7"/>',
    up:       '<path d="M19 15l-7-7-7 7"/>',
    trash:    '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    sort:     '<path d="M7 4v16M4 17l3 3 3-3"/><path d="M13 6h7M13 12h5M13 18h3"/>',
    check:    '<path d="M4.5 12.5l5 5 10-11"/>',
    volume:   '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4"/><path d="M18 6.5a8 8 0 0 1 0 11"/>',
    mute:     '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    music:    '<path d="M9 18.2V5.5l10-2v12.2"/><circle cx="6.6" cy="19" r="2.6"/><circle cx="16.6" cy="17.5" r="2.6"/>',
    folder:   '<path d="M3 7.5h6l2 2h10v9.5H3z"/>',
    clock:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
    theme:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    spark:    '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
    file:     '<path d="M6 3h7l5 5v13H6z"/><path d="M13 3v5h5"/>'
  };

  var GENRES = ["Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge",
    "Hip-Hop", "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap",
    "Reggae", "Rock", "Techno", "Industrial", "Alternative", "Ska", "Death Metal",
    "Pranks", "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk",
    "Fusion", "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip",
    "Gospel", "Noise", "Alternative Rock", "Bass", "Soul", "Punk", "Space", "Meditative",
    "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic", "Darkwave",
    "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream", "Southern Rock",
    "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk", "Jungle",
    "Native American", "Cabaret", "New Wave", "Psychedelic", "Rave", "Showtunes",
    "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro",
    "Musical", "Rock & Roll", "Hard Rock"];

  /* ---------------------------------------------------------------- helpers */

  function $(id) { return document.getElementById(id); }

  function $$(sel, root) {
    var out = [], list = (root || document).querySelectorAll(sel), i;
    for (i = 0; i < list.length; i++) out.push(list[i]);
    return out;
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() { return new Date().getTime(); }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? h + ":" + pad2(m) + ":" + pad2(s) : m + ":" + pad2(s);
  }

  function fmtDur(sec) {
    if (!isFinite(sec) || sec <= 0) return "";
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h) return h + " hr " + (m < 10 ? "0" + m : m) + " min";
    return (m || 1) + " min";
  }

  function fmtTotal(sec) {
    if (!isFinite(sec) || sec <= 0) return "0 min";
    var m = Math.round(sec / 60);
    if (m < 60) return (m || 1) + " min";
    var h = Math.floor(m / 60);
    return h + " hr " + (m % 60) + " min";
  }

  function fmtSize(b) {
    if (!b) return "";
    var u = ["B", "KB", "MB", "GB"], i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 || n >= 10 ? Math.round(n) : n.toFixed(1)) + " " + u[i];
  }

  function fmtDate(ms) {
    if (!ms) return "";
    var d = new Date(ms), t = new Date();
    var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var s = m[d.getMonth()] + " " + d.getDate();
    if (d.getFullYear() !== t.getFullYear()) s += ", " + d.getFullYear();
    return s;
  }

  function hashStr(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  function extOf(name) {
    var i = String(name || "").lastIndexOf(".");
    return i > 0 ? String(name).slice(i + 1).toLowerCase() : "";
  }

  function baseOf(name) {
    var s = String(name || ""), i = s.lastIndexOf(".");
    return i > 0 ? s.slice(0, i) : s;
  }

  function folderOf(path) {
    var p = String(path || "").replace(/\//g, "\\");
    var i = p.lastIndexOf("\\");
    return i > 0 ? p.slice(0, i) : "";
  }

  function folderName(path) {
    var f = folderOf(path);
    if (!f) return "";
    var parts = f.split("\\");
    return parts[parts.length - 1] || f;
  }

  function normText(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/\u0000/g, "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function cleanName(name) {
    var s = baseOf(name);
    s = s.replace(/[_]+/g, " ");
    s = s.replace(/^\s*\d{1,3}\s*[-.)]\s+/, "");
    s = s.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    return s;
  }

  function isAudio(name) {
    return AUDIO_EXT.indexOf(extOf(name)) >= 0;
  }

  function mimeFor(ext) { return MIME[ext] || "audio/mpeg"; }

  function byId(id) {
    for (var i = 0; i < S.lib.length; i++) if (S.lib[i].id === id) return S.lib[i];
    return null;
  }

  function icon(name, cls) {
    return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' +
           (ICONS[name] || "") + "</svg>";
  }

  function decodeEntities(s) { return s; }

  function genreName(raw) {
    var s = normText(raw);
    if (!s) return "";
    if (/^\(?\d+\)?$/.test(s)) {
      var i = parseInt(s.replace(/[^\d]/g, ""), 10);
      return GENRES[i] || s;
    }
    return s;
  }

  function firstGenre(g) {
    if (!g) return "";
    if (typeof g === "string") return genreName(g.split(/[;\/]/)[0]);
    if (g.length) return genreName(String(g[0]));
    return "";
  }

  /* ---------------------------------------------------------------- storage */

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  var DEFAULTS = {
    theme: "default",
    volume: 0.8,
    muted: false,
    shuffle: false,
    repeat: "off",
    crossfade: 0,
    normalize: true,
    limiter: true,
    eqOn: true,
    eqPreset: "Flat",
    eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    eqCustom: {},
    sortSongs: "title",
    sleepMinutes: 0,
    visualizer: false,
    showAlbumArt: true
  };

  var S = {
    lib: [],
    set: {},
    playlists: [],
    likes: [],
    history: [],
    counts: {},
    route: { name: "home" },
    lists: {},
    demo: false,
    ready: false
  };

  var saveLibTimer = null;

  function loadSettings() {
    var raw = loadJson(LS_SET, {});
    var out = {}, k;
    for (k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) out[k] = DEFAULTS[k];
    for (k in raw) if (raw.hasOwnProperty(k) && out.hasOwnProperty(k)) out[k] = raw[k];
    if (!out.eq || out.eq.length !== 10) out.eq = DEFAULTS.eq.slice(0);
    for (k = 0; k < 10; k++) out.eq[k] = clamp(parseFloat(out.eq[k]) || 0, -12, 12);
    out.preamp = clamp(parseFloat(out.preamp) || 0, -12, 12);
    out.volume = clamp(parseFloat(out.volume), 0, 1);
    if (!isFinite(out.volume)) out.volume = DEFAULTS.volume;
    out.crossfade = clamp(parseInt(out.crossfade, 10) || 0, 0, 12);
    if (!out.eqPreset) out.eqPreset = "Flat";
    if (["off", "all", "one"].indexOf(out.repeat) < 0) out.repeat = "off";
    if (!out.eqCustom || typeof out.eqCustom !== "object") out.eqCustom = {};
    S.set = out;
  }

  function saveSettings() { saveJson(LS_SET, S.set); }

  function loadLib() {
    var raw = loadJson(LS_LIB, []);
    if (!raw || !raw.length) { S.lib = []; return; }
    var out = [], i, t;
    for (i = 0; i < raw.length; i++) {
      t = raw[i];
      if (!t || !t.id) continue;
      t.title = normText(t.title) || cleanName(t.name);
      t.artist = normText(t.artist) || "Unknown Artist";
      t.album = normText(t.album) || folderName(t.path) || "Unknown Album";
      t.albumArtist = normText(t.albumArtist) || t.artist;
      t.genre = normText(t.genre);
      t.duration = isFinite(t.duration) ? t.duration : 0;
      t.dateAdded = t.dateAdded || now();
      out.push(t);
    }
    S.lib = out;
  }

  function saveLib() {
    saveJson(LS_LIB, S.lib);
  }

  function saveLibSoon() {
    if (saveLibTimer) clearTimeout(saveLibTimer);
    saveLibTimer = setTimeout(function () { saveLibTimer = null; saveLib(); }, 700);
  }

  function loadPlaylists() {
    var raw = loadJson(LS_PL, []);
    S.playlists = [];
    if (raw && raw.length) {
      for (var i = 0; i < raw.length; i++) {
        var p = raw[i];
        if (!p || !p.id) continue;
        S.playlists.push({
          id: p.id,
          name: normText(p.name) || "Playlist",
          tracks: p.tracks instanceof Array ? p.tracks : [],
          created: p.created || now(),
          updated: p.updated || now()
        });
      }
    }
  }

  function savePlaylists() { saveJson(LS_PL, S.playlists); }

  function loadState() {
    var raw = loadJson(LS_ST, {});
    S.likes = raw.likes instanceof Array ? raw.likes : [];
    S.history = raw.recent instanceof Array ? raw.recent : [];
    S.counts = raw.counts && typeof raw.counts === "object" ? raw.counts : {};
  }

  function saveState() {
    saveJson(LS_ST, { likes: S.likes, recent: S.history, counts: S.counts });
  }

  /* --------------------------------------------------------------- platform */

  var P = { winrt: false, engine: "browser" };

  try {
    P.winrt = !!(window.Windows && Windows.Storage && Windows.Storage.Pickers &&
                 Windows.Storage.Pickers.FileOpenPicker);
  } catch (e) { P.winrt = false; }

  if (P.winrt) {
    try {
      if (window.MSApp && MSApp.createBlobFromRandomAccessStream) P.engine = "EdgeHTML + Windows Runtime";
      else P.engine = "EdgeHTML";
    } catch (e2) { P.engine = "EdgeHTML"; }
  } else {
    P.engine = navigator.userAgent.indexOf("Chrome") >= 0 ? "Chromium (preview)" : "browser";
  }

  function toArray(list) {
    var out = [], i;
    for (i = 0; i < (list ? list.length : 0); i++) out.push(list[i]);
    return out;
  }

  var files = {};          // id -> File | StorageFile
  var tokens = {};         // id -> true when in FutureAccessList

  function rawFile(id) { return files[id] || null; }

  function guessTypeOf(ref) {
    if (!ref) return null;
    if (ref.file && ref.file.name) return ref;
    if (ref.name && (ref.slice || ref.path || ref.getFileAsync)) return ref;
    return null;
  }

  function tokenFor(id, file) {
    try {
      Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList
        .addOrReplace(id, file);
      tokens[id] = true;
      return true;
    } catch (e) { return false; }
  }

  function dropToken(id) {
    try {
      Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList.remove(id);
    } catch (e) { }
    delete tokens[id];
  }

  function getFile(track) {
    if (!track) return Promise.resolve(null);
    if (files[track.id]) return Promise.resolve(files[track.id]);
    if (!P.winrt) return Promise.resolve(null);
    var fa = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
    return new Promise(function (resolve) {
      var done = false;
      function ok(f) {
        if (done) return;
        done = true;
        if (f) files[track.id] = f;
        resolve(f || null);
      }
      try {
        fa.getItemAsync(track.id).then(function (f) {
          if (f) { ok(f); return; }
          if (track.path) {
            Windows.Storage.StorageFile.getFileFromPathAsync(track.path)
              .then(ok, function () { ok(null); });
          } else ok(null);
        }, function () {
          if (track.path) {
            Windows.Storage.StorageFile.getFileFromPathAsync(track.path)
              .then(ok, function () { ok(null); });
          } else ok(null);
        });
      } catch (e) { ok(null); }
    });
  }

  function pickFiles() {
    if (P.winrt) {
      return new Promise(function (resolve, reject) {
        try {
          var picker = new Windows.Storage.Pickers.FileOpenPicker();
          picker.viewMode = Windows.Storage.Pickers.PickerViewMode.list;
          try {
            picker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.musicLibrary;
          } catch (e) { }
          picker.commitButtonText = "Add to MP3Lumia";
          var types = [], i;
          for (i = 0; i < AUDIO_EXT.length; i++) types.push("." + AUDIO_EXT[i]);
          picker.fileTypeFilter.replaceAll(types);
          picker.pickMultipleFilesAsync().then(function (list) {
            resolve(list ? toArray(list) : []);
          }, function (err) { reject(err); });
        } catch (e) { reject(e); }
      });
    }
    return new Promise(function (resolve, reject) {
      var input = $("fileinput");
      if (!input) { reject(new Error("no input")); return; }
      var done = false;
      function finish(list) {
        if (done) return;
        done = true;
        input.removeEventListener("change", changed, false);
        try { input.value = ""; } catch (e) { }
        resolve(list || []);
      }
      function changed() {
        var out = [], fl = input.files, i;
        for (i = 0; fl && i < fl.length; i++) out.push(fl[i]);
        finish(out);
      }
      input.addEventListener("change", changed, false);
      try { input.value = ""; } catch (e) { }
      input.click();
    });
  }

  function winrtQueryFolder(folder) {
    return new Promise(function (resolve, reject) {
      if (!folder) { reject(new Error("folder not available")); return; }
      var opts = null;
      try {
        opts = new Windows.Storage.Search.QueryOptions(
          Windows.Storage.Search.CommonFileQuery.defaultQuery, []);
        opts.folderDepth = Windows.Storage.Search.FolderDepth.deep;
        opts.indexerOption = Windows.Storage.Search.IndexerOption.useIndexerWhenAvailable;
        var types = [], i;
        for (i = 0; i < AUDIO_EXT.length; i++) types.push("." + AUDIO_EXT[i]);
        opts.fileTypeFilter.replaceAll(types);
      } catch (e) { opts = null; }
      function done(list) { resolve(list ? toArray(list) : []); }
      try {
        if (opts) {
          folder.createFileQueryWithOptions(opts).getFilesAsync().then(done, function (err) {
            folder.getFilesAsync().then(done, function () { reject(err); });
          });
        } else folder.getFilesAsync().then(done, reject);
      } catch (e) { reject(e); }
    });
  }

  function pickFolder() {
    if (P.winrt) {
      return new Promise(function (resolve, reject) {
        try {
          var picker = new Windows.Storage.Pickers.FolderPicker();
          picker.fileTypeFilter.replaceAll(["*"]);
          try {
            picker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.musicLibrary;
          } catch (e) { }
          picker.commitButtonText = "Scan this folder";
          picker.pickSingleFolderAsync().then(function (folder) {
            if (!folder) { resolve([]); return; }
            winrtQueryFolder(folder).then(resolve, reject);
          }, reject);
        } catch (e) { reject(e); }
      });
    }
    return new Promise(function (resolve, reject) {
      var input = $("dirinput");
      if (!input) { reject(new Error("no input")); return; }
      var done = false;
      function finish(list) {
        if (done) return;
        done = true;
        input.removeEventListener("change", changed, false);
        try { input.value = ""; } catch (e) { }
        resolve(list || []);
      }
      function changed() {
        var out = [], fl = input.files, i;
        for (i = 0; fl && i < fl.length; i++) out.push(fl[i]);
        finish(out);
      }
      input.addEventListener("change", changed, false);
      try { input.value = ""; } catch (e) { }
      input.click();
    });
  }

  function scanMusicLibrary() {
    if (!P.winrt) return Promise.reject(new Error("Only available in the installed app"));
    try {
      return winrtQueryFolder(Windows.Storage.KnownFolders.musicLibrary);
    } catch (e) { return Promise.reject(e); }
  }

  function systemTheme() {
    if (P.winrt) {
      try {
        var ui = new Windows.UI.ViewManagement.UISettings();
        var c = ui.getColorValue(Windows.UI.ViewManagement.UIColorType.background);
        var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        return lum > 0.55 ? "light" : "dark";
      } catch (e) { }
    }
    try {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    } catch (e2) { }
    return "dark";
  }

  function applyTheme() {
    var mode = S.set.theme || "default";
    if (mode === "default") mode = systemTheme();
    var root = document.documentElement;
    root.className = root.className.replace(/\btheme-(dark|light)\b/g, "").replace(/\s+/g, " ");
    root.className = (root.className + " theme-" + mode).replace(/^\s+|\s+$/g, "");
    try {
      var meta = document.querySelector('meta[name="msapplication-navbutton-color"]');
      if (meta) meta.setAttribute("content", mode === "light" ? "#f4f4f7" : "#0a0a0d");
    } catch (e) { }
  }

  function watchSystemTheme() {
    if (P.winrt) {
      try {
        var ui = new Windows.UI.ViewManagement.UISettings();
        ui.addEventListener("colorvalueschanged", function () {
          if (S.set.theme === "default") { applyTheme(); paintSoon(); }
        });
      } catch (e) { }
      return;
    }
    try {
      if (!window.matchMedia) return;
      var mq = window.matchMedia("(prefers-color-scheme: light)");
      var handler = function () {
        if (S.set.theme === "default") { applyTheme(); paintSoon(); }
      };
      if (mq.addEventListener) mq.addEventListener("change", handler);
      else if (mq.addListener) mq.addListener(handler);
    } catch (e) { }
  }

  function cycleTheme() {
    var order = ["default", "dark", "light"];
    var i = order.indexOf(S.set.theme);
    S.set.theme = order[(i + 1) % order.length];
    saveSettings();
    applyTheme();
    paintSoon();
    toast("Theme: " + S.set.theme.charAt(0).toUpperCase() + S.set.theme.slice(1));
  }

  function deviceInfo() {
    var s = P.engine;
    if (P.winrt) {
      try {
        var v = Windows.System.Profile.AnalyticsInfo.versionInfo;
        if (v && v.deviceFamily) s += " \u00b7 " + String(v.deviceFamily).replace("Windows.", "");
      } catch (e) { }
    } else {
      s += " \u00b7 " + (navigator.userAgent.indexOf("Windows") >= 0 ? "Windows" : "device");
    }
    return s;
  }

  /* ------------------------------------------------------------- playable */

  var urls = {};

  function playableUrl(track) {
    if (!track) return Promise.reject(new Error("no track"));
    if (track.demo) return A.demoAudio ? A.demoAudio(track) : Promise.reject(new Error("no demo"));
    if (urls[track.id]) return Promise.resolve(urls[track.id]);

    var f = files[track.id];
    if (f && !P.winrt) {
      var u = URL.createObjectURL(f);
      urls[track.id] = u;
      return Promise.resolve(u);
    }

    return getFile(track).then(function (sf) {
      if (!sf) throw new Error("missing");
      if (!P.winrt) {
        var u2 = URL.createObjectURL(sf);
        urls[track.id] = u2;
        return u2;
      }
      return sf.openAsync(Windows.Storage.FileAccessMode.read).then(function (stream) {
        if (!window.MSApp || !MSApp.createBlobFromRandomAccessStream) throw new Error("no blob api");
        var blob = MSApp.createBlobFromRandomAccessStream(mimeFor(track.ext), stream);
        var u3 = URL.createObjectURL(blob);
        urls[track.id] = u3;
        return u3;
      });
    });
  }

  /* ------------------------------------------------------------------- art */

  var art = {};
  var artQueue = [];
  var artActive = 0;
  var artWait = {};

  function setArt(id, url) {
    if (!id || !url) return;
    art[id] = url;
    var nodes = document.querySelectorAll('[data-art="' + id + '"]'), i;
    for (i = 0; i < nodes.length; i++) {
      nodes[i].style.backgroundImage = 'url("' + url + '")';
      if (nodes[i].className.indexOf("hasart") < 0) nodes[i].className += " hasart";
      nodes[i].setAttribute("data-art-done", "1");
    }
    if (artWait[id]) { artWait[id] = null; }
  }

  function artFor(id) { return art[id] || null; }

  function queueArt() {
    var nodes = document.querySelectorAll("[data-art]"), i, id;
    for (i = 0; i < nodes.length; i++) {
      id = nodes[i].getAttribute("data-art");
      if (!id) continue;
      if (art[id]) {
        if (nodes[i].getAttribute("data-art-done") !== "1") setArt(id, art[id]);
        continue;
      }
      if (nodes[i].getAttribute("data-art-q") === "1") continue;
      nodes[i].setAttribute("data-art-q", "1");
      if (artQueue.indexOf(id) < 0) artQueue.push(id);
    }
    pumpArt();
  }

  function pumpArt() {
    var playing = A.isPlaying && A.isPlaying();
    var max = playing ? 1 : 3;
    while (artActive < max && artQueue.length) {
      (function (id) {
        artActive++;
        var t = byId(id);
        if (!t) { artActive--; return; }
        A.readArt(t).then(function (url) {
          if (url) setArt(id, url);
        }, function () { })["then"](function () {
          artActive--;
          if (A.isPlaying && A.isPlaying()) setTimeout(pumpArt, 80);
          else pumpArt();
        });
      })(artQueue.shift());
    }
  }

  /* ------------------------------------------------------------------ misc */

  var toastTimer = null;

  function toast(msg, ms) {
    var box = $("toast");
    if (!box) return;
    box.textContent = msg;
    box.className = "toast on";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = "toast"; }, ms || 2400);
  }

  var paintTimer = null;

  function paintSoon() {
    if (paintTimer) return;
    paintTimer = setTimeout(function () {
      paintTimer = null;
      if (A.paint) A.paint();
    }, 40);
  }

  function setView(name, param) {
    var isTab = (name === "home" || name === "search" || name === "library" || name === "settings");
    if (isTab) {
      S.stack = [];
    } else {
      S.stack = S.stack || [];
      S.stack.push({ name: S.route.name, param: S.route.param });
      if (S.stack.length > 12) S.stack.shift();
    }
    S.route = { name: name, param: param || null };
    paintSoon();
  }

  function back() {
    if (S.stack && S.stack.length) S.route = S.stack.pop();
    else S.route = { name: "home", param: null };
    paintSoon();
  }

  function registerList(key, ids, label) {
    S.lists[key] = { ids: ids.slice(0), label: label || "" };
    return key;
  }

  function listFor(key) { return S.lists[key] || null; }

  var A = {
    VERSION: VERSION,
    S: S,
    P: P,
    GENRES: GENRES,
    AUDIO_EXT: AUDIO_EXT,
    DEFAULTS: DEFAULTS,
    $: $, $$: $$, esc: esc, icon: icon, clamp: clamp, now: now,
    fmtTime: fmtTime, fmtDur: fmtDur, fmtTotal: fmtTotal, fmtSize: fmtSize, fmtDate: fmtDate,
    hashStr: hashStr, extOf: extOf, baseOf: baseOf, folderOf: folderOf,
    folderName: folderName, cleanName: cleanName, normText: normText, isAudio: isAudio,
    mimeFor: mimeFor, byId: byId, genreName: firstGenre, pad2: pad2,
    loadSettings: loadSettings, saveSettings: saveSettings,
    loadLib: loadLib, saveLib: saveLib, saveLibSoon: saveLibSoon,
    loadPlaylists: loadPlaylists, savePlaylists: savePlaylists,
    loadState: loadState, saveState: saveState,
    loadJson: loadJson, saveJson: saveJson,
    pickFiles: pickFiles, pickFolder: pickFolder, scanMusicLibrary: scanMusicLibrary,
    getFile: getFile, tokenFor: tokenFor, dropToken: dropToken, toArray: toArray,
    applyTheme: applyTheme, watchSystemTheme: watchSystemTheme, cycleTheme: cycleTheme,
    systemTheme: systemTheme, deviceInfo: deviceInfo,
    playableUrl: playableUrl, rawFile: rawFile,
    setArt: setArt, artFor: artFor, queueArt: queueArt,
    toast: toast, paintSoon: paintSoon, setView: setView, back: back,
    registerList: registerList, listFor: listFor,
    files: files, urls: urls, art: art,
    readArt: null,          // provided by 03-library.js
    demoAudio: null,        // provided by 06-app.js
    paint: null             // provided by 05-views.js
  };

  window.MP3 = A;
})();
