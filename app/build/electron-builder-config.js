const productName = process.env.PRODUCT_NAME || 'Surf'
const params = {
  buildTag: process.env.BUILD_TAG,
  shouldNotarize: process.env.SHOULD_NOTARIZE,
  shouldSignWindows: process.env.SIGN_WINDOWS,
  appleTeamId: process.env.APPLE_TEAM_ID,
  buildName: process.env.BUILD_TAG ? `${productName}-${process.env.BUILD_TAG}` : productName,
  signIgnore: process.env.SIGN_IGNORE,
  buildResourcesDir: process.env.BUILD_RESOURCES_DIR,
  appVersion: process.env.APP_VERSION || '0.0.1',
  publishS3BucketName: process.env.S3_UPDATES_BUCKET_NAME,
  publishS3BucketRegion: process.env.S3_UPDATES_BUCKET_REGION,
  releaseChannel: process.env.RELEASE_CHANNEL || 'latest'
}

function electronBuilderConfig() {
  return {
    appId: 'ea.browser.deta.surf',
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
      '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
      '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
      '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
      '!**/*.js.map'
    ],
    asar: true,
    asarUnpack: [
      'resources/**',
      '**/*.node',
      '**/main/bytecode-loader.js',
      '**/main/imageProcessor.js*'
    ],
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
      signingHashAlgorithms: ['sha256'],
      forceCodeSigning: params.shouldSignWindows === 'true',
      sign: 'build/winSign.js',
      publisherName: 'Deta GmbH',
      signExts: ['.node', '.dll']
      //verifyUpdateCodeSignature: false
    },
    nsis: {
      artifactName: `${params.buildName}-${params.appVersion}-setup.$\{ext\}`,
      shortcutName: params.buildName,
      uninstallDisplayName: params.buildName,
      createDesktopShortcut: 'always',
      include: 'build/installer.nsh',
      perMachine: true,
      allowElevation: true,
      deleteAppDataOnUninstall: false
    },
    mac: {
      hardenedRuntime: true,
      entitlementsInherit: `${
        params.buildResourcesDir || 'build/resources/prod'
      }/entitlements.mac.plist`,
      extendInfo: [
        "NSCameraUsageDescription: Application requests access to the device's camera.",
        "NSMicrophoneUsageDescription: Application requests access to the device's microphone.",
        "NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.",
        "NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.",
        'NSScreenCaptureUsageDescription: Application requests access to capture the screen.'
      ],
      notarize: params.shouldNotarize === 'true' ? { teamId: params.appleTeamId } : false
    },
    dmg: {
      artifactName: `${params.buildName}-${params.appVersion}.$\{arch\}.$\{ext\}`
    },
    linux: {
      // target: ['AppImage', 'tar.gz'],
      target: ['AppImage'],
      maintainer: 'deta.surf',
      artifactName: `${params.buildName}-${params.appVersion}.\${arch}.\${ext}`,
      category: 'WebBrowser'
    },
    npmRebuild: false,
    publish: params.publishS3BucketName
      ? {
          provider: 's3',
          bucket: params.publishS3BucketName,
          region: params.publishS3BucketRegion,
          channel: params.releaseChannel
        }
      : [],
    protocols: [
      {
        name: 'Hypertext Transfer Protocol',
        schemes: ['http', 'https']
      }
    ],
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
