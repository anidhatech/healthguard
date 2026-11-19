# Scan and share at a counter

Sheet group: Share Profile.

Functionality 7 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `SHARE_PATIENT_PROFILE_701`, `SHARE_PATIENT_PROFILE_702`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Every call in `scan-and-register-abdm-patient-share-hip` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Scan and share at a counter works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Scan and share at a counter succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `SHARE_PATIENT_PROFILE_701`, `SHARE_PATIENT_PROFILE_702` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Scan and share at a counter |

Loop limit: 3 passes through Test for Scan and share at a counter. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `SHARE_PATIENT_PROFILE_701`, `SHARE_PATIENT_PROFILE_702`.
An integration that already exists enters Scan and share at a counter at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: SHARE_PATIENT_PROFILE_701, SHARE_PATIENT_PROFILE_702. Mandatory for a private entity: SHARE_PATIENT_PROFILE_701, SHARE_PATIENT_PROFILE_702.

| Case | Government | Private | What is tested |
|---|---|---|---|
| SHARE_PATIENT_PROFILE_701 | mandatory | mandatory | Share Patient Profile |
| SHARE_PATIENT_PROFILE_702 | mandatory | mandatory | Returing patient |

### SHARE_PATIENT_PROFILE_701: Share Patient Profile

The user will scan the facility QR code displayed at the facility premises.

**Steps**

- 1\. Log into PHR app.
- 2\. The user will scan the facility QR code displayed at the facility premises /registration desk.
- 3\. After scanning the facility QR code, the patient needs to click on the 'Get Token' button. Upon clicking, the patient's profile details are displayed, including ABHA number, ABHA address, name, gender, date of birth, mobile number, and address.
- Below this, a consent message is displayed, prompting the patient to click the appropriate button, either 'Cancel' or 'I Agree'. Selecting 'Cancel' will prevent the details from being shared with the HIP, while selecting 'I Agree' will allow the details to be shared with the HIP.
- 4\. Clicking the 'I Agree' button facilitates the sharing of the patient's details with the HIP, and a token is issued with a validity of 60 minutes.

**Expected Result**

- The patient receives a token valid for 60 minutes,
- which successfully shares their details with the HIP.

**For the tester**

- After processing the token, the facility’s HMIS system should automatically save the patient details and register the patient using the available information, without requiring any manual data entry.

### SHARE_PATIENT_PROFILE_702: Returing patient

System must handle scenarios for revisit

**Steps**

- 1\. When a patient scans the hospital's QR code, the HIP receives the patient's details. The system then attempts to match these details against already registered patients in its database.
- It checks for a match based on the following parameters: name, mobile number, gender, ABHA number, and ABHA address.
- If a match is found, the system proceeds to generate a token and create a care context under the existing Beneficiary ID.
- If no match is found, the patient is treated as a new registration and a new Beneficiary ID is created.
- 2\. If a patient is already registered and revisits the hospital, but this time scans the QR code using a different ABHA address than previously used. The system should update the ABHA address on the existing Beneficiary ID, rather than creating a new one.
- 3\. If the patient scans the same QR code again with same ABHA address while an active queue entry already exists, the system shall not create a new queue entry. Instead, only a new token number may be issued as per queue management rules, while the existing queue association remains unchanged.
- 4\. If the patient scans a QR code associated with a different counter or queue, the system shall create a new queue entry using the same patient details while assigning a new token number corresponding to the selected queue/counter.

**Expected Result**

- 1\. For revisit patients, the system shall reuse the existing patient record and avoid duplicate registrations. Queue and token generation shall be handled based on the selected counter/queue rules.
- Refer below link to understand New vs Returning patient scenario: https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=NewReturningPatients

## Screen requirements

### In plain words

The patient scans the counter QR code in their PHR app and agrees to share.
The profile reaches your bridge on `/api/v3/hip/patient/share`, and your
answer on `on-share` carries their token. Everything your registration needs
is in that profile, so nobody at the counter types anything.

### What happens

| Requirement | Cases |
|---|---|
| A new patient is registered from the shared profile automatically, with no click and no data entry, and gets a token in the `on-share` answer | SHARE_PATIENT_PROFILE_701 |
| The `on-share` answer carries the token number your queue issued, in `acknowledgement.profile.tokenNumber`, with `status` `SUCCESS` and no `error` beside it. The case expects the patient to receive a token valid for 60 minutes. The specification gives `expiry` as a number and names no unit, so confirm the unit at onboarding before you set it | SHARE_PATIENT_PROFILE_701 |
| Match a returning patient on name, mobile, gender, ABHA number and ABHA address against your records | SHARE_PATIENT_PROFILE_702 |
| A certain match registers automatically under the existing beneficiary id, and the visit's care context is created under it | SHARE_PATIENT_PROFILE_702 |
| An uncertain match may take one confirmation from the operator, a single choice on the screen. Never any typing | SHARE_PATIENT_PROFILE_702 |
| No match: a new beneficiary id is created, as for a new patient | SHARE_PATIENT_PROFILE_702 |
| The same person sharing a different ABHA address of theirs updates the ABHA address on the existing beneficiary id. No new id | SHARE_PATIENT_PROFILE_702 |
| The same QR code, the same ABHA address and an active queue entry: no new queue entry. Only a new token number may be issued under your queue rules, and the existing queue association stays as it was | SHARE_PATIENT_PROFILE_702 |
| The QR code of a different counter or queue: a new queue entry for that queue, with the same patient details and a new token number for it | SHARE_PATIENT_PROFILE_702 |

### How you know it worked

A first scan leaves one new patient and a token, with no screen touched at
the counter. A second scan by the same person leaves the same single patient
row, and the queue entries the rules above name.

### When it goes wrong

- An operator who has to confirm every new registration fails the no click
  rule on SHARE_PATIENT_PROFILE_701.
- A second beneficiary id for a returning patient fails
  SHARE_PATIENT_PROFILE_702.

From `hiecm.concept.m1-screens-scan-and-share`.

## Calls

### Scan and register (`scan-and-register-abdm-patient-share-hip`)

**Act: the calls in this journey, in order**

#### 1. Share HIP patient (`scan-and-register_post_v3_hip_patient_share`)

Inbound to your bridge at `/api/v3/hip/patient/share`. Acknowledge it and continue.

#### 2. Answer the patient share request (`scan-and-register_post_patient_share_v3_on_share`)

```bash
curl --request POST \
  --url https://dev.abdm.gov.in/api/hiecm/patient-share/v3/on-share \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'X-CM-ID: sbx' \
  --header 'Content-Type: application/json' \
  --data '{
  "acknowledgement": {
    "status": "SUCCESS",
    "abhaAddress": "<ABHA_ADDRESS_FROM_THE_SHARE>",
    "profile": {
      "context": "<COUNTER_ID_FROM_THE_SHARE>",
      "tokenNumber": "<TOKEN_NUMBER_YOUR_QUEUE_ISSUED>",
      "expiry": "<TOKEN_EXPIRY_AS_A_NUMBER>"
    }
  },
  "response": {
    "requestId": "<REQUEST_ID_OF_THE_SHARE>"
  }
}'
```

**Exit condition (Observe until this is true)**

A 202 on this reply, sent with `response.requestId` set to the `REQUEST-ID` of the `POST /api/v3/hip/patient/share` request it answers. A reply without that id answers nothing.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| SHARE_PATIENT_PROFILE_701 | Counter registration from a shared profile, token | `scan-and-register_post_v3_hip_patient_share`, `scan-and-register_post_patient_share_v3_on_share` |
| SHARE_PATIENT_PROFILE_702 | Counter registration, returning patient and queue | `scan-and-register_post_v3_hip_patient_share`, `scan-and-register_post_patient_share_v3_on_share` |

| Operation | Call | What it does |
|---|---|---|
| `scan-and-register_post_v3_hip_patient_share` | `POST /api/v3/hip/patient/share` | This API will be invoked to the HIP for sharing the response of HIECM's /api/hiecm/patient-share/v3/share API |
| `scan-and-register_post_patient_share_v3_on_share` | `POST /api/hiecm/patient-share/v3/on-share` | This API will be invoked by the HIP for sharing the response of HIECM's /api/hiecm/patient-share/v3/on-share API |

Headers the calls of Scan and share at a counter take: `REQUEST-ID`, `TIMESTAMP`, `X-HIP-ID`, `X-CM-ID`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

The specification's examples return no error code on the calls of Scan and share at a counter.

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| SHARE_PATIENT_PROFILE_701 | `abha-app`, `counter-qr`, `public-callback` | none |
| SHARE_PATIENT_PROFILE_702 | `abha-app`, `counter-qr`, `public-callback`, `second-abha-address`, `patient-registered`, `second-counter-qr` | none |

### SHARE_PATIENT_PROFILE_701 and 702: share a profile by scanning the facility QR

The set marks this group for the PHR app, but the call that proves each case lands on your HIP. The person acts in the ABDM sandbox PHR app. Your system receives the share and answers it with a queue token. Both operations are in the scan and register specification.

Calls: the inbound `scan-and-register_post_v3_hip_patient_share` at your callback URL, which your system answers with HTTP 200. Then your `scan-and-register_post_patient_share_v3_on_share`, which returns 202.

Loop limit: 3 passes per test case.

**Preconditions.** A gateway access token less than 30 minutes old. Your callback URL registered with the bridge and reachable from the internet. A facility QR code for one of your counters, and for SHARE_PATIENT_PROFILE_702 a second QR code for a different counter. The person present with the ABDM sandbox PHR app, an ABHA number, and a second ABHA address on that ABHA number for SHARE_PATIENT_PROFILE_702.

#### SHARE_PATIENT_PROFILE_701, the profile is shared and the patient registered. `sandbox`, `human` and `screen`

Use a person your system has not registered. The person logs in to the PHR app, scans your facility QR code, taps "Get Token", reads their profile and the consent message, and taps "I Agree". Stop for that.

Exit condition: three observations, all pasted.

1. An inbound POST arrives at your URL for `scan-and-register_post_v3_hip_patient_share` with `intent` `PROFILE_SHARE`, `metaData.hipId` equal to your HIP id, `metaData.context` equal to the counter id of the QR code scanned, and `profile.patient.abhaAddress`, `profile.patient.name`, `profile.patient.gender` and `profile.patient.yearOfBirth` present. Your system answers it with HTTP 200. Paste the body in full, with `profile.patient.phoneNumber` masked.
2. Your `scan-and-register_post_patient_share_v3_on_share` returns 202. It was sent with `acknowledgement.status` `SUCCESS`, `acknowledgement.abhaAddress` equal to `profile.patient.abhaAddress`, `acknowledgement.profile.context` equal to `metaData.context`, `acknowledgement.profile.tokenNumber` and `acknowledgement.profile.expiry` present, and `response.requestId` equal to the share's `REQUEST-ID`. Paste the body you sent.
3. Human: the PHR app shows the token number you sent. The set says the token is valid for 60 minutes.

Screen check: your system registered the person from the shared details with nothing typed. A new beneficiary id holds the ABHA number, ABHA address, name, gender, date of birth, mobile and address as `profile.patient` carried them. Evidence: the stored record for this run.

Nudge: answer the inbound share with 200 first. Register the person and send the on-share after that.

#### SHARE_PATIENT_PROFILE_702, a returning patient is matched. `sandbox`, `human` and `screen`

Runs after SHARE_PATIENT_PROFILE_701, with the same person. Each step below is a fresh scan: the person scans, taps "Get Token" and taps "I Agree". Stop for each. Every scan must show observations 1 and 2 of SHARE_PATIENT_PROFILE_701, pasted, for the QR code scanned in that step.

Your system matches on name, mobile, gender, ABHA number and ABHA address. A person with no match is a new registration, which SHARE_PATIENT_PROFILE_701 already observed.

Exit condition: four steps, each with its share and on-share pasted and its screen check attested.

1. A revisit. Close the queue entry from SHARE_PATIENT_PROFILE_701 in your system, then the person scans the same QR code with the same ABHA address. The share carries the same `profile.patient.abhaNumber` and `profile.patient.abhaAddress`. Screen: your system reuses the beneficiary id from SHARE_PATIENT_PROFILE_701, creates the care context under it, and still holds one row for the person.
2. Another ABHA address. The person scans with their second ABHA address. The share carries the same `profile.patient.abhaNumber` and a different `profile.patient.abhaAddress`. Your on-share carries the new address in `acknowledgement.abhaAddress`. Screen: your system updates the ABHA address on the existing beneficiary id and creates no new one. Evidence: the record before and after, one row.
3. A repeat scan while a queue entry is active. Straight after step 2, the person scans the same QR code with the same ABHA address as step 2. The share carries the same `metaData.context`. Screen: your system creates no new queue entry, and the existing queue association is unchanged. A new token number is issued only if your queue rules issue one. Evidence: the queue for that counter before and after, with one entry for the person.
4. A different counter. The person scans the second QR code. The share carries a `metaData.context` different from step 3, and your on-share carries that context in `acknowledgement.profile.context` with an `acknowledgement.profile.tokenNumber` for that queue. Screen: your system creates a new queue entry on that counter, with the same beneficiary id and patient details. Evidence: both queues.
