/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// eslint-disable-next-line @typescript-eslint/ban-types
export const useDebounce = <T>(func: Function, value = 250) => {
  let debounceTimer: ReturnType<typeof setTimeout>
  const debounce = (...args: any[]) => {
    return new Promise<T>((resolve, reject) => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result = func(...args)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }, value)
    })
  }

  return debounce
}

export const useCancelableDebounce = <T>(func: Function, value = 250) => {
  let debounceTimer: ReturnType<typeof setTimeout>
  const execute = (...args: any[]) => {
    return new Promise<T>((resolve, reject) => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result = func(...args)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }, value)
    })
  }

  const cancel = () => clearTimeout(debounceTimer)

  return { execute, cancel }
}
