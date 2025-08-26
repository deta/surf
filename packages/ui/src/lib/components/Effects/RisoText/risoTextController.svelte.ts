import { Tween } from 'svelte/motion'
import type { EasingFunction } from 'svelte/transition'

interface AnimationOptions {
  start: number
  delay: number
  duration: number
  easing: EasingFunction
}

export class RisoTextController {
  t_rasterDensity?: Tween<number>
  t_rasterFill?: Tween<number>
  t_textBleed?: Tween<number>

  private rasterDensityAnimation?: AnimationOptions
  private rasterFillAnimation?: AnimationOptions
  private textbleedAnimation?: AnimationOptions

  constructor({
    rasterDensity: rasterDensityAnimation,
    rasterFill: rasterFillAnimation,
    textBleed: textBleedAnimation
  }: {
    rasterDensity?: AnimationOptions
    rasterFill?: AnimationOptions
    textBleed?: AnimationOptions
  }) {
    this.rasterDensityAnimation = rasterDensityAnimation
    this.rasterFillAnimation = rasterFillAnimation
    this.textbleedAnimation = textBleedAnimation

    if (rasterDensityAnimation) {
      this.t_rasterDensity = new Tween(rasterDensityAnimation.start, rasterDensityAnimation)
    }
    if (rasterFillAnimation) {
      this.t_rasterFill = new Tween(rasterFillAnimation.start, rasterFillAnimation)
    }
    if (textBleedAnimation) {
      this.t_textBleed = new Tween(textBleedAnimation.start, textBleedAnimation)
    }
  }

  reset() {
    this.t_rasterDensity?.set(this.rasterDensityAnimation.start, { duration: 0 })
    this.t_rasterFill?.set(this.rasterFillAnimation.start, { duration: 0 })
    this.t_textBleed?.set(this.textbleedAnimation.start, { duration: 0 })
  }
}
