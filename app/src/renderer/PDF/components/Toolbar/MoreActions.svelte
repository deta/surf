<script lang="ts">
  import { scale } from 'svelte/transition'
  import { quintOut, quintIn } from 'svelte/easing'
  import { Menu, MenuButton, MenuItems, MenuItem } from '@rgossiaux/svelte-headlessui'
  import { pdfSlickStore } from '../../store'
  import { onMount } from 'svelte'
  import type { ScrollMode as TScrollMode, SpreadMode as TSpreadMode } from '@pdfslick/core'
  import clsx from 'clsx'

  let ScrollMode: typeof TScrollMode
  let SpreadMode: typeof TSpreadMode
  // let openPdfFileRef: HTMLInputElement

  onMount(async () => {
    const pdfSlick = await import('@pdfslick/core')

    ScrollMode = pdfSlick.ScrollMode
    SpreadMode = pdfSlick.SpreadMode
  })

  // const handleOpenPdfFile = (e: Event) => {
  //   const target = e.target as HTMLInputElement
  //   if (target.files && target.files[0]) {
  //     const file = target.files[0]
  //     const url = URL.createObjectURL(file)
  //     $pdfSlickStore?.pdfSlick?.loadDocument(url, { filename: file.name })
  //   }
  // }
</script>

<div class="absolute overflow-hidden w-0 h-0">
  <!--  <input
    id="openPdfFileAction"
    tabIndex={-1}
    type="file"
    accept=".pdf,application/pdf"
    on:change={handleOpenPdfFile}
    class="absolute -top-[10000px"
    bind:this={openPdfFileRef}
  /> -->
</div>
<Menu class="relative" let:open>
  <MenuButton
    class="inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
    on:click={(e) => {
      e.preventDefault()
      e.stopPropagation()
    }}
  >
    <span class="sr-only">Open more actions menu</span>
    <iconify-icon height={16} icon="codicon:kebab-vertical" />
  </MenuButton>

  {#if open}
    <div
      in:scale={{ duration: 100, delay: 0, opacity: 0.75, start: 0.95, easing: quintOut }}
      out:scale={{ duration: 75, delay: 0, opacity: 0, start: 0.95, easing: quintIn }}
    >
      <MenuItems>
        <div
          class="absolute right-2 w-52 z-30 mt-2 origin-top-right divide-y divide-slate-200 rounded text-left bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-content-hide ui-expanded:animate-content-show"
          role="menu"
          aria-orientation="vertical"
          tabindex="-1"
        >
          <div class="py-1">
            <MenuItem
              on:click={() => {
                $pdfSlickStore?.pdfSlick?.requestPresentationMode()
              }}
              class={({ active, disabled }) =>
                clsx(
                  'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                  {
                    'text-gray-900 bg-slate-100': active,
                    'text-gray-700': !active,
                    'opacity-50': disabled
                  }
                )}
            >
              <iconify-icon height={16} icon="codicon:play" />
              <span>Presentation Mode</span>
            </MenuItem>
          </div>

          <div class="py-1">
            <!-- <MenuItem
              class={({ active, disabled }) =>
                clsx(
                  'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                  {
                    'text-gray-900 bg-slate-100': active,
                    'text-gray-700': !active,
                    'opacity-50': disabled
                  }
                )}
              on:click={() => {
                openPdfFileRef.click()
              }}
            >
              <iconify-icon height={16} icon="codicon:diff-added" />
              <span>Open PDF File...</span>
            </MenuItem>
            <MenuItem
              on:click={() => {
                $pdfSlickStore?.pdfSlick?.downloadOrSave()
              }}
              class={({ active, disabled }) =>
                clsx(
                  'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                  {
                    'text-gray-900 bg-slate-100': active,
                    'text-gray-700': !active,
                    'opacity-50': disabled
                  }
                )}
            >
              <iconify-icon height={16} icon="codicon:desktop-download" />
              <span>Save</span>
            </MenuItem>
            <MenuItem
              on:click={() => {
                $pdfSlickStore.pdfSlick?.triggerPrinting()
              }}
              class={({ active, disabled }) =>
                clsx(
                  'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                  {
                    'text-gray-900 bg-slate-100': active,
                    'text-gray-700': !active,
                    'opacity-50': disabled
                  }
                )}
            >
              <svg viewBox="0 0 20 20" class="w-5 h-5 fill-current -ml-0.5">
                <path
                  d="M5 4.5C5 3.67 5.67 3 6.5 3h7c.83 0 1.5.67 1.5 1.5V5h.5A2.5 2.5 0 0118 7.5v5c0 .83-.67 1.5-1.5 1.5H15v1.5c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 015 15.5V14H3.5A1.5 1.5 0 012 12.5v-5A2.5 2.5 0 014.5 5H5v-.5zM6 5h8v-.5a.5.5 0 00-.5-.5h-7a.5.5 0 00-.5.5V5zm-1 8v-1.5c0-.83.67-1.5 1.5-1.5h7c.83 0 1.5.67 1.5 1.5V13h1.5a.5.5 0 00.5-.5v-5c0-.83-.67-1.5-1.5-1.5h-11C3.67 6 3 6.67 3 7.5v5c0 .28.22.5.5.5H5zm1.5-2a.5.5 0 00-.5.5v4c0 .28.22.5.5.5h7a.5.5 0 00.5-.5v-4a.5.5 0 00-.5-.5h-7z"
                  fill-rule="nonzero"
                />
              </svg>
              <span>Print</span>
            </MenuItem>
          </div> -->

            <div class="py-1">
              <MenuItem
                disabled={$pdfSlickStore?.pageNumber === 1}
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.gotoPage(1)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:export" class="-rotate-90" />
                <span>Go to First Page</span>
              </MenuItem>
              <MenuItem
                disabled={$pdfSlickStore?.pageNumber === $pdfSlickStore?.numPages}
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.gotoPage($pdfSlickStore?.numPages)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:export" class="rotate-90" />
                <span>Go to Last Page</span>
              </MenuItem>
            </div>

            <div class="py-1">
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setRotation($pdfSlickStore?.pagesRotation + 90)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:refresh" />
                <span>Rotate Clockwise</span>
              </MenuItem>
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setRotation($pdfSlickStore?.pagesRotation - 90)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:refresh" class="-scale-x-100 scale-y-100" />
                <span>Rotate Counterclockwise</span>
              </MenuItem>
            </div>

            <div class="py-1">
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setScrollMode(ScrollMode.PAGE)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:file-pdf" />
                <span class="flex-1">Page Scrolling</span>
                {#if $pdfSlickStore.scrollMode === ScrollMode.PAGE}
                  <iconify-icon height={12} icon="codicon:check" />
                {/if}
              </MenuItem>
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setScrollMode(ScrollMode.VERTICAL)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:arrow-both" class="rotate-90" />
                <span class="flex-1">Vertical Scrolling</span>
                {#if $pdfSlickStore.scrollMode === ScrollMode.VERTICAL}
                  <iconify-icon height={12} icon="codicon:check" />
                {/if}
              </MenuItem>
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setScrollMode(ScrollMode.HORIZONTAL)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:arrow-both" />
                <span class="flex-1">Horizontal Scrolling</span>
                {#if $pdfSlickStore.scrollMode === ScrollMode.HORIZONTAL}
                  <iconify-icon height={12} icon="codicon:check" />
                {/if}
              </MenuItem>
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setScrollMode(ScrollMode.WRAPPED)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:extensions" />
                <span class="flex-1">Wrapped Scrolling</span>
                {#if $pdfSlickStore.scrollMode === ScrollMode.WRAPPED}
                  <iconify-icon height={12} icon="codicon:check" />
                {/if}
              </MenuItem>
            </div>

            <div class="py-1">
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setSpreadMode(SpreadMode.NONE)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:file" />
                <span class="flex-1">No Spreads</span>
                {#if $pdfSlickStore.spreadMode === SpreadMode.NONE}
                  <iconify-icon height={12} icon="codicon:check" />
                {/if}
              </MenuItem>
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setSpreadMode(SpreadMode.ODD)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:files" />
                <span class="flex-1">Odd Spreads</span>
                {#if $pdfSlickStore.spreadMode === SpreadMode.ODD}
                  <iconify-icon height={12} icon="codicon:check" />
                {/if}
              </MenuItem>
              <MenuItem
                on:click={() => {
                  $pdfSlickStore?.pdfSlick?.setSpreadMode(SpreadMode.EVEN)
                }}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="codicon:copy" />
                <span class="flex-1">Even Spreads</span>
                {#if $pdfSlickStore.spreadMode === SpreadMode.EVEN}
                  <iconify-icon height={12} icon="codicon:check" />
                {/if}
              </MenuItem>
            </div>

            <div class="py-1">
              <MenuItem
                on:click={() => $pdfSlickStore?.pdfSlick?.downloadOrSave()}
                class={({ active, disabled }) =>
                  clsx(
                    'w-full  items-center flex space-x-2 box-border text-left px-2 py-1.5 text-xs',
                    {
                      'text-gray-900 bg-slate-100': active,
                      'text-gray-700': !active,
                      'opacity-50': disabled
                    }
                  )}
              >
                <iconify-icon height={16} icon="tabler:download" />
                <span>Download to System</span>
              </MenuItem>
            </div>
          </div>
        </div></MenuItems
      >
    </div>
  {/if}
</Menu>
