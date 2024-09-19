export const isMac = () => {
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform === 'darwin'
  }

  return false
}
