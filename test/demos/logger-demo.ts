/**
 * Logger 사용 데모
 *
 * 실행 방법:
 * LOG_LEVEL=3 npx ts-node test/demos/logger-demo.ts
 * 또는
 * VERBOSE=true npx ts-node test/demos/logger-demo.ts
 */

import { logger, generateTraceId, createLogger, LogLevel } from '../../src/utils/logger.js';

// ============================================
// 예제 1: 기본 로깅
// ============================================
function basicLoggingDemo() {
  console.log('\n=== 기본 로깅 데모 ===\n');

  logger.info('애플리케이션 시작');
  logger.debug('디버그 정보', { version: '1.0.0' });
  logger.warn('경고: 메모리 사용량 높음', { usage: '85%' });
  logger.error('에러 발생', new Error('Something went wrong'));
}

// ============================================
// 예제 2: 함수 진입/종료 추적
// ============================================
async function processOrder(orderId: string, amount: number) {
  logger.enter('processOrder', { orderId, amount });

  try {
    // 주문 검증
    logger.flow('주문 검증 중');
    await new Promise(resolve => setTimeout(resolve, 100));

    if (amount < 0) {
      throw new Error('Invalid amount');
    }

    // 결제 처리
    logger.flow('결제 처리 중', { amount });
    await new Promise(resolve => setTimeout(resolve, 200));

    const result = { orderId, status: 'completed', amount };
    logger.exit('processOrder', result);
    return result;
  } catch (error) {
    logger.error('주문 처리 실패', error as Error);
    throw error;
  }
}

async function functionTrackingDemo() {
  console.log('\n=== 함수 진입/종료 추적 데모 ===\n');

  await processOrder('ORD-12345', 15000);
}

// ============================================
// 예제 3: 변수 추적
// ============================================
function calculatePrice(items: { name: string; price: number }[], discount: number) {
  logger.enter('calculatePrice', { itemCount: items.length, discount });

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = subtotal * discount;
  const tax = subtotal * 0.1;
  const total = subtotal - discountAmount + tax;

  // 중요한 계산 변수들을 한번에 로깅
  logger.vars(
    { name: 'subtotal', value: subtotal, type: 'number' },
    { name: 'discountAmount', value: discountAmount, type: 'number' },
    { name: 'tax', value: tax, type: 'number' },
    { name: 'total', value: total, type: 'number' }
  );

  logger.exit('calculatePrice', total);
  return total;
}

function variableTrackingDemo() {
  console.log('\n=== 변수 추적 데모 ===\n');

  const items = [
    { name: 'Item 1', price: 10000 },
    { name: 'Item 2', price: 20000 },
    { name: 'Item 3', price: 15000 },
  ];

  calculatePrice(items, 0.1); // 10% 할인
}

// ============================================
// 예제 4: 상태 변화 추적
// ============================================
interface User {
  id: string;
  name: string;
  status: string;
}

function updateUserStatus(user: User, newStatus: string) {
  logger.enter('updateUserStatus', { userId: user.id, newStatus });

  const oldStatus = user.status;

  // 상태 변경 전후 비교
  logger.state('사용자 상태 변경', oldStatus, newStatus);

  user.status = newStatus;

  logger.exit('updateUserStatus');
}

function stateChangeDemo() {
  console.log('\n=== 상태 변화 추적 데모 ===\n');

  const user: User = {
    id: 'USER-001',
    name: 'John Doe',
    status: 'active',
  };

  updateUserStatus(user, 'suspended');
  updateUserStatus(user, 'active');
}

// ============================================
// 예제 5: 성능 측정
// ============================================
async function expensiveOperation() {
  logger.enter('expensiveOperation');

  logger.startTimer('database-query');
  await new Promise(resolve => setTimeout(resolve, 500));
  logger.endTimer('database-query');

  logger.startTimer('api-call');
  await new Promise(resolve => setTimeout(resolve, 300));
  logger.endTimer('api-call');

  logger.startTimer('data-processing');
  await new Promise(resolve => setTimeout(resolve, 200));
  const elapsed = logger.endTimer('data-processing');

  if (elapsed > 150) {
    logger.warn('데이터 처리 느림', { elapsed });
  }

  logger.exit('expensiveOperation');
}

async function performanceDemo() {
  console.log('\n=== 성능 측정 데모 ===\n');

  await expensiveOperation();
}

// ============================================
// 예제 6: Trace ID를 이용한 요청 추적
// ============================================
async function handleRequest(requestId: string, userId: string) {
  const traceId = generateTraceId();
  logger.setTraceId(traceId);

  logger.info('요청 시작', { requestId, userId });

  try {
    logger.flow('사용자 인증 중');
    await new Promise(resolve => setTimeout(resolve, 100));

    logger.flow('데이터 조회 중');
    await new Promise(resolve => setTimeout(resolve, 150));

    logger.flow('응답 생성 중');
    await new Promise(resolve => setTimeout(resolve, 50));

    logger.info('요청 완료', { requestId, duration: 300 });
  } catch (error) {
    logger.error('요청 실패', error as Error);
  } finally {
    logger.clearTraceId();
  }
}

async function traceIdDemo() {
  console.log('\n=== Trace ID 추적 데모 ===\n');

  // 두 개의 동시 요청 - 각각 다른 Trace ID를 가짐
  await Promise.all([
    handleRequest('REQ-001', 'user-123'),
    handleRequest('REQ-002', 'user-456'),
  ]);
}

// ============================================
// 예제 7: 모듈별 Logger
// ============================================
function moduleLoggerDemo() {
  console.log('\n=== 모듈별 Logger 데모 ===\n');

  const dbLogger = createLogger('DATABASE', { level: LogLevel.DEBUG });
  const apiLogger = createLogger('API', { level: LogLevel.DEBUG });
  const cacheLogger = createLogger('CACHE', { level: LogLevel.DEBUG });

  dbLogger.info('데이터베이스 연결됨');
  dbLogger.debug('쿼리 실행', { sql: 'SELECT * FROM users' });

  apiLogger.info('API 서버 시작', { port: 3000 });
  apiLogger.debug('라우트 등록', { routes: ['/users', '/posts'] });

  cacheLogger.info('캐시 초기화');
  cacheLogger.debug('캐시 히트', { key: 'user:123' });
}

// ============================================
// 예제 8: 복잡한 실행 흐름
// ============================================
async function complexWorkflow(data: { type: string; value: number }) {
  logger.enter('complexWorkflow', data);

  logger.flow('워크플로우 시작');

  // 분기 1
  if (data.type === 'fast') {
    logger.flow('빠른 처리 경로 선택');
    await fastProcess(data.value);
  } else if (data.type === 'normal') {
    logger.flow('일반 처리 경로 선택');
    await normalProcess(data.value);
  } else {
    logger.flow('느린 처리 경로 선택');
    await slowProcess(data.value);
  }

  logger.flow('워크플로우 완료');
  logger.exit('complexWorkflow');
}

async function fastProcess(value: number) {
  logger.enter('fastProcess', { value });
  logger.flow('빠른 처리 시작');
  await new Promise(resolve => setTimeout(resolve, 50));
  logger.vars({ name: 'processedValue', value: value * 2 });
  logger.exit('fastProcess');
}

async function normalProcess(value: number) {
  logger.enter('normalProcess', { value });
  logger.flow('일반 처리 시작');
  await new Promise(resolve => setTimeout(resolve, 150));
  logger.vars({ name: 'processedValue', value: value * 3 });
  logger.exit('normalProcess');
}

async function slowProcess(value: number) {
  logger.enter('slowProcess', { value });
  logger.flow('느린 처리 시작');
  await new Promise(resolve => setTimeout(resolve, 300));
  logger.vars({ name: 'processedValue', value: value * 5 });
  logger.exit('slowProcess');
}

async function complexFlowDemo() {
  console.log('\n=== 복잡한 실행 흐름 데모 ===\n');

  await complexWorkflow({ type: 'fast', value: 10 });
  await complexWorkflow({ type: 'normal', value: 20 });
  await complexWorkflow({ type: 'slow', value: 30 });
}

// ============================================
// 메인 실행
// ============================================
async function main() {
  console.log('🚀 Logger 데모 시작');
  console.log('현재 로그 레벨:', process.env['LOG_LEVEL'] || '기본 (INFO)');
  console.log('\n⚠️  모든 로그를 보려면 LOG_LEVEL=3 또는 VERBOSE=true로 실행하세요\n');

  try {
    // 모든 데모 실행
    basicLoggingDemo();
    await functionTrackingDemo();
    variableTrackingDemo();
    stateChangeDemo();
    await performanceDemo();
    await traceIdDemo();
    moduleLoggerDemo();
    await complexFlowDemo();

    console.log('\n✅ 모든 데모 완료\n');
  } catch (error) {
    logger.error('데모 실행 중 에러 발생', error as Error);
  }
}

// 실행
if (require.main === module) {
  main();
}
