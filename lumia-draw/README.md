# FreePaint — drawing + animation app for the Nokia Lumia 929

Two apps in one, built for this phone: a touch drawing canvas, plus a flipbook
that turns your frames into a looping animation. Ships as a single HTML file for
running today, and as a signed Windows 10 Mobile `.appx` package.

```
Downloads\FreePaint\
  FreePaint.html              the app — one file, works offline
  README.md                   this file
  appx\
    FreePaint.appx            signed Windows Phone 8.1 package
    FreePaint-RootCA.cer      trust this on the phone (root of the chain)
    FreePaint-Dev.cer         the signing certificate itself
    AppxManifest.xml          the manifest inside the package
    INSTALL.txt               install steps, in full
  native-appx\FreePaint\      the folder that gets packaged
  tools\pack-draw.ps1         regenerates images and repacks this folder
  tools\build-appx.ps1        builds + signs the .appx
  tools\fetch-sdk-tools.ps1   downloads makeappx/signtool into .tooling
```

Copy the whole `FreePaint` folder to the phone, a USB stick, or anywhere else —
it is self-contained.

---

## Run it on the phone right now

`FreePaint.html` is self-contained: no internet, no fonts, no libraries, ~22 KB.
Internet Explorer on WP8.1 will not open a `file://` page, so the first load has
to come from a URL:

1. Put `FreePaint.html` on OneDrive (single file, no folder needed).
2. Open the share link in Internet Explorer on the phone.
3. **…** menu → **pin to Start**.

You get a tile with its own icon that opens full-screen. From then on it needs no
network at all.

Alternative, over the LAN from this PC: run `python -m http.server 8000` in this
folder and open `http://<this-pc-ip>:8000` in IE, then pin to Start.

---

## Part 1 — draw

- **Built for fingers** — drawing runs on Pointer Events (`MSPointer*` on IE11, the
  native touch path on this phone), with touch and mouse fallbacks. Pinch zoom, text
  selection and the long-press menu are suppressed, so a dragging finger draws
  instead of panning or selecting.
- **Pen / Eraser / Bucket** — tap to switch. The eraser clears to the paper, so
  exports are clean PNGs rather than transparent holes. The bucket floods the
  closed area you tap with the current colour; fills are kept in the order you
  make them (so a later stroke still covers a fill) and undo removes one like a
  stroke.
- **Colours** — ten swatches in the second row; it scrolls sideways if your thumb
  needs more room.
- **Sizes** — S / M / L / XL, thin to 20 px. The eraser is always 3× the pen size.
- **Undo** — removes the last stroke of the frame you are on, as many times as you
  like. After a move or rotate it puts the pieces back where they were.
- **Clear** — asks for a second tap ("Sure?") instead of a modal dialog.
- **▲ / ▼ in the top-right corner** — the toolbar is a drop-down panel. The arrow
  closes it so the canvas fills the screen, and drops it back open. The header keeps
  the project button, the arrow and the current tool/size/colour.
- **Save** — shows your drawing full-width with the two real save routes for this
  device: **Power + Volume Up** sends the screen to *Photos › Screenshots*, or
  long-press the preview and choose **save picture**.

- **Select** — loop a circle around the strokes you want. The selection gets a green
  box: drag inside it to move the pieces, drag the round handle above it to rotate.
  Everything stays as vectors, so a rotated line is still a clean line.

Strokes are smoothed with quadratic curves between sample points, so a finger
stroke comes out round rather than polygonal — and they stay as point lists, not
bitmaps, which is what keeps undo and frame switching instant on a 2014 phone.

## Part 2 — flipbook animation

Tap **Frames** in the top row and an extra strip opens under the toolbar.

- **Thumbnails** — one per frame, in order. Tap any thumbnail to edit that frame.
  The current frame is outlined in green.
- **+ Frame** — inserts a blank frame after the current one and jumps to it.
- **Copy** — duplicates the current frame (usual way to animate: copy, nudge, repeat).
- **Delete** — removes the current frame. On a single-frame flipbook it just empties it.
- **Play / Stop** — loops the frames on the canvas. Drawing is locked while it plays.
- **fps** — tap the fps button for a speed sheet: − / +, a 1–60 slider and presets
  (5, 8, 10, 12, 15, 24, 30). The speed belongs to each project.
- **Onion** — ghosts the previous frame faintly under the current one so you can draw
  the next position in register.

As many frames as the device will store — no 12-frame cap. Frames live in memory for
the session, so **Save** the ones you want to keep; the panel tells you which frame it
exported.

## Exporting

**Export** in the toolbar opens the export sheet.

- **PNG image** — the frame you are on, at 1920 × 1080 on the white paper.
- **PNG frames** — every frame as its own numbered PNG (`frame_001.png`, ...).
  Paintings only show the single-image button.
- **MP4 video** — the whole flipbook at the project's fps, 1280 × 720.

In the installed app the files are written to **Pictures › FreePaint** on the
phone: `<project>.png` for a single image, a `<project>` folder for the frame
sequence, and `<project>.mp4` for the video. The MP4 is rendered by Windows' own
media engine (`MediaComposition.RenderToFileAsync`), so no encoder is bundled in
the app. In a plain browser the files download instead, and MP4 uses the
browser's MediaRecorder (MP4 where supported, otherwise WebM).

---

## The .appx

`appx\FreePaint.appx` is a genuine **Windows 10 Mobile UWP package for ARM**:
manifest, payload, block map and signature, packed **and validated** by
`makeappx` 10.0.28000 and signed with `signtool`. It contains the same
`default.html` as `FreePaint.html`, byte for byte, plus the UWP tile and splash
assets. Its shape was copied from `PrivateBrowse-Mobile-1.0.0.1.appx`, which is
known to install on this phone: `foundation/windows10` schema with
`uap:VisualElements`, `ProcessorArchitecture="arm"`, `StartPage` only (no
Executable), and `TargetDeviceFamily Windows.Universal` 10.0.10586.0 to
10.0.15254.0.

The first FreePaint package was built for Windows Phone 8.1 — 2010 manifest
schema, neutral architecture, no `TargetDeviceFamily` — and this phone runs
Windows 10 Mobile, which refuses that shape. The install prompt appeared, was
tapped, and closed with nothing added to the app list.

The signature chain still matters: `FreePaint Root CA` issues `FreePaint Dev`
with the Code Signing EKU, the root is added to the signature with
`signtool /ac`, and `FreePaint-RootCA.cer` has to be trusted on the phone.

Read `appx\INSTALL.txt` before trying it: it installs from local files, with no
Store and no PC. Copy the folder to phone storage, set Settings > Update &
security > For developers > Developer mode, trust `FreePaint-RootCA.cer`, then
open `FreePaint.appx` and confirm — exactly how PrivateBrowse was installed
here. The broken Store does not matter.

The package was packed by a current SDK tool on Windows, and it has never been
run on hardware from this machine. Rebuild it any time with:

```
powershell -ExecutionPolicy Bypass -File tools\fetch-sdk-tools.ps1
powershell -ExecutionPolicy Bypass -File tools\build-appx.ps1
powershell -ExecutionPolicy Bypass -File tools\pack-draw.ps1
```

---

## Verified

Browser test at 360 × 640 (the 929's CSS size) and on a wide desktop window: the
tool row scrolls sideways instead of clipping (571 px of buttons in a 350 px
row at phone width, with Bucket still on screen), the flipbook panel adds
95 px and leaves a 441 px canvas, the arrow collapses the bar to 40 px and gives
the canvas 600 px, no horizontal page overflow, rotation re-fitting the canvas
(with a poll backstop for rotates that arrive without a resize event), pen strokes,
eraser, colour and size switching, undo, two-tap clear, save sheet with its frame
label, + Frame / Copy / Delete, thumbnail switching, onion skin, playback
start-stop at 6 / 10 / 15 fps, PNG export, the bucket (tap fills a closed
outline, undo restores the paper, and the fill survives leaving the project and
reloading), and the export sheet in a browser (one painting PNG, three numbered
frame PNGs, and a MediaRecorder MP4) — plus synthetic pointer events for
touch-type and mouse-type strokes, a second finger being ignored mid-stroke,
pointercancel ending cleanly, blocked context-menu and drag defaults, and pixel
checks that ink actually lands on the canvas. No console errors and no network requests; the page contains
no external URLs. The WinRT export branch (Pictures\FreePaint, FileIO and
MediaComposition) cannot run in a browser, so it is code-complete but untested
on the phone.

Package checks: `makeappx pack` succeeded, `signtool sign` reported
*Successfully signed*, and `makeappx unpack` returns the expected nine entries
(manifest, block map, signature, `default.html`, five images). `signtool verify`
reports an untrusted root, which is exactly what a self-signed certificate does on
a machine that has not installed it — the signature itself is present and well
formed.

**Not verified:** installation on the phone. There is no WP8.1 deployment tooling
and no developer-unlocked device here, so the package has never been deployed.
