export const ContextViewTypes = {
  Masonry: 'masonry',
  Grid: 'grid',
  List: 'list'
} as const
export type ContextViewType = (typeof ContextViewTypes)[keyof typeof ContextViewTypes]

export const ContextViewDensities = {
  Compact: 'compact',
  Cozy: 'cozy',
  Comfortable: 'comfortable',
  Spacious: 'spacious'
} as const
export type ContextViewDensity = (typeof ContextViewDensities)[keyof typeof ContextViewDensities]
