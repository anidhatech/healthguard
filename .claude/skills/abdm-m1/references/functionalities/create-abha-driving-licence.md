# Create ABHA by driving licence

Sheet group: ABHA Creation Through Driving License.

Functionality 15 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Create ABHA by driving licence holds no mandatory case |
| Scaffold | Calls | Create ABHA by driving licence makes no ABDM call; skip to Integrate |
| Integrate | Integrate notes | Create ABHA by driving licence works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Create ABHA by driving licence succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `CRT_ABHA_401`, `CRT_ABHA_402`, `CRT_ABHA_403`, `CRT_ABHA_404`, `CRT_ABHA_405`, `CRT_ABHA_406`, `CRT_ABHA_407`, `CRT_ABHA_408`, `CRT_ABHA_410`, `CRT_ABHA_411`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Create ABHA by driving licence |

Loop limit: 3 passes through Test for Create ABHA by driving licence. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `CRT_ABHA_401`, `CRT_ABHA_402`, `CRT_ABHA_403`, `CRT_ABHA_404`, `CRT_ABHA_405`, `CRT_ABHA_406`, `CRT_ABHA_407`, `CRT_ABHA_408`, `CRT_ABHA_410`, `CRT_ABHA_411`.
An integration that already exists enters Create ABHA by driving licence at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| CRT_ABHA_401 | optional | optional | Create ABHA Option |
| CRT_ABHA_402 | optional | optional | Consent Collection |
| CRT_ABHA_403 | optional | optional | Communication Mobile Number |
| CRT_ABHA_404 | optional | optional | Mobile Number Verification |
| CRT_ABHA_405 | optional | optional | Document Verification |
| CRT_ABHA_406 | optional | optional | Document Upload |
| CRT_ABHA_407 | optional | optional | Manual Verification and ABHA Creation |
| CRT_ABHA_408 | optional | optional | Display of ABHA Number |
| CRT_ABHA_410 | optional | optional | View and Download ABHA details (If integrators is generating ABHA card) |
| CRT_ABHA_411 | optional | optional | View and Download ABHA details (If integrators is not generating ABHA card) |

### CRT_ABHA_401: Create ABHA Option

The system must provide an option to create ABHA through Driving License

**Steps**

- User will have a choice to create ABHA using using DL.

**Expected Result**

- Not stated.

### CRT_ABHA_402: Consent Collection

The System must display the consent/ disclaimer language and collect user's consent

**Steps**

- 1\. System displays the consent language/disclaimer as per ABDM guidelines (refer approved consent language in cell number)
- 2\. User agrees to the consent using 'I Agree' checkbox or other approved mechanism (e.g., digital signature).

**Expected Result**

- 1\. User provides consent for sharing DL details for ABHA creation.
- 2\. System records the user's consent in compliance with the Health Data Management Policy

**For the tester**

- Approved consent language :
- https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=consentLanguage

### CRT_ABHA_403: Communication Mobile Number

System must collect the communication mobile number

**Steps**

- 1\. Enters a valid mobile number for communication purpose

**Expected Result**

- User will be able to enter their Mobile Number

### CRT_ABHA_404: Mobile Number Verification

System must verify the provided mobile number

**Steps**

- 1\. Receive OTP on mobile number
- 2\. Enter the OTP and clicks on verify

**Expected Result**

- 1\. In case of incorrect OTP, the system displays an error
- 2\. In case of correct OTP, the system allows the user to proceed

### CRT_ABHA_405: Document Verification

System must verify the provided document - Driving License

**Steps**

- 1\. Enter the Driving License
- 2\. Enter name, date of birth and gender as per the document.
- 3\. Successfully verification will generate enrollment number
- 4\. With this enrollment number patient/ user will approach with any ABDM facility for creation of ABHA number.

**Expected Result**

- System validates user's Driving License

### CRT_ABHA_406: Document Upload

System must allow upload of front and back page of the Driving licence

**Steps**

- 1\. Upload the front and back page of the document i.e Driving License .

**Expected Result**

- Document photos are uploaded in the system

### CRT_ABHA_407: Manual Verification and ABHA Creation

System Operator / healthcare worker must manually check the documents - Driving License

**Steps**

- 1\. A healthcare worker/ system operator manually verifies the Driving License

**Expected Result**

- 1\. Documents are manually verified.
- 2\. In case the document is valid, the operator approves ABHA creation.
- 3\. In case the document is invalid, the operator rejects the ABHA creation.

### CRT_ABHA_408: Display of ABHA Number

System should display the created ABHA Number

**Steps**

- 1\. Show the 14-digit ABHA number generated
- 2\. Show ABHA Number instead of Health ID

**Expected Result**

- User should be able to view the generated ABHA Number

### CRT_ABHA_410: View and Download ABHA details (If integrators is generating ABHA card)

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

- User should be able to view their ABHA Card and the details should be saved in HMIS system and linked with the HMIS unique beneficiary's ID or as per their business requirement.

### CRT_ABHA_411: View and Download ABHA details (If integrators is not generating ABHA card)

If Integrator is not generating ABHA card.

**Steps**

- 1\. If Integrator is not generating ABHA card then they print the mentioned information on their own card.
- a. ABHA Number (Mandatory)
- b. ABHA Address

**Expected Result**

- User should be able to view card with ABHA number and ABHA address.
- Note: In case of non-kyc abha address, users will not be able to download abha card. In order to download ABHA card, details should be KYC verified

## Screen requirements

### In plain words

The person creates an ABHA with a driving licence instead of Aadhaar, and an
operator checks the document. The enrolment by document call is not in the
published M1 specification, so these screens can be built and judged, and the
calls behind them cannot be made yet.

### What happens

| Requirement | Cases |
|---|---|
| Creation offers the driving licence as a method | CRT_ABHA_401 |
| The consent screen from create-abha-aadhaar-otp, where the declaration about a document other than Aadhaar is the one that leads here | CRT_ABHA_402 |
| Take the communication mobile and verify it by OTP | CRT_ABHA_403, CRT_ABHA_404 |
| Take the licence number with the name, date of birth and gender as the document shows them | CRT_ABHA_405 |
| Upload a photo of the front and of the back of the licence | CRT_ABHA_406 |
| An operator checks the documents and approves or rejects the creation | CRT_ABHA_407 |
| Show the 14 digit number as the ABHA number, never as a Health ID | CRT_ABHA_408 |
| Show the ABHA card, or print the ABHA number and address on your own card, saved and linked to your beneficiary id | CRT_ABHA_410, CRT_ABHA_411 |

### How you know it worked

Each screen above exists and holds what its case names.

From `hiecm.concept.m1-screens-create-abha-driving-licence`.

## Calls

Create ABHA by driving licence makes no ABDM call: no operation in the specification serves its cases.

- CRT_ABHA_404, step 1: Sends and verifies the mobile OTP. The spec has request/otp and auth/byAbdm only inside the Aadhaar, face and biometric creation journeys, not for a driving licence.
- CRT_ABHA_405, step 3: Verifies the licence and returns an enrolment number through enrol/byDocument, which the spec lacks.
- CRT_ABHA_406, step 1: Uploads the front and back of the licence through enrol/byDocument, which the spec lacks.
- CRT_ABHA_407, step 1: The operator's approval creates the ABHA through enrol/byDocument, which the spec lacks.
- CRT_ABHA_408, step 1: Shows the ABHA number enrol/byDocument would return; the spec lacks that call.
- CRT_ABHA_410, step 1: Shows the ABHA card; profile/account/abha-card needs the token enrol/byDocument would return, and the spec lacks that call.
- CRT_ABHA_411, step 1: Prints the ABHA number and address enrol/byDocument would return; the spec lacks that call.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| CRT_ABHA_401 | Create ABHA entry, method choice | None |
| CRT_ABHA_402 | Driving licence consent | None |
| CRT_ABHA_403 | Communication mobile entry | None |
| CRT_ABHA_404 | Communication mobile OTP | None |
| CRT_ABHA_405 | Driving licence details | None |
| CRT_ABHA_406 | Driving licence upload, front and back | None |
| CRT_ABHA_407 | Operator verification of the licence | None |
| CRT_ABHA_408 | Created ABHA number | None |
| CRT_ABHA_410 | ABHA card, view and download | None |
| CRT_ABHA_411 | Integrator's own card with ABHA details | None |

## Errors

The specification's examples return no error code on the calls of Create ABHA by driving licence.

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| CRT_ABHA_401 | nothing | none |
| CRT_ABHA_402 | nothing | none |
| CRT_ABHA_403 | nothing | none |
| CRT_ABHA_404 | `otp` | step 1 |
| CRT_ABHA_405 | `driving-licence` | step 3 |
| CRT_ABHA_406 | `driving-licence` | step 1 |
| CRT_ABHA_407 | `driving-licence` | step 1 |
| CRT_ABHA_408 | `driving-licence` | step 1 |
| CRT_ABHA_410 | `driving-licence` | step 1 |
| CRT_ABHA_411 | `driving-licence` | step 1 |

### CRT_ABHA_401 to 411: create an ABHA by driving licence

The set names `/abha/api/v3/enrollment/enrol/byDocument` for every case in this group. ABDM's M1 specification does not publish that operation, so there is no operation id to call. Record every case in this group `not-run` with that reason, until an operation is published. Do not improvise a call. Each heading names the evidence the case will need once an operation exists.

Loop limit: 3 passes per test case.

#### CRT_ABHA_401, the option exists. `screen`

The set checks that your system offers creation by driving licence.

#### CRT_ABHA_402, consent is shown and recorded. `screen`

The set checks consent for sharing the driving licence details, as CRT_ABHA_102.

#### CRT_ABHA_403, the communication mobile is collected. `screen`

#### CRT_ABHA_404, the mobile is verified by OTP. `sandbox`, `human`

#### CRT_ABHA_405, the driving licence is verified. `sandbox`

The set describes an enrolment number returned after the licence, name, date of birth and gender are checked, which the person takes to an ABDM facility.

#### CRT_ABHA_406, the licence front and back are uploaded. `screen`

#### CRT_ABHA_407, an operator checks the documents and approves or rejects. `human`

#### CRT_ABHA_408, the ABHA number is displayed. `screen`

#### CRT_ABHA_410, the ABHA card can be viewed. `sandbox` and `screen`

#### CRT_ABHA_411, your own card carries the ABHA details. `screen`
