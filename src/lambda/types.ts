import { BOTTOM } from './primitives'

// p = pure (no escaping exception), i = impure (may raise, see exn.pdf §6/B),
// or a Type = impure via an escaping algebraic operation, denoting the type
// expected by its continuation (see eff.pdf §6's ϵ ::= p | τ).
export type Effect = 'p' | 'i' | Type

export type Type =
    | { kind: 'base'; name: string }
    | { kind: 'arrow'; from: Type; to: Type; effect: Effect }

export type Term =
    | { kind: 'var'; name: string }
    | { kind: 'app'; fn: Term; arg: Term }
    | { kind: 'abs'; param: string; paramType?: Type; body: Term }
    | { kind: 'lit'; type: 'Int' | 'Bool'; value: number | boolean }
    | { kind: 'prim'; name: string }
    | { kind: 'error' }
    | { kind: 'try'; body: Term; handler: Term }
    | { kind: 'op' }
    | { kind: 'handle'; body: Term; x: string; er: Term; k: string; eo: Term }

export type Ctx = Array<[string, Type]>

// An algebraic-effect ϵ that's a Type (eff.pdf §6) prints as that type's own
// (effect-less) form — nesting `!ϵ` inside `!ϵ` would just restate the type.
export function effectToString(e: Effect): string {
    return typeof e === 'string' ? e : typeToString(e)
}

// showEffect renders the exn.pdf `σ → τ !ϵ` form; the `to` side gets
// parenthesized in that mode so a trailing `!ϵ` unambiguously binds to the
// outermost arrow, not whichever nested one happens to print last.
export function typeToString(t: Type, showEffect = false): string {
    if (t.kind === 'base') return t.name === BOTTOM ? '⊥' : t.name
    const from =
        t.from.kind === 'arrow'
            ? `(${typeToString(t.from, showEffect)})`
            : typeToString(t.from, showEffect)
    const to =
        t.to.kind === 'arrow' && showEffect
            ? `(${typeToString(t.to, showEffect)})`
            : typeToString(t.to, showEffect)
    const arrow = `${from} → ${to}`
    return showEffect ? `${arrow} !${effectToString(t.effect)}` : arrow
}

// Uncurried form, e.g. `a -> b -> c` becomes `(a × b) → c`: each curried arrow
// chain's arguments are grouped as a product, recursively, with the product
// always parenthesized (fully parenthesized, mirroring termToFullString).
export function typeToUncurriedString(t: Type): string {
    if (t.kind === 'base') return t.name
    const args: Type[] = []
    let ret: Type = t
    while (ret.kind === 'arrow') {
        args.push(ret.from)
        ret = ret.to
    }
    const argStrs = args.map((a) =>
        a.kind === 'arrow' ? `(${typeToUncurriedString(a)})` : typeToUncurriedString(a)
    )
    return `(${argStrs.join(' × ')}) → ${typeToUncurriedString(ret)}`
}

export function termToString(t: Term): string {
    switch (t.kind) {
        case 'var':
        case 'prim':
            return t.name
        case 'lit':
            return String(t.value)
        case 'error':
            return 'error'
        case 'op':
            return 'op'
        case 'try':
            return `try ${termToString(t.body)} with ${termToString(t.handler)}`
        case 'handle':
            return `handle ${termToString(t.body)} with {${t.x}. ${termToString(t.er)}; ${t.k}. ${termToString(t.eo)}}`
        case 'abs':
            return `λ${t.param}${t.paramType ? `:${typeToString(t.paramType)}` : ''}. ${termToString(t.body)}`
        case 'app': {
            const fn =
                t.fn.kind === 'abs' || t.fn.kind === 'try' || t.fn.kind === 'handle'
                    ? `(${termToString(t.fn)})`
                    : termToString(t.fn)
            const arg =
                t.arg.kind === 'var' ? termToString(t.arg) : `(${termToString(t.arg)})`
            return `${fn} ${arg}`
        }
    }
}

// Fully parenthesized form, e.g. `λx. { λy. { (x y) y } }`
export function termToFullString(t: Term): string {
    switch (t.kind) {
        case 'var':
        case 'prim':
            return t.name
        case 'lit':
            return String(t.value)
        case 'error':
            return 'error'
        case 'op':
            return 'op'
        case 'try':
            return `try { ${termToFullString(t.body)} } with { ${termToFullString(t.handler)} }`
        case 'handle':
            return `handle { ${termToFullString(t.body)} } with {${t.x}. { ${termToFullString(t.er)} }; ${t.k}. { ${termToFullString(t.eo)} }}`
        case 'abs':
            return `λ${t.param}${t.paramType ? `:${typeToString(t.paramType)}` : ''}. { ${termToFullString(t.body)} }`
        case 'app': {
            const atomKinds = ['var', 'lit', 'prim', 'error', 'op']
            const fn = atomKinds.includes(t.fn.kind)
                ? termToFullString(t.fn)
                : `(${termToFullString(t.fn)})`
            const arg = atomKinds.includes(t.arg.kind)
                ? termToFullString(t.arg)
                : `(${termToFullString(t.arg)})`
            return `${fn} ${arg}`
        }
    }
}

export function ctxToString(ctx: Ctx): string {
    if (ctx.length === 0) return '∅'
    return ctx.map(([n, t]) => `${n} : ${typeToString(t)}`).join(', ')
}

// `error`'s BOTTOM marker stands for "any type", so it compares equal to
// everything — that's what lets `add1 error` or `try 3 with error` typecheck.
export function typesEqual(a: Type, b: Type): boolean {
    if (
        (a.kind === 'base' && a.name === BOTTOM) ||
        (b.kind === 'base' && b.name === BOTTOM)
    )
        return true
    if (a.kind !== b.kind) return false
    if (a.kind === 'base' && b.kind === 'base') return a.name === b.name
    if (a.kind === 'arrow' && b.kind === 'arrow')
        return typesEqual(a.from, b.from) && typesEqual(a.to, b.to)
    return false
}

// Prefer the non-BOTTOM side so a resolved concrete type (e.g. from T-Try
// reconciling `error`'s branch with its handler's) propagates upward instead
// of the placeholder.
export function unifyTypes(a: Type, b: Type): Type {
    return a.kind === 'base' && a.name === BOTTOM ? b : a
}
