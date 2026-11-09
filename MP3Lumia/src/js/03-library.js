/* MP3Lumia — the library: importing files, reading their tags, grouping them
   into albums / artists / genres, playlists, likes, search and the recently
   played history. No network: everything lives in localStorage plus the files
   themselves. */
(function () {
  "use strict";

  var A = window.MP3;
  var S = A.S;
  var now = A.now, norm = A.normText, hashStr = A.hashStr;
  var folderName = A.folderName, cleanName = A.cleanName, isAudio = A.isAudio;
  var byId = A.byId, saveLibSoon = A.saveLibSoon, toast = A.toast;

  var files = A.files;
  var P = A.P;

  var groups = { albums: [], artists: [], genres: [] };
  var albumById = {}, artistById = {};

  var META_MAX = 3;
  var metaQueue = [];
  var metaActive = 0;
  var probeChain = Promise.resolve();

  /* ------------------------------------------------------------- naming */

  function guessFromName(rec) {
    var base = cleanName(rec.name || rec.path || "Track");
    var artist = "";
    var title = base;
    var trackNo = 0;

    var tn = base.match(/^(\d{1,3})[\s._-]+(.+)$/);
    if (tn) {
      trackNo = parseInt(tn[1], 10);
      base = tn[2];
      title = base;
    }

    var parts = base.split(/\s+-\s+/);
    if (parts.length === 2) {
      artist = parts[0];
      title = parts[1];
    } else if (parts.length > 2) {
      artist = parts[0];
      title = parts[parts.length - 1];
    }

    var folder = folderName(rec.path || "");
    var generic = /^(music|downloads|download|audio|songs|mp3|mp3s|media|sdcard|storage|dcim|albums|unknown|new folder)$/i;
    var album = folder && !generic.test(folder) ? folder : "";

    return {
      title: norm(title) || cleanName(rec.name),
      artist: norm(artist),
      album: norm(album),
      trackNo: trackNo
    };
  }

  function fillFallbacks(rec) {
    var g = guessFromName(rec);
    if (!rec.title) rec.title = g.title;
    if (!rec.artist) rec.artist = g.artist;
    if (!rec.album) rec.album = g.album;
    if (!rec.trackNo) rec.trackNo = g.trackNo;
    if (!rec.artist) rec.artist = "Unknown Artist";
    if (!rec.album) rec.album = "Unknown Album";
    if (!rec.albumArtist) rec.albumArtist = rec.artist;
    rec.title = norm(rec.title) || cleanName(rec.name);
    rec.artist = norm(rec.artist) || "Unknown Artist";
    rec.album = norm(rec.album) || "Unknown Album";
    rec.albumArtist = norm(rec.albumArtist) || rec.artist;
    rec.genre = norm(rec.genre);
  }

  /* --------------------------------------------------------------- import */

  function trackIdFor(name, path, size) {
    return "t" + hashStr(String(path || name).toLowerCase() + "|" +
                         String(name).toLowerCase() + "|" + (size || 0));
  }

  function addRefs(refs) {
    var added = [], skipped = 0, i, ref, name, path, size, id;

    for (i = 0; i < refs.length; i++) {
      ref = refs[i];
      if (!ref) continue;
      name = ref.name || (ref.file && ref.file.name) || "";
      if (!isAudio(name)) continue;
      path = ref.path || ref.webkitRelativePath || name;
      size = ref.size || 0;
      id = trackIdFor(name, path, size);

      if (byId(id)) { skipped++; continue; }

      var rec = {
        id: id,
        name: name,
        path: path,
        ext: A.extOf(name),
        size: size,
        dateAdded: now(),
        modified: ref.lastModified || 0,
        duration: 0,
        title: "", artist: "", albumArtist: "", album: "", genre: "",
        year: 0, trackNo: 0, trackTotal: 0, discNo: 0, discTotal: 0,
        composer: "", replayGain: 0, lastPlayed: 0, tagged: false
      };
      fillFallbacks(rec);
      S.lib.push(rec);
      files[id] = ref;
      if (P.winrt) { try { A.tokenFor(id, ref); } catch (e) { } }
      added.push(rec);
      metaQueue.push(rec);
    }

    if (added.length) {
      saveLibSoon();
      rebuildGroups();
      pumpMeta();
      A.paintSoon();
    }
    return { added: added, skipped: skipped };
  }

  function vecToString(list) {
    var out = [], i;
    try {
      if (list) {
        for (i = 0; i < list.length; i++) out.push(String(list[i]));
      }
    } catch (e) { }
    return out;
  }

  function winrtMeta(sf) {
    return new Promise(function (resolve) {
      var props;
      try { props = sf.properties; } catch (e) { resolve({}); return; }
      if (!props || !props.getMusicPropertiesAsync) { resolve({}); return; }
      props.getMusicPropertiesAsync().then(function (p) {
        var tags = {
          title: norm(p.title),
          artist: norm(p.artist),
          albumArtist: norm(p.albumArtist),
          album: norm(p.album),
          genre: A.genreName(vecToString(p.genre).join(";")),
          year: p.year || 0,
          trackNo: p.trackNumber || 0,
          discNo: p.discNumber || 0,
          composer: (function () { return vecToString(p.composers).join(", "); })(),
          duration: p.duration ? p.duration / 10000000 : 0,
          replayGain: 0,
          picture: null
        };
        var basic = null;
        try { basic = sf.getBasicPropertiesAsync ? sf.getBasicPropertiesAsync() : null; } catch (e) { basic = null; }
        if (basic && basic.then) {
          basic.then(function (bp) {
            if (bp && bp.size) {
              var t = byIdSafe(sf);
              if (t) {
                t.size = bp.size;
                if (bp.dateModified) t.modified = new Date(bp.dateModified).getTime();
              }
            }
            resolve(tags);
          }, function () { resolve(tags); });
        } else resolve(tags);
      }, function () { resolve({}); });
    });
  }

  function byIdSafe(sf) {
    for (var i = 0; i < S.lib.length; i++) if (files[S.lib[i].id] === sf) return S.lib[i];
    return null;
  }

  function applyTags(rec, tags) {
    var had = false;
    if (tags.title) { rec.title = norm(tags.title); had = true; }
    if (tags.artist) { rec.artist = norm(tags.artist); had = true; }
    if (tags.albumArtist) { rec.albumArtist = norm(tags.albumArtist); had = true; }
    if (tags.album) { rec.album = norm(tags.album); had = true; }
    if (tags.genre) { rec.genre = norm(tags.genre); had = true; }
    if (tags.year) rec.year = parseInt(tags.year, 10) || 0;
    if (tags.trackNo) rec.trackNo = parseInt(tags.trackNo, 10) || 0;
    if (tags.trackTotal) rec.trackTotal = parseInt(tags.trackTotal, 10) || 0;
    if (tags.discNo) rec.discNo = parseInt(tags.discNo, 10) || 0;
    if (tags.composer) rec.composer = norm(tags.composer);
    if (tags.lyrics) rec.lyrics = String(tags.lyrics);
    if (tags.replayGain) rec.replayGain = parseFloat(tags.replayGain) || 0;
    if (tags.duration && !rec.duration) rec.duration = tags.duration;
    if (!rec.albumArtist) rec.albumArtist = rec.artist;
    rec.tagged = had;
    fillFallbacks(rec);
    rebuildGroups();
    saveLibSoon();
    A.paintSoon();
  }

  function probeDuration(rec, file) {
    if (!file || !file.size || rec.duration > 0) return Promise.resolve();
    probeChain = probeChain.then(function () {
      return new Promise(function (resolve) {
        var url, audio, done = false;
        function finish(d) {
          if (done) return;
          done = true;
          try { audio.removeAttribute("src"); audio.load(); } catch (e) { }
          try { URL.revokeObjectURL(url); } catch (e2) { }
          if (d > 0 && !rec.duration) {
            rec.duration = d;
            rebuildGroups();
            saveLibSoon();
            A.paintSoon();
          }
          resolve();
        }
        try {
          url = URL.createObjectURL(file);
          audio = new Audio();
          audio.preload = "metadata";
          audio.addEventListener("loadedmetadata", function () {
            finish(isFinite(audio.duration) ? audio.duration : 0);
          }, false);
          audio.addEventListener("error", function () { finish(0); }, false);
          audio.src = url;
          setTimeout(function () { finish(0); }, 9000);
        } catch (e) { finish(0); }
      });
    });
    return probeChain;
  }

  function pumpMeta() {
    while (metaActive < META_MAX && metaQueue.length) {
      (function (rec) {
        metaActive++;
        var ref = files[rec.id];
        var p;

        if (ref && ref.getMusicPropertiesAsync === undefined && ref.properties && ref.properties.getMusicPropertiesAsync) {
          p = winrtMeta(ref).then(function (tags) { applyTags(rec, tags); });
        } else if (ref && ref.slice && ref.size !== undefined) {
          p = window.MP3Meta.read(ref).then(function (tags) {
            if (tags.picture) {
              try { A.setArt(rec.id, URL.createObjectURL(tags.picture)); } catch (e) { }
              delete tags.picture;
            }
            applyTags(rec, tags);
            return probeDuration(rec, ref);
          });
        } else if (ref && P.winrt && ref.getBasicPropertiesAsync) {
          p = winrtMeta(ref).then(function (tags) { applyTags(rec, tags); });
        } else {
          p = Promise.resolve();
        }

        p["then"](function () {
          metaActive--;
          pumpMeta();
        }, function () {
          metaActive--;
          fillFallbacks(rec);
          A.paintSoon();
          pumpMeta();
        });
      })(metaQueue.shift());
    }
  }

  /* ---------------------------------------------------------------- groups */

  function rebuildGroups() {
    var map = {}, artists = {}, genres = {}, i, t;
    var list = [];

    for (i = 0; i < S.lib.length; i++) {
      t = S.lib[i];
      var albumName = t.album || "Unknown Album";
      var albumArtist = t.albumArtist || t.artist || "Unknown Artist";
      var albumKey = "al" + hashStr(albumArtist.toLowerCase() + "|" + albumName.toLowerCase());
      var artistKey = "ar" + hashStr((t.artist || "Unknown Artist").toLowerCase());

      var al = map[albumKey];
      if (!al) {
        al = map[albumKey] = {
          id: albumKey, name: albumName, artist: albumArtist,
          tracks: [], year: t.year || 0, artId: null, added: t.dateAdded || 0,
          duration: 0, genres: []
        };
        list.push(al);
      }
      al.tracks.push(t);
      al.added = Math.max(al.added, t.dateAdded || 0);
      if (!al.artId) al.artId = t.id;
      if (t.year && (!al.year || t.year < al.year)) al.year = t.year;
      if (t.duration) al.duration += t.duration;
      if (t.genre && al.genres.indexOf(t.genre) < 0) al.genres.push(t.genre);

      var ar = artists[artistKey];
      if (!ar) {
        ar = artists[artistKey] = {
          id: artistKey, name: t.artist || "Unknown Artist",
          tracks: [], albums: [], artId: null, duration: 0
        };
      }
      ar.tracks.push(t);
      if (ar.albums.indexOf(albumKey) < 0) ar.albums.push(albumKey);
      if (!ar.artId) ar.artId = t.id;
      if (t.duration) ar.duration += t.duration;

      var gname = t.genre || "";
      if (gname) {
        if (!genres[gname]) genres[gname] = { name: gname, id: "gn" + hashStr(gname.toLowerCase()), tracks: [], artId: t.id };
        genres[gname].tracks.push(t);
      }
    }

    for (i = 0; i < list.length; i++) {
      list[i].tracks.sort(albumOrder);
    }
    var artistList = [];
    for (var k in artists) if (artists.hasOwnProperty(k)) {
      artists[k].tracks.sort(function (a, b) { return cmpText(a.title, b.title); });
      artistList.push(artists[k]);
    }
    var genreList = [];
    for (var g in genres) if (genres.hasOwnProperty(g)) genreList.push(genres[g]);

    list.sort(function (a, b) { return cmpText(a.name, b.name); });
    artistList.sort(function (a, b) { return cmpText(a.name, b.name); });
    genreList.sort(function (a, b) { return cmpText(a.name, b.name); });

    groups.albums = list;
    groups.artists = artistList;
    groups.genres = genreList;

    albumById = {};
    for (i = 0; i < list.length; i++) albumById[list[i].id] = list[i];
    artistById = {};
    for (i = 0; i < artistList.length; i++) artistById[artistList[i].id] = artistList[i];

    A.groups = groups;
  }

  function albumOrder(a, b) {
    if ((a.discNo || 0) !== (b.discNo || 0)) return (a.discNo || 0) - (b.discNo || 0);
    if ((a.trackNo || 0) !== (b.trackNo || 0)) return (a.trackNo || 0) - (b.trackNo || 0);
    return cmpText(a.title, b.title);
  }

  function cmpText(a, b) {
    var x = String(a || "").toLowerCase(), y = String(b || "").toLowerCase();
    return x < y ? -1 : (x > y ? 1 : 0);
  }

  function album(id) { return albumById[id] || null; }
  function artist(id) { return artistById[id] || null; }

  /* --------------------------------------------------------------- search */

  function searchAll(q) {
    var needle = String(q || "").toLowerCase().replace(/^\s+|\s+$/g, "");
    if (!needle) return { songs: [], albums: [], artists: [], playlists: [], genres: [] };
    var terms = needle.split(/\s+/);

    function hit(s) {
      s = String(s || "").toLowerCase();
      for (var i = 0; i < terms.length; i++) if (s.indexOf(terms[i]) < 0) return false;
      return true;
    }

    var songs = [], albums = [], artists = [], playlists = [], genres = [], i, t;
    for (i = 0; i < S.lib.length; i++) {
      t = S.lib[i];
      if (hit(t.title) || hit(t.artist) || hit(t.album) || hit(t.genre) || hit(t.name)) songs.push(t);
    }
    for (i = 0; i < groups.albums.length; i++) {
      if (hit(groups.albums[i].name) || hit(groups.albums[i].artist)) albums.push(groups.albums[i]);
    }
    for (i = 0; i < groups.artists.length; i++) {
      if (hit(groups.artists[i].name)) artists.push(groups.artists[i]);
    }
    for (i = 0; i < S.playlists.length; i++) {
      if (hit(S.playlists[i].name)) playlists.push(S.playlists[i]);
    }
    for (i = 0; i < groups.genres.length; i++) {
      if (hit(groups.genres[i].name)) genres.push(groups.genres[i]);
    }
    return { songs: songs, albums: albums, artists: artists, playlists: playlists, genres: genres };
  }

  /* ------------------------------------------------------------- playlists */

  function playlistById(id) {
    for (var i = 0; i < S.playlists.length; i++) if (S.playlists[i].id === id) return S.playlists[i];
    return null;
  }

  function newPlaylist(name) {
    var p = {
      id: "pl" + hashStr(name + "|" + now() + "|" + Math.random()),
      name: norm(name) || "New Playlist",
      tracks: [], created: now(), updated: now()
    };
    S.playlists.unshift(p);
    A.savePlaylists();
    return p;
  }

  function renamePlaylist(id, name) {
    var p = playlistById(id);
    if (!p) return;
    p.name = norm(name) || p.name;
    p.updated = now();
    A.savePlaylists();
  }

  function deletePlaylist(id) {
    for (var i = 0; i < S.playlists.length; i++) {
      if (S.playlists[i].id === id) { S.playlists.splice(i, 1); break; }
    }
    A.savePlaylists();
  }

  function addToPlaylist(plId, trackId) {
    var p = playlistById(plId);
    if (!p) return false;
    if (p.tracks.indexOf(trackId) >= 0) return false;
    p.tracks.push(trackId);
    p.updated = now();
    A.savePlaylists();
    return true;
  }

  function removeFromPlaylist(plId, trackId) {
    var p = playlistById(plId);
    if (!p) return false;
    for (var i = 0; i < p.tracks.length; i++) {
      if (p.tracks[i] === trackId) { p.tracks.splice(i, 1); p.updated = now(); A.savePlaylists(); return true; }
    }
    return false;
  }

  function playlistTracks(p) {
    var out = [], i, t;
    if (!p) return out;
    for (i = 0; i < p.tracks.length; i++) {
      t = byId(p.tracks[i]);
      if (t) out.push(t);
    }
    return out;
  }

  function likedTracks() {
    var out = [], i, t;
    for (i = 0; i < S.likes.length; i++) {
      t = byId(S.likes[i]);
      if (t) out.push(t);
    }
    return out;
  }

  function isLiked(id) { return S.likes.indexOf(id) >= 0; }

  function toggleLike(id) {
    var i = S.likes.indexOf(id);
    if (i >= 0) S.likes.splice(i, 1);
    else S.likes.unshift(id);
    A.saveState();
    return i < 0;
  }

  /* ------------------------------------------------------------- activity */

  function bumpPlay(t) {
    if (!t) return;
    t.lastPlayed = now();
    var i;
    for (i = 0; i < S.history.length; i++) {
      if (S.history[i].id === t.id) { S.history.splice(i, 1); break; }
    }
    S.history.unshift({ id: t.id, at: now() });
    if (S.history.length > 150) S.history.length = 150;
    S.counts[t.id] = (S.counts[t.id] || 0) + 1;
    A.saveState();
  }

  function recentTracks(limit) {
    var out = [], seen = {}, i, t;
    for (i = 0; i < S.history.length; i++) {
      if (seen[S.history[i].id]) continue;
      t = byId(S.history[i].id);
      if (!t) continue;
      seen[t.id] = true;
      out.push(t);
      if (limit && out.length >= limit) break;
    }
    return out;
  }

  function topTracks(limit) {
    var out = [], i;
    var withPlays = [], without = [];
    for (i = 0; i < S.lib.length; i++) {
      if (S.counts[S.lib[i].id]) withPlays.push(S.lib[i]);
      else without.push(S.lib[i]);
    }
    withPlays.sort(function (a, b) { return (S.counts[b.id] || 0) - (S.counts[a.id] || 0); });
    out = withPlays.concat(without);
    return limit ? out.slice(0, limit) : out;
  }

  function recentAlbums(limit) {
    var list = groups.albums.slice(0);
    list.sort(function (a, b) { return (b.added || 0) - (a.added || 0); });
    return limit ? list.slice(0, limit) : list;
  }

  function topArtists(limit) {
    var list = groups.artists.slice(0);
    list.sort(function (a, b) {
      var ca = 0, cb = 0;
      for (var i = 0; i < a.tracks.length; i++) ca += S.counts[a.tracks[i].id] || 0;
      for (var j = 0; j < b.tracks.length; j++) cb += S.counts[b.tracks[j].id] || 0;
      if (ca !== cb) return cb - ca;
      return b.tracks.length - a.tracks.length;
    });
    return limit ? list.slice(0, limit) : list;
  }

  function sortTracks(list, mode) {
    var out = list.slice(0);
    if (mode === "recent") {
      out.sort(function (a, b) { return (b.lastPlayed || b.dateAdded || 0) - (a.lastPlayed || a.dateAdded || 0); });
    } else if (mode === "artist") {
      out.sort(function (a, b) {
        var c = cmpText(a.artist, b.artist);
        if (c) return c;
        c = cmpText(a.album, b.album);
        if (c) return c;
        return albumOrder(a, b);
      });
    } else if (mode === "album") {
      out.sort(function (a, b) {
        var c = cmpText(a.album, b.album);
        if (c) return c;
        return albumOrder(a, b);
      });
    } else if (mode === "duration") {
      out.sort(function (a, b) { return (b.duration || 0) - (a.duration || 0); });
    } else if (mode === "plays") {
      out.sort(function (a, b) { return (S.counts[b.id] || 0) - (S.counts[a.id] || 0); });
    } else if (mode === "added") {
      out.sort(function (a, b) { return (b.dateAdded || 0) - (a.dateAdded || 0); });
    } else {
      out.sort(function (a, b) { return cmpText(a.title, b.title); });
    }
    return out;
  }

  /* --------------------------------------------------------------- remove */

  function removeTrack(id) {
    var i;
    for (i = 0; i < S.lib.length; i++) {
      if (S.lib[i].id === id) { S.lib.splice(i, 1); break; }
    }
    for (i = 0; i < S.playlists.length; i++) {
      var idx = S.playlists[i].tracks.indexOf(id);
      if (idx >= 0) S.playlists[i].tracks.splice(idx, 1);
    }
    for (i = S.likes.length - 1; i >= 0; i--) if (S.likes[i] === id) S.likes.splice(i, 1);
    for (i = S.history.length - 1; i >= 0; i--) if (S.history[i].id === id) S.history.splice(i, 1);
    delete S.counts[id];
    delete files[id];
    delete A.art[id];
    if (A.urls[id]) { try { URL.revokeObjectURL(A.urls[id]); } catch (e) { } delete A.urls[id]; }
    if (P.winrt) A.dropToken(id);
    if (A.queueDrop) A.queueDrop(id);
    A.savePlaylists();
    A.saveState();
    A.saveLib();
    rebuildGroups();
    A.paintSoon();
  }

  function clearLibrary() {
    for (var i = 0; i < S.lib.length; i++) {
      var id = S.lib[i].id;
      if (A.urls[id]) { try { URL.revokeObjectURL(A.urls[id]); } catch (e) { } }
      if (P.winrt) A.dropToken(id);
    }
    S.lib = [];
    S.likes = [];
    S.history = [];
    S.counts = {};
    for (i = 0; i < S.playlists.length; i++) S.playlists[i].tracks = [];
    A.saveLib();
    A.savePlaylists();
    A.saveState();
    A.files = files;
    rebuildGroups();
    A.paintSoon();
  }

  function stats() {
    var dur = 0, size = 0, i;
    for (i = 0; i < S.lib.length; i++) {
      dur += S.lib[i].duration || 0;
      size += S.lib[i].size || 0;
    }
    return {
      tracks: S.lib.length,
      albums: groups.albums.length,
      artists: groups.artists.length,
      duration: dur,
      size: size
    };
  }

  /* ------------------------------------------------------------------ art */

  function blobFromRandomAccessStream(stream, type) {
    try {
      if (window.MSApp && MSApp.createBlobFromRandomAccessStream) {
        return MSApp.createBlobFromRandomAccessStream(type || "application/octet-stream", stream);
      }
    } catch (e) { }
    return null;
  }

  function embeddedArt(file) {
    if (!file || !window.MP3Meta) return Promise.resolve(null);
    return window.MP3Meta.read(file).then(function (tags) {
      if (!tags || !tags.picture) return null;
      try { return URL.createObjectURL(tags.picture); } catch (e) { return null; }
    }, function () { return null; });
  }

  function winrtEmbeddedArt(sf) {
    if (!sf) return Promise.resolve(null);
    try {
      if (window.MSApp && MSApp.createFileFromStorageFile) {
        var file = MSApp.createFileFromStorageFile(sf);
        if (file) return embeddedArt(file);
      }
    } catch (e) { }
    if (!sf.openReadAsync) return Promise.resolve(null);
    return new Promise(function (resolve) {
      sf.openReadAsync().then(function (stream) {
        var blob = blobFromRandomAccessStream(stream, sf.contentType || A.mimeFor(sf.name || ""));
        resolve(blob ? embeddedArt(blob) : null);
      }, function () { resolve(null); });
    });
  }

  function winrtArt(sf) {
    if (!sf) return Promise.resolve(null);
    if (!sf.getThumbnailAsync) return winrtEmbeddedArt(sf);
    return new Promise(function (resolve) {
      try {
        sf.getThumbnailAsync(
          Windows.Storage.FileProperties.ThumbnailMode.musicView, 400,
          Windows.Storage.FileProperties.ThumbnailOptions.useCurrentScale
        ).then(function (thumb) {
          var isIcon = false;
          try {
            isIcon = Windows.Storage.FileProperties.ThumbnailType && thumb &&
              thumb.type === Windows.Storage.FileProperties.ThumbnailType.icon;
          } catch (e) { }
          if (!thumb || isIcon) { resolve(winrtEmbeddedArt(sf)); return; }
          var blob = blobFromRandomAccessStream(thumb, thumb.contentType || "image/jpeg");
          if (blob) {
            try { resolve(URL.createObjectURL(blob)); return; } catch (e2) { }
          }
          resolve(winrtEmbeddedArt(sf));
        }, function () { resolve(winrtEmbeddedArt(sf)); });
      } catch (e3) {
        resolve(winrtEmbeddedArt(sf));
      }
    });
  }

  function readArt(track) {
    if (!track) return Promise.resolve(null);
    if (track.demo) return Promise.resolve(track.art || null);
    if (P.winrt) {
      return A.getFile(track).then(function (sf) { return winrtArt(sf); });
    }
    var f = files[track.id];
    if (!f) return Promise.resolve(null);
    return embeddedArt(f);
  }

  /* ------------------------------------------------------------------ boot */

  A.groups = groups;
  A.rebuildGroups = rebuildGroups;
  A.album = album;
  A.artist = artist;
  A.albumOrder = albumOrder;
  A.cmpText = cmpText;
  A.addRefs = addRefs;
  A.guessFromName = guessFromName;
  A.searchAll = searchAll;
  A.playlistById = playlistById;
  A.newPlaylist = newPlaylist;
  A.renamePlaylist = renamePlaylist;
  A.deletePlaylist = deletePlaylist;
  A.addToPlaylist = addToPlaylist;
  A.removeFromPlaylist = removeFromPlaylist;
  A.playlistTracks = playlistTracks;
  A.likedTracks = likedTracks;
  A.isLiked = isLiked;
  A.toggleLike = toggleLike;
  A.bumpPlay = bumpPlay;
  A.recentTracks = recentTracks;
  A.topTracks = topTracks;
  A.recentAlbums = recentAlbums;
  A.topArtists = topArtists;
  A.sortTracks = sortTracks;
  A.removeTrack = removeTrack;
  A.clearLibrary = clearLibrary;
  A.stats = stats;
  A.readArt = readArt;
})();
