param([string]$Manifest='release/publish/channel.json')
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force test-results | Out-Null
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /codepage:65001 /target:exe /main:TerrainFoundry.LauncherTests '/out:test-results\LauncherTests.exe' '/resource:launcher\update-public.xml,update-public.xml' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll 'launcher\Launcher.cs' 'launcher\LauncherTests.cs'
if($LASTEXITCODE -ne 0){throw 'Launcher test build failed'}
& test-results/LauncherTests.exe $Manifest
if($LASTEXITCODE -ne 0){throw 'Launcher integrity tests failed'}
