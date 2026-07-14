import type { ProofNode } from './typecheck'
import type { Ctx, Term, Type } from './types'
import { TYVAR } from './primitives'

function collectEnvs(n: ProofNode, envs: Map<string, Ctx>) {
    const key = JSON.stringify(n.ctx)
    if (!envs.has(key)) envs.set(key, n.ctx)
    for (const p of n.premises) collectEnvs(p, envs)
}

// A λ-bound name only actually shadows an outer binding when the abs pushes
// a fresh Ctx entry (see typecheck.ts) — a Γ-inferred param reuses the outer
// slot instead, so it isn't a second binder worth distinguishing.
function paramCtxExtension(ctx: Ctx, t: Extract<Term, { kind: 'abs' }>): Ctx {
    return t.paramType ? [...ctx, [t.param, t.paramType]] : ctx
}

function lookupIndex(ctx: Ctx, name: string): number {
    for (let i = ctx.length - 1; i >= 0; i--) if (ctx[i][0] === name) return i
    return -1
}

function collectShadowBinders(n: ProofNode, byName: Map<string, string[]>) {
    if (
        n.rule === 'T-Abs' &&
        n.term.kind === 'abs' &&
        n.premises[0].ctx.length > n.ctx.length
    ) {
        const key = JSON.stringify(n.premises[0].ctx)
        const keys = byName.get(n.term.param) ?? []
        if (!keys.includes(key)) keys.push(key)
        byName.set(n.term.param, keys)
    }
    for (const p of n.premises) collectShadowBinders(p, byName)
}

// Per-name subscript (so "x_0"/"x_1" reads as "the same x, different
// binding") for every name that's actually bound more than once in the tree,
// keyed by the ctx prefix ending at that binder.
function buildBinderSubs(byName: Map<string, string[]>): Map<string, number> {
    const subs = new Map<string, number>()
    for (const keys of byName.values()) {
        if (keys.length < 2) continue
        keys.forEach((key, sub) => subs.set(key, sub))
    }
    return subs
}

function binderSubAt(
    ctx: Ctx,
    i: number,
    binderSubs: Map<string, number>
): number | undefined {
    return i >= 0 ? binderSubs.get(JSON.stringify(ctx.slice(0, i + 1))) : undefined
}

function varLatex(name: string, sub: number | undefined): string {
    return sub === undefined ? name : `${name}_{${sub}}`
}

// Same shape as termToString, but without param type hints (the LaTeX
// judgment already states the type separately).
function termToString(t: Term, ctx: Ctx, binderSubs: Map<string, number>): string {
    switch (t.kind) {
        case 'var':
            return varLatex(
                t.name,
                binderSubAt(ctx, lookupIndex(ctx, t.name), binderSubs)
            )
        case 'prim':
            return `\\texttt{${t.name}}`
        case 'lit':
            return t.type === 'Bool' ? `\\texttt{${t.value}}` : String(t.value)
        case 'abs': {
            const extended = paramCtxExtension(ctx, t)
            const param = varLatex(
                t.param,
                extended !== ctx ? binderSubs.get(JSON.stringify(extended)) : undefined
            )
            return `λ${param}. ${termToString(t.body, extended, binderSubs)}`
        }
        case 'app': {
            const fn =
                t.fn.kind === 'abs'
                    ? `(${termToString(t.fn, ctx, binderSubs)})`
                    : termToString(t.fn, ctx, binderSubs)
            const arg =
                t.arg.kind === 'var'
                    ? termToString(t.arg, ctx, binderSubs)
                    : `(${termToString(t.arg, ctx, binderSubs)})`
            return `${fn} ${arg}`
        }
    }
}

function escape(s: string): string {
    return s.replace(/→/g, '\\to ').replace(/λ/g, '\\lambda ')
}

function typeToLatex(t: Type): string {
    if (t.kind === 'base') return t.name === TYVAR ? '\\alpha ' : `\\text{${t.name}}`
    const from =
        t.from.kind === 'arrow' ? `(${typeToLatex(t.from)})` : typeToLatex(t.from)
    return `${from} \\to ${typeToLatex(t.to)}`
}

// Renders a Γ's bindings, resolving any shadowed name to its own subscript so
// e.g. "x : Bool, x : Nat" reads as which x is which.
function ctxLatex(ctx: Ctx, binderSubs: Map<string, number>): string {
    return ctx
        .map(
            ([n, t], i) =>
                `${varLatex(escape(n), binderSubAt(ctx, i, binderSubs))} : ${typeToLatex(t)}`
        )
        .join(', ')
}

function envLatex(
    ctx: Ctx,
    labels: Map<string, number>,
    binderSubs: Map<string, number>
): string {
    if (ctx.length === 0) return '\\emptyset'
    const i = labels.get(JSON.stringify(ctx))
    if (i !== undefined) return `\\Gamma_{${i}}`
    return ctxLatex(ctx, binderSubs)
}

function judgment(
    n: ProofNode,
    labels: Map<string, number>,
    binderSubs: Map<string, number>
): string {
    return `${envLatex(n.ctx, labels, binderSubs)} \\vdash ${escape(termToString(n.term, n.ctx, binderSubs))} : ${typeToLatex(n.type)}`
}

function nodeToLatex(
    n: ProofNode,
    labels: Map<string, number>,
    binderSubs: Map<string, number>
): string {
    const concl = `$${judgment(n, labels, binderSubs)}$`
    if (n.rule === 'T-Var') {
        const hyp = `$${escape(termToString(n.term, n.ctx, binderSubs))} : ${typeToLatex(n.type)} \\in ${envLatex(
            n.ctx,
            labels,
            binderSubs
        )}$`
        return `\\AxiomC{${hyp}}\n\\RightLabel{\\scriptsize \\textsc{T-Var}}\n\\UnaryInfC{${concl}}`
    }
    if (n.premises.length === 0) {
        return `\\AxiomC{}\n\\RightLabel{\\scriptsize \\textsc{${n.rule}}}\n\\UnaryInfC{${concl}}`
    }
    const premiseLatex = n.premises
        .map((p) => nodeToLatex(p, labels, binderSubs))
        .join('\n')
    const infer = n.premises.length === 1 ? 'UnaryInfC' : 'BinaryInfC'
    return `${premiseLatex}\n\\RightLabel{\\scriptsize \\textsc{${n.rule}}}\n\\${infer}{${concl}}`
}

export function proofToLatex(root: ProofNode): string {
    const envs = new Map<string, Ctx>()
    collectEnvs(root, envs)
    const entries = [...envs.values()].filter((ctx) => ctx.length > 0)
    const labels = new Map<string, number>(
        entries.map((ctx, i) => [JSON.stringify(ctx), i])
    )

    const byName = new Map<string, string[]>()
    collectShadowBinders(root, byName)
    const binderSubs = buildBinderSubs(byName)

    const legend = entries.map(
        (ctx, i) => `\\[\\Gamma_{${i}} = ${ctxLatex(ctx, binderSubs)}\\]`
    )

    return [
        ...legend,
        '\\begin{prooftree}',
        nodeToLatex(root, labels, binderSubs),
        '\\end{prooftree}'
    ].join('\n')
}
