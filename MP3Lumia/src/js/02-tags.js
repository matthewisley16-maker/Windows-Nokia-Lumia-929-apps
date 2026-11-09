/* MP3Lumia — tag readers. Reads the tags out of the audio file itself, with no
   libraries and no network: ID3v2.2/2.3/2.4 and ID3v1 for MP3, Vorbis comments
   and PICTURE blocks for FLAC/Ogg, and the ilst atoms of M4A/AAC/ALAC.

   Every function here is plain ES5 and works on an ArrayBuffer slice, so it
   behaves the same in the phone's EdgeHTML engine and in a desktop browser.

   read(file) -> Promise of
     { title, artist, albumArtist, album, genre, year, trackNo, discNo,
       composer, lyrics, replayGain, picture: Blob|null, duration } */
window.MP3Meta = (function () {
  "use strict";

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
    "Musical", "Rock & Roll", "Hard Rock", "Folk", "Folk-Rock", "National Folk",
    "Swing", "Fast Fusion", "Bebop", "Latin", "Revival", "Celtic", "Bluegrass",
    "Avantgarde", "Gothic Rock", "Progressive Rock", "Psychedelic Rock", "Symphonic Rock",
    "Slow Rock", "Big Band", "Chorus", "Easy Listening", "Acoustic", "Humour", "Speech",
    "Chanson", "Opera", "Chamber Music", "Sonata", "Symphony", "Booty Bass", "Primus",
    "Porn Groove", "Satire", "Slow Jam", "Club", "Tango", "Samba", "Folklore",
    "Ballad", "Power Ballad", "Rhythmic Soul", "Freestyle", "Duet", "Punk Rock",
    "Drum Solo", "A Cappella", "Euro-House", "Dance Hall", "Goa", "Drum & Bass",
    "Club-House", "Hardcore Techno", "Terror", "Indie", "BritPop", "Afro-Punk",
    "Polsk Punk", "Beat", "Christian Gangsta Rap", "Heavy Metal", "Black Metal",
    "Crossover", "Contemporary Christian", "Christian Rock", "Merengue", "Salsa",
    "Thrash Metal", "Anime", "JPop", "Synthpop"];

  /* ------------------------------------------------------------- decoding */

  function latin1(b, off, len) {
    var out = "", i, chunk;
    for (i = 0; i < len; i += 4096) {
      chunk = [];
      for (var j = i; j < Math.min(len, i + 4096); j++) chunk.push(b[off + j]);
      out += String.fromCharCode.apply(null, chunk);
    }
    return out;
  }

  function utf8(b, off, len) {
    var out = "", i = 0, c, c2, c3, c4;
    while (i < len) {
      c = b[off + i++];
      if (c < 0x80) { out += String.fromCharCode(c); continue; }
      if (c >= 0xc2 && c <= 0xdf && i < len) {
        c2 = b[off + i++];
        out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
        continue;
      }
      if (c >= 0xe0 && c <= 0xef && i + 1 < len) {
        c2 = b[off + i++]; c3 = b[off + i++];
        out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
        continue;
      }
      if (c >= 0xf0 && c <= 0xf4 && i + 2 < len) {
        c2 = b[off + i++]; c3 = b[off + i++]; c4 = b[off + i++];
        var cp = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        continue;
      }
      out += "\ufffd";
    }
    return out;
  }

  function utf16(b, off, len, bigEndian) {
    var out = "", i, lo, hi, units = [], n = Math.floor(len / 2);
    for (i = 0; i < n; i++) {
      var a = b[off + i * 2], d = b[off + i * 2 + 1];
      units.push(bigEndian ? (a << 8) | d : d << 8 | a);
    }
    for (i = 0; i < units.length; i += 2048) {
      out += String.fromCharCode.apply(null, units.slice(i, i + 2048));
    }
    return out.replace(/^\ufeff/, "");
  }

  function decodeText(b, off, len, enc) {
    if (len <= 0) return "";
    if (enc === 1) {
      if (b[off] === 0xff && b[off + 1] === 0xfe) return utf16(b, off + 2, len - 2, false);
      if (b[off] === 0xfe && b[off + 1] === 0xff) return utf16(b, off + 2, len - 2, true);
      return utf16(b, off, len, false);
    }
    if (enc === 2) return utf16(b, off, len, true);
    if (enc === 3) return utf8(b, off, len);
    return latin1(b, off, len);
  }

  function ascii(b, off, len) { return latin1(b, off, len); }
  function trimNull(s) {
    return String(s || "").replace(/[\u0000]+\s*$/, "").replace(/^\s+|\s+$/g, "");
  }

  function syncsafe(b, off) {
    return ((b[off] & 0x7f) << 21) | ((b[off + 1] & 0x7f) << 14) |
           ((b[off + 2] & 0x7f) << 7) | (b[off + 3] & 0x7f);
  }
  function be32(b, off) {
    return ((b[off] & 0xff) * 16777216) + ((b[off + 1] & 0xff) << 16) +
           ((b[off + 2] & 0xff) << 8) + (b[off + 3] & 0xff);
  }
  function le32(b, off) {
    return (b[off] & 0xff) + ((b[off + 1] & 0xff) << 8) +
           ((b[off + 2] & 0xff) << 16) + ((b[off + 3] & 0xff) * 16777216);
  }
  function be16(b, off) { return (b[off] << 8) | b[off + 1]; }

  function genreOut(raw) {
    var s = trimNull(raw);
    if (!s) return "";
    var m = s.match(/^\((\d+)\)/);
    if (m) {
      var name = GENRES[parseInt(m[1], 10)];
      if (name) return name;
    }
    if (/^\d+$/.test(s)) return GENRES[parseInt(s, 10)] || s;
    return s;
  }

  function parseNumber(v) {
    var m = String(v || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  /* ------------------------------------------------------------- ID3v2 */

  function parseId3v2(b, tags) {
    if (ascii(b, 0, 3) !== "ID3") return false;
    var major = b[3], flags = b[5];
    var size = syncsafe(b, 6);
    var pos = 10;
    if (flags & 0x40) {
      var ext = major === 4 ? syncsafe(b, pos) : be32(b, pos);
      pos += Math.max(0, ext) + (major === 4 ? 0 : 4);
    }
    var end = Math.min(b.length, 10 + size);
    var idLen = major === 2 ? 3 : 4;

    while (pos + (major === 2 ? 6 : 10) <= end) {
      var id = ascii(b, pos, idLen);
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      var fsize;
      if (major === 2) fsize = (b[pos + 3] << 16) | (b[pos + 4] << 8) | b[pos + 5];
      else if (major === 4) fsize = syncsafe(b, pos + 4);
      else fsize = be32(b, pos + 4);
      var dpos = pos + (major === 2 ? 6 : 10);
      if (fsize <= 0 || dpos + fsize > end) break;
      frame(major, id, b, dpos, fsize, tags);
      pos = dpos + fsize;
    }
    return true;
  }

  function frame(major, id, b, off, len, tags) {
    var enc, value, i, desc, zero;
    switch (id) {
      case "TIT2": case "TT2": tags.title = trimNull(textFrame(b, off, len)); break;
      case "TPE1": case "TP1": tags.artist = trimNull(textFrame(b, off, len)); break;
      case "TPE2": case "TP2": tags.albumArtist = trimNull(textFrame(b, off, len)); break;
      case "TALB": case "TAL": tags.album = trimNull(textFrame(b, off, len)); break;
      case "TCON": case "TCO": tags.genre = genreOut(textFrame(b, off, len)); break;
      case "TDRC": case "TYER": case "TYE":
        tags.year = parseNumber(textFrame(b, off, len)); break;
      case "TRCK": case "TRK":
        value = textFrame(b, off, len);
        tags.trackNo = parseNumber(value);
        if (String(value).indexOf("/") >= 0) tags.trackTotal = parseNumber(String(value).split("/")[1]);
        break;
      case "TPOS": case "TPA":
        value = textFrame(b, off, len);
        tags.discNo = parseNumber(value);
        if (String(value).indexOf("/") >= 0) tags.discTotal = parseNumber(String(value).split("/")[1]);
        break;
      case "TCOM": case "TCM": tags.composer = trimNull(textFrame(b, off, len)); break;
      case "USLT": case "ULT":
        enc = b[off];
        value = decodeText(b, off + 4, len - 4, enc);
        var z = value.indexOf("\u0000");
        tags.lyrics = trimNull(z >= 0 ? value.slice(z + 1) : value);
        break;
      case "TXXX": case "TXX":
        enc = b[off];
        value = decodeText(b, off + 1, len - 1, enc);
        zero = value.indexOf("\u0000");
        if (zero > 0) {
          desc = value.slice(0, zero).toLowerCase();
          var val = trimNull(value.slice(zero + 1));
          if (desc.indexOf("replaygain_track_gain") >= 0) {
            var m = val.match(/-?[\d.]+/);
            if (m) tags.replayGain = parseFloat(m[0]);
          }
        }
        break;
      case "APIC": case "PIC":
        readApic(major, b, off, len, tags);
        break;
      default:
        break;
    }
  }

  function textFrame(b, off, len) {
    if (len < 1) return "";
    return decodeText(b, off + 1, len - 1, b[off]);
  }

  function readApic(major, b, off, len, tags) {
    if (len < 8) return;
    var enc = b[off], pos = off + 1, mime, desc, picType;
    if (major === 2) {
      mime = "image/" + ascii(b, pos, 3).toLowerCase().replace("jpg", "jpeg");
      pos += 3;
    } else {
      var start = pos;
      while (pos < off + len && b[pos] !== 0) pos++;
      mime = ascii(b, start, pos - start).toLowerCase() || "image/jpeg";
      pos++;
    }
    if (pos >= off + len) return;
    picType = b[pos++];
    var dstart = pos;
    if (enc === 1 || enc === 2) {
      while (pos + 1 < off + len && !(b[pos] === 0 && b[pos + 1] === 0)) pos += 2;
      pos += 2;
    } else {
      while (pos < off + len && b[pos] !== 0) pos++;
      pos++;
    }
    desc = pos > dstart ? decodeText(b, dstart, pos - dstart, enc) : "";
    if (pos >= off + len) return;
    var dataLen = off + len - pos;
    if (dataLen <= 0) return;
    var type = mime.indexOf("png") >= 0 ? "image/png" : "image/jpeg";
    try {
      var bytes = new Uint8Array(dataLen), i;
      for (i = 0; i < dataLen; i++) bytes[i] = b[pos + i];
      tags.picture = new Blob([bytes], { type: type });
      tags.pictureDescription = trimNull(desc);
      tags.pictureType = picType;
    } catch (e) { }
  }

  function parseId3v1(b) {
    var tags = {};
    if (b.length < 128) return tags;
    var off = b.length - 128;
    if (ascii(b, off, 3) !== "TAG") return tags;
    tags.title = trimNull(ascii(b, off + 3, 30));
    tags.artist = trimNull(ascii(b, off + 33, 30));
    tags.album = trimNull(ascii(b, off + 63, 30));
    tags.year = parseNumber(trimNull(ascii(b, off + 93, 4)));
    var comment = trimNull(ascii(b, off + 97, 30));
    if (b[off + 125] === 0 && b[off + 126] !== 0) {
      tags.trackNo = b[off + 126];
      comment = trimNull(ascii(b, off + 97, 28));
    }
    tags.comment = comment;
    var gi = b[off + 127];
    if (gi < GENRES.length) tags.genre = GENRES[gi];
    return tags;
  }

  /* --------------------------------------------------------------- FLAC */

  function parseFlac(b, tags) {
    if (ascii(b, 0, 4) !== "fLaC") return false;
    var pos = 4;
    while (pos + 4 <= b.length) {
      var head = b[pos];
      var last = head & 0x80;
      var type = head & 0x7f;
      var len = (b[pos + 1] << 16) | (b[pos + 2] << 8) | b[pos + 3];
      var data = pos + 4;
      if (data + len > b.length) break;

      if (type === 4) parseVorbisComment(b, data, len, tags);
      else if (type === 6) parseFlacPicture(b, data, len, tags);
      else if (type === 0 && len >= 18) {
        var sampleRate = (b[data + 10] << 12) | (b[data + 11] << 4) | (b[data + 12] >> 4);
        var totalHi = b[data + 13] & 0x0f;
        var total = totalHi * 4294967296 + be32(b, data + 14);
        if (sampleRate > 0 && total > 0) tags.duration = total / sampleRate;
      }
      if (last) break;
      pos = data + len;
    }
    return true;
  }

  var VORBIS_MAP = {
    TITLE: "title", ARTIST: "artist", ALBUM: "album", ALBUMARTIST: "albumArtist",
    "ALBUM ARTIST": "albumArtist", GENRE: "genre", DATE: "year", YEAR: "year",
    COMPOSER: "composer", LYRICS: "lyrics", UNSYNCEDLYRICS: "lyrics",
    TRACKNUMBER: "trackNo", TRACKTOTAL: "trackTotal", TOTALTRACKS: "trackTotal",
    DISCNUMBER: "discNo", DISCTOTAL: "discTotal"
  };

  function parseVorbisComment(b, off, len, tags) {
    var pos = off, end = off + len;
    if (pos + 4 > end) return;
    var vendorLen = le32(b, pos); pos += 4 + vendorLen;
    if (pos + 4 > end) return;
    var count = le32(b, pos); pos += 4;
    for (var i = 0; i < count && pos + 4 <= end; i++) {
      var slen = le32(b, pos); pos += 4;
      if (slen <= 0 || pos + slen > end) break;
      var pair = utf8(b, pos, slen);
      pos += slen;
      var eq = pair.indexOf("=");
      if (eq < 0) continue;
      var key = pair.slice(0, eq).toUpperCase();
      var val = pair.slice(eq + 1);
      if (key === "REPLAYGAIN_TRACK_GAIN") {
        var m = val.match(/-?[\d.]+/);
        if (m) tags.replayGain = parseFloat(m[0]);
        continue;
      }
      var field = VORBIS_MAP[key];
      if (!field) continue;
      if (field === "genre") tags.genre = genreOut(val);
      else if (field === "year") tags.year = parseNumber(val);
      else if (field === "trackNo" || field === "discNo" || field === "trackTotal" || field === "discTotal") {
        tags[field] = parseNumber(val);
      } else if (field === "lyrics") tags.lyrics = trimNull(val);
      else tags[field] = trimNull(val);
    }
  }

  function parseFlacPicture(b, off, len, tags) {
    var pos = off, mimeLen, mime, descLen, dataLen;
    pos += 4; // picture type
    mimeLen = be32(b, pos); pos += 4;
    mime = ascii(b, pos, Math.min(mimeLen, 60)).toLowerCase();
    pos += mimeLen;
    descLen = be32(b, pos); pos += 4 + descLen;
    pos += 16; // width, height, depth, colours
    if (pos + 4 > off + len) return;
    dataLen = be32(b, pos); pos += 4;
    if (dataLen <= 0 || pos + dataLen > off + len) return;
    try {
      var bytes = new Uint8Array(dataLen), i;
      for (i = 0; i < dataLen; i++) bytes[i] = b[pos + i];
      tags.picture = new Blob([bytes], { type: mime.indexOf("png") >= 0 ? "image/png" : "image/jpeg" });
    } catch (e) { }
  }

  /* ----------------------------------------------------------- MP4 / M4A */

  function parseMp4(b, tags) {
    if (ascii(b, 4, 4) !== "ftyp") return false;
    scanBoxes(b, 0, b.length, tags, 0);
    return true;
  }

  function boxAt(b, pos, end) {
    if (pos + 8 > end) return null;
    var size = be32(b, pos);
    var type = ascii(b, pos + 4, 4);
    var head = 8;
    if (size === 1) {
      if (pos + 16 > end) return null;
      size = be32(b, pos + 8) * 4294967296 + be32(b, pos + 12);
      head = 16;
    } else if (size === 0) size = end - pos;
    if (size < head || pos + size > end) return null;
    return { size: size, type: type, data: pos + head, end: pos + size };
  }

  function scanBoxes(b, start, end, tags, depth) {
    var pos = start, guard = 0;
    while (pos + 8 <= end && guard++ < 200) {
      var box = boxAt(b, pos, end);
      if (!box) break;
      if (box.type === "moov") {
        scanBoxes(b, box.data, box.end, tags, depth + 1);
      } else if (box.type === "udta" || box.type === "trak" || box.type === "mdia") {
        scanBoxes(b, box.data, box.end, tags, depth + 1);
      } else if (box.type === "meta") {
        scanBoxes(b, box.data + 4, box.end, tags, depth + 1);
      } else if (box.type === "ilst") {
        readIlst(b, box.data, box.end, tags);
      } else if (box.type === "mvhd") {
        readMvhd(b, box.data, box.end, tags);
      }
      pos = box.end;
    }
  }

  function readMvhd(b, off, end, tags) {
    if (off + 20 > end) return;
    var version = b[off];
    var timescale, duration;
    if (version === 1) {
      if (off + 32 > end) return;
      timescale = be32(b, off + 20);
      duration = be32(b, off + 24) * 4294967296 + be32(b, off + 28);
    } else {
      timescale = be32(b, off + 12);
      duration = be32(b, off + 16);
    }
    if (timescale > 0 && duration > 0) tags.duration = duration / timescale;
  }

  var MP4_MAP = {
    "\u00a9nam": "title", "\u00a9ART": "artist", "\u00a9alb": "album",
    "aART": "albumArtist", "\u00a9gen": "genre", "gnre": "genre",
    "\u00a9day": "year", "\u00a9wrt": "composer", "\u00a9lyr": "lyrics",
    "\u00a9cmt": "comment"
  };

  function readIlst(b, start, end, tags) {
    var pos = start;
    while (pos + 8 <= end) {
      var item = boxAt(b, pos, end);
      if (!item) break;
      var name = item.type;
      var dataPos = item.data, found = null;
      while (dataPos + 8 <= item.end) {
        var child = boxAt(b, dataPos, item.end);
        if (!child) break;
        if (child.type === "data") { found = child; break; }
        dataPos = child.end;
      }
      if (found) readIlstValue(name, b, found, tags);
      pos = item.end;
    }
  }

  function readIlstValue(name, b, box, tags) {
    var off = box.data, end = box.end;
    if (off + 8 > end) return;
    var kind = be32(b, off) & 0xffffff;
    var dataOff = off + 8;
    var len = end - dataOff;
    if (len <= 0) return;

    if (name === "covr") {
      var type = kind === 14 ? "image/png" : "image/jpeg";
      try {
        var bytes = new Uint8Array(len), i;
        for (i = 0; i < len; i++) bytes[i] = b[dataOff + i];
        tags.picture = new Blob([bytes], { type: type });
      } catch (e) { }
      return;
    }
    if (name === "trkn" || name === "disk") {
      if (len >= 4) {
        var n = be16(b, dataOff + 2);
        var total = len >= 6 ? be16(b, dataOff + 4) : 0;
        if (name === "trkn") { tags.trackNo = n; tags.trackTotal = total; }
        else { tags.discNo = n; tags.discTotal = total; }
      }
      return;
    }
    if (name === "gnre") {
      if (len >= 2) tags.genre = GENRES[be16(b, dataOff) - 1] || "";
      return;
    }
    var field = MP4_MAP[name];
    if (!field) return;
    var value;
    if (kind === 2) value = utf16(b, dataOff, len, true);
    else value = utf8(b, dataOff, len);
    value = trimNull(value);
    if (!value) return;
    if (field === "year") tags.year = parseNumber(value);
    else tags[field] = value;
  }

  /* ----------------------------------------------------------------- api */

  function readSlice(file, start, end) {
    return new Promise(function (resolve, reject) {
      try {
        var blob = file.slice(start, end);
        if (blob.arrayBuffer && !/Edge\//.test(navigator.userAgent)) {
          blob.arrayBuffer().then(resolve, reject);
          return;
        }
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(fr.error || new Error("read failed")); };
        fr.readAsArrayBuffer(blob);
      } catch (e) { reject(e); }
    });
  }

  function finish(tags, name) {
    var out = {
      title: "", artist: "", albumArtist: "", album: "", genre: "",
      year: 0, trackNo: 0, trackTotal: 0, discNo: 0, discTotal: 0,
      composer: "", lyrics: "", replayGain: 0, duration: 0, picture: null
    }, k;
    for (k in tags) if (tags.hasOwnProperty(k)) out[k] = tags[k];
    out.title = trimNull(out.title);
    out.artist = trimNull(out.artist);
    out.albumArtist = trimNull(out.albumArtist) || out.artist;
    out.album = trimNull(out.album);
    out.genre = trimNull(out.genre);
    out.composer = trimNull(out.composer);
    out.lyrics = trimNull(out.lyrics);
    if (!out.title && name) out.title = "";
    return out;
  }

  function read(file) {
    return new Promise(function (resolve) {
      if (!file || !file.size) { resolve(finish({}, file && file.name)); return; }
      var headLen = Math.min(file.size, 5 * 1024 * 1024);
      readSlice(file, 0, headLen).then(function (buf) {
        var b = new Uint8Array(buf), tags = {};
        var kind = "";
        try {
          if (ascii(b, 0, 3) === "ID3") { kind = "id3"; parseId3v2(b, tags); }
          else if (ascii(b, 0, 4) === "fLaC") { kind = "flac"; parseFlac(b, tags); }
          else if (ascii(b, 4, 4) === "ftyp") { kind = "mp4"; parseMp4(b, tags); }
          else {
            // A bare MPEG stream or a Vorbis stream: look for a leading ID3 tag anyway.
            if (ascii(b, 0, 4) === "OggS") kind = "ogg";
          }
        } catch (e) { }

        function tail() {
          if (file.size <= 128) { resolve(finish(tags, file.name)); return; }
          readSlice(file, file.size - 128, file.size).then(function (tbuf) {
            try {
              var v1 = parseId3v1(new Uint8Array(tbuf)), k;
              for (k in v1) if (v1[k] && !tags[k]) tags[k] = v1[k];
            } catch (e) { }
            resolve(finish(tags, file.name));
          }, function () { resolve(finish(tags, file.name)); });
        }
        tail();
      }, function () {
        resolve(finish({}, file.name));
      });
    });
  }

  /* Package walker used by the tests: returns which tag family a buffer is. */
  function probe(buffer) {
    var b = new Uint8Array(buffer);
    if (ascii(b, 0, 3) === "ID3") return "id3v2." + b[3];
    if (ascii(b, 0, 4) === "fLaC") return "flac";
    if (ascii(b, 4, 4) === "ftyp") return "mp4";
    return "unknown";
  }

  return {
    read: read,
    probe: probe,
    decodeText: decodeText,
    genres: GENRES
  };
})();
