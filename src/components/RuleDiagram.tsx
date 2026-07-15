import type { ReactNode } from 'react'

// Shared natural-deduction box (premises over a line, rule name, conclusion
// below) used both by the reference dialog's full rule list and by each
// proof-tree node's rule-name tooltip, so the two always render rules
// identically.
export function RuleDiagram({
    premises,
    conclusion,
    name
}: {
    premises: ReactNode[]
    conclusion: ReactNode
    name: string
}) {
    return (
        <div className="rule">
            <div className="premises">
                {premises.map((p, i) => (
                    <span className="judgment" key={i}>
                        {p}
                    </span>
                ))}
            </div>
            <div className="line">
                <span className="rule-name">{name}</span>
            </div>
            <span className="judgment">{conclusion}</span>
        </div>
    )
}
