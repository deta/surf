// Generate a hash in the browser
export const generateHash = (input: string) => {
  const buffer = new TextEncoder().encode(input)
  return crypto.subtle.digest('SHA-256', buffer).then((hash) => {
    const hashArray = Array.from(new Uint8Array(hash))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  })
}
