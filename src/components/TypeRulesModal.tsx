import { type ReactNode } from 'react'
import './ProofTree.css'
import './TypeRulesModal.css'

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

function Rule1({ premise, conclusion, name }: { premise: string; conclusion: string; name: string }) {
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
  name,
}: {
  premise1: string
  premise2: string
  conclusion: string
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

export function TypeRulesModal({ dialogRef, primitives }: { dialogRef: React.RefObject<HTMLDialogElement | null>; primitives: boolean }) {
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
          <span>Allowed type rules</span>
          <button type="submit" aria-label="Close">✕</button>
        </div>
      </form>

      {primitives && (
        <div className="rules-dialog-section">
          <div className="rules-dialog-subhead">Base types</div>
          <div className="rules-row">
            <span className="judgment">Bool</span>
            <span className="judgment">Int</span>
          </div>
        </div>
      )}

      <div className="rules-dialog-subhead">Rules</div>
      <div className="rules-row">
        <Axiom conclusion={<>x : T ∈ Γ ⊢ x : T</>} name="T-Var" />
        <Rule1 premise="Γ, x:T₁ ⊢ e : T₂" conclusion="Γ ⊢ λx:T₁.e : T₁ → T₂" name="T-Abs" />
        <Rule2 premise1="Γ ⊢ f : T₁ → T₂" premise2="Γ ⊢ a : T₁" conclusion="Γ ⊢ f a : T₂" name="T-App" />
        {primitives && (
          <>
            <Axiom conclusion={<>∅ ⊢ true : Bool</>} name="T-Lit" />
            <Axiom conclusion={<>∅ ⊢ false : Bool</>} name="T-Lit" />
            <Axiom conclusion={<>∅ ⊢ n : Int (n = 0, 1, 2, ...)</>} name="T-Lit" />
            <Axiom conclusion={<>∅ ⊢ neg : Bool → Bool</>} name="T-Prim" />
            <Axiom conclusion={<>∅ ⊢ add1 : Int → Int</>} name="T-Prim" />
            <Axiom conclusion={<>∅ ⊢ eq : α → α → Bool</>} name="T-Prim" />
          </>
        )}
      </div>
    </dialog>
  )
}
