import { useEffect, useRef, useState } from 'react'
import { clamp, formatCompact } from '../../utils/numberUtils.js'

export function Motor3DPanel({ motor }) {
  const [angles, setAngles] = useState({ field: 0, rotor: 0 })
  const isMotorEnergized = motor.isMotorEnergized
  const isRotorMoving = motor.isRotorMoving
  const rotorRatio = clamp(motor.nr / Math.max(motor.ns, 0.0001), 0, 1)
  const rotorRatioRef = useRef(rotorRatio)
  const fieldAngle = isMotorEnergized ? angles.field : 0
  const rotorAngle = isRotorMoving ? angles.rotor : 0
  const normalizedRotorAngle = ((rotorAngle % 360) + 360) % 360
  const shaftStripeOffset = (normalizedRotorAngle / 360) * 34
  const rotorStripeOffset = (normalizedRotorAngle / 360) * 42

  useEffect(() => {
    rotorRatioRef.current = rotorRatio
  }, [rotorRatio])

  useEffect(() => {
    if (!isMotorEnergized && !isRotorMoving) return undefined

    let frameId
    let lastTime
    const degreesPerMs = 360 / (motor.visualFieldDuration * 1000)

    const tick = (time) => {
      if (lastTime === undefined) {
        lastTime = time
      }

      const delta = Math.min(time - lastTime, 64)
      lastTime = time
      setAngles((current) => ({
        field: isMotorEnergized ? current.field + delta * degreesPerMs : 0,
        rotor: current.rotor + delta * degreesPerMs * rotorRatioRef.current,
      }))
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [isMotorEnergized, isRotorMoving, motor.visualFieldDuration])

  return (
    <div
      className={[
        'panel motor-3d-panel',
        isMotorEnergized ? 'is-energized' : 'is-deenergized',
        `motor-state-${motor.simulationState ?? 'standby'}`,
        `motor-tone-${motor.state?.tone ?? 'balanced'}`,
      ].join(' ')}
    >
      <div className="panel-heading">
        <div>
          <h2>전동기 3D 모델</h2>
          <p>Simplified 3D Motor Model</p>
        </div>
        <span className={`metric-chip ${isMotorEnergized ? '' : 'metric-chip-off'}`}>
          {isMotorEnergized
            ? `Ns ${formatCompact(motor.ns, 0)} rpm · Nr ${formatCompact(motor.nr, 0)} rpm`
            : '전원 OFF · Supply OFF'}
        </span>
      </div>

      <svg
        className="motor3d-svg"
        viewBox="0 0 420 300"
        role="img"
        aria-labelledby="motor3d-title motor3d-desc"
      >
        <title id="motor3d-title">단순화된 3D 유도 전동기 모델</title>
        <desc id="motor3d-desc">
          원통형 고정자 하우징, 회전자, 축, 회전자계 방향 및 회전자 회전 방향을
          3D 스타일로 표시합니다.
        </desc>
        <defs>
          <linearGradient id="housingBody" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#365366" />
            <stop offset="34%" stopColor="#182a3a" />
            <stop offset="70%" stopColor="#0b1522" />
            <stop offset="100%" stopColor="#050910" />
          </linearGradient>
          <radialGradient id="housingFace" cx="44%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#46687c" />
            <stop offset="52%" stopColor="#152638" />
            <stop offset="100%" stopColor="#050910" />
          </radialGradient>
          <linearGradient id="rotorCore3d" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#52606a" />
            <stop offset="45%" stopColor="#24313a" />
            <stop offset="100%" stopColor="#101820" />
          </linearGradient>
          <linearGradient id="shaftSteel" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#697985" />
            <stop offset="50%" stopColor="#d4e0e6" />
            <stop offset="100%" stopColor="#43535f" />
          </linearGradient>
          <linearGradient id="shaftGloss" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.74)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.42)" />
          </linearGradient>
          <linearGradient id="rotorGloss3d" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="36%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.44)" />
          </linearGradient>
          <clipPath id="shaftClip">
            <rect x="42" y="142" width="336" height="16" rx="8" />
          </clipPath>
          <clipPath id="rotorBodyClip">
            <path d="M118 124 H288 C305 124 318 136 318 150 C318 164 305 176 288 176 H118 C128 162 128 138 118 124 Z" />
          </clipPath>
          <marker
            id="arrow3dField"
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#00e5ff" />
          </marker>
          <marker
            id="arrow3dRotor"
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#ffb020" />
          </marker>
        </defs>

        <ellipse className="motor3d-shadow" cx="210" cy="242" rx="148" ry="24" />

        <g className="motor3d-shaft-assembly">
          <rect className="motor3d-shaft" x="42" y="142" width="336" height="16" rx="8" />
          <g clipPath="url(#shaftClip)">
            <g
              className="motor3d-shaft-stripes"
              transform={`translate(${shaftStripeOffset - 34} 0)`}
            >
              {Array.from({ length: 18 }, (_, index) => (
                <line
                  key={index}
                  x1={index * 34}
                  x2={index * 34 + 22}
                  y1="160"
                  y2="140"
                />
              ))}
            </g>
          </g>
          <rect className="motor3d-shaft-gloss" x="46" y="143" width="328" height="6" rx="3" />
          <ellipse
            className="motor3d-shaft-end motor3d-shaft-end-left"
            cx="42"
            cy="150"
            rx="10"
            ry="8"
          />
          <ellipse
            className="motor3d-shaft-end motor3d-shaft-end-right"
            cx="378"
            cy="150"
            rx="10"
            ry="8"
          />
          <g className="motor3d-shaft-end-marks" transform={`rotate(${rotorAngle} 378 150)`}>
            <line x1="378" x2="378" y1="143" y2="157" />
            <line x1="371" x2="385" y1="150" y2="150" />
          </g>
        </g>

        <path
          className="motor3d-housing"
          d="M104 84 H292 C326 84 354 114 354 150 C354 186 326 216 292 216 H104 C128 196 139 174 139 150 C139 126 128 104 104 84 Z"
        />
        <ellipse className="motor3d-back-face" cx="104" cy="150" rx="46" ry="66" />
        <ellipse className="motor3d-front-face" cx="292" cy="150" rx="62" ry="66" />
        <ellipse className="motor3d-front-bore" cx="292" cy="150" rx="38" ry="43" />

        {Array.from({ length: 8 }, (_, index) => (
          <path
            key={index}
            className="motor3d-fin"
            d={`M${126 + index * 21} 91 C${146 + index * 21} 108 ${146 + index * 21} 192 ${126 + index * 21} 209`}
          />
        ))}

        <path
          className="motor3d-rotor"
          d="M118 124 H288 C305 124 318 136 318 150 C318 164 305 176 288 176 H118 C128 162 128 138 118 124 Z"
        />
        <g clipPath="url(#rotorBodyClip)">
          <rect className="motor3d-rotor-gloss" x="122" y="126" width="190" height="16" rx="8" />
          <g
            className="motor3d-rotor-surface-stripes"
            transform={`translate(${rotorStripeOffset - 42} 0)`}
          >
            {Array.from({ length: 11 }, (_, index) => (
              <path
                key={index}
                d={`M${105 + index * 42} 125 C${120 + index * 42} 135 ${120 + index * 42} 165 ${105 + index * 42} 175`}
              />
            ))}
          </g>
          <path
            className="motor3d-rotor-shadow-band"
            d="M116 164 H288 C300 164 311 158 316 150 C313 166 300 176 288 176 H118 C121 171 121 169 116 164 Z"
          />
        </g>
        <ellipse className="motor3d-rotor-face" cx="288" cy="150" rx="30" ry="27" />
        <g className="motor3d-rotor-marks" transform={`rotate(${rotorAngle} 292 150)`}>
          <line x1="292" x2="292" y1="126" y2="137" />
          <line x1="292" x2="292" y1="163" y2="174" />
          <line x1="268" x2="279" y1="150" y2="150" />
          <line x1="305" x2="316" y1="150" y2="150" />
          <circle cx="292" cy="150" r="4" />
        </g>

        {isMotorEnergized ? (
          <g className="motor3d-field-spin" transform={`rotate(${fieldAngle} 292 150)`}>
            <ellipse className="motor3d-field-orbit-3d" cx="292" cy="150" rx="69" ry="55" />
            <path
              className="motor3d-field-arrow"
              d="M292 91 C334 98 357 130 348 164"
              markerEnd="url(#arrow3dField)"
            />
          </g>
        ) : (
          <g className="motor3d-field-off">
            <ellipse cx="292" cy="150" rx="58" ry="47" />
            <path d="M258 112 H326" />
          </g>
        )}

        <g className="motor3d-rotor-spin" transform={`rotate(${rotorAngle} 292 150)`}>
          <ellipse className="motor3d-rotor-orbit-3d" cx="292" cy="150" rx="45" ry="35" />
          <path
            className="motor3d-rotor-arrow"
            d="M273 121 C304 108 331 128 329 158"
            markerEnd="url(#arrow3dRotor)"
          />
        </g>

        <g className="motor3d-label motor3d-label-stator">
          <line x1="139" x2="106" y1="105" y2="58" />
          <text x="42" y="48">
            고정자
            <tspan x="42" dy="12">
              Stator
            </tspan>
          </text>
        </g>
        <g className="motor3d-label motor3d-label-rotor">
          <line x1="242" x2="207" y1="150" y2="104" />
          <text x="174" y="91">
            회전자
            <tspan x="174" dy="12">
              Rotor
            </tspan>
          </text>
        </g>
        <g className="motor3d-label motor3d-label-shaft">
          <line x1="70" x2="102" y1="150" y2="238" />
          <text x="80" y="260">
            축
            <tspan x="80" dy="12">
              Shaft
            </tspan>
          </text>
        </g>
        <g className="motor3d-label motor3d-label-field">
          <line x1="343" x2="364" y1="105" y2="62" />
          <text x="330" y="47">
            {isMotorEnergized ? '회전자계' : '회전자계 OFF'}
            <tspan x="330" dy="12">
              {isMotorEnergized ? 'Rotating field' : 'Field OFF'}
            </tspan>
          </text>
        </g>
      </svg>
    </div>
  )
}

