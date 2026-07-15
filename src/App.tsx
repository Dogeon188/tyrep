import { useMemo, useRef, useState } from 'react'
import { Calligraph } from 'calligraph'
import './App.css'
import { parseCtxString, parseTermString } from './lambda/parser'
import { derive } from './lambda/typecheck'
import { proofToLatex } from './lambda/latex'
import { ProofTree } from './components/ProofTree'
import { TypeRulesModal } from './components/TypeRulesModal'
import { LabeledTextarea } from './components/LabeledTextarea'
import { typeToString, termToFullString } from './lambda/types'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { GithubLink } from './components/GithubLink'

const EXAMPLE = {
    ctx: 'x : b -> b -> b',
    term: 'λx. λy:b. x y y'
}

const PRESETS = [
    { name: 'Identity', ctx: '', term: 'λx:b. x', primitives: false },
    { name: 'Const', ctx: '', term: 'λx:b. λy:b. x', primitives: false },
    {
        name: 'Higher-Order',
        ctx: 'x : b -> b -> b',
        term: 'λx. λy:b. x y y',
        primitives: false
    },
    {
        name: 'Bool/Int Primitives',
        ctx: '',
        term: 'eq (add1 1) (add1 (add1 0))',
        primitives: true
    },
    {
        name: 'Variable Shadowing',
        ctx: 'x : Bool',
        term: 'λx:Bool. λx:Int. x',
        primitives: true
    }
]

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

    const latex = useMemo(
        () => (result.root ? proofToLatex(result.root) : ''),
        [result.root]
    )
    const [copied, setCopied] = useState(false)

    return (
        <>
            <h1 className="app-title">TyRep</h1>
            <div className="inputs">
                <div className="preset-row">
                    <span className="input-label">
                        Preset
                        <select
                            className="preset-select"
                            value=""
                            onChange={(e) => {
                                const preset = PRESETS[Number(e.target.value)]
                                if (!preset) return
                                setCtxSrc(preset.ctx)
                                setTermSrc(preset.term)
                                setPrimitives(preset.primitives)
                            }}
                        >
                            <option value="" disabled>
                                choose...
                            </option>
                            {PRESETS.map((p, i) => (
                                <option key={p.name} value={i}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </span>
                    <button
                        type="button"
                        className="primitives-toggle"
                        aria-pressed={primitives}
                        onClick={() => setPrimitives((v) => !v)}
                    >
                        BoolInt
                    </button>
                    <button
                        type="button"
                        className="primitives-toggle"
                        onClick={() => rulesDialogRef.current?.showModal()}
                    >
                        Type Rules
                    </button>
                </div>
                <LabeledTextarea
                    id="ctx-input"
                    label="Context (Γ₀)"
                    value={ctxSrc}
                    onChange={setCtxSrc}
                    hint={
                        <>
                            <span>
                                one binding per line/comma: <code>x : T</code>
                            </span>
                            <br />
                            <span>
                                types: <em>type-name</em> | <code>(T)</code> |{' '}
                                <code>T -&gt; T</code> or <code>T → T</code> (right-assoc)
                            </span>
                        </>
                    }
                />
                <LabeledTextarea
                    id="term-input"
                    label="Expression"
                    value={termSrc}
                    onChange={setTermSrc}
                    hint={
                        <>
                            <span>
                                lambda: <code>λx.e</code> or <code>\x.e</code> or{' '}
                                <code>fn x =&gt; e</code>
                            </span>
                            <br />
                            <span>
                                annotated lambda: <code>λx:T. e</code>
                            </span>
                            <br />
                            <span>inline annotation wins Γ if both are given</span>
                            <hr />
                            <span>
                                application: <code>f x</code>
                            </span>
                            <br />
                            <span>
                                arrow type: <code>T -&gt; T</code> or <code>T → T</code>
                            </span>
                            {primitives && (
                                <>
                                    <hr />
                                    <span>
                                        literals: <code>true</code> | <code>false</code> |{' '}
                                        <code>0</code>, <code>1</code>, ...
                                    </span>
                                    <br />
                                    <span>
                                        primitives: <code>neg</code> | <code>add1</code> |{' '}
                                        <code>eq</code> — see Type Rules
                                    </span>
                                </>
                            )}
                        </>
                    }
                >
                    {fullForm && (
                        <div className="full-form">
                            <Calligraph>{fullForm}</Calligraph>
                        </div>
                    )}
                </LabeledTextarea>
            </div>

            {result.error && <div className="error">{result.error}</div>}

            {result.root && (
                <div className="output">
                    <div className="result-type">
                        Result type:{' '}
                        <Calligraph>{typeToString(result.root.type)}</Calligraph>
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
                        <textarea
                            className="latex-output"
                            readOnly
                            value={latex}
                            hidden
                        />
                    </div>
                </div>
            )}

            <TypeRulesModal dialogRef={rulesDialogRef} primitives={primitives} />

            <div className="top-right-bar">
                <ThemeSwitcher />
                <GithubLink />
            </div>
        </>
    )
}

export default App
