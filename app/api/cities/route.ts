import { listCities } from "@/lib/calendar";
import { jsonOk } from "@/lib/http";

export async function GET() {
  return jsonOk({ cities: listCities() });
}
