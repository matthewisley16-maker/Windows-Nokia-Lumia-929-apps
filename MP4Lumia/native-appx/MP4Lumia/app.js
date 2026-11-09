/* MP4Lumia 1.0.0.0 - built 2026-11-08 23:52 from src/js (01-core.js, 02-views.js, 03-player.js) */
/* MP4Lumia — Netflix-style video player for the Nokia Lumia 929 (Windows 10 Mobile).
   This file is the core: helpers, state, storage, Windows Runtime platform layer,
   library operations and the thumbnail queue. It is concatenated with the other
   src/js modules into a single app.js by tools\pack-app.ps1. */
(function () {
  "use strict";

  var VERSION = "1.0.0.0";
  var LS_LIB = "mp4lumia.library.v1";
  var LS_SET = "mp4lumia.settings.v1";

  var VIDEO_EXT = ["mp4", "m4v", "mov", "mkv", "avi", "wmv", "asf", "mpg", "mpeg",
                   "ts", "m2ts", "mts", "webm", "3gp", "3g2", "flv", "vob",
                   "divx", "ogv", "rm", "rmvb", "f4v"];

  var MIME = {
    mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime",
    mkv: "video/x-matroska", avi: "video/x-msvideo", wmv: "video/x-ms-wmv",
    asf: "video/x-ms-asf", mpg: "video/mpeg", mpeg: "video/mpeg",
    ts: "video/mp2t", m2ts: "video/mp2t", mts: "video/mp2t", webm: "video/webm",
    "3gp": "video/3gpp", "3g2": "video/3gpp2", flv: "video/x-flv",
    vob: "video/mpeg", divx: "video/x-msvideo", ogv: "video/ogg",
    rm: "application/vnd.rn-realmedia", rmvb: "application/vnd.rn-realmedia-vbr",
    f4v: "video/mp4"
  };

  var ICONS = {
    play:   '<path d="M8 5l11 7-11 7z"/>',
    pause:  '<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>',
    back:   '<path d="M15 4l-8 8 8 8"/>',
    home:   '<path d="M3 10.6L12 3l9 7.6V21h-6v-6H9v6H3z"/>',
    grid:   '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    heart:  '<path d="M12 20.3S4.5 15.6 4.5 10.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 3.2c0 5.2-7.5 9.9-7.5 9.9z"/>',
    gear:   '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>',
    theme:  '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    close:  '<path d="M6 6l12 12M18 6L6 18"/>',
    check:  '<path d="M4.5 12.5l5 5 10-11"/>',
    trash:  '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    fit:    '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    film:   '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M8 4.5v15M16 4.5v15M3 9.5h5M3 14.5h5M16 9.5h5M16 14.5h5"/>',
    folder: '<path d="M3 7.5h6l2 2h10v9.5H3z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4.5h-4.5"/>',
    info:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.6v.2"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    clock:  '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
    drive:  '<rect x="3" y="13" width="18" height="6" rx="2"/><path d="M5.5 16h.2M8.5 16h.2"/><path d="M6 13l1.6-6.4A2 2 0 0 1 9.5 5h5a2 2 0 0 1 1.9 1.6L18 13"/>'
  };

  function icon(name, cls) {
    return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' +
           (ICONS[name] || "") + "</svg>";
  }

  /* ---------------------------------------------------------------- helpers */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    if (h) return h + "h " + (m < 10 ? "0" + m : m) + "m";
    return (m || 1) + " min";
  }

  function fmtSize(b) {
    if (!b) return "";
    var u = ["B", "KB", "MB", "GB", "TB"], i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 || n >= 10 ? Math.round(n) : n.toFixed(1)) + " " + u[i];
  }

  function fmtDate(ms) {
    if (!ms) return "";
    var d = new Date(ms), t = new Date();
    var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
             "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var s = m[d.getMonth()] + " " + d.getDate();
    if (d.getFullYear() !== t.getFullYear()) s += ", " + d.getFullYear();
    return s;
  }

  function pct(pos, dur) {
    if (!dur || !isFinite(dur) || dur <= 0) return 0;
    return clamp(Math.round((pos / dur) * 100), 0, 100);
  }

  function resLabel(it) {
    if (!it.videoW || !it.videoH) return "";
    var h = Math.min(it.videoW, it.videoH);
    if (h >= 2000) return "4K";
    if (h >= 1000) return "1080p";
    if (h >= 700) return "720p";
    if (h >= 400) return "480p";
    return it.videoW + "\u00d7" + it.videoH;
  }

  function hashStr(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  function hasDot(name) { return name.lastIndexOf(".") > 0; }

  function extOf(name) {
    if (!hasDot(name)) return "";
    return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  }

  function baseOf(name) {
    return hasDot(name) ? name.slice(0, name.lastIndexOf(".")) : name;
  }

  function folderOf(path) {
    if (!path) return "";
    var p = path.replace(/\//g, "\\");
    var i = p.lastIndexOf("\\");
    return i > 0 ? p.slice(0, i) : "";
  }

  function folderName(path) {
    var f = folderOf(path);
    if (!f) return "";
    var parts = f.split("\\");
    return parts[parts.length - 1] || f;
  }

  function cleanTitle(name) {
    var s = baseOf(name);
    s = s.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
    s = s.replace(/\[[^\]]*\]/g, " ");
    s = s.replace(/\b(2160p|1080p|720p|480p|4k|uhd|hdr|hdrip|bdrip|brrip|dvdrip|webrip|web-dl|webdl|hdtv|x264|x265|h264|h265|hevc|avc|aac\d*|ac3|eac3|dts|dd5|10bit|8bit|proper|repack|extended|remux|yify|yts)\b/gi, " ");
    s = s.replace(/\s*-\s*$/, "").replace(/\s+/g, " ").trim();
    return s || baseOf(name);
  }

  function byName(a, b) {
    var x = (a.title || a.name || "").toLowerCase(), y = (b.title || b.name || "").toLowerCase();
    return x < y ? -1 : (x > y ? 1 : 0);
  }

  function isVideoName(name) {
    var e = extOf(name || "");
    if (!e) return false;
    for (var i = 0; i < VIDEO_EXT.length; i++) if (VIDEO_EXT[i] === e) return true;
    return false;
  }

  /* ------------------------------------------------------------ app state */

  var S = {
    lib: [],
    set: {
      theme: "default",     // default | dark | light
      resume: true,
      continueRow: true,
      speed: 1
    },
    view: "home",
    sort: "recent",
    filter: "all",
    q: "",
    currentId: null,
    playerId: null,
    demo: false
  };

  var thumbs = {};        // id -> image url (object url or data url)
  var urls = {};          // id -> playback object url
  var files = {};         // id -> File (browser builds only)
  var tokened = {};       // id -> true once the future-access token is stored
  var paintTimer = null;
  var saveLibTimer = null;

  function byId(id) {
    for (var i = 0; i < S.lib.length; i++) if (S.lib[i].id === id) return S.lib[i];
    return null;
  }

  /* -------------------------------------------------------------- storage */

  function loadLib() {
    var raw = null;
    try { raw = localStorage.getItem(LS_LIB); } catch (e) { raw = null; }
    if (!raw) return;
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || !parsed.length) return;
    for (var i = 0; i < parsed.length; i++) {
      var it = parsed[i];
      if (!it || !it.id) continue;
      it.position = Number(it.position) || 0;
      it.duration = Number(it.duration) || 0;
      it.size = Number(it.size) || 0;
      it.videoW = Number(it.videoW) || 0;
      it.videoH = Number(it.videoH) || 0;
      it.watched = !!it.watched;
      it.fav = !!it.fav;
      it.dateAdded = Number(it.dateAdded) || now();
      it.lastOpened = Number(it.lastOpened) || 0;
      S.lib.push(it);
    }
  }

  function saveLib() {
    if (S.demo) return;
    var out = [];
    for (var i = 0; i < S.lib.length; i++) {
      var it = S.lib[i], copy = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) copy[k] = it[k];
      out.push(copy);
    }
    try { localStorage.setItem(LS_LIB, JSON.stringify(out)); } catch (e) { /* full or blocked */ }
  }

  function saveLibSoon() {
    if (saveLibTimer) return;
    saveLibTimer = setTimeout(function () { saveLibTimer = null; saveLib(); }, 900);
  }

  function loadSettings() {
    var raw = null;
    try { raw = localStorage.getItem(LS_SET); } catch (e) { raw = null; }
    if (!raw) return;
    var p = null;
    try { p = JSON.parse(raw); } catch (e) { p = null; }
    if (!p) return;
    if (p.theme === "dark" || p.theme === "light" || p.theme === "default") S.set.theme = p.theme;
    if (typeof p.resume === "boolean") S.set.resume = p.resume;
    if (typeof p.continueRow === "boolean") S.set.continueRow = p.continueRow;
    if (isFinite(p.speed) && p.speed > 0) S.set.speed = p.speed;
  }

  function saveSettings() {
    if (S.demo) return;
    try { localStorage.setItem(LS_SET, JSON.stringify(S.set)); } catch (e) { }
  }

  /* ------------------------------------------------------------- platform */

  var P = {
    winrt: false,
    engine: "browser"
  };

  try {
    P.winrt = !!(window.Windows && Windows.Storage && Windows.Storage.Pickers &&
                  Windows.Storage.Pickers.FileOpenPicker);
  } catch (e) { P.winrt = false; }

  if (P.winrt) {
    try {
      if (window.MSApp && MSApp.createBlobFromRandomAccessStream) P.engine = "EdgeHTML + Windows Runtime";
      else P.engine = "EdgeHTML";
    } catch (e) { P.engine = "EdgeHTML"; }
  } else {
    P.engine = navigator.userAgent.indexOf("Chrome") >= 0 ? "Chromium (preview)" : "browser";
  }

  function mimeFor(ext) { return MIME[ext] || "video/mp4"; }

  function currentFiles() {
    try { return Windows.Storage.KnownFolders.videosLibrary; } catch (e) { return null; }
  }

  function tokenFor(id, file) {
    try {
      Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList
        .addOrReplace(id, file);
      tokened[id] = true;
      return true;
    } catch (e) { return false; }
  }

  function dropToken(id) {
    try {
      Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList.remove(id);
    } catch (e) { }
    delete tokened[id];
  }

  function getFile(item) {
    if (files[item.id]) return Promise.resolve(files[item.id]);
    if (!P.winrt) return Promise.resolve(null);
    return new Promise(function (resolve) {
      try {
        Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList
          .getItemAsync(item.id)
          .then(function (file) {
            if (file) { files[item.id] = file; }
            resolve(file || null);
          }, function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }

  function pickFiles(useFolder) {
    if (P.winrt) {
      return new Promise(function (resolve, reject) {
        try {
          var picker = new Windows.Storage.Pickers.FileOpenPicker();
          picker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
          try {
            picker.suggestedStartLocation =
              Windows.Storage.Pickers.PickerLocationId.videosLibrary;
          } catch (e) { }
          picker.commitButtonText = "Add to MP4Lumia";
          var types = [];
          for (var i = 0; i < VIDEO_EXT.length; i++) types.push("." + VIDEO_EXT[i]);
          picker.fileTypeFilter.replaceAll(types);
          picker.pickMultipleFilesAsync().then(function (list) {
            resolve(list ? toArray(list) : []);
          }, function (err) { reject(err); });
        } catch (e) { reject(e); }
      });
    }
    return new Promise(function (resolve, reject) {
      var input = useFolder ? $("dirinput") : $("fileinput");
      if (!input) { reject(new Error("no input")); return; }
      var done = false;
      function finish(list) {
        if (done) return;
        done = true;
        input.removeEventListener("change", changed, false);
        input.value = "";
        resolve(list || []);
      }
      function changed() {
        var out = [];
        var fl = input.files;
        for (var i = 0; fl && i < fl.length; i++) out.push(fl[i]);
        finish(out);
      }
      input.addEventListener("change", changed, false);
      try { input.value = ""; } catch (e) { }
      input.click();
      setTimeout(function () { if (!done) { /* keep waiting: user may still pick */ } }, 200);
    });
  }

  function scanVideosFolder() {
    if (!P.winrt) return Promise.reject(new Error("Only available in the installed app"));
    return new Promise(function (resolve, reject) {
      var lib = currentFiles();
      if (!lib) { reject(new Error("Videos folder is not available")); return; }
      var opts = null;
      try {
        opts = new Windows.Storage.Search.QueryOptions(
          Windows.Storage.Search.CommonFileQuery.defaultQuery, [".mp4"]);
        opts.folderDepth = Windows.Storage.Search.FolderDepth.deep;
        opts.indexerOption = Windows.Storage.Search.IndexerOption.useIndexerWhenAvailable;
        var types = [];
        for (var i = 0; i < VIDEO_EXT.length; i++) types.push("." + VIDEO_EXT[i]);
        opts.fileTypeFilter.replaceAll(types);
      } catch (e) { opts = null; }
      function done(list) { resolve(list ? toArray(list) : []); }
      try {
        if (opts) {
          lib.createFileQueryWithOptions(opts).getFilesAsync().then(done, function (err) {
            // fall back to one level of folders
            lib.getFilesAsync().then(done, function () { reject(err); });
          });
        } else {
          lib.getFilesAsync().then(done, function (err) { reject(err); });
        }
      } catch (e) { reject(e); }
    });
  }

  function openExternal(item) {
    if (!P.winrt) { toast("Open in Movies & TV is only available on the phone"); return; }
    getFile(item).then(function (file) {
      if (!file) { toast("File is not available"); return; }
      try {
        Windows.System.Launcher.launchFileAsync(file).then(function (ok) {
          if (!ok) toast("No app found to open this file");
        }, function () { toast("Could not open this file"); });
      } catch (e) { toast("Could not open this file"); }
    });
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
      if (window.matchMedia) {
        if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
      }
    } catch (e) { }
    return "dark";
  }

  function watchSystemTheme() {
    if (P.winrt) {
      try {
        var ui = new Windows.UI.ViewManagement.UISettings();
        ui.addEventListener("colorvalueschanged", function () {
          if (S.set.theme === "default") { applyTheme(); schedulePaint(); }
        });
      } catch (e) { }
      return;
    }
    try {
      if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-color-scheme: light)");
        var handler = function () {
          if (S.set.theme === "default") { applyTheme(); schedulePaint(); }
        };
        if (mq.addEventListener) mq.addEventListener("change", handler);
        else if (mq.addListener) mq.addListener(handler);
      }
    } catch (e) { }
  }

  function toArray(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(list[i]);
    return out;
  }

  function deviceInfo() {
    if (!P.winrt) {
      return "Browser preview \u00b7 " + (navigator.userAgent || "").slice(0, 40);
    }
    var s = "Windows 10 Mobile";
    try {
      var v = Windows.System.Profile.AnalyticsInfo.versionInfo;
      if (v && v.deviceFamilyVersion) s += " " + v.deviceFamilyVersion;
      if (v && v.deviceFamily) s += " \u00b7 " + String(v.deviceFamily).replace("Windows.", "");
    } catch (e) { }
    return s;
  }

  /* --------------------------------------------------------------- library */

  function addFile(file, playNow) {
    if (!file) return null;
    var name = file.name || "video";
    if (!isVideoName(name)) {
      // still accept anything the picker handed us, but label it
    }
    var ext = extOf(name) || "vid";
    var size = 0;
    try { size = file.size || 0; } catch (e) { size = 0; }
    var path = "";
    try { path = file.path || ""; } catch (e) { path = ""; }
    var key = (path || name).toLowerCase() + "|" + size;

    for (var i = 0; i < S.lib.length; i++) {
      if (S.lib[i].key === key) return null;
    }

    var id = "v" + hashStr(key + "|" + S.lib.length);
    var modified = 0;
    try { modified = file.dateModified ? new Date(file.dateModified).getTime() : now(); }
    catch (e) { modified = now(); }

    var item = {
      id: id,
      key: key,
      name: name,
      title: cleanTitle(name),
      ext: ext,
      size: size,
      path: path,
      folder: folderName(path),
      dateAdded: now(),
      modified: modified,
      duration: 0,
      videoW: 0,
      videoH: 0,
      position: 0,
      lastOpened: 0,
      watched: false,
      fav: false,
      demo: false
    };

    if (P.winrt) tokenFor(id, file);
    else files[id] = file;

    S.lib.push(item);
    saveLibSoon();
    enqueueEnrich(item);
    queueThumbs();
    return item;
  }

  function addFiles(list, silent) {
    var added = [], i;
    for (i = 0; i < list.length; i++) {
      var it = addFile(list[i]);
      if (it) added.push(it);
    }
    if (added.length) {
      paint();
      if (!silent) {
        toast(added.length === 1 ? "Added \u201c" + (added[0].title || added[0].name) + "\u201d"
                                 : "Added " + added.length + " videos");
      }
    } else if (!silent) {
      toast("Those videos are already in your library");
    }
    return added;
  }

  function removeItem(id) {
    var item = byId(id);
    if (!item) return;
    if (P.winrt) dropToken(id);
    delete files[id];
    if (urls[id]) { try { URL.revokeObjectURL(urls[id]); } catch (e) { } delete urls[id]; }
    delete thumbs[id];
    for (var i = S.lib.length - 1; i >= 0; i--) if (S.lib[i].id === id) S.lib.splice(i, 1);
    if (S.currentId === id) S.currentId = null;
    saveLib();
    paint();
  }

  function clearLibrary() {
    if (P.winrt) { for (var i = 0; i < S.lib.length; i++) dropToken(S.lib[i].id); }
    for (var id in urls) { try { URL.revokeObjectURL(urls[id]); } catch (e) { } }
    urls = {}; files = {}; thumbs = {};
    S.lib = [];
    S.currentId = null;
    if (P.winrt) { try { localStorage.removeItem(LS_LIB); } catch (e) { } }
    saveLib();
    paint();
    toast("Library cleared");
  }

  /* ------------------------------------------------------------ enrichment */

  var enrichQueue = [];
  var enrichBusy = 0;

  function enqueueEnrich(item) {
    if (!item || (item.duration && item.videoW)) return;
    enrichQueue.push(item);
    pumpEnrich();
  }

  function pumpEnrich() {
    if (enrichBusy > 0 || !enrichQueue.length) return;
    var item = enrichQueue.shift();
    if (!item || (item.duration && item.videoW)) { pumpEnrich(); return; }
    enrichBusy++;
    (function (it) {
      readProps(it).then(function (props) {
        if (props) {
          if (props.duration) it.duration = props.duration;
          if (props.width) it.videoW = props.width;
          if (props.height) it.videoH = props.height;
          saveLibSoon();
          schedulePaint();
        }
      }, function () { }).then(function () {
        enrichBusy--;
        pumpEnrich();
      });
    })(item);
    // run a couple in parallel when there is a queue
    if (enrichQueue.length && enrichBusy < 2) setTimeout(pumpEnrich, 30);
  }

  function tsToSeconds(v) {
    if (typeof v !== "number" || !isFinite(v) || v <= 0) return 0;
    if (v > 10000000) return v / 10000000;   // 100ns ticks
    if (v > 60000) return v / 1000;          // milliseconds
    return v;                                 // already seconds
  }

  function readProps(item) {
    if (P.winrt) {
      return getFile(item).then(function (file) {
        if (!file) throw new Error("missing");
        return file.properties.getVideoPropertiesAsync().then(function (p) {
          return {
            duration: tsToSeconds(p.duration),
            width: p.width || 0,
            height: p.height || 0
          };
        });
      });
    }
    return new Promise(function (resolve, reject) {
      var file = files[item.id];
      if (!file) { reject(new Error("no file")); return; }
      var v = document.createElement("video");
      var localUrl = null;
      var done = false;
      function finish(props) {
        if (done) return;
        done = true;
        try { v.removeAttribute("src"); v.load(); } catch (e) { }
        if (localUrl) { try { URL.revokeObjectURL(localUrl); } catch (e) { } }
        resolve(props);
      }
      try { localUrl = URL.createObjectURL(file); } catch (e) { reject(e); return; }
      v.preload = "metadata";
      v.muted = true;
      v.addEventListener("loadedmetadata", function () {
        finish({ duration: isFinite(v.duration) ? v.duration : 0,
                 width: v.videoWidth || 0, height: v.videoHeight || 0 });
      }, false);
      v.addEventListener("error", function () { finish({ duration: 0, width: 0, height: 0 }); }, false);
      v.src = localUrl;
      setTimeout(function () { finish({ duration: 0, width: 0, height: 0 }); }, 8000);
    });
  }

  /* ------------------------------------------------------------ thumbnails */

  var thumbQueue = [];
  var thumbActive = 0;
  var THUMB_MAX = 3;

  function queueThumbs() {
    var nodes = document.querySelectorAll("[data-thumb]");
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].getAttribute("data-thumb");
      if (!id) continue;
      if (thumbs[id]) {
        if (nodes[i].style.backgroundImage.indexOf("url(") < 0 && nodes[i].getAttribute("data-done") !== "1") {
          nodes[i].style.backgroundImage = "url(" + thumbs[id] + ")";
          nodes[i].setAttribute("data-done", "1");
        }
        continue;
      }
      if (nodes[i].getAttribute("data-q") === "1") continue;
      nodes[i].setAttribute("data-q", "1");
      if (thumbQueue.indexOf(id) < 0) thumbQueue.push(id);
    }
    pumpThumbs();
  }

  function pumpThumbs() {
    while (thumbActive < THUMB_MAX && thumbQueue.length) {
      (function (id) {
        var item = byId(id);
        if (!item) { return; }
        thumbActive++;
        makeThumb(item).then(function (url) {
          if (url) {
            thumbs[id] = url;
            paintThumb(id);
          }
        }, function () { }).then(function () {
          thumbActive--;
          pumpThumbs();
        });
      })(thumbQueue.shift());
    }
  }

  function paintThumb(id) {
    var nodes = document.querySelectorAll('[data-thumb="' + id + '"]');
    for (var i = 0; i < nodes.length; i++) {
      if (!thumbs[id]) continue;
      nodes[i].style.backgroundImage = "url(" + thumbs[id] + ")";
      nodes[i].className += nodes[i].className.indexOf("hasthumb") < 0 ? " hasthumb" : "";
    }
  }

  function makeThumb(item) {
    if (item.demo) {
      var poster = window.MP4 && window.MP4.demoPoster ? window.MP4.demoPoster(item) : null;
      return poster ? Promise.resolve(poster) : Promise.reject(new Error("demo"));
    }
    if (P.winrt) {
      return getFile(item).then(function (file) {
        if (!file) throw new Error("missing");
        return file.getThumbnailAsync(
          Windows.Storage.FileProperties.ThumbnailMode.videosView, 480,
          Windows.Storage.FileProperties.ThumbnailOptions.useCurrentScale
        ).then(function (thumb) {
          if (!thumb) return null;
          var url = null;
          try {
            var blob = MSApp.createBlobFromRandomAccessStream(
              thumb.contentType || "image/jpeg", thumb);
            url = URL.createObjectURL(blob);
          } catch (e) { url = null; }
          return url;
        });
      });
    }
    var file = files[item.id];
    if (!file) return Promise.reject(new Error("no file"));
    return captureFrame(file);
  }

  function captureFrame(file) {
    return new Promise(function (resolve, reject) {
      var v = document.createElement("video");
      var src = null, settled = false;
      function end(err, data) {
        if (settled) return;
        settled = true;
        try { v.removeAttribute("src"); v.load(); } catch (e) { }
        if (src) { try { URL.revokeObjectURL(src); } catch (e) { } }
        if (data) resolve(data); else reject(err || new Error("thumb"));
      }
      try { src = URL.createObjectURL(file); } catch (e) { reject(e); return; }
      v.muted = true;
      v.preload = "auto";
      v.addEventListener("loadeddata", function () {
        try { v.currentTime = Math.min(3, Math.max(0.2, (v.duration || 4) * 0.2)); }
        catch (e) { }
      }, false);
      v.addEventListener("seeked", function () {
        try {
          var w = 320;
          var h = Math.max(90, Math.round(w * (v.videoHeight || 9) / (v.videoWidth || 16)));
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(v, 0, 0, w, h);
          end(null, c.toDataURL("image/jpeg", 0.72));
        } catch (e) { end(e); }
      }, false);
      v.addEventListener("error", function () { end(new Error("decode")); }, false);
      v.src = src;
      setTimeout(function () { end(new Error("timeout")); }, 8000);
    });
  }

  /* --------------------------------------------------------------- effects */

  var toastTimer = null;

  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 2600);
  }

  var confirmCb = null;

  function askConfirm(title, body, okLabel, cb) {
    var box = $("confirm");
    if (!box) { if (window.confirm(title + "\n" + body)) cb(); return; }
    $("confirmtitle").textContent = title;
    $("confirmbody").textContent = body;
    $("confirmok").textContent = okLabel || "OK";
    confirmCb = cb;
    box.className = "sheet open";
  }

  function closeConfirm() {
    var box = $("confirm");
    if (box) box.className = "sheet";
    confirmCb = null;
  }

  /* ---------------------------------------------------------------- paint */

  function schedulePaint() {
    if (paintTimer) return;
    paintTimer = setTimeout(function () {
      paintTimer = null;
      if ($("player").className.indexOf("open") >= 0) return;
      paint();
    }, 700);
  }

  function paint() {
    var A = window.MP4 || {};
    if (S.view === "home" && A.renderHome) A.renderHome();
    else if (S.view === "library" && A.paintLibraryGrid) A.paintLibraryGrid();
    else if (S.view === "list" && A.renderMyList) A.renderMyList();
    else if (S.view === "settings" && A.renderSettings) A.renderSettings();
    queueThumbs();
  }

  /* Everything below is used by the view and player modules. */
  var APP = {
    VERSION: VERSION,
    S: S,
    P: P,
    ICONS: ICONS,
    icon: icon, $: $, esc: esc, clamp: clamp, now: now, pad2: pad2,
    fmtTime: fmtTime, fmtDur: fmtDur, fmtSize: fmtSize, fmtDate: fmtDate,
    pct: pct, resLabel: resLabel, baseOf: baseOf, extOf: extOf,
    folderOf: folderOf, folderName: folderName, cleanTitle: cleanTitle,
    byName: byName, isVideoName: isVideoName, VIDEO_EXT: VIDEO_EXT,
    byId: byId, loadLib: loadLib, saveLib: saveLib, saveLibSoon: saveLibSoon,
    loadSettings: loadSettings, saveSettings: saveSettings,
    mimeFor: mimeFor, getFile: getFile, pickFiles: pickFiles,
    scanVideosFolder: scanVideosFolder, openExternal: openExternal,
    systemTheme: systemTheme, watchSystemTheme: watchSystemTheme,
    deviceInfo: deviceInfo, toArray: toArray,
    addFile: addFile, addFiles: addFiles, removeItem: removeItem,
    clearLibrary: clearLibrary, enqueueEnrich: enqueueEnrich,
    queueThumbs: queueThumbs, paintThumb: paintThumb, makeThumb: makeThumb,
    thumbs: thumbs, urls: urls, files: files,
    toast: toast, askConfirm: askConfirm, closeConfirm: closeConfirm,
    schedulePaint: schedulePaint, paint: paint,
    confirmCb: function () { return confirmCb; },
    clearConfirmCb: function () { confirmCb = null; },
    applyTheme: applyTheme
  };

  window.MP4 = APP;

  function applyTheme() {
    var mode = S.set.theme;
    var eff = mode === "default" ? systemTheme() : mode;
    var html = document.documentElement;
    html.className = "theme-" + eff;
    try {
      var meta = document.querySelector('meta[name="msapplication-navbutton-color"]');
      if (meta) meta.setAttribute("content", eff === "light" ? "#f2f2f5" : "#0b0b0f");
    } catch (e) { }
    var btn = $("themebtn");
    if (btn) btn.setAttribute("data-mode", mode);
  }
})();

/* MP4Lumia — views: home, library, my list, settings, detail sheet and actions. */
(function () {
  "use strict";

  var A = window.MP4;
  var S = A.S, P = A.P;
  var $ = A.$, esc = A.esc, icon = A.icon;
  var fmtTime = A.fmtTime, fmtDur = A.fmtDur, fmtSize = A.fmtSize, fmtDate = A.fmtDate;
  var pct = A.pct, resLabel = A.resLabel, byId = A.byId;

  /* --------------------------------------------------------------- helpers */

  function byDateDesc(a, b) { return (b.dateAdded || 0) - (a.dateAdded || 0); }
  function byOpenedDesc(a, b) { return (b.lastOpened || 0) - (a.lastOpened || 0); }
  function bySizeDesc(a, b) { return (b.size || 0) - (a.size || 0); }
  function byDurDesc(a, b) { return (b.duration || 0) - (a.duration || 0); }

  function metaLine(it) {
    var bits = [];
    if (it.ext) bits.push(it.ext.toUpperCase());
    var r = resLabel(it);
    if (r) bits.push(r);
    var d = fmtDur(it.duration);
    if (d) bits.push(d);
    if (it.size) bits.push(fmtSize(it.size));
    return bits.join(" \u00b7 ");
  }

  function tileSub(it) {
    var bits = [];
    var r = resLabel(it);
    if (r) bits.push(r);
    if (it.size) bits.push(fmtSize(it.size));
    if (it.watched) bits.push("Watched");
    else if (it.position > 5) bits.push(pct(it.position, it.duration) + "% watched");
    return bits.join(" \u00b7 ");
  }

  function thumbStyle(it) {
    return A.thumbs[it.id] ? ' style="background-image:url(' + A.thumbs[it.id] + ')"' : "";
  }

  function tile(it) {
    var p = pct(it.position, it.duration);
    var dur = fmtDur(it.duration);
    return '<div class="tile" data-act="open" data-id="' + esc(it.id) + '">' +
      '<div class="thumb' + (A.thumbs[it.id] ? " hasthumb" : "") + '" data-thumb="' + esc(it.id) + '"' + thumbStyle(it) + '>' +
        '<span class="badge">' + esc((it.ext || "vid").toUpperCase()) + '</span>' +
        (dur ? '<span class="dur">' + dur + '</span>' : '') +
        (it.watched ? '<span class="seen">' + icon("check") + '</span>' : '') +
        (p > 0 && !it.watched ? '<span class="pbar"><i style="width:' + p + '%"></i></span>' : '') +
      '</div>' +
      '<div class="tname">' + esc(it.title || it.name) + '</div>' +
      '<div class="tsub">' + esc(tileSub(it)) + '</div>' +
    '</div>';
  }

  function rowHtml(title, items, sub) {
    if (!items.length) return "";
    var html = '<div class="row"><div class="row-head"><span class="row-title">' + esc(title) + '</span>' +
               '<span class="row-count">' + (sub || items.length) + '</span></div>' +
               '<div class="strip">';
    for (var i = 0; i < items.length && i < 30; i++) html += tile(items[i]);
    return html + '</div></div>';
  }

  function heroHtml(it) {
    var isCont = it.position > 5 && !it.watched;
    var p = pct(it.position, it.duration);
    return '<div class="hero" data-thumb="' + esc(it.id) + '"' + thumbStyle(it) + '>' +
      '<div class="hero-scrim"></div>' +
      '<div class="hero-body">' +
        '<div class="hero-kicker">' + (isCont ? "Continue watching" : "Featured") + '</div>' +
        '<div class="hero-title">' + esc(it.title || it.name) + '</div>' +
        '<div class="hero-meta">' + esc(metaLine(it) || it.name) + '</div>' +
        (isCont ? '<div class="hero-prog"><span style="width:' + p + '%"></span></div>' : '') +
        '<div class="hero-actions">' +
          '<button class="btn btn-primary" data-act="play" data-id="' + esc(it.id) + '">' +
            icon(isCont ? "play" : "play", "ico-fill") +
            (isCont ? "Resume" : "Play") +
          '</button>' +
          '<button class="btn btn-ghost" data-act="open" data-id="' + esc(it.id) + '">' +
            icon("info") + 'More info' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function emptyState() {
    var html = '<div class="empty">' +
      '<div class="empty-art">' + icon("film") + '</div>' +
      '<div class="empty-title">Your library is empty</div>' +
      '<div class="empty-sub">MP4Lumia plays the videos already on your phone. Add files from storage, or scan the Videos folder.</div>' +
      '<button class="btn btn-primary wide" data-act="add">' + icon("plus") + 'Add videos</button>';
    if (P.winrt) {
      html += '<button class="btn btn-ghost wide" data-act="scan">' + icon("refresh") + 'Scan Videos folder</button>';
    } else {
      html += '<button class="btn btn-ghost wide" data-act="addfolder">' + icon("folder") + 'Add a folder</button>' +
              '<button class="btn btn-link" data-act="demo">Try the demo preview</button>';
    }
    html += '<div class="empty-note">MP4 \u00b7 MKV \u00b7 AVI \u00b7 WMV \u00b7 MOV \u00b7 TS \u00b7 3GP \u00b7 WebM</div>';
    return html + '</div>';
  }

  /* ------------------------------------------------------------------ home */

  function renderHome() {
    var v = $("view-home");
    if (!v) return;
    if (!S.lib.length) { v.innerHTML = emptyState(); return; }

    var cont = [], fav = [], all = S.lib.slice();
    for (var i = 0; i < S.lib.length; i++) {
      if (S.lib[i].position > 5 && !S.lib[i].watched) cont.push(S.lib[i]);
      if (S.lib[i].fav) fav.push(S.lib[i]);
    }
    cont.sort(byOpenedDesc);
    fav.sort(byNameSafe);
    all.sort(byNameSafe);
    var recent = S.lib.slice().sort(byDateDesc);

    var hero = cont[0] || recent[0];
    var html = hero ? heroHtml(hero) : "";
    if (S.set.continueRow) html += rowHtml("Continue watching", cont);
    html += rowHtml("My list", fav);
    html += rowHtml("Recently added", recent.slice(0, 12));
    html += rowHtml("All videos", all);
    html += '<div class="home-foot">' + S.lib.length + ' videos \u00b7 ' + fmtSize(totalSize()) + ' in your library</div>';
    v.innerHTML = html;
    A.queueThumbs();
  }

  function byNameSafe(a, b) { return A.byName(a, b); }

  function totalSize() {
    var n = 0;
    for (var i = 0; i < S.lib.length; i++) n += S.lib[i].size || 0;
    return n;
  }

  /* --------------------------------------------------------------- library */

  function formatsPresent() {
    var seen = {}, out = [];
    for (var i = 0; i < S.lib.length; i++) {
      var e = S.lib[i].ext || "vid";
      if (!seen[e]) { seen[e] = 1; out.push(e); }
    }
    out.sort();
    return out;
  }

  function renderLibrary() {
    var v = $("view-library");
    if (!v) return;
    var exts = formatsPresent();
    var html = '<div class="page-head">' +
      '<div class="page-title">My Library</div>' +
      '<div class="page-sub" id="libcount">' + countLabel(S.lib) + '</div>' +
      '<div class="searchbar">' + icon("search") +
        '<input id="q" type="search" placeholder="Search your videos" autocomplete="off" autocorrect="off" spellcheck="false" value="' + esc(S.q) + '" />' +
        (S.q ? '<button class="clearbtn" data-act="clear-q" aria-label="Clear">' + icon("close") + '</button>' : '') +
      '</div>';

    html += '<div class="chips">';
    var sorts = [["recent", "Recent"], ["name", "A\u2013Z"], ["size", "Largest"], ["duration", "Longest"]];
    for (var i = 0; i < sorts.length; i++) {
      html += '<button class="chip' + (S.sort === sorts[i][0] ? " on" : "") + '" data-act="sort" data-sort="' + sorts[i][0] + '">' + sorts[i][1] + '</button>';
    }
    html += '</div>';

    if (exts.length > 1) {
      html += '<div class="chips">';
      html += '<button class="chip' + (S.filter === "all" ? " on" : "") + '" data-act="filter" data-f="all">All</button>';
      for (i = 0; i < exts.length; i++) {
        html += '<button class="chip' + (S.filter === exts[i] ? " on" : "") + '" data-act="filter" data-f="' + esc(exts[i]) + '">' + esc(exts[i].toUpperCase()) + '</button>';
      }
      html += '</div>';
    }

    html += '</div><div class="grid" id="libgrid"></div>';
    v.innerHTML = html;

    var q = $("q");
    if (q) {
      q.addEventListener("input", function () {
        S.q = q.value || "";
        var clear = v.querySelector(".clearbtn");
        if (!clear && S.q) {
          var btn = document.createElement("button");
          btn.className = "clearbtn";
          btn.setAttribute("data-act", "clear-q");
          btn.setAttribute("aria-label", "Clear");
          btn.innerHTML = icon("close");
          q.parentNode.appendChild(btn);
        } else if (clear && !S.q) {
          clear.parentNode.removeChild(clear);
        }
        paintLibraryGrid();
      }, false);
    }
    paintLibraryGrid();
  }

  function countLabel(items) {
    var size = 0, watched = 0;
    for (var i = 0; i < items.length; i++) {
      size += items[i].size || 0;
      if (items[i].watched) watched++;
    }
    var s = items.length + (items.length === 1 ? " video" : " videos");
    if (size) s += " \u00b7 " + fmtSize(size);
    if (watched) s += " \u00b7 " + watched + " watched";
    return s;
  }

  function filteredLibrary() {
    var out = [], q = (S.q || "").toLowerCase(), i;
    for (i = 0; i < S.lib.length; i++) {
      var it = S.lib[i];
      if (S.filter !== "all" && (it.ext || "vid") !== S.filter) continue;
      if (q && (it.title || "").toLowerCase().indexOf(q) < 0 &&
               (it.name || "").toLowerCase().indexOf(q) < 0) continue;
      out.push(it);
    }
    if (S.sort === "name") out.sort(byNameSafe);
    else if (S.sort === "size") out.sort(bySizeDesc);
    else if (S.sort === "duration") out.sort(byDurDesc);
    else out.sort(byDateDesc);
    return out;
  }

  function paintLibraryGrid() {
    var grid = $("libgrid");
    if (!grid) return;
    var items = filteredLibrary();
    if (!S.lib.length) {
      grid.innerHTML = '<div class="grid-empty">' + emptyState() + '</div>';
    } else if (!items.length) {
      grid.innerHTML = '<div class="grid-empty"><div class="empty-sub">No videos match that search.</div>' +
        '<button class="btn btn-ghost" data-act="reset-filters">Reset filters</button></div>';
    } else {
      var html = "";
      for (var i = 0; i < items.length; i++) html += tile(items[i]);
      grid.innerHTML = html;
    }
    var cnt = $("libcount");
    if (cnt) cnt.textContent = countLabel(items);
    A.queueThumbs();
  }

  /* --------------------------------------------------------------- my list */

  function renderMyList() {
    var v = $("view-list");
    if (!v) return;
    var fav = [];
    for (var i = 0; i < S.lib.length; i++) if (S.lib[i].fav) fav.push(S.lib[i]);
    fav.sort(byNameSafe);

    var html = '<div class="page-head"><div class="page-title">My List</div>' +
      '<div class="page-sub">' + (fav.length ? fav.length + (fav.length === 1 ? " title saved" : " titles saved") : "Saved videos appear here") + '</div></div>';

    if (!fav.length) {
      html += '<div class="empty"><div class="empty-art">' + icon("heart") + '</div>' +
        '<div class="empty-title">Nothing saved yet</div>' +
        '<div class="empty-sub">Open any video, then tap <b>My List</b> to keep it here.</div>' +
        '<button class="btn btn-ghost" data-act="tab" data-view="home">Browse library</button></div>';
    } else {
      html += '<div class="grid">';
      for (i = 0; i < fav.length; i++) html += tile(fav[i]);
      html += '</div>';
    }
    v.innerHTML = html;
    A.queueThumbs();
  }

  /* ------------------------------------------------------------- settings */

  function sw(key, on) {
    return '<div class="sw' + (on ? " on" : "") + '" data-act="toggle" data-key="' + key + '" role="switch" aria-checked="' + (on ? "true" : "false") + '"><i></i></div>';
  }

  function renderSettings() {
    var v = $("view-settings");
    if (!v) return;
    var watched = 0;
    for (var i = 0; i < S.lib.length; i++) if (S.lib[i].watched) watched++;

    var html = '<div class="page-head"><div class="page-title">Settings</div>' +
      '<div class="page-sub">MP4Lumia ' + A.VERSION + '</div></div>';

    html += '<div class="card"><div class="card-title">Appearance</div>' +
      '<div class="themeseg">' +
        themeBtn("default", "Default", "Auto") +
        themeBtn("dark", "Dark", "") +
        themeBtn("light", "Light", "") +
      '</div>' +
      '<div class="hint">Default follows the phone\u2019s dark or light theme. Dark and Light override it for this app only.</div></div>';

    html += '<div class="card"><div class="card-title">Playback</div>' +
      rowItem("Resume where I left off", "Continue from the last position", sw("resume", S.set.resume)) +
      '<div class="divider"></div>' +
      rowItem("Continue watching row", "Show unfinished videos on Home", sw("continueRow", S.set.continueRow)) +
      '<div class="divider"></div>' +
      '<div class="rowitem"><div class="rowitem-l"><div class="rowitem-t">Playback speed</div>' +
        '<div class="rowitem-s">Remembered for the next video</div></div>' +
        '<div class="speedval">' + S.set.speed + '\u00d7</div></div>' +
      '</div>';

    html += '<div class="card"><div class="card-title">Library</div>' +
      '<div class="stat">' + S.lib.length + ' videos \u00b7 ' + fmtSize(totalSize()) + ' \u00b7 ' + watched + ' watched</div>' +
      '<button class="btn btn-ghost wide" data-act="add">' + icon("plus") + 'Add videos\u2026</button>';
    if (P.winrt) {
      html += '<button class="btn btn-ghost wide" data-act="scan">' + icon("refresh") + 'Scan Videos folder</button>';
    } else {
      html += '<button class="btn btn-ghost wide" data-act="addfolder">' + icon("folder") + 'Add a folder\u2026</button>';
    }
    if (S.lib.length) {
      html += '<button class="btn btn-ghost wide danger" data-act="clear">' + icon("trash") + 'Clear library</button>';
    }
    html += '</div>';

    html += '<div class="card"><div class="card-title">About</div>' +
      '<div class="about-title">MP4Lumia</div>' +
      '<div class="about-sub">A Netflix-style player for the Nokia Lumia 929. Everything is local \u2014 no account, no network.</div>' +
      '<div class="kv"><span>Version</span><b>' + A.VERSION + '</b></div>' +
      '<div class="kv"><span>Device</span><b>' + esc(A.deviceInfo()) + '</b></div>' +
      '<div class="kv"><span>Engine</span><b>' + esc(P.engine) + '</b></div>' +
      '<div class="kv"><span>Decoding</span><b>Windows Media Foundation</b></div>' +
      '<div class="formats">' + A.VIDEO_EXT.map(function (e) { return e.toUpperCase(); }).join("  ") + '</div>' +
      '<div class="hint">MP4/H.264, MKV, AVI, WMV, MOV, TS and 3GP play through the phone\u2019s own codecs. A file whose codec the phone lacks (for example HEVC or AC-3 audio) opens in Movies &amp; TV from the video\u2019s page.</div>' +
      '</div>';

    v.innerHTML = html;
  }

  function themeBtn(mode, label, tag) {
    return '<button class="seg' + (mode === "default" ? " auto" : "") + (S.set.theme === mode ? " on" : "") + '" data-act="theme" data-theme="' + mode + '">' +
      '<span class="seg-t">' + label + '</span>' +
      (tag ? '<span class="seg-s">' + tag + '</span>' : '') + '</button>';
  }

  function rowItem(title, sub, right) {
    return '<div class="rowitem"><div class="rowitem-l"><div class="rowitem-t">' + esc(title) + '</div>' +
      '<div class="rowitem-s">' + esc(sub) + '</div></div>' + right + '</div>';
  }

  /* --------------------------------------------------------------- detail */

  function openDetail(id) {
    var it = byId(id);
    if (!it) return;
    S.currentId = id;
    var p = pct(it.position, it.duration);
    var resuming = it.position > 5 && !it.watched;

    var html = '<div class="detail">' +
      '<div class="detail-hero" data-thumb="' + esc(it.id) + '"' + thumbStyle(it) + '>' +
        '<div class="detail-scrim"></div>' +
        '<button class="iconbtn detail-x" data-act="close-sheet" aria-label="Close">' + icon("close") + '</button>' +
        '<div class="detail-hero-t">' + esc((it.ext || "vid").toUpperCase()) + '</div>' +
      '</div>' +
      '<div class="detail-body">' +
        '<div class="detail-title">' + esc(it.title || it.name) + '</div>' +
        '<div class="detail-meta">' + esc(metaLine(it)) + '</div>';

    if (p > 0) {
      html += '<div class="dprog"><span style="width:' + p + '%"></span></div>' +
        '<div class="dprog-t">' + (it.watched ? "Watched" : pct(it.position, it.duration) + "% \u00b7 " +
          (resuming ? "resume at " + fmtTime(it.position) : "not started")) + '</div>';
    }

    html += '<button class="btn btn-primary wide" data-act="play" data-id="' + esc(it.id) + '">' +
              icon("play", "ico-fill") + (resuming ? "Resume" : "Play") + '</button>';

    if (resuming) {
      html += '<button class="btn btn-ghost wide" data-act="restart" data-id="' + esc(it.id) + '">' +
              icon("refresh") + 'Start over</button>';
    }

    html += '<div class="drow">' +
      dact("fav", "heart", it.fav ? "In My List" : "My List", it.fav) +
      dact("watched", "check", it.watched ? "Watched" : "Mark seen", it.watched) +
      dact("external", "external", "Movies & TV", false) +
      dact("remove", "trash", "Remove", false) +
      '</div>';

    html += '<div class="kvs">' +
      kv("File", it.name) +
      (it.folder ? kv("Folder", it.folder) : "") +
      kv("Size", fmtSize(it.size) || "\u2014") +
      kv("Duration", fmtDur(it.duration) || "\u2014") +
      kv("Resolution", (it.videoW && it.videoH) ? it.videoW + " \u00d7 " + it.videoH : "\u2014") +
      kv("Format", (it.ext || "").toUpperCase() || "\u2014") +
      kv("Added", fmtDate(it.dateAdded)) +
      (it.position > 0 ? kv("Last position", fmtTime(it.position)) : "") +
      '</div>' +
      (P.winrt ? '<div class="hint">If this file will not decode here, Movies &amp; TV uses the same phone codecs with an extra fallback for audio tracks.</div>' : "") +
      '</div></div>';

    $("sheetc").innerHTML = html;
    $("sheetc").className = "sheet-card";
    $("sheet").className = "sheet open";
    A.queueThumbs();
  }

  function kv(k, v) {
    return '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
  }

  function dact(act, ic, label, on) {
    return '<button class="dact' + (on ? " on" : "") + '" data-act="' + act + '" data-id="' + esc(S.currentId) + '">' +
      icon(ic) + '<span>' + esc(label) + '</span></button>';
  }

  function closeSheet() {
    $("sheet").className = "sheet";
    S.currentId = null;
  }

  /* --------------------------------------------------------------- actions */

  function setTheme(mode) {
    S.set.theme = mode;
    A.saveSettings();
    A.applyTheme();
    renderSettings();
    toastTheme(mode);
  }

  function toastTheme(mode) {
    A.toast("Theme: " + (mode === "default" ? "Default (follows phone)" : mode.charAt(0).toUpperCase() + mode.slice(1)));
  }

  function cycleTheme() {
    var order = ["default", "dark", "light"];
    var i = order.indexOf(S.set.theme);
    setTheme(order[(i + 1) % order.length]);
  }

  function findItem(node) {
    var id = node ? node.getAttribute("data-id") : null;
    if (!id) id = S.currentId;
    return id ? byId(id) : null;
  }

  function act(name, node) {
    var it, id;
    if (name.indexOf("player-") === 0) {
      if (A.playerAction) A.playerAction(name);
      return;
    }
    switch (name) {
      case "tab":
        setView(node.getAttribute("data-view"));
        break;
      case "go-search":
        setView("library");
        setTimeout(function () { var q = $("q"); if (q) q.focus(); }, 120);
        break;
      case "cycle-theme":
        cycleTheme();
        break;
      case "theme":
        setTheme(node.getAttribute("data-theme"));
        break;
      case "toggle":
        toggleSetting(node.getAttribute("data-key"));
        break;
      case "sort":
        S.sort = node.getAttribute("data-sort");
        renderLibrary();
        break;
      case "filter":
        S.filter = node.getAttribute("data-f");
        renderLibrary();
        break;
      case "reset-filters":
        S.filter = "all"; S.q = "";
        renderLibrary();
        break;
      case "clear-q":
        S.q = "";
        renderLibrary();
        break;
      case "open":
        openDetail(node.getAttribute("data-id"));
        break;
      case "close-sheet":
        closeSheet();
        break;
      case "play":
        it = findItem(node);
        if (it) { closeSheet(); A.openPlayer(it.id); }
        break;
      case "restart":
        it = findItem(node);
        if (it) { closeSheet(); A.openPlayer(it.id, 0); }
        break;
      case "fav":
        it = findItem(node);
        if (it) {
          it.fav = !it.fav;
          A.saveLib();
          openDetail(it.id);
          A.schedulePaint();
          A.toast(it.fav ? "Added to My List" : "Removed from My List");
        }
        break;
      case "watched":
        it = findItem(node);
        if (it) {
          it.watched = !it.watched;
          if (it.watched) it.position = 0;
          A.saveLib();
          openDetail(it.id);
          A.schedulePaint();
          A.toast(it.watched ? "Marked as watched" : "Marked as unwatched");
        }
        break;
      case "remove":
        it = findItem(node);
        if (it) {
          A.askConfirm("Remove from library?",
            "The file stays on your phone. Only the MP4Lumia entry and its watch progress are removed.",
            "Remove", function () {
              A.removeItem(it.id);
              closeSheet();
              A.toast("Removed from library");
            });
        }
        break;
      case "external":
        it = findItem(node);
        if (it) A.openExternal(it);
        break;
      case "add":
        doAdd(false);
        break;
      case "addfolder":
        doAdd(true);
        break;
      case "scan":
        doScan();
        break;
      case "clear":
        A.askConfirm("Clear the library?",
          "This removes every entry and its watch progress. Your video files are not deleted.",
          "Clear", function () {
            A.clearLibrary();
            setView("home");
          });
        break;
      case "demo":
        if (A.startDemo) A.startDemo();
        break;
      case "confirm-ok":
        doConfirm();
        break;
      case "confirm-cancel":
        A.closeConfirm();
        break;
    }
  }

  function doConfirm() {
    var cb = A.confirmCb();
    A.closeConfirm();
    if (cb) { try { cb(); } catch (e) { } }
  }

  function toggleSetting(key) {
    if (key === "resume") S.set.resume = !S.set.resume;
    else if (key === "continueRow") S.set.continueRow = !S.set.continueRow;
    A.saveSettings();
    renderSettings();
    A.paint();
  }

  function doAdd(folder) {
    A.pickFiles(!!folder).then(function (list) {
      A.addFiles(list);
    }, function (err) {
      A.toast("Could not open the picker");
    });
  }

  function doScan() {
    A.toast("Scanning the Videos folder\u2026");
    A.scanVideosFolder().then(function (list) {
      if (!list.length) { A.toast("No videos found in the Videos folder"); return; }
      var added = A.addFiles(list, true);
      A.toast(added.length ? "Found " + added.length + " new videos" : "Everything is already in your library");
      A.schedulePaint();
    }, function (err) {
      A.toast("Videos folder unavailable \u2014 use Add videos");
    });
  }

  /* ------------------------------------------------------------------ init */

  function setView(name) {
    S.view = name;
    var names = ["home", "library", "list", "settings"];
    for (var i = 0; i < names.length; i++) {
      var n = $("view-" + names[i]);
      if (n) n.className = "view" + (names[i] === name ? " active" : "");
    }
    var main = $("main");
    if (main) main.scrollTop = 0;
    if (name === "home") renderHome();
    else if (name === "library") renderLibrary();
    else if (name === "list") renderMyList();
    else renderSettings();
    paintTabs();
    A.queueThumbs();
  }

  function paintTabs() {
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      var v = tabs[i].getAttribute("data-view");
      tabs[i].className = "tab" + (v === S.view ? " on" : "");
    }
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.getAttribute) {
        var a = t.getAttribute("data-act");
        if (a) { act(a, t); return; }
      }
      t = t.parentNode;
    }
    // tap outside the detail card closes it
    if (e.target && e.target.id === "sheet") closeSheet();
  }, false);

  A.renderHome = renderHome;
  A.renderLibrary = renderLibrary;
  A.paintLibraryGrid = paintLibraryGrid;
  A.renderMyList = renderMyList;
  A.renderSettings = renderSettings;
  A.openDetail = openDetail;
  A.closeSheet = closeSheet;
  A.act = act;
  A.doAdd = doAdd;
  A.setView = setView;
  A.setTheme = setTheme;
  A.cycleTheme = cycleTheme;
  A.paintTabs = paintTabs;
})();

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

