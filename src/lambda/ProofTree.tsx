import type { ProofNode } from './typecheck'
import { ctxToString, termToString, typeToString } from './types'

function Judgment({ n }: { n: ProofNode }) {
  return (
    <span className="judgment">
      {ctxToString(n.ctx)} ⊢ {termToString(n.term)} : {typeToString(n.type)}
    </span>
  )
}

function Rule({ n }: { n: ProofNode }) {
  if (n.rule === 'T-Var') {
    return (
      <div className="rule">
        <div className="premises">
          <span className="judgment">
            {termToString(n.term)} : {typeToString(n.type)} ∈ {ctxToString(n.ctx)}
          </span>
        </div>
        <div className="line">
          <span className="rule-name">T-Var</span>
        </div>
        <Judgment n={n} />
      </div>
    )
  }
  return (
    <div className="rule">
      <div className="premises">
        {n.premises.map((p, i) => (
          <Rule key={i} n={p} />
        ))}
      </div>
      <div className="line">
        <span className="rule-name">{n.rule}</span>
      </div>
      <Judgment n={n} />
    </div>
  )
}

export function ProofTree({ root }: { root: ProofNode }) {
  return (
    <div className="proof-tree">
      <Rule n={root} />
    </div>
  )
}
