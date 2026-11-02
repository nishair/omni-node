import type { Source } from '../data/types'
import { chicago } from './chicago'
import { sfbay } from './sfbay'

export const SOURCES: readonly Source[] = [sfbay, chicago]
export const DEFAULT_SOURCE = sfbay

export function sourceById(id: string): Source | undefined {
  return SOURCES.find((s) => s.id === id)
}
