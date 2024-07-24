<script lang="ts">
  import { DragItem } from "$lib/index.ts";

  export let tab: {
    id: string;
    title: string;
    icon: string;
  };

  let draggable = true;
</script>

<div
  class="pinned-tab"
  {draggable}
  dragpreview="hoist"
  simulatedragstart="true"
  use:DragItem.action={{ id: tab.id, data: { "test/tab": tab } }}
  style:view-transition-name="tab-{tab.id}"
>
  <img src={tab.icon} alt="" />
</div>

<style lang="scss">
  .pinned-tab {
    width: auto;
    max-width: 30px;
    background: transparent;
    aspect-ratio: 1 / 1;
    display: flex;
    font-size: 0.6em;
    align-items: center;
    padding: 0.2rem 0.2rem;
    border-radius: 13px;
    user-select: none;

    > img {
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
    }

    transition: background 0.12s ease-out;
    &:hover {
      background: rgba(228, 228, 228, 0.9);
    }
  }
</style>
