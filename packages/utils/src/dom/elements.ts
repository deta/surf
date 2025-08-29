export const getTextElementsFromHtml = (html: string): string[] => {
  let textElements: string[] = []
  const body = new DOMParser().parseFromString(html, 'text/html').body
  body.querySelectorAll('p').forEach((p) => {
    textElements.push(p.textContent?.trim() ?? '')
  })
  return textElements
}
