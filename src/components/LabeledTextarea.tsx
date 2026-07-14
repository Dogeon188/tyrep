import type { ReactNode } from 'react'

export function LabeledTextarea({
  id,
  label,
  value,
  onChange,
  hint,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="labeled-textarea">
      <label htmlFor={id} className="input-label">
        {label}
      </label>
      <div className="input-row">
        <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
        <div className="syntax-hint">{hint}</div>
      </div>
      {children}
    </div>
  )
}
