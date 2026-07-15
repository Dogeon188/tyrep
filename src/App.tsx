import { useMemo, useRef, useState } from 'react'
import './App.css'
import { parseCtxString, parseTermString } from './lambda/parser'
import { derive } from './lambda/typecheck'
import { proofToLatex } from './lambda/latex'
import { ProofTree } from './components/ProofTree'
import { ReferenceModal } from './components/ReferenceModal'
import { LabeledTextarea } from './components/LabeledTextarea'
import { FullForm } from './components/FullForm'
import {
    typeToString,
    typeToUncurriedString,
    termToFullString,
    effectToString
} from './lambda/types'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { GithubLink } from './components/GithubLink'

const EXAMPLE = {
    ctx: 'x : b -> b -> b',
    term: 'λx. λy:b. x y y'
}

const PRESETS = [
    {
        name: 'Identity',
        ctx: '',
        term: 'λx:b. x',
        primitives: false,
        exceptions: false,
        effects: false
    },
    {
        name: 'Const',
        ctx: '',
        term: 'λx:b. λy:b. x',
        primitives: false,
        exceptions: false,
        effects: false
    },
    {
        name: 'Higher-Order',
        ctx: 'x : b -> b -> b',
        term: 'λx. λy:b. x y y',
        primitives: false,
        exceptions: false,
        effects: false
    },
    {
        name: 'Bool/Int Primitives',
        ctx: '',
        term: 'eq (add1 1) (add1 (add1 0))',
        primitives: true,
        exceptions: false,
        effects: false
    },
    {
        name: 'Variable Shadowing',
        ctx: 'x : Bool',
        term: 'λx:Bool. λx:Int. x',
        primitives: true,
        exceptions: false,
        effects: false
    },
    {
        name: 'Arrow Domain',
        ctx: 'x : (b -> b) -> b\ny : b',
        term: 'x (λy. y)',
        primitives: false,
        exceptions: false,
        effects: false
    },
    {
        name: 'Exceptions: Handled',
        ctx: '',
        term: 'try ((λx:Int. error) 1) with 2',
        primitives: true,
        exceptions: true,
        effects: false
    },
    {
        name: 'Exceptions: Unhandled',
        ctx: '',
        term: 'add1 error',
        primitives: true,
        exceptions: true,
        effects: false
    },
    {
        name: 'Exceptions: Nested Try',
        ctx: '',
        term: 'neg (try (eq error 0) with false)',
        primitives: true,
        exceptions: true,
        effects: false
    },
    {
        name: 'Exceptions: Handler Not Taken',
        ctx: '',
        term: 'try 3 with error',
        primitives: true,
        exceptions: true,
        effects: false
    },
    {
        name: 'Effects: Resolved',
        ctx: '',
        term: 'handle (eq 1 op) with {x. neg x; k. (λx:Bool. x) (k 0)}',
        primitives: true,
        exceptions: true,
        effects: true
    },
    {
        name: 'Effects: Unhandled',
        ctx: '',
        term: 'add1 op',
        primitives: true,
        exceptions: true,
        effects: true
    },
    {
        name: 'Effects: Mismatched Continuation',
        ctx: '',
        term: 'handle (neg op) with {x. x; k. k 2}',
        primitives: true,
        exceptions: true,
        effects: true
    }
]

function App() {
    const [ctxSrc, setCtxSrc] = useState(EXAMPLE.ctx)
    const [termSrc, setTermSrc] = useState(EXAMPLE.term)
    const [primitives, setPrimitives] = useState(false)
    const [exceptions, setExceptions] = useState(false)
    const [effects, setEffects] = useState(false)
    const [compact, setCompact] = useState(false)
    const rulesDialogRef = useRef<HTMLDialogElement>(null)
    const showEffects = exceptions || effects

    const result = useMemo(() => {
        try {
            const ctx = parseCtxString(ctxSrc)
            const term = parseTermString(termSrc, { primitives, exceptions, effects })
            const root = derive(ctx, term)
            return { root, error: null }
        } catch (e) {
            return { root: null, error: e instanceof Error ? e.message : String(e) }
        }
    }, [ctxSrc, termSrc, primitives, exceptions, effects])

    const fullForm = useMemo(() => {
        try {
            return termToFullString(
                parseTermString(termSrc, { primitives, exceptions, effects })
            )
        } catch {
            return null
        }
    }, [termSrc, primitives, exceptions, effects])

    const latex = useMemo(
        () => (result.root ? proofToLatex(result.root, showEffects) : ''),
        [result.root, showEffects]
    )

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
                                setExceptions(preset.exceptions)
                                setEffects(preset.effects)
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
                        aria-pressed={exceptions}
                        onClick={() => setExceptions((v) => !v)}
                    >
                        Exceptions
                    </button>
                    <button
                        type="button"
                        className="primitives-toggle"
                        aria-pressed={effects}
                        onClick={() =>
                            setEffects((v) => {
                                if (!v) setExceptions(true)
                                return !v
                            })
                        }
                    >
                        Effects
                    </button>
                    <button
                        type="button"
                        className="primitives-toggle"
                        onClick={() => rulesDialogRef.current?.showModal()}
                    >
                        Reference
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
                                <code>T -&gt; T</code> (right-assoc)
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
                                        <code>eq</code>
                                    </span>
                                </>
                            )}
                            {exceptions && (
                                <>
                                    <hr />
                                    <span>
                                        raise: <code>error</code>
                                    </span>
                                    <br />
                                    <span>
                                        handle: <code>try e1 with e2</code>
                                    </span>
                                </>
                            )}
                            {effects && (
                                <>
                                    <hr />
                                    <span>
                                        operation: <code>op</code>
                                    </span>
                                    <br />
                                    <span>
                                        handle:{' '}
                                        <code>
                                            handle e with {'{'}x. e<sub>r</sub>; k. e
                                            <sub>o</sub>
                                            {'}'}
                                        </code>
                                    </span>
                                </>
                            )}
                        </>
                    }
                >
                    {fullForm && <FullForm text={fullForm} />}
                </LabeledTextarea>
            </div>

            {result.error && <div className="error">{result.error}</div>}

            {result.root && (
                <div className="output">
                    <div className="result-type">
                        Result type:{' '}
                        <FullForm
                            text={
                                compact
                                    ? typeToUncurriedString(result.root.type)
                                    : typeToString(result.root.type, showEffects)
                            }
                        />
                        {showEffects && ` !${effectToString(result.root.effect)}`}
                    </div>

                    <div className="latex-panel">
                        <div className="proof-tree-scroll">
                            <ProofTree
                                root={result.root}
                                latex={latex}
                                compact={compact}
                                setCompact={setCompact}
                                exceptions={exceptions}
                                effects={effects}
                            />
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

            <ReferenceModal
                dialogRef={rulesDialogRef}
                primitives={primitives}
                exceptions={exceptions}
                effects={effects}
                compact={compact}
            />

            <div className="top-right-bar">
                <ThemeSwitcher />
                <GithubLink />
            </div>
        </>
    )
}

export default App
