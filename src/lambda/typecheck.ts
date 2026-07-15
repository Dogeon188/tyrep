import { BOTTOM, BUILTIN_TYPES, TYVAR } from './primitives'
import type { Ctx, Effect, Term, Type } from './types'
import { typesEqual, typeToString, unifyTypes } from './types'

// Replaces eq's placeholder type-variable with the concrete type it was
// applied to (only substitution this toy type system needs).
function substType(t: Type, replacement: Type): Type {
    if (t.kind === 'base') return t.name === TYVAR ? replacement : t
    return {
        kind: 'arrow',
        from: substType(t.from, replacement),
        to: substType(t.to, replacement),
        effect: t.effect
    }
}

// Effect composition from exn.pdf Appendix B: `∘` (sequencing — impure if
// either side is) determines T-App's effect from callee/arg/body; `•`
// (try-merge) determines T-Try's effect from its two branches.
const seqEffect = (a: Effect, b: Effect): Effect => (a === 'i' || b === 'i' ? 'i' : 'p')
const tryEffect = (body: Effect, handler: Effect): Effect =>
    body === 'p' ? 'p' : handler

export type ProofNode = {
    ctx: Ctx
    term: Term
    type: Type
    effect: Effect
    rule: 'T-Var' | 'T-App' | 'T-Abs' | 'T-Lit' | 'T-Prim' | 'T-Error' | 'T-Try'
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

const subscript = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])

// Names free in `term` that aren't already bound in `ctx`, in first-appearance
// (left-to-right) order — mirrors FV(e) from the paper, minus whatever the
// caller already supplied a binding for.
function collectFreeVars(term: Term, ctx: Ctx): string[] {
    const seen = new Set<string>()
    const order: string[] = []
    function walk(t: Term, bound: Set<string>) {
        switch (t.kind) {
            case 'var':
                if (
                    !bound.has(t.name) &&
                    lookup(ctx, t.name) === undefined &&
                    !seen.has(t.name)
                ) {
                    seen.add(t.name)
                    order.push(t.name)
                }
                return
            case 'lit':
            case 'prim':
            case 'error':
                return
            case 'abs':
                walk(t.body, new Set(bound).add(t.param))
                return
            case 'app':
                walk(t.fn, bound)
                walk(t.arg, bound)
                return
            case 'try':
                walk(t.body, bound)
                walk(t.handler, bound)
        }
    }
    walk(term, new Set())
    return order
}

// Like the PDF's "extend Γ with a type for the free variable to get a closed
// derivation" trick (section on open derivations): rather than erroring on a
// free variable, invent a fresh abstract type τ_1, τ_2, ... for it.
function withFreeVarTypes(ctx: Ctx, term: Term): Ctx {
    const free = collectFreeVars(term, ctx)
    if (free.length === 0) return ctx
    const fresh: Ctx = free.map((name, i) => [
        name,
        { kind: 'base', name: `τ${subscript(i + 1)}` }
    ])
    return [...fresh, ...ctx]
}

/** Pure synthesis over T-Var/T-App/T-Abs: context + expression -> result type. */
export function derive(ctx: Ctx, term: Term): ProofNode {
    return deriveNode(withFreeVarTypes(ctx, term), term)
}

function deriveNode(ctx: Ctx, term: Term): ProofNode {
    switch (term.kind) {
        case 'lit':
            return {
                ctx,
                term,
                type: { kind: 'base', name: term.type },
                effect: 'p',
                rule: 'T-Lit',
                premises: []
            }
        case 'prim':
            return {
                ctx,
                term,
                type: BUILTIN_TYPES[term.name],
                effect: 'p',
                rule: 'T-Prim',
                premises: []
            }
        case 'error':
            return {
                ctx,
                term,
                type: { kind: 'base', name: BOTTOM },
                effect: 'i',
                rule: 'T-Error',
                premises: []
            }
        case 'var': {
            const type = lookup(ctx, term.name)
            if (!type) throw new TypeError2(`unbound variable "${term.name}"`)
            return { ctx, term, type, effect: 'p', rule: 'T-Var', premises: [] }
        }
        case 'app': {
            const fnNode = deriveNode(ctx, term.fn)
            if (fnNode.type.kind !== 'arrow') {
                throw new TypeError2(
                    `applying non-function of type ${typeToString(fnNode.type)}`
                )
            }
            const argNode = deriveNode(ctx, term.arg)
            const isPoly =
                fnNode.type.from.kind === 'base' && fnNode.type.from.name === TYVAR
            if (!isPoly && !typesEqual(argNode.type, fnNode.type.from)) {
                throw new TypeError2(
                    `argument has type ${typeToString(argNode.type)}, expected ${typeToString(fnNode.type.from)}`
                )
            }
            const type = isPoly ? substType(fnNode.type.to, argNode.type) : fnNode.type.to
            const effect = seqEffect(
                seqEffect(fnNode.effect, argNode.effect),
                fnNode.type.effect
            )
            return { ctx, term, type, effect, rule: 'T-App', premises: [fnNode, argNode] }
        }
        case 'try': {
            const bodyNode = deriveNode(ctx, term.body)
            const handlerNode = deriveNode(ctx, term.handler)
            if (!typesEqual(bodyNode.type, handlerNode.type)) {
                throw new TypeError2(
                    `try branches disagree: ${typeToString(bodyNode.type)} vs ${typeToString(handlerNode.type)}`
                )
            }
            const type = unifyTypes(bodyNode.type, handlerNode.type)
            const effect = tryEffect(bodyNode.effect, handlerNode.effect)
            return {
                ctx,
                term,
                type,
                effect,
                rule: 'T-Try',
                premises: [bodyNode, handlerNode]
            }
        }
        case 'abs': {
            // ponytail: fall back to a same-name Γ binding instead of forcing inline annotation everywhere
            const paramType = term.paramType ?? lookup(ctx, term.param)
            if (!paramType) {
                throw new TypeError2(
                    `cannot infer type of "${term.param}" — annotate it as "λ${term.param}:T. ..." or add "${term.param} : T" to Γ`
                )
            }
            // Reusing the same Γ binding (no explicit annotation) shouldn't duplicate
            // it in the body's context — that just prints "x : T, x : T" in the legend.
            const bodyCtx: Ctx = term.paramType ? [...ctx, [term.param, paramType]] : ctx
            const bodyNode = deriveNode(bodyCtx, term.body)
            return {
                ctx,
                term,
                type: {
                    kind: 'arrow',
                    from: paramType,
                    to: bodyNode.type,
                    effect: bodyNode.effect
                },
                effect: 'p',
                rule: 'T-Abs',
                premises: [bodyNode]
            }
        }
    }
}
