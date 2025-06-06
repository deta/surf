export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
export type Timer = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>
