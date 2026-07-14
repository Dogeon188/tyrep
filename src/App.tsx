import { useMemo, useState } from 'react'
import './App.css'
import { parseCtxString, parseTermString } from './lambda/parser'
import { derive } from './lambda/typecheck'
import { proofToLatex } from './lambda/latex'
import { ProofTree } from './lambda/ProofTree'
import { typeToString, termToFullString } from './lambda/types'
import { ThemeSwitcher } from './ThemeSwitcher'

const EXAMPLE = {
  ctx: 'x : b -> b -> b',
  term: 'λx. λy:b. x y y',
}

function App() {
  const [ctxSrc, setCtxSrc] = useState(EXAMPLE.ctx)
  const [termSrc, setTermSrc] = useState(EXAMPLE.term)

  const result = useMemo(() => {
    try {
      const ctx = parseCtxString(ctxSrc)
      const term = parseTermString(termSrc)
      const root = derive(ctx, term)
      return { root, error: null }
    } catch (e) {
      return { root: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [ctxSrc, termSrc])

  const fullForm = useMemo(() => {
    try {
      return termToFullString(parseTermString(termSrc))
    } catch {
      return null
    }
  }, [termSrc])

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
              <span>types: <code>basename</code> | <code>T -&gt; T</code> or <code>T → T</code> (right-assoc) | <code>(T)</code></span>
            </div>
          </div>
        </label>
        <label>
          <span className="input-label">
            Expression
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
            </div>
          </div>
          {fullForm && <div className="full-form">{fullForm}</div>}
        </label>
      </div>

      {result.error && <div className="error">{result.error}</div>}

      {result.root && (
        <div className="output">
          <div className="result-type">Result type: {typeToString(result.root.type)}</div>

          {/* ponytail: placeholder only, interactive canvas rendering not implemented yet */}
          <canvas className="derivation-canvas" />

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

      <ThemeSwitcher />
    </>
  )
}

export default App
