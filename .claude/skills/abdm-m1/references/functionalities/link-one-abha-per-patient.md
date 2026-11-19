# Link one ABHA number to one patient record

Sheet group: Verify one ABHA Number is linked to the unique patient ID in HMIS.

Functionality 6 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each of `TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER`, for your entity type, is mapped to a screen or route in `INTEGRATION-PLAN.md` |
| Scaffold | Calls | Link one ABHA number to one patient record makes no ABDM call; skip to Integrate |
| Integrate | Integrate notes | Link one ABHA number to one patient record works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Link one ABHA number to one patient record succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER` |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Link one ABHA number to one patient record |

Loop limit: 3 passes through Test for Link one ABHA number to one patient record. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER`.
An integration that already exists enters Link one ABHA number to one patient record at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER. Mandatory for a private entity: TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER.

| Case | Government | Private | What is tested |
|---|---|---|---|
| TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER | mandatory | mandatory | Verify one ABHA Number is linked to the unique patient ID in HMIS |

### TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER: Verify one ABHA Number is linked to the unique patient ID in HMIS

Intergrator's HMIS System should allow tagging of one ABHA Number with unique patient Id.

**Steps**

- 1\. ABHA Number should be validated in the database if already exists before creating a new patient id to avoid tagging of multiple patient id with same ABHA Number.
- 2\. If ABHA number is not already linked, tag it to the unique Patient ID.
- 3\. If ABHA number is already linked, prevent the creation of a new patient ID.
- Kindly Note: This test scenario is applicable for both new and existing beneficiaries and linking will be happens with ABHA creation and verification flow.

**Expected Result**

- HMIS is able to tag Patient ID with ABHA number.

## Screen requirements

### In plain words

No ABDM call decides this. It is a check on your own records, run every time
an ABHA reaches registration, by creation or by verification.

### What happens

| Requirement | Cases |
|---|---|
| Before creating a patient id, look up the ABHA number in your records | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER |
| Not found: tag the ABHA number to the new patient id | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER |
| Found: open the existing patient id and create no new one | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER |

### How you know it worked

Registering the same ABHA number twice, once by creation and once by a login,
leaves one patient id carrying it.

From `hiecm.concept.m1-screens-link-one-abha-per-patient`.

## Calls

Link one ABHA number to one patient record makes no ABDM call: no operation in the specification serves its cases.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER | Patient registration, ABHA number already linked | None |

## Errors

The specification's examples return no error code on the calls of Link one ABHA number to one patient record.

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER | `patient-registered` | none |

### TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER: one ABHA per patient id

Loop limit: 3 passes per test case.

#### TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER, one ABHA maps to one patient id. `screen`

Your system checks whether an ABHA number already exists in its database before it creates a patient id, on both the creation and the verification paths. Not yet linked, it tags the ABHA to the patient id. Already linked, it creates no new patient id. So one ABHA never maps to two of your patients and one of your patients never holds two ABHAs.

Evidence: verify the same ABHA twice in a run. The second time, the screen says the record is already linked and names your patient id, and the database holds one row. `hiecm.concept.m1-avoiding-duplicate-abha`
