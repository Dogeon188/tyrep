import { useMemo, useRef, useState } from 'react'
import './App.css'
import { FullForm } from './components/FullForm'
import { GithubLink } from './components/GithubLink'
import { CtxHint, TermHint } from './components/InputHints'
import { LabeledTextarea } from './components/LabeledTextarea'
import { ProofTree } from './components/ProofTree'
import { ReduceMotionToggle } from './components/ReduceMotionToggle'
import { ReferenceModal } from './components/ReferenceModal'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { proofToLatex } from './lambda/latex'
import { parseCtxString, parseTermString } from './lambda/parser'
import { derive } from './lambda/typecheck'
import {
    effectToString,
    termToFullString,
    typeToString,
    typeToUncurriedString
} from './lambda/types'
import { EXAMPLE, PRESETS } from './presets'

function App() {
    const [ctxSrc, setCtxSrc] = useState(EXAMPLE.ctx)
    const [termSrc, setTermSrc] = useState(EXAMPLE.term)
    const [primitives, setPrimitives] = useState(false)
    const [dedicated, setDedicated] = useState(true)
    const [exceptions, setExceptions] = useState(false)
    const [effects, setEffects] = useState(false)
    const [compact, setCompact] = useState(false)
    const rulesDialogRef = useRef<HTMLDialogElement>(null)
    const showEffects = exceptions || effects
    const opts = useMemo(
        () => ({ primitives, dedicated, exceptions, effects }),
        [primitives, dedicated, exceptions, effects]
    )

    const result = useMemo(() => {
        try {
            const ctx = parseCtxString(ctxSrc)
            const term = parseTermString(termSrc, opts)
            const root = derive(ctx, term, opts)
            return { root, error: null }
        } catch (e) {
            return { root: null, error: e instanceof Error ? e.message : String(e) }
        }
    }, [ctxSrc, termSrc, opts])

    const fullForm = useMemo(() => {
        try {
            return termToFullString(parseTermString(termSrc, opts))
        } catch {
            return null
        }
    }, [termSrc, opts])

    const latex = useMemo(
        () => (result.root ? proofToLatex(result.root, showEffects) : ''),
        [result.root, showEffects]
    )

    return (
        <>
            <div className="top-left-bar">
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Reference"
                    onClick={() => rulesDialogRef.current?.showModal()}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                </button>
            </div>
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
                                setDedicated(true)
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
                </div>
                <div className="preset-row">
                    <button
                        type="button"
                        className="primitives-toggle boolint-toggle"
                        aria-pressed={primitives}
                        onClick={() => {
                            if (!primitives) setPrimitives(true)
                            else if (dedicated) setDedicated(false)
                            else {
                                setPrimitives(false)
                                setDedicated(true)
                            }
                        }}
                    >
                        BoolInt
                        {primitives ? (dedicated ? ': First-Class' : ': Primitives') : ''}
                    </button>
                    <button
                        type="button"
                        className="primitives-toggle"
                        aria-pressed={exceptions}
                        onClick={() =>
                            setExceptions((v) => {
                                if (v) setEffects(false)
                                return !v
                            })
                        }
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
                </div>
                <LabeledTextarea
                    id="ctx-input"
                    label="Context (Γ₀)"
                    value={ctxSrc}
                    onChange={setCtxSrc}
                    hint={<CtxHint />}
                />
                <LabeledTextarea
                    id="term-input"
                    label="Expression"
                    value={termSrc}
                    onChange={setTermSrc}
                    hint={
                        <TermHint
                            primitives={primitives}
                            exceptions={exceptions}
                            effects={effects}
                        />
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
                dedicated={dedicated}
                exceptions={exceptions}
                effects={effects}
                compact={compact}
            />

            <div className="top-right-bar">
                <ReduceMotionToggle />
                <ThemeSwitcher />
                <GithubLink />
            </div>
        </>
    )
}

export default App
