# FreePaint — apps for the Nokia Lumia 929

**FreePaint** is the project: a touch drawing app with a flipbook animator, made for a **Nokia Lumia 929 (Icon)** running **Windows 10 Mobile**, and shipped as a signed **ARM `.appx`** that installs from the phone's own storage — no Store needed.

The repository also holds two smaller apps for the same phone, listed below.

## FreePaint

Two apps in one: a finger drawing canvas and a flipbook that turns frames into a loop.

- **Pen / eraser**, ten colours, four sizes, smooth quadratic strokes.
- **Select** — loop around strokes, drag inside the green box to move them, drag the round handle to rotate. Stays vector, so rotated lines stay clean.
- **Undo** as far back as you like, including undoing a move or rotate.
- **Frames** — unlimited (no 12-frame cap), thumbnails, copy, delete, onion skin, play/stop.
- **Custom FPS** — 1–60, stored per project, with presets 5/8/10/12/15/24/30.
- **Projects** saved on the device and deleted only after an in-app confirmation.
- **Drop-down toolbar** — the ▲/▼ arrow collapses it so the canvas fills the screen.

The signed package is `lumia-draw/appx-dist/FreePaint.appx` (ARM UWP, **1.2.0.0**); `FreePaint.html` is the same app as a single web page. Full detail is in `lumia-draw/README.md`.

## Also in this repository

| App | Folder | What it does |
|---|---|---|
| **Lumia 929 Wi-Fi Fix** | `lumia-wifi-fix/` | Gets the phone onto 5 GHz 802.11ac: what the radio supports, which router settings block it (WPA3, PMF, band steering), and a Plan B access point. Offline page, plus WP8.1 XAP source. |
| **PocketCraft** | `pocketcraft-preview/` | A Minecraft-style block world: build on block faces, dig them out, pan, zoom and rotate the view, with a new world behind a confirmation. Generated and saved locally. |

## Installing FreePaint on the phone

1. Copy the `.appx` and the `.cer` files into the phone's own storage, e.g. **This Device › Downloads**.
2. **Settings › Update & security › For developers › Developer mode**, then restart.
3. Install `FreePaint-RootCA.cer` as a trusted root, if it is not already trusted.
4. Open `FreePaint.appx` and confirm the install prompt.
5. No tile? Restart and check **All apps** or **Settings › Apps & features**.

The signature chain is `FreePaint Root CA` → `FreePaint Dev`; error codes are decoded in `lumia-draw/appx-dist/INSTALL.txt`.

## Rebuilding FreePaint

```
powershell -ExecutionPolicy Bypass -File lumia-draw/tools/build-appx.ps1   # pack + sign
powershell -ExecutionPolicy Bypass -File lumia-draw/tools/pack-draw.ps1    # refresh appx-dist
```

Run `build-appx.ps1` first and `pack-draw.ps1` after it, or the folder keeps the previous package.

## History

Every change is committed as it happens; `git log --oneline` is the changelog.
