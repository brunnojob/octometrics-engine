import "dotenv/config";

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "metrics") {
    const [{ fetchMetrics }, { processMetrics }] = await Promise.all([
      import("./modules/metrics/fetcher.graphql.js"),
      import("./modules/metrics/processor.js")
    ]);
    const now = new Date();
    const metrics = processMetrics(await fetchMetrics(now), now);
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  if (mode === "webhooks") {
    const { startWebhookServer } = await import("./modules/webhooks/index.js");
    startWebhookServer();
    return;
  }

  throw new Error("Usage: node dist/index.js <metrics|webhooks>");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "application.error", message }));
  process.exitCode = 1;
});
