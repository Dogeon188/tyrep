export type Type =
    { kind: 'base'; name: string } | { kind: 'arrow'; from: Type; to: Type }

export type Term =
    | { kind: 'var'; name: string }
    | { kind: 'app'; fn: Term; arg: Term }
    | { kind: 'abs'; param: string; paramType?: Type; body: Term }
    | { kind: 'lit'; type: 'Int' | 'Bool'; value: number | boolean }
    | { kind: 'prim'; name: string }

export type Ctx = Array<[string, Type]>

export function typeToString(t: Type): string {
    if (t.kind === 'base') return t.name
    const from =
        t.from.kind === 'arrow' ? `(${typeToString(t.from)})` : typeToString(t.from)
    return `${from} → ${typeToString(t.to)}`
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
        case 'abs':
            return `λ${t.param}${t.paramType ? `:${typeToString(t.paramType)}` : ''}. ${termToString(t.body)}`
        case 'app': {
            const fn =
                t.fn.kind === 'abs' ? `(${termToString(t.fn)})` : termToString(t.fn)
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
        case 'abs':
            return `λ${t.param}${t.paramType ? `:${typeToString(t.paramType)}` : ''}. { ${termToFullString(t.body)} }`
        case 'app': {
            const atomKinds = ['var', 'lit', 'prim']
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

export function typesEqual(a: Type, b: Type): boolean {
    if (a.kind !== b.kind) return false
    if (a.kind === 'base' && b.kind === 'base') return a.name === b.name
    if (a.kind === 'arrow' && b.kind === 'arrow')
        return typesEqual(a.from, b.from) && typesEqual(a.to, b.to)
    return false
}
