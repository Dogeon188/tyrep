import { useMemo, useState } from 'react'
import './App.css'
import { parseCtxString, parseTermString } from './lambda/parser'
import { derive } from './lambda/typecheck'
import { proofToLatex } from './lambda/latex'
import { ProofTree } from './lambda/ProofTree'
import { typeToString, termToFullString } from './lambda/types'
import { ThemeSwitcher } from './ThemeSwitcher'

const EXAMPLE = {
  ctx: '',
  term: 'λx:b -> b -> b. λy:b. x y y',
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

  return (
    <>
      <div className="inputs">
        <label>
          Context (Γ)
          <textarea rows={3} value={ctxSrc} onChange={(e) => setCtxSrc(e.target.value)} />
          <div className="syntax-hint">
            one binding per line/comma: x : T
            <br/>
            types: base name | T -&gt; T (right-assoc) | (T)
          </div>
        </label>
        <label>
          Expression (annotate lambdas: λx:T. e)
          <textarea rows={3} value={termSrc} onChange={(e) => setTermSrc(e.target.value)} />
          <div className="syntax-hint">
            lambda: λx.e | \x.e | fn x =&gt; e
            <br/>
            application: f x
            <br/>
            arrow type: T -&gt; T
          </div>
          {fullForm && <div className="full-form">{fullForm}</div>}
        </label>
      </div>

      {result.error && <div className="error">{result.error}</div>}

      {result.root && (
        <div className="output">
          <div className="result-type">Result type: {typeToString(result.root.type)}</div>
          <ProofTree root={result.root} />
          <textarea className="latex-output" readOnly value={proofToLatex(result.root)} />
        </div>
      )}

      <ThemeSwitcher />
    </>
  )
}

export default App
