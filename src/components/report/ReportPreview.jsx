import { formatCompact } from '../../utils/numberUtils.js'
import { getLoadModelLabel } from '../../utils/loadModels.js'
import { calculateRatedPreview, getManufacturerLabel, getParameterModeLabel, getTestModeOption } from '../../utils/motorCalculations.js'

export function ReportPreviewPanel({ motor, testProfile, warnings }) {
  const preview = calculateRatedPreview(testProfile)
  const selectedMode = getTestModeOption(testProfile.testMode)

  return (
    <section className="panel report-preview-panel">
      <div className="panel-heading">
        <div>
          <h2>시험 결과 리포트 미리보기</h2>
          <p>Test Report Preview</p>
        </div>
        <span className="metric-chip">PDF Ready</span>
      </div>

      <div className="report-preview-grid">
        <article>
          <h3>Test profile summary</h3>
          <p>{testProfile.projectName || '프로젝트명 미입력'}</p>
          <span>{testProfile.userName || '-'} · {getManufacturerLabel(testProfile)}</span>
          <span>{selectedMode.label} / {selectedMode.subtitle}</span>
        </article>
        <article>
          <h3>Key calculated results</h3>
          <span>Ns {formatCompact(motor.ns, 0)} rpm</span>
          <span>
            Rated slip preview{' '}
            {motor.ratedSpeedStatus === 'ok'
              ? `${formatCompact((motor.ratedSpeedEstimatedSlip ?? preview.simulationEstimatedSlip) * 100, 2)} %`
              : motor.ratedSpeedSlipLabel ?? preview.simulationSlipLabel}
          </span>
          <span>Vpu {formatCompact(motor.vpu ?? preview.vpu, 3)} · {(motor.voltageCondition ?? preview.voltageCondition).label}</span>
          <span>{motor.loadModelLabel ?? getLoadModelLabel(testProfile.loadModel)}</span>
          <span>TL@OP {formatCompact(motor.operatingLoadTorque, 2)} N·m</span>
          <span>{motor.parameterModeLabel ?? getParameterModeLabel(testProfile.parameterMode)}</span>
          <span>R1/R2' {formatCompact(motor.r1, 3)} / {formatCompact(motor.r2, 3)} Ω</span>
          <span>Nr {formatCompact(motor.nr, 0)} rpm</span>
          <span>Te {formatCompact(motor.torque, 2)} N·m</span>
        </article>
        <article>
          <h3>Warning summary</h3>
          {warnings.slice(0, 3).map((warning) => (
            <span key={warning.id}>{warning.message}</span>
          ))}
        </article>
        <article>
          <h3>Interpretation</h3>
          <p>
            3상 전류는 회전자계를 형성하고, 유도전동기는 슬립이 존재할 때 토크가
            발생합니다. 부하토크가 증가하면 슬립이 커지고 속도가 감소할 수 있습니다.
          </p>
        </article>
      </div>
    </section>
  )
}


