# Apps for the Nokia Lumia 929

The project is a small suite of apps for a **Nokia Lumia 929 (Icon)** running **Windows 10 Mobile**. All of them work offline, and each installs from its own signed **ARM `.appx`** — the Store is not involved.

| App | Folder | What it is | Status |
|---|---|---|---|
| **FreePaint** | `lumia-draw/` | Drawing canvas with a flipbook animator | **1.2.0.0** `.appx` |
| **MP4Lumia** | `MP4Lumia/` | Netflix-style player for the videos on the phone | **1.0.0.0** `.appx` |
| **MP3Lumia** | `MP3Lumia/` | Spotify-style player for the music on the phone | **1.0.0.0** `.appx` |
| **LumiaRead** | — | Reading app | In development — source not published here yet |

Each app folder carries its own README with the full detail.

## FreePaint — draw, then animate it

A finger drawing canvas and a flipbook in one app.

- **Pen / eraser**, ten colours, four sizes, smooth quadratic strokes.
- **Select** — loop around strokes, drag inside the green box to move them, drag the round handle to rotate. Stays vector, so rotated lines stay clean.
- **Undo** as far back as you like, including undoing a move or rotate.
- **Frames** — unlimited (no 12-frame cap), thumbnails, copy, delete, onion skin, play/stop.
- **Custom FPS** — 1–60, stored per project, with presets 5/8/10/12/15/24/30.
- **Projects** saved on the phone and deleted only after an in-app confirmation.
- **Drop-down toolbar** — the ▲/▼ arrow collapses it so the canvas fills the screen.

Package: `lumia-draw/appx-dist/FreePaint.appx`. `FreePaint.html` is the same app as a single page. Full detail in `lumia-draw/README.md`.

## MP4Lumia — the phone's videos, Netflix-style

Turns the videos already on the phone into a browsable library: a featured hero, **Continue watching**, **My List** and **Recently added** rows, a searchable library, a detail page per film, and a full-screen player that remembers where you stopped. Dark, Light and Default themes.

Package: `MP4Lumia/appx/MP4Lumia.appx`. `MP4Lumia.html` is the whole app in one file. Full detail in `MP4Lumia/README.md`.

## MP3Lumia — the phone's music, Spotify-style

Turns the music already on the phone into a library: albums, artists, playlists, a real play queue, liked songs, lyrics, editable tags, and a ten-band equalizer with 35 presets plus your own saved curves. Dark, Light and Default themes.

Package: `MP3Lumia/appx/MP3Lumia.appx`. `MP3Lumia.html` is the whole app in one file. Full detail in `MP3Lumia/README.md`.

## LumiaRead — reading

Still being built. Its source and package are not in this repository yet.

## Installing on the phone

Every package is self-signed, so trust the root certificate that ships beside it, then open the `.appx`:

1. Copy the `.appx` and its `-RootCA.cer` into the phone's **own** storage, e.g. **This Device › Downloads › FreePaint**.
2. **Settings › Update & security › For developers › Developer mode**, then restart.
3. Open the root `.cer` on the phone and install it as a trusted root.
4. Open the `.appx`, confirm the install prompt, wait, then look in the app list.
5. No tile? Restart and check **All apps** or **Settings › Apps & features**.

FreePaint's chain is `FreePaint Root CA` → `FreePaint Dev`; its error codes are decoded in `lumia-draw/appx-dist/INSTALL.txt`. MP4Lumia and MP3Lumia ship their own certificate pair and INSTALL.txt.

## Rebuilding

FreePaint:

```
powershell -ExecutionPolicy Bypass -File lumia-draw/tools/build-appx.ps1   # pack + sign
powershell -ExecutionPolicy Bypass -File lumia-draw/tools/pack-draw.ps1    # refresh appx-dist
```

Run `build-appx.ps1` first and `pack-draw.ps1` after it, or the folder keeps the previous package.

MP4Lumia and MP3Lumia each have a `tools/` folder with `pack-app.ps1` (builds the payload, the single-file HTML and the tiles) and `build-appx.ps1` (validates, packs and signs); their READMEs give the exact order. `fetch-sdk-tools.ps1` downloads `makeappx`/`signtool` into `.tooling`, which is deliberately not committed.

## History

Every change is committed as it happens; `git log --oneline` is the changelog.
