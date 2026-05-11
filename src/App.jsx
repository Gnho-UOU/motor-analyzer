import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const DEFAULT_PARAMS = {
  f: 60,
  poles: 4,
  voltage: 220,
  r1: 0.8,
  r2: 0.6,
  x1: 1.2,
  x2: 1.2,
  xm: 30,
  slipPercent: 5,
  loadTorque: 10,
  inertia: 0.05,
  friction: 0.001,
}

const PARAM_CONTROLS = [
  {
    key: 'f',
    label: '공급 주파수 f',
    subtitle: 'Supply frequency',
    unit: 'Hz',
    min: 10,
    max: 120,
    step: 1,
  },
  {
    key: 'poles',
    label: '극수 P',
    subtitle: 'Number of poles',
    unit: 'poles',
    min: 2,
    max: 12,
    step: 2,
  },
  {
    key: 'voltage',
    label: '선간 전압 VLL',
    subtitle: 'Line-to-line voltage',
    unit: 'V',
    min: 20,
    max: 600,
    step: 5,
  },
  {
    key: 'r1',
    label: '고정자 저항 R1',
    subtitle: 'Stator resistance',
    unit: 'Ω',
    min: 0.01,
    max: 5,
    step: 0.01,
  },
  {
    key: 'r2',
    label: '회전자 환산 저항 R2',
    subtitle: 'Rotor resistance referred to stator',
    unit: 'Ω',
    min: 0.01,
    max: 5,
    step: 0.01,
  },
  {
    key: 'x1',
    label: '고정자 누설 리액턴스 X1',
    subtitle: 'Stator leakage reactance',
    unit: 'Ω',
    min: 0.01,
    max: 8,
    step: 0.01,
  },
  {
    key: 'x2',
    label: '회전자 누설 리액턴스 X2',
    subtitle: 'Rotor leakage reactance',
    unit: 'Ω',
    min: 0.01,
    max: 8,
    step: 0.01,
  },
  {
    key: 'xm',
    label: '자화 리액턴스 Xm',
    subtitle: 'Magnetizing reactance',
    unit: 'Ω',
    min: 2,
    max: 100,
    step: 0.5,
  },
  {
    key: 'slipPercent',
    label: '슬립 s',
    subtitle: 'Slip',
    unit: '%',
    min: 0,
    max: 100,
    step: 0.1,
  },
  {
    key: 'loadTorque',
    label: '부하 토크 TL',
    subtitle: 'Load torque',
    unit: 'N·m',
    min: 0,
    max: 120,
    step: 0.5,
  },
  {
    key: 'inertia',
    label: '관성 모멘트 J',
    subtitle: 'Moment of inertia',
    unit: 'kg·m²',
    min: 0.005,
    max: 1,
    step: 0.005,
  },
  {
    key: 'friction',
    label: '마찰 계수 B',
    subtitle: 'Friction coefficient',
    unit: 'N·m·s/rad',
    min: 0,
    max: 0.05,
    step: 0.0005,
  },
]

const MOTOR_PRESETS = [
  {
    id: 'no-load',
    label: '무부하',
    subtitle: 'No-load',
    values: {
      voltage: 220,
      slipPercent: 1,
      loadTorque: 1.5,
      inertia: 0.04,
      friction: 0.001,
    },
    summary: '부하가 거의 없는 상태',
    detail: '회전자 속도가 동기속도에 가깝고 슬립과 토크가 작게 나타나는 조건입니다.',
  },
  {
    id: 'rated-load',
    label: '정격부하',
    subtitle: 'Rated load',
    values: {
      voltage: 220,
      slipPercent: 5,
      loadTorque: 10,
      inertia: 0.05,
      friction: 0.001,
    },
    summary: '기준 운전 조건',
    detail: '정격 전압과 보통 부하에서 유도전동기의 정상 운전점을 관찰합니다.',
  },
  {
    id: 'overload',
    label: '과부하',
    subtitle: 'Overload',
    values: {
      voltage: 220,
      slipPercent: 9,
      loadTorque: 24,
      inertia: 0.07,
      friction: 0.0015,
    },
    summary: '부하 토크가 큰 조건',
    detail: '부하 증가로 슬립이 커지고 운전점이 낮은 회전자 속도 쪽으로 이동합니다.',
  },
  {
    id: 'low-voltage',
    label: '저전압',
    subtitle: 'Low voltage',
    values: {
      voltage: 170,
      slipPercent: 7,
      loadTorque: 10,
      inertia: 0.05,
      friction: 0.001,
    },
    summary: '전원 전압 저하 조건',
    detail: '전압 저하로 발생 토크가 감소하여 같은 부하에서도 여유 토크가 줄어듭니다.',
  },
  {
    id: 'high-slip',
    label: '고슬립',
    subtitle: 'High slip',
    values: {
      voltage: 220,
      slipPercent: 18,
      loadTorque: 30,
      inertia: 0.08,
      friction: 0.002,
    },
    summary: '슬립이 큰 운전 조건',
    detail: '큰 부하와 높은 수동 슬립 기준으로 기동 영역에 가까운 특성을 비교합니다.',
  },
]

const CUSTOM_PRESET = {
  id: 'custom',
  label: '사용자 설정',
  subtitle: 'Custom',
  summary: '직접 조정한 입력 조건',
  detail: '슬라이더 또는 숫자 입력으로 변경한 현재 파라미터를 기준으로 해석합니다.',
}

// Minimal complex-number helpers for the Thevenin equivalent calculation.
const c = (re, im = 0) => ({ re, im })
const cAdd = (a, b) => c(a.re + b.re, a.im + b.im)
const cMul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
const cDiv = (a, b) => {
  const denominator = b.re * b.re + b.im * b.im || Number.EPSILON
  return c(
    (a.re * b.re + a.im * b.im) / denominator,
    (a.im * b.re - a.re * b.im) / denominator,
  )
}
const cAbs = (a) => Math.hypot(a.re, a.im)
const cParallel = (a, b) => cDiv(cMul(a, b), cAdd(a, b))

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const clamp = (value, min, max) => {
  const numeric = toFiniteNumber(value, min)
  return Math.min(max, Math.max(min, numeric))
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function formatCompact(value, digits = 1) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
  })
}

// Normalize user input before any motor equations run, so charts never receive NaN or Infinity.
function sanitizeParams(params) {
  return {
    f: Math.max(0.001, toFiniteNumber(params.f, DEFAULT_PARAMS.f)),
    poles: Math.max(0.001, toFiniteNumber(params.poles, DEFAULT_PARAMS.poles)),
    voltage: Math.max(0, toFiniteNumber(params.voltage, DEFAULT_PARAMS.voltage)),
    r1: Math.max(0.0001, toFiniteNumber(params.r1, DEFAULT_PARAMS.r1)),
    r2: Math.max(0.0001, toFiniteNumber(params.r2, DEFAULT_PARAMS.r2)),
    x1: Math.max(0.0001, toFiniteNumber(params.x1, DEFAULT_PARAMS.x1)),
    x2: Math.max(0.0001, toFiniteNumber(params.x2, DEFAULT_PARAMS.x2)),
    xm: Math.max(0.0001, toFiniteNumber(params.xm, DEFAULT_PARAMS.xm)),
    slipPercent: clamp(params.slipPercent, 0, 100),
    loadTorque: Math.max(0, toFiniteNumber(params.loadTorque, DEFAULT_PARAMS.loadTorque)),
    inertia: Math.max(0.0001, toFiniteNumber(params.inertia, DEFAULT_PARAMS.inertia)),
    friction: Math.max(0, toFiniteNumber(params.friction, DEFAULT_PARAMS.friction)),
  }
}

// Find motor/load intersections and choose the stable branch closest to synchronous speed.
function findStableOperatingPoint(torqueSpeedData, loadTorque, ns) {
  if (loadTorque <= 0) {
    return {
      slip: 0,
      speed: ns,
      torque: 0,
      hasIntersection: true,
    }
  }

  const intersections = []
  let closestPoint = torqueSpeedData[0] ?? { slip: 1, speed: 0, torque: 0 }
  let closestDifference = Math.abs(closestPoint.torque - loadTorque)

  for (let index = 0; index < torqueSpeedData.length; index += 1) {
    const point = torqueSpeedData[index]
    const difference = Math.abs(point.torque - loadTorque)

    if (
      difference < closestDifference ||
      (difference === closestDifference && point.speed > closestPoint.speed)
    ) {
      closestPoint = point
      closestDifference = difference
    }

    const nextPoint = torqueSpeedData[index + 1]
    if (!nextPoint) continue

    const currentDelta = point.torque - loadTorque
    const nextDelta = nextPoint.torque - loadTorque

    if (currentDelta === 0) {
      intersections.push({ ...point, torque: loadTorque })
    }

    if (currentDelta * nextDelta < 0) {
      const ratio = (loadTorque - point.torque) / (nextPoint.torque - point.torque)
      intersections.push({
        slip: point.slip + (nextPoint.slip - point.slip) * ratio,
        speed: point.speed + (nextPoint.speed - point.speed) * ratio,
        torque: loadTorque,
      })
    }
  }

  const lastPoint = torqueSpeedData[torqueSpeedData.length - 1]
  if (lastPoint && lastPoint.torque === loadTorque) {
    intersections.push({ ...lastPoint, torque: loadTorque })
  }

  if (intersections.length > 0) {
    return {
      ...intersections.reduce((stable, point) =>
        point.speed > stable.speed ? point : stable,
      ),
      hasIntersection: true,
    }
  }

  return {
    ...closestPoint,
    hasIntersection: false,
  }
}

// Simplified startup dynamics: J*dω/dt = Te - TL - Bω.
function generateStartupResponse({
  omegaS,
  targetSpeedRpm,
  torqueAtSlip,
  loadTorque,
  inertia,
  friction,
}) {
  const dt = 0.02
  const maxTime = 8
  const targetOmega = Math.max(0, (targetSpeedRpm * 2 * Math.PI) / 60)
  const data = []
  let omega = 0

  for (let index = 0; index <= maxTime / dt; index += 1) {
    const time = index * dt
    const slip = omegaS > 0 ? clamp((omegaS - omega) / omegaS, 0.001, 1) : 1
    const torque = torqueAtSlip(slip)
    const speed = (omega * 60) / (2 * Math.PI)
    const acceleration = (torque - loadTorque - friction * omega) / inertia

    data.push({
      time: Number(time.toFixed(2)),
      speed: Math.max(0, toFiniteNumber(speed, 0)),
      torque: Math.max(0, toFiniteNumber(torque, 0)),
      slipPercent: slip * 100,
    })

    if (targetOmega <= 0 && time > 0) {
      break
    }

    if (targetOmega > 0 && Math.abs(targetOmega - omega) < 0.25 && time > 0.12) {
      break
    }

    const nextOmega = Math.max(0, omega + acceleration * dt)

    if (targetOmega <= 0) {
      omega = 0
    } else {
      omega =
        omega < targetOmega && nextOmega > targetOmega
          ? targetOmega
          : Math.min(nextOmega, targetOmega, omegaS * 0.999)
    }
  }

  const lastPoint = data[data.length - 1]
  const targetSlip = omegaS > 0 ? clamp((omegaS - targetOmega) / omegaS, 0.001, 1) : 1

  if (
    targetOmega > 0 &&
    lastPoint &&
    lastPoint.speed >= targetSpeedRpm * 0.95 &&
    Math.abs(lastPoint.speed - targetSpeedRpm) > 0.5
  ) {
    data.push({
      time: Number((lastPoint.time + dt).toFixed(2)),
      speed: targetSpeedRpm,
      torque: torqueAtSlip(targetSlip),
      slipPercent: targetSlip * 100,
    })
  }

  return data
}

const createStartupState = (overrides = {}) => ({
  isStarting: false,
  isCoastingDown: false,
  startupTime: 0,
  startupProgress: 0,
  startupRotorSpeed: 0,
  startupSlip: 1,
  startupTorque: 0,
  startupData: [],
  hasStartupFinished: false,
  hasStartupFailed: false,
  coastDownRotorSpeed: 0,
  status: 'idle',
  useStartupDisplay: false,
  ...overrides,
})

function getStartupStatusLabel(status) {
  if (status === 'starting') return '기동 중...'
  if (status === 'finished') return '정상 운전 도달'
  if (status === 'failed') return '기동 실패'
  if (status === 'emergency') return '비상정지'
  if (status === 'stopped') return '정지'
  return '대기 중'
}

function getStartupPoint(profile, time) {
  const safeProfile = Array.isArray(profile) ? profile : []
  if (safeProfile.length === 0) {
    return { time: 0, speed: 0, torque: 0, slipPercent: 100 }
  }

  if (time <= safeProfile[0].time) return safeProfile[0]

  const lastPoint = safeProfile[safeProfile.length - 1]
  if (time >= lastPoint.time) return lastPoint

  for (let index = 0; index < safeProfile.length - 1; index += 1) {
    const point = safeProfile[index]
    const nextPoint = safeProfile[index + 1]

    if (time >= point.time && time <= nextPoint.time) {
      const span = Math.max(nextPoint.time - point.time, Number.EPSILON)
      const ratio = clamp((time - point.time) / span, 0, 1)

      return {
        time,
        speed: point.speed + (nextPoint.speed - point.speed) * ratio,
        torque: point.torque + (nextPoint.torque - point.torque) * ratio,
        slipPercent:
          point.slipPercent + (nextPoint.slipPercent - point.slipPercent) * ratio,
      }
    }
  }

  return lastPoint
}

function buildStartupTrace(profile, currentPoint) {
  const safeProfile = Array.isArray(profile) ? profile : []
  const visibleData = safeProfile.filter((point) => point.time <= currentPoint.time)
  const lastVisiblePoint = visibleData[visibleData.length - 1]
  const shouldAppend =
    !lastVisiblePoint || Math.abs(lastVisiblePoint.time - currentPoint.time) > 0.001

  return shouldAppend ? [...visibleData, currentPoint] : visibleData
}

function getMotorWarnings(motor) {
  const startingTorqueInsufficient = motor.startingTorque + 0.05 < motor.loadTorque

  if (!motor.isMotorEnergized) {
    const offWarnings = [
      {
        id: 'supply-off',
        tone: 'normal',
        message: '전원 OFF: 전동기 정지 상태',
        detail: '3상 전원이 차단되어 고정자 전류, 회전자계, 전자기 토크가 0으로 표시됩니다.',
      },
    ]

    if (startingTorqueInsufficient) {
      offWarnings.push({
        id: 'startup-torque-low',
        tone: 'danger',
        message: '기동토크 부족: 부하토크가 기동토크보다 커서 전동기가 정상적으로 기동하기 어렵습니다.',
        detail: 'Starting torque is lower than load torque.',
      })
    }

    return offWarnings
  }

  const warnings = []
  const slip = clamp(motor.slip, 0, 1)
  const speedRatio = motor.ns > 0 ? clamp(motor.nr / motor.ns, 0, 1) : 1
  const voltageRatio = motor.voltage / DEFAULT_PARAMS.voltage
  const torqueMargin = Math.max(motor.loadTorque * 0.01, 0.05)

  if (startingTorqueInsufficient) {
    warnings.push({
      id: 'startup-torque-low',
      tone: 'danger',
      message: '기동토크 부족: 부하토크가 기동토크보다 커서 전동기가 정상적으로 기동하기 어렵습니다.',
      detail: 'Starting torque is lower than load torque.',
    })
  }

  if (slip > 0.15) {
    warnings.push({
      id: 'high-slip',
      tone: slip > 0.3 ? 'danger' : 'caution',
      message: '슬립 과다: 과부하 또는 속도 저하 가능성',
      detail: `현재 슬립 ${formatCompact(slip * 100, 1)}%로, 일반 운전 범위보다 큰 상태입니다.`,
    })
  }

  if (motor.torque + torqueMargin < motor.loadTorque) {
    warnings.push({
      id: 'low-torque',
      tone: 'danger',
      message: '토크 부족: 부하를 구동하기 어려움',
      detail: `Te ${formatCompact(motor.torque, 1)} N·m < TL ${formatCompact(
        motor.loadTorque,
        1,
      )} N·m`,
    })
  }

  if (voltageRatio < 0.9) {
    warnings.push({
      id: 'low-voltage',
      tone: voltageRatio < 0.78 ? 'danger' : 'caution',
      message: '저전압 운전: 토크 감소 가능성',
      detail: `기준 ${DEFAULT_PARAMS.voltage} V 대비 ${formatCompact(voltageRatio * 100, 0)}% 수준입니다.`,
    })
  }

  if (speedRatio < 0.85) {
    warnings.push({
      id: 'speed-drop',
      tone: speedRatio < 0.7 ? 'danger' : 'caution',
      message: '속도 저하: 발열 증가 가능성',
      detail: `Nr/Ns = ${formatCompact(speedRatio * 100, 1)}%로 동기속도와 차이가 큽니다.`,
    })
  }

  if (warnings.length === 0) {
    warnings.push({
      id: 'normal',
      tone: 'normal',
      message: '정상 범위: 주요 운전 지표가 안정적입니다',
      detail: '현재 입력 조건에서는 과도한 슬립, 저전압, 토크 부족 경향이 크게 보이지 않습니다.',
    })
  }

  return warnings
}

// Main induction-motor model: synchronous speed, Thevenin equivalent, torque, and graph data.
function calculateMotor(params, autoOperatingPoint, frequencyReactanceScaling = false) {
  const p = sanitizeParams(params)
  const manualSlip = clamp(p.slipPercent / 100, 0, 1)
  const ns = (120 * p.f) / p.poles
  const omegaS = (2 * Math.PI * ns) / 60
  const omegaSafe = Math.max(omegaS, 0.000001)
  const vPhase = p.voltage / Math.sqrt(3)
  const reactanceScale = frequencyReactanceScaling
    ? clamp(p.f / DEFAULT_PARAMS.f, 0.001, 10)
    : 1
  const x1Eff = p.x1 * reactanceScale
  const x2Eff = p.x2 * reactanceScale
  const xmEff = p.xm * reactanceScale

  const z1 = c(p.r1, x1Eff)
  const zm = c(0, xmEff)
  const z1PlusZm = cAdd(z1, zm)
  const vth = vPhase * cAbs(cDiv(zm, z1PlusZm))
  const zth = cDiv(cMul(z1, zm), z1PlusZm)
  const rth = zth.re
  const xth = zth.im

  // Slip is clamped away from zero to avoid division by zero near synchronous speed.
  const torqueAtSlip = (slipValue) => {
    const localSlip = Math.max(slipValue, 0.0001)
    const rotorResistance = p.r2 / localSlip
    const numerator = 3 * vth * vth * rotorResistance
    const denominator =
      omegaSafe *
      ((rth + rotorResistance) ** 2 + (xth + x2Eff) ** 2)
    const torqueValue = numerator / denominator
    return Number.isFinite(torqueValue) ? Math.max(0, torqueValue) : 0
  }

  const startingTorque = torqueAtSlip(1)
  const torqueSpeedData = Array.from({ length: 220 }, (_, index) => {
    const curveSlip = 0.001 + (index / 219) * 0.999
    return {
      slip: curveSlip,
      speed: ns * (1 - curveSlip),
      torque: torqueAtSlip(curveSlip),
    }
  }).sort((a, b) => a.speed - b.speed)

  const maxPoint = torqueSpeedData.reduce(
    (best, point) => (point.torque > best.torque ? point : best),
    torqueSpeedData[0],
  )

  const manualTorque = torqueAtSlip(manualSlip)
  const manualPoint = {
    slip: manualSlip,
    speed: ns * (1 - manualSlip),
    torque: manualTorque,
    hasIntersection: true,
  }
  const loadPoint = findStableOperatingPoint(torqueSpeedData, p.loadTorque, ns)
  const activePoint = autoOperatingPoint ? loadPoint : manualPoint
  const slip = clamp(activePoint.slip, 0, 1)
  const safeSlip = Math.max(slip, 0.0001)
  const nr = clamp(activePoint.speed, 0, ns)
  const torque = Math.max(0, toFiniteNumber(activePoint.torque, 0))

  const rotorBranch = c(p.r2 / safeSlip, x2Eff)
  const inputImpedance = cAdd(z1, cParallel(zm, rotorBranch))
  const inputCurrentRms = vPhase / Math.max(cAbs(inputImpedance), 0.0001)
  const im = Math.SQRT2 * inputCurrentRms

  // One electrical cycle of balanced three-phase current waveforms.
  const currentData = Array.from({ length: 145 }, (_, index) => {
    const wt = (2 * Math.PI * index) / 144
    return {
      degree: Math.round((wt * 180) / Math.PI),
      ia: im * Math.sin(wt),
      ib: im * Math.sin(wt - (2 * Math.PI) / 3),
      ic: im * Math.sin(wt - (4 * Math.PI) / 3),
    }
  })

  const startupProfile = generateStartupResponse({
    omegaS,
    targetSpeedRpm: nr,
    torqueAtSlip,
    loadTorque: p.loadTorque,
    inertia: p.inertia,
    friction: p.friction,
  })

  const torqueMargin = Math.max(p.loadTorque * 0.05, 0.25)
  let state = {
    tone: 'balanced',
    label: '평형 운전',
    subtitle: 'Balanced operating point',
  }

  if (autoOperatingPoint && !activePoint.hasIntersection) {
    state = {
      tone: 'warning',
      label: '교점 없음',
      subtitle: 'Load torque does not intersect the motor curve',
    }
  } else if (slip >= 0.95) {
    state = {
      tone: 'starting',
      label: '기동 영역',
      subtitle: 'Starting or locked-rotor region',
    }
  } else if (torque + torqueMargin < p.loadTorque) {
    state = {
      tone: 'warning',
      label: '부하 초과',
      subtitle: 'Load torque is higher than motor torque',
    }
  } else if (torque > p.loadTorque + torqueMargin) {
    state = {
      tone: 'accelerating',
      label: '가속 중',
      subtitle: 'Motor torque exceeds load torque',
    }
  }

  const visualFieldDuration = clamp((1800 / Math.max(ns, 1)) * 4, 2.2, 9)
  const rotorRatio = nr / Math.max(ns, 0.0001)
  const visualRotorDuration =
    rotorRatio > 0.001 ? visualFieldDuration / rotorRatio : 99999

  return {
    ...p,
    slip,
    slipPercent: slip * 100,
    manualSlipPercent: p.slipPercent,
    ns,
    nr,
    vth,
    rth,
    reactanceScale,
    frequencyReactanceScaling,
    x1Eff,
    x2Eff,
    xmEff,
    torque,
    startingTorque,
    maxTorque: maxPoint.torque,
    maxTorqueSpeed: maxPoint.speed,
    currentPeak: im,
    currentData,
    startupProfile,
    torqueSpeedData,
    operatingPoint: [{ speed: nr, torque, slip }],
    operatingPointMode: autoOperatingPoint ? 'auto' : 'manual',
    hasLoadIntersection: activePoint.hasIntersection,
    maxTorquePoint: [{ speed: maxPoint.speed, torque: maxPoint.torque }],
    startingTorquePoint: [{ speed: 0, torque: startingTorque }],
    torqueYMax: Math.max(maxPoint.torque, torque, startingTorque, p.loadTorque, 1) * 1.22,
    currentYMax: Math.max(im, 1) * 1.18,
    startupSpeedYMax: Math.max(ns, nr, 1) * 1.05,
    startupTorqueYMax:
      Math.max(...startupProfile.map((point) => point.torque), torque, startingTorque, 1) *
      1.16,
    state,
    visualFieldDuration,
    visualRotorDuration,
  }
}

function ParamControl({ config, value, onChange }) {
  const id = `param-${config.key}`

  return (
    <label className="param-control" htmlFor={id}>
      <span className="param-copy">
        <span className="param-label">{config.label}</span>
        <span className="param-subtitle">{config.subtitle}</span>
      </span>
      <span className="param-input-row">
        <input
          className="param-slider"
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(event) => onChange(config.key, event.target.value)}
        />
        <span className="param-number-wrap">
          <input
            id={id}
            className="param-number"
            type="number"
            min={config.min}
            max={config.max}
            step={config.step}
            value={value}
            onChange={(event) => onChange(config.key, event.target.value)}
          />
          <span className="param-unit">{config.unit}</span>
        </span>
      </span>
    </label>
  )
}

function ResultCard({ label, subtitle, value, unit, tone = 'default' }) {
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

function WarningPanel({ warnings }) {
  return (
    <section className="panel warning-panel" aria-label="motor operating warnings">
      <div className="panel-heading warning-heading">
        <div>
          <h2>운전 상태 경고</h2>
          <p>Intelligent operating condition indicators</p>
        </div>
        <span className="metric-chip">Educational</span>
      </div>

      <div className="warning-grid">
        {warnings.map((warning) => (
          <article className={`warning-card warning-card-${warning.tone}`} key={warning.id}>
            <span className="warning-severity">
              {warning.tone === 'normal'
                ? '정상'
                : warning.tone === 'danger'
                  ? '위험'
                  : '주의'}
            </span>
            <strong>{warning.message}</strong>
            <p>{warning.detail}</p>
          </article>
        ))}
      </div>

      <p className="warning-note">
        이 경고는 전기기기 교육을 위한 해석 지표이며, 실제 산업 현장의 보호계전기
        또는 트립 설정값이 아닙니다.
      </p>
    </section>
  )
}

function OperatingModeToggle({ enabled, onChange }) {
  return (
    <label className="mode-toggle-card">
      <span className="mode-toggle-copy">
        <span className="mode-title">자동 운전점 추적</span>
        <span className="mode-subtitle">Auto operating point</span>
      </span>
      <span className="mode-toggle-control">
        <input
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="mode-switch" aria-hidden="true"></span>
        <strong>{enabled ? 'ON' : 'OFF'}</strong>
      </span>
      <span className="mode-note">
        ON: 부하 토크 TL과 전동기 토크 곡선의 안정 교점을 사용합니다. OFF:
        입력한 슬립 값을 수동 기준으로 사용합니다.
      </span>
    </label>
  )
}

function FrequencyScalingToggle({ enabled, motor, onChange }) {
  return (
    <label className="mode-toggle-card reactance-toggle-card">
      <span className="mode-toggle-copy">
        <span className="mode-title">주파수에 따른 리액턴스 보정</span>
        <span className="mode-subtitle">Frequency-dependent reactance scaling</span>
      </span>
      <span className="mode-toggle-control">
        <input
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="mode-switch" aria-hidden="true"></span>
        <strong>{enabled ? 'ON' : 'OFF'}</strong>
      </span>
      <span className="mode-note">
        ON: X = 2πfL 관계에 의해 리액턴스가 주파수에 비례한다고 가정합니다.
      </span>
      <span className="reactance-effective-grid">
        <span>
          X1_eff <strong>{formatCompact(motor.x1Eff, 2)} Ω</strong>
        </span>
        <span>
          X2_eff <strong>{formatCompact(motor.x2Eff, 2)} Ω</strong>
        </span>
        <span>
          Xm_eff <strong>{formatCompact(motor.xmEff, 1)} Ω</strong>
        </span>
      </span>
    </label>
  )
}

function PresetPanel({ presets, selectedPreset, onSelect }) {
  return (
    <section className="preset-card">
      <div className="preset-heading">
        <span>운전조건 프리셋</span>
        <small>Operating Condition Presets</small>
      </div>

      <div className="preset-button-grid">
        {presets.map((preset) => (
          <button
            className={`preset-button ${selectedPreset.id === preset.id ? 'is-active' : ''}`}
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            type="button"
          >
            <span>{preset.label}</span>
            <small>{preset.subtitle}</small>
          </button>
        ))}
      </div>

      <div className="preset-description">
        <strong>{selectedPreset.summary}</strong>
        <span>
          {selectedPreset.label} / {selectedPreset.subtitle}
        </span>
        <p>{selectedPreset.detail}</p>
      </div>
    </section>
  )
}

function MotorControlPanel({
  startupState,
  statusLabel,
  displayedRotorSpeed,
  displayedSlipText,
  onStart,
  onReset,
  onEmergencyStop,
}) {
  const isStarting = startupState.status === 'starting' || startupState.status === 'failed'
  const isRunning = startupState.status === 'finished'
  const isStopped =
    startupState.status === 'idle' ||
    startupState.status === 'stopped' ||
    startupState.status === 'emergency'

  return (
    <section className="control-panel-card" aria-label="motor control panel">
      <span className="panel-screw panel-screw-tl"></span>
      <span className="panel-screw panel-screw-tr"></span>
      <span className="panel-screw panel-screw-bl"></span>
      <span className="panel-screw panel-screw-br"></span>

      <div className="control-panel-heading">
        <span>전동기 제어반</span>
        <small>Motor Control Panel</small>
      </div>

      <div className="indicator-lamps" aria-label="simulation status lamps">
        <div className={`indicator-lamp lamp-run ${isRunning ? 'is-on' : ''}`}>
          <span></span>
          <strong>RUN</strong>
          <small>운전</small>
        </div>
        <div className={`indicator-lamp lamp-starting ${isStarting ? 'is-on' : ''}`}>
          <span></span>
          <strong>STARTING</strong>
          <small>기동 중</small>
        </div>
        <div className={`indicator-lamp lamp-stop ${isStopped ? 'is-on' : ''}`}>
          <span></span>
          <strong>STOP</strong>
          <small>정지</small>
        </div>
      </div>

      <div className="control-command-label">
        <span>전동기 기동 시뮬레이션</span>
        <small>Start Motor Simulation</small>
      </div>

      <div className="industrial-controls">
        <button
          className={`industrial-button start-button ${isStarting ? 'is-active' : ''}`}
          onClick={onStart}
          type="button"
        >
          <span>START</span>
          <small>기동</small>
        </button>

        <button className="industrial-button reset-button" onClick={onReset} type="button">
          <span>RESET</span>
          <small>초기화</small>
        </button>

        <button
          className="emergency-stop-button"
          onClick={onEmergencyStop}
          type="button"
        >
          <span>EMERGENCY STOP</span>
          <small>비상정지</small>
        </button>
      </div>

      <div className="control-readout-grid">
        <span>
          상태
          <strong>{statusLabel}</strong>
        </span>
        <span>
          시간
          <strong>{formatCompact(startupState.startupTime, 2)} s</strong>
        </span>
        <span>
          속도
          <strong>{formatCompact(displayedRotorSpeed, 0)} rpm</strong>
        </span>
        <span>
          슬립
          <strong>{displayedSlipText}</strong>
        </span>
      </div>

      <div className="control-progress" aria-label="startup progress">
        <span style={{ width: `${clamp(startupState.startupProgress * 100, 0, 100)}%` }}></span>
      </div>
    </section>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry, index) => (
        <span key={`${entry.name ?? entry.dataKey}-${index}`} style={{ color: entry.color }}>
          {entry.name}: {formatCompact(entry.value, 2)}
        </span>
      ))}
    </div>
  )
}

function TorquePointMarker({
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
      <circle cx={cx} cy={cy} fill={color} r="6" />
      <circle cx={cx} cy={cy} fill="none" r="11" stroke={color} />
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

function polarPoint(angle, radius) {
  const radians = (angle * Math.PI) / 180
  return {
    x: 160 + Math.cos(radians) * radius,
    y: 160 + Math.sin(radians) * radius,
  }
}

function MotorVisualization({ motor }) {
  const [angles, setAngles] = useState({ field: 0, rotor: 0 })
  const isMotorEnergized = motor.isMotorEnergized
  const isRotorMoving = motor.isRotorMoving
  const rotorRatio = clamp(motor.nr / Math.max(motor.ns, 0.0001), 0, 1)
  const rotorRatioRef = useRef(rotorRatio)
  const fieldAngle = isMotorEnergized ? angles.field : 0
  const rotorAngle = isRotorMoving ? angles.rotor : 0
  const electricalAngle = (fieldAngle * Math.PI) / 180
  const arrowCenter = 160
  const rotorArrowEndX = 226
  const magneticArrowEndX = rotorArrowEndX

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
    <div className={`motor-panel ${isMotorEnergized ? 'is-energized' : 'is-deenergized'}`}>
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

function Motor3DPanel({ motor }) {
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
    <div className={`panel motor-3d-panel ${isMotorEnergized ? 'is-energized' : 'is-deenergized'}`}>
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

const EDUCATION_ITEMS = [
  {
    title: '3상 전류와 회전자계',
    subtitle: 'Balanced three-phase field',
    body: 'A, B, C상 전류가 120도 위상차를 가지면 각 상의 자속이 시간에 따라 합성되어 크기가 거의 일정한 회전자계가 만들어진다.',
  },
  {
    title: '동기속도 Ns',
    subtitle: 'Synchronous speed',
    body: '동기속도는 고정자 회전자계가 회전하는 속도이며, 주파수와 극수에 의해 Ns = 120f / P 로 결정된다.',
  },
  {
    title: '슬립 s',
    subtitle: 'Slip',
    body: '슬립은 회전자계 속도와 실제 회전자 속도의 차이를 나타낸다. 유도전동기에서는 이 차이가 있어야 회전자에 전압과 전류가 유도된다.',
  },
  {
    title: '회전자 속도가 더 낮은 이유',
    subtitle: 'Rotor speed below Ns',
    body: '회전자가 동기속도와 같아지면 상대속도가 0이 되어 유도전류와 토크가 사라진다. 그래서 정상 운전에서는 Nr이 Ns보다 약간 낮다.',
  },
  {
    title: '토크와 속도 변화',
    subtitle: 'Torque-speed relation',
    body: '속도가 낮고 슬립이 큰 영역에서는 회전자 전류가 커지며, 속도가 증가해 슬립이 작아질수록 전류와 토크도 함께 변한다.',
  },
  {
    title: '교육적 활용',
    subtitle: 'Engineering learning',
    body: '주파수, 극수, 전압, 저항, 리액턴스, 부하 토크를 바꾸며 속도, 슬립, 토크 곡선의 변화를 직관적으로 비교할 수 있다.',
  },
]

function EducationPanel() {
  return (
    <section className="panel education-panel">
      <div className="panel-heading">
        <div>
          <h2>유도전동기 원리 설명</h2>
          <p>Educational notes for induction motor analysis</p>
        </div>
        <span className="metric-chip">Study Guide</span>
      </div>

      <div className="education-grid">
        {EDUCATION_ITEMS.map((item, index) => (
          <article className="education-card" key={item.title}>
            <span className="education-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{item.title}</h3>
              <small>{item.subtitle}</small>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function StartupResponsePanel({ motor, startupState, statusLabel }) {
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
        전자기 토크가 부하 토크와 마찰 토크보다 크면 회전자가 가속되고, 속도가
        운전점에 가까워질수록 슬립은 감소한다.
      </p>
    </section>
  )
}

function ThreePhaseCurrentPanel({ motor }) {
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

function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [autoOperatingPoint, setAutoOperatingPoint] = useState(true)
  const [frequencyReactanceScaling, setFrequencyReactanceScaling] = useState(false)
  const [startupState, setStartupState] = useState(() => createStartupState())
  const [selectedPresetId, setSelectedPresetId] = useState('rated-load')
  const startupStartTimeRef = useRef(0)
  const motor = useMemo(
    () => calculateMotor(params, autoOperatingPoint, frequencyReactanceScaling),
    [params, autoOperatingPoint, frequencyReactanceScaling],
  )
  const selectedPreset =
    MOTOR_PRESETS.find((preset) => preset.id === selectedPresetId) ?? CUSTOM_PRESET
  const startupStatusLabel = getStartupStatusLabel(startupState.status)
  const isMotorEnergized =
    startupState.isStarting ||
    startupState.hasStartupFinished ||
    startupState.hasStartupFailed
  const isStartupFailed = startupState.hasStartupFailed
  const isCoastingDown = startupState.isCoastingDown
  const useStartupRuntimeValues = startupState.isStarting
  const displayedRotorSpeed = isCoastingDown
    ? startupState.coastDownRotorSpeed
    : !isMotorEnergized
    ? 0
    : useStartupRuntimeValues
      ? startupState.startupRotorSpeed
      : isStartupFailed
        ? 0
      : motor.nr
  const displayedSlip = !isMotorEnergized
    ? 1
    : useStartupRuntimeValues
      ? startupState.startupSlip
      : isStartupFailed
        ? 1
      : motor.slip
  const displayedSlipPercent = displayedSlip * 100
  const displayedTorque = !isMotorEnergized
    ? 0
    : useStartupRuntimeValues
      ? startupState.startupTorque
      : isStartupFailed
        ? startupState.startupTorque
      : motor.torque
  const displayedMotor = useMemo(() => {
    const startupTone =
      !isMotorEnergized
        ? 'stopped'
        : isStartupFailed
          ? 'danger'
        : startupState.status === 'finished'
        ? 'balanced'
        : startupState.status === 'stopped'
          ? 'warning'
          : 'starting'
    const startupSubtitle =
      !isMotorEnergized
        ? startupState.status === 'emergency'
          ? 'Supply is off, rotor is coasting down'
          : 'Stator supply is off'
        : isStartupFailed
          ? 'Starting torque is lower than load torque'
        : startupState.status === 'finished'
        ? 'Startup reached operating speed'
        : startupState.status === 'starting'
          ? 'Rotor is accelerating from standstill'
          : startupState.status === 'stopped'
            ? 'Emergency stop command applied'
            : 'Waiting for startup command'
    const rotorRatio = displayedRotorSpeed / Math.max(motor.ns, 0.0001)
    const currentMode = !isMotorEnergized
      ? 'off'
      : startupState.isStarting || isStartupFailed
        ? 'starting'
        : 'run'
    const currentScale =
      currentMode === 'off'
        ? 0
        : currentMode === 'starting'
          ? clamp(1 + 1.8 * displayedSlip, 1, 2.8)
          : 1
    const displayedCurrentData =
      currentMode === 'off'
        ? motor.currentData.map((point) => ({
          ...point,
          ia: 0,
          ib: 0,
          ic: 0,
        }))
        : motor.currentData.map((point) => ({
            ...point,
            ia: point.ia * currentScale,
            ib: point.ib * currentScale,
            ic: point.ic * currentScale,
          }))

    return {
      ...motor,
      isMotorEnergized,
      isSlipDefined: isMotorEnergized,
      isRotorMoving: isMotorEnergized || isCoastingDown,
      isCoastingDown,
      currentMode,
      nr: clamp(displayedRotorSpeed, 0, motor.ns),
      slip: isMotorEnergized ? clamp(displayedSlip, 0.001, 1) : 1,
      slipPercent: isMotorEnergized
        ? clamp(displayedSlipPercent, 0.1, 100)
        : 100,
      torque: Math.max(0, toFiniteNumber(displayedTorque, 0)),
      currentPeak: isMotorEnergized ? motor.currentPeak * currentScale : 0,
      currentData: displayedCurrentData,
      currentYMax: Math.max(motor.currentYMax * Math.max(currentScale, 0.15), 1),
      operatingPoint: [
        {
          speed: clamp(displayedRotorSpeed, 0, motor.ns),
          torque: Math.max(0, toFiniteNumber(displayedTorque, 0)),
          slip: isMotorEnergized ? clamp(displayedSlip, 0.001, 1) : 1,
        },
      ],
      state: {
        tone: startupTone,
        label: startupStatusLabel,
        subtitle: startupSubtitle,
      },
      visualRotorDuration:
        rotorRatio > 0.001 ? motor.visualFieldDuration / rotorRatio : 99999,
      torqueYMax: Math.max(motor.torqueYMax, displayedTorque, 1) * 1.04,
    }
  }, [
    displayedRotorSpeed,
    displayedSlip,
    displayedSlipPercent,
    displayedTorque,
    isCoastingDown,
    isMotorEnergized,
    isStartupFailed,
    motor,
    startupState.isStarting,
    startupState.status,
    startupStatusLabel,
  ])
  const displaySlipText = displayedMotor.isSlipDefined
    ? `${formatNumber(displayedMotor.slipPercent, 2)} %`
    : '--'
  const warningCards = useMemo(() => getMotorWarnings(displayedMotor), [displayedMotor])

  useEffect(() => {
    if (!startupState.isStarting) return undefined

    const profile = motor.startupProfile
    const fallbackFinalPoint = {
      time: 0,
      speed: motor.nr,
      torque: motor.torque,
      slipPercent: motor.slipPercent,
    }
    const finalPoint = profile[profile.length - 1] ?? fallbackFinalPoint
    const finalTime = Math.max(finalPoint.time, 0.001)
    let frameId

    const tick = (timestamp) => {
      if (!startupStartTimeRef.current) {
        startupStartTimeRef.current = timestamp
      }

      const elapsed = Math.max(0, (timestamp - startupStartTimeRef.current) / 1000)

      if (motor.startingTorque + 0.05 < motor.loadTorque) {
        const failedPoint = {
          time: Number(elapsed.toFixed(2)),
          speed: 0,
          torque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
          slipPercent: 100,
        }

        setStartupState((current) => {
          if (!current.isStarting) return current

          return {
            ...current,
            isStarting: false,
            startupTime: failedPoint.time,
            startupProgress: 0,
            startupRotorSpeed: 0,
            startupSlip: 1,
            startupTorque: failedPoint.torque,
            startupData: buildStartupTrace(current.startupData, failedPoint),
            hasStartupFinished: false,
            hasStartupFailed: true,
            status: 'failed',
            useStartupDisplay: true,
          }
        })
        return
      }

      const sampledPoint = getStartupPoint(profile, elapsed)
      const reachedSpeed =
        motor.nr <= 0.5 || sampledPoint.speed >= Math.max(0, motor.nr - 0.5)
      const finished = elapsed >= finalTime || reachedSpeed
      const basePoint = finished ? finalPoint : sampledPoint
      const safeSpeed = clamp(basePoint.speed, 0, motor.nr)
      const safeSlip = clamp(basePoint.slipPercent / 100, 0.001, 1)
      const safeTorque = Math.max(0, toFiniteNumber(basePoint.torque, 0))
      const livePoint = {
        time: Number(Math.min(basePoint.time, finalTime).toFixed(2)),
        speed: safeSpeed,
        torque: safeTorque,
        slipPercent: safeSlip * 100,
      }
      const completedTrace = profile.length > 0 ? profile : [livePoint]

      setStartupState((current) => {
        if (!current.isStarting) return current

        return {
          ...current,
          isStarting: !finished,
          startupTime: livePoint.time,
          startupProgress: finished ? 1 : clamp(livePoint.time / finalTime, 0, 1),
          startupRotorSpeed: safeSpeed,
          startupSlip: safeSlip,
          startupTorque: safeTorque,
          startupData: finished ? completedTrace : buildStartupTrace(profile, livePoint),
          hasStartupFinished: finished,
          status: finished ? 'finished' : 'starting',
          useStartupDisplay: true,
        }
      })

      if (!finished) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [
    motor.nr,
    motor.loadTorque,
    motor.slipPercent,
    motor.startingTorque,
    motor.startupProfile,
    motor.torque,
    startupState.isStarting,
  ])

  useEffect(() => {
    if (!startupState.isCoastingDown) return undefined

    let frameId
    let lastTime
    let omega = Math.max(0, (startupState.coastDownRotorSpeed * 2 * Math.PI) / 60)

    const tick = (timestamp) => {
      if (lastTime === undefined) {
        lastTime = timestamp
      }

      const dt = Math.min((timestamp - lastTime) / 1000, 0.08)
      lastTime = timestamp

      const deceleration = -(motor.loadTorque + motor.friction * omega) / motor.inertia
      omega = Math.max(0, omega + deceleration * dt)
      const speed = Math.max(0, (omega * 60) / (2 * Math.PI))
      const stopped = speed <= 0.5

      setStartupState((current) => {
        if (!current.isCoastingDown) return current

        return {
          ...current,
          isCoastingDown: !stopped,
          coastDownRotorSpeed: stopped ? 0 : speed,
          startupRotorSpeed: stopped ? 0 : speed,
          startupSlip: 1,
          startupTorque: 0,
          startupProgress: 0,
          hasStartupFinished: false,
          hasStartupFailed: false,
          status: 'emergency',
          useStartupDisplay: true,
        }
      })

      if (!stopped) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [
    motor.friction,
    motor.inertia,
    motor.loadTorque,
    startupState.coastDownRotorSpeed,
    startupState.isCoastingDown,
  ])

  const startStartupSimulation = () => {
    const initialPoint = motor.startupProfile[0] ?? {
      time: 0,
      speed: 0,
      torque: motor.startingTorque,
      slipPercent: 100,
    }
    const startingTorqueInsufficient = motor.startingTorque + 0.05 < motor.loadTorque

    startupStartTimeRef.current = performance.now()

    if (startingTorqueInsufficient) {
      setStartupState(
        createStartupState({
          hasStartupFailed: true,
          startupTorque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
          startupSlip: 1,
          startupData: [
            {
              time: 0,
              speed: 0,
              torque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
              slipPercent: 100,
            },
            {
              time: 1,
              speed: 0,
              torque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
              slipPercent: 100,
            },
          ],
          status: 'failed',
          useStartupDisplay: true,
        }),
      )
      return
    }

    setStartupState(
      createStartupState({
        isStarting: true,
        startupTorque: Math.max(0, toFiniteNumber(initialPoint.torque, 0)),
        startupData: [
          {
            time: 0,
            speed: 0,
            torque: Math.max(0, toFiniteNumber(initialPoint.torque, 0)),
            slipPercent: 100,
          },
        ],
        status: 'starting',
        useStartupDisplay: true,
      }),
    )
  }

  const resetStartupSimulation = () => {
    startupStartTimeRef.current = 0
    setStartupState(
      createStartupState({
        status: 'idle',
        useStartupDisplay: true,
      }),
    )
  }

  const emergencyStopSimulation = () => {
    const coastStartSpeed = Math.max(0, toFiniteNumber(displayedRotorSpeed, 0))

    startupStartTimeRef.current = 0
    setStartupState(
      createStartupState({
        isCoastingDown: coastStartSpeed > 0.5,
        coastDownRotorSpeed: coastStartSpeed,
        startupRotorSpeed: coastStartSpeed,
        status: 'emergency',
        useStartupDisplay: true,
      }),
    )
  }

  const updateOperatingMode = (enabled) => {
    startupStartTimeRef.current = 0
    setStartupState(createStartupState())
    setAutoOperatingPoint(enabled)
  }

  const applyPreset = (presetId) => {
    const preset = MOTOR_PRESETS.find((item) => item.id === presetId)
    if (!preset) return

    setSelectedPresetId(presetId)
    setStartupState((current) => {
      if (current.status !== 'idle' && current.status !== 'stopped') {
        return current
      }

      return {
        ...current,
        isStarting: false,
        hasStartupFinished: false,
        startupRotorSpeed: 0,
        startupSlip: 1,
        startupTorque: 0,
        startupProgress: 0,
        useStartupDisplay: true,
      }
    })
    setParams((current) => {
      const nextParams = { ...current }

      Object.entries(preset.values).forEach(([key, presetValue]) => {
        const config = PARAM_CONTROLS.find((item) => item.key === key)
        const numericValue = toFiniteNumber(presetValue, DEFAULT_PARAMS[key])
        const boundedValue = config
          ? clamp(numericValue, config.min, config.max)
          : numericValue
        nextParams[key] = key === 'poles' ? Math.max(1, Math.round(boundedValue)) : boundedValue
      })

      return nextParams
    })
  }

  const updateParam = (key, rawValue) => {
    const config = PARAM_CONTROLS.find((item) => item.key === key)
    const value = toFiniteNumber(rawValue, DEFAULT_PARAMS[key])
    const bounded = config ? clamp(value, config.min, config.max) : value

    startupStartTimeRef.current = 0
    setStartupState(createStartupState())
    setSelectedPresetId('custom')
    setParams((current) => ({
      ...current,
      [key]: key === 'poles' ? Math.max(1, Math.round(bounded)) : bounded,
    }))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">MA</span>
          <div>
            <h1>MotorAnalyzer</h1>
            <p>3상 유도 전동기 해석 시뮬레이터</p>
            <small>3-phase induction motor simulator</small>
          </div>
        </div>

        <div className="sidebar-section-title">
          <span>입력 파라미터</span>
          <small>Input parameters</small>
        </div>

        <OperatingModeToggle
          enabled={autoOperatingPoint}
          onChange={updateOperatingMode}
        />

        <FrequencyScalingToggle
          enabled={frequencyReactanceScaling}
          motor={motor}
          onChange={setFrequencyReactanceScaling}
        />

        <MotorControlPanel
          displayedRotorSpeed={displayedRotorSpeed}
          displayedSlipText={displaySlipText}
          onEmergencyStop={emergencyStopSimulation}
          onReset={resetStartupSimulation}
          onStart={startStartupSimulation}
          startupState={startupState}
          statusLabel={startupStatusLabel}
        />

        <PresetPanel
          onSelect={applyPreset}
          presets={MOTOR_PRESETS}
          selectedPreset={selectedPreset}
        />

        <div className="param-list">
          {PARAM_CONTROLS.map((config) => (
            <ParamControl
              key={config.key}
              config={config}
              value={params[config.key]}
              onChange={updateParam}
            />
          ))}
        </div>
      </aside>

      <main className="dashboard">
        <div className="top-status-bar">
          <div className="status-title">
            <span className="status-logo">MA</span>
            <div>
              <strong>MotorAnalyzer</strong>
              <small>Power electronics simulation workspace</small>
            </div>
          </div>
          <div className="status-live">
            <span className="live-dot"></span>
            <span>Live Simulation</span>
          </div>
        </div>

        <header className="dashboard-header">
          <div>
            <span className="eyebrow">Engineering Simulation Dashboard</span>
            <h2>유도 전동기 운전점 분석</h2>
            <p>
              Thevenin 등가회로로 토크, 속도, 전류 파형을 실시간 계산합니다.
            </p>
          </div>

          <div className="header-readouts" aria-label="main computed values">
            <span>
              Ns <strong>{formatCompact(motor.ns, 0)} rpm</strong>
            </span>
            <span>
              Nr <strong>{formatCompact(displayedMotor.nr, 0)} rpm</strong>
            </span>
            <span>
              Te <strong>{formatCompact(displayedMotor.torque, 2)} N·m</strong>
            </span>
          </div>
        </header>

        <section className="result-grid" aria-label="computed result cards">
          <ResultCard
            label="동기 속도 Ns"
            subtitle="Synchronous speed"
            value={formatNumber(motor.ns, 0)}
            unit="rpm"
          />
          <ResultCard
            label="회전자 속도 Nr"
            subtitle={
              displayedMotor.operatingPointMode === 'auto'
                ? 'Auto operating speed'
                : 'Manual slip speed'
            }
            value={formatNumber(displayedMotor.nr, 0)}
            unit="rpm"
          />
          <ResultCard
            label="슬립 s"
            subtitle={
              displayedMotor.isSlipDefined
                ? displayedMotor.operatingPointMode === 'auto'
                  ? `수동 기준 ${formatCompact(motor.manualSlipPercent, 2)}%`
                  : `s = ${formatCompact(displayedMotor.slip, 4)}`
                : '정지 상태에서는 회전자계가 없으므로 슬립은 정의되지 않음 / Slip is not defined when the rotating field is OFF.'
            }
            value={displayedMotor.isSlipDefined ? formatNumber(displayedMotor.slipPercent, 2) : '--'}
            unit={displayedMotor.isSlipDefined ? '%' : ''}
          />
          <ResultCard
            label="전자기 토크 Te"
            subtitle={
              displayedMotor.operatingPointMode === 'auto'
                ? 'At load intersection'
                : 'At manual slip'
            }
            tone="accent"
            value={formatNumber(displayedMotor.torque, 2)}
            unit="N·m"
          />
          <ResultCard
            label="기동 토크"
            subtitle="Starting torque"
            value={formatNumber(motor.startingTorque, 2)}
            unit="N·m"
          />
          <ResultCard
            label="최대 토크"
            subtitle={`${formatCompact(motor.maxTorqueSpeed, 0)} rpm에서 발생`}
            tone="hot"
            value={formatNumber(motor.maxTorque, 2)}
            unit="N·m"
          />
          <ResultCard
            label="부하 토크 TL"
            subtitle="Load torque reference"
            value={formatNumber(motor.loadTorque, 2)}
            unit="N·m"
          />
          <ResultCard
            label={displayedMotor.state.label}
            subtitle={displayedMotor.state.subtitle}
            tone={displayedMotor.state.tone}
            value={displayedMotor.operatingPointMode === 'auto' ? '자동' : '수동'}
            unit=""
          />
        </section>

        <section className="analysis-grid">
          <MotorVisualization motor={displayedMotor} />
          <Motor3DPanel motor={displayedMotor} />

          <StartupResponsePanel
            motor={motor}
            startupState={startupState}
            statusLabel={startupStatusLabel}
          />
        </section>

        <WarningPanel warnings={warningCards} />

        <ThreePhaseCurrentPanel motor={displayedMotor} />

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

          <ResponsiveContainer width="100%" height={390}>
            <ComposedChart
              data={motor.torqueSpeedData}
              margin={{ top: 26, right: 48, bottom: 42, left: 18 }}
            >
              <CartesianGrid stroke="rgba(132, 169, 193, 0.18)" strokeDasharray="4 4" />
              <XAxis
                dataKey="speed"
                domain={[0, Math.ceil(motor.ns / 100) * 100]}
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
                domain={[0, displayedMotor.torqueYMax]}
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
              <ReferenceLine
                ifOverflow="extendDomain"
                label={{
                  value: 'TL',
                  fill: '#ffb020',
                  position: 'right',
                }}
                stroke="#ffb020"
                strokeDasharray="6 5"
                y={motor.loadTorque}
              />
              <Line
                dataKey="torque"
                dot={false}
                isAnimationActive={false}
                name="Motor torque"
                stroke="#00e5ff"
                strokeWidth={3}
                type="monotone"
              />
              <Scatter
                data={motor.startingTorquePoint}
                isAnimationActive={false}
                name="Starting torque"
                shape={(props) => (
                  <TorquePointMarker
                    {...props}
                    anchor="start"
                    color="#ffb020"
                    label="기동 토크"
                    labelDx={12}
                    labelDy={-14}
                  />
                )}
              />
              <Scatter
                data={motor.maxTorquePoint}
                isAnimationActive={false}
                name="Maximum torque"
                shape={(props) => (
                  <TorquePointMarker
                    {...props}
                    anchor="middle"
                    color="#ff4d6d"
                    label="최대 토크"
                    labelDx={0}
                    labelDy={-18}
                  />
                )}
              />
              <Scatter
                data={displayedMotor.operatingPoint}
                isAnimationActive={false}
                name="Operating point"
                shape={(props) => (
                  <TorquePointMarker
                    {...props}
                    anchor="end"
                    color="#2dfc85"
                    label="현재 운전점"
                    labelDx={-12}
                    labelDy={-14}
                  />
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="chart-explanation">
            {motor.operatingPointMode === 'auto' && motor.hasLoadIntersection
              ? '자동 운전점은 전동기 토크 곡선과 부하 토크 TL 선이 만나는 지점이며, 이때 전자기 토크와 부하 토크가 평형을 이룬다.'
              : motor.operatingPointMode === 'auto'
                ? '현재 부하 토크는 전동기 토크 곡선과 안정 교점을 만들지 못하므로, 가장 가까운 운전 가능 지점을 표시한다.'
                : '수동 모드에서는 입력한 슬립 값을 기준으로 현재 운전점을 표시한다.'}{' '}
            유도전동기는 슬립이 존재해야 토크가 발생하며, 회전자 속도가
            동기속도에 가까워질수록 슬립이 작아진다.
          </p>
        </section>

        <EducationPanel />
      </main>
    </div>
  )
}

export default App
