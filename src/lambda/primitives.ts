import type { Type } from './types'

const bool: Type = { kind: 'base', name: 'Bool' }
const int: Type = { kind: 'base', name: 'Int' }

// Reserved type-variable name for eq's schema (α → α → Bool). Not an ASCII
// identifier, so it can never collide with a user-typed type name — the
// tokenizer's ident regex can't produce it.
export const TYVAR = 'α'
const tyvar: Type = { kind: 'base', name: TYVAR }

// Reserved stand-in for `error`'s type (Γ ⊢ error : τ ! i for *any* τ). Our
// typechecker is pure bottom-up synthesis, so it can't infer the τ an outer
// context expects; instead `error` synthesizes to this marker, and
// typesEqual (types.ts) treats it as equal to anything, letting the marker
// get reconciled with a concrete type wherever one is available (T-App's
// argument check, T-Try unifying the two branches, ...).
export const BOTTOM = '⊥'

// Single source of truth for built-in primitive functions: the parser gates
// which identifiers become `prim` terms, typecheck looks up their type here.
// eq is the one polymorphic entry — typecheck.ts substitutes TYVAR with the
// concrete argument type on first application (see substType). All builtins
// are pure (they can't raise), hence effect: 'p'.
export const BUILTIN_TYPES: Record<string, Type> = {
    neg: { kind: 'arrow', from: bool, to: bool, effect: 'p' },
    add1: { kind: 'arrow', from: int, to: int, effect: 'p' },
    eq: {
        kind: 'arrow',
        from: tyvar,
        to: { kind: 'arrow', from: tyvar, to: bool, effect: 'p' },
        effect: 'p'
    }
}
