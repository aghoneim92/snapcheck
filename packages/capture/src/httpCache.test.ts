import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { launchChromium } from './browser.ts';
import {
  HttpCache,
  httpCacheLaunchArgs,
  httpCacheManifestHash,
  HttpCacheMissError,
  readHttpCacheManifest,
  requestKey,
  resolveHttpCacheMode,
  type HttpCacheManifest,
  type HttpCacheMode,
} from './httpCache.ts';
import { serveStatic, type StaticServer } from './serve.ts';

/**
 * Record/replay against a local fixture server on a different origin from the
 * static build — never against a real Storybook. The external server counts
 * every request it receives, so "network disabled" is asserted, not assumed.
 */

const CSS = 'body { background: rgb(1, 2, 3); }';
const FONT = randomBytes(4096);

let external: Server;
let externalOrigin: string;
const hits: string[] = [];
let randomCounter = 0;
let flakyCounter = 0;

function startExternal(): Promise<void> {
  external = createServer((request, response) => {
    hits.push(`${request.method} ${request.url}`);
    const cors = { 'access-control-allow-origin': '*' };
    switch (request.url) {
      case '/style.css': {
        const body = gzipSync(CSS);
        response.writeHead(200, {
          ...cors,
          'content-type': 'text/css',
          'content-encoding': 'gzip',
          'x-fixture': 'kept',
          'access-control-expose-headers': 'x-fixture',
        });
        response.end(body);
        return;
      }
      case '/font.woff2': {
        response.writeHead(200, { ...cors, 'content-type': 'font/woff2' });
        response.end(FONT);
        return;
      }
      case '/redirect': {
        response.writeHead(302, { ...cors, location: '/target.txt' });
        response.end();
        return;
      }
      case '/target.txt': {
        response.writeHead(200, { ...cors, 'content-type': 'text/plain' });
        response.end('redirected');
        return;
      }
      case '/slow.png': {
        // Answers well after the page has gone idle.
        setTimeout(() => {
          response.writeHead(200, { ...cors, 'content-type': 'image/png' });
          response.end(FONT);
        }, 1500);
        return;
      }
      case '/hang': {
        // Never answers, like a long poll.
        return;
      }
      case '/flaky': {
        // Drops the first connection, answers the second.
        flakyCounter++;
        if (flakyCounter === 1) {
          request.socket.destroy();
          return;
        }
        response.writeHead(200, { ...cors, 'content-type': 'text/plain' });
        response.end('second time');
        return;
      }
      case '/broken': {
        request.socket.destroy();
        return;
      }
      case '/random': {
        // Different on every request, like an avatar service.
        randomCounter++;
        response.writeHead(200, { ...cors, 'content-type': 'text/plain' });
        response.end(`random ${randomCounter}`);
        return;
      }
      default: {
        response.writeHead(404, { ...cors, 'content-type': 'text/plain' });
        response.end('not found');
      }
    }
  });
  return new Promise((resolve) => {
    external.listen(0, '127.0.0.1', () => {
      // `localhost`, not the IP: replay must block it by name resolution too.
      externalOrigin = `http://localhost:${(external.address() as AddressInfo).port}`;
      resolve();
    });
  });
}

let staticServer: StaticServer;
const browsers = new Map<HttpCacheMode, Browser>();

beforeAll(async () => {
  await startExternal();
  const staticDir = await mkdtemp(path.join(tmpdir(), 'snapcheck-http-static-'));
  await writeFile(path.join(staticDir, 'page.html'), '<!doctype html><title>page</title>');
  staticServer = await serveStatic(staticDir);
  for (const mode of ['record', 'replay', 'bypass'] as const) {
    // oxlint-disable-next-line no-await-in-loop -- three launches, once
    browsers.set(mode, await launchChromium({ args: httpCacheLaunchArgs(mode) }));
  }
}, 60_000);

afterAll(async () => {
  await Promise.all([...browsers.values()].map((browser) => browser.close()));
  await staticServer.close();
  external.closeAllConnections();
  await new Promise((resolve) => external.close(resolve));
});

interface Fetched {
  status: number;
  body: string;
  xFixture: string | null;
}

/** Opens the static page with the cache attached and fetches each path from it. */
async function visit(
  cache: HttpCache | undefined,
  mode: HttpCacheMode,
  paths: string[],
): Promise<{ fetched: (Fetched | string)[]; assertComplete: () => void }> {
  const browser = browsers.get(mode) as Browser;
  const context = await browser.newContext();
  try {
    const session = await cache?.attach(context);
    const page = await context.newPage();
    await page.goto(`${staticServer.origin}/page.html`);
    const fetched: (Fetched | string)[] = [];
    for (const target of paths) {
      // Sequential, so the order of requests to the server is predictable.
      // oxlint-disable-next-line no-await-in-loop
      const result = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = '';
          for (const byte of bytes) binary += String.fromCodePoint(byte);
          return {
            status: response.status,
            body: btoa(binary),
            xFixture: response.headers.get('x-fixture'),
          };
        } catch (error) {
          return `failed: ${(error as Error).message}`;
        }
      }, `${externalOrigin}${target}`);
      fetched.push(result);
    }
    await session?.settle();
    return { fetched, assertComplete: () => session?.assertComplete() };
  } finally {
    await context.close();
  }
}

const decode = (fetched: Fetched | string | undefined) =>
  typeof fetched === 'object' ? Buffer.from(fetched.body, 'base64') : undefined;

describe('HttpCache record and replay', () => {
  const paths = ['/style.css', '/font.woff2', '/redirect', '/missing', '/random', '/random'];
  let dir: string;
  let recorded: (Fetched | string)[];

  beforeAll(async () => {
    dir = path.join(await mkdtemp(path.join(tmpdir(), 'snapcheck-http-cache-')), 'cache');
    const cache = await HttpCache.open({ mode: 'record', dir, origin: staticServer.origin });
    hits.length = 0;
    ({ fetched: recorded } = await visit(cache, 'record', paths));
    await cache.close();
  }, 60_000);

  it('records what the network served', () => {
    expect(decode(recorded[0])?.toString()).toBe(CSS);
    expect(decode(recorded[1])).toEqual(FONT);
    expect(decode(recorded[2])?.toString()).toBe('redirected');
    expect((recorded[3] as Fetched).status).toBe(404);
  });

  it('fetches each URL once while recording, freezing responses that vary', () => {
    expect(hits.filter((hit) => hit === 'GET /random')).toHaveLength(1);
    expect(decode(recorded[4])?.toString()).toBe(decode(recorded[5])?.toString());
  });

  it('never caches the static build itself', async () => {
    const manifest = (await readHttpCacheManifest(dir)) as HttpCacheManifest;
    const urls = Object.values(manifest.entries).map((entry) => entry.url);
    expect(urls.every((url) => url.startsWith(externalOrigin))).toBe(true);
    expect(urls).toHaveLength(5);
  });

  it('stores bodies by content and records metadata', async () => {
    const manifest = (await readHttpCacheManifest(dir)) as HttpCacheManifest;
    const font = manifest.entries[requestKey('GET', `${externalOrigin}/font.woff2`)];
    expect(font).toMatchObject({ status: 200, size: FONT.length, contentType: 'font/woff2' });
    expect(await readdir(path.join(dir, 'blobs'))).toContain(font?.body);
    const redirect = manifest.entries[requestKey('GET', `${externalOrigin}/redirect`)];
    expect(redirect?.finalUrl).toBe(`${externalOrigin}/target.txt`);
  });

  it('replays byte-identically with the network off', async () => {
    const cache = await HttpCache.open({ mode: 'replay', dir, origin: staticServer.origin });
    hits.length = 0;
    const { fetched, assertComplete } = await visit(cache, 'replay', paths);

    expect(hits).toEqual([]);
    expect(fetched).toEqual(recorded);
    expect((fetched[0] as Fetched).xFixture).toBe('kept');
    assertComplete();
    expect((await cache.close()).misses).toEqual([]);
  });

  it('fails a capture loudly on a miss, naming the URL, without touching the network', async () => {
    const cache = await HttpCache.open({ mode: 'replay', dir, origin: staticServer.origin });
    hits.length = 0;
    const { fetched, assertComplete } = await visit(cache, 'replay', ['/uncached.png']);

    expect(hits).toEqual([]);
    expect(fetched[0]).toMatch(/^failed/);
    expect(assertComplete).toThrow(HttpCacheMissError);
    expect(assertComplete).toThrow(`GET ${externalOrigin}/uncached.png`);
    expect((await cache.close()).misses).toEqual([`GET ${externalOrigin}/uncached.png`]);
  });

  it('keys by method as well as URL', async () => {
    const cache = await HttpCache.open({ mode: 'replay', dir, origin: staticServer.origin });
    const context = await (browsers.get('replay') as Browser).newContext();
    const session = await cache.attach(context);
    const page = await context.newPage();
    await page.goto(`${staticServer.origin}/page.html`);
    await page.evaluate(
      (url) => fetch(url, { method: 'POST', body: 'x' }).catch(() => undefined),
      `${externalOrigin}/style.css`,
    );
    await context.close();
    expect(() => session.assertComplete()).toThrow(`POST ${externalOrigin}/style.css`);
  });

  it('reports the recorded size and prunes blobs a re-recording no longer uses', async () => {
    const small = path.join(path.dirname(dir), 'small');
    const big = await HttpCache.open({ mode: 'record', dir: small, origin: staticServer.origin });
    await visit(big, 'record', ['/font.woff2', '/target.txt']);
    expect((await big.close()).bytes).toBe(FONT.length + 'redirected'.length);

    const smaller = await HttpCache.open({
      mode: 'record',
      dir: small,
      origin: staticServer.origin,
    });
    await visit(smaller, 'record', ['/target.txt']);
    const summary = await smaller.close();
    expect(summary.bytes).toBe('redirected'.length);
    expect(await readdir(path.join(small, 'blobs'))).toHaveLength(1);
  });
});

describe('HttpCache record completeness', () => {
  it('waits for a response a story requested after the page went idle', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'snapcheck-http-slow-')), 'cache');
    const cache = await HttpCache.open({ mode: 'record', dir, origin: staticServer.origin });
    const context = await (browsers.get('record') as Browser).newContext();
    const session = await cache.attach(context);
    const page = await context.newPage();
    await page.goto(`${staticServer.origin}/page.html`);
    await page.waitForLoadState('networkidle');
    // Inserted after idle, as a React effect would; network idle will not wait
    // for it. In flight when the capture moves on, as the Grafana avatar was.
    const sent = page.waitForRequest(`${externalOrigin}/slow.png`);
    await page.evaluate((url) => {
      const image = new Image();
      image.src = url;
      document.body.append(image);
    }, `${externalOrigin}/slow.png`);
    await sent;
    await page.waitForLoadState('networkidle');

    await session.settle();
    await context.close();
    session.assertComplete();
    const summary = await cache.close();
    expect(summary.entries).toBe(1);
    expect(summary.recordFailures).toEqual([]);
  });

  it('gives up on a response that never arrives, and says so', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'snapcheck-http-hang-')), 'cache');
    const cache = await HttpCache.open({ mode: 'record', dir, origin: staticServer.origin });
    const context = await (browsers.get('record') as Browser).newContext();
    const session = await cache.attach(context);
    const page = await context.newPage();
    await page.goto(`${staticServer.origin}/page.html`);
    const sent = page.waitForRequest(`${externalOrigin}/hang`);
    await page.evaluate((url) => {
      void fetch(url).catch(() => undefined);
    }, `${externalOrigin}/hang`);
    await sent;

    await session.settle(300);
    await context.close();
    expect(() => session.assertComplete()).toThrow(
      `could not record: GET ${externalOrigin}/hang: no response within 300ms`,
    );
    await cache.close();
  });

  it('retries a request whose connection failed, and records the answer', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'snapcheck-http-flaky-')), 'cache');
    const cache = await HttpCache.open({ mode: 'record', dir, origin: staticServer.origin });
    const { fetched, assertComplete } = await visit(cache, 'record', ['/flaky']);
    expect(decode(fetched[0])?.toString()).toBe('second time');
    assertComplete();
    expect((await cache.close()).entries).toBe(1);
  });

  it('fails the capture, naming the URL, when a response cannot be recorded', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'snapcheck-http-broken-')), 'cache');
    const cache = await HttpCache.open({ mode: 'record', dir, origin: staticServer.origin });
    const { fetched, assertComplete } = await visit(cache, 'record', ['/broken']);
    expect(fetched[0]).toMatch(/^failed/);
    expect(assertComplete).toThrow(`could not record: GET ${externalOrigin}/broken`);
    expect((await cache.close()).entries).toBe(0);
  });
});

describe('replay network isolation', () => {
  it('blocks outbound requests even when nothing routes them', async () => {
    // A context with no cache attached stands in for what routing cannot see,
    // such as a service worker's fetches.
    hits.length = 0;
    const { fetched } = await visit(undefined, 'replay', ['/style.css']);
    expect(fetched[0]).toMatch(/^failed/);
    expect(hits).toEqual([]);
  });

  it('bypass leaves the network alone and writes no cache', async () => {
    hits.length = 0;
    const { fetched } = await visit(undefined, 'bypass', ['/style.css']);
    expect(decode(fetched[0])?.toString()).toBe(CSS);
    expect(hits).toEqual(['GET /style.css']);
  });
});

describe('resolveHttpCacheMode', () => {
  it('defaults to bypass without a cache and replay with one', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'snapcheck-http-mode-'));
    expect(await resolveHttpCacheMode(undefined, dir)).toBe('bypass');
    await writeFile(path.join(dir, 'manifest.json'), '{"version":1,"entries":{}}');
    expect(await resolveHttpCacheMode(undefined, dir)).toBe('replay');
  });

  it('refuses replay without a cache rather than falling back to the network', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'snapcheck-http-mode-'));
    await expect(resolveHttpCacheMode('replay', dir)).rejects.toThrow(/No HTTP cache/);
  });

  it('honours an explicit mode', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'snapcheck-http-mode-'));
    await writeFile(path.join(dir, 'manifest.json'), '{"version":1,"entries":{}}');
    expect(await resolveHttpCacheMode('bypass', dir)).toBe('bypass');
    expect(await resolveHttpCacheMode('record', dir)).toBe('record');
  });
});

describe('httpCacheManifestHash', () => {
  const entry = {
    method: 'GET',
    url: 'https://cdn.example/font.woff2',
    status: 200,
    headers: [{ name: 'content-type', value: 'font/woff2' }],
    body: 'aa',
    size: 1,
    contentType: 'font/woff2',
    recordedAt: '2026-09-19T00:00:00.000Z',
  };

  it('ignores when a response was recorded', () => {
    const a: HttpCacheManifest = { version: 1, entries: { k: entry } };
    const b: HttpCacheManifest = {
      version: 1,
      entries: { k: { ...entry, recordedAt: '2027-01-01T00:00:00.000Z' } },
    };
    expect(httpCacheManifestHash(a)).toBe(httpCacheManifestHash(b));
  });

  it('changes when any served byte changes', () => {
    const a: HttpCacheManifest = { version: 1, entries: { k: entry } };
    const b: HttpCacheManifest = { version: 1, entries: { k: { ...entry, body: 'bb' } } };
    const c: HttpCacheManifest = {
      version: 1,
      entries: { k: { ...entry, headers: [{ name: 'content-type', value: 'text/plain' }] } },
    };
    expect(httpCacheManifestHash(a)).not.toBe(httpCacheManifestHash(b));
    expect(httpCacheManifestHash(a)).not.toBe(httpCacheManifestHash(c));
  });
});
