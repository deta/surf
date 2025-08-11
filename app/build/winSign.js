const cp = require('child_process')

/*
We are using https://github.com/vcsjones/AzureSignTool to sign files with Azure Key Vault.
*/

const signToolConfig = {
  shouldSign: process.env.SIGN_WINDOWS === 'true',
  timeserverUrl: 'http://timestamp.digicert.com',
  certificateName: process.env.AZURE_KEYVAULT_CERTIFICATE_NAME,
  keyVaultUrl: process.env.AZURE_KEYVAULT_URL,
  accessToken: process.env.AZURE_KEYVAULT_ACCESS_TOKEN
}

function isEmpty(value) {
  return !value || !value.length
}

exports.default = async function (configuration) {
  if (!signToolConfig.shouldSign) {
    console.log(`${configuration.path}: skipping windows signing...`)
    return
  }

  if (isEmpty(configuration.path)) {
    throw new Error('Path to file is required')
  }

  if (isEmpty(configuration.hash)) {
    throw new Error('Hash algorithm is required')
  }

  // Create the AzureSignTool command
  const command = [
    'AzureSignTool.exe sign',
    '-fd',
    configuration.hash,
    '-kvu',
    signToolConfig.keyVaultUrl,
    '-kva',
    signToolConfig.accessToken,
    '-kvc',
    signToolConfig.certificateName,
    '-tr',
    signToolConfig.timeserverUrl,
    '-v'
  ]

  // Execute the signing command
  cp.execSync(`${command.join(' ')} "${configuration.path}"`, {
    stdio: 'inherit'
  })
}
