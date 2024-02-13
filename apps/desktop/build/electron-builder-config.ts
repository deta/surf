// Set CSC_IDENTITY_AUTO_DISCOVERY=false in the environment
// to prevent electron-builder from trying to use the Apple signing service in dev
// there is no way to disable this in the config file directly
// you can set `identity` to null but in production we can't set identity to null because we need to sign the app

const productName = process.env.PRODUCT_NAME || 'Horizon'
const params = {
  buildTag: process.env.BUILD_TAG,
  shouldNotarize: process.env.SHOULD_NOTARIZE,
  appleTeamId: process.env.APPLE_TEAM_ID,
  buildName: process.env.BUILD_TAG ? `${productName}-${process.env.BUILD_TAG}` : productName,
  signIgnore: process.env.SIGN_IGNORE,
  buildResourcesDir: process.env.BUILD_RESOURCES_DIR
}

export default function electronBuilderConfig() {
  return {
    appId: 'space.deta.spaceos.ea',
    productName: params.buildName,
    directories: {
      buildResources: params.buildResourcesDir || 'build/resources/prod'
    },
    files: [
      '!**/.vscode/*',
      '!src/*',
      '!electron.vite.config.{js,ts,mjs,cjs}',
      '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
      '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
      '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
    ],
    asarUnpack: ['resources/**'],
    afterPack: 'build/afterPack.js',
    win: {
      executableName: params.buildName
    },
    nsis: {
      artifactName: `${params.buildName}-setup.$\{ext\}`,
      shortcutName: params.buildName,
      uninstallDisplayName: params.buildName,
      createDesktopShortcut: 'always'
    },
    mac: {
      hardenedRuntime: true,
      target: 'dmg',
      entitlementsInherit: `${params.buildResourcesDir || 'build/resources/prod'}/entitlements.mac.plist`,
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
      artifactName: `${params.buildName}.$\{arch\}.$\{ext}`
    },
    linux: {
      target: ['AppImage'],
      maintainer: 'deta.space'
    },
    appImage: {
      // TODO: what category are we lol
      category: 'WebBrowser',
      artifactName: `${params.buildName}.$\{arch\}.$\{ext\}`
    },
    npmRebuild: false
  }
}
