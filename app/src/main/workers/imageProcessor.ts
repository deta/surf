import { open } from 'fs/promises'
import { workerData, parentPort } from 'worker_threads'
import { readFile } from 'fs/promises'

const sharp = require(workerData.sharpPath)

interface Job {
  messageID: string
  imgPath: string
  savePath: string
  quality: number | null
  maxDimension: number | null
}

parentPort?.on('message', async (message: Job) => {
  const { imgPath, savePath, quality, maxDimension, messageID } = message

  if (!imgPath || !savePath) {
    parentPort?.postMessage({
      messageID,
      success: false,
      error: 'missing blob or savePath'
    })
    return
  }

  try {
    const blob = await readFile(imgPath)
    const pipeline = sharp(blob)

    if (quality !== null) {
      pipeline.webp({ quality, effort: 6 })
    }

    if (maxDimension !== null) {
      const { width, height } = await pipeline.metadata()
      if ((width ?? 10) > (height ?? 0)) {
        pipeline.resize({ width: maxDimension, withoutEnlargement: true })
      } else {
        pipeline.resize({ height: maxDimension, withoutEnlargement: true })
      }
    }

    const buf = await pipeline.toBuffer()
    open(savePath, 'w+')
      .then((fileHandle) => {
        fileHandle
          .writeFile(buf)
          .then(() => fileHandle.sync())
          .then(() => fileHandle.close())
          .then(() =>
            parentPort?.postMessage({
              messageID,
              success: true,
              buffer: buf
            })
          )
      })
      .catch((err) =>
        parentPort?.postMessage({
          messageID,
          success: false,
          error: err.message
        })
      )
  } catch (error) {
    parentPort?.postMessage({
      messageID,
      success: false,
      error: error.message
    })
  }
})
