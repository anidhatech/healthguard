# Create ABHA by fingerprint or iris

Sheet group: ABHA Creation Through Aadhaar Biometric(Fingerprint/Iris).

Functionality 12 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Create ABHA by fingerprint or iris holds no mandatory case |
| Scaffold | Calls | Every call in `m1-create-abha-fingerprint`, `m1-create-abha-iris` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Create ABHA by fingerprint or iris works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Create ABHA by fingerprint or iris succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `CRT_ABHA_201`, `CRT_ABHA_204`, `CRT_ABHA_202`, `CRT_ABHA_203`, `CRT_ABHA_205`, `CRT_ABHA_206`, `CRT_ABHA_207`, `CRT_ABHA_208`, `CRT_ABHA_209`, `CRT_ABHA_210`, `CRT_ABHA_211`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Create ABHA by fingerprint or iris |

Loop limit: 3 passes through Test for Create ABHA by fingerprint or iris. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `CRT_ABHA_201`, `CRT_ABHA_204`, `CRT_ABHA_202`, `CRT_ABHA_203`, `CRT_ABHA_205`, `CRT_ABHA_206`, `CRT_ABHA_207`, `CRT_ABHA_208`, `CRT_ABHA_209`, `CRT_ABHA_210`, `CRT_ABHA_211`.
An integration that already exists enters Create ABHA by fingerprint or iris at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| CRT_ABHA_201 | optional | optional | Create ABHA Option |
| CRT_ABHA_204 | optional | optional | Aadhaar Collection and Error Handling |
| CRT_ABHA_202 | optional | optional | Consent collection |
| CRT_ABHA_203 | optional | optional | Consent collection should be multilingual |
| CRT_ABHA_205 | optional | optional | Biometric based Aadhaar Authentication |
| CRT_ABHA_206 | optional | optional | Communication Mobile Number Verification – I |
| CRT_ABHA_207 | optional | optional | Communication Mobile Number verification-II |
| CRT_ABHA_208 | optional | optional | Suggested ABHA Address |
| CRT_ABHA_209 | optional | optional | Display of ABHA Number |
| CRT_ABHA_210 | optional | optional | View and Download ABHA details. (If integrators is generating ABHA card) |
| CRT_ABHA_211 | optional | optional | View and Download ABHA details. (If integrators is not generating ABHA card) |

### CRT_ABHA_201: Create ABHA Option

The system must provide an option to create ABHA through Aadhaar Biometric.

**Steps**

- 1\. Launch the application/web portal
- 2\. Navigate to the ABHA creation section
- 3\.Check if "Create ABHA " option is available

**Expected Result**

- 1\. User will have a choice to create ABHA using Aadhaar Biometrics.

### CRT_ABHA_204: Aadhaar Collection and Error Handling

Verify that the user can enter the Aadhaar number and the system validates its format and length, displaying appropriate error messages for invalid input.

**Steps**

- 1\. Navigate to Aadhaar input section.
- 2\. Enter an invalid Aadhaar number (e.g., fewer than 12 digits, alphabets, or special characters).

**Expected Result**

- 1\. If wrong Aadhaar number entered then system should display an error message "Aadhaar Number is not valid".

**For the tester**

- It is recommended that Aadhar number should be in masked format.

### CRT_ABHA_202: Consent collection

Verify that the system displays the correct consent/disclaimer language and collects user consent before proceeding with ABHA creation.

**Steps**

- 1\. System displays the consent language/disclaimer as per ABDM guidelines (refer approved consent language in cell number)
- 2\. User agrees to the consent using 'I Agree' checkbox or other approved mechanism (e.g., digital signature).

**Expected Result**

- 1\. User provides consent for sharing Aadhaar details for ABHA creation.
- 2\. System records the user's consent in compliance with the Health Data Management Policy

**For the tester**

- Approved consent language :
- https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=consentLanguage

### CRT_ABHA_203: Consent collection should be multilingual

The system should be able to provide the consent in languages other than English also

**Steps**

- 1\. System displays the consent language/disclaimer as per ABDM guidelines (refer approved consent language in cell number)
- 2\. User agrees to the consent using 'I Agree' checkbox or other approved mechanism (e.g., digital signature).

**Expected Result**

- 1\. User provides consent for sharing Aadhaar details for ABHA creation.
- 2\. System records the user's consent in compliance with the Health Data Management Policy

### CRT_ABHA_205: Biometric based Aadhaar Authentication

System must verify the biometrics (fingerprint or iris) of the user

**Steps**

- 1\. Scan biometrics (Fingerprint/Iris)
- 2\. Click on verify button

**Expected Result**

- 1\. System authenticates the user's Aadhaar through user's biometrics.
- 2\. In case of incorrect biometrices, the system displays an error as per API response.
- 3\. In case of correct biometrices, the system allows the user to proceed.

### CRT_ABHA_206: Communication Mobile Number Verification – I

If the communication mobile number provided by the user matches the Aadhaar-linked mobile number, the user should be directed to ABHA creation (No need of reverification)

**Steps**

- 1\.System verifies if the entered mobile number is the same as the Aadhaar-linked mobile number. If true, procced to next step.

**Expected Result**

- User proceeds with next steps of ABHA creation.

### CRT_ABHA_207: Communication Mobile Number verification-II

If communication mobile number is not same as Aadhaar linked mobile number then system must ask for the OTP to verify comuncation mobile number.

**Steps**

- 1\. System must verify the mobile number.
- 1\. System must send OTP on mobile number
- 2\. User enters the OTP and clicks on verify
- 3\. In case of incorrect OTP, the system displays an error
- 4\. In case of correct OTP, the system allows the user to proceed.
- 5\. Verify that the system enables the Resend OTP button after 60 seconds and allows a maximum of 2 resend attempts

**Expected Result**

- System verifies the communication mobile number

**For the tester**

- The mobile number corresponding to the communication mobile number (either same as aadhar linked or different) should be reflected on ABHA card

### CRT_ABHA_208: Suggested ABHA Address

System suggests available ABHA addresses and allows the user to select one from the list. Also system allows the user to create custom ABHA address.

**Steps**

- 1\. The system should allow the user to select the ABHA address giving atleast 3 available suggestions
- 2\. Also the system should have a provision to create a ABHA address with ABHA address Policy and validation rule should be print beside the field where ABHA Address is entered.
- Validation rules on ABHA Address to be set at the API level:
- 1\. Minimum length - 8 characters
- 2\. Maximum length - 18 characters (including @sbx or @abdm)
- 3\. Special characters allowed - 1 dot (.) and/or 1 underscore (_)
- 4\. Special characters cannot be in the beginning or at the end
- 5\. Alphanumeric - only numbers, only letters or any combination of numbers and letters is allowed.

**Expected Result**

- 1\. The system should display a list of available or suggested ABHA addresses.
- 2\.In addition to the suggested ABHA addresses, the user should have the option to enter a custom ABHA address.
- 3\. If the entered ABHA address is already in use, the system should display a clear message: "ABHA address already exists." and the system should also then provide the user with two options:
- a. Proceed with the existing ABHA address.
- b. Create a new ABHA address.

**For the tester**

- 1\. Validation rules should be highlighted in GREEN if validation criteria met else highlighted in RED

### CRT_ABHA_209: Display of ABHA Number

System must display the created ABHA Number along with profile details.

**Steps**

- 1\. System shows the 14-digit ABHA number and ABHA address generated along with all profile details.

**Expected Result**

- 1\. User should be able to view the generated ABHA Number and linked ABHA address in profile.

### CRT_ABHA_210: View and Download ABHA details. (If integrators is generating ABHA card)

System must have a provision to View / Download ABHA card

**Steps**

- 1\. The system should display the ABHA card to the user, as received in the response from the API.

**Expected Result**

- 1\. User should be able to view and download their ABHA Card with all the demographic details as given by API.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

### CRT_ABHA_211: View and Download ABHA details. (If integrators is not generating ABHA card)

System must have a provision to View details like ABHA number and ABHA address in the card (either ABHA card or any card being generated for their program/scheme/entity)

**Steps**

- 1\. If Integrator is not generating ABHA card then, they print the mentioned information on their program/scheme or any other card
- a. ABHA Number (Mandatory)
- b. ABHA Address (Mandatory)

**Expected Result**

- 1\. User should be able to view and download their ABHA Card with all the demographic details as given by API.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

## Screen requirements

### In plain words

The same journey as creation by Aadhaar OTP. A registered fingerprint or iris
device on your desk authenticates the person instead of an OTP.

### What happens

| Requirement | Cases |
|---|---|
| Creation offers Aadhaar biometric as a method | CRT_ABHA_201 |
| The Aadhaar field and the consent screen follow create-abha-aadhaar-otp | CRT_ABHA_204, CRT_ABHA_202, CRT_ABHA_203 |
| Capture the fingerprint or iris on the device and verify. A failed scan shows the API's error and the person scans again | CRT_ABHA_205 |
| The communication mobile, the address step, the profile and the card follow create-abha-aadhaar-otp | CRT_ABHA_206, CRT_ABHA_207, CRT_ABHA_208, CRT_ABHA_209, CRT_ABHA_210, CRT_ABHA_211 |

### How you know it worked

A scan on the device creates the ABHA and the journey reaches the same
address step, profile and card as the OTP route.

From `hiecm.concept.m1-screens-create-abha-biometric`.

## Calls

### Create ABHA, Fingerprint (`m1-create-abha-fingerprint`)

**Act: the calls in this journey, in order**

#### 1. Create ABHA - Aadhaar fingerprint (bio) (`m1_post_v3_enrollment_enrol_byaadhaar_fingerprint`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/byAadhaar \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'BENEFIT_NAME: {{Benefit Name}}' \
  --header 'Content-Type: application/json' \
  --data '{
  "authData": {
    "authMethods": [
      "bio"
    ],
    "bio": {
      "aadhaar": "{{encrypted aadhaar number}}",
      "fingerPrintAuthPid": "{{fingerPrintAuthPid}}",
      "mobile": "{{mobile number}}"
    }
  },
  "consent": {
    "code": "abha-enrollment",
    "version": "1.4"
  }
}'
```

#### 2. After ABHA creation - send OTP to verify mobile (optional) (`m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_64b04e`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "txnId": "{{txnId}}",
  "scope": [
    "abha-enrol",
    "mobile-verify"
  ],
  "loginHint": "mobile",
  "loginId": "{{encrypted mobileNumber}}",
  "otpSystem": "abdm"
}'
```

#### 3. After ABHA creation - verify mobile OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_3b237a`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/auth/byAbdm \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-enrol",
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

#### 4. After ABHA creation - send OTP to verify email (optional) (`m1_post_v3_enrollment_request_otp_email_verify_create_abh_4833d9`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "txnId": "{{txnId}}",
  "scope": [
    "abha-enrol",
    "email-verify"
  ],
  "loginHint": "email",
  "loginId": "{{encrypted email}}",
  "otpSystem": "abdm"
}'
```

#### 5. After ABHA creation - verify email OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_b696ba`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/auth/byAbdm \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-enrol",
    "email-verify"
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

#### 6. After ABHA creation - get ABHA address suggestions (`m1_get_v3_enrollment_enrol_suggestion_create_abha_fingerprint`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/suggestion \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'TRANSACTION_ID: {{txnId}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 7. After ABHA creation - create ABHA address (`m1_post_v3_enrollment_enrol_abha_address_create_abha_fingerprint`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/abha-address \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "txnId": "{{txnId}}",
  "abhaAddress": "{{ABHA Address}}",
  "preferred": 1
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "23acf181-339d-4771-b532-5c5df4a28d19",
  "healthIdNumber": "<ABHA_NUMBER>",
  "preferredAbhaAddress": "<ABHA_ADDRESS>"
}
```

### Create ABHA, IRIS (`m1-create-abha-iris`)

**Act: the calls in this journey, in order**

#### 1. Create ABHA - Aadhaar IRIS (`m1_post_v3_enrollment_enrol_byaadhaar_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/byAadhaar \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'BENEFIT_NAME: {{Benefit Name}}' \
  --header 'Content-Type: application/json' \
  --data '{
  "authData": {
    "authMethods": [
      "iris"
    ],
    "iris": {
      "aadhaar": "{{encrypted aadhaar number}}",
      "pid": "{{PID}}",
      "mobile": "{{mobile number}}"
    }
  },
  "consent": {
    "code": "abha-enrollment",
    "version": "1.4"
  }
}'
```

#### 2. After ABHA creation - send OTP to verify mobile (optional) (`m1_post_v3_enrollment_request_otp_mobile_verify_create_abha_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "txnId": "{{txnId}}",
  "scope": [
    "abha-enrol",
    "mobile-verify"
  ],
  "loginHint": "mobile",
  "loginId": "{{encrypted mobileNumber}}",
  "otpSystem": "abdm"
}'
```

#### 3. After ABHA creation - verify mobile OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_abha_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/auth/byAbdm \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-enrol",
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

#### 4. After ABHA creation - send OTP to verify email (optional) (`m1_post_v3_enrollment_request_otp_email_verify_create_abha_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/request/otp \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "txnId": "{{txnId}}",
  "scope": [
    "abha-enrol",
    "email-verify"
  ],
  "loginHint": "email",
  "loginId": "{{encrypted email}}",
  "otpSystem": "abdm"
}'
```

#### 5. After ABHA creation - verify email OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_email_verify_create_abha_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/auth/byAbdm \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-enrol",
    "email-verify"
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

#### 6. After ABHA creation - get ABHA address suggestions (`m1_get_v3_enrollment_enrol_suggestion_create_abha_iris`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/suggestion \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'TRANSACTION_ID: {{txnId}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 7. After ABHA creation - create ABHA address (`m1_post_v3_enrollment_enrol_abha_address_create_abha_iris`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/abha-address \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "txnId": "{{txnId}}",
  "abhaAddress": "{{ABHA Address}}",
  "preferred": 1
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "txnId": "23acf181-339d-4771-b532-5c5df4a28d19",
  "healthIdNumber": "<ABHA_NUMBER>",
  "preferredAbhaAddress": "<ABHA_ADDRESS>"
}
```

### ABHA Card & Profile (`m1-abha-card-profile`)

Built in [create-abha-aadhaar-otp](create-abha-aadhaar-otp.md). Reuse those calls.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| CRT_ABHA_201 | Create ABHA entry, method choice | None |
| CRT_ABHA_204 | Aadhaar number entry | None |
| CRT_ABHA_202 | Aadhaar consent | `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint`, `m1_post_v3_enrollment_enrol_byaadhaar_iris` |
| CRT_ABHA_203 | Aadhaar consent, language choice | None |
| CRT_ABHA_205 | Biometric capture and verify | `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint`, `m1_post_v3_enrollment_enrol_byaadhaar_iris` |
| CRT_ABHA_206 | Communication mobile entry | `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint`, `m1_post_v3_enrollment_enrol_byaadhaar_iris` |
| CRT_ABHA_207 | Communication mobile OTP | `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_64b04e`, `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_3b237a`, `m1_post_v3_enrollment_request_otp_mobile_verify_create_abha_iris`, `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_abha_iris` |
| CRT_ABHA_208 | ABHA address choice | `m1_get_v3_enrollment_enrol_suggestion_create_abha_fingerprint`, `m1_post_v3_enrollment_enrol_abha_address_create_abha_fingerprint`, `m1_get_v3_enrollment_enrol_suggestion_create_abha_iris`, `m1_post_v3_enrollment_enrol_abha_address_create_abha_iris` |
| CRT_ABHA_209 | Created ABHA profile | `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint`, `m1_post_v3_enrollment_enrol_byaadhaar_iris` |
| CRT_ABHA_210 | ABHA card, view and download | `m1_get_v3_profile_account_abha_card` |
| CRT_ABHA_211 | Integrator's own card with ABHA details | `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint`, `m1_post_v3_enrollment_enrol_byaadhaar_iris` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint` | `POST /abha/api/v3/enrollment/enrol/byAadhaar` | Create ABHA - Aadhaar fingerprint (bio) |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_64b04e` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify mobile (optional) |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_3b237a` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify mobile OTP (optional) |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abh_4833d9` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify email (optional) |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_b696ba` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify email OTP (optional) |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_fingerprint` | `GET /abha/api/v3/enrollment/enrol/suggestion` | After ABHA creation - get ABHA address suggestions |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_fingerprint` | `POST /abha/api/v3/enrollment/enrol/abha-address` | After ABHA creation - create ABHA address |
| `m1_post_v3_enrollment_enrol_byaadhaar_iris` | `POST /abha/api/v3/enrollment/enrol/byAadhaar` | Create ABHA - Aadhaar IRIS |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_abha_iris` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify mobile (optional) |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_abha_iris` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify mobile OTP (optional) |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abha_iris` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify email (optional) |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abha_iris` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify email OTP (optional) |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_iris` | `GET /abha/api/v3/enrollment/enrol/suggestion` | After ABHA creation - get ABHA address suggestions |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_iris` | `POST /abha/api/v3/enrollment/enrol/abha-address` | After ABHA creation - create ABHA address |

Headers the calls of Create ABHA by fingerprint or iris take: `TIMESTAMP`, `REQUEST-ID`, `BENEFIT_NAME`, `TRANSACTION_ID`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint` | 422 | `ABDM-1204` | UIDAI Error code : 501 : Invalid certificate identifier in “ci” attribute of “Skey”. |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_64b04e` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_3b237a` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_3b237a` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abh_4833d9` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_b696ba` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_b696ba` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_fingerprint` | 401 | `ABDM-1017` | Invalid Transaction Id |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_fingerprint` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_abha_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_abha_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_abha_iris` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abha_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abha_iris` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abha_iris` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_iris` | 401 | `ABDM-1017` | Invalid Transaction Id |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_iris` | 401 | `900901` | Invalid Credentials |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| CRT_ABHA_201 | nothing | none |
| CRT_ABHA_204 | nothing | none |
| CRT_ABHA_202 | `aadhaar-holder`, `biometric-device` | none |
| CRT_ABHA_203 | nothing | none |
| CRT_ABHA_205 | `aadhaar-holder`, `biometric-device` | none |
| CRT_ABHA_206 | `biometric-device`, `aadhaar-without-abha` | none |
| CRT_ABHA_207 | `biometric-device`, `aadhaar-without-abha`, `second-mobile`, `otp` | none |
| CRT_ABHA_208 | `aadhaar-holder`, `biometric-device` | none |
| CRT_ABHA_209 | `aadhaar-holder`, `biometric-device` | none |
| CRT_ABHA_210 | `aadhaar-holder`, `biometric-device` | none |
| CRT_ABHA_211 | `aadhaar-holder`, `biometric-device` | none |

### CRT_ABHA_201 to 211: create an ABHA by Aadhaar biometric, fingerprint or iris

Each case runs as its counterpart in CRT_ABHA_101 to 116 and records the counterpart's evidence, with the differences stated.

The creation call is `m1_post_v3_enrollment_enrol_byaadhaar_fingerprint` or `m1_post_v3_enrollment_enrol_byaadhaar_iris`. The calls after it are the same flow's: for fingerprint `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_64b04e`, `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_3b237a`, `m1_get_v3_enrollment_enrol_suggestion_create_abha_fingerprint` and `m1_post_v3_enrollment_enrol_abha_address_create_abha_fingerprint`; for iris `m1_post_v3_enrollment_request_otp_mobile_verify_create_abha_iris`, `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_abha_iris`, `m1_get_v3_enrollment_enrol_suggestion_create_abha_iris` and `m1_post_v3_enrollment_enrol_abha_address_create_abha_iris`.

If you do not claim biometric creation, the whole group is `not-run`. If you claim it and no registered fingerprint or iris device is at hand, record each case that scans as `needs-human`, naming the device, after it was asked for at readiness and again at the case, and the tester said they cannot provide it in this run.

Loop limit: 3 passes per test case.

#### CRT_ABHA_201, the option exists. `sandbox`

As CRT_ABHA_101, with the creation call above. Exit condition: it returns 200 with `tokens.token` and `ABHAProfile.ABHANumber`.

#### CRT_ABHA_204, an invalid Aadhaar number is refused before any call. `screen`

As CRT_ABHA_104.

#### CRT_ABHA_202, consent is shown and recorded. `screen`

As CRT_ABHA_102.

#### CRT_ABHA_203, consent in another language. `screen`

As CRT_ABHA_103.

#### CRT_ABHA_205, the biometric is verified, and a failed scan is refused. `sandbox`, `human`

The person scans a fingerprint or an iris. Exit condition: the creation call returns 200 as in CRT_ABHA_201. For a failed scan, the specification documents a 422 with `error.code` `ABDM-1204` and a `message` carrying the UIDAI error code. Your screen shows the message the API returned and lets the person scan again. Paste what the sandbox returned.

#### CRT_ABHA_206, the communication mobile is the Aadhaar mobile. `sandbox`

As CRT_ABHA_108, with the mobile verify call of the flow you ran.

#### CRT_ABHA_207, a different communication mobile is verified. `sandbox`, `human`

As CRT_ABHA_109, with the mobile verify calls of the flow you ran.

#### CRT_ABHA_208, the ABHA address is suggested and validated. `sandbox` and `screen`

As CRT_ABHA_112, with the suggestion and address calls of the flow you ran.

#### CRT_ABHA_209, the ABHA number is displayed. `screen`

As CRT_ABHA_113.

#### CRT_ABHA_210, the ABHA card can be viewed and downloaded. `sandbox` and `screen`

As CRT_ABHA_114.

#### CRT_ABHA_211, your own card carries the ABHA details. `screen`

As CRT_ABHA_115.
