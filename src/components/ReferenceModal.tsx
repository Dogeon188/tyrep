import { type ReactNode } from 'react'
import './ProofTree.css'
import './ReferenceModal.css'

function Axiom({ conclusion, name }: { conclusion: ReactNode; name: string }) {
    return (
        <div className="rule">
            <div className="premises" />
            <div className="line">
                <span className="rule-name">{name}</span>
            </div>
            <span className="judgment">{conclusion}</span>
        </div>
    )
}

function Rule1({
    premise,
    conclusion,
    name
}: {
    premise: ReactNode
    conclusion: ReactNode
    name: string
}) {
    return (
        <div className="rule">
            <div className="premises">
                <span className="judgment">{premise}</span>
            </div>
            <div className="line">
                <span className="rule-name">{name}</span>
            </div>
            <span className="judgment">{conclusion}</span>
        </div>
    )
}

function Rule2({
    premise1,
    premise2,
    conclusion,
    name
}: {
    premise1: ReactNode
    premise2: ReactNode
    conclusion: ReactNode
    name: string
}) {
    return (
        <div className="rule">
            <div className="premises">
                <span className="judgment">{premise1}</span>
                <span className="judgment">{premise2}</span>
            </div>
            <div className="line">
                <span className="rule-name">{name}</span>
            </div>
            <span className="judgment">{conclusion}</span>
        </div>
    )
}

export function ReferenceModal({
    dialogRef,
    primitives,
    exceptions,
    effects,
    compact
}: {
    dialogRef: React.RefObject<HTMLDialogElement | null>
    primitives: boolean
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
                    <Axiom
                        conclusion={
                            showEffects ? (
                                <>x : T ∈ Γ ⊢ x : T ! p</>
                            ) : (
                                <>x : T ∈ Γ ⊢ x : T</>
                            )
                        }
                        name="T-Var"
                    />
                    <Rule1
                        premise={
                            showEffects ? 'Γ, x:T₁ ⊢ e : T₂ ! ϵ' : 'Γ, x:T₁ ⊢ e : T₂'
                        }
                        conclusion={
                            showEffects
                                ? 'Γ ⊢ λx:T₁.e : (T₁ → T₂ !ϵ) ! p'
                                : 'Γ ⊢ λx:T₁.e : T₁ → T₂'
                        }
                        name="T-Abs"
                    />
                    <Rule2
                        premise1={
                            showEffects ? 'Γ ⊢ f : (T₁ → T₂ !ϵ₃) ! ϵ₁' : 'Γ ⊢ f : T₁ → T₂'
                        }
                        premise2={showEffects ? 'Γ ⊢ a : T₁ ! ϵ₂' : 'Γ ⊢ a : T₁'}
                        conclusion={
                            showEffects ? 'Γ ⊢ f a : T₂ ! (ϵ₁ ∘ ϵ₂ ∘ ϵ₃)' : 'Γ ⊢ f a : T₂'
                        }
                        name="T-App"
                    />
                    {primitives && (
                        <>
                            <Axiom
                                conclusion={
                                    showEffects ? (
                                        <>∅ ⊢ true : Bool ! p</>
                                    ) : (
                                        <>∅ ⊢ true : Bool</>
                                    )
                                }
                                name="T-Lit"
                            />
                            <Axiom
                                conclusion={
                                    showEffects ? (
                                        <>∅ ⊢ false : Bool ! p</>
                                    ) : (
                                        <>∅ ⊢ false : Bool</>
                                    )
                                }
                                name="T-Lit"
                            />
                            <Axiom
                                conclusion={
                                    showEffects ? (
                                        <>∅ ⊢ n : Int ! p (n = 0, 1, 2, ...)</>
                                    ) : (
                                        <>∅ ⊢ n : Int (n = 0, 1, 2, ...)</>
                                    )
                                }
                                name="T-Lit"
                            />
                            <Axiom
                                conclusion={
                                    showEffects ? (
                                        <>∅ ⊢ neg : (Bool → Bool !p) ! p</>
                                    ) : (
                                        <>∅ ⊢ neg : Bool → Bool</>
                                    )
                                }
                                name="T-Prim"
                            />
                            <Axiom
                                conclusion={
                                    showEffects ? (
                                        <>∅ ⊢ add1 : (Int → Int !p) ! p</>
                                    ) : (
                                        <>∅ ⊢ add1 : Int → Int</>
                                    )
                                }
                                name="T-Prim"
                            />
                            <Axiom
                                conclusion={
                                    showEffects ? (
                                        <>∅ ⊢ eq : (α → (α → Bool !p) !p) ! p</>
                                    ) : (
                                        <>∅ ⊢ eq : α → α → Bool</>
                                    )
                                }
                                name="T-Prim"
                            />
                        </>
                    )}
                    {exceptions && (
                        <>
                            <Axiom conclusion={<>Γ ⊢ error : τ ! i</>} name="T-Error" />
                            <Rule2
                                premise1="Γ ⊢ e₁ : τ ! ϵ₁"
                                premise2="Γ ⊢ e₂ : τ ! ϵ₂"
                                conclusion="Γ ⊢ try e₁ with e₂ : τ ! (ϵ₁ • ϵ₂)"
                                name="T-Try"
                            />
                        </>
                    )}
                    {effects && (
                        <>
                            <Axiom conclusion={<>Γ ⊢ op : τ ! τ</>} name="T-Op" />
                            <div className="rule">
                                <div className="premises">
                                    <span className="judgment">Γ ⊢ e : σ ! ϵ'</span>
                                    <span className="judgment">
                                        Γ, x:σ ⊢ e<sub>r</sub> : τ ! ϵ
                                    </span>
                                    <span className="judgment">
                                        Γ, k:ϵ'→τ !ϵ ⊢ e<sub>o</sub> : τ ! ϵ
                                    </span>
                                </div>
                                <div className="line">
                                    <span className="rule-name">T-Handle</span>
                                </div>
                                <span className="judgment">
                                    Γ ⊢ handle e with {'{'}x.e<sub>r</sub>; k.e
                                    <sub>o</sub>
                                    {'}'} : τ ! ϵ
                                </span>
                            </div>
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
