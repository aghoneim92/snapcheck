import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

export interface StaticServer {
  /** Origin with no trailing slash, e.g. `http://127.0.0.1:53124`. */
  origin: string;
  close: () => Promise<void>;
}

/**
 * Serves a static Storybook build over loopback HTTP on an ephemeral port.
 * Never `file://`: it breaks relative URLs and changes how fetch and fonts load.
 */
export async function serveStatic(rootDir: string): Promise<StaticServer> {
  const root = path.resolve(rootDir);

  const server: Server = createServer((request, response) => {
    void (async () => {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
      let filePath = path.join(root, pathname);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        response.writeHead(403).end();
        return;
      }

      try {
        let info = await stat(filePath);
        if (info.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
          info = await stat(filePath);
        }
        response.writeHead(200, {
          'content-type':
            contentTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
          'content-length': info.size,
          'cache-control': 'no-store',
        });
        createReadStream(filePath).pipe(response);
      } catch {
        response.writeHead(404).end();
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
