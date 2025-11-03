/**
 * Error Classes Tests
 */

import {
  BaseError,
  NetworkError,
  APIError,
  TimeoutError,
  ConfigError,
  InitializationError,
  ValidationError,
  LLMError,
  FileNotFoundError,
  getUserMessage,
  isRecoverableError,
  errorToJSON,
} from '../src/errors';

describe('BaseError', () => {
  test('should create error with all properties', () => {
    const error = new BaseError('Test error', 'TEST_ERROR', {
      details: { foo: 'bar' },
      isRecoverable: true,
      userMessage: 'User friendly message',
    });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.isRecoverable).toBe(true);
    expect(error.userMessage).toBe('User friendly message');
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  test('should have default values', () => {
    const error = new BaseError('Test error', 'TEST_ERROR');

    expect(error.isRecoverable).toBe(false);
    expect(error.userMessage).toBe('Test error');
    expect(error.details).toBeUndefined();
  });

  test('toJSON should return correct format', () => {
    const error = new BaseError('Test error', 'TEST_ERROR');
    const json = error.toJSON();

    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('code');
    expect(json).toHaveProperty('message');
    expect(json).toHaveProperty('userMessage');
    expect(json).toHaveProperty('isRecoverable');
    expect(json).toHaveProperty('timestamp');
  });
});

describe('NetworkError', () => {
  test('should be recoverable by default', () => {
    const error = new NetworkError('Connection failed');

    expect(error.isRecoverable).toBe(true);
    expect(error.code).toBe('NETWORK_ERROR');
  });

  test('should have user-friendly message', () => {
    const error = new NetworkError('Connection failed');

    expect(error.getUserMessage()).toContain('네트워크');
  });
});

describe('APIError', () => {
  test('should handle 401 status code', () => {
    const error = new APIError('Unauthorized', 401);

    expect(error.statusCode).toBe(401);
    expect(error.getUserMessage()).toContain('인증');
  });

  test('should handle 500 status code as recoverable', () => {
    const error = new APIError('Server error', 500);

    expect(error.isRecoverable).toBe(true);
    expect(error.getUserMessage()).toContain('서버');
  });

  test('should handle 404 status code as non-recoverable', () => {
    const error = new APIError('Not found', 404);

    expect(error.isRecoverable).toBe(false);
  });
});

describe('TimeoutError', () => {
  test('should include timeout value', () => {
    const error = new TimeoutError(5000);

    expect(error.timeout).toBe(5000);
    expect(error.isRecoverable).toBe(true);
    expect(error.getUserMessage()).toContain('5000');
  });
});

describe('ConfigError', () => {
  test('should not be recoverable', () => {
    const error = new ConfigError('Invalid config');

    expect(error.isRecoverable).toBe(false);
    expect(error.code).toBe('CONFIG_ERROR');
  });
});

describe('InitializationError', () => {
  test('should suggest init command', () => {
    const error = new InitializationError('Not initialized');

    expect(error.getUserMessage()).toContain('config init');
  });
});

describe('ValidationError', () => {
  test('should include field information', () => {
    const error = new ValidationError('Invalid email', 'email', 'not-an-email');

    expect(error.field).toBe('email');
    expect(error.value).toBe('not-an-email');
    expect(error.isRecoverable).toBe(true);
  });
});

describe('LLMError', () => {
  test('should be recoverable by default', () => {
    const error = new LLMError('API failed');

    expect(error.isRecoverable).toBe(true);
  });
});

describe('FileSystemError', () => {
  test('should include path', () => {
    const error = new FileNotFoundError('/path/to/file');

    expect(error.path).toBe('/path/to/file');
    expect(error.code).toBe('FILE_NOT_FOUND');
  });
});

describe('Error Utilities', () => {
  test('getUserMessage should extract message from BaseError', () => {
    const error = new NetworkError('Test');
    const message = getUserMessage(error);

    expect(message).toBe(error.getUserMessage());
  });

  test('getUserMessage should handle regular Error', () => {
    const error = new Error('Regular error');
    const message = getUserMessage(error);

    expect(message).toBe('Regular error');
  });

  test('getUserMessage should handle non-Error values', () => {
    const message = getUserMessage('string error');

    expect(message).toBe('string error');
  });

  test('isRecoverableError should check BaseError', () => {
    const recoverable = new NetworkError('Test');
    const nonRecoverable = new ConfigError('Test');

    expect(isRecoverableError(recoverable)).toBe(true);
    expect(isRecoverableError(nonRecoverable)).toBe(false);
  });

  test('errorToJSON should convert BaseError', () => {
    const error = new NetworkError('Test');
    const json = errorToJSON(error);

    expect(json).toHaveProperty('code');
    expect(json).toHaveProperty('message');
  });

  test('errorToJSON should handle regular Error', () => {
    const error = new Error('Test');
    const json = errorToJSON(error);

    expect(json).toHaveProperty('message');
    expect(json['message']).toBe('Test');
  });
});
