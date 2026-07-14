import { useMemo, useRef, useState } from 'react'
import { Calligraph } from 'calligraph'
import './App.css'
import { parseCtxString, parseTermString } from './lambda/parser'
import { derive } from './lambda/typecheck'
import { proofToLatex } from './lambda/latex'
import { ProofTree } from './components/ProofTree'
import { TypeRulesModal } from './components/TypeRulesModal'
import { typeToString, termToFullString } from './lambda/types'
import { ThemeSwitcher } from './ThemeSwitcher'

const EXAMPLE = {
  ctx: 'x : b -> b -> b',
  term: 'λx. λy:b. x y y',
}

function App() {
  const [ctxSrc, setCtxSrc] = useState(EXAMPLE.ctx)
  const [termSrc, setTermSrc] = useState(EXAMPLE.term)
  const [primitives, setPrimitives] = useState(false)
  const rulesDialogRef = useRef<HTMLDialogElement>(null)

  const result = useMemo(() => {
    try {
      const ctx = parseCtxString(ctxSrc)
      const term = parseTermString(termSrc, { primitives })
      const root = derive(ctx, term)
      return { root, error: null }
    } catch (e) {
      return { root: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [ctxSrc, termSrc, primitives])

  const fullForm = useMemo(() => {
    try {
      return termToFullString(parseTermString(termSrc, { primitives }))
    } catch {
      return null
    }
  }, [termSrc, primitives])

  const latex = useMemo(() => (result.root ? proofToLatex(result.root) : ''), [result.root])
  const [copied, setCopied] = useState(false)

  return (
    <>
      <div className="inputs">
        <label>
          <span className="input-label">Context (Γ)</span>
          <div className="input-row">
            <textarea rows={3} value={ctxSrc} onChange={(e) => setCtxSrc(e.target.value)} />
            <div className="syntax-hint">
              <span>one binding per line/comma: <code>x : T</code></span>
              <br/>
              <span>types: <em>type-name</em> | <code>(T)</code> | <code>T -&gt; T</code> or <code>T → T</code> (right-assoc)</span>
            </div>
          </div>
        </label>
        <label>
          <span className="input-label">
            Expression
            <button
              type="button"
              className="primitives-toggle"
              aria-pressed={primitives}
              onClick={() => setPrimitives((v) => !v)}
            >
              BoolInt
            </button>
            <button type="button" className="primitives-toggle" onClick={() => rulesDialogRef.current?.showModal()}>
              Type Rules
            </button>
          </span>
          <div className="input-row">
            <textarea rows={3} value={termSrc} onChange={(e) => setTermSrc(e.target.value)} />
            <div className="syntax-hint">
              <span>lambda: <code>λx.e</code> or <code>\x.e</code> or <code>fn x =&gt; e</code></span>
              <br/>
              <span>annotated lambda: <code>λx:T. e</code></span>
              <br/>
              <span>inline annotation wins Γ if both are given</span>
              <hr/>
              <span>application: <code>f x</code></span>
              <br/>
              <span>arrow type: <code>T -&gt; T</code> or <code>T → T</code></span>
              {primitives && (
                <>
                  <hr/>
                  <span>literals: <code>true</code> | <code>false</code> | <code>0</code>, <code>1</code>, ...</span>
                  <br/>
                  <span>primitives: <code>neg</code> | <code>add1</code> | <code>eq</code> — see Type Rules</span>
                </>
              )}
            </div>
          </div>
          {fullForm && (
            <div className="full-form">
              <Calligraph>{fullForm}</Calligraph>
            </div>
          )}
        </label>
      </div>

      {result.error && <div className="error">{result.error}</div>}

      {result.root && (
        <div className="output">
          <div className="result-type">
            Result type: <Calligraph>{typeToString(result.root.type)}</Calligraph>
          </div>

          <div className="latex-panel">
            <div className="proof-tree-scroll">
              <ProofTree root={result.root} />
            </div>
            <div className="latex-panel-actions">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(latex)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? 'Copied!' : 'Copy LaTeX'}
              </button>
            </div>
            <textarea className="latex-output" readOnly value={latex} hidden />
          </div>
        </div>
      )}

      <TypeRulesModal dialogRef={rulesDialogRef} primitives={primitives} />

      <ThemeSwitcher />
    </>
  )
}

export default App
