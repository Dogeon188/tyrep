import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseCtxString, parseTermString } from './parser'
import { derive } from './typecheck'
import { ProofTree } from './ProofTree'

describe('ProofTree shadow badges', () => {
  test('a genuinely shadowed name gets a distinct badge per binder', () => {
    const ctx = parseCtxString('x : Bool')
    const root = derive(ctx, parseTermString('λx:Bool. λx:Nat. x'))
    const html = renderToStaticMarkup(<ProofTree root={root} />)
    expect(html).toContain('x₀')
    expect(html).toContain('x₁')
  })

  test('a Γ-reused (non-shadowing) name is rendered plain, with no badge', () => {
    const ctx = parseCtxString('x : Nat')
    const root = derive(ctx, parseTermString('λx. x'))
    const html = renderToStaticMarkup(<ProofTree root={root} />)
    expect(html).not.toContain('var-badge')
  })
})
