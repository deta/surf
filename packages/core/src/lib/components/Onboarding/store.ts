import { writable } from 'svelte/store'
import { type Resource } from '@horizon/core/src/lib/service/resources'

function createSavedResourcesStore() {
  const { subscribe, update } = writable<Resource[]>([])

  return {
    subscribe,
    addResource: (resource: Resource) => {
      update((resources) => [...resources, resource])
    },
    addResources: (newResources: Resource[]) => {
      update((resources) => [...resources, ...newResources])
    },
    clear: () => {
      update(() => [])
    }
  }
}

export const savedResources = createSavedResourcesStore()
