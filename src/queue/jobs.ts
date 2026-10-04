export type JobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "delayed"
  | "dead";

export type JobRecord = {
  id: string;
  name: string;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  activeAt: number | null;
};

export type EnqueueOptions = {
  jobId?: string;
  maxAttempts?: number;
};

export type WorkerOptions = {
  concurrency?: number;
  takeTimeoutSeconds?: number;
  stuckAfterMs?: number;
  promoteIntervalMs?: number;
  rescueIntervalMs?: number;
};

export const INDEX_QUEUE = "index";
export const INDEX_DOCUMENT_JOB = "index-document";

export type IndexDocumentPayload = {
  documentId: number;
};
