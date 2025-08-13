let count = $state(0)

export function getCount() {
  return count
}

export function increment() {
  count += 1
}
