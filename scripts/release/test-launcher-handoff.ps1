$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force test-results | Out-Null
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /codepage:65001 /define:TEST_TRANSPORT,TEST_HANDOFF /target:exe /main:TerrainFoundry.LauncherHandoffTests '/out:test-results\LauncherHandoffTests.exe' '/resource:launcher\update-public.xml,update-public.xml' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll 'launcher\Launcher.cs' 'launcher\LauncherHandoffTests.cs'
if($LASTEXITCODE -ne 0){throw 'Launcher handoff test compilation failed'}
& test-results/LauncherHandoffTests.exe
if($LASTEXITCODE -ne 0){throw 'Launcher handoff test failed'}
