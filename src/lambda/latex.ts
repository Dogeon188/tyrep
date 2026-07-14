import type { ProofNode } from './typecheck'
import type { Ctx, Term } from './types'
import { typeToString } from './types'

function collectEnvs(n: ProofNode, envs: Map<string, Ctx>) {
  const key = JSON.stringify(n.ctx)
  if (!envs.has(key)) envs.set(key, n.ctx)
  for (const p of n.premises) collectEnvs(p, envs)
}

// Same shape as termToString, but without param type hints (the LaTeX
// judgment already states the type separately).
function termToString(t: Term): string {
  switch (t.kind) {
    case 'var':
      return t.name
    case 'abs':
      return `λ${t.param}. ${termToString(t.body)}`
    case 'app': {
      const fn = t.fn.kind === 'abs' ? `(${termToString(t.fn)})` : termToString(t.fn)
      const arg = t.arg.kind === 'var' ? termToString(t.arg) : `(${termToString(t.arg)})`
      return `${fn} ${arg}`
    }
  }
}

function escape(s: string): string {
  return s.replace(/→/g, '\\to ').replace(/λ/g, '\\lambda ')
}

function envLatex(ctx: Ctx, labels: Map<string, number>): string {
  if (ctx.length === 0) return '\\emptyset'
  const i = labels.get(JSON.stringify(ctx))
  if (i !== undefined) return `\\Gamma_{${i}}`
  return escape(ctx.map(([n, t]) => `${n} : ${typeToString(t)}`).join(', '))
}

function judgment(n: ProofNode, labels: Map<string, number>): string {
  return `${envLatex(n.ctx, labels)} \\vdash ${escape(termToString(n.term))} : ${escape(typeToString(n.type))}`
}

function nodeToLatex(n: ProofNode, labels: Map<string, number>): string {
  const concl = `$${judgment(n, labels)}$`
  if (n.rule === 'T-Var') {
    const hyp = `$${escape(termToString(n.term))} : ${escape(typeToString(n.type))} \\in ${envLatex(
      n.ctx,
      labels,
    )}$`
    return `\\AxiomC{${hyp}}\n\\RightLabel{\\scriptsize \\textsc{T-Var}}\n\\UnaryInfC{${concl}}`
  }
  const premiseLatex = n.premises.map((p) => nodeToLatex(p, labels)).join('\n')
  const infer = n.premises.length === 1 ? 'UnaryInfC' : 'BinaryInfC'
  return `${premiseLatex}\n\\RightLabel{\\scriptsize \\textsc{${n.rule}}}\n\\${infer}{${concl}}`
}

export function proofToLatex(root: ProofNode): string {
  const envs = new Map<string, Ctx>()
  collectEnvs(root, envs)
  const entries = [...envs.values()].filter((ctx) => ctx.length > 0)
  const labels = new Map<string, number>(entries.map((ctx, i) => [JSON.stringify(ctx), i]))

  const legend = entries.map(
    (ctx, i) => `\\[\\Gamma_{${i}} = ${escape(ctx.map(([n, t]) => `${n} : ${typeToString(t)}`).join(', '))}\\]`,
  )

  return [...legend, '\\begin{prooftree}', nodeToLatex(root, labels), '\\end{prooftree}'].join('\n')
}
