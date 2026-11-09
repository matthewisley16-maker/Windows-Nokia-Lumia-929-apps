# Builds the native Windows Phone 8.1 (Silverlight) XAP for LumiaWiFiFix.
# Needs: Visual Studio 2015/2017 + the Windows Phone 8.1 SDK.
# Run:  powershell -ExecutionPolicy Bypass -File tools\build-xap.ps1

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

function Find-MSBuild {
    $candidates = @(
        "${env:ProgramFiles(x86)}\MSBuild\14.0\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2017\Community\MSBuild\15.0\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2017\Professional\MSBuild\15.0\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2017\Enterprise\MSBuild\15.0\Bin\MSBuild.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    $cmd = Get-Command msbuild -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$msbuild = Find-MSBuild

if (-not $msbuild) {
    Write-Host ''
    Write-Host 'No MSBuild found.' -ForegroundColor Yellow
    Write-Host 'A Windows Phone 8.1 XAP can only be compiled by the WP8.1 SDK toolchain,' -ForegroundColor Yellow
    Write-Host 'which needs Visual Studio 2015 (or 2017 with the WP8.1 component).' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Without that toolchain, install the web app instead:'
    Write-Host '  put Lumia929-WiFiFix.html on OneDrive, open the link in IE on the phone,'
    Write-Host '  then ... > pin to Start. See README.md.'
    Write-Host ''
    exit 1
}

$sdk81 = "${env:ProgramFiles(x86)}\Microsoft SDKs\Windows Phone\v8.1"
if (-not (Test-Path $sdk81)) {
    Write-Host "Note: Windows Phone 8.1 SDK not found at $sdk81" -ForegroundColor Yellow
    Write-Host 'The build will fail unless the SDK component is installed.' -ForegroundColor Yellow
}

$solution = Join-Path $root 'native\LumiaWiFiFix.sln'
Write-Host "MSBuild : $msbuild"
Write-Host "Solution: $solution"
Write-Host ''

& $msbuild $solution /t:Build /p:Configuration=Release /p:Platform="Any CPU" /v:minimal /nologo

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host "Build failed (exit $LASTEXITCODE)." -ForegroundColor Red
    Write-Host 'If Visual Studio rejected the project type, create a new Windows Phone' -ForegroundColor Yellow
    Write-Host 'Silverlight App project and copy the .cs/.xaml/manifest/Assets across.' -ForegroundColor Yellow
    exit $LASTEXITCODE
}

$xap = Join-Path $root 'native\LumiaWiFiFix\Bin\Release\LumiaWiFiFix.xap'
if (Test-Path $xap) {
    Write-Host ''
    Write-Host "XAP: $xap" -ForegroundColor Green
    Write-Host 'Deploy with the WP8.1 Application Deployment tool (a developer-unlocked' 
    Write-Host 'Lumia 929 connected over USB), or Debug > Deploy from Visual Studio.'
} else {
    Write-Host 'Build reported success but no XAP was produced.' -ForegroundColor Yellow
    exit 1
}
