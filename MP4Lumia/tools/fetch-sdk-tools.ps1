# Downloads makeappx.exe / signtool.exe from the Microsoft.Windows.SDK.BuildTools
# NuGet package into .tooling\sdkbt. No Visual Studio needed.
#   powershell -ExecutionPolicy Bypass -File tools\fetch-sdk-tools.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root '.tooling\sdkbt'

$index = Invoke-RestMethod 'https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/index.json'
$stable = @($index.versions | Where-Object { $_ -notmatch '-' })
$ver = ($stable | Sort-Object { [version]$_ })[-1]
Write-Host "package version: $ver"

$url = "https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/$ver/microsoft.windows.sdk.buildtools.$ver.nupkg"
$pkg = Join-Path $env:TEMP "sdkbt-$ver.nupkg"
if (-not (Test-Path $pkg)) {
    Write-Host "downloading $url"
    Invoke-WebRequest -UseBasicParsing $url -OutFile $pkg -TimeoutSec 600
}

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($pkg, $dest)
}

function Find-Tool([string]$name) {
    Get-ChildItem $dest -Recurse -Filter $name -ErrorAction SilentlyContinue |
        Where-Object { $_.DirectoryName -like '*\x64*' } | Select-Object -First 1
}

$make = Find-Tool 'makeappx.exe'
$sign = Find-Tool 'signtool.exe'
if (-not $make) { Write-Host 'MAKEAPPX NOT FOUND'; exit 2 }
if (-not $sign) { Write-Host 'SIGNTOOL NOT FOUND'; exit 3 }
Write-Host "makeappx: $($make.FullName)"
Write-Host "signtool: $($sign.FullName)"
exit 0
