import { useEffect, useMemo, useRef } from 'react'
import { Calligraph } from 'calligraph'
import './FullForm.css'

const OPENERS = new Set(['(', '{'])
const CLOSERS = new Set([')', '}'])

// Golden-angle hue step spreads colors evenly regardless of nesting depth.
const bracketColor = (depth: number) => `hsl(${(depth * 137.508) % 360} 70% 55%)`

function analyzeBrackets(chars: string[]) {
    const info = new Map<number, { depth: number; match: number }>()
    const stack: number[] = []
    chars.forEach((c, i) => {
        if (OPENERS.has(c)) {
            stack.push(i)
            info.set(i, { depth: stack.length - 1, match: -1 })
        } else if (CLOSERS.has(c)) {
            const openIdx = stack.pop()
            if (openIdx !== undefined) {
                info.set(i, { depth: stack.length, match: openIdx })
                info.get(openIdx)!.match = i
            }
        }
    })
    return info
}

// "try"/"with" and "handle"/"with" keywords nest like brackets in the
// generated fullform text, so a "with" always closes the innermost
// still-open "try"/"handle".
const KEYWORD_RE = /\btry\b|\bhandle\b|\bwith\b/g

function analyzeKeywords(text: string) {
    const ranges = new Map<
        number,
        { start: number; end: number; matchStart: number; matchEnd: number }
    >()
    const stack: { start: number; end: number }[] = []
    for (const m of text.matchAll(KEYWORD_RE)) {
        const start = m.index
        const end = start + m[0].length
        if (m[0] === 'with') {
            const opener = stack.pop()
            if (!opener) continue
            for (let i = opener.start; i < opener.end; i++)
                ranges.set(i, {
                    start: opener.start,
                    end: opener.end,
                    matchStart: start,
                    matchEnd: end
                })
            for (let i = start; i < end; i++)
                ranges.set(i, {
                    start,
                    end,
                    matchStart: opener.start,
                    matchEnd: opener.end
                })
        } else {
            stack.push({ start, end })
        }
    }
    return ranges
}

export function FullForm({ text, className }: { text: string; className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chars = useMemo(() => Array.from(text), [text])
    const bracketInfo = useMemo(() => analyzeBrackets(chars), [chars])
    const keywordInfo = useMemo(() => analyzeKeywords(text), [text])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const getSpans = () =>
            Array.from(
                container.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')
            )

        // Expression is changing: strip old bracket colors first so stale
        // colors don't linger on mismatched spans during Calligraph's
        // add/remove animation. applyColors() below fades new colors back
        // in via the CSS transition once the new text settles.
        getSpans().forEach((span) => {
            span.classList.remove('bracket-hint')
            span.style.removeProperty('--bracket-color')
        })

        // Calligraph animates char add/remove via AnimatePresence, so mid-transition
        // the DOM briefly holds both outgoing and incoming spans. Skip applying until
        // the span count matches the text again; the MutationObserver retries on
        // every DOM change, including when the outgoing spans finish exiting.
        const applyColors = () => {
            const spans = getSpans()
            if (spans.length !== chars.length) return
            spans.forEach((span, i) => {
                const info = bracketInfo.get(i)
                if (info) {
                    span.classList.add('bracket-hint')
                    span.style.setProperty('--bracket-color', bracketColor(info.depth))
                } else {
                    span.classList.remove('bracket-hint')
                    span.style.removeProperty('--bracket-color')
                }
            })
        }
        applyColors()
        const observer = new MutationObserver(applyColors)
        observer.observe(container, { childList: true, subtree: true })

        let highlighted: HTMLElement[] = []
        const clear = () => {
            highlighted.forEach((el) =>
                el.classList.remove('paren-match', 'keyword-match')
            )
            highlighted = []
        }
        const onOver = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest<HTMLElement>(
                'span[aria-hidden="true"]'
            )
            clear()
            if (!target) return
            const spans = getSpans()
            if (spans.length !== chars.length) return
            const i = spans.indexOf(target)
            if (i === -1) return
            const info = bracketInfo.get(i)
            if (info && info.match !== -1) {
                highlighted = [spans[i], spans[info.match]]
                highlighted.forEach((el) => el.classList.add('paren-match'))
                return
            }
            const kw = keywordInfo.get(i)
            if (!kw) return
            highlighted = [
                ...spans.slice(kw.start, kw.end),
                ...spans.slice(kw.matchStart, kw.matchEnd)
            ]
            highlighted.forEach((el) => el.classList.add('keyword-match'))
        }
        container.addEventListener('mouseover', onOver)
        container.addEventListener('mouseout', clear)
        return () => {
            observer.disconnect()
            container.removeEventListener('mouseover', onOver)
            container.removeEventListener('mouseout', clear)
        }
    }, [chars, bracketInfo, keywordInfo])

    return (
        <div
            className={`full-form${className ? ` ${className}` : ''}`}
            ref={containerRef}
        >
            <Calligraph>{text}</Calligraph>
        </div>
    )
}
