import { listCities } from "@/lib/calendar";
import { jsonOk } from "@/lib/http";
import { ensureStoreReady } from "@/lib/store";

export async function GET() {
  await ensureStoreReady();
  return jsonOk({ cities: listCities() });
}
