import {
    createContext,
    useContext,
    useState,
    type CSSProperties,
    type ReactNode
} from 'react'
import type { ProofNode } from '../lambda/typecheck'
import type { Ctx, Term } from '../lambda/types'
import { ctxToString, effectToString, typeToString } from '../lambda/types'
import './ProofTree.css'

const subscript = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])

// Golden-angle hue step spreads colors evenly regardless of how many
// distinct environments show up.
const envColor = (i: number) => `hsl(${(i * 137.508) % 360} 70% 45%)`

// Same golden-angle spread, phase-shifted a half-turn so shadowed variable
// badges never land on the same hue as a Γ badge (i and i share a start).
const varColor = (i: number) => `hsl(${(i * 137.508 + 180) % 360} 70% 45%)`

// Which badge is currently hovered, so every badge sharing that key (across
// the tree and the legend) can light up its bounding box. Keyed by
// "env:<i>"/"var:<color>" so environment and variable badges never collide.
// hoveredTerm tracks the exact AST node (by reference) under the pointer, so
// hovering a subterm anywhere it's printed can light up the one proof-tree
// rule that actually derives it.
const HoverCtx = createContext<{
    hovered: string | null
    setHovered: (key: string | null) => void
    hoveredEnv: number | null
    setHoveredEnv: (i: number | null) => void
    hoveredTerm: Term | null
    setHoveredTerm: (t: Term | null) => void
    collapsed: Set<Term>
    toggleCollapse: (t: Term) => void
    compact: boolean
    exceptions: boolean
    effects: boolean
}>({
    hovered: null,
    setHovered: () => {},
    hoveredEnv: null,
    setHoveredEnv: () => {},
    hoveredTerm: null,
    setHoveredTerm: () => {},
    collapsed: new Set(),
    toggleCollapse: () => {},
    compact: false,
    exceptions: false,
    effects: false
})

// Distinct contexts repeat across many judgments; label them Γ₀, Γ₁, ... in
// first-appearance order so the tree can reference them instead of spelling
// each one out.
function collectEnvs(n: ProofNode, envs: Map<string, Ctx>) {
    const key = JSON.stringify(n.ctx)
    if (!envs.has(key)) envs.set(key, n.ctx)
    for (const p of n.premises) collectEnvs(p, envs)
}

// Collapsed subtrees are folded into a "D_i ⊢ type" placeholder; index them
// in first-appearance order and stop descending once a node is collapsed,
// since its premises no longer need labels.
function collectCollapseIndices(
    n: ProofNode,
    collapsed: Set<Term>,
    indices: Map<Term, number>
) {
    if (collapsed.has(n.term)) {
        indices.set(n.term, indices.size)
        return
    }
    for (const p of n.premises) collectCollapseIndices(p, collapsed, indices)
}

function EnvBadge({ i }: { i: number }) {
    const { hoveredEnv } = useContext(HoverCtx)
    return (
        <span
            className={`env-badge${hoveredEnv === i ? ' active' : ''}`}
            style={{ '--env-color': envColor(i) } as CSSProperties}
        >
            Γ{subscript(i)}
        </span>
    )
}

function envNode(ctx: Ctx, labels: Map<string, number>) {
    if (ctx.length === 0) return '∅'
    const i = labels.get(JSON.stringify(ctx))
    return i === undefined ? ctxToString(ctx) : <EnvBadge i={i} />
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

type BinderLabel = { color: number; sub: number }

// Global color index (so hues stay spread out) + a per-name subscript (so
// "x₀"/"x₁" reads as "the same x, different binding") for every name that's
// actually bound more than once somewhere in the tree.
function buildBinderLabels(byName: Map<string, string[]>): Map<string, BinderLabel> {
    const labels = new Map<string, BinderLabel>()
    let color = 0
    for (const keys of byName.values()) {
        if (keys.length < 2) continue
        keys.forEach((key, sub) => labels.set(key, { color: color++, sub }))
    }
    return labels
}

function VarBadge({ name, label }: { name: string; label: BinderLabel }) {
    const { hovered, setHovered } = useContext(HoverCtx)
    const key = `var:${label.color}`
    return (
        <span
            className={`var-badge${hovered === key ? ' active' : ''}`}
            style={{ '--env-color': varColor(label.color) } as CSSProperties}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
        >
            {name}
            {subscript(label.sub)}
        </span>
    )
}

// The binder a ctx slot belongs to is identified by the prefix ending at
// that slot — same key scheme collectShadowBinders registers under.
function binderLabelAt(
    ctx: Ctx,
    i: number,
    binderLabels: Map<string, BinderLabel>
): BinderLabel | undefined {
    return i >= 0 ? binderLabels.get(JSON.stringify(ctx.slice(0, i + 1))) : undefined
}

// Every subterm is a distinct AST object (the parser never shares nodes), so
// reference equality against hoveredTerm uniquely picks out this one node
// even when the same name/shape recurs elsewhere in the expression.
function TermHover({ term, children }: { term: Term; children: ReactNode }) {
    const { hoveredTerm, setHoveredTerm } = useContext(HoverCtx)
    return (
        <span
            className={`term-span${hoveredTerm === term ? ' active' : ''}`}
            onMouseOver={(e) => {
                e.stopPropagation()
                setHoveredTerm(term)
            }}
        >
            {children}
        </span>
    )
}

function termNode(
    term: Term,
    ctx: Ctx,
    binderLabels: Map<string, BinderLabel>
): ReactNode {
    return <TermHover term={term}>{termNodeInner(term, ctx, binderLabels)}</TermHover>
}

function termNodeInner(
    term: Term,
    ctx: Ctx,
    binderLabels: Map<string, BinderLabel>
): ReactNode {
    switch (term.kind) {
        case 'var': {
            const i = lookupIndex(ctx, term.name)
            const label = binderLabelAt(ctx, i, binderLabels)
            return label ? <VarBadge name={term.name} label={label} /> : term.name
        }
        case 'lit':
            return String(term.value)
        case 'prim':
            return term.name
        case 'error':
            return 'error'
        case 'op':
            return 'op'
        case 'try':
            return (
                <>
                    try {termNode(term.body, ctx, binderLabels)} with{' '}
                    {termNode(term.handler, ctx, binderLabels)}
                </>
            )
        case 'handle':
            return (
                <>
                    handle {termNode(term.body, ctx, binderLabels)} with {'{'}
                    {term.x}. {termNode(term.er, ctx, binderLabels)}; {term.k}.{' '}
                    {termNode(term.eo, ctx, binderLabels)}
                    {'}'}
                </>
            )
        case 'abs': {
            const extended = paramCtxExtension(ctx, term)
            const label =
                extended !== ctx ? binderLabels.get(JSON.stringify(extended)) : undefined
            return (
                <>
                    λ{label ? <VarBadge name={term.param} label={label} /> : term.param}.{' '}
                    {termNode(term.body, extended, binderLabels)}
                </>
            )
        }
        case 'app': {
            const fn =
                term.fn.kind === 'abs' ||
                term.fn.kind === 'try' ||
                term.fn.kind === 'handle' ? (
                    <>({termNode(term.fn, ctx, binderLabels)})</>
                ) : (
                    termNode(term.fn, ctx, binderLabels)
                )
            const arg =
                term.arg.kind === 'var' ||
                term.arg.kind === 'lit' ||
                term.arg.kind === 'prim' ||
                term.arg.kind === 'error' ||
                term.arg.kind === 'op' ? (
                    termNode(term.arg, ctx, binderLabels)
                ) : (
                    <>({termNode(term.arg, ctx, binderLabels)})</>
                )
            return (
                <>
                    {fn} {arg}
                </>
            )
        }
    }
}

type Labels = {
    envs: Map<string, number>
    binders: Map<string, BinderLabel>
    collapseIndices: Map<Term, number>
}

function Judgment({ n, labels }: { n: ProofNode; labels: Labels }) {
    const { compact, exceptions, effects } = useContext(HoverCtx)
    const showEffects = exceptions || effects
    return (
        <span className="judgment">
            {!compact && (
                <>
                    {envNode(n.ctx, labels.envs)}{' '}
                    <span className="judgment-separator">⊢</span>{' '}
                </>
            )}
            {termNode(n.term, n.ctx, labels.binders)}{' '}
            <span className="judgment-separator">:</span>{' '}
            {typeToString(n.type, showEffects)}
            {showEffects && ` !${effectToString(n.effect)}`}
        </span>
    )
}

function Rule({
    n,
    labels,
    parentEnvIndex = null
}: {
    n: ProofNode
    labels: Labels
    parentEnvIndex?: number | null
}) {
    const {
        hoveredTerm,
        hoveredEnv,
        setHoveredTerm,
        collapsed,
        toggleCollapse,
        compact,
        exceptions,
        effects
    } = useContext(HoverCtx)
    const showEffects = exceptions || effects
    const active = n.term === hoveredTerm
    const envIndex = labels.envs.get(JSON.stringify(n.ctx))
    const isMergedEnvRoot =
        compact && envIndex !== undefined && envIndex !== parentEnvIndex
    const envVisible = isMergedEnvRoot && hoveredEnv === envIndex
    const envStyle = isMergedEnvRoot
        ? ({ '--env-color': envColor(envIndex) } as CSSProperties)
        : undefined

    if (collapsed.has(n.term)) {
        const idx = labels.collapseIndices.get(n.term)!
        return (
            <div
                className={`rule collapsed${active ? ' active' : ''}${
                    isMergedEnvRoot
                        ? ` compact-env${envVisible ? ' env-visible' : ''}`
                        : ''
                }`}
                style={envStyle}
                onMouseLeave={() => setHoveredTerm(null)}
            >
                <span
                    className="judgment collapse-toggle"
                    onClick={() => toggleCollapse(n.term)}
                >
                    D{subscript(idx)} ⊢ {termNode(n.term, n.ctx, labels.binders)} :{' '}
                    {typeToString(n.type, showEffects)}
                    {showEffects && ` !${effectToString(n.effect)}`}
                </span>
            </div>
        )
    }

    const foldToggle = (
        <span
            className="collapse-toggle"
            title="Collapse this subtree"
            onClick={() => toggleCollapse(n.term)}
        >
            ⊟
        </span>
    )

    if (n.rule === 'T-Var') {
        return (
            <div
                className={`rule${active ? ' active' : ''}${
                    isMergedEnvRoot
                        ? ` compact-env${envVisible ? ' env-visible' : ''}`
                        : ''
                }`}
                style={envStyle}
                onMouseLeave={() => setHoveredTerm(null)}
            >
                <div className="premises">
                    <span className="judgment">
                        {termNode(n.term, n.ctx, labels.binders)}{' '}
                        <span className="judgment-separator">:</span>{' '}
                        {typeToString(n.type, showEffects)}
                        {showEffects && ` !${effectToString(n.effect)}`}
                        {!compact && <> ∈ {envNode(n.ctx, labels.envs)}</>}
                    </span>
                </div>
                <div className="line">
                    <span className="rule-name">T-Var</span>
                    {foldToggle}
                </div>
                <Judgment n={n} labels={labels} />
            </div>
        )
    }
    return (
        <div
            className={`rule${active ? ' active' : ''}${
                isMergedEnvRoot ? ` compact-env${envVisible ? ' env-visible' : ''}` : ''
            }`}
            style={envStyle}
            onMouseLeave={() => setHoveredTerm(null)}
        >
            <div className="premises">
                {n.premises.map((p, i) => (
                    <Rule
                        key={i}
                        n={p}
                        labels={labels}
                        parentEnvIndex={envIndex ?? parentEnvIndex}
                    />
                ))}
            </div>
            <div className="line">
                <span className="rule-name">{n.rule}</span>
                {foldToggle}
            </div>
            <Judgment n={n} labels={labels} />
        </div>
    )
}

export function ProofTree({
    root,
    latex,
    compact,
    setCompact,
    exceptions,
    effects
}: {
    root: ProofNode
    latex?: string
    compact: boolean
    setCompact: (v: boolean | ((prev: boolean) => boolean)) => void
    exceptions: boolean
    effects: boolean
}) {
    const [hovered, setHovered] = useState<string | null>(null)
    const [hoveredEnv, setHoveredEnv] = useState<number | null>(null)
    const [hoveredTerm, setHoveredTerm] = useState<Term | null>(null)
    const [collapsed, setCollapsed] = useState<Set<Term>>(new Set())
    const [copied, setCopied] = useState(false)
    const toggleCollapse = (t: Term) =>
        setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(t)) next.delete(t)
            else next.add(t)
            return next
        })
    const envs = new Map<string, Ctx>()
    collectEnvs(root, envs)
    const entries = [...envs.values()].filter((ctx) => ctx.length > 0)
    const byName = new Map<string, string[]>()
    collectShadowBinders(root, byName)
    const collapseIndices = new Map<Term, number>()
    collectCollapseIndices(root, collapsed, collapseIndices)
    const labels: Labels = {
        envs: new Map(entries.map((ctx, i) => [JSON.stringify(ctx), i])),
        binders: buildBinderLabels(byName),
        collapseIndices
    }

    return (
        <HoverCtx.Provider
            value={{
                hovered,
                setHovered,
                hoveredEnv,
                setHoveredEnv,
                hoveredTerm,
                setHoveredTerm,
                collapsed,
                toggleCollapse,
                compact,
                exceptions,
                effects
            }}
        >
            <div className={`proof-tree-panel${compact ? ' compact' : ''}`}>
                <div className="proof-tree-actions">
                    <button
                        type="button"
                        className="style-toggle"
                        title="Copy LaTeX to clipboard"
                        onClick={() => {
                            if (!latex) return
                            navigator.clipboard.writeText(latex)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1500)
                        }}
                    >
                        {copied ? 'Copied!' : 'Copy LaTeX'}
                    </button>
                    <button
                        type="button"
                        className="style-toggle"
                        aria-pressed={compact}
                        title="Toggle compact (sequent-style) judgments"
                        onClick={() => setCompact((v) => !v)}
                    >
                        ▷ Compact
                    </button>
                </div>
                <div className="proof-tree">
                    <Rule n={root} labels={labels} />
                </div>
                {entries.length > 0 && (
                    <div className="environment-legend">
                        {entries.map((ctx, i) => (
                            <section
                                key={i}
                                className="environment-entry"
                                onMouseEnter={() => setHoveredEnv(i)}
                                onMouseLeave={() => setHoveredEnv(null)}
                            >
                                <div className="environment-entry-title">
                                    <EnvBadge i={i} />
                                </div>
                                <table className="environment-table">
                                    <tbody>
                                        {ctx.map(([name, type], pairIndex) => (
                                            <tr key={pairIndex}>
                                                <th scope="row">
                                                    {(() => {
                                                        const label = binderLabelAt(
                                                            ctx,
                                                            pairIndex,
                                                            labels.binders
                                                        )
                                                        return label ? (
                                                            <VarBadge
                                                                name={name}
                                                                label={label}
                                                            />
                                                        ) : (
                                                            name
                                                        )
                                                    })()}
                                                </th>
                                                <td className="environment-table-separator">
                                                    :
                                                </td>
                                                <td>
                                                    {typeToString(
                                                        type,
                                                        exceptions || effects
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </HoverCtx.Provider>
    )
}
