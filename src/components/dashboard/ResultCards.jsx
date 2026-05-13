export function ResultCard({ label, subtitle, value, unit, tone = 'default' }) {
  return (
    <article className={`result-card result-card-${tone}`}>
      <span className="result-label">{label}</span>
      <span className="result-subtitle">{subtitle}</span>
      <strong className="result-value">
        {value}
        {unit ? <span>{unit}</span> : null}
      </strong>
    </article>
  )
}


