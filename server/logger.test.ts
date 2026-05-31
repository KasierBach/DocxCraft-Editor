// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { createServerLoggerOptions } from './logger.ts';

describe('createServerLoggerOptions', () => {
  it('enables pino-pretty output for local development', () => {
    expect(createServerLoggerOptions({ env: 'development', level: 'debug' })).toEqual({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          singleLine: true,
          translateTime: 'SYS:standard',
        },
      },
    });
  });

  it('keeps structured JSON logs in production', () => {
    expect(createServerLoggerOptions({ env: 'production', level: 'warn' })).toEqual({
      level: 'warn',
    });
  });
});
