<script lang="ts">
  import { onMount } from 'svelte'
  import { getHumanDistanceToNow } from '@deta/utils'

  export let date: string | number
  export let update: boolean = true

  $: formattedDate = getHumanDistanceToNow(date)

  onMount(() => {
    if (update) {
      const interval = setInterval(() => {
        formattedDate = getHumanDistanceToNow(date)
      }, 60000) // 1 minute

      return () => {
        clearInterval(interval)
      }
    }
  })
</script>

<slot date={formattedDate}>
  <span class="date-since-now">{formattedDate}</span>
</slot>
