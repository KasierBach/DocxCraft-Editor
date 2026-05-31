export function createServerLoggerOptions({
  env,
  level,
}: {
  env?: string;
  level: string;
}) {
  if (env === 'production') {
    return {
      level,
    };
  }

  return {
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        singleLine: true,
        translateTime: 'SYS:standard',
      },
    },
  };
}
