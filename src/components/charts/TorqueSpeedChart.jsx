import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompact, toFiniteNumber } from '../../utils/numberUtils.js'
import { ChartTooltip, TorquePointMarker } from './ChartPrimitives.jsx'

const MARKERS = {
  starting: {
    color: '#ffb020',
    label: '기동토크',
    legend: '기동토크 / Starting Torque',
  },
  maximum: {
    color: '#ff4d6d',
    label: '최대토크',
    legend: '최대토크 / Maximum Torque',
  },
  operating: {
    color: '#2dfc85',
    label: '운전점',
    legend: '운전점 / Operating Point',
  },
}

function createMarkerPoint(point, marker) {
  const source = Array.isArray(point) ? point[0] : point
  const speed = toFiniteNumber(source?.speed, Number.NaN)
  const torque = toFiniteNumber(source?.torque, Number.NaN)

  if (!Number.isFinite(speed) || !Number.isFinite(torque) || speed < 0 || torque < 0) {
    return []
  }

  return [{
    speed,
    torque,
    markerLabel: marker.legend,
    markerColor: marker.color,
  }]
}

function maxTorqueValue(...values) {
  return values.reduce((maxValue, value) => {
    const nextValue = toFiniteNumber(value, 0)
    return Number.isFinite(nextValue) ? Math.max(maxValue, nextValue) : maxValue
  }, 1)
}

export function TorqueSpeedChart({ motor, displayedMotor }) {
  const startingPoint = createMarkerPoint(motor.startingTorquePoint, MARKERS.starting)
  const maximumPoint = createMarkerPoint(motor.maxTorquePoint, MARKERS.maximum)
  const showOperatingPoint = motor.operatingPointMode !== 'auto' || motor.hasLoadIntersection
  const operatingPoint = showOperatingPoint
    ? createMarkerPoint(displayedMotor.operatingPoint, MARKERS.operating)
    : []
  const markerYMax = maxTorqueValue(
    displayedMotor.torqueYMax,
    motor.torqueYMax,
    startingPoint[0]?.torque,
    maximumPoint[0]?.torque,
    operatingPoint[0]?.torque,
  ) * 1.08
  const xDomainMax = Math.max(1, Math.ceil(toFiniteNumber(motor.ns, 0) / 100) * 100)

  return (
    <section className="panel torque-panel">
      <div className="panel-heading">
        <div>
          <h2>토크-속도 특성 곡선</h2>
          <p>Torque-speed characteristic with load reference</p>
        </div>
        <span className="metric-chip">
          Vth {formatCompact(motor.vth, 1)} V · Rth{' '}
          {formatCompact(motor.rth, 2)} Ω
        </span>
      </div>

      {!showOperatingPoint ? (
        <div className="chart-warning-label">안정 운전점 없음</div>
      ) : null}

      <ResponsiveContainer width="100%" height={390}>
        <ComposedChart
          data={motor.torqueSpeedData}
          margin={{ top: 30, right: 58, bottom: 42, left: 18 }}
        >
          <CartesianGrid stroke="rgba(132, 169, 193, 0.18)" strokeDasharray="4 4" />
          <XAxis
            dataKey="speed"
            domain={[0, xDomainMax]}
            label={{
              value: '회전자 속도 Nr [rpm]',
              fill: '#a8bfcd',
              position: 'insideBottom',
              offset: -24,
            }}
            name="Rotor speed Nr"
            stroke="#8ea7b7"
            tickFormatter={(value) => formatCompact(value, 0)}
            tickLine={false}
            type="number"
            unit=" rpm"
          />
          <YAxis
            domain={[0, markerYMax]}
            label={{
              value: '전자기 토크 Te [N·m]',
              angle: -90,
              fill: '#a8bfcd',
              position: 'insideLeft',
              offset: -4,
            }}
            name="Electromagnetic torque Te"
            stroke="#8ea7b7"
            tickFormatter={(value) => formatCompact(value, 0)}
            tickLine={false}
            unit=" N·m"
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Line
            dataKey="torque"
            dot={false}
            isAnimationActive={false}
            name="전동기 토크 / Motor Torque"
            stroke="#00e5ff"
            strokeWidth={3}
            type="monotone"
          />
          <Line
            dataKey="loadTorque"
            dot={false}
            isAnimationActive={false}
            name="부하 토크 / Load Torque"
            stroke="#ffb020"
            strokeDasharray="7 5"
            strokeWidth={3}
            type="monotone"
          />
          <Scatter
            data={startingPoint}
            dataKey="torque"
            fill={MARKERS.starting.color}
            isAnimationActive={false}
            name={MARKERS.starting.legend}
            shape={(props) => (
              <TorquePointMarker
                {...props}
                anchor="start"
                color={MARKERS.starting.color}
                label={MARKERS.starting.label}
                labelDx={14}
                labelDy={-22}
              />
            )}
          />
          <Scatter
            data={maximumPoint}
            dataKey="torque"
            fill={MARKERS.maximum.color}
            isAnimationActive={false}
            name={MARKERS.maximum.legend}
            shape={(props) => (
              <TorquePointMarker
                {...props}
                anchor="middle"
                color={MARKERS.maximum.color}
                label={MARKERS.maximum.label}
                labelDx={0}
                labelDy={-24}
              />
            )}
          />
          {showOperatingPoint ? (
            <Scatter
              data={operatingPoint}
              dataKey="torque"
              fill={MARKERS.operating.color}
              isAnimationActive={false}
              name={MARKERS.operating.legend}
              shape={(props) => (
                <TorquePointMarker
                  {...props}
                  anchor="end"
                  color={MARKERS.operating.color}
                  label={MARKERS.operating.label}
                  labelDx={-14}
                  labelDy={-22}
                />
              )}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="chart-explanation">
        {motor.operatingPointMode === 'auto' && motor.hasLoadIntersection
          ? '자동 운전점은 전동기 토크 곡선과 선택한 부하토크 곡선이 만나는 지점이며, 이때 전자기 토크와 부하토크가 평형을 이룹니다.'
          : motor.operatingPointMode === 'auto'
            ? '전동기 토크와 부하토크가 안정적으로 만나는 지점이 없어 정상 운전이 어렵습니다.'
            : '수동 모드에서는 입력한 슬립 값을 기준으로 현재 운전점을 표시합니다.'}{' '}
        현재 부하 모델은 {motor.loadModelLabel}입니다. 유도전동기는 슬립이 존재해야 토크가 발생하며,
        회전자 속도가 동기속도에 가까워질수록 슬립이 작아집니다.
      </p>
    </section>
  )
}
