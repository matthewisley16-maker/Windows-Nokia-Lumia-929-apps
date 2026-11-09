# Windows Nokia Lumia 929 apps

Apps built for a **Nokia Lumia 929 (Icon)** running **Windows 10 Mobile** — a phone whose Store no longer installs anything useful. Everything here runs **offline on the device itself**: either as a single self-contained page pinned to Start, or as a signed **ARM `.appx`** sideloaded from the phone's own storage.

Each app has its own folder and its own README with the full detail. This page is the map.

## The apps

| App | Folder | What it is | Status |
|---|---|---|---|
| **FreePaint** | `lumia-draw/` | Touch drawing app plus a flipbook animator | **1.2.0.0**, signed `.appx`, installed and used on the phone |
| **Lumia 929 Wi-Fi Fix** | `lumia-wifi-fix/` | Offline guide and checklist that gets the phone onto 5 GHz 802.11ac | Web app works; native XAP is source only |
| **PocketCraft** | `pocketcraft-preview/` | Minecraft-style block world to build and dig in | Browser preview |

---

### FreePaint — draw, then animate it

Two apps in one: a finger drawing canvas and a flipbook that turns frames into a loop.

- **Pen / eraser**, ten colours, four sizes, smooth quadratic strokes.
- **Select** — loop around strokes, then drag inside the green box to move them or drag the round handle to rotate. Stays vector, so rotated lines stay clean.
- **Undo** as far back as you like, including undoing a move or rotate.
- **Frames** — unlimited (no 12-frame cap), thumbnails, copy, delete, onion skin, play/stop.
- **Custom FPS** — 1–60, stored per project, with presets 5/8/10/12/15/24/30.
- **Projects** saved on the device, and deleted only after an in-app confirmation.
- **Drop-down toolbar** — the ▲/▼ arrow collapses it so the canvas fills the screen.

The signed package is `lumia-draw/appx-dist/FreePaint.appx` (ARM UWP, `1.2.0.0`). `FreePaint.html` is the same app as a single web page.

### Lumia 929 Wi-Fi Fix — get off 2.4 GHz

The Lumia 929 has a dual-band 802.11ac radio but WP8.1-era software hangs onto 2.4 GHz. This app explains exactly what the phone can and cannot do (802.11ac yes, WPA3 no) and walks through the router settings that make a modern router accept it: WPA2-PSK/AES on the 5 GHz page, PMF off, fixed non-DFS channel, 80 MHz, band steering off and its own SSID — plus a Plan B access point for locked-down networks. Includes a checklist saved on the device and a dedicated native project in `lumia-wifi-fix/native/` (Windows Phone 8.1 Silverlight, source only — it needs Visual Studio 2015 and the WP8.1 SDK).

### PocketCraft — a block world in your pocket

A small Minecraft-style sandbox: a procedurally generated block world you can **build** on and **dig** into, a hotbar of block types, drag to pan, zoom, rotate the view, and a **New** world button behind a confirmation. The world is generated locally and saved in `localStorage` — no server, no network.

---

## Installing an `.appx` on the phone

The phone is on Windows 10 Mobile, so packages must be **UWP for ARM**, and they are self-signed — the Store is not involved at all.

1. Copy the `.appx` (and the `.cer` files) into the phone's own storage, e.g. **This Device › Downloads**.
2. **Settings › Update & security › For developers › Developer mode**, then restart.
3. Open the root certificate (e.g. `FreePaint-RootCA.cer`) and install it as a **trusted root**, if not already trusted.
4. Open the `.appx` from the same folder and confirm the install prompt.
5. If no tile appears, restart and look under **All apps** or **Settings › Apps & features**.

The FreePaint chain is `FreePaint Root CA` → `FreePaint Dev` (Code Signing EKU). Root thumbprint `C5A4F74BEBEF1A0406109FE9486FCFA583E14C89`, leaf `EDDCE904C232FC2A82E23A1FE23B9EAA3C7E8708`. Error codes are decoded in `lumia-draw/appx-dist/INSTALL.txt` (`0x800B0109` = root not trusted, `0x80073CFF` = not in Developer mode).

## Repository layout

```
README.md                 this page
AGENTS.md                 repo rules for coding agents (commit after every change)
lumia-draw/               FreePaint: app source, native-appx/ package source, tools/, signed appx
lumia-wifi-fix/           Wi-Fi Fix: index.html, native/ XAP source, tools/
pocketcraft-preview/      PocketCraft: index.html + app.js + boot.js
```

## Rebuilding FreePaint

```
powershell -ExecutionPolicy Bypass -File lumia-draw/tools/fetch-sdk-tools.ps1   # once: makeappx/signtool
powershell -ExecutionPolicy Bypass -File lumia-draw/tools/build-appx.ps1        # pack + sign
powershell -ExecutionPolicy Bypass -File lumia-draw/tools/pack-draw.ps1         # refresh the delivered folder
```

`build-appx.ps1` must run **before** `pack-draw.ps1`, or the delivery folder keeps the previous package. A release is checked by manifest version, signature chain, and packaged `app.js` / `boot.js` / `default.html` hashes matching the sources.

## A note on how the HTML apps are written

Windows 10 Mobile's web host (WWAHost) **blocks inline `<script>`** with `CSP14312` and filters injected HTML. Every app here therefore loads its JavaScript from separate files (`boot.js`, `app.js`) and builds the DOM with `createElement` / `textContent` — no `innerHTML`. `boot.js` reports the first failure to an on-screen bar instead of dying silently.

## History

Work is committed as it happens — `git log --oneline` doubles as the changelog.
