import { useMemo, useRef, useState } from 'react'
import './App.css'
import { parseCtxString, parseTermString } from './lambda/parser'
import { derive } from './lambda/typecheck'
import { proofToLatex } from './lambda/latex'
import { ProofTree } from './components/ProofTree'
import { ReferenceModal } from './components/ReferenceModal'
import { LabeledTextarea } from './components/LabeledTextarea'
import { CtxHint, TermHint } from './components/InputHints'
import { FullForm } from './components/FullForm'
import {
    typeToString,
    typeToUncurriedString,
    termToFullString,
    effectToString
} from './lambda/types'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { GithubLink } from './components/GithubLink'
import { EXAMPLE, PRESETS } from './presets'

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
