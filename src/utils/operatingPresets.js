import { clamp, toFiniteNumber, toProfileNumber } from './numberUtils.js'
import { calculateRatedTorque } from './loadModels.js'

const safePositive = (value, fallback = 0) => Math.max(0, toFiniteNumber(value, fallback))
const FALLBACK_RATED_SLIP = 0.03
const DEFAULT_LOAD_PERCENT = 100

function calculateRatedSynchronousSpeed(ratedFrequency, poleNumber) {
  const frequency = Math.max(0, toFiniteNumber(ratedFrequency, 0))
  const poles = Math.max(0, toFiniteNumber(poleNumber, 0))

  return frequency > 0 && poles > 0 ? (120 * frequency) / poles : 0
}

function calculateRatedSlip(ratedSpeed, ratedSynchronousSpeed) {
  const speed = Math.max(0, toFiniteNumber(ratedSpeed, 0))
  const ns = Math.max(0, toFiniteNumber(ratedSynchronousSpeed, 0))

  if (speed > 0 && ns > 0 && speed < ns) {
    return clamp((ns - speed) / ns, 0.001, 1)
  }

  return FALLBACK_RATED_SLIP
}

export function calculateLoadPercent(loadTorque, ratedTorque, fallback = DEFAULT_LOAD_PERCENT) {
  const rated = Math.max(0, toFiniteNumber(ratedTorque, 0))
  const torque = Math.max(0, toFiniteNumber(loadTorque, 0))

  if (rated <= 0) return clamp(toFiniteNumber(fallback, DEFAULT_LOAD_PERCENT), 0, 300)

  return clamp((torque / rated) * 100, 0, 300)
}

export function calculateLoadTorqueFromPercent(loadPercent, ratedTorque) {
  const percent = clamp(toFiniteNumber(loadPercent, DEFAULT_LOAD_PERCENT), 0, 300)
  const rated = Math.max(0, toFiniteNumber(ratedTorque, 0))
  const torque = rated * (percent / 100)

  return Number.isFinite(torque) ? Math.max(0, torque) : 0
}

export function getRatedDataFromProfile(profile = {}) {
  const ratedPowerKw = safePositive(toProfileNumber(profile.ratedPowerKw, profile.ratedPowerKwReference), 15)
  const ratedVoltage = Math.max(0.001, toProfileNumber(profile.ratedVoltage, profile.ratedVoltageReference ?? profile.voltage ?? 380))
  const ratedFrequency = Math.max(0.001, toProfileNumber(profile.ratedFrequency, profile.ratedFrequencyReference ?? profile.f ?? 60))
  const poleNumber = Math.max(1, toProfileNumber(profile.poleNumber, profile.poles ?? 4))
  const ratedSpeed = safePositive(toProfileNumber(profile.ratedSpeed, profile.ratedSpeedReference), 1750)
  const inertiaJ = Math.max(0.0001, toProfileNumber(profile.inertiaJ, profile.inertia ?? 0.05))
  const ratedTorque = calculateRatedTorque(ratedPowerKw, ratedSpeed)
  const ratedSynchronousSpeed = calculateRatedSynchronousSpeed(ratedFrequency, poleNumber)
  const ratedSlip = calculateRatedSlip(ratedSpeed, ratedSynchronousSpeed)

  return {
    ratedPowerKw,
    ratedVoltage,
    ratedFrequency,
    poleNumber,
    ratedSpeed,
    ratedTorque: ratedTorque > 0 ? ratedTorque : safePositive(profile.loadTorque, 10),
    ratedSynchronousSpeed,
    ratedSlip,
    inertiaJ,
    loadPercent: clamp(
      toProfileNumber(
        profile.loadPercent,
        calculateLoadPercent(profile.loadTorque, ratedTorque, DEFAULT_LOAD_PERCENT),
      ),
      0,
      300,
    ),
    loadModel: profile.loadModel || 'constant-torque',
  }
}

export function getRatedDataFromParams(params = {}) {
  const ratedPowerKw = safePositive(params.ratedPowerKwReference, 15)
  const ratedVoltage = Math.max(0.001, toFiniteNumber(params.ratedVoltageReference, params.voltage || 380))
  const ratedFrequency = Math.max(0.001, toFiniteNumber(params.ratedFrequencyReference, params.f || 60))
  const poleNumber = Math.max(1, toFiniteNumber(params.poles, 4))
  const ratedSpeed = safePositive(params.ratedSpeedReference, 1750)
  const ratedTorqueReference = safePositive(params.ratedTorqueReference, 0)
  const ratedTorque = ratedTorqueReference > 0
    ? ratedTorqueReference
    : calculateRatedTorque(ratedPowerKw, ratedSpeed)
  const ratedSynchronousSpeed = calculateRatedSynchronousSpeed(ratedFrequency, poleNumber)
  const ratedSlip = calculateRatedSlip(ratedSpeed, ratedSynchronousSpeed)

  return {
    ratedPowerKw,
    ratedVoltage,
    ratedFrequency,
    poleNumber,
    ratedSpeed,
    ratedTorque: ratedTorque > 0 ? ratedTorque : safePositive(params.loadTorque, 10),
    ratedSynchronousSpeed,
    ratedSlip,
    inertiaJ: Math.max(0.0001, toFiniteNumber(params.inertia, 0.05)),
    loadPercent: clamp(
      toFiniteNumber(
        params.loadPercent,
        calculateLoadPercent(params.loadTorque, ratedTorque, DEFAULT_LOAD_PERCENT),
      ),
      0,
      300,
    ),
    loadModel: params.loadModel || 'constant-torque',
  }
}

export function buildPresetValuesFromRatedData(ratedData) {
  const ratedTorque = Math.max(0, toFiniteNumber(ratedData.ratedTorque, 0))
  const ratedVoltage = Math.max(0.001, toFiniteNumber(ratedData.ratedVoltage, 380))
  const ratedFrequency = Math.max(0.001, toFiniteNumber(ratedData.ratedFrequency, 60))
  const inertiaJ = Math.max(0.0001, toFiniteNumber(ratedData.inertiaJ, 0.05))
  const ratedSlipPercent = clamp(toFiniteNumber(ratedData.ratedSlip, FALLBACK_RATED_SLIP) * 100, 0.1, 100)
  const loadModel = ratedData.loadModel || 'constant-torque'

  const makePreset = ({
    id,
    label,
    loadMultiplier,
    slipPercent = ratedSlipPercent,
    subtitle,
    summary,
    voltageMultiplier = 1,
  }) => ({
    id,
    label,
    subtitle,
    summary,
    detail: summary,
    values: {
      voltage: Number((ratedVoltage * voltageMultiplier).toFixed(3)),
      f: ratedFrequency,
      loadPercent: Number((loadMultiplier * 100).toFixed(3)),
      loadTorque: Number((ratedTorque * loadMultiplier).toFixed(3)),
      loadModel,
      inertia: inertiaJ,
      slipPercent,
    },
    ratedTorque,
    ratedSlip: toFiniteNumber(ratedData.ratedSlip, FALLBACK_RATED_SLIP),
    ratedSynchronousSpeed: toFiniteNumber(ratedData.ratedSynchronousSpeed, 0),
    torqueMultiplier: loadMultiplier,
    voltageMultiplier,
  })

  return {
    'no-load': makePreset({
      id: 'no-load',
      label: '무부하',
      subtitle: 'No-load',
      loadMultiplier: 0.05,
      slipPercent: 1,
      summary: '무부하 조건: 정격토크의 약 5% 부하만 적용합니다.',
    }),
    'rated-load': makePreset({
      id: 'rated-load',
      label: '정격부하',
      subtitle: 'Rated load',
      loadMultiplier: 1,
      summary: '정격부하 조건: 정격토크 기준으로 운전합니다.',
    }),
    overload: makePreset({
      id: 'overload',
      label: '과부하',
      subtitle: 'Overload',
      loadMultiplier: 1.5,
      slipPercent: 8,
      summary: '과부하 조건: 정격토크의 150% 부하를 적용합니다.',
    }),
    'low-voltage': makePreset({
      id: 'low-voltage',
      label: '저전압',
      subtitle: 'Low voltage',
      loadMultiplier: 1,
      voltageMultiplier: 0.8,
      summary: '저전압 조건: 정격전압의 80%를 공급합니다.',
    }),
    'high-slip': makePreset({
      id: 'high-slip',
      label: '고슬립',
      subtitle: 'High slip',
      loadMultiplier: 1.8,
      slipPercent: 18,
      summary: '고슬립 조건: 정격토크의 180% 부하를 적용합니다.',
    }),
  }
}

export function createOperatingPresetsFromMotorProfile(profile) {
  return buildPresetValuesFromRatedData(getRatedDataFromProfile(profile))
}

export function createOperatingPresetsFromParams(params) {
  return buildPresetValuesFromRatedData(getRatedDataFromParams(params))
}

export function getPresetForTestMode(testMode, presets, selectedPresetId = 'rated-load') {
  if (selectedPresetId === 'custom') return null

  const mappedPresetId = {
    'no-load': 'no-load',
    'rated-load': 'rated-load',
    overload: 'overload',
    'low-voltage-startup': 'low-voltage',
    startup: 'rated-load',
    'load-variation': 'rated-load',
    'emergency-stop': 'rated-load',
    'torque-speed': selectedPresetId && selectedPresetId !== 'custom' ? selectedPresetId : 'rated-load',
  }[testMode] ?? selectedPresetId ?? 'rated-load'

  return presets[mappedPresetId] ?? presets['rated-load']
}

export function applyOperatingPresetToParams(params, preset) {
  if (!preset) return params
  const ratedTorque = Math.max(0, toFiniteNumber(preset.ratedTorque, params.ratedTorqueReference))
  const loadPercent = clamp(
    toFiniteNumber(
      preset.values.loadPercent,
      calculateLoadPercent(preset.values.loadTorque, ratedTorque, params.loadPercent),
    ),
    0,
    300,
  )
  const loadTorque = calculateLoadTorqueFromPercent(loadPercent, ratedTorque)

  return {
    ...params,
    voltage: Math.max(0, toFiniteNumber(preset.values.voltage, params.voltage)),
    f: Math.max(0.001, toFiniteNumber(preset.values.f, params.f)),
    loadPercent,
    loadTorque,
    loadModel: preset.values.loadModel || params.loadModel || 'constant-torque',
    inertia: Math.max(0.0001, toFiniteNumber(preset.values.inertia, params.inertia)),
    slipPercent: clamp(toFiniteNumber(preset.values.slipPercent, params.slipPercent), 0, 100),
    ratedTorqueReference: ratedTorque,
  }
}
