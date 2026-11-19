---
name: abdm-m1
description: Use when building, debugging or testing ABDM Milestone 1: creating an ABHA number or address, ABHA login, profile management, or a profile shared at the counter. Built per functionality: the router asks the entity type and lists each functionality with its mandatory cases; each file under references/functionalities/ is one loop from its screen requirements and calls to its own NHA test cases, with run.md, foundations.md, errors.md and the run scripts beside them.
type: skill
domain: m1
agent_consumers:
  - abdm-integration-agent
  - abdm-call-debugger
requires:
  - gateway-session-token
produces:
  - abha-number
  - abha-address
  - user-token
  - abha-profile
can_execute: true
can_orchestrate: false
---

# ABDM M1, create and verify ABHA

Generated from the ABDM Developer Portal on 2026-09-16, catalogue version 2026.09.16. Every fact below comes from a page in that portal, which is the place to look when this file does not carry enough.

This file is a snapshot. Re-download the whole folder from https://docs.abdm.gov.in/skills/abdm-m1/ when it is older than the work you are doing: this router and every file under references/ that it links to. Fetching this file alone leaves those links pointing at files you do not have.
If the abdm-docs MCP server is connected, trust its answers over this file: it serves the current catalogue and stamps every response with its catalogue_version, which you can compare against the version above.

## What you can do with M1

- Create an ABHA for somebody who has none: by Aadhaar OTP, by demographic authentication, by face or fingerprint, or under a parent for a child.
- Log in somebody who already has one, by Aadhaar, mobile, ABHA number or ABHA address.
- Read their profile, which carries the whole registration form: names, date of birth, gender, mobile, address with its codes, and a photograph.
- Find an ABHA somebody has forgotten, and pick the right account when one mobile holds several.
- Show the ABHA card and QR code, and take a profile a patient shares by QR at your counter.
- Update a profile and change a mobile.

## What happens first

The first question is your entity type: government or private. It sets the scope before anything is built.

- Every functionality below that holds a mandatory case for your entity type is in scope, whatever the deployment answers.
- The deployment questions in [foundations.md](references/foundations.md) add optional functionalities only. They never remove a journey a mandatory case needs.
- A group for the other entity type only is out of scope, and its cases are recorded NA with the group named.

## Functionalities, in build order

The cases each entity type must pass. Every other case is optional for that entity type.

| # | Functionality | Mandatory for government | Mandatory for private |
|---|---|---|---|
| 1 | [Create ABHA by Aadhaar OTP](references/functionalities/create-abha-aadhaar-otp.md) | CRT_ABHA_101, CRT_ABHA_104, CRT_ABHA_102, CRT_ABHA_105, CRT_ABHA_106, CRT_ABHA_107, CRT_ABHA_108, CRT_ABHA_109, CRT_ABHA_112 (conditional), CRT_ABHA_113, CRT_ABHA_114 or CRT_ABHA_115, CRT_ABHA_116 | CRT_ABHA_101, CRT_ABHA_104, CRT_ABHA_102, CRT_ABHA_105, CRT_ABHA_106, CRT_ABHA_107, CRT_ABHA_108, CRT_ABHA_109, CRT_ABHA_112 (conditional), CRT_ABHA_113, CRT_ABHA_114, CRT_ABHA_116 |
| 2 | [Log in with ABHA number](references/functionalities/login-abha-number.md) | VRFY_ABHA_101, VRFY_ABHA_201 | VRFY_ABHA_101, VRFY_ABHA_201 |
| 3 | [Log in with ABHA address](references/functionalities/login-abha-address.md) | VRFY_ABHA_102, VRFY_ABHA_202 | VRFY_ABHA_102, VRFY_ABHA_202 |
| 4 | [Find a forgotten ABHA by mobile](references/functionalities/find-abha-mobile.md) | VRFY_ABHA_301, VRFY_ABHA_302, VRFY_ABHA_303, VRFY_ABHA_304, VRFY_ABHA_305, VRFY_ABHA_306, VRFY_ABHA_307, VRFY_ABHA_308 | VRFY_ABHA_301, VRFY_ABHA_302, VRFY_ABHA_303, VRFY_ABHA_304, VRFY_ABHA_305, VRFY_ABHA_306, VRFY_ABHA_307, VRFY_ABHA_308 |
| 5 | [Log in with Aadhaar OTP](references/functionalities/login-aadhaar-otp.md) | VRFY_ABHA_401, VRFY_ABHA_402, VRFY_ABHA_403, VRFY_ABHA_404, VRFY_ABHA_405 | VRFY_ABHA_401, VRFY_ABHA_402, VRFY_ABHA_403, VRFY_ABHA_404, VRFY_ABHA_405 |
| 6 | [Link one ABHA number to one patient record](references/functionalities/link-one-abha-per-patient.md) | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER |
| 7 | [Scan and share at a counter](references/functionalities/scan-and-share.md) | SHARE_PATIENT_PROFILE_701, SHARE_PATIENT_PROFILE_702 | SHARE_PATIENT_PROFILE_701, SHARE_PATIENT_PROFILE_702 |
| 8 | [Update the mobile on an ABHA](references/functionalities/update-mobile.md) | none | none |
| 9 | [Read an ABHA QR code](references/functionalities/read-abha-qr.md) | none | none |
| 10 | [Create ABHA by face authentication](references/functionalities/create-abha-face-auth.md) | none | none |
| 11 | [Find ABHA by mobile with face authentication](references/functionalities/find-abha-face-auth.md) | none | none |
| 12 | [Create ABHA by fingerprint or iris](references/functionalities/create-abha-biometric.md) | none | none |
| 13 | [Find ABHA by mobile with fingerprint or iris](references/functionalities/find-abha-biometric.md) | none | none |
| 14 | [Log in with Aadhaar by fingerprint or iris](references/functionalities/login-aadhaar-biometric.md) | none | none |
| 15 | [Create ABHA by driving licence](references/functionalities/create-abha-driving-licence.md) | none | none |
| 16 | [Create ABHA by demographic authentication](references/functionalities/create-abha-demo-auth.md) | CRT_ABHA_301, CRT_ABHA_302, CRT_ABHA_304, CRT_ABHA_305, CRT_ABHA_306, CRT_ABHA_307, CRT_ABHA_308 or CRT_ABHA_309 | not applicable: government only |
| 17 | [Find the benefits linked to an ABHA](references/functionalities/find-abha-benefit.md) | none | not applicable: government only |

## Starting a loop

1. Build, in the order of the table, each functionality with a mandatory case for your entity type. An integration that already exists starts each loop at Test.
2. Read [foundations.md](references/foundations.md) at Design, and [run.md](references/run.md) at Test and Record.
3. Stop building when every one of those functionalities has met the Test exit in [run.md](references/run.md). Then run the full test.
4. Build an optional functionality only when the person asks for it, or a deployment answer in foundations.md added it.

## The full test run

Results gathered while building come from different builds. The report to submit comes from one run of every case in the workbook, on one final build, as [run.md](references/run.md) sets out, with the tester present.

## Two commands

With the integrators plugin installed, each starts with the environment survey and refuses to go on without NHA's workbook in `abdm-ft/`.

| Command | Does |
|---|---|
| `/abdm-build m1` | Starts or resumes the loops: reads the tracker, asks the entity type when the tracker lacks it, takes the next functionality in the table above whose mandatory cases have not passed, and runs its loop |
| `/abdm-test m1` | The final run on one build: every input asked for up front, the case plan, every mandatory case, the workbook, then the report or the draft and its findings |

Without the plugin, follow the same order by hand: [run.md](references/run.md) holds every step.

## Try asking

- "Add ABHA creation by Aadhaar OTP to this codebase"
- "What has to be in place before my first M1 call?"
- "My M1 call returned ABDM-1017. What is wrong, and how do I fix it?"
- "Walk me through the M1 test cases before go-live"

Loaded with no task? Say in three lines what this skill does. Offer the prompts above. Then ask what the person is building, and whether the code for it exists yet.

## The plan file

Integration work starts from a plan file and keeps it current. Before the first change to the codebase and the first sandbox call:

1. Look for `INTEGRATION-PLAN.md` at the root of the repository. If it exists, read it, say in one line where the work stands, and resume from the first step that is not `done`.
2. If it does not exist, scope the work first: the goal, the role, the modules and the skill that carries each, the routes the interview switched on, and what is out of scope. Write the file with every step `pending` and its exit condition, show it to the person, and start when they agree.
3. After every step, update the file at once: its status, the evidence that proves its exit condition (a request id, a passing test, a file changed), the date, and the count and percentage of steps `done`.

| Status | Means |
|---|---|
| `pending` | Not started |
| `in progress` | The step being worked on now. One at a time |
| `done` | Its exit condition was observed, and the evidence is in the file |
| `blocked` | Waiting on something only the person can give. The file names it and asks one question |

The last steps are the module's functional test cases. Their run log is its own file, linked from the plan. Never write a secret to the plan: no token, client secret, OTP, password or patient identifier.

For M1, the functionality rows of `INTEGRATION-PLAN.md` are the tracker [run.md](references/run.md) defines, and `abdm_report.py tracker` writes them. They take the place of the step statuses above for each functionality.

## What is in this folder

- **functionalities/**: 17 files, one loop each, in the order of the table above.
- **[run.md](references/run.md)**: the rules every test run follows, from the readiness check to the report.
- **[foundations.md](references/foundations.md)**: the rules across calls, hosts, headers, the codebase survey and the design rules across functionalities.
- **[errors.md](references/errors.md)**: every code the M1 specification returns, and the loop from a code to a fix.
- **workbook/**: NHA's workbook, copied into `abdm-ft/` before a run.
- **scripts/**: `abdm_env.py`, the environment survey; `abdm_workbook.py`; `abdm_report.py`, which also writes the tracker and the findings; and `functionalities.json`, which they read. All four are copied into `abdm-ft/` before a run, never retyped.

## Where the detail is

- Every endpoint, with its body fields and responses: /docs/hiecm/v3/api/m1
- The flows as diagrams: /docs/hiecm/v3/milestones/m1
- Every error code across modules: /docs/hiecm/v3/reference/error-codes
- Terms: /docs/hiecm/v3/getting-started/glossary
