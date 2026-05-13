import { clamp, toFiniteNumber } from './numberUtils.js'

const safePositive = (value, fallback = 0) => Math.max(0, toFiniteNumber(value, fallback))

const wattsToKw = (watts) => safePositive(watts) / 1000

export function calculateLossEfficiency(motor, displayedMotor = motor) {
  const speedRpm = safePositive(displayedMotor?.nr ?? motor?.nr)
  const torqueNm = safePositive(displayedMotor?.torque ?? motor?.torque)
  const isEnergized = Boolean(displayedMotor?.isMotorEnergized)
  const slip = clamp(toFiniteNumber(displayedMotor?.slip ?? motor?.slip, 0), 0, 0.98)
  const ratedPowerW = Math.max(1, safePositive(motor?.ratedPowerKwReference, 0) * 1000)
  const ratedSpeedRpm = Math.max(1, safePositive(motor?.ratedSpeedReference, speedRpm || 1))
  const ratedCurrent = safePositive(motor?.ratedCurrentReference, 0)
  const omega = (2 * Math.PI * speedRpm) / 60
  const outputPowerW = isEnergized ? safePositive(torqueNm * omega) : 0
  const loadRatio = clamp(outputPowerW / ratedPowerW, 0, 2.5)
  const measuredCurrentRms = safePositive(displayedMotor?.currentPeak, 0) / Math.SQRT2
  const estimatedCurrentRms = ratedCurrent > 0
    ? ratedCurrent * clamp(Math.sqrt(Math.max(loadRatio, 0.04)), 0.2, 2.2)
    : 0
  const inputCurrentRms = isEnergized
    ? measuredCurrentRms > 0.001 ? measuredCurrentRms : estimatedCurrentRms
    : 0
  const isCurrentEstimated = isEnergized && measuredCurrentRms <= 0.001 && estimatedCurrentRms > 0
  const r1 = Math.max(0.0001, toFiniteNumber(motor?.r1, 0.0001))
  const rc = toFiniteNumber(motor?.rc, 0)
  const voltage = safePositive(motor?.voltage, 0)
  const vPhase = voltage / Math.sqrt(3)
  const statorCopperLossW = safePositive(3 * inputCurrentRms * inputCurrentRms * r1)
  const rotorCopperLossW = outputPowerW > 0 && slip > 0 && slip < 0.98
    ? safePositive((slip / Math.max(1 - slip, 0.02)) * outputPowerW)
    : 0
  const coreLossFromRcW = rc > 0.001 ? safePositive((3 * vPhase * vPhase) / rc) : 0
  const fallbackCoreLossW = 0.015 * ratedPowerW * clamp(voltage / Math.max(motor?.ratedVoltageReference ?? voltage, 1), 0, 1.6) ** 2
  const coreLossW = isEnergized ? coreLossFromRcW > 0 ? coreLossFromRcW : fallbackCoreLossW : 0
  const speedRatio = clamp(speedRpm / ratedSpeedRpm, 0, 1.5)
  const mechanicalLossW = isEnergized ? safePositive(0.02 * ratedPowerW * speedRatio ** 1.5) : 0
  const copperLossW = statorCopperLossW + rotorCopperLossW
  const totalLossW = statorCopperLossW + rotorCopperLossW + coreLossW + mechanicalLossW
  const inputPowerW = outputPowerW + totalLossW
  const efficiency = inputPowerW > 0 ? clamp((outputPowerW / inputPowerW) * 100, 0, 100) : 0
  const hasValidOperatingPoint = motor?.operatingPointMode !== 'auto' || Boolean(motor?.hasLoadIntersection)
  const isStopped = !isEnergized || speedRpm <= 1 || outputPowerW <= 0
  const warnings = []

  if (isStopped) {
    warnings.push('모터가 정지 또는 무전원 상태이므로 효율 계산은 참고용입니다.')
  }

  if (!hasValidOperatingPoint) {
    warnings.push('안정 운전점이 없어 손실 및 효율 계산의 신뢰도가 낮습니다.')
  }

  if (!isStopped && efficiency > 0 && efficiency < 75) {
    warnings.push('효율이 낮습니다. 부하 조건, 전압, 등가회로 파라미터를 확인하세요.')
  }

  if (!isStopped && outputPowerW > 0 && copperLossW / Math.max(outputPowerW, 1) > 0.25) {
    warnings.push('동손 비중이 큽니다. 전류 또는 저항 값이 과도할 수 있습니다.')
  }

  if (isCurrentEstimated) {
    warnings.push('상세 입력전류 대신 정격전류와 부하율 기반 추정 전류를 사용했습니다.')
  }

  return {
    outputPowerW,
    outputPowerKw: wattsToKw(outputPowerW),
    statorCopperLossW,
    statorCopperLossKw: wattsToKw(statorCopperLossW),
    rotorCopperLossW,
    rotorCopperLossKw: wattsToKw(rotorCopperLossW),
    copperLossW,
    copperLossKw: wattsToKw(copperLossW),
    coreLossW,
    coreLossKw: wattsToKw(coreLossW),
    mechanicalLossW,
    mechanicalLossKw: wattsToKw(mechanicalLossW),
    totalLossW,
    totalLossKw: wattsToKw(totalLossW),
    inputPowerW,
    inputPowerKw: wattsToKw(inputPowerW),
    efficiency,
    inputCurrentRms,
    isCurrentEstimated,
    isStopped,
    hasValidOperatingPoint,
    warnings,
    breakdown: [
      { key: 'output', label: '출력', valueW: outputPowerW, tone: 'output' },
      { key: 'copper', label: '동손', valueW: copperLossW, tone: 'copper' },
      { key: 'core', label: '철손', valueW: coreLossW, tone: 'core' },
      { key: 'mechanical', label: '기계손', valueW: mechanicalLossW, tone: 'mechanical' },
    ],
  }
}
