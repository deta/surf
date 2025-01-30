<script lang="ts">
  import type { ComponentType, SvelteComponent } from 'svelte'
  import Markdown, { type Plugin } from 'svelte-exmarkdown'
  import rehypeRaw from 'rehype-raw'
  import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
  import rehypeStringify from 'rehype-stringify'
  import rehypeKatex from 'rehype-katex'
  import remarkMath from 'remark-math'
  import remarkGfm from 'remark-gfm'
  import rehypeHighlight from 'rehype-highlight'
  import { all } from 'lowlight'
  import 'highlight.js/styles/github-dark.min.css'
  import 'katex/dist/katex.min.css'

  import CodeBlock from './CodeBlock.svelte'

  export let id: string = ''
  export let content: string
  export let element: HTMLDivElement | undefined = undefined
  export let size: 'sm' | 'lg' = 'lg'
  export let citationComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let codeBlockComponent: ComponentType<SvelteComponent> | undefined = undefined

  const cleanContent = (content: string) => {
    const trimmed = content.trim()
    // first we escape dollar signs, like $44 st it does not trigger math mode
    const escapedDollars = trimmed.replace(/\$(\d)/g, '\\$$$1')
    // then replace latex groups that dont work on katex, like \( \) to $ $, and \[ \] to $$ $$
    const replacedDelimiters = escapedDollars
      .replace(/\\\(/g, '$ ')
      .replace(/\\\)/g, ' $')
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')

    if (replacedDelimiters.startsWith('```markdown')) {
      const cleanBeginning = replacedDelimiters.replace('```markdown', '')

      if (cleanBeginning.endsWith('```')) {
        return cleanBeginning.replace(/```$/, '')
      }

      return cleanBeginning
    }

    return replacedDelimiters
  }

  const createRehypePlugin = (plugin: any, opts?: any): Plugin => {
    return { rehypePlugin: opts ? [plugin, opts] : [plugin] }
  }

  const createRemarkPlugin = (plugin: any, opts?: any): Plugin => {
    return { remarkPlugin: opts ? [plugin, opts] : [plugin] }
  }

  const plugins: Plugin[] = [
    createRemarkPlugin(remarkGfm),
    createRemarkPlugin(remarkMath),
    createRehypePlugin(rehypeRaw),
    createRehypePlugin(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        // allow custom citation tags so we can render them
        citation: ['id', 'type'],
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
    }),
    /*
    createRehypePlugin(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        '*': ['*']
      },
      tagNames: [...(defaultSchema.tagNames || []), '*', 'citation']
    }),
    */
    createRehypePlugin(rehypeKatex),
    createRehypePlugin(rehypeStringify),
    createRehypePlugin(rehypeHighlight, { languages: all }),
    ...(citationComponent
      ? [
          {
            renderer: {
              citation: citationComponent,
              pre: codeBlockComponent || CodeBlock,
              h4: 'h3',
              h5: 'h3'
            }
          }
        ]
      : [{ renderer: { pre: CodeBlock, h4: 'h3', h5: 'h3' } }])
  ]

  $: cleanedContent = cleanContent(content)
</script>

<div
  {id}
  bind:this={element}
  class="prose prose-{size} prose-neutral dark:prose-invert prose-inline-code:bg-sky-200/80 prose-ul:list-disc prose-ol:list-decimal prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg select-text"
>
  <Markdown md={cleanedContent} {plugins} />
</div>
