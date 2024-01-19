export const generateID = () => {
  const random = Math.random().toString(36).substr(2, 10)
  return `${random}`
}
