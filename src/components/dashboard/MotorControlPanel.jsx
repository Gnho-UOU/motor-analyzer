import { clamp, formatCompact } from '../../utils/numberUtils.js'

export function OperatingModeToggle({ enabled, onChange }) {
  return (
    <label className="mode-toggle-card">
      <span className="mode-toggle-copy">
        <span className="mode-title">자동 운전점 추적</span>
        <span className="mode-subtitle">Auto operating point</span>
      </span>
      <span className="mode-toggle-control">
        <input
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="mode-switch" aria-hidden="true"></span>
        <strong>{enabled ? 'ON' : 'OFF'}</strong>
      </span>
      <span className="mode-note">
        ON: 부하 토크 TL과 전동기 토크 곡선의 안정 교점을 사용합니다. OFF:
        입력한 슬립 값을 수동 기준으로 사용합니다.
      </span>
    </label>
  )
}



export function FrequencyScalingToggle({ enabled, motor, onChange }) {
  return (
    <label className="mode-toggle-card reactance-toggle-card">
      <span className="mode-toggle-copy">
        <span className="mode-title">주파수에 따른 리액턴스 보정</span>
        <span className="mode-subtitle">Frequency-dependent reactance scaling</span>
      </span>
      <span className="mode-toggle-control">
        <input
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="mode-switch" aria-hidden="true"></span>
        <strong>{enabled ? 'ON' : 'OFF'}</strong>
      </span>
      <span className="mode-note">
        ON: X = 2πfL 관계에 의해 리액턴스가 주파수에 비례한다고 가정합니다.
      </span>
      <span className="reactance-effective-grid">
        <span>
          X1_eff <strong>{formatCompact(motor.x1Eff, 2)} Ω</strong>
        </span>
        <span>
          X2_eff <strong>{formatCompact(motor.x2Eff, 2)} Ω</strong>
        </span>
        <span>
          Xm_eff <strong>{formatCompact(motor.xmEff, 1)} Ω</strong>
        </span>
      </span>
    </label>
  )
}



export function PresetPanel({ presets, selectedPreset, onSelect }) {
  return (
    <section className="preset-card">
      <div className="preset-heading">
        <span>운전조건 프리셋</span>
        <small>Operating Condition Presets</small>
      </div>

      <div className="preset-button-grid">
        {presets.map((preset) => (
          <button
            className={`preset-button ${selectedPreset.id === preset.id ? 'is-active' : ''}`}
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            type="button"
          >
            <span>{preset.label}</span>
            <small>{preset.subtitle}</small>
          </button>
        ))}
      </div>

      <div className="preset-description">
        <strong>{selectedPreset.summary}</strong>
        <span>
          {selectedPreset.label} / {selectedPreset.subtitle}
        </span>
        <p>{selectedPreset.detail}</p>
      </div>
    </section>
  )
}



export function MotorControlPanel({
  startupState,
  statusLabel,
  displayedRotorSpeed,
  displayedSlipText,
  startDisabled = false,
  startDisabledReason = '',
  onStart,
  onReset,
  onEmergencyStop,
}) {
  const isStarting = startupState.status === 'starting' || startupState.status === 'failed'
  const isRunning = startupState.status === 'finished'
  const isStopped =
    startupState.status === 'idle' ||
    startupState.status === 'stopped' ||
    startupState.status === 'emergency'

  return (
    <section className="control-panel-card" aria-label="motor control panel">
      <span className="panel-screw panel-screw-tl"></span>
      <span className="panel-screw panel-screw-tr"></span>
      <span className="panel-screw panel-screw-bl"></span>
      <span className="panel-screw panel-screw-br"></span>

      <div className="control-panel-heading">
        <span>전동기 제어반</span>
        <small>Motor Control Panel</small>
      </div>

      <div className="indicator-lamps" aria-label="simulation status lamps">
        <div className={`indicator-lamp lamp-run ${isRunning ? 'is-on' : ''}`}>
          <span></span>
          <strong>RUN</strong>
          <small>운전</small>
        </div>
        <div className={`indicator-lamp lamp-starting ${isStarting ? 'is-on' : ''}`}>
          <span></span>
          <strong>STARTING</strong>
          <small>기동 중</small>
        </div>
        <div className={`indicator-lamp lamp-stop ${isStopped ? 'is-on' : ''}`}>
          <span></span>
          <strong>STOP</strong>
          <small>정지</small>
        </div>
      </div>

      <div className="control-command-label">
        <span>전동기 기동 시뮬레이션</span>
        <small>Start Motor Simulation</small>
      </div>

      <div className="industrial-controls">
        <button
          className={`industrial-button start-button ${isStarting ? 'is-active' : ''}`}
          disabled={startDisabled}
          onClick={onStart}
          type="button"
        >
          <span>START</span>
          <small>기동</small>
        </button>

        <button className="industrial-button reset-button" onClick={onReset} type="button">
          <span>RESET</span>
          <small>초기화</small>
        </button>

        <button
          className="emergency-stop-button"
          onClick={onEmergencyStop}
          type="button"
        >
          <span>EMERGENCY STOP</span>
          <small>비상정지</small>
        </button>
      </div>

      {startDisabled ? <div className="control-warning">{startDisabledReason}</div> : null}

      <div className="control-readout-grid">
        <span>
          상태
          <strong>{statusLabel}</strong>
        </span>
        <span>
          시간
          <strong>{formatCompact(startupState.startupTime, 2)} s</strong>
        </span>
        <span>
          속도
          <strong>{formatCompact(displayedRotorSpeed, 0)} rpm</strong>
        </span>
        <span>
          슬립
          <strong>{displayedSlipText}</strong>
        </span>
      </div>

      <div className="control-progress" aria-label="startup progress">
        <span style={{ width: `${clamp(startupState.startupProgress * 100, 0, 100)}%` }}></span>
      </div>
    </section>
  )
}


