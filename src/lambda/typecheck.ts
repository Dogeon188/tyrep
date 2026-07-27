import type { ParseOptions } from './parser'
import { BOOL, BOTTOM, BUILTIN_TYPES, TYVAR } from './primitives'
import type { Ctx, Effect, Term, Type } from './types'
import { effectToString, typesEqual, typeToString, unifyTypes } from './types'

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

function resolveEffect(e: Effect, subst: Map<string, Type>): Effect {
    return typeof e === 'string' ? e : resolveType(e, subst)
}

function resolveType(t: Type, subst: Map<string, Type>): Type {
    if (t.kind === 'base') {
        const replacement = subst.get(t.name)
        return replacement ? resolveType(replacement, subst) : t
    }
    return {
        kind: 'arrow',
        from: resolveType(t.from, subst),
        to: resolveType(t.to, subst),
        effect: resolveEffect(t.effect, subst)
    }
}

// Robinson (1965): a type variable can't be bound to a term containing
// itself, or resolveType would chase the substitution forever (this is
// exactly what used to stack-overflow on `λx. x x`).
function occursIn(name: string, t: Type, subst: Map<string, Type>): boolean {
    const resolved = resolveType(t, subst)
    return resolved.kind === 'base'
        ? resolved.name === name
        : occursIn(name, resolved.from, subst) || occursIn(name, resolved.to, subst)
}

function bindTypeVar(name: string, t: Type, subst: Map<string, Type>): Type {
    if (occursIn(name, t, subst))
        throw new TypeError2(`infinite type: ${name} occurs in ${typeToString(t)}`)
    subst.set(name, t)
    return t
}

// Robinson's unification algorithm: symmetric recursive descent over term
// structure, with an occurs check on variable binding and an explicit
// failure (rather than a silent `return left`) when no unifier exists.
function unifyType(a: Type, b: Type, subst: Map<string, Type>): Type {
    const left = resolveType(a, subst)
    const right = resolveType(b, subst)
    if (left.kind === 'base' && isFreshTypeVar(left))
        return bindTypeVar(left.name, right, subst)
    if (right.kind === 'base' && isFreshTypeVar(right))
        return bindTypeVar(right.name, left, subst)
    if (left.kind === 'base' && right.kind === 'base') {
        if (left.name !== right.name)
            throw new TypeError2(
                `cannot unify ${typeToString(left)} with ${typeToString(right)}`
            )
        return left
    }
    if (left.kind === 'arrow' && right.kind === 'arrow') {
        const from = unifyType(left.from, right.from, subst)
        const to = unifyType(left.to, right.to, subst)
        if (!effectsEqual(left.effect, right.effect))
            throw new TypeError2(
                `cannot unify effects !${effectToString(left.effect)} and !${effectToString(right.effect)}`
            )
        return { kind: 'arrow', from, to, effect: left.effect }
    }
    throw new TypeError2(`cannot unify ${typeToString(left)} with ${typeToString(right)}`)
}

// Effect composition from exn.pdf Appendix B: `∘` (sequencing — impure if
// either side is) determines T-App's effect from callee/arg/body; `•`
// (try-merge) determines T-Try's effect from its two branches. Generalized
// for eff.pdf's ϵ ::= p | τ: an escaping algebraic operation (a Type, not a
// string) is also "impure" for ∘'s purposes; 'i' still wins over an
// escaping-op type when exceptions and effects are mixed (an unspecified
// combination in either paper — this is just a deterministic tie-break).
const seqEffect = (a: Effect, b: Effect): Effect => {
    if (a === 'p') return b
    if (b === 'p') return a
    if (a === 'i' || b === 'i') return 'i'
    return a
}
const tryEffect = (body: Effect, handler: Effect): Effect =>
    body === 'p' ? 'p' : handler

// Effect-level counterpart of typesEqual/unifyTypes: 'p'/'i' compare/prefer
// literally, Type-valued effects (algebraic ops) go through the Type
// versions so an unresolved ⊥ marker still unifies with anything.
function effectsEqual(a: Effect, b: Effect): boolean {
    if (typeof a === 'string' || typeof b === 'string') return a === b
    return typesEqual(a, b)
}
function unifyEffect(a: Effect, b: Effect): Effect {
    if (typeof a !== 'string' && a.kind === 'base' && a.name === BOTTOM) return b
    return a
}

export type ProofNode = {
    ctx: Ctx
    term: Term
    type: Type
    effect: Effect
    rule:
        | 'T-Var'
        | 'T-App'
        | 'T-Abs'
        | 'T-Lit'
        | 'T-Prim'
        | 'T-Error'
        | 'T-Try'
        | 'T-Op'
        | 'T-Handle'
        | 'T-Neg'
        | 'T-Add1'
        | 'T-Eq'
    premises: ProofNode[]
    // An unjustified leaf: the derivation couldn't actually produce this
    // judgment (a type mismatch), so it's forced to the type its context
    // demands and asserted bare — the PDFs' "open derivation" trick, applied
    // to whichever leaf doesn't fit instead of just aborting the whole tree.
    open?: boolean
}

function openLeaf(ctx: Ctx, term: Term, type: Type, effect: Effect = 'p'): ProofNode {
    return { ctx, term, type, effect, rule: 'T-Var', premises: [], open: true }
}

export class TypeError2 extends Error {}

function lookup(ctx: Ctx, name: string): Type | undefined {
    // rightmost/innermost binding wins, matching normal shadowing
    for (let i = ctx.length - 1; i >= 0; i--) {
        if (ctx[i][0] === name) return ctx[i][1]
    }
    return undefined
}

function applySubstToCtx(ctx: Ctx, subst: Map<string, Type>): Ctx {
    return ctx.map(([name, t]) => [name, resolveType(t, subst)])
}

const subscript = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])

let freshTypeVarId = 0
function freshTypeVar(): Type {
    return { kind: 'base', name: `τ${freshTypeVarId++}` }
}

function isFreshTypeVar(t: Type): boolean {
    return t.kind === 'base' && /^τ(?:\d|[₀₁₂₃₄₅₆₇₈₉])+$/.test(t.name)
}

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
            case 'op':
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
                return
            case 'handle':
                walk(t.body, bound)
                walk(t.er, new Set(bound).add(t.x))
                walk(t.eo, new Set(bound).add(t.k))
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
export function derive(ctx: Ctx, term: Term, opts: ParseOptions = {}): ProofNode {
    freshTypeVarId = 0
    return deriveNode(withFreeVarTypes(ctx, term), term, opts, new Map<string, Type>())
}

// Recognizes `neg e`/`add1 e`/`eq e1 e2` application shapes and derives them
// via exn.pdf Appendix B's dedicated T-Neg/T-Add1/T-Eq axioms instead of
// generic T-App/T-Prim decomposition — same .type/.effect either way (see
// typecheck.test.ts), just a flatter, PDF-matching proof tree. Returns null
// for anything else (bare prim, partial application, ...), which falls back
// to the generic case.
function deriveDedicatedPrim(
    ctx: Ctx,
    term: Extract<Term, { kind: 'app' }>,
    opts: ParseOptions,
    subst: Map<string, Type>
): ProofNode | null {
    const { fn, arg } = term
    if (fn.kind === 'prim' && (fn.name === 'neg' || fn.name === 'add1')) {
        const primType = BUILTIN_TYPES[fn.name]
        if (primType.kind !== 'arrow') return null
        let argNode = deriveNode(ctx, arg, opts, subst)
        const domain = primType.from
        if (!typesEqual(argNode.type, domain)) argNode = openLeaf(ctx, arg, domain)
        const effect = argNode.effect === argNode.type ? domain : argNode.effect
        return {
            ctx,
            term,
            type: primType.to,
            effect,
            rule: fn.name === 'neg' ? 'T-Neg' : 'T-Add1',
            premises: [argNode]
        }
    }
    if (fn.kind === 'app' && fn.fn.kind === 'prim' && fn.fn.name === 'eq') {
        const e1Node = deriveNode(ctx, fn.arg, opts, subst)
        let e2Node = deriveNode(ctx, arg, opts, subst)
        if (!typesEqual(e1Node.type, e2Node.type))
            e2Node = openLeaf(ctx, arg, e1Node.type)
        const anchor = unifyTypes(e1Node.type, e2Node.type)
        const e1Effect = e1Node.effect === e1Node.type ? anchor : e1Node.effect
        const e2Effect = e2Node.effect === e2Node.type ? anchor : e2Node.effect
        return {
            ctx,
            term,
            type: BOOL,
            effect: seqEffect(e1Effect, e2Effect),
            rule: 'T-Eq',
            premises: [e1Node, e2Node]
        }
    }
    return null
}

function deriveNode(
    ctx: Ctx,
    term: Term,
    opts: ParseOptions,
    subst: Map<string, Type>
): ProofNode {
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
        case 'op': {
            // T-Op: Γ ⊢ op : τ ! τ for whatever τ context demands (eff.pdf §6).
            // Bottom-up synthesis can't know τ yet, so — mirroring `error`'s
            // BOTTOM trick — op synthesizes to a single fresh marker object
            // used as *both* its type and effect. Reference-equality between
            // a node's .type and .effect (checked in T-App) is what lets
            // that marker get pinned to a concrete type once the surrounding
            // context supplies one (e.g. `eq 1 op`, `neg op`).
            const marker: Type = { kind: 'base', name: BOTTOM }
            return { ctx, term, type: marker, effect: marker, rule: 'T-Op', premises: [] }
        }
        case 'var': {
            const type = lookup(ctx, term.name)
            if (!type) throw new TypeError2(`unbound variable "${term.name}"`)
            return {
                ctx: applySubstToCtx(ctx, subst),
                term,
                type: resolveType(type, subst),
                effect: 'p',
                rule: 'T-Var',
                premises: []
            }
        }
        case 'app': {
            if (opts.dedicated) {
                const dedicated = deriveDedicatedPrim(ctx, term, opts, subst)
                if (dedicated) return dedicated
            }
            const fnNode = deriveNode(ctx, term.fn, opts, subst)
            // if (fnNode.type.kind !== 'arrow') {
            //     throw new TypeError2(
            //         `applying non-function of type ${typeToString(fnNode.type)}`
            //     )
            // }
            let argNode = deriveNode(ctx, term.arg, opts, subst)
            let resolvedFnType = resolveType(fnNode.type, subst)
            if (resolvedFnType.kind !== 'arrow') {
                if (isFreshTypeVar(resolvedFnType)) {
                    const inferredFnType: Type = {
                        kind: 'arrow',
                        from: resolveType(argNode.type, subst),
                        to: freshTypeVar(),
                        effect: 'p'
                    }
                    unifyType(resolvedFnType, inferredFnType, subst)
                    const resolvedInferredFnType = resolveType(inferredFnType, subst)
                    if (resolvedInferredFnType.kind !== 'arrow') {
                        throw new TypeError2(
                            `applying non-function of type ${typeToString(fnNode.type)}`
                        )
                    }
                    return {
                        ctx: applySubstToCtx(ctx, subst),
                        term,
                        type: resolveType(resolvedInferredFnType.to, subst),
                        effect: seqEffect(
                            seqEffect(
                                resolveEffect(fnNode.effect, subst),
                                resolveEffect(argNode.effect, subst)
                            ),
                            inferredFnType.effect
                        ),
                        rule: 'T-App',
                        premises: [
                            { ...fnNode, type: resolvedInferredFnType, effect: 'p' },
                            argNode
                        ]
                    }
                }
                throw new TypeError2(
                    `applying non-function of type ${typeToString(fnNode.type)}`
                )
            }
            if (resolvedFnType.kind !== 'arrow') {
                throw new TypeError2(
                    `applying non-function of type ${typeToString(fnNode.type)}`
                )
            }
            const arrowFnType = resolvedFnType
            const isPoly =
                arrowFnType.from.kind === 'base' && arrowFnType.from.name === TYVAR
            if (
                !isPoly &&
                !typesEqual(
                    resolveType(argNode.type, subst),
                    resolveType(arrowFnType.from, subst)
                )
            )
                argNode = openLeaf(ctx, term.arg, arrowFnType.from)
            const type = isPoly
                ? substType(
                      resolveType(arrowFnType.to, subst),
                      resolveType(argNode.type, subst)
                  )
                : resolveType(arrowFnType.to, subst)
            // An argument that's a bare (or propagated) `op` carries its own
            // still-open marker as both its type and effect; once it's been
            // checked against the callee's declared parameter type above,
            // pin the marker to that concrete type instead of leaving it open.
            const argEffect =
                !isPoly && argNode.effect === argNode.type
                    ? arrowFnType.from
                    : argNode.effect
            const effect = seqEffect(
                seqEffect(
                    resolveEffect(fnNode.effect, subst),
                    resolveEffect(argEffect, subst)
                ),
                resolveEffect(arrowFnType.effect, subst)
            )
            return {
                ctx: applySubstToCtx(ctx, subst),
                term,
                type,
                effect,
                rule: 'T-App',
                premises: [fnNode, argNode]
            }
        }
        case 'try': {
            const bodyNode = deriveNode(ctx, term.body, opts, subst)
            let handlerNode = deriveNode(ctx, term.handler, opts, subst)
            if (!typesEqual(bodyNode.type, handlerNode.type))
                handlerNode = openLeaf(
                    ctx,
                    term.handler,
                    bodyNode.type,
                    handlerNode.effect
                )
            const type = unifyTypes(bodyNode.type, handlerNode.type)
            const effect = tryEffect(bodyNode.effect, handlerNode.effect)
            return {
                ctx: applySubstToCtx(ctx, subst),
                term,
                type,
                effect,
                rule: 'T-Try',
                premises: [bodyNode, handlerNode]
            }
        }
        case 'handle': {
            // T-Handle (eff.pdf §6): Γ⊢e:σ!τ' · Γ,x:σ⊢er:τ!ϵ · Γ,k:τ'→τ!ϵ⊢eo:τ!ϵ
            //   ⟹ Γ⊢handle e with {x.er;k.eo} : τ!ϵ
            const bodyNode = deriveNode(ctx, term.body, opts, subst)
            // τ': the type an escaping `op` inside the body expects from its
            // continuation. If the body is genuinely pure (no escaping op —
            // its effect is a plain 'p'/'i' string, not our Type-valued
            // marker), there's nothing for k to ever be called with; give it
            // a fresh BOTTOM marker so k's parameter type stays unconstrained
            // rather than forcing a specific (unused) type on it.
            const tauPrime: Type =
                typeof bodyNode.effect === 'string'
                    ? { kind: 'base', name: BOTTOM }
                    : bodyNode.effect
            const erNode = deriveNode(
                [...ctx, [term.x, bodyNode.type]],
                term.er,
                opts,
                subst
            )
            const kType: Type = {
                kind: 'arrow',
                from: tauPrime,
                to: erNode.type,
                effect: erNode.effect
            }
            const eoCtx: Ctx = [...ctx, [term.k, kType]]
            let eoNode = deriveNode(eoCtx, term.eo, opts, subst)
            if (
                !typesEqual(eoNode.type, erNode.type) ||
                !effectsEqual(eoNode.effect, erNode.effect)
            ) {
                eoNode = openLeaf(eoCtx, term.eo, erNode.type, erNode.effect)
            }
            return {
                ctx: applySubstToCtx(ctx, subst),
                term,
                type: unifyTypes(erNode.type, eoNode.type),
                effect: unifyEffect(eoNode.effect, erNode.effect),
                rule: 'T-Handle',
                premises: [bodyNode, erNode, eoNode]
            }
        }
        case 'abs': {
            // ponytail: fall back to a same-name Γ binding instead of forcing inline annotation everywhere
            // const paramType = term.paramType ?? lookup(ctx, term.param)
            // if (!paramType) {
            //     throw new TypeError2(
            //         `cannot infer type of "${term.param}" — annotate it as "λ${term.param}:T. ..." or add "${term.param} : T" to Γ`
            //     )
            // }
            const paramType = term.paramType ?? lookup(ctx, term.param) ?? freshTypeVar()
            // Reusing the same Γ binding (no explicit annotation) shouldn't duplicate
            // it in the body's context — that just prints "x : T, x : T" in the legend.
            const bodyCtx: Ctx =
                term.paramType || lookup(ctx, term.param) === undefined
                    ? [...ctx, [term.param, paramType]]
                    : ctx
            const bodyNode = deriveNode(bodyCtx, term.body, opts, subst)
            return {
                ctx: applySubstToCtx(ctx, subst),
                term,
                type: {
                    kind: 'arrow',
                    from: resolveType(paramType, subst),
                    to: resolveType(bodyNode.type, subst),
                    effect: resolveEffect(bodyNode.effect, subst)
                },
                effect: 'p',
                rule: 'T-Abs',
                premises: [bodyNode]
            }
        }
    }
}
