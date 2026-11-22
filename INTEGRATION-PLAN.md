# ABDM integration plan — HealthGuard

> **Status:** M1 is **not complete**. Functionality 1 (create ABHA by Aadhaar OTP) has run end to end against the sandbox. Of the three logins, the ABHA-address and Aadhaar-number calls answered in the sandbox; the ABHA-number login was refused and its fix is untested. None has been run through its screen against the sandbox. Functionalities 4 and 7 are not started. None of the 32 mandatory cases is recorded as passed.
> **Updated:** 2026-11-20 · **Steps done:** 8 of 17 (47%)
> **Skill:** `.claude/skills/abdm-m1` (catalogue version 2026.09.16) · **Run folder:** `abdm-ft/`
> Never write a secret here: no token, client secret, OTP, password, Aadhaar number or patient identifier.

## 1. Scope

| | |
|---|---|
| Goal | Pass every ABDM Milestone 1 case that is mandatory for a private entity, in the ABDM sandbox |
| Entity type | Private |
| Role | Health information provider (HIP) front desk: create, verify and receive ABHA profiles at registration |
| Module and skill | M1 → `abdm-m1` |
| Sandbox credentials | The owner holds them and enters them as `ABDM_CLIENT_ID` and `ABDM_CLIENT_SECRET` in the environment's settings, never in chat. They travel in a request body, so they must be environment variables |
| In scope | Functionalities 1–7 in the tracker below (32 mandatory cases, 1 of them conditional) |
| Optional, not in scope | Update mobile, read ABHA QR, face, fingerprint or iris routes, driving licence. Added only by a "yes" in section 3 or on request |
| Not applicable | Demographic authentication and benefit lookup (government only) |
| Out of scope | M2 care-context linking and record sharing, M3, production credentials, certification |

## 2. What the codebase holds today

Read from the tree on 2026-11-18, not from the documents.

| Find | Where | Note |
|---|---|---|
| Languages and runtime | Node 24 (`.nvmrc`), TypeScript, pnpm 10.28, Turborepo | |
| Build, run, test | `pnpm build`, `pnpm dev`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e` | CI: `.github/workflows/ci.yml` |
| Frontend and backend | `apps/web` (Next.js 16) calls `apps/api` (NestJS 12) through `apps/web/src/lib/api.ts` | Counter screens go in web; every ABDM call goes through the API |
| Outbound HTTP client in the backend | None. Add at `apps/api/src/modules/abdm/abdm-http.client.ts` | Built on Node's `fetch`; one client for all ABDM hosts |
| Secrets and configuration | `apps/api/src/config/env.ts` (zod, environment only), `.env.example` | `ABDM_ADAPTER` exists with `disabled` and `sandbox-mock`; add `sandbox` plus client id, secret and host settings |
| Patient model and identifiers | `PatientProfile` in `apps/api/prisma/schema.prisma:709–711` (`abhaNumber`, `abhaAddress`, `abhaVerifiedAt`) | `abhaAddress` and, since 2026-11-19, `abhaNumber` are unique per organization |
| Visit model | `Encounter` in the same schema | Not needed for M1 |
| Patient registration | Was none on 2026-11-18. Added 2026-11-19: `POST /api/v1/patients` and `apps/web/src/app/doctor/register/page.tsx` | Demo organizations stay seeded-only |
| Inbound routing and public URL | NestJS controllers under `/api/v1`, cookie session and CSRF; `API_PUBLIC_URL` defaults to localhost | No public URL exists; scan and share is blocked on one |
| Cryptography helpers | `apps/api/src/common/hashing.ts`, `jose` in `apps/api/src/modules/auth/token.service.ts` | No RSA encryption helper. Add at `apps/api/src/modules/abdm/abdm-crypto.ts` using `node:crypto` |
| Errors and logging | `apps/api/src/common/problem.filter.ts` (problem responses), pino with a logging allowlist in `apps/api/src/app.module.ts` | Tokens, OTPs and identifiers must stay out of the allowlist |
| Existing ABDM code | `apps/api/src/modules/interoperability/interoperability.module.ts` (labelled simulation, no network) | Stays untouched; the real adapter is a separate module |

## 3. Decisions needed from the owner

Decisions 1 and 2 are agreed. The rest can be answered when their step is reached.

1. **Aadhaar handling.** `docs/ABDM_INTEGRATION.md` §3.1 says HealthGuard verifies an ABHA but never creates one and never asks for an Aadhaar number. The private-entity mandatory cases require creating an ABHA by Aadhaar OTP and logging in by Aadhaar OTP, so the desk must collect an Aadhaar number. Proposed: accept it, encrypt it in the API with ABDM's public key, forward it, and never store or log it; then update §3.1. **Agreed by the owner, 2026-11-18.** §3.1 is updated.
2. **Where real identities live.** Demo organizations accept only synthetic patients, and the sandbox journeys need a real Aadhaar holder. Proposed: a separate non-demo organization in a separate environment with `DEMO_MODE=false`, as the roadmap's Phase 2 requires. **Agreed by the owner, 2026-11-19.** Registration is refused in demo organizations, and the sandbox adapter is refused in demo mode.
3. **Who works the counter.** Built for the front desk role and the care team (nurse, care coordinator), on a "Register a patient" screen. Say if it should be narrower.
4. **Deployment questions.** The record holds the patient's mobile at check-in: **yes** (owner, 2026-11-19), so the communication mobile is prefilled. Still open, each "yes" adds an optional route: Is there a fingerprint or iris reader at the desk? Do patients arrive with the ABHA app? Do you create ABHAs from a driving licence?
5. **ABHA card.** HealthGuard shows and downloads the ABHA card itself (case CRT_ABHA_114): **yes** (owner, 2026-11-19). The owner is the tester for OTP journeys.
6. **Public callback URL** and two counter QR codes, registered with the ABDM bridge, for scan and share.
7. **Address and email on the patient record.** The login cases expect the address, email, state, district and city from the ABHA to be editable and saved. **Agreed by the owner, 2026-11-20:** the patient record gained those fields (migration `20261120090000_patient_contact_details`), filled from the ABHA and editable before saving. Name, date of birth and gender stay read only.

## 4. Steps

| # | Step | Exit condition | Status | Evidence |
|---|---|---|---|---|
| 1 | Install the skill and set up `abdm-ft/` | Skill files in the repository; workbook and scripts copied; the workbook check exits 0 | done | Commit `99ce544`; `abdm_env.py workbook` exit 0, 2026-11-18 |
| 2 | Survey the codebase and write this plan | Every row of section 2 names a path or "none, add at" | done | This file, 2026-11-18 |
| 3 | Owner agrees the plan and answers decisions 1 and 2 | Written agreement in the session | done | Decision 1 agreed 2026-11-18; decision 2 agreed 2026-11-19 |
| 4 | Configuration and credentials | `ABDM_ADAPTER=sandbox` validates at start-up; the owner has set `ABDM_CLIENT_ID` and `ABDM_CLIENT_SECRET` in the environment's settings | done | Settings in `apps/api/src/config/env.ts` and `.env.example`; both variables present in the cloud environment, 2026-11-18 |
| 5 | ABDM module: HTTP client, gateway session, certificate and encryption | A gateway session call returns a token from the sandbox; an encrypted value is accepted by one call | done | From the owner's Mac, 2026-11-19: gateway session token (request `3a99b022-3c04-4bb1-a96f-eb2cbc6df218`); ABHA certificate read (request `e4647b37-85dd-414c-8bfd-4bb8108efd6d`); an encrypted Aadhaar number accepted, `request/otp` returned a `txnId` (request `df3183fb-59f0-401b-8306-c07122519df1`). The sandbox refuses the cloud session's network, so sandbox calls run from the Mac |
| 6 | Patient registration route and counter screen (no ABDM yet) | A coordinator registers a non-synthetic patient; integration test passes | done | `POST /api/v1/patients` and `/doctor/register`; `apps/api/test/registration.int.test.ts` passes (10 tests); screen driven in a browser against a local clinic organization, 2026-11-19 |
| 7 | One ABHA number per patient: unique rule and duplicate check | Migration adds a unique rule on `abhaNumber` per organization; a second registration with the same number is refused; integration test passes | done | Migration `20261119090000_abha_number_unique`; `PatientRegistrationService.register` and `linkAbha`; same test file, 2026-11-19 |
| 8 | Functionality 1: create ABHA by Aadhaar OTP | Tracker row reaches "built and waiting for the tester" | done | Built 2026-11-19: API under `/api/v1/abha/enrolments` (`abha-enrolment.service.ts`, `abha.controller.ts`), screens at `/doctor/abha/create`. Evidence: sandbox scaffold run (log below); 14 integration tests against a fake ABDM with the observed shapes (`apps/api/test/abha-enrolment.int.test.ts`); the whole journey driven in a browser against a local stand-in for ABDM. Not yet seen against the sandbox through the screens: that is the tester session (step 15). Resend settled 2026-11-19 by a second sandbox run (log below): a resend is a fresh send with a new `txnId` |
| 9 | Functionality 2: log in with ABHA number | Tracker row reaches "built and waiting for the tester" | in progress | Built 2026-11-20 (API `/api/v1/abha/logins`, screen `/doctor/abha/verify`). Sandbox, 2026-11-20: the OTP request was refused with a `loginId` validation reason, on both OTP routes (run log below). The number is now sent hyphenated; not yet re-run, so this login has not worked against the sandbox |
| 10 | Functionality 3: log in with ABHA address | Same | in progress | Built 2026-11-20. Sandbox, 2026-11-20: search, Aadhaar OTP, verify, profile and PHR card all answered (run log below); the response shapes differed from the guide and the code was corrected to them. Not yet run through the screen |
| 11 | Functionality 4: find a forgotten ABHA by mobile | Same | pending | |
| 12 | Functionality 5: log in with Aadhaar OTP | Same | in progress | Built 2026-11-20. Sandbox, 2026-11-20: OTP request and verify answered, with the account returned (run log below). "No ABHA" (code `ABDM-1114`) and a wrong OTP not yet observed. Not yet run through the screen |
| 13 | Functionality 6: link one ABHA to one patient record, on the screens from steps 8–12 | Same | pending | |
| 14 | Functionality 7: scan and share (callback receiver, counter QR) | Same; needs decision 6 | pending | |
| 15 | Tester session: run the mandatory cases with the tester present | Every mandatory case is PASS or CONDITIONAL PASS in the workbook | pending | |
| 16 | Full test run on one final build | `abdm_report.py build` writes the report without `--draft` | pending | |
| 17 | Update `docs/ABDM_INTEGRATION.md`, `README.md` and `.env.example` | Documents match what was built | pending | |

Steps 5–7 need no tester. Steps 8–14 each need sandbox responses observed, so each needs the credentials from step 4 and, for OTP journeys, a person with an Aadhaar-linked mobile.

## 5. Where each ABDM touchpoint lands

All new unless marked.

| Touchpoint | File |
|---|---|
| Settings | `apps/api/src/config/env.ts` (existing), `.env.example` (existing) |
| HTTP client, request ids, timestamps | `apps/api/src/modules/abdm/abdm-http.client.ts` (written) |
| Gateway session token and cache | `apps/api/src/modules/abdm/abdm-session.service.ts` (written) |
| Public certificate and field encryption | `apps/api/src/modules/abdm/abdm-crypto.ts` (written) |
| M1 journeys (create, login, find, profile, card) | Create: `abha-enrollment.client.ts`, `abha-enrolment.service.ts`, `abha.controller.ts` under `apps/api/src/modules/abdm/` (written). Login and find: not started |
| Scan-and-share callback receiver | `apps/api/src/modules/abdm/abdm-callback.controller.ts` |
| Shared request and response schemas, consent wording | `packages/shared/src/schemas/abha.ts`, `packages/shared/src/abha-consent.ts` (written) |
| Patient registration and ABHA uniqueness | `apps/api/src/modules/patients/patient-registration.service.ts` (written), `patients.module.ts` and `apps/api/prisma/schema.prisma` (existing) plus migration `20261119090000_abha_number_unique` (written) |
| Counter screens | `apps/web/src/app/doctor/register/` and `apps/web/src/app/doctor/abha/create/` (written; the staff area is `/doctor`) |
| Screen text in three languages | `apps/web/messages/en-IN.json`, `hi-IN.json`, `te-IN.json` (existing) |
| Audit of attempts, without identifiers | `apps/api/src/modules/audit/audit.service.ts` (existing) |
| Tests | `apps/api/test/` (integration, existing folder), `tests/e2e/specs/` (existing folder) |

## 6. Tracker

One row per functionality, written by `abdm-ft/abdm_report.py tracker`. Never edited by hand.

<!-- abdm-tracker start: written by abdm_report.py tracker. Never edit it by hand -->

Entity type: private. Run: ui. Workbook: M1_ABHA_CREATION_VERIFICATION_SCAN_AND_SHARE.xlsx. Written 2026-11-22.

In scope: 7 functionalities. 6 built and waiting for the tester, 1 building. Mandatory cases: 32, 0 passed, 0 failing, 32 open.

| # | Functionality | Mandatory cases and results | Screen or route | State | Date | Build |
|---|---|---|---|---|---|---|
| 1 | Create ABHA by Aadhaar OTP (`create-abha-aadhaar-otp`) | CRT_ABHA_101 open, CRT_ABHA_104 open, CRT_ABHA_102 open, CRT_ABHA_105 open, CRT_ABHA_106 open, CRT_ABHA_107 open, CRT_ABHA_108 open, CRT_ABHA_109 open, CRT_ABHA_112 open, CRT_ABHA_113 open, CRT_ABHA_114 open, CRT_ABHA_116 open | CRT_ABHA_101: Register a patient (/doctor/register) and the staff dashboard: Create ABHA with Aadhaar OTP, opens /doctor/abha/create; CRT_ABHA_104: /doctor/abha/create step 1 Details: Aadhaar number, 12 digits only, masked once entered, 'Aadhaar Number is not valid' with no call; CRT_ABHA_102: /doctor/abha/create step 2 Consent: terms word for word with I agree, five declarations, both confirmations with names filled; recorded in the audit trail before any call; CRT_ABHA_105: /doctor/abha/create step 3 Aadhaar OTP: [redacted] digits only, ABDM's message with the masked mobile; CRT_ABHA_106: /doctor/abha/create step 3 Aadhaar OTP: [redacted] OTP with a 60 second counter and two resends; each resend is a fresh send with a new txnId, as the sandbox requires; CRT_ABHA_107: /doctor/abha/create step 3 Aadhaar OTP: [redacted] enables at six digits; a wrong OTP shows ABDM's message and keeps the transaction; CRT_ABHA_108: /doctor/abha/create step 3 Aadhaar OTP: [redacted] mobile prefilled; the Aadhaar-linked mobile goes straight to step 5; CRT_ABHA_109: /doctor/abha/create step 4 Mobile: OTP for a different communication mobile, same resend and wrong-OTP rules; CRT_ABHA_112: /doctor/abha/create step 5 ABHA address: [masked], own address with rules in green or red, 'ABHA address already exists.' with two choices; CRT_ABHA_113: /doctor/abha/create step 6 ABHA and card: ABHA number, address and profile details; CRT_ABHA_114: /doctor/abha/create step 6 ABHA and card: card shown as ABDM returned it, Download ABHA card; CRT_ABHA_116: /doctor/abha/create step 7 Save: matches by ABHA number, by mobile, name, gender and year of birth, or by record number; link, or create only when none matches | built and waiting for the tester | 2026-11-19 |  |
| 2 | Log in with ABHA number (`login-abha-number`) | VRFY_ABHA_101 open, VRFY_ABHA_201 open | VRFY_ABHA_101: /doctor/abha/verify: ABHA number, OTP to the Aadhaar-linked mobile; profile and card; mobile update Yes or No; details form with name, date of birth and gender read only; save; VRFY_ABHA_201: /doctor/abha/verify: ABHA number, OTP to the mobile linked to the ABHA; same screens as VRFY_ABHA_101 | built and waiting for the tester | 2026-11-21 |  |
| 3 | Log in with ABHA address (`login-abha-address`) | VRFY_ABHA_102 open, VRFY_ABHA_202 open | VRFY_ABHA_102: /doctor/abha/verify: ABHA address, Find login methods lists what ABDM offers for that address, Aadhaar OTP; profile, PHR card, details form, save; VRFY_ABHA_202: /doctor/abha/verify: ABHA address, mobile OTP when ABDM lists it; same screens as VRFY_ABHA_102 | built and waiting for the tester | 2026-11-21 |  |
| 4 | Find a forgotten ABHA by mobile (`find-abha-mobile`) | VRFY_ABHA_301 open, VRFY_ABHA_302 open, VRFY_ABHA_303 open, VRFY_ABHA_304 open, VRFY_ABHA_305 open, VRFY_ABHA_306 open, VRFY_ABHA_307 open, VRFY_ABHA_308 open | VRFY_ABHA_301: /doctor/abha/verify, Look up by: Mobile number: ten digits only, else 'Please enter a valid mobile number.' and no search is sent; VRFY_ABHA_302: /doctor/abha/verify, Look up by: Mobile number: Search lists every ABHA on the mobile with masked ABHA number, name and gender, before any OTP; VRFY_ABHA_303: /doctor/abha/verify, Look up by: Mobile number: 'ABHA details not found...' with a Create ABHA button that carries the mobile over, and no OTP step; VRFY_ABHA_304: /doctor/abha/verify, Look up by: Mobile number: Send OTP appears only after one account is chosen; the choice is kept to verification; resend rules as on the other logins; VRFY_ABHA_305: /doctor/abha/verify, Look up by: Mobile number: OTP step, then the chosen profile only, with the shared profile and card view; VRFY_ABHA_306: /doctor/abha/verify, Look up by: Mobile number: shared details form, name, date of birth and gender read only; saved through PatientRegistration; VRFY_ABHA_307: /doctor/abha/verify, Look up by: Mobile number: a wrong OTP shows ABDM's message, opens no profile, and can be retried; VRFY_ABHA_308: /doctor/abha/verify, Look up by: Mobile number: save step shows 'This ABHA profile is already linked to HMIS Beneficiary ID.' with the ABHA's details beside the record's, and offers no new record | built and waiting for the tester | 2026-11-21 |  |
| 5 | Log in with Aadhaar OTP (`login-aadhaar-otp`) | VRFY_ABHA_401 open, VRFY_ABHA_402 open, VRFY_ABHA_403 open, VRFY_ABHA_404 open, VRFY_ABHA_405 open | VRFY_ABHA_401: /doctor/abha/verify: Aadhaar number, 12 digits only, masked, 'Aadhaar Number is not valid' with no call; consent screen; VRFY_ABHA_402: /doctor/abha/verify OTP step: a wrong OTP shows ABDM's message and stays on the step; VRFY_ABHA_403: /doctor/abha/verify: No ABHA found, with ABDM's message and Create ABHA, which opens /doctor/abha/create at consent without asking for the Aadhaar again; VRFY_ABHA_404: /doctor/abha/verify: ABHA verified, profile, card download, then save or link to the patient record; VRFY_ABHA_405: /doctor/abha/verify OTP step: Resend OTP with a 60 second counter, two resends, then the limit message | built and waiting for the tester | 2026-11-21 |  |
| 6 | Link one ABHA number to one patient record (`link-one-abha-per-patient`) | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER open | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER: Register a patient (/doctor/register) and every ABHA journey, through PatientRegistrationService: an ABHA number already linked returns that patient and creates no new record | built and waiting for the tester | 2026-11-22 |  |
| 7 | Scan and share at a counter (`scan-and-share`) | SHARE_PATIENT_PROFILE_701 open, SHARE_PATIENT_PROFILE_702 open | SHARE_PATIENT_PROFILE_701: POST /api/v3/hip/patient/share registers the patient from the shared profile with no desk input and replies on on-share with the counter's token; /doctor/counters shows the QR code and the queue; SHARE_PATIENT_PROFILE_702: POST /api/v3/hip/patient/share matches a returning patient, updates the ABHA address, keeps one active entry per counter and opens a new one for another counter; /doctor/counters shows both queues | building | 2026-11-21 |  |
| 8 | Update the mobile on an ABHA (`update-mobile`) | none for a private entity |  | optional, not in scope |  |  |
| 9 | Read an ABHA QR code (`read-abha-qr`) | none for a private entity |  | optional, not in scope |  |  |
| 10 | Create ABHA by face authentication (`create-abha-face-auth`) | none for a private entity |  | optional, not in scope |  |  |
| 11 | Find ABHA by mobile with face authentication (`find-abha-face-auth`) | none for a private entity |  | optional, not in scope |  |  |
| 12 | Create ABHA by fingerprint or iris (`create-abha-biometric`) | none for a private entity |  | optional, not in scope |  |  |
| 13 | Find ABHA by mobile with fingerprint or iris (`find-abha-biometric`) | none for a private entity |  | optional, not in scope |  |  |
| 14 | Log in with Aadhaar by fingerprint or iris (`login-aadhaar-biometric`) | none for a private entity |  | optional, not in scope |  |  |
| 15 | Create ABHA by driving licence (`create-abha-driving-licence`) | none for a private entity |  | optional, not in scope |  |  |
| 16 | Create ABHA by demographic authentication (`create-abha-demo-auth`) | none for a private entity |  | not applicable |  |  |
| 17 | Find the benefits linked to an ABHA (`find-abha-benefit`) | none for a private entity |  | not applicable |  |  |

<!-- abdm-tracker end -->

## 7. Run logs

### Scaffold run, create ABHA by Aadhaar OTP, 2026-11-19

Run by the owner as tester, from the Mac, with `pnpm --filter @healthguard/api abdm:scaffold-create` on commit `cea9832`. The script prints request ids and response shapes only. The Aadhaar used already held an ABHA.

| Call | HTTP | Request id | Observed |
|---|---|---|---|
| `POST enrollment/request/otp` (Aadhaar) | 200 | `df3183fb-59f0-401b-8306-c07122519df1` | `txnId`, and `message` naming the masked mobile |
| `POST enrollment/request/otp` (resend, first `txnId`, seconds after the send) | 400 | `2d4120b7-0adc-4892-8d7e-f3bc631005d1` | Refused. Body held only `txnId` and `timestamp`: no code, no message. Cause not known yet |
| `POST enrollment/enrol/byAadhaar` | 200 | `6f5d884e-c26b-43a6-900f-1af8b9de1bd0` | `isNew` false, message "This account already exist", same `txnId`, `tokens`, `ABHAProfile` with `ABHANumber`, `preferredAddress`, `phrAddress`, `dob`, `photo`, `mobile`, `pinCode`; `communicationMobile` null |
| `POST enrollment/request/otp` (mobile) | 200 | `f82b3ee9-18e7-4740-9390-e83bdab16fe6` | `txnId`, `message` |
| `POST enrollment/auth/byAbdm` | 200 | `2ba141b5-ca40-4d04-af2d-203e2fc196c6` | `authResult` "success", `accounts` |
| `GET enrollment/enrol/suggestion` | 200 | `32001c57-5eb9-45ae-b730-db4cdf3a680a` | `abhaAddressList` with 10 entries |
| `GET profile/account` | 200 | `602eb8b6-9fd2-4d29-acbe-5bafb6bb66f4` | Different key names from enrolment: `preferredAbhaAddress`, `pincode`, `profilePhoto`, `status`; date of birth as `dayOfBirth`, `monthOfBirth`, `yearOfBirth`; `kycVerified`, `mobileVerified` |
| `GET profile/account/abha-card` | 202 | `8add1ec4-b7f2-4087-9b5a-fc0f782e60de` | `image/png`, about 210 KB |

Findings acted on: the profile reader now handles both sets of key names and builds the date of birth from its three parts. A card answers 202, not 200.

### Scaffold run, the three logins, 2026-11-20

Run by the owner as tester, from the Mac, with `abdm:scaffold-login` on commit `31c793e`.

| Call | HTTP | Request id | Observed |
|---|---|---|---|
| `POST profile/login/request/otp` (ABHA number, Aadhaar OTP) | 400 | `c6f3379f-f634-442c-97cb-3b8cca19d88b` | Refused. Body: a `loginId` field holding an 18-character reason, and `timestamp`. No code, no `message` |
| Same call (ABHA number, ABHA-linked mobile OTP) | 400 | `ac9fcebb-a771-4dbb-a0b2-61594bd8e072` | Refused the same way |
| `POST phr/web/login/abha/search` | 200 | `6d7864a3-56f8-4a15-a851-9d5ba1fa188e` | `authMethods` `MOBILE_OTP` and `AADHAAR_OTP`; also `healthIdNumber`, `abhaAddress`, `blockedAuthMethods`, `status`, `fullName`, `mobile` |
| `POST phr/web/login/abha/request/otp` (Aadhaar OTP) | 200 | `c351b9af-b08d-46e1-bd55-83c34d419f0c` | `txnId`, `message` naming the masked mobile |
| `POST phr/web/login/abha/verify` | 200 | `4c092b6e-bf0e-46bb-9499-a20d9cfec7f0` | `authResult` "success"; accounts under **`users`** (`abhaAddress`, `fullName`, `abhaNumber`, `status`, `kycStatus`, `age`); token under **`tokens.token`** |
| `GET phr/web/login/profile/abha-profile` | 200 | `d6392d5c-7244-404f-8653-a55eec82bb00` | `abhaAddress`, `fullName`, name parts, `dayOfBirth`, `monthOfBirth`, `yearOfBirth`, `dateOfBirth` (9 characters, so not zero-padded), `email`, `mobile`, `abhaNumber`, `address`, `stateName`, `districtName`, `pinCode`, `kycStatus`, `mobileVerified` as the text "true" |
| `GET phr/web/login/profile/abha/phr-card` | 202 | `c51d4120-d8fc-472e-953e-1c4ae9ee58dd` | `image/png`, about 204 KB |
| `POST profile/login/request/otp` (Aadhaar number) | 200 | `e1539304-2932-4ebc-97e3-6e73db4b9560` | `txnId`, `message` |
| `POST profile/login/verify` (Aadhaar number) | 200 | `1323b9ef-f2e9-4da4-a2e8-2f422d573220` | `authResult` "success", top-level `token`, `accounts` with `ABHANumber`, `preferredAbhaAddress`, `name`, `status`, `profilePhoto`, `mobileVerified` |

Findings acted on:

- **A validation refusal has its own shape:** `{ "<field>": "<reason>", "timestamp": ... }`, with no code and no `message`. The client now passes the reason on as ABDM wrote it. This also explains the bare 400 on the earlier resend, whose body held a 22-character `txnId` reason.
- **ABHA number format.** The refusal named `loginId`. The run script asked for "14 digits", so the number was most likely sent without hyphens. The client now sends fourteen bare digits as `XX-XXXX-XXXX-XXXX`. **This is a hypothesis until the ABHA-number login is run again.**
- **ABHA-address login.** Its accounts are under `users` and its token under `tokens`, not `accounts` and `token` as the skill's guide shows for the other logins. Before the fix, the service would have refused a verified ABHA-address login as "no account".
- **ABHA-address profile.** It uses `abhaAddress`, `fullName` and `kycStatus`, and sends `mobileVerified` as text; the reader now handles them.

Not yet observed: an ABHA-number login succeeding, a wrong OTP on a login, "no ABHA" for an Aadhaar, and the mobile update.

### Scaffold run, the three logins again, 2026-11-21

Run by the owner as tester, from the Mac, with `abdm:scaffold-login` on commit `96684b0`.

| Call | HTTP | Request id | Observed |
|---|---|---|---|
| `POST profile/login/request/otp` (ABHA number, Aadhaar OTP) | 400 | `320cf713-cdc9-4de8-8dd0-6cdc41fb3716` | Refused: `loginId` "LoginId is invalid" |
| Same call (ABHA number, ABHA-linked mobile OTP) | 400 | `ff5db551-dd51-4b3f-9c3f-f19142cb1523` | Refused the same way |
| `POST phr/web/login/abha/verify` | 200 | `939e98d0-5024-4490-a424-4647490dd6e5` | The corrected reader found the one account under `users`, with its ABHA number and address |
| `POST profile/login/verify` (Aadhaar number) | 200 | `640f5d09-c457-46e5-a558-632f980152a0` | As before: one account |

Findings:

- **The ABHA-address fix is confirmed** in the sandbox: one account read, where the first run read none. The refusal reason is now shown as ABDM wrote it.
- **The ABHA-number login is still refused**, so the hyphen hypothesis alone did not settle it. ABDM returns the ABHA number as 17 characters, which fits `XX-XXXX-XXXX-XXXX`. What was typed at the hidden prompt cannot be seen, so a typing slip is not ruled out: a value that is not fourteen digits goes out as typed.
- The run script now says how many characters and digits were typed, and has a part E that sends the OTP for the ABHA number ABDM itself returned, with and without hyphens.

A third run the same day, on `e0057e1`, settled it: the script reported **12 digits typed** at the ABHA number prompt (request `32da1f21-a615-445b-9d34-fa8d622d866d`, refused). The refusals were a typing slip, not a format the sandbox rejects. The script now stops before sending a number that is not 14 digits.

### Scaffold run, ABHA-number login, 2026-11-21

Run by the owner as tester, from the Mac, on commit `e0057e1`, with a 14-digit number sent as `XX-XXXX-XXXX-XXXX`.

| Call | HTTP | Request id | Observed |
|---|---|---|---|
| `POST profile/login/request/otp` (ABHA number, Aadhaar OTP) | 200 | `d6a03215-727d-47b7-82a5-b12a8780e144` | `txnId`, `message` naming the masked Aadhaar-registered mobile |
| `POST profile/login/verify` | 200 | `dd6c9149-0abb-4d07-b4fe-209562376c1a` | `authResult` "success", top-level `token`, one entry in `accounts` (`ABHANumber`, `preferredAbhaAddress`, `name`, `status`, `profilePhoto`, `mobileVerified` false) |
| `GET profile/account` | 200 | `54c57340-7bfe-4a23-b083-f9aae74c9858` | Full profile; `mobile` present, `mobileVerified` true |
| `GET profile/account/abha-card` | 202 | `ace96df6-f1bb-40f2-bc97-5d1e648196dd` | `image/png`, about 211 KB |
| `POST profile/login/request/otp` (ABHA number, ABHA-linked mobile OTP) | 200 | `792ce7b8-dac9-416d-b8f6-82b48d642f32` | `txnId`, `message` naming the masked mobile |
| `POST profile/login/verify` | 200 | `3a1c3cce-6087-48c2-aa05-788d26869ccb` | Same shape as the Aadhaar OTP route |
| `GET profile/account` | 200 | `5689ae7a-3637-4746-9e05-f27f51499879` | As above |
| `GET profile/account/abha-card` | 202 | `e2452ff3-3989-4500-a8bd-83288331ec22` | As above |

Findings:

- **The ABHA-number login works in the sandbox by both OTP routes** with the hyphenated number. Whether bare digits would also be accepted was not tested and does not matter: the client always sends the hyphenated form.
- The account in the verify answer says `mobileVerified` false while the profile says true, with a mobile. The mobile-update offer must be decided from the profile, as the service already does.

All three logins have now answered correctly at the call level. Not yet observed: any login through the screens, a wrong OTP on a login, "no ABHA" for an Aadhaar, and the mobile update.

### First run through the screens, 2026-11-20

Run by the owner as tester, on the Mac, on commit `55bfc95`: the API with `ABDM_ADAPTER=sandbox` and `DEMO_MODE=false` against a separate clinic database, the web app at `/doctor/abha/create`, signed in as the clinic's front desk.

Observed in the clinic database afterwards, by count only:

| What | Observed |
|---|---|
| Consent | One `CONSENT_GRANT` audit event for the journey, written before the OTP was sent, and one later event tying it to the patient |
| Enrolment | One enrolment event, `isNew` false: the Aadhaar already held an ABHA, and the journey carried on from it |
| Patient record | One patient created, not synthetic, with an ABHA number and an ABHA address linked |
| Screen | The staff dashboard listed the new patient, with no demo banner |

What this does and does not show: the journey works end to end against the sandbox for an Aadhaar that already holds an ABHA. It is **not** a test run in the skill's sense. The tester's observation of each case (invalid Aadhaar, wrong OTP, resend, a different mobile, the address rules, the card, a second visit) was not recorded, no workbook row was written, and every case in the tracker stays open.

### The three logins through the screens, 2026-11-21

Run by the owner as tester, on the Mac, the API with `ABDM_ADAPTER=sandbox` and `DEMO_MODE=false` against the clinic database, at `/doctor/abha/verify`, signed in as the clinic's front desk. Reported by the tester; no request ids were collected.

| Login | Build | Observed by the tester |
|---|---|---|
| ABHA address, Aadhaar OTP | `58bee13` | Worked. A wrong OTP first showed ABDM's message "Entered OTP is incorrect. Kindly re-enter valid OTP." with the transaction kept and the resend count shown (screenshot seen) |
| Aadhaar number, Aadhaar OTP | `58bee13` | Worked. A wrong OTP first showed the error |
| ABHA number, typed with separators | `58bee13` | Refused at Send OTP with ABDM's message "Runtime Error" (screenshot seen) |
| ABHA number | `d4b5e70` | Worked, after the client began to accept any dash character in the typed number |

What this does and does not show: all three logins work from the screens against the sandbox. The cause of "Runtime Error" is **not proven**: the fix that followed treats an en dash as a hyphen, and the login then worked, but the API log line of the failed call was not collected, so a passing sandbox fault is not ruled out. This is not a test run in the skill's sense: no case was recorded, and saving the ABHA to a patient record, the mobile update, "no ABHA" for an Aadhaar and the ABHA-linked mobile route on the screens were not reported.

### Scaffold run, find an ABHA by mobile, 2026-11-21

Run by the owner as tester, from the Mac, with `abdm:scaffold-find` on commit `6bcd063`.

| Call | HTTP | Request id | Observed |
|---|---|---|---|
| `POST profile/account/abha/search` | 200 | `aa6e24c5-b212-4edc-a7d1-4db862e2045d` | An array of one entry: `txnId`, and `ABHA`, an array of accounts each with `index` (a number), `ABHANumber` (17 characters, masked), `name`, `gender`, `kycVerified` as the text "true", and `authMethods`. No OTP was sent |
| `POST profile/login/request/otp` (`loginHint` `index`, the search `txnId`) | 200 | `95ae74e6-cb41-4dd0-931b-02b0499c8e40` | `txnId`, `message` naming the masked mobile |
| `POST profile/login/verify` | 200 | `a52b06eb-a1d1-404a-b35f-151d66c27c7b` | `authResult` "success", `token`, one entry in `accounts`, the same shape as an ABHA-number login |
| `GET profile/account` | 200 | `4ac34c5f-9a14-4099-b313-97e03781f43e` | The full profile, with ABHA number and mobile |
| `POST profile/account/abha/search` (second mobile) | 200 | `5a755f03-b5e4-437a-9819-4593fa02361d` | One account listed: that mobile also holds an ABHA |

Findings:

- The search answers in the array shape the skill's guide gives first, not the bare object it marks for confirmation. The client reads it without change.
- **"No ABHA on this mobile" was not observed.** The second mobile tried holds an ABHA. The code treats ABDM's `ABDM-1114` refusal as that outcome, from the guide; VRFY_ABHA_303 needs a mobile with no ABHA at the tester session.
- Not observed: a wrong OTP on this route, a resend with the same search transaction, and a mobile that holds more than one ABHA.

Built on this the same day: `POST abha/logins/mobile-search`, the `MOBILE` login route, the "Mobile number" choice on `/doctor/abha/verify`, and, in the shared save step, the words "This ABHA profile is already linked to HMIS Beneficiary ID." with the ABHA's details beside the record's. The eight cases were driven through the screen in a browser against a local stand-in for ABDM, not the sandbox; that is a check of the build, not a test run.

### Find an ABHA by mobile through the screens, 2026-11-21

Run by the owner as tester, on the Mac, on commit `adbfa21`, the API with `ABDM_ADAPTER=sandbox` and `DEMO_MODE=false` against the clinic database, at `/doctor/abha/verify` with "Mobile number" chosen. Reported by the tester with two screenshots; no request ids were collected.

| Step | Observed |
|---|---|
| A valid mobile that holds no ABHA | "ABHA details not found. We did not find any ABHA number linked to this mobile number. Please use an ABHA-linked mobile number.", "You can create an ABHA for this person now." and a Create ABHA button; no OTP step (screenshot seen) |
| The tester's own mobile, account chosen, Send OTP | "OTP sent to mobile number ending with" and the masked number (screenshot seen) |
| A wrong OTP | ABDM's message "Please enter a valid OTP. Entered OTP is either expired or incorrect.", the OTP field cleared, the resend wait and "2 resends left" shown, no profile opened (screenshot seen) |
| The right OTP | Reported as working |

| A six-digit number, then Search | "Please enter a valid mobile number." under the field, and no list or OTP step (screenshot seen) |
| Continue to the save step, for an ABHA already linked | The existing record with its record number and "This ABHA profile is already linked to HMIS Beneficiary ID." (text pasted by the tester; the comparison table was not in what was pasted) |

What this does and does not show: the "no ABHA on this mobile" outcome is now observed from the sandbox through the screen, though not which answer ABDM gave for it (the `ABDM-1114` refusal or an empty list; the code treats both alike). Not reported: the ABHA-beside-record comparison, a resend, and a mobile with several ABHAs. This is not a test run in the skill's sense: no case was recorded.

### Scan and share: decision and what is needed, 2026-11-21

The owner chose a tunnel from the Mac for the public callback while this is built, with a hosted address to follow before the tester session.

The skill's guide gives the inbound call, the reply on on-share and the counter QR format. It does **not** say how the bridge URL is registered or how ABDM identifies itself on the inbound call, so both are to be observed before the receiving side is built: `abdm:scaffold-share` shows a counter QR code, prints the header names and body shape of what arrives, answers 200, and replies on on-share with a token number. It registers nobody. Its bridge URL step (`PATCH /api/hiecm/gateway/v3/bridge/url`) is from memory of ABDM's documentation, not from the guide: the sandbox's answer decides whether it is right.

Needed from the owner for that run: a facility id (HIP id) registered in the sandbox HFR and linked to this client id, a tunnel to the script's port, and the ABDM sandbox PHR app signed in with an ABHA.

### Scan and share: receiving side built, not yet observed, 2026-11-21

The owner has no facility id (HIP id) yet, so no share can reach us and nothing here has been observed in the sandbox. Built from the skill's guide meanwhile:

- **Counters and queue.** A clinic adds counters (`/doctor/counters`), each with the QR code ABDM's patient app opens, and sees who is waiting with their token number. `db:create-clinic` takes `FACILITY_ID`.
- **The inbound call**, `POST /api/v3/hip/patient/share`, answered 200 at once. It is refused with 404 unless `ABDM_SHARE_INBOUND=on`, which is off by default.
- **Registration with nothing typed.** The record takes the name, gender, date of birth, mobile, address, ABHA number and ABHA address from the share; the audit trail records the system as the actor.
- **A returning patient** is matched on the ABHA number, then the ABHA address, then name, gender and mobile together (only when exactly one record matches). Another ABHA address of the same person updates the record. A repeat scan at the same counter keeps the one entry and its token; another counter opens a new entry.
- **The reply on on-share** carries the token number, the counter and the ABHA address, with the share's request id.

Open, to settle from a real share:

- **How ABDM identifies itself on the inbound call is not in the guide and is not checked yet.** Until it is, the route must stay off outside a test run: anyone who knew the address and a facility id could post a made-up profile.
- The unit of the token's `expiry` (3600 is sent, assuming seconds).
- A share that carries only a year of birth is stored as 1 January of that year.
- A queue entry stands in for the visit; a care context in ABDM's sense belongs to Milestone 2.

The integration tests drive every rule above against a stand-in for ABDM, and the counters screen was driven in a browser the same way. That is a check of the build, not a test run.

### Owner's decision on scan and share, 2026-11-22

The owner will obtain the facility id (HIP id) during Milestone 3, not now, and asked for the rest of Milestone 1 to proceed. Consequences, stated so nobody reads more into the tracker than is there:

- Scan and share stays **built and unobserved**, with its inbound route off. `SHARE_PATIENT_PROFILE_701` and `702` are mandatory for a private entity and cannot be run without a facility id, a registered callback address and the PHR app. In the tester session they are to be recorded `needs-human`, naming the facility id as what was asked for and not available in this run. They are not `not-run`: they apply.
- Milestone 1 therefore cannot be reported complete until those two cases are run. The other 30 mandatory cases can be.
- Link one ABHA per patient is marked built: the lookup before creating a record, the unique ABHA number per clinic, and the "already linked" outcome are in every journey and covered by the integration tests. The tester saw the already-linked outcome from a mobile search on 2026-11-21.

Next for Milestone 1: the tester session over the 30 runnable mandatory cases, recorded in NHA's workbook, and the draft report.

### Resend test, 2026-11-19

Run by the owner as tester, from the Mac, with `abdm:scaffold-create --resend-test` on commit `049a8a4`.

| Call | HTTP | Request id | Observed |
|---|---|---|---|
| `POST enrollment/request/otp` (Aadhaar) | 200 | `65724322-168e-48f3-afbe-a0ff829f2349` | `txnId`, `message` |
| Same call 65 seconds later, carrying the first `txnId` | 400 | `01b3b528-884a-4427-9635-a7277ef5f4c5` | Refused. Body held only `txnId` and `timestamp` |
| Same call with an empty `txnId` | 200 | `a6b8b8df-1b88-4e43-b084-7b1ccce74a5c` | A new `txnId`, `message` |

Finding acted on: a resend is a fresh send with an empty `txnId`, and later calls use the newest id. The 60-second wait and the two-resend limit are still enforced on the screen and in the API.

**Catalogue issue, for the owner to file if they wish.** The skill's guide for this functionality (create-abha-aadhaar-otp, "Resend") says "A resend reuses the `txnId` of the first send" for CRT_ABHA_106. In the sandbox on 2026-11-19 a resend carrying the first `txnId` was refused with HTTP 400 and no code or message, both seconds after the send and 65 seconds after it, while a send with an empty `txnId` was accepted and returned a new id.
