#!/usr/bin/env node
const fs = require("node:fs");

const [output, ...inputs] = process.argv.slice(2);
if (!output || inputs.length < 2) throw new Error("usage: merge_odoo.js OUTPUT INPUT...");
const sources = inputs.map(file => JSON.parse(fs.readFileSync(file, "utf8")));
const latest = sources.at(-1);
const keyFor = {
  creations: item => item.key || `${item.model}:${item.res_id}`,
  comments: item => item.key || `mail.message:${item.message_id}`,
  tracking: item => item.key || `mail.tracking.value:${item.tracking_id}`,
  timesheets: item => item.key || `account.analytic.line:${item.line_id}`,
  interactions: item => item.key,
  weak_write_batches: item => [item.model, item.date_utc, item.actor_user_id].join("|"),
  coverage: item => `${item.day}|${item.user_id}`,
};
const mergeLatest = (field, sortKey) => {
  const map = new Map();
  for (const source of sources) for (const item of source[field] || []) map.set(keyFor[field](item), item);
  return [...map.values()].sort((a, b) => String(sortKey(a)).localeCompare(String(sortKey(b))));
};
const completeDays = [];
for (let d = new Date("2026-09-15T00:00:00Z"); d < new Date("2026-09-26T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) completeDays.push(d.toISOString().slice(0, 10));
const result = {
  report: {
    ...latest.report,
    start_local: sources[0].report.start_local,
    start_utc_inclusive: sources[0].report.start_utc_inclusive,
    complete_days: completeDays,
    partial_days: ["2026-09-26"],
    stable_key_duplicates: { creations: 0, comments: 0, tracking: 0, timesheets: 0, interactions: 0 },
  },
  roster_count: latest.roster.length,
  roster: latest.roster,
  partners: latest.partners,
  employees: latest.employees,
  creations: mergeLatest("creations", item => `${item.date_utc}|${item.key}`),
  comments: mergeLatest("comments", item => `${item.date_utc}|${item.key}`),
  tracking: mergeLatest("tracking", item => `${item.date_utc}|${item.key}`),
  timesheets: mergeLatest("timesheets", item => `${item.day}|${item.line_id}`),
  interactions: mergeLatest("interactions", item => `${item.date_utc}|${item.key}`),
  weak_write_batches: mergeLatest("weak_write_batches", item => `${item.date_utc}|${item.actor_user_id}`),
  coverage: mergeLatest("coverage", item => `${item.day}|${item.user_id}`),
  limitations: [...new Set(sources.flatMap(source => source.limitations || []))],
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(Object.fromEntries(["roster", "creations", "comments", "tracking", "timesheets", "interactions"].map(field => [field, result[field].length])), null, 2));
