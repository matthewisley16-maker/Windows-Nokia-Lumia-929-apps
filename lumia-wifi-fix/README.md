# Lumia 929 Wi-Fi Fix — 2.4 GHz + 5 GHz

A tiny offline app for the **Nokia Lumia 929 (Icon)** that gets the phone onto the newest
network it can actually speak to: **5 GHz, 802.11ac, WPA2-PSK**. Plus a router-by-router guide
for the settings that make a modern router refuse the phone entirely.

Two builds of the same thing:

| Build | File | Status |
|---|---|---|
| Web app (works today, no toolchain) | `index.html` | Tested, renders and runs |
| Native Windows Phone app (XAP source) | `native/LumiaWiFiFix.sln` | Source only — not compiled here |

---

## What this phone can and cannot do

The Lumia 929 has a Snapdragon 800 with a **dual-band 802.11ac** radio, and WP8.1 ships the
driver for it.

- **2.4 GHz** — yes
- **5 GHz at 802.11n/ac** — yes
- **WPA2-PSK (AES/CCMP)** — yes
- **WPA3 / SAE** — no, and no app can add it (it lives in firmware + the OS supplicant)
- **802.11ax / Wi-Fi 6** — no
- **6 GHz** — no
- **802.11w PMF (required mode)** — no

So "connect to the newest Wi-Fi" means **5 GHz ac with WPA2-PSK**, and the app is built around
that. Nothing here pretends to install WPA3, because nothing can.

## The 5 GHz recipe (the whole point)

On the router's **5 GHz page** — not the 2.4 page, they are separate:

1. **Security** → `WPA2-PSK` / `WPA2-Personal`, cipher `AES`/`CCMP`.
   Turn **WPA3** and **WPA3 Transition / mixed** off.
2. **PMF / 802.11w** → `Disabled` or `Optional`. Never `Required`.
3. **Channel** → `44` (or `157`). Never `Auto`, never 52–144 (DFS).
4. **Width** → `80 MHz` (fall back to `40` if it drops). Mode → `802.11 a/n/ac mixed`,
   and an `ax only` mode off.
5. **Band steering** (Smart Connect / One Wi-Fi Name / SON) → **off**, then give the 5 GHz
   radio its own SSID, e.g. `Home-5G`.
6. **Fast roaming / 802.11r / k / v** → off.
7. On the phone: Settings › Wi-Fi, delete the old saved network, then join `Home-5G` fresh.

That is what moves the phone off 2.4 GHz. With steering left on, the router hands out 2.4 GHz
first and WP8.1 never migrates.

If the network will not accept WPA2 — locked-down building Wi-Fi, WPA3-only mesh, rented kit the
ISP will not change — use **Plan B** in the app: a cheap WPA2 access point on the LAN with its
own 5 GHz SSID. The phone joins that at full ac speed. Full steps are in the app's PLAN B tab.

---

## Using the web app

`index.html` is a single self-contained file with its icon inlined. No internet, no build step,
no dependencies, no server required after the first load.

**Installing it on the phone itself.** Internet Explorer on WP8.1 has no `file://` browsing, so
the page has to come from a URL once. After that it lives on the Start screen as a tile, with
its own icon, and opens like an app:

- **OneDrive (best if you want zero PC involvement).** Upload `Lumia929-WiFiFix.html` to
  OneDrive, open the share link in Internet Explorer on the phone, then **…** →
  **pin to Start**. Works over mobile data, so it does not need the home Wi-Fi to install.
- **From this PC over the LAN.** Join the phone to the network's *2.4 GHz* SSID (the one that
  works), run `python -m http.server 8000` in this folder, open `http://<this-pc-ip>:8000` in
  IE, then **…** → **pin to Start**.
- **A real installed app.** That is the XAP in `native/` — see below. It is the only route that
  puts the app in the app list rather than on the Start screen, and it needs a dev-unlocked
  phone plus Visual Studio.

State: the checklist is saved in `localStorage` on the device. Nothing is transmitted anywhere;
the page makes no network requests at all.

## Building the native app (optional)

The XAP source in `native/` is a Windows Phone 8.1 **Silverlight** project. It shows the same
checklist and adds a button that jumps straight into the system Wi-Fi page
(`ConnectionSettingsTask` → `ConnectionSettingsType.WiFi`) — that is the only Wi-Fi action
WP8.1 exposes to an app, which is exactly why a native app cannot do more than the router fix.

**Not compiled in this environment.** Verified on this machine: no Visual Studio, no MSBuild,
no Windows Phone 8.1 SDK, and `dotnet` alone cannot build a Silverlight XAP. So treat `native/`
as project source, not a signed artifact. `tools/build-xap.ps1` runs the moment that toolchain
exists.

Requirements:

- Visual Studio 2015 (or 2017 with the Windows Phone 8.1 SDK component)
- Windows Phone 8.1 SDK
- Windows Phone 8.1 Developer Registration Tool + a free Microsoft developer account for
  sideloading (dev-unlocked device needed)

Build:

1. Open `native/LumiaWiFiFix.sln` in Visual Studio.
2. If VS complains about the project type, create a new *Windows Phone Silverlight App*
   project, then copy in `App.xaml(.cs)`, `MainPage.xaml(.cs)`, `Properties/WMAppManifest.xml`
   and the `Assets/` PNGs, and rebuild.
3. Build → Deploy to a connected, developer-unlocked Lumia 929.

A ready-made XAP built with the same UI can also be produced by anyone with that toolchain; the
logic is deliberately trivial so nothing can break.

---

## Files

```
index.html                     the app (open this)
README.md                      this file
native/LumiaWiFiFix.sln        VS solution
native/LumiaWiFiFix/           WP8.1 Silverlight project + Assets
tools/make-assets.ps1          regenerates the tile/splash images
```
