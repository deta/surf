export interface MotionConfig {
  direction: 'up' | 'down' | 'left' | 'right'
  type: 'in' | 'out'
  scrollStart: number
  scrollRange: number
  initialOffset: number
  movePercentage: number
  scaleRange?: number
  scalePercentage?: number
  opacityRange?: number
}

export class Motion {
  private config: MotionConfig
  private ticking: boolean = false

  constructor(config: MotionConfig) {
    this.config = config
  }

  handleScroll(scrollTop: number, callback: (style: string) => void): void {
    if (!this.ticking) {
      window.requestAnimationFrame(() => {
        const style = this.calculateStyle(scrollTop)
        callback(style)
        this.ticking = false
      })
      this.ticking = true
    }
  }

  private calculateStyle(scrollTop: number): string {
    const progress = this.calculateProgress(scrollTop)
    const transform = this.getTransform(progress)
    const opacity = this.getOpacity(progress)
    return `transform: ${transform}; opacity: ${opacity};`
  }

  private calculateProgress(scrollTop: number): number {
    if (scrollTop <= this.config.scrollStart) return 0
    const scrollProgress = (scrollTop - this.config.scrollStart) / this.config.scrollRange
    return Math.min(scrollProgress, 1)
  }

  private getTransform(progress: number): string {
    const { direction, type, initialOffset, movePercentage } = this.config
    const moveProgress = type === 'in' ? 1 - progress : progress
    const offset = initialOffset * moveProgress * (movePercentage / 100)

    let translate = ''
    switch (direction) {
      case 'up':
        translate = `translateY(-${offset}rem)`
        break
      case 'down':
        translate = `translateY(${offset}rem)`
        break
      case 'left':
        translate = `translateX(-${offset}rem)`
        break
      case 'right':
        translate = `translateX(${offset}rem)`
        break
    }

    let scale = '1'
    if (this.config.scaleRange && this.config.scalePercentage) {
      const scaleProgress = Math.min(
        progress * (this.config.scrollRange / this.config.scaleRange),
        1
      )
      const scaleValue = 1 - (scaleProgress * this.config.scalePercentage) / 100
      scale = scaleValue.toString()
    }

    return `${translate} scale(${scale})`
  }

  private getOpacity(progress: number): number {
    if (!this.config.opacityRange) return 1
    const opacityProgress = Math.min(
      progress * (this.config.scrollRange / this.config.opacityRange),
      1
    )
    return this.config.type === 'in' ? opacityProgress : 1 - opacityProgress
  }
}
