import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

// The server fetches URLs people give it, so it must never be talked into reaching
// into the home network (or its own cloud metadata address). Every connection is
// checked after DNS, so a hostname that points at a private address is refused too.

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; FoodTools/0.1; +https://github.com/Matthew-Morris-dev/food-tools)";

export class FetchBlockedError extends Error {}

function ipv4Private(a: number, b: number) {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return ipv4Private(a, b);
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    // IPv4 inside IPv6, e.g. ::ffff:192.168.0.1 or ::ffff:c0a8:1
    const mapped = lower.match(/^(?:::ffff:|0:0:0:0:0:ffff:)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      return ipv4Private(hi >> 8, hi & 255);
    }
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd]/.test(lower) || // unique local fc00::/7
      /^fe[89ab]/.test(lower) || // link-local fe80::/10
      lower.startsWith("ff") || // multicast
      lower.startsWith("2001:db8")
    );
  }
  return true; // not an address at all
}

export function assertAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchBlockedError("That isn't a valid web address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchBlockedError("Only http and https addresses work");
  if (url.username || url.password) throw new FetchBlockedError("Addresses with a login in them aren't supported");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateAddress(host)) throw new FetchBlockedError("That address isn't reachable from the internet");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchBlockedError("That address isn't reachable from the internet");
  }
  return url;
}

// Checks the address a hostname really resolves to, at connect time
const guardedLookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
      return callback(new FetchBlockedError("That address isn't reachable from the internet"));
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}) as unknown as net.LookupFunction;

function request(url: URL): Promise<{ status: number; location?: string; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-encoding": "gzip, deflate, br" },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location, contentType: "", body: "" });
        }
        const encoding = res.headers["content-encoding"];
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip())
          : encoding === "deflate" ? res.pipe(zlib.createInflate())
          : encoding === "br" ? res.pipe(zlib.createBrotliDecompress())
          : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(new FetchBlockedError("That page is too large"));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () =>
          resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks).toString("utf8") }),
        );
        stream.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("The website took too long to answer")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPage(raw: string): Promise<string> {
  let url = assertAllowedUrl(raw);
  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    const res = await request(url);
    if (res.status >= 300 && res.status < 400 && res.location) {
      // Each redirect is checked again, so a public page can't bounce us to a private one
      url = assertAllowedUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`The website answered with status ${res.status}`);
    if (!/html|xml/i.test(res.contentType)) throw new Error("That address isn't a web page");
    return res.body;
  }
  throw new Error("Too many redirects");
}
