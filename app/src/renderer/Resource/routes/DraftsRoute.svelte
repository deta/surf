<script lang="ts">
  import { Icon } from '@deta/icons'
  import {
    Button,
    NotebookCover,
    openDialog,
    PageMention,
    ResourceLoader,
    SurfLoader
  } from '@deta/ui'
  import { onMount } from 'svelte'
  import { MaskedScroll } from '@deta/ui'
  import { contextMenu, type CtxItem } from '@deta/ui'
  import TeletypeEntry from '../../Core/components/Teletype/TeletypeEntry.svelte'
  import { SearchResourceTags, truncate, useDebounce, useLogScope } from '@deta/utils'
  import {
    useResourceManager,
    type Resource,
    type ResourceNote,
    ResourceManagerEvents
  } from '@deta/services/resources'
  import { ResourceTagsBuiltInKeys, ResourceTypes, type ViewLocation } from '@deta/types'
  import { type MessagePortClient } from '@deta/services/messagePort'
  import { handleResourceClick } from '../handlers/notebookOpenHandlers'
  import NotebookSidebar from '../components/notebook/NotebookSidebar.svelte'
  import NotebookLayout from '../layouts/NotebookLayout.svelte'
  import NotebookContents from '../components/notebook/NotebookContents.svelte'
  import { MentionItemType } from '@deta/editor'
  import { useConfig, useTeletypeService } from '@deta/services'
  import { provideAI } from '@deta/services/ai'
  import { BUILT_IN_PAGE_PROMPTS } from '@deta/services/constants'
  import PromptPills from '../components/PromptPills.svelte'

  let {
    messagePort,
    resourcesPanelOpen = false
  }: { messagePort: MessagePortClient; resourcesPanelOpen?: boolean } = $props()

  const log = useLogScope('DraftsRoute')
  const resourceManager = useResourceManager()
  const config = useConfig()
  const ai = provideAI(resourceManager, config, false)
  const teletype = useTeletypeService()

  const contextManager = ai.contextManager
  const { generatedPrompts, generatingPrompts } = contextManager
  const ttyQuery = teletype.query
  const mentions = teletype.mentions

  let hasMentions = $derived($mentions.length > 0)
  let hasActiveTabMention = $derived($mentions.some((m) => m.type === MentionItemType.ACTIVE_TAB))
  let mentionsHash = $derived(JSON.stringify($mentions))

  let prevMentionsHash = $state('')
  let viewLocation = $state<ViewLocation | null>(null)

  let showAllNotes = $state(false)
  let isRenamingNote = $state(null)

  const suggestedPrompts = $derived.by(() => {
    if ($generatingPrompts) {
      return [
        {
          label: hasActiveTabMention
            ? 'Analyzing Page'
            : hasMentions
              ? 'Analyzing Mentions'
              : 'Generating Prompts',
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

  const handleCreateNote = async () => {
    await messagePort.createNote.send({ isNewTabPage: true })
  }

  const handleDeleteNote = async (note: ResourceNote) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate(note.metadata.name, 26)}</i>`,
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return

    await resourceManager.deleteResource(note.id)
  }

  const handleRenameNote = useDebounce((noteId: string, value: string) => {
    resourceManager.updateResourceMetadata(noteId, { name: value })
  }, 75)

  const handleCancelRenameNote = useDebounce(() => {
    isRenamingNote = undefined
  }, 75)

  const handleRunPrompt = (e: CustomEvent<ChatPrompt>) => {
    const prompt = e.detail
    log.debug('Running prompt', prompt)
    teletype.ask({ query: prompt.prompt, queryLabel: prompt.label })
  }

  $effect(() => {
    if (hasMentions && mentionsHash !== prevMentionsHash && !$generatingPrompts) {
      prevMentionsHash = mentionsHash
      contextManager.getPrompts({ mentions: $mentions })
    }
  })

  onMount(async () => {
    const unsubs = [resourceManager.on(ResourceManagerEvents.Deleted, () => (refreshKey = {}))]
    return () => unsubs.forEach((f) => f())
  })

  onMount(() => {
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
</script>

<svelte:head>
  <title>Drafts</title>
</svelte:head>

<NotebookLayout>
  <main>
    <div class="tty-wrapper">
      <div class="name">
        <NotebookCover
          title="Drafts"
          height="5ch"
          fontSize="0.3rem"
          --round-base="6px"
          --round-diff="-8px"
          color={[
            ['#5d5d62', '5d5d62'],
            ['#2e2f34', '#2e2f34'],
            ['#efefef', '#efefef']
          ]}
        />
        <h1>Drafts</h1>
      </div>
      <TeletypeEntry open={true} hideNavigation />
    </div>

    {#if ($generatingPrompts || suggestedPrompts.length > 0) && hasMentions}
      <div class="prompts-wrapper">
        <PromptPills
          promptItems={suggestedPrompts}
          direction={'vertical'}
          on:click={handleRunPrompt}
        />
      </div>
    {/if}

    {#if !hasMentions}
      <section class="contents-wrapper">
        <NotebookContents notebookId="drafts" />
      </section>
    {/if}
  </main>
</NotebookLayout>

<style lang="scss">
  main {
    width: 100%;
    height: 100%;
    max-width: 680px;
    margin: 0 auto;

    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  section {
    padding-inline: 12px;

    > header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;

      > label {
        opacity: 0.5;
        color: var(--text-color);
        leading-trim: both;
        text-edge: cap;
        font-family: Inter;
        font-size: 0.75rem;
        font-style: normal;
        font-weight: 500;
        line-height: 0.9355rem;
      }
    }
  }

  section.notes {
    ul {
      position: relative;

      &:not(.showAllNotes) {
        mask-image: linear-gradient(to bottom, black 40%, transparent 83%);
      }
    }
    .more {
      margin-top: -3rem;
      opacity: 0.25;
    }
  }

  .empty {
    width: 100%;
    border: 1px dashed light-dark(rgba(0, 0, 0, 0.2), rgba(71, 85, 105, 0.4));
    padding: 0.75rem 0.75rem;
    border-radius: 10px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    color: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.3));
    text-align: center;
    text-wrap: pretty;
    p {
      max-width: 28ch;
    }
    :global(button) {
      margin-bottom: 0.5rem;
      background: light-dark(rgb(198 206 249 / 40%), rgba(100, 116, 180, 0.3));
      color: var(--accent);
    }
  }

  .tty-wrapper {
    width: 100%;

    .name {
      display: flex;
      align-items: center;
      gap: 2ch;
      padding-inline: 1.5rem;
    }

    h1 {
      font-size: 30px;
      font-family: 'Gambarino';
      color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));
    }
  }
  .cover.title {
    display: none;
  }

  @media screen and (width <= 1024px) {
    .cover.side {
      display: none;
    }
    .cover.title {
      display: block;
    }
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
  }
</style>
