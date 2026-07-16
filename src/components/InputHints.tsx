export function CtxHint() {
    return (
        <>
            <span>
                one binding per line/comma: <code>x : T</code>
            </span>
            <br />
            <span>
                types: <em>type-name</em> | <code>(T)</code> | <code>T -&gt; T</code>{' '}
                (right-assoc)
            </span>
        </>
    )
}

export function TermHint({
    primitives,
    exceptions,
    effects
}: {
    primitives: boolean
    exceptions: boolean
    effects: boolean
}) {
    return (
        <>
            <span>
                lambda: <code>λx.e</code> or <code>\x.e</code> or{' '}
                <code>fn x =&gt; e</code>
            </span>
            <br />
            <span>
                annotated lambda: <code>λx:T. e</code>
            </span>
            <br />
            <span>inline annotation wins Γ if both are given</span>
            <hr />
            <span>
                application: <code>f x</code>
            </span>
            <br />
            {primitives && (
                <>
                    <hr />
                    <span>
                        literals: <code>true</code> | <code>false</code> | <code>0</code>,{' '}
                        <code>1</code>, ...
                    </span>
                    <br />
                    <span>
                        primitives: <code>neg</code> | <code>add1</code> | <code>eq</code>
                    </span>
                </>
            )}
            {exceptions && (
                <>
                    <hr />
                    <span>
                        raise: <code>error</code>
                    </span>
                    <br />
                    <span>
                        handle: <code>try e1 with e2</code>
                    </span>
                </>
            )}
            {effects && (
                <>
                    <hr />
                    <span>
                        anon effect: <code>op</code>
                    </span>
                    <br />
                    <span>
                        handle:{' '}
                        <code>
                            handle e with {'{'}x. e<sub>r</sub>; k. e<sub>o</sub>
                            {'}'}
                        </code>
                    </span>
                </>
            )}
        </>
    )
}
