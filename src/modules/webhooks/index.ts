import express, { type Express } from "express";
import { createWebhookHandler } from "./handler.js";

export function createWebhookApp(secret: string): Express {
  const app = express();
  app.disable("x-powered-by");
  app.post("/webhook", express.raw({ type: "application/json", limit: "1mb" }), createWebhookHandler(secret));
  return app;
}

export function startWebhookServer(): void {
  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("WEBHOOK_SECRET is required");

  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const app = createWebhookApp(secret);
  const server = app.listen(port, () => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: "webhook.server.started", port }));
  });
  server.on("error", (error: Error) => {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "webhook.server.error", message: error.message }));
    process.exitCode = 1;
  });
}
