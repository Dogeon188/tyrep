import { useEffect, useState } from 'react'

export function ReduceMotionToggle() {
    const [reduced, setReduced] = useState(
        () =>
            (localStorage.getItem('reduce-motion') ??
                String(matchMedia('(prefers-reduced-motion: reduce)').matches)) === 'true'
    )

    useEffect(() => {
        if (reduced) document.documentElement.dataset.reduceMotion = ''
        else delete document.documentElement.dataset.reduceMotion
        localStorage.setItem('reduce-motion', String(reduced))
    }, [reduced])

    return (
        <button
            type="button"
            className="icon-button"
            aria-label="Reduce animation"
            title="Reduce animation"
            aria-pressed={reduced}
            onClick={() => setReduced((v) => !v)}
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {/* zap (motion) with a slash when reduced */}
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                {reduced && <path d="M2 2l20 20" />}
            </svg>
        </button>
    )
}
