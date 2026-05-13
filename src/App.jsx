import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './App.css'
import { StartupResponsePanel } from './components/charts/StartupChart.jsx'
import { ThermalChart } from './components/charts/ThermalChart.jsx'
import { ThreePhaseCurrentPanel } from './components/charts/PhaseCurrentChart.jsx'
import { TorqueSpeedChart } from './components/charts/TorqueSpeedChart.jsx'
import { ParamControl } from './components/dashboard/ParamControl.jsx'
import { ResultCard } from './components/dashboard/ResultCards.jsx'
import { WarningPanel } from './components/dashboard/WarningPanel.jsx'
import { FrequencyScalingToggle, MotorControlPanel, OperatingModeToggle, PresetPanel } from './components/dashboard/MotorControlPanel.jsx'
import { TestSessionHeader } from './components/dashboard/TestSessionHeader.jsx'
import { EquivalentParameterDashboardPanel, MappingCheckPanel } from './components/dashboard/MappingDebugPanel.jsx'
import { LossEfficiencyPanel } from './components/dashboard/LossEfficiencyPanel.jsx'
import { ThermalModelPanel } from './components/dashboard/ThermalModelPanel.jsx'
import { MotorVisualization } from './components/visualization/MotorVisualization.jsx'
import { Motor3DPanel } from './components/visualization/Motor3DPanel.jsx'
import { SetupWizard } from './components/wizard/SetupWizard.jsx'
import { ReportPreviewPanel } from './components/report/ReportPreview.jsx'
import { useMotorSimulation } from './hooks/useMotorSimulation.js'
import { DEFAULT_PARAMS, PARAM_CONTROLS, MOTOR_PRESETS, CUSTOM_PRESET } from './data/defaultParams.js'
import { EQUIVALENT_PARAMETER_FIELDS } from './data/motorOptions.js'
import { MOTOR_EXAMPLE_SOURCE_NOTE } from './data/motorExamples.js'
import { clamp, formatCompact, formatNumber, getLocalDateString, toFiniteNumber, toProfileNumber } from './utils/numberUtils.js'
import { calculateVoltagePerUnit, getVoltageCondition } from './utils/voltageJudgment.js'
import { getLoadModelLabel, getLoadModelOption } from './utils/loadModels.js'
import { calculateLossEfficiency } from './utils/lossCalculations.js'
import {
  applyOperatingPresetToParams,
  calculateLoadPercent,
  calculateLoadTorqueFromPercent,
  createOperatingPresetsFromMotorProfile,
  createOperatingPresetsFromParams,
  getRatedDataFromParams,
  getPresetForTestMode,
} from './utils/operatingPresets.js'
import { buildThermalAnalysis, buildThermalWarnings, stepThermalModel } from './utils/thermalCalculations.js'
import {
  buildStartupTrace,
  calculateRatedPreview,
  createDefaultTestProfile,
  createSimulationParamsFromProfile,
  createStartupState,
  getManufacturerLabel,
  getMotorTypeLabel,
  getParameterModeLabel,
  getParameterModeOption,
  getStartupPoint,
  getStartupStatusLabel,
  getTestModeOption,
} from './utils/motorCalculations.js'
import { buildWarningSummary, getMotorWarnings } from './utils/warningLogic.js'
import { sanitizeFileName } from './utils/reportUtils.js'

const EDUCATION_ITEMS = [
  {
    title: '3상 전류와 회전자계',
    subtitle: 'Balanced three-phase field',
    body: 'A, B, C상 전류가 120도 위상차를 가지면 각 상의 자속이 시간에 따라 합성되어 크기가 거의 일정한 회전자계가 만들어집니다.',
  },
  {
    title: '동기속도 Ns',
    subtitle: 'Synchronous speed',
    body: '동기속도는 고정자의 회전자계가 회전하는 속도이며, 공급 주파수와 극수에 의해 Ns = 120f / P로 결정됩니다.',
  },
  {
    title: '슬립 s',
    subtitle: 'Slip',
    body: '슬립은 회전자계 속도와 실제 회전자 속도의 차이를 나타냅니다. 유도전동기에서는 이 차이가 있어야 회전자에 전압과 전류가 유도됩니다.',
  },
  {
    title: '회전자 속도가 낮은 이유',
    subtitle: 'Rotor speed below Ns',
    body: '회전자 속도가 동기속도와 같아지면 상대속도가 0이 되어 유도전류와 토크가 사라집니다. 그래서 정상 운전에서는 Nr이 Ns보다 약간 낮습니다.',
  },
  {
    title: '토크와 속도 변화',
    subtitle: 'Torque-speed relation',
    body: '속도가 낮고 슬립이 큰 영역에서는 회전자 전류가 커지며, 속도가 증가하고 슬립이 작아질수록 전류와 토크가 함께 변합니다.',
  },
  {
    title: '교육적 활용',
    subtitle: 'Engineering learning',
    body: '주파수, 극수, 전압, 등가회로 파라미터, 부하토크를 바꾸며 속도, 슬립, 토크 곡선의 변화를 직관적으로 비교할 수 있습니다.',
  },
]

function EducationPanel() {
  return (
    <section className="panel education-panel">
      <div className="panel-heading">
        <div>
          <h2>유도전동기 원리 설명</h2>
          <p>Educational notes for induction motor analysis</p>
        </div>
        <span className="metric-chip">Study Guide</span>
      </div>

      <div className="education-grid">
        {EDUCATION_ITEMS.map((item, index) => (
          <article className="education-card" key={item.title}>
            <span className="education-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{item.title}</h3>
              <small>{item.subtitle}</small>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

const BASIC_PARAM_KEYS = ['f', 'poles', 'voltage', 'loadPercent', 'inertia']
const EQUIVALENT_PARAM_KEYS = ['r1', 'r2', 'x1', 'x2', 'xm', 'rc']
const ADVANCED_PARAM_KEYS = ['slipPercent', 'friction']
const THERMAL_PARAM_KEYS = ['ambientTemperature', 'thermalResistance', 'thermalCapacitance', 'maxWindingTemperature']

const DASHBOARD_TABS = [
  { id: 'graphs', label: 'Graphs', subtitle: '그래프' },
  { id: 'parameters', label: 'Parameters', subtitle: '파라미터' },
  { id: 'report', label: 'Report', subtitle: '리포트' },
  { id: 'theory', label: 'Theory', subtitle: '원리 설명' },
  { id: 'debug', label: 'Debug', subtitle: '디버그' },
]

const GRAPH_VIEWS = [
  { id: 'torque', label: 'Torque-Speed' },
  { id: 'startup', label: 'Startup Response' },
  { id: 'current', label: 'Three-Phase Current' },
  { id: 'thermal', label: 'Thermal' },
  { id: 'all', label: 'Show All' },
]

const OPERATING_PRESET_PRESENTATION = {
  'no-load': {
    label: '무부하',
    subtitle: 'No-load',
    summary: '정격토크의 약 5%',
    detail: '무부하 조건: 정격토크의 약 5% 부하만 적용합니다.',
  },
  'rated-load': {
    label: '정격부하',
    subtitle: 'Rated load',
    summary: '정격토크 기준 운전',
    detail: '정격부하 조건: 정격토크 기준으로 운전합니다.',
  },
  overload: {
    label: '과부하',
    subtitle: 'Overload',
    summary: '정격토크의 150%',
    detail: '과부하 조건: 정격토크의 150% 부하를 적용합니다.',
  },
  'low-voltage': {
    label: '저전압',
    subtitle: 'Low voltage',
    summary: '정격전압의 80%',
    detail: '저전압 조건: 전압 저하로 토크가 크게 감소할 수 있습니다.',
  },
  'high-slip': {
    label: '고슬립',
    subtitle: 'High slip',
    summary: '정격토크의 180%',
    detail: '고슬립 조건: 과도한 부하로 슬립 증가 및 불안정 운전 가능성이 있습니다.',
  },
  custom: {
    label: '사용자 설정',
    subtitle: 'Custom',
    summary: '직접 조정한 입력 조건',
    detail: '슬라이더 또는 숫자 입력으로 변경한 현재 파라미터를 기준으로 해석합니다.',
  },
}

const getPresetPresentation = (preset) => ({
  ...(OPERATING_PRESET_PRESENTATION[preset.id] ?? {}),
  ...preset,
})

function SidebarAccordion({ children, isOpen, onToggle, subtitle, title }) {
  return (
    <section className={`sidebar-accordion ${isOpen ? 'is-open' : ''}`}>
      <button className="sidebar-accordion-button" type="button" onClick={onToggle}>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <em>{isOpen ? 'Hide' : 'Show'}</em>
      </button>
      {isOpen ? <div className="sidebar-accordion-content">{children}</div> : null}
    </section>
  )
}

function TechnicalParameterPanel({ motor, testProfile }) {
  const preview = calculateRatedPreview(testProfile)
  const ratedRows = [
    ['Rated Power', `${formatCompact(preview.ratedPowerKw, 1)} kW`],
    ['Rated Voltage', `${formatCompact(preview.ratedVoltage, 0)} V`],
    ['Rated Frequency', `${formatCompact(preview.ratedFrequency, 0)} Hz`],
    ['Pole Number', `${formatCompact(preview.poleNumber, 0)} P`],
    ['Rated Speed', `${formatCompact(preview.ratedSpeed, 0)} rpm`],
    ['Rated Current', `${formatCompact(preview.ratedCurrent, 1)} A`],
    ['Power Factor', formatCompact(preview.powerFactor, 2)],
    ['Efficiency', `${formatCompact(preview.efficiency, 1)} %`],
  ]
  const operatingRows = [
    ['Supply Voltage', `${formatCompact(preview.supplyVoltage, 0)} V`],
    ['Supply Frequency', `${formatCompact(preview.supplyFrequency, 0)} Hz`],
    ['Vpu', `${formatCompact(motor.vpu ?? preview.vpu, 3)} pu`],
    ['Voltage Condition', (motor.voltageCondition ?? preview.voltageCondition).label],
    ['Load Model', motor.loadModelLabel ?? getLoadModelLabel(testProfile.loadModel)],
    ['Selected Load Torque', `${formatCompact(motor.loadTorque, 2)} N·m`],
    ['Operating Load Torque', `${formatCompact(motor.operatingLoadTorque, 2)} N·m`],
    ['Inertia J', `${formatCompact(motor.inertia, 4)} kg·m²`],
    ['Parameter Mode', motor.parameterModeLabel ?? getParameterModeLabel(testProfile.parameterMode)],
  ]

  return (
    <section className="panel technical-summary-panel">
      <div className="panel-heading">
        <div>
          <h2>Rated Motor Data / Operating Conditions</h2>
          <p>Nameplate reference values and applied simulation inputs</p>
        </div>
        <span className={`metric-chip voltage-chip-${(motor.voltageCondition ?? preview.voltageCondition).tone}`}>
          {(motor.voltageCondition ?? preview.voltageCondition).label}
        </span>
      </div>
      <div className="technical-summary-grid">
        <div>
          <h3>Rated Motor Data</h3>
          <div className="mapping-check-grid">
            {ratedRows.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h3>Operating Conditions</h3>
          <div className="mapping-check-grid">
            {operatingRows.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ReportValueGrid({ rows }) {
  return (
    <div className="pdf-report-grid">
      {rows.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  )
}

function PdfReportDocument({
  autoOperatingPoint,
  displayedMotor,
  frequencyReactanceScaling,
  motor,
  selectedPreset,
  startupState,
  startupStatusLabel,
  testProfile,
  warnings,
}) {
  const preview = calculateRatedPreview(testProfile)
  const selectedMode = getTestModeOption(testProfile.testMode)
  const voltageClassLabel = testProfile.voltageClass === 'high-voltage'
    ? '고압 모터 / High-voltage motor'
    : '저압 모터 / Low-voltage motor'
  const warningSummary = buildWarningSummary(warnings) || '경고 없음'
  const startupJudgment =
    startupState.hasStartupFailed ||
    motor.hasStartupTorqueReserve === false ||
    motor.startupCanReachTarget === false
      ? '기동 실패 가능 / Startup failure possible'
      : '기동 가능 / Startup available'
  const sourceNote = MOTOR_EXAMPLE_SOURCE_NOTE
  const parameterNote =
    '등가회로 파라미터는 교육용 해석을 위한 값이며 실제 제품과 다를 수 있습니다.'
  const ratedRows = [
    ['정격 출력 [kW]', `${formatCompact(preview.ratedPowerKw, 1)} kW`],
    ['정격 전압 [V]', `${formatCompact(preview.ratedVoltage, 0)} V`],
    ['정격 주파수 [Hz]', `${formatCompact(preview.ratedFrequency, 0)} Hz`],
    ['극수', `${formatCompact(preview.poleNumber, 0)} P`],
    ['정격 속도 [rpm]', `${formatCompact(preview.ratedSpeed, 0)} rpm`],
    ['정격 전류 [A]', `${formatCompact(preview.ratedCurrent, 1)} A`],
    ['역률', formatCompact(preview.powerFactor, 3)],
    ['효율 [%]', `${formatCompact(preview.efficiency, 1)} %`],
    ['정격 토크 [N·m]', `${formatCompact(preview.ratedTorque, 2)} N·m`],
    ['관성 J', `${formatCompact(toProfileNumber(testProfile.inertiaJ, motor.inertia), 4)} kg·m²`],
    ['파라미터 모드', motor.parameterModeLabel ?? getParameterModeLabel(testProfile.parameterMode)],
  ]
  const operatingRows = [
    ['공급 전압 [V]', `${formatCompact(motor.voltage, 0)} V`],
    ['공급 주파수 [Hz]', `${formatCompact(motor.f, 0)} Hz`],
    ['Vpu', `${formatCompact(motor.vpu, 3)} pu`],
    ['전압 상태', `${motor.voltageCondition.label} / ${motor.voltageCondition.subtitle}`],
    ['부하 토크 [N·m]', `${formatCompact(motor.loadTorque, 2)} N·m`],
    ['부하 모델', motor.loadModelLabel ?? getLoadModelLabel(testProfile.loadModel)],
    ['관성 J', `${formatCompact(motor.inertia, 4)} kg·m²`],
    ['자동 운전점 추적', autoOperatingPoint ? 'ON' : 'OFF'],
    ['주파수 리액턴스 보정', frequencyReactanceScaling ? 'ON' : 'OFF'],
    ['적용 프리셋', `${selectedPreset.label} / ${selectedPreset.subtitle}`],
  ]
  const equivalentRows = [
    ['R1', `${formatCompact(motor.r1, 4)} Ω`],
    ["R2'", `${formatCompact(motor.r2, 4)} Ω`],
    ['X1', `${formatCompact(motor.x1, 4)} Ω`],
    ["X2'", `${formatCompact(motor.x2, 4)} Ω`],
    ['Xm', `${formatCompact(motor.xm, 4)} Ω`],
    ['Rc', `${formatCompact(motor.rc, 4)} Ω`],
    ['설정 방식', motor.parameterModeLabel ?? getParameterModeLabel(testProfile.parameterMode)],
    ['설정 메모', motor.parameterEstimationNote || parameterNote],
  ]
  const resultRows = [
    ['동기속도 Ns', `${formatCompact(motor.ns, 0)} rpm`],
    ['회전자 속도 Nr', `${formatCompact(displayedMotor.nr, 0)} rpm`],
    ['슬립', `${formatCompact(displayedMotor.slipPercent, 2)} %`],
    ['전자기 토크 Te', `${formatCompact(displayedMotor.torque, 2)} N·m`],
    ['부하 토크 TL', `${formatCompact(motor.operatingLoadTorque, 2)} N·m`],
    ['기동토크', `${formatCompact(motor.startingTorque, 2)} N·m`],
    ['최대토크', `${formatCompact(motor.maxTorque, 2)} N·m`],
    ['운전점 속도', `${formatCompact(motor.nr, 0)} rpm`],
    ['운전점 슬립', `${formatCompact(motor.slipPercent, 2)} %`],
    ['운전점 판정', motor.operatingJudgment],
    ['기동 판정', startupJudgment],
    ['경고 요약', warningSummary],
  ]

  return (
    <div className="pdf-report-stage" aria-hidden="true">
      <section className="pdf-report-page">
        <div className="pdf-cover">
          <span>MotorAnalyzer</span>
          <h1>MotorAnalyzer 전동기 시험 시뮬레이션 리포트</h1>
          <p>Industrial Motor Test Simulation Report</p>
        </div>
        <ReportValueGrid
          rows={[
            ['사용자', testProfile.userName || '-'],
            ['소속', testProfile.organization || '-'],
            ['프로젝트', testProfile.projectName || '-'],
            ['시험 날짜', testProfile.testDate || '-'],
            ['제조사', getManufacturerLabel(testProfile)],
            ['전압 등급', voltageClassLabel],
            ['전동기 유형', getMotorTypeLabel(testProfile)],
            ['시험 모드', `${selectedMode.label} / ${selectedMode.subtitle}`],
            ['최종 운전 판정', motor.operatingJudgment],
          ]}
        />
        <p className="pdf-report-note">
          본 리포트는 교육용 시뮬레이션 결과이며 실제 산업 현장 적용에는 제조사 데이터시트,
          시험 데이터, 보호 설정, 열해석 검토가 필요합니다.
        </p>
      </section>

      <section className="pdf-report-page">
        <h2>2. 정격 전동기 명판 데이터 / Rated Motor Data</h2>
        <ReportValueGrid rows={ratedRows} />
        <p className="pdf-report-note">{sourceNote}</p>
      </section>

      <section className="pdf-report-page">
        <h2>3. 운전 조건 / Operating Conditions</h2>
        <ReportValueGrid rows={operatingRows} />
      </section>

      <section className="pdf-report-page">
        <h2>4. 등가회로 파라미터 / Equivalent Circuit Parameters</h2>
        <ReportValueGrid rows={equivalentRows} />
        <p className="pdf-report-note">{parameterNote}</p>
      </section>

      <section className="pdf-report-page">
        <h2>5. 주요 시뮬레이션 결과 / Key Simulation Results</h2>
        <ReportValueGrid rows={resultRows} />
      </section>

      <section className="pdf-report-page pdf-graph-page">
        <h2>6. 그래프 / Simulation Graphs</h2>
        <div className="pdf-graph-block">
          <TorqueSpeedChart motor={motor} displayedMotor={displayedMotor} />
          <p>토크-속도 그래프는 전동기 토크 곡선과 부하토크 곡선의 교점을 통해 운전점을 해석합니다.</p>
        </div>
        <div className="pdf-graph-block">
          <StartupResponsePanel motor={motor} startupState={startupState} statusLabel={startupStatusLabel} />
          <p>기동 응답 그래프는 정지 상태에서 운전점까지 가속되는 속도와 토크 변화를 보여줍니다.</p>
        </div>
        <div className="pdf-graph-block">
          <ThreePhaseCurrentPanel motor={displayedMotor} />
          <p>3상 전류 파형은 현재 START/RUN/STOP 상태에 따른 전류 크기와 위상 관계를 보여줍니다.</p>
        </div>
      </section>

      <section className="pdf-report-page">
        <h2>7. 해석 및 이론 / Interpretation</h2>
        <ul className="pdf-theory-list">
          <li>3상 전류에 의해 회전자계가 형성됩니다.</li>
          <li>동기속도는 공급주파수와 극수에 의해 결정됩니다.</li>
          <li>유도전동기는 슬립이 있어야 토크가 발생합니다.</li>
          <li>부하토크가 증가하면 슬립이 증가하고 속도가 감소할 수 있습니다.</li>
          <li>전압이 낮아지면 토크가 전압 제곱에 비례해 감소합니다.</li>
          <li>과전압은 절연 파괴, 철심 포화, 권선 소손 위험이 있습니다.</li>
          <li>
            본 시뮬레이션은 교육용 단순화 모델이며 실제 산업 현장 적용에는 제조사 데이터시트,
            시험 데이터, 보호 설정, 열해석 검토가 필요합니다.
          </li>
        </ul>
      </section>
    </div>
  )
}

function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [autoOperatingPoint, setAutoOperatingPoint] = useState(true)
  const [frequencyReactanceScaling, setFrequencyReactanceScaling] = useState(false)
  const [startupState, setStartupState] = useState(() => createStartupState())
  const [selectedPresetId, setSelectedPresetId] = useState('rated-load')
  const [setupCompleted, setSetupCompleted] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [testProfile, setTestProfile] = useState(() => createDefaultTestProfile())
  const [wizardValidationMessage, setWizardValidationMessage] = useState('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportStatus, setReportStatus] = useState('')
  const [sidebarSections, setSidebarSections] = useState({
    basic: true,
    load: true,
    equivalent: false,
    thermal: false,
    advanced: false,
  })
  const [activeDashboardTab, setActiveDashboardTab] = useState('graphs')
  const [activeGraphView, setActiveGraphView] = useState('all')
  const [windingTemperature, setWindingTemperature] = useState(DEFAULT_PARAMS.ambientTemperature)
  const startupStartTimeRef = useRef(0)
  const lastThermalUpdateRef = useRef(Date.now())
  const reportCaptureRef = useRef(null)
  const pdfReportRef = useRef(null)
  const motor = useMotorSimulation(params, autoOperatingPoint, frequencyReactanceScaling)
  const displayedPresets = useMemo(() => {
    const dynamicPresets = createOperatingPresetsFromParams(params)

    return MOTOR_PRESETS.map((preset) => {
      const dynamicPreset = dynamicPresets[preset.id]

      return getPresetPresentation({
        ...preset,
        ...dynamicPreset,
        values: dynamicPreset?.values ?? preset.values,
      })
    })
  }, [params])
  const selectedPreset =
    displayedPresets.find((preset) => preset.id === selectedPresetId) ??
    getPresetPresentation(CUSTOM_PRESET)
  const startupStatusLabel = getStartupStatusLabel(startupState.status)
  const isStartupFailed = startupState.hasStartupFailed
  const isCoastingDown = startupState.isCoastingDown
  const isRunState =
    startupState.hasStartupFinished &&
    startupState.status === 'finished' &&
    !isCoastingDown
  const isStandbyPreview =
    !startupState.isStarting &&
    !isRunState &&
    !isStartupFailed &&
    !isCoastingDown &&
    startupState.status === 'idle'
  const isMotorEnergized = startupState.isStarting || isRunState || isStartupFailed
  const useStartupRuntimeValues = startupState.isStarting
  const startProhibited = motor.voltageCondition?.isProhibited
  const displayedRotorSpeed = isCoastingDown
    ? startupState.coastDownRotorSpeed
    : isStandbyPreview
      ? motor.nr
    : !isMotorEnergized
    ? 0
    : useStartupRuntimeValues
      ? startupState.startupRotorSpeed
      : isStartupFailed
        ? 0
      : motor.nr
  const displayedSlip = isStandbyPreview
    ? motor.slip
    : !isMotorEnergized
    ? 1
    : useStartupRuntimeValues
      ? startupState.startupSlip
      : isStartupFailed
        ? 1
      : motor.slip
  const displayedSlipPercent = displayedSlip * 100
  const displayedTorque = isStandbyPreview
    ? motor.torque
    : !isMotorEnergized
    ? 0
    : useStartupRuntimeValues
      ? startupState.startupTorque
      : isStartupFailed
        ? startupState.startupTorque
      : motor.torque
  const displayedMotor = useMemo(() => {
    const voltageCondition = motor.voltageCondition ?? getVoltageCondition(motor.vpu)
    const voltageAttention = voltageCondition.tone !== 'normal'
    const hasNoStableOperatingPoint =
      motor.operatingPointMode === 'auto' && !motor.hasLoadIntersection
    const showActiveNoStableOperatingPoint =
      hasNoStableOperatingPoint && isMotorEnergized && !isCoastingDown
    const simulationState = voltageCondition.isProhibited
      ? 'prohibited'
      : isStandbyPreview
        ? 'standby'
      : startupState.isStarting
        ? 'starting'
      : isStartupFailed
        ? 'failed'
      : isCoastingDown
        ? startupState.status === 'emergency'
          ? 'emergency-stop'
          : 'coasting'
      : startupState.status === 'emergency'
        ? 'emergency-stop'
      : startupState.status === 'stopped'
        ? 'stopped'
      : isRunState
        ? 'running'
        : 'standby'
    const startupTone =
      voltageCondition.isProhibited
        ? 'danger'
      : showActiveNoStableOperatingPoint
        ? 'danger'
      : isStandbyPreview
        ? 'stopped'
      : isCoastingDown
        ? startupState.status === 'emergency' ? 'danger' : 'warning'
      : isMotorEnergized && voltageCondition.tone === 'danger'
        ? 'danger'
      : isMotorEnergized && voltageCondition.tone === 'caution'
        ? 'warning'
      : !isMotorEnergized
        ? 'stopped'
        : isStartupFailed
          ? 'danger'
        : startupState.status === 'finished'
        ? 'balanced'
        : startupState.status === 'stopped'
          ? 'warning'
          : 'starting'
    const startupSubtitle =
      voltageCondition.isProhibited
        ? voltageCondition.detail
      : showActiveNoStableOperatingPoint
        ? '전동기 토크와 부하토크가 안정적으로 만나는 지점이 없어 정상 운전이 어렵습니다.'
      : isStandbyPreview
        ? 'Steady-state preview before START'
      : isCoastingDown
        ? startupState.status === 'emergency'
          ? 'Supply is off, rotor is coasting down'
          : 'Supply is off, rotor is coasting down'
      : isMotorEnergized && voltageAttention
        ? voltageCondition.detail
      : !isMotorEnergized
        ? startupState.status === 'emergency'
          ? 'Supply is off, rotor is coasting down'
          : 'Stator supply is off'
        : isStartupFailed
          ? 'Starting torque is lower than initial load torque'
        : startupState.status === 'finished'
        ? 'Startup reached operating speed'
        : startupState.status === 'starting'
          ? 'Rotor is accelerating from standstill'
          : startupState.status === 'stopped'
            ? 'Emergency stop command applied'
            : 'Waiting for startup command'
    const rotorRatio = displayedRotorSpeed / Math.max(motor.ns, 0.0001)
    const currentMode = !isMotorEnergized
      ? 'off'
      : startupState.isStarting || isStartupFailed
        ? 'starting'
        : 'run'
    const currentScale =
      currentMode === 'off'
        ? 0
        : currentMode === 'starting'
          ? clamp(1 + 1.8 * displayedSlip, 1, 2.8)
          : 1
    const displayedCurrentData =
      currentMode === 'off'
        ? motor.currentData.map((point) => ({
          ...point,
          ia: 0,
          ib: 0,
          ic: 0,
        }))
        : motor.currentData.map((point) => ({
            ...point,
            ia: point.ia * currentScale,
            ib: point.ib * currentScale,
            ic: point.ic * currentScale,
          }))

    return {
      ...motor,
      simulationState,
      isMotorEnergized,
      isStandbyPreview,
      isSlipDefined: isStandbyPreview || isMotorEnergized,
      isRotorMoving: isMotorEnergized || isCoastingDown,
      isCoastingDown,
      currentMode,
      nr: clamp(displayedRotorSpeed, 0, motor.ns),
      slip: isStandbyPreview || isMotorEnergized ? clamp(displayedSlip, 0.001, 1) : 1,
      slipPercent: isStandbyPreview || isMotorEnergized
        ? clamp(displayedSlipPercent, 0.1, 100)
        : 100,
      torque: Math.max(0, toFiniteNumber(displayedTorque, 0)),
      currentPeak: isMotorEnergized ? motor.currentPeak * currentScale : 0,
      currentData: displayedCurrentData,
      currentYMax: Math.max(motor.currentYMax * Math.max(currentScale, 0.15), 1),
      operatingPoint: [
        {
          speed: clamp(displayedRotorSpeed, 0, motor.ns),
          torque: Math.max(0, toFiniteNumber(displayedTorque, 0)),
          loadTorque: Math.max(
            0,
            toFiniteNumber(motor.loadTorqueAtSpeed(displayedRotorSpeed), motor.operatingLoadTorque),
          ),
          slip: isStandbyPreview || isMotorEnergized ? clamp(displayedSlip, 0.001, 1) : 1,
        },
      ],
      state: {
        tone: startupTone,
        label: voltageCondition.isProhibited
          ? voltageCondition.label
          : showActiveNoStableOperatingPoint
            ? '안정 운전점 없음'
          : isStandbyPreview
            ? '대기 중 / Standby'
            : isMotorEnergized && voltageAttention
              ? voltageCondition.label
              : startupStatusLabel,
        subtitle: startupSubtitle,
      },
      visualRotorDuration:
        rotorRatio > 0.001 ? motor.visualFieldDuration / rotorRatio : 99999,
      torqueYMax: Math.max(motor.torqueYMax, displayedTorque, 1) * 1.04,
    }
  }, [
    displayedRotorSpeed,
    displayedSlip,
    displayedSlipPercent,
    displayedTorque,
    isCoastingDown,
    isMotorEnergized,
    isStartupFailed,
    isRunState,
    isStandbyPreview,
    motor,
    startupState.isStarting,
    startupState.status,
    startupStatusLabel,
  ])
  const displaySlipText = displayedMotor.isSlipDefined
    ? `${formatNumber(displayedMotor.slipPercent, 2)} %`
    : '--'
  const lossAnalysis = useMemo(
    () => calculateLossEfficiency(motor, displayedMotor),
    [displayedMotor, motor],
  )
  const thermalModel = useMemo(
    () => buildThermalAnalysis({
      displayedMotor,
      lossAnalysis,
      params,
      windingTemperature,
    }),
    [displayedMotor, lossAnalysis, params, windingTemperature],
  )
  const warningCards = useMemo(() => {
    const baseWarnings = getMotorWarnings(displayedMotor)
    const thermalWarnings = buildThermalWarnings(thermalModel)
    const visibleBaseWarnings = thermalWarnings.length > 0
      ? baseWarnings.filter((warning) => warning.id !== 'normal')
      : baseWarnings

    return [...visibleBaseWarnings, ...thermalWarnings]
  }, [displayedMotor, thermalModel])

  useEffect(() => {
    if (!setupCompleted) return undefined

    lastThermalUpdateRef.current = Date.now()
    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const dtSeconds = Math.min(5, Math.max(0.1, (now - lastThermalUpdateRef.current) / 1000))
      lastThermalUpdateRef.current = now

      setWindingTemperature((currentTemperature) => stepThermalModel({
        ambientTemperature: params.ambientTemperature,
        currentTemperature,
        dtSeconds,
        lossPowerW:
          displayedMotor.isMotorEnergized && !displayedMotor.voltageCondition?.isProhibited
            ? lossAnalysis.totalLossW
            : 0,
        ratedSpeedRpm: params.ratedSpeedReference,
        rotorSpeedRpm: displayedMotor.nr,
        thermalCapacitance: params.thermalCapacitance,
        thermalResistance: params.thermalResistance,
      }))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [
    displayedMotor.isMotorEnergized,
    displayedMotor.nr,
    displayedMotor.voltageCondition?.isProhibited,
    lossAnalysis.totalLossW,
    params.ambientTemperature,
    params.ratedSpeedReference,
    params.thermalCapacitance,
    params.thermalResistance,
    setupCompleted,
  ])

  useEffect(() => {
    if (!startupState.isStarting) return undefined

    const profile = motor.startupProfile
    const fallbackFinalPoint = {
      time: 0,
      speed: motor.nr,
      torque: motor.torque,
      loadTorque: motor.operatingLoadTorque,
      slipPercent: motor.slipPercent,
    }
    const finalPoint = profile[profile.length - 1] ?? fallbackFinalPoint
    const profileFinalTime = Math.max(finalPoint.time, 0.001)
    const finalTime = Math.max(profileFinalTime, motor.startupCanReachTarget === false ? profileFinalTime : 1.6)
    let frameId

    const tick = (timestamp) => {
      if (!startupStartTimeRef.current) {
        startupStartTimeRef.current = timestamp
      }

      const elapsed = Math.max(0, (timestamp - startupStartTimeRef.current) / 1000)

      if (motor.hasStartupTorqueReserve === false) {
        const failedPoint = {
          time: Number(elapsed.toFixed(2)),
          speed: 0,
          torque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
          loadTorque: Math.max(0, toFiniteNumber(motor.startingLoadTorque, 0)),
          slipPercent: 100,
        }

        setStartupState((current) => {
          if (!current.isStarting) return current

          return {
            ...current,
            isStarting: false,
            startupTime: failedPoint.time,
            startupProgress: 0,
            startupRotorSpeed: 0,
            startupSlip: 1,
            startupTorque: failedPoint.torque,
            startupData: buildStartupTrace(current.startupData, failedPoint),
            hasStartupFinished: false,
            hasStartupFailed: true,
            status: 'failed',
            useStartupDisplay: true,
          }
        })
        return
      }

      const profileElapsed =
        finalTime > profileFinalTime
          ? elapsed * (profileFinalTime / finalTime)
          : elapsed
      const sampledPoint = getStartupPoint(profile, profileElapsed)
      const reachedSpeed =
        motor.nr <= 0.5 || sampledPoint.speed >= Math.max(0, motor.nr - 0.5)
      const profileEnded = elapsed >= finalTime
      const failedToReachTarget =
        profileEnded &&
        motor.nr > 0.5 &&
        (motor.startupCanReachTarget === false ||
          Math.max(0, toFiniteNumber(finalPoint.speed, 0)) < motor.nr * 0.95)
      const finished = profileEnded || reachedSpeed
      const basePoint = finished ? finalPoint : sampledPoint
      const safeSpeed = clamp(basePoint.speed, 0, motor.nr)
      const safeSlip = clamp(basePoint.slipPercent / 100, 0.001, 1)
      const safeTorque = Math.max(0, toFiniteNumber(basePoint.torque, 0))
      const livePoint = {
        time: Number(Math.min(basePoint.time, finalTime).toFixed(2)),
        speed: safeSpeed,
        torque: safeTorque,
        loadTorque: Math.max(0, toFiniteNumber(basePoint.loadTorque, motor.loadTorqueAtSpeed(safeSpeed))),
        slipPercent: safeSlip * 100,
      }
      const completedTrace = profile.length > 0 ? profile : [livePoint]

      setStartupState((current) => {
        if (!current.isStarting) return current

        return {
          ...current,
          isStarting: !finished && !failedToReachTarget,
          startupTime: livePoint.time,
          startupProgress: finished ? 1 : clamp(elapsed / finalTime, 0, 1),
          startupRotorSpeed: safeSpeed,
          startupSlip: safeSlip,
          startupTorque: safeTorque,
          startupData: finished ? completedTrace : buildStartupTrace(profile, livePoint),
          hasStartupFinished: finished && !failedToReachTarget,
          hasStartupFailed: failedToReachTarget,
          status: failedToReachTarget ? 'failed' : finished ? 'finished' : 'starting',
          useStartupDisplay: true,
        }
      })

      if (!finished && !failedToReachTarget) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [
    motor,
    startupState.isStarting,
  ])

  useEffect(() => {
    if (!startupState.isCoastingDown) return undefined

    let frameId
    let lastTime
    let omega = Math.max(0, (startupState.coastDownRotorSpeed * 2 * Math.PI) / 60)
    const inertia = Math.max(0.0001, toFiniteNumber(motor.inertia, DEFAULT_PARAMS.inertia))
    const friction = Math.max(0, toFiniteNumber(motor.friction, DEFAULT_PARAMS.friction))
    const loadTorqueAtSpeed = motor.loadTorqueAtSpeed
    const coastStatus = startupState.status === 'emergency' ? 'emergency' : 'stopped'
    const coastMultiplier = Math.max(0.1, toFiniteNumber(startupState.coastDownDecelMultiplier, 1))

    const tick = (timestamp) => {
      if (lastTime === undefined) {
        lastTime = timestamp
      }

      const dt = Math.min((timestamp - lastTime) / 1000, 0.08)
      lastTime = timestamp

      const speed = Math.max(0, (omega * 60) / (2 * Math.PI))
      const dynamicLoadTorque = Math.max(0, toFiniteNumber(loadTorqueAtSpeed(speed), 0))
      const deceleration = -coastMultiplier * (dynamicLoadTorque + friction * omega) / inertia
      omega = Math.max(0, omega + deceleration * dt)
      const nextSpeed = Math.max(0, (omega * 60) / (2 * Math.PI))
      const stopped = nextSpeed <= 0.5

      setStartupState((current) => {
        if (!current.isCoastingDown) return current

        return {
          ...current,
          isCoastingDown: !stopped,
          coastDownRotorSpeed: stopped ? 0 : nextSpeed,
          startupRotorSpeed: stopped ? 0 : nextSpeed,
          startupSlip: 1,
          startupTorque: 0,
          startupProgress: 0,
          hasStartupFinished: false,
          hasStartupFailed: false,
          status: coastStatus,
          useStartupDisplay: true,
        }
      })

      if (!stopped) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [
    startupState.isCoastingDown,
    startupState.status,
  ])

  const startStartupSimulation = () => {
    if (startProhibited) {
      startupStartTimeRef.current = 0
      setStartupState(
        createStartupState({
          hasStartupFailed: true,
          startupSlip: 1,
          startupTorque: 0,
          startupData: [
            {
              time: 0,
              speed: 0,
              torque: 0,
              loadTorque: Math.max(0, toFiniteNumber(motor.startingLoadTorque, 0)),
              slipPercent: 100,
            },
          ],
          status: 'failed',
          useStartupDisplay: true,
        }),
      )
      return
    }

    const initialPoint = motor.startupProfile[0] ?? {
      time: 0,
      speed: 0,
      torque: motor.startingTorque,
      slipPercent: 100,
    }
    const startingTorqueInsufficient = motor.hasStartupTorqueReserve === false

    startupStartTimeRef.current = performance.now()

    if (startingTorqueInsufficient) {
      setStartupState(
        createStartupState({
          hasStartupFailed: true,
          startupTorque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
          startupSlip: 1,
          startupData: [
            {
              time: 0,
              speed: 0,
              torque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
              loadTorque: Math.max(0, toFiniteNumber(motor.startingLoadTorque, 0)),
              slipPercent: 100,
            },
            {
              time: 1,
              speed: 0,
              torque: Math.max(0, toFiniteNumber(motor.startingTorque, 0)),
              loadTorque: Math.max(0, toFiniteNumber(motor.startingLoadTorque, 0)),
              slipPercent: 100,
            },
          ],
          status: 'failed',
          useStartupDisplay: true,
        }),
      )
      return
    }

    setStartupState(
      createStartupState({
        isStarting: true,
        startupTorque: Math.max(0, toFiniteNumber(initialPoint.torque, 0)),
        startupData: [
          {
            time: 0,
            speed: 0,
            torque: Math.max(0, toFiniteNumber(initialPoint.torque, 0)),
            loadTorque: Math.max(0, toFiniteNumber(initialPoint.loadTorque, motor.startingLoadTorque)),
            slipPercent: 100,
          },
        ],
        status: 'starting',
        useStartupDisplay: true,
      }),
    )
  }

  const resetStartupSimulation = () => {
    const coastStartSpeed = Math.max(
      0,
      toFiniteNumber(isMotorEnergized || isCoastingDown ? displayedRotorSpeed : 0, 0),
    )

    startupStartTimeRef.current = 0
    if ((isMotorEnergized || isCoastingDown) && coastStartSpeed > 0.5) {
      setStartupState(
        createStartupState({
          isCoastingDown: true,
          coastDownDecelMultiplier: 1,
          coastDownRotorSpeed: coastStartSpeed,
          startupRotorSpeed: coastStartSpeed,
          status: 'stopped',
          useStartupDisplay: true,
        }),
      )
      return
    }

    setStartupState(
      createStartupState({
        status: 'idle',
        useStartupDisplay: true,
      }),
    )
  }

  const emergencyStopSimulation = () => {
    const coastStartSpeed = Math.max(
      0,
      toFiniteNumber(isMotorEnergized || isCoastingDown ? displayedRotorSpeed : 0, 0),
    )

    startupStartTimeRef.current = 0
    setStartupState(
      createStartupState({
        isCoastingDown: coastStartSpeed > 0.5,
        coastDownDecelMultiplier: 1.6,
        coastDownRotorSpeed: coastStartSpeed,
        startupRotorSpeed: coastStartSpeed,
        status: 'emergency',
        useStartupDisplay: true,
      }),
    )
  }

  const updateOperatingMode = (enabled) => {
    startupStartTimeRef.current = 0
    setStartupState(createStartupState())
    setAutoOperatingPoint(enabled)
  }

  const applyPreset = (presetId) => {
    const dynamicPresets = createOperatingPresetsFromParams(params)
    const preset = dynamicPresets[presetId]
    if (!preset) return

    setSelectedPresetId(presetId)
    setStartupState((current) => {
      if (current.status !== 'idle' && current.status !== 'stopped') {
        return current
      }

      return {
        ...current,
        isStarting: false,
        hasStartupFinished: false,
        startupRotorSpeed: 0,
        startupSlip: 1,
        startupTorque: 0,
        startupProgress: 0,
        useStartupDisplay: true,
      }
    })
    setParams((current) => {
      const nextPreset = createOperatingPresetsFromParams(current)[presetId]

      if (!nextPreset || nextPreset.ratedTorque <= 0) {
        setReportStatus('프리셋 배율 적용에는 유효한 정격 출력과 정격 속도가 필요합니다. 현재 부하토크를 유지했습니다.')
        return current
      }

      setReportStatus('')
      const nextParams = applyOperatingPresetToParams(current, nextPreset)

      setTestProfile((profile) => ({
        ...profile,
        supplyVoltage: nextParams.voltage,
        supplyFrequency: nextParams.f,
        loadPercent: nextParams.loadPercent,
        loadTorque: nextParams.loadTorque,
        loadModel: nextParams.loadModel,
        exampleProfileId: profile.exampleProfileId ?? 'custom',
      }))

      return nextParams
    })
  }

  const getRuntimeParamConfig = (key, sourceParams = params) => {
    const config = PARAM_CONTROLS.find((item) => item.key === key)
    if (!config) return null

    const ratedData = getRatedDataFromParams(sourceParams)

    if (key === 'loadPercent') {
      const currentPercent = toFiniteNumber(
        sourceParams.loadPercent,
        calculateLoadPercent(sourceParams.loadTorque, ratedData.ratedTorque, 100),
      )
      const maxPercent = Math.max(200, currentPercent * 1.2, 100)

      return {
        ...config,
        min: 0,
        max: Number(maxPercent.toFixed(1)),
        inputMax: 300,
        step: 1,
      }
    }

    if (key === 'inertia') {
      const inertia = Math.max(0.0001, toFiniteNumber(sourceParams.inertia, ratedData.inertiaJ))
      const maxInertia = Math.max(config.max, inertia * 2, ratedData.inertiaJ * 2, 0.01)

      return {
        ...config,
        max: Number(maxInertia.toFixed(3)),
        inputMax: Number(maxInertia.toFixed(3)),
        step: inertia >= 10 ? 0.1 : inertia >= 1 ? 0.01 : config.step,
      }
    }

    if (key === 'voltage') {
      const ratedVoltage = Math.max(1, ratedData.ratedVoltage)

      return {
        ...config,
        min: Number((ratedVoltage * 0.5).toFixed(2)),
        max: Number((ratedVoltage * 1.2).toFixed(2)),
        inputMin: 0,
        inputMax: Math.max(config.max, Number((ratedVoltage * 1.5).toFixed(2))),
        step: ratedVoltage >= 1000 ? 50 : 5,
      }
    }

    if (key === 'f') {
      const ratedFrequency = Math.max(1, ratedData.ratedFrequency)

      return {
        ...config,
        min: Number((ratedFrequency * 0.5).toFixed(2)),
        max: Number((ratedFrequency * 1.2).toFixed(2)),
        inputMin: 0.001,
        inputMax: Math.max(config.max, Number((ratedFrequency * 2).toFixed(2))),
      }
    }

    return config
  }

  const updateParam = (key, rawValue) => {
    const config = getRuntimeParamConfig(key, params)
    const value = toFiniteNumber(rawValue, DEFAULT_PARAMS[key])
    const max = config?.inputMax ?? config?.max
    const min = config?.inputMin ?? config?.min
    const bounded = config ? clamp(value, min, max) : value

    startupStartTimeRef.current = 0
    setStartupState(createStartupState())
    setSelectedPresetId('custom')
    setParams((current) => {
      const nextValue = key === 'poles' ? Math.max(1, Math.round(bounded)) : bounded
      const ratedData = getRatedDataFromParams(current)
      const loadPatch = key === 'loadPercent'
        ? {
          loadPercent: nextValue,
          loadTorque: calculateLoadTorqueFromPercent(nextValue, ratedData.ratedTorque),
        }
        : {}

      return {
        ...current,
        [key]: nextValue,
        ...loadPatch,
        ...(key === 'r1' || key === 'r2' || key === 'x1' || key === 'x2' || key === 'xm' || key === 'rc'
          ? {
            parameterMode: 'manual',
            parameterEstimationStatus: 'ok',
            parameterEstimationNote: '대시보드에서 수동 조정한 등가회로 파라미터입니다.',
          }
          : {}),
      }
    })
  }

  const applyTestProfileToSimulation = (profile) => {
    const baseParams = createSimulationParamsFromProfile(profile)
    const profilePresets = createOperatingPresetsFromMotorProfile(profile)
    const startupPreset = getPresetForTestMode(profile.testMode, profilePresets, 'rated-load')
    const mappedParams = applyOperatingPresetToParams(baseParams, startupPreset)

    startupStartTimeRef.current = 0
    setAutoOperatingPoint(true)
    setSelectedPresetId(startupPreset?.id ?? 'custom')
    setStartupState(createStartupState({ status: 'idle', useStartupDisplay: true }))
    setWindingTemperature(mappedParams.ambientTemperature ?? DEFAULT_PARAMS.ambientTemperature)
    lastThermalUpdateRef.current = Date.now()
    setTestProfile((current) => ({
      ...current,
      supplyVoltage: mappedParams.voltage,
      supplyFrequency: mappedParams.f,
      loadPercent: mappedParams.loadPercent,
      loadTorque: mappedParams.loadTorque,
      loadModel: mappedParams.loadModel,
    }))
    setParams((current) => ({
      ...current,
      ...mappedParams,
    }))
  }

  const validateWizardStep = (step) => {
    if (step === 1 && !testProfile.userName.trim()) {
      return '사용자 이름을 입력하세요. / User name is required.'
    }

    if (step === 4) {
      const ratedPower = toFiniteNumber(testProfile.ratedPowerKw, 0)
      const ratedVoltage = toFiniteNumber(testProfile.ratedVoltage, 0)
      const ratedFrequency = toFiniteNumber(testProfile.ratedFrequency, 0)
      const supplyVoltage = toProfileNumber(testProfile.supplyVoltage, ratedVoltage)
      const supplyFrequency = toProfileNumber(testProfile.supplyFrequency, ratedFrequency)
      const poles = toFiniteNumber(testProfile.poleNumber, 0)
      const ratedSpeed = toFiniteNumber(testProfile.ratedSpeed, 0)
      const parameterMode = getParameterModeOption(testProfile.parameterMode).value

      if (
        ratedPower <= 0 ||
        ratedVoltage <= 0 ||
        ratedFrequency <= 0 ||
        supplyVoltage < 0 ||
        supplyFrequency <= 0 ||
        poles <= 0 ||
        ratedSpeed <= 0
      ) {
        return '정격 출력, 정격 전압, 주파수, 극수, 정격 속도는 0보다 커야 하며 공급 전압은 음수가 될 수 없습니다.'
      }

      if (
        parameterMode === 'manual' &&
        EQUIVALENT_PARAMETER_FIELDS.some(
          (field) => toFiniteNumber(testProfile[field.key], 0) <= 0,
        )
      ) {
        return '수동 등가회로 파라미터는 모두 0보다 커야 합니다.'
      }
    }

    return ''
  }

  const handleWizardNext = () => {
    const message = validateWizardStep(currentStep)

    if (message) {
      setWizardValidationMessage(message)
      return
    }

    setWizardValidationMessage('')
    setCurrentStep((step) => Math.min(step + 1, 6))
  }

  const handleWizardBack = () => {
    setWizardValidationMessage('')
    setCurrentStep((step) => Math.max(step - 1, 1))
  }

  const handleStartSimulationFromWizard = () => {
    const message = validateWizardStep(currentStep)

    if (message) {
      setWizardValidationMessage(message)
      return
    }

    applyTestProfileToSimulation(testProfile)
    setWizardValidationMessage('')
    setReportStatus('')
    setSetupCompleted(true)
  }

  const handleEditSetup = () => {
    setReportStatus('')
    setCurrentStep(1)
    setSetupCompleted(false)
  }

  const handleNewTest = () => {
    const nextProfile = createDefaultTestProfile()

    startupStartTimeRef.current = 0
    setParams(DEFAULT_PARAMS)
    setAutoOperatingPoint(true)
    setFrequencyReactanceScaling(false)
    setStartupState(createStartupState())
    setWindingTemperature(DEFAULT_PARAMS.ambientTemperature)
    lastThermalUpdateRef.current = Date.now()
    setSelectedPresetId('rated-load')
    setTestProfile(nextProfile)
    setCurrentStep(1)
    setWizardValidationMessage('')
    setReportStatus('')
    setSetupCompleted(false)
  }

  const handleGeneratePdfReport = async () => {
    const PdfConstructor = jsPDF.jsPDF ?? jsPDF
    const safeUserName = sanitizeFileName(testProfile.userName || 'User')
    const safeDate = sanitizeFileName(testProfile.testDate || getLocalDateString())
    const fileName = `MotorAnalyzer_Report_${safeUserName}_${safeDate}.pdf`
    const pdf = new PdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const reportPages = Array.from(pdfReportRef.current?.querySelectorAll('.pdf-report-page') ?? [])

    setIsGeneratingReport(true)
    setReportStatus('PDF 생성 중...')

    try {
      if (reportPages.length === 0) {
        throw new Error('Report DOM pages are not available.')
      }

      for (let index = 0; index < reportPages.length; index += 1) {
        const page = reportPages[index]
        const canvas = await html2canvas(page, {
          backgroundColor: '#ffffff',
          logging: false,
          scale: 1.7,
          useCORS: true,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight,
        })
        const image = canvas.toDataURL('image/png')
        const imageRatio = canvas.width / Math.max(canvas.height, 1)
        const imageWidth = pageWidth
        const imageHeight = Math.min(pageWidth / imageRatio, pageHeight)
        const y = Math.max(0, (pageHeight - imageHeight) / 2)

        if (index > 0) {
          pdf.addPage()
        }

        pdf.addImage(image, 'PNG', 0, y, imageWidth, imageHeight)
      }

      pdf.save(fileName)
      setReportStatus('PDF 리포트가 생성되었습니다.')
    } catch (error) {
      try {
        const fallbackPdf = new PdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        fallbackPdf.setFont('helvetica', 'normal')
        fallbackPdf.setFontSize(14)
        fallbackPdf.text('MotorAnalyzer simulation report', 16, 24)
        fallbackPdf.setFontSize(10)
        fallbackPdf.text('HTML report capture failed. A simplified fallback report was generated.', 16, 36)
        fallbackPdf.text(`Reason: ${String(error.message || error).slice(0, 120)}`, 16, 46)
        fallbackPdf.text(`Ns: ${formatCompact(motor.ns, 0)} rpm`, 16, 60)
        fallbackPdf.text(`Nr: ${formatCompact(displayedMotor.nr, 0)} rpm`, 16, 68)
        fallbackPdf.text(`Te: ${formatCompact(displayedMotor.torque, 2)} N m`, 16, 76)
        fallbackPdf.text(`Vpu: ${formatCompact(motor.vpu, 3)} pu`, 16, 84)
        fallbackPdf.save(fileName)
        setReportStatus('HTML 캡처 실패로 간이 PDF 리포트를 생성했습니다.')
      } catch (fallbackError) {
        setReportStatus(`PDF 생성 중 오류가 발생했습니다. ${fallbackError.message}`)
      }
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const toggleSidebarSection = (sectionKey) => {
    setSidebarSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }))
  }

  const renderParamControl = (key) => {
    const config = getRuntimeParamConfig(key, params)

    if (!config) return null

    return (
      <ParamControl
        key={config.key}
        config={config}
        value={params[config.key]}
        onChange={updateParam}
      />
    )
  }

  if (!setupCompleted) {
    return (
      <SetupWizard
        currentStep={currentStep}
        testProfile={testProfile}
        validationMessage={wizardValidationMessage}
        onBack={handleWizardBack}
        onChange={setTestProfile}
        onNext={handleWizardNext}
        onStart={handleStartSimulationFromWizard}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">MA</span>
          <div>
            <h1>MotorAnalyzer</h1>
            <p>3상 유도전동기 해석 시뮬레이터</p>
            <small>3-phase induction motor simulator</small>
          </div>
        </div>

        <div className="sidebar-section-title">
          <span>입력 파라미터</span>
          <small>Input parameters</small>
        </div>

        <MotorControlPanel
          displayedRotorSpeed={displayedRotorSpeed}
          displayedSlipText={displaySlipText}
          onEmergencyStop={emergencyStopSimulation}
          onReset={resetStartupSimulation}
          onStart={startStartupSimulation}
          startDisabled={startProhibited}
          startDisabledReason="운전 불가 전압 조건입니다. 정격전압 대비 공급 전압을 낮춘 뒤 START를 실행하세요."
          startupState={startupState}
          statusLabel={startupStatusLabel}
        />

        <PresetPanel
          onSelect={applyPreset}
          presets={displayedPresets}
          selectedPreset={selectedPreset}
        />

        <SidebarAccordion
          isOpen={sidebarSections.basic}
          onToggle={() => toggleSidebarSection('basic')}
          title="Basic Operating Conditions"
          subtitle="공급 조건 / 부하 조건"
        >
          <div className="param-list">
            {BASIC_PARAM_KEYS.map(renderParamControl)}
          </div>
        </SidebarAccordion>

        <SidebarAccordion
          isOpen={sidebarSections.load}
          onToggle={() => toggleSidebarSection('load')}
          title="Load Model Settings"
          subtitle="부하 모델"
        >
          <div className="sidebar-readout-panel">
            <span>Selected Load Model</span>
            <strong>{motor.loadModelLabel ?? getLoadModelLabel(params.loadModel)}</strong>
            <p>{motor.loadModelDescription}</p>
            {motor.loadModelNote ? <p>{motor.loadModelNote}</p> : null}
            <small>Load model selection is configured in the setup wizard and reflected in the simulation.</small>
          </div>
        </SidebarAccordion>

        <SidebarAccordion
          isOpen={sidebarSections.equivalent}
          onToggle={() => toggleSidebarSection('equivalent')}
          title="Equivalent Circuit Parameters"
          subtitle="R1 / R2 / X1 / X2 / Xm / Rc"
        >
          <div className="param-list">
            {EQUIVALENT_PARAM_KEYS.map(renderParamControl)}
          </div>
        </SidebarAccordion>

        <SidebarAccordion
          isOpen={sidebarSections.thermal}
          onToggle={() => toggleSidebarSection('thermal')}
          title="Thermal Model Settings"
          subtitle="권선온도 / 열저항 / 열용량"
        >
          <div className="param-list">
            {THERMAL_PARAM_KEYS.map(renderParamControl)}
          </div>
        </SidebarAccordion>

        <SidebarAccordion
          isOpen={sidebarSections.advanced}
          onToggle={() => toggleSidebarSection('advanced')}
          title="Advanced Simulation Options"
          subtitle="슬립 / 마찰 / 추적 옵션"
        >
          <div className="sidebar-advanced-stack">
            <OperatingModeToggle
              enabled={autoOperatingPoint}
              onChange={updateOperatingMode}
            />

            <FrequencyScalingToggle
              enabled={frequencyReactanceScaling}
              motor={motor}
              onChange={setFrequencyReactanceScaling}
            />

            <div className="param-list">
              {ADVANCED_PARAM_KEYS.map(renderParamControl)}
            </div>
          </div>
        </SidebarAccordion>
      </aside>

      <main className="dashboard">
        <div className="top-status-bar">
          <div className="status-title">
            <span className="status-logo">MA</span>
            <div>
              <strong>MotorAnalyzer</strong>
              <small>Power electronics simulation workspace</small>
            </div>
          </div>
          <div className="status-badge-row">
            <div className="status-live">
              <span className="live-dot"></span>
              <span>Live Simulation</span>
            </div>
            <span className={`state-chip state-chip-${displayedMotor.state.tone}`}>
              {displayedMotor.state.label}
            </span>
            <span className={`state-chip ${motor.hasLoadIntersection ? 'state-chip-balanced' : 'state-chip-danger'}`}>
              {motor.operatingJudgment}
            </span>
          </div>
        </div>

        <TestSessionHeader
          isGeneratingReport={isGeneratingReport}
          motor={motor}
          onEditSetup={handleEditSetup}
          onGenerateReport={handleGeneratePdfReport}
          onNewTest={handleNewTest}
          reportStatus={reportStatus}
          testProfile={testProfile}
        />

        <header className="dashboard-header">
          <div>
            <span className="eyebrow">Engineering Simulation Dashboard</span>
            <h2>유도전동기 운전점 분석</h2>
            <p>
              Thevenin 등가회로로 토크, 속도, 전류 파형을 실시간 계산합니다.
            </p>
          </div>

          <div className="header-readouts" aria-label="main computed values">
            <span>
              Ns <strong>{formatCompact(motor.ns, 0)} rpm</strong>
            </span>
            <span>
              Nr <strong>{formatCompact(displayedMotor.nr, 0)} rpm</strong>
            </span>
            <span>
              Te <strong>{formatCompact(displayedMotor.torque, 2)} N·m</strong>
            </span>
          </div>
        </header>

        <div className="report-capture-region" ref={reportCaptureRef}>
        <section className="result-grid" aria-label="computed result cards">
          <ResultCard
            label="동기 속도 Ns"
            subtitle="Synchronous speed"
            value={formatNumber(motor.ns, 0)}
            unit="rpm"
          />
          <ResultCard
            label="회전자 속도 Nr"
            subtitle={
              displayedMotor.operatingPointMode === 'auto'
                ? 'Auto operating speed'
                : 'Manual slip speed'
            }
            value={formatNumber(displayedMotor.nr, 0)}
            unit="rpm"
          />
          <ResultCard
            label="슬립 s"
            subtitle={
              displayedMotor.isSlipDefined
                ? displayedMotor.operatingPointMode === 'auto'
                  ? `수동 기준 ${formatCompact(motor.manualSlipPercent, 2)}%`
                  : `s = ${formatCompact(displayedMotor.slip, 4)}`
                : '정지 상태에서는 회전자계가 없으므로 슬립은 정의되지 않음 / Slip is not defined when the rotating field is OFF.'
            }
            value={displayedMotor.isSlipDefined ? formatNumber(displayedMotor.slipPercent, 2) : '--'}
            unit={displayedMotor.isSlipDefined ? '%' : ''}
          />
          <ResultCard
            label="전자기 토크 Te"
            subtitle={
              displayedMotor.operatingPointMode === 'auto'
                ? 'At load intersection'
                : 'At manual slip'
            }
            tone="accent"
            value={formatNumber(displayedMotor.torque, 2)}
            unit="N·m"
          />
          <ResultCard
            label="기동 토크"
            subtitle="Starting torque"
            value={formatNumber(motor.startingTorque, 2)}
            unit="N·m"
          />
          <ResultCard
            label="최대 토크"
            subtitle={`${formatCompact(motor.maxTorqueSpeed, 0)} rpm에서 발생`}
            tone="hot"
            value={formatNumber(motor.maxTorque, 2)}
            unit="N·m"
          />
          <ResultCard
            label="부하 모델"
            subtitle="Selected load model"
            value={getLoadModelOption(motor.loadModel).label}
            unit=""
          />
          <ResultCard
            label="운전점 부하 토크 TL"
            subtitle="Load torque at operating point"
            value={formatNumber(motor.operatingLoadTorque, 2)}
            unit="N·m"
          />
          <ResultCard
            label="운전점 판정"
            subtitle="Operating point judgment"
            tone={motor.hasLoadIntersection ? 'balanced' : 'danger'}
            value={motor.hasLoadIntersection ? '안정' : '불안정'}
            unit=""
          />
          <ResultCard
            label="전압 조건 Vpu"
            subtitle={motor.voltageCondition.label}
            tone={motor.voltageCondition.tone === 'normal' ? 'balanced' : motor.voltageCondition.tone === 'caution' ? 'warning' : 'danger'}
            value={formatNumber(motor.vpu, 3)}
            unit="pu"
          />
          <ResultCard
            label={displayedMotor.state.label}
            subtitle={displayedMotor.state.subtitle}
            tone={displayedMotor.state.tone}
            value={
  displayedMotor.hasLoadIntersection
    ? displayedMotor.operatingPointMode === 'auto'
      ? '안정'
      : '수동'
    : '불안정'
}
            unit=""
          />
        </section>

        <section className="always-visible-grid">
          <MotorVisualization motor={displayedMotor} />
          <Motor3DPanel motor={displayedMotor} />
          <WarningPanel warnings={warningCards} />
        </section>
        </div>

        <section className="dashboard-tabs-section">
          <div className="dashboard-tab-list" role="tablist" aria-label="secondary dashboard panels">
            {DASHBOARD_TABS.map((tab) => (
              <button
                aria-selected={activeDashboardTab === tab.id}
                className={`dashboard-tab-button ${activeDashboardTab === tab.id ? 'is-active' : ''}`}
                key={tab.id}
                onClick={() => setActiveDashboardTab(tab.id)}
                role="tab"
                type="button"
              >
                <span>{tab.label}</span>
                <small>{tab.subtitle}</small>
              </button>
            ))}
          </div>

          <div className="dashboard-tab-panel">
            {activeDashboardTab === 'graphs' ? (
              <div className="graphs-tab">
                <div className="graph-selector" aria-label="graph selector">
                  {GRAPH_VIEWS.map((view) => (
                    <button
                      className={`graph-selector-button ${activeGraphView === view.id ? 'is-active' : ''}`}
                      key={view.id}
                      onClick={() => setActiveGraphView(view.id)}
                      type="button"
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
                {(activeGraphView === 'torque' || activeGraphView === 'all') ? (
                  <TorqueSpeedChart motor={motor} displayedMotor={displayedMotor} />
                ) : null}
                {(activeGraphView === 'startup' || activeGraphView === 'all') ? (
                  <StartupResponsePanel
                    motor={motor}
                    startupState={startupState}
                    statusLabel={startupStatusLabel}
                  />
                ) : null}
                {(activeGraphView === 'current' || activeGraphView === 'all') ? (
                  <ThreePhaseCurrentPanel motor={displayedMotor} />
                ) : null}
                {(activeGraphView === 'thermal' || activeGraphView === 'all') ? (
                  <ThermalChart thermal={thermalModel} />
                ) : null}
              </div>
            ) : null}

            {activeDashboardTab === 'parameters' ? (
              <div className="parameters-tab">
                <TechnicalParameterPanel motor={motor} testProfile={testProfile} />
                <LossEfficiencyPanel motor={motor} displayedMotor={displayedMotor} />
                <ThermalModelPanel thermal={thermalModel} />
                <EquivalentParameterDashboardPanel motor={motor} />
                <MappingCheckPanel
                  motor={motor}
                  params={params}
                  selectedPreset={selectedPreset}
                  startupState={startupState}
                  testProfile={testProfile}
                />
              </div>
            ) : null}

            {activeDashboardTab === 'report' ? (
              <div className="report-tab">
                <div className="report-tab-toolbar">
                  <div>
                    <strong>PDF Report</strong>
                    <span>Generate the same MotorAnalyzer report from the active simulation session.</span>
                  </div>
                  <button
                    className="session-button session-button-primary"
                    disabled={isGeneratingReport}
                    onClick={handleGeneratePdfReport}
                    type="button"
                  >
                    {isGeneratingReport ? 'PDF 생성 중...' : 'PDF 리포트 생성 / Generate PDF Report'}
                  </button>
                </div>
                {reportStatus ? <div className="report-status">{reportStatus}</div> : null}
                <ReportPreviewPanel
                  motor={displayedMotor}
                  testProfile={testProfile}
                  warnings={warningCards}
                />
              </div>
            ) : null}

            {activeDashboardTab === 'theory' ? <EducationPanel /> : null}

            {activeDashboardTab === 'debug' ? (
              <div className="debug-tab">
                <MappingCheckPanel
                  motor={motor}
                  params={params}
                  selectedPreset={selectedPreset}
                  startupState={startupState}
                  testProfile={testProfile}
                />
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <div ref={pdfReportRef}>
        <PdfReportDocument
          autoOperatingPoint={autoOperatingPoint}
          displayedMotor={displayedMotor}
          frequencyReactanceScaling={frequencyReactanceScaling}
          motor={motor}
          selectedPreset={selectedPreset}
          startupState={startupState}
          startupStatusLabel={startupStatusLabel}
          testProfile={testProfile}
          warnings={warningCards}
        />
      </div>
    </div>
  )
}

export default App
