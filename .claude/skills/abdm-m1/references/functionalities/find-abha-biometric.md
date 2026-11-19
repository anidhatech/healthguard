# Find ABHA by mobile with fingerprint or iris

Sheet group: Find ABHA (Biometrics - Fingerprint/Iris).

Functionality 13 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Find ABHA by mobile with fingerprint or iris holds no mandatory case |
| Scaffold | Calls | Every call in `m1-find-abha-fingerprint`, `m1-find-abha-iris` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Find ABHA by mobile with fingerprint or iris works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Find ABHA by mobile with fingerprint or iris succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_601`, `VRFY_ABHA_602`, `VRFY_ABHA_603`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Find ABHA by mobile with fingerprint or iris |

Loop limit: 3 passes through Test for Find ABHA by mobile with fingerprint or iris. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_601`, `VRFY_ABHA_602`, `VRFY_ABHA_603`.
An integration that already exists enters Find ABHA by mobile with fingerprint or iris at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_601 | optional | optional | ABHA Retrieval Using Communication Mobile OTP |
| VRFY_ABHA_602 | optional | optional | ABHA Retrieval – No ABHA Linked to Communication Mobile Number |
| VRFY_ABHA_603 | optional | optional | ABHA Details Exist for Communication Mobile Number |

### VRFY_ABHA_601: ABHA Retrieval Using Communication Mobile OTP

The system must validate the communication mobile number during ABHA retrieval and display an appropriate error message for invalid input.

**Steps**

- 1\. User enters an invalid communication mobile number (e.g., incorrect format, less than 10 digits, or non-numeric characters).
- 2\. User attempts to proceed with the biometric verification.

**Expected Result**

- 1\. The system should validate the input and display the following error message:
- "Please enter a valid mobile number."
- 2\. Biometric verification failed.

### VRFY_ABHA_602: ABHA Retrieval – No ABHA Linked to Communication Mobile Number

The system must handle scenarios where no ABHA details are found for the entered communication mobile number and should provide users with an option to create a new ABHA.

**Steps**

- 1\. User enters a communication mobile number that is not linked to any ABHA profile in the ABHA system.

**Expected Result**

- 1\. The system displays the following error message:
- "ABHA details not found. We did not find any ABHA number linked to this mobile number. Please use an ABHA-linked mobile number."
- 2\. The system should also present the option to create a new ABHA for the user.

### VRFY_ABHA_603: ABHA Details Exist for Communication Mobile Number

The system must handle scenarios where ABHA details are found for the entered communication mobile number and allow linking or registering based on presence in the HMIS system.

**Steps**

- 1\. User enters a communication mobile number.
- 2\. The system checks if ABHA profiles are linked to this number in the ABHA system.
- 3\. If ABHA profiles are found: Display list of all available ABHA profiles.
- 4\. Select any profile for which user wants to see the profile.
- 5\. Proceed with biometric verification for that profile.
- 6\. Upon biometric verification: ABHA profile of selected user will be visible along with all details like name, age, gender, mobile number, ABHA number, ABHA address, state, district.
- 7\. If the profile is already linked in the HMIS system: Show message: "This ABHA profile is already linked to HMIS Beneficiary ID."
- 8\. If the profile is not linked: Allow the user to register and link the ABHA profile with the HMIS Beneficiary ID.
- 9\. Allow the beneficiary to download their ABHA card.

**Expected Result**

- 1\. ABHA details are successfully fetched, validated, and displayed.
- 2\. Based on presence in HMIS: Either linkage is confirmed, or the system allows new registration/linking as per business rules.
- 3\. Option to download the ABHA card is provided where applicable.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

## Screen requirements

### In plain words

The same search as finding an ABHA by mobile, verified with a biometric
device instead of an OTP.

### What happens

| Requirement | Cases |
|---|---|
| An invalid mobile shows "Please enter a valid mobile number." and goes no further | VRFY_ABHA_601 |
| A mobile with no ABHA shows the not found message from find-abha-mobile and offers to create an ABHA | VRFY_ABHA_602 |
| List every ABHA on the mobile, verify the chosen one by biometric, then show its profile | VRFY_ABHA_603 |
| Already linked in your records: show "This ABHA profile is already linked to HMIS Beneficiary ID." Not linked: let the person register and link it | VRFY_ABHA_603 |
| Offer the ABHA card download where the ABHA is KYC verified | VRFY_ABHA_603 |

### How you know it worked

The chosen profile opens after the biometric, and ends either linked or
registered.

From `hiecm.concept.m1-screens-find-abha-biometric`.

## Calls

### Find ABHA, Fingerprint (`m1-find-abha-fingerprint`)

**Act: the calls in this journey, in order**

#### 1. Search ABHA by mobile (`m1_post_v3_profile_account_abha_search_find_abha_fingerprint`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/abha/search \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "search-abha"
  ],
  "mobile": "{{rsaMobileEncryptionOutput}}"
}'
```

#### 2. Find ABHA via Fingerprint - send authentication request (`m1_post_v3_profile_login_request_otp_find_abha_fingerprint`)

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
    "search-abha",
    "aadhaar-bio-verify"
  ],
  "loginHint": "index",
  "loginId": "{{rsaIndexEncryptionOutput}}",
  "otpSystem": "aadhaar",
  "txnId": "{{searchTxnId}}"
}'
```

#### 3. Find ABHA via Fingerprint - verify (`m1_post_v3_profile_login_verify_find_abha_fingerprint`)

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
      "fingerPrintAuthPid": "{{fingerPrintAuthPid}}"
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

### Find ABHA, IRIS (`m1-find-abha-iris`)

**Act: the calls in this journey, in order**

#### 1. Search ABHA by mobile (`m1_post_v3_profile_account_abha_search_find_abha_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/abha/search \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "search-abha"
  ],
  "mobile": "{{rsaMobileEncryptionOutput}}"
}'
```

#### 2. Find ABHA via IRIS - send authentication request (`m1_post_v3_profile_login_request_otp_find_abha_iris`)

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
    "search-abha",
    "aadhaar-iris-verify"
  ],
  "loginHint": "index",
  "loginId": "{{rsaIndexEncryptionOutput}}",
  "otpSystem": "aadhaar",
  "txnId": "{{searchTxnId}}"
}'
```

#### 3. Find ABHA via IRIS - verify (`m1_post_v3_profile_login_verify_find_abha_iris`)

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
| VRFY_ABHA_601 | Mobile number entry | None |
| VRFY_ABHA_602 | ABHA profile list, none found | `m1_post_v3_profile_account_abha_search_find_abha_fingerprint`, `m1_post_v3_profile_account_abha_search_find_abha_iris` |
| VRFY_ABHA_603 | ABHA profile list, biometric verify, profile | `m1_post_v3_profile_account_abha_search_find_abha_fingerprint`, `m1_post_v3_profile_login_request_otp_find_abha_fingerprint`, `m1_post_v3_profile_login_verify_find_abha_fingerprint`, `m1_post_v3_profile_account_abha_search_find_abha_iris`, `m1_post_v3_profile_login_request_otp_find_abha_iris`, `m1_post_v3_profile_login_verify_find_abha_iris` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_profile_account_abha_search_find_abha_fingerprint` | `POST /abha/api/v3/profile/account/abha/search` | Search ABHA by mobile |
| `m1_post_v3_profile_login_request_otp_find_abha_fingerprint` | `POST /abha/api/v3/profile/login/request/otp` | Find ABHA via Fingerprint - send authentication request |
| `m1_post_v3_profile_login_verify_find_abha_fingerprint` | `POST /abha/api/v3/profile/login/verify` | Find ABHA via Fingerprint - verify |
| `m1_post_v3_profile_account_abha_search_find_abha_iris` | `POST /abha/api/v3/profile/account/abha/search` | Search ABHA by mobile |
| `m1_post_v3_profile_login_request_otp_find_abha_iris` | `POST /abha/api/v3/profile/login/request/otp` | Find ABHA via IRIS - send authentication request |
| `m1_post_v3_profile_login_verify_find_abha_iris` | `POST /abha/api/v3/profile/login/verify` | Find ABHA via IRIS - verify |

Headers the calls of Find ABHA by mobile with fingerprint or iris take: `REQUEST-ID`, `TIMESTAMP`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_profile_login_request_otp_find_abha_fingerprint` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_fingerprint` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_fingerprint` | 404 | `ABDM-1114` | User not found. |
| `m1_post_v3_profile_login_request_otp_find_abha_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_iris` | 404 | `ABDM-1114` | User not found. |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_601 | nothing | none |
| VRFY_ABHA_602 | `mobile-without-abha` | none |
| VRFY_ABHA_603 | `aadhaar-holder`, `biometric-device` | none |

### VRFY_ABHA_601 to 603: find an ABHA by the communication mobile and a biometric

The set names `/abha/api/v3/profile/account/abha/search`, `/abha/api/v3/profile/login/request/otp` and a verify path on the production host. Run the sandbox operations of the published find by fingerprint flow instead: `m1_post_v3_profile_account_abha_search_find_abha_fingerprint`, `m1_post_v3_profile_login_request_otp_find_abha_fingerprint` and `m1_post_v3_profile_login_verify_find_abha_fingerprint`. For iris, `m1_post_v3_profile_account_abha_search_find_abha_iris`, `m1_post_v3_profile_login_request_otp_find_abha_iris` and `m1_post_v3_profile_login_verify_find_abha_iris`. `hiecm.flow.m1-find-abha`

Without a registered fingerprint or iris device, the cases that scan and that you claim are `needs-human`, naming the device, after it was asked for at readiness and again at the case, and the tester said they cannot provide it in this run. A case you do not claim is `not-run`.

Loop limit: 3 passes per test case.

#### VRFY_ABHA_601, an invalid mobile is refused. `screen`

As VRFY_ABHA_301. No biometric step starts.

#### VRFY_ABHA_602, no ABHA on this mobile. `sandbox`

As VRFY_ABHA_303, with the search operation of the flow you ran.

#### VRFY_ABHA_603, the chosen ABHA is verified by biometric. `sandbox`, `human`

The search lists the accounts as in VRFY_ABHA_302, the person picks one, the request call returns 200 with a `txnId`, and the person scans.

Exit condition: the verify returns 200 with `authResult` `success` and `accounts` holding the chosen `ABHANumber`. Screen checks: the profile is shown with name, age, gender, mobile, ABHA number, ABHA address, state and district; an account already linked in your system says so, as in VRFY_ABHA_308, and one not yet linked can be registered and linked; the card can be downloaded as in CRT_ABHA_114 where the account is KYC verified.
