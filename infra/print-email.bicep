param emailName string = 'terrainfoundry-print-email'
param communicationName string = 'terrainfoundry-print-communication'
resource email 'Microsoft.Communication/emailServices@2023-03-31' = {
  name: emailName
  location: 'global'
  properties: { dataLocation: 'Europe' }
}
resource domain 'Microsoft.Communication/emailServices/domains@2023-03-31' = {
  parent: email
  name: 'AzureManagedDomain'
  location: 'global'
  properties: { domainManagement: 'AzureManaged' }
}
resource communication 'Microsoft.Communication/communicationServices@2023-03-31' = {
  name: communicationName
  location: 'global'
  properties: { dataLocation: 'Europe', linkedDomains: [domain.id] }
}
output domainResourceId string = domain.id
output communicationResourceId string = communication.id
