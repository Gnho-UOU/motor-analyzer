export const WIZARD_STEPS = [
  { number: 1, label: '사용자 정보', subtitle: 'User' },
  { number: 2, label: '모터 유형', subtitle: 'Type' },
  { number: 3, label: '제조사', subtitle: 'Maker' },
  { number: 4, label: '정격 사양', subtitle: 'Rating' },
  { number: 5, label: '시험 목적', subtitle: 'Mode' },
  { number: 6, label: '확인', subtitle: 'Review' },
  { number: 7, label: '리포트', subtitle: 'Report' },
]

export const VOLTAGE_CLASS_OPTIONS = [
  { value: 'low-voltage', label: '저압 모터', subtitle: 'Low-voltage motor' },
  { value: 'high-voltage', label: '고압 모터', subtitle: 'High-voltage motor' },
]

export const POWER_TYPE_OPTIONS = [
  { value: 'ac', label: 'AC 모터', subtitle: 'AC Motor', supported: true },
  { value: 'dc', label: 'DC 모터', subtitle: 'DC Motor', supported: false },
]

export const PHASE_TYPE_OPTIONS = [
  { value: 'single-phase', label: '단상 모터', subtitle: 'Single-phase motor', supported: false },
  { value: 'three-phase', label: '3상 모터', subtitle: 'Three-phase motor', supported: true },
]

export const MOTOR_CATEGORY_OPTIONS = [
  { value: 'induction', label: '유도전동기', subtitle: 'Induction Motor', supported: true },
  { value: 'synchronous', label: '동기전동기', subtitle: 'Synchronous Motor', supported: false },
  { value: 'bldc', label: 'BLDC 모터', subtitle: 'BLDC Motor', supported: false },
  { value: 'dc', label: 'DC 모터', subtitle: 'DC Motor', supported: false },
]

export const MANUFACTURER_OPTIONS = [
  { value: 'hyosung', label: '효성중공업', subtitle: 'Hyosung Heavy Industries' },
  { value: 'hd-hyundai', label: 'HD현대일렉트릭', subtitle: 'HD Hyundai Electric' },
  { value: 'higen', label: '하이젠모터', subtitle: 'Higen Motor' },
  { value: 'siemens', label: 'Siemens', subtitle: 'Siemens' },
  { value: 'abb', label: 'ABB', subtitle: 'ABB' },
  { value: 'weg', label: 'WEG', subtitle: 'WEG' },
  { value: 'other', label: '기타', subtitle: 'Other' },
]

export const LOAD_MODEL_OPTIONS = [
  {
    value: 'constant-torque',
    label: '정토크 부하',
    subtitle: 'Constant Torque Load',
    description: '속도와 관계없이 거의 일정한 토크를 요구하는 부하입니다.',
  },
  {
    value: 'fan-pump',
    label: '팬·펌프 부하',
    subtitle: 'Fan/Pump Quadratic Load',
    description: '속도가 증가할수록 부하토크가 제곱에 비례하여 증가합니다.',
  },
  {
    value: 'constant-power',
    label: '정출력 부하',
    subtitle: 'Constant Power Load',
    description: '출력이 일정하므로 저속에서 요구 토크가 커질 수 있습니다.',
  },
  {
    value: 'marine-propulsion',
    label: '선박 추진 부하',
    subtitle: 'Marine Propulsion Load',
    description:
      '프로펠러 부하를 단순화한 모델로, 속도 증가에 따라 토크가 급격히 증가합니다.',
    note: '선박 추진 부하는 교육용 단순화 모델이며 실제 프로펠러 해석을 대체하지 않습니다.',
  },
  {
    value: 'custom',
    label: '사용자 정의 부하',
    subtitle: 'Custom Load',
    description: '사용자가 입력한 부하토크 값을 기준으로 계산하는 단순 부하입니다.',
  },
]

export const PARAMETER_MODE_OPTIONS = [
  {
    value: 'manual',
    label: '수동 입력',
    subtitle: 'Manual input',
    description: '사용자가 등가회로 파라미터를 직접 입력합니다.',
  },
  {
    value: 'rated-estimation',
    label: '정격값 기반 교육용 추정',
    subtitle: 'Rated-data educational estimation',
    description: '정격 전압, 전류, 역률, 효율, 출력으로 교육용 근사 파라미터를 산정합니다.',
  },
  {
    value: 'test-estimation',
    label: '무부하·구속 시험 기반 추정',
    subtitle: 'No-load and blocked-rotor test estimation',
    description: '무부하 시험과 구속 시험 입력값으로 단순 등가회로 파라미터를 추정합니다.',
  },
]

export const RATED_SPEC_FIELDS = [
  { key: 'ratedPowerKw', label: '정격 출력 [kW]', subtitle: 'Rated power [kW]', step: '0.1', min: '0.1' },
  { key: 'ratedVoltage', label: '정격 전압 [V]', subtitle: 'Rated voltage [V]', step: '1', min: '1' },
  { key: 'ratedFrequency', label: '정격 주파수 [Hz]', subtitle: 'Rated frequency [Hz]', step: '1', min: '1' },
  { key: 'poleNumber', label: '극수', subtitle: 'Number of poles', step: '2', min: '2' },
  { key: 'ratedSpeed', label: '정격 속도 [rpm]', subtitle: 'Rated speed [rpm]', step: '1', min: '1' },
  { key: 'ratedCurrent', label: '정격 전류 [A]', subtitle: 'Rated current [A]', step: '0.1', min: '0' },
  { key: 'powerFactor', label: '역률', subtitle: 'Power factor', step: '0.01', min: '0', max: '1' },
  { key: 'efficiency', label: '효율 [%]', subtitle: 'Efficiency [%]', step: '0.1', min: '0', max: '100' },
]

export const OPERATING_CONDITION_FIELDS = [
  { key: 'supplyVoltage', label: '공급 전압 [V]', subtitle: 'Supply voltage [V]', step: '1', min: '0' },
  { key: 'supplyFrequency', label: '공급 주파수 [Hz]', subtitle: 'Supply frequency [Hz]', step: '1', min: '1' },
  { key: 'loadPercent', label: '부하율 [%]', subtitle: 'Load percent [%]', step: '1', min: '0', max: '200' },
  { key: 'inertiaJ', label: '관성 J [kg·m²]', subtitle: 'Moment of inertia J', step: '0.001', min: '0.001' },
]

export const EQUIVALENT_PARAMETER_FIELDS = [
  { key: 'r1', label: 'R1 고정자 저항 [Ω]', subtitle: 'Stator resistance R1', step: '0.001', min: '0.0001' },
  { key: 'r2', label: "R2' 회전자 저항 환산값 [Ω]", subtitle: "Rotor resistance R2'", step: '0.001', min: '0.0001' },
  { key: 'x1', label: 'X1 고정자 누설 리액턴스 [Ω]', subtitle: 'Stator leakage reactance X1', step: '0.001', min: '0.0001' },
  { key: 'x2', label: "X2' 회전자 누설 리액턴스 환산값 [Ω]", subtitle: "Rotor leakage reactance X2'", step: '0.001', min: '0.0001' },
  { key: 'xm', label: 'Xm 자화 리액턴스 [Ω]', subtitle: 'Magnetizing reactance Xm', step: '0.01', min: '0.0001' },
  { key: 'rc', label: 'Rc 철손 저항 [Ω]', subtitle: 'Core-loss resistance Rc', step: '0.01', min: '0.0001' },
]

export const NO_LOAD_TEST_FIELDS = [
  { key: 'noLoadVoltage', label: 'V0 무부하 시험 전압 [V]', subtitle: 'No-load test voltage V0', step: '1', min: '0' },
  { key: 'noLoadCurrent', label: 'I0 무부하 전류 [A]', subtitle: 'No-load current I0', step: '0.01', min: '0' },
  { key: 'noLoadPower', label: 'P0 무부하 입력전력 [W]', subtitle: 'No-load input power P0', step: '1', min: '0' },
]

export const BLOCKED_ROTOR_TEST_FIELDS = [
  { key: 'blockedRotorVoltage', label: 'Vsc 구속 시험 전압 [V]', subtitle: 'Blocked-rotor voltage Vsc', step: '1', min: '0' },
  { key: 'blockedRotorCurrent', label: 'Isc 구속 전류 [A]', subtitle: 'Blocked-rotor current Isc', step: '0.01', min: '0' },
  { key: 'blockedRotorPower', label: 'Psc 구속 입력전력 [W]', subtitle: 'Blocked-rotor input power Psc', step: '1', min: '0' },
  { key: 'measuredR1', label: 'R1 measured 고정자 저항 측정값 [Ω]', subtitle: 'Measured stator resistance R1', step: '0.001', min: '0.0001' },
]
