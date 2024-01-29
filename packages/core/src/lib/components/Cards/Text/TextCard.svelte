<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { writable, type Writable } from "svelte/store"

    import type { CardEvents, CardText } from "../../../types"
    import { useLogScope } from "../../../utils/log"

    export let card: Writable<CardText>

    const dispatch = createEventDispatcher<CardEvents>()
    const log = useLogScope('BrowserCard')

    const value = writable($card.data.content)

    const updateCard = () => {
        log.debug('updateCard', $card)
        dispatch('change', $card)
    }

    value.subscribe((value) => {
        $card.data.content = value
        updateCard()
    })
</script>

<div class="text-card">
    <textarea bind:value={$value} placeholder="jot something down"></textarea>
</div>

<style lang="scss">
    .text-card {
        width: 100%;
        height: 100%;

        textarea {
            width: 100%;
            height: 100%;
            border: none;
            outline: none;
            resize: none;
            padding: 0.5rem;
            font-size: 1rem;
            font-family: inherit;
            background: transparent;
            color: inherit;
        }
    }
</style>