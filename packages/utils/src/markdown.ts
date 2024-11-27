import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'

export const htmlToMarkdown = async (html: string) => {
  const content = await unified()
    .use(rehypeParse)
    .use(remarkGfm)
    .use(rehypeRemark)
    .use(remarkStringify)
    .process(html)

  return String(content)
}
