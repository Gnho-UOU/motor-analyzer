# MotorAnalyzer 현재 시뮬레이션 구조 기술 보고서

작성 기준: 현재 로컬 프로젝트의 `src/App.jsx`, `package.json`, `electron/main.js`, `electron-builder.yml` 구조를 기준으로 분석했다.

## 1. 현재 전체 앱 구조

현재 앱은 대시보드로 바로 시작하지 않고 Setup Wizard로 시작한다. `App` 컴포넌트의 `setupCompleted` 기본값이 `false`이며, `setupCompleted`가 `false`이면 기존 MotorAnalyzer 대시보드 렌더링 전에 `SetupWizard`를 먼저 반환한다.

Setup Wizard와 Dashboard는 `testProfile`과 `params` 상태를 통해 연결된다. Wizard 마지막 확인 단계에서 `handleStartSimulationFromWizard`가 실행되면 `createSimulationParamsFromProfile(testProfile)`로 Wizard 입력값 일부를 기존 시뮬레이션 파라미터 형식으로 변환하고, 변환된 값을 `params`에 반영한 뒤 `setupCompleted`를 `true`로 바꾼다.

PDF 리포트 생성은 대시보드 진입 후 `TestSessionHeader`의 리포트 생성 버튼과 연결되어 있다. 실제 PDF 생성 함수는 `handleGeneratePdfReport`이며, `jsPDF`로 텍스트 페이지를 만들고 `html2canvas`로 대시보드 일부 영역을 캡처해 PDF 3페이지에 삽입한다.

Electron 지원은 존재한다. `package.json`의 `main`은 `electron/main.js`이고, Electron 개발 실행용 `electron:dev`, 빌드 후 실행용 `electron`, Windows 패키징용 `dist` 스크립트가 있다. `electron-builder.yml`도 존재해 NSIS 설치 파일과 portable exe 생성을 목표로 설정되어 있다.

현재 앱의 주요 파일은 다음과 같다.

- `src/App.jsx`: Wizard, 기존 대시보드, 유도전동기 계산 모델, START/STOP/RESET/EMERGENCY STOP, 그래프 데이터, PDF 생성 로직이 대부분 포함되어 있다.
- `src/App.css`: Wizard와 대시보드 스타일을 포함한다.
- `package.json`: Vite, Electron, electron-builder 실행 스크립트와 의존성을 정의한다.
- `electron/main.js`: Electron 메인 프로세스와 BrowserWindow 생성 로직을 포함한다.
- `electron-builder.yml`: Windows 설치 파일과 portable 실행 파일 패키징 설정을 포함한다.
- `IMPLEMENTATION_STATUS.md`: 구현 상태 메모 파일로 보인다.

## 2. 현재 Setup Wizard 구조

현재 Wizard 단계는 `WIZARD_STEPS`에 7개로 정의되어 있다.

1. 사용자 정보
2. 모터 유형
3. 제조사
4. 정격 사양
5. 시험 목적
6. 확인
7. 리포트

실제 `currentStep` 기반 화면은 1단계부터 6단계까지 구현되어 있으며, 7단계 리포트는 Wizard의 독립 화면이라기보다 대시보드 진입 후 PDF 생성 기능으로 연결된다.

Wizard 값은 `testProfile` 상태에 저장된다. 기본값은 `createDefaultTestProfile()`에서 생성된다.

현재 기본값은 다음과 같다.

| 항목 | 기본값 |
|---|---|
| `userName` | 빈 문자열 |
| `organization` | 빈 문자열 |
| `projectName` | 빈 문자열 |
| `testDate` | 오늘 날짜 |
| `testMemo` | 빈 문자열 |
| `voltageClass` | `low-voltage` |
| `powerType` | `ac` |
| `phaseType` | `three-phase` |
| `motorCategory` | `induction` |
| `manufacturer` | `hyosung` |
| `customManufacturer` | 빈 문자열 |
| `ratedPowerKw` | `15` |
| `ratedVoltage` | `380` |
| `ratedFrequency` | `60` |
| `poleNumber` | `4` |
| `ratedSpeed` | `1750` |
| `ratedCurrent` | `30` |
| `powerFactor` | `0.85` |
| `efficiency` | `90` |
| `loadTorque` | `50` |
| `inertiaJ` | `0.05` |
| `testMode` | `rated-load` |

단계별 입력은 다음과 같다.

| 단계 | 현재 입력 또는 선택 항목 |
|---|---|
| 1단계 사용자 정보 | 사용자 이름, 소속/회사명, 프로젝트명, 시험 날짜, 시험 메모 |
| 2단계 모터 유형 | 전압 등급, 전원 종류, 상수, 모터 종류 |
| 3단계 제조사 | 효성중공업, HD현대일렉트릭, 하이젠모터, Siemens, ABB, WEG, 기타 |
| 4단계 정격 사양 | 정격 출력, 정격 전압, 정격 주파수, 극수, 정격 속도, 정격 전류, 역률, 효율, 부하토크, 관성 J |
| 5단계 시험 목적 | 무부하, 정격부하, 과부하, 기동 특성, 저전압 기동, 부하토크 변화, 비상정지, 토크-속도 분석 |
| 6단계 확인 | 사용자 정보, 모터 유형, 제조사, 정격 사양, 시험 목적 요약 |

현재 완전 지원되는 모터 프로파일은 `AC + 3상 + 유도전동기`이다. DC 모터, 단상 모터, 동기전동기, BLDC 모터 등은 선택은 가능하지만 `추후 지원 예정 / Coming soon`으로 표시된다. 전압 등급의 저압/고압 선택은 현재 지원 여부 판단에는 직접 사용되지 않는다.

## 3. Wizard 입력값과 시뮬레이션 반영 여부

| Wizard input | Stored state variable | Is it displayed only? | Is it used in simulation calculation? | Where is it used? | Current problem or note |
|---|---|---:|---:|---|---|
| 사용자 이름 | `testProfile.userName` | 예 | 아니오 | Wizard, 세션 헤더, 리포트, 파일명 | 계산에는 영향 없음 |
| 소속/회사명 | `testProfile.organization` | 예 | 아니오 | Wizard, 세션 헤더, 리포트 | 계산에는 영향 없음 |
| 프로젝트명 | `testProfile.projectName` | 예 | 아니오 | Wizard, 세션 헤더, 리포트 | 선택 입력이며 계산에는 영향 없음 |
| 시험 날짜 | `testProfile.testDate` | 예 | 아니오 | Wizard, 세션 헤더, 리포트, 파일명 | 계산에는 영향 없음 |
| 전압 등급 | `testProfile.voltageClass` | 예 | 아니오 | Wizard 모터 유형 요약 | 저압/고압 선택이 전압 판정 기준이나 절연/보호 로직에 연결되지 않음 |
| 전원 종류 | `testProfile.powerType` | 일부 | 간접 | 지원 여부 판단 | `ac`가 아니면 경고 표시. 실제 계산 모델은 여전히 3상 유도전동기 모델 |
| 상수 | `testProfile.phaseType` | 일부 | 간접 | 지원 여부 판단 | `three-phase`가 아니면 경고 표시. 단상 모델은 없음 |
| 모터 종류 | `testProfile.motorCategory` | 일부 | 간접 | 지원 여부 판단 | `induction`이 아니면 경고 표시. 동기/BLDC/DC 모델은 없음 |
| 제조사 | `testProfile.manufacturer`, `customManufacturer` | 예 | 아니오 | Wizard, 세션 헤더, 리포트 | 제조사별 파라미터 DB 또는 성능 차이 없음 |
| 정격 출력 | `testProfile.ratedPowerKw` | 일부 | 부분 사용 | 정격 토크 미리보기, 리포트 | 실제 등가회로/토크 계산에는 직접 사용되지 않음 |
| 정격 전압 | `testProfile.ratedVoltage` | 아니오 | 예 | `createSimulationParamsFromProfile`에서 `params.voltage`로 매핑 | 정격 전압과 실제 공급 전압이 분리되어 있지 않음 |
| 정격 주파수 | `testProfile.ratedFrequency` | 아니오 | 예 | `params.f`로 매핑, `Ns` 계산 | 정격 주파수와 실제 공급 주파수가 분리되어 있지 않음 |
| 극수 | `testProfile.poleNumber` | 아니오 | 예 | `params.poles`로 매핑, `Ns` 계산 | 극수 유효성은 기본 clamp로 처리됨 |
| 정격 속도 | `testProfile.ratedSpeed` | 아니오 | 예 | 정격 슬립 추정 후 `params.slipPercent`로 매핑 | auto operating point 모드에서는 최종 운전점이 부하토크 교점으로 다시 결정될 수 있음 |
| 정격 전류 | `testProfile.ratedCurrent` | 예 | 아니오 | Wizard, 리포트 | 실제 전류 계산이나 과전류 보호에 사용되지 않음 |
| 역률 | `testProfile.powerFactor` | 예 | 아니오 | Wizard, 리포트 | 등가회로 파라미터 추정에 사용되지 않음 |
| 효율 | `testProfile.efficiency` | 예 | 아니오 | Wizard, 리포트 | 손실/열/입력전력 계산에 사용되지 않음 |
| 부하토크 | `testProfile.loadTorque` | 아니오 | 예 | `params.loadTorque`로 매핑, 운전점/기동 계산 | 시험 모드에 따라 무부하/과부하에서는 값이 보정됨 |
| 관성 J | `testProfile.inertiaJ` | 아니오 | 예 | `params.inertia`로 매핑, 기동 응답 계산 | 기동/감속 동역학에 연결되어 있음 |
| 시험 목적 | `testProfile.testMode` | 일부 | 부분 사용 | Wizard, 세션 헤더, 리포트, 시뮬레이션 초기값 보정 | 일부 모드만 파라미터 보정. 자동 시험 시나리오 실행은 없음 |

## 4. 현재 Simulation Parameter 구조

MotorAnalyzer 대시보드의 주요 시뮬레이션 파라미터는 `params` 상태에 저장된다. 기본값은 `DEFAULT_PARAMS`이다.

| 파라미터 | 의미 | 기본값 |
|---|---|---:|
| `f` | 공급 주파수 | 60 Hz |
| `poles` | 극수 | 4 |
| `voltage` | 선간 공급 전압으로 사용 | 220 V |
| `r1` | 고정자 저항 | 0.8 ohm |
| `r2` | 회전자 저항 환산값 | 0.6 ohm |
| `x1` | 고정자 누설 리액턴스 | 1.2 ohm |
| `x2` | 회전자 누설 리액턴스 환산값 | 1.2 ohm |
| `xm` | 자화 리액턴스 | 30 ohm |
| `slipPercent` | 수동 슬립 기준값 | 5 % |
| `loadTorque` | 부하토크 | 10 N·m |
| `inertia` | 관성 J | 0.05 kg·m² |
| `friction` | 점성 마찰 계수 | 0.001 N·m·s |

전압을 제어하는 값은 `params.voltage`이다. Wizard의 `ratedVoltage`도 이 값으로 직접 들어가므로 현재는 정격 전압과 공급 전압이 분리되어 있지 않다.

주파수를 제어하는 값은 `params.f`이다. Wizard의 `ratedFrequency`도 이 값으로 직접 들어가므로 현재는 정격 주파수와 공급 주파수가 분리되어 있지 않다.

극수는 `params.poles`가 제어한다. 슬립은 수동 모드에서는 `params.slipPercent`가 운전점을 만든다. 자동 운전점 모드에서는 `params.slipPercent`보다 부하토크와 토크-속도 곡선의 교점이 우선된다.

부하토크는 `params.loadTorque`, 관성은 `params.inertia`가 제어한다. 등가회로 파라미터는 `params.r1`, `params.r2`, `params.x1`, `params.x2`, `params.xm`으로 제어된다.

## 5. 현재 유도전동기 모델

동기속도 `Ns`는 다음 식으로 계산된다.

```text
Ns = 120 * f / poles
```

슬립은 기본적으로 `s = (Ns - Nr) / Ns` 개념을 사용한다. 수동 모드에서는 `params.slipPercent / 100`을 직접 사용하고, 자동 운전점 모드에서는 부하토크와 토크-속도 곡선의 교점에서 구한 슬립을 사용한다.

회전자 속도 `Nr`은 슬립으로부터 다음과 같이 계산된다.

```text
Nr = Ns * (1 - s)
```

전자기 토크 `Te`는 Thevenin 등가회로 기반 식으로 계산된다. 고정자 임피던스 `Z1 = R1 + jX1`, 자화 리액턴스 `Zm = jXm`을 만들고, Thevenin 전압과 임피던스를 구한 뒤 회전자 저항 `R2 / s`를 포함해 토크를 계산한다.

현재 Thevenin 등가 계산은 다음 구조이다.

```text
Vphase = VLL / sqrt(3)
Vth = Vphase * |Zm / (Z1 + Zm)|
Zth = Z1 * Zm / (Z1 + Zm)
```

토크-속도 곡선은 슬립 `0.001`부터 `1.0`까지 약 220개 점을 생성해 만든다. 각 점은 `speed = Ns * (1 - slip)`과 `torqueAtSlip(slip)`로 구성된다.

전압 변화는 `Vth`를 바꾸므로 토크-속도 곡선에 영향을 준다. 주파수 변화도 `Ns`와 동기각속도에 영향을 준다. 다만 리액턴스가 주파수에 따라 변하는 효과는 `frequencyReactanceScaling` 옵션이 켜진 경우에만 반영된다.

부하토크는 자동 운전점 모드에서 토크-속도 곡선과의 교점을 찾는 데 사용된다. 따라서 부하토크가 바뀌면 운전점 속도와 슬립이 바뀐다.

## 6. 현재 운전점 분석 로직

현재 자동 운전점 모드에서는 모터 토크 곡선과 부하토크 수평선의 교점을 계산한다. `findStableOperatingPoint`가 토크-속도 데이터에서 `torque - loadTorque`의 부호 변화 지점을 찾고, 보간을 통해 교점을 만든다.

교점이 여러 개 있으면 가장 높은 속도의 교점을 선택한다. 이는 일반적인 유도전동기 정상 운전점이 동기속도에 가까운 안정 영역에 위치한다는 가정을 반영한 단순화 방식이다.

정격 속도는 Wizard에서 입력되지만, Dashboard 진입 시에는 정격 속도로 추정한 슬립이 `params.slipPercent`에 들어갈 뿐이다. `autoOperatingPoint`가 기본적으로 `true`로 설정되므로 최종 운전점은 고정된 정격 속도라기보다 현재 등가회로 토크 곡선과 부하토크의 교점으로 다시 결정된다.

교점이 없으면 가장 가까운 점을 반환하고 `hasIntersection: false`로 표시한다. 이 경우 운전 상태는 경고 또는 위험 상태로 분류될 수 있다.

현재 로직은 수동 슬립보다 현실적인 방향으로 개선되어 있지만, 산업용 시뮬레이터 관점에서는 아직 단순화되어 있다. 부하 모델이 일정토크 하나에 가깝고, 실제 정격 데이터 기반 등가회로 추정, 열 한계, 보호 계전, 전압 불평형, 포화, VFD 제어 등은 포함되지 않는다.

## 7. 현재 기동 시뮬레이션

START는 `startStartupSimulation`에서 처리된다. 사용자가 START를 누르면 현재 모터 계산 결과를 기준으로 기동 가능성을 먼저 확인한다. `startingTorque`가 `loadTorque`보다 작으면 기동 실패 상태로 들어가고, 속도는 0 rpm에 머물며 실패 데이터가 생성된다.

기동이 가능하면 `startupState.isStarting`이 `true`가 되고, `requestAnimationFrame` 기반 효과에서 미리 계산된 `startupProfile`을 시간에 맞춰 샘플링한다.

`startupRotorSpeed`는 기동 응답 배열의 현재 시간 위치에서 가져온 `speed` 값이다. `startupSlip`은 현재 각속도와 동기각속도 관계에서 계산된 슬립이다. `startupTorque`는 현재 슬립에서의 `torqueAtSlip(slip)` 값이다.

기동 응답은 다음 단순 동역학을 사용한다.

```text
J * dω/dt = Te - TL - Bω
```

여기서 `J`는 `params.inertia`, `TL`은 `params.loadTorque`, `B`는 `params.friction`이다. Wizard의 `inertiaJ`는 Dashboard 진입 시 `params.inertia`로 매핑되므로 실제 기동 응답에 연결되어 있다.

저전압 기동 시험 모드는 Dashboard 진입 시 전압을 약 80%로 낮춘다. 전압이 토크 계산에 반영되므로 기동토크도 낮아진다.

다만 현재 서로 다른 기동 방식은 없다. 직입기동, Y-Delta, 리액터 기동, 소프트스타터, 인버터 기동 같은 별도 알고리즘은 구현되어 있지 않다.

## 8. 현재 경고 및 보호 로직

현재 경고는 `getMotorWarnings(motor)`에서 생성된다.

주요 경고 조건은 다음과 같다.

| 경고 | 조건 |
|---|---|
| 전원 차단 상태 | 모터가 energized 상태가 아닐 때 |
| 기동토크 부족 | `startingTorque + margin < loadTorque` |
| 과도한 슬립 | energized 상태에서 `slip > 0.15` |
| 부하토크 대비 토크 부족 | `torque + margin < loadTorque` |
| 저전압 | `motor.voltage / DEFAULT_PARAMS.voltage < 0.9` |
| 속도 저하 | `nr / ns < 0.85` |
| 정상 운전 | energized 상태이고 별도 경고가 없을 때 |

과전압 검출은 현재 없다. 저전압 검출은 있지만 기준이 Wizard의 정격 전압이 아니라 `DEFAULT_PARAMS.voltage`인 220 V 기준이다. Wizard에서 380 V를 입력해도 저전압 판정 기준이 정격 전압 대비로 바뀌지 않는다.

과도한 슬립 검출은 있다. 기동 실패 검출도 있다. 과부하는 토크 부족, 기동토크 부족, 슬립 증가 형태로 간접적으로만 표현된다. 과전류, 과열, 절연, 보호계전기 트립, 재기동 제한 같은 산업용 보호 로직은 없다.

STOP, RESET, EMERGENCY STOP 상태는 UI 상태로는 구분되어 있다. EMERGENCY STOP은 전자기 토크를 0으로 두고 부하토크와 마찰로 감속시키는 방식이다. 다만 실제 차단기, 접촉기, 인버터 DC braking, 기계 브레이크, 보호 트립 이력까지 물리적으로 일관되게 모델링하지는 않는다.

## 9. 현재 그래프와 시각화

현재 존재하는 주요 그래프와 시각화는 다음과 같다.

| 항목 | 사용하는 데이터 |
|---|---|
| 토크-속도 특성 그래프 | `motor.torqueSpeedData`, 현재 운전점, 최대토크점, 부하토크 |
| 기동 응답 그래프 | `motor.startupProfile` 또는 `startupState.startupData` |
| 3상 전류 파형 | `displayedMotor.currentData` |
| 회전자계/단면 시각화 | 표시용 회전 속도, 슬립, 전류 모드 |
| 3D 모터 모델 | 표시용 속도와 운전 상태 |
| 결과 카드 | `displayedMotor`의 속도, 슬립, 토크, 전류, 상태 등 |
| 경고 패널 | `getMotorWarnings(displayedMotor)` 결과 |

Wizard 값이 Dashboard 진입 시 `params`에 매핑되는 항목은 그래프에 영향을 준다. 예를 들어 정격 전압, 주파수, 극수, 부하토크, 관성은 토크 곡선, 운전점, 기동 응답에 영향을 줄 수 있다. 반면 정격 전류, 역률, 효율, 제조사, 전압 등급 등은 그래프 계산에는 직접 영향을 주지 않는다.

모터 단면 시각화와 3D 모터 모델은 계산된 표시 속도를 사용한다. STARTING, RUN, STOP 상태에 따라 표시 속도와 전류 모드가 달라진다.

전류 파형은 STOP 또는 전원 차단 상태에서는 0으로 표시되고, STARTING/RUN 상태에서는 현재 등가회로 계산에서 나온 전류 크기를 기반으로 3상 파형을 표시한다.

전압 변화는 토크와 전류 계산에 영향을 주고, 부하토크 변화는 운전점과 기동 가능성에 영향을 준다. 다만 실제 포화, 고조파, 전압 불평형, 케이블 전압강하, 인버터 PWM 효과는 반영되지 않는다.

## 10. 현재 PDF 리포트 생성

PDF는 `handleGeneratePdfReport`에서 생성된다. `jsPDF`를 사용해 텍스트 페이지를 만들고, `html2canvas`로 대시보드의 `reportCaptureRef` 영역을 캡처해 이미지로 PDF에 삽입한다.

현재 Korean text는 대부분 `jsPDF.text()`로 직접 출력된다. jsPDF 기본 폰트인 helvetica 계열은 한글을 안정적으로 지원하지 않으므로, 한글 텍스트가 깨질 가능성이 높다. 반면 html2canvas로 캡처된 대시보드 화면의 한글은 이미지로 들어가기 때문에 캡처가 성공하면 보존될 가능성이 높다.

현재 PDF 페이지 구성은 다음과 같다.

| 페이지 | 내용 |
|---|---|
| 1페이지 | 커버/요약, 사용자, 조직, 프로젝트, 시험일, 제조사, 모터 유형, 정격 출력/전압/주파수, 시험 목적, 메모 |
| 2페이지 | 정격 사양, 동기속도, 추정 슬립, 회전자 속도, 전자기 토크, 기동토크, 최대토크, 부하토크, 운전 상태, 경고 요약 |
| 3페이지 | html2canvas로 캡처한 대시보드 주요 영역 |
| 4페이지 | 3상 유도전동기 이론과 해석 문장 |

포함된 시뮬레이션 데이터는 핵심 운전점과 일부 경고 요약 중심이다. 누락된 중요한 데이터는 시간별 기동 응답 테이블, 전류 파형 수치, 토크-속도 곡선 원자료, 보호 동작 이력, 시험 합격/불합격 판정, 실제 시험 시작/종료 시각, CSV 원자료 등이다.

리포트의 데이터는 대부분 현재 `displayedMotor`, `motor`, `testProfile`, `warnings`에서 가져오므로 Dashboard 표시값과 큰 틀에서는 일치한다. 다만 정격 전류, 역률, 효율처럼 계산에 쓰이지 않는 값도 정격 사양으로 출력되며, 한글 텍스트 렌더링 안정성은 아직 보장되지 않는다.

## 11. 현재 Electron / exe 패키징 구조

Electron 파일은 존재한다. 메인 프로세스는 `electron/main.js`이다. 개발 모드에서는 `http://127.0.0.1:5173`의 Vite dev server를 BrowserWindow에 로드하고, 운영 모드에서는 `dist/index.html`을 로드한다.

`package.json`의 주요 스크립트는 다음과 같다.

| script | 동작 |
|---|---|
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run electron` | Vite 빌드 후 Electron 실행 |
| `npm run electron:dev` | Vite dev server와 Electron을 함께 실행 |
| `npm run build` | Vite production build |
| `npm run dist` | Vite build 후 electron-builder로 Windows NSIS/portable 패키징 |
| `npm run lint` | ESLint 실행 |
| `npm run preview` | Vite preview 실행 |

`electron-builder.yml`은 `release` 폴더로 결과물을 내보내고, Windows x64용 NSIS installer와 portable exe를 생성하도록 설정되어 있다.

PDF 생성은 Renderer 프로세스의 브라우저 기능으로 동작하므로 Electron에서도 동작할 것으로 예상된다. 다만 `pdf.save()`의 저장 UX는 Electron 메인 프로세스에서 별도 저장 대화상자를 제어하는 방식이 아니며, Chromium의 다운로드 처리에 의존한다.

## 12. 현재 한계점

현재 앱은 교육용 시뮬레이션에서 산업용 테스트 프로그램으로 확장되는 중간 단계로 볼 수 있다. 주요 한계는 다음과 같다.

- 정격 전압과 실제 공급 전압이 분리되어 있지 않다.
- 정격 주파수와 실제 공급 주파수가 분리되어 있지 않다.
- Wizard의 정격 전류, 역률, 효율은 표시와 리포트에는 나오지만 계산에는 쓰이지 않는다.
- 제조사 선택은 분류 정보일 뿐 제조사별 등가회로나 성능 데이터가 없다.
- 전압 등급은 표시 정보일 뿐 저압/고압 보호 기준이나 절연 기준에 연결되지 않는다.
- 부하 모델이 일정토크 중심이며 팬/펌프/크레인/추진 부하 같은 모델 선택이 없다.
- 등가회로 파라미터 `R1`, `R2`, `X1`, `X2`, `Xm`은 정격 데이터로부터 추정되지 않는다.
- 손실, 효율, 온도 상승, 열용량, 냉각 조건이 없다.
- 과전류, 과전압, 과열, 결상, 전압 불평형, 보호 트립 로직이 없다.
- START/STOP/EMERGENCY STOP은 시각화 상태로는 동작하지만 실제 제어반/보호장치 시퀀스 수준은 아니다.
- 기동 방식은 사실상 단일 직접기동 모델이며 Y-Delta, 소프트스타터, 인버터 기동이 없다.
- PDF 한글 출력은 jsPDF 기본 폰트 사용으로 깨질 가능성이 있다.
- Wizard의 7단계 리포트는 진행 표시에는 있지만 독립 Wizard 화면으로 구현되어 있지 않다.
- 모터 타입 확장은 UI 선택만 있고 실제 계산 모델은 3상 AC 유도전동기 하나이다.

## 13. 산업용 수준으로 올리기 위한 안전한 업그레이드 순서

1. Wizard-to-simulation mapping cleanup: Wizard 입력값 중 계산에 실제로 쓰이는 값과 표시 전용 값을 명확히 분리하고 매핑 함수를 테스트 가능하게 분리한다.
2. Rated data vs supply condition separation: 정격 전압/정격 주파수와 실제 공급 전압/공급 주파수를 별도 상태로 둔다.
3. Voltage pu judgment: 저전압/과전압 판단을 `supplyVoltage / ratedVoltage` 기준의 pu 값으로 바꾼다.
4. Operating point calculation improvement: 교점 탐색, 안정/불안정 영역 판정, 교점 없음 상태 표시를 더 명확히 한다.
5. Load model selection: 일정토크, 팬/펌프 제곱 부하, 관성 부하, 추진 부하 등 부하 모델을 선택할 수 있게 한다.
6. Equivalent circuit parameter estimation: 정격 출력, 전압, 전류, 역률, 효율, 정격 속도로부터 등가회로 파라미터를 추정하는 옵션을 추가한다.
7. Loss and efficiency calculation: 동손, 철손, 기계손, stray loss, 입력전력, 출력전력, 효율 계산을 추가한다.
8. Thermal model: 열용량, 열저항, 주변온도, 냉각 방식, 온도 상승 계산을 추가한다.
9. Starting method selection: DOL, Y-Delta, 리액터, 소프트스타터, VFD 기동 방식을 선택하고 기동전류/토크를 비교한다.
10. Protection and trip logic: 과전류, 저전압, 과전압, 과열, 장시간 기동, stall, 결상, 전압 불평형 트립을 구현한다.
11. Test scenario automation: 선택한 시험 목적에 따라 자동으로 시나리오를 실행하고 이벤트 로그를 남긴다.
12. Save/load profile: 시험 프로파일과 모터 정격 정보를 JSON으로 저장/불러오기 한다.
13. CSV export: 토크-속도 곡선, 기동 응답, 전류 파형, 이벤트 로그를 CSV로 내보낸다.
14. PDF report upgrade: 한글 폰트 임베딩, 표/그래프 품질 개선, 원자료 요약, 판정 결과, 이벤트 로그를 추가한다.
15. Motor type expansion: 동기전동기, BLDC, DC 모터의 별도 계산 모델을 추가한다.
16. Inverter/motor drive features: V/f 제어, 주파수 램프, 전류 제한, 토크 제한, PWM/고조파 단순 모델을 추가한다.
17. Marine propulsion mode: 추진기 부하 곡선, 선박 운항 조건, 축계 관성, 비상정지/역전 시나리오를 추가한다.

## 14. 다음 단계에서 바로 수정해야 할 10개 항목

1. 정격 전압과 공급 전압을 분리하고, Wizard에는 정격값과 시험 공급조건을 각각 입력하도록 정리한다.
2. 저전압 경고 기준을 `DEFAULT_PARAMS.voltage`가 아니라 `supplyVoltage / ratedVoltage` 기준으로 변경한다.
3. 정격 주파수와 공급 주파수를 분리해 VFD 또는 저주파 시험 확장 기반을 만든다.
4. Wizard 7단계 리포트가 실제 화면인지 진행 표시인지 명확히 정리한다.
5. 정격 전류, 역률, 효율을 계산에 쓰지 않는다는 점을 UI와 리포트에 명확히 표시하거나 등가회로 추정에 연결한다.
6. PDF 한글 깨짐 방지를 위해 한글 폰트 임베딩 또는 HTML 기반 PDF 페이지 캡처 방식을 도입한다.
7. 시험 모드별 자동 시나리오를 추가해 무부하/과부하/저전압/비상정지가 단순 초기값 변경에 그치지 않도록 한다.
8. 부하 모델 선택 기능을 추가해 일정토크 외 팬/펌프/추진 부하를 지원한다.
9. 보호 로직에 과전압, 과전류, 과열, 장시간 기동 실패, stall 트립을 추가한다.
10. 등가회로 파라미터와 Wizard 정격 사양의 관계를 정리하고, 사용자 수동 입력 모드와 자동 추정 모드를 분리한다.
