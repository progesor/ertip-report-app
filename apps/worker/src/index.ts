import { readRuntimeConfig } from '../../../packages/config/src/index.ts';

const runtime = readRuntimeConfig();
const heartbeatMs = 30_000;

function safeWorkerState() {
  return {
    service: 'ertip-report-worker',
    environment: runtime.appEnvironment,
    demoMode: runtime.demoMode,
    odooConfigured: runtime.odoo.configured,
    timestamp: new Date().toISOString(),
  };
}

console.info(JSON.stringify({ event: 'worker.started', ...safeWorkerState() }));

const heartbeat = setInterval(() => {
  console.info(JSON.stringify({ event: 'worker.heartbeat', ...safeWorkerState() }));
}, heartbeatMs);

function shutdown(signal: string) {
  clearInterval(heartbeat);
  console.info(JSON.stringify({ event: 'worker.stopped', signal, ...safeWorkerState() }));
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
