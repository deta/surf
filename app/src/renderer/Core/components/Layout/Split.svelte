<script lang="ts">
    import { type Snippet } from "svelte"

    let { left, right }: { left?: Snippet; right?: Snippet } = $props();
</script>

<div class="wrapper">
    <div class="side left">
        {@render left?.()}
    </div>

    <div class="side right">
        {@render right?.()}
    </div>
</div>

<style>
    .wrapper {
        display: flex;
        width: 100%;
        height: 100%;
    }

    .side {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .left {
        border-right: 1px solid var(--border-color);
    }

    .right {
        border-left: 1px solid var(--border-color);
    }
</style>