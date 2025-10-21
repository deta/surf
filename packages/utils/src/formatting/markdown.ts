import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import matter from 'gray-matter'

import { remarkParseCustomComponents, rehypeProcessCustomComponents } from './markdown-plugins'
import {
  handleCitations,
  handleWebsearch,
  handleSurflet,
  handleSpan,
  handleDIV
} from './html-parsers'

export const htmlToMarkdown = async (html: string, parseCustomNodes = false) => {
  const content = await unified()
    .use(rehypeParse)
    .use(remarkGfm)
    .use(
      rehypeRemark,
      parseCustomNodes
        ? {
            handlers: {
              citation: handleCitations,
              websearch: handleWebsearch,
              surflet: handleSurflet,
              span: handleSpan,
              div: handleDIV
            }
          }
        : {}
    )
    .use(remarkStringify)
    .process(html)

  return String(content)
}

export const markdownToHtml = async (markdown: string) => {
  const content = await unified()
    .use(remarkParse)
    .use(remarkParseCustomComponents)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        // allow custom citation tags so we can render them
        citation: ['id', 'type', 'dataInfo'],
        // The `language-*` regex is allowed by default.
        code: [['className', /^language-./, 'math-inline', 'math-display']],
        div: [...(defaultSchema.attributes?.div ?? []), ['className', 'math', 'math-display']],
        span: [['className', 'math', 'math-inline']],
        // Allow all data attributes on surflet tags
        surflet: ['data*'],
        websearch: ['data*']
      },
      tagNames: [
        ...(defaultSchema.tagNames ?? []),
        // allow custom citation tags so we can render them
        'citation',
        'think',
        'surflet',
        'websearch'
      ]
    })
    .use(rehypeKatex)
    .use(rehypeProcessCustomComponents)
    .use(rehypeStringify)
    .process(markdown)

  return String(content)
}

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
