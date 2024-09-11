<script lang="ts">
  import Markdown, { type Plugin } from 'svelte-exmarkdown'
  import rehypeRaw from 'rehype-raw'
  import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
  import rehypeStringify from 'rehype-stringify'
  import rehypeHighlight from 'rehype-highlight'
  import { all } from 'lowlight'
  import 'highlight.js/styles/github-dark.min.css'

  import CitationItem from './CitationItem.svelte'
  import CodeBlock from './CodeBlock.svelte'

  export let content: string
  export let element: HTMLDivElement

  const createRehypePlugin = (plugin: any, opts?: any): Plugin => {
    return { rehypePlugin: opts ? [plugin, opts] : [plugin] }
  }

  const plugins: Plugin[] = [
    createRehypePlugin(rehypeRaw),
    createRehypePlugin(rehypeSanitize, {
      ...defaultSchema,
      tagNames: [
        ...(defaultSchema.tagNames ?? []),
        // allow custom citation tags so we can render them
        'citation'
      ]
    }),
    createRehypePlugin(rehypeStringify),
    createRehypePlugin(rehypeHighlight, { languages: all }),
    { renderer: { citation: CitationItem, pre: CodeBlock, h4: 'h3', h5: 'h3' } }
  ]
</script>

<div
  bind:this={element}
  class="prose prose-lg prose-neutral prose-inline-code:bg-sky-200/80 prose-ul:list-disc prose-ol:list-decimal prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg"
>
  <Markdown md={content} {plugins} />
</div>
