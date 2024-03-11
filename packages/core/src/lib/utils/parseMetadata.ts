import { WebParser, type WebMetadata, type DetectedWebApp } from '@horizon/web-parser'

// Optional: Include any other dependencies that `parseMetadata` needs

export type ParsedMetadata = {
  url: string
  appInfo: DetectedWebApp
  linkMetadata: WebMetadata
}

export const parseMetadata = async (url: string) => {
  const webParser = new WebParser(url)

  const appInfo = await webParser.getPageInfo()
  console.debug('AppInfo', appInfo)

  const metadata = await webParser.getSimpleMetadata()
  console.debug('Metadata', metadata)

  return {
    url: url,
    appInfo: appInfo,
    linkMetadata: metadata
  } as ParsedMetadata
}
