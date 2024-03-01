/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// eslint-disable-next-line @typescript-eslint/ban-types
export const useDebounce = <F extends (...args: any[]) => any>(func: F, value = 250) => {
  let debounceTimer: ReturnType<typeof setTimeout>
  const debounce = (...args: Parameters<F>) => {
    return new Promise<Awaited<ReturnType<F>>>((resolve, reject) => {
      // check if Awaited is needed
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result = await func(...args)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }, value)
    })
  }

  return debounce
}

export const useCancelableDebounce = <F extends (...args: any[]) => any>(func: F, value = 250) => {
  let debounceTimer: ReturnType<typeof setTimeout>
  const execute = (...args: Parameters<F>) => {
    return new Promise<Awaited<ReturnType<F>>>((resolve, reject) => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result = await func(...args)
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
