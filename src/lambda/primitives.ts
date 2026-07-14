import type { Type } from './types'

const bool: Type = { kind: 'base', name: 'Bool' }
const int: Type = { kind: 'base', name: 'Int' }

// Reserved type-variable name for eq's schema (α → α → Bool). Not an ASCII
// identifier, so it can never collide with a user-typed type name — the
// tokenizer's ident regex can't produce it.
export const TYVAR = 'α'
const tyvar: Type = { kind: 'base', name: TYVAR }

// Single source of truth for built-in primitive functions: the parser gates
// which identifiers become `prim` terms, typecheck looks up their type here.
// eq is the one polymorphic entry — typecheck.ts substitutes TYVAR with the
// concrete argument type on first application (see substType).
export const BUILTIN_TYPES: Record<string, Type> = {
  neg: { kind: 'arrow', from: bool, to: bool },
  add1: { kind: 'arrow', from: int, to: int },
  eq: { kind: 'arrow', from: tyvar, to: { kind: 'arrow', from: tyvar, to: bool } },
}
