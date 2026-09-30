$ErrorActionPreference='Stop'
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('terrain-launcher-integration-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $testRoot,test-results | Out-Null
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /codepage:65001 /define:TEST_TRANSPORT /target:winexe '/out:test-results\LauncherIntegration.exe' '/resource:launcher\update-public.xml,update-public.xml' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll 'launcher\Launcher.cs'
if($LASTEXITCODE -ne 0){throw 'Integration build failed'}
$env:TERRAIN_TEST_ROOT=$testRoot
$env:TERRAIN_TEST_RELEASE=(Resolve-Path release/publish).Path
$run=Start-Process -FilePath (Resolve-Path test-results/LauncherIntegration.exe) -WindowStyle Hidden -PassThru
if(!$run.WaitForExit(300000)){$run.Kill();throw 'Launcher integration timed out'}
if($run.ExitCode -ne 0){Get-Content -LiteralPath (Join-Path $testRoot 'integration-result.txt');throw 'First-install integration failed'}
$before=Get-Content -LiteralPath (Join-Path $testRoot 'state.json') -Raw
$run=Start-Process -FilePath (Resolve-Path test-results/LauncherIntegration.exe) -WindowStyle Hidden -PassThru
if(!$run.WaitForExit(300000)){$run.Kill();throw 'Cached-update integration timed out'}
if($run.ExitCode -ne 0){throw 'Cached update integration failed'}
if((Get-Content -LiteralPath (Join-Path $testRoot 'state.json') -Raw) -ne $before){throw 'Unchanged release altered activation state'}
Write-Output 'PASS: signed first installation, all client/scenery file inventories, atomic activation and cached update reuse. Fixture transport only; production GitHub download awaits public repository visibility.'
@{root=$testRoot;state=(Join-Path $testRoot 'state.json');result='passed';transport='local release fixture'} | ConvertTo-Json | Set-Content test-results/launcher-integration-receipt.json
