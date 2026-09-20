const positional = process.argv.slice(2).filter((value) => !value.startsWith('--'));
const flag = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
};

const baseUrl = flag('--url', process.env.LOAD_TEST_URL ?? positional[0] ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
const requestCount = Math.max(1, Number(flag('--requests', positional[1] ?? '50')) || 50);
const concurrency = Math.min(requestCount, Math.max(1, Number(flag('--concurrency', positional[2] ?? '10')) || 10));
const results: Array<{ status: number; durationMs: number }> = [];
let nextRequest = 0;

async function worker() {
  while (true) {
    const requestNumber = nextRequest++;
    if (requestNumber >= requestCount) return;
    const started = performance.now();
    const response = await fetch(`${baseUrl}/api/health`);
    results[requestNumber] = { status: response.status, durationMs: performance.now() - started };
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const failed = results.filter((result) => result.status !== 200);
const durations = results.map((result) => result.durationMs).sort((left, right) => left - right);
const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)] ?? 0;
console.log(`${requestCount} requests, concurrency ${concurrency}, p95 ${p95.toFixed(1)}ms, failures ${failed.length}`);
if (failed.length > 0) process.exitCode = 1;
