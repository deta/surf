<script lang="ts">
  import { writable } from "svelte/store";
  import TabList from "./TabList.svelte";
  import Desktop from "./Desktop.svelte";

  const tabs = writable([
    {
      id: crypto.randomUUID(),
      title: "YouTube – How to make a nor...",
      icon: "https://www.youtube.com/s/desktop/86d8f362/img/favicon_96x96.png"
    }
  ]);
  const cards = writable([]);

  function addTab() {
    const exampleTabs = [
      {
        id: crypto.randomUUID(),
        title: "Google",
        icon: "https://www.google.com/favicon.ico"
      },
      {
        id: crypto.randomUUID(),
        title: "Twitter — Cool Tweet",
        icon: "https://abs.twimg.com/favicons/twitter.3.ico"
      },
      {
        id: crypto.randomUUID(),
        title: "Hackernews",
        icon: "https://news.ycombinator.com/y18.svg"
      },
      {
        id: crypto.randomUUID(),
        title: "Deta",
        icon: "https://deta.space/landing-page/static/favicons/favicon.ico"
      },
      {
        id: crypto.randomUUID(),
        title: "Reddit – r/dankMemes",
        icon: "https://www.redditstatic.com/desktop2x/img/favicon/favicon-96x96.png"
      },
      {
        id: crypto.randomUUID(),
        title: "GitHub – sveltejs/svelte",
        icon: "https://github.githubassets.com/favicons/favicon.svg"
      },
      {
        id: crypto.randomUUID(),
        title: "Stack Overflow",
        icon: "https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico"
      },
      {
        id: crypto.randomUUID(),
        title: "Wikipedia – Personal Computer",
        icon: "https://en.wikipedia.org/static/favicon/wikipedia.ico"
      },
      {
        id: crypto.randomUUID(),
        title: "Amazon",
        icon: "https://www.amazon.com/favicon.ico"
      },
      {
        id: crypto.randomUUID(),
        title: "Facebook",
        icon: "https://www.facebook.com/favicon.ico"
      },
      {
        id: crypto.randomUUID(),
        title: "Instagram",
        icon: "https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png"
      },
      {
        id: crypto.randomUUID(),
        title: "LinkedIn",
        icon: "https://static-exp1.licdn.com/sc/h/1bt1uwq5akv756knzdj4l6cdc"
      },
      {
        id: crypto.randomUUID(),
        title: "Twitch – Live Streams",
        icon: "https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png"
      }
    ];
    const randomTab = exampleTabs[Math.floor(Math.random() * exampleTabs.length)];
    randomTab.id = crypto.randomUUID();
    tabs.update((t) => [...t, randomTab]);
  }
</script>

<main>
  <aside>
    <span style="display: flex;align-items: center;"
      ><h1>Tabs</h1>
      <button on:click={addTab}>+</button></span
    >

    <TabList {tabs} />
  </aside>

  <Desktop />
</main>

<style lang="scss">
  :global(body) {
    margin: 0;
    padding: 0;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Oxygen,
      Ubuntu,
      Cantarell,
      "Open Sans",
      "Helvetica Neue",
      sans-serif;
  }
  main {
    display: flex;
    min-height: 100vh;
  }
  aside {
    width: 100%;
    max-width: 30ch;
    background: rgba(247, 247, 247, 1);
    padding-inline: 1rem;
    display: flex;
    flex-direction: column;
    padding-bottom: 3rem;

    > span {
      h1 {
        flex: 1;
      }
      button {
        background: transparent;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        aspect-ratio: 1 / 1;
        border-radius: 5px;
        padding-inline: 0.5rem;

        &:hover {
          background: rgba(0, 0, 0, 0.08);
        }
      }
    }
  }
</style>
