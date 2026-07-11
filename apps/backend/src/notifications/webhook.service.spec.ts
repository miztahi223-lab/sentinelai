import { lookup } from 'dns';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { WebhookService, OutboundGuard } from './webhook.service';

/**
 * A real unit test against a real local HTTP server (not a mocked axios
 * client) — confirms `WebhookService` actually sends a real HTTP POST with
 * the right JSON body to a real listening socket, the strongest check
 * available without depending on an external service.
 *
 * The HTTP-mechanics tests below construct the service with a permissive
 * guard (real DNS `lookup`, no hostname check) specifically so this test
 * server's own loopback address isn't (correctly) rejected by the real SSRF
 * guard — a separate test confirms the real default guard still blocks
 * loopback (both via its literal-IP check *and* its `lookup` callback), so
 * this substitution never masks the guard actually being wired in
 * production.
 */
const PERMISSIVE_GUARD: OutboundGuard = {
  assertHostnameAllowed: () => {},
  lookup,
};

describe('WebhookService', () => {
  let server: Server;
  let received: { body: unknown; headers: Record<string, string> }[];
  let url: string;

  beforeEach((done) => {
    received = [];
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        received.push({
          body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'),
          headers: req.headers as Record<string, string>,
        });
        res.writeHead(200);
        res.end('ok');
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      url = `http://127.0.0.1:${port}/webhook`;
      done();
    });
  });

  afterEach((done) => {
    server.close(() => done());
  });

  it('sends a real JSON POST with the given payload', async () => {
    const service = new WebhookService(PERMISSIVE_GUARD);
    await service.sendWebhook(url, { alertId: 'alert-1', severity: 'HIGH' });

    expect(received).toHaveLength(1);
    expect(received[0].body).toEqual({ alertId: 'alert-1', severity: 'HIGH' });
    expect(received[0].headers['content-type']).toContain('application/json');
  });

  it('sends a real Slack-shaped JSON POST ({"text": ...})', async () => {
    const service = new WebhookService(PERMISSIVE_GUARD);
    await service.sendSlackMessage(url, '*HIGH* — something happened');

    expect(received).toHaveLength(1);
    expect(received[0].body).toEqual({
      text: '*HIGH* — something happened',
    });
  });

  it('does not throw when the target is unreachable', async () => {
    const service = new WebhookService(PERMISSIVE_GUARD);
    await expect(
      service.sendWebhook('http://127.0.0.1:1/unreachable', { a: 1 }),
    ).resolves.toBeUndefined();
  });

  it('uses the real SSRF guard by default, blocking a literal loopback IP', async () => {
    // `url` targets `127.0.0.1` literally — Node never invokes a `lookup`
    // callback for a literal IP (see `assertHostnameNotLiteralBlockedIp`'s
    // own comment), so this specifically proves the synchronous
    // literal-IP check the real gap needed, not just the DNS-based path.
    const service = new WebhookService();
    await service.sendWebhook(url, { a: 1 });

    // The guard rejects the connection before any bytes reach the server —
    // the real production wiring, proven by the fact this exact same `url`
    // (which the tests above successfully deliver to) is refused here.
    expect(received).toHaveLength(0);
  });

  it('uses the real SSRF guard by default, blocking a hostname that resolves to loopback', async () => {
    // `localhost` is a real hostname needing DNS resolution (unlike the
    // literal-IP case above) — this exercises the *other* real code path,
    // the async `lookup` callback itself.
    const port = (server.address() as AddressInfo).port;
    const service = new WebhookService();
    await service.sendWebhook(`http://localhost:${port}/webhook`, { a: 1 });

    expect(received).toHaveLength(0);
  });
});
