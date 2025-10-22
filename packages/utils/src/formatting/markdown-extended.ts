import matter from 'gray-matter'
import { htmlToMarkdown } from './markdown'

export const generateMarkdownWithFrontmatter = async (
  content: string,
  frontmatter: Record<string, any>
) => {
  const frontmatterString = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: "${value.replace(/"/g, '\\"')}"`
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        return `${key}: ${value}`
      } else if (Array.isArray(value)) {
        return `${key}:\n${value.map((item) => `  - "${item.replace(/"/g, '\\"')}"`).join('\n')}`
      } else if (typeof value === 'object' && value !== null) {
        return `${key}:\n${Object.entries(value)
          .map(([subKey, subValue]) => `  ${subKey}: "${String(subValue).replace(/"/g, '\\"')}"`)
          .join('\n')}`
      } else {
        return `${key}: "${String(value).replace(/"/g, '\\"')}"`
      }
    })
    .join('\n')

  const markdown = await htmlToMarkdown(content)
  return `---\n${frontmatterString}\n---\n\n${markdown}`
}

export const parseMarkdownWithFrontmatter = async <T = any>(rawContent: string) => {
  const parsed = matter(rawContent)

  return { content: parsed.content, matter: parsed.data as T }
}
