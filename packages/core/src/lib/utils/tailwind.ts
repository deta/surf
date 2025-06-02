import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// TOOD: Somebody please nuke.. this hurts my soul!
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
