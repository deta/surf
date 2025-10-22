<script lang="ts">
  import { clsx } from 'clsx'
  import { pdfSlickStore, tab, isThumbsbarOpen } from '../../store'
  import Tooltip from '../../Tooltip.svelte'
</script>

<div
  class={clsx(
    `bg-white z-10 flex flex-col p-1 py-2 space-y-3 items-center border-r border-r-slate-300 shadow-sm transition-all [box-shadow:1px_0_2px_0_rgb(0_0_0_/_0.05)]`,
    {
      'translate-x-0 visible opacity-100': $isThumbsbarOpen,
      '-translate-x-full invisible opacity-0': !$isThumbsbarOpen
    }
  )}
>
  <button
    disabled={!$pdfSlickStore?.pdfSlick}
    on:click={() => tab.set('thumbnails')}
    class={clsx(
      `flex items-center enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent`,
      {
        'enabled:bg-blue-100 enabled:text-black border-blue-200':
          !!$pdfSlickStore?.pdfSlick && $tab === 'thumbnails'
      }
    )}
  >
    <Tooltip>
      <p class="whitespace-nowrap">Page Thumbnails</p>
    </Tooltip>
    <iconify-icon height={16} icon="codicon:versions" />
  </button>
  <button
    disabled={!$pdfSlickStore?.documentOutline}
    class={clsx(
      `flex items-center enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent`,
      {
        'enabled:bg-blue-100 enabled:text-black border-blue-200': $tab === 'outline'
      }
    )}
    on:click={() => tab.set('outline')}
  >
    <Tooltip>
      <p class="whitespace-nowrap">Document Outline</p>
    </Tooltip>
    <iconify-icon height={16} icon="codicon:list-tree" />
  </button>
  <button
    disabled={$pdfSlickStore?.attachments?.size < 1}
    class={clsx(
      `flex items-center enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent`,
      {
        'enabled:bg-blue-100 enabled:text-black border-blue-200': $tab === 'attachments'
      }
    )}
    on:click={() => tab.set('attachments')}
  >
    <Tooltip>
      <p class="whitespace-nowrap">Attachments</p>
    </Tooltip>
    <iconify-icon height={16} icon="codicon:save-all" />
  </button>
</div>
