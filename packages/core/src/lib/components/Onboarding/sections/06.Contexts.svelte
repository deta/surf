<script lang="ts">
  import { Icon } from '@horizon/icons'

  // Create a helper array for the repeated elements
  const contextCards = Array(3)
  const gridItems = Array(4)
</script>

<section class="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
  <h1
    class="font-gambarino text-3xl md:text-5xl text-center text-black mb-12 md:mb-24 [text-shadow:0_1px_2px_rgba(0,0,0,0.05)]"
  >
    Use Multiple<br />Contexts
  </h1>

  <div class="flex flex-col md:flex-row gap-8 justify-center w-full max-w-7xl px-4 md:px-8">
    {#each contextCards as _}
      <div class="flex-1 bg-gray-100/90 backdrop-blur-sm rounded-3xl p-4 md:p-6 shadow-lg max-w-md">
        <div class="flex items-center gap-3 mb-4 md:mb-6">
          <div class="w-3 h-3 rounded-full bg-gray-200" />
          <div class="h-2 w-32 md:w-48 bg-gray-200 rounded-full" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          {#each gridItems as _}
            <div class="aspect-square bg-white rounded-lg shadow-sm" />
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>
