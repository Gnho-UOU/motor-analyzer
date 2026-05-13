import { toProfileNumber } from './numberUtils.js'

export function getVoltageCondition(vpu) {
  const safeVpu = Number.isFinite(vpu) ? vpu : 0

  if (safeVpu > 1.5) {
    return {
      label: '운전 불가',
      subtitle: 'Operation prohibited',
      tone: 'danger',
      isProhibited: true,
      detail: '정격전압을 크게 초과하여 절연 파괴, 철심 포화, 권선 소손 위험이 있습니다.',
    }
  }

  if (safeVpu > 1.2) {
    return {
      label: '위험 과전압',
      subtitle: 'Dangerous overvoltage',
      tone: 'danger',
      isProhibited: false,
      detail: '정격전압 대비 과전압이 커서 절연, 철심 포화, 발열 위험을 검토해야 합니다.',
    }
  }

  if (safeVpu > 1.1) {
    return {
      label: '과전압 주의',
      subtitle: 'Overvoltage caution',
      tone: 'caution',
      isProhibited: false,
      detail: '정격전압보다 높은 공급 조건입니다. 장시간 운전은 발열과 절연 스트레스를 키울 수 있습니다.',
    }
  }

  if (safeVpu >= 0.9) {
    return {
      label: '정상 전압 범위',
      subtitle: 'Normal voltage range',
      tone: 'normal',
      isProhibited: false,
      detail: '공급 전압이 정격전압 기준 정상 범위에 있습니다.',
    }
  }

  if (safeVpu >= 0.8) {
    return {
      label: '저전압 주의',
      subtitle: 'Low-voltage caution',
      tone: 'caution',
      isProhibited: false,
      detail: '저전압으로 인해 발생 가능한 토크가 감소할 수 있습니다.',
    }
  }

  return {
    label: '심각한 저전압 / 기동 실패 가능성',
    subtitle: 'Severe undervoltage',
    tone: 'danger',
    isProhibited: false,
    detail: '저전압으로 인해 발생 가능한 토크가 크게 감소합니다.',
  }
}

export function calculateVoltagePerUnit(supplyVoltage, ratedVoltage) {
  const rated = Math.max(0.001, toProfileNumber(ratedVoltage, 1))
  const supply = Math.max(0, toProfileNumber(supplyVoltage, rated))
  const vpu = supply / rated

  return Number.isFinite(vpu) ? vpu : 0
}
