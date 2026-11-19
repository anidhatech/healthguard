# Find ABHA by mobile with face authentication

Sheet group: Login Via Mobile: Find ABHA via Face Auth.

Functionality 11 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Find ABHA by mobile with face authentication holds no mandatory case |
| Scaffold | Calls | Every call in `m1-find-abha-face` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Find ABHA by mobile with face authentication works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Find ABHA by mobile with face authentication succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_301_FA`, `VRFY_ABHA_302_FA`, `VRFY_ABHA_303_FA`, `VRFY_ABHA_304_FA`, `VRFY_ABHA_305_FA`, `VRFY_ABHA_306_FA`, `VRFY_ABHA_307_FA`, `VRFY_ABHA_308_FA`, `VRFY_ABHA_309_FA`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Find ABHA by mobile with face authentication |

Loop limit: 3 passes through Test for Find ABHA by mobile with face authentication. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_301_FA`, `VRFY_ABHA_302_FA`, `VRFY_ABHA_303_FA`, `VRFY_ABHA_304_FA`, `VRFY_ABHA_305_FA`, `VRFY_ABHA_306_FA`, `VRFY_ABHA_307_FA`, `VRFY_ABHA_308_FA`, `VRFY_ABHA_309_FA`.
An integration that already exists enters Find ABHA by mobile with face authentication at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_301_FA | optional | optional | Validate Communication Mobile Number Input |
| VRFY_ABHA_302_FA | optional | optional | Fetch Associated ABHA Profiles Using Communication Mobile Number |
| VRFY_ABHA_303_FA | optional | optional | No ABHA Profile Linked with Communication Mobile Number |
| VRFY_ABHA_304_FA | optional | optional | Select Required ABHA Profile and Generate Face Auth QR Code |
| VRFY_ABHA_305_FA | optional | optional | Scan Face Authentication QR Code using ABHA App |
| VRFY_ABHA_306_FA | optional | optional | Redirect for ABHA Face RD App Installation |
| VRFY_ABHA_307_FA | optional | optional | Successful Face Authentication through ABHA Face RD App |
| VRFY_ABHA_308_FA | optional | optional | Fetch Selected ABHA Profile Details after Successful Face Authentication |
| VRFY_ABHA_309_FA | optional | optional | Face Authentication Failure / PID Error Handling |

### VRFY_ABHA_301_FA: Validate Communication Mobile Number Input

The system must validate the communication mobile number before initiating ABHA retrieval through Face Authentication.

**Steps**

- 1\. Enter an invalid communication mobile number, such as less than 10 digits, more than 10 digits, alphabetic characters, special characters, or blank input.
- 2\. Click on Proceed / Search as applicable.

**Expected Result**

- 1\. The system should not proceed with ABHA profile search.
- 2\. The system should display: "Please enter a valid mobile number."
- 3\. No ABHA profile search or Face Auth QR generation should be initiated for invalid mobile numbers.

### VRFY_ABHA_302_FA: Fetch Associated ABHA Profiles Using Communication Mobile Number

The system must fetch and display all ABHA profiles associated with the entered communication mobile number before Face Authentication.

**Steps**

- 1\. Enter a valid communication mobile number.
- 2\. Click on Search / Proceed.
- 3\. System checks ABHA profiles linked with the entered mobile number.

**Expected Result**

- 1\. The system should display the list of all ABHA profiles associated with the entered mobile number.
- 2\. The profile list should show sufficient details to identify the correct ABHA profile, such as masked ABHA number / ABHA address / name as available from API.
- 3\. Face Authentication QR Code should not be generated before the patient selects the required ABHA profile.

### VRFY_ABHA_303_FA: No ABHA Profile Linked with Communication Mobile Number

The system must handle the scenario where no ABHA profile is linked with the entered communication mobile number.

**Steps**

- 1\. Enter a valid communication mobile number that is not linked with any ABHA profile.
- 2\. Click on Search / Proceed.

**Expected Result**

- 1\. The system should display: "ABHA details not found. We did not find any ABHA number linked to this mobile number. Please use an ABHA-linked mobile number."
- 2\. The system should provide an option to create a new ABHA, if supported as per business flow.
- 3\. No Face Authentication QR Code should be generated for retrieval.

### VRFY_ABHA_304_FA: Select Required ABHA Profile and Generate Face Auth QR Code

The system must allow the patient to select the required ABHA profile from the displayed profile list and generate a Face Authentication QR Code.

**Steps**

- 1\. From the displayed ABHA profile list, select the required ABHA profile.
- 2\. Click on Proceed using Face Authentication / Face Auth.
- 3\. System generates a Face Authentication QR Code on the HIP / HMIS screen.

**Expected Result**

- 1\. QR Code should be generated successfully by HIP / HMIS.
- 2\. QR Code should be displayed clearly on the HMIS screen for scanning.
- 3\. The selected ABHA profile context should be retained until authentication is completed.

### VRFY_ABHA_305_FA: Scan Face Authentication QR Code using ABHA App

The system must allow the patient to scan the Face Authentication QR Code using the ABHA App scanner available on the landing page.

**Steps**

- 1\. Open ABHA App on the patient mobile device.
- 2\. Ensure ABHA App is logged out.
- 3\. On the ABHA App landing page, tap the scanner icon available on the top-left side.
- 4\. Scan the QR Code displayed on the HMIS / HIP screen.

**Expected Result**

- 1\. QR Code should be scanned successfully using the ABHA App scanner.
- 2\. ABHA App should initiate the Face Authentication flow.
- 3\. Patient should be redirected to ABHA Face RD application for face capture/authentication.

### VRFY_ABHA_306_FA: Redirect for ABHA Face RD App Installation

The system must handle the scenario where ABHA Face RD application is not installed on the patient mobile device.

**Steps**

- 1\. Scan Face Authentication QR Code using ABHA App.
- 2\. Ensure ABHA Face RD application is not installed on the mobile device.
- 3\. Proceed with Face Authentication redirection.

**Expected Result**

- 1\. Patient should be redirected to Play Store / App Store for ABHA Face RD application installation.
- 2\. Patient should be able to download and install the ABHA Face RD application.
- 3\. After installation, patient should be able to continue or restart the Face Authentication flow as per app behavior.

### VRFY_ABHA_307_FA: Successful Face Authentication through ABHA Face RD App

The system must verify the beneficiary using Face Authentication through ABHA Face RD application after QR Code scanning.

**Steps**

- 1\. Scan the Face Authentication QR Code using ABHA App.
- 2\. ABHA Face RD application opens.
- 3\. Patient captures face using the device camera.
- 4\. Submit face authentication request.

**Expected Result**

- 1\. Face Authentication should be completed successfully.
- 2\. Successful authentication confirmation should be shown on the patient mobile device.
- 3\. Authentication success status should be received by HMIS / HIP.
- 4\. The selected ABHA profile should be validated successfully.

### VRFY_ABHA_308_FA: Fetch Selected ABHA Profile Details after Successful Face Authentication

The system must fetch and display the selected ABHA profile details after successful Face Authentication.

**Steps**

- 1\. Complete Face Authentication successfully through ABHA Face RD application.
- 2\. Wait for HMIS / HIP to receive authentication success status.
- 3\. System fetches the selected ABHA profile details.

**Expected Result**

- 1\. The selected patient ABHA profile should open.
- 2\. The system should fetch and display profile details such as name, date of birth / age, gender, mobile number, ABHA number, ABHA address, state, district, photo and address, as available from APIs.
- 3\. The system should not display details of any non-selected ABHA profile.

### VRFY_ABHA_309_FA: Face Authentication Failure / PID Error Handling

The system must handle unsuccessful Face Authentication attempts and display the PID error code/message returned as per API response.

**Steps**

- 1\. Scan Face Authentication QR Code.
- 2\. Open ABHA Face RD application.
- 3\. Perform face scan with unsuccessful authentication scenario, such as incorrect face, poor capture quality, camera issue, timeout, or authentication failure.
- 4\. Submit authentication request.

**Expected Result**

- 1\. Face Authentication should fail.
- 2\. ABHA profile details should not be fetched or auto-populated.
- 3\. HMIS should display the PID error code and error message returned by the API.
- 4\. User should be allowed to retry authentication or regenerate QR Code as per implementation/business rules.

## Screen requirements

### In plain words

The same search as finding an ABHA by mobile, with face authentication in
place of the OTP.

### What happens

| Requirement | Cases |
|---|---|
| The mobile check and the list follow find-abha-mobile, and an invalid mobile starts neither a search nor a QR code | VRFY_ABHA_301_FA, VRFY_ABHA_302_FA |
| No face authentication QR code before a profile is chosen | VRFY_ABHA_302_FA |
| A mobile with no ABHA shows the not found message from find-abha-mobile, offers creation, and generates no QR code | VRFY_ABHA_303_FA |
| Choosing a profile generates the QR code for that profile, and the choice holds until authentication completes | VRFY_ABHA_304_FA |
| After success, open the chosen profile only | VRFY_ABHA_307_FA, VRFY_ABHA_308_FA |
| A failure shows the PID error from the API, fills nothing, and allows a retry or a new QR code | VRFY_ABHA_309_FA |
| The scan and the ABHA Face RD install for a chosen profile happen in the ABHA app on the patient's phone, judged on the case text there; your screen shows the QR code for the chosen profile | VRFY_ABHA_305_FA, VRFY_ABHA_306_FA |

### How you know it worked

The QR code follows the choice of profile, and the profile that opens is the
one chosen.

From `hiecm.concept.m1-screens-find-abha-face-auth`.

## Calls

### Find ABHA, Face (`m1-find-abha-face`)

**Act: the calls in this journey, in order**

#### 1. Search ABHA by mobile (`m1_post_v3_profile_account_abha_search_find_abha_face`)

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

#### 2. Find ABHA via Face - send authentication request (`m1_post_v3_profile_login_request_otp_find_abha_face`)

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
    "face-auth"
  ],
  "loginHint": "index",
  "loginId": "{{rsaIndexEncryptionOutput}}",
  "otpSystem": "aadhaar",
  "txnId": "{{searchTxnId}}"
}'
```

#### 3. Face auth - capture PID / track status (`m1_post_v3_enrollment_enrol_capturepid_find_abha_face`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/capturePID \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-enrol",
    "face-verify"
  ],
  "txnId": "ea1dc7aa-d7c3-40ab-bee8-84c6f1eb90fa"
}'
```

#### 4. Find ABHA via Face - verify (`m1_post_v3_profile_login_verify_find_abha_face`)

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
    "aadhaar-face-verify"
  ],
  "authData": {
    "authMethods": [
      "face_auth"
    ],
    "face": {
      "txnId": "{{txnId}}"
    }
  }
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "d17cb533-9bfa-40f5-a7bc-b84143516787",
  "authResult": "success",
  "message": "Aadhaar Face Authentication Success",
  "token": "<TOKEN>...",
  "expiresIn": 1800,
  "refreshToken": "<TOKEN>...",
  "refreshExpiresIn": 1296000,
  "accounts": [
    {
      "ABHANumber": "<ABHA_NUMBER>",
      "preferredAbhaAddress": "<ABHA_ADDRESS>",
      "name": "<NAME>",
      "status": "ACTIVE",
      "profilePhoto": "{{base64 profile photo}}",
      "mobileVerified": false
    }
  ]
}
```

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| VRFY_ABHA_301_FA | Mobile number entry | None |
| VRFY_ABHA_302_FA | ABHA profile list | `m1_post_v3_profile_account_abha_search_find_abha_face` |
| VRFY_ABHA_303_FA | ABHA profile list, none found | `m1_post_v3_profile_account_abha_search_find_abha_face` |
| VRFY_ABHA_304_FA | Face authentication QR code for the selected profile | `m1_post_v3_profile_login_request_otp_find_abha_face` |
| VRFY_ABHA_305_FA | ABHA app scanner | None |
| VRFY_ABHA_306_FA | ABHA app, Face RD install redirect | None |
| VRFY_ABHA_307_FA | Face authentication status | `m1_post_v3_enrollment_enrol_capturepid_find_abha_face` |
| VRFY_ABHA_308_FA | Selected ABHA profile | `m1_post_v3_profile_login_verify_find_abha_face` |
| VRFY_ABHA_309_FA | Face authentication failure, PID error | `m1_post_v3_enrollment_enrol_capturepid_find_abha_face`, `m1_post_v3_profile_login_verify_find_abha_face` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_profile_account_abha_search_find_abha_face` | `POST /abha/api/v3/profile/account/abha/search` | Search ABHA by mobile |
| `m1_post_v3_profile_login_request_otp_find_abha_face` | `POST /abha/api/v3/profile/login/request/otp` | Find ABHA via Face - send authentication request |
| `m1_post_v3_enrollment_enrol_capturepid_find_abha_face` | `POST /abha/api/v3/enrollment/enrol/capturePID` | Face auth - capture PID / track status |
| `m1_post_v3_profile_login_verify_find_abha_face` | `POST /abha/api/v3/profile/login/verify` | Find ABHA via Face - verify |

Headers the calls of Find ABHA by mobile with face authentication take: `REQUEST-ID`, `TIMESTAMP`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_profile_login_request_otp_find_abha_face` | 401 | `ABDM-1224` | Login via Biometric is not allowed. |
| `m1_post_v3_enrollment_enrol_capturepid_find_abha_face` | 400 | `ABDM-1017` | Invalid transaction, either the transaction is expired or not found |
| `m1_post_v3_enrollment_enrol_capturepid_find_abha_face` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_face` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_face` | 404 | `404` | Runtime Error |
| `m1_post_v3_profile_login_verify_find_abha_face` | 422 | `ABDM-1204` | UIDAI Error code : 563 : Duplicate request (this error occur... |
| `m1_post_v3_profile_login_verify_find_abha_face` | 422 | `ABDM-1204` | UIDAI Error code : 561 : Request expired (“Pid->ts” value is... |
| `m1_post_v3_profile_login_verify_find_abha_face` | 422 | `ABDM-1204` | UIDAI Error code : 810 : Missing biometric data as specified in “Uses” |
| `m1_post_v3_profile_login_verify_find_abha_face` | 422 | `ABDM-1204` | UIDAI Error code : 300 : Biometric data did not match. |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_301_FA | nothing | none |
| VRFY_ABHA_302_FA | `aadhaar-holder` | none |
| VRFY_ABHA_303_FA | `mobile-without-abha` | none |
| VRFY_ABHA_304_FA | `aadhaar-holder` | none |
| VRFY_ABHA_305_FA | `aadhaar-holder`, `abha-app` | none |
| VRFY_ABHA_306_FA | `abha-app`, `face-device` | none |
| VRFY_ABHA_307_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| VRFY_ABHA_308_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| VRFY_ABHA_309_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |

### VRFY_ABHA_301_FA to 309_FA: find an ABHA by the communication mobile and face authentication

The set lists no API for this group. ABDM publishes the find by face flow: `m1_post_v3_profile_account_abha_search_find_abha_face`, `m1_post_v3_profile_login_request_otp_find_abha_face` with the chosen account's `index` and the search `txnId`, `m1_post_v3_enrollment_enrol_capturepid_find_abha_face` polled every 5 to 10 seconds, then `m1_post_v3_profile_login_verify_find_abha_face`. `hiecm.flow.m1-find-abha`

Face authentication is a `human` step on a device, as in CRT_ABHA_101_FA to 117_FA. Without a phone with the ABHA app and the person, record every case from VRFY_ABHA_305_FA on that you claim as `needs-human`, naming what was asked, after it was asked for at readiness and again at the case, and the tester said they cannot provide it in this run. A case you do not claim is `not-run`.

Loop limit: 3 passes per test case.

#### VRFY_ABHA_301_FA, an invalid mobile is refused. `screen`

As VRFY_ABHA_301. No search and no QR code follow an invalid mobile.

#### VRFY_ABHA_302_FA, every ABHA on this mobile is listed. `sandbox` and `screen`

As VRFY_ABHA_302, with `m1_post_v3_profile_account_abha_search_find_abha_face`. No QR code is generated before the person picks an account.

#### VRFY_ABHA_303_FA, no ABHA on this mobile. `sandbox`

As VRFY_ABHA_303, with `m1_post_v3_profile_account_abha_search_find_abha_face`. No QR code is generated.

#### VRFY_ABHA_304_FA, the chosen ABHA gets a face authentication QR code. `sandbox` and `screen`

Exit condition: `m1_post_v3_profile_login_request_otp_find_abha_face` returns 200 with a `txnId`, sent only after the person picked an account. Screen check: the QR code is shown clearly for scanning, and the chosen account stays selected until authentication ends.

#### VRFY_ABHA_305_FA, the QR code is scanned in the ABHA app. `human`

As CRT_ABHA_106_FA, with the `status` from `m1_post_v3_enrollment_enrol_capturepid_find_abha_face`.

#### VRFY_ABHA_306_FA, the ABHA Face RD app is not installed. `human`

As CRT_ABHA_107_FA.

#### VRFY_ABHA_307_FA, face authentication succeeds. `sandbox`, `human`

Exit condition: `m1_post_v3_enrollment_enrol_capturepid_find_abha_face` returns 200 with `status` `COMPLETE`, then `m1_post_v3_profile_login_verify_find_abha_face` returns 200 with `authResult` `success`. Screen check: the phone shows success.

#### VRFY_ABHA_308_FA, the chosen ABHA opens. `sandbox` and `screen`

Exit condition: the verify in VRFY_ABHA_307_FA carries `accounts` with the chosen account's `ABHANumber`, and `m1_get_v3_profile_account`, sent with the returned `token` as `X-token`, returns 200 with that `ABHANumber`. Screen check: as VRFY_ABHA_305. No other account's details are shown.

#### VRFY_ABHA_309_FA, a failed face authentication is refused. `sandbox`, `human`

The person does a scan that fails. Exit condition: one of the two refusals the specification documents, pasted. `m1_post_v3_enrollment_enrol_capturepid_find_abha_face` returns 200 with `status` `FAILED`, or `m1_post_v3_profile_login_verify_find_abha_face` returns 422 with `error.code` `ABDM-1204` and a `message` carrying the UIDAI error code. Your screen shows the code and message the API returned, fills no profile, and lets the person retry or generate a new QR code.
