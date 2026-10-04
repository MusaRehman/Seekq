import type { RedisDeps } from "../shared/types.js";
import type { JobRecord, WorkerOptions } from "./jobs.js";
import {
  markDone,
  markFailed,
  promoteDelayed,
  renewActive,
  rescueStuck,
  takeNext,
} from "./redis-ops.js";

export type JobHandler = (
  deps: RedisDeps,
  job: JobRecord,
) => Promise<void>;

export async function runWorker(
  workerRedis: RedisDeps,
  opsRedis: RedisDeps,
  queueName: string,
  handler: JobHandler,
  options: WorkerOptions = {},
): Promise<void> {
  const concurrency = options.concurrency ?? 2;
  const takeTimeoutSeconds = options.takeTimeoutSeconds ?? 5;
  const stuckAfterMs = options.stuckAfterMs ?? 120_000;
  const promoteIntervalMs = options.promoteIntervalMs ?? 5_000;
  const rescueIntervalMs = options.rescueIntervalMs ?? 30_000;

  let stopping = false;
  const running = new Set<Promise<void>>();

  const stop = (): void => {
    stopping = true;
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const promoteTimer = setInterval(() => {
    void promoteDelayed(opsRedis, queueName);
  }, promoteIntervalMs);

  const rescueTimer = setInterval(() => {
    void rescueStuck(opsRedis, queueName, stuckAfterMs);
  }, rescueIntervalMs);

  while (!stopping) {
    while (running.size < concurrency && !stopping) {
      const job = await takeNext(workerRedis, queueName, takeTimeoutSeconds);
      if (!job) {
        break;
      }

      const task = (async () => {
        const heartbeat = setInterval(() => {
          void renewActive(opsRedis, job.id);
        }, Math.floor(stuckAfterMs / 3));

        try {
          await handler(opsRedis, job);
          await markDone(opsRedis, queueName, job.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await markFailed(opsRedis, queueName, job.id, message);
        } finally {
          clearInterval(heartbeat);
        }
      })();

      running.add(task);
      void task.finally(() => {
        running.delete(task);
      });
    }

    if (running.size === 0) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }

    await Promise.race(running);
  }

  clearInterval(promoteTimer);
  clearInterval(rescueTimer);
  await Promise.all([...running]);
}
