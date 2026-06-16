import { createServer, type Server } from 'node:http';
import type { Client } from 'discord.js';
import type { LavalinkClient } from './lavalink.js';
import type { QueueStore } from './queue-store.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('health');

export interface HealthProbes {
  discord: Client;
  lavalink: LavalinkClient;
  queueStore: QueueStore;
}

interface HealthReport {
  status: 'ok' | 'degraded';
  uptime: number;
  checks: {
    discord: boolean;
    lavalink: boolean;
    database: boolean;
  };
}

async function buildReport(probes: HealthProbes): Promise<HealthReport> {
  const discord = probes.discord.isReady();
  const lavalink = probes.lavalink.isNodeReady();
  const database = await probes.queueStore.ping();

  const status = discord && lavalink && database ? 'ok' : 'degraded';

  return {
    status,
    uptime: Math.floor(process.uptime()),
    checks: { discord, lavalink, database },
  };
}

/**
 * Tiny readiness endpoint for external monitors (Uptime Kuma).
 * `GET /health` → 200 when every dependency is up, 503 when any is down.
 * Database counts as up when persistence is disabled (it is optional).
 * Zero deps — built on node:http.
 */
export function startHealthServer(port: number, probes: HealthProbes): Server {
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }

    buildReport(probes)
      .then((report) => {
        const code = report.status === 'ok' ? 200 : 503;
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(report));
      })
      .catch((error) => {
        logger.error({ error }, 'Health check failed to build report');
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'degraded', error: 'probe_failed' }));
      });
  });

  server.listen(port, () => {
    logger.info({ port }, 'Health server listening');
  });

  server.on('error', (error) => {
    logger.error({ error, port }, 'Health server error');
  });

  return server;
}
