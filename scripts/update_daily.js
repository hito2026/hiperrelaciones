#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const file = path.join(root, "data/daily_activity.json");
const daily = JSON.parse(fs.readFileSync(file, "utf8"));
const incrementalPath = process.env.HIPER_DAILY_SOURCE;
if (!incrementalPath) throw new Error("HIPER_DAILY_SOURCE is required");
const incremental = JSON.parse(fs.readFileSync(incrementalPath, "utf8"));
Object.assign(daily.report.files, incremental.report.files);
const additions = incremental.interactions;
const refreshedDays = new Set(Object.keys(incremental.report.files));
const byKey = new Map(daily.interactions.filter(item => !refreshedDays.has(item.day)).map(item => [item.key, item]));
for (const item of additions) byKey.set(item.key, item);
daily.interactions = [...byKey.values()].sort((a, b) => `${a.day}|${a.actor}|${a.counterpart}`.localeCompare(`${b.day}|${b.actor}|${b.counterpart}`));
fs.writeFileSync(file, JSON.stringify(daily, null, 2) + "\n");
console.log(JSON.stringify({ files: Object.keys(daily.report.files).length, interactions: daily.interactions.length }, null, 2));
