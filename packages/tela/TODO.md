# Features

- [ ] Board
  - [ ] Configuration
    - [ ] Modes
      - [ ] Dragging
      - [ ] Selecting
      - [ ] Pan
      - [X] Zoom
    - [ ] Bounds
      - [ ] Offset
      - [ ] Zoom
      - [ ] Limit ("hard" / "soft")
    - [ ] Grid Snap
      - [ ] Snapping
      - [ ] Snapping Size
    - [ ] Culling
    - [ ] Cull margin
    - [ ] Dev
      - [ ] Dev Pos
      - [ ] Dev Mode
  - [ ] Implementation
    - [ ] Modes & Events
      - [ ] Mode changes emit better events
    - [ ] Bounds
    - [ ] Respect parent container boundingRect

- [X]] Background Grid
  - [X] Configuration
    - [X] dotColor
    - [X] dotOpacity
    - [X] dotSize
    - [X] gridSize -> always linked to board

- [ ] Positionable
  - [ ] Configuration
    - [ ] SnapToGrid override
    - [ ] Cull override
  - [ ] Implementation
    - [X] Update position
    - [ ] Respect bounds (maybe damp out of bound return dep on cfg)
    - [ ]

- [ ] Draggable
  - [ ] Events -> Rethink them & usefullness / cancelability

- [ ] Resizable -> Maybe turn into ResizeHandle -> + direction cfg
  - [ ] Configurability
    - [ ] Min/Max width/height
  - [ ] Support all directions

- [ ] Optimizations
  - [ ] Position updates if snapping to grid
  - [ ] Make culling work correctly

- !! have GPU accelerated option using transform3d
- ! make element list a board prop, expose TPositionable array type & each block slot inside for declaring elements

- Add full touch support
- Extract default styling to importable css (mode cursors etc)
- Auto pan board when dragging to the edge



# Bugs / Missing

- [ ] Zooming fcks up mouse click events -> positions are wrong
- [ ] When board is not full window, click & drag calculations are wrong
- [ ] Touchscreens not working

- Add some sort of click event hijacking and adjust cursor to scaled position
- ON bounded -> window resize -> fix view jump
- fix scrolling trackpag nested scrolls
- when not fullscreen, window.innerwidth does not apply --> Replace with getting parent bounding box

importing into ohe
"exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./dist/index.js"
    }
  },