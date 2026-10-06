param([string]$ResourceGroup='rg-terrainfoundry',[string]$AppName='terrainfoundry-premium',[string]$AzureCli='az')
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$stage=Join-Path $repo ('work/premium-deploy-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $repo 'print-service/package.json'),(Join-Path $repo 'print-service/pnpm-lock.yaml'),(Join-Path $repo 'print-service/host.json') $stage
Copy-Item (Join-Path $repo 'print-service/src') $stage -Recurse
$packagePath=Join-Path $stage 'package.json'
$package=Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
$package.main='src/premium-functions.mjs'
$package | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $packagePath
# Hoisted dependencies produce a portable archive without Windows-only symlinks.
$previousCI=$env:CI
try {
  $env:CI='true'
  & pnpm --dir $stage install --ignore-workspace --frozen-lockfile --ignore-scripts --prod --node-linker=hoisted
  if($LASTEXITCODE -ne 0){throw 'Dependency installation failed'}
} finally { $env:CI=$previousCI }
$archive=$stage+'.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage,$archive)
& $AzureCli functionapp deployment source config-zip --resource-group $ResourceGroup --name $AppName --src $archive --query '{status:status,message:message}' -o json
if($LASTEXITCODE -ne 0){throw 'Function deployment failed; existing settings were not changed'}
Write-Output "Deployed code to $AppName. Sales remain governed by the configured pack approval and enablement flags."
