# Log in with Aadhaar OTP

Sheet group: Login Via Aadhaar(OTP).

Functionality 5 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `VRFY_ABHA_401`, `VRFY_ABHA_402`, `VRFY_ABHA_403`, `VRFY_ABHA_404`, `VRFY_ABHA_405`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Every call in `m1-login-aadhaar-number` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Log in with Aadhaar OTP works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Log in with Aadhaar OTP succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_401`, `VRFY_ABHA_402`, `VRFY_ABHA_403`, `VRFY_ABHA_404`, `VRFY_ABHA_405` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Log in with Aadhaar OTP |

Loop limit: 3 passes through Test for Log in with Aadhaar OTP. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_401`, `VRFY_ABHA_402`, `VRFY_ABHA_403`, `VRFY_ABHA_404`, `VRFY_ABHA_405`.
An integration that already exists enters Log in with Aadhaar OTP at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: VRFY_ABHA_401, VRFY_ABHA_402, VRFY_ABHA_403, VRFY_ABHA_404, VRFY_ABHA_405. Mandatory for a private entity: VRFY_ABHA_401, VRFY_ABHA_402, VRFY_ABHA_403, VRFY_ABHA_404, VRFY_ABHA_405.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_401 | mandatory | mandatory | Fetch ABHA Details Using Aadhaar Number |
| VRFY_ABHA_402 | mandatory | mandatory | Incorrect OTP |
| VRFY_ABHA_403 | mandatory | mandatory | ABHA Details Not Found for Aadhaar Number |
| VRFY_ABHA_404 | mandatory | mandatory | ABHA Details Exist for Aadhaar Number |
| VRFY_ABHA_405 | mandatory | mandatory | Resend OTP Functionality |

### VRFY_ABHA_401: Fetch ABHA Details Using Aadhaar Number

The system must allow retrieval of ABHA details using a valid Aadhaar number.

**Steps**

- 1\.If the user enters wrong Aadhaar Number then system will display an error message "Invalid LoginId" or some relevant message i.e "Aadhaar Number is not valid".

**Expected Result**

- Display a relevant error message.

**For the tester**

- 1\. It is recommended that Aadhar number should be in masked format.
- 2\. Consent language should be updated : https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=consentLanguage

### VRFY_ABHA_402: Incorrect OTP

In case the user enters an incorrect OTP during verification.

**Steps**

- If the OTP is incorrect, the system must prevent further progress and display an appropriate error message.

**Expected Result**

- Display a relevant error message.

### VRFY_ABHA_403: ABHA Details Not Found for Aadhaar Number

No ABHA is linked with the given Aadhaar number.

**Steps**

- 1\. Beneficary enter Aadhaar Number .
- 2\. Beneficary will receive the OTP i.e "OTP sent to Aadhaar linked mobile number ending with ******XXXX"
- 3\. After OTP verfication then system will display "NO ABHA user registered with this Aadhaar Number".
- 4\. System should redirects the user to proceed with ABHA creation.

**Expected Result**

- 1\.Display a relevant error message if no ABHA exists.
- 2\.Provide the option to create a new ABHA.

### VRFY_ABHA_404: ABHA Details Exist for Aadhaar Number

ABHA number is already linked with the Aadhaar number.

**Steps**

- 1\. Enter Aadhaar Number.
- 2\. Beneficary will receive the OTP i.e "OTP sent to Aadhaar linked mobile number ending with ******XXXX" .
- 3\. After the OTP verfication. If ABHA Number exists then system will display Beneficary ABHA profile details and user can download the ABHA card.
- 4\. If ABHA Profile is not present in HMIS, the system will allow it to be Register and linked in their HMIS beneficary's ID or proceed as per bussiness requirement .

**Expected Result**

- 1\.Display ABHA profile details.
- 2\.Allow download of ABHA card.
- 3\.Option to register and link ABHA in HMIS or proceed as required.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

### VRFY_ABHA_405: Resend OTP Functionality

Defines the behavior of the “Resend OTP” feature.

**Steps**

- Verify that the system enables the Resend OTP button after 60 seconds and allows a maximum of 2 resend attempts

**Expected Result**

- 1\.System activates the “Resend OTP” button as per the specified logic.
- 2\.Display a relevant message if the limit is exceeded.

**For the tester**

- 1\. If user tries to resend more than 2 times, system should display an appropriate, “Maximum OTP resend attempts reached. Please try again after 30 mins".

## Screen requirements

### In plain words

Logging in with an Aadhaar number answers two questions at once: does this
person hold an ABHA, and if so, which. Both answers have a screen.

### What happens

| Requirement | Cases |
|---|---|
| The Aadhaar field follows the rule in create-abha-aadhaar-otp: 12 digits, a refusal on the screen, no call, the number masked once entered | VRFY_ABHA_401 |
| Where this route asks for consent, it shows the published consent screen from create-abha-aadhaar-otp | VRFY_ABHA_401 |
| The OTP screen says where the OTP went, as the case's steps write it: "OTP sent to Aadhaar linked mobile number ending with ******XXXX", with the last digits the `request/otp` response carries. A screen that names no mobile fails the case | VRFY_ABHA_403, VRFY_ABHA_404 |
| A wrong OTP stops progress and shows ABDM's message, under the OTP rules in create-abha-aadhaar-otp | VRFY_ABHA_402 |
| No ABHA on the Aadhaar shows a clear message, such as "NO ABHA user registered with this Aadhaar Number", and offers to create one. Creation carries on from what this screen already holds and never asks for the Aadhaar again | VRFY_ABHA_403 |
| An ABHA on the Aadhaar shows the profile, lets the person download the card, and offers to register and link it to your beneficiary id | VRFY_ABHA_404 |
| Resend follows the shared rule in create-abha-aadhaar-otp, including the message on the third attempt | VRFY_ABHA_405 |

### How you know it worked

The masked mobile on the OTP screen matches the response's `message`, and
both outcomes, ABHA and no ABHA, end on a screen that offers the next step.

### When it goes wrong

- An OTP screen with no masked mobile fails VRFY_ABHA_404.
- "No ABHA" as a dead end, with no offer to create, fails VRFY_ABHA_403.

From `hiecm.concept.m1-screens-login-aadhaar-otp`.

## Calls

### Login, Aadhaar Number (`m1-login-aadhaar-number`)

**Act: the calls in this journey, in order**

#### 1. Login via Aadhaar number - send Aadhaar OTP (`m1_post_v3_profile_login_request_otp_aadhaar`)

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
  "loginHint": "aadhaar",
  "loginId": "{{encrypted aadhaar-number}}",
  "otpSystem": "aadhaar"
}'
```

#### 2. Login via Aadhaar number - verify Aadhaar OTP (`m1_post_v3_profile_login_verify_aadhaar_otp`)

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

### ABHA Card & Profile (`m1-abha-card-profile`)

Built in [create-abha-aadhaar-otp](create-abha-aadhaar-otp.md). Reuse those calls.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| VRFY_ABHA_401 | Aadhaar number entry | `m1_post_v3_profile_login_request_otp_aadhaar` |
| VRFY_ABHA_402 | Aadhaar OTP entry, wrong OTP | `m1_post_v3_profile_login_verify_aadhaar_otp` |
| VRFY_ABHA_403 | No ABHA found, offer to create | `m1_post_v3_profile_login_request_otp_aadhaar`, `m1_post_v3_profile_login_verify_aadhaar_otp` |
| VRFY_ABHA_404 | ABHA profile and card, then registration | `m1_post_v3_profile_login_request_otp_aadhaar`, `m1_post_v3_profile_login_verify_aadhaar_otp`, `m1_get_v3_profile_account`, `m1_get_v3_profile_account_abha_card` |
| VRFY_ABHA_405 | Aadhaar OTP entry, resend | `m1_post_v3_profile_login_request_otp_aadhaar` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_profile_login_request_otp_aadhaar` | `POST /abha/api/v3/profile/login/request/otp` | Login via Aadhaar number - send Aadhaar OTP |
| `m1_post_v3_profile_login_verify_aadhaar_otp` | `POST /abha/api/v3/profile/login/verify` | Login via Aadhaar number - verify Aadhaar OTP |

Headers the calls of Log in with Aadhaar OTP take: `REQUEST-ID`, `TIMESTAMP`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_profile_login_request_otp_aadhaar` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_aadhaar_otp` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_aadhaar_otp` | 404 | `ABDM-1114` | No ABHA user registered with this Aadhaar number. |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_401 | nothing | none |
| VRFY_ABHA_402 | `aadhaar-holder`, `otp` | none |
| VRFY_ABHA_403 | `aadhaar-without-abha`, `otp` | none |
| VRFY_ABHA_404 | `aadhaar-holder`, `otp` | none |
| VRFY_ABHA_405 | `aadhaar-holder`, `otp` | none |

### VRFY_ABHA_401 to 405: log in with an Aadhaar number and OTP

Loop limit: 3 passes per test case.

#### VRFY_ABHA_401, an invalid Aadhaar is refused. `screen`

As CRT_ABHA_104, on the login screen. The message may read "Invalid LoginId" or "Aadhaar Number is not valid". The set recommends the masked format and the current consent text here too.

#### VRFY_ABHA_402, a wrong OTP is refused. `sandbox`, `human`

Exit condition: `m1_post_v3_profile_login_verify_aadhaar_otp` returns 400 with `otpValue` naming an invalid OTP value, and your screen shows an error and goes no further.

#### VRFY_ABHA_403, no ABHA on this Aadhaar. `sandbox`, `human`

Calls: `m1_post_v3_profile_login_request_otp_aadhaar`, the OTP, `m1_post_v3_profile_login_verify_aadhaar_otp`.

Exit condition: the request returns 200 with a `message` naming the masked Aadhaar mobile, the person enters the OTP, and the verify returns 404 with `error.code` `ABDM-1114` and a message that no ABHA user is registered with this Aadhaar number. Your screen says so and offers creation, and the creation path does not ask for the Aadhaar number again. `hiecm.concept.m1-never-ask-twice`

#### VRFY_ABHA_404, an ABHA exists on this Aadhaar. `sandbox`, `human`

Same calls with an Aadhaar that holds an account, then `m1_get_v3_profile_account`.

Exit condition: the verify returns 200 with `authResult` `success` and `accounts[0].ABHANumber`; the profile call returns 200 with the same number. Screen checks: the profile is shown, the card can be downloaded as in CRT_ABHA_114 where the account is KYC verified, and the account is registered and linked to your patient id if it was not already.

#### VRFY_ABHA_405, resend OTP. `screen`

As CRT_ABHA_106, on the login screen.
