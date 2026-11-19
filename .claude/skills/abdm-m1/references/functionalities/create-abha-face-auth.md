# Create ABHA by face authentication

Sheet group: ABHA creation via Face Auth.

Functionality 10 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Create ABHA by face authentication holds no mandatory case |
| Scaffold | Calls | Every call in `m1-create-abha-face-authentication` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Create ABHA by face authentication works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Create ABHA by face authentication succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `CRT_ABHA_101_FA`, `CRT_ABHA_102_FA`, `CRT_ABHA_103_FA`, `CRT_ABHA_104_FA`, `CRT_ABHA_105_FA`, `CRT_ABHA_106_FA`, `CRT_ABHA_107_FA`, `CRT_ABHA_108_FA`, `CRT_ABHA_109_FA`, `CRT_ABHA_110_FA`, `CRT_ABHA_111_FA`, `CRT_ABHA_112_FA`, `CRT_ABHA_113_FA`, `CRT_ABHA_114_FA`, `CRT_ABHA_115_FA`, `CRT_ABHA_116_FA`, `CRT_ABHA_117_FA`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Create ABHA by face authentication |

Loop limit: 3 passes through Test for Create ABHA by face authentication. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `CRT_ABHA_101_FA`, `CRT_ABHA_102_FA`, `CRT_ABHA_103_FA`, `CRT_ABHA_104_FA`, `CRT_ABHA_105_FA`, `CRT_ABHA_106_FA`, `CRT_ABHA_107_FA`, `CRT_ABHA_108_FA`, `CRT_ABHA_109_FA`, `CRT_ABHA_110_FA`, `CRT_ABHA_111_FA`, `CRT_ABHA_112_FA`, `CRT_ABHA_113_FA`, `CRT_ABHA_114_FA`, `CRT_ABHA_115_FA`, `CRT_ABHA_116_FA`, `CRT_ABHA_117_FA`.
An integration that already exists enters Create ABHA by face authentication at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| CRT_ABHA_101_FA | optional | optional | Create ABHA Option using Face Auth |
| CRT_ABHA_102_FA | optional | optional | Aadhaar Collection and Error Handling |
| CRT_ABHA_103_FA | optional | optional | Consent Collection |
| CRT_ABHA_104_FA | optional | optional | Consent Collection should be Multilingual |
| CRT_ABHA_105_FA | optional | optional | Generate Face Auth QR Code after Aadhaar Entry |
| CRT_ABHA_106_FA | optional | optional | Scan Face Auth QR Code using ABHA App |
| CRT_ABHA_107_FA | optional | optional | Redirect for ABHA Face RD App Installation |
| CRT_ABHA_108_FA | optional | optional | Successful Aadhaar Face Authentication |
| CRT_ABHA_109_FA | optional | optional | Face Authentication Failure / PID Error Handling |
| CRT_ABHA_110_FA | optional | optional | Communication Mobile Number Collection after Face Auth |
| CRT_ABHA_111_FA | optional | optional | Communication Mobile Number OTP Collection |
| CRT_ABHA_112_FA | optional | optional | Resend OTP for Communication Mobile Number |
| CRT_ABHA_113_FA | optional | optional | Suggested ABHA Address |
| CRT_ABHA_114_FA | optional | optional | Display of Created ABHA Number |
| CRT_ABHA_115_FA | optional | optional | View and Download ABHA Card (If Integrator is Generating ABHA Card) |
| CRT_ABHA_116_FA | optional | optional | View ABHA Details if Integrator is not Generating ABHA Card |
| CRT_ABHA_117_FA | optional | optional | Returning Patient / Revisit Handling |

### CRT_ABHA_101_FA: Create ABHA Option using Face Auth

The system must provide an option to create ABHA through Aadhaar based Face Authentication.

**Steps**

- 1\. Launch the application / web portal.
- 2\. Navigate to the ABHA creation section.
- 3\. Check if "Create ABHA" option is available.
- 4\. Check if Face Authentication is available as an authentication mode for Aadhaar based ABHA creation.

**Expected Result**

- 1\. User should have an option to create ABHA.
- 2\. User should be able to select / proceed with Face Authentication mode for Aadhaar based ABHA creation.

### CRT_ABHA_102_FA: Aadhaar Collection and Error Handling

Verify that the user can enter the Aadhaar number and the system validates its format and length before generating Face Authentication QR Code.

**Steps**

- 1\. Navigate to Aadhaar input section.
- 2\. Enter an invalid Aadhaar number, such as fewer than 12 digits, alphabets, special characters, or blank input.
- 3\. Click on Proceed / Generate QR Code as applicable.

**Expected Result**

- 1\. If wrong Aadhaar number is entered, the system should display an error message: "Aadhaar Number is not valid".
- 2\. Face Authentication QR Code should not be generated for invalid Aadhaar number.
- 3\. It is recommended that Aadhaar number should be displayed in masked format after entry.

### CRT_ABHA_103_FA: Consent Collection

Verify that the system displays the correct consent / disclaimer language and collects user consent before proceeding with ABHA creation through Face Authentication.

**Steps**

- 1\. System displays the consent language / disclaimer as per ABDM guidelines.
- 2\. User agrees to the consent using "I Agree" checkbox or other approved mechanism.
- 3\. User proceeds with Aadhaar Face Authentication flow.

**Expected Result**

- 1\. User provides consent for using Aadhaar details for ABHA creation.
- 2\. System records the user consent in compliance with the Health Data Management Policy.
- 3\. System should not proceed to generate Face Authentication QR Code until consent is captured.

### CRT_ABHA_104_FA: Consent Collection should be Multilingual

The system should be able to provide the consent in languages other than English also.

**Steps**

- 1\. Select a supported language other than English.
- 2\. System displays the consent language / disclaimer as per ABDM guidelines.
- 3\. User agrees to the consent using "I Agree" checkbox or other approved mechanism.

**Expected Result**

- 1\. Consent language should be displayed in the selected language.
- 2\. User should be able to provide consent.
- 3\. System should record the consent in compliance with the Health Data Management Policy.

### CRT_ABHA_105_FA: Generate Face Auth QR Code after Aadhaar Entry

After Aadhaar number and consent are captured, the system must generate a Face Authentication QR Code on HMIS / HIP screen.

**Steps**

- 1\. Enter valid Aadhaar number.
- 2\. Capture consent.
- 3\. Select Face Authentication mode.
- 4\. Click on Generate QR Code / Proceed.

**Expected Result**

- 1\. Face Authentication QR Code should be generated successfully by HMIS / HIP.
- 2\. QR Code should be displayed clearly on the HMIS / HIP screen.
- 3\. User should be instructed to scan the QR Code using ABHA App scanner from logged-out landing page.

### CRT_ABHA_106_FA: Scan Face Auth QR Code using ABHA App

The system must allow the patient to scan the Face Authentication QR Code using ABHA App scanner.

**Steps**

- 1\. Open ABHA App on the patient mobile device.
- 2\. Ensure ABHA App is logged out.
- 3\. On ABHA App landing page, tap the scanner icon available on the top-left side.
- 4\. Scan the QR Code displayed on HMIS / HIP screen.

**Expected Result**

- 1\. QR Code should be scanned successfully using ABHA App scanner.
- 2\. ABHA App should initiate the Face Authentication flow.
- 3\. Patient should be redirected to ABHA Face RD application for face capture/authentication.

### CRT_ABHA_107_FA: Redirect for ABHA Face RD App Installation

The system / app must handle scenarios where ABHA Face RD application is not installed on the patient mobile device.

**Steps**

- 1\. Scan Face Authentication QR Code using ABHA App.
- 2\. Ensure ABHA Face RD application is not installed on the mobile device.
- 3\. Proceed with Face Authentication redirection.

**Expected Result**

- 1\. Patient should be redirected to Play Store / App Store for ABHA Face RD application installation.
- 2\. Patient should be able to download and install ABHA Face RD application.
- 3\. After installation, patient should be able to continue or restart Face Authentication flow as per app behavior.

### CRT_ABHA_108_FA: Successful Aadhaar Face Authentication

The system must authenticate the user using Aadhaar Face Authentication through ABHA Face RD application.

**Steps**

- 1\. Scan the Face Authentication QR Code using ABHA App.
- 2\. ABHA Face RD application opens.
- 3\. Patient captures face using the device camera.
- 4\. Submit face authentication request.

**Expected Result**

- 1\. Face Authentication should be completed successfully.
- 2\. Successful authentication confirmation should be shown on the patient mobile device.
- 3\. HMIS / HIP should receive successful authentication status.
- 4\. System should allow the user to proceed to communication mobile number entry step.

### CRT_ABHA_109_FA: Face Authentication Failure / PID Error Handling

The system must handle unsuccessful Face Authentication attempts and display PID error code/message returned as per API response.

**Steps**

- 1\. Scan Face Authentication QR Code.
- 2\. Open ABHA Face RD application.
- 3\. Perform face scan with unsuccessful authentication scenario, such as incorrect face, poor capture quality, camera issue, timeout, or authentication failure.
- 4\. Submit authentication request.

**Expected Result**

- 1\. Face Authentication should fail.
- 2\. User should not proceed to communication mobile number verification / ABHA creation.
- 3\. HMIS should display the PID error code and error message returned by the API.
- 4\. User should be allowed to retry authentication or regenerate QR Code as per implementation/business rules.

### CRT_ABHA_110_FA: Communication Mobile Number Collection after Face Auth

After successful Aadhaar Face Authentication, the system must ask the user to enter communication mobile number for ABHA creation.

**Steps**

- 1\. Complete Aadhaar Face Authentication successfully.
- 2\. System displays communication mobile number entry field.
- 3\. Enter communication mobile number.
- 4\. Click on Send OTP / Proceed.

**Expected Result**

- 1\. Communication mobile number field should be displayed after successful Face Authentication.
- 2\. System should validate mobile number format.
- 3\. OTP should be triggered to the entered communication mobile number, irrespective of whether it is same as Aadhaar-linked mobile number or different from Aadhaar-linked mobile number.

### CRT_ABHA_111_FA: Communication Mobile Number OTP Collection

User receives OTP on the entered communication mobile number and system must allow the user to enter and verify OTP.

**Steps**

- 1\. Receive OTP on the entered communication mobile number.
- 2\. Enter OTP in the OTP field.
- 3\. Submit OTP for verification.

**Expected Result**

- 1\. User should be able to input the OTP.
- 2\. System should accept only a 6-digit numeric OTP.
- 3\. In case of correct OTP, the system should verify the communication mobile number and proceed with ABHA creation.
- 4\. In case of incorrect OTP, incomplete OTP, or expired OTP, system should display message as per API response.

### CRT_ABHA_112_FA: Resend OTP for Communication Mobile Number

Verify that the system enables the Resend OTP button after 60 seconds and allows a maximum of 2 resend attempts for communication mobile OTP.

**Steps**

- 1\. Trigger OTP on communication mobile number.
- 2\. Wait for 60 seconds.
- 3\. Click the Resend OTP button.
- 4\. Receive the new OTP on communication mobile number.
- 5\. Enter the newly received OTP.
- 6\. Try to resend OTP more than two times.

**Expected Result**

- 1\. User can resend the OTP a maximum of 2 times.
- 2\. Resend OTP button should be enabled only after 60 seconds.
- 3\. New OTP should be received and can be verified.
- 4\. If user tries to resend more than 2 times, system should display: "Maximum OTP resend attempts reached. Please try again after 30 mins."
- 5\. OTP counter should be visible.

### CRT_ABHA_113_FA: Suggested ABHA Address

System suggests available ABHA addresses and allows the user to select one from the list. System also allows the user to create custom ABHA address.

**Steps**

- 1\. After successful communication mobile OTP verification, system displays ABHA address suggestions.
- 2\. User selects one of the suggested ABHA addresses or enters a custom ABHA address.
- 3\. System validates the ABHA address as per policy rules.
- Validation rules on ABHA Address to be set at API level:
- 1\. Minimum length - 8 characters.
- 2\. Maximum length - 18 characters including @sbx or @abdm.
- 3\. Special characters allowed - 1 dot (.) and/or 1 underscore (_).
- 4\. Special characters cannot be at the beginning or at the end.
- 5\. Alphanumeric - only numbers, only letters, or any combination of numbers and letters is allowed.

**Expected Result**

- 1\. System should display at least 3 available ABHA address suggestions.
- 2\. User should have option to enter a custom ABHA address.
- 3\. If entered ABHA address is already in use, system should display: "ABHA address already exists."
- 4\. System should provide options to proceed with existing ABHA address or create a new ABHA address, as applicable.
- 5\. Validation rules should be highlighted in GREEN if validation criteria are met and RED if validation criteria are not met.

### CRT_ABHA_114_FA: Display of Created ABHA Number

System must display the created ABHA Number along with profile details after successful ABHA creation through Face Authentication and communication mobile OTP verification.

**Steps**

- 1\. Complete Aadhaar Face Authentication successfully.
- 2\. Complete communication mobile number OTP verification successfully.
- 3\. Select/create ABHA address if applicable.
- 4\. Complete ABHA creation.

**Expected Result**

- 1\. System should display the 14-digit ABHA number and ABHA address generated along with profile details.
- 2\. User should be able to view the generated ABHA Number and linked ABHA address in profile.
- 3\. Communication mobile number entered and verified should be reflected in the created ABHA profile / card as per API response.

### CRT_ABHA_115_FA: View and Download ABHA Card (If Integrator is Generating ABHA Card)

System must have a provision to view / download ABHA card if integrator is generating ABHA card.

**Steps**

- 1\. Complete ABHA creation through Aadhaar Face Authentication.
- 2\. Navigate to View / Download ABHA Card option.
- 3\. Click on View / Download ABHA Card.

**Expected Result**

- 1\. System should display ABHA card to the user as received in the response from API.
- 2\. User should be able to view and download ABHA Card with all demographic details as given by API.
- 3\. Note: In case of non-KYC ABHA address, users will not be able to download ABHA card. In order to download ABHA card, details should be KYC verified.

### CRT_ABHA_116_FA: View ABHA Details if Integrator is not Generating ABHA Card

System must have a provision to view details like ABHA number and ABHA address in the card being generated for the program / scheme / entity.

**Steps**

- 1\. Complete ABHA creation through Aadhaar Face Authentication.
- 2\. If integrator is not generating ABHA card, open the program / scheme / entity card generated by the system.
- 3\. Verify ABHA details printed / displayed on the card.

**Expected Result**

- 1\. Program / scheme / entity card should display:
- a. ABHA Number - Mandatory.
- b. ABHA Address - Mandatory.
- 2\. User should be able to view ABHA details as per business requirement.
- 3\. Note: In case of non-KYC ABHA address, users will not be able to download ABHA card. In order to download ABHA card, details should be KYC verified.

### CRT_ABHA_117_FA: Returning Patient / Revisit Handling

System must handle returning patient scenarios and prevent duplicate UHID / Beneficiary ID creation after ABHA creation through Face Authentication.

**Steps**

- 1\. The system captures patient information through ABHA creation via Face Authentication.
- 2\. HMIS searches existing records using patient mobile number, name, gender and age.
- 3\. If Unique Beneficiary ID such as MRD / UHID is provided, system also performs search using this ID.
- 4\. If an existing beneficiary is found and all matching criteria are satisfied, system links the current registration / encounter to existing Beneficiary ID.
- 5\. If match fails due to mismatch in any critical demographic field, system creates a new Beneficiary ID.

**Expected Result**

- 1\. For returning patients, HMIS shall perform beneficiary matching using demographic attributes and/or existing UHID/MRD.
- 2\. If a valid match is found, system shall reuse existing Beneficiary ID/UHID and link current registration/encounter to it.
- 3\. This process shall prevent creation of multiple UHIDs for same patient.
- 4\. A new Beneficiary ID/UHID shall only be created when no valid match exists.

## Screen requirements

### In plain words

Your screen shows a QR code. The person scans it with the ABHA app, logged
out, and captures their face in the ABHA Face RD app on their own phone. Your
screen waits for the result, then carries on to the communication mobile.

### What happens

| Requirement | Cases |
|---|---|
| Creation offers face authentication as a method for Aadhaar based creation | CRT_ABHA_101_FA |
| An invalid Aadhaar number is refused on the screen with "Aadhaar Number is not valid", and no QR code is generated | CRT_ABHA_102_FA |
| The consent screen from create-abha-aadhaar-otp, with its language choice, comes before the QR code. No QR code until consent is in | CRT_ABHA_103_FA, CRT_ABHA_104_FA |
| Show the QR code clearly on your screen, with the instruction to scan it with the scanner on the ABHA app's logged out landing page | CRT_ABHA_105_FA |
| Wait for the face authentication status, polling `capturePID`, and move to the communication mobile only on success | CRT_ABHA_108_FA |
| A failed face authentication stops the journey and shows the PID error code and message the API returned. The person can retry, or a new QR code is generated | CRT_ABHA_109_FA |
| The communication mobile is always verified by OTP in this route, whether or not it is the Aadhaar linked one. The OTP and resend rules are in create-abha-aadhaar-otp | CRT_ABHA_110_FA, CRT_ABHA_111_FA, CRT_ABHA_112_FA |
| The address step, the profile, the card and a returning patient follow create-abha-aadhaar-otp, and the profile and card show the communication mobile verified here | CRT_ABHA_113_FA, CRT_ABHA_114_FA, CRT_ABHA_115_FA, CRT_ABHA_116_FA, CRT_ABHA_117_FA |
| Scanning the QR code and installing the ABHA Face RD app happen in the ABHA app on the patient's phone, and are judged on the case text there. Your product's part is the QR code and the instruction beside it | CRT_ABHA_106_FA, CRT_ABHA_107_FA |

### How you know it worked

The QR code appears only after consent and a valid Aadhaar, and the created
profile shows the mobile verified after face authentication.

From `hiecm.concept.m1-screens-create-abha-face-auth`.

## Calls

### Create ABHA, Face Authentication (`m1-create-abha-face-authentication`)

**Act: the calls in this journey, in order**

#### 1. Face auth - generate transaction ID (init) (`m1_post_v3_enrollment_enrol_auth_init_create_abha_face_au_4dea33`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/auth/init \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "abha-enrol",
    "face-auth"
  ]
}'
```

#### 2. Face auth - capture PID / track status (`m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e`)

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

#### 3. Create ABHA - Aadhaar face authentication (`m1_post_v3_enrollment_enrol_byaadhaar_face`)

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
      "face_auth"
    ],
    "face": {
      "txnId": "881f2bf5-7377-4067-b50e-1e6ff100b3cc",
      "aadhaar": "{{encrypted aadhaar number}}",
      "mobile": "{{mobile number}}"
    }
  },
  "consent": {
    "code": "abha-enrollment",
    "version": "1.4"
  }
}'
```

#### 4. After ABHA creation - send OTP to verify mobile (optional) (`m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_6474ce`)

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

#### 5. After ABHA creation - verify mobile OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_b555fb`)

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

#### 6. After ABHA creation - send OTP to verify email (optional) (`m1_post_v3_enrollment_request_otp_email_verify_create_abh_880d7e`)

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

#### 7. After ABHA creation - verify email OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_d8de3e`)

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

#### 8. After ABHA creation - get ABHA address suggestions (`m1_get_v3_enrollment_enrol_suggestion_create_abha_face_au_848b26`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/suggestion \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'TRANSACTION_ID: {{txnId}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 9. After ABHA creation - create ABHA address (`m1_post_v3_enrollment_enrol_abha_address_create_abha_face_4b1f33`)

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
| CRT_ABHA_101_FA | Create ABHA entry, method choice | None |
| CRT_ABHA_102_FA | Aadhaar number entry | None |
| CRT_ABHA_103_FA | Aadhaar consent | `m1_post_v3_enrollment_enrol_byaadhaar_face` |
| CRT_ABHA_104_FA | Aadhaar consent, language choice | None |
| CRT_ABHA_105_FA | Face authentication QR code | `m1_post_v3_enrollment_enrol_auth_init_create_abha_face_au_4dea33` |
| CRT_ABHA_106_FA | ABHA app scanner | None |
| CRT_ABHA_107_FA | ABHA app, Face RD install redirect | None |
| CRT_ABHA_108_FA | Face authentication status, then mobile entry | `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e`, `m1_post_v3_enrollment_enrol_byaadhaar_face` |
| CRT_ABHA_109_FA | Face authentication failure, PID error | `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e`, `m1_post_v3_enrollment_enrol_byaadhaar_face` |
| CRT_ABHA_110_FA | Communication mobile entry | `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_6474ce` |
| CRT_ABHA_111_FA | Communication mobile OTP | `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_b555fb` |
| CRT_ABHA_112_FA | Communication mobile OTP, resend | `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_6474ce` |
| CRT_ABHA_113_FA | ABHA address choice | `m1_get_v3_enrollment_enrol_suggestion_create_abha_face_au_848b26`, `m1_post_v3_enrollment_enrol_abha_address_create_abha_face_4b1f33` |
| CRT_ABHA_114_FA | Created ABHA profile | `m1_post_v3_enrollment_enrol_byaadhaar_face`, `m1_get_v3_profile_account` |
| CRT_ABHA_115_FA | ABHA card, view and download | `m1_get_v3_profile_account_abha_card` |
| CRT_ABHA_116_FA | Integrator's own card with ABHA details | `m1_get_v3_profile_account` |
| CRT_ABHA_117_FA | Patient registration, returning patient match | None |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_enrollment_enrol_auth_init_create_abha_face_au_4dea33` | `POST /abha/api/v3/enrollment/enrol/auth/init` | Face auth - generate transaction ID (init) |
| `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e` | `POST /abha/api/v3/enrollment/enrol/capturePID` | Face auth - capture PID / track status |
| `m1_post_v3_enrollment_enrol_byaadhaar_face` | `POST /abha/api/v3/enrollment/enrol/byAadhaar` | Create ABHA - Aadhaar face authentication |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_6474ce` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify mobile (optional) |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_b555fb` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify mobile OTP (optional) |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abh_880d7e` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify email (optional) |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_d8de3e` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify email OTP (optional) |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_face_au_848b26` | `GET /abha/api/v3/enrollment/enrol/suggestion` | After ABHA creation - get ABHA address suggestions |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_face_4b1f33` | `POST /abha/api/v3/enrollment/enrol/abha-address` | After ABHA creation - create ABHA address |

Headers the calls of Create ABHA by face authentication take: `REQUEST-ID`, `TIMESTAMP`, `BENEFIT_NAME`, `TRANSACTION_ID`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_enrollment_enrol_auth_init_create_abha_face_au_4dea33` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e` | 400 | `ABDM-1017` | Invalid transaction, either the transaction is expired or not found |
| `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_6474ce` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_b555fb` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_b555fb` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abh_880d7e` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_d8de3e` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_d8de3e` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_face_au_848b26` | 401 | `ABDM-1017` | Invalid Transaction Id |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_face_4b1f33` | 401 | `900901` | Invalid Credentials |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| CRT_ABHA_101_FA | nothing | none |
| CRT_ABHA_102_FA | nothing | none |
| CRT_ABHA_103_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| CRT_ABHA_104_FA | nothing | none |
| CRT_ABHA_105_FA | `aadhaar-holder` | none |
| CRT_ABHA_106_FA | `aadhaar-holder`, `abha-app` | none |
| CRT_ABHA_107_FA | `abha-app`, `face-device` | none |
| CRT_ABHA_108_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| CRT_ABHA_109_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| CRT_ABHA_110_FA | `abha-app`, `face-device`, `aadhaar-without-abha` | none |
| CRT_ABHA_111_FA | `abha-app`, `face-device`, `aadhaar-without-abha`, `otp` | none |
| CRT_ABHA_112_FA | `abha-app`, `face-device`, `aadhaar-without-abha`, `otp` | none |
| CRT_ABHA_113_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| CRT_ABHA_114_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| CRT_ABHA_115_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| CRT_ABHA_116_FA | `aadhaar-holder`, `abha-app`, `face-device` | none |
| CRT_ABHA_117_FA | `patient-registered` | none |

### CRT_ABHA_101_FA to 117_FA: create an ABHA by Aadhaar face authentication

The set lists no API for this group. ABDM publishes the face authentication creation flow, so the operation ids below are the ones that observe it. `hiecm.flow.m1-create-abha-face-auth`

Face authentication is a `human` step on a device. The person scans a QR code from your screen with the ABHA app, logged out, and captures their face in the ABHA Face RD app on their phone. Ask for that phone and that person at readiness and again at each case. Without them, record every case from CRT_ABHA_106_FA on that you claim as `needs-human`, naming what was asked, after it was asked for at readiness and again at the case, and the tester said they cannot provide it in this run. A case you do not claim is `not-run`, because the whole group is optional.

Loop limit: 3 passes per test case.

**Preconditions.** A gateway access token less than 30 minutes old. A person present with their Aadhaar number and a phone with the ABHA app installed and logged out. Their Aadhaar number searched first on the login path and not found.

#### CRT_ABHA_101_FA, the face authentication option exists. `screen`

Your ABHA creation screen offers face authentication as a way to authenticate the Aadhaar number. Evidence: the screen with the option.

#### CRT_ABHA_102_FA, an invalid Aadhaar number is refused before a QR code. `screen`

As CRT_ABHA_104, with blank input as well. No QR code is generated for an invalid number, so no `m1_post_v3_enrollment_enrol_auth_init_create_abha_face_au_4dea33` call is in the log for that attempt.

#### CRT_ABHA_103_FA, consent comes before the QR code. `screen`

As CRT_ABHA_102. Your system does not generate the face authentication QR code until consent is recorded. Evidence: the consent screen, the stored record, and no init call before it in the log. `hiecm.concept.m1-screen-contract`

#### CRT_ABHA_104_FA, consent in another language. `screen`

As CRT_ABHA_103.

#### CRT_ABHA_105_FA, the face authentication QR code is generated. `sandbox` and `screen`

After the Aadhaar number and consent, your system generates a transaction and shows it as a QR code.

Exit condition: `m1_post_v3_enrollment_enrol_auth_init_create_abha_face_au_4dea33` returns 200 with a `txnId`. Screen check: the QR code is shown clearly, and the person is told to scan it with the scanner on the logged out ABHA app's landing page.

#### CRT_ABHA_106_FA, the QR code is scanned in the ABHA app. `human`

The person opens the ABHA app logged out, taps the scanner at the top left of the landing page, and scans your QR code. The ABHA app starts face authentication and opens the ABHA Face RD app. No call of yours proves the scan. Evidence: the phone screen after the scan, and the `status` from `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e` pasted at that moment.

#### CRT_ABHA_107_FA, the ABHA Face RD app is not installed. `human`

On a phone without the ABHA Face RD app, the scan sends the person to the Play Store or App Store to install it, and they can then continue or restart. This is the ABHA app's behaviour, not your system's. Evidence: the phone screen at the store. If you claim the case and no such phone is available, record `needs-human` naming what was asked, after it was asked for at readiness and again at the case, and the tester said they cannot provide it in this run.

#### CRT_ABHA_108_FA, face authentication succeeds. `sandbox`, `human`

The person captures their face. Poll the status every 5 to 10 seconds while they do.

Exit condition: `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e` returns 200 with `status` `COMPLETE`. Screen check: the phone shows success, and your system moves on to the communication mobile step.

#### CRT_ABHA_109_FA, a failed face authentication is refused. `sandbox`, `human`

The person does a scan that fails: another face, a poor capture, or a timeout.

Exit condition: `m1_post_v3_enrollment_enrol_capturepid_create_abha_face_a_417d5e` returns 200 with `status` `FAILED` and a `message`. Your screen shows that message, does not go on to the mobile step or creation, and lets the person retry or generate a new QR code.

#### CRT_ABHA_110_FA, the communication mobile is collected after face authentication. `sandbox`, `human`

Your system asks for the communication mobile after face authentication, checks its format, and sends an OTP to it. The set asks for the OTP whether or not this is the Aadhaar linked mobile.

Exit condition: two literals, both pasted.

1. `m1_post_v3_enrollment_enrol_byaadhaar_face`, sent with the `txnId` from CRT_ABHA_108_FA and that mobile, returns 200 with `tokens.token` present and `ABHAProfile.ABHANumber` present.
2. `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_6474ce` returns 200 with a `txnId` and a `message` naming the masked mobile.

#### CRT_ABHA_111_FA, the communication mobile OTP is verified. `sandbox`, `human`

Two observations, both needed. The person enters both OTPs. Stop for each.

1. A wrong OTP: `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_b555fb` returns 400 with `description` naming an invalid OTP value, and your screen shows that error.
2. The right OTP: the same call returns 200 with `authResult` `success`.

Screen check: the OTP field accepts only six digits.

#### CRT_ABHA_112_FA, resend the communication mobile OTP. `screen`

As CRT_ABHA_106, for the communication mobile OTP.

#### CRT_ABHA_113_FA, the ABHA address is suggested and validated. `sandbox` and `screen`

As CRT_ABHA_112, with the face flow's calls. Exit condition: `m1_get_v3_enrollment_enrol_suggestion_create_abha_face_au_848b26` returns 200 with `abhaAddressList` holding at least three entries, and `m1_post_v3_enrollment_enrol_abha_address_create_abha_face_4b1f33` returns 200 with `preferredAbhaAddress` equal to the one chosen.

#### CRT_ABHA_114_FA, the ABHA number is displayed. `sandbox` and `screen`

As CRT_ABHA_113. Exit condition: `m1_get_v3_profile_account`, sent with the `X-token` from CRT_ABHA_110_FA, returns 200 with the same `ABHANumber` and a masked `mobile` ending in the digits of the mobile verified in CRT_ABHA_111_FA.

#### CRT_ABHA_115_FA, the ABHA card can be viewed and downloaded. `sandbox` and `screen`

As CRT_ABHA_114.

#### CRT_ABHA_116_FA, your own card carries the ABHA details. `screen`

As CRT_ABHA_115.

#### CRT_ABHA_117_FA, a returning patient is matched, not registered again. `screen`

As CRT_ABHA_116, for a person created by face authentication.
