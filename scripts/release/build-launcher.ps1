$version=(Get-Content release-config/product.json -Raw | ConvertFrom-Json).launcherVersion
if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid launcher version'}
$source=Get-Content launcher/Launcher.cs -Raw -Encoding utf8
$source=[regex]::Replace($source,'AssemblyVersion\("[0-9.]+"\)','AssemblyVersion("'+$version+'.0")')
[System.IO.File]::WriteAllText((Join-Path $PWD 'launcher/Launcher.cs'),$source,(New-Object System.Text.UTF8Encoding($false)))
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'create-icon.ps1')
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /codepage:65001 /target:winexe '/win32icon:launcher\generated\terrain-foundry.ico' '/out:launcher\TerrainFoundryLauncher.exe' '/resource:launcher\update-public.xml,update-public.xml' '/resource:launcher\launcher-art.jpg,launcher-scene.jpg' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll 'launcher\Launcher.cs'
if($LASTEXITCODE -ne 0){throw 'Launcher compilation failed'}

