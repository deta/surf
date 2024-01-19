<script lang="ts">
  import Board, { createBoard, createSettings } from "$lib/Board.svelte";
  import type { Vec4 } from "$lib/types/Utils.type.js";
  import { rectsIntersect } from "$lib/utils.js";
  import { get, writable, type Writable } from "svelte/store";
  import "$lib/tela.css";
  import LazyComponent from "./LazyComponent.svelte";
  import type { IPositionable } from "$lib/Positionable.svelte";
  import Grid from "$lib/Grid.svelte";
  import Card from "./Card.svelte";

  interface ICard {
    key: string;
    pos_x: number;
    pos_y: number;
    width: number;
    height: number;
    positionable: Writable<IPositionable<"key">>;
  }

  let stackingOrder = writable<string[]>([]);
  let cards: Writable<Writable<IPositionable<"key">>[]> = writable(
    Array.from({ length: 5000 }, (_, i) => {
      let x = {
        key: crypto.randomUUID() + i,
        x: Math.random() * 12000,
        y: Math.random() * 12000,
        // x: i * 510,
        // y: 250,
        // y: 20,
        width: 240,
        height: 100,
        hoisted: false
      };
      let p = writable(x);
      // return {
      //   ...x, positionable: p
      // }
      return p;
    })
  );
  stackingOrder.update((_o) => {
    get(cards).forEach((c) => {
      let _c = get(c);
      _o.push(_c.key);
    });
    return _o;
  });

  // Tela Handlers
  function onMetaSelectEnd(e: CustomEvent<{ rect: Vec4 }>) {
    const { rect } = e.detail;
    cards.update((_cards) => {
      _cards.push(
        writable({
          key: crypto.randomUUID(),
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          z: 0
        })
      );
      return _cards;
    });
  }

  const settings = createSettings({
    // PAN_DIRECTION: "x",
    DEV: true,
    SNAP_TO_GRID: true,
    GRID_SIZE: 30,
    CHUNK_WIDTH: 300,
    CHUNK_HEIGHT: 300,
  });
  const board = createBoard(settings, stackingOrder, {}, "idle", {
    idle: { select: "select", pan: "pan" },
    pan: { idle: "idle" },
    select: { idle: "idle" },
    metaSelect: { idle: "idle" }
  });

  let state = board.state;
  $: ({ selectionCss } = $state);
  state.update(v => {
    v.stackingOrder.set(get(stackingOrder));
    return v;
  })

  function onDelete(e: any) {
    const key = e.detail;
    cards.update(_cards => {
        const index = _cards.findIndex(e => get(e).key === key)
        if (index !== -1) {
          _cards.splice(index, 1)
        }
        return _cards
      })
  }

  // let lazyCard = () => import("./Card.svelte").then((m) => m.default);
</script>

<main>
  <Board
    {board}
    {settings}
    {stackingOrder}
    positionables={cards}
    let:positionable
    on:metaSelectChange={() => {}}
    on:metaSelectEnd={onMetaSelectEnd}
    on:draggableChanged={() => console.log("draggableChanged")}
    on:resizableChanged={() => console.log("resizableChanged")}
    on:positionableLeave={(e) => console.log("positionableLeave", e.detail)}
    on:positionableEnter={(e) => console.log("positionableEnter", e.detail)}
  >
    <svelte:fragment slot="selectRect">
      <div class="selectionRect" style={$selectionCss} />
    </svelte:fragment>

    <svelte:fragment slot="raw">
      <Grid />
    </svelte:fragment>

    <LazyComponent this={() => import("./Card.svelte")}>
      <svelte:fragment slot="component" let:Component>
        <Component card={positionable} on:delete={onDelete}/>
      </svelte:fragment>
    </LazyComponent>

    <!-- <svelte:fragment> -->
    <!-- <Positionable {positionable}> -->
    <!-- card {get(positionable).key}
        <input type="range" min="0" max="2000" />
        <textarea rows="3"></textarea>
        <br>
        <div contenteditable="true">fio bar test asf</div>-->
    <!-- </Positionable> -->
    <!-- </svelte:fragment> -->

    <!-- {#each visibleCards as card, i (get(card).key)}
      <LazyComponent this={() => import("./Card.svelte")}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} />
        </svelte:fragment>
      </LazyComponent> -->

    <!-- visible={isInsideViewport(card.pos_x, card.pos_y, card.width, card.height, $viewX, $viewY, viewPort, $zoom, 0)} -->
    <!-- <Positionable key={card.key} x={card.pos_x} y={card.pos_y} width={card.width} height={card.height}>
      <Draggable key={card.key} bind:x={card.pos_x} bind:y={card.pos_y} width={card.width} height={card.height}/>
      card {i}
      <input type="range" min="0" max="2000" />
    </Positionable> -->
    <!-- {@const c = get(card)} -->
    <!-- <svelte:component this={lazyCard} positionable={card}> -->
    <!-- <Resizable
          positionable={card}
          direction="top"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        />
        <Resizable
          positionable={card}
          direction="right"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        />
        <Resizable
          positionable={card}
          direction="bottom"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        />
        <Resizable
          positionable={card}
          direction="left"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        />
        <Resizable
          positionable={card}
          direction="top-right"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        />
        <Resizable
          positionable={card}
          direction="top-left"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        />
        <Resizable
          positionable={card}
          direction="bottom-right"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        />
        <Resizable
          positionable={card}
          direction="bottom-left"
          on:mousedown={onDragMouseDown}
          on:mousemove={onDragMouseUp}
        /> -->
    <!-- <Draggable positionable={card}>
          card {i}
          <input type="range" min="0" max="2000" />
          <textarea rows="3" />
          <br />
          <div contenteditable="true">fio bar test asf</div>
        </Draggable>
      </svelte:component> -->
    <!-- <Positionable positionable={card}>
        card {i}
        <input type="range" min="0" max="2000" />
        <textarea rows="3"></textarea>
        <br>
        <div contenteditable="true">fio bar test asf</div>
    </Positionable> -->
    <!-- <LazyCard component={Positionable} positionable={card}>
        card {i}
        <input type="range" min="0" max="2000" />
        <textarea rows="3"></textarea>
        <br>
        <div contenteditable="true">fio bar test asf</div>
    </LazyCard>-->
    <!-- {/each} -->
  </Board>
</main>

<style>
  main {
    width: 100%;
    height: 100vh;
  }
  :global(.positionable) {
    background: rgb(98, 95, 112);
    border: 1px solid rgba(52, 34, 132, 0.793);
  }
  :global(.draggable) {
    background: rgba(54, 93, 221, 0.2);
    padding: 10px;
    width: 100%;
    height: 100%;
    /*position: absolute;
    top: 0;
    left: 0; */
  }
  .selectionRect {
    position: absolute;
    background: rgba(46, 96, 234, 0.372);
  }
  :global(.positionable) {
    border: 4px solid green;
  }
  :global(.positionable.selected) {
    border: 4px solid red;
  }
  :global(.resizable) {
    /* background: lime; */
    width: 25px;
    height: 25px;
    position: absolute;
    z-index: 300;
  }
  :global(.resizable.top-right) {
    top: -10px;
    right: -10px;
  }
  :global(.resizable.top-left) {
    top: -10px;
    left: -10px;
  }
  :global(.resizable.bottom-right) {
    bottom: -10px;
    right: -10px;
  }
  :global(.resizable.bottom-left) {
    bottom: -10px;
    left: -10px;
  }
  :global(.resizable.top) {
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
  }
  :global(.resizable.right) {
    top: 50%;
    right: -10px;
    transform: translateY(-50%);
  }
  :global(.resizable.bottom) {
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
  }
  :global(.resizable.left) {
    top: 50%;
    left: -10px;
    transform: translateY(-50%);
  }
</style>
