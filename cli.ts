#!/usr/bin/env bun
import { parseCtxString, parseTermString } from './src/lambda/parser'
import { derive, TypeError2, type ProofNode } from './src/lambda/typecheck'
import { proofToLatex } from './src/lambda/latex'
import { ctxToString, termToString, typeToString } from './src/lambda/types'

function usage(): never {
  console.error(
    'usage: tyrep --term "<expr>" [--ctx "x : T, y : T"] [--latex]\n' +
      '  expr syntax: λx:T. e  |  \\x:T. e  |  application by juxtaposition\n' +
      '  example: tyrep --term "λx:b -> b -> b. λy:b. x y y"',
  )
  process.exit(1)
}

function printTree(n: ProofNode, indent = 0) {
  console.log(
    '  '.repeat(indent) + `${n.rule}: ${ctxToString(n.ctx)} ⊢ ${termToString(n.term)} : ${typeToString(n.type)}`,
  )
  n.premises.forEach((p: ProofNode) => printTree(p, indent + 1))
}

function parseArgs(argv: string[]) {
  const args: { term?: string; ctx?: string; latex?: boolean } = {}
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--term':
        args.term = argv[++i]
        break
      case '--ctx':
        args.ctx = argv[++i]
        break
      case '--latex':
        args.latex = true
        break
      case '--help':
      case '-h':
        usage()
    }
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
if (!args.term) usage()

try {
  const ctx = parseCtxString(args.ctx ?? '')
  const term = parseTermString(args.term)
  const root = derive(ctx, term)
  if (args.latex) {
    console.log(proofToLatex(root))
  } else {
    console.log(`Result type: ${typeToString(root.type)}\n`)
    printTree(root)
  }
} catch (e) {
  const msg = e instanceof TypeError2 ? `type error: ${e.message}` : e instanceof Error ? e.message : String(e)
  console.error(msg)
  process.exit(1)
}
