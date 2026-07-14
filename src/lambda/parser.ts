import type { Ctx, Term, Type } from './types'

// ponytail: hand-rolled tokenizer/parser instead of a parser-combinator lib —
// the grammar is tiny (vars, app, abs, arrow types) and this is ~60 lines.
// expression-level aliases: lambda openers and abs separators
const TERM_ALIASES: Record<string, string> = { '\\': 'λ', fn: 'λ', '=>': '.', '⇒': '.' }
// context/type-level aliases: arrow types (used in both the term and Γ boxes)
const TYPE_ALIASES: Record<string, string> = { '→': '->' }
const ALIASES = { ...TERM_ALIASES, ...TYPE_ALIASES }

function tokenize(src: string): string[] {
  const re = /->|=>|→|⇒|λ|\\|\.|\(|\)|:|,|\n|[A-Za-z_][A-Za-z0-9_]*/g
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
function parseType(s: TokenStream): Type {
  const atom = parseTypeAtom(s)
  if (s.peek() === '->') {
    s.next()
    return { kind: 'arrow', from: atom, to: parseType(s) }
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

// Term := Abs | App ; Abs := "λ" IDENT (":" Type)? "." Term ; App := Atom+ ; Atom := IDENT | "(" Term ")"
// note: "\" and "fn" are tokenizer aliases for "λ", "=>"/"⇒" for "." — see TERM_ALIASES
function parseTerm(s: TokenStream): Term {
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
    return { kind: 'abs', param, paramType, body: parseTerm(s) }
  }
  let term = parseTermAtom(s)
  while (s.peek() === '(' || isIdent(s.peek())) {
    term = { kind: 'app', fn: term, arg: parseTermAtom(s) }
  }
  return term
}

function parseTermAtom(s: TokenStream): Term {
  if (s.peek() === '(') {
    s.next()
    const t = parseTerm(s)
    s.expect(')')
    return t
  }
  const name = s.next()
  if (!isIdent(name)) throw new Error(`expected a variable, got "${name}"`)
  return { kind: 'var', name }
}

export function parseTermString(src: string): Term {
  const s = new TokenStream(tokenize(src))
  const t = parseTerm(s)
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
      if (!name || !typeSrc) throw new Error(`bad binding "${line}", expected "x : T"`)
      return [name.trim(), parseTypeString(typeSrc)] as [string, Type]
    })
}
