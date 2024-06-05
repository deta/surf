<script>
  import { onMount, onDestroy, getContext, setContext, tick } from 'svelte'
  export let stretchFirst = false,
    gridGap = '0.5em',
    colWidth = 'minmax(Min(40em, 100%), 1fr)',
    items = [] // pass in data if it's dynamically updated
  let grids = [],
    masonryElement

  export let reset = false
  $: if (reset) {
    masonryElement = masonryElement
  }

  export const refreshLayout = async () => {
    grids.forEach(async (grid) => {
      /* get the post relayout number of columns */
      let ncol = getComputedStyle(grid._el).gridTemplateColumns.split(' ').length

      grid.items.forEach((c) => {
        let new_h = c.getBoundingClientRect().height

        if (new_h !== +c.dataset.h) {
          c.dataset.h = new_h
          grid.mod++
        }
      })

      /* if the number of columns has changed */
      if (grid.ncol !== ncol || grid.mod) {
        /* update number of columns */
        grid.ncol = ncol
        /* revert to initial positioning, no margin */
        grid.items.forEach((c) => c.style.removeProperty('margin-top'))
        /* if we have more than one column */
        if (grid.ncol > 1) {
          grid.items.slice(ncol).forEach((c, i) => {
            let prev_fin =
                grid.items[i].getBoundingClientRect().bottom /* bottom edge of item above */,
              curr_ini = c.getBoundingClientRect().top /* top edge of current item */

            c.style.marginTop = `${prev_fin + grid.gap - curr_ini}px`
          })
        }

        grid.mod = 0
      }
    })
  }

  const calcGrid = async (_masonryArr) => {
    await tick()
    if (_masonryArr.length && getComputedStyle(_masonryArr[0]).gridTemplateRows !== 'masonry') {
      grids = _masonryArr.map((grid) => {
        return {
          _el: grid,
          gap: parseFloat(getComputedStyle(grid).gridRowGap),
          items: [...grid.childNodes].filter(
            (c) => c.nodeType === 1 && +getComputedStyle(c).gridColumnEnd !== -1
          ),
          ncol: 0,
          mod: 0
        }
      })
      await tick()
      refreshLayout() /* initial load */
      await tick()
      setTimeout(() => {
        refreshLayout()
      }, 100)
      await tick()
      setTimeout(() => {
        refreshLayout()
      }, 500)
    }
  }

  let _window
  onMount(() => {
    _window = window
    _window.addEventListener('resize', refreshLayout, false) /* on resize */
  })
  onDestroy(() => {
    if (_window) {
      _window.removeEventListener('resize', refreshLayout, false) /* on resize */
    }
  })

  $: if (masonryElement) {
    calcGrid([masonryElement])
  }

  $: if (items) {
    // update if items are changed
    masonryElement = masonryElement // refresh masonryElement
  }
</script>

<!--
  An almost direct copy and paste of: https://css-tricks.com/a-lightweight-masonry-solution

  Usage:
    - stretchFirst stretches the first item across the top

  <Masonry stretchFirst={true} >
    {#each data as o}
      <div class="_card _padding">
        Here's some stuff {o.name}
        <header>
          <h3>{o.name}</h3>
        </header>
        <section>
          <p>{o.text}</p>
        </section>
      </div>
    {/each}
  </Masonry>
 -->

<div
  bind:this={masonryElement}
  class={`__grid--masonry ${stretchFirst ? '__stretch-first' : ''}`}
  style={`--grid-gap:
  ${gridGap}; --col-width: ${colWidth};`}
>
  <slot />
</div>

<!--
$w: var(--col-width); // minmax(Min(20em, 100%), 1fr);
$s: var(--grid-gap); // .5em;
-->

<style>
  :global(.__grid--masonry) {
    display: grid;
    grid-template-columns: repeat(auto-fit, var(--col-width));
    grid-template-rows: masonry;
    justify-content: center;
    grid-gap: var(--grid-gap);
    padding: var(--grid-gap);
  }

  :global(.__grid--masonry) {
    transition: 250ms ease-out;
  }

  :global(.__grid--masonry.__stretch-first > *:first-child) {
    grid-column: 1/ -1;
  }
</style>
