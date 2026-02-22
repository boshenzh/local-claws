import { ensurePostgresTables, isPostgresConfigured, queryPg } from "@/lib/postgres";

type Counters = {
  events_created_total: number;
  events_delivered_total: number;
  events_ack_total: number;
  events_failed_total: number;
  stream_connected_agents_gauge: number;
  stream_reconnect_total: number;
  backlog_fetch_total: number;
};

type CounterName = keyof Counters;
type MetricKind = "counter" | "gauge";

const counters: Counters = {
  events_created_total: 0,
  events_delivered_total: 0,
  events_ack_total: 0,
  events_failed_total: 0,
  stream_connected_agents_gauge: 0,
  stream_reconnect_total: 0,
  backlog_fetch_total: 0
};

const METRIC_KIND: Record<CounterName, MetricKind> = {
  events_created_total: "counter",
  events_delivered_total: "counter",
  events_ack_total: "counter",
  events_failed_total: "counter",
  stream_connected_agents_gauge: "gauge",
  stream_reconnect_total: "counter",
  backlog_fetch_total: "counter"
};

const USE_POSTGRES = isPostgresConfigured();

async function upsertMetricValue(name: CounterName, value: number, mode: "set" | "delta"): Promise<void> {
  await ensurePostgresTables();
  const kind = METRIC_KIND[name];
  if (mode === "set") {
    await queryPg(
      `
      INSERT INTO localclaws_metrics (name, kind, value, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (name)
      DO UPDATE SET kind = EXCLUDED.kind, value = EXCLUDED.value, updated_at = NOW()
      `,
      [name, kind, Math.trunc(value)]
    );
    return;
  }

  await queryPg(
    `
      INSERT INTO localclaws_metrics (name, kind, value, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (name)
      DO UPDATE SET kind = EXCLUDED.kind, value = localclaws_metrics.value + EXCLUDED.value, updated_at = NOW()
    `,
    [name, kind, Math.trunc(value)]
  );
}

export async function metricsSnapshot(): Promise<Counters> {
  if (!USE_POSTGRES) {
    return { ...counters };
  }

  await ensurePostgresTables();
  const result = await queryPg<{ name: string; value: string }>(
    "SELECT name, value FROM localclaws_metrics"
  );

  const snapshot: Counters = {
    events_created_total: 0,
    events_delivered_total: 0,
    events_ack_total: 0,
    events_failed_total: 0,
    stream_connected_agents_gauge: 0,
    stream_reconnect_total: 0,
    backlog_fetch_total: 0
  };

  for (const row of result.rows) {
    if (!(row.name in snapshot)) continue;
    const parsed = Number.parseInt(row.value, 10);
    if (!Number.isNaN(parsed)) {
      snapshot[row.name as CounterName] = parsed;
    }
  }

  return snapshot;
}

export function metricIncrement(name: CounterName, by = 1): void {
  if (!USE_POSTGRES) {
    counters[name] += by;
    return;
  }
  void upsertMetricValue(name, by, "delta");
}

export function metricGaugeSet(name: CounterName, value: number): void {
  if (!USE_POSTGRES) {
    counters[name] = value;
    return;
  }
  void upsertMetricValue(name, value, "set");
}

export function metricGaugeDelta(name: CounterName, delta: number): void {
  if (!USE_POSTGRES) {
    counters[name] += delta;
    return;
  }
  void upsertMetricValue(name, delta, "delta");
}
