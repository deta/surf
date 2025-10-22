export interface ResourceDataLocation {
  name: string
  description: string
  coordinates: {
    latitude: number
    longitude: number
  }
  google_maps_link: string | null
}

export interface ResourceDataColor {
  name: string
  hex: string
  rgb: {
    r: number
    g: number
    b: number
  }
  hsl: {
    h: number
    s: number
    l: number
  }
}
