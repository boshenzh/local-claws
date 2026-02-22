import { metricsSnapshot } from "@/lib/metrics";
import { jsonOk } from "@/lib/http";
import { isPostgresConfigured } from "@/lib/postgres";

export async function GET() {
  const postgresConfigured = isPostgresConfigured();
  const isProduction = process.env.NODE_ENV === "production";
  return jsonOk({
    metrics: await metricsSnapshot(),
    store: {
      mode: postgresConfigured ? "postgres" : "memory",
      production_persistence_ok: !isProduction || postgresConfigured
    }
  });
}
