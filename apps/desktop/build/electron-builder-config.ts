// Set CSC_IDENTITY_AUTO_DISCOVERY=false in the environment
// to prevent electron-builder from trying to use the Apple signing service in dev
// there is no way to disable this in the config file directly
// you can set `identity` to null but in production we don't use key but just rely on env variables

const params = {
  productName: process.env.PRODUCT_NAME,
  buildTag: process.env.BUILD_TAG,
  shouldNotarize: process.env.SHOULD_NOTARIZE,
  appleTeamId: process.env.APPLE_TEAM_ID,
  buildName: process.env.BUILD_TAG? `${process.env.PRODUCT_NAME}-${process.env.BUILD_TAG}` : process.env.PRODUCT_NAME,
  signIgnore: process.env.SIGN_IGNORE
}

export default function electronBuilderConfig(){
  return {
    appId: "space.deta.spaceos.ea",
    productName: params.buildName,
    directories: {
      buildResources: "build",
    },
    files: [
      "!**/.vscode/*",
      "!src/*",
      "!electron.vite.config.{js,ts,mjs,cjs}",
      "!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}",
      "!{.env,.env.*,.npmrc,pnpm-lock.yaml}",
      "!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}"
    ],
    asarUnpack: [
      "resources/**"
    ],
    afterPack: "build/afterPack.js",
    win: {
      executableName: params.buildName,
    },
    nsis: {
      artifactName: `${params.buildName}-setup.$\{ext\}`,
      shortcutName: params.buildName,
      uninstallDisplayName: params.buildName,
      createDesktopShortcut: "always",
    },
    mac: {
      hardenedRuntime: true,
      target: "dmg",
      entitlementsInherit: "build/entitlements.mac.plist",
      extendInfo: [
        "NSCameraUsageDescription: Application requests access to the device's camera.",
        "NSMicrophoneUsageDescription: Application requests access to the device's microphone.",
        "NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.",
        "NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder."
      ],
      notarize: params.shouldNotarize === 'true' ? {teamId: params.appleTeamId} : false,
    },
    dmg: {
      artifactName: `${params.buildName}.$\{arch\}.$\{ext}`,
    },
    linux: {
      target: [
        "AppImage",
        "snap",
        "deb"
      ],
      maintainer: "deta.space",
    },
    appImage: {
      artifactName: `${params.buildName}.$\{ext\}`,
    },
    npmRebuild: false
  }
}
