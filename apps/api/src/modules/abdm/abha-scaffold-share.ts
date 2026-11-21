/**
 * Sandbox run of "scan and share at a counter", for the tester. Run it in your
 * own terminal, with a public HTTPS tunnel pointing at the port it listens on:
 *
 *   pnpm --filter @healthguard/api abdm:scaffold-share
 *
 * It shows a counter QR code, waits for ABDM to post a shared profile to
 * /api/v3/hip/patient/share, answers 200, and replies on on-share with a token
 * number. It prints header names and the SHAPE of each body, never a name, a
 * mobile, an ABHA number or a token, so the output is safe to share. Nothing is
 * written to disk and no patient is registered: this only observes.
 */
import { createServer } from 'node:http';
import QRCode from 'qrcode';
import { ask, closeTerminal, createObservedGateway, print, shape, step } from './abdm-scaffold.js';

const SHARE_PATH = '/api/v3/hip/patient/share';
/** Header values that identify the call and no person, shown as they came. */
const SHOW_HEADER = new Set(['request-id', 'timestamp', 'x-hip-id', 'x-cm-id', 'content-type']);

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

/** Says how the caller identified itself without showing the credential. */
function describeAuthorization(value: string): string {
  const [scheme, token = ''] = value.split(' ');
  const parts = token.split('.');
  if (parts.length !== 3) return `${scheme ?? ''} credential, ${token.length} characters`;
  try {
    const header = object(JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString('utf8')));
    const claims = object(JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')));
    return (
      `${scheme ?? ''} JWT, alg ${String(header.alg)}, kid present ${Boolean(header.kid)}, ` +
      `claims: ${Object.keys(claims).join(', ')}`
    );
  } catch {
    return `${scheme ?? ''} token in three parts, not readable as a JWT`;
  }
}

async function main(): Promise<number> {
  const gateway = createObservedGateway();
  if (!gateway) return 1;

  print('Scan and share: sandbox run. This observes what ABDM sends; it registers nobody.');
  print();
  const hipId = await ask('Your facility id in the sandbox HFR (the HIP id): ');
  const counter = (await ask('Counter id, 1 to 20 letters or digits [OPD1]: ')) || 'OPD1';
  if (!hipId || !/^[A-Za-z0-9]{1,20}$/.test(counter) || counter === hipId) {
    print('A facility id is needed, and a counter id of 1 to 20 letters or digits that is not it.');
    return 1;
  }
  const port = Number((await ask('Local port to listen on [4100]: ')) || '4100');

  const publicUrl = (
    await ask(
      'Public HTTPS address of your tunnel, to register as the bridge URL, or blank to skip: ',
    )
  ).replace(/\/+$/, '');
  if (publicUrl) {
    if (!/^https:\/\/[^\s/]+$/.test(publicUrl)) {
      print('That is not an https address with no path. Nothing was registered.');
    } else {
      // Not in the skill's guide: the sandbox's own answer decides whether this is the right call.
      await step('Register the bridge URL', async () => {
        const answer = await gateway.http.request({
          host: 'gateway',
          method: 'PATCH',
          path: '/api/hiecm/gateway/v3/bridge/url',
          accessToken: await gateway.session.accessToken(),
          body: { url: publicUrl },
        });
        print(`bridge URL call answered ${answer.status}`);
      });
    }
  }

  const qrUrl = `https://phrsbx.abdm.gov.in/share-profile?hip-id=${encodeURIComponent(hipId)}&counter-id=${encodeURIComponent(counter)}`;
  print('\nCounter QR code. Scan it in the ABDM sandbox PHR app, tap Get Token, then I Agree.');
  print(qrUrl);
  print(await QRCode.toString(qrUrl, { type: 'terminal', small: true }));

  let token = 0;
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
    request.on('end', () => {
      const path = (request.url ?? '').split('?')[0] ?? '';
      print(`\n== inbound ${request.method ?? ''} ${path}`);
      for (const [name, value] of Object.entries(request.headers)) {
        const text = Array.isArray(value) ? value.join(', ') : (value ?? '');
        if (name === 'authorization') print(`  ${name}: ${describeAuthorization(text)}`);
        else if (SHOW_HEADER.has(name)) print(`  ${name}: ${text}`);
        else print(`  ${name}: (${text.length} characters)`);
      }
      let body: unknown = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        print('  body is not JSON');
      }
      print(JSON.stringify(shape(body), null, 2));
      if (request.method !== 'POST' || path !== SHARE_PATH) {
        response.writeHead(404).end();
        return;
      }
      const share = object(body);
      const meta = object(share.metaData);
      const patient = object(object(share.profile).patient);
      const shareRequestId = String(request.headers['request-id'] ?? '');
      print(`intent: ${String(share.intent)}`);
      print(`metaData.hipId is your facility id: ${meta.hipId === hipId}`);
      print(`metaData.context: ${String(meta.context)} (the counter in the QR: ${counter})`);
      // Answered first; the reply on on-share follows.
      response.writeHead(200, { 'content-type': 'application/json' }).end('{}');

      token += 1;
      const tokenNumber = String(token);
      void step(`Reply on on-share with token ${tokenNumber}`, async () => {
        const answer = await gateway.http.request({
          host: 'gateway',
          method: 'POST',
          path: '/api/hiecm/patient-share/v3/on-share',
          accessToken: await gateway.session.accessToken(),
          headers: { 'X-HIP-ID': hipId },
          body: {
            acknowledgement: {
              status: 'SUCCESS',
              abhaAddress: patient.abhaAddress,
              // The unit of `expiry` is not stated in the specification; 3600 assumes seconds.
              profile: { context: meta.context, tokenNumber, expiry: '3600' },
            },
            response: { requestId: shareRequestId },
          },
        });
        print(`on-share answered ${answer.status}. Does the PHR app show token ${tokenNumber}?`);
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(port, resolve));
  print(`Listening on port ${port} for ${SHARE_PATH}. Press Ctrl+C to stop.`);
  closeTerminal();
  await new Promise<void>((resolve) => process.once('SIGINT', resolve));
  server.close();
  print('\nStopped. This output holds no name, mobile, ABHA number, ABHA address or token.');
  return 0;
}

const code = await main().finally(closeTerminal);
process.exit(code);
