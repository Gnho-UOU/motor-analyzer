import { clamp, formatCompact, toFiniteNumber } from './numberUtils.js'
import { calculateVoltagePerUnit, getVoltageCondition } from './voltageJudgment.js'

const makeWarning = (id, tone, message, detail, meta = {}) => ({
  id,
  tone,
  message,
  detail,
  ...meta,
})

function getSimulationState(motor) {
  if (motor.simulationState) return motor.simulationState
  if (motor.isCoastingDown) return 'coasting'
  if (motor.isMotorEnergized) return 'running'
  return 'standby'
}

function getTorqueMargin(loadTorque) {
  return Math.max(Math.abs(toFiniteNumber(loadTorque, 0)) * 0.01, 0.05)
}

function buildStateWarning({
  motor,
  simulationState,
  startingLoadTorque,
  startingTorque,
  operatingLoadTorque,
  torqueMargin,
}) {
  const speedRatio = motor.ns > 0 ? clamp(motor.nr / motor.ns, 0, 1.2) : 0
  const slipPercent = clamp(toFiniteNumber(motor.slipPercent, motor.slip * 100), 0, 100)
  const torqueReserve = toFiniteNumber(motor.torque, 0) - operatingLoadTorque
  const startingReserve = startingTorque - startingLoadTorque

  if (simulationState === 'prohibited') {
    return makeWarning(
      'state-prohibited',
      'danger',
      '운전 금지 상태 / Operation prohibited',
      '공급 조건이 보호 한계를 벗어나 START 및 정상 운전 판단을 중지합니다.',
    )
  }

  if (simulationState === 'standby') {
    return makeWarning(
      'state-standby-preview',
      'info',
      '대기 중: 정상 운전점 미리보기',
      `START 전 상태입니다. 예측 운전점은 ${formatCompact(motor.nr, 0)} rpm, 슬립 ${formatCompact(slipPercent, 2)}%, 부하 ${formatCompact(operatingLoadTorque, 1)} N·m입니다.`,
    )
  }

  if (simulationState === 'starting') {
    const tone = startingReserve < -torqueMargin ? 'danger' : speedRatio < 0.55 ? 'starting' : 'caution'
    const message = startingReserve < -torqueMargin
      ? '기동 중: 초기 토크 여유 부족'
      : speedRatio < 0.55
        ? '기동 중: 가속 구간'
        : '기동 중: 정격 속도 접근'

    return makeWarning(
      'state-starting',
      tone,
      message,
      `Nr/Ns ${formatCompact(speedRatio * 100, 1)}%, Te_start ${formatCompact(startingTorque, 1)} N·m, TL_start ${formatCompact(startingLoadTorque, 1)} N·m.`,
    )
  }

  if (simulationState === 'failed') {
    return makeWarning(
      'state-start-failed',
      'danger',
      '기동 실패 상태 / Startup failed',
      `기동 또는 가속 과정에서 토크 여유가 부족합니다. 초기 여유 ${formatCompact(startingReserve, 1)} N·m.`,
    )
  }

  if (simulationState === 'running') {
    const tone = torqueReserve < -torqueMargin
      ? 'danger'
      : slipPercent > 12 || speedRatio < 0.9
        ? 'caution'
        : 'normal'

    return makeWarning(
      'state-running',
      tone,
      tone === 'normal' ? '운전 중: 안정 운전' : '운전 중: 운전 여유 확인',
      `속도 ${formatCompact(motor.nr, 0)} rpm, 슬립 ${formatCompact(slipPercent, 2)}%, 토크 여유 ${formatCompact(torqueReserve, 1)} N·m.`,
    )
  }

  if (simulationState === 'coasting') {
    return makeWarning(
      'state-coasting',
      'off',
      '정지 명령: 관성 감속 중',
      `전원은 차단됐고 회전자는 ${formatCompact(motor.nr, 0)} rpm에서 부하와 마찰로 감속 중입니다.`,
    )
  }

  if (simulationState === 'emergency-stop') {
    return makeWarning(
      'state-emergency-stop',
      'danger',
      '비상 정지: 전원 차단 및 급감속',
      `비상 정지 상태입니다. 회전자는 ${formatCompact(motor.nr, 0)} rpm에서 빠르게 감속합니다.`,
    )
  }

  return makeWarning(
    'state-stopped',
    'off',
    '정지 상태 / Supply OFF',
    '전원과 회전자계가 꺼져 있으며 기동 또는 운전 경고는 비활성입니다.',
  )
}

export function getMotorWarnings(motor) {
  const simulationState = getSimulationState(motor)
  const voltageCondition =
    motor.voltageCondition ??
    getVoltageCondition(calculateVoltagePerUnit(motor.voltage, motor.ratedVoltageReference))
  const startingLoadTorque = Math.max(0, toFiniteNumber(motor.startingLoadTorque, motor.loadTorque))
  const operatingLoadTorque = Math.max(0, toFiniteNumber(motor.operatingLoadTorque, motor.loadTorque))
  const startingTorque = Math.max(0, toFiniteNumber(motor.startingTorque, 0))
  const operatingTorque = Math.max(0, toFiniteNumber(motor.torque, 0))
  const torqueMargin = getTorqueMargin(operatingLoadTorque)
  const startingTorqueInsufficient =
    motor.hasStartupTorqueReserve === false ||
    startingTorque + torqueMargin < startingLoadTorque
  const slip = clamp(toFiniteNumber(motor.slip, 0), 0, 1)
  const slipPercent = clamp(toFiniteNumber(motor.slipPercent, slip * 100), 0, 100)
  const speedRatio = motor.ns > 0 ? clamp(toFiniteNumber(motor.nr, 0) / motor.ns, 0, 1.2) : 0
  const vpuText = formatCompact((motor.vpu ?? 0) * 100, 1)
  const isStartupEvaluationState = simulationState === 'starting' || simulationState === 'failed'
  const isRunningEvaluationState = simulationState === 'running'
  const isSupplyOffState =
    simulationState === 'standby' ||
    simulationState === 'stopped' ||
    simulationState === 'coasting' ||
    simulationState === 'emergency-stop'

  const warnings = [
    buildStateWarning({
      motor,
      simulationState,
      startingLoadTorque,
      startingTorque,
      operatingLoadTorque,
      torqueMargin,
    }),
  ]

  const equivalentValues = [
    ['R1', motor.r1],
    ["R2'", motor.r2],
    ['X1', motor.x1],
    ["X2'", motor.x2],
    ['Xm', motor.xm],
    ['Rc', motor.rc],
  ]

  if (voltageCondition.isProhibited) {
    warnings.push(makeWarning(
      'overvoltage-prohibited',
      'danger',
      '전압 보호 한계 초과',
      `${voltageCondition.detail} Vpu = ${vpuText}%.`,
    ))
  } else if (motor.vpu > 1.2) {
    warnings.push(makeWarning(
      'danger-overvoltage',
      'danger',
      '위험 과전압: 절연 스트레스 증가',
      `${voltageCondition.detail} Vpu = ${vpuText}%.`,
    ))
  } else if (motor.vpu > 1.1) {
    warnings.push(makeWarning(
      'overvoltage-caution',
      'caution',
      '과전압 주의',
      `${voltageCondition.detail} Vpu = ${vpuText}%.`,
    ))
  } else if (motor.vpu < 0.8) {
    warnings.push(makeWarning(
      'severe-low-voltage',
      isStartupEvaluationState ? 'danger' : 'caution',
      '심한 저전압: 기동 여유 감소',
      `${voltageCondition.detail} Vpu = ${vpuText}%.`,
    ))
  } else if (motor.vpu < 0.9) {
    warnings.push(makeWarning(
      'low-voltage',
      'caution',
      '저전압 주의: 발생 토크 감소',
      `${voltageCondition.detail} Vpu = ${vpuText}%.`,
    ))
  }

  if (motor.ratedSpeedStatus && motor.ratedSpeedStatus !== 'ok') {
    warnings.push(makeWarning(
      'rated-speed-invalid',
      motor.ratedSpeedStatus === 'invalid-high-speed' ? 'danger' : 'caution',
      '정격 속도 입력 확인 필요',
      motor.ratedSpeedWarning || '정격 속도는 같은 주파수와 극수의 동기속도보다 낮아야 합니다.',
    ))
  }

  if (equivalentValues.some(([, value]) => !Number.isFinite(value) || value <= 0.0001)) {
    warnings.push(makeWarning(
      'equivalent-parameter-invalid',
      'danger',
      '등가회로 파라미터 이상',
      'R1, R2, X1, X2, Xm, Rc는 모두 0보다 큰 유한값이어야 합니다.',
    ))
  }

  if (motor.xm <= Math.max(motor.x1, motor.x2) * 1.5) {
    warnings.push(makeWarning(
      'xm-too-small',
      'caution',
      '자화 리액턴스 Xm 확인',
      'Xm이 누설 리액턴스와 너무 가까우면 여자전류와 토크 계산이 과도해질 수 있습니다.',
    ))
  }

  if (motor.parameterEstimationStatus === 'warning') {
    warnings.push(makeWarning(
      'parameter-estimation-warning',
      'caution',
      '등가회로 추정값 주의',
      motor.parameterEstimationNote,
    ))
  }

  if (motor.operatingPointMode === 'auto' && !motor.hasLoadIntersection && !isSupplyOffState) {
    warnings.push(makeWarning(
      'no-stable-operating-point',
      'danger',
      '안정 운전점 없음',
      '전동기 토크와 부하토크가 안정적으로 만나는 지점이 없어 정상 운전이 어렵습니다.',
    ))
  }

  if (motor.maxLoadTorque > motor.maxTorque + torqueMargin) {
    warnings.push(makeWarning(
      'load-exceeds-max-torque',
      'danger',
      '부하 곡선이 최대 토크를 초과',
      `부하곡선 최대 ${formatCompact(motor.maxLoadTorque, 1)} N·m > Tmax ${formatCompact(motor.maxTorque, 1)} N·m.`,
    ))
  }

  if (motor.loadModel === 'constant-power') {
    warnings.push(makeWarning(
      'constant-power-low-speed',
      startingTorqueInsufficient && isStartupEvaluationState ? 'danger' : 'caution',
      '정출력 부하: 저속 고토크 요구',
      '저속에서 요구 토크가 커질 수 있어 기동 여유를 확인해야 합니다.',
    ))
  }

  if (motor.loadModel === 'marine-propulsion' && motor.ratedLoadTorque > motor.maxTorque * 0.85) {
    warnings.push(makeWarning(
      'marine-high-speed-load',
      motor.ratedLoadTorque > motor.maxTorque ? 'danger' : 'caution',
      '선박 추진 부하: 고속 영역 토크 여유 주의',
      '프로펠러 부하는 속도 증가에 따라 요구 토크가 급격히 증가합니다.',
    ))
  }

  if (isStartupEvaluationState && startingTorqueInsufficient) {
    warnings.push(makeWarning(
      'startup-torque-low',
      'danger',
      '기동토크 부족',
      `Te_start ${formatCompact(startingTorque, 1)} N·m < TL_start ${formatCompact(startingLoadTorque, 1)} N·m.`,
    ))
  }

  if (isStartupEvaluationState && !startingTorqueInsufficient && speedRatio < 0.25) {
    warnings.push(makeWarning(
      'startup-breakaway-ok',
      'starting',
      '초기 기동 토크 여유 확보',
      `초기 여유 ${formatCompact(startingTorque - startingLoadTorque, 1)} N·m. 가속 응답을 감시 중입니다.`,
    ))
  }

  if (isRunningEvaluationState && slipPercent > 15) {
    warnings.push(makeWarning(
      'high-slip',
      slipPercent > 30 ? 'danger' : 'caution',
      '슬립 과다: 과부하 또는 속도 저하 가능성',
      `현재 슬립 ${formatCompact(slipPercent, 1)}%로 일반 운전 범위보다 큽니다.`,
    ))
  }

  if (isRunningEvaluationState && operatingTorque + torqueMargin < operatingLoadTorque) {
    warnings.push(makeWarning(
      'low-torque',
      'danger',
      '운전 토크 부족',
      `Te ${formatCompact(operatingTorque, 1)} N·m < TL ${formatCompact(operatingLoadTorque, 1)} N·m.`,
    ))
  }

  if (isRunningEvaluationState && speedRatio < 0.85) {
    warnings.push(makeWarning(
      'speed-drop',
      speedRatio < 0.7 ? 'danger' : 'caution',
      '속도 저하: 발열 증가 가능성',
      `Nr/Ns = ${formatCompact(speedRatio * 100, 1)}%로 동기속도와 차이가 큽니다.`,
    ))
  }

  if (isRunningEvaluationState && warnings.length === 1) {
    warnings.push(makeWarning(
      'normal-running-margin',
      'normal',
      '주요 운전 지표 안정',
      `전압 ${formatCompact(motor.vpu ?? 0, 3)} pu, 속도비 ${formatCompact(speedRatio * 100, 1)}%, 슬립 ${formatCompact(slipPercent, 2)}%.`,
    ))
  }

  return warnings
}

export function buildWarningSummary(warnings) {
  return warnings.map((warning) => `${warning.message} ${warning.detail}`).join(' / ')
}
