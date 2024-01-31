<script lang="ts">
    import type { Resource } from "../../../types"

    export let resource: Resource

    const blob = resource.data
    const url = URL.createObjectURL(blob)
</script>

<div class="wrapper">
    <img src={url} alt="" />
</div>

<style>
    .wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        user-select: none;
    }
</style>