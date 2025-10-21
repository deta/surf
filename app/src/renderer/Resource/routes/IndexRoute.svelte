<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useNotebookManager, type Notebook } from '@deta/services/notebooks'
  import { Button } from '@deta/ui'
  import { onMount } from 'svelte'
  import { MaskedScroll, openDialog, contextMenu, NotebookCover } from '@deta/ui'
  import { conditionalArrayItem, truncate, useDebounce, useLogScope } from '@deta/utils'
  import TeletypeEntry from '../../Core/components/Teletype/TeletypeEntry.svelte'
  import { openNotebook, openResource } from '../handlers/notebookOpenHandlers'
  import { type ChatPrompt, type Fn, ViewLocation } from '@deta/types'
  import { useResourceManager } from '@deta/services/resources'
  import { provideAI } from '@deta/services/ai'
  import { useMessagePortClient } from '@deta/services/messagePort'
  import { BUILT_IN_PAGE_PROMPTS, type ExamplePrompt } from '@deta/services/constants'
  import { useConfig } from '@deta/services'
  import NotebookLayout from '../layouts/NotebookLayout.svelte'
  import NotebookEditor from '../components/notebook/NotebookEditor/NotebookEditor.svelte'
  import { useTeletypeService } from '../../../../../packages/services/src/lib'
  import NotebookContents from '../components/notebook/NotebookContents.svelte'
  import PromptPills from '../components/PromptPills.svelte'
  import { MentionItemType } from '@deta/editor'
  import NotebookSidecarExample from '../components/notebook/NotebookSidecarExample.svelte'

  let {
    onopensidebar,
    resourcesPanelOpen = false
  }: { onopensidebar: Fn; resourcesPanelOpen?: boolean } = $props()

  let isCreatingNotebook = $state(false)
  let isRenamingNotebook: string | undefined = $state(undefined)
  let newNotebookName: string | undefined = $state(undefined)
  let isCustomizingNotebook = $state(null)
  let viewLocation = $state<ViewLocation | null>(null)
  let isTtyInitializing = $state(true)

  const log = useLogScope('IndexRoute')
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const config = useConfig()
  const ai = provideAI(resourceManager, config, false)
  const teletype = useTeletypeService()
  const messagePort = useMessagePortClient()

  const contextManager = ai.contextManager
  const { generatedPrompts, generatingPrompts } = contextManager
  const ttyQuery = teletype.query
  const mentions = teletype.mentions

  let hasMentions = $derived($mentions.length > 0)
  let hasActiveTabMention = $derived($mentions.some((m) => m.type === MentionItemType.ACTIVE_TAB))
  let mentionsHash = $derived(JSON.stringify($mentions))

  let prevMentionsHash = $state('')

  const suggestedPrompts = $derived.by(() => {
    if ($generatingPrompts) {
      return [
        {
          label: hasActiveTabMention
            ? 'Analyzing Page...'
            : hasMentions
              ? 'Analyzing Mentions...'
              : 'Generating Prompts...',
          prompt: '',
          loading: true
        }
      ]
    }

    if ($generatedPrompts.length === 0) return []

    return [
      ...BUILT_IN_PAGE_PROMPTS.filter((p) =>
        $generatedPrompts.every((gp) => gp.label !== p.label && gp.label !== 'Summary')
      ),
      ...$generatedPrompts
        .slice(0, 4)
        .sort((a, b) => (a.label?.length ?? 0) - (b.label?.length ?? 0))
    ]
  })

  const shouldMentionActiveTab = () => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('mention_active_tab') === 'true'
  }

  const handleCreateNotebook = async () => {
    //if (newNotebookName === undefined || newNotebookName.length < 1) {
    //  isCreatingNotebook = false
    //  newNotebookName = undefined
    //  return
    //}

    const nb = await notebookManager.createNotebook(
      {
        name: 'Untitled Notebook',
        pinned: true
      },
      true
    )

    isCreatingNotebook = false
    newNotebookName = undefined
    // Note: loadNotebooks() is already called by createNotebook()

    onopensidebar?.()
  }

  const handleDeleteNotebook = async (notebook: Notebook) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate(notebook.nameValue, 26)}</i>`,
      message: `This can't be undone. <br>Your resources won't be deleted.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    notebookManager.deleteNotebook(notebook.id, true)
  }

  const handleRenameNotebook = useDebounce((notebookId: string, value: string) => {
    notebookManager.updateNotebookData(notebookId, { name: value })
  }, 175)

  const handleCancelRenameNotebook = () => {
    isRenamingNotebook = undefined
  }

  const handleCreateNote = async () => {
    const note = await resourceManager.createResourceNote(
      '',
      {
        name: 'Untitled Note'
      },
      undefined,
      true
    )
    openResource(note.id, { target: 'active_tab' })
  }

  const handlePinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: true })
  }
  const handleUnPinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: false })
  }

  const handleRunPrompt = (e: CustomEvent<ChatPrompt>) => {
    const prompt = e.detail
    log.debug('Running prompt', prompt)
    teletype.ask({ query: prompt.prompt, queryLabel: prompt.label })
  }

  const handleRunExample = (example: ExamplePrompt) => {
    log.debug('Running example', example)

    if (example.id === 'search') {
      teletype.ask({ query: example.prompt, queryLabel: example.label })
    } else if (example.id === 'youtube') {
      teletype.ask({ query: example.prompt, openTabUrl: example.url })
    } else if (example.id === 'pdf') {
      teletype.promptForAndInsertFileMentions()
    } else if (example.id === 'note') {
      teletype.createNote('')
    } else if (example.id === 'mention') {
      teletype.insertMention(undefined, '@')
    } else {
      log.warn('Unknown example prompt id', example.id)
    }
  }

  $effect(() => {
    if (hasMentions && mentionsHash !== prevMentionsHash && !$generatingPrompts) {
      prevMentionsHash = mentionsHash
      contextManager.getPrompts({ mentions: $mentions })
    }
  })

  onMount(() => {
    document.title = 'Surf'
    // notebookManager.loadNotebooks()

    if (shouldMentionActiveTab()) {
      // NOTE: we still need a timeout here to let the tty component init
      // otherwise the editor focuses at the start of the mention for some reason :)
      setTimeout(() => {
        teletype.insertMention({
          id: 'active_tab',
          label: 'Active Tab',
          type: MentionItemType.ACTIVE_TAB,
          icon: 'sparkles'
        })
        isTtyInitializing = false
      }, 50)
    } else {
      isTtyInitializing = false
    }

    let unsubs = [
      messagePort.viewMounted.handle(({ location }) => {
        log.debug('Received view-mounted event', location)
        viewLocation = location

        if (hasMentions) {
          contextManager.getPrompts({ mentions: $mentions })
        } /*else {
          contextManager.getPrompts({ text: 'generate prompts that are useful for the user to kick off a new research session. make them insightful and relevant' })
        }*/
      }),

      messagePort.activeTabChanged.handle(() => {
        log.debug('Received active-tab-changed event', viewLocation, contextManager)
        if (hasMentions) {
          contextManager.getPrompts({ mentions: $mentions })
        }
      })
    ]

    return () => {
      unsubs.forEach((u) => u())
    }
  })

  const pinnedNotebooks = $derived(notebookManager.sortedNotebooks.filter((e) => e.data.pinned))
</script>

<svelte:head>
  <title>Surf</title>
</svelte:head>

{#if isCustomizingNotebook}
  <NotebookEditor bind:notebook={isCustomizingNotebook} />
{/if}

<NotebookLayout>
  <main>
    {#if $generatingPrompts || (suggestedPrompts.length > 0 && (viewLocation === ViewLocation.Sidebar || hasMentions))}
      <div class="prompts-wrapper">
        <PromptPills
          direction="horizontal"
          promptItems={suggestedPrompts}
          on:click={handleRunPrompt}
          hide={$ttyQuery.slice(11).trim().length > 0}
        />
      </div>
    {/if}
    <div class="tty-wrapper">
      <!--<h1>
        {title}
      </h1>-->
      <TeletypeEntry open={true} />
    </div>

    {#if $ttyQuery.length <= 0}
      <section class="contents-wrapper">
        <NotebookContents />
      </section>
    {/if}

    {#if viewLocation === ViewLocation.Tab && $ttyQuery.length <= 0}
      <NotebookSidecarExample onselect={handleRunExample} />
    {/if}
  </main>

  <!-- <NotebookSidebar title="Surf" bind:open={resourcesPanelOpen} /> -->
</NotebookLayout>

<style lang="scss">
  main {
    width: 100%;
    height: 100%;
    max-width: 680px;
    margin: 0 auto;
    position: relative;

    display: flex;
    flex-direction: column;
    gap: 1rem;

    section {
      flex-shrink: 1;
      padding-inline: 0.5rem;

      transform: translateY(0px);
      transition:
        opacity 223ms ease-out,
        transform 223ms ease-out;
      transition-delay: var(--delay, 0ms);
      @starting-style {
        transform: translateY(2px);
        opacity: 0;
      }
    }
  }

  .tty-wrapper {
    width: 100%;

    h1 {
      font-size: 30px;
      margin-bottom: 0.75rem;
      font-family: 'Gambarino';
      text-align: center;
      color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));
    }

    .empty {
      width: 100%;
      border: 1px dashed light-dark(rgba(0, 0, 0, 0.2), rgba(71, 85, 105, 0.4));
      padding: 0.5rem 0.75rem;
      border-radius: 10px;
      display: flex;
      justify-content: center;
      align-items: center;
      color: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.3));

      p {
        max-width: 40ch;
        text-align: center;
        text-wrap: pretty;
      }
    }

    .notebook-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;

      display: flex;
      flex-wrap: wrap;
      //justify-content: space-between;
      justify-items: center;
    }
    .notebook-wrapper {
      opacity: 1;

      transform: translateY(0px);
      transition:
        opacity 223ms ease-out,
        transform 123ms ease-out,
        box-shadow 123ms ease-out;
      transition-delay: var(--delay, 0ms);
      @starting-style {
        transform: translateY(2px);
        opacity: 0;
      }
    }
  }

  .notebook-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;

    display: flex;
    flex-wrap: wrap;
    //justify-content: space-between;
    justify-items: center;
  }

  .contents-wrapper {
    margin-left: calc(-50vw + 50%);
    margin-right: calc(-50vw + 50%);
    padding-left: calc(50vw - 50%);
    padding-right: calc(50vw - 50%);
    margin-top: 1rem;
    opacity: 0.5;
    transition: opacity 223ms ease-out;

    &:hover {
      opacity: 1;
    }

    > :global(*) {
      max-width: 680px;
      margin: 0 auto;
      padding-inline: 1.5rem;
    }
  }

  .prompts-wrapper {
    padding-left: 1.25rem;
    margin-bottom: -1rem;
  }
</style>
