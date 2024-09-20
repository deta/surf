export const isMac = () => {
  return import.meta.env.PLATFORM === 'darwin'
}

export const isWindows = () => {
  return import.meta.env.PLATFORM === 'win32'
}

export const isLinux = () => {
  return import.meta.env.PLATFORM === 'linux'
}
