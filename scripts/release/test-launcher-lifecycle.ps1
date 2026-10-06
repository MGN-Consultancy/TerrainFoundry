$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force test-results | Out-Null
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /codepage:65001 /define:TEST_UI,TEST_TRANSPORT /target:exe /main:TerrainFoundry.LauncherLifecycleTests '/out:test-results\LauncherLifecycleTests.exe' '/resource:launcher\update-public.xml,update-public.xml' '/resource:site\assets\scenery-backdrop.png,launcher-scene.png' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll 'launcher\Launcher.cs' 'launcher\LauncherLifecycleTests.cs'
if($LASTEXITCODE -ne 0){throw 'Launcher lifecycle test compilation failed'}
& test-results/LauncherLifecycleTests.exe
if($LASTEXITCODE -ne 0){throw 'Launcher startup lifecycle failed'}
