// TODO: electron specific code should be moved to the desktop app itself

export const takePageScreenshot = async () => {
  const dataURL = await window.api.captureWebContents()
  return dataURL
}
