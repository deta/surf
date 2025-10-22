// create a dummy promise that you can await and call resolve on
export function createDummyPromise<T>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
} {
  let resolve: (value: T | PromiseLike<T>) => void
  let reject: (reason?: any) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve: resolve!, reject: reject! }
}

export type DummyPromise<T> = ReturnType<typeof createDummyPromise<T>>
