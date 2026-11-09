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
