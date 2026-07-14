import { describe, expect, test } from 'bun:test'
import { parseCtxString, parseTermString } from './parser'
import { derive, TypeError2 } from './typecheck'

describe('derive', () => {
  test('Γ-inferred param type reuses the outer binding instead of duplicating it', () => {
    const ctx = parseCtxString('x : Nat')
    const root = derive(ctx, parseTermString('λx. x'))
    expect(root.premises[0].ctx).toEqual(ctx)
  })

  test('explicit annotation still shadows and extends the context', () => {
    const ctx = parseCtxString('x : Bool')
    const root = derive(ctx, parseTermString('λx:Nat. x'))
    expect(root.premises[0].ctx).toEqual([...ctx, ['x', { kind: 'base', name: 'Nat' }]])
  })

  test('unannotated param with no matching Γ binding is a type error', () => {
    expect(() => derive([], parseTermString('λx. x'))).toThrow(TypeError2)
  })

  test('Int/Bool primitives type as base Int/Bool when enabled', () => {
    const n = derive([], parseTermString('42', { primitives: true }))
    expect(n.type).toEqual({ kind: 'base', name: 'Int' })
    const b = derive([], parseTermString('true', { primitives: true }))
    expect(b.type).toEqual({ kind: 'base', name: 'Bool' })
  })

  test('primitives stay plain identifiers when the toggle is off', () => {
    expect(() => parseTermString('42')).toThrow()
    expect(derive([['true', { kind: 'base', name: 'Bool' }]], parseTermString('true')).rule).toBe('T-Var')
  })

  test('neg and add1 are built-in primitive functions when enabled', () => {
    const neg = derive([], parseTermString('neg', { primitives: true }))
    expect(neg.type).toEqual({ kind: 'arrow', from: { kind: 'base', name: 'Bool' }, to: { kind: 'base', name: 'Bool' } })
    const applied = derive([], parseTermString('add1 41', { primitives: true }))
    expect(applied.type).toEqual({ kind: 'base', name: 'Int' })
  })

  test('eq accepts two same-typed operands and yields Bool', () => {
    const intEq = derive([], parseTermString('eq 1 2', { primitives: true }))
    expect(intEq.type).toEqual({ kind: 'base', name: 'Bool' })
    const boolEq = derive([], parseTermString('eq true false', { primitives: true }))
    expect(boolEq.type).toEqual({ kind: 'base', name: 'Bool' })
  })

  test('eq rejects operands of different types', () => {
    expect(() => derive([], parseTermString('eq 1 true', { primitives: true }))).toThrow(TypeError2)
  })
})
