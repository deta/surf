<svelte:options accessors={true} />

<script context="module" lang="ts">
    import type { Editor } from '@tiptap/core';

    export type Item = {
        icon: string
        title: string
        command: (props: { editor: Editor, range: any }) => void
    }
    
</script>

<script lang="ts">
  import Icon from "../../icons/Icon.svelte";

    export let editor: Editor
    export let range: any
    export let items: Item[] = [];

    let selectedIndex = 0;
    let elements: HTMLElement[] = [];

    $: {
        if (elements[0] != null) {
        elements[selectedIndex]?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
        });
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex = (selectedIndex + items.length - 1) % items.length;
            return true;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            return true;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            const item = items[selectedIndex];

            if (item) {
                item.command({ editor, range });
            }
            return true;
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="slash-container">
    <div class="slash-header">Select element to insert:</div>
    <div
        class="slash-list"
        tabindex="-1"
        role="listbox"
        aria-labelledby="slash-command-menu"
        aria-activedescendant="listbox-option-0"
    >
        {#each items as { icon, title, command }, i}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
                class="slash-item {i == selectedIndex ? 'slash-item-selected' : ''}"
                id="listbox-option-0"
                on:mouseenter={() => (selectedIndex = i)}
                on:click={() => {
                    command({ editor, range });
                }}
                bind:this={elements[i]}
            >
                <div class="slash-item-icon">
                    <Icon name={icon} size="22px" />
                </div>
                <p class="slash-item-title">{title}</p>
                <!-- <div class="slash-item-content">
                    <p class="slash-item-subtitle">{subtitle}</p>
                </div> -->
            </div>
        {/each}
        </div>
</div>

<style>
    .slash-container {
        border: 1px solid var(--background-menu-muted);
        background: var(--background-menu);
        color: var(--color-menu);
        box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
        width: 24rem;
        max-width: 100%;
        border-radius: 0.5rem;
        overflow-x: hidden;
        overflow-y: auto;
        z-index: 50;
    }

    .slash-header {
        color: var(--color-text-muted);
        font-size: 0.85rem;
        padding: 0.25rem;
    }

    .slash-list {
        overflow: hidden;
        outline: none;
    }

    .slash-item {
        color: var(--color-menu);
        user-select: none;
        padding: 0.25rem;
        font-size: 0.875rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .slash-item:hover {
        background-color: var(--background-menu-muted);
    }

    .slash-item-selected {
        background-color: var(--background-menu-muted);
    }

    .slash-item-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-menu-muted);
    }

    .slash-item-title {
        font-weight: normal;
        margin: 0;
    }
</style>