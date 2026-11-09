# Repository instructions

Apps for the Nokia Lumia 929 on Windows 10 Mobile. Read the app's own README before changing it, and read `README.md` for the overall map.

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

## The other apps

- `lumia-wifi-fix/index.html` and `pocketcraft-preview/` are self-contained pages; keep them dependency-free and offline.
- `lumia-wifi-fix/native/` is Windows Phone 8.1 Silverlight source that cannot be compiled in this environment — do not claim it is built.
