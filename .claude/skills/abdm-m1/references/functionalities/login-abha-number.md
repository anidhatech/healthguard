# Log in with ABHA number

Sheet group: Login Via ABHA Number.

Functionality 2 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `VRFY_ABHA_101`, `VRFY_ABHA_201`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Every call in `m1-login-abha-number-aadhaar-otp`, `m1-login-abha-number-mobile-otp`, `m1-profile-update-mobile` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Log in with ABHA number works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Log in with ABHA number succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_101`, `VRFY_ABHA_201` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Log in with ABHA number |

Loop limit: 3 passes through Test for Log in with ABHA number. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_101`, `VRFY_ABHA_201`.
An integration that already exists enters Log in with ABHA number at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: VRFY_ABHA_101, VRFY_ABHA_201. Mandatory for a private entity: VRFY_ABHA_101, VRFY_ABHA_201.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_101 | mandatory | mandatory | ABHA Number Verification using Aadhaar OTP |
| VRFY_ABHA_201 | mandatory | mandatory | ABHA Number Verification using Mobile OTP (ABHA Linked Mobile Number) |

### VRFY_ABHA_101: ABHA Number Verification using Aadhaar OTP

The system must allow verification of an ABHA Number using an Aadhaar-linked mobile number and OTP authentication.

**Steps**

- 1\. Enter the ABHA Number.
- 2\. Receive OTP on the mobile number linked with Aadhaar.
- 3\. Enter the received OTP.
- 4\. The system must allow the OTP to be resent a maximum of two times, with a 60-second interval between each resend request.
- 5\. If the beneficiary has updated their mobile number in the HMIS system, the system should offer an option (Yes/No) to update the mobile number in the ABHA profile using the Profile API.

**Expected Result**

- 1\. Upon successful OTP verification, the system fetches the user’s ABHA profile via the APIs. This includes the name, date of birth, gender, mobile number, photo, address, ABHA Number, and ABHA Address.
- 2\. If the OTP is incorrect, the verification should fail with an appropriate error message.
- 3\. Fields such as name, date of birth, and gender must be non-editable. Other fields (e.g., address, email, mobile number, state, district, city) should be editable.
- 4\. Once verification is successful, the retrieved data should be saved in the HMIS system and linked to the unique beneficiary ID as per the organization’s business requirements.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

### VRFY_ABHA_201: ABHA Number Verification using Mobile OTP (ABHA Linked Mobile Number)

The system must support ABHA Number verification using OTP sent to the communication mobile number linked with the ABHA profile.

**Steps**

- 1\. Enter the ABHA Number
- 2\. Receive OTP on the ABHA-linked mobile number.
- 3\. Enter the OTP.
- 4\. The system must enable the “Resend OTP” option, allowing a maximum of two resend attempts with a 60-second interval.
- 5\. If the beneficiary has updated their mobile number in the HMIS system, the application must provide an option (Yes/No) to update the mobile number in the ABHA profile using the Profile API.

**Expected Result**

- 1\. On entering a valid OTP, the system should complete verification and fetch the user’s ABHA profile using APIs, including name, date of birth, gender, mobile number, photo, address, state, district, ABHA Number, and ABHA Address.
- 2\. If the OTP entered is incorrect, the system must display an appropriate error message.
- 3\. Name, date of birth, and gender must be displayed as non-editable fields. The remaining fields (e.g., address, email, mobile number, state, district, city) should remain editable.
- 4\. Upon successful verification, the fetched details must be saved in the HMIS system and linked to the corresponding unique beneficiary ID, as per organizational or business logic.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

## Screen requirements

### In plain words

An ABHA number can be verified two ways, by an OTP to the Aadhaar linked
mobile and by an OTP to the mobile linked to the ABHA. Both are mandatory for
every entity type, so both are built. The profile they return fills your
registration form, and the fields that came from Aadhaar cannot be changed on
your screen.

### What happens

| Requirement | Cases |
|---|---|
| Build both routes: ABHA number with Aadhaar OTP, and ABHA number with the ABHA linked mobile OTP. The deployment interview never switches either off, because a journey a mandatory case needs is not optional | VRFY_ABHA_101, VRFY_ABHA_201 |
| After the OTP verifies, fetch the profile and fill your registration form from it: name, date of birth, gender, mobile, photo, address, state, district, ABHA number and ABHA address. Nobody types what the profile holds | VRFY_ABHA_101, VRFY_ABHA_201 |
| On any form filled from an ABHA, name, date of birth and gender are read only. Address, email, mobile, state, district and city stay editable. This holds for every M1 route that fills the form | VRFY_ABHA_101, VRFY_ABHA_201, VRFY_ABHA_102, VRFY_ABHA_202, VRFY_ABHA_306 |
| Save what was fetched and link the ABHA number and ABHA address to your own beneficiary id | VRFY_ABHA_101, VRFY_ABHA_201 |
| When the mobile in your record differs from the one on the ABHA profile, offer a Yes or No choice to update the ABHA profile's mobile. Yes runs the update mobile calls with this login's `X-token` | VRFY_ABHA_101, VRFY_ABHA_201 |
| A wrong OTP keeps the transaction and the right one then succeeds, and resend follows the shared rule: both are under Screen requirements in create-abha-aadhaar-otp | VRFY_ABHA_101, VRFY_ABHA_201 |
| A non-KYC ABHA address cannot download a card. Say so on the screen rather than offering a download that fails | VRFY_ABHA_101, VRFY_ABHA_201 |

### How you know it worked

Both routes reach a filled registration form, the three Aadhaar fields cannot
be edited, and the saved patient carries the ABHA number and address.

### When it goes wrong

- Only one route built: the other case has no screen to run on.
- Name, gender or date of birth editable after the fill fails VRFY_ABHA_101.

From `hiecm.concept.m1-screens-login-abha-number`.

## Calls

### Login, ABHA Number (Aadhaar OTP) (`m1-login-abha-number-aadhaar-otp`)

**Act: the calls in this journey, in order**

#### 1. Login via ABHA number - send Aadhaar OTP (`m1_post_v3_profile_login_request_otp_abha_number_aadhaar_otp`)

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
    "aadhaar-verify"
  ],
  "loginHint": "abha-number",
  "loginId": "{{encrypted abha-number}}",
  "otpSystem": "aadhaar"
}'
```

#### 2. Login via ABHA number - verify Aadhaar OTP (`m1_post_v3_profile_login_verify_abha_number_aadhaar_otp`)

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
    "aadhaar-verify"
  ],
  "authData": {
    "authMethods": [
      "otp"
    ],
    "otp": {
      "txnId": "{{txnId}}",
      "otpValue": "{{encrypted OTP}}"
    }
  }
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "9fc6af6a-374f-4b6a-9cbe-791d360dfc28",
  "authResult": "success",
  "message": "OTP verified successfully",
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

### Login, ABHA Number (Mobile OTP) (`m1-login-abha-number-mobile-otp`)

**Act: the calls in this journey, in order**

#### 1. Login via ABHA number - send ABHA (mobile) OTP (`m1_post_v3_profile_login_request_otp_abha_number_abha_otp`)

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
    "mobile-verify"
  ],
  "loginHint": "abha-number",
  "loginId": "{{encrypted abha-number}}",
  "otpSystem": "abdm"
}'
```

#### 2. Login via ABHA number - verify ABHA (mobile) OTP (`m1_post_v3_profile_login_verify_abha_number_abha_otp`)

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
    "mobile-verify"
  ],
  "authData": {
    "authMethods": [
      "otp"
    ],
    "otp": {
      "txnId": "{{txnId}}",
      "otpValue": "{{encrypted OTP}}"
    }
  }
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "160ce506-4ef8-462e-ba2f-413c6f17852e",
  "authResult": "success",
  "message": "OTP verified successfully",
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

### ABHA Card & Profile (`m1-abha-card-profile`)

Built in [create-abha-aadhaar-otp](create-abha-aadhaar-otp.md). Reuse those calls.

### Profile, Update Mobile (`m1-profile-update-mobile`)

**Act: the calls in this journey, in order**

#### 1. Update mobile - send OTP (`m1_post_v3_profile_account_request_otp_update_mobile`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-profile",
    "mobile-verify"
  ],
  "loginHint": "mobile",
  "loginId": "{{encrypted mobile number}}",
  "otpSystem": "abdm"
}'
```

#### 2. Update mobile - verify OTP (`m1_post_v3_profile_account_verify_update_mobile`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/verify \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-profile",
    "mobile-verify"
  ],
  "authData": {
    "authMethods": [
      "otp"
    ],
    "otp": {
      "txnId": "{{txnId}}",
      "otpValue": "{{encrypted otp}}"
    }
  }
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "01bb3a4c-4588-4734-aff4-23d3978e50be",
  "authResult": "success",
  "message": "Mobile Number linked successfully",
  "accounts": [
    {
      "ABHANumber": "<ABHA_NUMBER>"
    }
  ]
}
```

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| VRFY_ABHA_101 | ABHA number login, Aadhaar OTP, then registration form | `m1_post_v3_profile_login_request_otp_abha_number_aadhaar_otp`, `m1_post_v3_profile_login_verify_abha_number_aadhaar_otp`, `m1_get_v3_profile_account`, `m1_post_v3_profile_account_request_otp_update_mobile`, `m1_post_v3_profile_account_verify_update_mobile` |
| VRFY_ABHA_201 | ABHA number login, mobile OTP, then registration form | `m1_post_v3_profile_login_request_otp_abha_number_abha_otp`, `m1_post_v3_profile_login_verify_abha_number_abha_otp`, `m1_get_v3_profile_account`, `m1_post_v3_profile_account_request_otp_update_mobile`, `m1_post_v3_profile_account_verify_update_mobile` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_profile_login_request_otp_abha_number_aadhaar_otp` | `POST /abha/api/v3/profile/login/request/otp` | Login via ABHA number - send Aadhaar OTP |
| `m1_post_v3_profile_login_verify_abha_number_aadhaar_otp` | `POST /abha/api/v3/profile/login/verify` | Login via ABHA number - verify Aadhaar OTP |
| `m1_post_v3_profile_login_request_otp_abha_number_abha_otp` | `POST /abha/api/v3/profile/login/request/otp` | Login via ABHA number - send ABHA (mobile) OTP |
| `m1_post_v3_profile_login_verify_abha_number_abha_otp` | `POST /abha/api/v3/profile/login/verify` | Login via ABHA number - verify ABHA (mobile) OTP |
| `m1_post_v3_profile_account_request_otp_update_mobile` | `POST /abha/api/v3/profile/account/request/otp` | Update mobile - send OTP |
| `m1_post_v3_profile_account_verify_update_mobile` | `POST /abha/api/v3/profile/account/verify` | Update mobile - verify OTP |

Headers the calls of Log in with ABHA number take: `REQUEST-ID`, `TIMESTAMP`, `X-token`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_profile_login_request_otp_abha_number_aadhaar_otp` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_abha_number_aadhaar_otp` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_abha_number_aadhaar_otp` | 404 | `ABDM-1114` | User not found. |
| `m1_post_v3_profile_login_request_otp_abha_number_abha_otp` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_abha_number_abha_otp` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_abha_number_abha_otp` | 404 | `ABDM-1114` | User not found. |
| `m1_post_v3_profile_account_request_otp_update_mobile` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_account_verify_update_mobile` | 401 | `900901` | Invalid Credentials |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_101 | `aadhaar-holder`, `otp`, `second-mobile` | none |
| VRFY_ABHA_201 | `aadhaar-holder`, `otp`, `second-mobile` | none |

### VRFY_ABHA_101 and 201: log in with an ABHA number

Loop limit: 3 passes per test case.

**Preconditions.** A person present with an ABHA, the Aadhaar linked mobile and the ABHA linked mobile.

#### VRFY_ABHA_101, by ABHA number and Aadhaar OTP. `sandbox`, `human`

Calls: `m1_post_v3_profile_login_request_otp_abha_number_aadhaar_otp`, the OTP, `m1_post_v3_profile_login_verify_abha_number_aadhaar_otp`, then `m1_get_v3_profile_account` with the returned token as `X-token`.

Exit condition: the verify returns 200 with `authResult` `success` and `accounts[0].ABHANumber`, and the profile call returns 200 with the same `ABHANumber`. A wrong OTP returns 400 with `otpValue` naming an invalid OTP value, and your screen says the verification failed.

Screen checks alongside: resend as in CRT_ABHA_106; name, date of birth and gender shown not editable, and address, email, mobile, state, district and city editable; the profile stored against your own patient id after verification. When the mobile in your own record differs from the ABHA one, your system offers a Yes or No choice to update the ABHA mobile, which PROF_ABHA_601 runs.

Nudge: the accounts array already carries the whole registration form. Fill the form from it before the profile call, so the person reads back rather than types.

#### VRFY_ABHA_201, by ABHA number and the ABHA linked mobile OTP. `sandbox`, `human`

As VRFY_ABHA_101 with `m1_post_v3_profile_login_request_otp_abha_number_abha_otp` and `m1_post_v3_profile_login_verify_abha_number_abha_otp`. Same exit condition, same screen checks.
