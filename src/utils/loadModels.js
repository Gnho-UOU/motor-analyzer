import { DEFAULT_PARAMS } from '../data/defaultParams.js'
import { LOAD_MODEL_OPTIONS } from '../data/motorOptions.js'
import { clamp, toFiniteNumber, toProfileNumber } from './numberUtils.js'

export function getLoadModelOption(value) {
  return LOAD_MODEL_OPTIONS.find((item) => item.value === value) ?? LOAD_MODEL_OPTIONS[0]
}

export function getLoadModelLabel(value) {
  const option = getLoadModelOption(value)
  return `${option.label} / ${option.subtitle}`
}

export function calculateRatedTorque(ratedPowerKw, ratedSpeedRpm) {
  const powerW = Math.max(0, toFiniteNumber(ratedPowerKw, 0)) * 1000
  const speed = Math.max(0, toFiniteNumber(ratedSpeedRpm, 0))
  if (powerW <= 0 || speed <= 0) return 0
  const omega = (2 * Math.PI * speed) / 60
  const torque = omega > 0 ? powerW / omega : 0

  return Number.isFinite(torque) ? Math.max(0, torque) : 0
}

export function calculateLoadTorqueAtSpeed(speedRpm, {
  loadModel,
  selectedLoadTorque,
  finalLoadTorque,
  ratedPowerKw,
  ratedSpeedRpm,
  ratedTorque,
} = {}) {
  const model = loadModel === 'custom' ? 'custom' : getLoadModelOption(loadModel).value
  const referenceTorque = Math.max(0, toFiniteNumber(ratedTorque, 0))
  const fallbackTorque = Math.max(
    0,
    toFiniteNumber(finalLoadTorque ?? selectedLoadTorque, referenceTorque),
  )
  const ratedSpeed = Math.max(1, toFiniteNumber(ratedSpeedRpm, DEFAULT_PARAMS.ratedSpeedReference))
  const speed = Math.max(0, toFiniteNumber(speedRpm, 0))
  const speedRatio = clamp(speed / ratedSpeed, 0, 1.2)
  const ratedOmega = (2 * Math.PI * ratedSpeed) / 60
  const ratedPowerFromTorque = fallbackTorque * ratedOmega
  const ratedPowerFromNameplate = Math.max(0, toFiniteNumber(ratedPowerKw, 0)) * 1000
  const constantPowerW = ratedPowerFromTorque > 0 ? ratedPowerFromTorque : ratedPowerFromNameplate
  const maxLowSpeedTorque = Math.max(referenceTorque * 6, fallbackTorque * 6, 1)
  let torque = fallbackTorque

  if (model === 'fan-pump') {
    torque = fallbackTorque * speedRatio ** 2
  } else if (model === 'constant-power') {
    const lowSpeedClampRpm = Math.max(speed, ratedSpeed * 0.05)
    const omega = (2 * Math.PI * lowSpeedClampRpm) / 60
    torque = omega > 0 ? constantPowerW / omega : maxLowSpeedTorque
    torque = Math.min(torque, maxLowSpeedTorque)
  } else if (model === 'marine-propulsion') {
    torque = fallbackTorque * speedRatio ** 2.5
  }

  return Number.isFinite(torque) ? Math.max(0, torque) : 0
}

export function createLoadTorqueCalculator(loadSettings = {}) {
  return (speedRpm) => calculateLoadTorqueAtSpeed(speedRpm, loadSettings)
}

export function calculateLoadTorqueAtRatedSpeed(profile, ratedTorque) {
  const model = profile.loadModel === 'custom' ? 'custom' : getLoadModelOption(profile.loadModel).value
  const ratedSpeed = Math.max(0.001, toProfileNumber(profile.ratedSpeed, 1750))
  const loadTorque = Math.max(0, toProfileNumber(profile.finalLoadTorque ?? profile.loadTorque, ratedTorque))
  const calculator = createLoadTorqueCalculator({
    loadModel: model,
    selectedLoadTorque: loadTorque,
    ratedPowerKw: toProfileNumber(profile.ratedPowerKw, 15),
    ratedSpeedRpm: ratedSpeed,
    ratedTorque,
  })

  return calculator(ratedSpeed)
}
