/* MP3Lumia — metadata editing. Songs and whole albums can be re-tagged inside
   the library: title, artist, album, album artist, genre, year, track/disc
   numbers, composer and lyrics. On the phone the same values are also written
   back into the file when Windows allows it; a browser cannot rewrite ID3 tags,
   so there the change is kept in MP3Lumia's own library. */
(function () {
  "use strict";

  var A = window.MP3;
  var S = A.S;
  var $ = A.$, esc = A.esc, icon = A.icon;

  function val(id) {
    var el = $(id);
    if (!el) return "";
    return String(el.value || "").replace(/^\s+|\s+$/g, "");
  }

  function textField(id, label, value) {
    return '<label for="' + id + '">' + esc(label) +
      '<input id="' + id + '" type="text" autocomplete="off" value="' + esc(value || "") + '" /></label>';
  }

  function numField(id, label, value, max) {
    return '<label for="' + id + '">' + esc(label) +
      '<input id="' + id + '" type="number" min="0" max="' + (max || 9999) +
      '" value="' + (parseInt(value, 10) || 0) + '" /></label>';
  }

  function writeFileTags(t) {
    if (!A.P.winrt) return;
    try {
      A.getFile(t).then(function (sf) {
        if (!sf || !sf.properties || !sf.properties.getMusicPropertiesAsync) return;
        return sf.properties.getMusicPropertiesAsync().then(function (p) {
          try {
            try { p.title = t.title; } catch (e) { }
            try { p.artist = t.artist; } catch (e2) { }
            try { p.album = t.album; } catch (e3) { }
            try { p.albumArtist = t.albumArtist; } catch (e4) { }
            try { p.year = t.year || 0; } catch (e5) { }
            try { p.trackNumber = t.trackNo || 0; } catch (e6) { }
            try { p.discNumber = t.discNo || 0; } catch (e7) { }
            if (p.savePropertiesAsync) {
              p.savePropertiesAsync().then(function () {
                A.toast("Also written into the audio file");
              }, function () { });
            }
          } catch (e8) { }
        }, function () { });
      }, function () { });
    } catch (e) { }
  }

  function showTrackMeta(id) {
    var t = A.byId(id);
    if (!t) return;
    var hint = A.P.winrt
      ? "Saved in MP3Lumia and written back to the file when Windows allows it. The audio itself is untouched."
      : "Saved in MP3Lumia\u2019s library. A browser cannot rewrite ID3 tags, so the audio file stays exactly as it is.";
    var html = '<div class="sheet-head"><div><div class="sheet-title">Edit song details</div>' +
      '<div class="sheet-sub">' + esc(t.title) + "</div></div>" +
      '<button class="iconbtn" data-act="sheet-close" aria-label="Close">' + icon("close") + "</button></div>" +
      '<div class="meta-form">' +
      textField("mt-title", "Title", t.title) +
      textField("mt-artist", "Artist", t.artist) +
      textField("mt-album", "Album", t.album) +
      textField("mt-albumartist", "Album artist", t.albumArtist) +
      textField("mt-genre", "Genre", t.genre) +
      '<div class="meta-row">' + numField("mt-year", "Year", t.year) + numField("mt-track", "Track no", t.trackNo) + "</div>" +
      '<div class="meta-row">' + numField("mt-disc", "Disc no", t.discNo) + numField("mt-tracktotal", "Tracks on album", t.trackTotal) + "</div>" +
      textField("mt-composer", "Composer", t.composer) +
      '<label for="mt-lyrics">Lyrics<textarea id="mt-lyrics" rows="5">' + esc(t.lyrics || "") + "</textarea></label>" +
      "</div>" +
      '<button class="btn btn-primary wide" data-act="save-track-meta" data-id="' + id + '">Save changes</button>' +
      '<div class="sheet-foot">' + hint + "</div>";
    A.openSheet("meta", html, "tall");
  }

  function saveTrackMeta(id) {
    var t = A.byId(id);
    if (!t) return;

    var title = val("mt-title") || t.title || A.cleanName(t.name);
    t.title = title;
    t.artist = val("mt-artist") || "Unknown Artist";
    t.album = val("mt-album") || "Unknown Album";
    t.albumArtist = val("mt-albumartist") || t.artist;
    t.genre = val("mt-genre");
    t.year = parseInt(val("mt-year"), 10) || 0;
    t.trackNo = parseInt(val("mt-track"), 10) || 0;
    t.trackTotal = parseInt(val("mt-tracktotal"), 10) || 0;
    t.discNo = parseInt(val("mt-disc"), 10) || 0;
    t.composer = val("mt-composer");
    t.lyrics = val("mt-lyrics");
    t.tagged = true;

    A.rebuildGroups();
    A.saveLib();
    A.closeSheet();

    if (A.currentId() === t.id) A.refreshPlayback();
    A.toast("Song details saved");
    writeFileTags(t);

    if (S.route.name === "album" && !A.album(S.route.param)) A.setView("library");
    else A.render();
  }

  function showAlbumMeta(id) {
    var al = A.album(id);
    if (!al) return;
    var html = '<div class="sheet-head"><div><div class="sheet-title">Edit album info</div>' +
      '<div class="sheet-sub">' + al.tracks.length + " songs \u00b7 applies to all of them</div></div>" +
      '<button class="iconbtn" data-act="sheet-close" aria-label="Close">' + icon("close") + "</button></div>" +
      '<div class="meta-form">' +
      textField("ma-name", "Album name", al.name) +
      textField("ma-artist", "Album artist", al.artist) +
      numField("ma-year", "Year", al.year) +
      textField("ma-genre", "Genre", al.tracks.length ? (al.tracks[0].genre || "") : "") +
      "</div>" +
      '<button class="btn btn-primary wide" data-act="save-album-meta" data-id="' + id + '">Save album</button>' +
      '<div class="sheet-foot">Every song in this album is re-tagged. Changing the album name or artist moves the album in your library.</div>';
    A.openSheet("albummeta", html, "tall");
  }

  function saveAlbumMeta(id) {
    var al = A.album(id);
    if (!al) return;

    var name = val("ma-name") || al.name;
    var artist = val("ma-artist") || al.artist;
    var year = parseInt(val("ma-year"), 10) || 0;
    var genre = val("ma-genre");
    var tracks = al.tracks.slice(0);
    var i, t;

    for (i = 0; i < tracks.length; i++) {
      t = tracks[i];
      t.album = name;
      t.albumArtist = artist;
      t.year = year;
      if (genre) t.genre = genre;
      t.tagged = true;
    }

    A.rebuildGroups();
    A.saveLib();
    A.closeSheet();

    var newId = "al" + A.hashStr(artist.toLowerCase() + "|" + name.toLowerCase());
    if (S.route.name === "album") {
      if (A.album(newId)) A.setView("album", newId);
      else A.setView("library");
    }
    A.render();
    A.refreshPlayback();
    A.toast("Album updated \u00b7 " + tracks.length + " songs");

    if (A.P.winrt) {
      for (i = 0; i < tracks.length; i++) writeFileTags(tracks[i]);
    }
  }

  A.showTrackMeta = showTrackMeta;
  A.saveTrackMeta = saveTrackMeta;
  A.showAlbumMeta = showAlbumMeta;
  A.saveAlbumMeta = saveAlbumMeta;
})();
