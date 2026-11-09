# Builds and signs MP4Lumia.appx for Windows 10 Mobile (UWP, ARM).
# Uses makeappx/signtool from .tooling\sdkbt (fetched by fetch-sdk-tools.ps1).
#
# The phone runs Windows 10 Mobile 10.0.15254 and refuses Windows Phone 8.1
# packages. This builds the shape that installs there, copied from
# PrivateBrowse-Mobile-1.0.0.1.appx and FreePaint.appx: foundation/windows10
# schema, uap:VisualElements, ARM, TargetDeviceFamily, StartPage only.
#
# Signing: "MP4Lumia Root CA" -> "MP4Lumia Dev" (Code Signing EKU), created on
# first run in Cert:\CurrentUser\My, exported next to the package. The phone
# must trust MP4Lumia-RootCA.cer.
#
#   powershell -ExecutionPolicy Bypass -File tools\build-appx.ps1

$ErrorActionPreference = 'Stop'

$VERSION = '1.0.0.0'
$root    = Split-Path -Parent $PSScriptRoot
$src     = Join-Path $root 'native-appx\MP4Lumia'
$toolDir = Join-Path $root '.tooling\sdkbt'
$work    = Join-Path $root '.tooling\pkg'
$outDir  = Join-Path $root '.tooling\out'
$keyDir  = Join-Path $root '.tooling\keys'
$dist    = Join-Path $root 'appx'

function Find-Tool([string]$name) {
    Get-ChildItem $toolDir -Recurse -Filter $name -ErrorAction SilentlyContinue |
        Where-Object { $_.DirectoryName -like '*\x64*' } | Select-Object -First 1
}

# ------------------------------------------------------------------- payload

Write-Host 'building payload...'
& (Join-Path $PSScriptRoot 'pack-app.ps1')
if (-not $?) { throw 'pack-app.ps1 failed' }

$make = Find-Tool 'makeappx.exe'
$sign = Find-Tool 'signtool.exe'
if (-not $make) { throw 'makeappx.exe missing - run tools\fetch-sdk-tools.ps1' }
if (-not $sign) { throw 'signtool.exe missing - run tools\fetch-sdk-tools.ps1' }

# --- stage the package -----------------------------------------------------
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work -Force | Out-Null
foreach ($f in @('AppxManifest.xml', 'default.html', 'app.js', 'app.css', 'boot.js')) {
    $p = Join-Path $src $f
    if (-not (Test-Path $p)) { throw "payload: $f missing from native-appx\MP4Lumia" }
    Copy-Item $p $work -Force
}
Copy-Item (Join-Path $src 'Assets') (Join-Path $work 'Assets') -Recurse -Force

foreach ($d in @($outDir, $keyDir, $dist)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# --- manifest and asset checks (fail here, not on the phone) ---------------
[xml]$mf = Get-Content (Join-Path $work 'AppxManifest.xml')
$ns = New-Object System.Xml.XmlNamespaceManager($mf.NameTable)
$ns.AddNamespace('a',   'http://schemas.microsoft.com/appx/manifest/foundation/windows10')
$ns.AddNamespace('mp',  'http://schemas.microsoft.com/appx/2014/phone/manifest')
$ns.AddNamespace('uap', 'http://schemas.microsoft.com/appx/manifest/uap/windows10')

if ($mf.DocumentElement.NamespaceURI -ne 'http://schemas.microsoft.com/appx/manifest/foundation/windows10') {
    throw "manifest: root namespace is '$($mf.DocumentElement.NamespaceURI)', Windows 10 Mobile needs foundation/windows10"
}

$identity = $mf.SelectSingleNode('/a:Package/a:Identity', $ns)
if (-not $identity) { throw 'manifest: Identity missing' }
if ($identity.Version -ne $VERSION) { throw "manifest: Version $($identity.Version) does not match $VERSION" }
if ($identity.ProcessorArchitecture -ne 'arm') { throw "manifest: ProcessorArchitecture is '$($identity.ProcessorArchitecture)', a phone needs 'arm'" }

$phoneId = $mf.SelectSingleNode('/a:Package/mp:PhoneIdentity', $ns)
if (-not $phoneId -or -not $phoneId.PhoneProductId -or $phoneId.PhoneProductId -eq '00000000-0000-0000-0000-000000000000') {
    throw 'manifest: mp:PhoneIdentity/PhoneProductId missing'
}

$tdf = $mf.SelectSingleNode('/a:Package/a:Dependencies/a:TargetDeviceFamily', $ns)
if (-not $tdf) { throw 'manifest: TargetDeviceFamily missing (Windows 10 Mobile needs it)' }

$appNode = $mf.SelectSingleNode('/a:Package/a:Applications/a:Application', $ns)
if (-not $appNode.StartPage) { throw 'manifest: Application/@StartPage missing' }
if (-not (Test-Path (Join-Path $work $appNode.StartPage))) { throw "manifest: StartPage '$($appNode.StartPage)' not in package" }

$vis = $mf.SelectSingleNode('/a:Package/a:Applications/a:Application/uap:VisualElements', $ns)
if (-not $vis -or -not $vis.Square150x150Logo -or -not $vis.Square44x44Logo) {
    throw 'manifest: uap:VisualElements needs Square150x150Logo and Square44x44Logo'
}

$vids = $mf.SelectSingleNode('/a:Package/a:Capabilities/uap:Capability[@Name="videosLibrary"]', $ns)
if (-not $vids) { throw 'manifest: videosLibrary capability missing' }

Add-Type -AssemblyName System.Drawing
$expected = [ordered]@{
    'Square44x44Logo.png'   = @(44, 44)
    'Square71x71Logo.png'   = @(71, 71)
    'Square150x150Logo.png' = @(150, 150)
    'Square310x310Logo.png' = @(310, 310)
    'Wide310x150Logo.png'   = @(310, 150)
    'StoreLogo.png'         = @(50, 50)
    'SplashScreen.png'      = @(620, 300)
}
foreach ($name in $expected.Keys) {
    $path = Join-Path $work ('Assets\' + $name)
    if (-not (Test-Path $path)) { throw "image missing from package: Assets\$name" }
    $img = [System.Drawing.Image]::FromFile($path)
    $w = $img.Width; $h = $img.Height; $img.Dispose()
    if ($w -ne $expected[$name][0] -or $h -ne $expected[$name][1]) {
        throw "Assets\$name is ${w}x${h}, expects $($expected[$name][0])x$($expected[$name][1]) - run tools\pack-app.ps1"
    }
}
Write-Host "manifest ok: $($identity.Name) $($identity.Version) $($identity.ProcessorArchitecture), min $($tdf.MinVersion), max $($tdf.MaxVersionTested)"

# --- certificates ---------------------------------------------------------
$rootSubject = 'CN=MP4Lumia Root CA'
$leafSubject = 'CN=MP4Lumia Dev'          # must equal Identity/@Publisher
if ($leafSubject -ne $identity.Publisher) { throw "Identity/@Publisher '$($identity.Publisher)' must equal '$leafSubject'" }

$rootCert = Get-ChildItem Cert:\CurrentUser\My |
            Where-Object { $_.Subject -eq $rootSubject -and $_.HasPrivateKey } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $rootCert) {
    Write-Host 'creating root CA (MP4Lumia Root CA)...'
    $rootCert = New-SelfSignedCertificate `
        -Subject $rootSubject `
        -KeyUsage CertSign, CRLSign, DigitalSignature `
        -KeyUsageProperty All `
        -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256 `
        -CertStoreLocation Cert:\CurrentUser\My `
        -NotAfter (Get-Date).AddYears(10) `
        -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=0')
}
Write-Host "root CA: $($rootCert.Thumbprint)"

$leafCert = Get-ChildItem Cert:\CurrentUser\My |
            Where-Object { $_.Subject -eq $leafSubject -and $_.Issuer -eq $rootCert.Subject -and $_.HasPrivateKey } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $leafCert) {
    Write-Host 'creating signing certificate (MP4Lumia Dev)...'
    $leafCert = New-SelfSignedCertificate `
        -Subject $leafSubject `
        -Signer $rootCert `
        -KeyUsage DigitalSignature `
        -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256 `
        -CertStoreLocation Cert:\CurrentUser\My `
        -NotAfter (Get-Date).AddYears(3) `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3')
}
Write-Host "signing certificate: $($leafCert.Thumbprint)"

$rootCer = Join-Path $keyDir 'MP4Lumia-RootCA.cer'
$leafCer = Join-Path $keyDir 'MP4Lumia-Dev.cer'
Export-Certificate -Cert $rootCert -FilePath $rootCer -Type CERT | Out-Null
Export-Certificate -Cert $leafCert -FilePath $leafCer -Type CERT | Out-Null

# --- pack (validation on: makeappx checks the manifest and every asset) ----
$appx = Join-Path $outDir 'MP4Lumia.appx'
if (Test-Path $appx) { Remove-Item $appx -Force }
& $make.FullName pack /d $work /p $appx /o 2>&1 | Where-Object { $_ -notmatch '^\s*$' } | ForEach-Object { $_ }
Write-Host "makeappx exit: $LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { exit 4 }

# --- sign, embedding the root so the phone can build the chain ------------
& $sign.FullName sign /fd SHA256 /sha1 $leafCert.Thumbprint /ac $rootCer $appx 2>&1 | ForEach-Object { $_ }
Write-Host "signtool exit: $LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { exit 5 }

# --- structural check: unpack and list what is inside --------------------
$unpack = Join-Path $root '.tooling\verify'
if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
& $make.FullName unpack /p $appx /d $unpack 2>&1 | Where-Object { $_ -notmatch '^\s*$' } | ForEach-Object { $_ }
Write-Host "unpack exit: $LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { exit 6 }
Write-Host 'package contents:'
Get-ChildItem $unpack -Recurse -File | ForEach-Object { '  ' + $_.FullName.Substring($unpack.Length + 1) }

$p7x = Join-Path $unpack 'AppxSignature.p7x'
if (-not (Test-Path $p7x)) { throw 'AppxSignature.p7x missing from package' }
Write-Host "signature blob: $([math]::Round((Get-Item $p7x).Length / 1024, 1)) KB"

# The leaf must carry the Code Signing EKU. The root is a plain CA and has no
# EKU, so chain usage checking is relaxed with IgnoreWrongUsage (Windows itself
# only requires the leaf's EKU plus a trusted root).
$eku = $leafCert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' }
if (-not $eku -or $eku.Format($false) -notmatch '1\.3\.6\.1\.5\.5\.7\.3\.3') {
    throw 'signing certificate has no Code Signing EKU (1.3.6.1.5.5.7.3.3)'
}
Write-Host "leaf EKU: $($eku.Format($false))"

$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
$chain.ChainPolicy.RevocationMode = 'NoCheck'
$chain.ChainPolicy.ApplicationPolicy.Add((New-Object System.Security.Cryptography.Oid('1.3.6.1.5.5.7.3.3')))
$chain.ChainPolicy.ExtraStore.Add($rootCert)
$chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::AllowUnknownCertificateAuthority -bor [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::IgnoreWrongUsage
$chainOk = $chain.Build($leafCert)
foreach ($st in $chain.ChainStatus) { Write-Host "  chain status: $($st.Status) - $($st.StatusInformation.Trim())" }
Write-Host "leaf -> root chain valid (local trust ignored): $chainOk"
foreach ($el in $chain.ChainElements) { Write-Host "  chain: $($el.Certificate.Subject)" }
if (-not $chainOk) { throw 'package chain is not valid against the shipped root' }

# --- deliver -------------------------------------------------------------
Get-ChildItem $dist -File -ErrorAction SilentlyContinue | Remove-Item -Force
Copy-Item $appx $dist -Force
Copy-Item $rootCer $dist -Force
Copy-Item $leafCer $dist -Force
Copy-Item (Join-Path $src 'AppxManifest.xml') $dist -Force

$hash = (Get-FileHash $appx -Algorithm SHA256).Hash

$notes = @'
MP4Lumia - Nokia Lumia 929 / Windows 10 Mobile
==============================================

A Netflix-style video player for the videos already on the phone. Local only:
no account, no network, no Store.

FILES IN THIS FOLDER
  MP4Lumia.appx          signed ARM package for Windows 10 Mobile
  MP4Lumia-RootCA.cer    the root the package chains to - trust this on the phone
  MP4Lumia-Dev.cer       the signing certificate itself, for reference
  AppxManifest.xml       the manifest inside the package, for reference
  INSTALL.txt            this file

INSTALL - the same steps that worked for PrivateBrowse and FreePaint
  1. Copy MP4Lumia.appx and MP4Lumia-RootCA.cer into the phone's own storage,
     for example: This Device > Downloads > MP4Lumia.
     Do not leave them only in OneDrive.
  2. Settings > Update & security > For developers > Developer mode.
     Choose Developer mode, not "Sideload apps", then restart the phone.
  3. Open MP4Lumia-RootCA.cer from the phone's file manager and install it as a
     trusted root. If the page only shows certificate details with no install
     button, it is not installed yet.
  4. Open MP4Lumia.appx from the same folder and confirm the install prompt.
     It takes a few seconds; MP4Lumia then appears in the app list.
  5. If nothing appears, restart the phone and search All apps for MP4Lumia,
     or check Settings > Apps > Apps & features.

FIRST RUN
  Tap "Add videos" and pick files from Downloads, Videos, SD card or OneDrive
  files that are kept on the device.
  "Scan Videos folder" adds everything it finds in This Device > Videos,
  including subfolders.

IF SOMETHING GOES WRONG
  0x800B0109  root not trusted on the phone - install MP4Lumia-RootCA.cer
  0x80073CFF  not in Developer mode - step 2
  0x80073CF3  architecture or dependency conflict - you are opening an older or
              different package; use this file (about 60 KB)
  0x80073CF0  truncated copy - copy MP4Lumia.appx again
  Settings > System > About shows the OS build. This package needs 10.0.10586
  or later; a Lumia Icon on Windows 10 Mobile reports 10.0.15254.
  A Windows 10 PC will also refuse this file: it is a phone package.

PLAYBACK NOTES
  Video is decoded by the phone's own Media Foundation stack through the app's
  video element. MP4/H.264 with AAC is the safest combination and plays
  everywhere. MKV, AVI, WMV, MOV, TS and 3GP play when the container's codecs
  are ones the phone knows. A file with an unsupported codec (for example HEVC
  without the extension, or AC-3 audio) shows a message in the player with an
  "Open in Movies & TV" button.

ABOUT THE SIGNATURE
  MP4Lumia Root CA is self-signed, CA:true, path length 0, valid 10 years.
  MP4Lumia Dev is issued by it with the Code Signing EKU, valid 3 years.
  Neither is timestamped and neither is from the Store: fine for sideloading,
  unsuitable for anything else.
'@
Set-Content -Path (Join-Path $dist 'INSTALL.txt') -Value $notes -Encoding ASCII

Add-Content -Path (Join-Path $dist 'INSTALL.txt') -Value (
    "`r`nPACKAGE`r`n  MP4Lumia.appx version $VERSION, ARM, SHA256`r`n  $hash`r`n")

Write-Host "appx bytes: $((Get-Item $appx).Length)"
Write-Host "sha256:     $hash"
Write-Host 'delivered:'
Get-ChildItem $dist -File | ForEach-Object { '{0,10:N0}  {1}' -f $_.Length, $_.Name }
