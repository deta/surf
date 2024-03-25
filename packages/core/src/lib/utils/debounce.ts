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

/**
 * Throttles a function to only be called once every `n` milliseconds
 */
export const useThrottle = <F extends (...args: any[]) => any>(func: F, value = 250) => {
  let inThrottle: boolean
  let debounceTimer: ReturnType<typeof setTimeout>
  const throttle = (...args: Parameters<F>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), value)
    } else {
      debounceTimer = setTimeout(async () => {
        func(...args)
      }, value)
    }
  }

  return throttle
}

export const useAnimationFrameThrottle = <F extends (...args: any[]) => any>(
  func: F,
  timeout?: number
) => {
  let inThrottle: boolean
  let debounceTimer: ReturnType<typeof setTimeout>
  const throttle = (...args: Parameters<F>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    if (!inThrottle) {
      func(...args)
      inThrottle = true
      requestAnimationFrame(() => (inThrottle = false))
    } else if (timeout) {
      debounceTimer = setTimeout(async () => {
        func(...args)
      }, timeout)
    }
  }

  return throttle
}
