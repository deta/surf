<script lang="ts">
    import { onMount } from "svelte";
    import { get, writable, type Writable } from "svelte/store";

    import { Board, Grid, createSettings, createBoard, clamp, snapToGrid } from "@horizon/tela";
    import type { IBoard, IPositionable, Vec4 } from "@horizon/tela";

    import './index.scss'

    import CardWrapper from "./CardWrapper.svelte";
    import { Horizon } from "../../service/horizon";

    export let horizon: Horizon

    const cards = horizon.cards
    const data = horizon.data
  
    const settings = createSettings({
        CAN_PAN: true,
        CAN_DRAW: true,
        CAN_ZOOM: false,
        CAN_SELECT: true,
        PAN_DIRECTION: 'x',
        SNAP_TO_GRID: true,
        GRID_SIZE: 30,
        BOUNDS: {
            minX: 0,
            minY: 0,
            maxX: 1920 * 7,
            maxY: 1080,
            maxZoom: 1,
            minZoom: 1, // todo?: Do we need to make these dynamic?
            limit: "hard"
        },
        CHUNK_WIDTH: 1920 / 4, // Should be divisible by GRID_SIZE
        CHUNK_HEIGHT: 1080 / 3, // Should be divisible by GRID_SIZE
        POSITIONABLE_KEY: 'id'
    })

    const board: IBoard<any, any> = createBoard(
        settings,
        writable([]),
        {}, "idle", {}
    )

    const state = board.state
    const selectionCss = $state.selectionCss

    let containerEl: HTMLElement

    // Responsible for the scaling of the entire Horizon on bigger screens
    const handleWindowResize = () => {
        state.update(_state => {
            _state.zoom.set(clamp(window.innerHeight / 1080, 1, Infinity))
            return _state
        })
    }

    const loadHorizon = () => {
        $state.stackingOrder.set($cards.map(e => get(e).id))
        $state.viewOffset.set({ x: $data.viewOffsetX, y: 0 })
    }

    const onModSelectEnd = (
        e: CustomEvent<{
            event: MouseEvent
            rect: Vec4
        }>
    ) => {
        const { rect } = e.detail
        let pos = { x: rect.x, y: rect.y }
        let size = { x: rect.w, y: rect.h }
        // Snap
        pos.x = $settings.SNAP_TO_GRID
        ? snapToGrid(pos.x, $settings.GRID_SIZE!)
        : pos.x
        pos.y = $settings.SNAP_TO_GRID
        ? snapToGrid(pos.y, $settings.GRID_SIZE!)
        : pos.y
        size.x = $settings.SNAP_TO_GRID
        ? snapToGrid(size.x, $settings.GRID_SIZE!)
        : size.x
        size.y = $settings.SNAP_TO_GRID
        ? snapToGrid(size.y, $settings.GRID_SIZE!)
        : size.y

        if (size.x < 90 || size.y < 90) {
            return
            // if (!e.detail.event.shiftKey) return
            pos = {
                x: pos.x - 90,
                y: pos.y - 90,
            }
            size = {
                x: 180,
                y: 180,
            }
        }

        horizon.addCard({
            x: pos.x,
            y: pos.y,
            width: size.x,
            height: size.y,
            data: {
                title: "Google",
                src: "https://google.com"
            }
        })

        $state.stackingOrder.set($cards.map(e => get(e).id))
    }

    // TODO fix types to get rid of this type conversion
    $: positionables = cards as unknown as Writable<Writable<IPositionable<any>>[]>

    onMount(() => {
        loadHorizon()
        handleWindowResize()
    })
    
</script>

<svelte:window on:resize={handleWindowResize} />

<div data-horizon={horizon.id} class="horizon">
    <Board
        {settings}
        {board}
        positionables={positionables}
        on:modSelectEnd={onModSelectEnd}
        bind:containerEl
        let:positionable
    >
        <svelte:fragment slot="selectRect">
            <div class="selectionRect" style={$selectionCss} />
        </svelte:fragment>

        <svelte:fragment slot="raw">
            <Grid dotColor="var(--color-text)" dotSize={1} dotOpacity={20} />
        </svelte:fragment>

        <CardWrapper {positionable} />
    </Board>
</div>
