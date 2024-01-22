<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
import {
    Draggable,
    Positionable,
    Resizable,
    type IPositionable,
} from '@horizon/tela'
import { type Writable } from 'svelte/store'
import type { Card } from '../../types';
import { createEventDispatcher, onDestroy, onMount } from 'svelte';

export let positionable: Writable<IPositionable<any>>

$: card = $positionable as unknown as Card

const dispatch = createEventDispatcher<{ change: void, load: void }>()

const minSize = { x: 100, y: 100 }
const maxSize = { x: Infinity, y: Infinity }
    
let el: HTMLElement
let webview: HTMLIFrameElement

const getHostname = (text: string) => {
    try {
        const url = new URL(text)
        return url.hostname
    } catch (e) {
        return text
    }
}

const updateCard = () => {
    console.log('updateCard', card)
    // horizon.updateCard($card)
    dispatch('change')
}

const handleDragEnd = (e: any) => {
    updateCard()
}

$: title = card.data.title
$: hostname = getHostname(card.data.src)

onMount(() => {
    // el.addEventListener('draggable_start', onDragStart)
    // el.addEventListener('draggable_move', onDragMove)
    el.addEventListener('draggable_end', handleDragEnd)
    el.addEventListener('resizable_end', updateCard)

    webview.src = card.data.src

    webview.addEventListener('did-navigate', (e: any) => {
        card.data.src = e.url
    })

    webview.addEventListener('page-title-updated', (e: any) => {
        card.data.title = e.title
    })

    webview.addEventListener('did-finish-load', (e: any) => {
       dispatch('load')
    })
})

onDestroy(() => {
    // el && el.addEventListener('draggable_start', onDragStart)
    // el && el.addEventListener('draggable_move', onDragMove)
    el && el.removeEventListener('draggable_end', handleDragEnd)
    el && el.removeEventListener('resizable_end', updateCard)
})
</script>
  
<Positionable
    positionable={positionable}
    data-id={$positionable.id}
    class="card {$positionable.id}"
    contained={false}
    bind:el
  >
    <Resizable positionable={positionable} direction="top-right" {minSize} {maxSize} />
    <Resizable positionable={positionable} direction="top-left" {minSize} {maxSize} />
    <Resizable positionable={positionable} direction="bottom-right" {minSize} {maxSize} />
    <Resizable positionable={positionable} direction="bottom-left" {minSize} {maxSize} />
  
    <Draggable
        positionable={positionable}
        class=""
    >
        <div class="top-bar">
            <div>{title}</div>
            <div>{hostname}</div>
        </div>
    </Draggable>

    <div class="content tela-ignore">
        <webview bind:this={webview} src="" partition="persist:horizon" frameborder="0"></webview>
    </div>
</Positionable>

<style>
    webview {
      user-select: none;
      width: 100%;
      height: 100%;
    }
  </style>
  