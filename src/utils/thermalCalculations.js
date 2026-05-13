import { clamp, toFiniteNumber } from './numberUtils.js'

const THERMAL_COOLING_MODES = {
  'self-ventilated': {
    label: '자냉식 팬 냉각 / Self-ventilated fan cooling',
    naturalCooling: 0.25,
    forcedCooling: 0.75,
    fanExponent: 1.5,
  },
  'forced-blower': {
    label: '강제 송풍 냉각 / Forced external blower',
    naturalCooling: 0.3,
    forcedCooling: 0.9,
    fanExponent: 0,
  },
  natural: {
    label: '자연 냉각 / Natural cooling only',
    naturalCooling: 0.25,
    forcedCooling: 0,
    fanExponent: 1.5,
  },
}

export function estimateThermalDefaults(ratedPowerKw) {
  const powerKw = Math.max(0.1, toFiniteNumber(ratedPowerKw, 15))

  return {
    ambientTemperature: 25,
    thermalResistance: clamp(0.12 / Math.sqrt(powerKw), 0.005, 0.12),
    thermalCapacitance: clamp(15000 + powerKw * 1000, 30000, 2500000),
    maxWindingTemperature: 120,
    coolingMode: 'self-ventilated',
  }
}

function estimateRatedLossPowerW(params = {}) {
  const ratedPowerW = Math.max(1, toFiniteNumber(params.ratedPowerKwReference, 15) * 1000)
  const efficiency = clamp(toFiniteNumber(params.efficiencyReference, 90) / 100, 0.5, 0.98)
  const ratedLossRatio = clamp((1 / efficiency) - 1, 0.025, 0.18)

  return ratedPowerW * ratedLossRatio
}

function calculateRatedThermalCalibration(params = {}) {
  const ambient = toFiniteNumber(params.ambientTemperature, 25)
  const maxWindingTemperature = Math.max(ambient + 10, toFiniteNumber(params.maxWindingTemperature, 120))
  const allowableRise = Math.max(10, maxWindingTemperature - ambient)
  const targetRatedTemperatureRise = Math.min(
    clamp(allowableRise * 0.58, 20, 75),
    allowableRise * 0.72,
  )
  const ratedLossPowerW = estimateRatedLossPowerW(params)
  const ratedEffectiveThermalResistance = targetRatedTemperatureRise / Math.max(ratedLossPowerW, 1)

  return {
    ratedEffectiveThermalResistance,
    ratedLossPowerW,
    targetRatedTemperatureRise,
  }
}

function calculateThermalLossPower({ displayedMotor, lossAnalysis, params, thermalCalibration }) {
  const isHeating = Boolean(displayedMotor?.isMotorEnergized) && !displayedMotor?.voltageCondition?.isProhibited
  if (!isHeating) {
    return {
      isLimited: false,
      referenceLossPowerW: 0,
      rawLossPowerW: 0,
      thermalLossPowerW: 0,
    }
  }

  const rawLossPowerW = Math.max(0, toFiniteNumber(lossAnalysis?.totalLossW, 0))
  const ratedPowerW = Math.max(1, toFiniteNumber(params?.ratedPowerKwReference, 15) * 1000)
  const outputPowerW = Math.max(0, toFiniteNumber(lossAnalysis?.outputPowerW, 0))
  const ratedLossPowerW = Math.max(1, thermalCalibration.ratedLossPowerW)
  const loadRatio = clamp(outputPowerW / ratedPowerW, 0, 2.5)
  const fixedLossShare = 0.38
  const referenceLossPowerW = ratedLossPowerW *
    (fixedLossShare + (1 - fixedLossShare) * (loadRatio ** 2))
  const vpu = toFiniteNumber(displayedMotor?.vpu, 1)
  const voltageStress = clamp(1 + Math.max(0, Math.abs(vpu - 1) - 0.05) * 2.4, 1, 1.8)
  const isStarting = displayedMotor?.simulationState === 'starting'
  const lossLimitMultiplier = isStarting ? 6 : 1.3
  const thermalLossLimitW = Math.max(ratedLossPowerW * 0.25, referenceLossPowerW * voltageStress * lossLimitMultiplier)
  const thermalLossPowerW = Math.min(rawLossPowerW, thermalLossLimitW)

  return {
    isLimited: thermalLossPowerW + 0.001 < rawLossPowerW,
    referenceLossPowerW,
    rawLossPowerW,
    thermalLossPowerW,
  }
}

export function sanitizeThermalParams(params = {}) {
  const defaults = estimateThermalDefaults(params.ratedPowerKwReference)
  const coolingMode = THERMAL_COOLING_MODES[params.coolingMode]
    ? params.coolingMode
    : 'self-ventilated'

  return {
    ambientTemperature: clamp(
      toFiniteNumber(params.ambientTemperature, defaults.ambientTemperature),
      -20,
      80,
    ),
    thermalResistance: clamp(
      toFiniteNumber(params.thermalResistance, defaults.thermalResistance),
      0.001,
      1,
    ),
    thermalCapacitance: clamp(
      toFiniteNumber(params.thermalCapacitance, defaults.thermalCapacitance),
      1000,
      2000000,
    ),
    maxWindingTemperature: clamp(
      toFiniteNumber(params.maxWindingTemperature, defaults.maxWindingTemperature),
      40,
      220,
    ),
    coolingMode,
  }
}

export function calculateCoolingState({
  ambientTemperature,
  coolingMode = 'self-ventilated',
  currentTemperature,
  ratedEffectiveThermalResistance,
  ratedSpeedRpm,
  rotorSpeedRpm,
  thermalResistance,
}) {
  const ambient = toFiniteNumber(ambientTemperature, 25)
  const current = Math.max(-50, toFiniteNumber(currentTemperature, ambient))
  const rth = Math.max(0.001, toFiniteNumber(thermalResistance, 0.08))
  const ratedSpeed = Math.max(1, Math.abs(toFiniteNumber(ratedSpeedRpm, 1800)))
  const rotorSpeed = Math.abs(toFiniteNumber(rotorSpeedRpm, 0))
  const speedRatio = clamp(rotorSpeed / ratedSpeed, 0, 1.2)
  const mode = THERMAL_COOLING_MODES[coolingMode] ?? THERMAL_COOLING_MODES['self-ventilated']
  const fanCoolingFactor = clamp(
    mode.naturalCooling + mode.forcedCooling * (speedRatio ** mode.fanExponent),
    0.1,
    3,
  )
  const ratedFanCoolingFactor = clamp(
    mode.naturalCooling + mode.forcedCooling,
    0.1,
    3,
  )
  const calibratedBaseThermalResistance = toFiniteNumber(ratedEffectiveThermalResistance, 0) > 0
    ? toFiniteNumber(ratedEffectiveThermalResistance, 0) * ratedFanCoolingFactor
    : Number.POSITIVE_INFINITY
  const baseThermalResistance = Math.min(rth, calibratedBaseThermalResistance)
  const effectiveThermalResistance = Math.max(0.0001, baseThermalResistance / fanCoolingFactor)
  const coolingPowerW = Math.max(0, (current - ambient) / effectiveThermalResistance)

  return {
    baseThermalResistance,
    calibratedBaseThermalResistance,
    coolingMode,
    coolingModeLabel: mode.label,
    coolingPowerW,
    effectiveThermalResistance,
    fanCoolingFactor,
    speedRatio,
  }
}

export function stepThermalModel({
  ambientTemperature,
  coolingMode,
  currentTemperature,
  dtSeconds,
  efficiencyReference,
  lossPowerW,
  ratedSpeedRpm,
  ratedPowerKwReference,
  rotorSpeedRpm,
  maxWindingTemperature,
  thermalCapacitance,
  thermalResistance,
}) {
  const ambient = toFiniteNumber(ambientTemperature, 25)
  const current = Math.max(-50, toFiniteNumber(currentTemperature, ambient))
  const dt = clamp(toFiniteNumber(dtSeconds, 1), 0, 60)
  const loss = Math.max(0, toFiniteNumber(lossPowerW, 0))
  const cth = Math.max(1000, toFiniteNumber(thermalCapacitance, 25000))
  const thermalCalibration = calculateRatedThermalCalibration({
    ambientTemperature: ambient,
    efficiencyReference,
    maxWindingTemperature,
    ratedPowerKwReference,
  })
  const cooling = calculateCoolingState({
    ambientTemperature: ambient,
    coolingMode,
    currentTemperature: current,
    ratedEffectiveThermalResistance: thermalCalibration.ratedEffectiveThermalResistance,
    ratedSpeedRpm,
    rotorSpeedRpm,
    thermalResistance,
  })
  const dtdt = (loss - cooling.coolingPowerW) / cth
  const nextTemperature = current + dt * dtdt
  const boundedTemperature = loss <= 0 && current >= ambient
    ? Math.max(ambient, nextTemperature)
    : nextTemperature

  return Number.isFinite(boundedTemperature) ? Math.max(-50, boundedTemperature) : ambient
}

export function getThermalStatus(temperature, maxTemperature) {
  const windingTemperature = toFiniteNumber(temperature, 25)
  const maxWindingTemperature = Math.max(1, toFiniteNumber(maxTemperature, 120))
  const utilization = clamp((windingTemperature / maxWindingTemperature) * 100, 0, 250)

  if (windingTemperature >= maxWindingTemperature) {
    return {
      label: 'Trip 권장',
      subtitle: 'Thermal trip recommended',
      tone: 'danger',
      utilization,
    }
  }

  if (windingTemperature >= 0.95 * maxWindingTemperature) {
    return {
      label: '과열 위험',
      subtitle: 'Overheating risk',
      tone: 'danger',
      utilization,
    }
  }

  if (windingTemperature >= 0.8 * maxWindingTemperature) {
    return {
      label: '주의',
      subtitle: 'Thermal caution',
      tone: 'caution',
      utilization,
    }
  }

  return {
    label: '정상',
    subtitle: 'Normal thermal range',
    tone: 'normal',
    utilization,
  }
}

export function buildThermalProjection({
  ambientTemperature,
  coolingMode,
  currentTemperature,
  efficiencyReference,
  lossPowerW,
  maxWindingTemperature,
  ratedPowerKwReference,
  ratedSpeedRpm,
  rotorSpeedRpm,
  thermalCapacitance,
  thermalResistance,
}) {
  const data = []
  let temperature = Math.max(
    -50,
    toFiniteNumber(currentTemperature, toFiniteNumber(ambientTemperature, 25)),
  )
  const dt = 60
  const thermalCalibration = calculateRatedThermalCalibration({
    ambientTemperature,
    efficiencyReference,
    maxWindingTemperature,
    ratedPowerKwReference,
  })

  for (let time = 0; time <= 3600; time += dt) {
    const cooling = calculateCoolingState({
      ambientTemperature,
      coolingMode,
      currentTemperature: temperature,
      ratedEffectiveThermalResistance: thermalCalibration.ratedEffectiveThermalResistance,
      ratedSpeedRpm,
      rotorSpeedRpm,
      thermalResistance,
    })
    const steadyStateTemperature = toFiniteNumber(ambientTemperature, 25)
      + Math.max(0, toFiniteNumber(lossPowerW, 0)) * cooling.effectiveThermalResistance

    data.push({
      time,
      ambientTemperature,
      maxWindingTemperature,
      steadyStateTemperature,
      windingTemperature: temperature,
    })
    temperature = stepThermalModel({
      ambientTemperature,
      coolingMode,
      currentTemperature: temperature,
      dtSeconds: dt,
      efficiencyReference,
      lossPowerW,
      maxWindingTemperature,
      ratedPowerKwReference,
      ratedSpeedRpm,
      rotorSpeedRpm,
      thermalCapacitance,
      thermalResistance,
    })
  }

  return data
}

export function buildThermalAnalysis({ displayedMotor, lossAnalysis, params, windingTemperature }) {
  const thermalParams = sanitizeThermalParams(params)
  const thermalCalibration = calculateRatedThermalCalibration({
    ...thermalParams,
    efficiencyReference: params?.efficiencyReference,
    ratedPowerKwReference: params?.ratedPowerKwReference,
  })
  const thermalLoss = calculateThermalLossPower({
    displayedMotor,
    lossAnalysis,
    params,
    thermalCalibration,
  })
  const isHeating = thermalLoss.thermalLossPowerW > 0
  const totalLossW = thermalLoss.thermalLossPowerW
  const rotorSpeedRpm = Math.max(0, toFiniteNumber(displayedMotor?.nr, 0))
  const ratedSpeedRpm = Math.max(
    1,
    toFiniteNumber(params?.ratedSpeedReference, displayedMotor?.ratedSpeedReference ?? 1800),
  )
  const temperature = Math.max(
    -50,
    toFiniteNumber(windingTemperature, thermalParams.ambientTemperature),
  )
  const cooling = calculateCoolingState({
    ...thermalParams,
    currentTemperature: temperature,
    ratedEffectiveThermalResistance: thermalCalibration.ratedEffectiveThermalResistance,
    ratedSpeedRpm,
    rotorSpeedRpm,
  })
  const steadyStateTemperature = thermalParams.ambientTemperature
    + totalLossW * cooling.effectiveThermalResistance
  const temperatureRise = Math.max(0, temperature - thermalParams.ambientTemperature)
  const status = getThermalStatus(temperature, thermalParams.maxWindingTemperature)
  const graphData = buildThermalProjection({
    ...thermalParams,
    currentTemperature: temperature,
    efficiencyReference: params?.efficiencyReference,
    lossPowerW: totalLossW,
    ratedPowerKwReference: params?.ratedPowerKwReference,
    ratedSpeedRpm,
    rotorSpeedRpm,
  })

  return {
    ...thermalParams,
    calibratedBaseThermalResistance: cooling.calibratedBaseThermalResistance,
    coolingModeLabel: cooling.coolingModeLabel,
    coolingPowerW: cooling.coolingPowerW,
    coolingPowerKw: cooling.coolingPowerW / 1000,
    effectiveThermalResistance: cooling.effectiveThermalResistance,
    fanCoolingFactor: cooling.fanCoolingFactor,
    isThermalResistanceLimited: cooling.baseThermalResistance < thermalParams.thermalResistance,
    ratedEffectiveThermalResistance: thermalCalibration.ratedEffectiveThermalResistance,
    rawLossPowerW: thermalLoss.rawLossPowerW,
    rawLossPowerKw: thermalLoss.rawLossPowerW / 1000,
    referenceLossPowerW: thermalLoss.referenceLossPowerW,
    referenceLossPowerKw: thermalLoss.referenceLossPowerW / 1000,
    ratedLossPowerW: thermalCalibration.ratedLossPowerW,
    ratedLossPowerKw: thermalCalibration.ratedLossPowerW / 1000,
    targetRatedTemperatureRise: thermalCalibration.targetRatedTemperatureRise,
    isThermalLossLimited: thermalLoss.isLimited,
    windingTemperature: temperature,
    ratedSpeedRpm,
    rotorSpeedRpm,
    speedRatio: cooling.speedRatio,
    steadyStateTemperature,
    temperatureRise,
    thermalUtilization: status.utilization,
    thermalStatus: status,
    totalLossW,
    totalLossKw: totalLossW / 1000,
    isHeating,
    graphData,
  }
}

export function buildThermalWarnings(thermal) {
  if (!thermal) return []

  if (thermal.thermalStatus.label === 'Trip 권장') {
    return [{
      id: 'thermal-trip-recommended',
      tone: 'danger',
      message: '열적 Trip 권장',
      detail: `권선온도 ${thermal.windingTemperature.toFixed(1)} °C가 허용온도 ${thermal.maxWindingTemperature.toFixed(1)} °C 이상입니다.`,
    }]
  }

  if (thermal.thermalStatus.label === '과열 위험') {
    return [{
      id: 'thermal-overheat-risk',
      tone: 'danger',
      message: '과열 위험',
      detail: `권선온도 ${thermal.windingTemperature.toFixed(1)} °C가 허용온도에 근접했습니다.`,
    }]
  }

  if (thermal.thermalStatus.label === '주의') {
    return [{
      id: 'thermal-caution',
      tone: 'caution',
      message: '권선온도 주의',
      detail: `열 이용률 ${thermal.thermalUtilization.toFixed(1)}%입니다. 연속 운전 조건을 확인하세요.`,
    }]
  }

  return []
}
