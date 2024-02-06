import { writable } from 'svelte/store'
import type { Horizon } from '../components'

export const initDemoHorizon = (horizon : Horizon) => {
    console.log("CREATING DEMO CARDS")
    horizon.addCard({
        ...{x: 50, y: 50, width: 400, height: 200},
        type: 'text',
        data: {
            content: {"type":"doc","content":[{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"How to use Horizon"}]},{"type":"paragraph","content":[{"type":"text","text":"Horizon is a new way to experience"}]}]}
        }
    },
    false)
}



    