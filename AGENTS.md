# Repository instructions

Apps for the Nokia Lumia 929 on Windows 10 Mobile. Read the app's own README before changing it, and read `README.md` for the overall map.

The suite is **FreePaint** (`lumia-draw/`), **MP4Lumia** (`MP4Lumia/`), **MP3Lumia** (`MP3Lumia/`) and **LumiaRead** — LumiaRead is still being built and must not be added to this repository until the user says it is ready.

## Commits — always

- After **every** change the user asks for — a new build, a bug fix, or even a small chat-only request — commit it to git with a short, descriptive message. Finished work is never left uncommitted.
- One change, one commit. Do not bundle unrelated work.
- When an app is rebuilt, bump its version in the same commit as the new package.
- Keep `README.md`'s app table and the affected app README matching what the code actually does.

## FreePaint (`lumia-draw/`)

- The version lives in three places: `APP_VER` in `app.js`, `Version=` in `native-appx/FreePaint/AppxManifest.xml`, and the delivered package. Bump them together.
- Rebuild order matters: `tools/build-appx.ps1` (packs and signs) **then** `tools/pack-draw.ps1` (refreshes `appx-dist/` and the copy in `Downloads\...\AppsIMade\FreePaintnokialumia929`). The reverse order delivers the old `.appx`.
- Before delivering, verify: manifest version, `signtool` success, signature chain, and that the packaged `app.js` / `boot.js` / `default.html` hashes equal the source files.
- WWAHost on this phone blocks inline `<script>` (`CSP14312`) and filters injected HTML. Keep all JS in external files and build the DOM with `createElement` / `textContent` — never `innerHTML`.
- `.tooling/sdkbt` is the vendored SDK build tools and the `.pfx` is the signing key; leave both tracked and unchanged.

## MP4Lumia and MP3Lumia

- Each is a self-contained app folder: edit `src/`, which `tools/pack-app.ps1` turns into the payload, the single-file `.html` and the tiles; `tools/build-appx.ps1` then packs, signs and delivers the `.appx`.
- `.tooling/` holds the downloaded SDK tools and is ignored — run `tools/fetch-sdk-tools.ps1` instead of committing ~55 MB per app.
- Bump `Version=` in `src/AppxManifest.xml` in the same commit as a rebuilt package.
- Keep the same WWAHost rules as FreePaint: external JS only, no `innerHTML`.

## Not part of the suite

- `lumia-wifi-fix/` and `pocketcraft-preview/` are earlier side projects. Their files stay on disk but are untracked and ignored; do not add them back unless the user asks.
