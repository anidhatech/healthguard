# Log in with ABHA address

Sheet group: Login Via ABHA address.

Functionality 3 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `VRFY_ABHA_102`, `VRFY_ABHA_202`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Every call in `m1-abha-address-login-aadhaar-otp`, `m1-abha-address-login-mobile-otp` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Log in with ABHA address works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Log in with ABHA address succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_102`, `VRFY_ABHA_202` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Log in with ABHA address |

Loop limit: 3 passes through Test for Log in with ABHA address. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_102`, `VRFY_ABHA_202`.
An integration that already exists enters Log in with ABHA address at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: VRFY_ABHA_102, VRFY_ABHA_202. Mandatory for a private entity: VRFY_ABHA_102, VRFY_ABHA_202.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_102 | mandatory | mandatory | ABHA Address Verification using Aadhaar OTP |
| VRFY_ABHA_202 | mandatory | mandatory | ABHA address Verification using Mobile OTP (ABHA Linked Mobile Number) |

### VRFY_ABHA_102: ABHA Address Verification using Aadhaar OTP

The system must allow verification of an ABHA address using an Aadhaar-linked mobile number and OTP authentication.

**Steps**

- 1\. Enter the ABHA address.
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

**For the tester**

- Note: Auth modes in case of ABHA address must be dynamic and fetched from APIs

### VRFY_ABHA_202: ABHA address Verification using Mobile OTP (ABHA Linked Mobile Number)

The system must support ABHA address verification using OTP sent to the communication mobile number linked with the ABHA profile.

**Steps**

- 1\. Enter the ABHA address
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

An ABHA address does not carry every login method. The search for the address
says which ones it offers, and the screen shows those and no others.

### What happens

| Requirement | Cases |
|---|---|
| Search the address first. Offer exactly the methods the search response lists in `authMethods`, and nothing your system decided in advance | VRFY_ABHA_102, VRFY_ABHA_202 |
| A method the search does not list is not shown, even when your screen has a route for it | VRFY_ABHA_102 |
| The fetched profile fills the registration form under the read only rule in login-abha-number, and is saved and linked to your beneficiary id | VRFY_ABHA_102, VRFY_ABHA_202 |
| The Yes or No offer to update the mobile is shown when your record's mobile differs. No published call updates the mobile with an ABHA address login's token, so never show the update as done unless an update call returned success | VRFY_ABHA_102, VRFY_ABHA_202 |
| The OTP, wrong OTP and resend rules are under Screen requirements in create-abha-aadhaar-otp | VRFY_ABHA_102, VRFY_ABHA_202 |

### How you know it worked

The methods on screen match `authMethods` from the search for the address
the tester entered, and the form fills read only from the profile.

### When it goes wrong

- Methods typed into the screen fail VRFY_ABHA_102 the first time an address
  offers fewer of them.

From `hiecm.concept.m1-screens-login-abha-address`.

## Calls

### ABHA Address Login, Aadhaar OTP (`m1-abha-address-login-aadhaar-otp`)

**Act: the calls in this journey, in order**

#### 1. Search ABHA address (auth methods) (`m1_post_v3_phr_web_login_abha_search_abha_address_login_a_de8184`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/abha/search \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "abhaAddress": "<ABHA_ADDRESS>"
}'
```

#### 2. ABHA address login via Aadhaar OTP - send OTP (`m1_post_v3_phr_web_login_abha_request_otp_aadhaar_otp`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/abha/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-address-login",
    "aadhaar-verify"
  ],
  "loginHint": "abha-address",
  "loginId": "{{encryptedAbhaAddress}}",
  "otpSystem": "aadhaar"
}'
```

#### 3. ABHA address login via Aadhaar OTP - verify (`m1_post_v3_phr_web_login_abha_verify_aadhaar_otp`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/abha/verify \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-address-login",
    "aadhaar-verify"
  ],
  "authData": {
    "authMethods": [
      "otp"
    ],
    "otp": {
      "txnId": "41e59beb-6ee7-421e-a844-3652b2482038",
      "otpValue": "{{encryptedOtpValue}}"
    }
  }
}'
```

#### 4. Get ABHA-address profile (`m1_get_v3_phr_web_login_profile_abha_profile_abha_address_c04e83`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/profile/abha-profile \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{jwtToken}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 5. Get PHR card (`m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_817c0d`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/profile/abha/phr-card \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{jwtToken}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 6. Get ABHA-address QR code (`m1_get_v3_phr_web_login_profile_abha_qr_code_abha_address_26c955`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/profile/abha/qr-code \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

**Exit condition (Observe until this is true)**

A 200 response to `GET /abha/api/v3/phr/web/login/profile/abha/qr-code` in `m1-abha-address-login-aadhaar-otp`, whose body the specification does not give: read what comes back.

### ABHA Address Login, Mobile OTP (`m1-abha-address-login-mobile-otp`)

**Act: the calls in this journey, in order**

#### 1. Search ABHA address (auth methods) (`m1_post_v3_phr_web_login_abha_search_abha_address_login_m_27a20f`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/abha/search \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "abhaAddress": "<ABHA_ADDRESS>"
}'
```

#### 2. ABHA address login via Mobile OTP - send OTP (`m1_post_v3_phr_web_login_abha_request_otp_mobile_otp`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/abha/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-address-login",
    "mobile-verify"
  ],
  "loginHint": "abha-address",
  "loginId": "{{encryptedAbhaAddress}}",
  "otpSystem": "abdm"
}'
```

#### 3. ABHA address login via Mobile OTP - verify (`m1_post_v3_phr_web_login_abha_verify_mobile_otp`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/abha/verify \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-address-login",
    "mobile-verify"
  ],
  "authData": {
    "authMethods": [
      "otp"
    ],
    "otp": {
      "txnId": "41e59beb-6ee7-421e-a844-3652b2482038",
      "otpValue": "{{encryptedOtpValue}}"
    }
  }
}'
```

#### 4. Get ABHA-address profile (`m1_get_v3_phr_web_login_profile_abha_profile_abha_address_b038c4`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/profile/abha-profile \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{jwtToken}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 5. Get PHR card (`m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_e1bae9`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/profile/abha/phr-card \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{jwtToken}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 6. Get ABHA-address QR code (`m1_get_v3_phr_web_login_profile_abha_qr_code_abha_address_a48785`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/phr/web/login/profile/abha/qr-code \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

**Exit condition (Observe until this is true)**

A 200 response to `GET /abha/api/v3/phr/web/login/profile/abha/qr-code` in `m1-abha-address-login-mobile-otp`, whose body the specification does not give: read what comes back.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| VRFY_ABHA_102 | ABHA address login, Aadhaar OTP, then registration form | `m1_post_v3_phr_web_login_abha_search_abha_address_login_a_de8184`, `m1_post_v3_phr_web_login_abha_request_otp_aadhaar_otp`, `m1_post_v3_phr_web_login_abha_verify_aadhaar_otp`, `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_c04e83`, `m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_817c0d` |
| VRFY_ABHA_202 | ABHA address login, mobile OTP, then registration form | `m1_post_v3_phr_web_login_abha_search_abha_address_login_m_27a20f`, `m1_post_v3_phr_web_login_abha_request_otp_mobile_otp`, `m1_post_v3_phr_web_login_abha_verify_mobile_otp`, `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_b038c4`, `m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_e1bae9` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_phr_web_login_abha_search_abha_address_login_a_de8184` | `POST /abha/api/v3/phr/web/login/abha/search` | Search ABHA address (auth methods) |
| `m1_post_v3_phr_web_login_abha_request_otp_aadhaar_otp` | `POST /abha/api/v3/phr/web/login/abha/request/otp` | ABHA address login via Aadhaar OTP - send OTP |
| `m1_post_v3_phr_web_login_abha_verify_aadhaar_otp` | `POST /abha/api/v3/phr/web/login/abha/verify` | ABHA address login via Aadhaar OTP - verify |
| `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_c04e83` | `GET /abha/api/v3/phr/web/login/profile/abha-profile` | Get ABHA-address profile |
| `m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_817c0d` | `GET /abha/api/v3/phr/web/login/profile/abha/phr-card` | Get PHR card |
| `m1_get_v3_phr_web_login_profile_abha_qr_code_abha_address_26c955` | `GET /abha/api/v3/phr/web/login/profile/abha/qr-code` | Get ABHA-address QR code |
| `m1_post_v3_phr_web_login_abha_search_abha_address_login_m_27a20f` | `POST /abha/api/v3/phr/web/login/abha/search` | Search ABHA address (auth methods) |
| `m1_post_v3_phr_web_login_abha_request_otp_mobile_otp` | `POST /abha/api/v3/phr/web/login/abha/request/otp` | ABHA address login via Mobile OTP - send OTP |
| `m1_post_v3_phr_web_login_abha_verify_mobile_otp` | `POST /abha/api/v3/phr/web/login/abha/verify` | ABHA address login via Mobile OTP - verify |
| `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_b038c4` | `GET /abha/api/v3/phr/web/login/profile/abha-profile` | Get ABHA-address profile |
| `m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_e1bae9` | `GET /abha/api/v3/phr/web/login/profile/abha/phr-card` | Get PHR card |
| `m1_get_v3_phr_web_login_profile_abha_qr_code_abha_address_a48785` | `GET /abha/api/v3/phr/web/login/profile/abha/qr-code` | Get ABHA-address QR code |

Headers the calls of Log in with ABHA address take: `REQUEST-ID`, `TIMESTAMP`, `X-token`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_phr_web_login_abha_search_abha_address_login_a_de8184` | 400 | `ABDM-1211` | User not found. |
| `m1_post_v3_phr_web_login_abha_search_abha_address_login_a_de8184` | 401 | `900902` | Missing Credentials |
| `m1_post_v3_phr_web_login_abha_request_otp_aadhaar_otp` | 400 | `ABDM-1211` | User not found. |
| `m1_post_v3_phr_web_login_abha_request_otp_aadhaar_otp` | 401 | `900902` | Missing Credentials |
| `m1_post_v3_phr_web_login_abha_verify_aadhaar_otp` | 401 | `900902` | Missing Credentials |
| `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_c04e83` | 401 | `900902` | Missing Credentials |
| `m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_817c0d` | 401 | `900902` | Missing Credentials |
| `m1_post_v3_phr_web_login_abha_search_abha_address_login_m_27a20f` | 400 | `ABDM-1211` | User not found. |
| `m1_post_v3_phr_web_login_abha_search_abha_address_login_m_27a20f` | 401 | `900902` | Missing Credentials |
| `m1_post_v3_phr_web_login_abha_request_otp_mobile_otp` | 401 | `900902` | Missing Credentials |
| `m1_post_v3_phr_web_login_abha_verify_mobile_otp` | 401 | `900902` | Missing Credentials |
| `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_b038c4` | 401 | `900902` | Missing Credentials |
| `m1_get_v3_phr_web_login_profile_abha_phr_card_abha_addres_e1bae9` | 401 | `900902` | Missing Credentials |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_102 | `aadhaar-holder`, `otp` | step 5 |
| VRFY_ABHA_202 | `aadhaar-holder`, `otp` | step 5 |

### VRFY_ABHA_102 and 202: log in with an ABHA address

Loop limit: 3 passes per test case.

**Preconditions.** A person present with an ABHA address, the Aadhaar linked mobile and the ABHA linked mobile.

#### VRFY_ABHA_102, by ABHA address and Aadhaar OTP. `sandbox`, `human`

Calls: `m1_post_v3_phr_web_login_abha_search_abha_address_login_a_de8184`, `m1_post_v3_phr_web_login_abha_request_otp_aadhaar_otp`, the OTP, `m1_post_v3_phr_web_login_abha_verify_aadhaar_otp`, then `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_c04e83`.

Exit condition: the search returns 200 with `authMethods`, the verify returns 200 with a token, and the profile call returns 200 carrying the ABHA number and the address searched for. Paste all three.

Screen checks alongside: the ways to log in that your screen offers are the ones `authMethods` returned, not a fixed list. Resend, the not editable fields, the stored record and the mobile update offer as in VRFY_ABHA_101.

#### VRFY_ABHA_202, by ABHA address and the ABHA linked mobile OTP. `sandbox`, `human`

As VRFY_ABHA_102 with `m1_post_v3_phr_web_login_abha_search_abha_address_login_m_27a20f`, `m1_post_v3_phr_web_login_abha_request_otp_mobile_otp`, `m1_post_v3_phr_web_login_abha_verify_mobile_otp` and `m1_get_v3_phr_web_login_profile_abha_profile_abha_address_b038c4`. Same exit condition, same screen checks.
