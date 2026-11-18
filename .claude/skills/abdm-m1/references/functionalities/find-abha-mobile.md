# Find a forgotten ABHA by mobile

Sheet group: Login Via Mobile: Find ABHA via Mobile Number(OTP).

Functionality 4 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `VRFY_ABHA_301`, `VRFY_ABHA_302`, `VRFY_ABHA_303`, `VRFY_ABHA_304`, `VRFY_ABHA_305`, `VRFY_ABHA_306`, `VRFY_ABHA_307`, `VRFY_ABHA_308`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Every call in `m1-find-abha-mobile-otp` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Find a forgotten ABHA by mobile works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Find a forgotten ABHA by mobile succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_301`, `VRFY_ABHA_302`, `VRFY_ABHA_303`, `VRFY_ABHA_304`, `VRFY_ABHA_305`, `VRFY_ABHA_306`, `VRFY_ABHA_307`, `VRFY_ABHA_308` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Find a forgotten ABHA by mobile |

Loop limit: 3 passes through Test for Find a forgotten ABHA by mobile. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_301`, `VRFY_ABHA_302`, `VRFY_ABHA_303`, `VRFY_ABHA_304`, `VRFY_ABHA_305`, `VRFY_ABHA_306`, `VRFY_ABHA_307`, `VRFY_ABHA_308`.
An integration that already exists enters Find a forgotten ABHA by mobile at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: VRFY_ABHA_301, VRFY_ABHA_302, VRFY_ABHA_303, VRFY_ABHA_304, VRFY_ABHA_305, VRFY_ABHA_306, VRFY_ABHA_307, VRFY_ABHA_308. Mandatory for a private entity: VRFY_ABHA_301, VRFY_ABHA_302, VRFY_ABHA_303, VRFY_ABHA_304, VRFY_ABHA_305, VRFY_ABHA_306, VRFY_ABHA_307, VRFY_ABHA_308.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_301 | mandatory | mandatory | Validate Communication Mobile Number Input |
| VRFY_ABHA_302 | mandatory | mandatory | Fetch Associated ABHA Profiles Using Communication Mobile Number |
| VRFY_ABHA_303 | mandatory | mandatory | No ABHA Profile Linked with Communication Mobile Number |
| VRFY_ABHA_304 | mandatory | mandatory | Select Required ABHA Profile and Trigger OTP |
| VRFY_ABHA_305 | mandatory | mandatory | Verify OTP and Open Selected ABHA Profile |
| VRFY_ABHA_306 | mandatory | mandatory | Auto-populate ABHA Profile Details in HMIS Registration Form |
| VRFY_ABHA_307 | mandatory | mandatory | Incorrect OTP Handling |
| VRFY_ABHA_308 | mandatory | mandatory | Selected ABHA Profile Already Linked in HMIS |

### VRFY_ABHA_301: Validate Communication Mobile Number Input

The system must validate the communication mobile number before initiating ABHA retrieval through mobile OTP.

**Steps**

- 1\. Enter an invalid communication mobile number, such as less than 10 digits, more than 10 digits, alphabetic characters, special characters, or blank input.
- 2\. Click on Proceed / Search as applicable.

**Expected Result**

- 1\. The system should not proceed with ABHA profile search.
- 2\. The system should display: ""Please enter a valid mobile number.

### VRFY_ABHA_302: Fetch Associated ABHA Profiles Using Communication Mobile Number

The system must fetch and display all ABHA profiles associated with the entered communication mobile number before OTP verification.

**Steps**

- 1\. Enter a valid communication mobile number.
- 2\. Click on Search / Proceed.
- 3\. System checks ABHA profiles linked with the entered mobile number..

**Expected Result**

- 1\. The system should display the list of all ABHA profiles associated with the entered mobile number.
- 2\. The profile list should show sufficient details to identify the correct ABHA profile, such as masked ABHA number / ABHA address / name as available from API.
- 3\. OTP should not be submitted before the patient selects the required ABHA profile.

### VRFY_ABHA_303: No ABHA Profile Linked with Communication Mobile Number

The system must handle the scenario where no ABHA profile is linked with the entered communication mobile number.

**Steps**

- 1\. Enter a valid communication mobile number that is not linked with any ABHA profile.
- 2\. Click on Search / Proceed.

**Expected Result**

- 1\. The system should display: "ABHA details not found. We did not find any ABHA number linked to this mobile number. Please use an ABHA-linked mobile number."
- 2\. The system should provide an option to create a new ABHA, if supported as per business flow.
- 3\. No OTP verification screen should be opened for retrieval.

### VRFY_ABHA_304: Select Required ABHA Profile and Trigger OTP

The system must allow the patient to select the required ABHA profile from the list and then trigger OTP to the communication mobile number.

**Steps**

- 1\. From the displayed ABHA profile list, select the required ABHA profile.
- 2\. Click on Send OTP / Proceed.
- 3\. Wait for OTP on the communication mobile number.

**Expected Result**

- 1\. OTP should be triggered only after profile selection.
- 2\. OTP should be sent to the communication mobile number linked with the selected ABHA profile.
- 3\. The system should open the OTP verification screen.
- 4\. The selected profile context should be retained until OTP verification is completed.

**For the tester**

- 1\. If user tries to resend more than 2 times, system should display an appropriate, “Maximum OTP resend attempts reached. Please try again after 30 mins".

### VRFY_ABHA_305: Verify OTP and Open Selected ABHA Profile

The system must verify OTP and display the selected ABHA profile details after successful OTP authentication.

**Steps**

- 1\. Enter the valid OTP received on the communication mobile number.
- 2\. Submit OTP for verification.

**Expected Result**

- 1\. OTP should be verified successfully.
- 2\. The selected patient ABHA profile should open.
- 3\. The system should fetch and display profile details such as name, date of birth / age, gender, mobile number, ABHA number, ABHA address, state, district, photo and address, as available from APIs.
- 4\. The system should not display details of any non-selected ABHA profile.

### VRFY_ABHA_306: Auto-populate ABHA Profile Details in HMIS Registration Form

After successful OTP verification, the system must auto-populate the selected ABHA profile details in HMIS for registration or linking.

**Steps**

- 1\. Complete OTP verification successfully.
- 2\. Navigate to registration / linking screen.
- 3\. Verify the fields populated in HMIS.

**Expected Result**

- 1\. ABHA profile details should be auto-populated in the HMIS registration form.
- 2\. Name, date of birth / age and gender should be non-editable.
- 3\. Editable fields such as address, email, mobile number, state, district and city should be editable as per business rules.
- 4\. Retrieved ABHA number and ABHA address should be linked with the HMIS Beneficiary ID after successful registration/linking.

### VRFY_ABHA_307: Incorrect OTP Handling

The system must handle incorrect OTP submissions and prevent profile access until valid OTP is entered.

**Steps**

- 1\. Enter an incorrect OTP.
- 2\. Submit OTP for verification.

**Expected Result**

- 1\. The system should not verify the ABHA profile.
- 2\. The selected ABHA profile details should not be opened.
- 3\. The system should display an appropriate error message, such as "Invalid OTP. Please enter a valid OTP."

### VRFY_ABHA_308: Selected ABHA Profile Already Linked in HMIS

The system must identify if the selected ABHA profile is already linked with an HMIS Beneficiary ID.

**Steps**

- 1\. Enter communication mobile number.
- 2\. Select the required ABHA profile.
- 3\. Complete OTP verification successfully.
- 4\. System checks whether selected ABHA profile is already linked in HMIS.

**Expected Result**

- 1\. The system should display: "This ABHA profile is already linked to HMIS Beneficiary ID." and shows a comparison sc reen where details from ABHA and details in HMIS are displayed.
- 2\. Duplicate beneficiary registration should not be created.
- 3\. Existing beneficiary linkage should be shown or handled as per organization business rules.

## Screen requirements

### In plain words

One mobile can hold several ABHAs. The search lists them for free, before
any OTP, so the person picks theirs first and the OTP goes to that one.

### What happens

| Requirement | Cases |
|---|---|
| The mobile field takes ten digits and nothing else. Anything else shows "Please enter a valid mobile number." and no search is sent | VRFY_ABHA_301 |
| Search first and list every ABHA on the mobile, each with enough to tell them apart: the masked ABHA number, the ABHA address and the name, as the search returns them | VRFY_ABHA_302 |
| No OTP is sent before a profile is chosen. Send OTP appears only after the choice, and the OTP request carries the chosen profile's `index` and the search's `txnId` | VRFY_ABHA_302, VRFY_ABHA_304 |
| The chosen profile stays chosen until the OTP verifies | VRFY_ABHA_304 |
| A mobile with no ABHA shows "ABHA details not found. We did not find any ABHA number linked to this mobile number. Please use an ABHA-linked mobile number.", offers to create an ABHA, and opens no OTP screen | VRFY_ABHA_303 |
| After the OTP verifies, open the chosen profile only, never another ABHA on the same mobile | VRFY_ABHA_305 |
| The profile fills the registration form under the read only rule in login-abha-number, and the ABHA number and address are linked to your beneficiary id | VRFY_ABHA_306 |
| A wrong OTP opens nothing and shows ABDM's message, under the OTP rules in create-abha-aadhaar-otp | VRFY_ABHA_307 |
| When the chosen ABHA is already linked in your records, show "This ABHA profile is already linked to HMIS Beneficiary ID." and a comparison screen: the details from the ABHA beside the details your record holds. No second registration is created | VRFY_ABHA_308 |

### How you know it worked

The list appears before any OTP, the OTP reaches only the chosen profile, and
running the same person twice opens the comparison screen the second time.

### When it goes wrong

- An OTP sent on the mobile before the list fails VRFY_ABHA_302 and 304.
- A second patient row for an already linked ABHA fails VRFY_ABHA_308.

From `hiecm.concept.m1-screens-find-abha-mobile`.

## Calls

### Find ABHA, Mobile OTP (`m1-find-abha-mobile-otp`)

**Act: the calls in this journey, in order**

#### 1. Search ABHA by mobile (`m1_post_v3_profile_account_abha_search_find_abha_mobile_otp`)

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

#### 2. Find ABHA via Mobile - send OTP (`m1_post_v3_profile_login_request_otp_find_abha_mobile`)

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
    "mobile-verify"
  ],
  "loginHint": "index",
  "loginId": "{{rsaIndexEncryptionOutput}}",
  "otpSystem": "abdm",
  "txnId": "{{searchTxnId}}"
}'
```

#### 3. Find ABHA via Mobile - verify OTP (`m1_post_v3_profile_login_verify_find_abha_mobile`)

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
  "txnId": "dcc22def-8102-4c9a-a36e-15743556fdc4",
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
| VRFY_ABHA_301 | Mobile number entry | None |
| VRFY_ABHA_302 | ABHA profile list | `m1_post_v3_profile_account_abha_search_find_abha_mobile_otp` |
| VRFY_ABHA_303 | ABHA profile list, none found | `m1_post_v3_profile_account_abha_search_find_abha_mobile_otp` |
| VRFY_ABHA_304 | ABHA profile list, select then send OTP | `m1_post_v3_profile_account_abha_search_find_abha_mobile_otp`, `m1_post_v3_profile_login_request_otp_find_abha_mobile` |
| VRFY_ABHA_305 | Mobile OTP entry, then selected profile | `m1_post_v3_profile_login_verify_find_abha_mobile`, `m1_get_v3_profile_account` |
| VRFY_ABHA_306 | Registration form filled from the profile | `m1_post_v3_profile_login_verify_find_abha_mobile`, `m1_get_v3_profile_account` |
| VRFY_ABHA_307 | Mobile OTP entry, wrong OTP | `m1_post_v3_profile_login_verify_find_abha_mobile` |
| VRFY_ABHA_308 | Already linked, comparison screen | `m1_post_v3_profile_account_abha_search_find_abha_mobile_otp`, `m1_post_v3_profile_login_request_otp_find_abha_mobile`, `m1_post_v3_profile_login_verify_find_abha_mobile`, `m1_get_v3_profile_account` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_profile_account_abha_search_find_abha_mobile_otp` | `POST /abha/api/v3/profile/account/abha/search` | Search ABHA by mobile |
| `m1_post_v3_profile_login_request_otp_find_abha_mobile` | `POST /abha/api/v3/profile/login/request/otp` | Find ABHA via Mobile - send OTP |
| `m1_post_v3_profile_login_verify_find_abha_mobile` | `POST /abha/api/v3/profile/login/verify` | Find ABHA via Mobile - verify OTP |

Headers the calls of Find a forgotten ABHA by mobile take: `REQUEST-ID`, `TIMESTAMP`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_profile_login_request_otp_find_abha_mobile` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_mobile` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_profile_login_verify_find_abha_mobile` | 404 | `ABDM-1114` | User not found. |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_301 | nothing | none |
| VRFY_ABHA_302 | `aadhaar-holder` | none |
| VRFY_ABHA_303 | `mobile-without-abha` | none |
| VRFY_ABHA_304 | `aadhaar-holder`, `otp` | none |
| VRFY_ABHA_305 | `aadhaar-holder`, `otp` | none |
| VRFY_ABHA_306 | `aadhaar-holder`, `otp` | none |
| VRFY_ABHA_307 | `aadhaar-holder`, `otp` | none |
| VRFY_ABHA_308 | `aadhaar-holder`, `otp`, `patient-registered` | none |

### VRFY_ABHA_301 to 308: find an ABHA by the communication mobile and OTP

This is the lookup that costs no Aadhaar OTP, so it is the one your desk should run first.

Calls, in order: `m1_post_v3_profile_account_abha_search_find_abha_mobile_otp`, `m1_post_v3_profile_login_request_otp_find_abha_mobile` with the chosen account's `index` and the search `txnId`, the OTP, `m1_post_v3_profile_login_verify_find_abha_mobile`, then `m1_get_v3_profile_account` with the returned `token` as `X-token`. `hiecm.flow.m1-find-abha`

Loop limit: 3 passes per test case.

#### VRFY_ABHA_301, an invalid mobile is refused. `screen`

Fewer than ten digits, more than ten, letters, special characters and blank input are each refused on screen with "Please enter a valid mobile number.", and no search is sent.

#### VRFY_ABHA_302, every ABHA on this mobile is listed. `sandbox` and `screen`

Exit condition: the search returns 200 with a top level array. `[0].txnId` is present, and `[0].ABHA[]` holds the accounts, each entry carrying `index`, `ABHANumber` and `name`. Paste it.

The specification also carries a saved example without the `ABHA` array, an object with `txnId` and `message`, marked for confirmation with NHA. A run that sees that shape pastes it and records the difference in the run log.

Screen checks: every account in the array is listed, with enough to tell them apart, such as the masked ABHA number and the name. No OTP is requested before the person picks one.

Nudge: read the array as plural. One mobile can hold up to six accounts, and a screen that shows the first one silently links the wrong person.

#### VRFY_ABHA_303, no ABHA on this mobile. `sandbox`

Exit condition: the search returns 404 with `error.code` `ABDM-1114`. Your screen says "ABHA details not found. We did not find any ABHA number linked to this mobile number. Please use an ABHA-linked mobile number.", and opens no OTP screen. If your business flow supports creation, the screen also offers to create a new ABHA. `hiecm.concept.m1-journey-completes-without-abha`

#### VRFY_ABHA_304, the chosen ABHA gets the OTP. `sandbox`, `human`

Exit condition: `m1_post_v3_profile_login_request_otp_find_abha_mobile` returns 200 with a `txnId` and a `message` naming the masked mobile, sent only after the person picked an account. Screen checks: the OTP screen opens, the chosen account stays selected until verification, and resend works as in CRT_ABHA_106.

#### VRFY_ABHA_305, the OTP is verified and the chosen ABHA opens. `sandbox`, `human`

Exit condition: `m1_post_v3_profile_login_verify_find_abha_mobile` returns 200 with `authResult` `success`, `token`, and `accounts` holding the chosen `ABHANumber`; the profile call returns 200 with that `ABHANumber`. Screen check: only the chosen profile is shown, with name, date of birth or age, gender, mobile, ABHA number, ABHA address, state, district, photo and address as the API returned them.

#### VRFY_ABHA_306, the registration form is filled from the profile. `screen`

After VRFY_ABHA_305, your registration or linking form is filled from the profile. Name, date of birth or age and gender are not editable. Address, email, mobile, state, district and city are editable. After registration, the ABHA number and ABHA address are linked to your beneficiary id. Evidence: the form, and the stored link. `hiecm.concept.m1-confirm-the-filled-form`

#### VRFY_ABHA_307, a wrong OTP is refused. `sandbox`, `human`

Exit condition: `m1_post_v3_profile_login_verify_find_abha_mobile` returns 400 with `otpValue` naming an invalid OTP value. Your screen shows an error such as "Invalid OTP. Please enter a valid OTP.", opens no profile, and allows a retry without re-entering the mobile.

#### VRFY_ABHA_308, the chosen ABHA is already linked in your system. `screen`

Pick an account already linked to one of your patients. After VRFY_ABHA_305 your screen says "This ABHA profile is already linked to HMIS Beneficiary ID.", shows the ABHA details and your stored details side by side, and creates no second registration. Evidence: the screen and one row in your database. `hiecm.concept.m1-avoiding-duplicate-abha`
