// TODO: electron specific code should be moved to the desktop app itself

export const requestNewPreviewImage = async (horizonId: string) => {
  // @ts-ignore
  await window.api.requestNewPreviewImage(horizonId)
}

export const takePageScreenshot = async () => {
  // @ts-ignore
  const dataURL = await window.api.captureWebContents()
  return dataURL as string
}
