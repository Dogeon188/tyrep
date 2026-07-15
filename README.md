# TyRep

A simply-typed lambda calculus type checker with proof-tree visualization.

Type a term and (optionally) a context, and TyRep derives its type using
[STLC typing rules](https://en.wikipedia.org/wiki/Simply_typed_lambda_calculus), rendering the derivation as a proof tree. Supports
Bool/Int primitives (`add1`, `eq`, ...) and a LaTeX export of the proof tree.

## Usage

### Web app

```sh
bun install
bun run dev      # start dev server
bun run build    # type-check + production build
bun run lint
bun test         # run typecheck/parser tests
```

### CLI

An example:

```sh
bun run cli.ts --term "λx:b -> b -> b. λy:b. x y y" [--ctx "x : T, y : T"] [--latex]
```

`--term` is the expression to derive type; `--ctx` is the typing environment; `--latex` outputs the derivation in LaTeX [bussproofs](https://mathweb.ucsd.edu/~sbuss/ResearchWeb/bussproofs/index.html) format.

## Project layout

- `src/lambda/` — parser, typechecker, term/type representation, LaTeX export
- `src/components/` — components for the web app
- `src/App.tsx` — main UI
- `cli.ts` — command-line interface for the same type checker

## Stack

React 19 + TypeScript + Vite, [calligraph](https://www.npmjs.com/package/calligraph)
for rendering, Bun for the CLI/tests.
