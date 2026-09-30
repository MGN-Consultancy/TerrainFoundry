param([Parameter(Mandatory=$true)][string]$File)
$ErrorActionPreference='Stop'
$base=Join-Path $PSScriptRoot '../../.tools/publisher-signing'
$packages=@{
 'microsoft.artifactsigning.client'=@('1.0.128','74bd7d27e6ce1051409c38d9b46bc8df0400ecd643d51ffbf2ac00869061e40b');
 'microsoft.windows.sdk.buildtools'=@('10.0.28000.2705','8bfdfb6ca2633f531cf80b5fa22512ba61a394d7988f0970db83baadc67929ed')
}
foreach($name in $packages.Keys){$v,$sha=$packages[$name];$zip=Join-Path $base "$name.zip";$dir=Join-Path $base $name;New-Item -ItemType Directory -Force $base | Out-Null;if(!(Test-Path -LiteralPath $zip)){Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/$name/$v/$name.$v.nupkg" -OutFile $zip};if((Get-FileHash -LiteralPath $zip).Hash.ToLowerInvariant() -ne $sha){throw 'Signing tool checksum mismatch'};if(!(Test-Path -LiteralPath $dir)){Expand-Archive -LiteralPath $zip -DestinationPath $dir}}
$metadata=@{Endpoint='https://neu.codesigning.azure.net';CodeSigningAccountName='dotrsigningb0f36990';CertificateProfileName='dotr-public';ExcludeCredentials=@('EnvironmentCredential','ManagedIdentityCredential','WorkloadIdentityCredential','SharedTokenCacheCredential','VisualStudioCredential','VisualStudioCodeCredential','AzurePowerShellCredential','AzureDeveloperCliCredential','InteractiveBrowserCredential')}
$meta=Join-Path $base 'metadata.json';$metadata | ConvertTo-Json | Set-Content $meta
$tool=Join-Path $base 'microsoft.windows.sdk.buildtools/bin/10.0.28000.0/x64/signtool.exe'
& $tool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /dlib (Join-Path $base 'microsoft.artifactsigning.client/bin/x64/Azure.CodeSigning.Dlib.dll') /dmdf $meta $File
if($LASTEXITCODE -ne 0){throw 'Publisher signing failed'}
& $tool verify /pa /all $File
if($LASTEXITCODE -ne 0){throw 'Signature verification failed'}
$s=Get-AuthenticodeSignature -LiteralPath $File
if($s.Status -ne 'Valid' -or !$s.TimeStamperCertificate -or $s.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -ne 'MGN CONSULTANCY LIMITED'){throw 'Unexpected or invalid publisher signature'}
Write-Output 'Verified timestamped MGN CONSULTANCY LIMITED publisher signature.'
