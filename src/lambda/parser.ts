import { BUILTIN_TYPES } from './primitives'
import type { Ctx, Term, Type } from './types'

// ponytail: hand-rolled tokenizer/parser instead of a parser-combinator lib —
// the grammar is tiny (vars, app, abs, arrow types) and this is ~60 lines.
// expression-level aliases: lambda openers and abs separators
const TERM_ALIASES: Record<string, string> = { '\\': 'λ', fn: 'λ', '=>': '.', '⇒': '.' }
// context/type-level aliases: arrow types (used in both the term and Γ boxes)
const TYPE_ALIASES: Record<string, string> = { '→': '->' }
const ALIASES = { ...TERM_ALIASES, ...TYPE_ALIASES }

function tokenize(src: string): string[] {
    const re = /->|=>|→|⇒|λ|\\|\.|\(|\)|\{|\}|:|;|,|\n|[A-Za-z_][A-Za-z0-9_]*|\d+/g
    return (src.match(re) ?? []).filter((t) => t !== '\n').map((t) => ALIASES[t] ?? t)
}

class TokenStream {
    private i = 0
    private toks: string[]
    constructor(toks: string[]) {
        this.toks = toks
    }
    peek(): string | undefined {
        return this.toks[this.i]
    }
    next(): string {
        const t = this.toks[this.i++]
        if (t === undefined) throw new Error('unexpected end of input')
        return t
    }
    expect(t: string) {
        const got = this.next()
        if (got !== t) throw new Error(`expected "${t}" but got "${got}"`)
    }
    atEnd(): boolean {
        return this.i >= this.toks.length
    }
}

const isIdent = (t: string | undefined) => !!t && /^[A-Za-z_][A-Za-z0-9_]*$/.test(t)

// Type := Arrow ; Arrow := Atom ("->" Arrow)? ; Atom := IDENT | "(" Type ")"
// User-written types never spell out an effect (exn.pdf's Γ boxes don't
// associate one either) — arrows parsed from source are 'p' by construction;
// 'i' only ever comes from typecheck.ts inferring it from an `error`.
function parseType(s: TokenStream): Type {
    const atom = parseTypeAtom(s)
    if (s.peek() === '->') {
        s.next()
        return { kind: 'arrow', from: atom, to: parseType(s), effect: 'p' }
    }
    return atom
}

function parseTypeAtom(s: TokenStream): Type {
    if (s.peek() === '(') {
        s.next()
        const t = parseType(s)
        s.expect(')')
        return t
    }
    const name = s.next()
    if (!isIdent(name)) throw new Error(`expected a type name, got "${name}"`)
    return { kind: 'base', name }
}

export function parseTypeString(src: string): Type {
    const s = new TokenStream(tokenize(src))
    const t = parseType(s)
    if (!s.atEnd()) throw new Error('trailing tokens after type')
    return t
}

export type ParseOptions = {
    primitives?: boolean
    exceptions?: boolean
    effects?: boolean
}

const isNumber = (t: string | undefined) => !!t && /^\d+$/.test(t)
// atoms these bind to when primitives are enabled — otherwise plain idents
const BOOL_LITS: Record<string, boolean> = { true: true, false: false }

// Term := Abs | App ; Abs := "λ" IDENT (":" Type)? "." Term ; App := Atom+ ; Atom := IDENT | NUMBER | "(" Term ")"
// note: "\" and "fn" are tokenizer aliases for "λ", "=>"/"⇒" for "." — see TERM_ALIASES
// try/with are only reserved when exceptions are enabled, handle/with only
// when effects are enabled, so plain lambda calculus keeps them free as
// ordinary variable names. ("op"/"error" aren't listed: like error, op is
// disambiguated positionally in parseTermAtom rather than blocking app-chains.)
const isReservedWord = (opts: ParseOptions, t: string | undefined) =>
    (!!opts.exceptions && (t === 'try' || t === 'with')) ||
    (!!opts.effects && (t === 'handle' || t === 'with'))

function parseTerm(s: TokenStream, opts: ParseOptions): Term {
    if (s.peek() === 'λ') {
        s.next()
        const param = s.next()
        if (!isIdent(param)) throw new Error(`expected a parameter name, got "${param}"`)
        let paramType: Type | undefined
        if (s.peek() === ':') {
            s.next()
            paramType = parseType(s)
        }
        s.expect('.')
        return { kind: 'abs', param, paramType, body: parseTerm(s, opts) }
    }
    if (opts.exceptions && s.peek() === 'try') {
        s.next()
        const body = parseTerm(s, opts)
        const w = s.next()
        if (w !== 'with') throw new Error(`expected "with" but got "${w}"`)
        const handler = parseTerm(s, opts)
        return { kind: 'try', body, handler }
    }
    if (opts.effects && s.peek() === 'handle') {
        s.next()
        const body = parseTerm(s, opts)
        const w = s.next()
        if (w !== 'with') throw new Error(`expected "with" but got "${w}"`)
        s.expect('{')
        const x = s.next()
        if (!isIdent(x)) throw new Error(`expected a return-clause binder, got "${x}"`)
        s.expect('.')
        const er = parseTerm(s, opts)
        s.expect(';')
        const k = s.next()
        if (!isIdent(k))
            throw new Error(`expected an operation-clause binder, got "${k}"`)
        s.expect('.')
        const eo = parseTerm(s, opts)
        s.expect('}')
        return { kind: 'handle', body, x, er, k, eo }
    }
    let term = parseTermAtom(s, opts)
    while (
        s.peek() === '(' ||
        (isIdent(s.peek()) && !isReservedWord(opts, s.peek())) ||
        (opts.primitives && isNumber(s.peek()))
    ) {
        term = { kind: 'app', fn: term, arg: parseTermAtom(s, opts) }
    }
    return term
}

function parseTermAtom(s: TokenStream, opts: ParseOptions): Term {
    if (s.peek() === '(') {
        s.next()
        const t = parseTerm(s, opts)
        s.expect(')')
        return t
    }
    if (opts.exceptions && s.peek() === 'error') {
        s.next()
        return { kind: 'error' }
    }
    if (opts.effects && s.peek() === 'op') {
        s.next()
        return { kind: 'op' }
    }
    if (opts.primitives && isNumber(s.peek())) {
        return { kind: 'lit', type: 'Int', value: Number(s.next()) }
    }
    const name = s.next()
    if (isReservedWord(opts, name)) throw new Error(`unexpected reserved word "${name}"`)
    if (opts.primitives && name in BOOL_LITS) {
        return { kind: 'lit', type: 'Bool', value: BOOL_LITS[name] }
    }
    if (opts.primitives && name in BUILTIN_TYPES) {
        return { kind: 'prim', name }
    }
    if (!isIdent(name)) throw new Error(`expected a variable, got "${name}"`)
    return { kind: 'var', name }
}

export function parseTermString(src: string, opts: ParseOptions = {}): Term {
    const s = new TokenStream(tokenize(src))
    const t = parseTerm(s, opts)
    if (!s.atEnd()) throw new Error('trailing tokens after term')
    return t
}

// One binding per line/comma: "x : b -> b -> b"
export function parseCtxString(src: string): Ctx {
    return src
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [name, typeSrc] = line.split(':')
            if (!name || !typeSrc)
                throw new Error(`bad binding "${line}", expected "x : T"`)
            return [name.trim(), parseTypeString(typeSrc)] as [string, Type]
        })
}
