import type { ProofNode } from './typecheck'
import { ctxToString, termToString, typeToString } from './types'

function judgment(n: ProofNode): string {
  return `${ctxToString(n.ctx)} \\vdash ${termToString(n.term).replace(/λ/g, '\\lambda ')} : ${typeToString(
    n.type,
  ).replace(/→/g, '\\to ')}`
}

function nodeToLatex(n: ProofNode): string {
  const concl = `$${judgment(n)}$`
  if (n.rule === 'T-Var') {
    const hyp = `$${termToString(n.term)} : ${typeToString(n.type).replace(/→/g, '\\to ')} \\in ${ctxToString(
      n.ctx,
    )}$`
    return `\\AxiomC{${hyp}}\n\\RightLabel{\\scriptsize T-Var}\n\\UnaryInfC{${concl}}`
  }
  const premiseLatex = n.premises.map(nodeToLatex).join('\n')
  const infer = n.premises.length === 1 ? 'UnaryInfC' : 'BinaryInfC'
  return `${premiseLatex}\n\\RightLabel{\\scriptsize ${n.rule}}\n\\${infer}{${concl}}`
}

export function proofToLatex(root: ProofNode): string {
  return [
    '\\begin{prooftree}',
    nodeToLatex(root),
    '\\end{prooftree}',
  ].join('\n')
}
