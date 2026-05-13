export const TEST_MODE_OPTIONS = [
  {
    value: 'no-load',
    label: '무부하 운전 시험',
    subtitle: 'No-load test',
    description:
      '부하를 낮게 설정하여 전동기의 회전 속도, 슬립, 기본 전류 응답을 확인합니다.',
  },
  {
    value: 'rated-load',
    label: '정격부하 운전 시험',
    subtitle: 'Rated-load operation',
    description:
      '입력한 정격 조건과 부하토크를 기준으로 정상 운전점과 주요 계산값을 확인합니다.',
  },
  {
    value: 'overload',
    label: '과부하 시험',
    subtitle: 'Overload test',
    description:
      '부하토크를 약 1.5배로 증가시켜 슬립 증가, 속도 저하, 경고 발생 가능성을 확인합니다.',
  },
  {
    value: 'startup',
    label: '기동 특성 시험',
    subtitle: 'Startup characteristic test',
    description:
      '전동기가 0 rpm에서 정상 운전 속도까지 가속되는 과정의 속도, 슬립, 토크 변화를 확인합니다.',
  },
  {
    value: 'low-voltage-startup',
    label: '저전압 기동 시험',
    subtitle: 'Low-voltage startup test',
    description:
      '전압을 정격의 약 80%로 낮춰 기동토크와 운전 여유가 어떻게 변하는지 확인합니다.',
  },
  {
    value: 'load-variation',
    label: '부하토크 변화 시험',
    subtitle: 'Load torque variation test',
    description:
      '부하토크 조건을 기준으로 운전점, 슬립, 토크 여유를 비교 분석합니다.',
  },
  {
    value: 'emergency-stop',
    label: '비상정지 시험',
    subtitle: 'Emergency stop test',
    description:
      '전동기 운전 중 비상정지 버튼을 적용했을 때 전원 차단과 감속 상태 표시를 확인합니다.',
  },
  {
    value: 'torque-speed',
    label: '토크-속도 특성 분석',
    subtitle: 'Torque-speed characteristic analysis',
    description:
      '토크-속도 곡선과 부하토크 기준선을 통해 안정 운전점과 최대토크 영역을 분석합니다.',
  },
]
