export function WarningPanel({ warnings }) {
  const severityLabel = (tone) => {
    if (tone === 'normal') return '정상'
    if (tone === 'danger') return '위험'
    if (tone === 'caution') return '주의'
    if (tone === 'starting') return '기동'
    if (tone === 'off') return 'OFF'
    return '상태'
  }
  const hasDanger = warnings.some((warning) => warning.tone === 'danger')
  const hasActive = warnings.some((warning) =>
    warning.tone === 'caution' || warning.tone === 'starting',
  )
  const panelTone = hasDanger ? 'danger' : hasActive ? 'active' : 'normal'

  return (
    <section
      className={`panel warning-panel warning-panel-${panelTone}`}
      aria-label="motor operating warnings"
      aria-live="polite"
    >
      <div className="panel-heading warning-heading">
        <div>
          <h2>운전 상태 경고</h2>
          <p>Intelligent operating condition indicators</p>
        </div>
        <span className={`metric-chip warning-panel-chip warning-panel-chip-${panelTone}`}>
          {hasDanger ? 'ALARM' : hasActive ? 'ACTIVE' : 'MONITOR'}
        </span>
      </div>

      <div className="warning-grid">
        {warnings.map((warning) => (
          <article className={`warning-card warning-card-${warning.tone}`} key={warning.id}>
            <span className="warning-severity">{severityLabel(warning.tone)}</span>
            <strong>{warning.message}</strong>
            <p>{warning.detail}</p>
          </article>
        ))}
      </div>

      <p className="warning-note">
        경고는 현재 시뮬레이션 상태를 즉시 반영하는 교육용 운전 지표이며, 실제 현장의 보호계전기 또는 트립 설정값을 대체하지 않습니다.
      </p>
    </section>
  )
}
