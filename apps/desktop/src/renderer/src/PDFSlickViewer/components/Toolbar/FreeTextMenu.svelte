<script lang="ts">
  import { clsx } from 'clsx'
  import { scale } from 'svelte/transition'
  import { quintOut, quintIn } from 'svelte/easing'
  import { Menu, MenuButton, MenuItems } from '@rgossiaux/svelte-headlessui'
  import { pdfSlickStore } from '../../store'
  import { default as colors, colorStrengths, colorNames } from '../../colors'
  import { AnnotationEditorType, AnnotationEditorParamsType } from 'pdfjs-dist'

  let isFreetextMode = false
  let fontSize = 12

  $: isFreetextMode = $pdfSlickStore?.annotationEditorMode === AnnotationEditorType.FREETEXT

  $: {
    if ($pdfSlickStore?.pdfSlick && fontSize) {
      $pdfSlickStore?.pdfSlick?.setAnnotationEditorParams([
        {
          type: AnnotationEditorParamsType.FREETEXT_SIZE,
          value: fontSize
        }
      ])
    }
  }
</script>

<div
  class={clsx(`flex items-center group rounded-sm`, {
    'bg-blue-100': isFreetextMode,
    'hover:bg-slate-200/50': !isFreetextMode
  })}
>
  <button
    class={`inline-flex enabled:hover:text-black text-slate-600 p-0.5 disabled:text-slate-300 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent`}
    on:click={() => {
      const mode = isFreetextMode ? AnnotationEditorType.NONE : AnnotationEditorType.FREETEXT
      $pdfSlickStore?.pdfSlick?.setAnnotationEditorMode(mode)
    }}
  >
    <iconify-icon height={20} icon="codicon:case-sensitive" />
  </button>

  <Menu class="relative" let:open>
    <MenuButton
      disabled={!$pdfSlickStore?.pdfSlick}
      class="h-6 enabled:group-hover:hover:!bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 rounded-sm transition-all focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
      on:click={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div class="inline-flex p-0.5">
        <iconify-icon height={12} icon="codicon:chevron-down" />
      </div>
    </MenuButton>

    {#if open}
      <div
        in:scale={{ duration: 100, delay: 0, opacity: 0.75, start: 0.95, easing: quintOut }}
        out:scale={{ duration: 75, delay: 0, opacity: 0, start: 0.95, easing: quintIn }}
      >
        <MenuItems
          static
          class="absolute right-0 z-30 mt-2 origin-top-right rounded-sm text-left bg-white divide-y divide-slate-200 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          tabindex={-1}
        >
          <div class="flex flex-col space-y-1 p-2">
            <div class="text-sm font-medium text-gray-900 py-1">Color</div>
            {#each colorStrengths as s}
              <div class="flex space-x-1">
                {#each colorNames as name}
                  <button
                    class="p-2 block rounded-full origin-center border border-transparent hover:scale-125 hover:border-blue-300 focus:ring-0 focus:outline-none focus:scale-125 focus:border-blue-300"
                    style={`background-color: ${colors[name][s]}`}
                    on:click={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      $pdfSlickStore?.pdfSlick?.setAnnotationEditorMode(
                        AnnotationEditorType.FREETEXT
                      )
                      $pdfSlickStore?.pdfSlick?.setAnnotationEditorParams([
                        {
                          type: AnnotationEditorParamsType.FREETEXT_COLOR,
                          value: colors[name][s]
                        }
                      ])
                    }}
                  />
                {/each}
              </div>
            {/each}
          </div>

          <div class="p-2 flex flex-col">
            <div class="py-1 flex space-x-2 items-center">
              <label for="fontSize" class="text-sm w-20 font-medium text-gray-900">
                Font Size
              </label>
              <div class="w-full flex flex-1 items-center">
                <input
                  class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none dark:bg-gray-700"
                  bind:value={fontSize}
                  id="fontSize"
                  type="range"
                  min={12}
                  max={100}
                />
              </div>
            </div>
          </div>
        </MenuItems>
      </div>
    {/if}
  </Menu>
</div>
