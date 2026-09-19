import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BrowserContext, Request, Route } from 'playwright';

import { readFixtureManifest } from './fixture.ts';

/**
 * HTTP record/replay for everything a story fetches from outside the static
 * build: webfonts from a CDN, avatars from a bucket, data from an API.
 *
 * Those requests are nondeterminism a user often cannot fix at source — the
 * Google Fonts race found in M0 is one — and deterministic replay is also what
 * lets capture run air-gapped. Requests to the static build itself are never
 * cached: the build is the thing under test.
 *
 * Record fetches each request once, fulfills the page from the stored copy,
 * and holds the capture until every response it is recording has arrived.
 * Recording runs still see real network latency, so their screenshots are
 * not baselines; replay is what makes a capture deterministic. Replay
 * serves only from the cache, with outbound networking switched off at the
 * browser; a request with no cached response fails the capture and names the
 * URL, because a silent passthrough is one more flake source.
 *
 * What "byte-identical" means here: Playwright hands a recorded body over
 * already decoded (a gzip response arrives as the plain entity), so the stored
 * body is exactly the bytes the page consumed, and headers are stored and
 * replayed verbatim — `content-encoding` included, which Chromium ignores for
 * fulfilled bodies. Redirects are followed at record time and the final
 * response is stored under the requested URL: Chromium does not route the
 * target of a fulfilled redirect, so replaying the 3xx would let the follow-up
 * request escape the cache.
 */

export type HttpCacheMode = 'record' | 'replay' | 'bypass';

export const HTTP_CACHE_MODES: readonly HttpCacheMode[] = ['record', 'replay', 'bypass'];

export const HTTP_CACHE_MANIFEST = 'manifest.json';

export interface HttpCacheEntry {
  method: string;
  url: string;
  status: number;
  /** Verbatim, in order, duplicates kept. */
  headers: { name: string; value: string }[];
  /** SHA-256 of the body; the blob's file name. */
  body: string;
  size: number;
  contentType: string;
  recordedAt: string;
  /** Where redirects ended up, when the requested URL redirected. */
  finalUrl?: string;
}

export interface HttpCacheManifest {
  version: 1;
  entries: Record<string, HttpCacheEntry>;
}

export interface HttpCacheSummary {
  mode: HttpCacheMode;
  dir: string;
  entries: number;
  /** Total size of the bodies the manifest references. */
  bytes: number;
  /** Requests served from the cache (replay) or from this session's recording. */
  hits: number;
  /** Unique `METHOD url` with no cached response, replay only. */
  misses: string[];
  /** Unique `METHOD url: error` that could not be fetched while recording. */
  recordFailures: string[];
  /** Absent in bypass. */
  manifestHash?: string;
}

/** Raised by a capture that requested something the cache has no response for. */
export class HttpCacheMissError extends Error {
  override name = 'HttpCacheMissError';
}

/** Key for a request: method + URL, hashed so it is safe as a manifest key. */
export function requestKey(method: string, url: string): string {
  return createHash('sha256').update(`${method.toUpperCase()} ${url}`).digest('hex');
}

/**
 * Hash of what the cache would serve: every key's status, headers and body.
 * Only snapcheck's own `recordedAt` is left out. Headers count as served, so
 * a fresh recording almost always hashes differently — `Date` alone changes
 * every second — and that is deliberate: a new recording is a new cache, and
 * baselines captured from the old one say so rather than silently comparing.
 */
export function httpCacheManifestHash(manifest: HttpCacheManifest): string {
  const hash = createHash('sha256');
  for (const key of Object.keys(manifest.entries).toSorted()) {
    const entry = manifest.entries[key] as HttpCacheEntry;
    hash.update(JSON.stringify([key, entry.status, entry.headers, entry.body]));
    hash.update('\n');
  }
  return hash.digest('hex');
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readHttpCacheManifest(dir: string): Promise<HttpCacheManifest | undefined> {
  let raw: string;
  try {
    raw = await readFile(path.join(dir, HTTP_CACHE_MANIFEST), 'utf8');
  } catch {
    return undefined;
  }
  return JSON.parse(raw) as HttpCacheManifest;
}

/**
 * The mode a run uses: the one asked for, otherwise replay when a cache
 * exists and bypass when it does not. Replay without a cache is an error, not
 * a silent fallback to the network.
 */
export async function resolveHttpCacheMode(
  requested: HttpCacheMode | undefined,
  dir: string,
): Promise<HttpCacheMode> {
  const hasCache = await exists(path.join(dir, HTTP_CACHE_MANIFEST));
  if (requested === 'replay' && !hasCache) {
    throw new Error(
      `No HTTP cache at ${dir} to replay from. Record one first with --http-cache record.`,
    );
  }
  return requested ?? (hasCache ? 'replay' : 'bypass');
}

export interface HttpCacheConfig {
  /**
   * `record`, `replay` or `bypass`. Default: replay when a cache exists in
   * `dir`, bypass otherwise.
   */
  mode?: HttpCacheMode;
  /**
   * Cache directory, relative to the config file. Default
   * `.snapcheck/http-cache/<fixture>`, where the fixture name comes from the
   * build's fixture manifest and is `default` for an ordinary build.
   */
  dir?: string;
}

/** The mode and directory a run will use, with every default applied. */
export async function resolveHttpCache(input: {
  config: HttpCacheConfig | undefined;
  /** Mode from the command line, which wins over config. */
  mode?: HttpCacheMode;
  snapcheckDir: string;
  staticDir: string;
  /** Resolves a configured `dir`. Default: the working directory. */
  root?: string;
}): Promise<{ mode: HttpCacheMode; dir: string }> {
  const fixture = await readFixtureManifest(input.staticDir);
  const dir = input.config?.dir
    ? path.resolve(input.root ?? '.', input.config.dir)
    : path.join(input.snapcheckDir, 'http-cache', fixture?.fixture ?? 'default');
  const mode = await resolveHttpCacheMode(input.mode ?? input.config?.mode, dir);
  return { mode, dir };
}

export function parseHttpCacheMode(value: string): HttpCacheMode {
  if ((HTTP_CACHE_MODES as readonly string[]).includes(value)) return value as HttpCacheMode;
  throw new Error(
    `Invalid --http-cache mode "${value}". Expected one of: ${HTTP_CACHE_MODES.join(', ')}.`,
  );
}

/**
 * Chromium flags for a mode. Replay turns off name resolution for every host,
 * which covers what request routing cannot see — service-worker fetches and
 * WebSockets among them. The static build is served from an IP literal and is
 * unaffected.
 */
export function httpCacheLaunchArgs(mode: HttpCacheMode): string[] {
  return mode === 'replay' ? ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] : [];
}

/**
 * Playwright's fulfill takes one value per header name. Repeated headers are
 * joined the way HTTP folds them; `set-cookie`, which cannot be comma-folded,
 * with newlines, which Playwright splits back apart.
 */
function headerRecord(headers: HttpCacheEntry['headers']): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { name, value } of headers) {
    const existing = record[name];
    if (existing === undefined) record[name] = value;
    else record[name] = `${existing}${name.toLowerCase() === 'set-cookie' ? '\n' : ', '}${value}`;
  }
  return record;
}

/**
 * One browser context's view of the cache, so what went wrong is attributed
 * to the one capture it happened in.
 */
export interface HttpCacheSession {
  /**
   * Resolves once every request this context has already sent through the
   * cache has been answered. It cannot wait for a request the page has not
   * made yet. Record needs it before capturing, because Playwright's network
   * idle fires once per navigation and does not wait for a request a story
   * starts after that; and every mode needs it before closing the context,
   * because a response still being recorded dies with the context.
   */
  settle: (timeoutMs?: number) => Promise<void>;
  /**
   * Throws `HttpCacheMissError` naming every request that had no cached
   * response (replay) or could not be recorded (record).
   */
  assertComplete: () => void;
}

/**
 * Attempts per request while recording. Only a failure to get any response
 * (a timeout, a reset connection) is retried; an HTTP error status is a real
 * response and is recorded as it is.
 */
const RECORD_ATTEMPTS = 3;

/** How long `settle` waits for outstanding responses before giving up on them. */
const SETTLE_TIMEOUT_MS = 30_000;

interface SessionState {
  /** External requests the page has sent and not yet seen finish or fail. */
  outstanding: Map<Request, { label: string; done: Promise<void> }>;
  /** `METHOD url` with no cached response, replay only. */
  misses: Set<string>;
  /** `METHOD url: error` that could not be recorded. */
  recordFailures: Set<string>;
}

export class HttpCache {
  readonly mode: HttpCacheMode;
  readonly dir: string;
  readonly #origin: string;
  readonly #manifest: HttpCacheManifest;
  readonly #inflight = new Map<string, Promise<HttpCacheEntry | undefined>>();
  readonly #bodies = new Map<string, Buffer>();
  readonly #misses = new Set<string>();
  readonly #recordFailures = new Set<string>();
  #hits = 0;

  private constructor(
    mode: HttpCacheMode,
    dir: string,
    origin: string,
    manifest: HttpCacheManifest,
  ) {
    this.mode = mode;
    this.dir = dir;
    this.#origin = origin;
    this.#manifest = manifest;
  }

  /**
   * `origin` is the static server's: requests to it are never cached. Record
   * starts from an empty manifest, so a recording is always one coherent
   * session rather than a mix of old and new responses.
   */
  static async open(options: { mode: HttpCacheMode; dir: string; origin: string }) {
    let manifest: HttpCacheManifest = { version: 1, entries: {} };
    if (options.mode === 'replay') {
      const existing = await readHttpCacheManifest(options.dir);
      if (!existing) throw new Error(`No HTTP cache at ${options.dir} to replay from.`);
      manifest = existing;
    }
    if (options.mode === 'record')
      await mkdir(path.join(options.dir, 'blobs'), { recursive: true });
    return new HttpCache(options.mode, options.dir, options.origin, manifest);
  }

  #isExternal(url: URL): boolean {
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== this.#origin;
  }

  async #body(sha: string): Promise<Buffer> {
    let body = this.#bodies.get(sha);
    if (!body) {
      body = await readFile(path.join(this.dir, 'blobs', sha));
      this.#bodies.set(sha, body);
    }
    return body;
  }

  async #fulfill(route: Route, entry: HttpCacheEntry): Promise<void> {
    this.#hits++;
    await route.fulfill({
      status: entry.status,
      headers: headerRecord(entry.headers),
      body: await this.#body(entry.body),
    });
  }

  async #record(route: Route, key: string): Promise<HttpCacheEntry | undefined> {
    const request = route.request();
    const label = `${request.method()} ${request.url()}`;
    try {
      let response: Awaited<ReturnType<Route['fetch']>> | undefined;
      for (let attempt = 1; !response; attempt++) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- retries are sequential
          response = await route.fetch();
        } catch (error) {
          if (attempt >= RECORD_ATTEMPTS) throw error;
        }
      }
      const body = await response.body();
      const sha = createHash('sha256').update(body).digest('hex');
      await writeFile(path.join(this.dir, 'blobs', sha), body);
      this.#bodies.set(sha, body);
      const headers = response.headersArray();
      const entry: HttpCacheEntry = {
        method: request.method(),
        url: request.url(),
        status: response.status(),
        headers,
        body: sha,
        size: body.length,
        contentType:
          headers.find((header) => header.name.toLowerCase() === 'content-type')?.value ?? '',
        recordedAt: new Date().toISOString(),
        ...(response.url() === request.url() ? {} : { finalUrl: response.url() }),
      };
      this.#manifest.entries[key] = entry;
      return entry;
    } catch (error) {
      this.#recordFailures.add(
        `${label}: ${(error as Error).message.split('\n')[0]} (${RECORD_ATTEMPTS} attempts)`,
      );
      return undefined;
    }
  }

  async #handle(route: Route, session: SessionState): Promise<void> {
    const request = route.request();
    const key = requestKey(request.method(), request.url());
    const label = `${request.method()} ${request.url()}`;

    let entry = this.#manifest.entries[key];
    if (!entry && this.mode === 'record') {
      // Concurrent pages asking for the same URL share one fetch, so a
      // resource that differs per request (a random avatar) is frozen once.
      let pending = this.#inflight.get(key);
      if (!pending) {
        pending = this.#record(route, key);
        this.#inflight.set(key, pending);
        // A failure is not remembered: the next page to ask tries again, so
        // one stalled request fails only the capture that hit it.
        void pending.then((recorded) => {
          if (!recorded) this.#inflight.delete(key);
        });
      }
      entry = await pending;
    }

    if (entry) {
      await this.#fulfill(route, entry);
      return;
    }
    if (this.mode === 'replay') {
      session.misses.add(label);
      this.#misses.add(label);
    } else {
      const failure = [...this.#recordFailures].find((line) => line.startsWith(`${label}: `));
      session.recordFailures.add(failure ?? `${label}: not recorded`);
    }
    await route.abort('blockedbyclient');
  }

  /** Routes every external request in the context through the cache. */
  async attach(context: BrowserContext): Promise<HttpCacheSession> {
    const session: SessionState = {
      outstanding: new Map(),
      misses: new Set(),
      recordFailures: new Set(),
    };
    if (this.mode !== 'bypass') {
      // Tracked from the request event, not the route handler: Playwright
      // emits the event first, so a request can be in flight before any
      // handler has been called for it.
      const resolvers = new Map<Request, () => void>();
      context.on('request', (request) => {
        if (!this.#isExternal(new URL(request.url()))) return;
        const done = new Promise<void>((resolve) => resolvers.set(request, resolve));
        session.outstanding.set(request, { label: `${request.method()} ${request.url()}`, done });
      });
      const finish = (request: Request) => {
        resolvers.get(request)?.();
        resolvers.delete(request);
        session.outstanding.delete(request);
      };
      context.on('requestfinished', finish);
      context.on('requestfailed', finish);

      await context.route(
        (url) => this.#isExternal(url),
        // A handler must never reject: one answering a context that has just
        // closed would otherwise be an unhandled rejection that ends the run.
        (route) => this.#handle(route, session).catch(() => undefined),
      );
    }
    return {
      settle: async (timeoutMs = SETTLE_TIMEOUT_MS) => {
        const deadline = performance.now() + timeoutMs;
        // Answering one request can start another (a stylesheet's font).
        while (session.outstanding.size > 0) {
          const remaining = deadline - performance.now();
          if (remaining <= 0) {
            // Only recording waits on the network; say which never answered.
            if (this.mode === 'record') {
              for (const { label } of session.outstanding.values()) {
                session.recordFailures.add(`${label}: no response within ${timeoutMs}ms`);
              }
            }
            return;
          }
          let timer: ReturnType<typeof setTimeout> | undefined;
          // oxlint-disable-next-line no-await-in-loop
          await Promise.race([
            Promise.all([...session.outstanding.values()].map(({ done }) => done)),
            new Promise((resolve) => {
              timer = setTimeout(resolve, remaining);
            }),
          ]);
          clearTimeout(timer);
        }
      },
      assertComplete: () => {
        const problems = [
          ...[...session.misses].map((miss) => `  not in the cache: ${miss}`),
          ...[...session.recordFailures].map((failure) => `  could not record: ${failure}`),
        ];
        if (problems.length === 0) return;
        throw new HttpCacheMissError(
          `${problems.length} external request${problems.length === 1 ? '' : 's'} could not be ` +
            `served from the HTTP cache (${this.dir}):\n${problems.join('\n')}\n` +
            (session.misses.size > 0
              ? `Re-record with --http-cache record, or use --http-cache bypass to allow the network.`
              : `The story rendered without these responses; the capture is not valid.`),
        );
      },
    };
  }

  /**
   * Record writes the manifest and drops blobs nothing references any more,
   * so the reported size is the size of this recording.
   */
  async close(): Promise<HttpCacheSummary> {
    if (this.mode === 'record') {
      await writeFile(
        path.join(this.dir, HTTP_CACHE_MANIFEST),
        `${JSON.stringify(this.#manifest, null, 2)}\n`,
      );
      const referenced = new Set(Object.values(this.#manifest.entries).map((entry) => entry.body));
      const blobs = await readdir(path.join(this.dir, 'blobs'));
      await Promise.all(
        blobs
          .filter((blob) => !referenced.has(blob))
          .map((blob) => rm(path.join(this.dir, 'blobs', blob), { force: true })),
      );
    }
    return this.summary();
  }

  summary(): HttpCacheSummary {
    const entries = Object.values(this.#manifest.entries);
    const bodies = new Map(entries.map((entry) => [entry.body, entry.size]));
    return {
      mode: this.mode,
      dir: this.dir,
      entries: entries.length,
      bytes: [...bodies.values()].reduce((sum, size) => sum + size, 0),
      hits: this.#hits,
      misses: [...this.#misses],
      recordFailures: [...this.#recordFailures],
      ...(this.mode === 'bypass' ? {} : { manifestHash: httpCacheManifestHash(this.#manifest) }),
    };
  }
}
