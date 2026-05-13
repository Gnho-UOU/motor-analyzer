export const MOTOR_EXAMPLE_SOURCE_NOTE =
  '본 명판값은 효성 계열 자료를 참고한 교육용 예시값이며 실제 제품 선정에는 제조사 데이터시트 확인이 필요합니다.'

export const lowVoltageHyosungExample = {
  id: 'low-voltage-hyosung-75kw-4p',
  label: '저압 4극 전동기 교육용 예시값',
  manufacturer: 'hyosung',
  voltageClass: 'low-voltage',
  motorCategory: 'induction',
  phaseType: 'three-phase',
  powerType: 'ac',
  ratedPowerKw: 75,
  ratedVoltage: 380,
  ratedFrequency: 60,
  poleNumber: 4,
  ratedSpeed: 1785,
  ratedCurrent: 144.8,
  powerFactor: 0.825,
  efficiency: 95.4,
  loadTorque: 401.2,
  inertiaJ: 4.799,
  supplyVoltage: 380,
  supplyFrequency: 60,
  loadModel: 'constant-torque',
  parameterMode: 'rated-data-estimation',
  r1: 0.084,
  r2: 0.068,
  x1: 0.463,
  x2: 0.923,
  rc: 56.4,
  xm: 18.11,
}

export const highVoltageHyosungExample = {
  id: 'high-voltage-hyosung-1750kw-2p',
  label: '고압 전동기 교육용 예시값',
  manufacturer: 'hyosung',
  voltageClass: 'high-voltage',
  motorCategory: 'induction',
  phaseType: 'three-phase',
  powerType: 'ac',
  ratedPowerKw: 1750,
  ratedVoltage: 6600,
  ratedFrequency: 60,
  poleNumber: 2,
  ratedSpeed: 3553,
  ratedCurrent: 183.2,
  powerFactor: 0.889,
  efficiency: 94.0,
  loadTorque: 4703.4,
  inertiaJ: 86,
  supplyVoltage: 6600,
  supplyFrequency: 60,
  loadModel: 'constant-torque',
  parameterMode: 'rated-data-estimation',
}

export const VOLTAGE_CLASS_EXAMPLE_PROFILES = {
  'low-voltage': lowVoltageHyosungExample,
  'high-voltage': highVoltageHyosungExample,
}

export function getVoltageClassExampleProfile(voltageClass) {
  return VOLTAGE_CLASS_EXAMPLE_PROFILES[voltageClass] ?? lowVoltageHyosungExample
}

export function applyVoltageClassExampleToProfile(profile) {
  const example = getVoltageClassExampleProfile(profile.voltageClass)
  const merged = {
    ...profile,
    ...example,
    exampleProfileId: example.id,
  }

  if (example.r1 !== undefined) merged.parameterR1 = example.r1
  if (example.r2 !== undefined) merged.parameterR2 = example.r2
  if (example.x1 !== undefined) merged.parameterX1 = example.x1
  if (example.x2 !== undefined) merged.parameterX2 = example.x2
  if (example.xm !== undefined) merged.parameterXm = example.xm
  if (example.rc !== undefined) merged.parameterRc = example.rc

  return merged
}

export function getExampleProfileLabel(exampleProfileId) {
  const examples = Object.values(VOLTAGE_CLASS_EXAMPLE_PROFILES)
  return examples.find((example) => example.id === exampleProfileId)?.label ?? '사용자 직접 입력값'
}
