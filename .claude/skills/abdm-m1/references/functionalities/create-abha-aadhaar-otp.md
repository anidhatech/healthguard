# Create ABHA by Aadhaar OTP

Sheet group: ABHA creation through Aadhaar OTP.

Functionality 1 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `CRT_ABHA_101`, `CRT_ABHA_104`, `CRT_ABHA_102`, `CRT_ABHA_105`, `CRT_ABHA_106`, `CRT_ABHA_107`, `CRT_ABHA_108`, `CRT_ABHA_109`, `CRT_ABHA_112`, `CRT_ABHA_113`, `CRT_ABHA_114`, `CRT_ABHA_115`, `CRT_ABHA_116`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Every call in `m1-create-abha-aadhaar-otp`, `m1-abha-card-profile` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Create ABHA by Aadhaar OTP works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Create ABHA by Aadhaar OTP succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `CRT_ABHA_101`, `CRT_ABHA_104`, `CRT_ABHA_102`, `CRT_ABHA_105`, `CRT_ABHA_106`, `CRT_ABHA_107`, `CRT_ABHA_108`, `CRT_ABHA_109`, `CRT_ABHA_112`, `CRT_ABHA_113`, `CRT_ABHA_114`, `CRT_ABHA_115`, `CRT_ABHA_116` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Create ABHA by Aadhaar OTP |

Loop limit: 3 passes through Test for Create ABHA by Aadhaar OTP. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `CRT_ABHA_101`, `CRT_ABHA_104`, `CRT_ABHA_102`, `CRT_ABHA_103`, `CRT_ABHA_105`, `CRT_ABHA_106`, `CRT_ABHA_107`, `CRT_ABHA_108`, `CRT_ABHA_109`, `CRT_ABHA_112`, `CRT_ABHA_113`, `CRT_ABHA_114`, `CRT_ABHA_115`, `CRT_ABHA_116`.
An integration that already exists enters Create ABHA by Aadhaar OTP at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: CRT_ABHA_101, CRT_ABHA_104, CRT_ABHA_102, CRT_ABHA_105, CRT_ABHA_106, CRT_ABHA_107, CRT_ABHA_108, CRT_ABHA_109, CRT_ABHA_112 (conditional), CRT_ABHA_113, CRT_ABHA_114 or CRT_ABHA_115, CRT_ABHA_116. Mandatory for a private entity: CRT_ABHA_101, CRT_ABHA_104, CRT_ABHA_102, CRT_ABHA_105, CRT_ABHA_106, CRT_ABHA_107, CRT_ABHA_108, CRT_ABHA_109, CRT_ABHA_112 (conditional), CRT_ABHA_113, CRT_ABHA_114, CRT_ABHA_116.

| Case | Government | Private | What is tested |
|---|---|---|---|
| CRT_ABHA_101 | mandatory | mandatory | Create ABHA Option |
| CRT_ABHA_104 | mandatory | mandatory | Aadhaar Collection and Error Handling |
| CRT_ABHA_102 | mandatory | mandatory | Consent collection |
| CRT_ABHA_103 | optional | optional | Consent collection should be multilingual |
| CRT_ABHA_105 | mandatory | mandatory | Aadhaar OTP Collection |
| CRT_ABHA_106 | mandatory | mandatory | Resend OTP |
| CRT_ABHA_107 | mandatory | mandatory | OTP based Aadhaar Authentication |
| CRT_ABHA_108 | mandatory | mandatory | Communication Mobile Number Verification – I |
| CRT_ABHA_109 | mandatory | mandatory | Communication Mobile Number verification-II |
| CRT_ABHA_112 | conditional | conditional | Suggested ABHA Address |
| CRT_ABHA_113 | mandatory | mandatory | Display of ABHA Number |
| CRT_ABHA_114 | mandatory, either CRT_ABHA_114 or CRT_ABHA_115 | mandatory | View and Download ABHA details. (If integrators is generating ABHA card) |
| CRT_ABHA_115 | mandatory, either CRT_ABHA_114 or CRT_ABHA_115 | optional | View and Download ABHA details. (If integrators is not generating ABHA card) |
| CRT_ABHA_116 | mandatory | mandatory | Returning patient |

### CRT_ABHA_101: Create ABHA Option

The system must provide an option to create ABHA through Aadhaar OTP

**Steps**

- 1\. Launch the application/web portal
- 2\. Navigate to the ABHA creation section
- 3\.Check if "Create ABHA " option is available

**Expected Result**

- User will have an option to create ABHA

### CRT_ABHA_104: Aadhaar Collection and Error Handling

Verify that the user can enter the Aadhaar number and the system validates its format and length, displaying appropriate error messages for invalid input.

**Steps**

- 1\. Navigate to Aadhaar input section.
- 2\. Enter an invalid Aadhaar number (e.g., fewer than 12 digits, alphabets, or special characters).

**Expected Result**

- 1\. If wrong Aadhaar number entered then system should display an error message "Aadhaar Number is not valid".

**For the tester**

- 1\. It is recommended that Aadhar number should be in masked format.

### CRT_ABHA_102: Consent collection

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

### CRT_ABHA_103: Consent collection should be multilingual

The system should be able to provide the consent in languages other than English also

**Steps**

- 1\. System displays the consent language/disclaimer as per ABDM guidelines (refer approved consent language in cell number)
- 2\. User agrees to the consent using 'I Agree' checkbox or other approved mechanism (e.g., digital signature).

**Expected Result**

- 1\. User provides consent for sharing Aadhaar details for ABHA creation.
- 2\. System records the user's consent in compliance with the Health Data Management Policy

### CRT_ABHA_105: Aadhaar OTP Collection

User receives Aadhaar OTP and System must allow the user to enter Aadhaar OTP.

**Steps**

- 1\. Receive OTP on mobile number registered with Aadhaar
- 2\. Enter Aadhaar OTP

**Expected Result**

- 1\.User is able to input the OTP.
- 2\. System accepts only a 6-digit numeric OTP.
- 3\. Message displayed to the user as per API response.

**For the tester**

- 1\.Check for error messages for incomplete, incorrect, or expired OTPs.
- 2\. Check the visibility and correctness of the masked mobile number (*******XXXX)

### CRT_ABHA_106: Resend OTP

Verify that the system enables the Resend OTP button after 60 seconds and allows a maximum of 2 resend attempts

**Steps**

- 1\. Click the Resend OTP button.
- 2\. Receive the new OTP on the Aadhaar-linked mobile number.
- 3\. Enter the newly received OTP.

**Expected Result**

- 1\. User can resend the OTP a maximum of 2 times.
- 2\. New OTP is successfully received and can be verified.

**For the tester**

- 1\. If user tries to resend more than 2 times, system should display an appropriate, “Maximum OTP resend attempts reached. Please try again after 30 mins".
- OTP Counter should be visible

### CRT_ABHA_107: OTP based Aadhaar Authentication

System must verify the OTP

**Steps**

- 1\. Click on verify button (For Resend and Send)
- 2\. It is recommended that verify button be auto enabled

**Expected Result**

- 1\. System authenticates the user's Aadhaar through OTP.
- 2\. In case of incorrect OTP, the system displays an error as per API response.
- 3\. In case of correct OTP, the system allows the user to proceed.

### CRT_ABHA_108: Communication Mobile Number Verification – I

If the communication mobile number provided by the user matches the Aadhaar-linked mobile number, the user should be directed to ABHA creation (No need of reverification)

**Steps**

- 1\.System verifies if the entered mobile number is the same as the Aadhaar-linked mobile number. If true, procced to next step.

**Expected Result**

- User proceeds with next steps of ABHA creation.

### CRT_ABHA_109: Communication Mobile Number verification-II

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

### CRT_ABHA_112: Suggested ABHA Address

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

### CRT_ABHA_113: Display of ABHA Number

System must display the created ABHA Number along with profile details.

**Steps**

- 1\. System shows the 14-digit ABHA number and ABHA address generated along with all profile details.

**Expected Result**

- 1\. User should be able to view the generated ABHA Number and linked ABHA address in profile.

### CRT_ABHA_114: View and Download ABHA details. (If integrators is generating ABHA card)

System must have a provision to View / Download ABHA card

**Steps**

- 1\. The system should display the ABHA card to the user, as received in the response from the API.

**Expected Result**

- 1\. User should be able to view and download their ABHA Card with all the demographic details as given by API.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified.

### CRT_ABHA_115: View and Download ABHA details. (If integrators is not generating ABHA card)

System must have a provision to View details like ABHA number and ABHA address in the card (either ABHA card or any card being generated for their program/scheme/entity)

**Steps**

- 1\. If Integrator is not generating ABHA card then, they print the mentioned information on their program/scheme or any other card
- a. ABHA Number (Mandatory)
- b. ABHA Address (Mandatory)

**Expected Result**

- 1\. User should be able to view and download their ABHA Card with all the demographic details as given by API.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified.

### CRT_ABHA_116: Returning patient

System must handle scenarios for revisit

**Steps**

- 1\. The system should capture patient information either through the ABHA creation or verification flow.
- 2\. The HMIS system should search existing records using the patient's mobile number, name, gender, and age.
- 3\. If a Unique Beneficiary ID (e.g., MRD/UHID) is provided, the system should also perform a search using this ID.
- 4\. If an existing beneficiary is found and all matching criteria are satisfied, the system should link the new records to the already created Beneficiary ID.
- 5\. If match fails due to mismatch in any critical demographic field, System creates a new beneficiary id.

**Expected Result**

- 1\. For returning patients, the HMIS shall perform beneficiary matching using demographic attributes and/or existing UHID/MRD. If a valid match is found, the system shall reuse the existing Beneficiary ID/UHID and link the current registration/encounter to it. This process shall prevent the creation of multiple UHIDs for the same patient. A new Beneficiary ID/UHID shall only be created when no valid match exists.
- Refer below link to understand New vs Returning patient scenario: https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=NewReturningPatients

## Screen requirements

### In plain words

Every call in this journey can succeed while the screen around it fails its
case. The requirements below are what the cases are judged on. Each one names
the cases it comes from. Several of them, the consent, the OTP field, resend
and a wrong OTP, hold on every screen in M1 that asks for consent or an OTP,
and the other functionalities point back here for them.

### What happens

#### Consent, before the Aadhaar number is sent

Two texts apply, and both are shown before the Aadhaar number leaves your
system.

The terms and conditions for ABHA enrolment are the text in
`hiecm.concept.m1-abha-consent`, under the next heading. The `consent` block
in `enrol/byAadhaar`, `code` `abha-enrollment` and `version` `1.4`, records
agreement to those terms.

The consent language is the facility's own consent screen: five declarations,
each with its own checkbox, then two confirmations. Show it word for word:

> I hereby declare that:
>
> - [x] I am voluntarily sharing my Aadhaar Number / Virtual ID issued by the Unique Identification Authority of India (“UIDAI”), and my demographic information for the purpose of creating an Ayushman Bharat Health Account number (“ABHA number”) and Ayushman Bharat Health Account address (“ABHA Address”). I authorize NHA to use my Aadhaar number / Virtual ID for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication.
> - [ ] I intend to create Ayushman Bharat Health Account Number (“ABHA number”) and Ayushman Bharat Health Account address (“ABHA Address”) using document other than Aadhaar. (Click here to proceed further)
> - [x] I consent to usage of my ABHA address and ABHA number for linking of my legacy (past) government health records and those which will be generated during this encounter.
> - [x] I authorize the sharing of all my health records with healthcare provider(s) for the purpose of providing healthcare services to me during this encounter.
> - [x] I consent to the anonymization and subsequent use of my government health records for public health purposes.
>   - [ ] I, (name of healthcare worker- depending on the username used for logging in into the system), confirm that I have duly informed and explained the beneficiary of the contents of consent for aforementioned purposes.
>   - [ ] I, (beneficiary name), have been explained about the consent as stated above and hereby provide my consent for the aforementioned purposes.

| Requirement | Cases |
|---|---|
| Show the terms and conditions word for word, with nothing cut, and require an explicit "I agree" before the Aadhaar number is sent | CRT_ABHA_102 |
| Each of the five declarations of the consent language has its own checkbox. In an Aadhaar flow the second one, creation with a document other than Aadhaar, is left unchecked; checking it leads to creation by driving licence | CRT_ABHA_102 |
| The healthcare worker's confirmation names the person logged in to your system, filled from that login. The beneficiary's confirmation shows the patient's name dynamically, from what the screen already holds. Nobody types either name | CRT_ABHA_102 |
| A private entity removes the word "government" from the consent language. A government entity shows it as written | CRT_ABHA_102 |
| Nothing is sent until the terms are agreed and the declarations and both confirmations are in. Store who agreed, who confirmed and when, against the patient | CRT_ABHA_102 |
| Offering the consent in a language other than English is optional, and is what CRT_ABHA_103, an optional case, tests. Where you offer it, the screen has a language choice and the text in another language is the facility's approved translation, loaded as supplied and never machine translated | CRT_ABHA_103 |
| `enrol/byAadhaar` carries the `consent` block with `code` `abha-enrollment` and `version` `1.4`, which records agreement to the terms and conditions | CRT_ABHA_102 |

Advised, not tested: show the consent language on a second screen that faces
the patient, so they can read it, and in the local language.

#### Entry, the Aadhaar number and the OTP

| Requirement | Cases |
|---|---|
| Registration offers "Create ABHA", with Aadhaar OTP as a method | CRT_ABHA_101 |
| The Aadhaar field takes 12 digits and nothing else. Fewer or more digits, a letter or a special character shows "Aadhaar Number is not valid" on the screen, and no call is sent. Show the number masked once it is entered | CRT_ABHA_104 |
| The OTP screen names where the OTP went with the masked mobile the `request/otp` response carries in `message`, as the sheet writes it, `*******XXXX`. Never a mobile your system typed in | CRT_ABHA_105 |
| The OTP field takes six digits and nothing else. The verify button enables itself once six digits are in | CRT_ABHA_105, CRT_ABHA_107 |
| An incomplete, wrong or expired OTP shows the message ABDM returned, as it came. On every M1 screen, a message ABDM returns is never replaced by your own wording. The fixed texts the cases quote, such as "Aadhaar Number is not valid" or the not found message of VRFY_ABHA_303, are your product's own and are shown as the cases write them | CRT_ABHA_105, CRT_ABHA_107, VRFY_ABHA_307, VRFY_ABHA_402 |
| A wrong OTP keeps the transaction. The person enters the OTP again on the same screen, and the retry carries the same `txnId`. They never re-enter the Aadhaar number, and the right OTP then succeeds. This holds on every OTP screen in M1 | CRT_ABHA_107, VRFY_ABHA_201, VRFY_ABHA_307, VRFY_ABHA_402 |

#### Resend

One rule for every OTP screen in M1.

| Requirement | Cases |
|---|---|
| Resend stays disabled for 60 seconds after each send, and enables itself after that | CRT_ABHA_106, CRT_ABHA_109, VRFY_ABHA_101, VRFY_ABHA_201, VRFY_ABHA_405 |
| At most two resends. A third attempt does not call ABDM and shows "Maximum OTP resend attempts reached. Please try again after 30 mins". Only the Resend control counts toward this limit. A second press of Send OTP is not a resend | CRT_ABHA_106, VRFY_ABHA_304, VRFY_ABHA_405 |
| The tester note asks that the "OTP Counter should be visible". A Resend control that does nothing visible gives the person no answer at all | CRT_ABHA_106, VRFY_ABHA_405 |
| A resend reuses the `txnId` of the first send | CRT_ABHA_106 |

#### The communication mobile

| Requirement | Cases |
|---|---|
| A communication mobile that is the Aadhaar linked one goes straight on to creation, with no second OTP | CRT_ABHA_108 |
| A different one is verified by OTP, with the resend and wrong OTP rules above | CRT_ABHA_109 |
| The communication mobile, whichever it is, is the one the ABHA card and profile show | CRT_ABHA_109 |

#### An Aadhaar that already holds an ABHA

`enrol/byAadhaar` answers an Aadhaar that already holds an ABHA with a 200,
`isNew` `false`, the message `This account already exist`, a `txnId`, user
`tokens` and the full `ABHAProfile`.

| Requirement | Cases |
|---|---|
| `isNew` `false` is not a stop and not an error screen. Carry on from that response exactly as for a new account | CRT_ABHA_112, CRT_ABHA_113, CRT_ABHA_114 |
| Show the profile from `ABHAProfile`, the card with `tokens.token` as `X-token`, and the address step with the same `txnId` | CRT_ABHA_112, CRT_ABHA_113, CRT_ABHA_114 |
| The address step stays open for an existing account. A person can create more than one ABHA address for the same ABHA number, so never refuse a new one because one exists, and never state a limit | CRT_ABHA_112 |

#### The ABHA address

| Requirement | Cases |
|---|---|
| Show at least three suggestions from `enrol/suggestion` to pick from | CRT_ABHA_112 |
| Offer a free field for an address of the person's own, with the rules printed beside it: 8 to 18 characters including `@sbx` or `@abdm`, letters and digits, at most one dot and one underscore, neither first nor last. Each rule shows green when met and red when not | CRT_ABHA_112 |
| An address already in use shows "ABHA address already exists." with two choices: go on with the existing address, or create a new one | CRT_ABHA_112 |

#### The profile, the card and a returning patient

| Requirement | Cases |
|---|---|
| After creation, show the 14 digit ABHA number and the ABHA address together with the profile details | CRT_ABHA_113 |
| Show the ABHA card as the API returned it, and let the person download it. A non-KYC ABHA address cannot download a card; say so rather than showing a broken one | CRT_ABHA_114 |
| A system that prints its own programme or scheme card instead prints the ABHA number and the ABHA address on it, both required | CRT_ABHA_115 |
| Before registering, search your own records by mobile, name, gender and age, and by your own beneficiary id when one is given. A full match links this visit to the existing id. A new id is created only when no match holds | CRT_ABHA_116 |

### How you know it worked

Each case named above passes on its Expected Result, judged on the screen. The
consent screen shows the five declarations and both confirmations with the
logged in user's name filled, and a stored record of who agreed and when.

### When it goes wrong

- The terms alone, without the consent language declarations and
  confirmations, fail CRT_ABHA_102 whatever the API returns.
- A creation that stops at "account already exists" leaves CRT_ABHA_112 to 114
  unreachable for an Aadhaar that already holds an ABHA.
- A wrong OTP that starts a new transaction makes the right OTP fail next.

From `hiecm.concept.m1-screens-create-abha-aadhaar-otp`.

### In plain words

Before your system sends a person's Aadhaar number, show them the terms and
conditions below and collect their agreement, through an "I agree" checkbox or
another form of signature. Keep a record that they agreed. Every journey that
creates an ABHA from Aadhaar starts here, and functional testing checks it in
[CRT_ABHA_102](/docs/hiecm/v3/resources/test-cases/m1#crt_abha_102).

Show the text exactly as written:

<div className="consent-text">

**Terms and Conditions**

I, hereby declare that I am voluntarily sharing my Aadhaar number and demographic information issued by UIDAI, with National Health Authority (NHA) for the sole purpose of creation of ABHA number. I understand that my ABHA number can be used and shared for purposes as may be notified by ABDM from time to time including provision of healthcare services. Further, I am aware that my personal identifiable information (Name, Address, Age, Date of Birth, Gender and Photograph) may be made available to the entities working in the National Digital Health Ecosystem (NDHE) which inter alia includes stakeholders and entities such as healthcare professionals (e.g. doctors), facilities (e.g. hospitals, laboratories) and data fiduciaries (e.g. health programmes), which are registered with or linked to the Ayushman Bharat Digital Mission (ABDM), and various processes there under. I authorize NHA to use my Aadhaar number for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication. I have been duly informed about the option of using other IDs apart from Aadhaar; however, I consciously choose to use Aadhaar number for the purpose of availing benefits across the NDHE. I am aware that my personal identifiable information excluding Aadhaar number / VID number can be used and shared for purposes as mentioned above. I reserve the right to revoke the given consent at any point of time as per provisions of Aadhaar Act and Regulations.

</div>

The `consent` block in the `enrol/byAadhaar` request records the agreement:
`code` is `abha-enrollment` and `version` is `1.4`. Offering the text in other
languages is optional.

### What happens

Display the text verbatim, require an explicit "I agree" before the OTP request is sent, and store who agreed and when. Send the `consent` block with `code` `abha-enrollment` and `version` `1.4` in `enrol/byAadhaar`.

### How you know it worked

The OTP request cannot be sent until the person has agreed, and your records show the agreement for every ABHA your system created.

### When it goes wrong

A creation flow that sends the Aadhaar number before consent is collected fails functional testing at CRT_ABHA_102, whatever the API returns.

From `hiecm.concept.m1-abha-consent`.

## Calls

### Create ABHA, Aadhaar OTP (`m1-create-abha-aadhaar-otp`)

**Act: the calls in this journey, in order**

#### 1. Send Aadhaar OTP for ABHA enrolment (`m1_post_v3_enrollment_request_otp_aadhaar_otp`)

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
    "abha-enrol"
  ],
  "loginHint": "aadhaar",
  "loginId": "{{encrypted aadhaar number}}",
  "otpSystem": "aadhaar"
}'
```

#### 2. Create ABHA - verify Aadhaar OTP (`m1_post_v3_enrollment_enrol_byaadhaar_otp`)

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
      "otp"
    ],
    "otp": {
      "txnId": "{{txnId}}",
      "otpValue": "{{encrypted otp}}",
      "mobile": "{{mobile number}}"
    }
  },
  "consent": {
    "code": "abha-enrollment",
    "version": "1.4"
  }
}'
```

#### 3. After ABHA creation - send OTP to verify mobile (optional) (`m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_1b66bb`)

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

#### 4. After ABHA creation - verify mobile OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_091285`)

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

#### 5. After ABHA creation - send OTP to verify email (optional) (`m1_post_v3_enrollment_request_otp_email_verify_create_abh_ddbed1`)

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

#### 6. After ABHA creation - verify email OTP (optional) (`m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_6d732c`)

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

#### 7. After ABHA creation - get ABHA address suggestions (`m1_get_v3_enrollment_enrol_suggestion_create_abha_aadhaar_otp`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/enrol/suggestion \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'TRANSACTION_ID: {{txnId}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 8. After ABHA creation - create ABHA address (`m1_post_v3_enrollment_enrol_abha_address_create_abha_aadhaar_otp`)

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

**Act: the calls in this journey, in order**

#### 1. Get ABHA QR code (`m1_get_v3_profile_account_qrcode`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/qrCode \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 2. Retrieve ABHA card image (`m1_get_v3_profile_account_abha_card`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/abha-card \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 3. Get ABHA profile (`m1_get_v3_profile_account`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 4. Download ABHA card (`m1_get_v3_profile_account_download_abha_card`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/download-abha-card \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'X-token: Bearer {{X-token}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

#### 5. Refresh user token (`m1_get_v3_profile_account_request_token`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/account/request/token \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'R-token: Bearer {{R-jwtToken}}' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "token": "<TOKEN>",
  "expiresIn": 1800,
  "refreshToken": "<TOKEN>",
  "refreshExpiresIn": 1296000
}
```

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| CRT_ABHA_101 | Create ABHA entry, method choice | None |
| CRT_ABHA_104 | Aadhaar number entry | None |
| CRT_ABHA_102 | Aadhaar consent | `m1_post_v3_enrollment_enrol_byaadhaar_otp` |
| CRT_ABHA_103 | Aadhaar consent, language choice | None |
| CRT_ABHA_105 | Aadhaar OTP entry | `m1_post_v3_enrollment_request_otp_aadhaar_otp`, `m1_post_v3_enrollment_enrol_byaadhaar_otp` |
| CRT_ABHA_106 | Aadhaar OTP entry, resend | `m1_post_v3_enrollment_request_otp_aadhaar_otp` |
| CRT_ABHA_107 | Aadhaar OTP entry, verify | `m1_post_v3_enrollment_enrol_byaadhaar_otp` |
| CRT_ABHA_108 | Communication mobile entry | `m1_post_v3_enrollment_enrol_byaadhaar_otp` |
| CRT_ABHA_109 | Communication mobile OTP | `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_1b66bb`, `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_091285` |
| CRT_ABHA_112 | ABHA address choice | `m1_get_v3_enrollment_enrol_suggestion_create_abha_aadhaar_otp`, `m1_post_v3_enrollment_enrol_abha_address_create_abha_aadhaar_otp` |
| CRT_ABHA_113 | Created ABHA profile | `m1_post_v3_enrollment_enrol_byaadhaar_otp`, `m1_get_v3_profile_account` |
| CRT_ABHA_114 | ABHA card, view and download | `m1_get_v3_profile_account_abha_card` |
| CRT_ABHA_115 | Integrator's own card with ABHA details | `m1_get_v3_profile_account` |
| CRT_ABHA_116 | Patient registration, returning patient match | None |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_enrollment_request_otp_aadhaar_otp` | `POST /abha/api/v3/enrollment/request/otp` | Send Aadhaar OTP for ABHA enrolment |
| `m1_post_v3_enrollment_enrol_byaadhaar_otp` | `POST /abha/api/v3/enrollment/enrol/byAadhaar` | Create ABHA - verify Aadhaar OTP |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_1b66bb` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify mobile (optional) |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_091285` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify mobile OTP (optional) |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abh_ddbed1` | `POST /abha/api/v3/enrollment/request/otp` | After ABHA creation - send OTP to verify email (optional) |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_6d732c` | `POST /abha/api/v3/enrollment/auth/byAbdm` | After ABHA creation - verify email OTP (optional) |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_aadhaar_otp` | `GET /abha/api/v3/enrollment/enrol/suggestion` | After ABHA creation - get ABHA address suggestions |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_aadhaar_otp` | `POST /abha/api/v3/enrollment/enrol/abha-address` | After ABHA creation - create ABHA address |
| `m1_get_v3_profile_account_qrcode` | `GET /abha/api/v3/profile/account/qrCode` | Get ABHA QR code |
| `m1_get_v3_profile_account_abha_card` | `GET /abha/api/v3/profile/account/abha-card` | Retrieve ABHA card image |
| `m1_get_v3_profile_account` | `GET /abha/api/v3/profile/account` | Get ABHA profile |
| `m1_get_v3_profile_account_download_abha_card` | `GET /abha/api/v3/profile/account/download-abha-card` | Download ABHA card |
| `m1_get_v3_profile_account_request_token` | `GET /abha/api/v3/profile/account/request/token` | Refresh user token |

Headers the calls of Create ABHA by Aadhaar OTP take: `REQUEST-ID`, `TIMESTAMP`, `BENEFIT_NAME`, `TRANSACTION_ID`, `X-token`, `R-token`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_enrollment_request_otp_aadhaar_otp` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_enrol_byaadhaar_otp` | 422 | `ABDM-1204` | UIDAI Error code : 400 : Invalid Aadhaar OTP value. |
| `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_1b66bb` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_091285` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_091285` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_post_v3_enrollment_request_otp_email_verify_create_abh_ddbed1` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_6d732c` | 401 | `900901` | Invalid Credentials |
| `m1_post_v3_enrollment_auth_byabdm_email_verify_create_abh_6d732c` | 500 | `900900` | Unclassified Authentication Failure |
| `m1_get_v3_enrollment_enrol_suggestion_create_abha_aadhaar_otp` | 401 | `ABDM-1017` | Invalid Transaction Id |
| `m1_post_v3_enrollment_enrol_abha_address_create_abha_aadhaar_otp` | 401 | `900901` | Invalid Credentials |
| `m1_get_v3_profile_account` | 401 | `900901` | Invalid Credentials |
| `m1_get_v3_profile_account_request_token` | 401 | `900902` | Missing Credentials |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| CRT_ABHA_101 | nothing | none |
| CRT_ABHA_104 | nothing | none |
| CRT_ABHA_102 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_103 | nothing | none |
| CRT_ABHA_105 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_106 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_107 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_108 | `otp`, `aadhaar-without-abha` | none |
| CRT_ABHA_109 | `otp`, `aadhaar-without-abha`, `second-mobile` | none |
| CRT_ABHA_112 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_113 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_114 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_115 | `aadhaar-holder`, `otp` | none |
| CRT_ABHA_116 | `patient-registered` | none |

### CRT_ABHA_101 to 116: create an ABHA by Aadhaar OTP

This is the group every other creation group repeats with a different authentication step, so it is written in full and the others state only what differs.

Loop limit: 3 passes per test case.

**Preconditions.** A gateway access token less than 30 minutes old. A person present with an Aadhaar linked mobile. Their Aadhaar number searched first on the login path and not found, so the run creates rather than duplicates.

**A fresh Aadhaar, said before the run.** The full creation journey needs an Aadhaar that holds no ABHA. Tell the tester so at the readiness check, before the first case: an existing ABHA can be deleted on the ABHA sandbox portal, https://abhasbx.abdm.gov.in/abha/v3, to free that Aadhaar, as NHA recommends.

**An existing ABHA is not a stop.** If the tester keeps the existing ABHA, run the cases anyway. For an Aadhaar that already holds an ABHA, `m1_post_v3_enrollment_enrol_byaadhaar_otp` answers 200 with `message` `This account already exist` and `isNew` `false`, and still returns the account's `txnId`, `tokens` with `token` and `refreshToken`, and the full `ABHAProfile`, with `ABHANumber`, `phrAddress` and the masked `mobile`. So these still run on that response:

| Case | Runs on |
|---|---|
| CRT_ABHA_112, the address step | The same `txnId`. A person can create more than one ABHA address for the same ABHA number |
| CRT_ABHA_113, the profile shown | `ABHAProfile`, and the address from CRT_ABHA_112 |
| CRT_ABHA_114, the card | `m1_get_v3_profile_account_abha_card`, sent with `tokens.token` as `X-token` |

Only a case that truly needs a brand new ABHA waits for a fresh Aadhaar, and is `needs-human` with `an Aadhaar with no ABHA` in Remarks after the tester was asked for one. If your application offers no address step for an existing account, that is your application's FAIL on CRT_ABHA_112, not a `not-run`.

#### CRT_ABHA_101, the option exists. `sandbox`

Your system offers ABHA creation by Aadhaar OTP, and the journey completes. Drive it end to end through your screen or API.

Calls, in order: `m1_post_v3_enrollment_request_otp_aadhaar_otp`, `m1_post_v3_enrollment_enrol_byaadhaar_otp`, the optional mobile and email verifications, `m1_get_v3_enrollment_enrol_suggestion_create_abha_aadhaar_otp`, `m1_post_v3_enrollment_enrol_abha_address_create_abha_aadhaar_otp`, then `m1_get_v3_profile_account` and `m1_get_v3_profile_account_abha_card`.

Exit condition: three literals, all pasted.

1. `m1_post_v3_enrollment_enrol_byaadhaar_otp` returns 200 with `tokens.token` present and `ABHAProfile.ABHANumber` present.
2. `m1_post_v3_enrollment_enrol_abha_address_create_abha_aadhaar_otp` returns 200 with `healthIdNumber` and `preferredAbhaAddress`.
3. `m1_get_v3_profile_account`, sent with that `X-token`, returns 200 with the same `ABHANumber`.

Nudge: read `message` and `isNew` on step 1. `Account created successfully` with `isNew` `true` is a new account. `This account already exist` with `isNew` `false` is a 200 too, and is not a failure: the Aadhaar already holds an ABHA. Your application must carry on from that response to the profile, the card and the address step, as "An existing ABHA is not a stop" above sets out. Say in the run log that the account existed, and that steps 1 to 3 ran on it.

#### CRT_ABHA_104, an invalid Aadhaar number is refused before any call. `screen`

Enter fewer than 12 digits, more than 12 digits, letters and special characters. Your system refuses each with the message "Aadhaar Number is not valid", and sends nothing. Evidence: the refusal on screen and an empty call log for that attempt. Your own check has to be the strict one here; the sandbox's refusal for a bad number is not the one this case is about. The set recommends showing the Aadhaar number masked once entered. `hiecm.concept.m1-honest-screen-states`

#### CRT_ABHA_102, consent is shown and recorded. `screen`

Your system shows the published ABDM consent text before the Aadhaar number is asked for, and stores that the person agreed, with when. The person agrees with an "I Agree" checkbox or another approved mechanism. Evidence: the consent screen, and the stored record for this run. `hiecm.concept.m1-screen-contract`

#### CRT_ABHA_103, consent in another language. `screen`

The same consent offered in at least one language other than English. Evidence: the screen in that language. Record `not-run` if you do not claim it.

#### CRT_ABHA_105, the Aadhaar OTP is requested and can be entered. `sandbox`, then `human`

Exit condition: `m1_post_v3_enrollment_request_otp_aadhaar_otp` returns 200 with a `txnId` and a `message` that names the masked mobile. Paste it. Then stop: the OTP arrives on the person's phone and only they enter it. If they are not there, ask again naming the OTP field; only when the tester says they cannot provide it in this run, or stays silent after the second ask, record `needs-human` with what was asked and the txnId, and do not mark the case passed or failed.

Screen checks alongside: the prompt tells the person the OTP went to the mobile linked with Aadhaar and shows the last digits, which the `message` carries. The OTP field accepts only six digits. An incomplete, wrong or expired OTP shows the message the API returned.

#### CRT_ABHA_106, resend OTP. `screen`

Judge it against the Resend requirements under Screen requirements, pressing the Resend control only. Evidence: a recording or timestamped screenshots: disabled at send, enabled after 60 seconds, disabled after the second resend, and the message on the third. A resend that works reuses the `txnId`; a fresh `txnId` is a new request, not a resend.

#### CRT_ABHA_107, the OTP is verified, and a wrong OTP is refused. `sandbox`, `human`

Two observations, both needed.

1. A wrong OTP: `m1_post_v3_enrollment_enrol_byaadhaar_otp` returns 422 with `error.code` `ABDM-1204` and a message naming an invalid Aadhaar OTP value, and your screen shows that error and lets the person retry without re-entering the Aadhaar number.
2. The right OTP: the 200 from CRT_ABHA_101 step 1.

The person enters both OTPs. Stop for each.

#### CRT_ABHA_108, the communication mobile is the Aadhaar mobile. `sandbox`

When the mobile the person gives is the Aadhaar linked one, your system goes on to ABHA creation with no second OTP. Drive that path. Exit condition: the journey reaches the ABHA address step with no `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_1b66bb` call in the log.

#### CRT_ABHA_109, a different communication mobile is verified. `sandbox`, `human`

Give a mobile that is not the Aadhaar linked one. Exit condition: `m1_post_v3_enrollment_request_otp_mobile_verify_create_ab_1b66bb` returns 200 with a `txnId`, the person enters the OTP, and `m1_post_v3_enrollment_auth_byabdm_mobile_verify_create_ab_091285` returns 200. A wrong OTP here is refused on screen and the person can retry.

Screen checks alongside: resend as in CRT_ABHA_106. The communication mobile, whether the Aadhaar one or another, is the one the ABHA card shows.

#### CRT_ABHA_112, the ABHA address is suggested and validated. `sandbox` and `screen`

Optional only for a programme that creates a default address by demographic authentication.

Exit condition: `m1_get_v3_enrollment_enrol_suggestion_create_abha_aadhaar_otp` returns 200 with `abhaAddressList` holding at least three entries, and `m1_post_v3_enrollment_enrol_abha_address_create_abha_aadhaar_otp` returns 200 with `preferredAbhaAddress` equal to the one chosen.

Screen checks: at least three suggestions are shown, and a free field with these rules printed beside it. Each rule shows green when it is met and red when it is not. An address already taken shows "ABHA address already exists." and offers two choices: proceed with the existing address, or create a new one.

```text
length 8 to 18, including @sbx or @abdm
letters, digits, or both
at most one dot and at most one underscore, neither first nor last
```

#### CRT_ABHA_113, the ABHA number is displayed. `screen`

The 14 digit ABHA number and the ABHA address from CRT_ABHA_112 are shown together with the profile after creation. Evidence: the screen, with the number matching `healthIdNumber` from the pasted response.

#### CRT_ABHA_114, the ABHA card can be viewed and downloaded. `sandbox` and `screen`

For an integrator that shows the ABHA card. Exit condition: `m1_get_v3_profile_account_abha_card` returns 200 with content type `image/png`, sent with the `X-token` from creation. Screen check: the card is shown as the API returned it, with the demographic details it carries, and can be downloaded. A non-KYC ABHA address cannot download a card; the details have to be KYC verified first.

#### CRT_ABHA_115, your own card carries the ABHA details. `screen`

For an integrator that prints its own programme or scheme card instead. A government integrator passes one of CRT_ABHA_114 and CRT_ABHA_115. The card shows the ABHA number and the ABHA address, both required, and your system stores both against your own patient id. Evidence: the card and the stored record.

#### CRT_ABHA_116, a returning patient is matched, not registered again. `screen`

After a creation or a verification, your system searches its own records by mobile, name, gender and age, and by your own beneficiary id such as an MRD or UHID number when one is given. A full match links this visit to the existing beneficiary id. A mismatch in any critical demographic field creates a new one. Evidence: run the same person twice; the second visit is linked to the first beneficiary id and your database holds one row. `hiecm.concept.m1-avoiding-duplicate-abha`
