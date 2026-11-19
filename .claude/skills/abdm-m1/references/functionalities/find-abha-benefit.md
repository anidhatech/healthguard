# Find the benefits linked to an ABHA

Sheet group: Find ABHA for benefit.

Functionality 17 of 17 in M1's build order. Find the benefits linked to an ABHA applies to government entities only. Read [foundations.md](../foundations.md) at Design, and [run.md](../run.md) at Test and Record.

## The loop

| Phase | In this file | Exit |
|---|---|---|
| Design | Screen requirements | Each screen requirement below is mapped to a screen in `INTEGRATION-PLAN.md`; Find the benefits linked to an ABHA holds no mandatory case |
| Scaffold | Calls | Every call in `m1-benefit-search` reaches its exit condition against the sandbox |
| Integrate | Integrate notes | Find the benefits linked to an ABHA works end to end on your own screen, for the screens the notes name |
| Debug | Errors, then the loop in [errors.md](../errors.md) | The failing step of Find the benefits linked to an ABHA succeeds |
| Test | Cases, How the cases run | The Test exit in [run.md](../run.md), over `VRFY_ABHA_701`, none of them mandatory |
| Record | [run.md](../run.md): the workbook writer, the report | The draft report shows Find the benefits linked to an ABHA |

Loop limit: 3 passes through Test for Find the benefits linked to an ABHA. On the fourth, escalate in the format [run.md](../run.md) sets out, naming the case among `VRFY_ABHA_701`.
An integration that already exists enters Find the benefits linked to an ABHA at Test, and goes back to Design or Integrate only for a case that fails.

## Cases

Mandatory for a government entity: none. Mandatory for a private entity: none.

| Case | Government | Private | What is tested |
|---|---|---|---|
| VRFY_ABHA_701 | optional | not applicable | Retrieve benefit programs linked to an ABHA number |

### VRFY_ABHA_701: Retrieve benefit programs linked to an ABHA number

To verify that the system correctly retrieves a list of benefit programs linked to a given ABHA number

**Steps**

- 1\. User provides a valid ABHA number

**Expected Result**

- 1\. The response should contain a list of benefit programs linked to the ABHA number.

## Screen requirements

### In plain words

A government entity can list the benefit programmes an ABHA number is
enrolled in.

### What happens

| Requirement | Cases |
|---|---|
| Given a valid ABHA number, show the list of benefit programmes the call returns for it | VRFY_ABHA_701 |

### How you know it worked

The list on screen matches the programmes in the response.

From `hiecm.concept.m1-screens-find-abha-benefit`.

## Calls

### Benefit, Search (`m1-benefit-search`)

**Act: the calls in this journey, in order**

#### 1. Benefit search by xmlUid (`m1_post_v3_profile_benefit_search_xmluid`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/benefit/search \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'BENEFIT_NAME: {{Benefit Name}}' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "search"
  ],
  "loginHint": "xmlUid",
  "loginId": "{{encrypted xmlUid}}"
}'
```

#### 2. Benefit search by ABHA number (`m1_post_v3_profile_benefit_search_abha_number`)

```bash
curl --request POST \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/benefit/search \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z' \
  --header 'BENEFIT_NAME: {{Benefit Name}}' \
  --header 'Content-Type: application/json' \
  --data '{
  "scope": [
    "search"
  ],
  "loginHint": "abha-number",
  "loginId": "{{encrypted abha-number}}"
}'
```

#### 3. Get benefits linked to an ABHA number (`m1_get_v3_profile_benefit_abha_abhanumber`)

```bash
curl --request GET \
  --url https://abhasbx.abdm.gov.in/abha/api/v3/profile/benefit/abha/{abhanumber} \
  --header 'Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>' \
  --header 'BENEFIT_NAME: {{Benefit Name}}' \
  --header 'REQUEST-ID: 18235d89-cb13-479d-ad71-7a57d5f669a8' \
  --header 'TIMESTAMP: 2022-10-06T15:10:00.587Z'
```

**Exit condition (Observe until this is true)**

A 200 whose body matches:

```json
{
  "abhaNumber": "<ABHA_NUMBER>",
  "programme": [
    {
      "benefitName": "Poshan Abhiyaan"
    },
    {
      "benefitName": "Test Benefit Program"
    },
    {
      "benefitName": "Pradhan Mantri National Dialysis Programme"
    }
  ]
}
```

## Integrate notes

| Case | Screen | Calls |
|---|---|---|
| VRFY_ABHA_701 | Benefit programmes for an ABHA number | `m1_get_v3_profile_benefit_abha_abhanumber` |

| Operation | Call | What it does |
|---|---|---|
| `m1_post_v3_profile_benefit_search_xmluid` | `POST /abha/api/v3/profile/benefit/search` | Benefit search by xmlUid |
| `m1_post_v3_profile_benefit_search_abha_number` | `POST /abha/api/v3/profile/benefit/search` | Benefit search by ABHA number |
| `m1_get_v3_profile_benefit_abha_abhanumber` | `GET /abha/api/v3/profile/benefit/abha/{abhanumber}` | Get benefits linked to an ABHA number |

Headers the calls of Find the benefits linked to an ABHA take: `REQUEST-ID`, `TIMESTAMP`, `BENEFIT_NAME`. What each one is: [foundations.md](../foundations.md), Headers.

## Errors

| Call | HTTP | Code | Message |
|---|---|---|---|
| `m1_post_v3_profile_benefit_search_xmluid` | 401 | `900902` | Missing Credentials |
| `m1_post_v3_profile_benefit_search_xmluid` | 404 | `ABDM-1114` | User not found. |
| `m1_post_v3_profile_benefit_search_abha_number` | 401 | `900902` | Missing Credentials |
| `m1_post_v3_profile_benefit_search_abha_number` | 404 | `ABDM-1114` | User not found. |
| `m1_get_v3_profile_benefit_abha_abhanumber` | 401 | `900901` | Invalid Credentials |
| `m1_get_v3_profile_benefit_abha_abhanumber` | 404 | `ABDM-1114` | User not found. |

Other codes, and the debug loop: [errors.md](../errors.md).

## How the cases run

Need names are defined in [run.md](../run.md).

| Case | Needs | Steps with no call |
|---|---|---|
| VRFY_ABHA_701 | `aadhaar-holder` | none |

### VRFY_ABHA_701: benefit programmes linked to an ABHA number

A private integrator records it `not-run`: the group applies to government entities only.

Loop limit: 3 passes per test case.

#### VRFY_ABHA_701, the benefit programmes are listed. `sandbox`

Call `m1_get_v3_profile_benefit_abha_abhanumber` with a valid ABHA number. Exit condition: 200 with `abhaNumber` equal to the one sent and a `programme` array, each entry carrying `benefitName`. Screen check: your system shows the list.
