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

export function FullForm({ text }: { text: string }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chars = useMemo(() => Array.from(text), [text])
    const bracketInfo = useMemo(() => analyzeBrackets(chars), [chars])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const getSpans = () =>
            Array.from(
                container.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')
            )

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
            highlighted.forEach((el) => el.classList.remove('paren-match'))
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
            const info = i === -1 ? undefined : bracketInfo.get(i)
            if (!info || info.match === -1) return
            highlighted = [spans[i], spans[info.match]]
            highlighted.forEach((el) => el.classList.add('paren-match'))
        }
        container.addEventListener('mouseover', onOver)
        container.addEventListener('mouseout', clear)
        return () => {
            observer.disconnect()
            container.removeEventListener('mouseover', onOver)
            container.removeEventListener('mouseout', clear)
        }
    }, [chars, bracketInfo])

    return (
        <div className="full-form" ref={containerRef}>
            <Calligraph>{text}</Calligraph>
        </div>
    )
}
