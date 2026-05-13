import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompact } from '../../utils/numberUtils.js'
import { ChartTooltip } from './ChartPrimitives.jsx'

export function ThreePhaseCurrentPanel({ motor }) {
  const isMotorEnergized = motor.isMotorEnergized
  const currentTitle =
    motor.currentMode === 'off'
      ? '전원 OFF / Supply OFF'
      : motor.currentMode === 'starting'
        ? '기동 전류 증가 / Increased starting current'
        : '정상 3상 전류 / Balanced 3-phase current'

  return (
    <div className={`panel chart-panel ${isMotorEnergized ? 'is-energized' : 'is-current-off'}`}>
      <div className="panel-heading">
        <div>
          <h2>3상 전류 파형</h2>
          <p>{currentTitle}</p>
        </div>
        <span className={`metric-chip ${isMotorEnergized ? '' : 'metric-chip-off'}`}>
          {isMotorEnergized ? `Im ${formatCompact(motor.currentPeak, 1)} A` : '전원 OFF'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={motor.currentData}
          margin={{ top: 12, right: 18, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke="#23313a" strokeDasharray="4 4" />
          <XAxis
            dataKey="degree"
            stroke="#81909b"
            tickLine={false}
            unit="°"
          />
          <YAxis
            domain={[-motor.currentYMax, motor.currentYMax]}
            stroke="#81909b"
            tickFormatter={(value) => formatCompact(value, 0)}
            tickLine={false}
            unit=" A"
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Line
            dataKey="ia"
            dot={false}
            isAnimationActive={false}
            name="ia"
            stroke="#00e5ff"
            strokeWidth={2.5}
            type="monotone"
          />
          <Line
            dataKey="ib"
            dot={false}
            isAnimationActive={false}
            name="ib"
            stroke="#ffb020"
            strokeWidth={2.5}
            type="monotone"
          />
          <Line
            dataKey="ic"
            dot={false}
            isAnimationActive={false}
            name="ic"
            stroke="#ff4d6d"
            strokeWidth={2.5}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="chart-explanation current-explanation">
        전류 파형은 회전자계 형성 원리를 설명하기 위한 교육용 단순화 모델이다.
        The current waveform is a simplified educational model for explaining rotating
        magnetic field formation.
      </p>
    </div>
  )
}


