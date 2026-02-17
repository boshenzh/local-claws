type Counters = {
  events_created_total: number;
  events_delivered_total: number;
  events_ack_total: number;
  events_failed_total: number;
  stream_connected_agents_gauge: number;
  stream_reconnect_total: number;
  backlog_fetch_total: number;
};

const counters: Counters = {
  events_created_total: 0,
  events_delivered_total: 0,
  events_ack_total: 0,
  events_failed_total: 0,
  stream_connected_agents_gauge: 0,
  stream_reconnect_total: 0,
  backlog_fetch_total: 0
};

export function metricsSnapshot(): Counters {
  return { ...counters };
}

export function metricIncrement(name: keyof Counters, by = 1): void {
  counters[name] += by;
}

export function metricGaugeSet(name: keyof Counters, value: number): void {
  counters[name] = value;
}

export function metricGaugeDelta(name: keyof Counters, delta: number): void {
  counters[name] += delta;
}
