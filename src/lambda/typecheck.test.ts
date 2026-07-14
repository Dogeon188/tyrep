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
})
