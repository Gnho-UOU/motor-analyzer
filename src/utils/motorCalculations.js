import { DEFAULT_PARAMS } from '../data/defaultParams.js'
import { MANUFACTURER_OPTIONS, VOLTAGE_CLASS_OPTIONS, POWER_TYPE_OPTIONS, PHASE_TYPE_OPTIONS, MOTOR_CATEGORY_OPTIONS, PARAMETER_MODE_OPTIONS } from '../data/motorOptions.js'
import { TEST_MODE_OPTIONS } from '../data/testModes.js'
import { clamp, formatCompact, getLocalDateString, toFiniteNumber, toProfileNumber } from './numberUtils.js'
import { calculateVoltagePerUnit, getVoltageCondition } from './voltageJudgment.js'
import { calculateLoadTorqueAtRatedSpeed, calculateRatedTorque, createLoadTorqueCalculator, getLoadModelOption } from './loadModels.js'
import { calculateLoadPercent, calculateLoadTorqueFromPercent } from './operatingPresets.js'
import { estimateThermalDefaults, sanitizeThermalParams } from './thermalCalculations.js'

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

export function evaluateRatedSpeedAgainstNs(ratedSpeedRpm, synchronousSpeedRpm) {
  const speed = Math.max(0, toFiniteNumber(ratedSpeedRpm, 0))
  const ns = Math.max(0, toFiniteNumber(synchronousSpeedRpm, 0))
  const safeSlipPercent = 3
  const safeSlip = safeSlipPercent / 100

  if (ns <= 0) {
    return {
      status: 'invalid-ns',
      tone: 'caution',
      isValid: false,
      estimatedSlip: safeSlip,
      slipPercent: safeSlipPercent,
      label: '입력 확인 필요',
      warning: '동기속도를 계산할 수 없어 기본 슬립 3%를 적용했습니다.',
    }
  }

  if (speed <= 0) {
    return {
      status: 'invalid-speed',
      tone: 'caution',
      isValid: false,
      estimatedSlip: safeSlip,
      slipPercent: safeSlipPercent,
      label: '입력 확인 필요',
      warning: '정격속도가 유효하지 않아 기본 슬립 3%를 적용했습니다.',
    }
  }

  if (speed >= ns) {
    return {
      status: 'invalid-high-speed',
      tone: 'danger',
      isValid: false,
      estimatedSlip: safeSlip,
      slipPercent: safeSlipPercent,
      label: '입력 확인 필요',
      warning:
        '정격속도가 동기속도보다 크거나 같습니다. 3상 유도전동기에서는 정격속도가 동기속도보다 작아야 합니다. 극수 또는 정격속도를 확인하세요.',
    }
  }

  const estimatedSlip = (ns - speed) / ns
  const slipPercent = clamp(estimatedSlip * 100, 0.1, 100)

  return {
    status: 'ok',
    tone: 'normal',
    isValid: true,
    estimatedSlip,
    slipPercent,
    label: `${formatCompact(slipPercent, 2)} %`,
    warning: '',
  }
}

export function sanitizeParams(params) {
  const f = Math.max(0.001, toFiniteNumber(params.f, DEFAULT_PARAMS.f))
  const poles = Math.max(0.001, toFiniteNumber(params.poles, DEFAULT_PARAMS.poles))
  const voltage = Math.max(0, toFiniteNumber(params.voltage, DEFAULT_PARAMS.voltage))
  const ratedVoltageReference = Math.max(
    0.001,
    toFiniteNumber(params.ratedVoltageReference, voltage || DEFAULT_PARAMS.ratedVoltageReference),
  )

  const thermalParams = sanitizeThermalParams({
    ...params,
    ratedPowerKwReference: toFiniteNumber(params.ratedPowerKwReference, DEFAULT_PARAMS.ratedPowerKwReference),
  })
  const ratedPowerKwReference = Math.max(
    0,
    toFiniteNumber(params.ratedPowerKwReference, DEFAULT_PARAMS.ratedPowerKwReference),
  )
  const ratedSpeedReference = Math.max(
    0,
    toFiniteNumber(params.ratedSpeedReference, DEFAULT_PARAMS.ratedSpeedReference),
  )
  const ratedTorqueInput = Math.max(
    0,
    toFiniteNumber(params.ratedTorqueReference, DEFAULT_PARAMS.ratedTorqueReference),
  )
  const calculatedRatedTorque = calculateRatedTorque(ratedPowerKwReference, ratedSpeedReference)
  const ratedTorqueReference = ratedTorqueInput > 0 ? ratedTorqueInput : calculatedRatedTorque
  const loadPercent = clamp(
    toFiniteNumber(
      params.loadPercent,
      calculateLoadPercent(params.loadTorque, ratedTorqueReference, DEFAULT_PARAMS.loadPercent),
    ),
    0,
    300,
  )
  const loadTorque = params.loadPercent !== undefined && ratedTorqueReference > 0
    ? calculateLoadTorqueFromPercent(loadPercent, ratedTorqueReference)
    : Math.max(0, toFiniteNumber(params.loadTorque, DEFAULT_PARAMS.loadTorque))

  return {
    f,
    poles,
    voltage,
    ratedPowerKwReference,
    ratedVoltageReference,
    ratedFrequencyReference: Math.max(
      0.001,
      toFiniteNumber(params.ratedFrequencyReference, f || DEFAULT_PARAMS.ratedFrequencyReference),
    ),
    ratedSpeedReference,
    ratedCurrentReference: Math.max(
      0,
      toFiniteNumber(params.ratedCurrentReference, DEFAULT_PARAMS.ratedCurrentReference),
    ),
    ratedTorqueReference,
    powerFactorReference: clamp(
      toFiniteNumber(params.powerFactorReference, DEFAULT_PARAMS.powerFactorReference),
      0,
      1,
    ),
    efficiencyReference: clamp(
      toFiniteNumber(params.efficiencyReference, DEFAULT_PARAMS.efficiencyReference),
      0,
      100,
    ),
    ratedSpeedStatus: String(params.ratedSpeedStatus || DEFAULT_PARAMS.ratedSpeedStatus),
    ratedSpeedWarning: String(params.ratedSpeedWarning || DEFAULT_PARAMS.ratedSpeedWarning),
    ratedSpeedEstimatedSlip: clamp(
      toFiniteNumber(params.ratedSpeedEstimatedSlip, DEFAULT_PARAMS.ratedSpeedEstimatedSlip),
      0,
      1,
    ),
    r1: Math.max(0.0001, toFiniteNumber(params.r1, DEFAULT_PARAMS.r1)),
    r2: Math.max(0.0001, toFiniteNumber(params.r2, DEFAULT_PARAMS.r2)),
    x1: Math.max(0.0001, toFiniteNumber(params.x1, DEFAULT_PARAMS.x1)),
    x2: Math.max(0.0001, toFiniteNumber(params.x2, DEFAULT_PARAMS.x2)),
    xm: Math.max(0.0001, toFiniteNumber(params.xm, DEFAULT_PARAMS.xm)),
    rc: Math.max(0.0001, toFiniteNumber(params.rc, DEFAULT_PARAMS.rc)),
    slipPercent: clamp(params.slipPercent, 0, 100),
    loadModel: String(params.loadModel || DEFAULT_PARAMS.loadModel),
    parameterMode: String(params.parameterMode || DEFAULT_PARAMS.parameterMode),
    parameterEstimationStatus: String(
      params.parameterEstimationStatus || DEFAULT_PARAMS.parameterEstimationStatus,
    ),
    parameterEstimationNote: String(
      params.parameterEstimationNote || DEFAULT_PARAMS.parameterEstimationNote,
    ),
    loadPercent,
    loadTorque,
    inertia: Math.max(0.0001, toFiniteNumber(params.inertia, DEFAULT_PARAMS.inertia)),
    friction: Math.max(0, toFiniteNumber(params.friction, DEFAULT_PARAMS.friction)),
    ...thermalParams,
  }
}

export function clampEquivalentParameter(value, fallback, max = 10000) {
  const numeric = toFiniteNumber(value, fallback)
  return clamp(numeric, 0.0001, max)
}

export const EQUIVALENT_PARAMETER_ALIASES = {
  r1: 'parameterR1',
  r2: 'parameterR2',
  x1: 'parameterX1',
  x2: 'parameterX2',
  xm: 'parameterXm',
  rc: 'parameterRc',
}

export const REVERSE_EQUIVALENT_PARAMETER_ALIASES = Object.entries(
  EQUIVALENT_PARAMETER_ALIASES,
).reduce((aliases, [canonicalKey, legacyKey]) => {
  aliases[legacyKey] = canonicalKey
  return aliases
}, {})

export function getProfileEquivalentParameter(profile, key, fallback) {
  const legacyKey = EQUIVALENT_PARAMETER_ALIASES[key]
  const value = profile[key] ?? (legacyKey ? profile[legacyKey] : undefined)
  return clampEquivalentParameter(value, fallback)
}

export function getManualEquivalentParameters(profile) {
  return {
    r1: getProfileEquivalentParameter(profile, 'r1', DEFAULT_PARAMS.r1),
    r2: getProfileEquivalentParameter(profile, 'r2', DEFAULT_PARAMS.r2),
    x1: getProfileEquivalentParameter(profile, 'x1', DEFAULT_PARAMS.x1),
    x2: getProfileEquivalentParameter(profile, 'x2', DEFAULT_PARAMS.x2),
    xm: getProfileEquivalentParameter(profile, 'xm', DEFAULT_PARAMS.xm),
    rc: getProfileEquivalentParameter(profile, 'rc', DEFAULT_PARAMS.rc),
  }
}

export function estimateRatedEquivalentParameters(profile) {
  const ratedPowerKw = Math.max(0.1, toProfileNumber(profile.ratedPowerKw, 15))
  const ratedVoltage = Math.max(1, toProfileNumber(profile.ratedVoltage, 380))
  const ratedCurrentInput = Math.max(0, toProfileNumber(profile.ratedCurrent, 30))
  const powerFactor = clamp(toProfileNumber(profile.powerFactor, 0.85), 0.05, 1)
  const efficiency = clamp(toProfileNumber(profile.efficiency, 90), 1, 100) / 100
  const estimatedCurrent =
    (ratedPowerKw * 1000) / (Math.sqrt(3) * ratedVoltage * powerFactor * efficiency)
  const ratedCurrent = ratedCurrentInput > 0 ? ratedCurrentInput : estimatedCurrent
  const vPhase = ratedVoltage / Math.sqrt(3)
  const zbase = vPhase / Math.max(ratedCurrent, 0.001)
  const powerScale = clamp((15 / ratedPowerKw) ** 0.14, 0.68, 1.7)
  const efficiencyScale = clamp(0.92 / Math.max(efficiency, 0.2), 0.78, 1.35)
  const resistanceScale = powerScale * efficiencyScale
  const leakageScale = clamp((60 / Math.max(toProfileNumber(profile.ratedFrequency, 60), 1)) ** 0.08, 0.85, 1.15)

  return {
    r1: clampEquivalentParameter(0.04 * zbase * resistanceScale, DEFAULT_PARAMS.r1),
    r2: clampEquivalentParameter(0.035 * zbase * resistanceScale, DEFAULT_PARAMS.r2),
    x1: clampEquivalentParameter(0.08 * zbase * leakageScale, DEFAULT_PARAMS.x1),
    x2: clampEquivalentParameter(0.08 * zbase * leakageScale, DEFAULT_PARAMS.x2),
    xm: clampEquivalentParameter(2.5 * zbase, DEFAULT_PARAMS.xm),
    rc: clampEquivalentParameter(8 * zbase * clamp(efficiency / 0.9, 0.75, 1.25), DEFAULT_PARAMS.rc),
  }
}

export function estimateTestEquivalentParameters(profile) {
  const manual = getManualEquivalentParameters(profile)
  const v0 = Math.max(0, toProfileNumber(profile.noLoadVoltage, profile.ratedVoltage || 380))
  const i0 = Math.max(0, toProfileNumber(profile.noLoadCurrent, 0))
  const p0 = Math.max(0, toProfileNumber(profile.noLoadPower, 0))
  const vsc = Math.max(0, toProfileNumber(profile.blockedRotorVoltage, 0))
  const isc = Math.max(0, toProfileNumber(profile.blockedRotorCurrent, 0))
  const psc = Math.max(0, toProfileNumber(profile.blockedRotorPower, 0))
  const measuredR1 = clampEquivalentParameter(profile.measuredR1, manual.r1)
  const warnings = []

  const vscPhase = vsc / Math.sqrt(3)
  const zsc = isc > 0 ? vscPhase / isc : 0
  const req = isc > 0 ? psc / (3 * isc ** 2) : 0
  const xeqSquared = zsc ** 2 - req ** 2
  const blockedDataValid =
    vsc > 0 && isc > 0 && psc > 0 && zsc > 0 && req > 0 && xeqSquared >= 0

  if (!blockedDataValid) {
    warnings.push('구속 시험 데이터가 유효하지 않아 수동 입력값을 유지했습니다.')
  }

  const xeq = blockedDataValid ? Math.sqrt(Math.max(0, xeqSquared)) : manual.x1 + manual.x2
  const r2 = blockedDataValid
    ? Math.max(req - measuredR1, 0.0001)
    : manual.r2

  const v0Phase = v0 / Math.sqrt(3)
  const iw = v0Phase > 0 ? p0 / (3 * v0Phase) : 0
  const imSquared = i0 ** 2 - iw ** 2
  const noLoadDataValid =
    v0 > 0 && i0 > 0 && p0 > 0 && iw > 0 && imSquared > 0

  if (!noLoadDataValid) {
    warnings.push('무부하 시험 데이터가 유효하지 않아 수동 입력값을 유지했습니다.')
  }

  const im = noLoadDataValid ? Math.sqrt(Math.max(0, imSquared)) : 0

  return {
    params: {
      r1: measuredR1,
      r2: clampEquivalentParameter(r2, manual.r2),
      x1: clampEquivalentParameter(xeq / 2, manual.x1),
      x2: clampEquivalentParameter(xeq / 2, manual.x2),
      xm: noLoadDataValid ? clampEquivalentParameter(v0Phase / im, manual.xm) : manual.xm,
      rc: noLoadDataValid ? clampEquivalentParameter(v0Phase / iw, manual.rc) : manual.rc,
    },
    warnings,
  }
}

export function estimateEquivalentParameters(profile) {
  const mode = getParameterModeOption(profile.parameterMode).value

  if (mode === 'manual') {
    return {
      mode,
      params: getManualEquivalentParameters(profile),
      status: 'ok',
      note: '사용자가 입력한 등가회로 파라미터를 적용합니다.',
    }
  }

  if (mode === 'test-estimation') {
    const result = estimateTestEquivalentParameters(profile)
    const hasWarnings = result.warnings.length > 0

    return {
      mode,
      params: result.params,
      status: hasWarnings ? 'warning' : 'ok',
      note: hasWarnings
        ? result.warnings.join(' ')
        : '무부하·구속 시험 기반 교육용 추정값입니다.',
    }
  }

  if (
    profile.exampleProfileId === 'low-voltage-hyosung-75kw-4p' &&
    profile.parameterMode === 'example-equivalent-override'
  ) {
    return {
      mode: 'rated-estimation',
      params: getManualEquivalentParameters(profile),
      status: 'ok',
      note: '저압 75 kW 4극 교육용 예시 등가회로 값을 적용했습니다. 실제 제품 데이터와 다를 수 있습니다.',
    }
  }

  return {
    mode: 'rated-estimation',
    params: estimateRatedEquivalentParameters(profile),
    status: 'ok',
    note: '본 값은 교육용 추정값이며 실제 제품 데이터와 다를 수 있습니다.',
  }
}

// Find motor/load intersections and choose the high-speed stable branch closest to synchronous speed.
export function findStableOperatingPoint(torqueSpeedData, ns) {
  if (!Array.isArray(torqueSpeedData) || torqueSpeedData.length === 0) {
    return {
      slip: 1,
      speed: 0,
      torque: 0,
      loadTorque: 0,
      hasIntersection: false,
    }
  }

  const maximumLoadTorque = torqueSpeedData.reduce(
    (maxValue, point) => Math.max(maxValue, toFiniteNumber(point.loadTorque, 0)),
    0,
  )

  if (maximumLoadTorque <= 0.0001) {
    return {
      slip: 0,
      speed: ns,
      torque: 0,
      loadTorque: 0,
      torqueDelta: 0,
      hasIntersection: true,
    }
  }

  const intersections = []
  let closestPoint = torqueSpeedData[0] ?? { slip: 1, speed: 0, torque: 0, loadTorque: 0 }
  let closestDifference = Math.abs(closestPoint.torque - closestPoint.loadTorque)

  for (let index = 0; index < torqueSpeedData.length; index += 1) {
    const point = torqueSpeedData[index]
    const currentDelta = point.torque - point.loadTorque
    const difference = Math.abs(currentDelta)

    if (
      difference < closestDifference ||
      (difference === closestDifference && point.speed > closestPoint.speed)
    ) {
      closestPoint = point
      closestDifference = difference
    }

    const nextPoint = torqueSpeedData[index + 1]
    if (!nextPoint) continue

    const nextDelta = nextPoint.torque - nextPoint.loadTorque

    if (currentDelta === 0) {
      intersections.push({ ...point, torqueDelta: 0 })
    }

    if (currentDelta * nextDelta < 0) {
      const span = nextDelta - currentDelta
      const ratio = Math.abs(span) > Number.EPSILON ? -currentDelta / span : 0
      const speed = point.speed + (nextPoint.speed - point.speed) * ratio
      const torque = point.torque + (nextPoint.torque - point.torque) * ratio
      const loadTorque =
        point.loadTorque + (nextPoint.loadTorque - point.loadTorque) * ratio

      intersections.push({
        slip: point.slip + (nextPoint.slip - point.slip) * ratio,
        speed,
        torque,
        loadTorque,
        torqueDelta: torque - loadTorque,
      })
    }
  }

  const lastPoint = torqueSpeedData[torqueSpeedData.length - 1]
  if (lastPoint && lastPoint.torque === lastPoint.loadTorque) {
    intersections.push({ ...lastPoint, torqueDelta: 0 })
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
export function generateStartupResponse({
  omegaS,
  targetSpeedRpm,
  torqueAtSlip,
  loadTorqueAtSpeed,
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
    const loadTorque = Math.max(0, toFiniteNumber(loadTorqueAtSpeed(speed), 0))
    const acceleration = (torque - loadTorque - friction * omega) / inertia

    data.push({
      time: Number(time.toFixed(2)),
      speed: Math.max(0, toFiniteNumber(speed, 0)),
      torque: Math.max(0, toFiniteNumber(torque, 0)),
      loadTorque,
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
      loadTorque: Math.max(0, toFiniteNumber(loadTorqueAtSpeed(targetSpeedRpm), 0)),
      slipPercent: targetSlip * 100,
    })
  }

  return data
}

export const createStartupState = (overrides = {}) => ({
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

export function getStartupStatusLabel(status) {
  if (status === 'starting') return '기동 중...'
  if (status === 'finished') return '정상 운전 도달'
  if (status === 'failed') return '기동 실패'
  if (status === 'emergency') return '비상정지'
  if (status === 'stopped') return '정지'
  return '대기 중'
}

export function getStartupPoint(profile, time) {
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
        loadTorque:
          toFiniteNumber(point.loadTorque, 0) +
          (toFiniteNumber(nextPoint.loadTorque, 0) - toFiniteNumber(point.loadTorque, 0)) *
            ratio,
        slipPercent:
          point.slipPercent + (nextPoint.slipPercent - point.slipPercent) * ratio,
      }
    }
  }

  return lastPoint
}

export function buildStartupTrace(profile, currentPoint) {
  const safeProfile = Array.isArray(profile) ? profile : []
  const visibleData = safeProfile.filter((point) => point.time <= currentPoint.time)
  const lastVisiblePoint = visibleData[visibleData.length - 1]
  const shouldAppend =
    !lastVisiblePoint || Math.abs(lastVisiblePoint.time - currentPoint.time) > 0.001

  return shouldAppend ? [...visibleData, currentPoint] : visibleData
}

// Main induction-motor model: synchronous speed, Thevenin equivalent, torque, and graph data.
export function calculateMotor(params, autoOperatingPoint, frequencyReactanceScaling = false) {
  const p = sanitizeParams(params)
  const manualSlip = clamp(p.slipPercent / 100, 0, 1)
  const supplyFrequency = p.f
  const supplyVoltage = p.voltage
  const R1 = p.r1
  const R2 = p.r2
  const X1 = p.x1
  const X2 = p.x2
  const Xm = p.xm
  const ns = (120 * supplyFrequency) / p.poles
  const ratedSpeedCheck = evaluateRatedSpeedAgainstNs(p.ratedSpeedReference, ns)
  const vpu = calculateVoltagePerUnit(p.voltage, p.ratedVoltageReference)
  const voltageCondition = getVoltageCondition(vpu)
  const loadModelOption = getLoadModelOption(p.loadModel)
  const parameterModeOption = getParameterModeOption(p.parameterMode)
  const calculatedRatedTorque = calculateRatedTorque(
    p.ratedPowerKwReference,
    p.ratedSpeedReference,
  )
  const ratedTorque = p.ratedTorqueReference > 0 ? p.ratedTorqueReference : calculatedRatedTorque
  const loadTorqueAtSpeed = createLoadTorqueCalculator({
    loadModel: loadModelOption.value,
    selectedLoadTorque: p.loadTorque,
    ratedPowerKw: p.ratedPowerKwReference,
    ratedSpeedRpm: p.ratedSpeedReference,
    ratedTorque,
  })
  const omegaS = (2 * Math.PI * ns) / 60
  const omegaSafe = Math.max(omegaS, 0.000001)
  const vPhase = supplyVoltage / Math.sqrt(3)
  const reactanceScale = frequencyReactanceScaling
    ? clamp(supplyFrequency / DEFAULT_PARAMS.f, 0.001, 10)
    : 1
  const x1Eff = X1 * reactanceScale
  const x2Eff = X2 * reactanceScale
  const xmEff = Xm * reactanceScale

  const z1 = c(R1, x1Eff)
  const zm = c(0, xmEff)
  const z1PlusZm = cAdd(z1, zm)
  const vth = vPhase * cAbs(cDiv(zm, z1PlusZm))
  const zth = cDiv(cMul(z1, zm), z1PlusZm)
  const rth = zth.re
  const xth = zth.im

  const rawTorqueAtSlip = (slipValue, {
    omega = omegaSafe,
    rthValue = rth,
    vthValue = vth,
    x2Value = x2Eff,
    xthValue = xth,
  } = {}) => {
    const localSlip = Math.max(slipValue, 0.0001)
    const rotorResistance = R2 / localSlip
    const numerator = 3 * vthValue * vthValue * rotorResistance
    const denominator =
      Math.max(omega, 0.000001) *
      ((rthValue + rotorResistance) ** 2 + (xthValue + x2Value) ** 2)
    const torqueValue = numerator / denominator
    return Number.isFinite(torqueValue) ? Math.max(0, torqueValue) : 0
  }
  const ratedNs = (120 * p.ratedFrequencyReference) / p.poles
  const ratedSlipForCalibration =
    p.ratedSpeedReference > 0 && ratedNs > 0 && p.ratedSpeedReference < ratedNs
      ? (ratedNs - p.ratedSpeedReference) / ratedNs
      : 0
  const ratedReactanceScale = frequencyReactanceScaling
    ? clamp(p.ratedFrequencyReference / DEFAULT_PARAMS.f, 0.001, 10)
    : 1
  const z1Rated = c(R1, X1 * ratedReactanceScale)
  const zmRated = c(0, Xm * ratedReactanceScale)
  const zRatedSum = cAdd(z1Rated, zmRated)
  const ratedVphase = p.ratedVoltageReference / Math.sqrt(3)
  const ratedVth = ratedVphase * cAbs(cDiv(zmRated, zRatedSum))
  const ratedZth = cDiv(cMul(z1Rated, zmRated), zRatedSum)
  const rawRatedTorque =
    ratedSlipForCalibration > 0
      ? rawTorqueAtSlip(ratedSlipForCalibration, {
        omega: (2 * Math.PI * ratedNs) / 60,
        rthValue: ratedZth.re,
        vthValue: ratedVth,
        x2Value: X2 * ratedReactanceScale,
        xthValue: ratedZth.im,
      })
      : 0
  const torqueCalibrationFactor =
    parameterModeOption.value === 'rated-estimation' &&
    ratedTorque > 0 &&
    rawRatedTorque > 0
      ? clamp(ratedTorque / rawRatedTorque, 0.2, 5)
      : 1

  // Slip is clamped away from zero to avoid division by zero near synchronous speed.
  const torqueAtSlip = (slipValue) => rawTorqueAtSlip(slipValue) * torqueCalibrationFactor

  const startingTorque = torqueAtSlip(1)
  const torqueSpeedData = Array.from({ length: 220 }, (_, index) => {
    const curveSlip = 0.001 + (index / 219) * 0.999
    const speed = ns * (1 - curveSlip)
    const loadTorque = loadTorqueAtSpeed(speed)
    const torque = torqueAtSlip(curveSlip)

    return {
      slip: curveSlip,
      speed,
      torque,
      loadTorque,
      torqueDelta: torque - loadTorque,
    }
  }).sort((a, b) => a.speed - b.speed)

  const maxPoint = torqueSpeedData.reduce(
    (best, point) => (point.torque > best.torque ? point : best),
    torqueSpeedData[0],
  )

  const manualTorque = torqueAtSlip(manualSlip)
  const manualSpeed = ns * (1 - manualSlip)
  const manualLoadTorque = loadTorqueAtSpeed(manualSpeed)
  const manualPoint = {
    slip: manualSlip,
    speed: manualSpeed,
    torque: manualTorque,
    loadTorque: manualLoadTorque,
    torqueDelta: manualTorque - manualLoadTorque,
    hasIntersection: true,
  }
  const loadPoint = findStableOperatingPoint(torqueSpeedData, ns)
  const activePoint = autoOperatingPoint ? loadPoint : manualPoint
  const slip = clamp(activePoint.slip, 0, 1)
  const safeSlip = Math.max(slip, 0.0001)
  const nr = clamp(activePoint.speed, 0, ns)
  const torque = Math.max(0, toFiniteNumber(activePoint.torque, 0))
  const operatingLoadTorque = Math.max(
    0,
    toFiniteNumber(activePoint.loadTorque, loadTorqueAtSpeed(nr)),
  )
  const startingLoadTorque = loadTorqueAtSpeed(0)
  const ratedLoadTorque = loadTorqueAtSpeed(p.ratedSpeedReference)
  const maxLoadTorque = torqueSpeedData.reduce(
    (maxValue, point) => Math.max(maxValue, point.loadTorque),
    0,
  )

  const rotorBranch = c(R2 / safeSlip, x2Eff)
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
    loadTorqueAtSpeed,
    inertia: p.inertia,
    friction: p.friction,
  })
  const startupFinalPoint = startupProfile[startupProfile.length - 1] ?? null
  const startupFinalSpeed = Math.max(0, toFiniteNumber(startupFinalPoint?.speed, 0))
  const startupTargetSpeed = Math.max(0, toFiniteNumber(nr, 0))
  const startupTorqueMargin = Math.max(startingLoadTorque * 0.05, ratedTorque * 0.02, 0.25)
  const startupTorqueReserve = startingTorque - startingLoadTorque
  const hasStartupTorqueReserve = startupTorqueReserve + startupTorqueMargin >= 0
  const startupCanReachTarget =
    startupTargetSpeed <= 0.5 ||
    startupFinalSpeed >= startupTargetSpeed * 0.95
  const startupCanAccelerate =
    hasStartupTorqueReserve &&
    startupCanReachTarget &&
    startupProfile.some((point) => toFiniteNumber(point.speed, 0) > Math.max(1, startupTargetSpeed * 0.02))

  const torqueMargin = Math.max(operatingLoadTorque * 0.05, 0.25)
  let state = {
    tone: 'balanced',
    label: '평형 운전',
    subtitle: 'Balanced operating point',
  }

  if (voltageCondition.isProhibited) {
    state = {
      tone: 'danger',
      label: '운전 불가',
      subtitle: 'Supply voltage exceeds the prohibited limit',
    }
  } else if (!ratedSpeedCheck.isValid) {
    state = {
      tone: ratedSpeedCheck.tone === 'danger' ? 'danger' : 'warning',
      label: '정격속도 입력 확인',
      subtitle: 'Rated speed must be lower than synchronous speed',
    }
  } else if (voltageCondition.tone === 'danger') {
    state = {
      tone: 'danger',
      label: voltageCondition.label,
      subtitle: voltageCondition.subtitle,
    }
  } else if (autoOperatingPoint && !activePoint.hasIntersection) {
    state = {
      tone: 'danger',
      label: '안정 운전점 없음',
      subtitle: 'No stable operating point',
    }
  } else if (slip >= 0.95) {
    state = {
      tone: 'starting',
      label: '기동 영역',
      subtitle: 'Starting or locked-rotor region',
    }
  } else if (torque + torqueMargin < operatingLoadTorque) {
    state = {
      tone: 'warning',
      label: '부하 초과',
      subtitle: 'Load torque is higher than motor torque',
    }
  } else if (torque > operatingLoadTorque + torqueMargin) {
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
    vpu,
    voltageCondition,
    loadModel: loadModelOption.value,
    loadModelLabel: `${loadModelOption.label} / ${loadModelOption.subtitle}`,
    loadModelDescription: loadModelOption.description,
    loadModelNote: loadModelOption.note ?? '',
    parameterMode: parameterModeOption.value,
    parameterModeLabel: `${parameterModeOption.label} / ${parameterModeOption.subtitle}`,
    parameterEstimationStatus: p.parameterEstimationStatus,
    parameterEstimationNote: torqueCalibrationFactor !== 1 && parameterModeOption.value === 'rated-estimation'
      ? `${p.parameterEstimationNote} 정격값 기반 교육용 추정 모드에서는 정격 슬립 지점에서 정격토크와 일치하도록 토크 곡선을 보정합니다.`
      : p.parameterEstimationNote,
    ratedTorque,
    rawRatedTorque,
    torqueCalibrationFactor,
    ratedSpeedStatus: ratedSpeedCheck.status,
    ratedSpeedWarning: ratedSpeedCheck.warning,
    ratedSpeedEstimatedSlip: ratedSpeedCheck.estimatedSlip,
    ratedSpeedSlipPercent: ratedSpeedCheck.slipPercent,
    ratedSpeedSlipLabel: ratedSpeedCheck.label,
    startingLoadTorque,
    startupTorqueMargin,
    startupTorqueReserve,
    hasStartupTorqueReserve,
    startupCanAccelerate,
    startupCanReachTarget,
    startupFinalSpeed,
    startupTargetSpeed,
    ratedLoadTorque,
    operatingLoadTorque,
    maxLoadTorque,
    loadTorqueAtSpeed,
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
    loadTorqueCurveData: torqueSpeedData.map((point) => ({
      speed: point.speed,
      loadTorque: point.loadTorque,
    })),
    operatingPoint: [{ speed: nr, torque, loadTorque: operatingLoadTorque, slip }],
    operatingPointMode: autoOperatingPoint ? 'auto' : 'manual',
    hasLoadIntersection: activePoint.hasIntersection,
    operatingJudgment: activePoint.hasIntersection
      ? '안정 운전점 / Stable operating point'
      : '안정 운전점 없음 / No stable operating point',
    maxTorquePoint: [{ speed: maxPoint.speed, torque: maxPoint.torque }],
    startingTorquePoint: [{ speed: 0, torque: startingTorque }],
    torqueYMax:
      Math.max(maxPoint.torque, torque, startingTorque, operatingLoadTorque, maxLoadTorque, 1) *
      1.22,
    currentYMax: Math.max(im, 1) * 1.18,
    startupSpeedYMax: Math.max(ns, nr, 1) * 1.05,
    startupTorqueYMax:
      Math.max(
        ...startupProfile.map((point) => Math.max(point.torque, point.loadTorque ?? 0)),
        torque,
        startingTorque,
        startingLoadTorque,
        1,
      ) *
      1.16,
    state,
    visualFieldDuration,
    visualRotorDuration,
  }
}

export function createDefaultTestProfile() {
  return {
    userName: '',
    organization: '',
    projectName: '',
    testDate: getLocalDateString(),
    testMemo: '',
    voltageClass: 'low-voltage',
    powerType: 'ac',
    phaseType: 'three-phase',
    motorCategory: 'induction',
    manufacturer: 'hyosung',
    customManufacturer: '',
    exampleProfileId: 'custom',
    ratedPowerKw: 15,
    ratedVoltage: 380,
    ratedFrequency: 60,
    supplyVoltage: 380,
    supplyFrequency: 60,
    poleNumber: 4,
    ratedSpeed: 1750,
    ratedCurrent: 30,
    powerFactor: 0.85,
    efficiency: 90,
    loadModel: 'constant-torque',
    loadPercent: 100,
    loadTorque: 81.85,
    inertiaJ: 0.05,
    parameterMode: 'rated-estimation',
    r1: 0.8,
    r2: 0.6,
    x1: 1.2,
    x2: 1.2,
    xm: 30,
    rc: 240,
    parameterR1: 0.8,
    parameterR2: 0.6,
    parameterX1: 1.2,
    parameterX2: 1.2,
    parameterXm: 30,
    parameterRc: 240,
    noLoadVoltage: 380,
    noLoadCurrent: 10,
    noLoadPower: 900,
    blockedRotorVoltage: 110,
    blockedRotorCurrent: 30,
    blockedRotorPower: 1800,
    measuredR1: 0.8,
    testMode: 'rated-load',
  }
}

export function getOptionLabel(options, value) {
  const option = options.find((item) => item.value === value)
  return option ? `${option.label} / ${option.subtitle}` : value || '-'
}

export function getManufacturerLabel(profile) {
  if (profile.manufacturer === 'other') {
    return profile.customManufacturer?.trim() || '기타 / Other'
  }

  return getOptionLabel(MANUFACTURER_OPTIONS, profile.manufacturer)
}

export function getMotorTypeLabel(profile) {
  return [
    getOptionLabel(VOLTAGE_CLASS_OPTIONS, profile.voltageClass),
    getOptionLabel(POWER_TYPE_OPTIONS, profile.powerType),
    getOptionLabel(PHASE_TYPE_OPTIONS, profile.phaseType),
    getOptionLabel(MOTOR_CATEGORY_OPTIONS, profile.motorCategory),
  ].join(' · ')
}

export function getTestModeOption(value) {
  return TEST_MODE_OPTIONS.find((item) => item.value === value) ?? TEST_MODE_OPTIONS[1]
}

export function getParameterModeOption(value) {
  if (value === 'rated-data-estimation') {
    return PARAMETER_MODE_OPTIONS.find((item) => item.value === 'rated-estimation') ?? PARAMETER_MODE_OPTIONS[1]
  }

  return PARAMETER_MODE_OPTIONS.find((item) => item.value === value) ?? PARAMETER_MODE_OPTIONS[1]
}

export function getParameterModeLabel(value) {
  const option = getParameterModeOption(value)
  return `${option.label} / ${option.subtitle}`
}

export function isSupportedMotorProfile(profile) {
  return (
    profile.powerType === 'ac' &&
    profile.phaseType === 'three-phase' &&
    profile.motorCategory === 'induction'
  )
}

export function calculateRatedPreview(profile) {
  const ratedPowerKw = Math.max(0, toProfileNumber(profile.ratedPowerKw, 15))
  const ratedVoltage = Math.max(0.001, toProfileNumber(profile.ratedVoltage, 380))
  const ratedFrequency = Math.max(0.001, toProfileNumber(profile.ratedFrequency, 60))
  const supplyVoltage = Math.max(0, toProfileNumber(profile.supplyVoltage, ratedVoltage))
  const supplyFrequency = Math.max(0.001, toProfileNumber(profile.supplyFrequency, ratedFrequency))
  const poleNumber = Math.max(1, toProfileNumber(profile.poleNumber, 4))
  const ratedSpeed = Math.max(0, toProfileNumber(profile.ratedSpeed, 1750))
  const ratedCurrent = Math.max(0, toProfileNumber(profile.ratedCurrent, 30))
  const powerFactor = clamp(toProfileNumber(profile.powerFactor, 0.85), 0, 1)
  const efficiency = clamp(toProfileNumber(profile.efficiency, 90), 0, 100)
  const loadModel = getLoadModelOption(profile.loadModel).value
  const ns = (120 * ratedFrequency) / poleNumber
  const simulationNs = (120 * supplyFrequency) / poleNumber
  const ratedSlipCheck = evaluateRatedSpeedAgainstNs(ratedSpeed, ns)
  const simulationSlipCheck = evaluateRatedSpeedAgainstNs(ratedSpeed, simulationNs)
  const omega = ratedSpeed > 0 ? (2 * Math.PI * ratedSpeed) / 60 : 0
  const ratedTorque = omega > 0 ? (ratedPowerKw * 1000) / omega : 0
  const loadPercent = clamp(
    toProfileNumber(
      profile.loadPercent,
      calculateLoadPercent(profile.loadTorque, ratedTorque, 100),
    ),
    0,
    300,
  )
  const finalLoadTorque = calculateLoadTorqueFromPercent(loadPercent, ratedTorque)
  const inputEfficiency = Math.max(efficiency / 100, 0.001)
  const inputPowerFactor = Math.max(powerFactor, 0.001)
  const estimatedRatedCurrent =
    ratedVoltage > 0
      ? (ratedPowerKw * 1000) / (Math.sqrt(3) * ratedVoltage * inputPowerFactor * inputEfficiency)
      : 0
  const vpu = calculateVoltagePerUnit(supplyVoltage, ratedVoltage)
  const loadTorqueAtRatedSpeed = calculateLoadTorqueAtRatedSpeed(
    { ...profile, loadModel, finalLoadTorque, loadTorque: finalLoadTorque },
    ratedTorque,
  )
  const selectedLoadModel = getLoadModelOption(loadModel)
  const equivalentParameters = estimateEquivalentParameters(profile)

  return {
    ratedPowerKw,
    ratedVoltage,
    ratedFrequency,
    supplyVoltage,
    supplyFrequency,
    poleNumber,
    ratedSpeed,
    ratedCurrent,
    powerFactor,
    efficiency,
    loadModel,
    selectedLoadModel,
    equivalentParameters,
    ns: Number.isFinite(ns) ? ns : 0,
    simulationNs: Number.isFinite(simulationNs) ? simulationNs : 0,
    estimatedSlip: ratedSlipCheck.estimatedSlip,
    estimatedSlipPercent: ratedSlipCheck.slipPercent,
    estimatedSlipLabel: ratedSlipCheck.label,
    estimatedSlipIsValid: ratedSlipCheck.isValid,
    estimatedSlipStatus: ratedSlipCheck.status,
    estimatedSlipWarning: ratedSlipCheck.warning,
    simulationEstimatedSlip: simulationSlipCheck.estimatedSlip,
    simulationSlipPercent: simulationSlipCheck.slipPercent,
    simulationSlipLabel: simulationSlipCheck.label,
    simulationSlipIsValid: simulationSlipCheck.isValid,
    simulationSlipStatus: simulationSlipCheck.status,
    simulationSlipWarning: simulationSlipCheck.warning,
    ratedTorque: Number.isFinite(ratedTorque) ? ratedTorque : 0,
    loadPercent,
    finalLoadTorque,
    loadTorqueAtRatedSpeed: Number.isFinite(loadTorqueAtRatedSpeed)
      ? loadTorqueAtRatedSpeed
      : 0,
    estimatedRatedCurrent: Number.isFinite(estimatedRatedCurrent) ? estimatedRatedCurrent : 0,
    vpu,
    voltageCondition: getVoltageCondition(vpu),
  }
}

export function createSimulationParamsFromProfile(profile) {
  const preview = calculateRatedPreview(profile)
  const equivalentParameters = preview.equivalentParameters
  const poleNumber = Math.max(1, Math.round(preview.poleNumber))
  const baseLoadPercent = preview.loadPercent
  const baseLoadTorque = calculateLoadTorqueFromPercent(baseLoadPercent, preview.ratedTorque)
  const slipPercent = preview.simulationSlipIsValid
    ? preview.simulationSlipPercent
    : 3
  const thermalDefaults = estimateThermalDefaults(preview.ratedPowerKw)

  return {
    f: preview.supplyFrequency,
    poles: poleNumber,
    voltage: preview.supplyVoltage,
    ratedPowerKw: preview.ratedPowerKw,
    ratedPowerKwReference: preview.ratedPowerKw,
    ratedVoltage: preview.ratedVoltage,
    ratedVoltageReference: preview.ratedVoltage,
    ratedFrequency: preview.ratedFrequency,
    ratedFrequencyReference: preview.ratedFrequency,
    ratedSpeed: preview.ratedSpeed,
    ratedSpeedReference: preview.ratedSpeed,
    ratedCurrent: preview.ratedCurrent,
    ratedCurrentReference: preview.ratedCurrent,
    ratedTorque: preview.ratedTorque,
    ratedTorqueReference: preview.ratedTorque,
    powerFactor: preview.powerFactor,
    powerFactorReference: preview.powerFactor,
    efficiency: preview.efficiency,
    efficiencyReference: preview.efficiency,
    ratedSpeedStatus: preview.simulationSlipStatus,
    ratedSpeedWarning: preview.simulationSlipWarning,
    ratedSpeedEstimatedSlip: preview.simulationEstimatedSlip,
    loadModel: preview.loadModel,
    parameterMode: equivalentParameters.mode,
    parameterEstimationStatus: equivalentParameters.status,
    parameterEstimationNote: equivalentParameters.note,
    r1: equivalentParameters.params.r1,
    r2: equivalentParameters.params.r2,
    x1: equivalentParameters.params.x1,
    x2: equivalentParameters.params.x2,
    xm: equivalentParameters.params.xm,
    rc: equivalentParameters.params.rc,
    slipPercent,
    loadPercent: baseLoadPercent,
    loadTorque: baseLoadTorque,
    inertia: Math.max(0.0001, toProfileNumber(profile.inertiaJ, 0.05)),
    ...thermalDefaults,
  }
}
