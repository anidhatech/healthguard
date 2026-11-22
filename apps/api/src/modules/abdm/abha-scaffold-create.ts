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
 *
 * With `--resend-test` it only checks how ABDM answers a resend: it sends one
 * OTP, waits 65 seconds, and resends. No OTP is entered and no ABHA is touched.
 *
 *   pnpm --filter @healthguard/api abdm:scaffold-create --resend-test
 */
import { AbhaEnrollmentClient } from './abha-enrollment.client.js';
import { ask, closeTerminal, createObservedGateway, print, step } from './abdm-scaffold.js';

async function main(): Promise<number> {
  const gateway = createObservedGateway();
  if (!gateway) return 1;
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

  if (process.argv.includes('--resend-test')) {
    print('\nWaiting 65 seconds before the resend. Do not type anything.');
    for (let left = 65; left > 0; left -= 5) {
      process.stdout.write(`  ${left}s `);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    print();
    const same = await step('R1. Resend after 65 seconds, with the first txnId', () =>
      client.requestAadhaarOtp(aadhaar, sent.txnId),
    );
    if (same) {
      print(`R1 accepted. same txnId returned: ${same.txnId === sent.txnId}`);
    } else {
      const fresh = await step('R2. Send again with an empty txnId', () =>
        client.requestAadhaarOtp(aadhaar),
      );
      print(
        `R2 ${fresh ? 'accepted' : 'refused'}. new txnId differs from the first: ${fresh ? fresh.txnId !== sent.txnId : 'n/a'}`,
      );
    }
    print('\nResend test done. The OTPs that arrived can be ignored.');
    return 0;
  }

  if ((await ask('Send a second OTP, as a resend does? Type y or n: ')).toLowerCase() === 'y') {
    const again = await step('1b. Send the Aadhaar OTP again, as a resend does', () =>
      client.requestAadhaarOtp(aadhaar),
    );
    if (again) {
      print('A new transaction id was returned. Use the newest OTP.');
      sent.txnId = again.txnId;
    }
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

const code = await main().finally(closeTerminal);
process.exit(code);
