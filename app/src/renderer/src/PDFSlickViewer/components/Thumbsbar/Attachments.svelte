<script lang="ts">
  import { clsx } from 'clsx'
  import { pdfSlickStore, tab } from '../../store'
</script>

<div
  class={clsx('overflow-auto absolute inset-0', {
    invisible: $tab !== 'attachments'
  })}
>
  <div class="p-2 text-slate-700 text-sm">
    {#each Array.from($pdfSlickStore?.attachments?.values() ?? []) as { filename, content }}
      <button
        class="w-full box-border rounded text-left hover:text-slate-900 p-1 hover:bg-slate-200"
        on:click={(e) => {
          // @ts-expect-error Argument of type 'EventTarget' is not assignable to parameter of type 'HTMLElement'
          e.target && $pdfSlickStore?.pdfSlick?.openOrDownloadData(e.target, content, filename)
        }}
      >
        {filename}
      </button>
    {/each}
  </div>
</div>
