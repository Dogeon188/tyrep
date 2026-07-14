import { createContext, useContext, useState, type CSSProperties } from 'react'
import type { ProofNode } from './typecheck'
import type { Ctx } from './types'
import { ctxToString, termToString, typeToString } from './types'
import './ProofTree.css'

const subscript = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])

// Golden-angle hue step spreads colors evenly regardless of how many
// distinct environments show up.
const envColor = (i: number) => `hsl(${(i * 137.508) % 360} 70% 45%)`

// Which environment index is currently hovered, so every badge sharing that
// index (across the tree and the legend) can light up its bounding box.
const HoverCtx = createContext<{ hovered: number | null; setHovered: (i: number | null) => void }>({
  hovered: null,
  setHovered: () => {},
})

// Distinct contexts repeat across many judgments; label them Γ₀, Γ₁, ... in
// first-appearance order so the tree can reference them instead of spelling
// each one out.
function collectEnvs(n: ProofNode, envs: Map<string, Ctx>) {
  const key = JSON.stringify(n.ctx)
  if (!envs.has(key)) envs.set(key, n.ctx)
  for (const p of n.premises) collectEnvs(p, envs)
}

function EnvBadge({ i }: { i: number }) {
  const { hovered, setHovered } = useContext(HoverCtx)
  return (
    <span
      className={`env-badge${hovered === i ? ' active' : ''}`}
      style={{ '--env-color': envColor(i) } as CSSProperties}
      onMouseEnter={() => setHovered(i)}
      onMouseLeave={() => setHovered(null)}
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

function Judgment({ n, labels }: { n: ProofNode; labels: Map<string, number> }) {
  return (
    <span className="judgment">
      {envNode(n.ctx, labels)} ⊢ {termToString(n.term)} : {typeToString(n.type)}
    </span>
  )
}

function Rule({ n, labels }: { n: ProofNode; labels: Map<string, number> }) {
  if (n.rule === 'T-Var') {
    return (
      <div className="rule">
        <div className="premises">
          <span className="judgment">
            {termToString(n.term)} : {typeToString(n.type)} ∈ {envNode(n.ctx, labels)}
          </span>
        </div>
        <div className="line">
          <span className="rule-name">T-Var</span>
        </div>
        <Judgment n={n} labels={labels} />
      </div>
    )
  }
  return (
    <div className="rule">
      <div className="premises">
        {n.premises.map((p, i) => (
          <Rule key={i} n={p} labels={labels} />
        ))}
      </div>
      <div className="line">
        <span className="rule-name">{n.rule}</span>
      </div>
      <Judgment n={n} labels={labels} />
    </div>
  )
}

export function ProofTree({ root }: { root: ProofNode }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const envs = new Map<string, Ctx>()
  collectEnvs(root, envs)
  const entries = [...envs.values()].filter((ctx) => ctx.length > 0)
  const labels = new Map<string, number>(entries.map((ctx, i) => [JSON.stringify(ctx), i]))

  return (
    <HoverCtx.Provider value={{ hovered, setHovered }}>
      <div className="proof-tree-panel">
        <div className="proof-tree">
          <Rule n={root} labels={labels} />
        </div>
        {entries.length > 0 && (
          <div className="environment-legend">
            {entries.map((ctx, i) => (
              <div key={i} className="environment-entry">
                <EnvBadge i={i} /> = {ctxToString(ctx)}
              </div>
            ))}
          </div>
        )}
      </div>
    </HoverCtx.Provider>
  )
}
