export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>
export type Option<T> = T | undefined
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
export type Timer = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>
export type Fn = () => void

// Used for synchronizing data access.
export type Lock = Promise<any> | null
