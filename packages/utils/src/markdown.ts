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

export const htmlToMarkdown = async (html: string) => {
  const content = await unified()
    .use(rehypeParse)
    .use(remarkGfm)
    .use(rehypeRemark)
    .use(remarkStringify)
    .process(html)

  return String(content)
}

export const markdownToHtml = async (markdown: string) => {
  const content = await unified()
    .use(remarkParse)
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
        span: [['className', 'math', 'math-inline']]
      },
      tagNames: [
        ...(defaultSchema.tagNames ?? []),
        // allow custom citation tags so we can render them
        'citation'
      ]
    })
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown)

  return String(content)
}
