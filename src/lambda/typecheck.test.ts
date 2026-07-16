import { describe, expect, test } from 'bun:test'
import { parseCtxString, parseTermString } from './parser'
import { derive, TypeError2 } from './typecheck'

describe('derive', () => {
    test('Γ-inferred param type reuses the outer binding instead of duplicating it', () => {
        const ctx = parseCtxString('x : Nat')
        const root = derive(ctx, parseTermString('λx. x'))
        expect(root.premises[0].ctx).toEqual(ctx)
    })

    test('explicit annotation still shadows and extends the context', () => {
        const ctx = parseCtxString('x : Bool')
        const root = derive(ctx, parseTermString('λx:Nat. x'))
        expect(root.premises[0].ctx).toEqual([
            ...ctx,
            ['x', { kind: 'base', name: 'Nat' }]
        ])
    })

    test('unannotated param with no matching Γ binding is a type error', () => {
        expect(() => derive([], parseTermString('λx. x'))).toThrow(TypeError2)
    })

    test('Int/Bool primitives type as base Int/Bool when enabled', () => {
        const n = derive([], parseTermString('42', { primitives: true }))
        expect(n.type).toEqual({ kind: 'base', name: 'Int' })
        const b = derive([], parseTermString('true', { primitives: true }))
        expect(b.type).toEqual({ kind: 'base', name: 'Bool' })
    })

    test('primitives stay plain identifiers when the toggle is off', () => {
        expect(() => parseTermString('42')).toThrow()
        expect(
            derive([['true', { kind: 'base', name: 'Bool' }]], parseTermString('true'))
                .rule
        ).toBe('T-Var')
    })

    test('neg and add1 are built-in primitive functions when enabled', () => {
        const neg = derive([], parseTermString('neg', { primitives: true }))
        expect(neg.type).toEqual({
            kind: 'arrow',
            from: { kind: 'base', name: 'Bool' },
            to: { kind: 'base', name: 'Bool' },
            effect: 'p'
        })
        const applied = derive([], parseTermString('add1 41', { primitives: true }))
        expect(applied.type).toEqual({ kind: 'base', name: 'Int' })
    })

    test('eq accepts two same-typed operands and yields Bool', () => {
        const intEq = derive([], parseTermString('eq 1 2', { primitives: true }))
        expect(intEq.type).toEqual({ kind: 'base', name: 'Bool' })
        const boolEq = derive([], parseTermString('eq true false', { primitives: true }))
        expect(boolEq.type).toEqual({ kind: 'base', name: 'Bool' })
    })

    test('eq rejects operands of different types', () => {
        expect(() =>
            derive([], parseTermString('eq 1 true', { primitives: true }))
        ).toThrow(TypeError2)
    })
})

describe('derive — dedicated primitive rules (exn.pdf Appendix B)', () => {
    const opts = { primitives: true, dedicated: true }

    test('neg/add1 derive via T-Neg/T-Add1 with a single premise', () => {
        const neg = derive([], parseTermString('neg true', { primitives: true }), opts)
        expect(neg.rule).toBe('T-Neg')
        expect(neg.premises).toHaveLength(1)
        expect(neg.type).toEqual({ kind: 'base', name: 'Bool' })
        expect(neg.effect).toBe('p')

        const add1 = derive([], parseTermString('add1 41', { primitives: true }), opts)
        expect(add1.rule).toBe('T-Add1')
        expect(add1.premises).toHaveLength(1)
        expect(add1.type).toEqual({ kind: 'base', name: 'Int' })
    })

    test('eq derives via T-Eq with two premises', () => {
        const eq = derive([], parseTermString('eq 1 2', { primitives: true }), opts)
        expect(eq.rule).toBe('T-Eq')
        expect(eq.premises).toHaveLength(2)
        expect(eq.type).toEqual({ kind: 'base', name: 'Bool' })
    })

    test('eq still rejects mismatched operand types', () => {
        expect(() =>
            derive([], parseTermString('eq 1 true', { primitives: true }), opts)
        ).toThrow(TypeError2)
    })

    test('dedicated and generic modes agree on .type/.effect', () => {
        const term = parseTermString('eq (add1 1) (add1 (add1 0))', {
            primitives: true
        })
        const generic = derive([], term)
        const dedicatedResult = derive([], term, opts)
        expect(dedicatedResult.type).toEqual(generic.type)
        expect(dedicatedResult.effect).toEqual(generic.effect)
    })

    test('op resolves through dedicated rules just like the generic path', () => {
        const opOpts = { primitives: true, effects: true, dedicated: true }
        const eq = derive([], parseTermString('eq 1 op', opOpts), opOpts)
        expect(eq.rule).toBe('T-Eq')
        expect(eq.type).toEqual({ kind: 'base', name: 'Bool' })
        expect(eq.effect).toEqual({ kind: 'base', name: 'Int' })

        const neg = derive([], parseTermString('neg op', opOpts), opOpts)
        expect(neg.rule).toBe('T-Neg')
        expect(neg.effect).toEqual({ kind: 'base', name: 'Bool' })
    })
})

describe('derive — exceptions (exn.pdf §6/Appendix B)', () => {
    const opts = { primitives: true, exceptions: true }

    test('error unifies with any type, and propagates the i effect through app/abs', () => {
        // exn.pdf worked example: try ((λx. error) 1) with 2 : int ! p
        const root = derive([], parseTermString('try ((λx:Int. error) 1) with 2', opts))
        expect(root.type).toEqual({ kind: 'base', name: 'Int' })
        expect(root.effect).toBe('p')
        const app = root.premises[0]
        expect(app.effect).toBe('i')
    })

    test('try is pure when the handled branch is pure, even if the handler is not', () => {
        // exn.pdf worked example: try 3 with error : int ! i (imprecise system) —
        // our precise (Appendix B) system instead gets try 3 with error : int ! p
        const root = derive([], parseTermString('try 3 with error', opts))
        expect(root.type).toEqual({ kind: 'base', name: 'Int' })
        expect(root.effect).toBe('p')
    })

    test('bare error has no handler and is impure', () => {
        const root = derive([], parseTermString('add1 error', opts))
        expect(root.type).toEqual({ kind: 'base', name: 'Int' })
        expect(root.effect).toBe('i')
    })

    test('mismatched try branches are a type error', () => {
        expect(() => derive([], parseTermString('try 3 with true', opts))).toThrow(
            TypeError2
        )
    })

    test('"error"/"try"/"with" stay usable as identifiers when exceptions are off', () => {
        expect(derive([], parseTermString('λerror:Int. error')).type).toEqual({
            kind: 'arrow',
            from: { kind: 'base', name: 'Int' },
            to: { kind: 'base', name: 'Int' },
            effect: 'p'
        })
    })
})

describe('derive — algebraic effects (eff.pdf §6)', () => {
    const opts = { primitives: true, effects: true }

    test('op resolves to the concrete type demanded by its context (eq 1 op : bool ! int)', () => {
        // eff.pdf worked example D1: ∅ ⊢ eq 1 op : bool ! int
        const root = derive([], parseTermString('eq 1 op', opts))
        expect(root.type).toEqual({ kind: 'base', name: 'Bool' })
        expect(root.effect).toEqual({ kind: 'base', name: 'Int' })
    })

    test('op resolves through a unary primitive too (neg op : bool ! bool)', () => {
        // eff.pdf worked example D5: ∅ ⊢ neg op : bool ! bool
        const root = derive([], parseTermString('neg op', opts))
        expect(root.type).toEqual({ kind: 'base', name: 'Bool' })
        expect(root.effect).toEqual({ kind: 'base', name: 'Bool' })
    })

    test('bare op with nothing to pin it stays an unresolved ⊥ type and effect', () => {
        const root = derive([], parseTermString('op', opts))
        expect(root.type).toEqual({ kind: 'base', name: '⊥' })
        expect(root.effect).toEqual({ kind: 'base', name: '⊥' })
    })

    test('handle resolves an escaping op via a matching continuation type', () => {
        // eff.pdf worked example: handle (eq 1 op) with {x. neg x; k. (λx. x) (k 0)} : bool ! p
        const root = derive(
            [],
            parseTermString(
                'handle (eq 1 op) with {x. neg x; k. (λx:Bool. x) (k 0)}',
                opts
            )
        )
        expect(root.type).toEqual({ kind: 'base', name: 'Bool' })
        expect(root.effect).toBe('p')
    })

    test('handle with a pure body still type-checks by leaving k unconstrained', () => {
        const root = derive([], parseTermString('handle 5 with {x. x; k. k 0}', opts))
        expect(root.type).toEqual({ kind: 'base', name: 'Int' })
        expect(root.effect).toBe('p')
    })

    test('a continuation used at the wrong type is a type error', () => {
        // eff.pdf worked example D7: k requires bool, but is applied to the int 2
        expect(() =>
            derive([], parseTermString('handle (neg op) with {x. x; k. k 2}', opts))
        ).toThrow(TypeError2)
    })

    test('mismatched handler-clause types are a type error', () => {
        expect(() =>
            derive([], parseTermString('handle 5 with {x. x; k. false}', opts))
        ).toThrow(TypeError2)
    })

    test('"op"/"handle"/"with" stay usable as identifiers when effects are off', () => {
        expect(derive([], parseTermString('λop:Int. op')).type).toEqual({
            kind: 'arrow',
            from: { kind: 'base', name: 'Int' },
            to: { kind: 'base', name: 'Int' },
            effect: 'p'
        })
    })
})
