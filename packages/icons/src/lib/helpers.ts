import { IconTypes, type IconData } from './types'

export const getIconString = (iconData: IconData) => {
  const { type, data } = iconData
  if (type === IconTypes.ICON) {
    return `icon;;${data}`
  }
  if (type === IconTypes.EMOJI) {
    return `emoji;;${data}`
  } else if (type === IconTypes.IMAGE) {
    return `image;;${data}`
  } else if (type === IconTypes.ICON_FILE) {
    return `file;;${data}`
  } else if (type === IconTypes.FAVICON) {
    return `favicon;;${data}`
  } else {
    const [color1, color2] = data
    return `colors;;${color1};;${color2}`
  }
}
