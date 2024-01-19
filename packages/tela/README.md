<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/deta/tela">
    <img src="https://github.com/MaximilianHeidenreich/PingBack/blob/main/assets/logo/v2_pingback-logo_deta@1024.png?raw=true" alt="PingBack Logo" width="80" height="80">
  </a>

<h1 align="center"><i>Tela</i></h1>

<p align="center">
    A declarative, easy to use, infinite canvas library for svelte.
    <br />
    <a href="https://github.com/deta/tela"><strong>Demo</strong></a> • <a href="https://deta.github.io/tela/?path=/docs/get-started--docs"><strong>Documentation</strong></a>
    <br />
    <br />
    <a href="https://github.com/deta/tela/issues">Report Bug</a>
    ·
    <a href="https://github.com/deta/tela">Contribute</a>
  </p>
</p>

<br><br>

<!-- ABOUT THE PROJECT -->

## ⚡️ TL;DR

Tela is a declarative svelte library for creating infinite canvases, positioning elements on them, and handling all canvas related logic like moving elements, dragging, panning etc.

To get started, follow the steps below or checkout the [examples](src/routes/examples) under `/src/routes/examples` to see how tela integrates in a real app.

## Getting Started

Add the package to your project:

```bash
npm i @deta/tela

pnpm i @∂eta/tela

yarn add @deta/tela
```

Import the components & setup the board data:

```html
<script lang="ts">
  import Board from "$lib/Board.svelte";
  import Positionable from "$lib/Positionable.svelte";
  import type { TBoard, TBoardSettings } from "$lib/index.js";
  import { writable } from "svelte/store";

  const settings = writable({} satisfies TBoardSettings);
  const board = writable({} satisfies TBoard);
</script>
```

Create a fullscreen board & place some items on it:

```html
<main>
  <Board {settings} {board}>
    <Positionable pos={{ x: 10, y: 10 }} size={{ x: 400, y: 300 }} z={1}>
      Hello, I am tela.
    </Positionable>

    <Positionable pos={{ x: 200, y: 150 }} size={{ x: 400, y: 300 }} z={1}>
      Try moving the canvas around with the trackpad or by using META + Left Mouse.
    </Positionable>
  </Board>
</main>

<style>
  main {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
```

## Components

### Board

The board is the main component of tela. It is the container for all other components and handles all the logic for panning, zooming etc. It can be configured using the settings prop, and exposes a board prop, which contains all the information about the current state of the board like the zoom factor or the view offset.

To get a board up and running you need to create two writable stores which will be passed into the board. They can be empty to use the defaults or already provide a state to the board. This can be used to save the state of the board to local storage or in a database so that the user can continue where they left off.

In this example we also wrap the board in an element that takes up the whole screen, but it would also be possible to just embedd the board in the normal flow of a html page.

> 💡 The board itself does not have a set dimensions. It tries to take up 100% of the available height & width. If you don't see your board, try setting a specific height on its container element.

```html
<script lang="ts">
  import Board from "$lib/Board.svelte";
  import Positionable from "$lib/Positionable.svelte";
  import type { TBoard, TBoardSettings } from "$lib/index.js";
  import { writable } from "svelte/store";

  const settings = writable({} satisfies TBoardSettings); // <- used to configure the board
  const board = writable({ viewOffset: { x: 0, y: 0 }, zoom: 1 } satisfies TBoard); // <- determines the initial state of the board
</script>

<main>
  <Board {settings} {board}> </Board>
</main>

<style>
  main {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
```

#### Board Props

##### `settings`

```ts
{
  // Whether users can draw on the board.
  CAN_DRAW?: boolean;
  // Whether users can select on the board.
  CAN_SELECT?: boolean;
  // Whether users can pan the board manually.
  CAN_PAN?: boolean;
  // Whether users can zoom.
  CAN_ZOOM?: boolean;

  // Whether Positionables should snap to the grid.
  SNAP_TO_GRID?: boolean;
  // Grid size for snapping
  GRID_SIZE?: number;

  BOUNDS?: {
    // null: no boundary | n: boundary at n
    minX: number | null;
    // null: no boundary | n: boundary at n
    maxX: number | null;
    // null: no boundary | n: boundary at n
    minY: number | null;
    // null: no boundary | n: boundary at n
    maxY: number | null;
    // null: minZoom = 0 | n: minZoom at n
    minZoom: number | null;
    // null: maxZoom = 0 | n: maxZoom at n
    maxZoom: number | null;
    // hard: movement will be blocked past boundary | soft: movement will be allowed past boundary, but position will be snapped to boundary on end of drag
    limit: "hard" | "soft";
  };

  // Whether to only render positionables in viewport (set to false if you have issue with component lifecycle)
  CULL?: boolean;
  // Margin around viewport to make panning smooth
  CULL_MARGIN?: number;

  // Dev / debug overlays
  DEV: {
    SHOW_POS: boolean;
    SHOW_MODE: boolean;
  };
}
```

##### `board`

Initial state of the board.

```ts
{
  // X, Y offset on the board
  viewOffset: Vec2;
  // Size -> Currently mostly irreleant
  viewSize: Vec2;
  // Store viewport position in case container el is not full window
  viewPort: Vec4;
  // Current zoom factor
  zoom: number;
}
```

### Positionable

Any element placed on the board must be wrapped in a Positionable component. This component handles the positioning of the element on the board whilst panning and zooming.

The example below illustrates how a Positionable component can be used to place an element on the board:

```html
<script lang="ts">
  import Board from "$lib/Board.svelte";
  import Positionable from "$lib/Positionable.svelte";
  import type { TBoard, TBoardSettings } from "$lib/index.js";
  import { writable } from "svelte/store";

  const settings = writable({} satisfies TBoardSettings); // <- used to configure the board
  const board = writable({ viewOffset: { x: 0, y: 0 }, zoom: 1 } satisfies TBoard); // <- determines the initial state of the board
</script>

<main>
  <Board {settings} {board}>
    <Positionable pos={{ x: 0, y: 0 }} size={{ x: 0, y: 0}} z={1}>
      I am a positionable element.
    </Positionable>
  </Board>
</main>

<style>
  main {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
```

If you want to dynamically render multiple elements on the board, you can simply store their state in some array and use svelte's each directive:

```html
<script lang="ts">
  import Board from "$lib/Board.svelte";
  import Positionable from "$lib/Positionable.svelte";
  import type { TBoard, TBoardSettings } from "$lib/index.js";
  import { writable } from "svelte/store";

  const settings = writable({} satisfies TBoardSettings); // <- used to configure the board
  const board = writable({ viewOffset: { x: 0, y: 0 }, zoom: 1 } satisfies TBoard); // <- determines the initial state of the board

  const elements: { pos: { x: number, y: number }, size: { x: number, y: number} }[] = [
    { pos: { x: 0, y: 0 }, size: { x: 150, y: 150} },
    { pos: { x: 400, y: 400 }, size: { x: 400, y: 300} }
  ];
</script>

<main>
  <Board {settings} {board}>
    {#each elements as element}
      <Positionable pos={element.pos} size={element.size} z={1}>
        I am a positionable element.
      </Positionable>
    {/each}
  </Board>
</main>

<style>
  main {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
```

### Draggable

A draggable element can be used inside of a Positionable element to enable moving it around the board:

> 💡 Notice, that we need to use the bind: directive for the pos & size props, as the changes handled inside the Draggable component need to be applied to the state of the Positionable component as well.

```html
<script lang="ts">
  import Board from "$lib/Board.svelte";
  import Positionable from "$lib/Positionable.svelte";
  import Draggable from "$lib/Draggable.svelte";
  import type { TBoard, TBoardSettings } from "$lib/index.js";
  import { writable } from "svelte/store";

  const settings = writable({} satisfies TBoardSettings); // <- used to configure the board
  const board = writable({ viewOffset: { x: 0, y: 0 }, zoom: 1 } satisfies TBoard); // <- determines the initial state of the board

  const element = { pos: { x: 0, y: 0 }, size: { x: 150, y: 150} };
</script>

<main>
  <Board {settings} {board}>
    <Positionable pos={element.pos} size={element.size} z={1}>
      <Draggable bind:pos={element.pos} bind:size={element.size}>
      drag here.
      </Draggable>
      I am a positionable element.
    </Positionable>
  </Board>
</main>

<style>
  main {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
```

### Resizable

todo

### Grid

The Grid component can be placed inside a board to display an infinite background grid. Just place the Grid component inside a Board component and use the props to adjust the stlying.

> 💡 The grid gap itself is derived from the board's GRID_SIZE setting.

```html
...
<Board ...>
  <Grid dotColor="black" dotOpacity={30} dotSize={1}/>
</Board>
...
```

#### Grid Props
- `dotColor`: string    | css color for dots.
- `dotOpacity`: number  | opacity (0-100)
- `dotSize`: number     | size

## Styling

Styling tela components can be done in 3 different ways (example code below):

1. Style the default tela class (e.g. `.positionable` for positionable elements).
2. Add a custom class to the element and style it in the css style block.
3. Add inline styles to the element.

> 💡 If you are using classes for styling, make sure to either use the `:global(.yourClassName) {}` selector or an external stylesheet. Otherwise, the styles will be scoped to your component and will not be applied to the actual tela element underneath.

Tela also provides a default stylesheet which you can import into your project. This stylesheet contains some sensible default like mouse cursors indicating the current mode, or the selection rectangle.
You can use this stylesheet by importing it into your svelte file (todo: adjust path):

```html
<script>
  import "@deta/tela/dist/tela.css";
  ...
</script>
```

### Global classes

Tela adds a few default classes to its elements, so you can start styling them right away. These classes are:

- `tela-container`: The container element of a board.
- `board`: The board element inside the container.
- `positionable`: A positionable element inside the board.
- `draggable`: A draggable element inside the board.
- `resizable`: A resizable element inside the board.

- `selection-rect`: the rectangle beeing drawn whilst dragging in the `draw` or `selecting` mode.

Some additional classes are added to the body, which can be used to apply styling depending on the current state (e.g. mouse cursor). These are:

- `body.drawing`
- `body.panning`
- `body.selecting`

View the [Styling example](/todo) for a complete example.
