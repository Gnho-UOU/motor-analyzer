import { formatCompact, toProfileNumber } from '../../utils/numberUtils.js'
import { getLoadModelLabel } from '../../utils/loadModels.js'
import { calculateRatedPreview, sanitizeParams } from '../../utils/motorCalculations.js'

export function MappingCheckPanel({ motor, params, selectedPreset, startupState, testProfile }) {
  const preview = calculateRatedPreview(testProfile)
  const appliedParams = sanitizeParams(params ?? motor)
  const slipLabel =
    motor.ratedSpeedStatus === 'ok'
      ? `${formatCompact((motor.ratedSpeedEstimatedSlip ?? preview.simulationEstimatedSlip) * 100, 2)} %`
      : motor.ratedSpeedSlipLabel ?? preview.simulationSlipLabel
  const rows = [
    ['active ratedPowerKw', `${formatCompact(appliedParams.ratedPowerKwReference, 1)} kW`],
    ['testProfile.ratedVoltage', `${formatCompact(preview.ratedVoltage, 0)} V`],
    ['testProfile.supplyVoltage', `${formatCompact(preview.supplyVoltage, 0)} V`],
    ['params.ratedVoltageReference', `${formatCompact(appliedParams.ratedVoltageReference, 0)} V`],
    ['params.voltage', `${formatCompact(appliedParams.voltage, 0)} V`],
    ['testProfile.ratedFrequency', `${formatCompact(preview.ratedFrequency, 0)} Hz`],
    ['testProfile.supplyFrequency', `${formatCompact(preview.supplyFrequency, 0)} Hz`],
    ['params.ratedFrequencyReference', `${formatCompact(appliedParams.ratedFrequencyReference, 0)} Hz`],
    ['params.f', `${formatCompact(appliedParams.f, 0)} Hz`],
    ['testProfile.poleNumber', `${formatCompact(preview.poleNumber, 0)} P`],
    ['params.poles', `${formatCompact(appliedParams.poles, 0)} P`],
    ['ratedTorque', `${formatCompact(motor.ratedTorque ?? appliedParams.ratedTorqueReference, 2)} N*m`],
    ['selectedPreset', selectedPreset ? `${selectedPreset.id} / ${selectedPreset.subtitle}` : '-'],
    ['loadPercent', `${formatCompact(appliedParams.loadPercent, 1)} %`],
    ['finalLoadTorque', `${formatCompact(appliedParams.loadTorque, 2)} N*m`],
    ['initialStartupLoadTorque', `${formatCompact(motor.startingLoadTorque, 2)} N*m`],
    ['Te_start', `${formatCompact(motor.startingTorque, 2)} N*m`],
    ['startupTorqueReserve', `${formatCompact(motor.startupTorqueReserve, 2)} N*m`],
    ['hasStartupTorqueReserve', motor.hasStartupTorqueReserve ? 'true' : 'false'],
    ['startupCanReachTarget', motor.startupCanReachTarget ? 'true' : 'false'],
    ['startupCanAccelerate', motor.startupCanAccelerate ? 'true' : 'false'],
    ['startupFinalSpeed', `${formatCompact(motor.startupFinalSpeed, 0)} rpm`],
    ['torqueCalibrationFactor', formatCompact(motor.torqueCalibrationFactor ?? 1, 3)],
    ['simulationState', motor.simulationState ?? startupState?.status ?? '-'],
    ['testProfile.loadTorque', `${formatCompact(toProfileNumber(testProfile.loadTorque, 0), 2)} N·m`],
    ['params.loadTorque', `${formatCompact(appliedParams.loadTorque, 2)} N·m`],
    ['testProfile.inertiaJ', `${formatCompact(toProfileNumber(testProfile.inertiaJ, 0), 4)} kg·m²`],
    ['params.inertia', `${formatCompact(appliedParams.inertia, 4)} kg·m²`],
    ['testProfile.loadModel', getLoadModelLabel(testProfile.loadModel)],
    ['params.loadModel', getLoadModelLabel(appliedParams.loadModel)],
    ['Ns', `${formatCompact(motor.ns, 0)} rpm`],
    ['ratedSpeed', `${formatCompact(appliedParams.ratedSpeedReference, 0)} rpm`],
    ['estimated slip', slipLabel],
    ['Vpu', `${formatCompact(motor.vpu, 3)} pu · ${motor.voltageCondition.label}`],
    ['operating load torque', `${formatCompact(motor.operatingLoadTorque, 2)} N·m`],
  ]

  return (
    <section className="panel mapping-check-panel">
      <div className="panel-heading">
        <div>
          <h2>Wizard - Simulation Mapping Check</h2>
          <p>Wizard - Simulation Mapping Check</p>
        </div>
        <span className={`metric-chip voltage-chip-${motor.voltageCondition.tone}`}>
          {motor.voltageCondition.label}
        </span>
      </div>

      <div className="mapping-check-grid">
        {rows.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}



export function EquivalentParameterDashboardPanel({ motor }) {
  const rows = [
    ['params.r1', `${formatCompact(motor.r1, 4)} Ω`],
    ['params.r2', `${formatCompact(motor.r2, 4)} Ω`],
    ['params.x1', `${formatCompact(motor.x1, 4)} Ω`],
    ['params.x2', `${formatCompact(motor.x2, 4)} Ω`],
    ['params.xm', `${formatCompact(motor.xm, 4)} Ω`],
    ['params.rc', `${formatCompact(motor.rc, 4)} Ω`],
    ['starting torque', `${formatCompact(motor.startingTorque, 2)} N·m`],
    ['maximum torque', `${formatCompact(motor.maxTorque, 2)} N·m`],
    ['operating speed', `${formatCompact(motor.nr, 0)} rpm`],
    ['operating slip', `${formatCompact(motor.slipPercent, 2)} %`],
    ['Thevenin voltage', `${formatCompact(motor.vth, 2)} V`],
  ]

  return (
    <section className="panel equivalent-parameter-dashboard">
      <div className="panel-heading">
        <div>
          <h2>Torque Model Parameter Check</h2>
          <p>Equivalent circuit values used by torqueAtSlip()</p>
        </div>
        <span className={`metric-chip ${motor.parameterEstimationStatus === 'warning' ? 'voltage-chip-caution' : ''}`}>
          {motor.parameterModeLabel}
        </span>
      </div>
      <div className="equivalent-preview-grid">
        {rows.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <p className={motor.parameterEstimationStatus === 'warning' ? 'wizard-warning' : 'wizard-note'}>
        {motor.parameterEstimationNote}
      </p>
    </section>
  )
}

