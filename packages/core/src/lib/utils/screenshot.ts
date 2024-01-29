export const takePageScreenshot = async () => {
  // TODO: electron specific code should be moved to the desktop app itself
  // @ts-ignore
  const dataURL = await window.electronAPI.captureWebContents()
  return dataURL as string
}
