import type { Type } from './types'

const bool: Type = { kind: 'base', name: 'Bool' }
const int: Type = { kind: 'base', name: 'Int' }

// Single source of truth for built-in primitive functions: the parser gates
// which identifiers become `prim` terms, typecheck looks up their type here.
export const BUILTIN_TYPES: Record<string, Type> = {
  neg: { kind: 'arrow', from: bool, to: bool },
  add1: { kind: 'arrow', from: int, to: int },
}
