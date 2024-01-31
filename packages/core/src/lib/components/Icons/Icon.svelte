<script lang="ts">
   import { icons, type Icons } from './index'

    export let size = '18px';
    export let name: Icons;
</script>

<svelte:component this={icons[name]} size={size} {...$$restProps} />
