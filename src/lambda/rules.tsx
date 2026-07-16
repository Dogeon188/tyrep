import type { ReactNode } from 'react'
import type { ProofNode } from './typecheck'

// Single source of truth for each rule's schema, keyed by the typechecker's
// own rule union (ProofNode['rule'] in typecheck.ts) so this can never drift
// out of sync with the rules the backend actually derives with — adding,
// renaming, or removing a rule there forces a compile error here until it's
// mirrored. Consumed by both the reference dialog's full rule list and each
// proof-tree node's rule-name tooltip.
export type RuleSpec = {
    premises: (showEffects: boolean) => ReactNode[]
    conclusion: (showEffects: boolean) => ReactNode
}

export const RULES: Record<ProofNode['rule'], RuleSpec> = {
    'T-Var': {
        premises: () => [],
        conclusion: (e) => (e ? 'x : T ∈ Γ ⊢ x : T ! p' : 'x : T ∈ Γ ⊢ x : T')
    },
    'T-Abs': {
        premises: (e) => [e ? 'Γ, x:T₁ ⊢ e : T₂ ! ϵ' : 'Γ, x:T₁ ⊢ e : T₂'],
        conclusion: (e) =>
            e ? 'Γ ⊢ λx:T₁.e : (T₁ → T₂ !ϵ) ! p' : 'Γ ⊢ λx:T₁.e : T₁ → T₂'
    },
    'T-App': {
        premises: (e) => [
            e ? 'Γ ⊢ f : (T₁ → T₂ !ϵ₃) ! ϵ₁' : 'Γ ⊢ f : T₁ → T₂',
            e ? 'Γ ⊢ a : T₁ ! ϵ₂' : 'Γ ⊢ a : T₁'
        ],
        conclusion: (e) => (e ? 'Γ ⊢ f a : T₂ ! (ϵ₁ ∘ ϵ₂ ∘ ϵ₃)' : 'Γ ⊢ f a : T₂')
    },
    'T-Lit': {
        premises: () => [],
        conclusion: (e) => (e ? '∅ ⊢ c : type(c) ! p' : '∅ ⊢ c : type(c)')
    },
    'T-Prim': {
        premises: () => [],
        conclusion: (e) =>
            e ? '∅ ⊢ prim : (builtin-type(prim) !p) ! p' : '∅ ⊢ prim : builtin-type(prim)'
    },
    'T-Error': {
        premises: () => [],
        conclusion: () => <>Γ ⊢ error : τ ! i</>
    },
    'T-Try': {
        premises: () => ['Γ ⊢ e₁ : τ ! ϵ₁', 'Γ ⊢ e₂ : τ ! ϵ₂'],
        conclusion: () => 'Γ ⊢ try e₁ with e₂ : τ ! (ϵ₁ • ϵ₂)'
    },
    'T-Op': {
        premises: () => [],
        conclusion: () => <>Γ ⊢ op : τ ! τ</>
    },
    'T-Neg': {
        premises: (e) => [e ? 'Γ ⊢ e : Bool ! ϵ' : 'Γ ⊢ e : Bool'],
        conclusion: (e) => (e ? 'Γ ⊢ neg e : Bool ! ϵ' : 'Γ ⊢ neg e : Bool')
    },
    'T-Add1': {
        premises: (e) => [e ? 'Γ ⊢ e : Int ! ϵ' : 'Γ ⊢ e : Int'],
        conclusion: (e) => (e ? 'Γ ⊢ add1 e : Int ! ϵ' : 'Γ ⊢ add1 e : Int')
    },
    'T-Eq': {
        premises: (e) => [
            e ? 'Γ ⊢ e₁ : τ ! ϵ₁' : 'Γ ⊢ e₁ : τ',
            e ? 'Γ ⊢ e₂ : τ ! ϵ₂' : 'Γ ⊢ e₂ : τ'
        ],
        conclusion: (e) => (e ? 'Γ ⊢ eq e₁ e₂ : Bool ! (ϵ₁ ∘ ϵ₂)' : 'Γ ⊢ eq e₁ e₂ : Bool')
    },
    'T-Handle': {
        premises: () => [
            <>Γ ⊢ e : σ ! ϵ'</>,
            <>
                Γ, x:σ ⊢ e<sub>r</sub> : τ ! ϵ
            </>,
            <>
                Γ, k:ϵ'→τ !ϵ ⊢ e<sub>o</sub> : τ ! ϵ
            </>
        ],
        conclusion: () => (
            <>
                Γ ⊢ handle e with {'{'}x.e<sub>r</sub>; k.e
                <sub>o</sub>
                {'}'} : τ ! ϵ
            </>
        )
    }
}

// Concrete axiom instances (not the generic T-Lit/T-Prim schema above) shown
// in the reference dialog's primitives section.
type Axiom = { name: 'T-Lit' | 'T-Prim'; conclusion: (showEffects: boolean) => ReactNode }

// Always shown when primitives are on, regardless of the dedicated-rules
// toggle — literals never go through T-Prim either way.
export const LITERAL_AXIOMS: Axiom[] = [
    {
        name: 'T-Lit',
        conclusion: (e) => (e ? <>∅ ⊢ true : Bool ! p</> : <>∅ ⊢ true : Bool</>)
    },
    {
        name: 'T-Lit',
        conclusion: (e) => (e ? <>∅ ⊢ false : Bool ! p</> : <>∅ ⊢ false : Bool</>)
    },
    {
        name: 'T-Lit',
        conclusion: (e) =>
            e ? (
                <>∅ ⊢ n : Int ! p (n = 0, 1, 2, ...)</>
            ) : (
                <>∅ ⊢ n : Int (n = 0, 1, 2, ...)</>
            )
    }
]

// Shown only when the dedicated-rules toggle is off — otherwise neg/add1/eq
// are derived via the T-Neg/T-Add1/T-Eq entries in RULES above instead of
// this generic curried-function-type axiom.
export const PRIM_FUNCTION_AXIOMS: Axiom[] = [
    {
        name: 'T-Prim',
        conclusion: (e) =>
            e ? <>∅ ⊢ neg : (Bool → Bool !p) ! p</> : <>∅ ⊢ neg : Bool → Bool</>
    },
    {
        name: 'T-Prim',
        conclusion: (e) =>
            e ? <>∅ ⊢ add1 : (Int → Int !p) ! p</> : <>∅ ⊢ add1 : Int → Int</>
    },
    {
        name: 'T-Prim',
        conclusion: (e) =>
            e ? <>∅ ⊢ eq : (α → (α → Bool !p) !p) ! p</> : <>∅ ⊢ eq : α → α → Bool</>
    }
]
