$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$toolFolder = Join-Path $taskRoot '.tools\wix314'
$archive = Join-Path $taskRoot '.tools\wix314-binaries.zip'
$expected = '6AC824E1642D6F7277D0ED7EA09411A508F6116BA6FAE0AA5F2C7DAA2FF43D31'
New-Item -ItemType Directory -Force $toolFolder | Out-Null
if (!(Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest 'https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip' -OutFile $archive
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'WiX download checksum mismatch.' }
Expand-Archive -LiteralPath $archive -DestinationPath $toolFolder -Force
Write-Output 'WiX 3.14.1 build tools ready. End users do not need WiX or .NET.'
