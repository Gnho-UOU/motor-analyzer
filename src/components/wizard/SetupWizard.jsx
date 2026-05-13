import {
  BLOCKED_ROTOR_TEST_FIELDS, EQUIVALENT_PARAMETER_FIELDS, MANUFACTURER_OPTIONS, MOTOR_CATEGORY_OPTIONS,
  LOAD_MODEL_OPTIONS, NO_LOAD_TEST_FIELDS, OPERATING_CONDITION_FIELDS, PARAMETER_MODE_OPTIONS, PHASE_TYPE_OPTIONS,
  POWER_TYPE_OPTIONS, RATED_SPEC_FIELDS, VOLTAGE_CLASS_OPTIONS, WIZARD_STEPS,
} from '../../data/motorOptions.js'
import {
  MOTOR_EXAMPLE_SOURCE_NOTE,
  applyVoltageClassExampleToProfile,
  getExampleProfileLabel,
  getVoltageClassExampleProfile,
} from '../../data/motorExamples.js'
import { TEST_MODE_OPTIONS } from '../../data/testModes.js'
import { formatCompact, formatNumber, toFiniteNumber, toProfileNumber } from '../../utils/numberUtils.js'
import {
  calculateLoadTorqueFromPercent,
  createOperatingPresetsFromMotorProfile,
  getPresetForTestMode,
} from '../../utils/operatingPresets.js'
import {
  EQUIVALENT_PARAMETER_ALIASES, REVERSE_EQUIVALENT_PARAMETER_ALIASES, calculateRatedPreview,
  getManufacturerLabel, getMotorTypeLabel, getParameterModeLabel, getParameterModeOption,
  getTestModeOption, isSupportedMotorProfile,
} from '../../utils/motorCalculations.js'
import { getLoadModelLabel, getLoadModelOption } from '../../utils/loadModels.js'

export function WizardProgress({ currentStep }) {
  return (
    <div className="wizard-progress" aria-label="setup progress">
      {WIZARD_STEPS.map((step) => (
        <div
          className={[
            'wizard-step',
            currentStep === step.number ? 'is-current' : '',
            currentStep > step.number ? 'is-complete' : '',
          ].join(' ')}
          key={step.number}
        >
          <span>{step.number}</span>
          <strong>{step.label}</strong>
          <small>{step.subtitle}</small>
        </div>
      ))}
    </div>
  )
}



export function WizardField({
  label,
  subtitle,
  value,
  onChange,
  type = 'text',
  multiline = false,
  required = false,
  ...inputProps
}) {
  const InputTag = multiline ? 'textarea' : 'input'

  return (
    <label className="wizard-field">
      <span>
        <strong>{label}</strong>
        <small>{subtitle}</small>
      </span>
      <InputTag
        {...inputProps}
        required={required}
        type={multiline ? undefined : type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}



export function SelectionCard({ option, selected, onSelect, showSupport = false }) {
  const supported = option.supported !== false

  return (
    <button
      className={`selection-card ${selected ? 'is-selected' : ''} ${
        supported ? '' : 'is-coming-soon'
      }`}
      type="button"
      onClick={() => onSelect(option.value)}
    >
      <span>
        <strong>{option.label}</strong>
        <small>{option.subtitle}</small>
      </span>
      {showSupport && !supported ? (
        <em>추후 지원 예정 / Coming soon</em>
      ) : null}
    </button>
  )
}



export function WizardActions({ currentStep, onBack, onNext, onStart }) {
  return (
    <div className="wizard-actions">
      {currentStep > 1 ? (
        <button className="wizard-button wizard-button-secondary" type="button" onClick={onBack}>
          이전 / Back
        </button>
      ) : (
        <span />
      )}
      {currentStep < 6 ? (
        <button className="wizard-button wizard-button-primary" type="button" onClick={onNext}>
          다음 / Next
        </button>
      ) : (
        <button className="wizard-start-button" type="button" onClick={onStart}>
          <strong>시뮬레이션 시작</strong>
          <small>Start Simulation</small>
        </button>
      )}
    </div>
  )
}



export function SetupWizard({
  currentStep,
  testProfile,
  validationMessage,
  onBack,
  onChange,
  onNext,
  onStart,
}) {
  const preview = calculateRatedPreview(testProfile)
  const selectedTestMode = getTestModeOption(testProfile.testMode)
  const selectedLoadModel = getLoadModelOption(testProfile.loadModel)
  const selectedParameterMode = getParameterModeOption(testProfile.parameterMode)
  const canonicalParameterMode = selectedParameterMode.value
  const selectedVoltageExample = getVoltageClassExampleProfile(testProfile.voltageClass)
  const equivalentPreview = preview.equivalentParameters
  const profilePresets = createOperatingPresetsFromMotorProfile(testProfile)
  const startupPreset = getPresetForTestMode(testProfile.testMode, profilePresets, 'rated-load')
  const startupPresetValues = startupPreset?.values ?? {
    voltage: preview.supplyVoltage,
    f: preview.supplyFrequency,
    loadPercent: preview.loadPercent,
    loadTorque: preview.finalLoadTorque,
    loadModel: testProfile.loadModel,
    inertia: toProfileNumber(testProfile.inertiaJ, 0),
  }
  const unsupportedMotor = !isSupportedMotorProfile(testProfile)
  const update = (key, value) =>
    onChange((current) => {
      const next = { ...current, [key]: value }
      const legacyEquivalentKey = EQUIVALENT_PARAMETER_ALIASES[key]
      const canonicalEquivalentKey = REVERSE_EQUIVALENT_PARAMETER_ALIASES[key]

      if (legacyEquivalentKey) {
        next[legacyEquivalentKey] = value
      }

      if (canonicalEquivalentKey) {
        next[canonicalEquivalentKey] = value
      }

      if (
        [
          'manufacturer',
          'voltageClass',
          'ratedPowerKw',
          'ratedVoltage',
          'ratedFrequency',
          'poleNumber',
          'ratedSpeed',
          'ratedCurrent',
          'powerFactor',
          'efficiency',
          'supplyVoltage',
          'supplyFrequency',
          'loadPercent',
          'inertiaJ',
          'loadModel',
          'parameterMode',
          'r1',
          'r2',
          'x1',
          'x2',
          'xm',
          'rc',
        ].includes(key)
      ) {
        next.exampleProfileId = 'custom'
      }

      if (key === 'loadPercent') {
        const ratedPowerKw = Math.max(0, toProfileNumber(current.ratedPowerKw, 15))
        const ratedSpeed = Math.max(0, toProfileNumber(current.ratedSpeed, 1750))
        const ratedTorque = ratedSpeed > 0
          ? (ratedPowerKw * 1000) / ((2 * Math.PI * ratedSpeed) / 60)
          : 0

        next.loadTorque = Number(calculateLoadTorqueFromPercent(value, ratedTorque).toFixed(3))
      }

      if (key === 'ratedVoltage') {
        const currentSupply = String(current.supplyVoltage ?? '').trim()
        const currentRated = String(current.ratedVoltage ?? '').trim()
        const currentRatedNumber = Math.max(0.001, toProfileNumber(current.ratedVoltage, 380))
        const currentSupplyNumber = toProfileNumber(current.supplyVoltage, currentRatedNumber)
        const nextRatedNumber = Math.max(0.001, toProfileNumber(value, currentRatedNumber))

        if (!currentSupply || currentSupply === currentRated) {
          next.supplyVoltage = value
        } else if (
          current.testMode === 'low-voltage-startup' &&
          Math.abs(currentSupplyNumber - currentRatedNumber * 0.8) < 0.01
        ) {
          next.supplyVoltage = Number((nextRatedNumber * 0.8).toFixed(1))
        }
      }

      if (key === 'ratedFrequency') {
        const currentSupply = String(current.supplyFrequency ?? '').trim()
        const currentRated = String(current.ratedFrequency ?? '').trim()

        if (!currentSupply || currentSupply === currentRated) {
          next.supplyFrequency = value
        }
      }

      if (key === 'testMode' && value === 'low-voltage-startup') {
        const ratedVoltage = Math.max(0.001, toProfileNumber(current.ratedVoltage, 380))
        const supplyVoltage = toProfileNumber(current.supplyVoltage, ratedVoltage)

        if (Math.abs(supplyVoltage - ratedVoltage) < 0.001) {
          next.supplyVoltage = Number((ratedVoltage * 0.8).toFixed(1))
        }
      }

      return next
    })
  const applySelectedVoltageExample = () => {
    onChange((current) => applyVoltageClassExampleToProfile(current))
  }
  const applyVoltageClassExample = (voltageClass) => {
    onChange((current) => applyVoltageClassExampleToProfile({
      ...current,
      voltageClass,
    }))
  }
  const summaryRows = [
    ['사용자 / User', testProfile.userName || '-'],
    ['소속 / Organization', testProfile.organization || '-'],
    ['프로젝트 / Project', testProfile.projectName || '-'],
    ['전동기 유형 / Motor Type', getMotorTypeLabel(testProfile)],
    ['제조사 / Manufacturer', getManufacturerLabel(testProfile)],
    ['부하 모델 / Load Model', getLoadModelLabel(testProfile.loadModel)],
    ['파라미터 설정 / Parameter Mode', getParameterModeLabel(testProfile.parameterMode)],
    ['시험 목적 / Test Mode', `${selectedTestMode.label} / ${selectedTestMode.subtitle}`],
  ]

  return (
    <div className="setup-shell">
      <div className="setup-frame">
        <div className="setup-brand">
          <span className="brand-mark">MA</span>
          <div>
            <h1>MotorAnalyzer</h1>
            <p>Industrial motor test and simulation workflow</p>
          </div>
        </div>

        <WizardProgress currentStep={currentStep} />

        <section className="wizard-card">
          {currentStep === 1 ? (
            <>
              <div className="wizard-heading">
                <span className="eyebrow">Commissioning Setup</span>
                <h2>1단계. 사용자 정보 입력</h2>
                <p>Step 1. User Information</p>
              </div>
              <div className="wizard-form-grid">
                <WizardField
                  required
                  label="사용자 이름"
                  subtitle="User name"
                  value={testProfile.userName}
                  onChange={(value) => update('userName', value)}
                />
                <WizardField
                  label="소속 또는 회사명"
                  subtitle="Organization"
                  value={testProfile.organization}
                  onChange={(value) => update('organization', value)}
                />
                <WizardField
                  label="프로젝트명"
                  subtitle="Project name"
                  value={testProfile.projectName}
                  onChange={(value) => update('projectName', value)}
                />
                <WizardField
                  label="시험 날짜"
                  subtitle="Test date"
                  type="date"
                  value={testProfile.testDate}
                  onChange={(value) => update('testDate', value)}
                />
                <WizardField
                  multiline
                  label="시험 메모"
                  subtitle="Test memo"
                  value={testProfile.testMemo}
                  onChange={(value) => update('testMemo', value)}
                />
              </div>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <div className="wizard-heading">
                <span className="eyebrow">Motor Classification</span>
                <h2>2단계. 전동기 유형 선택</h2>
                <p>Step 2. Motor Type Selection</p>
              </div>
              <div className="selection-section">
                <h3>Voltage class</h3>
                <div className="selection-grid two">
                  {VOLTAGE_CLASS_OPTIONS.map((option) => (
                    <SelectionCard
                      key={option.value}
                      option={option}
                      selected={testProfile.voltageClass === option.value}
                      onSelect={applyVoltageClassExample}
                    />
                  ))}
                </div>
              </div>
              <div className="selection-section">
                <h3>Power type</h3>
                <div className="selection-grid two">
                  {POWER_TYPE_OPTIONS.map((option) => (
                    <SelectionCard
                      showSupport
                      key={option.value}
                      option={option}
                      selected={testProfile.powerType === option.value}
                      onSelect={(value) => update('powerType', value)}
                    />
                  ))}
                </div>
              </div>
              <div className="selection-section">
                <h3>Phase type</h3>
                <div className="selection-grid two">
                  {PHASE_TYPE_OPTIONS.map((option) => (
                    <SelectionCard
                      showSupport
                      key={option.value}
                      option={option}
                      selected={testProfile.phaseType === option.value}
                      onSelect={(value) => update('phaseType', value)}
                    />
                  ))}
                </div>
              </div>
              <div className="selection-section">
                <h3>Motor category</h3>
                <div className="selection-grid">
                  {MOTOR_CATEGORY_OPTIONS.map((option) => (
                    <SelectionCard
                      showSupport
                      key={option.value}
                      option={option}
                      selected={testProfile.motorCategory === option.value}
                      onSelect={(value) => update('motorCategory', value)}
                    />
                  ))}
                </div>
              </div>
              {unsupportedMotor ? (
                <div className="wizard-warning">
                  현재 시뮬레이션은 3상 AC 유도전동기를 기준으로 동작합니다.
                </div>
              ) : null}
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <div className="wizard-heading">
                <span className="eyebrow">Equipment Metadata</span>
                <h2>3단계. 제조사 선택</h2>
                <p>Step 3. Manufacturer Selection</p>
              </div>
              <div className="selection-grid manufacturer-grid">
                {MANUFACTURER_OPTIONS.map((option) => (
                  <SelectionCard
                    key={option.value}
                    option={option}
                    selected={testProfile.manufacturer === option.value}
                    onSelect={(value) => update('manufacturer', value)}
                  />
                ))}
              </div>
              {testProfile.manufacturer === 'other' ? (
                <WizardField
                  label="제조사 직접 입력"
                  subtitle="Custom manufacturer"
                  value={testProfile.customManufacturer}
                  onChange={(value) => update('customManufacturer', value)}
                />
              ) : null}
              <p className="wizard-note">
                제조사 선택은 리포트 및 장비 분류용이며, 실제 상세 파라미터는 사용자가 입력한
                정격값과 일반적인 유도전동기 모델을 기반으로 계산됩니다.
              </p>
            </>
          ) : null}

          {currentStep === 4 ? (
            <>
              <div className="wizard-heading">
                <span className="eyebrow">Rated Nameplate Data</span>
                <h2>4단계. 전동기 정격 사양 입력</h2>
                <p>Step 4. Rated Motor Specification</p>
              </div>
              <div className="wizard-example-panel">
                <div>
                  <strong>현재 값: {getExampleProfileLabel(testProfile.exampleProfileId)}</strong>
                  <span>선택 가능 예시: {selectedVoltageExample.label}</span>
                  <p>{MOTOR_EXAMPLE_SOURCE_NOTE}</p>
                </div>
                <button className="wizard-button wizard-button-secondary" type="button" onClick={applySelectedVoltageExample}>
                  선택한 전압 등급 예시값 적용 / Apply selected voltage-class example
                </button>
              </div>
              <div className="wizard-spec-layout">
                <div className="wizard-spec-sections">
                  <section className="wizard-field-section">
                    <div>
                      <h3>정격값 / Rated Motor Data</h3>
                      <p>Nameplate values used as motor reference data</p>
                    </div>
                    <div className="wizard-form-grid spec-grid">
                      {RATED_SPEC_FIELDS.map((field) => (
                        <WizardField
                          key={field.key}
                          label={field.label}
                          subtitle={field.subtitle}
                          type="number"
                          value={testProfile[field.key]}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          onChange={(value) => update(field.key, value)}
                        />
                      ))}
                    </div>
                  </section>
                  <section className="wizard-field-section">
                    <div>
                      <h3>운전 조건 / Operating Conditions</h3>
                      <p>Actual supply and mechanical load applied to the simulation</p>
                    </div>
                    <div className="wizard-form-grid spec-grid">
                      {OPERATING_CONDITION_FIELDS.map((field) => (
                        <WizardField
                          key={field.key}
                          label={field.label}
                          subtitle={field.subtitle}
                          type="number"
                          value={testProfile[field.key] ?? ''}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          onChange={(value) => update(field.key, value)}
                        />
                      ))}
                    </div>
                    <div className="selection-section load-model-section">
                      <h3>부하 모델 / Load Model</h3>
                      <div className="selection-grid load-model-grid">
                        {LOAD_MODEL_OPTIONS.map((option) => (
                          <SelectionCard
                            key={option.value}
                            option={option}
                            selected={testProfile.loadModel === option.value}
                            onSelect={(value) => update('loadModel', value)}
                          />
                        ))}
                      </div>
                      {selectedLoadModel.note ? (
                        <p className="wizard-note">{selectedLoadModel.note}</p>
                      ) : null}
                    </div>
                  </section>
                  <section className="wizard-field-section equivalent-parameter-section">
                    <div>
                      <h3>등가회로 파라미터 설정</h3>
                      <p>Equivalent Circuit Parameter Setup</p>
                    </div>
                    <div className="selection-section">
                      <h3>파라미터 설정 방식 / Parameter Setup Mode</h3>
                      <div className="selection-grid parameter-mode-grid">
                        {PARAMETER_MODE_OPTIONS.map((option) => (
                          <SelectionCard
                            key={option.value}
                            option={option}
                            selected={canonicalParameterMode === option.value}
                            onSelect={(value) => update('parameterMode', value)}
                          />
                        ))}
                      </div>
                      <p className="wizard-note">{selectedParameterMode.description}</p>
                    </div>

                    {canonicalParameterMode === 'manual' ? (
                      <div className="wizard-form-grid spec-grid">
                        {EQUIVALENT_PARAMETER_FIELDS.map((field) => (
                          <WizardField
                            key={field.key}
                            label={field.label}
                            subtitle={field.subtitle}
                            type="number"
                            value={testProfile[field.key] ?? ''}
                            min={field.min}
                            step={field.step}
                            onChange={(value) => update(field.key, value)}
                          />
                        ))}
                      </div>
                    ) : null}

                    {canonicalParameterMode === 'rated-estimation' ? (
                      <p className="wizard-note">
                        본 값은 교육용 추정값이며 실제 제품 데이터와 다를 수 있습니다.
                      </p>
                    ) : null}

                    {canonicalParameterMode === 'test-estimation' ? (
                      <>
                        <div className="wizard-form-grid spec-grid">
                          {NO_LOAD_TEST_FIELDS.map((field) => (
                            <WizardField
                              key={field.key}
                              label={field.label}
                              subtitle={field.subtitle}
                              type="number"
                              value={testProfile[field.key] ?? ''}
                              min={field.min}
                              step={field.step}
                              onChange={(value) => update(field.key, value)}
                            />
                          ))}
                        </div>
                        <div className="wizard-form-grid spec-grid">
                          {BLOCKED_ROTOR_TEST_FIELDS.map((field) => (
                            <WizardField
                              key={field.key}
                              label={field.label}
                              subtitle={field.subtitle}
                              type="number"
                              value={testProfile[field.key] ?? ''}
                              min={field.min}
                              step={field.step}
                              onChange={(value) => update(field.key, value)}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}

                    <div className="equivalent-preview-panel">
                      <div>
                        <h3>등가회로 파라미터 미리보기</h3>
                        <p>Equivalent Circuit Parameter Preview</p>
                      </div>
                      <div className="equivalent-preview-grid">
                        {[
                          ['R1', equivalentPreview.params.r1],
                          ["R2'", equivalentPreview.params.r2],
                          ['X1', equivalentPreview.params.x1],
                          ["X2'", equivalentPreview.params.x2],
                          ['Xm', equivalentPreview.params.xm],
                          ['Rc', equivalentPreview.params.rc],
                        ].map(([label, value]) => (
                          <article key={label}>
                            <span>{label}</span>
                            <strong>{formatCompact(value, 4)} Ω</strong>
                          </article>
                        ))}
                      </div>
                      <p className={equivalentPreview.status === 'warning' ? 'wizard-warning' : 'wizard-note'}>
                        {equivalentPreview.note}
                      </p>
                      <p className="wizard-note">
                        등가회로 파라미터는 토크-속도 곡선, 기동토크, 최대토크,
                        전류 계산에 영향을 줍니다.
                      </p>
                    </div>
                  </section>
                </div>
                <div className="calculated-preview">
                  <h3>자동 계산 미리보기</h3>
                  <p>Automatic calculated preview</p>
                  <div>
                    <span>Synchronous speed Ns</span>
                    <strong>{formatNumber(preview.ns, 0)} rpm</strong>
                  </div>
                  <div>
                    <span>Estimated slip</span>
                    <strong>
                      {preview.estimatedSlipIsValid
                        ? `${formatNumber(preview.estimatedSlipPercent, 2)} %`
                        : preview.estimatedSlipLabel}
                    </strong>
                    {!preview.estimatedSlipIsValid ? (
                      <small className="warning-inline">{preview.estimatedSlipWarning}</small>
                    ) : null}
                  </div>
                  <div>
                    <span>Estimated rated torque</span>
                    <strong>{formatNumber(preview.ratedTorque, 2)} N·m</strong>
                  </div>
                  <div>
                    <span>Selected load model</span>
                    <strong>{selectedLoadModel.label}</strong>
                    <small>{selectedLoadModel.subtitle}</small>
                  </div>
                  <div>
                    <span>Load torque at rated speed</span>
                    <strong>{formatNumber(preview.loadTorqueAtRatedSpeed, 2)} N·m</strong>
                  </div>
                  <div>
                    <span>Expected load behavior</span>
                    <small>{selectedLoadModel.description}</small>
                  </div>
                  <div>
                    <span>Estimated rated current</span>
                    <strong>{formatNumber(preview.estimatedRatedCurrent, 2)} A</strong>
                  </div>
                  <div>
                    <span>Voltage per-unit Vpu</span>
                    <strong>{formatNumber(preview.vpu, 3)} pu</strong>
                  </div>
                  <div className={`voltage-condition-preview voltage-condition-${preview.voltageCondition.tone}`}>
                    <span>Voltage condition</span>
                    <strong>{preview.voltageCondition.label}</strong>
                    <small>{preview.voltageCondition.subtitle}</small>
                  </div>
                  {startupPreset ? (
                    <div>
                      <span>Initial simulation preset</span>
                      <strong>{startupPreset.label}</strong>
                      <small>
                        V {formatCompact(startupPresetValues.voltage, 0)} V · f{' '}
                        {formatCompact(startupPresetValues.f, 0)} Hz · TL{' '}
                        {formatCompact(startupPresetValues.loadTorque, 1)} N·m
                      </small>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {currentStep === 5 ? (
            <>
              <div className="wizard-heading">
                <span className="eyebrow">Test Objective</span>
                <h2>5단계. 시험 목적 선택</h2>
                <p>Step 5. Test Mode Selection</p>
              </div>
              <div className="selection-grid test-mode-grid">
                {TEST_MODE_OPTIONS.map((option) => (
                  <SelectionCard
                    key={option.value}
                    option={option}
                    selected={testProfile.testMode === option.value}
                    onSelect={(value) => update('testMode', value)}
                  />
                ))}
              </div>
              <div className="mode-explanation">
                <strong>{selectedTestMode.label}</strong>
                <span>{selectedTestMode.subtitle}</span>
                <p>{selectedTestMode.description}</p>
              </div>
            </>
          ) : null}

          {currentStep === 6 ? (
            <>
              <div className="wizard-heading">
                <span className="eyebrow">Final Review</span>
                <h2>6단계. 시험 조건 확인 및 시뮬레이션 시작</h2>
                <p>Step 6. Review and Start Simulation</p>
              </div>
              <div className="review-grid">
                {summaryRows.map(([label, value]) => (
                  <article className="review-card" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
                <article className="review-card">
                  <span>정격값 / Rated motor data</span>
                  <strong>
                    {formatCompact(toFiniteNumber(testProfile.ratedPowerKw, 0), 1)} kW ·{' '}
                    {formatCompact(preview.ratedVoltage, 0)} V ·{' '}
                    {formatCompact(preview.ratedFrequency, 0)} Hz ·{' '}
                    {formatCompact(preview.poleNumber, 0)} P
                  </strong>
                </article>
                <article className="review-card">
                  <span>운전 조건 / Operating conditions</span>
                  <strong>
                    {startupPreset ? `${startupPreset.label} preset · ` : ''}
                    Supply {formatCompact(startupPresetValues.voltage, 0)} V ·{' '}
                    {formatCompact(startupPresetValues.f, 0)} Hz · TL{' '}
                    {formatCompact(startupPresetValues.loadTorque, 1)} N·m · J{' '}
                    {formatCompact(startupPresetValues.inertia, 3)} ·{' '}
                    {getLoadModelOption(startupPresetValues.loadModel).label}
                  </strong>
                </article>
                <article className="review-card">
                  <span>계산 미리보기 / Calculated preview</span>
                  <strong>
                    Ns {formatCompact(preview.ns, 0)} rpm · Slip{' '}
                    {preview.estimatedSlipIsValid
                      ? `${formatCompact(preview.estimatedSlipPercent, 2)} %`
                      : preview.estimatedSlipLabel}{' '}
                    · T{' '}
                    {formatCompact(preview.ratedTorque, 1)} N·m · TL@rated{' '}
                    {formatCompact(preview.loadTorqueAtRatedSpeed, 1)} N·m
                  </strong>
                  {!preview.estimatedSlipIsValid ? (
                    <small className="warning-inline">{preview.estimatedSlipWarning}</small>
                  ) : null}
                </article>
                <article className={`review-card voltage-review-card voltage-review-${preview.voltageCondition.tone}`}>
                  <span>전압 조건 / Voltage condition</span>
                  <strong>
                    Vpu {formatCompact(preview.vpu, 3)} · {preview.voltageCondition.label}
                  </strong>
                </article>
                <article className="review-card">
                  <span>등가회로 / Equivalent circuit</span>
                  <strong>
                    {selectedParameterMode.label} · R1 {formatCompact(equivalentPreview.params.r1, 3)} Ω ·
                    R2' {formatCompact(equivalentPreview.params.r2, 3)} Ω · Xm{' '}
                    {formatCompact(equivalentPreview.params.xm, 2)} Ω
                  </strong>
                </article>
              </div>
              {unsupportedMotor ? (
                <div className="wizard-warning">
                  현재 선택한 유형은 추후 지원 예정입니다. 대시보드는 3상 AC 유도전동기
                  모델로 시뮬레이션을 진행합니다.
                </div>
              ) : null}
            </>
          ) : null}

          {validationMessage ? <div className="wizard-error">{validationMessage}</div> : null}

          <WizardActions
            currentStep={currentStep}
            onBack={onBack}
            onNext={onNext}
            onStart={onStart}
          />
        </section>
      </div>
    </div>
  )
}

