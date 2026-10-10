import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

type WebhookOutcome = "merged" | "closed" | "ignored";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validSignature(payload: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function logWebhook(outcome: WebhookOutcome, delivery: string, details: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: "github.webhook", delivery, outcome, ...details }));
}

export function createWebhookHandler(secret: string) {
  if (!secret.trim()) throw new Error("WEBHOOK_SECRET is required");

  return (request: Request, response: Response): void => {
    const payload = request.body as unknown;
    if (!Buffer.isBuffer(payload)) {
      response.status(415).json({ error: "Expected an application/json payload" });
      return;
    }

    if (!validSignature(payload, request.get("x-hub-signature-256"), secret)) {
      response.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse(payload.toString("utf8")) as unknown;
    } catch {
      response.status(400).json({ error: "Invalid JSON payload" });
      return;
    }

    const delivery = request.get("x-github-delivery") ?? "unknown";
    const event = request.get("x-github-event");
    if (event !== "pull_request") {
      logWebhook("ignored", delivery, { githubEvent: event ?? "unknown" });
      response.status(202).json({ outcome: "ignored" });
      return;
    }

    if (!isRecord(body) || !isRecord(body.pull_request) || !isRecord(body.repository) ||
        typeof body.number !== "number" || !Number.isSafeInteger(body.number) || body.number < 1 ||
        typeof body.repository.full_name !== "string" || typeof body.action !== "string") {
      response.status(400).json({ error: "Invalid pull_request payload" });
      return;
    }

    if (body.action !== "closed") {
      logWebhook("ignored", delivery, { githubEvent: event, action: body.action });
      response.status(202).json({ outcome: "ignored" });
      return;
    }

    if (typeof body.pull_request.merged !== "boolean") {
      response.status(400).json({ error: "Invalid pull_request payload" });
      return;
    }

    const outcome = body.pull_request.merged ? "merged" : "closed";
    logWebhook(outcome, delivery, { repository: body.repository.full_name, pullNumber: body.number });
    response.status(200).json({ outcome });
  };
}
