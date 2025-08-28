<script lang="ts">
  import { Icon } from "@deta/icons";
    import type { WebContentsView } from "@deta/services/views";
    import { useLogScope } from "@deta/utils";

    let {
        view,
    }: {
        view: WebContentsView;
    } = $props();

    const log = useLogScope("SaveState");

    let isSaved = $derived(view.resourceCreatedByUser)

    async function onClick() {
        if ($isSaved) {
            log.info("Resource is already saved");
            return
        }

        log.debug("Bookmarking page");
        await view.bookmarkPage()
    }

</script>

<button onclick={onClick}>
    {#if $isSaved}
        <Icon name="bookmarkFilled" />
        Saved
    {:else}
        <Icon name="bookmark" />
        Save
    {/if}
</button>

<style lang="scss">
    button {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        background: none;
        border: none;
    }
</style>