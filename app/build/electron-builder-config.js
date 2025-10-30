const productName = process.env.PRODUCT_NAME || 'Breakwind'

const params = {
  buildName: process.env.BUILD_TAG ? `${productName}-${process.env.BUILD_TAG}` : productName,
  buildResourcesDir: process.env.BUILD_RESOURCES_DIR,
  appVersion: process.env.APP_VERSION || '0.0.1'
}

function electronBuilderConfig() {
  return {
    appId: 'surf.deta',
    productName: params.buildName,
    directories: {
      buildResources: params.buildResourcesDir || 'build/resources/prod'
    },
    extraMetadata: {
      version: params.appVersion
    },
    files: [
      '!**/backend/target*',
      '!**/backend/src/*',
      '!**/backend/migrations/*',
      '!**/backend-server/target*',
      '!**/backend-server/src/*',
      '!**/trackpad/target*',
      '!**/trackpad/src/*',
      '!**/.vscode/*',
      '!src/*',
      '!electron.vite.config.{js,ts,mjs,cjs}',
      '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,CHANGELOG.md,README.md}',
      '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
      '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
      '!**/*.js.map'
    ],
    asar: true,
    asarUnpack: ['resources/**', '**/*.node', '**/main/imageProcessor.js*'],
    afterPack: 'build/afterpack.js',
    protocols: [
      {
        name: 'HTTP link',
        schemes: ['http', 'https']
      },
      {
        name: 'File',
        schemes: ['file']
      }
    ],
    win: {
      executableName: params.buildName,
      target: ['nsis']
    },
    nsis: {
      artifactName: `${params.buildName}-${params.appVersion}-setup.\${ext}`,
      shortcutName: params.buildName,
      uninstallDisplayName: params.buildName,
      createDesktopShortcut: 'always',
      include: 'build/installer.nsh',
      perMachine: true,
      allowElevation: true,
      deleteAppDataOnUninstall: false
    },
    mac: {
      identity: null, // this skips code signing
      extendInfo: [
        "NSCameraUsageDescription: Application requests access to the device's camera.",
        "NSMicrophoneUsageDescription: Application requests access to the device's microphone.",
        "NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.",
        "NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.",
        'NSScreenCaptureUsageDescription: Application requests access to capture the screen.'
      ]
    },
    dmg: {
      artifactName: `${params.buildName}-${params.appVersion}.\${arch}.\${ext}`
    },
    linux: {
      target: ['AppImage'],
      maintainer: 'deta.surf',
      artifactName: `${params.buildName}-${params.appVersion}.\${arch}.\${ext}`,
      category: 'WebBrowser'
    },
    npmRebuild: false,
    fileAssociations: [
      {
        name: 'Hypertext Markup Language',
        isPackage: true,
        role: 'Editor',
        rank: 'Default',
        ext: 'html'
      }
    ]
  }
}

module.exports = electronBuilderConfig
