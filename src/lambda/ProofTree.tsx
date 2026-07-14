import type { ProofNode } from './typecheck'
import type { Ctx } from './types'
import { ctxToString, termToString, typeToString } from './types'
import './ProofTree.css'

const subscript = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])

// Distinct contexts repeat across many judgments; label them Γ₀, Γ₁, ... in
// first-appearance order so the tree can reference them instead of spelling
// each one out.
function collectEnvs(n: ProofNode, envs: Map<string, Ctx>) {
  const key = JSON.stringify(n.ctx)
  if (!envs.has(key)) envs.set(key, n.ctx)
  for (const p of n.premises) collectEnvs(p, envs)
}

function envLabel(ctx: Ctx, labels: Map<string, string>): string {
  return ctx.length === 0 ? '∅' : (labels.get(JSON.stringify(ctx)) ?? ctxToString(ctx))
}

function Judgment({ n, labels }: { n: ProofNode; labels: Map<string, string> }) {
  return (
    <span className="judgment">
      {envLabel(n.ctx, labels)} ⊢ {termToString(n.term)} : {typeToString(n.type)}
    </span>
  )
}

function Rule({ n, labels }: { n: ProofNode; labels: Map<string, string> }) {
  if (n.rule === 'T-Var') {
    return (
      <div className="rule">
        <div className="premises">
          <span className="judgment">
            {termToString(n.term)} : {typeToString(n.type)} ∈ {envLabel(n.ctx, labels)}
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
  const envs = new Map<string, Ctx>()
  collectEnvs(root, envs)
  const entries = [...envs.values()].filter((ctx) => ctx.length > 0)
  const labels = new Map(entries.map((ctx, i) => [JSON.stringify(ctx), `Γ${subscript(i)}`]))

  return (
    <div className="proof-tree-panel">
      <div className="proof-tree">
        <Rule n={root} labels={labels} />
      </div>
      {entries.length > 0 && (
        <div className="environment-legend">
          {entries.map((ctx, i) => (
            <div key={i} className="environment-entry">
              Γ{subscript(i)} = {ctxToString(ctx)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
