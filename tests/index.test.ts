import express from 'express';
import http from 'http';

import VerdaccioMiddlewarePlugin from '../src';

function request(server: http.Server, path: string): Promise<{ statusCode: number; body: string }> {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('test server is not listening on a TCP port');
  }

  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: address.port, path }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body });
      });
    });
    req.on('error', reject);
  });
}

describe('VerdaccioMiddlewarePlugin', () => {
  it('does not mutate the tarball request URL before the downstream route', async () => {
    const app = express();
    const plugin = new VerdaccioMiddlewarePlugin(
      { redis: {} } as any,
      { logger: { error: jest.fn(), warn: jest.fn() } } as any,
      {} as any
    );
    const storage = {
      getPackage: jest.fn((options) => {
        options.callback(null, { versions: {} });
      }),
    };
    const url = '/com.openupm.example/-/com.openupm.example-1.0.0.tgz';
    let downstreamUrl = '';

    plugin.register_middlewares(app, {} as any, storage as any);
    app.get('/:package/-/:filename', (req, res) => {
      downstreamUrl = req.url;
      res.status(204).end();
    });

    const server = app.listen(0);
    try {
      const response = await request(server, url);
      expect(response.statusCode).toBe(204);
      expect(downstreamUrl).toBe(url);
      expect(storage.getPackage).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  });
});
