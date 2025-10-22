<script lang="ts">
  import { scale } from 'svelte/transition'
  import { quintOut, quintIn } from 'svelte/easing'
  import { clsx } from 'clsx'
  import { Menu, MenuButton, MenuItems } from '@rgossiaux/svelte-headlessui'
  import { pdfSlickStore } from '../../store'
  import { default as colors, colorStrengths, colorNames } from '../../colors'

  const AnnotationEditorType = {
    DISABLE: -1,
    NONE: 0,
    FREETEXT: 3,
    INK: 15
  }

  const AnnotationEditorParamsType = {
    FREETEXT_SIZE: 1,
    FREETEXT_COLOR: 2,
    FREETEXT_OPACITY: 3,
    INK_COLOR: 11,
    INK_THICKNESS: 12,
    INK_OPACITY: 13
  }

  let isInkMode = false
  let thickness = 1
  let opacity = 100

  $: isInkMode = $pdfSlickStore?.annotationEditorMode === AnnotationEditorType.INK

  $: {
    if ($pdfSlickStore?.pdfSlick && thickness) {
      $pdfSlickStore?.pdfSlick?.setAnnotationEditorParams([
        {
          type: AnnotationEditorParamsType.INK_THICKNESS,
          value: thickness
        }
      ])
    }
  }

  $: {
    if ($pdfSlickStore?.pdfSlick && opacity) {
      $pdfSlickStore?.pdfSlick?.setAnnotationEditorParams([
        {
          type: AnnotationEditorParamsType.INK_OPACITY,
          value: opacity
        }
      ])
    }
  }
</script>

<div
  class={clsx(`flex items-center rounded-sm group`, {
    'bg-blue-100': isInkMode,
    'hover:bg-slate-200/50': !isInkMode
  })}
>
  <button
    class={`inline-flex enabled:hover:text-black text-slate-600 p-1 disabled:text-slate-300 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent`}
    on:click={() => {
      const mode = isInkMode ? AnnotationEditorType.NONE : AnnotationEditorType.INK
      $pdfSlickStore?.pdfSlick?.setAnnotationEditorMode(mode)
    }}
  >
    <iconify-icon height={16} icon="codicon:edit" />
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

                      $pdfSlickStore?.pdfSlick?.setAnnotationEditorMode(AnnotationEditorType.INK)
                      $pdfSlickStore?.pdfSlick?.setAnnotationEditorParams([
                        {
                          type: AnnotationEditorParamsType.INK_COLOR,
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
              <label for="inkThickness" class="text-sm w-20 font-medium text-gray-900"
                >Thickness</label
              >
              <div class="w-full flex flex-1 items-center">
                <input
                  class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none dark:bg-gray-700"
                  bind:value={thickness}
                  id="inkThickness"
                  type="range"
                  min={1}
                  max={100}
                />
              </div>
            </div>

            <div class="py-1 flex space-x-2 items-center">
              <label for="inkOpacity" class="text-sm w-20 font-medium text-gray-900">Opacity</label>
              <div class="w-full flex flex-1 items-center">
                <input
                  class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none dark:bg-gray-700"
                  bind:value={opacity}
                  id="inkOpacity"
                  type="range"
                  min={0}
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
