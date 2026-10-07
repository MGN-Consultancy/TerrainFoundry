$ErrorActionPreference='Stop'
if(!$env:TERRAIN_RELEASE_KEY){throw 'Incremental updater test requires the channel signing key in the process environment.'}
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('terrain-incremental-'+[Guid]::NewGuid().ToString('N'))
$fixture=[IO.Path]::GetFullPath('test-results/incremental-fixture')
New-Item -ItemType Directory -Force $testRoot,test-results,$fixture | Out-Null
node scripts/release/create-incremental-fixture.mjs
if($LASTEXITCODE -ne 0){throw 'Could not create the signed initial fixture'}
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /codepage:65001 /define:TEST_TRANSPORT,TEST_SKIP_PUBLISHER /target:winexe '/out:test-results\LauncherIncremental.exe' '/resource:launcher\update-public.xml,update-public.xml' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll 'launcher\Launcher.cs'
if($LASTEXITCODE -ne 0){throw 'Incremental launcher test build failed'}
$env:TERRAIN_TEST_ROOT=$testRoot
$env:TERRAIN_TEST_RELEASE=$fixture
function Invoke-TestLauncher {
  $process=Start-Process -FilePath (Resolve-Path 'test-results/LauncherIncremental.exe') -WindowStyle Hidden -PassThru
  if(!$process.WaitForExit(120000)){$process.Kill();throw 'Incremental launcher test timed out'}
  if($process.ExitCode -ne 0){throw "Incremental launcher process failed with exit code $($process.ExitCode)"}
}
Invoke-TestLauncher
$state=Get-Content -LiteralPath (Join-Path $testRoot 'state.json') -Raw | ConvertFrom-Json
if($state.schema -ne 2){throw 'Initial file-level installation did not activate schema 2'}
$firstClient=Join-Path $state.client 'resources/app.js'
if((Get-Content -LiteralPath $firstClient -Raw) -ne 'editor-resource-v1'){throw 'Initial editor files were not installed'}
$firstModel=Join-Path $state.assets.starter 'models/r-002.bin'
if(!(Test-Path -LiteralPath $firstModel)){throw 'Initial scenery pieces were not installed'}
[IO.File]::WriteAllText((Join-Path $testRoot 'download-log.txt'),'')
node scripts/release/create-incremental-fixture.mjs update
if($LASTEXITCODE -ne 0){throw 'Could not create the signed incremental fixture'}
Invoke-TestLauncher
$downloaded=Get-Content -LiteralPath (Join-Path $testRoot 'download-log.txt')
$expected=@('client-app-v2.bin','asset-r-002-v2.bin')
$actualText=(@($downloaded | Sort-Object) -join ',');$expectedText=(@($expected | Sort-Object) -join ',');if($actualText -ne $expectedText){throw "Expected just the two changed files; downloaded $($downloaded -join ', ')"}
$state=Get-Content -LiteralPath (Join-Path $testRoot 'state.json') -Raw | ConvertFrom-Json
if((Get-Content -LiteralPath (Join-Path $state.client 'resources/app.js') -Raw) -ne 'editor-resource-v2'){throw 'Changed editor file was not applied'}
$bytes=[IO.File]::ReadAllBytes((Join-Path $state.assets.starter 'models/r-002.bin'))
if($bytes.Length -ne 48 -or $bytes[0] -ne 9){throw 'Changed scenery piece was not applied'}
if([IO.File]::ReadAllBytes((Join-Path $state.assets.starter 'models/r-001.bin'))[0] -ne 1){throw 'Unchanged scenery piece was not preserved'}
Write-Output 'PASS: launcher, editor, and content components update independently; only changed editor and scenery files were downloaded.'
@{root=$testRoot;result='passed';downloadedChangedFiles=$downloaded} | ConvertTo-Json | Set-Content -Encoding utf8 test-results/incremental-update-receipt.json
