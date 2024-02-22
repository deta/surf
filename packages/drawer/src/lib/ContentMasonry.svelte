<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'

  export let animate: boolean = true
  export let calcCols = (masonryWidth: number, minColWidth: number, gap: number): number => {
    return Math.min(items.length, Math.floor((masonryWidth + gap) / (minColWidth + gap)) || 1)
  }
  export { className as class }
  export let columnClass: string = ``
  export let duration: number = 200
  export let gap: number = 20
  // On non-primitive types, we need a property to tell masonry items apart. This component
  // hard-codes the name of this property to 'id'. See https://svelte.dev/tutorial/keyed-each-blocks.
  export let getId = (item: Item): string | number => {
    if (typeof item === `number`) return item
    if (typeof item === `string`) return item
    return (item as Record<string, string | number>)[idKey]
  }
  export let idKey: string = `id`
  export let items: Item[]
  export let masonryHeight: number = 0
  export let masonryWidth: number = 0
  export let maxColWidth: number = 500
  export let minColWidth: number = 330
  export let style: string = ``

  $: if (maxColWidth < minColWidth) {
    console.warn(`svelte-bricks: maxColWidth (${maxColWidth}) < minColWidth (${minColWidth}).`)
  }

  type Item = $$Generic
  let className = ``

  $: nCols = calcCols(masonryWidth, minColWidth, gap)
  $: itemsToCols = items.reduce(
    (cols: [Item, number][][], item, idx) => {
      cols[idx % cols.length].push([item, idx])
      return cols
    },
    Array(nCols).fill(null).map(() => []) // prettier-ignore
  )

  $: console.log('masonryWidth', masonryWidth)
</script>

<div
  class="masonry {className}"
  bind:clientWidth={masonryWidth}
  bind:clientHeight={masonryHeight}
  style="gap: {gap}px; {style}"
>
  {#each itemsToCols as col}
    <div class="col {columnClass}" style="gap: {gap}px; max-width: {maxColWidth}px;">
      {#if animate}
        {#each col as [item, idx] (getId(item))}
          <div
            in:fade={{ delay: 100, duration }}
            out:fade={{ delay: 0, duration }}
            animate:flip={{ duration }}
          >
            <slot {idx} {item}>
              <span>{item}</span>
            </slot>
          </div>
        {/each}
      {:else}
        {#each col as [item, idx] (getId(item))}
          <slot {idx} {item}>
            <span>{item}</span>
          </slot>
        {/each}
      {/if}
    </div>
  {/each}
</div>

<style>
  :where(div.masonry) {
    display: flex;
    justify-content: center;
    overflow-wrap: anywhere;
    box-sizing: border-box;
  }
  :where(div.masonry div.col) {
    display: grid;
    height: max-content;
    width: 100%;
  }
</style>
