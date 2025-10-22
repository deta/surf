<script lang="ts">
  import { pdfSlickStore, tab } from '../../store'
  import { clsx } from 'clsx'
  import OutlineItems from './OutlineItems.svelte'
</script>

<div
  class={clsx('overflow-auto absolute inset-0', {
    invisible: $tab !== 'outline'
  })}
>
  <div class="p-2 pl-0.5 text-slate-700 text-sm">
    <OutlineItems outline={$pdfSlickStore?.documentOutline} />
  </div>
</div>
