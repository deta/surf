<svelte:options immutable />

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { WebParser } from '@horizon/web-parser'

  import TextPreview from './Previews/Text/TextPreview.svelte'
  import LinkPreview from './Previews/Link/LinkPreview.svelte'

  import {
    ResourceHistoryEntry,
    useResourceManager,
    type Resource,
    type ResourceAnnotation,
    type ResourceArticle,
    type ResourceChatMessage,
    type ResourceChatThread,
    type ResourceDocument,
    type ResourceLink,
    type ResourceNote,
    type ResourcePost
  } from '../../service/resources'
  import FilePreview from './Previews/File/FilePreview.svelte'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type CreateTabOptions,
    type ResourceData,
    type ResourceDataPost
  } from '../../types'
  import FileIcon from './Previews/File/FileIcon.svelte'
  import PostPreview from './Previews/Post/PostPreview.svelte'
  import ChatMessagePreview from './Previews/ChatMessage/ChatMessagePreview.svelte'
  import ArticlePreview from './Previews/Article/ArticlePreview.svelte'
  import DocumentPreview from './Previews/Document/DocumentPreview.svelte'
  import ChatThreadPreview from './Previews/ChatThread/ChatThreadPreview.svelte'
  import YoutubePreview from './Previews/Post/YoutubePreview.svelte'
  import AnnotationPreview from './Previews/Annotation/AnnotationPreview.svelte'

  import HistoryEntryPreview from './Previews/Link/HistoryEntryPreview.svelte'
  import { writable } from 'svelte/store'
  import { slide } from 'svelte/transition'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import { CreateTabEventTrigger } from '@horizon/types'
  import {
    useLogScope,
    getHumanDistanceToNow,
    isModKeyPressed,
    hover,
    getFileKind,
    getFileType,
    parseStringIntoUrl
  } from '@horizon/utils'
  import ArticleProperties from './ArticleProperties.svelte'
  import { useTabsManager } from '../../service/tabs'
  import Preview from './Previews/Preview.svelte'

  export let resource: Resource
  export let selected: boolean = false
  // export let annotations: ResourceAnnotation[] = []
  export let showSummary: boolean = false
  export let showTitles: boolean = true
  export let interactive: boolean = true
  export let showSource: boolean = false
  export let newTabOnClick: boolean = false

  const log = useLogScope('ResourcePreviewClean')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()

  const dispatch = createEventDispatcher<{
    click: string
    remove: string
    load: string
    open: string
    'created-tab': void
  }>()

  const isHovered = writable(false)

  // TODO: figure out better way to do this
  $: textResource = resource as ResourceNote
  $: linkResource = resource as ResourceLink
  $: postResource = resource as ResourcePost
  $: articleResource = resource as ResourceArticle
  $: chatMessageResource = resource as ResourceChatMessage
  $: chatThreadResource = resource as ResourceChatThread
  $: documentResource = resource as ResourceDocument
  $: annotationResource = resource as ResourceAnnotation
  $: historyEntryResource = resource as ResourceHistoryEntry

  $: annotations = resource.annotations ?? []

  $: isSilent = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.SILENT)
  $: canonicalUrl =
    resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
    resource.metadata?.sourceURI

  $: isLiveSpaceResource = !!resource.tags?.find(
    (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
  )

  $: showOpenAsFile = !(Object.values(ResourceTypes) as string[]).includes(resource.type)

  let data: ResourceData | null = null
  const handleData = (e: CustomEvent<ResourceData>) => {
    data = e.detail
  }

  let dragging = false

  const openResourceAsTab = (opts?: CreateTabOptions) => {
    tabsManager.openResourceAsTab(resource, opts)
    dispatch('created-tab')
  }

  const handleDragStart = (e: DragEvent) => {
    dragging = true
    if (data) {
      if (resource.type.startsWith(ResourceTypes.POST)) {
        e.dataTransfer?.setData('text/uri-list', (data as ResourceDataPost)?.url ?? '')
      }

      const content = WebParser.getResourceContent(resource.type, data)
      if (content.plain) {
        e.dataTransfer?.setData('text/plain', content.plain)
      }

      if (content.html) {
        e.dataTransfer?.setData('text/html', content.html)
      }
    }
  }

  const handleClick = async (e: MouseEvent) => {
    if (dragging) {
      dragging = false
      return
    }

    if (resource.type === ResourceTypes.ANNOTATION) {
      const annotatesTag = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.ANNOTATES)
      if (annotatesTag) {
        dispatch('open', annotatesTag.value)
        return
      }

      return
    }

    if (e.shiftKey && !isModKeyPressed(e)) {
      log.debug('opening resource in mini browser', resource.id)
      dispatch('open', resource.id)
    } else {
      log.debug('opening resource in new tab', resource.id)
      openResourceAsTab({
        active: !isModKeyPressed(e) || e.shiftKey,
        trigger: CreateTabEventTrigger.OasisItem
      })
    }
  }

  const handleLoad = () => {
    dispatch('load', resource.id)
  }

  const handleRemove = (e: MouseEvent) => {
    e.stopImmediatePropagation()
    dispatch('remove', resource.id)
  }

  const handleOpenAsNewTab = (e: MouseEvent) => {
    e.stopImmediatePropagation()

    openResourceAsTab({
      active: true,
      trigger: CreateTabEventTrigger.OasisItem
    })
  }

  const handleOpenAsFile = () => {
    if (resource.metadata?.name) {
      window.api.openResourceLocally({
        id: resource.id,
        metadata: resource.metadata,
        type: resource.type,
        path: resource.path,
        deleted: resource.deleted,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt
      })
    } else {
      alert('Failed to open file')
    }
  }

  const getHostname = (raw: string) => {
    try {
      const url = new URL(raw)
      return url.hostname
    } catch (error) {
      return raw
    }
  }

  const redditResource = {
    title: "The technology behind GitHub's new code search",
    content:
      'From launching our technology preview of the new and improved code search experience a year ago, to the public beta we released at GitHub Universe last November, there’s been a flurry of innovation and dramatic changes to some of the core GitHub product experiences around how we, as developers, find, read, and navigate code.',
    image:
      'https://external-preview.redd.it/the-technology-behind-githubs-new-code-search-v0-IOddQMDbthht07F_k5NCk9_OWNfuX_LyWNiAwHW3wHA.jpg?auto=webp&s=7ebe51c029a1ac1d9b238df5d6562e42ab976ade',
    url: 'https://www.reddit.com/r/programming/comments/1fjziwr/the_technology_behind_githubs_new_code_search/',
    source: {
      text: 'r/programming',
      imageUrl: 'https://www.google.com/s2/favicons?domain=https://reddit.com&sz=48'
    },
    author: {
      text: 'Posted by StellarNavigator',
      imageUrl: 'https://styles.redditmedia.com/t5_2fwo/styles/communityIcon_1bqa1ibfp8q11.png'
    },
    theme: ['#ff4500', '#ff7947'] as [string, string]
  }

  const twitterResource = {
    title: '',
    content:
      "Over 4 years, 151 releases, and 4k commits later, the stabilization of the Deno Standard Library is finally complete 🎉 There's probably something in this closely audited library that you can use today. And no, you don't need to use Deno.",
    image: '',
    url: 'https://twitter.com/deno_land/status/1430630730730736640',
    source: {
      text: 'Tweet',
      imageUrl: 'https://www.google.com/s2/favicons?domain=https://twitter.com&sz=48'
    },
    author: {
      text: 'Posted by Deno',
      imageUrl: 'https://pbs.twimg.com/profile_images/1267819337026420739/GBuq7wjs_400x400.jpg'
    },
    theme: ['#000', '#252525'] as [string, string]
  }

  const githubResource = {
    title: 'cleanup masonry component, generalize it and fix reactivity issues',
    content:
      'Improves and cleans up the masonry component as previously when searching or making lots of changes to a space you might have ended up with the wrong resources being rendered.',
    image: '',
    url: 'https://github.com/deta/horizon/pull/731',
    source: {
      text: 'deta/horizon',
      imageUrl: 'https://www.google.com/s2/favicons?domain=https://github.com&sz=48'
    },
    author: {
      text: 'Opened by BetaHuhn',
      imageUrl: 'https://avatars.githubusercontent.com/u/51766171?s=60&v=4'
    },
    theme: ['#24292e', '#6e5494'] as [string, string]
  }

  const youtubeResource = {
    title: 'Exploring the secrets of Porsche with photographer Willem Verbeeck',
    content: '',
    image: 'https://img.youtube.com/vi/yRFBitjgmv0/mqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=yRFBitjgmv0&list=WL&index=61',
    source: {
      text: 'YouTube',
      imageUrl: 'https://www.google.com/s2/favicons?domain=https://youtube.com&sz=48'
    },
    author: {
      text: 'From Porsche',
      imageUrl:
        'https://yt3.ggpht.com/IY6Bnx7RbZOv2qXYUQ2irl4CZAXWv7woG_PY50O5w2-eHCz4uR0D8VEB40Dwwc83b2zsKOhj=s88-c-k-c0x00ffffff-no-rj'
    },
    theme: undefined
  }

  const articleZeitResource = {
    title: 'Transporter mehr als doppelt so schwer beladen wie erlaubt',
    content:
      'In Mittelfranken stoppten Polizisten einen überladenen Kleintransporter auf der Autobahn 3 in Gremsdorf, der etwa 7,4 Tonnen wog, obwohl nur 3,5 Tonnen erlaubt waren. Die beiden Insassen wollten asiatische Lebensmittel von Prag nach London transportieren. Der Beifahrer, der auch Fahrzeughalter ist, war 2023 schon einmal mit einem überladenen Transporter angehalten worden. Nach Umschlag der Ladung und Zahlung einer Sicherheitsleistung von 500 Euro durften sie weiterfahren; ein Verfahren zur Abschöpfung des Gewinns wurde gegen den Unternehmer eingeleitet.',
    image:
      'https://img.zeit.de/news/2024-09/18/transporter-mehr-als-doppelt-so-schwer-beladen-wie-erlaubt-image-group/wide__660x371__desktop__scale_2',
    url: 'https://www.zeit.de/news/2024-09/18/transporter-mehr-als-doppelt-so-schwer-beladen-wie-erlaubt',
    source: {
      text: 'zeit.de',
      imageUrl: 'https://static.zeit.de/p/zeit.web/icons/favicon.svg'
    },
    author: {
      text: 'From dpa Bayern',
      imageUrl: ''
    },
    theme: undefined
  }

  const notionResource = {
    title: 'Improve Resource Previews Spec',
    content:
      "An important consideration for the new previews is improving information passthrough and adapting the previews with the user's context. For example if the user annotated a page we should let the annotation pass through so they can easily identify it. Going forward we will have 4 different preview types, a minimal one, a media rich one, a content rich one and a full version with both media and content. We will choose the right one depending on what is saved in the space but the user can also manually change it for each space.",
    image: '',
    url: 'https://www.notion.so/deta/Improve-Resource-Previews-104a5244a717805c8256ccb0c2c947c5',
    source: {
      text: 'Deta',
      imageUrl: 'https://www.google.com/s2/favicons?domain=https://notion.so&sz=48'
    },
    author: {
      text: 'Created by Maximilian Schiller',
      imageUrl: 'https://avatars.githubusercontent.com/u/51766171?s=60&v=4'
    },
    theme: undefined
  }

  const mockResources = [
    redditResource,
    twitterResource,
    githubResource,
    youtubeResource,
    articleZeitResource,
    notionResource
  ]

  // randomly choose between the mock resources
  $: mockResource = mockResources[Math.floor(Math.random() * mockResources.length)]
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  on:click={handleClick}
  class="resource-preview"
  class:clickable={newTabOnClick}
  class:isSelected={selected}
  style="--id:{resource.id};"
  on:dragstart={handleDragStart}
  draggable="true"
>
  <Preview
    {resource}
    title={mockResource.title}
    content={mockResource.content}
    image={mockResource.image}
    url={mockResource.url}
    source={mockResource.source}
    author={mockResource.author}
    theme={mockResource.theme}
    mode="full"
  />
</div>

<style lang="scss">
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(30px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .resource-preview {
    position: relative;
    display: flex;
    gap: 8px;
    flex-direction: column;
    border-radius: 16px;
    overflow: visible;
    cursor: default;
    /* animation: 280ms fade-in-up cubic-bezier(0.25, 0.46, 0.45, 0.94); */
    animation-delay: 20ms;
    animation-fill-mode: forwards;
    animation-iteration-count: 1;
    &:hover {
      .remove-wrapper {
        animation: fade-in 120ms forwards;
        animation-iteration-count: 1;
        animation-delay: 60ms;
      }
    }

    &.clickable {
      cursor: pointer;
    }

    &.isSelected {
      .preview {
        outline: 4px solid rgba(0, 123, 255, 0.75);
      }
    }

    &.background {
      background: rgb(255, 255, 255);
      border: 1px solid rgba(228, 228, 228, 0.75);
      box-shadow:
        0px 1px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 1px 0px rgba(0, 0, 0, 0.25);

      .preview:not(.slack):not(.reddit):not(.twitter):not(.notion) {
        background: rgba(255, 255, 255, 0.75);
        border: none;
        box-shadow: none;
      }
    }

    &.details {
      .preview:hover {
        outline: 0;
      }
    }

    & * {
      user-select: none;
      -webkit-user-drag: none;
    }
  }

  .preview {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(228, 228, 228, 0.75);
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    background: rgba(255, 255, 255, 0.75);
    transition: 60ms ease-out;
    position: relative;
    &:hover {
      outline: 3px solid rgba(0, 0, 0, 0.15);
    }
    &.twitter {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #000 0%, #252525 100%) !important;
    }
    &.slack {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #d5ffed 0%, #ecf9ff 100%);
    }
    &.reddit {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #ff4500 0%, #ff7947 100%);
    }
    &.notion {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #fff 0%, #fafafa 100%);
    }
  }

  .details {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.5rem 0.75rem 0.5rem;
    gap: 0.5rem;
    color: var(--color-text-muted);
    width: 100%;
  }

  .remove-wrapper {
    position: absolute;
    display: flex;
    gap: 0.75rem;
    top: 0;
    padding: 1rem;
    right: -2rem;
    transform: translateY(-45%);
    opacity: 0;
    margin-left: 0.5rem;
    cursor: default;
    .remove {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      transition: 60ms ease-out;
      background: white;
      &.rotated {
        transform: rotate(-45deg);
      }
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }

  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  .type {
    display: flex;
    align-items: start;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: #281b53;
  }

  .label {
    font-size: 1.1rem;
    line-height: 1.4;
    padding: 0 0.25rem 0 0.25rem;
    margin-bottom: 1.5rem;
    text-wrap: balance;
  }

  .dragging {
    position: absolute;
    width: 200px;
    height: 200px;
    max-width: 200px;
    max-height: 200px;
    opacity: 0.7;
    pointer-events: none;
    animation: initial-drag 0.2s ease-out;
  }

  @keyframes initial-drag {
    from {
      transform: scale(0.8);
    }
    to {
      transform: scale(1);
    }
  }

  .annotations {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: rgb(12 74 110/0.9);
  }

  .resource-source {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(4px);
    box-shadow: 0px 0.425px 0px 0px rgba(65, 58, 86, 0.25);
    padding: 0.4rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: rgb(12 74 110/0.9);

    &.hover {
      background: rgba(255, 255, 255);
      color: rgb(12 74 110);
    }
  }

  .favicon {
    width: 1rem;
    height: 1rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .summary-wrapper {
    padding: 0.5rem 1rem;
  }

  .summary {
    font-size: 1rem;
    color: rgb(12 74 110/0.9);
    letter-spacing: 0.0175rem;
    font-weight: 500;
    text-wrap: pretty;
    display: -webkit-box;
    overflow: hidden;
    line-height: 1.5;
    word-break: break-word;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-line-clamp: 15;
    -webkit-box-orient: vertical;
  }
</style>
