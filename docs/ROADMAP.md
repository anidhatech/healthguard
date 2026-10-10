# HealthGuard — Roadmap

> **Status:** technical design (Step 2). No application code yet.
> **Targets** are proposals to agree with partners and pilot sites. Each phase ends at an exit gate, not a date.
>
> Related: [PRD](PRD.md) · [Architecture](ARCHITECTURE.md) · [Data model](DATA_MODEL.md) · [Security](SECURITY.md) · [AI agents](AI_AGENT_SPEC.md) · [FHIR mapping](FHIR_MAPPING.md) · [ABDM integration](ABDM_INTEGRATION.md)

## Overview

| | Phase 1 — Investor/Partner Demo | Phase 2 — Clinic Pilot | Phase 3 — Hospital Pilot | Phase 4 — Production Scale |
|---|---|---|---|---|
| Purpose | Show the whole journey | Prove value with real patients in one clinic | Prove it inside a hospital's workflows and systems | Serve many clinics and hospitals |
| Users | Presenters using seeded personas | One clinic; 100–500 consenting patients | One hospital; 2–3 outpatient departments; 1,000–3,000 consenting patients | Many organizations |
| Data | Synthetic only | Real, under contracts and consent | Real | Real |
| Hosting | Laptop with Docker Compose; optional small VM | Small managed environment in AWS Mumbai | Production environment in AWS India regions | Scaled; Hyderabad for disaster recovery |
| AI provider | Anthropic API with synthetic data, or `DemoAIProvider` offline | Claude through Amazon Bedrock's India inference profile | Same | Any provider that passes the eval gate and keeps data in India |
| ABDM | Simulated and labelled | Sandbox prototype of M1 and M2, in a separate environment | Certified HIP (M1, M2) live; HIU (M3) in the sandbox | HIU (M3) live |
| Length | Until the exit gate | About three months of patient use | About six months | Ongoing |

**Constant in every phase:** HealthGuard does not diagnose, prescribe, change doses or stop medicines, does not book on anyone's behalf without their explicit action, and is not an emergency service ([PRD §10](PRD.md#10-explicitly-out-of-scope)). Every phase keeps tenant isolation, consent-aware access with the same rules for AI, an append-only audit trail, the four kinds of content and template-first medication instructions.

## Phase 1 — Investor/Partner Demo

**Goal.** A repeatable 12-minute demonstration of the full journey on synthetic data, on a laptop, online or offline ([PRD §8](PRD.md#8-mvp-and-demo-scope-phase-1)).

**Status (October 2026): built.** Everything below works on synthetic data, with these differences from the plan: document upload and AI extraction are not built (the day-85 report is seeded, and the patient confirms its values); staff invitations are not built; the persona switcher is the demo sign-in page; prescribing covers once-a-day oral tablets and capsules. See the README's known limitations.

### Features
- Two demo tenants, HealthGuard Demo Clinic and Lakeview Demo Hospital, with seeded personas: Ananya Rao (patient), Dr. Meera Sharma, Dr. Arjun Menon, Ravi Kumar (care coordinator), a clinic admin and a Lakeview Demo Hospital doctor.
- Patient PWA in English, Hindi and Telugu: medication cards and instructions, reminders, Taken, Snooze, Skip, Missed and Need help, record timeline, sharing screen and access log.
- Clinician workspace: patient list with flags, structured prescribing with an allergy check and signing, instruction review and approval, "What changed since last visit?", the AI Doctor Brief with sources and the AI details drawer, follow-ups with a patient-approved mock booking.
- Lab before/after comparisons, trends in association-only wording, synthetic activity and vitals.
- Consent grant and revocation, with AI assistance as its own purpose; access log of allowed and denied attempts.
- FHIR R4 export tagged synthetic; the simulated ABDM panel.
- Demo console: personas, scenario clock with checkpoints (days 0, 6, 42, 85, 88, 92), reset, AI provider switch.
- **DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE** on every screen and export.

### Integrations

| Integration | Phase 1 form |
|---|---|
| Anthropic API | Through `AIProvider`; synthetic data only; `ANTHROPIC_API_KEY` from the environment |
| `DemoAIProvider` | Recorded fixtures and a template composer; no network |
| FHIR R4 | Export only, base resources ([FHIR mapping](FHIR_MAPPING.md)) |
| ABDM | `SimulatedAbdmAdapter`; no network ([ABDM integration §7](ABDM_INTEGRATION.md#7-simulated-in-the-demo-versus-real-later)) |
| Devices | `SyntheticDeviceAdapter` |
| Reminders | In-app and a simulated phone panel |

Nothing else is connected.

### Security requirements
- Synthetic-only enforcement: demo organizations accept only patients with `isSynthetic = true`; uploads come only from the sample library; the banner and the `SYNTHETIC` export tag.
- Tenant isolation layers 1–4 with a cross-tenant test suite in CI.
- `AccessService` decides every patient-data read and every AI request; AI also needs the `AI_ASSISTANCE` consent.
- Append-only audit with row hashes; the patient's access log.
- Secrets only from the environment; `.env.example` with placeholders; gitleaks in CI.
- httpOnly cookies, CSRF protection, strict Content Security Policy, rate limits, logging allowlist.
- AI safety validators, with the eval suites as a merge gate.

### Infrastructure
- Docker Compose on a laptop: `web`, `api`, `worker`, `migrate`, `postgres`, `redis`, `minio`, with optional Mailpit, ClamAV and Jaeger profiles ([Architecture §10](ARCHITECTURE.md#10-deployment-architecture)).
- Optional remote demo: the same images on one small VM in AWS Mumbai behind Caddy (TLS, basic auth or an IP allowlist), `DEMO_MODE=true`.
- GitHub Actions: lint, type checks, unit and integration tests, AI evals, cross-tenant suite, image build to a private registry.
- No Kubernetes and no managed cloud services.

### Clinical workflow requirements
- Only a prescriber signs a medication plan. AI-assisted notes are released only after the prescriber approves them.
- Dose lines come from instruction templates reviewed by a clinician and a native speaker of each language before the first demo.
- The patient approves an appointment before the clinic can confirm it; a database check enforces this.
- Need help shows the emergency numbers (112, and 108 for an ambulance) first.
- Every clinical item shows its kind (recorded fact, calculation, AI summary, AI suggestion); nothing suggests a demo prescription is a real instruction.

### Success criteria

| Criterion | Target |
|---|---|
| Script completed end to end without manual fixes | 3 consecutive runs |
| The same script offline (`DemoAIProvider`) and with the live API | Both pass |
| Safety eval suites | 100% pass |
| Hero panel | HbA1c 7.4 → 6.8 %, weight 74.2 → 72.9 kg, average daily steps 5,200 → 7,100, adherence 92% (166 / 180 doses), each linked to its sources and shown within one second |
| Access proofs | Dr. Arjun denied; the Lakeview user gets "not found"; both appear in Ananya's access log |
| Reset and checkpoint jumps | Under 60 seconds |
| Languages | English, Hindi and Telugu render correctly on Android Chrome and iOS Safari |
| Partner and investor demos with structured feedback | At least 3 |
| Clinics agreeing to discuss a pilot | At least 1 |

### Exit gate
- The success criteria are met.
- A pilot clinic has signed a letter of intent.
- Phase 2 prerequisites have started: legal review (data-processing agreement and DPDP roles), a data-protection impact assessment, and a regulatory assessment of whether any feature counts as a medical device under India's Medical Devices Rules, 2017.

## Phase 2 — Clinic Pilot

**Goal.** Show, with real patients in one clinic, that clear multilingual medication instructions, reminders and planned follow-up raise engagement and follow-up completion, and that doctors can review the brief quickly.

**Shape.** One clinic caring for people with diabetes and hypertension; 100–500 consenting patients; about three months of use, long enough for one repeat HbA1c.

### Features
- Real sign-in: phone OTP for patients; OIDC single sign-on with MFA for staff.
- Consent notices in English, Hindi and Telugu; revocation; data-principal requests for access, correction, erasure, grievance and nominee.
- Reminders over WhatsApp with SMS fallback, and web push. Need help reaches the clinic during clinic hours; outside them the app shows the clinic's hours and the emergency numbers.
- Real document uploads with malware scanning and AI extraction confirmed by a person.
- Caregiver access with the patient's `CAREGIVING` consent, including missed-dose alerts.
- Break-glass access with review by the clinic's privacy lead.
- A small React Native companion app, the project's first native code, that reads Apple Health and Health Connect with the patient's permission and syncs through the `DeviceDataAdapter`; manual entry of home readings in the PWA.
- Read-aloud audio from text-to-speech in English, Hindi and Telugu, generated only from approved instruction text and spot-checked by native speakers for each template.
- Family history.
- Appointment confirmation through the clinic's calendar where it offers an API, otherwise by the care coordinator.
- Flagged AI items go to a review queue. A classifier may route Need help messages, never answer them.
- The demo console and banner are removed for the pilot organization; demo organizations keep both.

### Integrations

| Integration | Phase 2 form |
|---|---|
| Claude | `BedrockProvider` through Amazon Bedrock's India geographic cross-Region inference profile; the eval suite must pass on the configured models; no demo fallback ([AI agents §3.2](AI_AGENT_SPEC.md#32-provider-abstraction)) |
| WhatsApp | WhatsApp Business Platform with pre-approved templates in three languages |
| SMS | A provider using a sender ID and templates registered on TRAI's DLT platform |
| Push | Web Push from the PWA |
| Apple Health and Health Connect | Through the companion app |
| Staff identity | OIDC: Keycloak, Amazon Cognito or the clinic's identity provider |
| ABDM | Sandbox prototype of M1 and M2 in a separate environment with test identities; NRCeS bundles validated against the implementation guide's package ([ABDM integration §8](ABDM_INTEGRATION.md#8-path-to-a-real-integration)) |
| Text-to-speech | A service with Indian English, Hindi and Telugu voices |

### Security requirements
- Row-level security on (isolation layer 5); field-level encryption of identifiers with KMS data keys and blind indexes.
- TLS everywhere, including between services; KMS-encrypted database, buckets and backups.
- A secrets manager with rotation. No standing access to production data; support access is time-boxed and audited.
- Hourly audit digests in Object Lock storage and a SIEM feed; logs archived in India for at least 180 days; audit events kept at least one year.
- MFA for staff; OTP device binding and new-device alerts for patients; alerts on unusual access volume.
- Messages outside the app (WhatsApp, SMS, push) name no medicine or condition by default; the patient can opt in to details.
- VAPT by a CERT-In-empanelled auditor before go-live, with high and critical findings closed.
- A data-protection impact assessment; a data-processing agreement in which the clinic is the data fiduciary and HealthGuard its processor; the AI provider's terms and data retention confirmed.
- Incident response that meets CERT-In's six-hour reporting rule and the DPDP Rules' breach intimation. Most DPDP obligations apply from 13 May 2027; the pilot follows them from the start.

### Infrastructure
- A small, managed footprint in AWS Mumbai (ap-south-1), defined as infrastructure as code:
  - the same `web`, `api` and `worker` images on Amazon ECS with Fargate, behind an Application Load Balancer with AWS WAF;
  - Amazon RDS for PostgreSQL 17, encrypted, with point-in-time recovery and backup copies in Hyderabad (ap-south-2);
  - Amazon ElastiCache for Valkey;
  - Amazon S3 with KMS encryption, versioning, and Object Lock for audit digests;
  - AWS Secrets Manager, CloudWatch, and OpenTelemetry traces.
- Environments: staging and pilot production, with the ABDM sandbox environment separate from both.
- No Kubernetes.

### Clinical workflow requirements
- The clinic's medical lead signs off the instruction templates in each language after review by a clinician and a native speaker; any template change repeats that review.
- A prescriber signs every plan and approves every AI-assisted note.
- Patients are enrolled at the clinic with assisted consent, including their choice about AI assistance.
- Need help call-backs happen within the same clinic working day, as agreed with the clinic. Patients are told at enrolment that HealthGuard is not a monitoring or emergency service.
- Missed-dose flags and caregiver alerts are reviewed at the clinic's normal pace, not treated as alarms.
- Doctors review the brief before relying on it and accept or dismiss each AI suggestion.
- A named clinical safety lead reviews the hazard log and any incident weekly.

### Success criteria

| Criterion | Target |
|---|---|
| Patients answering reminders weekly at day 60 | At least 70% of enrolled |
| Follow-up and repeat-test completion | At least 15 points above the clinic's baseline |
| Median time for a doctor to review the brief | Under 60 seconds |
| Released instructions failing a preservation check | Zero |
| Reminders sent within 5 minutes of the due time | At least 99% |
| Patients who explain their dose and timing correctly in a teach-back sample | At least 90% |
| Doctors rating the brief useful | At least 70% |
| Safety incidents caused by a shown instruction | Zero |
| Cross-tenant or unauthorized access incidents | Zero |
| Availability during clinic hours | At least 99.5% |

### Exit gate
- The success criteria are met, or the gaps are understood with the clinic.
- VAPT findings are closed.
- A hospital partner has signed for Phase 3.
- M1 and M2 work in the ABDM sandbox.

## Phase 3 — Hospital Pilot

**Goal.** Prove HealthGuard inside a hospital: several departments, discharge and outpatient follow-up, integration with the hospital's systems, and live record sharing over ABDM as a certified HIP.

**Shape.** One hospital; 2–3 outpatient departments (for example diabetology, cardiology and nephrology); 1,000–3,000 consenting patients; about six months.

### Features
- Department-level care teams and access policies.
- Specialty templates beyond diabetes (hypertension, heart failure, chronic kidney disease), each with its own "what changed" items.
- Discharge follow-up: discharge prescriptions become structured plans signed by a prescriber, with multilingual instructions and scheduled follow-ups.
- More languages through the same review process (for example Tamil, Kannada or Marathi), chosen with the hospital.
- Coordinator queues at hospital scale: call-backs, overdue follow-ups and missed-dose flags by department.
- Aggregate reporting for the hospital: adherence, follow-up completion and response times per department.
- Recorded doses shared as `MedicationAdministration`; HFR and HPR identifiers in use.
- Voice-call reminders for patients who prefer them.

### Integrations

| Integration | Phase 3 form |
|---|---|
| Hospital information system | Patients, encounters and appointments through FHIR or HL7 v2 via the hospital's interface engine |
| Laboratory system | Results arrive as a `LAB_FEED` source |
| ABDM | Certified HIP (M1, M2) in production for the pilot hospital; HIU (M3) in the sandbox |
| Staff identity | The hospital's single sign-on, for example Entra ID |
| Wearables | Vendor clouds (Google Health API, blood-pressure monitor and glucometer vendors) for patients who opt in |

### Security requirements
- ABDM certification: functional testing by an NHA-empanelled agency, and a WASA by a CERT-In-empanelled auditor with a safe-to-host certificate.
- The hospital's security review; an annual penetration test.
- An ISO/IEC 27001 information security management system in operation, with certification targeted for Phase 4.
- Disaster recovery tested: recovery point at most 15 minutes, recovery time at most 4 hours.
- Security monitoring with on-call coverage during hospital hours; access reviews every quarter.
- The DPDP compliance programme complete before 13 May 2027.

### Infrastructure
- Production in AWS India: a multi-AZ database, autoscaling ECS services, WAF, and separate AWS accounts for production, staging and the ABDM sandbox.
- A public callback endpoint for ABDM, the `interop` queue and an egress proxy ([ABDM integration §5](ABDM_INTEGRATION.md#5-health-information-exchange-boundary)).
- Private connectivity (VPN or a private link) to the hospital's interface engine.
- Still no Kubernetes.

### Clinical workflow requirements
- The hospital's clinical governance approves the templates, each specialty's "what changed" items and each AI feature, department by department.
- Discharge medication reconciliation stays with clinicians; HealthGuard records its result.
- A named clinical safety officer at the hospital and at HealthGuard share one hazard log.
- Training for doctors, nurses and coordinators, with department leads owning the change.

### Success criteria

| Criterion | Target |
|---|---|
| Discharge prescriptions in pilot departments delivered as multilingual instructions within one hour of discharge | At least 80% |
| 30-day follow-up visit completion after discharge | At least 10 points above the hospital's baseline |
| Eligible encounters linked as ABDM care contexts for patients with a verified ABHA | At least 95% |
| ABDM record transfers completed without error | At least 99% |
| Integration messages failing processing | Under 0.5% |
| Open critical or high findings at go-live (WASA, penetration test) | Zero |
| Availability | At least 99.9% per month |
| Median time for a doctor to review the brief | Under 60 seconds |

### Exit gate
- The success criteria are met.
- ABDM production is stable for the pilot hospital.
- A second organization is ready to onboard, and the cost to serve one organization is known.

## Phase 4 — Production Scale

**Goal.** Serve many clinics and hospitals reliably, with onboarding that does not need engineers.

### Features
- Self-serve or assisted onboarding: organization set-up, staff invitations, template selection, organization details on notices (never on clinical content).
- Subscription billing for organizations.
- ABDM HIU (M3) in production: clinicians request a patient's records from other facilities, with the patient's consent through ABDM.
- Organization dashboards for follow-up operations, aggregated. Any research use would need its own governance and consent process.
- More specialties and languages through the same review process.
- An optional site entity for hospital groups with several branches.

### Integrations
- ABDM M3 in production; more hospital and EMR connectors; national drug codes in FHIR exports; more device vendors.

### Security requirements
- ISO/IEC 27001 certification; ISO/IEC 27701 considered.
- Annual WASA and penetration tests; a bug bounty; 24×7 security monitoring.
- Per-organization encryption keys as an option.
- Full DPDP compliance, including data-principal requests at scale and automated retention.
- Breach-response drills twice a year.

### Infrastructure
- AWS India regions: Mumbai primary, Hyderabad for disaster recovery.
- ECS by default; EKS only if scale or operations justify it ([Architecture §10](ARCHITECTURE.md#10-deployment-architecture)).
- Reminders and AI workers extracted first into separately scaled services, along the existing module seams.
- Read replicas for reporting; service-level objectives with error budgets.

### Clinical workflow requirements
- A clinical safety management process across organizations.
- Monitoring of AI output after release (dismissal rates, validator failures, incidents), with periodic re-review of templates and prompts.
- Each organization names a clinical lead who approves its templates and AI features.

### Success criteria

| Criterion | Target |
|---|---|
| Organizations live | At least 20 |
| Gross revenue retention | At least 90% |
| Availability | At least 99.9% per month |
| API latency | p95 under 300 ms |
| Reminder lag | p95 under 2 minutes |
| Time to onboard a clinic | Under 2 weeks |
| Confirmed cross-tenant incidents | Zero |
| AI changes released without passing the eval gate | Zero |

## References

- [Digital Personal Data Protection Rules, 2025: phased commencement](https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-)
- [CERT-In Directions, 2022: overview](https://www.mondaq.com/india/security/1191962/an-overview-on-the-cert-in-cyber-security-directions-2022)
- [Claude in India through Amazon Bedrock cross-Region inference](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-expands-claude-model-availability-to-india-cross-region-inference/)
- [Structured outputs in Amazon Bedrock](https://aws.amazon.com/about-aws/whats-new/2026/02/structured-outputs-available-amazon-bedrock)
- ABDM sources are listed in [ABDM integration §10](ABDM_INTEGRATION.md#10-references).
