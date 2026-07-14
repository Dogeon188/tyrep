export type Type =
  | { kind: 'base'; name: string }
  | { kind: 'arrow'; from: Type; to: Type }

export type Term =
  | { kind: 'var'; name: string }
  | { kind: 'app'; fn: Term; arg: Term }
  | { kind: 'abs'; param: string; paramType?: Type; body: Term }

export type Ctx = Array<[string, Type]>

export function typeToString(t: Type): string {
  if (t.kind === 'base') return t.name
  const from = t.from.kind === 'arrow' ? `(${typeToString(t.from)})` : typeToString(t.from)
  return `${from} → ${typeToString(t.to)}`
}

export function termToString(t: Term): string {
  switch (t.kind) {
    case 'var':
      return t.name
    case 'abs':
      return `λ${t.param}${t.paramType ? `:${typeToString(t.paramType)}` : ''}. ${termToString(t.body)}`
    case 'app': {
      const fn = t.fn.kind === 'abs' ? `(${termToString(t.fn)})` : termToString(t.fn)
      const arg = t.arg.kind === 'var' ? termToString(t.arg) : `(${termToString(t.arg)})`
      return `${fn} ${arg}`
    }
  }
}

export function ctxToString(ctx: Ctx): string {
  if (ctx.length === 0) return '∅'
  return ctx.map(([n, t]) => `${n} : ${typeToString(t)}`).join(', ')
}

export function typesEqual(a: Type, b: Type): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'base' && b.kind === 'base') return a.name === b.name
  if (a.kind === 'arrow' && b.kind === 'arrow') return typesEqual(a.from, b.from) && typesEqual(a.to, b.to)
  return false
}
