# Update the mobile on an ABHA

Sheet group: Profile update.

Functionality 8 of 17 in M1's build order. Its group applies to every entity type. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Update the mobile on an ABHA holds no mandatory case |
| Scaffold | Calls | The calls are built in [login-abha-number](login-abha-number.md); they answer in your build |
| Integrate | Integrate notes | Update the mobile on an ABHA works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Update the mobile on an ABHA succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `PROF_ABHA_601`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Update the mobile on an ABHA |

Loop limit: 3 passes through Test for Update the mobile on an ABHA. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `PROF_ABHA_601`.
An integration that already exists enters Update the mobile on an ABHA at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| PROF_ABHA_601 | optional | optional | Mobile Update |

### PROF_ABHA_601: Mobile Update

System must allow the user to update their Mobile number

**Steps**

- 1\. Enter new mobile number
- 2\. Enter OTP
- 3\. Enter Password/ OTP on old mobile number

**Expected Result**

- Mobile number on ABHA profile is updated

## Screen requirements

### In plain words

Changing the mobile on an ABHA is a profile call that needs a logged in user
token. The new number is proved by an OTP before it replaces the old one.

### What happens

| Requirement | Cases |
|---|---|
| Take the new mobile, send the OTP to it, and verify it, with the `X-token` of an ABHA number login | PROF_ABHA_601 |
| Show the mobile as updated only after the verify call returns success, then read the profile again so the screen shows the mobile the ABHA now holds | PROF_ABHA_601 |
| Both OTPs on this screen follow create-abha-aadhaar-otp: its OTP field, wrong OTP and resend rules | PROF_ABHA_601 |

### How you know it worked

The profile fetched after the update carries the new mobile.

From `hiecm.concept.m1-screens-update-mobile`.

## Calls

### Profile, Update Mobile (`m1-profile-update-mobile`)

Built in [login-abha-number](login-abha-number.md). Reuse those calls.

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| PROF_ABHA_601 | Profile, update mobile | `m1_post_v3_profile_account_request_otp_update_mobile`, `m1_post_v3_profile_account_verify_update_mobile` |

## Errors

The specification's examples return no error code on the calls of Update the mobile on an ABHA.

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| PROF_ABHA_601 | `aadhaar-holder`, `otp`, `second-mobile` | none |

### PROF_ABHA_601: profile update

Loop limit: 3 passes per test case.

#### PROF_ABHA_601, the mobile is updated. `sandbox`, `human`

Calls: `m1_post_v3_profile_account_request_otp_update_mobile`, the OTP, `m1_post_v3_profile_account_verify_update_mobile`. The person enters the OTP on the new mobile, and the password or OTP on the old one when asked. Stop for each.

Exit condition: the verify returns 200 with `authResult` `success` and a message that the mobile number was linked; `m1_get_v3_profile_account` then shows the new masked `mobile`.
