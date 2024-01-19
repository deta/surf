import type { IPositionable } from "@deta/tela"

export interface Card extends IPositionable<'id'> {
    id: string
    stacking_order: number
    data: {
        title: string
        src: string
    }
}
