param([switch]$Install,[string]$SeedCache)
$ErrorActionPreference='Stop'
$root=Join-Path $PWD ('test-results/chosen-install-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $root | Out-Null
Copy-Item launcher/installation.json $root
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /codepage:65001 /target:exe /main:TerrainFoundry.LauncherUiTests "/out:$root/LauncherUiTests.exe" '/win32icon:launcher/generated/terrain-foundry.ico' '/resource:launcher/update-public.xml,update-public.xml' '/resource:launcher/launcher-art.jpg,launcher-scene.jpg' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $PWD 'launcher/Launcher.cs') (Join-Path $PWD 'launcher/LauncherUiTests.cs')
if($LASTEXITCODE -ne 0){throw 'Launcher UI test compilation failed'}
$args=@();if($Install){$args+='--install'}
if($SeedCache){$args+='--seed-cache='+(Resolve-Path -LiteralPath $SeedCache).Path}
& "$root/LauncherUiTests.exe" @args
if($LASTEXITCODE -ne 0){throw 'Launcher UI and chosen-directory test failed'}
@{root=$root;approvedInstallation=$Install.IsPresent;result='passed'} | ConvertTo-Json | Set-Content test-results/launcher-ui-receipt.json
