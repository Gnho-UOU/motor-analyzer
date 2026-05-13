import { formatCompact, toFiniteNumber } from '../../utils/numberUtils.js'

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const markerPayload = payload.find((entry) => entry.payload?.markerLabel)?.payload

  return (
    <div className="chart-tooltip">
      {markerPayload ? (
        <>
          <strong>{markerPayload.markerLabel}</strong>
          <span style={{ color: markerPayload.markerColor }}>
            {formatCompact(toFiniteNumber(markerPayload.speed), 0)} rpm /{' '}
            {formatCompact(toFiniteNumber(markerPayload.torque), 2)} N·m
          </span>
        </>
      ) : (
        <>
          <strong>{label}</strong>
          {payload.map((entry, index) => (
            <span key={`${entry.name ?? entry.dataKey}-${index}`} style={{ color: entry.color }}>
              {entry.name}: {formatCompact(entry.value, 2)}
            </span>
          ))}
        </>
      )}
    </div>
  )
}

export function TorquePointMarker({
  cx,
  cy,
  payload = {},
  color,
  label,
  labelDx = 10,
  labelDy = -16,
  anchor = 'start',
}) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null

  return (
    <g className="torque-point-marker" style={{ color }}>
      <circle cx={cx} cy={cy} fill={color} r="7" />
      <circle cx={cx} cy={cy} fill="none" r="13" stroke={color} />
      <text textAnchor={anchor} x={cx + labelDx} y={cy + labelDy}>
        {label}
        <tspan x={cx + labelDx} dy="12">
          {formatCompact(toFiniteNumber(payload.speed), 0)} rpm /{' '}
          {formatCompact(toFiniteNumber(payload.torque), 1)} N·m
        </tspan>
      </text>
    </g>
  )
}
