# Generates the WP8.1 tile/splash images and packs the finished product into Downloads.
# Run:  powershell -ExecutionPolicy Bypass -File tools\make-assets.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root    = Split-Path -Parent $PSScriptRoot
$assets  = Join-Path $root 'native\LumiaWiFiFix\Assets'
$dest    = Join-Path $env:USERPROFILE 'Downloads\Lumia929-WiFiFix'

if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Path $assets -Force | Out-Null }

function New-Tile([string]$path, [int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::FromArgb(255, 5, 9, 12))

    $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 200, 83))
    $dim    = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 8, 20, 26))

    $pad  = [int]($w * 0.14)
    $size = $w - ($pad * 2)
    $g.FillEllipse($accent, $pad, $pad, $size, $size)
    $g.FillEllipse($dim, ($w / 2) - [int]($size * 0.13), ($h / 2) - [int]($size * 0.13),
                   [int]($size * 0.26), [int]($size * 0.26))

    $font = New-Object System.Drawing.Font('Segoe UI', [float]($w * 0.11), [System.Drawing.FontStyle]::Bold)
    $fmt  = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF(0, ($h * 0.72), $w, ($h * 0.24))
    $g.DrawString('5G', $font, $accent, $rect, $fmt)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "  $path"
}

function New-Splash([string]$path, [int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 5, 9, 12))
    $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 200, 83))
    $g.FillEllipse($accent, ($w / 2) - 60, ($h / 2) - 60, 120, 120)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "  $path"
}

Write-Host 'Generating assets...'
New-Tile   (Join-Path $assets 'ApplicationIcon.png') 62 62
New-Tile   (Join-Path $assets 'Square71x71Logo.png') 71 71
New-Tile   (Join-Path $assets 'Square150x150Logo.png') 150 150
New-Tile   (Join-Path $assets 'Square310x310Logo.png') 310 310
New-Tile   (Join-Path $assets 'StoreLogo.png') 50 50
New-Splash (Join-Path $assets 'SplashScreenImage.jpg') 480 800

Write-Host "Packing to $dest ..."
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest -Force | Out-Null

Copy-Item (Join-Path $root 'index.html')   (Join-Path $dest 'Lumia929-WiFiFix.html') -Force
Copy-Item (Join-Path $root 'README.md')    (Join-Path $dest 'README.md') -Force
Copy-Item (Join-Path $root 'native')       (Join-Path $dest 'native') -Recurse -Force
Copy-Item (Join-Path $root 'tools')        (Join-Path $dest 'tools') -Recurse -Force

Write-Host 'Done.'
Get-ChildItem $dest -Recurse -File | ForEach-Object {
    '{0,8:N0}  {1}' -f $_.Length, $_.FullName.Substring($dest.Length + 1)
}
