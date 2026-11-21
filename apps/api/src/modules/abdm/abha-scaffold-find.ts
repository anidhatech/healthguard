/**
 * Interactive sandbox run of "find an ABHA by mobile", for the tester. Run it
 * in your own terminal, on a network the sandbox accepts:
 *
 *   pnpm --filter @healthguard/api abdm:scaffold-find
 *
 * It asks for a mobile number and an OTP at hidden prompts and sends them only
 * to ABDM, encrypted. It prints request ids and the SHAPE of each response,
 * never a value, a token or an identifier, so the output is safe to share.
 * Nothing is written to disk and nothing on the ABHA is changed.
 *
 * Part A searches a mobile and can log in to one of the ABHAs found, which
 * sends one real OTP. Part B searches a mobile that holds no ABHA.
 */
import { AbhaEnrollmentClient } from './abha-enrollment.client.js';
import { AbhaLoginClient } from './abha-login.client.js';
import { ask, closeTerminal, createObservedGateway, print, step, yes } from './abdm-scaffold.js';

async function askMobile(question: string): Promise<string | null> {
  const mobile = (await ask(question, true)).replace(/\s+/g, '');
  if (/^[0-9]{10}$/.test(mobile)) return mobile;
  print('Please enter a valid mobile number. Nothing was sent.');
  return null;
}

async function main(): Promise<number> {
  const gateway = createObservedGateway();
  if (!gateway) return 1;
  const login = new AbhaLoginClient(gateway);
  const enrolment = new AbhaEnrollmentClient(gateway);

  print('Find an ABHA by mobile: sandbox run. The search sends no OTP.');
  print('Values you type are not printed. Use your own mobile.');
  print();
  const consent = await ask('Type the words I agree to consent to this for your own ABHA: ');
  if (consent.replace(/["']/g, '').toLowerCase() !== 'i agree') {
    print('Stopped: no consent given. Nothing was sent.');
    return 1;
  }

  if (await yes('\nPart A: search a mobile that holds an ABHA?')) {
    const mobile = await askMobile('Mobile number, 10 digits (hidden as you type): ');
    const found = mobile
      ? await step('A1. Search by mobile', () => login.searchByMobile(mobile))
      : null;
    if (found) {
      const indexes = found.accounts.map((account) => account.index);
      print(
        `accounts listed: ${found.accounts.length}, with index ${indexes.join(', ') || '(none read)'}`,
      );
      for (const account of found.accounts) {
        print(
          `  index ${account.index}: ABHA number present ${Boolean(account.abhaNumber)}, ` +
            `masked ${/[xX*]/.test(account.abhaNumber ?? '')}, name present ${Boolean(account.name)}`,
        );
      }
      const choice = await ask('Index to log in to, or anything else to skip: ');
      const index = indexes.find((value) => String(value) === choice);
      const sent =
        index === undefined
          ? null
          : await step('A2. Send OTP to the chosen account', () =>
              login.requestIndexOtp(found.txnId, index),
            );
      if (sent) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const otp = await ask(`OTP, attempt ${attempt} of 3 (hidden as you type): `, true);
          const result = await step('A3. Verify OTP', () =>
            login.verifyOtp({ txnId: sent.txnId, otp, otpSystem: 'abdm' }),
          );
          if (result && !result.verified) {
            print(`not verified. ABDM message: ${result.message ?? '(none)'}`);
          }
          if (!result?.verified) continue;
          print(`user token received: ${Boolean(result.userToken)}`);
          print(`accounts returned: ${result.accounts.length}`);
          const token = result.userToken;
          if (token) {
            const profile = await step('A4. Read the ABHA profile', () => enrolment.profile(token));
            if (profile) {
              print(`profile has ABHA number: ${Boolean(profile.abhaNumber)}`);
              print(`profile has mobile: ${Boolean(profile.mobile)}`);
            }
          }
          break;
        }
      }
    }
  }

  if (await yes('\nPart B: search a mobile that holds no ABHA?')) {
    const mobile = await askMobile('A mobile with no ABHA, 10 digits (hidden as you type): ');
    if (mobile) {
      const found = await step('B1. Search by mobile', () => login.searchByMobile(mobile));
      if (found) print(`accounts listed: ${found.accounts.length} (expected a refusal instead)`);
    }
  }

  print('\nDone. This output holds no mobile number, ABHA number, OTP or token.');
  return 0;
}

const code = await main().finally(closeTerminal);
process.exit(code);
