param([Parameter(Mandatory=$true)][string]$PrivateDeliveryFolder,[string]$AzureCli='az',[string]$ResourceGroup='rg-terrainfoundry',[string]$StorageAccount='tfpremium5xc3ig54fujlw')
$ErrorActionPreference='Stop'
$recordFile=Join-Path $PrivateDeliveryFolder 'private-delivery-record.json'
$record=Get-Content -LiteralPath $recordFile -Raw | ConvertFrom-Json
if($record.approved -ne $true -or $record.fixtureOnly -eq $true -or $record.blob -notmatch '^packs/(tf-[a-z0-9-]+)/([0-9]+\.[0-9]+\.[0-9]+)/([a-f0-9]{64})\.tfc$'){throw 'Use an approved production delivery record'}
$packId=$Matches[1];$version=$Matches[2];$expectedHash=$Matches[3]
$blobFile=Join-Path $PrivateDeliveryFolder ($expectedHash+'.tfc')
if((Get-FileHash -LiteralPath $blobFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash){throw 'Encrypted pack inventory changed'}
$previousPremiumConnection=$env:AZURE_STORAGE_CONNECTION_STRING
try {
 $connection=& $AzureCli storage account show-connection-string --resource-group $ResourceGroup --name $StorageAccount --query connectionString --output tsv
 if($LASTEXITCODE -ne 0 -or !$connection){throw 'Private storage access unavailable'}
 $env:AZURE_STORAGE_CONNECTION_STRING=$connection
 & $AzureCli storage blob upload --container-name premium-packs --name $record.blob --file $blobFile --overwrite false --output none
 if($LASTEXITCODE -ne 0){throw 'Immutable blob upload failed; no catalogue activation was attempted'}
 & $AzureCli storage blob upload --container-name premium-state --name "catalogue/$packId.json" --file $recordFile --overwrite true --output none
 if($LASTEXITCODE -ne 0){throw 'Private catalogue registration failed; the previous installed version remains available'}
 Write-Output "Registered encrypted $packId version $version. Checkout approval and sales flags were not changed."
}finally{$env:AZURE_STORAGE_CONNECTION_STRING=$previousPremiumConnection;$connection=$null}
