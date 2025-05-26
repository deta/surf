<script lang="ts">
  import type { Resource } from '../../service/resources'
  import LazyComponent from '../Atoms/LazyComponent.svelte'

  export let resource: Resource
</script>

<LazyComponent this={() => import('../Resources/ResourcePreview.svelte')}>
  <svelte:fragment slot="component" let:Component>
    <Component
      {resource}
      mode="compact"
      viewMode="responsive"
      interactive={false}
      frameless
      draggable
      titleEditable={false}
      origin="cmdt"
    ></Component>
  </svelte:fragment>
</LazyComponent>
