import { useEffect, useState } from 'react'
import { clamp, formatCompact } from '../../utils/numberUtils.js'

const CROSS_SECTION_VISUAL_RPM_SCALE = 0.04

function polarPoint(angle, radius) {
  const radians = (angle * Math.PI) / 180
  return {
    x: 160 + Math.cos(radians) * radius,
    y: 160 + Math.sin(radians) * radius,
  }
}

export function MotorVisualization({ motor }) {
  const [angles, setAngles] = useState({ field: 0, rotor: 0 })
  const isMotorEnergized = motor.isMotorEnergized
  const isRotorMoving = motor.isRotorMoving
  const fieldDegreesPerMs = Math.max(0, motor.ns) * 360 / 60000 * CROSS_SECTION_VISUAL_RPM_SCALE
  const rotorDegreesPerMs = Math.max(0, motor.nr) * 360 / 60000 * CROSS_SECTION_VISUAL_RPM_SCALE
  const fieldAngle = isMotorEnergized ? angles.field : 0
  const rotorAngle = isRotorMoving ? angles.rotor : 0
  const electricalAngle = (fieldAngle * Math.PI) / 180
  const arrowCenter = 160
  const rotorArrowEndX = 226
  const magneticArrowEndX = rotorArrowEndX

  useEffect(() => {
    if (!isMotorEnergized && !isRotorMoving) return undefined

    let frameId
    let lastTime

    const tick = (time) => {
      if (lastTime === undefined) {
        lastTime = time
      }

      const delta = Math.min(time - lastTime, 64)
      lastTime = time
      setAngles((current) => ({
        field: isMotorEnergized ? current.field + delta * fieldDegreesPerMs : 0,
        rotor: isRotorMoving ? current.rotor + delta * rotorDegreesPerMs : current.rotor,
      }))
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [fieldDegreesPerMs, isMotorEnergized, isRotorMoving, rotorDegreesPerMs])

  const phases = [
    {
      id: 'A',
      angle: -90,
      color: '#00e5ff',
      current: motor.currentPeak * Math.sin(electricalAngle),
      label: 'A상',
      subtitle: 'Phase A',
    },
    {
      id: 'B',
      angle: 30,
      color: '#ffb020',
      current: motor.currentPeak * Math.sin(electricalAngle - (2 * Math.PI) / 3),
      label: 'B상',
      subtitle: 'Phase B',
    },
    {
      id: 'C',
      angle: 150,
      color: '#ff4d6d',
      current: motor.currentPeak * Math.sin(electricalAngle - (4 * Math.PI) / 3),
      label: 'C상',
      subtitle: 'Phase C',
    },
  ].map((phase) => {
    const magnitude = Math.abs(phase.current)
    const normalized = clamp(magnitude / Math.max(motor.currentPeak, 0.0001), 0, 1)
    const currentAngle = phase.current >= 0 ? phase.angle : phase.angle + 180

    return {
      ...phase,
      currentText: `${phase.current >= 0 ? '+' : '-'}${formatCompact(magnitude, 1)} A`,
      end: polarPoint(phase.angle, 94),
      start: polarPoint(phase.angle + 180, 94),
      labelPoint: polarPoint(phase.angle, 137),
      currentEnd: polarPoint(currentAngle, 30 + normalized * 58),
      normalized,
    }
  })

  return (
    <div
      className={[
        'motor-panel',
        isMotorEnergized ? 'is-energized' : 'is-deenergized',
        `motor-state-${motor.simulationState ?? 'standby'}`,
        `motor-tone-${motor.state?.tone ?? 'balanced'}`,
      ].join(' ')}
    >
      <div className="panel-heading">
        <div>
          <h2>전동기 단면 시각화</h2>
          <p>Live motor field visualization</p>
        </div>
        <span className={`state-pill state-${motor.state.tone}`}>
          {motor.state.label}
        </span>
      </div>

      <div className="motor-speed-strip">
        <div>
          <span>회전자계 속도</span>
          <small>{isMotorEnergized ? 'Magnetic field speed' : 'Rotating field OFF'}</small>
          <strong>
            {isMotorEnergized ? formatCompact(motor.ns, 0) : 'OFF'}
            <em>{isMotorEnergized ? 'rpm' : 'supply'}</em>
          </strong>
        </div>
        <div>
          <span>회전자 속도</span>
          <small>Rotor speed</small>
          <strong>
            {formatCompact(motor.nr, 0)}
            <em>rpm</em>
          </strong>
        </div>
        <div>
          <span>슬립</span>
          <small>{motor.isSlipDefined ? 'Slip' : 'Slip N/A - field OFF'}</small>
          <strong>
            {motor.isSlipDefined ? formatCompact(motor.slipPercent, 2) : '--'}
            <em>{motor.isSlipDefined ? '%' : 'N/A'}</em>
          </strong>
        </div>
      </div>

      <svg
        className="motor-svg"
        viewBox="0 0 320 320"
        role="img"
        aria-labelledby="motor-title motor-desc"
      >
        <title id="motor-title">3상 유도 전동기 회전 자계 시각화</title>
        <desc id="motor-desc">
          고정자, 회전자, 120도 간격의 A B C 상축, 동기 속도 자계 벡터와
          슬립에 따라 느리게 회전하는 회전자 벡터를 표시합니다.
        </desc>
        <defs>
          <radialGradient id="statorMetal" cx="42%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#344b5b" />
            <stop offset="45%" stopColor="#162534" />
            <stop offset="76%" stopColor="#0a131f" />
            <stop offset="100%" stopColor="#02060b" />
          </radialGradient>
          <radialGradient id="statorBore" cx="47%" cy="40%" r="68%">
            <stop offset="0%" stopColor="#132433" />
            <stop offset="70%" stopColor="#07111c" />
            <stop offset="100%" stopColor="#03070d" />
          </radialGradient>
          <radialGradient id="rotorGlow" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#52646d" />
            <stop offset="42%" stopColor="#273641" />
            <stop offset="78%" stopColor="#101922" />
            <stop offset="100%" stopColor="#070d13" />
          </radialGradient>
          <marker
            id="arrowField"
            markerHeight="7"
            markerWidth="7"
            orient="auto"
            refX="6"
            refY="3.5"
          >
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#00e5ff" />
          </marker>
          <marker
            id="arrowRotor"
            markerHeight="7"
            markerWidth="7"
            orient="auto"
            refX="6"
            refY="3.5"
          >
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#ffb020" />
          </marker>
        </defs>

        <circle className="stator-shadow" cx="160" cy="164" r="132" />
        <circle className="stator-shell" cx="160" cy="160" r="126" />
        <circle className="stator-outer-highlight" cx="160" cy="160" r="122" />

        {Array.from({ length: 36 }, (_, index) => {
          const start = polarPoint(index * 10, 109)
          const end = polarPoint(index * 10, 122)
          return (
            <line
              key={index}
              className="stator-slot"
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            />
          )
        })}

        <circle className="stator-bore" cx="160" cy="160" r="102" />
        <circle className="field-orbit" cx="160" cy="160" r="62" />
        <circle className="rotor-orbit" cx="160" cy="160" r="70" />
        <circle className="stator-inner" cx="160" cy="160" r="104" />

        {phases.map((phase) => {
          const labelWidth = 70
          const labelX =
            phase.id === 'B'
              ? Math.min(phase.labelPoint.x - 8, 320 - labelWidth - 6)
              : phase.id === 'C'
                ? Math.max(phase.labelPoint.x - labelWidth + 8, 6)
                : phase.labelPoint.x - labelWidth / 2
          const labelY = phase.id === 'A' ? phase.labelPoint.y - 12 : phase.labelPoint.y - 14

          return (
            <g key={phase.id}>
              <line
                className="phase-axis"
                style={{ stroke: phase.color }}
                x1={phase.start.x}
                y1={phase.start.y}
                x2={phase.end.x}
                y2={phase.end.y}
              />
              <line
                className="phase-current-vector"
                style={{
                  stroke: phase.color,
                  opacity: isMotorEnergized ? 0.28 + phase.normalized * 0.72 : 0.08,
                }}
                x1="160"
                y1="160"
                x2={phase.currentEnd.x}
                y2={phase.currentEnd.y}
              />
              <circle
                className="phase-terminal"
                style={{ fill: phase.color }}
                cx={phase.end.x}
                cy={phase.end.y}
                r="5"
              />
              <g className="phase-readout" transform={`translate(${labelX} ${labelY})`}>
                <rect width={labelWidth} height="35" rx="7" />
                <text x="8" y="13">
                  {phase.label}
                  <tspan className="phase-english" dx="4">
                    / {phase.subtitle}
                  </tspan>
                </text>
                <text className="phase-current-text" x="8" y="27">
                  i{phase.id} {phase.currentText}
                </text>
              </g>
            </g>
          )
        })}

        <circle className="rotor-body" cx="160" cy="160" r="64" />
        <circle className="rotor-ring" cx="160" cy="160" r="42" />
        <circle className="shaft" cx="160" cy="160" r="12" />

        {isMotorEnergized ? (
          <g transform={`rotate(${fieldAngle} 160 160)`}>
            <line
              className="field-vector-glow"
              x1={arrowCenter}
              x2={magneticArrowEndX}
              y1={arrowCenter}
              y2={arrowCenter}
            />
            <line
              className="field-vector"
              markerEnd="url(#arrowField)"
              x1={arrowCenter}
              x2={magneticArrowEndX}
              y1={arrowCenter}
              y2={arrowCenter}
            />
            <circle className="field-tip" cx={magneticArrowEndX} cy={arrowCenter} r="3.4" />
          </g>
        ) : (
          <g className="field-vector-off">
            <line x1={arrowCenter} x2={magneticArrowEndX - 18} y1={arrowCenter} y2={arrowCenter} />
            <circle cx={magneticArrowEndX - 18} cy={arrowCenter} r="2.8" />
          </g>
        )}

        <g transform={`rotate(${rotorAngle} 160 160)`}>
          <line
            className="rotor-vector"
            markerEnd="url(#arrowRotor)"
            x1="160"
            x2="226"
            y1="160"
            y2="160"
          />
          <circle className="rotor-tip" cx="226" cy="160" r="3.4" />
        </g>

        <text className="svg-korean" x="160" y="154" textAnchor="middle">
          회전자
          <tspan className="svg-english" x="160" dy="13">
            Rotor
          </tspan>
        </text>
        <text className="svg-korean svg-field-copy" x="222" y="82" textAnchor="middle">
          {isMotorEnergized ? '회전자계' : '회전자계 OFF'}
          <tspan className="svg-english" x="222" dy="13">
            {isMotorEnergized ? 'Rotating Magnetic Field' : 'Rotating Field OFF'}
          </tspan>
        </text>
        <text className="svg-korean svg-rotor-copy" x="214" y="221" textAnchor="middle">
          회전자
          <tspan className="svg-english" x="214" dy="13">
            Rotor
          </tspan>
        </text>
        <text className="svg-korean svg-stator-copy" x="160" y="304" textAnchor="middle">
          고정자
          <tspan className="svg-english" x="160" dy="12">
            Stator
          </tspan>
        </text>
      </svg>
    </div>
  )
}

