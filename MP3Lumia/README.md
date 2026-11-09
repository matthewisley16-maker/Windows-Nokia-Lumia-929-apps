# MP3Lumia — a Spotify-style local music player for the Nokia Lumia 929

MP3Lumia turns the music already on the phone into a browsable library: albums,
artists, playlists, a real play queue, liked songs, lyrics, editable tags, and a
ten-band equalizer with 35 ready-made presets plus your own saved curves. Dark,
Light and Default (follows the phone) themes. Everything is local — no account,
no streaming service, no network.

It is built as a real Windows 10 Mobile app: an ARM UWP package hosting an
HTML/JS interface, the same package shape as MP4Lumia, PrivateBrowse and
FreePaint. The source also builds to a single self-contained HTML file that runs
in any modern browser.

```
MP3Lumia\
  MP3Lumia.html              the whole app in one file (browser / OneDrive fallback)
  README.md                  this file
  START-HERE.txt             install steps, short version
  appx\
    MP3Lumia.appx            signed ARM package for Windows 10 Mobile  <- install this
    MP3Lumia-RootCA.cer      trust this on the phone first
    MP3Lumia-Dev.cer         the signing certificate itself
    AppxManifest.xml         the manifest inside the package
    INSTALL.txt              install steps, error codes, playback notes
  native-appx\MP3Lumia\      the folder that is packaged (generated)
  src\                       the source you edit
    shell.html               page structure
    app.css                  dark + light themes, phone-first and desktop layouts
    boot.js                  startup/error probe
    js\01-core.js            helpers, state, storage, Windows Runtime layer, artwork
    js\02-tags.js            ID3v1/v2, FLAC Vorbis comments, MP4 atoms
    js\03-library.js         importing, grouping, search, playlists, likes, history
    js\04-audio.js           dual decks, Web Audio EQ, queue, crossfade, sleep timer
    js\05-views.js           every screen and sheet, transport painting, EQ curve
    js\05b-metadata.js       song and album metadata editors
    js\06-app.js             boot, actions, keyboard shortcuts, import, demo library
    AppxManifest.xml         package manifest source
  tools\
    pack-app.ps1             builds the payload, the single-file HTML and the tiles
    build-appx.ps1           validates, packs, signs and delivers the .appx
    fetch-sdk-tools.ps1      downloads makeappx/signtool into .tooling
```

---

## Install it on the phone

The full steps are in `appx\INSTALL.txt`. The short version:

1. Copy `MP3Lumia.appx` and `MP3Lumia-RootCA.cer` into the phone's **own**
   storage (This Device → Downloads → MP3Lumia). Not OneDrive only.
2. Settings → Update & security → For developers → **Developer mode**, restart.
3. Open `MP3Lumia-RootCA.cer` on the phone and install it as a trusted root.
4. Open `MP3Lumia.appx`, confirm the prompt, wait, then find MP3Lumia in the app
   list. If it is not there, restart and search All apps.

The package targets Windows 10 Mobile build 10.0.10586 or newer and is ARM-only.
A Windows 10 PC will refuse it. See **Verified** at the end: the package has not
been installed on a phone from this PC.

---

## Using it

**Add music** — *Add music files* opens the system file picker; pick one file or
many. *Add a folder* imports every audio file inside it (including subfolders).
On the phone, *Scan the Music folder* walks **This Device → Music** through the
Windows Runtime and needs the `musicLibrary` capability declared in the
manifest. In a browser you can also drag a folder onto the window.

Tags are read from the audio file itself: ID3v1 and ID3v2.2/2.3/2.4 for MP3,
Vorbis comments and embedded pictures for FLAC, and `ilst` atoms for MP4/M4A.
On the phone, Windows music properties are preferred when available. Missing
fields fall back to the filename and folder name. Embedded artwork is used when
present; otherwise the app shows a grey music-note placeholder.

**Home** — greeting, library counts, recently played, recently added, artists
and playlists. Cards scroll sideways.

**Your Library** — tabs for Playlists, Songs, Albums and Artists. Search matches
titles, artists, albums, genres and filenames. Songs can be sorted by title,
artist, album, recently added, recently played, length or play count. Album and
artist pages have their own Play and Shuffle buttons and a track list.

**Playlists and likes** — create, rename and delete playlists; add a song from
its three-dot menu; remove songs from a playlist without touching the library.
Liked Songs is a built-in playlist. Play counts and recent history feed the Home
rows and the sort options.

**Playback** — play/pause, previous/next, seek by dragging, volume and mute.
Shuffle and repeat Off / All / One. Two audio decks feed one Web Audio graph, so
crossfade can overlap songs; a sleep timer offers 15, 30 or 60 minutes, or stops
at the end of the current track.
The Now Playing screen has artwork, a seek bar, transport controls, lyrics, the
queue, the equalizer and an optional frequency visualizer. Media Session metadata
is exposed to the system, and keyboard shortcuts work in a browser. Tapping the
artist or album name opens that artist or album.

**Queue** — add a song to the front ("Play next") or the end ("Add to queue")
from any track menu, add a whole album, or view the queue from Home / Now
Playing. Upcoming songs can be moved up or down, removed, or cleared; the current
song stays. The queue is remembered across launches.

**Lyrics** — the lyrics sheet reads embedded lyrics (ID3 USLT / Vorbis LYRICS)
and also shows lyrics you type into the metadata editor.

**Themes** — Settings → Appearance: **Default** follows the phone's theme,
**Dark** and **Light** override it for the app only. The header moon/sun button
cycles all three. The choice is remembered.

### Editing song and album metadata

Open a song's three-dot menu → **Edit metadata**. The editor covers title,
artist, album, album artist, genre, year, track number, disc number, tracks on
album, composer and lyrics. Saving re-groups the library immediately: a changed
album or artist moves the song into the matching album/artist page.

Open an album page → **More** → **Edit album info** to change the album name,
album artist, year and genre for **every song in that album** at once. The album
is re-filed under its new name/artist and the app navigates to the renamed album.

What "saved" means, honestly:

* **In the browser** the change is stored in MP3Lumia's own library on this
  device. Browsers cannot rewrite ID3/Vorbis/MP4 tags, so the audio file itself
  is untouched.
* **On the phone** the change is also stored in MP3Lumia's library, and the app
  asks the Windows Runtime `MusicProperties` API to write the common fields
  (title, artist, album, album artist, year, track/disc number) back into the
  file. Windows may refuse for files it does not own or formats it cannot write,
  so this is best-effort, not a guarantee.

### The equalizer

Open Settings → Equalizer, or the EQ button on Now Playing. The chain is:

```
deck gains -> preamp -> 10 biquad bands -> limiter -> analyser -> master volume
```

* Ten bands: **31, 62, 125, 250, 500 Hz, 1, 2, 4, 8, 16 kHz**, ±12 dB each.
  The ends are low/high shelves; the middle bands are peaking filters with Q 1.1.
* Preamp ±12 dB, a limiter, a bypass switch and Reset.
* A live response curve drawn on a canvas, plus an optional playback visualizer.
* **35 presets**: Flat, Normal, Spotify, Spotify Punch, Bass, Mids, Highs, Bass
  Boost, Treble Boost, Loudness, V-Shape, Warm, Bright, Rock, Pop, Rap, Hip-Hop,
  R&B, Electronic, Dance, House, Trance, Club, Live, Jazz, Classical, Piano,
  Guitar, Acoustic, Vocal, Podcast, Audiobook, Lo-Fi, Headphones, Small Speakers.
* **Custom presets**: name the current ten bands and save. Custom presets appear
  with the built-ins and survive a reload; the trash button deletes them.
* If the device/browser has no Web Audio, playback still works and the EQ sheet
  says the equalizer is bypassed.

---

## Formats and tag support

Decoding is done by the phone's own Media Foundation stack through `<audio>`;
the app does not bundle a codec pack. Expect MP3, WAV, AAC/M4A and WMA to play
on Windows 10 Mobile, with FLAC on later builds. The manifest registers MP3,
MP2, M4A, M4B, AAC, FLAC, WAV, OGG, OPUS, WMA, AIFF and AMR for "open with",
and file activation opens the app.

Tag readers are implemented in the app:

| Container | Tags read | Artwork |
|---|---|---|
| MP3 | ID3v1, ID3v2.2/2.3/2.4 (text, track/disc, composer, lyrics, ReplayGain) | APIC |
| FLAC / Ogg | Vorbis comments | FLAC PICTURE block |
| MP4 / M4A | `ilst` atoms (`©nam`, `©ART`, `©alb`, `©gen`, `©day`, `trkn`, `disk`, lyrics) | `covr` |

Metadata editing is stored in the library on every platform; only the phone
attempts to write common fields back to the file, as described above.

---

## The browser build

`MP3Lumia.html` is the whole app in one file: no network, no fonts, no
libraries. Open it in any modern browser, or put it on OneDrive and open it in
Internet Explorer on the phone, then pin it to Start.

In a browser you must add your files again after a full page reload: browsers do
not let a page keep permanent access to local files. The library (including any
tag edits), playlists, likes, queue and equalizer settings are kept in
`localStorage` and do come back; only the file handles themselves are
session-scoped. On the phone the Windows Runtime `FutureAccessList` is used to
reopen chosen files across launches.

Add `?demo=1` to the URL for a sample library of 15 tracks across 5 albums, with
synthesized audio and generated cover art. It is useful for trying the interface
and the equalizer on a PC. Demo tracks have no real files behind them. Click a
track to start playback (browsers require a user gesture before audio).

---

## Rebuild

```powershell
powershell -ExecutionPolicy Bypass -File tools\fetch-sdk-tools.ps1   # once: makeappx/signtool
powershell -ExecutionPolicy Bypass -File tools\build-appx.ps1        # payload + appx + signature
```

`pack-app.ps1` alone rebuilds the payload, `MP3Lumia.html` and the tiles without
touching the package. `build-appx.ps1` validates the manifest and every asset,
creates the signing chain on first run (`MP3Lumia Root CA` → `MP3Lumia Dev` in
`Cert:\CurrentUser\My`), packs with `makeappx`, signs with
`signtool /fd SHA256 /ac`, unpacks the result to prove its contents, checks the
chain, and writes `appx\` with `INSTALL.txt` and both `.cer` files.

`tools\fetch-sdk-tools.ps1` downloads `makeappx`/`signtool` into
`.tooling\sdkbt`; `build-appx.ps1` reads them from there. This build reused the
copy from `..\MP4Lumia\.tooling\sdkbt`, so no new download was needed, but the
build script does not fetch it automatically.

---

## Verified

Tested in Chromium at 380 × 720 (a phone-sized viewport) against the built
`MP3Lumia.html` with `?demo=1`, plus package checks with the Windows SDK tools.
These results are from this machine; see the next section for what was not tested.

* **Startup** — all seven source modules parse as ES5. The built app boots with
  no console errors or failed requests: 15 songs, 5 albums, 4 artists, 2 demo
  playlists plus Liked Songs (3 songs), and the expected Home rows.
* **Tag reader** — a synthetic ID3v2.3 file built in the page returned
  `Test Title`, `Test Artist`, `Test Album`, genre `Rock`, and a 12-byte
  `image/png` APIC picture. This exercises the actual binary parser, not a mock.
* **Song editing** — the track menu opened the editor ("Title, artist, album,
  year, lyrics"), saving a new title/artist/album/genre/year/lyrics updated the
  track, regrouped the library from 5 to 6 albums and 4 to 5 artists, wrote the
  values to `mp3lumia.library.v1`, closed the sheet and showed "Song details
  saved".
* **Album editing** — "Edit album info" applied a new album name, year and genre
  to all songs in the album, created the renamed album, navigated to it, and
  showed "Album updated · 2 songs".
* **Persistence** — loading without `?demo=1` restored the edited song fields,
  the renamed album and its two songs, the saved custom EQ preset and its bands,
  and the selected theme from storage.
* **Equalizer** — 35 preset chips rendered. Choosing **Bass** set all ten bands
  and all ten sliders to `[8,6,3,1,0,0,0,0,-1,-1]`, highlighted the chip, drew
  the response curve (17,011 non-transparent canvas pixels) and left the Web
  Audio analyser producing data. A custom preset "My Warm Curve" saved, appeared
  in the custom list, persisted in `mp3lumia.settings.v1`, switched the state to
  `Custom` when a band was changed, and deleted cleanly.
* **Playback** — clicking a demo track started its generated WAV on `deckA`.
  After seeking to 2 s, the current track advanced from 2.6 s to 6.8 s over
  4.2 s with zero `waiting`, `stalled`, `error`, `pause` or `ended` events.
  `isPlaying()` stayed true, the AudioContext stayed `running`, the visualizer
  stayed off, and flat EQ kept all ten filters bypassed. A track change advanced
  into the next song without error or stall.
* **Now Playing links** — actual pointer clicks on the artist and album lines
  opened the correct artist and album pages and closed the overlay; both IDs
  resolved against the demo library.
* **Search** — a query for "paper" returned 2 songs and the renamed "Paper Planes
  Deluxe" album through the real search index.
* **Queue, playlists, likes** — a deterministic queue accepted two added songs,
  the remove button deleted the targeted upcoming song, and the remaining item
  could not be moved below the end (correct guard). Creating a playlist, adding
  a song and deleting the playlist returned true throughout. Liking/unliking a
  song updated the likes list.
* **Theme** — the header theme button switched the app to Dark:
  `theme-dark`, body background `rgb(10, 10, 13)`, text `rgb(246, 246, 248)`.
* **Compatibility scan** — no arrow functions, template literals, `const`/`let`,
  CSS variables, CSS grid or flex `gap` in the source, matching the EdgeHTML
  constraints of Windows 10 Mobile.

Package checks: `makeappx pack` succeeded with manifest/asset validation on;
`makeappx unpack` lists `AppxManifest.xml`, `AppxBlockMap.xml`,
`AppxSignature.p7x`, `default.html`, `app.js`, `app.css`, `boot.js` and the seven
tile/splash images. The signature carries the Code Signing EKU, and the chain
`MP3Lumia Dev → MP3Lumia Root CA` validates against the shipped root (locally
untrusted, which is expected for a self-signed sideloading package).
`appx\MP3Lumia.appx` is 91,079 bytes, version 1.0.0.0, ARM, SHA-256
`0C801C1E2755F95F37E3E1E2CBFC37E06BCE94571DD4592D330F24C2F2E08BF8`.

**Not verified:**

* Installation and launch on the actual Lumia 929. There is no
  developer-unlocked phone or WP/W10M deployment tooling on this PC, so the
  package has never been deployed to hardware.
* The Windows Runtime paths — file/folder pickers, Music-folder scan,
  `FutureAccessList` reopening, thumbnail extraction, file activation and
  `MusicProperties` tag writing. These are written against the documented APIs
  and fall back to browser paths, but only the browser side ran here.
* Playback and tag reading of real MP3/FLAC/M4A files. The parser test used a
  synthetic ID3v2.3 file; playback used the generated 20-second WAV demo. FLAC,
  MP4 and real-world ID3 variants were not exercised on this machine.
* Web Audio behavior in EdgeHTML on the phone, including whether the equalizer
  graph is available there; tested in Chromium only. The app falls back to plain
  playback when Web Audio is missing.
* Crossfade, the sleep timer and Media Session/media-key behavior on hardware
  were not individually exercised in this pass.

The demo library and test edits live only in the test browser profile; they are
not baked into the app or the package.
