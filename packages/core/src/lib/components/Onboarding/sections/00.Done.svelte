<script lang="ts">
  import { Icon } from '@horizon/icons'

  export let modShortcut: string
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center relative z-10 p-4 md:p-8 lg:p-32"
>
  <div class="flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto px-4">
    <h1
      class="font-gambarino text-3xl md:text-5xl text-center text-white leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
    >
      You're all set!
    </h1>
    <p class="text-lg md:text-xl text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.05)]">
      Here are some helpful resources to get the most out of Surf:
    </p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
      <div class="bg-white p-4 md:p-6 rounded-xl shadow-lg border border-gray-100">
        <h3 class="font-bold text-lg mb-2">Quick Reference</h3>
        <ul class="space-y-2">
          <li><span class="text-gray-600">{modShortcut} + O</span> - Open Stuff</li>
          <li><span class="text-gray-600">{modShortcut} + Shift + 1</span> - Vision</li>
          <li>
            <a
              href="https://deta.notion.site/Shortcuts-10ca5244a71780a7ae1aee4b51fab009"
              target="_blank"
              class="text-blue-500 hover:underline"
            >
              View all Shortcuts
            </a>
          </li>
        </ul>
      </div>
      <div class="bg-white p-4 md:p-6 rounded-xl shadow-lg border border-gray-100">
        <h3 class="font-bold text-lg mb-2">Community & Support</h3>
        <ul class="space-y-2">
          <li>
            <a
              href="https://deta.surf/discord"
              target="_blank"
              class="text-blue-500 hover:underline"
            >
              Join Discord
            </a>
          </li>
          <li>
            <a
              href="https://deta.notion.site/Surf-Zero-e9c49ddf02a8476fb3c53b7efdc7e0fd"
              target="_blank"
              class="text-blue-500 hover:underline"
            >
              Documentation
            </a>
          </li>
          <li>support@deta.surf</li>
        </ul>
      </div>
    </div>
  </div>
</section>
