# Foundations, M1

What holds for every functionality: the rules across calls, the hosts and headers, the codebase survey, and the design rules that are not about one functionality. Read it once per session.

## Before anything else

- Paste the sandbox response at every step and check it against the shape this skill gives before you build on it. A step is done when its response is observed.
- The design section's rules come from building a working front desk against the sandbox, and each atom it cites names what was observed and the date it was seen.
- ABDM publishes operations, not a user experience. The journey is the integrator's to design, so offer the shape below as a suggestion and build what they ask for instead when they have a view of their own counter.
- The ABHA step comes before the registration form and fills it. A verified profile carries the whole form, so a journey that registers the patient first and offers ABHA afterwards has already spent the keystrokes it existed to save.
- Two ways the profile reaches the desk. The patient scans a QR and consents in their own app, and ABDM posts the profile to your callback, so nobody types or asks anything. Or the desk runs the identifier journey. The filled form is the destination either way.
- Decide deliberately whether a journey can complete without an ABHA. A record keyed by the facility's own number does not need one, and a journey that cannot finish without one blocks care for anyone who has none.
- An identifier and an auth method are two different questions, and listing them together is what makes M1 look like five choices. Ask which identifier first, then offer auth methods underneath it, and only where there is more than one.
- Offer Create ABHA and the verification routes the cases require. Creation by Aadhaar cannot make a second ABHA: an Aadhaar that already holds one comes back with isNew false and that account, and the journey carries on from it. On a login, only ABDM-1114 means nobody holds an ABHA; create on any other refusal and the patient can end up with two numbers, which nothing merges.
- Get an access token first, from the gateway session endpoint. Every other call needs it in `Authorization: Bearer <token>`.
- Two tokens exist and they are not interchangeable. The gateway access token goes in `Authorization`. The user token from an enrolment or a login goes in `X-token`. Profile endpoints need both.
- Sensitive fields travel encrypted. Aadhaar numbers, mobile numbers, email addresses, OTP values and passwords are encrypted before they go in the body, then base64 encoded.
- The certificate response tells you the padding. `GET /v3/profile/public/certificate` returns `{"publicKey", "encryptionAlgorithm"}`. Read that field and translate it for your language. Do not hard code a padding: a constant is right until it is not, and the failure then looks like a bad value rather than a stale constant.
- One path serves several jobs. The `scope` array in the body picks which one, so read it before assuming an endpoint does one thing.
- The accounts array on a login verification already carries ABHANumber, preferredAbhaAddress, name, gender, dob, profilePhoto and kycVerified, so a registration form can fill the moment the OTP verifies and before any profile call.

## Practices that hold across every call

- Read the body, not only the status. A refusal often names the field in its body while the status says nothing useful.
- When ABDM publishes a value, read it rather than hard coding what it currently says. That covers a parameter, such as the encryption algorithm the certificate endpoints return beside the key, and it covers an enumeration. The registries publish theirs as master data calls: councils, courses, colleges, states and districts on the HPR, and facility types and LGD codes on the HFR. A table typed into your source goes stale silently. Purposes and HI types have no master data call: take them from the enumeration in the specification of the call you are making. Refuse to act on a published value you do not recognise rather than falling back to a default.
- Read every field in a response, not the one you came for. The M1 certificate call returns the encryption algorithm next to the key.
- Prove an assumption against a call that is able to disagree with you. A call that refuses every input with one message cannot tell you which input was right.
- Suspect the transport before the data. When a call refuses a value you believe in, check the encryption, the headers and the clock before you doubt the value.
- Do not carry an encryption path from one module to another. Read the certificate and the algorithm from the registry you are calling.
- Never log a sensitive value before you encrypt it, and never send one to a remote service to be encrypted. Both move the leak rather than removing it.
- Generate a fresh REQUEST-ID for every call and log it before sending. Once a call has failed it is the only handle on it.
- Check the host on any sample before you copy it. A request copied whole can be correct in every respect except where it is pointed, and that failure looks like credentials.
- Do not validate an identifier more strictly than the platform does. A schema that types a field as a UUID is not a promise that every value is one. Refusing a value ABDM would have accepted turns your own client into the thing that broke.
- Read a plural response as plural. A verification returns an accounts array and a consent request can produce more than one artefact. Store the collection and decide from its length.
- A documented callback path is not a documented callback payload. Log the whole body on arrival before you parse it, so a handler written against an assumed shape fails where you can see it.
- Decode a token before you use it. A call that hands you a token has not necessarily handed you the token the next call wants, and the claims are base64 that need no library to read.
- When a journey carries the same parameter through two calls, check what each call's specification asks for rather than carrying the first value forward.
- Do not infer which path an identifier belongs to from where that identifier is most discussed. Send every identifier to the lookup first and let the answer pick the path, so nobody who already holds an account is sent to create a second.
- Do not match an error code with string equality. A code may come back bare, as `ABDM-1001`, or with a trailing `: ` separator, as `ABDM-1001: `. Match on the code itself and tolerate the separator.
- Handle a failure that carries no body. Check for an empty body before you parse, or your client throws on the simplest failure there is.
- Back off on an authentication failure rather than retrying, and never loop a credential check.
- Send TIMESTAMP in UTC, ISO-8601 with milliseconds and a trailing Z, as in `2022-10-06T15:10:00.587Z`.
- Cache a public certificate with a validity window rather than forever. A rotation fails every encrypted call at once, and a cache with no expiry cannot recover on its own.

## Hosts

- `https://abhasbx.abdm.gov.in` ABHA service, sandbox
- `https://dev.abdm.gov.in` ABDM gateway, sandbox
- `https://apis.abdm.gov.in` ABDM gateway, production

## Headers

| Header | What it is |
| --- | --- |
| `REQUEST-ID` | Unique UUID for track the end to end request transaction |
| `TIMESTAMP` | Actual time of the request was initiated, ISO 8601 represents date and time by starting with the year, follow… |
| `X-CM-ID` | Suffix of the consent manager to which the request was intended |
| `TRANSACTION_ID` | Transaction ID from the ABHA creation response. |
| `Content-Type` | `application/json`. |
| `BENEFIT_NAME` | Benefit / program name approved by NHA for the integrator. |
| `X-token` | User token (`Bearer <token>`) received after ABHA creation / login. |
| `R-token` | Refresh token (`Bearer <refreshToken>`) received at login. |
| `T-token` | Short-lived token (`Bearer <token>`) returned by *Login via Mobile number - verify OTP*. |
| `X-HIP-ID` | Identifier of the health information provider to which the request was intended |

## Before the first journey, when the codebase already exists

Skip this section only for a system that does not exist yet. Otherwise it runs first, and its exit condition is a written plan, not a call.

### In plain words

Most ABDM integrations are not new systems. They are a hospital management
system, a laboratory system or a clinic application that already has patients,
visits, records, a login, an HTTP client and a way of keeping secrets. Every
ABDM journey has to land somewhere inside that, and a journey built before the
codebase has been read lands in the wrong place: a second HTTP client beside the
first, an ABHA column on the wrong table, a callback route the reverse proxy
never forwards.

So the first loop is not a journey. It is a survey of the system as it is, and
its exit condition is a written plan that names, for every ABDM touchpoint, the
file it will live in. The journeys then build against that plan rather than
against the specification's idea of a fresh codebase.

### Before you start

- The repository, checked out, with permission to read all of it. A survey of
  half a codebase produces a plan for half a system.
- The answers to the deployment interview. The
  code says what the system is. Only the integrator can say what the
  deployment is, and the two together decide which journeys are built at all.
- The practices that hold across every call, which
  the plan has to leave room for.

### What happens

This is one loop with a limit of eight passes over the codebase. Each pass
reads live state only, which here means the files themselves, never a README's
description of them and never an assumption carried from a similar system.

**Observe.** Inventory the system from its manifests and its tree, not from its
documentation. Record file paths for each of these, or record that none exists:

| Find | Where it usually shows | Why ABDM needs it |
|---|---|---|
| Languages and runtime versions | package manifests, lock files, toolchain files | Every generated call has to be idiomatic here |
| Build, run and test commands | manifests, CI configuration, a Makefile | Each journey's exit condition becomes a test that runs the same way |
| The frontend and backend split, and how they talk | the top level tree, an API client in the frontend, route definitions in the backend | The counter screens go in the frontend; every ABDM call goes through the backend |
| The outbound HTTP client the backend already uses | the dependency list, a shared client module | ABDM calls reuse it, or a second one appears and the two drift |
| How secrets and configuration reach the process | environment loading, a vault client, a config file | The client id, the secret and the access token travel the same way |
| The patient model, and the identifier fields it already carries | the schema, the ORM models, the migrations | The ABHA number and address become columns beside the existing identifiers, not a new table |
| The visit, encounter or record model | the same places | A care context maps to one of these, and the plan has to say which |
| Where inbound HTTP is routed and authenticated, and whether the deployment has a public URL | the router, the middleware, the reverse proxy configuration, the deployment manifests | ABDM calls back, and a callback route that nothing forwards is silence nobody notices |
| Existing cryptography helpers | a security or crypto module, the dependency list | The RSA encryption of identifiers reuses them |
| Where errors are shown to a user, and where they are logged | the frontend's error surface, the logging setup | A refused call has to land on the screen the person is looking at, and never log a token |

**Orient.** Map each ABDM touchpoint onto that inventory. Where the map is
exact, write the file path. Where it is not, write two candidates and say what
would decide between them. The common ambiguities: two places that could hold
the patient identifier, an HTTP client in the frontend and none in the backend,
a monorepo with several services and no obvious owner for callbacks.

Then read the interview answers against the inventory. A government integrator
gets the demographic route; a facility with no public URL gets no callback
driven journey until it has one; a desk with a fingerprint reader gets the
biometric method. The route set is the intersection of what the deployment
allows and what the code can host.

**Decide.** Order the journeys. The token comes first because every other call
needs it: the gateway session token, or for M4 the bearer token the registry calls
carry. Then the journey whose exit condition can be observed with
the least new code, usually a profile read for a patient who already holds an
ABHA. Creation and linking come after, because each depends on state the earlier
ones produce. For each journey, name the files it will touch and the test that
proves its exit condition.

**Act.** Write the plan. It is a file in the repository, at the path the
integrator names or at the root as `abdm-integration-plan.md`, and it is the
only output of this loop. Then return to observe once, reading the plan against
the tree, to confirm every path in it exists or is marked as new.

If the limit is reached with questions still open, escalate: name what was
found, name the two candidates that could not be separated, point at this
atom, and ask one question.

### How you know it worked

The plan exists and answers every row of the inventory table with a file path,
or with the words none, add at, followed by a path. No row is blank and no row
says to be decided.

Every ABDM touchpoint in the plan names one file, or names two candidates and
the observation that would choose between them. Every journey in the plan names
the test that proves its exit condition and the command that runs it.

Open the plan beside the tree. Every path it names resolves, or is marked as
new. That is the observation that ends this loop, and the first journey does
not start until it has been made.

### When it goes wrong

- **The plan puts the HTTP client in the frontend.** The survey found the
  frontend's API client and stopped. Every ABDM call carries a secret, so it
  goes through the backend, and the plan has to say which backend module.
- **Two patient tables, and the plan picked one.** Orient produced one
  hypothesis where it needed two. Name both, and name the query that shows
  which one the visit model points at.
- **The plan has a callback route and the deployment has no public URL.** The
  inventory row on inbound routing was answered from the router rather than
  from the deployment. Mark every callback driven journey as blocked on a URL,
  and build the ones that are not.
- **The survey read the README and not the tree.** A README describes the
  system somebody meant to build. The plan is for the one that exists.
- **Eight passes and the plan is still incomplete.** Escalate with the rows
  that are answered, the rows that are not, this atom, and one question about
  the row that blocks the most journeys.

From `shared.concept.survey-an-existing-codebase`.

## Design rules across functionalities

### ABDM publishes operations, not a journey

#### In plain words

The M1 specification defines around forty operations. It does not say which to
call first, which to skip, or what a screen should ask. That is deliberate: the
same operations serve a hospital front desk, a pharmacy counter, a laboratory
and a patient's own application, and those are not the same journey.

So the journey is the integrator's to design, and a product that knows its own
counter will often beat any default. The rules in this section are the
constraints a good design satisfies, not a design.

That distinction matters when an agent is building. Offer the suggested shape,
say that it is a suggestion, and build what the integrator asks for instead
when they have a view.

#### What happens

The suggested shape is one entry rather than a menu. Take one identifier, send
one one time password, and branch on what comes back.

The reason is the branch that creates a duplicate:
asking a person at a desk whether they want to log in or to register puts a
question to them they often cannot answer, and the response already contains the
answer. One screen titled for both outcomes takes the identifier and lets ABDM
decide which journey it was. Either shape keeps the Create ABHA option the test cases
look for.

A chooser is better where the desk genuinely knows. A counter that only
registers new patients has already answered the question, and making it click
through a combined screen is a step that serves nobody.

Neither is a rule. The rules are the ones that follow in this section: do not
ask twice, do not create before looking, complete without an ABHA, tell the
truth on screen. A design that satisfies those and looks nothing like the shape
above is a good design.

#### How you know it worked

Ask the integrator what their counter does before proposing screens. If they
have a view, the built journey matches their view and still satisfies every
rule in this section.

If they have no view, the built journey is the suggested shape, and it was
offered as a suggestion rather than presented as what ABDM requires.

#### When it goes wrong

- **The journey is the one the specification implies.** Reading the operations
  in the order they are documented produces a journey nobody designed. The
  order in the specification is an order of documentation.
- **The integrator's own design was overridden by a default.** The default is a
  suggestion. Their counter is the thing that exists.
- **A rule was relaxed to fit the design.** The shape is negotiable. The rules
  in this section are not, because each one was a defect before it was a rule.

### The ABHA step comes before the registration form and fills it

#### In plain words

An ABHA is a patient's health account, and a verified one already holds their
name, date of birth, gender, mobile number, full address with its codes, and a
photograph. A desk that reads that profile types almost nothing.

Put the ABHA step first and the registration form opens already filled. Put it
second and you have spent the keystrokes the integration existed to save, then
filed an identifier on top of them.

The test is simple. Count what the receptionist typed. If a registration with an
ABHA took as many keystrokes as one without, the order of the screens is the
first thing to look at.

#### What happens

Rank what is scarce at a counter. Calls are cheap. In order of cost:

1. **Questions put to the patient.** A third question costs more than three
   extra HTTP calls.
2. **One time passwords.** They fail, they expire, they lock a transaction, and
   they reach a handset the person may not be holding.
3. **API calls.** Last, and a long way last.

Rank routes by that list in order, and never let a call count outrank a
question.

| Route | Questions | One time passwords | Calls |
|---|---|---|---|
| Scan and register | 0 | 0 | 1 out, 1 in |
| Create, demographic authentication | 1 | 0 | 1 |
| Create, fingerprint | 1 | 0 | 1 to 3 |
| Create, face | 1 | 0 | 3 plus polling |
| Log in, any identifier | 1 | 1 | 3 to 4 |
| Create, Aadhaar one time password | 1 to 2 | 1 to 2 | 4 to 5 |

Two things fall out of that table.

Demographic authentication is one call and spends no one time password. A
government integrator is required to offer it and a private integrator is not
asked for it, so most integrators build the five call route instead, because it
is the one the specification leads with.

The cheapest journey involves no desk call at all. A registered facility with a
callback ABDM can reach can put a QR code at the counter, and the profile
arrives already consented.

Some lookups cost nothing. A login attempt on an identifier nobody holds is
refused `ABDM-1114` before any one time password is sent, so looking before
creating is free for exactly the people you would otherwise send to create a
duplicate.

#### How you know it worked

A receptionist registering a patient who brought an ABHA types corrections only.
Every field the profile carries arrives filled, and the only screen asking for
input is the one confirming the form.

Count the one time passwords spent on a full registration. On the demographic
route and on scan and register that count is zero.

#### When it goes wrong

- The form opens empty after a successful ABHA step. The profile was read and
  its result was not carried into the form. Hold it in the fact store rather
  than in a screen's own state, which
  the patient fact store covers.
- The desk asks for an identifier it already holds. Same cause, same fix.
- The journey offers login or creation as a question to the patient. They often
  cannot answer it, and
  avoiding a duplicate ABHA explains what to
  do instead.

### Two routes to the profile, and the form is the destination of both

#### In plain words

A registration form fills from an ABHA profile. There are two ways that profile
reaches the desk, and they look nothing like each other.

The patient scans a QR code at the counter carrying your facility id and a
counter id, consents in their own application, and ABDM posts the profile to
your callback. Nobody at the desk types anything or asks anything.

Or the desk runs an identifier journey: take an identifier, verify it, and end
holding a token that reads the profile.

Build whichever the deployment can reach. The form is the destination either
way, which is why both belong to the same design rather than being two
features.

#### What happens

The share route costs nothing at the counter: no question, no one time
password, no outbound call. It is the cheapest journey in M1 and most
integrations never build it, because it needs a public callback and the
specification leads with the identifier route.

The identifier route is the one to build when the deployment has no callback
ABDM can reach, or when patients arrive without the application. It spends at
least one question and usually one one time password, which is why
the journey order ranks the routes.

Both end in the same place. The form opens filled, the desk corrects rather
than types, and every rule about the form applies whichever route filled it.
A design that treats the share route as a separate feature with its own screens
ends up with two registration paths that drift.

Where both are available, the share route is the default and the identifier
route is the fallback for a patient who cannot or will not scan.

#### How you know it worked

Register a patient by each route and compare what the receptionist did. The
share route required nothing beyond showing the code. The identifier route
required one identifier and its verification. Both ended on the same form,
filled from the same profile.

Where the deployment has no callback, the share route is absent from the
journey rather than present and silently failing.

#### When it goes wrong

- **The share route is built and nothing ever arrives.** No callback URL is
  registered against the facility, so ABDM has nowhere to post the profile.
  That is a configuration cause for a runtime symptom, and the interface has to
  say so.
- **Two registration forms exist, one per route.** They will drift. The routes
  differ in how the profile arrives, not in what happens after.
- **The share route was skipped because the specification leads with the
  other.** That is the most expensive omission in M1: it is the only journey
  that asks the patient nothing.

### A journey has to complete without an ABHA

#### In plain words

An ABHA is voluntary. A person can be treated, registered and billed without
one, and a facility's own patient number is what its record is keyed by.

So a registration journey that cannot finish until an ABHA exists has quietly
decided that people without one are not registered. Nobody chose that. It fell
out of putting the ABHA step first and making the form wait for it. The step
comes first so the form opens filled; it does not come first so the form can be
refused.

#### What happens

Decide it deliberately, and write the decision down where the journey is
designed. The question is not whether to offer an ABHA, which every deployment
does. It is what the desk does when the person has none and cannot or will not
create one now.

The answer for a facility record is that the form still completes. The patient
number is the facility's own. The ABHA fields on that record stay empty, and
the surface offers creation again on the next
visit rather than blocking this one.

The ABHA step therefore needs an exit that is neither success nor failure: not
now. It returns whatever facts it collected to the fact store, and the form
opens with those filled and the rest blank, exactly as it would after a
successful step with fewer fields.

Where a deployment does require an ABHA, a government scheme that pays only
against one for instance, that is a rule of the deployment, and it belongs in
the deployment interview as a question with a
yes, not in the screen order as an accident.

#### How you know it worked

Walk a patient through the journey and decline the ABHA step at every point it
is offered. The registration completes, the record exists under the facility's
number, and its ABHA fields are empty.

Open the design and find the sentence that says what happens without an ABHA.
It exists, and it was written on purpose.

#### When it goes wrong

- **The form will not submit with the ABHA fields empty.** A validation rule
  made the fields required. They are not, unless the deployment interview said
  so.
- **The ABHA step has only two exits.** Success and failure, and a person with
  no ABHA is routed to failure. Add the third exit, not now, and route it to
  the form.
- **The decision was never made.** Nobody can say what the journey does for a
  person without an ABHA. That is this rule failing, whatever the screens do.

### Never ask a patient the same thing twice, enforced by structure

#### In plain words

A patient at a counter will be asked for an identifier, and then, two screens
later, for something they already gave. Nobody notices in review, because each
screen reads correctly on its own. It is only the journey that repeats itself.

Discipline does not fix this, because the mistake is invisible at the point it
is made. Structure does. Keep one store of what you know about the patient in
front of you, and generate every question from what is missing in it. A request
to collect a fact you already hold then cannot be constructed.

#### What happens

Hold one store per patient, for the length of their visit:

```
facts:      { aadhaar, mobile, abhaNumber, name, dob, gender, ... }
provenance: { mobile: 'from the appointment', name: 'from the ABHA profile' }
tried:      [ { route, why it failed } ]
```

Three rules make it work.

1. **Facts are write once.** Nothing overwrites a fact silently.
2. **A failed route gives back everything it collected.** An Aadhaar typed for a
   login that then failed is already in the store when creation begins.
3. **Screens ask for one missing fact at a time**, and the question is generated
   from the store rather than hard coded into the screen.

Where this bites in practice: a patient identifies by mobile, turns out to have
no ABHA, and creation begins. Creation needs a mobile to attach to the new
account. An implementation that renders a fresh empty mobile field there has
asked the same question twice.

Show provenance. When a field is filled from something you already hold, say so
beside it: taken from what they already gave you, change it only if the new ABHA
should carry something different. A prefilled field with no explanation reads as
a guess.

#### How you know it worked

Walk a patient through a route that fails and then through a second route. The
second route asks only for facts the first never collected, and the fields the
first collected arrive filled, each showing where it came from.

Search the interface for a question that is asked in two places. In a journey
built this way there is no such question to find, because the screen cannot name
a field, only request the next missing one.

#### When it goes wrong

- A field arrives filled and wrong, and the desk cannot tell why. Provenance is
  missing. Show where each value came from.
- A fact changes under the desk between two screens. Something is overwriting
  rather than writing once. The store should refuse the second write.
- A route fails and the patient is asked everything again. The failed route
  discarded what it collected instead of returning it.

### Ask the integrator about the deployment, not the patient about the journey

#### In plain words

M1 has around forty operations and no deployment needs all of them. The routes
do not change from one integrator to the next. The context does: who they are,
what hardware sits on the desk, what their record already holds.

The first fact is the entity type, government or private. Every functionality
that holds a mandatory test case for that entity type is built, whatever else
the deployment looks like. The other questions only add optional routes. None
of them removes a route a mandatory case needs, which is what keeps an
integration from branching into a government variant and a private variant
that then drift apart.

#### What happens

Settle the entity type first. Then ask these five. Each is a yes or a no, and a
yes adds an optional route.

| Ask | A yes adds |
|---|---|
| Does your record hold the patient's mobile at check in? | No route. It removes a screen, because the lookup is submitted from the number you already hold |
| Is there a fingerprint or iris reader at the desk? | The biometric method |
| Do patients arrive with the ABHA app? | The face route, as a second method rather than a first |
| Do you create ABHAs from a driving licence? | The driving licence route |
| Which record types does your system actually produce? | The bundles worth generating, rather than all seven |

Scan and register is not a question. Its cases are mandatory for every entity
type, so it is always built. A callback ABDM cannot reach yet is a readiness
item to solve before its test, never a reason to leave it out. The same holds
for the demographic route for a government entity.

The mandatory functionalities and the answers together give the route set. The
route set gives the screen set. The integrator then implements renderers for
those screens, rather than implementing a flow.

The last question belongs here rather than with the record work, because
scaffolding all eight record types before knowing which two a system produces is
the most expensive guess available in this integration.

#### How you know it worked

You can name, before any screen is drawn, the routes the entity type makes
mandatory and the optional routes the answers added. Every functionality with a
mandatory case for the entity type is in the build, whatever the answers were.

#### When it goes wrong

- The build contains a government branch and a private branch. The answers were
  used to pick a variant rather than to add routes. Each yes should add,
  never replace.
- A functionality with a mandatory case is missing because an answer was no.
  The answers add optional routes only.
- Seven record generators exist and the system produces two. The last question
  was not asked.

### An identifier and an auth method are two different questions

#### In plain words

M1 looks like five unrelated choices when a screen lists Aadhaar one time
password, mobile one time password, fingerprint, face and demographic
authentication side by side. It is not five choices. It is two questions.

Who is this person, which is an identifier. And how do they prove it is them,
which is an auth method. Every combination the platform supports is one answer
to each.

Ask them in that order and the screen stops being a menu.

#### What happens

ABDM works with four identifiers: an Aadhaar number, a mobile number, an ABHA
number and an ABHA address. Not all four reach every path. The profile login
path takes a mobile, an Aadhaar or an ABHA number, and refuses an ABHA address
with `Invalid Login Hint`. An address signs in through the PHR login family
instead, which is the patient's own application acting for them rather than a
facility acting as a provider, so a facility takes such a patient through the
share route.

How the person proves the identifier is theirs travels separately, as
`authMethods`. Its values include `otp`, `demo_auth`, `bio`, `face`, `iris` and
`child`.

So the screen asks for the identifier first. The auth methods go underneath it,
and only where there is more than one, because offering a single method as a
choice is a click that decides nothing. Which methods are available depends on
the identifier and on the deployment: a demographic route is for a government
integrator, a fingerprint route needs a reader on the desk.

The account lookup returns the methods an account actually supports, so a desk
can offer one that will work rather than one that will fail.

#### How you know it worked

Count the options on the first screen. It offers identifiers, and the number of
them is at most four and usually fewer, rather than a flat list of every
identifier and method combination.

Pick an identifier that supports one auth method. No method chooser appears.
Pick one that supports several and the chooser appears underneath, listing only
the ones this deployment can actually perform.

#### When it goes wrong

- **The first screen lists five or more options.** The two axes were
  collapsed. Split them.
- **A method is offered that the desk cannot perform.** A fingerprint option on
  a desk with no reader, or a demographic option for a private integrator. The
  route set comes from
  the deployment interview.
- **An ABHA address is offered on the profile login path.** It is refused with
  `Invalid Login Hint`. That identifier reaches a different family of calls.
- **A chooser appears with one option in it.** Offer it only where there is
  more than one.

### The six counter screens, and what each is forbidden to ask

#### In plain words

Six screens cover every ABHA route a desk offers. Each one declares three
things: what it collects, what it is forbidden to ask, and when it does not
appear at all.

The forbidden column is the one usually missing, and it is the one that stops a
journey asking the same question twice.

#### What happens

| Screen | Collects | Must never ask | Skipped when |
|---|---|---|---|
| Identify | one identifier | anything already held | the desk holds a mobile or an ABHA number |
| Confirm it is them | yes or no to a masked number | the number itself | no free lookup ran |
| One time password | six digits | the identifier, again | the chosen route spends no one time password |
| Choose an account | which of several | anything the accounts array already carries | there is one account or none |
| Choose an address | pick or type | anything the profile carries | the route issues a default address |
| Confirm the form | corrections only | anything the profile carries | never. It is the destination |

The account chooser is not an edge case. One mobile carrying several ABHA
accounts is an ordinary shared family handset. A journey written as a straight
line from one time password to signed in has nowhere to put the second account,
and finds this out in production.

The last screen is the destination of the whole journey, which is why it is the
only one never skipped. Everything before it exists to arrive there with the
fields already filled.

#### How you know it worked

Every screen in the build maps to a row above. For each one you can say what it
refuses to ask, and that refusal is enforced by the fact store rather than by a
comment.

Run a patient whose mobile carries two ABHA accounts. The account chooser
appears, offers both, and asks for nothing the accounts array already carries.

#### When it goes wrong

- A second account signs the wrong person in, or the journey stalls. The account
  chooser was not built. It is not optional.
- A screen asks for the identifier again alongside the one time password. The
  screen is naming its own fields instead of requesting the next missing fact.
- The address screen appears on a route that issues a default address. The skip
  condition is not being checked.

### Present the filled form for confirmation rather than saving it unseen

#### In plain words

The point of reading an ABHA profile is that the receptionist stops typing. The
temptation that follows is to stop showing the form at all: the data is
authoritative, so save it and move on.

Do not. The profile is what ABDM holds, which is not the same as what the
clinician needs to see. Names may be transliterated into a script the desk does
not use. An address may be years old. A mobile number on a shared handset may
belong to a relative. None of that makes the profile wrong, and all of it
matters at a counter.

#### What happens

The confirmation screen collects corrections only. It asks for nothing the
profile already carries, because everything it carries is already on the
screen.

It is the one screen never skipped. Every other screen in the journey exists to
reach this one with more fields filled.

Show which fields came from the profile, so a correction is a deliberate act
rather than a guess. A receptionist who cannot tell a prefilled value from a
typed one will either trust all of it or retype all of it, and both defeat the
purpose.

A correction changes the facility's record. It does not change what ABDM holds:
the profile is the patient's, updated through their own application or through
the profile update calls, not by a desk editing a form. If the desk's copy and
ABDM's copy need to agree, that is a separate update call and a separate
decision.

#### How you know it worked

Register a patient whose profile carries a transliterated name. The
confirmation screen shows the profile's value, the receptionist corrects it,
and the facility record carries the correction.

Read what ABDM holds for that patient afterwards. It is unchanged, because a
correction to the form is not an update to the profile.

#### When it goes wrong

- **The record is saved without anybody seeing it.** The form was skipped
  because the data was authoritative. Authoritative is not the same as
  appropriate for this counter.
- **A correction silently changed the ABHA profile.** The form was wired to the
  profile update call. Those are different decisions and usually different
  permissions.
- **The receptionist retypes every field.** Nothing distinguished a prefilled
  value from an empty one, so none of them were trusted.

### The branch that creates a duplicate ABHA, and how to close it

#### In plain words

The expensive failure in M1 is a person ending up with two ABHA numbers. Nothing
merges them, so the mistake is permanent and the patient carries it.

It is caused by journey decisions rather than by any single call. Four of them
matter.

#### What happens

**Offer create and verify, and let creation carry on for an existing account.**
The product offers a Create ABHA option and the login routes the verification
cases need. Creation by Aadhaar does not make a second ABHA: `enrol/byAadhaar`
answers an Aadhaar that already holds one with a 200, `isNew` `false` and that
account's tokens and profile. Carry on from that response to the profile, the
card and the address step, as for a new account.

**On a login, `ABDM-1114` is the only answer that means nobody holds an ABHA.** A refusal
that names a field is not the same thing. A stale certificate reads back
identically, and creating an account on that is how the duplicate happens.

**A patient who cannot say whether they hold an ABHA need not decide.** A
screen titled for both outcomes can take an identifier and let the response
decide. It sits beside the Create ABHA option, never in place of it.

**Read the token, not the account count.** A verification that returns a
`refreshToken` has already returned the final user token, so use it. One without
a `refreshToken` is a short lived transfer token and must be exchanged at the
account selection call, whatever the length of the accounts array. Branching on
`accounts.length` sends the Aadhaar path into an exchange it must not make, and
the refusal then blames the token's shape rather than saying the call was
unnecessary.

Creation is from Aadhaar. ABDM publishes a mobile enrolment route, and an
account created that way is address only and never verified against a
government identity document. No later desk can look it up before spending a one
time password, and the person carries the lesser account permanently. Write that
rule into code as a guard that refuses an unknown method by name, because a rule
the code merely happens to satisfy is one that regresses silently.

When the desk already knows there is no ABHA, ask only for Aadhaar. Offering a
mobile there offers a path that cannot finish. A patient saying they have never
had one is not evidence, and the creation response settles it: `isNew` `false`
means they had one, and the journey carries on with it.

#### How you know it worked

Run a login for an identifier nobody holds. You receive `404` with `ABDM-1114`,
no one time password is sent, and only then does the journey offer creation.
Run creation for an Aadhaar that already holds an ABHA. You receive `200` with
`isNew` `false`, and the journey shows that account rather than an error.

Run the Aadhaar login path. The verify response carries a `refreshToken`, the
journey uses it directly, and no exchange call is made. Run the mobile path and
the exchange call is made, because no `refreshToken` came back.

#### When it goes wrong

- A login is refused with a message naming a field, and the journey offers
  creation anyway. Only `ABDM-1114` means nobody holds an account. Treat
  anything else as a failure to answer the question.
- The Aadhaar path is refused `Invalid T-token` at the account selection call.
  The journey branched on the account count instead of on `refreshToken`, and
  made a call it did not need to make.
- Two patients a week arrive holding two numbers. Something in the journey is
  creating by a route other than Aadhaar before it has looked, and the lookup is
  the cheapest call available.
- Creation stops at `This account already exist`. The journey treated
  `isNew` `false` as a failure instead of carrying on with the account.

### Telling the truth on screen at the counter

#### In plain words

An integration that overstates its own state is worse than one that reports a
gap, because the gap is then discovered by a patient at a counter rather than by
the person who could have fixed it.

Most of what follows was a defect before it was a rule.

#### What happens

**An error must land on the screen the person is looking at.** A multi step
journey that writes a failure into a step the view has scrolled past shows the
desk nothing at all. Resolve the target to the active step rather than to a
fixed position on the page.

**Accepted is not done.** Anything asynchronous has at least five outcomes and
they must not look alike: sent, accepted and waiting, answered, refused before
it ever waited, and no answer inside the window. A refusal shown as a completion
is the worst of the five.

**A silence is not a failure.** Where no timeout is published, say that nothing
arrived in the window you chose, rather than saying it failed.

**Show the masked number the code went to.** A person with two handsets needs to
know which one to pick up.

**A resend button has two jobs either side of one boundary.** While the
transaction still has attempts left, reuse it, because starting a new one throws
away a live transaction. Once it is locked, only a fresh transaction recovers
and retrying cannot. Show a visible wait, because the fastest route to a locked
transaction is somebody pressing resend four times.

**Name the field, not the person.** When an encrypted value is refused, the
cause is usually the encryption, the headers or the clock. Telling a patient
their number is wrong is usually a lie.

Some of this is interface mechanics rather than ABDM, and it still costs real
failures. Off screen is not hidden: a translated step track leaves every step in
the tab order, so the first keypress walks into fields nobody can see, and
inactive steps need marking inert. State from one patient must not survive into
the next, and the field that leaks is always the one the desk typed rather than
the one the profile filled, because every other field is overwritten on the way
in.

#### How you know it worked

Trigger a refusal on the last step of a long journey. The message appears on the
step in view, and the desk can read it without scrolling.

Trigger a synchronous refusal on an asynchronous call. The screen says refused,
not waiting, and not done.

Complete a journey for one patient and start another. No field carries a value
from the first, including the fields the desk typed by hand.

#### When it goes wrong

- A green state is showing for a refusal. The success and failure paths are
  sharing a function that closes the waiter. Fix it in the shared function, not
  at each call site.
- A one time password transaction locks repeatedly. Resend is starting a new
  transaction while the old one still had attempts left.
- A patient is told their Aadhaar number is wrong when the clock or the
  certificate is at fault. Name the field that was refused and say what else
  can cause it.

### The surface is more than a registration form

#### In plain words

Registering a patient is the journey every M1 integration builds first, and it
is not the whole of what the operations support. Several other placements exist,
each answering something a desk is actually asked for, and each arriving later
as a change request when the design did not account for it.

List them for the integrator early. They may choose to build none of them, and
that is a decision rather than an omission.

#### What happens

| Placement | What a desk is asked for |
|---|---|
| Find a forgotten ABHA | A patient knows they have one and cannot produce it |
| Show the card and the QR code | A patient wants their ABHA on screen or on paper |
| Take a profile shared by QR at the counter | The share route, which is also the cheapest registration journey |
| Update a mobile number | The number on the account is not the one the patient carries |

One of these is worth deciding early rather than late.

The card and QR are usually the first thing a patient asks for and the last
thing an integration builds, because they are not part of registering anybody.

#### How you know it worked

Show the integrator the table above before the first screen is designed. For
each row they say build it, or not now, and not now is recorded.

For each placement built, a patient can reach it from somewhere a receptionist
would look, rather than from a screen that exists only in the registration
journey.

#### When it goes wrong

- **Every placement arrives as a change request.** The list was never shown, so
  each one looks like new scope rather than a decision deferred.
- **A patient cannot be shown their own card.** The operations support it and
  the journey has nowhere to put it.

### What an ABHA address is allowed to be

#### In plain words

ABHA Addresses must comply with defined validation standards.

**Permitted Characters**

- Alphabetic characters (A-Z)
- Numeric characters (0-9)
- Dot (.)

**Validation Rules**

- Cannot begin with a numeric character.
- Cannot begin or end with a dot (.).
- Must conform to ABDM validation requirements at the time of creation.
- Mobile numbers cannot be used directly as ABHA Addresses.

Organizations should rely on ABDM validation services to verify address eligibility.

Every ABHA number is issued a default address built from its 14 digits. A person cannot create that address themselves, and can create a readable one beside it. Offer addresses built from the person's name rather than an empty field.

#### What happens

Validate the rules above in your own form before you submit, so a refused address becomes an inline message. Offer the suggestions the service returns from `/abha/api/v3/enrollment/enrol/suggestion` during M1 enrolment. Send the chosen address without the `@` suffix where the call asks for it.

#### How you know it worked

The address is created and the person can sign in with it. Before that, your form refuses an address that begins with a digit, begins or ends with a dot, or is a mobile number.

#### When it goes wrong

The address is taken: show alternatives rather than an error alone. The person expects to use their mobile number as their address: say in the form that this is not allowed, rather than letting them find out on submission.

### ABHA number and ABHA address, and why there are two

#### In plain words

An ABHA account consists of two key identifiers:

##### 1. ABHA Number

The ABHA Number is a unique 14-digit identifier assigned to an individual after successful identity verification.

**Key Characteristics**

- Unique to each individual.
- Acts as the primary health identity within ABDM.
- Used for patient identification across healthcare systems.
- Issued after completion of the KYC verification process.
- Always associated with at least one ABHA Address.

##### 2. ABHA Address

The ABHA Address is a unique and user-friendly identifier in the format: `user@abdm`

**Key Characteristics**

- Facilitates secure routing of health information and consent requests.
- Can be shared with healthcare providers for record linking and data exchange.
- A default ABHA Address is generated along with every ABHA Number.
- Users may subsequently create a personalized ABHA Address.

The number answers who the person is. The address answers where their records are routed, and it is the identifier care contexts are linked to and consent requests are raised against. One number can carry more than one address, and one mobile number can carry several ABHA numbers, which is common in a family. That is why a login by mobile can return a list of accounts to choose from.

#### What happens

Store the ABHA number as the patient's stable identity and the address as the routing handle beside it. Use the address wherever a call routes to the person: linking and consent.

#### How you know it worked

You can answer two questions. An address a patient gives you routes to an existing account; it does not create one. Your patient record keys on the ABHA number, because a person can hold several addresses and add more later.

#### When it goes wrong

An address stored as the primary key breaks when the person adds or changes one. A sandbox address does not exist in production, and the refusal reads as not found rather than as the wrong environment.

### Why identifiers are encrypted, and where to do it

#### In plain words

We publish the public half of a key pair. You encrypt with it. Only our private half can decrypt. Your system never holds a secret to do this, only the current certificate.

```mermaid
sequenceDiagram
    autonumber
    participant S as Your system
    participant A as ABHA service
    S->>A: GET /abha/api/v3/profile/public/certificate
    A-->>S: publicKey, encryptionAlgorithm
    S->>S: RSA encrypt the Aadhaar number, mobile number,<br/>OTP or password with that public key
    S->>A: The Base64 result as the field value,<br/>for example loginId or otp.otpValue
    A->>A: Decrypts with its private key
```

There is nothing ABDM specific in the mechanics. Your platform's standard RSA library does the work. Both keys use `RSA/ECB/OAEPWithSHA-1AndMGF1Padding`. The one thing to confirm is which key you are using.

Read `encryptionAlgorithm` from the certificate response and encrypt with what it names. Code that reads the field survives a change of algorithm. Code that cannot recognise what the field names should refuse to encrypt rather than fall back to a default.

#### What happens

Put the plaintext in the shape the service validates after it decrypts, from the table above: an ABHA number keeps its dashes. Encrypt with the algorithm the response names and send the base64 result as the field value, for example `loginId`.

#### How you know it worked

The raw Aadhaar or mobile number exists only inside your own process, for the length of the call, and never reaches a log. A call carrying your ciphertext passes validation.

#### When it goes wrong

`400 {"loginId": "LoginId is invalid"}` means the value decrypted and the plaintext failed a format rule, usually an ABHA number sent without its dashes. Logging the plain value before encryption is the same leak, moved into your log store.

### The gateway session, the first call in every integration

#### In plain words

One endpoint issues the token every other call carries. It is the call [M1](/docs/hiecm/v3/getting-started/glossary#m1) uses. [M4](/docs/hiecm/v3/getting-started/glossary#m4) calls carry their own bearer token instead.

**POST** `/api/hiecm/gateway/v3/sessions`

Headers:

| Header | Example value | What it is |
|---|---|---|
| `REQUEST-ID` | `18235d89-cb13-479d-ad71-7a57d5f669a8` | A fresh UUID for this call |
| `TIMESTAMP` | `2022-10-06T15:10:00.587Z` | The time you made the call, ISO 8601 |
| `X-CM-ID` | `sbx` | The consent manager. Use `sbx` for sandbox |
| `Content-Type` | `application/json` | |

No `Authorization` header on this call. It is the one call with no token yet.

Body:

```json
{
  "clientId": "<CLIENT_ID_FROM_SANDBOX_SIGNUP>",
  "clientSecret": "<CLIENT_SECRET_FROM_SANDBOX_SIGNUP>",
  "grantType": "client_credentials"
}
```

Send the client id you were issued.

Response shape:

```json
{
  "accessToken": "<JWT>",
  "expiresIn": 1200,
  "refreshExpiresIn": 1800,
  "refreshToken": "<JWT>",
  "tokenType": "bearer"
}
```

The response carries the token in `accessToken`.

Send the token back as `Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>` on every other call. Headers per call, and the second token M1 login issues, are on [authentication](/docs/hiecm/v3/reference/authentication). Interactive: [gateway API reference](/reference/hiecm-gateway).

The session token says which application is calling, not which person. [M1](/docs/hiecm/v3/milestones/m1) profile calls also carry a user token in `X-token`, which login returns.

#### What happens

Call the session endpoint with `clientId`, `clientSecret` and `grantType` set to `client_credentials`. Send the `accessToken` it returns as `Authorization: Bearer <ACCESS_TOKEN_FROM_SESSIONS_CALL>` on every other gateway call. Renew before `expiresIn` runs out rather than on a fixed timer.

#### How you know it worked

The response carries `accessToken` and `expiresIn`, and the next gateway call with that token is not refused as unauthorised.

#### When it goes wrong

Every call returns 401: see [everything returns 401](/docs/hiecm/v3/troubleshooting/everything-returns-401). A profile call is refused while the session token is fresh: the `X-token` is missing, or it holds the short lived token from login verify, which the verify user call exchanges for the user token. `ABDM-1094` reads X-token expired, and the token sent is often the wrong kind rather than an old one.

### Encrypting sensitive inputs, Aadhaar, mobile, OTP and passwords

#### In plain words

Six kinds of value never travel raw in an M1 request body.

| Value | Where it appears |
| --- | --- |
| Aadhaar number | Enrolment and login by Aadhaar |
| ABHA number | Login and search by ABHA number |
| Mobile number | Login, search and mobile update |
| Email address | Email verification |
| One time password ([OTP](/docs/hiecm/v3/getting-started/glossary#otp)) value | Every call that verifies a challenge |
| Password | Password based login |

Each is encrypted with RSA using the ABDM public certificate, and the base64 of the ciphertext goes in the field.

The padding belongs to the certificate. M1 and PHR calls use RSA OAEP with SHA-1 for both the digest and the mask generation function, which the certificate names as `RSA/ECB/OAEPWithSHA-1AndMGF1Padding`. The [M4](/docs/hiecm/v3/milestones/m4) registries use `RSA/ECB/PKCS1Padding` under a certificate of their own. An integration that calls both holds both keys and never crosses them.

#### What happens

Encrypt each value in the table in your own process and send the standard base64 of the ciphertext. In most libraries OAEP defaults to SHA-256, so pass SHA-1 explicitly: in Node, the OAEP padding constant with the OAEP hash set to sha1; in Java, the transformation the certificate names. The certificate arrives as base64 DER with no PEM armour, so add the armour before your library loads it. Cache the certificate with a validity window, not forever.

#### How you know it worked

A value your code encrypted is accepted by a real M1 call: the OTP request returns a `txnId` instead of a validation refusal.

#### When it goes wrong

A wrong padding or digest does not fail when you encrypt. It fails at the API as a validation refusal that names the business field, which reads as a wrong Aadhaar or mobile number. Check the padding, the digest and the key before you doubt the plaintext. A stale cached certificate fails every encrypted call at once.

### A suggested ABHA journey, and what holds if you design your own

#### In plain words

A front desk adopts ABHA because the receptionist stops typing. A verified ABHA
profile already carries the name, date of birth, gender, mobile, address and
photograph. So the ABHA step comes before your registration form, and fills it.

The suggested journey, in five steps:

1. **Start registering the patient** in your own system, under your own number.
2. **Ask whether they have an ABHA.** No means the form is typed by hand, and
   the patient is treated exactly the same.
3. **Take one identifier.** Aadhaar is the one to recommend, because it is the
   only route that ends in a KYC verified ABHA number. Mobile sits beside it.
   Under Aadhaar only, ask how they prove it: an OTP, a face scan, or a
   fingerprint or iris reader.
4. **Offer both: find an existing ABHA, or create one.** Functional testing
   expects a Create ABHA option beside verification. On the find path, one
   account signs the person in, several need a chooser, and none offers
   creation. On the create path, an Aadhaar that already holds an ABHA is not
   a stop: `enrol/byAadhaar` returns that account, and the journey carries on
   to its profile, card and ABHA address.
5. **Fill your form from what came back,** and let the receptionist confirm it
   rather than type it.

Whatever journey you build, these hold:

- **Look before you create.** Creating an ABHA for a person who already holds
  one leaves them with two ABHA numbers, and nothing in M1 merges them.
- **The login token is not the profile token.** Login verify returns a short
  lived token, which the verify user call exchanges for the `X-token` that
  profile calls accept.
- **An ABHA is optional to your record.** ABDM does not require a person to
  hold an ABHA to be treated. A journey that cannot finish without one blocks
  care.
- **The profile is what ABDM holds**, not what is in front of your clinician.
  Present the filled form for confirmation rather than saving it unseen.

#### What happens

Offer Create ABHA beside the find and login paths, as CRT_ABHA_101 requires. On a find or login path, read `accounts` on the verify response: one account, call verify user with its `ABHANumber` and the same `txnId`; several, show a chooser and do the same with the chosen one; none, offer creation. On the create path, `enrol/byAadhaar` answering `isNew` false returns the existing account's profile and tokens: carry on to the profile, card and ABHA address step, never create a second account. Then read the profile at `/abha/api/v3/profile/account` with the `X-token` and fill the form.

#### How you know it worked

A person with an ABHA registers with their details arriving from the profile and the receptionist correcting at most one field. A person who declines is still registered, with no error, and can be offered ABHA again from their chart. A person who already holds an ABHA ends on the account they had, whether they chose to find it or to create one.

#### When it goes wrong

Two ABHA numbers for one person: the journey ignored `accounts` on a find path, or `isNew` on the create path. The desk types everything and then links an ABHA: the order is wrong, fetch the profile first. A refused encrypted field shown to the person as a wrong number: check the padding before you blame the number, see [encryption](/docs/hiecm/v3/concepts/encryption).

### The counter QR code for scan and register

#### In plain words

The QR code at each counter holds this URL. Your system can generate it and
print one per counter:

```text
https://phrsbx.abdm.gov.in/share-profile?hip-id=<HIP_ID>&counter-id=<COUNTER_ID>
```

| Parameter | What it holds |
| --- | --- |
| `hip-id` | Your facility's HIP id, the facility ID it holds in the [HFR](/docs/hiecm/v3/getting-started/glossary#hfr). The share arrives with the same value in `X-HIP-ID` and `metaData.hipId`. |
| `counter-id` | The counter, such as `OPD1`: 1 to 20 alphanumeric characters that you choose. It arrives as `metaData.context`. Never use the facility ID, the HIP id or the HIP name. |

`phrsbx.abdm.gov.in` is the sandbox host. Use one code per counter, so the
token you hand back belongs to that counter's queue.

#### What happens

Build the URL from the facility ID and a counter id of your own, render it as a QR code, and print or display it at the counter. Keep the counter id stable: a reprinted code with a new counter id starts a new queue. `phrsbx.abdm.gov.in` is the sandbox host; confirm the production host at onboarding.

#### How you know it worked

A PHR app scans the code, the patient agrees to share, and a POST arrives on your bridge at `/api/v3/hip/patient/share` whose `metaData.context` is the counter id in the code.

#### When it goes wrong

The app scans the code but nothing arrives: the bridge URL for that facility points somewhere else. See [the callback never arrives](/docs/hiecm/v3/troubleshooting/callback-never-arrives).

## Where these came from

- `hiecm.concept.m1-operations-not-a-journey`
- `hiecm.concept.m1-counter-journey-order`
- `hiecm.concept.m1-two-routes-to-the-profile`
- `hiecm.concept.m1-journey-completes-without-abha`
- `hiecm.concept.m1-never-ask-twice`
- `hiecm.concept.m1-deployment-interview`
- `hiecm.concept.m1-identifier-and-auth-method`
- `hiecm.concept.m1-screen-contract`
- `hiecm.concept.m1-confirm-the-filled-form`
- `hiecm.concept.m1-avoiding-duplicate-abha`
- `hiecm.concept.m1-honest-screen-states`
- `hiecm.concept.m1-the-whole-surface`
- `hiecm.concept.abha-address-policy`
- `hiecm.concept.abha-number-and-address`
- `hiecm.concept.encrypted-identifiers`
- `hiecm.concept.gateway-session`
- `hiecm.concept.input-encryption`
- `hiecm.concept.m1-journey-design`
- `hiecm.concept.scan-and-register-qr`
