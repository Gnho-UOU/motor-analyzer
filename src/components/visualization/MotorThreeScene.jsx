import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { clamp, formatCompact, toFiniteNumber } from '../../utils/numberUtils.js'

const FAN_BLADE_COUNT = 8
const GUARD_BAR_COUNT = 12
const COOLING_RIB_ANGLES = [-72, -54, -36, -18, 0, 18, 36, 54, 72]

const STATE_STYLE = {
  normal: { accent: '#00e5ff', glow: '#0aa9d8', risk: '#00e5ff' },
  starting: { accent: '#37d9ff', glow: '#2f8cff', risk: '#37d9ff' },
  caution: { accent: '#ffb020', glow: '#ff9d1c', risk: '#ffb020' },
  danger: { accent: '#ff4d6d', glow: '#ff5a24', risk: '#ff334e' },
  emergency: { accent: '#ff1744', glow: '#ff2a1f', risk: '#ff1744' },
  off: { accent: '#7f95a3', glow: '#394955', risk: '#7f95a3' },
}

const PHASE_COILS = [
  { id: 'A', color: '#00e5ff', angle: -90 },
  { id: 'B', color: '#ffb020', angle: 30 },
  { id: 'C', color: '#ff4d6d', angle: 150 },
]

const PART_LABELS = [
  { key: 'stator', label: '고정자', sublabel: 'Stator', position: [0.1, 1.38, 0.72], color: '#00e5ff' },
  { key: 'rotor', label: '회전자', sublabel: 'Rotor', position: [0.18, 0.62, 0.94], color: '#ffb020' },
  { key: 'shaft', label: '축', sublabel: 'Shaft', position: [2.3, -0.22, 0.56], color: '#d5e7ef' },
  { key: 'fan', label: '팬', sublabel: 'Cooling fan', position: [-2.1, 0.86, 0.72], color: '#a9d6e5' },
  { key: 'field', label: '회전자계', sublabel: 'Ns field', position: [-0.82, 1.54, -0.18], color: '#37d9ff' },
]

const dummy = new THREE.Object3D()

function rpmToRadPerSecond(rpm) {
  return Math.max(0, toFiniteNumber(rpm, 0)) * 2 * Math.PI / 60
}

function normalizeTone(value, fallback = 'normal') {
  const tone = typeof value === 'string' ? value : value?.tone
  if (tone === 'warning') return 'caution'
  if (tone === 'balanced' || tone === 'accelerating' || tone === 'info') return 'normal'
  if (tone === 'danger' || tone === 'caution' || tone === 'starting' || tone === 'off') return tone

  return fallback
}

function getSceneTone({ simulationState, warningSeverity, thermalStatus }) {
  if (simulationState === 'emergency-stop') return 'emergency'
  if (simulationState === 'prohibited' || warningSeverity === 'danger') return 'danger'

  const thermalTone = normalizeTone(thermalStatus, 'normal')
  if (thermalTone === 'danger') return 'danger'
  if (warningSeverity === 'caution' || thermalTone === 'caution') return 'caution'
  if (simulationState === 'starting' || warningSeverity === 'starting') return 'starting'
  if (simulationState === 'coasting' || simulationState === 'stopped' || simulationState === 'standby') return 'off'

  return 'normal'
}

function hasWebGLSupport() {
  if (typeof document === 'undefined') return true

  try {
    const canvas = document.createElement('canvas')
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch {
    return false
  }
}

function CoolingRibs({ lowPerformanceMode }) {
  const meshRef = useRef(null)
  const ribAngles = useMemo(
    () => (lowPerformanceMode ? COOLING_RIB_ANGLES.filter((_, index) => index % 2 === 0) : COOLING_RIB_ANGLES),
    [lowPerformanceMode],
  )

  useLayoutEffect(() => {
    if (!meshRef.current) return

    ribAngles.forEach((angle, index) => {
      const radians = angle * Math.PI / 180
      const y = Math.cos(radians) * 0.84
      const z = Math.sin(radians) * 0.84

      dummy.position.set(0, y, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  }, [ribAngles])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ribAngles.length]}>
      <boxGeometry args={[2.82, 0.055, 0.07]} />
      <meshStandardMaterial color="#31495a" metalness={0.72} roughness={0.34} />
    </instancedMesh>
  )
}

function EndShieldBolts({ lowPerformanceMode }) {
  const meshRef = useRef(null)
  const boltCount = lowPerformanceMode ? 6 : 8

  useLayoutEffect(() => {
    if (!meshRef.current) return

    let instanceIndex = 0
    ;[-1.88, 1.88].forEach((x) => {
      for (let index = 0; index < boltCount; index += 1) {
        const angle = index * Math.PI * 2 / boltCount
        const y = Math.cos(angle) * 0.72
        const z = Math.sin(angle) * 0.72

        dummy.position.set(x, y, z)
        dummy.rotation.set(0, 0, Math.PI / 2)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(instanceIndex, dummy.matrix)
        instanceIndex += 1
      }
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  }, [boltCount])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, boltCount * 2]}>
      <cylinderGeometry args={[0.032, 0.032, 0.028, 12]} />
      <meshStandardMaterial color="#a4b4bc" metalness={0.86} roughness={0.22} />
    </instancedMesh>
  )
}

function FanAndGuard({ fanRef, lowPerformanceMode, nsRpm, rotorSpeedRpm, style }) {
  const bladeCount = lowPerformanceMode ? 6 : FAN_BLADE_COUNT
  const guardBars = lowPerformanceMode ? 8 : GUARD_BAR_COUNT
  const fanBlurOpacity = clamp(rotorSpeedRpm / Math.max(nsRpm, 1) * 0.22, 0, lowPerformanceMode ? 0.1 : 0.22)
  const blades = useMemo(() => Array.from({ length: bladeCount }, (_, index) => index), [bladeCount])
  const bars = useMemo(() => Array.from({ length: guardBars }, (_, index) => index), [guardBars])

  return (
    <group position={[-2.05, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.62, 0.62, 0.08, 36, 1, true]} />
        <meshStandardMaterial color="#233744" metalness={0.72} roughness={0.32} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.64, 0.025, 8, 44]} />
        <meshStandardMaterial color="#8ea2ad" metalness={0.78} roughness={0.24} />
      </mesh>
      {bars.map((index) => (
        <group key={index} rotation={[index * Math.PI * 2 / guardBars, 0, 0]}>
          <mesh position={[0, 0.31, 0]}>
            <boxGeometry args={[0.026, 0.58, 0.025]} />
            <meshStandardMaterial color="#78909c" metalness={0.7} roughness={0.28} />
          </mesh>
        </group>
      ))}

      <group ref={fanRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.5, 0.5, 0.018, lowPerformanceMode ? 24 : 36]} />
          <meshBasicMaterial
            color={style.accent}
            transparent
            opacity={fanBlurOpacity}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.14, 24]} />
          <meshStandardMaterial color="#c0ccd2" metalness={0.82} roughness={0.2} />
        </mesh>
        {blades.map((index) => (
          <group key={index} rotation={[index * Math.PI * 2 / bladeCount, 0, 0]}>
            <mesh position={[0, 0.26, 0.035]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.035, 0.42, 0.11]} />
              <meshStandardMaterial
                color="#aebfc7"
                emissive={style.accent}
                emissiveIntensity={0.06}
                metalness={0.62}
                roughness={0.3}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function PhaseCoils({ isFieldOn }) {
  return (
    <group position={[1.62, 0, 0]}>
      {PHASE_COILS.map((phase) => {
        const radians = phase.angle * Math.PI / 180
        const y = Math.cos(radians) * 0.79
        const z = Math.sin(radians) * 0.79

        return (
          <group key={phase.id} position={[0, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <torusGeometry args={[0.12, 0.014, 8, 24]} />
              <meshBasicMaterial color={phase.color} transparent opacity={isFieldOn ? 0.9 : 0.25} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function PowerFlow({ active, count, lowPerformanceMode, style }) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const particleCount = lowPerformanceMode ? Math.min(8, count) : count
  const offsets = useMemo(() => Array.from({ length: particleCount }, (_, index) => index / particleCount), [particleCount])
  const flowCurve = useMemo(
    () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.05, 1.28, -0.72),
      new THREE.Vector3(-1.42, 1.28, -0.62),
      new THREE.Vector3(-0.18, 1.32, -0.42),
      new THREE.Vector3(0.24, 1.08, -0.18),
      new THREE.Vector3(0.1, 0.55, -0.06),
      new THREE.Vector3(1.3, 0.16, -0.04),
      new THREE.Vector3(2.36, 0.02, -0.04),
    ]),
    [],
  )

  useFrame(({ clock }) => {
    if (!meshRef.current) return

    const time = clock.elapsedTime * (active ? 0.28 : 0.01)

    offsets.forEach((offset, index) => {
      const t = (time + offset) % 1
      const point = flowCurve.getPointAt(t)
      const scale = active ? 0.028 : 0.008

      dummy.position.copy(point)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true

    if (materialRef.current) {
      materialRef.current.opacity = active ? 0.68 : 0
    }
  })

  return (
    <group>
      <mesh>
        <tubeGeometry args={[flowCurve, lowPerformanceMode ? 24 : 42, 0.016, 8, false]} />
        <meshBasicMaterial color={style.accent} transparent opacity={active ? 0.18 : 0.06} depthWrite={false} />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial ref={materialRef} color={style.accent} transparent opacity={0.48} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}

function FieldAndRotorRings({ fieldRef, rotorRef, isFieldOn, rotorSpeedRpm, style }) {
  const rotorVisible = Math.abs(rotorSpeedRpm) > 0.5

  return (
    <group position={[0, 0, 0]}>
      <group ref={fieldRef}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.14, 0.015, 8, 64]} />
          <meshBasicMaterial color={style.accent} transparent opacity={isFieldOn ? 0.72 : 0.06} depthWrite={false} />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <sphereGeometry args={[0.052, 12, 12]} />
          <meshBasicMaterial color={style.accent} transparent opacity={isFieldOn ? 0.94 : 0.08} depthWrite={false} />
        </mesh>
      </group>

      <group ref={rotorRef}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.99, 0.013, 8, 64]} />
          <meshBasicMaterial color="#ffb020" transparent opacity={rotorVisible ? 0.68 : 0.14} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.99, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#ffb020" transparent opacity={rotorVisible ? 0.9 : 0.18} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function PartLabels({ lowPerformanceMode }) {
  if (lowPerformanceMode) return null

  return (
    <group>
      {PART_LABELS.map((item) => (
        <Html
          center
          className="motor-three-part-label"
          distanceFactor={3.2}
          key={item.key}
          position={item.position}
          transform
        >
          <span style={{ '--label-color': item.color }}>
            <strong>{item.label}</strong>
            <small>{item.sublabel}</small>
          </span>
        </Html>
      ))}
    </group>
  )
}

function IndustrialMotor({
  isEmergencyStop,
  isFieldOn,
  isCoasting,
  isRunning,
  isStarting,
  lowPerformanceMode,
  motor,
  params,
  sceneTone,
  simulationState,
  thermalStatus,
  warningSeverity,
  windingTemperature,
}) {
  const rotorRef = useRef(null)
  const fanRef = useRef(null)
  const fieldRingRef = useRef(null)
  const rotorRingRef = useRef(null)
  const thermalRef = useRef(null)
  const riskRef = useRef(null)
  const emergencyRef = useRef(null)
  const nsRpm = Math.max(0, toFiniteNumber(motor?.ns, 0))
  const rawRotorSpeedRpm = Math.max(0, toFiniteNumber(motor?.nr, 0))
  const shouldSpinRotor =
    isRunning ||
    isStarting ||
    isCoasting ||
    isEmergencyStop ||
    simulationState === 'running' ||
    simulationState === 'starting' ||
    simulationState === 'coasting' ||
    simulationState === 'emergency-stop'
  const rotorSpeedRpm = shouldSpinRotor ? rawRotorSpeedRpm : 0
  const fieldOmega = rpmToRadPerSecond(nsRpm)
  const rotorOmega = rpmToRadPerSecond(rotorSpeedRpm)
  const style = STATE_STYLE[sceneTone] ?? STATE_STYLE.normal
  const thermalTone = normalizeTone(thermalStatus, 'normal')
  const maxWindingTemperature = Math.max(1, toFiniteNumber(params?.maxWindingTemperature, 120))
  const thermalRatio = clamp(toFiniteNumber(windingTemperature, 25) / maxWindingTemperature, 0, 1.5)
  const baseThermalOpacity =
    thermalTone === 'danger'
      ? 0.42
      : thermalTone === 'caution'
        ? 0.26
        : clamp((thermalRatio - 0.45) * 0.28, 0.04, 0.16)
  const energyActive = isFieldOn && sceneTone !== 'emergency'

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)

    if (rotorRef.current) {
      rotorRef.current.rotation.x += rotorOmega * dt
    }

    if (fanRef.current) {
      fanRef.current.rotation.x += rotorOmega * dt
    }

    if (fieldRingRef.current && isFieldOn) {
      fieldRingRef.current.rotation.x += fieldOmega * dt
    }

    if (rotorRingRef.current) {
      rotorRingRef.current.rotation.x += rotorOmega * dt
    }

    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * (isEmergencyStop ? 7 : 2.5))

    if (thermalRef.current) {
      thermalRef.current.opacity = baseThermalOpacity + pulse * (thermalTone === 'danger' ? 0.12 : 0.04)
    }

    if (riskRef.current) {
      const riskActive = warningSeverity === 'danger' || sceneTone === 'danger' || sceneTone === 'emergency'
      riskRef.current.opacity = riskActive ? 0.22 + pulse * 0.22 : sceneTone === 'caution' ? 0.15 : 0.04
    }

    if (emergencyRef.current) {
      emergencyRef.current.opacity = isEmergencyStop ? 0.36 + pulse * 0.34 : 0
    }
  })

  return (
    <group rotation={[0, -0.1, 0]}>
      <group>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.78, 0.78, 3.15, lowPerformanceMode ? 32 : 48]} />
          <meshStandardMaterial
            color="#1b2e3d"
            emissive={style.glow}
            emissiveIntensity={sceneTone === 'off' ? 0.03 : 0.12}
            metalness={0.68}
            roughness={0.36}
          />
        </mesh>

        {[-1.72, 1.72].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.88, 0.88, 0.28, lowPerformanceMode ? 32 : 48]} />
              <meshStandardMaterial color="#263d4c" metalness={0.74} roughness={0.3} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.67, 0.018, 8, 44]} />
              <meshStandardMaterial color="#8fa4ad" metalness={0.72} roughness={0.28} />
            </mesh>
          </group>
        ))}

        <CoolingRibs lowPerformanceMode={lowPerformanceMode} />
        <EndShieldBolts lowPerformanceMode={lowPerformanceMode} />

        <mesh position={[0.25, 1.08, 0]}>
          <boxGeometry args={[0.86, 0.44, 0.7]} />
          <meshStandardMaterial color="#263c4b" metalness={0.62} roughness={0.42} />
        </mesh>
        <mesh position={[0.25, 1.34, 0]}>
          <boxGeometry args={[0.96, 0.12, 0.78]} />
          <meshStandardMaterial color="#344f60" metalness={0.64} roughness={0.36} />
        </mesh>
        <mesh position={[-0.34, 1.08, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.2, 18]} />
          <meshStandardMaterial color="#758a95" metalness={0.74} roughness={0.26} />
        </mesh>
        <mesh position={[0.22, 0.28, -0.79]}>
          <boxGeometry args={[0.72, 0.22, 0.018]} />
          <meshStandardMaterial color="#9fb1ba" metalness={0.82} roughness={0.18} />
        </mesh>

        {[-0.88, 0.88].map((x) => (
          <group key={x} position={[x, -0.88, 0]}>
            <mesh position={[0, -0.09, -0.45]}>
              <boxGeometry args={[0.78, 0.2, 0.46]} />
              <meshStandardMaterial color="#172633" metalness={0.62} roughness={0.46} />
            </mesh>
            <mesh position={[0, -0.09, 0.45]}>
              <boxGeometry args={[0.78, 0.2, 0.46]} />
              <meshStandardMaterial color="#172633" metalness={0.62} roughness={0.46} />
            </mesh>
          </group>
        ))}
        {[-0.45, 0.45].map((z) => (
          <mesh key={z} position={[0, -1.08, z]}>
            <boxGeometry args={[2.45, 0.12, 0.28]} />
            <meshStandardMaterial color="#111d27" metalness={0.58} roughness={0.5} />
          </mesh>
        ))}
      </group>

      <group ref={rotorRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 2.7, lowPerformanceMode ? 28 : 40]} />
          <meshStandardMaterial color="#7d8a92" metalness={0.84} roughness={0.23} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.43, 0.012, 8, 36]} />
          <meshBasicMaterial color="#ffb020" transparent opacity={0.45} />
        </mesh>
        <mesh position={[2.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.19, 0.19, 0.32, lowPerformanceMode ? 20 : 28]} />
          <meshStandardMaterial color="#a7b7bf" metalness={0.88} roughness={0.18} />
        </mesh>
        <mesh position={[2.42, 0.17, 0]}>
          <boxGeometry args={[0.08, 0.045, 0.24]} />
          <meshBasicMaterial color="#ffb020" />
        </mesh>
      </group>

      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 4.35, 24]} />
        <meshStandardMaterial color="#b9c7ce" metalness={0.9} roughness={0.18} />
      </mesh>

      <FanAndGuard
        fanRef={fanRef}
        lowPerformanceMode={lowPerformanceMode}
        nsRpm={nsRpm}
        rotorSpeedRpm={rotorSpeedRpm}
        style={style}
      />
      <PhaseCoils isFieldOn={isFieldOn} />
      <FieldAndRotorRings
        fieldRef={fieldRingRef}
        isFieldOn={isFieldOn}
        rotorRef={rotorRingRef}
        rotorSpeedRpm={rotorSpeedRpm}
        style={style}
      />
      <PartLabels lowPerformanceMode={lowPerformanceMode} />
      <PowerFlow
        active={energyActive}
        count={lowPerformanceMode ? 8 : 18}
        lowPerformanceMode={lowPerformanceMode}
        style={style}
      />

      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.93, 0.93, 3.35, lowPerformanceMode ? 32 : 48, 1, true]} />
        <meshBasicMaterial
          ref={thermalRef}
          color={thermalTone === 'danger' ? '#ff2d1f' : thermalTone === 'caution' ? '#ff9d1c' : '#ff5933'}
          transparent
          opacity={baseThermalOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.35, 0.018, 8, 64]} />
        <meshBasicMaterial ref={riskRef} color={style.risk} transparent opacity={0.04} depthWrite={false} />
      </mesh>

      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.5, 0.03, 8, 64]} />
        <meshBasicMaterial ref={emergencyRef} color="#ff1744" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function MotorSceneContent(props) {
  const {
    isFieldOn,
    lowPerformanceMode,
    motor,
    simulationState,
    thermalStatus,
    warningSeverity,
  } = props
  const sceneTone = getSceneTone({ simulationState, warningSeverity, thermalStatus })
  const style = STATE_STYLE[sceneTone] ?? STATE_STYLE.normal

  return (
    <>
      <color attach="background" args={['#061018']} />
      <ambientLight intensity={0.55} />
      <directionalLight color="#dbeeff" intensity={1.45} position={[4, 4, 5]} />
      <pointLight color={style.accent} intensity={isFieldOn ? 1.1 : 0.24} position={[0, 2.2, 2.2]} />
      <pointLight color="#ff334e" intensity={sceneTone === 'danger' || sceneTone === 'emergency' ? 1.6 : 0.08} position={[2.7, 1.8, 1.2]} />
      <IndustrialMotor {...props} sceneTone={sceneTone} />
      <mesh position={[0, -1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.1, lowPerformanceMode ? 40 : 64]} />
        <meshBasicMaterial color="#081a27" transparent opacity={0.58} />
      </mesh>
      <OrbitControls
        autoRotate={!lowPerformanceMode}
        autoRotateSpeed={0.25}
        enableDamping
        dampingFactor={0.06}
        maxDistance={7}
        minDistance={3.6}
        target={[0, 0.04, 0]}
      />
    </>
  )
}

export function MotorThreeScene({
  motor,
  params,
  simulationState = motor?.simulationState ?? 'standby',
  warningSeverity = 'normal',
  thermalStatus = 'normal',
  windingTemperature = params?.ambientTemperature ?? 25,
  isRunning = false,
  isStarting = false,
  isCoasting = false,
  isEmergencyStop = false,
  isFieldOn = false,
  lowPerformanceMode = false,
}) {
  const webglAvailable = useMemo(() => hasWebGLSupport(), [])
  const ns = Math.max(0, toFiniteNumber(motor?.ns, 0))
  const nr = Math.max(0, toFiniteNumber(motor?.nr, 0))
  const sceneTone = getSceneTone({ simulationState, warningSeverity, thermalStatus })

  if (!webglAvailable) {
    return (
      <div className="motor-three-fallback">
        <strong>WebGL visualization unavailable</strong>
        <span>브라우저 또는 그래픽 드라이버가 WebGL을 지원하지 않아 간이 표시로 대체합니다.</span>
      </div>
    )
  }

  return (
    <div className="motor-three-scene" data-state={simulationState}>
      <Canvas
        camera={{ position: [4.9, 2.35, 3.25], fov: 40, near: 0.1, far: 50 }}
        dpr={lowPerformanceMode ? [1, 1] : [1, 1.5]}
        gl={{ antialias: !lowPerformanceMode, powerPreference: 'high-performance' }}
      >
        <MotorSceneContent
          isCoasting={isCoasting}
          isEmergencyStop={isEmergencyStop}
          isFieldOn={isFieldOn}
          isRunning={isRunning}
          isStarting={isStarting}
          lowPerformanceMode={lowPerformanceMode}
          motor={motor}
          params={params}
          simulationState={simulationState}
          thermalStatus={thermalStatus}
          warningSeverity={warningSeverity}
          windingTemperature={windingTemperature}
        />
      </Canvas>

      <div className="motor-three-hud">
        <span>Ns <strong>{formatCompact(ns, 0)}</strong> rpm</span>
        <span>Nr <strong>{formatCompact(nr, 0)}</strong> rpm</span>
        <span>Slip <strong>{formatCompact(toFiniteNumber(motor?.slipPercent, 0), 2)}</strong>%</span>
        <span>Power flow <strong>{isFieldOn ? 'ON' : 'OFF'}</strong></span>
        <span className={`motor-three-state motor-three-state-${sceneTone}`}>{simulationState}</span>
      </div>
    </div>
  )
}

export default MotorThreeScene
