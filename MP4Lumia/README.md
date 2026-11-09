# MP4Lumia — a Netflix-style video player for the Nokia Lumia 929

MP4Lumia turns the videos already on the phone into a browsable library: a
featured hero, rows for *Continue watching*, *My List* and *Recently added*, a
searchable library, a detail page per film, and a full-screen player that
remembers where you stopped. Dark, Light and Default (follows the phone) themes.

It is a real Windows 10 Mobile app — an ARM UWP package hosting an HTML/JS
interface, the same package shape as PrivateBrowse and FreePaint, both of which
install on this phone. Everything is local: no account, no network, no Store.

```
MP4Lumia\
  MP4Lumia.html              the whole app in one file (browser / OneDrive fallback)
  README.md                  this file
  START-HERE.txt             install steps, short version
  appx\
    MP4Lumia.appx            signed ARM package for Windows 10 Mobile  <- install this
    MP4Lumia-RootCA.cer      trust this on the phone first
    MP4Lumia-Dev.cer         the signing certificate itself
    AppxManifest.xml         the manifest inside the package
    INSTALL.txt              install steps, error codes, playback notes
  native-appx\MP4Lumia\      the folder that is packaged (generated)
  src\                       the source you edit
    shell.html               page structure
    app.css                  dark + light themes
    boot.js                  startup/error probe
    js\01-core.js            helpers, storage, Windows Runtime layer, thumbnails
    js\02-views.js           home, library, My List, settings, detail sheet
    js\03-player.js          player, resume, demo library, file activation
    AppxManifest.xml         package manifest source
  tools\
    pack-app.ps1             builds the payload, the single-file HTML and the tiles
    build-appx.ps1           validates, packs, signs and delivers the .appx
    fetch-sdk-tools.ps1      downloads makeappx/signtool into .tooling
```

---

## Install it on the phone

The full steps are in `appx\INSTALL.txt`. The short version, which is exactly
how PrivateBrowse and FreePaint were installed:

1. Copy `MP4Lumia.appx` and `MP4Lumia-RootCA.cer` into the phone's **own**
   storage (This Device → Downloads → MP4Lumia). Not OneDrive only.
2. Settings → Update & security → For developers → **Developer mode**, restart.
3. Open `MP4Lumia-RootCA.cer` on the phone and install it as a trusted root.
4. Open `MP4Lumia.appx`, confirm the prompt, wait, then find MP4Lumia in the app
   list. If it is not there, restart and search All apps.

The package needs Windows 10 Mobile build 10.0.10586 or newer. A Lumia Icon on
Windows 10 Mobile reports 10.0.15254. A Windows Phone 8.1 phone cannot install it,
and neither can a Windows 10 PC (it is an ARM phone package).

---

## Using it

**Add videos** — *Add videos* opens the system file picker; pick one file or
many. Chosen files are remembered across launches through the app's
`FutureAccessList`, so you pick them once. *Scan Videos folder* pulls in
everything under **This Device → Videos**, including subfolders (needs the
`videosLibrary` capability, which the manifest declares).

**Home** — featured title with Resume/Play, then *Continue watching* (anything
watched between 5 seconds and the end), *My List*, *Recently added* and *All
videos*. Rows scroll sideways. Each card carries its format badge, runtime,
progress bar, and a tick once watched.

**My Library** — search by title or file name, sort by Recent / A–Z / Largest /
Longest, and filter by format when the library has more than one. The header
counts videos, total size and how many are watched.

**Details** — tap any card. Big backdrop, format, resolution, runtime, size,
folder, date added, exact last position. Buttons: Play/Resume, Start over,
My List, Mark seen, and **Open in Movies & TV** (handy when a file uses a codec
the web player cannot decode). Remove deletes only the library entry and its
progress — never the file.

**Player** — tap to show/hide controls, play/pause, −10 s / +10 s, a scrub bar
with buffered fill, playback speed 0.5×–2×, and *Fill the screen* for zoomed
playback. It resumes where you stopped, saves every few seconds and on exit, and
marks finished videos as watched. The finished screen offers Replay. If a file
cannot be decoded, the player says which kind of failure it was and offers
Movies & TV instead. Keyboard shortcuts work in a browser: Space, ← →, F, Esc.

**Themes** — Settings → Appearance: **Default** follows the phone's theme
(dark or light, read from `UISettings` and updated if the phone changes),
**Dark** and **Light** override it for the app only. The header moon/sun button
cycles all three. The choice is remembered.

**Settings** — resume on/off, Continue-watching row on/off, remembered speed,
library stats, add/scan/clear, and an About card with version, device, engine and
supported formats.

---

## Formats — what "any format" honestly means

Decoding is done by the phone's own Media Foundation stack through the app's
`<video>` element; the app does not bundle a codec pack (Windows 10 Mobile does
not allow one). In practice:

| Plays normally | Plays when the codecs inside are supported | Needs Movies & TV |
|---|---|---|
| MP4 / M4V (H.264 + AAC) | MKV, AVI, WMV/ASF, MOV, TS/M2TS, 3GP, WebM, FLV, VOB | anything with an unsupported codec, e.g. HEVC without the extension or AC-3 audio |

The player reads the container and duration from the file itself, so a file that
the engine refuses fails with a clear message rather than a black screen. The
**Open in Movies & TV** button on the detail page and in the error panel hands
the same file to the system player, which has the extra audio fallbacks.

File types are also registered in the manifest, so MP4Lumia appears in **Open
with** for video files and receives them through file activation.

---

## The browser build

`MP4Lumia.html` is the same app as one self-contained file: no network, no
fonts, no libraries. Open it in any browser, or put it on OneDrive and open it
in Internet Explorer on the phone (IE will not open a `file://` page), then pin
to Start. On a desktop it uses a normal file picker and generates thumbnails
from the video frames; on the phone it uses the Windows Runtime (real MF
thumbnails, `FutureAccessList`, file activation).

Add `?demo=1` to the URL for a sample library of twelve titles with generated
posters — useful to see the interface on a PC. Sample titles have no files
behind them; Play there uses a short clip the browser records from a canvas, or
shows a friendly message if the browser cannot do that.

---

## Rebuild

```powershell
powershell -ExecutionPolicy Bypass -File tools\fetch-sdk-tools.ps1   # once: makeappx/signtool
powershell -ExecutionPolicy Bypass -File tools\build-appx.ps1        # payload + appx + signature
```

`pack-app.ps1` alone rebuilds the payload, `MP4Lumia.html` and the tile images
without touching the package. `build-appx.ps1` validates the manifest and every
asset, creates the signing chain on first run (`MP4Lumia Root CA` →
`MP4Lumia Dev` in `Cert:\CurrentUser\My`), packs with `makeappx`, signs with
`signtool /fd SHA256 /ac`, unpacks the result to prove its contents, checks the
chain, and writes `appx\` with `INSTALL.txt` and both `.cer` files.

---

## Verified

Browser tests at 360 × 640, the Lumia's CSS size, against the built
`MP4Lumia.html` with `?demo=1`:

* Boot with no console errors and no failed requests; 12 sample titles, 12
  generated posters, 4 home rows, hero with Resume/More info.
* Tab navigation across Home / Library / My List / Settings; no horizontal page
  overflow (document scroll width = 360), 158 px cards in the two-column grid.
* Library: 12 tiles, search "solar" → 1 result, A–Z sort starts at "Afterglow",
  MKV filter → 4 tiles, counters update.
* Settings: 4 cards, theme segmented control shows Default; **Light** repaints
  body `rgb(242,242,245)` with `rgb(13,13,18)` text and white cards; **Dark**
  restores `rgb(8,8,10)`; the Resume switch toggles and persists.
* Detail sheet: opens from a card, shows the title, 8 metadata rows and 4
  actions; My List toggles to "In My List"; the sheet closes on the X.
* Player: opens from a card, loads the source (`readyState 4`) and plays. The
  timeline shows the demo clip's 11.82 s (a recorded WebM carries no duration
  metadata, so it appears once playback reaches the end), the clock advances,
  and the finished panel opens with the title. Replay returns to 0 and closes
  the panel. +10 s and −10 s land exactly on 10 s and 0 s. The speed button
  reports 1.25× / 1.5× and the rate follows, including after reopening a video.
  Fill the screen applies `scale(3.16)` for a 1080p file in the portrait window.
  Closing the player marks the item watched (position 0, watched true), returns
  to Home and moves the hero on to the next unfinished title. No console errors.

Package checks: `makeappx pack` succeeded with validation on (manifest schema,
`uap:Capability videosLibrary`, file-type associations, StartPage and all seven
images), `signtool sign` succeeded, `makeappx unpack` lists 14 entries including
`AppxManifest.xml`, `AppxBlockMap.xml`, `AppxSignature.p7x`, `default.html`,
`app.js`, `app.css`, `boot.js` and the seven assets, and the signing chain
`MP4Lumia Dev → MP4Lumia Root CA` validates against the shipped root (locally
untrusted, exactly as expected for a self-signed package).

**Not verified:** installation on the phone — there is no developer-unlocked
Lumia or WP/W10M deployment tooling on this PC, so the package has never been
deployed to hardware. Playback was exercised with the generated demo clip, muted
because an automated page cannot grant Chromium's autoplay permission; no real
MP4/MKV/AVI file was available on this PC to play, so container and codec
behaviour on the phone itself is untested. The codec table above describes what
Windows Media Foundation supports on Windows 10 Mobile, not a test result.
Likewise the Windows Runtime paths (file picker, Videos-folder scan, MF
thumbnails, `FutureAccessList`, file activation, `UISettings` theme) are written
against the documented APIs but only the browser fallbacks ran here.
