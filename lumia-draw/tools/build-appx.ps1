# Builds and signs FreePaint.appx for Windows 10 Mobile (UWP, ARM).
# Uses makeappx/signtool from .tooling\sdkbt (fetched by fetch-sdk-tools.ps1).
# Output lands in appx-dist\, which pack-draw.ps1 copies into Downloads\FreePaint\appx\.
#
# Why this shape: the phone runs Windows 10 Mobile. The earlier WP8.1 package
# (2010 schema, neutral architecture, no TargetDeviceFamily) is refused by that
# OS. PrivateBrowse-Mobile-1.0.0.1.appx did install on the same phone, and this
# build matches it: foundation/windows10 + uap:VisualElements, ARM, and
# TargetDeviceFamily Windows.Universal 10.0.10586.0 .. 10.0.15254.0.
#
# Signing: FreePaint Root CA -> FreePaint Dev (EKU Code Signing). The root is
# embedded with signtool /ac and shipped as .cer; the phone must trust it.

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$src     = Join-Path $root 'native-appx\FreePaint'
$toolDir = Join-Path $root '.tooling\sdkbt'
$work    = Join-Path $root '.tooling\pkg'
$outDir  = Join-Path $root '.tooling\out'
$keyDir  = Join-Path $root '.tooling\keys'
$dist    = Join-Path $root 'appx-dist'

function Find-Tool([string]$name) {
    Get-ChildItem $toolDir -Recurse -Filter $name -ErrorAction SilentlyContinue |
        Where-Object { $_.DirectoryName -like '*\x64*' } | Select-Object -First 1
}
$make = Find-Tool 'makeappx.exe'
$sign = Find-Tool 'signtool.exe'
if (-not $make) { throw 'makeappx.exe missing - run tools\fetch-sdk-tools.ps1' }
if (-not $sign) { throw 'signtool.exe missing - run tools\fetch-sdk-tools.ps1' }

# --- package layout -------------------------------------------------------
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work -Force | Out-Null
Copy-Item (Join-Path $src 'AppxManifest.xml') $work -Force
Copy-Item (Join-Path $src 'default.html')     $work -Force
Copy-Item (Join-Path $src 'app.js')           $work -Force
Copy-Item (Join-Path $src 'boot.js')          $work -Force
Copy-Item (Join-Path $src 'Assets')           (Join-Path $work 'Assets') -Recurse -Force

foreach ($f in @('app.js', 'boot.js')) {
    if (-not (Test-Path (Join-Path $work $f))) { throw "package: $f missing from native-appx\FreePaint" }
}

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
    throw "manifest: root namespace is '$($mf.DocumentElement.NamespaceURI)', Windows 10 Mobile needs the foundation/windows10 schema"
}

$identity = $mf.SelectSingleNode('/a:Package/a:Identity', $ns)
if (-not $identity) { throw 'manifest: Identity element missing' }
$publisher = $identity.Publisher
$version   = $identity.Version
$arch      = $identity.ProcessorArchitecture
if ($arch -ne 'arm') { throw "manifest: ProcessorArchitecture is '$arch', a phone needs 'arm'" }

$phoneId = $mf.SelectSingleNode('/a:Package/mp:PhoneIdentity', $ns)
if (-not $phoneId) { throw 'manifest: mp:PhoneIdentity missing' }
if (-not $phoneId.PhoneProductId -or $phoneId.PhoneProductId -eq '00000000-0000-0000-0000-000000000000') {
    throw 'manifest: PhoneProductId is missing or empty'
}

$tdf = $mf.SelectSingleNode('/a:Package/a:Dependencies/a:TargetDeviceFamily', $ns)
if (-not $tdf) { throw 'manifest: Dependencies/TargetDeviceFamily missing (Windows 10 Mobile needs it)' }
if ($tdf.Name -ne 'Windows.Universal') { Write-Host "note: TargetDeviceFamily is $($tdf.Name)" }

$appNode = $mf.SelectSingleNode('/a:Package/a:Applications/a:Application', $ns)
if (-not $appNode.StartPage) { throw 'manifest: Application/@StartPage missing' }
if (-not (Test-Path (Join-Path $work $appNode.StartPage))) { throw "manifest: StartPage '$($appNode.StartPage)' not in package" }

$vis = $mf.SelectSingleNode('/a:Package/a:Applications/a:Application/uap:VisualElements', $ns)
if (-not $vis) { throw 'manifest: uap:VisualElements missing' }
if (-not $vis.Square150x150Logo -or -not $vis.Square44x44Logo) {
    throw 'manifest: uap:VisualElements needs Square150x150Logo and Square44x44Logo'
}

# UWP asset names and sizes. The loader rejects a package that references a
# missing image, so every referenced file must exist and be the right shape.
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
        throw "Assets\$name is ${w}x${h}, expects $($expected[$name][0])x$($expected[$name][1]) - run tools\pack-draw.ps1"
    }
}
Write-Host "manifest ok: uwp arm, publisher='$publisher' version=$version min=$($tdf.MinVersion) max=$($tdf.MaxVersionTested)"

# --- certificates ---------------------------------------------------------
$rootSubject = 'CN=FreePaint Root CA'
$leafSubject = 'CN=FreePaint Dev'          # must equal Identity/@Publisher
if ($leafSubject -ne $publisher) { throw "Identity/@Publisher '$publisher' must equal '$leafSubject'" }

$rootCert = Get-ChildItem Cert:\CurrentUser\My |
            Where-Object { $_.Subject -eq $rootSubject -and $_.HasPrivateKey } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $rootCert) { throw 'FreePaint Root CA with private key not found in Cert:\CurrentUser\My' }
Write-Host "root CA: $($rootCert.Thumbprint)"

$leafCert = Get-ChildItem Cert:\CurrentUser\My |
            Where-Object { $_.Subject -eq $leafSubject -and $_.Issuer -eq $rootCert.Subject -and $_.HasPrivateKey } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $leafCert) { throw 'FreePaint Dev signing certificate not found (run the old build or create it)' }
Write-Host "signing certificate: $($leafCert.Thumbprint)"

$rootCer = Join-Path $keyDir 'FreePaint-RootCA.cer'
$leafCer = Join-Path $keyDir 'FreePaint-Dev.cer'
Export-Certificate -Cert $rootCert -FilePath $rootCer -Type CERT | Out-Null
Export-Certificate -Cert $leafCert -FilePath $leafCer -Type CERT | Out-Null

# --- pack (validation ON: makeappx checks the manifest and every asset) ----
$appx = Join-Path $outDir 'FreePaint.appx'
if (Test-Path $appx) { Remove-Item $appx -Force }
& $make.FullName pack /d $work /p $appx /o 2>&1 | Where-Object { $_ -notmatch '^\s*$' } | ForEach-Object { $_ }
Write-Host "makeappx exit: $LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { exit 4 }

# --- sign, embedding the root so the phone can build the chain ------------
# /sha1, not /f: the pfx also carries the root, which has no EKU, so signtool
# sees two candidates and refuses to guess.
& $sign.FullName sign /fd SHA256 /sha1 $leafCert.Thumbprint /ac $rootCer $appx 2>&1 | ForEach-Object { $_ }
Write-Host "signtool exit: $LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { exit 5 }

# --- structural check: unpack and list what is inside ---------------------
$unpack = Join-Path $root '.tooling\verify'
if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
& $make.FullName unpack /p $appx /d $unpack 2>&1 | Where-Object { $_ -notmatch '^\s*$' } | ForEach-Object { $_ }
Write-Host "unpack exit: $LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { exit 6 }
Write-Host 'package contents:'
Get-ChildItem $unpack -Recurse -File | ForEach-Object { '  ' + $_.FullName.Substring($unpack.Length + 1) }

# --- verify the signature, read-only --------------------------------------
$p7x = Join-Path $unpack 'AppxSignature.p7x'
if (-not (Test-Path $p7x)) { throw 'AppxSignature.p7x missing from package' }
Write-Host "signature blob: $([math]::Round((Get-Item $p7x).Length / 1024, 1)) KB"

$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
$chain.ChainPolicy.RevocationMode = 'NoCheck'
$chain.ChainPolicy.ApplicationPolicy.Add((New-Object System.Security.Cryptography.Oid('1.3.6.1.5.5.7.3.3')))
$chain.ChainPolicy.ExtraStore.Add($rootCert)
$chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::AllowUnknownCertificateAuthority
$chainOk = $chain.Build($leafCert)
Write-Host "leaf -> root chain valid (local trust ignored): $chainOk"
foreach ($el in $chain.ChainElements) { Write-Host "  chain: $($el.Certificate.Subject)" }
if (-not $chainOk) { throw 'package chain is not valid against the shipped root' }

# --- deliver --------------------------------------------------------------
Get-ChildItem $dist -File -ErrorAction SilentlyContinue | Remove-Item -Force
Copy-Item $appx $dist -Force
Copy-Item $rootCer $dist -Force
Copy-Item $leafCer $dist -Force
Copy-Item (Join-Path $src 'AppxManifest.xml') $dist -Force

$notes = @'
FreePaint - Nokia Lumia 929 / Windows 10 Mobile
===============================================

FILES IN THIS FOLDER
  FreePaint.appx        signed ARM package for Windows 10 Mobile
  FreePaint-RootCA.cer  the root the package chains to
  FreePaint-Dev.cer     the signing certificate itself, for reference
  AppxManifest.xml      the manifest inside the package, for reference
  INSTALL.txt           this file

WHY THE EARLIER PACKAGE WOULD NOT INSTALL
It was built for Windows Phone 8.1: 2010 manifest schema, neutral architecture,
no TargetDeviceFamily. This phone runs Windows 10 Mobile, which will not install
that. The rebuild matches PrivateBrowse-Mobile-1.0.0.1.appx, the package that
did install on this phone: foundation/windows10 schema, uap:VisualElements,
ProcessorArchitecture="arm", TargetDeviceFamily Windows.Universal 10.0.10586.0
to 10.0.15254.0, StartPage only (an HTML/JavaScript app, like PrivateBrowse).

INSTALL - the same way PrivateBrowse worked
  1. Copy FreePaint.appx and FreePaint-RootCA.cer into the phone's own storage,
     for example: This Device > Downloads > FreePaint.
     Do not leave them only in OneDrive.
  2. Settings > Update & security > For developers > Developer mode.
     Choose Developer mode, not "Sideload apps", then restart the phone.
  3. Open FreePaint-RootCA.cer from the phone's file manager and install it as
     a trusted root, if it is not already trusted. If the page only shows
     certificate details with no install button, it is not installed.
  4. Open FreePaint.appx from the same folder and confirm the install prompt.
     It takes seconds; FreePaint then appears in the app list.
  5. If nothing appears, restart the phone and search All apps for FreePaint,
     or check Settings > Apps > Apps & features.

IF IT STILL DOES NOTHING
  0x800B0109  root not trusted on the phone - install FreePaint-RootCA.cer.
  0x80073CFF  not in Developer mode - step 2.
  0x80073CF3  architecture or dependency conflict - you are probably opening an
              older neutral WP8.1 package; use this one (about 70 KB).
  0x80073CF0  truncated copy - copy the file again.
  Settings > System > About shows the OS build. This package needs 10.0.10586
  or later; a Lumia Icon on Windows 10 Mobile is 10.0.15254.
  A Windows 10 PC will also refuse this file: it is a phone package.

ABOUT THE SIGNATURE
FreePaint Root CA is self-signed, CA:true, path length 0, valid 10 years.
FreePaint Dev is issued by it, carries the Code Signing EKU, valid 3 years.
Neither is timestamped and neither is from the Store: fine for sideloading,
unsuitable for anything else.
'@
Set-Content -Path (Join-Path $dist 'INSTALL.txt') -Value $notes -Encoding ASCII

Write-Host "appx bytes: $((Get-Item $appx).Length)"
Write-Host 'delivered:'
Get-ChildItem $dist -File | ForEach-Object { '{0,10:N0}  {1}' -f $_.Length, $_.Name }
