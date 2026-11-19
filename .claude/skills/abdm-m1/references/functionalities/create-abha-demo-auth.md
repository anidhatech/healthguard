# Create ABHA by demographic authentication

Sheet group: ABHA Creation Through Demo Auth/ Offline Mode.

Functionality 16 of 17 in M1's build order. Create ABHA by demographic authentication applies to government entities only. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `CRT_ABHA_301`, `CRT_ABHA_302`, `CRT_ABHA_304`, `CRT_ABHA_305`, `CRT_ABHA_306`, `CRT_ABHA_307`, `CRT_ABHA_308`, `CRT_ABHA_309`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Every call in `m1-create-abha-demo-auth` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Create ABHA by demographic authentication works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Create ABHA by demographic authentication succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `CRT_ABHA_301`, `CRT_ABHA_302`, `CRT_ABHA_304`, `CRT_ABHA_305`, `CRT_ABHA_306`, `CRT_ABHA_307`, `CRT_ABHA_308`, `CRT_ABHA_309` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Create ABHA by demographic authentication |

Loop limit: 3 passes through Test for Create ABHA by demographic authentication. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `CRT_ABHA_301`, `CRT_ABHA_302`, `CRT_ABHA_303`, `CRT_ABHA_304`, `CRT_ABHA_305`, `CRT_ABHA_306`, `CRT_ABHA_307`, `CRT_ABHA_308`, `CRT_ABHA_309`.
An integration that already exists enters Create ABHA by demographic authentication at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: CRT_ABHA_301, CRT_ABHA_302, CRT_ABHA_304, CRT_ABHA_305, CRT_ABHA_306, CRT_ABHA_307, CRT_ABHA_308 or CRT_ABHA_309. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| CRT_ABHA_301 | mandatory | not applicable | Create ABHA Option |
| CRT_ABHA_302 | mandatory | not applicable | Consent collection |
| CRT_ABHA_303 | optional | not applicable | Consent collection should be multilingual |
| CRT_ABHA_304 | mandatory | not applicable | Aadhaar Collection and Error Handling |
| CRT_ABHA_305 | mandatory | not applicable | Demographic Information Based Authentication |
| CRT_ABHA_306 | mandatory | not applicable | Profile Completion |
| CRT_ABHA_307 | mandatory | not applicable | Display of ABHA Number |
| CRT_ABHA_308 | mandatory, either CRT_ABHA_308 or CRT_ABHA_309 | not applicable | View and Download ABHA details. (If integrators is generating ABHA card) |
| CRT_ABHA_309 | mandatory, either CRT_ABHA_308 or CRT_ABHA_309 | not applicable | View and Download ABHA details. (If integrators is not generating ABHA card) |

### CRT_ABHA_301: Create ABHA Option

Verify that the system displays the "Create ABHA using Demographics" option on the landing page or registration screen and that it initiates the correct flow.

**Steps**

- 1\. Launch the application/web portal
- 2\. Navigate to the ABHA creation section
- 3\.Check if "Create ABHA " option is available

**Expected Result**

- User will have an option to create ABHA

### CRT_ABHA_302: Consent collection

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

### CRT_ABHA_303: Consent collection should be multilingual

The system should be able to provide the consent in languages other than English also

**Steps**

- 1\. System displays the consent language/disclaimer as per ABDM guidelines (refer approved consent language in cell number)
- 2\. User agrees to the consent using 'I Agree' checkbox or other approved mechanism (e.g., digital signature).

**Expected Result**

- 1\. User provides consent for sharing Aadhaar details for ABHA creation.
- 2\. System records the user's consent in compliance with the Health Data Management Policy

### CRT_ABHA_304: Aadhaar Collection and Error Handling

Verify that the user can enter the Aadhaar number and the system validates its format and length, displaying appropriate error messages for invalid input.

**Steps**

- 1\. Navigate to Aadhaar input section.
- 2\. Enter an invalid Aadhaar number (e.g., fewer than 12 digits, alphabets, or special characters).

**Expected Result**

- 1\. If wrong Aadhaar number entered then system should display an error message "Aadhaar Number is not valid".

**For the tester**

- 1\. It is recommended that Aadhar number should be in masked format.

### CRT_ABHA_305: Demographic Information Based Authentication

The system should verify the user’s demographic data (name, date of birth, gender) against Aadhaar records and allow or deny ABHA creation accordingly.

**Steps**

- 1\. Enter the following beneficiary details: Name, Date of Birth, Gender, Aadhaar Number, Mobile Number.
- 2\. Proceed with Aadhaar-based demographic authentication

**Expected Result**

- 1\. System validates demographic details (Name, DOB, Gender) with Aadhaar.
- 2\. Name, DOB, and Gender fields are prefilled and non-editable.
- 3\. Other fields like Address, Email, Mobile Number, State, District and profile picture remain editable.

### CRT_ABHA_306: Profile Completion

The system must prefill and allow completion of user profile using Aadhaar demographic data, ensuring only editable fields are modifiable.

**Steps**

- 1\. System auto-populates the following fields: Name, Date of Birth, Gender, Aadhaar Number, Mobile Number, Address, State Name, District Name, ABHA Number
- 2\. Verify which fields are editable.
- 3\. Complete any missing or editable information and submit the profile.

**Expected Result**

- 1\. System auto-fills demographic information from Aadhaar accurately.
- 2\. Fields for Name, Date of Birth, and Gender are non-editable.
- 3\. Fields like Address, Email, Mobile Number, State, District and profile picture are editable.
- 4\. System should allow user to complete the profile and proceed without errors.

### CRT_ABHA_307: Display of ABHA Number

System must display the created ABHA Number

**Steps**

- System shows the 14-digit ABHA number and ABHA address generated

**Expected Result**

- User should be able to view the generated ABHA Number

### CRT_ABHA_308: View and Download ABHA details. (If integrators is generating ABHA card)

System must have a provision to View / Download ABHA card

**Steps**

- 1\. System should show the user their ABHA Card
- 2\. ABHA Card should be generated by API and should contain -
- a. ABHA Number (Mandatory)
- b. User Photo-Optional
- c. ABHA QR code
- d. date of birth and gender
- e. ABHA Address

**Expected Result**

- 1\. User should be able to view their ABHA Card with all the demographic details.

### CRT_ABHA_309: View and Download ABHA details. (If integrators is not generating ABHA card)

System must have a provision to View details like ABHA number and ABHA address in the card (either ABHA card or any card being generated for their program/scheme/entity)

**Steps**

- 1\. If Integrator is not generating ABHA card then, they print the mentioned information on their program/scheme or any other card
- a. ABHA Number (Mandatory)
- b. ABHA Address (Mandatory)

**Expected Result**

- 1\. User should be able to view card with ABHA number and ABHA address and the details should be saved in HMIS system and linked with the HMIS unique beneficary 's ID.g or as per their business requirement.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

## Screen requirements

### In plain words

A government entity can create an ABHA with no OTP, by matching a person's
name, date of birth and gender against their Aadhaar record.

### What happens

| Requirement | Cases |
|---|---|
| Creation offers "Create ABHA using Demographics" | CRT_ABHA_301 |
| The consent screen and the Aadhaar field follow create-abha-aadhaar-otp | CRT_ABHA_302, CRT_ABHA_303, CRT_ABHA_304 |
| Take name, date of birth, gender, Aadhaar number and mobile, and authenticate them against Aadhaar | CRT_ABHA_305 |
| After authentication, name, date of birth and gender are filled and read only. Address, email, mobile, state, district and the photo stay editable, and the person can complete the profile and go on | CRT_ABHA_305, CRT_ABHA_306 |
| Show the 14 digit ABHA number and the ABHA address created | CRT_ABHA_307 |
| The card from the API carries the ABHA number, the QR code, date of birth, gender and the ABHA address, the photo optional. A system that prints its own card prints the ABHA number and address, saved and linked to your beneficiary id | CRT_ABHA_308, CRT_ABHA_309 |

### How you know it worked

The profile completes with the three Aadhaar fields read only, and the card
or your own card carries the fields above.

From `hiecm.concept.m1-screens-create-abha-demo-auth`.

## Calls

### Create ABHA, Demo Auth (`m1-create-abha-demo-auth`)

**Act: the calls in this journey, in order**

#### 1. Create ABHA - Demographic authentication (Demo Auth) (`m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d`)

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
      "demo_auth"
    ],
    "demo_auth": {
      "aadhaarNumber": "{{encrypted aadhaar number}}",
      "districtCode": "{{District code}}",
      "stateCode": "{{State code}}",
      "dateOfBirth": "{{DOB}}",
      "gender": "{{Gender}}",
      "name": "{{Full name}}",
      "mobile": "{{Mobile number}}",
      "profilePhoto": "{{Base64 plain String}}",
      "pinCode": "<PINCODE>",
      "address": "<ADDRESS>"
    }
  },
  "consent": {
    "code": "abha-enrollment",
    "version": "1.4"
  }
}'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "healthIdNumber": "<ABHA_NUMBER>",
  "healthId": "<ABHA_ADDRESS>",
  "mobile": "******0903",
  "firstName": "Username",
  "middleName": "<NAME>",
  "lastName": "<NAME>",
  "name": "<NAME>",
  "yearOfBirth": "<DOB>",
  "dayOfBirth": "<DOB>",
  "monthOfBirth": "<DOB>",
  "gender": "F",
  "stateCode": "27",
  "districtCode": "490",
  "stateName": "MAHARASHTRA",
  "districtName": "<ADDRESS>",
  "kycVerified": true,
  "token": "<TOKEN>",
  "jwtResponse": {
    "token": "<TOKEN>",
    "expiresIn": 1800,
    "refreshToken": "<TOKEN>",
    "refreshExpiresIn": 1296000
  },
  "status": "ACTIVE",
  "new": true
}
```

### ABHA Card & Profile (`m1-abha-card-profile`)

Built in [create-abha-aadhaar-otp](create-abha-aadhaar-otp.md). Reuse those calls.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| CRT_ABHA_301 | Create ABHA entry, method choice | None |
| CRT_ABHA_302 | Aadhaar consent | `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` |
| CRT_ABHA_303 | Aadhaar consent, language choice | None |
| CRT_ABHA_304 | Aadhaar number entry | None |
| CRT_ABHA_305 | Demographic details entry | `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` |
| CRT_ABHA_306 | Profile completion form | `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` |
| CRT_ABHA_307 | Created ABHA number | `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` |
| CRT_ABHA_308 | ABHA card, view and download | `m1_get_v3_profile_account_abha_card` |
| CRT_ABHA_309 | Integrator's own card with ABHA details | `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` | `POST /abha/api/v3/enrollment/enrol/byAadhaar` | Create ABHA - Demographic authentication (Demo Auth) |

Headers the calls of Create ABHA by demographic authentication take: `TIMESTAMP`, `REQUEST-ID`, `BENEFIT_NAME`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` | 422 | `ABDM-1124` | The mobile number provided by you is already linked to 6 ABHA Numbers. Please provide a different Mobile Number. |
| `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d` | 422 | `ABDM-1207` | The information you provided does not match the details on record with Aadhaar. Please verify and provide accurate information. |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| CRT_ABHA_301 | nothing | none |
| CRT_ABHA_302 | `aadhaar-holder` | none |
| CRT_ABHA_303 | nothing | none |
| CRT_ABHA_304 | nothing | none |
| CRT_ABHA_305 | `aadhaar-holder` | none |
| CRT_ABHA_306 | `aadhaar-holder` | none |
| CRT_ABHA_307 | `aadhaar-holder` | none |
| CRT_ABHA_308 | `aadhaar-holder` | none |
| CRT_ABHA_309 | `aadhaar-holder` | none |

### CRT_ABHA_301 to 309: create an ABHA by demographic authentication

A private integrator records the group `not-run`: it applies to government entities only.

Loop limit: 3 passes per test case.

#### CRT_ABHA_301, the option exists. `screen`

Your landing or registration screen offers "Create ABHA using Demographics", and it starts the demographic flow. Evidence: the screen with the option and the screen it opens.

#### CRT_ABHA_302, consent is shown and recorded. `screen`

As CRT_ABHA_102.

#### CRT_ABHA_303, consent in another language. `screen`

As CRT_ABHA_103.

#### CRT_ABHA_304, an invalid Aadhaar number is refused before any call. `screen`

As CRT_ABHA_104.

#### CRT_ABHA_305, the demographic details are checked against Aadhaar. `sandbox`

One call, `m1_post_v3_enrollment_enrol_byaadhaar_demo_auth_create_ab_81107d`, with the name, date of birth, gender, Aadhaar number and mobile as they read on the Aadhaar card. Exit condition: 200 with `healthIdNumber`, `healthId` and `kycVerified` `true`.

Then the mismatch: send the same call with the date of birth changed. Exit condition: 422 with `error.code` `ABDM-1207` and a message that the information does not match the details on record with Aadhaar, and your screen says so without creating anything. Both observations, both pasted.

Screen check: name, date of birth and gender are filled and not editable; address, email, mobile, state, district and profile photo stay editable.

Nudge: the same mobile on a seventh account is refused with ABDM-1124. That is a mobile limit, not a demographic mismatch. Read `error.message`.

#### CRT_ABHA_306, the profile is completed from the response, not typed. `screen`

Your system fills name, date of birth, gender, Aadhaar number, mobile, address, state, district and ABHA number from the response. Name, date of birth and gender are not editable. Address, email, mobile, state, district and profile photo are editable. The person completes the rest and submits without an error. Evidence: the form after creation and after submission. `hiecm.concept.m1-confirm-the-filled-form`

#### CRT_ABHA_307, the ABHA number is displayed. `screen`

As CRT_ABHA_113, matching `healthIdNumber` and `healthId` from CRT_ABHA_305.

#### CRT_ABHA_308, the ABHA card can be viewed. `sandbox` and `screen`

As CRT_ABHA_114, sent with the `token` from CRT_ABHA_305 as `X-token`. The card carries the ABHA number, the QR code, date of birth, gender and the ABHA address. The photo is optional.

#### CRT_ABHA_309, your own card carries the ABHA details. `screen`

As CRT_ABHA_115.
