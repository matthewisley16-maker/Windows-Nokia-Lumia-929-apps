/* MP3Lumia — every screen: Home, Search, Your Library, album/artist/playlist
   pages, Settings, the full-screen Now Playing view and the bottom sheets for
   the queue, the equaliser, lyrics and track actions. */
(function () {
  "use strict";

  var A = window.MP3;
  var S = A.S;
  var $ = A.$, esc = A.esc, icon = A.icon, fmtTime = A.fmtTime;
  var fmtTotal = A.fmtTotal, fmtDate = A.fmtDate, fmtDur = A.fmtDur;
  var clamp = A.clamp;

  var searchQuery = "";
  var searchFilter = "all";
  var libTab = "playlists";
  var sheetKind = null;
  var sheetId = null;
  var lastRouteKey = "";
  var vizRaf = null;
  var npVisible = false;

  /* --------------------------------------------------------------- helpers */

  function idsOf(list) {
    var out = [], i;
    for (i = 0; i < list.length; i++) out.push(list[i].id);
    return out;
  }

  function songCount(n) { return n + (n === 1 ? " song" : " songs"); }

  function artDiv(id, cls, extra) {
    var a = id ? ' data-art="' + esc(id) + '"' : "";
    var note = '<span class="ph">' + icon("music") + "</span>";
    return '<div class="' + cls + " artbox" + (id ? "" : " noart") + '"' + a + (extra || "") + ">" + note + "</div>";
  }

  function page(inner) {
    return '<div class="page">' + inner + "</div>";
  }

  function sectionHead(title, right) {
    return '<div class="section-head"><h2>' + esc(title) + "</h2>" + (right || "") + "</div>";
  }

  function heading(title, sub) {
    return '<div class="page-head"><h1>' + esc(title) + "</h1>" +
           (sub ? '<div class="page-sub">' + esc(sub) + "</div>" : "") + "</div>";
  }

  function emptyBlock(text, sub) {
    return '<div class="empty"><div class="empty-ico">' + icon("music") + "</div>" +
           '<div class="empty-t">' + esc(text) + "</div>" +
           (sub ? '<div class="empty-s">' + esc(sub) + "</div>" : "") + "</div>";
  }

  function playlistArtId(p) {
    var list = A.playlistTracks(p);
    return list.length ? list[0].id : "";
  }

  function gradientClass(seed) {
    var n = parseInt(A.hashStr(String(seed || "")), 36) % 5;
    return " grad" + n;
  }

  /* --------------------------------------------------------------- rows */

  function trackRow(t, i, listKey, opts) {
    opts = opts || {};
    var cur = A.currentId() === t.id;
    var playing = cur && A.isPlaying();
    var sub = opts.sub || (t.artist + " \u00b7 " + t.album);
    var marker = "";
    if (cur) {
      marker = '<span class="eqbars' + (playing ? " on" : "") + '"><i></i><i></i><i></i></span>';
    } else if (opts.num !== false) {
      marker = String(i + 1);
    }
    return '<div class="tr' + (cur ? " on" : "") + '" data-act="play-tap" data-l="' + esc(listKey) + '" data-i="' + i + '">' +
      '<div class="tr-idx">' + marker + "</div>" +
      artDiv(t.id, "tr-thumb" + gradientClass(t.album)) +
      '<div class="tr-main"><div class="tr-title">' + esc(t.title) + "</div>" +
      '<div class="tr-sub">' + esc(sub) + "</div></div>" +
      '<div class="tr-dur">' + (t.duration ? fmtTime(t.duration) : "") + "</div>" +
      '<button class="tr-more" data-act="track-menu" data-id="' + t.id + '" aria-label="More options">' + icon("more") + "</button>" +
      "</div>";
  }

  function trackList(list, listKey, opts) {
    var html = "", i;
    for (i = 0; i < list.length; i++) html += trackRow(list[i], i, listKey, opts || {});
    return html;
  }

  function albumCard(al) {
    return '<button class="card" data-act="open-album" data-id="' + al.id + '">' +
      artDiv(al.artId, "card-art" + gradientClass(al.name)) +
      '<div class="card-name">' + esc(al.name) + "</div>" +
      '<div class="card-sub">' + esc(al.artist) + "</div></button>";
  }

  function playlistCard(p) {
    var artId = playlistArtId(p);
    var n = A.playlistTracks(p).length;
    return '<button class="card" data-act="open-playlist" data-id="' + p.id + '">' +
      artDiv(artId, "card-art" + gradientClass(p.name)) +
      '<div class="card-name">' + esc(p.name) + "</div>" +
      '<div class="card-sub">Playlist \u00b7 ' + n + "</div></button>";
  }

  function artistCard(ar) {
    return '<button class="card artist" data-act="open-artist" data-id="' + ar.id + '">' +
      artDiv(ar.artId, "card-art round" + gradientClass(ar.name)) +
      '<div class="card-name">' + esc(ar.name) + "</div>" +
      '<div class="card-sub">Artist</div></button>';
  }

  function genreCard(g) {
    return '<button class="genre' + gradientClass(g.name) + '" data-act="open-genre" data-name="' + esc(g.name) + '">' +
      '<span class="genre-name">' + esc(g.name) + "</span>" +
      '<span class="genre-n">' + g.tracks.length + " songs</span>" +
      artDiv(g.artId, "genre-art") + "</button>";
  }

  function playlistRow(p) {
    var n = A.playlistTracks(p).length;
    var artId = playlistArtId(p);
    return '<button class="lrow" data-act="open-playlist" data-id="' + p.id + '">' +
      artDiv(artId, "lrow-art" + gradientClass(p.name)) +
      '<span class="lrow-main"><span class="lrow-t">' + esc(p.name) + "</span>" +
      '<span class="lrow-s">Playlist \u00b7 ' + n + " songs</span></span>" +
      icon("chevron", "") + "</button>";
  }

  function likedRow() {
    var n = A.likedTracks().length;
    return '<button class="lrow" data-act="open-liked">' +
      '<span class="lrow-art liked-art">' + icon("heart", "ico-fill") + "</span>" +
      '<span class="lrow-main"><span class="lrow-t">Liked Songs</span>' +
      '<span class="lrow-s">Playlist \u00b7 ' + n + " songs</span></span>" +
      icon("chevron", "") + "</button>";
  }

  /* ---------------------------------------------------------------- home */

  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return "Good night";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  function viewHome() {
    var stats = A.stats();
    var html = heading(greeting(), S.lib.length ? songCount(stats.tracks) + " \u00b7 " + stats.albums + " albums \u00b7 " + fmtTotal(stats.duration) : "Your music, on your phone");

    if (!S.lib.length) {
      html += '<div class="onboard">' +
        '<div class="onboard-art">' + icon("music") + "</div>" +
        "<h2>Bring your music</h2>" +
        "<p>Add the songs already on your phone. MP3Lumia reads their tags and arranges them by artist, album and genre \u2014 no account, no network.</p>" +
        '<button class="btn btn-primary" data-act="add-files">Add music files</button>' +
        '<button class="btn" data-act="add-folder">Add a folder</button>' +
        (A.P.winrt ? '<button class="btn btn-ghost" data-act="scan-library">Scan the Music folder</button>' : "") +
        '<button class="link" data-act="demo">See it with a demo library</button>' +
        "</div>";
      return page(html);
    }

    var recentAlbums = A.recentAlbums(8);
    var topArtists = A.topArtists(8);
    var recent = A.recentTracks(6);
    var i, al;

    if (recentAlbums.length) {
      html += '<div class="tiles">';
      for (i = 0; i < Math.min(4, recentAlbums.length); i++) {
        al = recentAlbums[i];
        html += '<button class="tile" data-act="open-album" data-id="' + al.id + '">' +
          artDiv(al.artId, "tile-art" + gradientClass(al.name)) +
          '<span class="tile-name">' + esc(al.name) + "</span></button>";
      }
      html += "</div>";
    }

    if (recent.length) {
      var key = A.registerList("home:recent", idsOf(recent), "Recently played");
      html += sectionHead("Recently played", '<button class="txt-btn" data-act="open-queue">Queue</button>');
      html += trackList(recent, key, { num: false });
    }

    if (recentAlbums.length) {
      html += sectionHead("Recently added");
      html += '<div class="hscroll">';
      for (i = 0; i < recentAlbums.length; i++) html += albumCard(recentAlbums[i]);
      html += "</div>";
    }

    if (topArtists.length) {
      html += sectionHead("Your artists");
      html += '<div class="hscroll">';
      for (i = 0; i < topArtists.length; i++) html += artistCard(topArtists[i]);
      html += "</div>";
    }

    html += sectionHead("Your playlists", '<button class="txt-btn" data-act="new-playlist">New</button>');
    html += '<div class="hscroll">';
    html += '<button class="card" data-act="open-liked">' +
      '<span class="card-art liked-art">' + icon("heart", "ico-fill") + "</span>" +
      '<div class="card-name">Liked Songs</div>' +
      '<div class="card-sub">Playlist \u00b7 ' + A.likedTracks().length + "</div></button>";
    for (i = 0; i < S.playlists.length; i++) html += playlistCard(S.playlists[i]);
    html += "</div>";

    return page(html);
  }

  /* --------------------------------------------------------------- search */

  function searchResultsHtml() {
    var q = searchQuery.replace(/^\s+|\s+$/g, "");
    if (!q) {
      if (!A.groups.genres.length) {
        return emptyBlock("Search your music", "Artists, albums, songs and genres appear here once you add music.");
      }
      var html = sectionHead("Browse by genre") + '<div class="genres">', i;
      for (i = 0; i < A.groups.genres.length; i++) html += genreCard(A.groups.genres[i]);
      return html + "</div>";
    }

    var r = A.searchAll(q);
    var total = r.songs.length + r.albums.length + r.artists.length + r.playlists.length;
    if (!total) return emptyBlock("No results for \u201c" + q + "\u201d", "Try a different spelling, or add more music.");

    var html2 = '<div class="chips filter">';
    var filters = [["all", "All"], ["songs", "Songs"], ["albums", "Albums"], ["artists", "Artists"]];
    for (i = 0; i < filters.length; i++) {
      html2 += '<button class="chip' + (searchFilter === filters[i][0] ? " on" : "") +
        '" data-act="search-filter" data-f="' + filters[i][0] + '">' + filters[i][1] + "</button>";
    }
    html2 += "</div>";

    var showSongs = searchFilter === "all" || searchFilter === "songs";
    var showAlbums = searchFilter === "all" || searchFilter === "albums";
    var showArtists = searchFilter === "all" || searchFilter === "artists";

    if (showSongs && r.songs.length) {
      var key = A.registerList("search:songs", idsOf(r.songs), "Search: " + q);
      html2 += sectionHead("Songs", '<span class="count">' + r.songs.length + "</span>");
      html2 += trackList(r.songs.slice(0, 12), key, {});
    }
    if (showAlbums && r.albums.length) {
      html2 += sectionHead("Albums", '<span class="count">' + r.albums.length + "</span>");
      html2 += '<div class="grid">';
      for (i = 0; i < r.albums.length; i++) html2 += albumCard(r.albums[i]);
      html2 += "</div>";
    }
    if (showArtists && r.artists.length) {
      html2 += sectionHead("Artists", '<span class="count">' + r.artists.length + "</span>");
      html2 += '<div class="hscroll">';
      for (i = 0; i < r.artists.length; i++) html2 += artistCard(r.artists[i]);
      html2 += "</div>";
    }
    if (searchFilter === "all" && r.playlists.length) {
      html2 += sectionHead("Playlists");
      for (i = 0; i < r.playlists.length; i++) html2 += playlistRow(r.playlists[i]);
    }
    if (searchFilter === "all" && r.genres.length) {
      html2 += sectionHead("Genres") + '<div class="genres">';
      for (i = 0; i < r.genres.length; i++) html2 += genreCard(r.genres[i]);
      html2 += "</div>";
    }
    return html2;
  }

  function viewSearch() {
    var html = '<div class="page searchpage">' +
      '<div class="searchbar">' + icon("search") +
      '<input id="q" type="search" autocomplete="off" placeholder="Songs, albums, artists" value="' + esc(searchQuery) + '" />' +
      '<button class="sbc' + (searchQuery ? "" : " hidden") + '" data-act="search-clear" aria-label="Clear">' + icon("close") + "</button>" +
      "</div>" +
      '<div id="searchres">' + searchResultsHtml() + "</div></div>";
    return html;
  }

  /* -------------------------------------------------------------- library */

  function viewLibrary() {
    var stats = A.stats();
    var html = '<div class="page">' +
      '<div class="page-head row-head"><div><h1>Your Library</h1>' +
      '<div class="page-sub">' + songCount(stats.tracks) + " \u00b7 " + stats.albums + " albums</div></div>" +
      '<button class="round-btn" data-act="add-menu" aria-label="Add music or playlist">' + icon("plus") + "</button></div>";

    var tabs = [["playlists", "Playlists"], ["songs", "Songs"], ["albums", "Albums"], ["artists", "Artists"]], i;
    html += '<div class="seg">';
    for (i = 0; i < tabs.length; i++) {
      html += '<button class="seg-btn' + (libTab === tabs[i][0] ? " on" : "") +
        '" data-act="lib-tab" data-tab="' + tabs[i][0] + '">' + tabs[i][1] + "</button>";
    }
    html += "</div>";

    if (libTab === "playlists") {
      html += likedRow();
      html += '<button class="lrow" data-act="new-playlist">' +
        '<span class="lrow-art add-art">' + icon("plus") + "</span>" +
        '<span class="lrow-main"><span class="lrow-t">New playlist</span>' +
        '<span class="lrow-s">Collect songs into a mix</span></span></button>';
      for (i = 0; i < S.playlists.length; i++) html += playlistRow(S.playlists[i]);
      if (!S.playlists.length) {
        html += '<div class="hint">Playlists you make show up here, and in the sidebar on the now playing screen.</div>';
      }
    } else if (libTab === "songs") {
      if (!S.lib.length) {
        html += emptyBlock("No songs yet", "Add files or a folder to get started.");
        html += '<button class="btn btn-primary wide" data-act="add-menu">Add music</button>';
      } else {
        var sorted = A.sortTracks(S.lib, S.set.sortSongs || "title");
        var key = A.registerList("lib:songs", idsOf(sorted), "Songs");
        var opts = [["title", "Title"], ["artist", "Artist"], ["album", "Album"], ["added", "Recently added"], ["recent", "Recently played"], ["duration", "Length"], ["plays", "Most played"]];
        html += '<div class="list-tools">' +
          '<button class="play-pill" data-act="play-songs">' + icon("play", "ico-fill") + "<span>Play all</span></button>" +
          '<button class="round-btn sm" data-act="shuffle-songs" aria-label="Shuffle">' + icon("shuffle") + "</button>" +
          '<span class="spacer"></span>' +
          '<select id="sortsongs" data-act="sort-songs" aria-label="Sort songs">';
        for (i = 0; i < opts.length; i++) {
          html += '<option value="' + opts[i][0] + '"' + (S.set.sortSongs === opts[i][0] ? " selected" : "") + ">" + opts[i][1] + "</option>";
        }
        html += "</select></div>";
        html += '<div class="list-meta">' + sorted.length + " songs \u00b7 " + fmtTotal(stats.duration) + "</div>";
        html += trackList(sorted, key, {});
      }
    } else if (libTab === "albums") {
      if (!A.groups.albums.length) html += emptyBlock("No albums yet", "Album tags in your files are used to group songs.");
      else {
        html += '<div class="grid">';
        for (i = 0; i < A.groups.albums.length; i++) html += albumCard(A.groups.albums[i]);
        html += "</div>";
      }
    } else {
      if (!A.groups.artists.length) html += emptyBlock("No artists yet", "Artist tags in your files are used to group songs.");
      else {
        html += '<div class="artists">';
        for (i = 0; i < A.groups.artists.length; i++) {
          var ar = A.groups.artists[i];
          html += '<button class="arow" data-act="open-artist" data-id="' + ar.id + '">' +
            artDiv(ar.artId, "arow-art round" + gradientClass(ar.name)) +
            '<span class="lrow-main"><span class="lrow-t">' + esc(ar.name) + "</span>" +
            '<span class="lrow-s">' + ar.albums.length + (ar.albums.length === 1 ? " album" : " albums") + " \u00b7 " + ar.tracks.length + " songs</span></span>" +
            icon("chevron") + "</button>";
        }
        html += "</div>";
      }
    }
    return html + "</div>";
  }

  /* ---------------------------------------------------------------- detail */

  function artistNames(tracks) {
    var out = [], seen = {}, i;
    for (i = 0; i < tracks.length; i++) {
      var n = tracks[i].artist || "Unknown Artist";
      if (!seen[n]) { seen[n] = true; out.push(n); }
    }
    if (out.length <= 3) return out.join(", ");
    return out.slice(0, 2).join(", ") + " and " + (out.length - 2) + " more";
  }

  function detailTracks(list, key, opts) {
    var html = trackList(list, key, opts || {});
    return html;
  }

  function viewAlbum(id) {
    var al = A.album(id);
    if (!al) return page(emptyBlock("Album not found", "It may have been removed from the library."));
    var key = A.registerList("album:" + id, idsOf(al.tracks), al.name);
    var sub = al.artist + (al.year ? " \u00b7 " + al.year : "");
    var meta = al.tracks.length + " songs \u00b7 " + fmtTotal(al.duration);
    var html = '<div class="page detail">' +
      '<div class="detail-head">' +
      artDiv(al.artId, "detail-art" + gradientClass(al.name)) +
      '<div class="detail-info"><div class="kind">Album</div>' +
      "<h1>" + esc(al.name) + "</h1>" +
      '<div class="detail-sub">' + esc(sub) + "</div>" +
      '<div class="detail-meta">' + meta + "</div></div></div>" +
      '<div class="actions">' +
      '<button class="fab" data-act="play-list" data-l="' + key + '" aria-label="Play">' + icon("play", "ico-fill") + "</button>" +
      '<button class="round-btn" data-act="shuffle-list" data-l="' + key + '" aria-label="Shuffle">' + icon("shuffle") + "</button>" +
      '<button class="round-btn" data-act="like-album" data-id="' + id + '" aria-label="Save album">' + icon("heart") + "</button>" +
      '<span class="spacer"></span>' +
      '<button class="round-btn" data-act="album-menu" data-id="' + id + '" aria-label="More">' + icon("more") + "</button></div>" +
      detailTracks(al.tracks, key, {}) + "</div>";
    return html;
  }

  function viewArtist(id) {
    var ar = A.artist(id);
    if (!ar) return page(emptyBlock("Artist not found", "It may have been removed from the library."));
    var key = A.registerList("artist:" + id, idsOf(ar.tracks), ar.name);
    var albums = [], i;
    for (i = 0; i < ar.albums.length; i++) {
      var al = A.album(ar.albums[i]);
      if (al) albums.push(al);
    }
    var top = A.sortTracks(ar.tracks, "plays").slice(0, 8);
    var html = '<div class="page detail">' +
      '<div class="detail-head vertical">' +
      artDiv(ar.artId, "detail-art round" + gradientClass(ar.name)) +
      '<div class="detail-info"><div class="kind">Artist</div>' +
      "<h1>" + esc(ar.name) + "</h1>" +
      '<div class="detail-meta">' + ar.tracks.length + " songs \u00b7 " + albums.length + " albums</div></div></div>" +
      '<div class="actions">' +
      '<button class="fab" data-act="play-list" data-l="' + key + '" aria-label="Play">' + icon("play", "ico-fill") + "</button>" +
      '<button class="round-btn" data-act="shuffle-list" data-l="' + key + '" aria-label="Shuffle">' + icon("shuffle") + "</button>" +
      '<span class="spacer"></span>' +
      '<button class="round-btn" data-act="like-artist" data-id="' + id + '" aria-label="Like">' + icon("heart") + "</button></div>";

    if (albums.length) {
      html += sectionHead("Albums");
      html += '<div class="hscroll">';
      for (i = 0; i < albums.length; i++) html += albumCard(albums[i]);
      html += "</div>";
    }
    var topKey = A.registerList("artist-top:" + id, idsOf(ar.tracks), ar.name);
    html += sectionHead("Songs");
    html += '<div class="list-meta">' + artistNames(ar.tracks) + "</div>";
    html += detailTracks(top, topKey, {});
    return html + "</div>";
  }

  function viewPlaylist(id) {
    var p = A.playlistById(id);
    if (!p) return page(emptyBlock("Playlist not found", "It may have been deleted."));
    var list = A.playlistTracks(p);
    var key = A.registerList("pl:" + id, idsOf(list), p.name);
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].duration || 0;
    var html = '<div class="page detail">' +
      '<div class="detail-head">' +
      artDiv(list.length ? list[0].id : "", "detail-art" + gradientClass(p.name)) +
      '<div class="detail-info"><div class="kind">Playlist</div>' +
      "<h1>" + esc(p.name) + "</h1>" +
      '<div class="detail-sub">You</div>' +
      '<div class="detail-meta">' + songCount(list.length) + (total ? " \u00b7 " + fmtTotal(total) : "") + "</div></div></div>" +
      '<div class="actions">' +
      '<button class="fab" data-act="play-list" data-l="' + key + '" aria-label="Play">' + icon("play", "ico-fill") + "</button>" +
      '<button class="round-btn" data-act="shuffle-list" data-l="' + key + '" aria-label="Shuffle">' + icon("shuffle") + "</button>" +
      '<span class="spacer"></span>' +
      '<button class="round-btn" data-act="playlist-menu" data-id="' + id + '" aria-label="More">' + icon("more") + "</button></div>";

    if (!list.length) {
      html += emptyBlock("This playlist is empty", "Open a song\u2019s menu and choose \u201cAdd to playlist\u201d.");
      html += '<button class="btn wide" data-act="tab-search">Find songs</button>';
    } else {
      html += detailTracks(list, key, {});
    }
    return html + "</div>";
  }

  function viewLiked() {
    var list = A.likedTracks();
    var key = A.registerList("liked", idsOf(list), "Liked Songs");
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].duration || 0;
    var html = '<div class="page detail">' +
      '<div class="detail-head">' +
      '<div class="detail-art liked-art big">' + icon("heart", "ico-fill") + "</div>" +
      '<div class="detail-info"><div class="kind">Playlist</div>' +
      "<h1>Liked Songs</h1>" +
      '<div class="detail-sub">You</div>' +
      '<div class="detail-meta">' + songCount(list.length) + (total ? " \u00b7 " + fmtTotal(total) : "") + "</div></div></div>" +
      '<div class="actions">' +
      '<button class="fab" data-act="play-list" data-l="' + key + '" aria-label="Play">' + icon("play", "ico-fill") + "</button>" +
      '<button class="round-btn" data-act="shuffle-list" data-l="' + key + '" aria-label="Shuffle">' + icon("shuffle") + "</button></div>";
    if (!list.length) {
      html += emptyBlock("No liked songs yet", "Tap the heart on any song to keep it here.");
      html += '<button class="btn wide" data-act="tab-search">Find songs</button>';
    } else {
      html += detailTracks(list, key, {});
    }
    return html + "</div>";
  }

  function viewGenre(name) {
    var g = null, i;
    for (i = 0; i < A.groups.genres.length; i++) if (A.groups.genres[i].name === name) { g = A.groups.genres[i]; break; }
    if (!g) return page(emptyBlock("Genre not found", ""));
    var list = A.sortTracks(g.tracks, "artist");
    var key = A.registerList("genre:" + name, idsOf(list), name);
    var total = 0;
    for (i = 0; i < list.length; i++) total += list[i].duration || 0;
    var html = '<div class="page detail">' +
      '<div class="detail-head">' +
      artDiv(g.artId, "detail-art" + gradientClass(name)) +
      '<div class="detail-info"><div class="kind">Genre</div>' +
      "<h1>" + esc(name) + "</h1>" +
      '<div class="detail-meta">' + songCount(list.length) + " \u00b7 " + fmtTotal(total) + "</div></div></div>" +
      '<div class="actions">' +
      '<button class="fab" data-act="play-list" data-l="' + key + '" aria-label="Play">' + icon("play", "ico-fill") + "</button>" +
      '<button class="round-btn" data-act="shuffle-list" data-l="' + key + '" aria-label="Shuffle">' + icon("shuffle") + "</button></div>" +
      detailTracks(list, key, {}) + "</div>";
    return html;
  }

  /* -------------------------------------------------------------- settings */

  function switchRow(label, sub, key, on) {
    return '<div class="set-row"><div class="set-text"><div class="set-label">' + esc(label) + "</div>" +
      (sub ? '<div class="set-sub">' + esc(sub) + "</div>" : "") + "</div>" +
      '<button class="switch' + (on ? " on" : "") + '" data-act="setting" data-key="' + key + '" aria-label="' + esc(label) + '"><span></span></button></div>';
  }

  function viewSettings() {
    var stats = A.stats();
    var engine = A.P.engine;
    var html = '<div class="page">' + heading("Settings", "MP3Lumia " + A.VERSION);
    var eqPreset = S.set.eqPreset || "Flat";
    var eqOn = S.set.eqOn ? eqPreset : "Off";

    html += '<div class="set-card"><div class="set-title">Playback</div>' +
      '<div class="set-row"><div class="set-text"><div class="set-label">Crossfade</div>' +
      '<div class="set-sub">Blend the end of one song into the next</div></div>' +
      '<div class="slider-wrap"><input type="range" id="cfslider" min="0" max="12" step="1" value="' + S.set.crossfade + '" data-act="crossfade" />' +
      '<span class="slider-val" id="cfval">' + (S.set.crossfade ? S.set.crossfade + "s" : "Off") + "</span></div></div>" +
      switchRow("Normalize volume", "Use ReplayGain tags so loud and quiet albums match", "normalize", S.set.normalize) +
      switchRow("Limiter", "Prevent clipping when the EQ boosts a band", "limiter", S.set.limiter) +
      switchRow("Visualizer", "Show the spectrum while a song plays", "visualizer", S.set.visualizer) +
      "</div>";

    html += '<button class="set-card link-card" data-act="eq"><div class="set-row flat"><div class="set-text">' +
      '<div class="set-label">Equalizer</div><div class="set-sub">10 bands \u00b1 12 dB \u00b7 ' + esc(eqOn) + "</div></div>" +
      '<span class="chev">' + icon("chevron") + "</span></div></button>";

    html += '<div class="set-card"><div class="set-title">Sleep timer</div>' +
      '<div class="chips">' +
      '<button class="chip' + (!S.set.sleepMinutes ? " on" : "") + '" data-act="sleep" data-min="0">Off</button>' +
      '<button class="chip' + (S.set.sleepMinutes === 15 ? " on" : "") + '" data-act="sleep" data-min="15">15 min</button>' +
      '<button class="chip' + (S.set.sleepMinutes === 30 ? " on" : "") + '" data-act="sleep" data-min="30">30 min</button>' +
      '<button class="chip' + (S.set.sleepMinutes === 60 ? " on" : "") + '" data-act="sleep" data-min="60">1 hour</button>' +
      '<button class="chip' + (S.set.sleepMinutes === "end" ? " on" : "") + '" data-act="sleep" data-min="end">End of track</button>' +
      "</div></div>";

    html += '<div class="set-card"><div class="set-title">Appearance</div>' +
      '<div class="set-row"><div class="set-text"><div class="set-label">Theme</div>' +
      '<div class="set-sub">Default follows the phone</div></div></div>' +
      '<div class="seg small">' +
      '<button class="seg-btn' + (S.set.theme === "default" ? " on" : "") + '" data-act="theme-set" data-theme="default">Default</button>' +
      '<button class="seg-btn' + (S.set.theme === "dark" ? " on" : "") + '" data-act="theme-set" data-theme="dark">Dark</button>' +
      '<button class="seg-btn' + (S.set.theme === "light" ? " on" : "") + '" data-act="theme-set" data-theme="light">Light</button>' +
      "</div></div>";

    html += '<div class="set-card"><div class="set-title">Library</div>' +
      '<div class="stats"><span><b>' + stats.tracks + "</b>songs</span><span><b>" + stats.albums + "</b>albums</span>" +
      "<span><b>" + stats.artists + "</b>artists</span><span><b>" + A.fmtSize(stats.size) + "</b>files</span></div>" +
      '<button class="btn" data-act="add-files">Add music files</button>' +
      '<button class="btn" data-act="add-folder">Add a folder</button>' +
      (A.P.winrt ? '<button class="btn" data-act="scan-library">Scan the Music folder</button>' : "") +
      '<button class="btn btn-ghost danger" data-act="clear-library">Clear library</button></div>';

    html += '<div class="set-card"><div class="set-title">About</div>' +
      '<div class="about"><div>Version <b>' + A.VERSION + "</b></div>" +
      "<div>Engine <b>" + esc(engine) + "</b></div>" +
      "<div>Library <b>" + esc(A.deviceInfo()) + "</b></div>" +
      '<p>MP3Lumia plays MP3, M4A/AAC, FLAC, WAV, OGG and WMA when the device can decode them. Tags and artwork are read from the files; nothing leaves the phone.</p>' +
      '<p>Equalizer: ten bands, presets, preamp and a limiter. On a device without Web Audio the player still works but the EQ is bypassed.</p></div></div>';

    return html + "</div>";
  }

  /* --------------------------------------------------------- now playing */

  function npArt(t) {
    return artDiv(t.id, "np-art" + gradientClass(t.album));
  }

  function trackAlbumId(t) {
    var name = t.album || "Unknown Album";
    var artist = t.albumArtist || t.artist || "Unknown Artist";
    return "al" + A.hashStr(artist.toLowerCase() + "|" + name.toLowerCase());
  }

  function trackArtistId(t) {
    return "ar" + A.hashStr((t.artist || "Unknown Artist").toLowerCase());
  }

  function viewNowPlaying() {
    var np = $("np");
    if (!np) return;
    var t = A.currentTrack();
    if (!t) {
      np.innerHTML = '<div class="np-inner"><div class="np-head">' +
        '<button class="iconbtn" data-act="np-close">' + icon("down") + "</button>" +
        '<div class="np-context"><span>Now playing</span></div><span class="np-spacer"></span></div>' +
        emptyBlock("Nothing playing", "Pick a song and it will appear here.") + "</div>";
      return;
    }
    var q = A.audioQueue();
    var playing = A.isPlaying();
    var liked = A.isLiked(t.id);
    var up = A.upcoming().length;
    var repeatOne = S.set.repeat === "one";
    var hasLyrics = !!(t.lyrics && String(t.lyrics).length);
    var artistId = trackArtistId(t);
    var albumId = trackAlbumId(t);

    var html = '<div class="np-inner">' +
      '<div class="np-head">' +
      '<button class="iconbtn" data-act="np-close" aria-label="Close">' + icon("down") + "</button>" +
      '<div class="np-context"><span>Playing from</span><b>' + esc(q.label || "Your library") + "</b></div>" +
      '<button class="iconbtn" data-act="track-menu" data-id="' + t.id + '" aria-label="More">' + icon("more") + "</button>" +
      "</div>" +
      '<div class="np-body">' +
      (S.set.visualizer ? '<canvas id="npviz" class="npviz"></canvas>' : "") +
      '<div class="np-artwrap">' + npArt(t) + "</div>" +
      '<div class="np-meta"><div class="np-text"><div class="np-title">' + esc(t.title) + "</div>" +
      '<button class="np-artist np-link" data-act="np-artist" data-id="' + esc(artistId) + '" aria-label="Open artist">' + esc(t.artist) + "</button></div>" +
      '<button class="iconbtn like' + (liked ? " on" : "") + '" id="npliked" data-act="like" data-id="' + t.id + '" aria-label="Like">' +
      icon("heart", liked ? "ico-fill" : "") + "</button></div>" +
      '<div class="seek" id="npseek"><div class="seek-track"><div class="seek-fill" id="npfill"></div>' +
      '<div class="seek-knob" id="npknob"></div></div>' +
      '<div class="seek-times"><span id="npcur">0:00</span><span id="npdur">' + fmtTime(t.duration) + "</span></div></div>" +
      '<div class="np-controls">' +
      '<button class="ctl small' + (S.set.shuffle ? " on" : "") + '" id="npshuffle" data-act="shuffle" aria-label="Shuffle">' + icon("shuffle") + "</button>" +
      '<button class="ctl" data-act="prev" aria-label="Previous">' + icon("prev") + "</button>" +
      '<button class="np-play" id="npbtn" data-act="toggle" aria-label="Play or pause">' + icon(playing ? "pause" : "play", "ico-fill") + "</button>" +
      '<button class="ctl" data-act="next" aria-label="Next">' + icon("next") + "</button>" +
      '<button class="ctl small' + (S.set.repeat !== "off" ? " on" : "") + '" id="nprepeat" data-act="repeat" aria-label="Repeat">' +
      icon("repeat") + (repeatOne ? '<span class="one">1</span>' : "") + "</button>" +
      "</div>" +
      '<div class="np-extra">' +
      '<button class="np-mini' + (up ? " badge" : "") + '" data-act="queue" aria-label="Queue">' + icon("queue") + '<span id="npqcount">' + (up || "") + "</span></button>" +
      '<button class="np-mini" data-act="eq" aria-label="Equalizer">' + icon("eq") + "</button>" +
      (hasLyrics ? '<button class="np-mini" data-act="lyrics" aria-label="Lyrics">' + icon("lyrics") + "</button>" : "") +
      '<div class="vol"><button class="np-mini" data-act="mute" aria-label="Volume">' + icon(S.set.muted || S.set.volume === 0 ? "mute" : "volume") + "</button>" +
      '<input type="range" id="npvol" data-act="volume" min="0" max="100" step="1" value="' + Math.round(S.set.volume * 100) + '" aria-label="Volume" /></div>' +
      "</div>" +
      '<div class="np-foot"><button class="np-albumlink np-link" data-act="np-album" data-id="' + esc(albumId) + '" aria-label="Open album">' + esc(t.album) + (t.year ? " \u00b7 " + t.year : "") + "</button></div>" +
      "</div></div>";

    np.innerHTML = html;
    bindSeek();
    startViz();
    paintTransport();
  }

  function renderMini() {
    var mini = $("mini");
    if (!mini) return;
    var t = A.currentTrack();
    if (!t) {
      mini.className = "mini";
      mini.innerHTML = "";
      return;
    }
    var playing = A.isPlaying();
    mini.className = "mini on";
    mini.innerHTML =
      artDiv(t.id, "mini-art") +
      '<div class="mini-text" data-act="np-open"><div class="mini-title">' + esc(t.title) + "</div>" +
      '<div class="mini-sub">' + esc(t.artist) + "</div></div>" +
      '<button class="mini-btn" id="minibtn" data-act="toggle" aria-label="Play or pause">' + icon(playing ? "pause" : "play", "ico-fill") + "</button>" +
      '<div class="mini-seek"><div id="minifill"></div></div>';
    paintTransport();
  }

  function paintTransport() {
    var t = A.currentTrack();
    var playing = A.isPlaying();
    var pos = A.position ? A.position() : { pos: 0, dur: t ? t.duration : 0 };
    var el = $("minibtn"), np = $("npbtn");
    if (el) el.innerHTML = icon(playing ? "pause" : "play", "ico-fill");
    if (np) np.innerHTML = icon(playing ? "pause" : "play", "ico-fill");

    var dur = pos.dur || (t ? t.duration : 0);
    var pct = dur > 0 ? clamp((pos.pos / dur) * 100, 0, 100) : 0;

    var mf = $("minifill");
    if (mf) mf.style.width = pct + "%";

    if (npVisible) {
      var fill = $("npfill"), knob = $("npknob");
      if (fill) fill.style.width = pct + "%";
      if (knob) knob.style.left = pct + "%";
      var cur = $("npcur"), d = $("npdur");
      if (cur) cur.textContent = fmtTime(pos.pos);
      if (d && dur) d.textContent = fmtTime(dur);
      var liked = $("npliked");
      if (liked && t) {
        var on = A.isLiked(t.id);
        liked.className = "iconbtn like" + (on ? " on" : "");
        liked.innerHTML = icon("heart", on ? "ico-fill" : "");
      }
      var sh = $("npshuffle");
      if (sh) sh.className = "ctl small" + (S.set.shuffle ? " on" : "");
      var rp = $("nprepeat");
      if (rp) {
        rp.className = "ctl small" + (S.set.repeat !== "off" ? " on" : "");
        rp.innerHTML = icon("repeat") + (S.set.repeat === "one" ? '<span class="one">1</span>' : "");
      }
      var qc = $("npqcount");
      if (qc) {
        var n = A.upcoming().length;
        qc.textContent = n ? String(n) : "";
        var qb = qc.parentNode;
        if (qb) qb.className = "np-mini" + (n ? " badge" : "");
      }
    }
  }

  function bindSeek() {
    var seek = $("npseek");
    if (!seek || seek.getAttribute("data-wired") === "1") return;
    seek.setAttribute("data-wired", "1");
    var dragging = false;

    function ratioAt(clientX) {
      var r = seek.getBoundingClientRect();
      if (!r.width) return 0;
      return clamp((clientX - r.left) / r.width, 0, 1);
    }
    function preview(r) {
      var fill = $("npfill"), knob = $("npknob"), cur = $("npcur");
      if (fill) fill.style.width = (r * 100) + "%";
      if (knob) knob.style.left = (r * 100) + "%";
      var pos = A.position ? A.position() : { dur: 0 };
      if (cur) cur.textContent = fmtTime((pos.dur || 0) * r);
    }
    function move(e) { if (dragging) preview(ratioAt(e.clientX)); }
    function release(e) {
      document.removeEventListener("pointermove", move, false);
      document.removeEventListener("pointerup", release, false);
      document.removeEventListener("pointercancel", release, false);
      if (!dragging) return;
      dragging = false;
      A.seekRatio(ratioAt(e.clientX));
    }
    function down(e) {
      dragging = true;
      try { seek.setPointerCapture(e.pointerId); } catch (err) { }
      preview(ratioAt(e.clientX));
      document.addEventListener("pointermove", move, false);
      document.addEventListener("pointerup", release, false);
      document.addEventListener("pointercancel", release, false);
      e.preventDefault();
    }

    if (window.PointerEvent) {
      seek.addEventListener("pointerdown", down, false);
    } else {
      seek.addEventListener("mousedown", function (e) {
        down({ clientX: e.clientX, pointerId: 1, preventDefault: function () { e.preventDefault(); } });
      }, false);
    }
  }

  function startViz() {
    stopViz();
    if (!S.set.visualizer) return;
    var canvas = $("npviz");
    if (!canvas) return;
    var g = canvas.getContext("2d");
    if (!g) return;

    function frame() {
      vizRaf = requestAnimationFrame(frame);
      var w = canvas.clientWidth || 320, h = canvas.clientHeight || 46;
      var dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      var data = A.analyserData ? A.analyserData() : null;
      var bars = 36, bw = w / bars, i;
      for (i = 0; i < bars; i++) {
        var v = 0;
        if (data) {
          var idx = Math.floor(Math.pow(i / bars, 1.7) * (data.length * 0.55));
          v = data[idx] / 255;
        }
        var bh = Math.max(2, v * (h - 4));
        g.fillStyle = "rgba(30,215,96," + (0.28 + v * 0.72) + ")";
        g.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 2), bh);
      }
    }
    vizRaf = requestAnimationFrame(frame);
  }

  function stopViz() {
    if (vizRaf) { cancelAnimationFrame(vizRaf); vizRaf = null; }
  }

  /* --------------------------------------------------------------- sheets */

  function openSheet(kind, html, cls) {
    sheetKind = kind;
    var s = $("sheet");
    if (!s) return;
    s.innerHTML = '<div class="sheet-card ' + (cls || "") + '" data-act="sheet-keep">' +
      '<div class="sheet-grab"></div>' + html + "</div>";
    s.className = "sheet open";
    A.queueArt();
  }

  function closeSheet() {
    sheetKind = null;
    sheetId = null;
    var s = $("sheet");
    if (!s) return;
    s.className = "sheet";
    setTimeout(function () { if (!sheetKind && s) s.innerHTML = ""; }, 220);
  }

  function sheetHead(title, sub) {
    return '<div class="sheet-head"><div><div class="sheet-title">' + esc(title) + "</div>" +
      (sub ? '<div class="sheet-sub">' + esc(sub) + "</div>" : "") + "</div>" +
      '<button class="iconbtn" data-act="sheet-close" aria-label="Close">' + icon("close") + "</button></div>";
  }

  function addMusicSheet() {
    var html = sheetHead("Add music", "Files stay on this device") +
      '<button class="menu-row" data-act="add-files">' + icon("file") + "<span><b>Add music files</b><small>Pick one or many songs</small></span></button>" +
      '<button class="menu-row" data-act="add-folder">' + icon("folder") + "<span><b>Add a folder</b><small>Import every song inside it</small></span></button>" +
      (A.P.winrt ? '<button class="menu-row" data-act="scan-library">' + icon("music") + "<span><b>Scan the Music folder</b><small>Everything in This Device \\ Music</small></span></button>" : "") +
      '<button class="menu-row" data-act="new-playlist">' + icon("plus") + "<span><b>New playlist</b><small>An empty mix to fill</small></span></button>";
    openSheet("add", html);
  }

  function trackSheet(id) {
    var t = A.byId(id);
    if (!t) return;
    sheetId = id;
    var liked = A.isLiked(id);
    var inPlaylist = S.route.name === "playlist" ? A.playlistById(S.route.param) : null;
    var route = S.route;

    var html = '<div class="sheet-track">' + artDiv(id, "sheet-art" + gradientClass(t.album)) +
      '<div class="sheet-track-text"><div class="sheet-title">' + esc(t.title) + "</div>" +
      '<div class="sheet-sub">' + esc(t.artist) + " \u00b7 " + esc(t.album) + "</div></div></div>";
    html += '<button class="menu-row" data-act="add-next" data-id="' + id + '">' + icon("next") + "<span><b>Play next</b></span></button>";
    html += '<button class="menu-row" data-act="add-queue" data-id="' + id + '">' + icon("queue") + "<span><b>Add to queue</b></span></button>";
    html += '<button class="menu-row" data-act="like" data-id="' + id + '">' + icon("heart", liked ? "ico-fill" : "") +
      "<span><b>" + (liked ? "Remove from Liked Songs" : "Save to Liked Songs") + "</b></span></button>";
    html += '<button class="menu-row" data-act="add-to-playlist" data-id="' + id + '">' + icon("plus") + "<span><b>Add to playlist</b></span></button>";
    html += '<button class="menu-row" data-act="edit-track" data-id="' + id + '">' + icon("file") + "<span><b>Edit metadata</b><small>Title, artist, album, year, lyrics</small></span></button>";
    if (route.name === "album") html += '<button class="menu-row" data-act="menu-album" data-id="' + route.param + '">' + icon("music") + "<span><b>Go to album</b></span></button>";
    else html += '<button class="menu-row" data-act="menu-track-album" data-id="' + id + '">' + icon("music") + "<span><b>Go to album</b></span></button>";
    if (route.name === "artist") html += '<button class="menu-row" data-act="menu-artist" data-id="' + route.param + '">' + icon("music") + "<span><b>Go to artist</b></span></button>";
    else html += '<button class="menu-row" data-act="menu-track-artist" data-id="' + id + '">' + icon("music") + "<span><b>Go to artist</b></span></button>";
    if (inPlaylist) {
      html += '<button class="menu-row" data-act="remove-from-playlist" data-id="' + id + '" data-pl="' + inPlaylist.id + '">' +
        icon("trash") + "<span><b>Remove from this playlist</b></span></button>";
    }
    if (t.lyrics) html += '<button class="menu-row" data-act="lyrics" data-id="' + id + '">' + icon("lyrics") + "<span><b>Show lyrics</b></span></button>";
    html += '<button class="menu-row danger" data-act="remove-track" data-id="' + id + '">' + icon("trash") +
      "<span><b>Remove from library</b><small>The file itself is not deleted</small></span></button>";
    html += '<div class="sheet-foot">' + esc(t.name) + (t.size ? " \u00b7 " + A.fmtSize(t.size) : "") +
      (t.year ? " \u00b7 " + t.year : "") + (t.genre ? " \u00b7 " + esc(t.genre) : "") + "</div>";
    openSheet("track", html);
  }

  function addToPlaylistSheet(id) {
    sheetId = id;
    var t = A.byId(id);
    var html = sheetHead("Add to playlist", t ? t.title : "");
    html += '<button class="menu-row" data-act="new-playlist" data-add="' + esc(id) + '">' + icon("plus") +
      "<span><b>New playlist</b></span></button>";
    var i;
    for (i = 0; i < S.playlists.length; i++) {
      var p = S.playlists[i];
      var has = p.tracks.indexOf(id) >= 0;
      html += '<button class="menu-row" data-act="playlist-add" data-pl="' + p.id + '" data-id="' + esc(id) + '">' +
        icon(has ? "check" : "plus") + "<span><b>" + esc(p.name) + "</b><small>" + p.tracks.length + " songs</small></span></button>";
    }
    if (!S.playlists.length) html += '<div class="hint">No playlists yet. Create one and this song goes straight in.</div>';
    openSheet("addpl", html);
  }

  function queueSheet() {
    var q = A.audioQueue();
    var cur = q.queue[q.index] ? A.byId(q.queue[q.index]) : null;
    var up = A.upcoming();
    var html = '<div class="sheet-head"><div><div class="sheet-title">Queue</div>' +
      '<div class="sheet-sub">' + esc(q.label || "Your library") + "</div></div>" +
      '<button class="txt-btn" data-act="queue-clear">Clear</button>' +
      '<button class="iconbtn" data-act="sheet-close">' + icon("close") + "</button></div>";

    if (cur) {
      html += '<div class="q-now"><div class="q-label">Now playing</div>' +
        '<div class="q-row on" data-act="np-open">' + artDiv(cur.id, "q-art") +
        '<span class="q-main"><span class="q-t">' + esc(cur.title) + '</span><span class="q-s">' + esc(cur.artist) + "</span></span>" +
        '<span class="q-eq"><span class="eqbars on"><i></i><i></i><i></i></span></span></div></div>';
    } else {
      html += '<div class="hint">Nothing is playing.</div>';
    }

    html += '<div class="q-label up">Next up</div>';
    if (!up.length) {
      html += '<div class="hint">The queue is empty. Use a song\u2019s menu to add one.</div>';
    } else {
      for (var i = 0; i < up.length; i++) {
        var t = up[i].track, idx = up[i].index;
        html += '<div class="q-row" data-act="queue-play" data-i="' + idx + '">' +
          '<span class="q-num">' + (i + 1) + "</span>" +
          '<span class="q-main"><span class="q-t">' + esc(t.title) + '</span><span class="q-s">' + esc(t.artist) + "</span></span>" +
          '<button class="q-btn" data-act="queue-up" data-i="' + idx + '" aria-label="Move up">' + icon("up") + "</button>" +
          '<button class="q-btn" data-act="queue-down" data-i="' + idx + '" aria-label="Move down">' + icon("down") + "</button>" +
          '<button class="q-btn" data-act="queue-remove" data-i="' + idx + '" aria-label="Remove">' + icon("close") + "</button>" +
          "</div>";
      }
    }
    html += '<div class="sheet-foot">' + (up.length + (cur ? 1 : 0)) + " songs in the queue</div>";
    openSheet("queue", html, "tall");
  }

  function eqBandRow(i) {
    return '<div class="eq-row"><span class="eq-freq">' + A.EQ_LABELS[i] + "</span>" +
      '<input type="range" min="-12" max="12" step="0.5" value="' + S.set.eq[i] + '" data-eq="' + i + '" aria-label="' + A.EQ_LABELS[i] + ' Hz" />' +
      '<span class="eq-val" data-eqv="' + i + '">' + (S.set.eq[i] > 0 ? "+" : "") + S.set.eq[i] + "</span></div>";
  }

  function eqSheet() {
    var names = A.presetNames();
    var html = sheetHead("Equalizer", A.eqAvailable() ? "10 bands \u00b7 \u00b1 12 dB" : "Not available on this device");
    if (!A.eqAvailable()) {
      html += '<div class="hint">This device\u2019s browser engine has no Web Audio, so the equalizer is bypassed. Playback still works.</div>';
      openSheet("eq", html);
      return;
    }

    html += '<canvas id="eqcurve" class="eq-curve" width="640" height="150"></canvas>';
    html += '<div class="preset-wrap">';
    for (var i = 0; i < names.length; i++) {
      html += '<button class="chip' + (S.set.eqPreset === names[i] ? " on" : "") + '" data-act="eq-preset" data-name="' + esc(names[i]) + '">' + esc(names[i]) + "</button>";
    }
    html += "</div>";

    html += '<div class="eq-head"><span>Preamp</span><span class="eq-preamp">' +
      '<button class="mini-step" data-act="preamp" data-d="-1">\u2212</button>' +
      '<input type="range" min="-12" max="12" step="1" value="' + S.set.preamp + '" data-preamp="1" aria-label="Preamp" />' +
      '<button class="mini-step" data-act="preamp" data-d="1">+</button>' +
      '<span class="eq-val" id="eqpre">' + (S.set.preamp > 0 ? "+" : "") + S.set.preamp + "</span></span></div>";

    html += '<div class="eq-bands">';
    for (i = 0; i < 10; i++) html += eqBandRow(i);
    html += "</div>";

    html += '<div class="eq-actions">' +
      '<button class="btn sm" data-act="eq-reset">Reset</button>' +
      '<button class="btn sm" data-act="eq-toggle">' + (S.set.eqOn ? "Bypass EQ" : "Enable EQ") + "</button>" +
      "</div>";

    html += '<div class="eq-save"><input id="eqname" type="text" placeholder="Save these settings as\u2026" maxlength="24" />' +
      '<button class="btn sm btn-primary" data-act="eq-save">Save</button></div>';

    var customs = [], ck;
    for (ck in S.set.eqCustom) if (S.set.eqCustom.hasOwnProperty(ck)) customs.push(ck);
    if (customs.length) {
      html += '<div class="your-presets"><div class="sheet-sub">Your presets</div>';
      for (var c = 0; c < customs.length; c++) {
        html += '<div class="your-preset"><b>' + esc(customs[c]) + '</b>' +
          '<button class="iconbtn" data-act="eq-del" data-name="' + esc(customs[c]) + '" aria-label="Delete preset">' + icon("trash") + "</button></div>";
      }
      html += "</div>";
    }

    html += '<div class="sheet-foot">31 Hz \u2013 16 kHz, high-shelf and low-shelf ends, peaking bands with Q 1.1. Ten bands, preamp, limiter, and your own presets stay on this device.</div>';
    openSheet("eq", html, "tall");
    setTimeout(drawEQCurve, 0);
  }

  function drawEQCurve() {
    var canvas = $("eqcurve");
    if (!canvas) return;
    var g = canvas.getContext("2d");
    if (!g) return;
    var w = canvas.width, h = canvas.height, i, b, x, y, f, gain, oct, width, t;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(127,127,127,0.20)";
    g.lineWidth = 1;
    for (i = 1; i < 4; i++) { x = w * i / 4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();

    var pts = [];
    for (i = 0; i <= 160; i++) {
      t = i / 160;
      f = 20 * Math.pow(1000, t);
      gain = 0;
      for (b = 0; b < 10; b++) {
        oct = Math.log(f / A.EQ_FREQS[b]) / Math.LN2;
        width = (b === 0 || b === 9) ? 1.7 : 1.0;
        gain += S.set.eq[b] * Math.exp(-(oct * oct) / (2 * width * width));
      }
      y = h / 2 - (gain / 15) * (h * 0.44);
      pts.push([t * w, clamp(y, 2, h - 2)]);
    }

    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(30,215,96,0.30)");
    grad.addColorStop(1, "rgba(30,215,96,0)");
    g.beginPath();
    g.moveTo(0, h / 2);
    for (i = 0; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineTo(w, h / 2);
    g.closePath();
    g.fillStyle = grad;
    g.fill();

    g.beginPath();
    for (i = 0; i < pts.length; i++) {
      if (i === 0) g.moveTo(pts[i][0], pts[i][1]);
      else g.lineTo(pts[i][0], pts[i][1]);
    }
    g.strokeStyle = "#1ed760";
    g.lineWidth = 3;
    g.stroke();
  }

  function refreshEQ() {
    if (sheetKind !== "eq") return;
    var i;
    for (i = 0; i < 10; i++) {
      var input = document.querySelector('[data-eq="' + i + '"]');
      if (input) input.value = S.set.eq[i];
      var label = document.querySelector('[data-eqv="' + i + '"]');
      if (label) label.textContent = (S.set.eq[i] > 0 ? "+" : "") + S.set.eq[i];
    }
    var pre = document.querySelector("[data-preamp]");
    if (pre) pre.value = S.set.preamp;
    var preLabel = $("eqpre");
    if (preLabel) preLabel.textContent = (S.set.preamp > 0 ? "+" : "") + S.set.preamp;
    var chips = document.querySelectorAll("[data-act='eq-preset']");
    for (i = 0; i < chips.length; i++) {
      chips[i].className = "chip" + (chips[i].getAttribute("data-name") === S.set.eqPreset ? " on" : "");
    }
    drawEQCurve();
  }

  function refreshQueue() {
    if (sheetKind === "queue") queueSheet();
  }

  function lyricsSheet(id) {
    var t = A.byId(id || (A.currentTrack() ? A.currentTrack().id : null));
    if (!t) return;
    var text = String(t.lyrics || "").replace(/\r/g, "");
    var html = sheetHead(t.title, t.artist);
    if (!text) html += '<div class="hint">No lyrics are stored in this file.</div>';
    else {
      var lines = text.split("\n");
      html += '<div class="lyrics">';
      for (var i = 0; i < lines.length; i++) html += "<p>" + (lines[i] ? esc(lines[i]) : "&nbsp;") + "</p>";
      html += "</div>";
    }
    openSheet("lyrics", html, "tall");
  }

  function playlistMenu(id) {
    var p = A.playlistById(id);
    if (!p) return;
    sheetId = id;
    var html = sheetHead(p.name, "Playlist \u00b7 " + p.tracks.length + " songs") +
      '<button class="menu-row" data-act="rename-playlist" data-id="' + id + '">' + icon("file") + "<span><b>Rename playlist</b></span></button>" +
      '<button class="menu-row" data-act="playlist-play" data-id="' + id + '">' + icon("play") + "<span><b>Play</b></span></button>" +
      '<button class="menu-row danger" data-act="delete-playlist" data-id="' + id + '">' + icon("trash") + "<span><b>Delete playlist</b><small>Songs stay in your library</small></span></button>";
    openSheet("plmenu", html);
  }

  function newPlaylistSheet(editId) {
    var p = editId ? A.playlistById(editId) : null;
    var html = '<div class="sheet-head"><div class="sheet-title">' + (p ? "Rename playlist" : "New playlist") + "</div>" +
      '<button class="iconbtn" data-act="sheet-close">' + icon("close") + "</button></div>" +
      '<div class="field"><label for="plname">Name</label>' +
      '<input id="plname" type="text" maxlength="40" value="' + (p ? esc(p.name) : "") + '" placeholder="My playlist" /></div>' +
      '<button class="btn btn-primary wide" data-act="create-playlist" data-edit="' + (editId || "") + '">' + (p ? "Save" : "Create") + "</button>";
    openSheet("newpl", html);
    setTimeout(function () {
      var input = $("plname");
      if (input) { try { input.focus(); } catch (e) { } }
    }, 120);
  }

  function albumMenu(id) {
    var al = A.album(id);
    if (!al) return;
    var key = "album:" + id;
    sheetId = id;
    var html = sheetHead(al.name, al.artist) +
      '<button class="menu-row" data-act="play-list" data-l="' + key + '">' + icon("play") + "<span><b>Play album</b></span></button>" +
      '<button class="menu-row" data-act="shuffle-list" data-l="' + key + '">' + icon("shuffle") + "<span><b>Shuffle album</b></span></button>" +
      '<button class="menu-row" data-act="queue-album" data-id="' + id + '">' + icon("queue") + "<span><b>Add album to queue</b></span></button>" +
      '<button class="menu-row" data-act="like-album" data-id="' + id + '">' + icon("heart") + "<span><b>Like every song</b></span></button>" +
      '<button class="menu-row" data-act="edit-album" data-id="' + id + '">' + icon("file") + "<span><b>Edit album info</b><small>Name, artist, year, genre</small></span></button>";
    openSheet("albummenu", html);
  }

  function confirmSheet(title, body, act, data) {
    var html = '<div class="sheet-head"><div class="sheet-title">' + esc(title) + "</div>" +
      '<button class="iconbtn" data-act="sheet-close">' + icon("close") + "</button></div>" +
      '<div class="confirm-body">' + esc(body) + "</div>" +
      '<div class="sheet-actions"><button class="btn" data-act="sheet-close">Cancel</button>' +
      '<button class="btn btn-danger" data-act="' + act + '"' + (data || "") + ">Delete</button></div>";
    openSheet("confirm", html);
  }

  /* --------------------------------------------------------------- render */

  function routeKey() {
    return S.route.name + "|" + (S.route.param || "");
  }

  function render() {
    var main = $("main");
    if (!main) return;
    var key = routeKey();
    var changed = key !== lastRouteKey;
    lastRouteKey = key;

    var back = $("back");
    if (back) back.className = "iconbtn back" + (S.route.name === "album" || S.route.name === "artist" ||
      S.route.name === "playlist" || S.route.name === "liked" || S.route.name === "genre" ? " on" : "");

    var html = "";
    switch (S.route.name) {
      case "home": html = viewHome(); break;
      case "search": html = viewSearch(); break;
      case "library": html = viewLibrary(); break;
      case "settings": html = viewSettings(); break;
      case "album": html = viewAlbum(S.route.param); break;
      case "artist": html = viewArtist(S.route.param); break;
      case "playlist": html = viewPlaylist(S.route.param); break;
      case "liked": html = viewLiked(); break;
      case "genre": html = viewGenre(S.route.param); break;
      default: html = viewHome();
    }
    main.innerHTML = html;

    var tabs = document.querySelectorAll("[data-tabbtn]");
    for (var i = 0; i < tabs.length; i++) {
      var tname = tabs[i].getAttribute("data-tabbtn");
      tabs[i].className = "tab" + ((tname === S.route.name ||
        (tname === "library" && (S.route.name === "album" || S.route.name === "artist" ||
         S.route.name === "playlist" || S.route.name === "liked" || S.route.name === "genre"))) ? " on" : "");
    }

    if (changed) { try { main.scrollTop = 0; } catch (e) { } }
    renderMini();
    A.queueArt();
  }

  function refreshPlayback() {
    renderMini();
    if (npVisible) viewNowPlaying();
    var t = A.currentTrack();
    try {
      document.title = t ? (t.title + " \u00b7 " + t.artist + " \u2014 MP3Lumia") : "MP3Lumia";
    } catch (e) { }
  }

  /* ------------------------------------------------------------------ api */

  A.render = render;
  A.refreshPlayback = refreshPlayback;
  A.paintTransport = paintTransport;
  A.refreshEQ = refreshEQ;
  A.refreshQueue = refreshQueue;
  A.refreshSettings = function () { if (S.route.name === "settings") A.render(); };

  A.openNowPlaying = function () {
    npVisible = true;
    var np = $("np");
    if (np) np.className = "np open";
    viewNowPlaying();
    A.queueArt();
  };
  A.closeNowPlaying = function () {
    npVisible = false;
    stopViz();
    var np = $("np");
    if (np) np.className = "np";
  };
  A.nowPlayingOpen = function () { return npVisible; };

  A.openSheet = openSheet;
  A.closeSheet = closeSheet;
  A.showAddMenu = addMusicSheet;
  A.showTrackMenu = trackSheet;
  A.showAddToPlaylist = addToPlaylistSheet;
  A.showQueue = queueSheet;
  A.showEQ = eqSheet;
  A.showLyrics = lyricsSheet;
  A.showPlaylistMenu = playlistMenu;
  A.showNewPlaylist = newPlaylistSheet;
  A.showAlbumMenu = albumMenu;
  A.showConfirm = confirmSheet;
  A.sheetKind = function () { return sheetKind; };

  A.setLibTab = function (tab) { libTab = tab; };
  A.libTab = function () { return libTab; };
  A.setSearchFilter = function (f) { searchFilter = f; };
  A.searchFilter = function () { return searchFilter; };

  A.onSearchInput = function (value) {
    searchQuery = value;
    var box = $("searchres");
    if (box) { box.innerHTML = searchResultsHtml(); A.queueArt(); }
    var clear = document.querySelector(".sbc");
    if (clear) clear.className = "sbc" + (value ? "" : " hidden");
  };
  A.searchQuery = function () { return searchQuery; };
  A.clearSearch = function () { searchQuery = ""; searchFilter = "all"; render(); };
  A.refreshSearch = function () {
    var box = $("searchres");
    if (box) { box.innerHTML = searchResultsHtml(); A.queueArt(); }
  };
  A.artDiv = artDiv;
  A.sectionHead = sectionHead;
  A.renderMini = renderMini;
  A.viewNowPlaying = viewNowPlaying;
})();
