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

// use a unique key to identify the debounce function and separate it from other debounces
export const useScopedDebounce = <F extends (...args: any[]) => any>(func: F, value = 250) => {
  let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const call = (key: string, ...args: Parameters<F>) => {
    return new Promise<Awaited<ReturnType<F>>>((resolve, reject) => {
      clearTimeout(debounceTimers.get(key))
      debounceTimers.set(
        key,
        setTimeout(async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const result = await func(...args)
            resolve(result)
          } catch (err) {
            reject(err)
          }
        }, value)
      )
    })
  }

  return call
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

export const useTimeout = <F extends (...args: any[]) => Promise<any>>(func: F, timeout = 250) => {
  return (...args: Parameters<F>) => {
    return new Promise<Awaited<ReturnType<F>>>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Function timed out'))
      }, timeout)

      func(...args)
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }
}
