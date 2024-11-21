<script lang="ts">
  import { Icon, IconConfirmation } from '@horizon/icons'
  import { copyToClipboard, tooltip } from '@horizon/utils'
  import { afterUpdate, onMount } from 'svelte'

  let elem: HTMLPreElement
  let copyIcon: Icon

  let language: string = ''

  const getCode = () => {
    const codeElem = elem.querySelector('code')
    if (!codeElem) return ''
    return codeElem.textContent
  }

  const handleCopyClick = () => {
    const code = getCode()
    copyToClipboard(code)

    copyIcon.showConfirmation()
  }

  const formatLanguage = (lang: string) => {
    if (lang === 'javascript') return 'JS'
    if (lang === 'typescript') return 'TS'
    if (lang === 'html') return 'HTML'
    if (lang === 'css') return 'CSS'
    if (lang === 'scss') return 'SCSS'
    if (lang === 'json') return 'JSON'
    if (lang === 'bash') return 'Bash'
    if (lang === 'shell') return 'Shell'
    if (lang === 'plaintext') return 'Text'
    if (lang === 'markdown') return 'MD'
    if (lang === 'yaml') return 'YAML'
    if (lang === 'xml') return 'XML'
    if (lang === 'sql') return 'SQL'
    if (lang === 'graphql') return 'GraphQL'
    if (lang === 'python') return 'Python'
    if (lang === 'java') return 'Java'
    if (lang === 'csharp') return 'C#'
    if (lang === 'cpp') return 'C++'
    if (lang === 'c') return 'C'
    if (lang === 'ruby') return 'Ruby'
    if (lang === 'php') return 'PHP'
    if (lang === 'perl') return 'Perl'
    if (lang === 'rust') return 'Rust'
    if (lang === 'go') return 'Go'
    if (lang === 'swift') return 'Swift'
    if (lang === 'kotlin') return 'Kotlin'
    if (lang === 'dart') return 'Dart'
    if (lang === 'elixir') return 'Elixir'
    return lang
  }

  const getLanguage = () => {
    const codeElem = elem.querySelector('code')
    if (!codeElem) return

    const langClass = codeElem.className.split(' ').find((c) => c.startsWith('language-'))
    if (langClass) {
      language = formatLanguage(langClass.replace('language-', ''))
    }
  }

  afterUpdate(() => {
    if (!language) {
      getLanguage()
    }
  })
</script>

<div class="relative bg-gray-900 rounded-lg overflow-hidden">
  <div class="flex items-center justify-between px-3 py-2 bg-gray-950">
    <div class="text-sm text-gray-300 font-mono">{language}</div>

    <button
      use:tooltip={{ text: 'Copy Code', position: 'left' }}
      class="flex items-center text-gray-500 p-1 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
      on:click={handleCopyClick}
    >
      <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
    </button>
  </div>

  <!-- <div class="absolute top-2 left-2">
        <span class="text-xs text-gray-200/80 bg-gray-600 px-2 py-1 rounded-md">{language}</span>
    </div>

    <div class="absolute top-2 right-2 flex items-center">
        <button use:tooltip={{ text: 'Copy Code', position: 'left' }} class="flex items-center text-gray-200/80 bg-gray-600 p-2 rounded-md hover:bg-gray-500 hover:text-white transition-colors group-hover:opacity-40 hover:!opacity-100" on:click={handleCopyClick}>
            <IconConfirmation bind:this={copyIcon} name="copy" />
        </button>
    </div> -->

  <pre bind:this={elem}><slot /></pre>
</div>
