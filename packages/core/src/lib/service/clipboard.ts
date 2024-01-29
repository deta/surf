import { hasClassOrParentWithClass } from "@horizon/tela"

export const SUPPORTED_MIMES = [
    'text/plain',
    'text/html',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'image/webp',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
]

export const canConsume = (mimeType: string) => {
    if (!SUPPORTED_MIMES.includes(mimeType)) {
      let canConsume = false
      for (const type of SUPPORTED_MIMES) {
        if (type.includes('/*')) {
          const [typePrefix] = type.split('/')
          if (mimeType.startsWith(typePrefix)) {
            canConsume = true
          }
        }
      }

      return canConsume
    }

    return true
}

export const shouldIgnorePaste = (elem: HTMLElement) => {
    const isInputElem =
        ['INPUT', 'TEXTAREA'].includes(elem.tagName) ||
        elem.hasAttribute('contenteditable')
    const isCardElem = hasClassOrParentWithClass(elem, 'card')

    return isInputElem || isCardElem
}

export const parseClipboardItems = async (clipboardItems: ClipboardItem[]) => {
    // let parsedItems: Blob[] = []

    const parsedItems = await Promise.all(clipboardItems.map(async item => {
            const supportedTypes = item.types.filter(type => {
                    return canConsume(type)
            })

            console.log(supportedTypes)

            // prevent duplicate cards by removing overlapping types
            if (
                supportedTypes.includes('text/html') &&
                supportedTypes.includes('text/plain')
            ) {
                supportedTypes.splice(supportedTypes.indexOf('text/plain'), 1)
            } else if (
                supportedTypes.includes('image/png') &&
                supportedTypes.includes('image/jpeg')
            ) {
                supportedTypes.splice(supportedTypes.indexOf('image/jpeg'), 1)
            } else if (
                supportedTypes.includes('image/png') &&
                supportedTypes.includes('image/webp')
            ) {
                supportedTypes.splice(supportedTypes.indexOf('image/webp'), 1)
            } else if (
                supportedTypes.includes('image/jpeg') &&
                supportedTypes.includes('image/webp')
            ) {
                supportedTypes.splice(supportedTypes.indexOf('image/webp'), 1)
            } else if (
                supportedTypes.some(type => type.startsWith('image/')) &&
                supportedTypes.includes('text/plain')
            ) {
                supportedTypes.splice(supportedTypes.indexOf('text/plain'), 1)
            } else if (
                supportedTypes.some(type => type.startsWith('image/')) &&
                supportedTypes.includes('text/html')
            ) {
                supportedTypes.splice(supportedTypes.indexOf('text/html'), 1)
            }

            return Promise.all(
                supportedTypes.map(type => item.getType(type))
            )
    }))

    return parsedItems.flat()
}
