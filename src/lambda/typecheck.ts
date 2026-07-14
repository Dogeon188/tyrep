import { BUILTIN_TYPES, TYVAR } from './primitives'
import type { Ctx, Term, Type } from './types'
import { typesEqual, typeToString } from './types'

// Replaces eq's placeholder type-variable with the concrete type it was
// applied to (only substitution this toy type system needs).
function substType(t: Type, replacement: Type): Type {
  if (t.kind === 'base') return t.name === TYVAR ? replacement : t
  return { kind: 'arrow', from: substType(t.from, replacement), to: substType(t.to, replacement) }
}

export type ProofNode = {
  ctx: Ctx
  term: Term
  type: Type
  rule: 'T-Var' | 'T-App' | 'T-Abs' | 'T-Lit' | 'T-Prim'
  premises: ProofNode[]
}

export class TypeError2 extends Error {}

function lookup(ctx: Ctx, name: string): Type | undefined {
  // rightmost/innermost binding wins, matching normal shadowing
  for (let i = ctx.length - 1; i >= 0; i--) {
    if (ctx[i][0] === name) return ctx[i][1]
  }
  return undefined
}

/** Pure synthesis over T-Var/T-App/T-Abs: context + expression -> result type. */
export function derive(ctx: Ctx, term: Term): ProofNode {
  switch (term.kind) {
    case 'lit':
      return { ctx, term, type: { kind: 'base', name: term.type }, rule: 'T-Lit', premises: [] }
    case 'prim':
      return { ctx, term, type: BUILTIN_TYPES[term.name], rule: 'T-Prim', premises: [] }
    case 'var': {
      const type = lookup(ctx, term.name)
      if (!type) throw new TypeError2(`unbound variable "${term.name}"`)
      return { ctx, term, type, rule: 'T-Var', premises: [] }
    }
    case 'app': {
      const fnNode = derive(ctx, term.fn)
      if (fnNode.type.kind !== 'arrow') {
        throw new TypeError2(`applying non-function of type ${typeToString(fnNode.type)}`)
      }
      const argNode = derive(ctx, term.arg)
      const isPoly = fnNode.type.from.kind === 'base' && fnNode.type.from.name === TYVAR
      if (!isPoly && !typesEqual(argNode.type, fnNode.type.from)) {
        throw new TypeError2(
          `argument has type ${typeToString(argNode.type)}, expected ${typeToString(fnNode.type.from)}`,
        )
      }
      const type = isPoly ? substType(fnNode.type.to, argNode.type) : fnNode.type.to
      return { ctx, term, type, rule: 'T-App', premises: [fnNode, argNode] }
    }
    case 'abs': {
      // ponytail: fall back to a same-name Γ binding instead of forcing inline annotation everywhere
      const paramType = term.paramType ?? lookup(ctx, term.param)
      if (!paramType) {
        throw new TypeError2(
          `cannot infer type of "${term.param}" — annotate it as "λ${term.param}:T. ..." or add "${term.param} : T" to Γ`,
        )
      }
      // Reusing the same Γ binding (no explicit annotation) shouldn't duplicate
      // it in the body's context — that just prints "x : T, x : T" in the legend.
      const bodyCtx: Ctx = term.paramType ? [...ctx, [term.param, paramType]] : ctx
      const bodyNode = derive(bodyCtx, term.body)
      return {
        ctx,
        term,
        type: { kind: 'arrow', from: paramType, to: bodyNode.type },
        rule: 'T-Abs',
        premises: [bodyNode],
      }
    }
  }
}
