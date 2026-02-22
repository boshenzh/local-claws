import { metricsSnapshot } from "@/lib/metrics";
import { jsonOk } from "@/lib/http";

export async function GET() {
  return jsonOk({ metrics: await metricsSnapshot() });
}
