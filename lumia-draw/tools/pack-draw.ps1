# Generates the UWP payload images for Windows 10 Mobile and packs FreePaint
# into the AppsIMade delivery folder. Run: powershell -ExecutionPolicy Bypass -File tools\pack-draw.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$appx   = Join-Path $root 'native-appx\FreePaint'
$assets = Join-Path $appx 'Assets'
$dest   = Join-Path $env:USERPROFILE 'Downloads\APPLICATIONS\Freebuff\AppsIMade\FreePaintnokialumia929'

if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Path $assets -Force | Out-Null }

function New-Art([string]$path, [int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::FromArgb(255, 13, 18, 22))

    $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 200, 83))
    $white  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 236, 245, 241))

    $pen = New-Object System.Drawing.Pen($white, [float]([Math]::Max(2, $w * 0.09)))
    $pen.StartCap = 'Round'
    $pen.EndCap   = 'Round'
    $g.DrawLine($pen, [int]($w * 0.24), [int]($h * 0.76), [int]($w * 0.72), [int]($h * 0.28))

    $r = [int]([Math]::Max(2, $w * 0.09))
    $g.FillEllipse($accent, [int]($w * 0.72) - $r, [int]($h * 0.28) - $r, $r * 2, $r * 2)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $pen.Dispose()
    Write-Host "  $path"
}

Write-Host 'Generating UWP images...'
# Windows 10 Mobile asset names and sizes, the same set PrivateBrowse uses.
# build-appx.ps1 refuses to pack if any of these is missing or the wrong size.
New-Art (Join-Path $assets 'Square44x44Logo.png')    44  44
New-Art (Join-Path $assets 'Square71x71Logo.png')    71  71
New-Art (Join-Path $assets 'Square150x150Logo.png') 150 150
New-Art (Join-Path $assets 'Square310x310Logo.png') 310 310
New-Art (Join-Path $assets 'Wide310x150Logo.png')   310 150
New-Art (Join-Path $assets 'StoreLogo.png')          50  50
New-Art (Join-Path $assets 'SplashScreen.png')      620 300

# The appx payload and the web app are the same page, on purpose.
# The host does not run inline script, so the code lives in app.js / boot.js.
Copy-Item (Join-Path $root 'index.html') (Join-Path $appx 'default.html') -Force
Copy-Item (Join-Path $root 'app.js')     (Join-Path $appx 'app.js')     -Force
Copy-Item (Join-Path $root 'boot.js')    (Join-Path $appx 'boot.js')    -Force

Write-Host "Packing to $dest ..."
New-Item -ItemType Directory -Path $dest -Force | Out-Null
# Overwrite only what this script owns; never wipe the whole delivery folder.
foreach ($sub in @('native-appx', 'tools', 'appx')) {
    if (Test-Path (Join-Path $dest $sub)) { Remove-Item (Join-Path $dest $sub) -Recurse -Force }
}

Copy-Item (Join-Path $root 'index.html')     (Join-Path $dest 'FreePaint.html') -Force
Copy-Item (Join-Path $root 'app.js')         (Join-Path $dest 'app.js')         -Force
Copy-Item (Join-Path $root 'boot.js')        (Join-Path $dest 'boot.js')        -Force
Copy-Item (Join-Path $root 'README.md')      (Join-Path $dest 'README.md') -Force
Copy-Item (Join-Path $root 'START-HERE.txt') (Join-Path $dest 'START-HERE.txt') -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $root 'native-appx')    (Join-Path $dest 'native-appx') -Recurse -Force
Copy-Item (Join-Path $root 'tools')          (Join-Path $dest 'tools') -Recurse -Force

$appxDist = Join-Path $root 'appx-dist'
if (Test-Path $appxDist) {
    Copy-Item $appxDist (Join-Path $dest 'appx') -Recurse -Force
} else {
    Write-Host '  (no appx-dist folder yet - run tools\build-appx.ps1 to add the .appx)'
}

Write-Host 'Done.'
Get-ChildItem $dest -Recurse -File | ForEach-Object {
    '{0,8:N0}  {1}' -f $_.Length, $_.FullName.Substring($dest.Length + 1)
}
