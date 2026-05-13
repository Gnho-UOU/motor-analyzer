import { formatCompact } from '../../utils/numberUtils.js'

function ThermalMetric({ label, unit, value }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </article>
  )
}

export function ThermalModelPanel({ thermal }) {
  return (
    <section className="panel thermal-model-panel">
      <div className="panel-heading">
        <div>
          <h2>권선온도 및 열 모델 / Winding Temperature & Thermal Model</h2>
          <p>손실 기반 1차 열 모델로 권선 온도 상승을 추정합니다.</p>
        </div>
        <span className={`metric-chip voltage-chip-${thermal.thermalStatus.tone === 'caution' ? 'caution' : thermal.thermalStatus.tone === 'danger' ? 'danger' : 'normal'}`}>
          {thermal.thermalStatus.label}
        </span>
      </div>

      <div className="thermal-gauge">
        <div>
          <span>Thermal utilization</span>
          <strong>{formatCompact(thermal.thermalUtilization, 1)}%</strong>
        </div>
        <div className="thermal-gauge-track">
          <i style={{ width: `${Math.min(100, thermal.thermalUtilization)}%` }} />
        </div>
      </div>

      <div className="loss-metric-grid thermal-metric-grid">
        <ThermalMetric label="권선온도 T" value={formatCompact(thermal.windingTemperature, 1)} unit="°C" />
        <ThermalMetric label="주변온도 Tambient" value={formatCompact(thermal.ambientTemperature, 1)} unit="°C" />
        <ThermalMetric label="온도상승 ΔT" value={formatCompact(thermal.temperatureRise, 1)} unit="°C" />
        <ThermalMetric label="허용 권선온도 Tmax" value={formatCompact(thermal.maxWindingTemperature, 1)} unit="°C" />
        <ThermalMetric label="열 계산 손실" value={formatCompact(thermal.totalLossKw, 2)} unit="kW" />
        <ThermalMetric label="냉각 방열량 Qcool" value={formatCompact(thermal.coolingPowerKw, 2)} unit="kW" />
        <ThermalMetric label="열저항 Rth" value={formatCompact(thermal.thermalResistance, 4)} unit="°C/W" />
        <ThermalMetric label="유효 열저항 Rth_eff" value={formatCompact(thermal.effectiveThermalResistance, 4)} unit="°C/W" />
        <ThermalMetric label="열용량 Cth" value={formatCompact(thermal.thermalCapacitance, 0)} unit="J/°C" />
        <ThermalMetric label="냉각 모드" value={thermal.coolingModeLabel} unit={`speed ratio ${formatCompact(thermal.speedRatio, 2)}`} />
        <ThermalMetric label="예상 정상상태 온도" value={formatCompact(thermal.steadyStateTemperature, 1)} unit="°C" />
        <ThermalMetric label="열 상태" value={thermal.thermalStatus.label} unit={thermal.thermalStatus.subtitle} />
      </div>

      <p className="wizard-note">
        실제 전동기는 팬과 프레임 방열에 의해 열이 방출되므로, 손실과 냉각이 평형을 이루면 권선온도는 일정 온도에 수렴합니다.
        {' '}
        본 열 모델은 교육용 단순화 모델이며 실제 열해석 및 제조사 온도상승 시험을 대체하지 않습니다.
      </p>
    </section>
  )
}
