import { randomUUID } from "node:crypto";

export type CreateDocumentBody = {
  external_id: string;
  title: string;
  body: string;
};

export function parseCreateDocumentBody(
  body: unknown,
): { ok: true; data: CreateDocumentBody } | { ok: false; error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }

  const record = body as Record<string, unknown>;
  const title = record.title;
  const description = record.description;
  const bodyField = record.body ?? description;
  const externalRaw = record.external_id ?? record.externalId;

  if (typeof title !== "string" || title.trim() === "") {
    return { ok: false, error: "title is required and must be a non-empty string" };
  }
  if (typeof bodyField !== "string") {
    return { ok: false, error: "body is required and must be a string" };
  }

  const external_id =
    typeof externalRaw === "string" && externalRaw.trim() !== ""
      ? externalRaw.trim()
      : randomUUID();

  return {
    ok: true,
    data: {
      external_id,
      title: title.trim(),
      body: bodyField,
    },
  };
}
