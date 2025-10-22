import { app, nativeImage } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { useLogScope } from '@deta/utils'

const log = useLogScope('drag')

const getPreviewImage = (filePath: string, fileType: string) => {
  if (fileType.startsWith('image')) {
    const previewImage = nativeImage.createFromPath(filePath)
    if (!previewImage.isEmpty()) {
      const size = previewImage.getSize()
      return previewImage.resize({ width: 100, height: (100 * size.height) / size.width })
    }
  }

  // get our own app icon
  const iconPath = path.join(app.getAppPath(), 'build/resources/prod/icon.png')

  const image = nativeImage.createFromPath(iconPath)
  return image.resize({ width: 50, height: 50 })
}

export const handleDragStart = async (
  webContents: Electron.WebContents,
  resourceId: string,
  filePath: string,
  fileType: string
) => {
  try {
    log.log('Start drag', filePath)

    const previewImage = getPreviewImage(filePath, fileType)

    if (fileType.startsWith('image')) {
      const imageType = fileType.split('/')[1]

      // create a copy of the file with the filetype appended so apps can recognize it and prefixing it so we can recognize it when dropped on horizon
      const tempFilePath = path.join(
        app.getPath('temp'),
        `space_resource_${resourceId}.${imageType}`
      )

      log.log('Temp file path', tempFilePath)

      await fs.copyFile(filePath, tempFilePath)

      webContents.startDrag({
        file: tempFilePath,
        icon: previewImage
      })

      // remove the temp file after the drag is done, TODO: find a better way to do this
      // setTimeout(() => {
      //     fs.unlinkSync(tempFilePath)
      // }, 1000)
    } else {
      webContents.startDrag({
        file: filePath,
        icon: previewImage
      })
    }
  } catch (error) {
    log.error('Error starting drag', error)
  }
}
