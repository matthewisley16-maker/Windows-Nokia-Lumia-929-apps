# Builds the MP3Lumia payload:
#   1. concatenates src\js\*.js (in name order) into one app.js
#   2. writes native-appx\MP3Lumia (default.html with inline CSS + external
#      boot.js/app.js, because the Windows app host does not run inline script)
#   3. writes MP3Lumia.html, a single self-contained file for browser use
#   4. draws the UWP tile and splash images
#
#   powershell -ExecutionPolicy Bypass -File tools\pack-app.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$VERSION = '1.0.0.0'
$root    = Split-Path -Parent $PSScriptRoot
$src     = Join-Path $root 'src'
$appDir  = Join-Path $root 'native-appx\MP3Lumia'
$assets  = Join-Path $appDir 'Assets'

function Read-Text([string]$path) { [System.IO.File]::ReadAllText($path) }
function Write-Text([string]$path, [string]$text) {
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

if (-not (Test-Path $appDir)) { New-Item -ItemType Directory -Path $appDir -Force | Out-Null }
if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Path $assets -Force | Out-Null }

# ------------------------------------------------------------------ app code

$parts = @(Get-ChildItem (Join-Path $src 'js') -Filter '*.js' | Sort-Object Name)
if ($parts.Count -lt 5) { throw 'src\js is missing modules (expected 01-core .. 06-app)' }

$js = ''
foreach ($p in $parts) {
    $js += (Read-Text $p.FullName) + "`r`n"
}
$js = "/* MP3Lumia $VERSION - built $(Get-Date -Format 'yyyy-MM-dd HH:mm') from src/js (" +
      (($parts | ForEach-Object { $_.Name }) -join ', ') + ") */`r`n" + $js

$css  = Read-Text (Join-Path $src 'app.css')
$boot = Read-Text (Join-Path $src 'boot.js')
$shell = Read-Text (Join-Path $src 'shell.html')

$cssLink = '<link rel="stylesheet" href="app.css" id="appcss" />'
if ($shell.IndexOf($cssLink) -lt 0) { throw "shell.html: stylesheet link not found ($cssLink)" }
if ($shell.IndexOf('<script src="boot.js"></script>') -lt 0) { throw 'shell.html: boot.js tag not found' }
if ($shell.IndexOf('<script src="app.js"></script>') -lt 0) { throw 'shell.html: app.js tag not found' }

$packaged = $shell.Replace($cssLink, "<style>`r`n$css`r`n</style>")

Write-Text (Join-Path $appDir 'app.js') $js
Write-Text (Join-Path $appDir 'app.css') $css
Write-Text (Join-Path $appDir 'boot.js') $boot
Write-Text (Join-Path $appDir 'default.html') $packaged
Copy-Item (Join-Path $src 'AppxManifest.xml') (Join-Path $appDir 'AppxManifest.xml') -Force
if (Test-Path (Join-Path $appDir '.keep')) { Remove-Item (Join-Path $appDir '.keep') -Force }

$single = $packaged.Replace('<script src="boot.js"></script>', "<script>`r`n$boot`r`n</script>")
$single = $single.Replace('<script src="app.js"></script>', "<script>`r`n$js`r`n</script>")
Write-Text (Join-Path $root 'MP3Lumia.html') $single

Write-Host ("app.js        {0,9:N0} bytes" -f (Get-Item (Join-Path $appDir 'app.js')).Length)
Write-Host ("MP3Lumia.html {0,9:N0} bytes" -f (Get-Item (Join-Path $root 'MP3Lumia.html')).Length)

# --------------------------------------------------------------------- art

function RoundRect([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [Math]::Max(2, $r * 2)
    if ($d -gt $w) { $d = $w }
    if ($d -gt $h) { $d = $h }
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

function New-Art([string]$path, [int]$w, [int]$h, [bool]$wordmark) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 10, 13))

    $green = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 215, 96))
    $dark  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 6, 19, 10))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $note = [string][char]0x266B

    if ($wordmark) {
        $box = [int]([Math]::Min($h * 0.56, $w * 0.26))
        if ($box -lt 12) { $box = 12 }
        $x = [int]($w * 0.07)
        $y = [int](($h - $box) / 2)
        $rr = RoundRect $x $y $box $box ([int]($box * 0.24))
        $g.FillPath($green, $rr)
        $rr.Dispose()

        $nf = New-Object System.Drawing.Font('Segoe UI Symbol', [single]($box * 0.66), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $g.DrawString($note, $nf, $dark, (New-Object System.Drawing.RectangleF($x, $y, $box, $box)), $sf)
        $nf.Dispose()

        $size = [single]([Math]::Max(8, $h * 0.16))
        $font = New-Object System.Drawing.Font('Segoe UI', $size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $tx = [single]($x + $box + $w * 0.05)
        $ty = [single](($h - $size) / 2)
        $g.DrawString('MP3LUMIA', $font, $white, $tx, $ty)
        $font.Dispose()
    }
    else {
        $pad = [int]($w * 0.07)
        if ($pad -lt 1) { $pad = 1 }
        $box = $w - $pad * 2
        $rr = RoundRect $pad $pad $box $box ([int]($box * 0.26))
        $g.FillPath($green, $rr)
        $rr.Dispose()

        $nf = New-Object System.Drawing.Font('Segoe UI Symbol', [single]($box * 0.62), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $g.DrawString($note, $nf, $dark, (New-Object System.Drawing.RectangleF($pad, $pad, $box, $box)), $sf)
        $nf.Dispose()
    }

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $green.Dispose(); $dark.Dispose(); $white.Dispose(); $sf.Dispose()
    Write-Host ("  asset {0,-24} {1}x{2}" -f (Split-Path -Leaf $path), $w, $h)
}

Write-Host 'drawing UWP assets...'
New-Art (Join-Path $assets 'Square44x44Logo.png')    44  44  $false
New-Art (Join-Path $assets 'Square71x71Logo.png')    71  71  $false
New-Art (Join-Path $assets 'Square150x150Logo.png') 150 150  $false
New-Art (Join-Path $assets 'Square310x310Logo.png') 310 310  $false
New-Art (Join-Path $assets 'Wide310x150Logo.png')   310 150  $true
New-Art (Join-Path $assets 'StoreLogo.png')          50  50  $false
New-Art (Join-Path $assets 'SplashScreen.png')      620 300  $true

Write-Host 'payload ready:'
Get-ChildItem $appDir -Recurse -File | ForEach-Object {
    '{0,9:N0}  {1}' -f $_.Length, $_.FullName.Substring($appDir.Length + 1)
}
