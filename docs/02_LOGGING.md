# 로깅 시스템 가이드 (Logging System Guide)

이 문서는 OPEN-CLI의 로깅 시스템을 설명합니다.
**모든 새 기능 구현 시 반드시 이 가이드에 따라 로깅을 추가해야 합니다.**

---

## 목차

1. [CLI 실행 모드](#1-cli-실행-모드)
2. [기본 사용법](#2-기본-사용법)
3. [로그 레벨 이해하기](#3-로그-레벨-이해하기)
4. [실행 흐름 추적하기](#4-실행-흐름-추적하기)
5. [변수 및 상태 추적하기](#5-변수-및-상태-추적하기)
6. [성능 측정하기](#6-성능-측정하기)
7. [HTTP 및 Tool 로깅](#7-http-및-tool-로깅)
8. [실전 예제](#8-실전-예제)
9. [빠른 참조 (Cheat Sheet)](#9-빠른-참조-cheat-sheet)

---

## 1. CLI 실행 모드

OPEN-CLI는 3가지 로깅 모드를 지원합니다.

**중요**: Normal 모드(`open`)에서는 **로그가 전혀 출력되지 않습니다**.
모든 사용자 피드백은 UI 컴포넌트로 처리됩니다.

### 1.1 모드 비교표

| 기능 | Normal | Verbose | Debug |
|------|--------|---------|-------|
| 명령어 | `open` | `open --verbose` | `open --debug` |
| 로그 레벨 | WARN | DEBUG | VERBOSE |
| 터미널 로그 출력 | **X** | O | O |
| ERROR | X (UI로 표시) | O | O |
| WARN | X (UI로 표시) | O | O |
| INFO | X | X | X |
| DEBUG | X | O | O |
| VERBOSE | X | X | O |
| 위치 정보 | X | O | O |
| 함수 추적 | X | O | O |
| 변수 추적 | X | O | O |
| HTTP 상세 | X | X | O |
| Tool 상세 | X | X | O |

> **참고**: INFO 레벨은 더 이상 사용하지 않습니다.
> 기존 INFO → DEBUG 또는 VERBOSE로 마이그레이션하세요.

### 1.2 모드별 출력 예시

**Normal Mode** (`open`)
```
(로그 출력 없음 - 모든 피드백은 UI로 표시)
```

**Verbose Mode** (`open --verbose`)
```
[2025-11-12T06:50:04.349Z] [OPEN-CLI] [app.ts:17:startApp] ↓ ENTER: startApp
  Args: { "mode": "VERBOSE" }
[2025-11-12T06:50:04.349Z] [OPEN-CLI] [app.ts:22:startApp] ➜ FLOW: 설정 로드 중
[2025-11-12T06:50:04.349Z] [OPEN-CLI] [app.ts:25:startApp] 📦 VARS:
   config.endpoint="https://api.example.com" (string)
[2025-11-12T06:50:04.350Z] [OPEN-CLI] [app.ts:30:startApp] 🔄 STATE: 상태 변경
  Before: "idle"
  After: "running"
[2025-11-12T06:50:04.350Z] [OPEN-CLI] [app.ts:35:startApp] ⏱️  TIMER END: init 150ms
```

**Debug Mode** (`open --debug`)
```
[2025-11-12T06:50:04.350Z] [OPEN-CLI] [http.ts:42:request] → HTTP REQUEST: POST https://api.example.com/v1/chat
  Body: { "messages": [...] }
[2025-11-12T06:50:04.550Z] [OPEN-CLI] [http.ts:56:request] ← HTTP RESPONSE: 200 OK
  Data: { "choices": [...] }
[2025-11-12T06:50:04.551Z] [OPEN-CLI] [tools.ts:89:executeTool] 🔧 TOOL SUCCESS: read_file
  Args: { "path": "README.md" }
  Result: "# OPEN-CLI\n\n..."
```

### 1.3 모드 선택 가이드

| 상황 | 권장 모드 |
|------|----------|
| 일반 사용 | Normal (`open`) |
| 개발 중 | Verbose (`open --verbose`) |
| 버그 디버깅 | Verbose (`open --verbose`) |
| HTTP 문제 진단 | Debug (`open --debug`) |
| Tool 실행 문제 | Debug (`open --debug`) |
| 심층 분석 | Debug (`open --debug`) |

---

## 2. 기본 사용법

### 2.1 Logger 임포트

```typescript
import { logger } from '../utils/logger.js';
// 또는
import { logger } from '@/utils/logger';
```

### 2.2 기본 로깅

```typescript
// 디버그 메시지 (--verbose 모드에서 표시)
logger.debug('서버가 시작되었습니다');

// 데이터와 함께 로그
logger.debug('사용자 로그인', { userId: '123', email: 'user@example.com' });

// 상세 메시지 (--debug 모드에서 표시)
logger.verbose('상세 HTTP 응답', { headers, body });

// 에러 (개발자 디버깅용, UI에서는 별도 처리)
logger.error('데이터베이스 연결 실패', error);
```

> **주의**: `logger.info()`는 더 이상 사용하지 않습니다.
> Normal 모드에서 로그가 보이면 안 되므로, `logger.debug()` 또는 `logger.verbose()`를 사용하세요.

---

## 3. 로그 레벨 이해하기

### 로그 레벨 (실제 사용하는 레벨)

```typescript
enum LogLevel {
  ERROR = 0,      // 시스템 작동 불가 문제 (디버깅용)
  WARN = 1,       // 주의 필요 상황 (Normal 모드 기본값 - 출력 안함)
  // INFO = 2,    // ❌ 사용하지 않음 (deprecated)
  DEBUG = 3,      // 개발자용 디버그 정보 (--verbose)
  VERBOSE = 4,    // 매우 상세한 정보 (--debug)
}
```

### 언제 어떤 레벨을 사용할까?

| 레벨 | 아이콘 | 사용 시점 | 예시 |
|------|--------|----------|------|
| ERROR | ❌ | 시스템이 작동할 수 없는 문제 | `logger.error('DB 연결 실패', error)` |
| WARN | ⚠️ | 문제는 아니지만 주의 필요 | `logger.warn('응답 시간 5초 초과')` |
| ~~INFO~~ | ~~ℹ️~~ | ~~사용하지 않음~~ | ~~deprecated~~ |
| DEBUG | 🐛 | 개발자용 디버그 정보 | `logger.debug('캐시 조회')` |
| VERBOSE | 🔍 | 매우 상세한 추적 정보 | `logger.verbose('HTTP 헤더 상세')` |

> **중요**: Normal 모드에서는 어떤 로그도 터미널에 출력되지 않습니다.
> 사용자에게 보여줄 정보는 반드시 UI 컴포넌트로 처리하세요.

---

## 4. 실행 흐름 추적하기

### 4.1 flow() - 코드 실행 경로 표시

```typescript
function processOrder(orderId: string) {
  logger.flow('주문 처리 시작');

  if (orderId.startsWith('VIP')) {
    logger.flow('VIP 주문 처리 경로');
    // VIP 처리 로직
  } else {
    logger.flow('일반 주문 처리 경로');
    // 일반 처리 로직
  }

  logger.flow('주문 처리 완료');
}
```

**출력:**
```
[...] [order.ts:23:processOrder] ➜ FLOW: 주문 처리 시작
[...] [order.ts:26:processOrder] ➜ FLOW: VIP 주문 처리 경로
[...] [order.ts:33:processOrder] ➜ FLOW: 주문 처리 완료
```

### 4.2 enter() / exit() - 함수 진입/종료

```typescript
async function getUserInfo(userId: string) {
  // 함수 시작 - 인자 표시
  logger.enter('getUserInfo', { userId });

  try {
    const user = await database.findUser(userId);
    const profile = await database.getProfile(userId);

    // 함수 종료 - 결과 표시
    logger.exit('getUserInfo', { user, profile });
    return { user, profile };

  } catch (error) {
    logger.error('getUserInfo 실패', error);
    throw error;
  }
}
```

**출력:**
```
[...] [user.ts:42:getUserInfo] ↓ ENTER: getUserInfo
  Args: { "userId": "user-123" }

[...] [user.ts:50:getUserInfo] ↑ EXIT: getUserInfo
  Result: {"user":{...},"profile":{...}}
```

---

## 5. 변수 및 상태 추적하기

### 5.1 vars() - 변수 값 확인

```typescript
function calculateTotal(price: number, quantity: number, discount: number) {
  const subtotal = price * quantity;
  const discountAmount = subtotal * discount;
  const total = subtotal - discountAmount;

  // 변수 값들을 한번에 확인
  logger.vars(
    { name: 'price', value: price },
    { name: 'quantity', value: quantity },
    { name: 'subtotal', value: subtotal },
    { name: 'discountAmount', value: discountAmount },
    { name: 'total', value: total }
  );

  return total;
}
```

**출력:**
```
[...] [calc.ts:15:calculateTotal] 📦 VARS:
   price=10000 (number)
   quantity=3 (number)
   subtotal=30000 (number)
   discountAmount=3000 (number)
   total=27000 (number)
```

### 5.2 state() - 상태 변화 추적

```typescript
function updateOrderStatus(order: Order, newStatus: string) {
  const oldStatus = order.status;

  // 상태 변경 전후를 명확히 표시
  logger.state('주문 상태 변경', oldStatus, newStatus);

  order.status = newStatus;
  saveOrder(order);
}
```

**출력:**
```
[...] [order.ts:67:updateOrderStatus] 🔄 STATE: 주문 상태 변경
  Before: "pending"
  After: "completed"
```

---

## 6. 성능 측정하기

### startTimer() / endTimer()

```typescript
async function loadBigData() {
  // 타이머 시작
  logger.startTimer('data-loading');

  const data = await database.query('SELECT * FROM big_table');

  // 타이머 종료 (경과 시간 반환)
  const elapsed = logger.endTimer('data-loading');

  // 너무 오래 걸리면 경고
  if (elapsed > 1000) {
    logger.warn('데이터 로드가 느립니다', { elapsed });
  }

  return data;
}
```

**출력:**
```
[...] [data.ts:23:loadBigData] ⏱️  TIMER START: data-loading
[...] [data.ts:27:loadBigData] ⏱️  TIMER END: data-loading 1333ms
[...] [data.ts:30:loadBigData] ⚠️  WARN: 데이터 로드가 느립니다
  Data: { "elapsed": 1333 }
```

---

## 7. HTTP 및 Tool 로깅

### 7.1 HTTP 요청/응답

```typescript
async function callExternalAPI(url: string, data: any) {
  // HTTP 요청 로깅
  logger.httpRequest('POST', url, data);

  try {
    const response = await axios.post(url, data);

    // HTTP 응답 로깅
    logger.httpResponse(response.status, response.statusText, response.data);

    return response.data;
  } catch (error) {
    logger.error('API 호출 실패', error);
    throw error;
  }
}
```

**출력:**
```
[...] [api.ts:45] → HTTP REQUEST: POST https://api.example.com/users
  Body: { "name": "John", "email": "john@example.com" }

[...] [api.ts:50] ← HTTP RESPONSE: 200 OK
  Data: { "id": "user-123", "created": true }
```

### 7.2 Tool 실행

```typescript
logger.toolExecution('read_file', { path: 'README.md' }, fileContent);
// 또는 에러 시
logger.toolExecution('read_file', { path: 'README.md' }, undefined, error);
```

**출력:**
```
[...] [tools.ts:89] 🔧 TOOL SUCCESS: read_file
  Args: { "path": "README.md" }
  Result: "# OPEN-CLI\n\n..."
```

---

## 8. 실전 예제

### 예제 1: 사용자 등록 함수

```typescript
import { logger, generateTraceId } from '../utils/logger.js';

async function registerUser(email: string, password: string) {
  // 1. 함수 진입 (필수)
  logger.enter('registerUser', { email });

  // 2. Trace ID 생성 (선택 - 요청 추적용)
  const traceId = generateTraceId();
  logger.setTraceId(traceId);

  try {
    // 3. 실행 흐름 표시
    logger.flow('이메일 중복 확인 시작');

    // 4. 타이머 시작
    logger.startTimer('email-check');
    const exists = await checkEmailExists(email);
    logger.endTimer('email-check');

    // 5. 분기 처리
    if (exists) {
      logger.flow('이메일 중복 발견 - 에러 반환');
      throw new Error('Email already exists');
    }

    logger.flow('신규 사용자 생성 시작');

    // 6. 비밀번호 해시
    logger.startTimer('password-hash');
    const hashedPassword = await bcrypt.hash(password, 10);
    logger.endTimer('password-hash');

    // 7. 변수 확인 (민감 정보 마스킹)
    logger.vars(
      { name: 'email', value: email },
      { name: 'hashedPassword', value: hashedPassword.substring(0, 20) + '...' }
    );

    // 8. 데이터베이스 저장
    logger.flow('데이터베이스에 사용자 저장');
    logger.startTimer('db-insert');
    const user = await database.createUser({ email, password: hashedPassword });
    logger.endTimer('db-insert');

    // 9. 디버그 로깅 (개발자용)
    logger.debug('사용자 등록 완료', { userId: user.id, email: user.email });

    // 10. 함수 종료 (필수)
    logger.exit('registerUser', { userId: user.id });

    return user;

  } catch (error) {
    // 11. 에러 로깅 (필수)
    logger.error('사용자 등록 실패', error as Error, { email });
    throw error;

  } finally {
    // 12. Trace ID 정리
    logger.clearTraceId();
  }
}
```

### 예제 2: 주문 처리 함수

```typescript
async function processOrder(orderId: string) {
  logger.enter('processOrder', { orderId });

  try {
    // 주문 조회
    logger.flow('주문 정보 조회');
    const order = await getOrder(orderId);

    logger.vars(
      { name: 'orderId', value: order.id },
      { name: 'status', value: order.status },
      { name: 'amount', value: order.amount }
    );

    // 상태 확인
    if (order.status !== 'pending') {
      logger.warn('이미 처리된 주문', { orderId, status: order.status });
      return;
    }

    // 재고 확인
    logger.flow('재고 확인 중');
    logger.startTimer('inventory-check');
    const available = await checkInventory(order.items);
    logger.endTimer('inventory-check');

    if (!available) {
      logger.flow('재고 부족 - 주문 취소');
      logger.state('주문 상태 변경', order.status, 'cancelled');
      order.status = 'cancelled';
      await saveOrder(order);
      throw new Error('Insufficient inventory');
    }

    // 결제 처리
    logger.flow('결제 처리 시작');
    logger.startTimer('payment-process');
    const payment = await processPayment(order);
    logger.endTimer('payment-process');

    // 주문 완료
    logger.state('주문 상태 변경', order.status, 'completed');
    order.status = 'completed';
    await saveOrder(order);

    logger.debug('주문 처리 완료', {
      orderId,
      amount: order.amount,
      paymentId: payment.id
    });

    logger.exit('processOrder', { success: true });

  } catch (error) {
    logger.error('주문 처리 실패', error as Error, { orderId });
    throw error;
  }
}
```

---

## 9. 빠른 참조 (Cheat Sheet)

### 기본 로깅

```typescript
logger.error('에러 메시지', error);           // ❌ 에러 (디버깅용)
logger.warn('경고 메시지', data);              // ⚠️ 경고 (디버깅용)
// logger.info() - ❌ 사용하지 않음 (deprecated)
logger.debug('디버그 메시지', data);           // 🐛 디버그 (--verbose)
logger.verbose('상세 메시지', data);           // 🔍 Verbose (--debug)
```

### 추적 로깅

```typescript
logger.flow('실행 경로 표시');                                    // ➜ 흐름
logger.vars({ name: 'var1', value: val1 });                    // 📦 변수
logger.enter('functionName', args);                            // ↓ 진입
logger.exit('functionName', result);                           // ↑ 종료
logger.state('설명', beforeValue, afterValue);                 // 🔄 상태
logger.startTimer('label');                                    // ⏱️ 시작
logger.endTimer('label');                                      // ⏱️ 종료
```

### HTTP 로깅

```typescript
logger.httpRequest('POST', url, body);                         // → 요청
logger.httpResponse(status, statusText, data);                 // ← 응답
```

### Tool 로깅

```typescript
logger.toolExecution(toolName, args, result, error);           // 🔧 Tool
```

### Trace ID

```typescript
const traceId = generateTraceId();
logger.setTraceId(traceId);
// ... 로깅 ...
logger.clearTraceId();
```

---

## 필수 로깅 패턴 (코드 리뷰 체크리스트)

모든 새 기능 구현 시 다음 항목을 반드시 확인하세요:

- [ ] 모든 public 함수에 `enter()` / `exit()` 추가
- [ ] 중요한 분기점마다 `flow()` 추가
- [ ] 복잡한 계산 후 `vars()`로 결과 확인
- [ ] 상태가 변경되면 `state()` 기록
- [ ] 시간이 걸리는 작업에 타이머 추가
- [ ] 모든 에러에 `logger.error()` 추가
- [ ] 민감한 정보는 마스킹 처리

---

**더 자세한 Logger API는 `src/utils/logger.ts` 소스 코드를 참조하세요.**
