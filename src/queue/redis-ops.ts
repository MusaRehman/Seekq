import { randomUUID } from "node:crypto";
import type { RedisDeps } from "../shared/types.js";
import { nowMs } from "../shared/clock.js";
import {
  jobKey,
  queueActiveKey,
  queueDeadKey,
  queueDelayedKey,
  queueWaitKey,
} from "./keys.js";
import type { EnqueueOptions, JobRecord, JobStatus } from "./jobs.js";
import { retryDelayMs } from "./retry.js";

function parseJobHash(id: string, raw: Record<string, string>): JobRecord | null {
  if (!raw.name) {
    return null;
  }
  let payload: unknown = null;
  if (raw.payload) {
    try {
      payload = JSON.parse(raw.payload) as unknown;
    } catch {
      payload = raw.payload;
    }
  }
  return {
    id,
    name: raw.name,
    payload,
    status: (raw.status as JobStatus) ?? "waiting",
    attempts: Number(raw.attempts ?? "0"),
    maxAttempts: Number(raw.maxAttempts ?? "3"),
    error: raw.error ?? null,
    createdAt: Number(raw.createdAt ?? "0"),
    updatedAt: Number(raw.updatedAt ?? "0"),
    activeAt: raw.activeAt ? Number(raw.activeAt) : null,
  };
}

export async function getJob(
  deps: RedisDeps,
  jobId: string,
): Promise<JobRecord | null> {
  const raw = await deps.redis.hgetall(jobKey(jobId));
  if (Object.keys(raw).length === 0) {
    return null;
  }
  return parseJobHash(jobId, raw);
}

export async function enqueue(
  deps: RedisDeps,
  queueName: string,
  name: string,
  payload: unknown,
  options: EnqueueOptions = {},
): Promise<{ jobId: string; created: boolean }> {
  const jobId = options.jobId ?? randomUUID();
  const maxAttempts = options.maxAttempts ?? 5;
  const key = jobKey(jobId);

  if (options.jobId) {
    const exists = await deps.redis.exists(key);
    if (exists) {
      return { jobId, created: false };
    }
  }

  const now = nowMs();
  const multi = deps.redis.multi();
  multi.hset(key, {
    name,
    payload: JSON.stringify(payload),
    status: "waiting",
    attempts: "0",
    maxAttempts: String(maxAttempts),
    error: "",
    createdAt: String(now),
    updatedAt: String(now),
    activeAt: "",
  });
  multi.rpush(queueWaitKey(queueName), jobId);
  await multi.exec();

  return { jobId, created: true };
}

export async function takeNext(
  deps: RedisDeps,
  queueName: string,
  waitSeconds: number,
): Promise<JobRecord | null> {
  const waitKey = queueWaitKey(queueName);
  const activeKey = queueActiveKey(queueName);

  const jobId = await deps.redis.blmove(waitKey, activeKey, "LEFT", "RIGHT", waitSeconds);
  if (!jobId) {
    return null;
  }

  const now = nowMs();
  await deps.redis.hset(jobKey(jobId), {
    status: "active",
    updatedAt: String(now),
    activeAt: String(now),
  });

  return getJob(deps, jobId);
}

export async function renewActive(
  deps: RedisDeps,
  jobId: string,
): Promise<void> {
  const now = nowMs();
  await deps.redis.hset(jobKey(jobId), {
    activeAt: String(now),
    updatedAt: String(now),
  });
}

export async function markDone(
  deps: RedisDeps,
  queueName: string,
  jobId: string,
): Promise<void> {
  const now = nowMs();
  const multi = deps.redis.multi();
  multi.lrem(queueActiveKey(queueName), 0, jobId);
  multi.hset(jobKey(jobId), {
    status: "completed",
    updatedAt: String(now),
    error: "",
  });
  await multi.exec();
}

export async function markFailed(
  deps: RedisDeps,
  queueName: string,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const job = await getJob(deps, jobId);
  if (!job) {
    return;
  }

  const attempts = job.attempts + 1;
  const now = nowMs();
  const activeKey = queueActiveKey(queueName);
  const jobHashKey = jobKey(jobId);

  if (attempts < job.maxAttempts) {
    const runAt = now + retryDelayMs(attempts);
    const multi = deps.redis.multi();
    multi.lrem(activeKey, 0, jobId);
    multi.zadd(queueDelayedKey(queueName), runAt, jobId);
    multi.hset(jobHashKey, {
      status: "delayed",
      attempts: String(attempts),
      error: errorMessage,
      updatedAt: String(now),
      activeAt: "",
    });
    await multi.exec();
    return;
  }

  const multi = deps.redis.multi();
  multi.lrem(activeKey, 0, jobId);
  multi.rpush(queueDeadKey(queueName), jobId);
  multi.hset(jobHashKey, {
    status: "dead",
    attempts: String(attempts),
    error: errorMessage,
    updatedAt: String(now),
    activeAt: "",
  });
  await multi.exec();
}

export async function promoteDelayed(
  deps: RedisDeps,
  queueName: string,
): Promise<number> {
  const delayedKey = queueDelayedKey(queueName);
  const now = nowMs();
  const ids = await deps.redis.zrangebyscore(delayedKey, 0, now);
  if (ids.length === 0) {
    return 0;
  }

  const multi = deps.redis.multi();
  for (const id of ids) {
    multi.zrem(delayedKey, id);
    multi.rpush(queueWaitKey(queueName), id);
    multi.hset(jobKey(id), {
      status: "waiting",
      updatedAt: String(now),
    });
  }
  await multi.exec();
  return ids.length;
}

export async function rescueStuck(
  deps: RedisDeps,
  queueName: string,
  stuckAfterMs: number,
): Promise<number> {
  const activeKey = queueActiveKey(queueName);
  const ids = await deps.redis.lrange(activeKey, 0, -1);
  const now = nowMs();
  let rescued = 0;

  for (const id of ids) {
    const raw = await deps.redis.hget(jobKey(id), "activeAt");
    const activeAt = raw ? Number(raw) : 0;
    if (activeAt > 0 && now - activeAt < stuckAfterMs) {
      continue;
    }

    const multi = deps.redis.multi();
    multi.lrem(activeKey, 0, id);
    multi.rpush(queueWaitKey(queueName), id);
    multi.hset(jobKey(id), {
      status: "waiting",
      updatedAt: String(now),
      activeAt: "",
    });
    await multi.exec();
    rescued += 1;
  }

  return rescued;
}

export async function retryDeadJob(
  deps: RedisDeps,
  queueName: string,
  jobId: string,
): Promise<boolean> {
  const deadKey = queueDeadKey(queueName);
  const removed = await deps.redis.lrem(deadKey, 0, jobId);
  if (removed === 0) {
    return false;
  }

  const now = nowMs();
  const multi = deps.redis.multi();
  multi.rpush(queueWaitKey(queueName), jobId);
  multi.hset(jobKey(jobId), {
    status: "waiting",
    attempts: "0",
    error: "",
    updatedAt: String(now),
    activeAt: "",
  });
  await multi.exec();
  return true;
}

export async function getQueueStats(
  deps: RedisDeps,
  queueName: string,
): Promise<{ waiting: number; active: number; delayed: number; dead: number }> {
  const [waiting, active, delayed, dead] = await Promise.all([
    deps.redis.llen(queueWaitKey(queueName)),
    deps.redis.llen(queueActiveKey(queueName)),
    deps.redis.zcard(queueDelayedKey(queueName)),
    deps.redis.llen(queueDeadKey(queueName)),
  ]);
  return { waiting, active, delayed, dead };
}

export async function listDeadJobs(
  deps: RedisDeps,
  queueName: string,
): Promise<JobRecord[]> {
  const ids = await deps.redis.lrange(queueDeadKey(queueName), 0, -1);
  const jobs: JobRecord[] = [];
  for (const id of ids) {
    const job = await getJob(deps, id);
    if (job) {
      jobs.push(job);
    }
  }
  return jobs;
}
