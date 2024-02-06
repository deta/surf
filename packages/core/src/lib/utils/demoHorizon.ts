import { writable } from 'svelte/store'
import type { Horizon } from '../components'

export const initDemoHorizon = (horizon : Horizon) => {
    console.log("CREATING DEMO CARDS")
    horizon.addCard({
        ...{x: 0, y: 0},
        type: 'text',
        data: {
            content: 'degna'
        }
    },
    false)
}
    