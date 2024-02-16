import fs from 'fs'
import path from 'path'

export type Config = {
  [key: string]: any
}

export const getConfig = <T extends Config>(
  configPath: string,
  fileName = 'config.json'
): Partial<T> => {
  try {
    const fullPath = path.join(configPath, fileName)

    if (fs.existsSync(fullPath)) {
      const raw = fs.readFileSync(fullPath, 'utf8')
      const data = JSON.parse(raw)

      return data as T
    } else {
      fs.writeFileSync(fullPath, JSON.stringify({}))
      return {} as T
    }
  } catch (error) {
    console.error('Error reading config file:', error)
    return {} as T
  }
}

export const setConfig = <T extends Config>(
  configPath: string,
  config: T,
  fileName = 'config.json'
) => {
  try {
    const fullPath = path.join(configPath, fileName)
    fs.writeFileSync(fullPath, JSON.stringify(config))
  } catch (error) {
    console.error('Error writing config file:', error)
  }
}
