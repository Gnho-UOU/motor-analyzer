import { useState } from 'react'
import { formatCompact, toFiniteNumber, toProfileNumber } from '../../utils/numberUtils.js'
import { calculateVoltagePerUnit, getVoltageCondition } from '../../utils/voltageJudgment.js'
import { getLoadModelLabel } from '../../utils/loadModels.js'
import {
  calculateRatedPreview,
  getManufacturerLabel,
  getMotorTypeLabel,
  getParameterModeLabel,
  getTestModeOption,
} from '../../utils/motorCalculations.js'

export function TestSessionHeader({
  isGeneratingReport,
  motor,
  onEditSetup,
  onGenerateReport,
  onNewTest,
  reportStatus,
  testProfile,
}) {
  const [showDetails, setShowDetails] = useState(false)
  const selectedMode = getTestModeOption(testProfile.testMode)
  const preview = calculateRatedPreview(testProfile)
  const ratedVoltage = motor?.ratedVoltageReference ?? preview.ratedVoltage
  const supplyVoltage = motor?.voltage ?? preview.supplyVoltage
  const ratedFrequency = motor?.ratedFrequencyReference ?? preview.ratedFrequency
  const supplyFrequency = motor?.f ?? preview.supplyFrequency
  const vpu = motor?.vpu ?? calculateVoltagePerUnit(supplyVoltage, ratedVoltage)
  const voltageCondition = motor?.voltageCondition ?? getVoltageCondition(vpu)
  const poles = motor?.poles ?? preview.poleNumber
  const ratedSpeed = motor?.ratedSpeedReference ?? preview.ratedSpeed
  const synchronousSpeed = motor?.ns ?? preview.simulationNs
  const slipLabel =
    motor?.ratedSpeedStatus === 'ok'
      ? `${formatCompact((motor?.ratedSpeedEstimatedSlip ?? preview.simulationEstimatedSlip) * 100, 2)} %`
      : motor?.ratedSpeedSlipLabel ?? preview.simulationSlipLabel
  const loadTorque = motor?.loadTorque ?? toProfileNumber(testProfile.loadTorque, 0)
  const inertia = motor?.inertia ?? toProfileNumber(testProfile.inertiaJ, 0)
  const manufacturer = getManufacturerLabel(testProfile)
  const motorType = getMotorTypeLabel(testProfile)
  const actionGuide =
    testProfile.testMode === 'startup'
      ? 'START 버튼을 눌러 0 rpm에서 정상 속도까지의 기동 응답을 확인하세요.'
      : testProfile.testMode === 'emergency-stop'
        ? 'START 후 EMERGENCY STOP 버튼으로 비상정지 동작을 확인하세요.'
        : selectedMode.description

  const compactItems = [
    ['Manufacturer', manufacturer],
    ['Motor Type', motorType],
    ['Rated Power', `${formatCompact(toFiniteNumber(testProfile.ratedPowerKw, 0), 1)} kW`],
    ['Supply Voltage', `${formatCompact(supplyVoltage, 0)} V`],
    ['Frequency', `${formatCompact(supplyFrequency, 0)} Hz`],
    ['Test Mode', `${selectedMode.label} / ${selectedMode.subtitle}`],
    ['Vpu Condition', `${formatCompact(vpu, 3)} pu · ${voltageCondition.label}`],
  ]

  const sessionItems = [
    ['사용자 / User', testProfile.userName || '-'],
    ['소속 / Organization', testProfile.organization || '-'],
    ['프로젝트 / Project', testProfile.projectName || '-'],
    ['제조사 / Manufacturer', manufacturer],
    ['전동기 유형 / Motor Type', motorType],
    ['정격 출력 / Rated Power', `${formatCompact(toFiniteNumber(testProfile.ratedPowerKw, 0), 1)} kW`],
    ['정격 전압 / Rated Voltage', `${formatCompact(ratedVoltage, 0)} V`],
    ['공급 전압 / Supply Voltage', `${formatCompact(supplyVoltage, 0)} V`],
    ['Vpu / Voltage PU', `${formatCompact(vpu, 3)} pu · ${voltageCondition.label}`],
    ['Rated/Supply Frequency', `${formatCompact(ratedFrequency, 0)} / ${formatCompact(supplyFrequency, 0)} Hz`],
    ['극수 / Pole Number', `${formatCompact(poles, 0)} P`],
    ['정격속도 / Rated Speed', `${formatCompact(ratedSpeed, 0)} rpm`],
    ['동기속도 / Synchronous Speed', `${formatCompact(synchronousSpeed, 0)} rpm`],
    ['추정 슬립 / Estimated Slip', slipLabel],
    ['부하 모델 / Load Model', motor?.loadModelLabel ?? getLoadModelLabel(testProfile.loadModel)],
    ['부하토크 / Load Torque', `${formatCompact(loadTorque, 2)} N·m`],
    ['관성 J / Inertia J', `${formatCompact(inertia, 4)} kg·m²`],
    ['파라미터 방식 / Parameter Mode', motor?.parameterModeLabel ?? getParameterModeLabel(testProfile.parameterMode)],
    ['시험 목적 / Test Mode', `${selectedMode.label} / ${selectedMode.subtitle}`],
    ['시험 날짜 / Test Date', testProfile.testDate || '-'],
  ]

  return (
    <section className={`test-session-header ${showDetails ? 'is-expanded' : 'is-compact'}`}>
      <div className="test-session-topline">
        <div className="test-session-title">
          <span className="eyebrow">Industrial Test Session</span>
          <h2>전동기 시험 세션</h2>
          <p>Motor Test Session</p>
        </div>
        <div className="test-session-status">
          <span className={`metric-chip voltage-chip-${voltageCondition.tone}`}>
            {selectedMode.label}
          </span>
          <span className={`metric-chip voltage-chip-${voltageCondition.tone}`}>
            {voltageCondition.label}
          </span>
        </div>
      </div>

      <div className="session-compact-grid">
        {compactItems.map(([label, value]) => (
          <div className="session-info-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {showDetails ? (
        <div className="session-info-grid">
          {sessionItems.map(([label, value]) => (
            <div className="session-info-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="session-command-row">
        <p>{actionGuide}</p>
        <div>
          <button className="session-button" type="button" onClick={() => setShowDetails((value) => !value)}>
            {showDetails ? '세부 정보 접기 / Hide Details' : '세부 정보 보기 / Show Details'}
          </button>
          <button className="session-button" type="button" onClick={onEditSetup}>
            시험 정보 수정 / Edit Setup
          </button>
          <button className="session-button" type="button" onClick={onNewTest}>
            새 시험 시작 / New Test
          </button>
          <button
            className="session-button session-button-primary"
            type="button"
            disabled={isGeneratingReport}
            onClick={onGenerateReport}
          >
            {isGeneratingReport ? 'PDF 생성 중...' : '리포트 생성 / Generate Report'}
          </button>
        </div>
      </div>
      {reportStatus ? <div className="report-status">{reportStatus}</div> : null}
    </section>
  )
}
