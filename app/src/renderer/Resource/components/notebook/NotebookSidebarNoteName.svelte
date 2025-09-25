<script lang="ts">
  import { onMount } from 'svelte'
  import { useResourceManager, type Resource, getResourceCtxItems } from '@deta/services/resources'
  import { contextMenu, openDialog, type CtxItem } from '@deta/ui'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { truncate } from '@deta/utils'
  import { type Fn, type OpenTarget, SpaceEntryOrigin } from '@deta/types'
  import { handleResourceClick, openResource } from '../../handlers/notebookOpenHandlers'
  import { Icon } from '@deta/icons'

  let {
    resource,
    sourceNotebookId,
    onclick,
    fallbackIcon = 'add',
    fallbackText = 'Create new Note'
  }: {
    resource: Resource
    sourceNotebookId?: string
    onclick?: Fn
    fallbackIcon?: string
    fallbackText?: string
  } = $props()

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  const handleAddToNotebook = (notebookId: string) => {
    notebookManager.addResourcesToNotebook(
      notebookId,
      [resource.id],
      SpaceEntryOrigin.ManuallyAdded,
      true
    )
  }

  const handleRemoveFromNotebook = (notebookId: string) => {
    notebookManager.removeResourcesFromNotebook(notebookId, [resource.id], true)
  }

  const CTX_MENU_ITEMS: CtxItem[] = $derived(
    resource
      ? getResourceCtxItems({
          resource,
          sortedNotebooks: notebookManager.sortedNotebooks,
          onOpen: (target: OpenTarget) => openResource(resource.id, { target, offline: false }),
          onAddToNotebook: (id: string) => handleAddToNotebook(id),
          onDeleteResource: async (resourceId: string) => {
            const { closeType: confirmed } = await openDialog({
              title: `Delete Note?</i>`,
              message: `This can't be undone..`,
              actions: [
                { title: 'Cancel', type: 'reset' },
                { title: 'Delete', type: 'submit', kind: 'danger' }
              ]
            })
            if (!confirmed) return

            notebookManager.deleteResourcesFromSurf(resourceId, true)
          },
          onRemove:
            !sourceNotebookId || sourceNotebookId === 'drafts'
              ? undefined
              : () => handleRemoveFromNotebook(sourceNotebookId)
        })
      : []
  )

  function formatFriendlyDate(date) {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    // Normalize times to midnight for comparison
    function normalize(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    }

    const normalizedDate = normalize(date)
    const normalizedToday = normalize(today)
    const normalizedYesterday = normalize(yesterday)

    if (normalizedDate.getTime() === normalizedToday.getTime()) {
      return 'Today'
    }

    if (normalizedDate.getTime() === normalizedYesterday.getTime()) {
      return 'Yesterday'
    }

    // Otherwise format like "Monday 27, September"
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    })
      .format(date)
      .replace(/(\w+), (\w+) (\d+)/, '$1 $3, $2')
  }
</script>

<li
  {@attach contextMenu({
    canOpen: resource !== undefined,
    items: CTX_MENU_ITEMS
  })}
  onclick={(e) => {
    resource ? handleResourceClick(resource.id, e) : onclick?.(e)
  }}
  onauxclick={(e) => {
    resource ? handleResourceClick(resource.id, e) : onclick?.(e)
  }}
>
  {#if resource}
    <div class="note">
      <svg
        width="34"
        height="41"
        viewBox="0 0 34 41"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g filter="url(#filter0_ddd_1996_3278)">
          <rect
            x="1"
            y="3.00195"
            width="29"
            height="36"
            rx="5"
            transform="rotate(-2 1 3.00195)"
            fill="#F9F9F9"
            style="fill:#F9F9F9;fill:color(display-p3 0.9781 0.9781 0.9781);fill-opacity:1;"
          />
          <rect
            x="0.482855"
            y="2.51971"
            width="30"
            height="37"
            rx="5.5"
            transform="rotate(-2 0.482855 2.51971)"
            stroke="#E8E8E8"
            stroke-opacity="0.52"
            style="stroke:#E8E8E8;stroke:color(display-p3 0.9107 0.9107 0.9107);stroke-opacity:0.51;"
          />
          <path
            d="M6.24121 9.82227L12.2376 9.61287"
            stroke="black"
            stroke-opacity="0.16"
            style="stroke:black;stroke-opacity:0.25;"
            stroke-linecap="round"
          />
          <path
            d="M6.38086 13.8203L19.3729 13.3666"
            stroke="black"
            stroke-opacity="0.16"
            style="stroke:black;stroke-opacity:0.25;"
            stroke-linecap="round"
          />
        </g>
        <defs>
          <filter
            id="filter0_ddd_1996_3278"
            x="-0.78363"
            y="0.207031"
            width="33.806"
            height="42.5566"
            filterUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB"
          >
            <feFlood flood-opacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset />
            <feGaussianBlur stdDeviation="0.5" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.09 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1996_3278" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="0.5" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
            <feBlend
              mode="normal"
              in2="effect1_dropShadow_1996_3278"
              result="effect2_dropShadow_1996_3278"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="2" />
            <feGaussianBlur stdDeviation="0.5" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.01 0" />
            <feBlend
              mode="normal"
              in2="effect2_dropShadow_1996_3278"
              result="effect3_dropShadow_1996_3278"
            />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="effect3_dropShadow_1996_3278"
              result="shape"
            />
          </filter>
        </defs>
      </svg>
    </div>
    <div class="details">
      <span>{resource.metadata.name}</span>
      <span class="small">{formatFriendlyDate(new Date(resource.updatedAt))}</span>
    </div>
  {:else}
    <div class="note empty">
      <Icon name={fallbackIcon} size="1em" />
    </div>
    <div class="details">
      <span style="color: rgba(0,0,0,0.75);">{fallbackText}</span>
    </div>
  {/if}
</li>

<style lang="scss">
  li {
    padding: 0.5em 0.5em;
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 1ch;

    &:hover,
    &:global([data-context-menu-anchor]) {
      background: rgba(0, 0, 0, 0.03);
    }

    .details {
      //padding-block: 0.2rem;
      font-size: 0.9em;
    }

    span {
      //display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      leading-trim: both;
      text-edge: cap;
      text-overflow: ellipsis;
      font-family: Inter;
      font-style: normal;
      font-weight: 400;
      line-height: 0.9355rem; /* 106.916% */

      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;

      &:not(.active) {
        opacity: 0.6;
      }

      &.small {
        opacity: 0.25;
        margin-top: 0.2rem;
        font-size: 0.95em;
      }
    }

    .note.empty {
      --color: rgba(0, 0, 0, 0.25);
      border: 1px dashed var(--color);
      rotate: -2deg;
      width: 34px;
      height: 41px;
      border-radius: 8px;

      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--color);
    }
  }
</style>
