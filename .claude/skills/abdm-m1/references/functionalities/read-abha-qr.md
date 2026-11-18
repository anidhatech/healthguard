# Read an ABHA QR code

Sheet group: Reading ABHA Info using ABHA QR Code.

Functionality 9 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Read an ABHA QR code holds no mandatory case |
| Scaffold | Calls | Read an ABHA QR code makes no ABDM call; skip to Integrate |
| Integrate | Integrate notes | Read an ABHA QR code works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Read an ABHA QR code succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_501`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Read an ABHA QR code |

Loop limit: 3 passes through Test for Read an ABHA QR code. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_501`.
An integration that already exists enters Read an ABHA QR code at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_501 | optional | optional | Reading ABHA Profile Info using ABHA QR Code |

### VRFY_ABHA_501: Reading ABHA Profile Info using ABHA QR Code

System must allow scanning of ABHA QR code to read the ABHA information

**Steps**

- 1\. EMR/HMIS scans the user's ABHA QR code

**Expected Result**

- System reads the user information from the ABHA QR code - name, date of birth, gender, mobile and other details and populates the same in the system for registration.

## Screen requirements

### In plain words

The QR code on an ABHA card carries the profile. Your system reads it on its
own device and fills the registration form from it.

### What happens

| Requirement | Cases |
|---|---|
| Scan the ABHA QR code and fill name, date of birth, gender, mobile and the other details it carries into the registration form | VRFY_ABHA_501 |
| Nobody types what the QR code carried, and the read only rule in login-abha-number holds on the filled form | VRFY_ABHA_501 |

### How you know it worked

A scan of the tester's card fills the form with the card's details.

From `hiecm.concept.m1-screens-read-abha-qr`.

## Calls

Read an ABHA QR code makes no ABDM call: no operation in the specification serves its cases.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| VRFY_ABHA_501 | Registration form filled from a scanned ABHA QR code | None |

## Errors

The specification's examples return no error code on the calls of Read an ABHA QR code.

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_501 | `aadhaar-holder` | none |

### VRFY_ABHA_501: read the ABHA QR code

Loop limit: 3 passes per test case.

#### VRFY_ABHA_501, the ABHA QR code fills registration. `screen`

No call. Your system scans a person's ABHA QR code and fills name, date of birth, gender, mobile and the other details into registration from it. Evidence: the filled form after a scan, with nothing typed. `hiecm.concept.m1-two-routes-to-the-profile`
