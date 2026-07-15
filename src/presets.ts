export const EXAMPLE = {
    ctx: 'x : b -> b -> b',
    term: 'λx. λy:b. x y y'
}

export const PRESETS = [
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
