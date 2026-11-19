/**
 * Interactive sandbox run of "Create ABHA by Aadhaar OTP", for the tester.
 * Run it in your own terminal, on a network the sandbox accepts:
 *
 *   pnpm --filter @healthguard/api abdm:scaffold-create
 *
 * It asks for the Aadhaar number and each OTP at a hidden prompt and sends
 * them only to ABDM, encrypted. It prints request ids and the SHAPE of each
 * response (key names and value types), never a value, a token or an
 * identifier, so the output is safe to share. Nothing is written to disk.
 *
 * It really sends OTPs, and it really creates a sandbox ABHA for that Aadhaar
 * (or returns the one it already holds).
 */
import { createInterface, type Interface } from 'node:readline';
import { Writable } from 'node:stream';
import { buildConfig } from '../../config/env.js';
import { loadRootEnv } from '../../config/load-env.js';
import { AbhaEnrollmentClient } from './abha-enrollment.client.js';
import { AbdmApiError } from './abdm-http.client.js';
import { createAbdmGateway } from './abdm.module.js';

const print = (line = '') => process.stdout.write(`${line}\n`);

/** Keys whose values are ABDM's own wording or flags, safe to show as they came. */
const SHOW_VALUE = new Set(['message', 'isNew', 'authResult', 'code', 'abhaStatus', 'abhaType']);

/** Key names and value types only: `string(12)`, `number`, `array(3) of string`. */
export function shape(value: unknown, key = ''): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return value.length === 0
      ? 'array(0)'
      : { [`array(${value.length}) of`]: shape(value[0] as unknown) };
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([name, item]) => [
        name,
        shape(item, name),
      ]),
    );
  }
  if (SHOW_VALUE.has(key)) return value;
  return typeof value === 'string' ? `string(${value.length})` : typeof value;
}

let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk as Buffer);
    done();
  },
});
let terminal: Interface | null = null;

/**
 * Asks one question. The question is readline's own prompt, so the terminal
 * never erases it; for a hidden answer the echo is muted only after the
 * prompt has been written.
 */
function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    muted = false;
    terminal?.question(question, (answer) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = hidden;
  });
}

async function step<T>(title: string, run: () => Promise<T>): Promise<T | null> {
  print(`\n== ${title}`);
  try {
    return await run();
  } catch (error) {
    if (error instanceof AbdmApiError) {
      print(
        `REFUSED status ${error.status} code ${error.code ?? 'none'} request ${error.requestId}`,
      );
      print(`ABDM message: ${error.abdmMessage ?? '(none)'}`);
    } else {
      print(`FAILED: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return null;
  }
}

async function main(): Promise<number> {
  terminal = createInterface({ input: process.stdin, output, terminal: true });
  loadRootEnv();
  const config = buildConfig({ ...process.env, ABDM_ADAPTER: 'sandbox', DEMO_MODE: 'false' });
  // Print the shape of every JSON answer as it arrives, before anything parses it.
  const observingFetch = (async (url: string | URL, init?: RequestInit) => {
    const response = await fetch(url, init);
    const path = new URL(url.toString()).pathname;
    const type = response.headers.get('content-type') ?? '';
    if (path.endsWith('/sessions') || path.endsWith('/public/certificate')) return response;
    if (type.includes('json')) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      print(`response ${response.status} ${path}`);
      print(JSON.stringify(shape(body), null, 2));
    } else {
      print(`response ${response.status} ${path} content-type ${type || '(none)'}`);
    }
    return response;
  }) as typeof fetch;
  const gateway = createAbdmGateway(config, {
    fetch: observingFetch,
    now: Date.now,
    logger: {
      log: (detail: unknown) => print(JSON.stringify(detail)),
      warn: (detail: unknown) => print(JSON.stringify(detail)),
    },
  });
  if (!gateway) {
    print('Set ABDM_CLIENT_ID and ABDM_CLIENT_SECRET in .env first.');
    return 1;
  }
  const client = new AbhaEnrollmentClient(gateway);

  print('Create ABHA by Aadhaar OTP: sandbox run.');
  print('This sends a real OTP and creates a sandbox ABHA for the Aadhaar you enter');
  print('(or returns the ABHA it already holds). Values you type are not printed.');
  print();
  const consent = await ask('Type the words I agree to consent to this for your own Aadhaar: ');
  if (consent.replace(/["']/g, '').toLowerCase() !== 'i agree') {
    print('Stopped: no consent given. Nothing was sent.');
    return 1;
  }
  const aadhaar = (await ask('Aadhaar number, 12 digits (hidden as you type): ', true)).replace(
    /\s+/g,
    '',
  );
  if (!/^[0-9]{12}$/.test(aadhaar)) {
    print('Aadhaar Number is not valid');
    return 1;
  }

  const sent = await step('1. Send Aadhaar OTP', () => client.requestAadhaarOtp(aadhaar));
  if (!sent) return 1;

  if ((await ask('Test a resend in the same transaction? Type y or n: ')).toLowerCase() === 'y') {
    const again = await step('1b. Resend Aadhaar OTP, same txnId', () =>
      client.requestAadhaarOtp(aadhaar, sent.txnId),
    );
    print(`same txnId returned: ${again ? again.txnId === sent.txnId : 'n/a'}`);
  }

  const mobile = (
    await ask('Communication mobile, 10 digits (hidden as you type): ', true)
  ).replace(/\D+/g, '');
  let enrolled = null;
  for (let attempt = 1; attempt <= 3 && !enrolled; attempt += 1) {
    const otp = await ask(`Aadhaar OTP, attempt ${attempt} of 3 (hidden as you type): `, true);
    enrolled = await step('2. Verify Aadhaar OTP and enrol', () =>
      client.enrolByAadhaar({ txnId: sent.txnId, otp, mobile }),
    );
  }
  if (!enrolled) return 1;
  const txnId = enrolled.txnId ?? sent.txnId;
  print(`isNew: ${enrolled.isNew}`);
  print(`txnId unchanged after enrol: ${txnId === sent.txnId}`);
  print(`user token received: ${Boolean(enrolled.userToken)}`);
  print(`profile mobile present: ${Boolean(enrolled.profile.mobile)}`);
  print(`profile mobile equals the communication mobile: ${enrolled.profile.mobile === mobile}`);
  print(`ABHA number present: ${Boolean(enrolled.profile.abhaNumber)}`);
  print(`ABHA addresses on the profile: ${enrolled.profile.abhaAddresses.length}`);

  if (
    (await ask('Verify the communication mobile by OTP now? Type y or n: ')).toLowerCase() === 'y'
  ) {
    const challenge = await step('3. Send mobile OTP', () =>
      client.requestMobileOtp(txnId, mobile),
    );
    if (challenge) {
      const otp = await ask('Mobile OTP (hidden as you type): ', true);
      const verified = await step('4. Verify mobile OTP', () =>
        client.verifyMobileOtp(challenge.txnId, otp),
      );
      print(`verified: ${verified?.verified ?? false}`);
    }
  }

  const suggestions = await step('5. ABHA address suggestions', () =>
    client.addressSuggestions(txnId),
  );
  print(`suggestions returned: ${suggestions?.length ?? 0}`);

  if (enrolled.userToken) {
    const token = enrolled.userToken;
    const profile = await step('6. Read the ABHA profile', () => client.profile(token));
    if (profile) {
      print(`profile mobile equals the communication mobile: ${profile.mobile === mobile}`);
    }
    const card = await step('7. Read the ABHA card', () => client.card(token));
    if (card)
      print(`card: ${card.bytes.length} bytes, content-type ${card.contentType ?? '(none)'}`);
  } else {
    print('\nNo user token in the enrolment response: profile and card were not read.');
  }

  print('\nDone. This output holds no Aadhaar number, OTP, token or ABHA identifier.');
  return 0;
}

if (process.argv[1]?.endsWith('abha-scaffold-create.ts')) {
  const code = await main().finally(() => terminal?.close());
  process.exit(code);
}
