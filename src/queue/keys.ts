export function queueWaitKey(queueName: string): string {
  return `queue:${queueName}:wait`;
}

export function queueActiveKey(queueName: string): string {
  return `queue:${queueName}:active`;
}

export function queueDelayedKey(queueName: string): string {
  return `queue:${queueName}:delayed`;
}

export function queueDeadKey(queueName: string): string {
  return `queue:${queueName}:dead`;
}

export function jobKey(jobId: string): string {
  return `job:${jobId}`;
}
