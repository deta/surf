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
import { onMount } from 'svelte';

export let positionable: Writable<IPositionable<any>>

$: card = $positionable as unknown as Card

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

$: title = card.data.title
$: hostname = getHostname(card.data.src)

onMount(() => {
    webview.src = card.data.src

    webview.addEventListener('did-navigate', (e: any) => {
        card.data.src = e.url
    })

    webview.addEventListener('page-title-updated', (e: any) => {
        card.data.title = e.title
    })
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
  