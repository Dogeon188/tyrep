import { RuleDiagram } from './RuleDiagram'
import { LITERAL_AXIOMS, PRIM_FUNCTION_AXIOMS, RULES } from '../lambda/rules'
import type { ProofNode } from '../lambda/typecheck'
import './ProofTree.css'
import './ReferenceModal.css'

function Rule({ rule, showEffects }: { rule: ProofNode['rule']; showEffects: boolean }) {
    return (
        <RuleDiagram
            premises={RULES[rule].premises(showEffects)}
            conclusion={RULES[rule].conclusion(showEffects)}
            name={rule}
        />
    )
}

export function ReferenceModal({
    dialogRef,
    primitives,
    dedicated,
    exceptions,
    effects,
    compact
}: {
    dialogRef: React.RefObject<HTMLDialogElement | null>
    primitives: boolean
    dedicated: boolean
    exceptions: boolean
    effects: boolean
    compact: boolean
}) {
    const showEffects = exceptions || effects
    return (
        <dialog
            ref={dialogRef}
            className="rules-dialog"
            onClick={(e) => {
                if (e.target === e.currentTarget) e.currentTarget.close()
            }}
        >
            <form method="dialog">
                <div className="rules-dialog-header">
                    <span>Reference</span>
                    <button type="submit" aria-label="Close">
                        ✕
                    </button>
                </div>
            </form>

            {(primitives || exceptions || effects) && (
                <div className="rules-dialog-section">
                    <div className="rules-dialog-subhead">Base types</div>
                    <div className="rules-row">
                        {primitives && <span className="judgment">Bool</span>}
                        {primitives && <span className="judgment">Int</span>}
                        {(exceptions || effects) && <span className="judgment">⊥</span>}
                    </div>
                    {exceptions && (
                        <p className="rules-dialog-note">
                            <code>⊥</code>: type of <code>error</code>, equal to any type
                        </p>
                    )}
                    {effects && (
                        <p className="rules-dialog-note">
                            <code>⊥</code>: also stands for <code>op</code>'s still-open
                            type, until pinned down by its context
                        </p>
                    )}
                </div>
            )}

            <div className="rules-dialog-section">
                <div className="rules-dialog-subhead">Rules</div>
                <div className="rules-row">
                    <Rule rule="T-Var" showEffects={showEffects} />
                    <Rule rule="T-Abs" showEffects={showEffects} />
                    <Rule rule="T-App" showEffects={showEffects} />
                    {primitives &&
                        LITERAL_AXIOMS.map((axiom, i) => (
                            <RuleDiagram
                                key={i}
                                premises={[]}
                                conclusion={axiom.conclusion(showEffects)}
                                name={axiom.name}
                            />
                        ))}
                    {primitives &&
                        !dedicated &&
                        PRIM_FUNCTION_AXIOMS.map((axiom, i) => (
                            <RuleDiagram
                                key={i}
                                premises={[]}
                                conclusion={axiom.conclusion(showEffects)}
                                name={axiom.name}
                            />
                        ))}
                    {primitives && dedicated && (
                        <>
                            <Rule rule="T-Neg" showEffects={showEffects} />
                            <Rule rule="T-Add1" showEffects={showEffects} />
                            <Rule rule="T-Eq" showEffects={showEffects} />
                        </>
                    )}
                    {exceptions && (
                        <>
                            <Rule rule="T-Error" showEffects={showEffects} />
                            <Rule rule="T-Try" showEffects={showEffects} />
                        </>
                    )}
                    {effects && (
                        <>
                            <Rule rule="T-Op" showEffects={showEffects} />
                            <Rule rule="T-Handle" showEffects={showEffects} />
                        </>
                    )}
                </div>
            </div>
            {(exceptions || effects) && (
                <div className="rules-dialog-section">
                    <div className="rules-dialog-subhead">Effects</div>
                    <p className="rules-dialog-note">
                        <code>!p</code> pure
                        {exceptions && (
                            <>
                                , <code>!i</code> impure (may raise)
                            </>
                        )}
                        {effects && (
                            <>
                                <br />
                                <code>!τ</code> an escaping <code>op</code> expecting a
                                τ-typed continuation
                            </>
                        )}
                        <br />
                        arrows carry their body&apos;s effect
                    </p>
                    <div className="rules-row">
                        <span className="judgment">p ∘ ϵ = ϵ</span>
                        {exceptions && <span className="judgment">i ∘ ϵ = i</span>}
                        {exceptions && <span className="judgment">p • ϵ = p</span>}
                        {exceptions && <span className="judgment">i • ϵ = ϵ</span>}
                    </div>
                    <p className="rules-dialog-note">
                        ∘: T-App/Neg/Add1/Eq — impure if any part is
                        {exceptions && (
                            <>
                                <br />
                                •: T-Try — pure if the handled branch can&apos;t raise
                            </>
                        )}
                        {effects && (
                            <>
                                <br />
                                T-Handle fully discharges its body&apos;s effect (ϵ')
                            </>
                        )}
                    </p>
                </div>
            )}
            {compact && (
                <>
                    <div className="rules-dialog-subhead">Uncurried Types</div>
                    <p className="rules-dialog-note">
                        High-order functions can be seen as a normal function whose input
                        is a Cartesian product of types, e.g. <code>A → B → C</code> to{' '}
                        <code>A × B → C</code>. See{' '}
                        <a
                            href="https://en.wikipedia.org/wiki/Currying"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Wikipedia: Currying
                        </a>
                        .
                    </p>
                </>
            )}
        </dialog>
    )
}
