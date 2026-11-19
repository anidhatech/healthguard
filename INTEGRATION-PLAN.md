# ABDM integration plan — HealthGuard

> **Status:** decisions 1 and 2 agreed. Configuration, the ABDM client, patient registration and the one-ABHA-per-patient rule are built and tested. The sandbox answers from the owner's Mac: a gateway session and the ABHA certificate were observed on 2026-11-19. No ABHA journey is built yet.
> **Updated:** 2026-11-19 · **Steps done:** 7 of 17 (41%)
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
| 8 | Functionality 1: create ABHA by Aadhaar OTP | Tracker row reaches "built and waiting for the tester" | in progress | Design: cases mapped in the tracker. Scaffold, observed from the owner's Mac on 2026-11-19 (run log below): send OTP, enrol (`isNew` false), mobile OTP send and verify, suggestions, profile and card all answered 200 or 202. Open: a resend with the first `txnId` was refused with 400; address creation, a wrong OTP and a new account (`isNew` true) not yet observed. Integrate: not started |
| 9 | Functionality 2: log in with ABHA number | Same | pending | |
| 10 | Functionality 3: log in with ABHA address | Same | pending | |
| 11 | Functionality 4: find a forgotten ABHA by mobile | Same | pending | |
| 12 | Functionality 5: log in with Aadhaar OTP | Same | pending | |
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
| M1 journeys (create, login, find, profile, card) | `apps/api/src/modules/abdm/abha-enrollment.client.ts` (written: the calls), then `abha.service.ts`, `abha.controller.ts` |
| Scan-and-share callback receiver | `apps/api/src/modules/abdm/abdm-callback.controller.ts` |
| Shared request and response schemas | `packages/shared/src/schemas/abdm.ts` |
| Patient registration and ABHA uniqueness | `apps/api/src/modules/patients/patient-registration.service.ts` (written), `patients.module.ts` and `apps/api/prisma/schema.prisma` (existing) plus migration `20261119090000_abha_number_unique` (written) |
| Counter screens | `apps/web/src/app/doctor/register/` (written; the staff area is `/doctor`) and `apps/web/src/components/abha/` |
| Screen text in three languages | `apps/web/messages/en-IN.json`, `hi-IN.json`, `te-IN.json` (existing) |
| Audit of attempts, without identifiers | `apps/api/src/modules/audit/audit.service.ts` (existing) |
| Tests | `apps/api/test/` (integration, existing folder), `tests/e2e/specs/` (existing folder) |

## 6. Tracker

One row per functionality, written by `abdm-ft/abdm_report.py tracker`. Never edited by hand.

<!-- abdm-tracker start: written by abdm_report.py tracker. Never edit it by hand -->

Entity type: private. Run: ui. Workbook: M1_ABHA_CREATION_VERIFICATION_SCAN_AND_SHARE.xlsx. Written 2026-11-19.

In scope: 7 functionalities. 2 building, 5 not started. Mandatory cases: 32, 0 passed, 0 failing, 32 open.

| # | Functionality | Mandatory cases and results | Screen or route | State | Date | Build |
|---|---|---|---|---|---|---|
| 1 | Create ABHA by Aadhaar OTP (`create-abha-aadhaar-otp`) | CRT_ABHA_101 open, CRT_ABHA_104 open, CRT_ABHA_102 open, CRT_ABHA_105 open, CRT_ABHA_106 open, CRT_ABHA_107 open, CRT_ABHA_108 open, CRT_ABHA_109 open, CRT_ABHA_112 open, CRT_ABHA_113 open, CRT_ABHA_114 open, CRT_ABHA_116 open | CRT_ABHA_101: Register a patient (/doctor/register): Create ABHA, method Aadhaar OTP, opens /doctor/abha/create; CRT_ABHA_104: Create ABHA step 1, Aadhaar number: 12 digits only, masked once entered, 'Aadhaar Number is not valid' with no call; CRT_ABHA_102: Create ABHA step 2, consent: terms word for word, five declarations, both confirmations, stored before any call; CRT_ABHA_105: Create ABHA step 3, Aadhaar OTP: [redacted] digits, ABDM's message with the masked mobile; CRT_ABHA_106: Create ABHA step 3, Resend: 60 second counter, two resends, same txnId; CRT_ABHA_107: Create ABHA step 3, Verify: enabled at six digits, ABDM's message on a wrong OTP, same txnId on retry; CRT_ABHA_108: Create ABHA step 3, communication mobile prefilled from the desk's record: same as Aadhaar-linked goes straight on; CRT_ABHA_109: Create ABHA step 4, mobile OTP when the communication mobile differs; CRT_ABHA_112: Create ABHA step 5, ABHA address: [masked], own address with live rules, already-exists choices; CRT_ABHA_113: Create ABHA step 6, created ABHA: number, address and profile details; CRT_ABHA_114: Create ABHA step 6, ABHA card: view and download as ABDM returned it; CRT_ABHA_116: Create ABHA step 7, save to HealthGuard: match on ABHA number, then mobile, name, gender and age, or record number; link or create | building | 2026-11-19 |  |
| 2 | Log in with ABHA number (`login-abha-number`) | VRFY_ABHA_101 open, VRFY_ABHA_201 open | VRFY_ABHA_101: not mapped; VRFY_ABHA_201: not mapped | not started |  |  |
| 3 | Log in with ABHA address (`login-abha-address`) | VRFY_ABHA_102 open, VRFY_ABHA_202 open | VRFY_ABHA_102: not mapped; VRFY_ABHA_202: not mapped | not started |  |  |
| 4 | Find a forgotten ABHA by mobile (`find-abha-mobile`) | VRFY_ABHA_301 open, VRFY_ABHA_302 open, VRFY_ABHA_303 open, VRFY_ABHA_304 open, VRFY_ABHA_305 open, VRFY_ABHA_306 open, VRFY_ABHA_307 open, VRFY_ABHA_308 open | VRFY_ABHA_301: not mapped; VRFY_ABHA_302: not mapped; VRFY_ABHA_303: not mapped; VRFY_ABHA_304: not mapped; VRFY_ABHA_305: not mapped; VRFY_ABHA_306: not mapped; VRFY_ABHA_307: not mapped; VRFY_ABHA_308: not mapped | not started |  |  |
| 5 | Log in with Aadhaar OTP (`login-aadhaar-otp`) | VRFY_ABHA_401 open, VRFY_ABHA_402 open, VRFY_ABHA_403 open, VRFY_ABHA_404 open, VRFY_ABHA_405 open | VRFY_ABHA_401: not mapped; VRFY_ABHA_402: not mapped; VRFY_ABHA_403: not mapped; VRFY_ABHA_404: not mapped; VRFY_ABHA_405: not mapped | not started |  |  |
| 6 | Link one ABHA number to one patient record (`link-one-abha-per-patient`) | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER open | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER: Register a patient (/doctor/register) and every ABHA journey, through PatientRegistrationService: an ABHA number already linked returns that patient and creates no new record | building | 2026-11-19 |  |
| 7 | Scan and share at a counter (`scan-and-share`) | SHARE_PATIENT_PROFILE_701 open, SHARE_PATIENT_PROFILE_702 open | SHARE_PATIENT_PROFILE_701: not mapped; SHARE_PATIENT_PROFILE_702: not mapped | not started |  |  |
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
