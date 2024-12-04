<script lang="ts">
  import { clsx } from 'clsx'

  export let position: 'bottom' | 'right' = 'right'
  export let alignX: 'center' | 'right' | 'left' = 'left'
</script>

<div
  role="tooltip"
  class={clsx({
    'absolute z-10 inline-block text-xs transition-opacity duration-300': true,
    'rounded-sm shadow opacity-0 invisible': true,
    'text-gray-500 bg-slate-50 border border-slate-300': true,
    'group-hover:!visible group-hover:!opacity-100': true,

    'left-full top-1/2 -translate-y-1/2 ml-4': position === 'right',
    'top-full mt-2': position === 'bottom',
    'right-1/2 translate-x-1/2': position === 'bottom' && alignX === 'center',
    'right-0': position === 'bottom' && alignX === 'right',
    'left-0': position === 'bottom' && alignX === 'left'
  })}
>
  <div class="px-2 py-1.5">
    <slot />
  </div>

  {#if position === 'right'}
    <div
      class={clsx({
        'absolute w-[6px] h-[6px] bg-inherit invisible -left-[8px] top-1/2 -mt-[4px]': true,
        "before:absolute before:w-[6px] before:h-[6px] before:bg-inherit before:visible before:rotate-45 before:content-['']": true,
        "after:absolute after:w-[7px] after:h-[7px] after:bg-inherit after:visible after:rotate-45 after:content-['']": true,
        'before:border-b before:border-l before:border-solid before:border-slate-300': true,
        'after:border-b after:border-l after:border-solid after:border-slate-300': true,
        'after:invisible before:invisible group-hover:after:!visible group-hover:before:!visible': true
      })}
    />
  {/if}

  {#if position === 'bottom'}
    <div
      class={clsx({
        'absolute w-[6px] h-[6px] bg-inherit invisible -top-[5px]': true,
        "before:absolute before:w-[6px] before:h-[6px] before:bg-inherit before:visible before:rotate-45 before:content-['']": true,
        "after:absolute after:w-[7px] after:h-[7px] after:bg-inherit after:visible after:rotate-45 after:content-['']": true,
        'before:border-t before:border-l before:border-solid before:border-slate-300': true,
        'after:border-t after:border-l after:border-solid after:border-slate-300': true,
        'after:invisible before:invisible group-hover:after:!visible group-hover:before:!visible': true,

        'left-1/2 -ml-[6px]': alignX === 'center',
        'right-0 mr-[12px]': alignX === 'right',
        'left-0 ml-[6px]': alignX === 'left'
      })}
    />
  {/if}
</div>
