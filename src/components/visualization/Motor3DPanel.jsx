import { formatCompact } from '../../utils/numberUtils.js'
import { MotorThreeScene } from './MotorThreeScene.jsx'

export function Motor3DPanel({
  motor,
  params,
  simulationState,
  warningSeverity,
  thermalStatus,
  windingTemperature,
  isRunning,
  isStarting,
  isCoasting,
  isEmergencyStop,
  isFieldOn,
  lowPerformanceMode,
}) {
  const energized = Boolean(isFieldOn)

  return (
    <div
      className={[
        'panel',
        'motor-3d-panel',
        energized ? 'is-energized' : 'is-deenergized',
        `motor-state-${simulationState ?? motor.simulationState ?? 'standby'}`,
        `motor-tone-${motor.state?.tone ?? 'balanced'}`,
      ].join(' ')}
    >
      <div className="panel-heading">
        <div>
          <h2>전동기 3D 모델</h2>
          <p>GPU-accelerated Three.js induction motor visualization</p>
        </div>
        <span className={`metric-chip ${energized ? '' : 'metric-chip-off'}`}>
          {energized
            ? `Ns ${formatCompact(motor.ns, 0)} rpm · Nr ${formatCompact(motor.nr, 0)} rpm`
            : '전원 OFF · Supply OFF'}
        </span>
      </div>

      <MotorThreeScene
        isCoasting={isCoasting}
        isEmergencyStop={isEmergencyStop}
        isFieldOn={isFieldOn}
        isRunning={isRunning}
        isStarting={isStarting}
        lowPerformanceMode={lowPerformanceMode}
        motor={motor}
        params={params}
        simulationState={simulationState ?? motor.simulationState}
        thermalStatus={thermalStatus}
        warningSeverity={warningSeverity}
        windingTemperature={windingTemperature}
      />
    </div>
  )
}
