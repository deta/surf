export const takePageScreenshot = async () => {
  // TODO: electron specific code should be moved to the desktop app itself
  const dataURL = await window.electronAPI.captureWebContents()
  return dataURL as string
}
