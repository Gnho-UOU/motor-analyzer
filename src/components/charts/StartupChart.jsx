import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompact } from '../../utils/numberUtils.js'
import { ChartTooltip } from './ChartPrimitives.jsx'

export function StartupResponsePanel({ motor, startupState, statusLabel }) {
  const chartData = startupState.startupData

  return (
    <section className="panel startup-panel">
      <div className="panel-heading">
        <div>
          <h2>기동 특성</h2>
          <p>Startup Response</p>
        </div>
        <span className="metric-chip">{statusLabel}</span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart
          data={chartData}
          margin={{ top: 18, right: 42, bottom: 28, left: 8 }}
        >
          <CartesianGrid stroke="rgba(132, 169, 193, 0.18)" strokeDasharray="4 4" />
          <XAxis
            dataKey="time"
            label={{
              value: '시간 t [s]',
              fill: '#a8bfcd',
              position: 'insideBottom',
              offset: -18,
            }}
            stroke="#8ea7b7"
            tickFormatter={(value) => formatCompact(value, 1)}
            tickLine={false}
            unit=" s"
          />
          <YAxis
            domain={[0, motor.startupSpeedYMax]}
            stroke="#00e5ff"
            tickFormatter={(value) => formatCompact(value, 0)}
            tickLine={false}
            unit=" rpm"
            yAxisId="speed"
          />
          <YAxis
            domain={[0, Math.max(motor.startupTorqueYMax, 105)]}
            orientation="right"
            stroke="#ffb020"
            tickFormatter={(value) => formatCompact(value, 0)}
            tickLine={false}
            yAxisId="response"
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Line
            dataKey="speed"
            dot={false}
            isAnimationActive={false}
            name="Nr(t) [rpm]"
            stroke="#00e5ff"
            strokeWidth={3}
            type="monotone"
            yAxisId="speed"
          />
          <Line
            dataKey="torque"
            dot={false}
            isAnimationActive={false}
            name="Te(t) [N·m]"
            stroke="#ffb020"
            strokeWidth={2.5}
            type="monotone"
            yAxisId="response"
          />
          <Line
            dataKey="loadTorque"
            dot={false}
            isAnimationActive={false}
            name="TL(t) [N·m]"
            stroke="#ff4d6d"
            strokeDasharray="6 5"
            strokeWidth={2.3}
            type="monotone"
            yAxisId="response"
          />
          <Line
            dataKey="slipPercent"
            dot={false}
            isAnimationActive={false}
            name="s(t) [%]"
            stroke="#2dfc85"
            strokeDasharray="7 5"
            strokeWidth={2.5}
            type="monotone"
            yAxisId="response"
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="chart-explanation">
        기동 시에는 회전자 속도가 0 rpm에서 시작하므로 슬립이 거의 100%이다.
        선택한 {motor.loadModelLabel}의 속도별 부하토크를 적용하며, 전자기 토크가
        부하 토크와 마찰 토크보다 크면 회전자가 가속되고 속도가 운전점에 가까워질수록
        슬립은 감소한다.
      </p>
    </section>
  )
}


