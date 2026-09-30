param location string = 'uksouth'
param name string = 'terrainfoundry-print'
param siteOrigin string = 'https://terrainfoundry.co.uk'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'tfprint${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', supportsHttpsTrafficOnly: true, allowBlobPublicAccess: false }
}
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${name}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: { reserved: true }
  kind: 'linux'
}
resource function 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: { allowedOrigins: [siteOrigin, 'https://www.terrainfoundry.co.uk'], supportCredentials: false }
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'FUNCTIONS_REQUEST_BODY_SIZE_LIMIT', value: '42043040' }
        { name: 'PRINT_SITE_ORIGIN', value: siteOrigin }
        { name: 'PRINT_ALLOWED_ORIGINS', value: '${siteOrigin},https://www.terrainfoundry.co.uk' }
        { name: 'PRINT_OPERATOR_EMAIL', value: 'nigel.webster@mgnconsultancy.co.uk' }
        { name: 'PRINT_SERVICE_ENABLED', value: 'false' }
        { name: 'PRINT_COMMERCIAL_RIGHTS_APPROVED', value: 'false' }
        { name: 'PRINT_RATES_APPROVED', value: 'false' }
        { name: 'PRINT_TERMS_APPROVED', value: 'false' }
        { name: 'PAYPAL_ENV', value: 'sandbox' }
      ]
    }
  }
}
output apiOrigin string = 'https://${function.properties.defaultHostName}'
output storageAccount string = storage.name
