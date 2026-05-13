import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompact } from '../../utils/numberUtils.js'
import { ChartTooltip } from './ChartPrimitives.jsx'

export function ThermalChart({ thermal }) {
  const yMax = Math.max(
    thermal.maxWindingTemperature * 1.08,
    ...thermal.graphData.map((point) => point.windingTemperature),
    ...thermal.graphData.map((point) => point.steadyStateTemperature ?? thermal.ambientTemperature),
    thermal.ambientTemperature + 10,
  )

  return (
    <section className="panel thermal-chart-panel">
      <div className="panel-heading">
        <div>
          <h2>권선온도 상승 곡선 / Winding Temperature Rise</h2>
          <p>Current operating condition projected with a simplified first-order thermal model</p>
        </div>
        <span className={`metric-chip voltage-chip-${thermal.thermalStatus.tone === 'caution' ? 'caution' : thermal.thermalStatus.tone === 'danger' ? 'danger' : 'normal'}`}>
          {thermal.thermalStatus.label}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart
          data={thermal.graphData}
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
            tickFormatter={(value) => formatCompact(value, 0)}
            tickLine={false}
            unit=" s"
          />
          <YAxis
            domain={[0, yMax]}
            label={{
              value: '권선온도 [°C]',
              angle: -90,
              fill: '#a8bfcd',
              position: 'insideLeft',
              offset: -4,
            }}
            stroke="#ffb020"
            tickFormatter={(value) => formatCompact(value, 0)}
            tickLine={false}
            unit=" °C"
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Line
            dataKey="windingTemperature"
            dot={false}
            isAnimationActive={false}
            name="권선온도 / Winding Temperature"
            stroke="#ffb020"
            strokeWidth={3}
            type="monotone"
          />
          <Line
            dataKey="ambientTemperature"
            dot={false}
            isAnimationActive={false}
            name="주변온도 / Ambient"
            stroke="#00e5ff"
            strokeDasharray="7 5"
            strokeWidth={2.2}
            type="monotone"
          />
          <Line
            dataKey="maxWindingTemperature"
            dot={false}
            isAnimationActive={false}
            name="허용 권선온도 / Tmax"
            stroke="#ff4d6d"
            strokeDasharray="5 5"
            strokeWidth={2.4}
            type="monotone"
          />
          <Line
            dataKey="steadyStateTemperature"
            dot={false}
            isAnimationActive={false}
            name="예상 정상상태 / Estimated steady-state"
            stroke="#2dfc85"
            strokeDasharray="8 4"
            strokeWidth={2.2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="chart-explanation">
        RUN 또는 STARTING 상태에서는 손실을 열원으로 사용하고 회전자 속도에 따른 팬 냉각을 적용합니다.
        STOP 또는 EMERGENCY STOP 상태에서는 전기적 손실을 0으로 두고 자연 냉각과 남은 회전 속도에 따른 팬 냉각으로 주변온도 방향으로 냉각됩니다.
      </p>
    </section>
  )
}
