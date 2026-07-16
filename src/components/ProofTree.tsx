import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode
} from 'react'
import { createPortal, flushSync } from 'react-dom'
import { TYVAR } from '../lambda/primitives'
import { RULES } from '../lambda/rules'
import type { ProofNode } from '../lambda/typecheck'
import type { Ctx, Effect, Term, Type } from '../lambda/types'
import { ctxToString, effectToString, typeToString } from '../lambda/types'
import './ProofTree.css'
import { RuleDiagram } from './RuleDiagram'

const subscript = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])

// Anchors a tooltip to its trigger with `position: fixed` (computed from the
// trigger's viewport rect) instead of `position: absolute`, so it floats over
// .proof-tree-scroll's horizontal scrollbar instead of expanding its
// scrollable content size. Recomputed on scroll/resize while visible so it
// tracks the trigger as the tree scrolls under it.
function useFloatingRect<T extends HTMLElement>() {
    const ref = useRef<T>(null)
    const [rect, setRect] = useState<DOMRect | null>(null)
    const update = () => setRect(ref.current?.getBoundingClientRect() ?? null)
    const hide = () => setRect(null)
    useEffect(() => {
        if (!rect) return
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => {
            window.removeEventListener('scroll', update, true)
            window.removeEventListener('resize', update)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!rect])
    return { ref, rect, show: update, hide }
}

// Golden-angle hue step spreads colors evenly regardless of how many
// distinct environments show up.
const envColor = (i: number) => `hsl(${(i * 137.508) % 360} 70% 45%)`

// Same golden-angle spread, phase-shifted a half-turn so shadowed variable
// badges never land on the same hue as a Γ badge (i and i share a start).
const varColor = (i: number) => `hsl(${(i * 137.508 + 180) % 360} 70% 45%)`

// Same golden-angle spread again, phase-shifted a third turn so effect
// composition colors don't collide with env/var hues at the same index.
const effectColor = (i: number) => `hsl(${(i * 137.508 + 60) % 360} 70% 45%)`

// Stable per-Term view-transition-name so collapsing/expanding animates each
// remaining rule to its new position (and morphs the toggled node) via the
// native View Transitions API. Terms are unique AST objects, so names never
// collide within one tree.
let nextTermId = 0
const termIds = new WeakMap<Term, number>()
function termTransitionName(t: Term) {
    let id = termIds.get(t)
    if (id === undefined) termIds.set(t, (id = nextTermId++))
    return `rule-${id}`
}

// A node can be the source of both its own top-level effect (rendered right
// after its type, e.g. "T !ϵ") and, separately, the latent effect embedded
// inside its own arrow type (e.g. the "!ϵ" inside "A → B !ϵ") — two distinct
// printed locations, so each gets its own optional color rather than one
// overwriting the other.
type EffectHighlight = { own?: string; latent?: string }

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
    hoveredEffectSources: Map<ProofNode, EffectHighlight> | null
    setHoveredEffectSources: (m: Map<ProofNode, EffectHighlight> | null) => void
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
    hoveredEffectSources: null,
    setHoveredEffectSources: () => {},
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

// A colored operand carries the proof node it came from, so the tooltip
// entry and its source in the tree can be highlighted with the same color;
// plain strings are just connective text (" ∘ ", " = ", ...). `kind: 'latent'`
// marks the one operand (T-App's callee arrow effect) that isn't the
// source's own top-level effect annotation but the "!ϵ" embedded inside its
// arrow type — a different printed location, so it needs its own slot.
type EffectSegment = string | { text: string; source: ProofNode; kind?: 'latent' }

// Mirrors typecheck.ts's T-App effect derivation: fn's own effect, then the
// argument's (pinned to the callee's declared param type if the argument was
// still an unresolved `op` marker), then the callee's latent arrow effect —
// composed left-to-right with `∘`.
function appEffectFormula(n: ProofNode): EffectSegment[] | null {
    const [fnNode, argNode] = n.premises
    if (fnNode.type.kind !== 'arrow') return null
    const isPoly = fnNode.type.from.kind === 'base' && fnNode.type.from.name === TYVAR
    const argEffect: Effect =
        !isPoly && argNode.effect === argNode.type ? fnNode.type.from : argNode.effect
    return [
        { text: effectToString(fnNode.effect), source: fnNode },
        ' ∘ ',
        { text: effectToString(argEffect), source: argNode },
        ' ∘ ',
        // The latent arrow effect lives in fn's own type (printed as the
        // trailing "!ϵ" of fn's arrow type), not fn's own effect annotation
        // — same source node, different printed location.
        { text: effectToString(fnNode.type.effect), source: fnNode, kind: 'latent' },
        ` = ${effectToString(n.effect)}`
    ]
}

// Mirrors tryEffect: the handler only contributes when the body isn't
// already pure — spell out which branch actually decided the result.
function tryEffectFormula(n: ProofNode): EffectSegment[] {
    const [bodyNode, handlerNode] = n.premises
    if (bodyNode.effect === 'p') return [`body is pure ⟹ !${effectToString(n.effect)}`]
    return [
        'body ',
        { text: `!${effectToString(bodyNode.effect)}`, source: bodyNode },
        " ⟹ take handler's ",
        { text: `!${effectToString(handlerNode.effect)}`, source: handlerNode }
    ]
}

// Only T-App (∘) and T-Try (•) genuinely combine two sub-effects into a new
// one; every other rule's effect is just copied or looked up, not worth a
// tooltip.
function effectFormula(n: ProofNode): EffectSegment[] | null {
    if (n.rule === 'T-App') return appEffectFormula(n)
    if (n.rule === 'T-Try') return tryEffectFormula(n)
    return null
}

function EffectAnnotation({ n }: { n: ProofNode }) {
    const { hoveredEffectSources, setHoveredEffectSources } = useContext(HoverCtx)
    const { ref: infoRef, rect, show, hide } = useFloatingRect<HTMLSpanElement>()
    const ownColor = hoveredEffectSources?.get(n)?.own
    const formula = effectFormula(n)
    let colorIndex = 0
    const sources = new Map<ProofNode, EffectHighlight>()
    const rendered = formula?.map((seg, i) => {
        if (typeof seg === 'string') return <span key={i}>{seg}</span>
        const color = effectColor(colorIndex++)
        const entry = sources.get(seg.source) ?? {}
        if (seg.kind === 'latent') entry.latent = color
        else entry.own = color
        sources.set(seg.source, entry)
        return (
            <span
                key={i}
                className="effect-part active"
                style={{ '--effect-color': color } as CSSProperties}
            >
                {seg.text}
            </span>
        )
    })
    return (
        <>
            {' '}
            <span
                className={`effect-part${ownColor ? ' active' : ''}`}
                style={
                    ownColor
                        ? ({ '--effect-color': ownColor } as CSSProperties)
                        : undefined
                }
            >
                !{effectToString(n.effect)}
            </span>
            {formula && (
                <span
                    ref={infoRef}
                    className="effect-info"
                    tabIndex={0}
                    onMouseEnter={() => {
                        setHoveredEffectSources(sources)
                        show()
                    }}
                    onMouseLeave={() => {
                        setHoveredEffectSources(null)
                        hide()
                    }}
                    onFocus={() => {
                        setHoveredEffectSources(sources)
                        show()
                    }}
                    onBlur={() => {
                        setHoveredEffectSources(null)
                        hide()
                    }}
                >
                    ?
                    {rect &&
                        createPortal(
                            <span
                                className="effect-tooltip"
                                style={{
                                    left: rect.left + rect.width / 2,
                                    top: rect.top
                                }}
                            >
                                {rendered}
                            </span>,
                            document.getElementById('root')!
                        )}
                </span>
            )}
        </>
    )
}

// Colors the trailing "!ϵ" of an arrow type in place. exn.pdf's printing
// convention (typeToString in types.ts) puts exactly one such latent-effect
// marker at the very end of the outermost arrow, so there's exactly one
// spot to target — everything else prints the same as typeToString.
function typeNode(t: Type, showEffect: boolean, latentColor?: string): ReactNode {
    if (!showEffect || t.kind !== 'arrow') return typeToString(t, showEffect)
    const from =
        t.from.kind === 'arrow'
            ? `(${typeToString(t.from, showEffect)})`
            : typeToString(t.from, showEffect)
    const to =
        t.to.kind === 'arrow'
            ? `(${typeToString(t.to, showEffect)})`
            : typeToString(t.to, showEffect)
    return (
        <>
            {from} → {to}{' '}
            {/* Always wrapped (border reserved even when inactive) so
                hovering doesn't change this span's width and shift layout. */}
            <span
                className={`effect-part${latentColor ? ' active' : ''}`}
                style={
                    latentColor
                        ? ({ '--effect-color': latentColor } as CSSProperties)
                        : undefined
                }
            >
                !{effectToString(t.effect)}
            </span>
        </>
    )
}

function RuleName({
    rule,
    showEffects
}: {
    rule: ProofNode['rule']
    showEffects: boolean
}) {
    const { ref, rect, show, hide } = useFloatingRect<HTMLSpanElement>()
    return (
        <span
            ref={ref}
            className="rule-name"
            tabIndex={0}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {rule}
            {rect &&
                createPortal(
                    <span
                        className="effect-tooltip rule-tooltip"
                        style={{ left: rect.right, top: rect.bottom }}
                    >
                        <RuleDiagram
                            premises={RULES[rule].premises(showEffects)}
                            conclusion={RULES[rule].conclusion(showEffects)}
                            name={rule}
                        />
                    </span>,
                    document.getElementById('root')!
                )}
        </span>
    )
}

function Judgment({ n, labels }: { n: ProofNode; labels: Labels }) {
    const { compact, exceptions, effects, hoveredEffectSources } = useContext(HoverCtx)
    const showEffects = exceptions || effects
    return (
        <span className="judgment">
            {!compact && (
                // inline-block + own view-transition-name so compact toggling
                // fades this prefix in place instead of sliding it around
                // inside the rule's morphing snapshot.
                <span
                    style={{
                        display: 'inline-block',
                        viewTransitionName: `env-${termTransitionName(n.term)}`
                    }}
                >
                    {envNode(n.ctx, labels.envs)}{' '}
                    <span className="judgment-separator">⊢</span>
                </span>
            )}
            {!compact && ' '}
            {termNode(n.term, n.ctx, labels.binders)}{' '}
            <span className="judgment-separator">:</span>{' '}
            {typeNode(n.type, showEffects, hoveredEffectSources?.get(n)?.latent)}
            {showEffects && <EffectAnnotation n={n} />}
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
        hoveredEffectSources,
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
    const envStyle = {
        ...(isMergedEnvRoot ? { '--env-color': envColor(envIndex) } : undefined),
        viewTransitionName: termTransitionName(n.term)
    } as CSSProperties

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
                    D{subscript(idx)} ⇒ {termNode(n.term, n.ctx, labels.binders)} :{' '}
                    {typeNode(n.type, showEffects, hoveredEffectSources?.get(n)?.latent)}
                    {showEffects && <EffectAnnotation n={n} />}
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

    if (n.open) {
        return (
            <div
                className={`rule open${active ? ' active' : ''}${
                    isMergedEnvRoot
                        ? ` compact-env${envVisible ? ' env-visible' : ''}`
                        : ''
                }`}
                style={envStyle}
                onMouseLeave={() => setHoveredTerm(null)}
                title="unjustified premise: asserted, not derived"
            >
                <Judgment n={n} labels={labels} />
            </div>
        )
    }

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
                        {typeNode(
                            n.type,
                            showEffects,
                            hoveredEffectSources?.get(n)?.latent
                        )}
                        {showEffects && <EffectAnnotation n={n} />}
                        {!compact && (
                            <>
                                {' '}
                                <span
                                    style={{
                                        display: 'inline-block',
                                        viewTransitionName: `in-${termTransitionName(n.term)}`
                                    }}
                                >
                                    ∈ {envNode(n.ctx, labels.envs)}
                                </span>
                            </>
                        )}
                    </span>
                </div>
                <div
                    className="line"
                    style={{
                        viewTransitionName: `line-${termTransitionName(n.term)}`
                    }}
                >
                    <RuleName rule="T-Var" showEffects={showEffects} />
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
            <div
                className="line"
                style={{ viewTransitionName: `line-${termTransitionName(n.term)}` }}
            >
                <RuleName rule={n.rule} showEffects={showEffects} />
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
    const [hoveredEffectSources, setHoveredEffectSources] = useState<Map<
        ProofNode,
        EffectHighlight
    > | null>(null)
    const [collapsed, setCollapsed] = useState<Set<Term>>(new Set())
    const [copied, setCopied] = useState(false)
    // ponytail: native View Transitions animate the reflow; browsers
    // without it just snap, no polyfill.
    const withViewTransition = (update: () => void) => {
        if (
            document.startViewTransition &&
            !('reduceMotion' in document.documentElement.dataset)
        )
            document.startViewTransition(() => flushSync(update))
        else update()
    }
    const toggleCollapse = (t: Term) =>
        withViewTransition(() =>
            setCollapsed((prev) => {
                const next = new Set(prev)
                if (next.has(t)) next.delete(t)
                else next.add(t)
                return next
            })
        )
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
                hoveredEffectSources,
                setHoveredEffectSources,
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
                        aria-pressed={compact}
                        title="Toggle compact (sequent-style) judgments"
                        onClick={() => withViewTransition(() => setCompact((v) => !v))}
                    >
                        ▷ Compact
                    </button>
                    <span className="copy-latex-wrap">
                        <button
                            type="button"
                            className="style-toggle icon-toggle"
                            title="Copy LaTeX to clipboard"
                            onClick={() => {
                                if (!latex) return
                                navigator.clipboard.writeText(latex)
                                setCopied(true)
                                setTimeout(() => setCopied(false), 1500)
                            }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <rect x="9" y="9" width="12" height="12" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                        </button>
                        {copied && <span className="copy-latex-popup">Copied!</span>}
                    </span>
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
