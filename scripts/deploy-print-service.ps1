param([string]$ResourceGroup='rg-terrainfoundry',[string]$AppName='terrainfoundry-print',[string]$AzureCli='az')
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$stage=Join-Path $repo ('work/print-deploy-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $repo 'print-service/package.json'),(Join-Path $repo 'print-service/pnpm-lock.yaml'),(Join-Path $repo 'print-service/host.json') $stage
Copy-Item (Join-Path $repo 'print-service/src') $stage -Recurse
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
Write-Output "Deployed code to $AppName. Pricing, provider credentials and service activation flags are unchanged."
