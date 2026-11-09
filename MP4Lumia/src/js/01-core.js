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
