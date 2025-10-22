<script lang="ts">
  import { pdfSlickStore } from '../../store'
  import { Menu, MenuButton, MenuItems, MenuItem } from '@rgossiaux/svelte-headlessui'
  import { clsx } from 'clsx'

  const presets = new Map([
    ['auto', 'Auto'],
    ['page-actual', 'Actual Size'],
    ['page-fit', 'Page Fit'],
    ['page-width', 'Page Width']
  ])

  const zoomVals = new Map([
    [0.5, '50%'],
    [0.75, '75%'],
    [1, '100%'],
    [1.25, '125%'],
    [1.5, '150%'],
    [2, '200%']
  ])
</script>

<div class="flex items-center space-x-1">
  <button
    disabled={!$pdfSlickStore?.pdfSlick || $pdfSlickStore?.scale <= 0.25}
    class="inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
    on:click={() => $pdfSlickStore?.pdfSlick?.viewer?.decreaseScale()}
  >
    <iconify-icon height={16} icon="codicon:remove" />
  </button>

  <Menu as="div" class="relative">
    <MenuButton
      class="flex w-32 text-left items-center bg-slate-200/70 hover:bg-slate-200 py-1 rounded-sm focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
      on:click={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <span class="sr-only">Open zoom options</span>
      <div class="flex px-1 w-full">
        <span class={`flex-1 px-1 ${$pdfSlickStore?.pdfSlick ? 'opacity-100' : 'opacity-0'}`}>
          {$pdfSlickStore?.scaleValue && presets.has($pdfSlickStore?.scaleValue)
            ? presets.get($pdfSlickStore?.scaleValue)
            : `${~~($pdfSlickStore?.scale * 100)}%`}
        </span>

        <div class="w-4 h-4">
          <iconify-icon height={16} icon="codicon:chevron-down" />
        </div>
      </div>
    </MenuButton>
    <MenuItems
      as="div"
      class="absolute w-32 max-w-[142px] right-0 left-0 z-30 mt-1 origin-top-right divide-y divide-slate-200 rounded text-left bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-content-hide ui-expanded:animate-content-show"
      role="menu"
      aria-orientation="vertical"
      tabindex={-1}
    >
      <div class="py-1">
        {#each Array.from(presets.entries()) as [value, label]}
          <MenuItem
            on:click={() => {
              if ($pdfSlickStore.pdfSlick) {
                $pdfSlickStore.pdfSlick.currentScaleValue = value
              }
            }}
            class={({ active }) =>
              clsx(` block w-full text-left px-2 py-1.5 text-xs`, {
                'bg-slate-100 text-slate-900': active,
                'text-slate-700': !active
              })}
          >
            {label}
          </MenuItem>
        {/each}
      </div>

      <div class="py-1">
        {#each Array.from(zoomVals.entries()) as [value, label]}
          <MenuItem
            on:click={() => {
              if ($pdfSlickStore.pdfSlick) {
                $pdfSlickStore.pdfSlick.currentScale = value
              }
            }}
            class={({ active }) =>
              clsx(` block w-full text-left px-2 py-1.5 text-xs`, {
                'bg-slate-100 text-slate-900': active,
                'text-slate-700': !active
              })}
          >
            {label}
          </MenuItem>
        {/each}
      </div>
    </MenuItems>
  </Menu>

  <button
    disabled={!$pdfSlickStore?.pdfSlick || $pdfSlickStore?.scale >= 5}
    class="inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
    on:click={() => $pdfSlickStore?.pdfSlick?.viewer?.increaseScale()}
  >
    <iconify-icon height={16} icon="codicon:add" />
  </button>
</div>
