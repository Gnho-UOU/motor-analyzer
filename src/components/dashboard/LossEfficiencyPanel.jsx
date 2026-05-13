import { formatCompact } from '../../utils/numberUtils.js'
import { calculateLossEfficiency } from '../../utils/lossCalculations.js'

function LossMetric({ label, value, unit = 'kW' }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </article>
  )
}

export function LossEfficiencyPanel({ motor, displayedMotor }) {
  const loss = calculateLossEfficiency(motor, displayedMotor)
  const breakdownTotal = Math.max(loss.inputPowerW, 1)

  return (
    <section className="panel loss-efficiency-panel">
      <div className="panel-heading">
        <div>
          <h2>손실 및 효율 분석 / Loss & Efficiency Analysis</h2>
          <p>현재 운전점과 등가회로 값을 이용한 교육용 손실 추정</p>
        </div>
        <span className={`metric-chip ${loss.efficiency >= 85 ? 'voltage-chip-normal' : loss.efficiency >= 75 ? 'voltage-chip-caution' : 'voltage-chip-danger'}`}>
          η {formatCompact(loss.efficiency, 1)} %
        </span>
      </div>

      <div className="loss-metric-grid">
        <LossMetric label="출력 Pout" value={formatCompact(loss.outputPowerKw, 2)} />
        <LossMetric label="고정자 동손 Pcu1" value={formatCompact(loss.statorCopperLossKw, 2)} />
        <LossMetric label="회전자 동손 Pcu2" value={formatCompact(loss.rotorCopperLossKw, 2)} />
        <LossMetric label="철손 Pcore" value={formatCompact(loss.coreLossKw, 2)} />
        <LossMetric label="기계손 Pmech" value={formatCompact(loss.mechanicalLossKw, 2)} />
        <LossMetric label="총 손실 Ploss" value={formatCompact(loss.totalLossKw, 2)} />
        <LossMetric label="입력 Pin" value={formatCompact(loss.inputPowerKw, 2)} />
        <LossMetric label="효율 η" value={formatCompact(loss.efficiency, 1)} unit="%" />
      </div>

      <div className="loss-breakdown" aria-label="loss and output power breakdown">
        {loss.breakdown.map((item) => {
          const width = Math.max(0, Math.min(100, (item.valueW / breakdownTotal) * 100))

          return (
            <div className="loss-breakdown-row" key={item.key}>
              <span>{item.label}</span>
              <div>
                <i className={`loss-bar loss-bar-${item.tone}`} style={{ width: `${width}%` }} />
              </div>
              <strong>{formatCompact(item.valueW / 1000, 2)} kW</strong>
            </div>
          )
        })}
      </div>

      {loss.warnings.length > 0 ? (
        <div className="loss-warning-list">
          {loss.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <p className="wizard-note">
        본 손실 및 효율 계산은 교육용 단순화 모델이며 실제 제품 시험값과 다를 수 있습니다.
      </p>
    </section>
  )
}
