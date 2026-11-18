# Log in with Aadhaar by fingerprint or iris

Sheet group: Login Via Aadhaar (Biometrics).

Functionality 14 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Log in with Aadhaar by fingerprint or iris holds no mandatory case |
| Scaffold | Calls | Every call in `m1-login-biometric-v3-fingerprint`, `m1-login-biometric-v3-iris` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Log in with Aadhaar by fingerprint or iris works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Log in with Aadhaar by fingerprint or iris succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_801`, `VRFY_ABHA_802`, `VRFY_ABHA_803`, `VRFY_ABHA_804`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Log in with Aadhaar by fingerprint or iris |

Loop limit: 3 passes through Test for Log in with Aadhaar by fingerprint or iris. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_801`, `VRFY_ABHA_802`, `VRFY_ABHA_803`, `VRFY_ABHA_804`.
An integration that already exists enters Log in with Aadhaar by fingerprint or iris at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_801 | optional | optional | Fetch ABHA Details Using Aadhaar Number |
| VRFY_ABHA_802 | optional | optional | Biometric based Aadhaar Authentication |
| VRFY_ABHA_803 | optional | optional | ABHA Details Not Found for Aadhaar Number |
| VRFY_ABHA_804 | optional | optional | ABHA Details Exist for Aadhaar Number |

### VRFY_ABHA_801: Fetch ABHA Details Using Aadhaar Number

The system must allow retrieval of ABHA details using a valid Aadhaar number.

**Steps**

- 1\.If the user enters wrong Aadhaar Number then system will display an error message "Invalid LoginId" or some relevant message i.e "Aadhaar Number is not valid".

**Expected Result**

- Display a relevant error message.

**For the tester**

- 1\. It is recommended that Aadhar number should be in masked format.
- 2\. Consent language should be updated : https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=consentLanguage

### VRFY_ABHA_802: Biometric based Aadhaar Authentication

System must verify the biometrics (fingerprint or iris) of the user

**Steps**

- 1\. Scan biometrics (Fingerprint/Iris)
- 2\. Click on verify button

**Expected Result**

- 1\. System authenticates the user's Aadhaar through user's biometrics.
- 2\. In case of incorrect biometrices, the system displays an error as per API response.
- 3\. In case of correct biometrices, the system allows the user to proceed.

### VRFY_ABHA_803: ABHA Details Not Found for Aadhaar Number

No ABHA is linked with the given Aadhaar number.

**Steps**

- 1\. Beneficary enter Aadhaar Number .
- 2\. Beneficary verifies biometrics
- 3\. After biometric verfication if ABHA details are not present then system will display "NO ABHA user registered with this Aadhaar Number".
- 4\. System should redirects the user to proceed with ABHA creation.

**Expected Result**

- 1\.Display a relevant error message if no ABHA exists.
- 2\.Provide the option to create a new ABHA.

### VRFY_ABHA_804: ABHA Details Exist for Aadhaar Number

ABHA number is already linked with the Aadhaar number.

**Steps**

- 1\. Enter Aadhaar Number.
- 2\. Beneficary verifies biometrics
- 3\. After biometric verfication. If ABHA Number exists then system will display Beneficary ABHA profile details and user can download the ABHA card.
- 4\. If ABHA Profile is not present in HMIS, the system will allow it to be Register and linked in their HMIS beneficary's ID or proceed as per bussiness requirement .

**Expected Result**

- 1\.Display ABHA profile details.
- 2\.Allow download of ABHA card.
- 3\.Option to register and link ABHA in HMIS or proceed as required.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

## Screen requirements

### In plain words

The same two outcomes as login with Aadhaar OTP, reached by a biometric scan.

### What happens

| Requirement | Cases |
|---|---|
| The Aadhaar field follows create-abha-aadhaar-otp | VRFY_ABHA_801 |
| A failed scan shows the API's error, and a good one lets the person through | VRFY_ABHA_802 |
| No ABHA on the Aadhaar and an ABHA on it end on the screens login-aadhaar-otp names | VRFY_ABHA_803, VRFY_ABHA_804 |

### How you know it worked

Both outcomes end on a screen that offers the next step.

From `hiecm.concept.m1-screens-login-aadhaar-biometric`.

## Calls

### Login, Biometric v3 (Fingerprint) (`m1-login-biometric-v3-fingerprint`)

**Act: the calls in this journey, in order**

#### 1. Login via Biometric (Fingerprint) - send authentication request (`m1_post_v3_profile_login_request_otp_biometric_fingerprint`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/login/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-login",
    "aadhaar-bio-verify"
  ],
  "loginHint": "abha-number",
  "loginId": "{{encrypted abha-number}}",
  "otpSystem": "aadhaar"
}'
```

#### 2. Login via Biometric (Fingerprint) - verify (`m1_post_v3_profile_login_verify_biometric_fingerprint`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/login/verify \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-login",
    "aadhaar-bio-verify"
  ],
  "authData": {
    "authMethods": [
      "bio"
    ],
    "bio": {
      "txnId": "{{txnId}}",
      "fingerPrintAuthPid": "{{PID}}"
    }
  }
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "fe1c527e-1ab8-40c4-84d2-9eedb3378d39",
  "authResult": "success",
  "message": "BIO verified successfully",
  "token": "<TOKEN>",
  "expiresIn": 1800,
  "refreshToken": "<TOKEN>",
  "refreshExpiresIn": 1296000,
  "accounts": [
    {
      "ABHANumber": "<ABHA_NUMBER>",
      "preferredAbhaAddress": "<ABHA_ADDRESS>",
      "name": "<NAME>",
      "status": "ACTIVE",
      "profilePhoto": "<BASE64_PHOTO>"
    }
  ]
}
```

### Login, Biometric v3 (Iris) (`m1-login-biometric-v3-iris`)

**Act: the calls in this journey, in order**

#### 1. Login via Biometric (Iris) - send authentication request (`m1_post_v3_profile_login_request_otp_biometric_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/login/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-login",
    "aadhaar-iris-verify"
  ],
  "loginHint": "abha-number",
  "loginId": "{{encrypted abha-number}}",
  "otpSystem": "aadhaar"
}'
```

#### 2. Login via Biometric (Iris) - verify (`m1_post_v3_profile_login_verify_biometric_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/login/verify \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-login",
    "aadhaar-iris-verify"
  ],
  "authData": {
    "authMethods": [
      "iris"
    ],
    "iris": {
      "txnId": "{{txnId}}",
      "irisAuthPid": "{{PID}}"
    }
  }
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "a2s9f59d-dfba-4261-8ea2-16541cfd6f2a",
  "authResult": "success",
  "message": "IRIS verified successfully",
  "token": "<TOKEN>",
  "expiresIn": 1800,
  "refreshToken": "<TOKEN>",
  "refreshExpiresIn": 1296000,
  "accounts": [
    {
      "ABHANumber": "<ABHA_NUMBER>",
      "preferredAbhaAddress": "<ABHA_ADDRESS>",
      "name": "<NAME>",
      "status": "ACTIVE",
      "profilePhoto": "<BASE64_PHOTO>"
    }
  ]
}
```

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| VRFY_ABHA_801 | Aadhaar number entry | `m1_post_v3_profile_login_request_otp_biometric_fingerprint`, `m1_post_v3_profile_login_request_otp_biometric_iris` |
| VRFY_ABHA_802 | Biometric capture and verify | `m1_post_v3_profile_login_request_otp_biometric_fingerprint`, `m1_post_v3_profile_login_verify_biometric_fingerprint`, `m1_post_v3_profile_login_request_otp_biometric_iris`, `m1_post_v3_profile_login_verify_biometric_iris` |
| VRFY_ABHA_803 | No ABHA found, offer to create | `m1_post_v3_profile_login_request_otp_biometric_fingerprint`, `m1_post_v3_profile_login_verify_biometric_fingerprint`, `m1_post_v3_profile_login_request_otp_biometric_iris`, `m1_post_v3_profile_login_verify_biometric_iris` |
| VRFY_ABHA_804 | ABHA profile and card, then registration | `m1_post_v3_profile_login_request_otp_biometric_fingerprint`, `m1_post_v3_profile_login_verify_biometric_fingerprint`, `m1_post_v3_profile_login_request_otp_biometric_iris`, `m1_post_v3_profile_login_verify_biometric_iris` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_profile_login_request_otp_biometric_fingerprint` | `POST /abha/api/v3/profile/login/request/otp` | Login via Biometric (Fingerprint) - send authentication request |
| `m1_post_v3_profile_login_verify_biometric_fingerprint` | `POST /abha/api/v3/profile/login/verify` | Login via Biometric (Fingerprint) - verify |
| `m1_post_v3_profile_login_request_otp_biometric_iris` | `POST /abha/api/v3/profile/login/request/otp` | Login via Biometric (Iris) - send authentication request |
| `m1_post_v3_profile_login_verify_biometric_iris` | `POST /abha/api/v3/profile/login/verify` | Login via Biometric (Iris) - verify |

Headers the calls of Log in with Aadhaar by fingerprint or iris take: `REQUEST-ID`, `TIMESTAMP`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_profile_login_request_otp_biometric_fingerprint` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_biometric_fingerprint` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_biometric_fingerprint` | 404 | `ABDM-1114` | User not found. |
| `m1_post_v3_profile_login_request_otp_biometric_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_biometric_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_biometric_iris` | 404 | `ABDM-1114` | User not found. |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_801 | nothing | none |
| VRFY_ABHA_802 | `aadhaar-holder`, `biometric-device` | none |
| VRFY_ABHA_803 | `aadhaar-without-abha`, `biometric-device` | none |
| VRFY_ABHA_804 | `aadhaar-holder`, `biometric-device` | none |

### VRFY_ABHA_801 to 804: log in with an Aadhaar number and a biometric

The set names `/abha/api/v3/profile/login/request/otp` and `/abha/api/v3/profile/login/verify`. In the published specification the fingerprint use of those two paths takes an ABHA number, not an Aadhaar number. The login that takes an encrypted Aadhaar number with a biometric is `m1_post_v3_1_profile_login_verify_fingerprint`, or `m1_post_v3_1_profile_login_verify_iris`, one call each. Run that, and say in the run log that it is the v3.1 call.

A claimed case that scans waits on a registered fingerprint or iris device. With none present after both asks, and the tester unable to provide one in this run, it is `needs-human`, naming the device. An unclaimed case is `not-run`.

Loop limit: 3 passes per test case.

#### VRFY_ABHA_801, an invalid Aadhaar is refused. `screen`

As VRFY_ABHA_401.

#### VRFY_ABHA_802, the biometric is verified, and a failed scan is refused. `sandbox`, `human`

Exit condition: the v3.1 call returns 200 with `authResult` `success` and `token`. A failed scan is refused with the error the API returned; your screen shows it and lets the person scan again. Paste what the sandbox returned.

#### VRFY_ABHA_803, no ABHA on this Aadhaar. `sandbox`, `human`

Exit condition: the v3.1 call returns 404 with `error.code` `ABDM-1114`. Your screen says no ABHA user is registered with this Aadhaar number and offers creation, as in VRFY_ABHA_403.

#### VRFY_ABHA_804, an ABHA exists on this Aadhaar. `sandbox`, `human`

As VRFY_ABHA_404, with the v3.1 call in place of the OTP verify: 200 with `accounts[0].ABHANumber`, then `m1_get_v3_profile_account` with the returned `token` as `X-token`, 200 with the same number.
