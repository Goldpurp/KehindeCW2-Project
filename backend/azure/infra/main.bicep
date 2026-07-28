param appName string = 'kehinde-scalable-solution'
param location string = resourceGroup().location

@secure()
param authTokenSecret string

@secure()
param creatorSignupCode string

var storageName = 'kehindescalablesolution'
var cosmosName = '${appName}-cosmos'
var planName = '${appName}-plan'
var functionName = '${appName}-api'
var appInsightsName = '${appName}-insights'
var databaseName = 'kehindeScalableSolution'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}

resource videosContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storage.name}/default/videos'
  properties: {
    publicAccess: 'None'
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource users 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
    }
  }
}

resource videos 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'videos'
  properties: {
    resource: {
      id: 'videos'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

resource comments 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'comments'
  properties: {
    resource: {
      id: 'comments'
      partitionKey: {
        paths: ['/videoId']
        kind: 'Hash'
      }
    }
  }
}

resource activities 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'activities'
  properties: {
    resource: {
      id: 'activities'
      partitionKey: {
        paths: ['/recipientId']
        kind: 'Hash'
      }
    }
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: [
          'https://kehinde-scalable-solution.onrender.com'
          'http://127.0.0.1:3000'
          'http://localhost:3000'
          'http://127.0.0.1:3003'
          'http://localhost:3003'
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'ENABLE_ORYX_BUILD'
          value: 'true'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'COSMOS_CONNECTION_STRING'
          value: cosmos.listConnectionStrings().connectionStrings[0].connectionString
        }
        {
          name: 'COSMOS_DATABASE_NAME'
          value: databaseName
        }
        {
          name: 'VIDEO_STORAGE_CONTAINER'
          value: 'videos'
        }
        {
          name: 'AUTH_TOKEN_SECRET'
          value: authTokenSecret
        }
        {
          name: 'CREATOR_SIGNUP_CODE'
          value: creatorSignupCode
        }
      ]
    }
    httpsOnly: true
  }
}

output functionApiName string = functionApp.name
output functionApiUrl string = 'https://${functionApp.properties.defaultHostName}/api'
output cosmosAccountName string = cosmos.name
output storageAccountName string = storage.name
