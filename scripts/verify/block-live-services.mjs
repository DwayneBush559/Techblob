// Loaded with node --import during the checks. Any Node call to a live service throws and gets counted, so a
// passing run proves the tests, the builds and the preview server made no live calls. TechBlob's outside services:
// S3-compatible storage, the YouTube Data API, hosted Redis and Postgres, plus Next's telemetry.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const LIVE = [
  /amazonaws\.com/i,
  /r2\.cloudflarestorage\.com/i,
  /googleapis\.com/i,
  /youtube\.com/i,
  /upstash\.io/i,
  /redis(labs|-cloud)?\.com/i,
  /neon\.tech/i,
  /supabase\.(co|in)/i,
  /sentry\.io/i,
  /telemetry\.nextjs\.org/i,
];

const log = process.env.BLOCK_LOG;
const note = (target) => {
  if (log) fs.appendFileSync(log, `${String(target)}\n`);
};
const isLive = (target) => LIVE.some((re) => re.test(String(target ?? "")));
const refuse = (target) => {
  note(target);
  throw new Error(`BLOCKED live call: ${target}`);
};

const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : (input?.url ?? input?.href ?? input);
  if (isLive(url)) refuse(url);
  return realFetch(input, init);
};

const targetOf = (opts) =>
  typeof opts === "string" ? opts : (opts?.href ?? opts?.hostname ?? opts?.host ?? opts?.servername ?? "");

for (const mod of [https, http]) {
  for (const name of ["request", "get"]) {
    const real = mod[name];
    mod[name] = function (opts, ...rest) {
      if (isLive(targetOf(opts))) refuse(targetOf(opts));
      return real.call(this, opts, ...rest);
    };
  }
}

// SMTP goes over raw sockets, not HTTP: net.connect(port, host) or tls.connect({ host }) / tls.connect(port, host).
for (const [mod, names] of [
  [net, ["connect", "createConnection"]],
  [tls, ["connect"]],
]) {
  for (const name of names) {
    const real = mod[name];
    mod[name] = function (...args) {
      const host = args.map((a) => (typeof a === "string" ? a : targetOf(a))).find((h) => h);
      if (isLive(host)) refuse(host);
      return real.apply(this, args);
    };
  }
}
