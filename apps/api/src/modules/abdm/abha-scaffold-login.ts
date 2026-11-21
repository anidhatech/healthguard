/**
 * Interactive sandbox run of the three ABHA logins, for the tester. Run it in
 * your own terminal, on a network the sandbox accepts:
 *
 *   pnpm --filter @healthguard/api abdm:scaffold-login
 *
 * It asks for an ABHA number, an ABHA address, an Aadhaar number and each OTP
 * at hidden prompts and sends them only to ABDM, encrypted where ABDM asks for
 * that. It prints request ids and the SHAPE of each response, never a value,
 * a token or an identifier, so the output is safe to share. Nothing is
 * written to disk. It reads profiles and cards; it changes nothing on the ABHA.
 *
 * Each part can be skipped. Each part that runs sends one real OTP.
 */
import { AbhaEnrollmentClient } from './abha-enrollment.client.js';
import {
  AbhaLoginClient,
  formatAbhaNumber,
  type LoginResult,
  type OtpSystem,
} from './abha-login.client.js';
import { ask, closeTerminal, createObservedGateway, print, step, yes } from './abdm-scaffold.js';

/** Says what was typed without showing it: how long, how many digits, and the form it goes out in. */
function describeTyped(number: string): void {
  const digits = number.replace(/[^0-9]/g, '').length;
  const other = number.replace(/[0-9\s-]/g, '').length;
  const wellFormed = /^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$/.test(formatAbhaNumber(number));
  print(
    `typed: ${number.length} characters, ${digits} digits, ${other} other than digits, spaces and hyphens`,
  );
  print(`goes out as XX-XXXX-XXXX-XXXX: ${wellFormed}`);
}

function summary(result: LoginResult): void {
  print(`verified: ${result.verified}`);
  print(`user token received: ${Boolean(result.userToken)}`);
  print(`accounts returned: ${result.accounts.length}`);
  const first = result.accounts[0];
  if (first) {
    print(`first account has ABHA number: ${Boolean(first.abhaNumber)}`);
    print(`first account has ABHA address: ${Boolean(first.preferredAbhaAddress)}`);
  }
}

/** Up to three OTP attempts on one transaction, so a wrong OTP can be tried first. */
async function verify(
  label: string,
  run: (otp: string) => Promise<LoginResult>,
): Promise<LoginResult | null> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const otp = await ask(`${label} OTP, attempt ${attempt} of 3 (hidden as you type): `, true);
    const result = await step(`${label}: verify OTP`, () => run(otp));
    if (result?.verified) return result;
    if (result) print(`not verified. ABDM message: ${result.message ?? '(none)'}`);
  }
  return null;
}

async function main(): Promise<number> {
  const gateway = createObservedGateway();
  if (!gateway) return 1;
  const login = new AbhaLoginClient(gateway);
  const enrolment = new AbhaEnrollmentClient(gateway);

  print('ABHA logins: sandbox run. Each part sends one real OTP and reads a profile.');
  print('Values you type are not printed. Use your own ABHA and Aadhaar.');
  print();
  const consent = await ask('Type the words I agree to consent to this for your own ABHA: ');
  if (consent.replace(/["']/g, '').toLowerCase() !== 'i agree') {
    print('Stopped: no consent given. Nothing was sent.');
    return 1;
  }

  // The ABHA number as ABDM itself returns it, and as it was typed, for part E.
  let returned: string | null | undefined;
  let typed: string | undefined;

  // Part A and B: ABHA number, by Aadhaar OTP and by the ABHA-linked mobile OTP.
  for (const [part, otpSystem, label] of [
    ['A', 'aadhaar', 'ABHA number + Aadhaar OTP'],
    ['B', 'abdm', 'ABHA number + ABHA-linked mobile OTP'],
  ] as [string, OtpSystem, string][]) {
    if (!(await yes(`\nPart ${part}: run ${label}?`))) continue;
    const number = await ask('ABHA number, with or without hyphens (hidden as you type): ', true);
    typed = number;
    describeTyped(number);
    if (number.replace(/[^0-9]/g, '').length !== 14) {
      print('An ABHA number has 14 digits (an Aadhaar number has 12). Nothing was sent.');
      continue;
    }
    const sent = await step(`${part}1. Send OTP`, () =>
      login.requestOtp({ identifier: 'abha-number', value: number, otpSystem }),
    );
    if (!sent) continue;
    const result = await verify(part, (otp) =>
      login.verifyOtp({ txnId: sent.txnId, otp, otpSystem }),
    );
    if (!result?.userToken) continue;
    summary(result);
    const token = result.userToken;
    const profile = await step(`${part}3. Read the ABHA profile`, () => enrolment.profile(token));
    if (profile) print(`profile has mobile: ${Boolean(profile.mobile)}`);
    const card = await step(`${part}4. Read the ABHA card`, () => enrolment.card(token));
    if (card) print(`card: ${card.bytes.length} bytes, content-type ${card.contentType ?? ''}`);
  }

  // Part C: ABHA address. The search says which methods the address offers.
  if (await yes('\nPart C: run ABHA address login?')) {
    const address = await ask('ABHA address, for example name@sbx (hidden as you type): ', true);
    const found = await step('C1. Search the ABHA address', () => login.searchAddress(address));
    if (found) {
      print(`methods offered: ${found.authMethods.join(', ') || '(none read)'}`);
      const choice = await ask('Which OTP? Type aadhaar or mobile, or anything else to skip: ');
      const otpSystem: OtpSystem | null =
        choice === 'aadhaar' ? 'aadhaar' : choice === 'mobile' ? 'abdm' : null;
      const sent = otpSystem
        ? await step('C2. Send OTP', () => login.requestAddressOtp(address, otpSystem))
        : null;
      if (sent && otpSystem) {
        const result = await verify('C', (otp) =>
          login.verifyAddressOtp({ txnId: sent.txnId, otp, otpSystem }),
        );
        if (result?.userToken) {
          returned ??= result.accounts[0]?.abhaNumber;
          summary(result);
          const token = result.userToken;
          const profile = await step('C4. Read the ABHA-address profile', () =>
            login.addressProfile(token),
          );
          if (profile) {
            print(`profile has ABHA number: ${Boolean(profile.abhaNumber)}`);
            print(`profile has mobile: ${Boolean(profile.mobile)}`);
          }
          const card = await step('C5. Read the PHR card', () => login.addressCard(token));
          if (card)
            print(`card: ${card.bytes.length} bytes, content-type ${card.contentType ?? ''}`);
        }
      }
    }
  }

  // Part D: Aadhaar number. Answers whether the person holds an ABHA, and which.
  if (await yes('\nPart D: run Aadhaar number login?')) {
    const aadhaar = (await ask('Aadhaar number, 12 digits (hidden as you type): ', true)).replace(
      /\s+/g,
      '',
    );
    if (!/^[0-9]{12}$/.test(aadhaar)) {
      print('Aadhaar Number is not valid');
    } else {
      const sent = await step('D1. Send Aadhaar OTP', () =>
        login.requestOtp({ identifier: 'aadhaar', value: aadhaar, otpSystem: 'aadhaar' }),
      );
      if (sent) {
        const result = await verify('D', (otp) =>
          login.verifyOtp({ txnId: sent.txnId, otp, otpSystem: 'aadhaar' }),
        );
        if (result) {
          returned ??= result.accounts[0]?.abhaNumber;
          summary(result);
        }
      }
    }
  }

  // Part E: the ABHA-number send again, with the number ABDM returned above
  // rather than a typed one. It tells a typing slip from a format ABDM refuses.
  if (returned) {
    const known = returned;
    const pattern = known.replace(/[0-9]/g, '9').replace(/[A-Za-z]/g, 'a');
    print(`\nABDM returned an ABHA number of the pattern ${pattern}`);
    if (typed) {
      const same = typed.replace(/[^0-9]/g, '') === known.replace(/[^0-9]/g, '');
      print(`the number typed in part A or B has the same digits: ${same}`);
    }
    if (await yes('Part E: send an Aadhaar OTP for that returned ABHA number? Do not verify it.')) {
      await step('E1. Send OTP, number as ABDM returned it', () =>
        login.requestOtp({ identifier: 'abha-number', value: known, otpSystem: 'aadhaar' }),
      );
      const bare = known.replace(/[^0-9]/g, '');
      if (await yes('Part E: send once more with the hyphens taken out?')) {
        await step('E2. Send OTP, digits only', () => login.requestOtpRaw(bare, 'aadhaar'));
      }
    }
  }

  print('\nDone. This output holds no ABHA number, ABHA address, Aadhaar number, OTP or token.');
  return 0;
}

const code = await main().finally(closeTerminal);
process.exit(code);
