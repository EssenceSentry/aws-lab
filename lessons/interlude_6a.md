# Interlude Lesson 6A — Northstar Care: A 24/7 Appointment Self-Service Contact Center

## Amazon Connect, Lex, Polly, Lambda, routing, authentication, recordings, and contact analytics

## Source note

The uploaded Domain 2 material introduces the canonical AWS contact-center combination:

```text
Amazon Connect
+
Amazon Lex
+
Amazon Polly
+
AWS Lambda
+
Amazon S3 recordings
```

It presents Connect as the omnichannel contact-center service, Lex as the conversational interface, Polly as text-to-speech, and Lambda as the integration point for external business processing. 

The cheat sheets separately distinguish:

```text
Lex        → conversational intent understanding
Transcribe → speech to text
Polly      → text to speech
Comprehend → analysis of existing text
```



The architecture below is an independent teaching synthesis built around the appointment-cancellation problem.

---

# 1. The project

## 1.1 Business brief

**Northstar Care** operates a network of outpatient clinics.

Patients currently cancel appointments by calling a scheduling office during business hours:

```text
Monday–Friday
08:00–18:00
```

Outside those hours, callers hear:

> “Our offices are currently closed. Please call again during normal business hours.”

This creates several business failures:

- a patient who remembers on Sunday cannot cancel Monday’s visit;
- the clinic does not recover the appointment slot early enough to offer it to someone else;
- staff spend Monday morning processing avoidable voicemail and phone traffic;
- some patients forget to call again and become no-shows;
- patients must wait for a human to perform a deterministic database update;
- the clinic pays agents to handle tasks that do not require judgment.

Northstar wants a contact center that remains available at all hours for selected administrative operations.

The first automated capabilities are:

```text
cancel an appointment
confirm an appointment
check clinic hours
request a callback
speak to an agent
```

Rescheduling will be introduced later because it requires:

- finding valid replacement slots;
- matching provider, location, specialty, and visit type;
- handling insurance and referral restrictions;
- preventing concurrent booking conflicts.

The initial automation must **not**:

- diagnose symptoms;
- provide medical advice;
- alter prescriptions;
- cancel clinically restricted procedures;
- disclose appointment information before identity verification;
- claim success before the scheduling system commits the cancellation.

---

## 1.2 The central architectural lesson

The spoken conversation and the business transaction are different systems.

```text
Conversational layer
    understands:
        "I need to cancel my appointment"

Business layer
    decides:
        Is this caller authenticated?
        Which appointment?
        Is it cancellable?
        Has it already been cancelled?
        Does policy require a human?
        Did the database transaction commit?
```

Amazon Lex can recognize an intent.

It should not independently decide that a medical appointment may be cancelled.

The central rule is:

> **Natural language identifies the requested operation. Deterministic backend logic authorizes and executes it.**

---

# 2. Constraint ledger

| Dimension | Requirement |
|---|---|
| Channel | Ordinary telephone plus optional web chat |
| Availability | Administrative self-service available 24/7 |
| Agent hours | Human scheduling agents available during defined hours |
| Authentication | Caller identity must be verified before disclosing or modifying appointments |
| Privacy | Minimize exposure of patient and appointment information |
| Operation | Cancellation must be transactional and idempotent |
| Latency | Caller should receive an answer within a few seconds |
| Escalation | Ambiguous or restricted requests must reach a human workflow |
| Backend | Existing relational scheduling system remains authoritative |
| Reliability | Backend failure must not be reported as successful cancellation |
| Recording | Recording and retention depend on policy and consent |
| Analytics | Measure automation success, failures, transfers, sentiment, and queue performance |
| Operations | No self-managed telephony infrastructure |
| Scale | Bursty call traffic around reminders, holidays, and weather events |
| Compliance | Services and configuration must satisfy applicable healthcare requirements |
| Disaster recovery | Regional telephony failure considered explicitly |
| Languages | Voice and text experience may support multiple configured languages |

---

# 3. Baseline architecture

```text
                                 Patient
                                    │
                            PSTN telephone call
                                    │
                                    ▼
                        Northstar Connect number
                                    │
                                    ▼
                     Amazon Connect inbound flow
                                    │
              ┌─────────────────────┴──────────────────────┐
              │                                            │
              ▼                                            ▼
   Set language and voice                         Check hours of operation
        Amazon Polly                                  │
              │                         ┌──────────────┴──────────────┐
              ▼                         │                             │
      Get customer input                ▼                             ▼
        Amazon Lex                   In hours                     Out of hours
              │                         │                             │
       intent + slots                   │                             │
              │                         │                             │
              ├─────────────────────────┴─────────────────────────────┤
              │                                                       │
              ▼                                                       │
       Authentication subflow                                        │
     caller lookup hint + OTP                                         │
       DTMF secure input                                              │
              │                                                       │
              ▼                                                       │
       Identity Lambda                                                │
              │                                                       │
      DynamoDB session state                                          │
              │                                                       │
              ▼                                                       │
    LookupAppointment Lambda                                          │
              │                                                       │
       private VPC subnets                                            │
              │                                                       │
          RDS Proxy                                                   │
              │                                                       │
      Aurora PostgreSQL                                               │
      scheduling database                                             │
              │                                                       │
              ▼                                                       │
  explicit spoken confirmation                                        │
              │                                                       │
              ▼                                                       │
    CancelAppointment Lambda                                          │
              │                                                       │
  transaction + idempotency + outbox                                  │
              │                                                       │
       ┌──────┴──────────┐                                            │
       │                 │                                            │
       ▼                 ▼                                            ▼
  Polly success      Event publisher                         Cannot automate
     prompt               │                                      │
                          ▼                         ┌──────────────┴─────────────┐
                      EventBridge                   │                            │
                          │                         ▼                            ▼
                  ┌───────┴────────┐          Human queue                 Connect Task
                  ▼                ▼          or callback               next business day
                SQS          slot/waitlist
                  │            workflow
                  ▼
       Notification Lambda
           │             │
           ▼             ▼
          SES       SMS notification


             Contact-center operations and evidence

     Amazon Connect contact records ──► Kinesis Data Streams
     Call recordings / transcripts ───► S3 + KMS
     Contact Lens analytics ──────────► transcripts, categories, sentiment
     Flow logs / metrics ─────────────► CloudWatch
     Configuration activity ──────────► CloudTrail
```

## Architecture in one sentence

> Amazon Connect accepts the call, checks operating hours, uses Lex and Polly for conversational self-service, invokes narrowly scoped Lambda functions to authenticate the caller and transact with the private appointment system, and either confirms the cancellation or routes the contact into an agent queue, callback, or Connect Task.

---

# 4. Functional decisions at a glance

| Function | Baseline choice | Reason |
|---|---|---|
| Telephone contact center | Amazon Connect | Managed phone numbers, flows, queues, routing, agents |
| Natural-language intent | Amazon Lex V2 | Voice and text intents, slots, confirmation, fallback |
| Voice prompts | Amazon Polly through Connect | Dynamic text-to-speech and SSML |
| Sensitive numeric input | DTMF secure-input blocks | More deterministic and less transcript exposure |
| Business integration | Lambda | Fast lookup and transactional integration |
| Appointment system | Aurora PostgreSQL | Relational schedule and booking constraints |
| Lambda database access | RDS Proxy | Pool connections and protect database from bursts |
| Temporary auth state | DynamoDB | Contact-scoped OTP and attempt state with expiry |
| Human waiting area | Connect queue | Contacts waiting for available agents |
| Agent eligibility | Routing profile | Connect queues and channels to agents |
| Agent permissions | Security profile | Control actions within Connect |
| After-hours follow-up | Amazon Connect Task | Work item routed to agents on a longer SLA |
| Machine retry queue | SQS | Durable asynchronous processing and backpressure |
| Domain events | EventBridge | Route cancellation events to interested systems |
| Recordings | S3 with KMS | Durable controlled retention |
| Integrated analytics | Contact Lens conversational analytics | Transcription, sentiment, categories, redaction |
| Custom audio analysis | Amazon Transcribe Call Analytics | Standalone or non-Connect audio workflows |
| Custom text analysis | Amazon Comprehend | Entities, sentiment, key phrases, PII in text |
| Real-time event export | Kinesis Data Streams | Contact and agent events for custom analytics |
| Operational monitoring | CloudWatch | Metrics, logs, alarms |
| Audit | CloudTrail | Connect and supporting AWS API changes |
| Regional contact-center DR | Connect Global Resiliency | Replicated instances and traffic distribution |

---

# 5. The Amazon Connect mental model

## 5.1 Connect instance

An Amazon Connect **instance** is the administrative boundary for one contact-center environment.

It contains or references resources such as:

```text
phone numbers
flows
queues
hours of operation
routing profiles
security profiles
agents
Lex bots
Lambda functions
recording configuration
analytics configuration
```

Northstar uses separate production and nonproduction instances rather than testing new routing logic against the live patient number.

---

## 5.2 Claimed phone number

Northstar claims or ports a telephone number and associates it with an inbound flow.

```text
Phone number
    ↓
entry flow
```

The number identifies the contact-center entry point.

It does not identify or authenticate the patient.

---

## 5.3 Contact

A **contact** is one interaction handled by Connect.

Examples:

```text
inbound voice call
outbound call
chat
task
email interaction
callback
```

A contact receives a unique contact ID.

The contact ID is useful for:

- tracing the flow;
- correlating logs;
- linking Lambda calls;
- identifying recordings;
- idempotency within one interaction.

It is not the patient’s permanent business identifier.

---

## 5.4 Flow

A Connect **flow** is the contact-center orchestration.

It can:

- play prompts;
- obtain DTMF or Lex input;
- check operating hours;
- set contact attributes;
- invoke Lambda;
- select a working queue;
- transfer to agents;
- create tasks;
- enable recording and analytics;
- branch on errors;
- disconnect.

The source material treats this as the workflow that routes calls and messages to the correct responder. 

### Memory rule

```text
Flow:
    What happens to this contact next?
```

---

## 5.5 Queue

A queue is a waiting area for contacts that need an agent.

Examples:

```text
General Scheduling
Procedure Scheduling
Billing
Spanish Scheduling
Urgent Clinical Triage
After-Hours Callback
```

A queue does not itself decide which agents may receive its contacts.

Amazon Connect defines queues as the waiting areas for contacts. 

### Memory rule

```text
Queue:
    Which work is waiting?
```

---

## 5.6 Routing profile

A routing profile links agents to queues.

It determines concepts such as:

- which queues an agent serves;
- queue priority;
- queue delay;
- supported channels;
- concurrency for chats or tasks.

```text
Bilingual Scheduling routing profile
    ├── Spanish Scheduling
    ├── General Scheduling
    └── After-Hours Callback
```

Connect documentation explicitly distinguishes the queue as the waiting area from the routing profile that connects queues to agents. 

### Memory rule

```text
Routing profile:
    Which waiting work may reach this agent?
```

---

## 5.7 Security profile

A security profile controls what a Connect user may do inside the contact-center environment.

Examples:

```text
accept calls
search contacts
listen to recordings
view transcripts
edit flows
manage users
view metrics
monitor live contacts
```

Security profiles are groups of permissions for Connect roles such as agents, supervisors, and administrators. 

### Memory rule

```text
Security profile:
    What may this Connect user see or do?
```

---

## 5.8 Three commonly confused objects

| Object | Main question |
|---|---|
| Queue | Where is the contact waiting? |
| Routing profile | Which agents may receive it? |
| Security profile | What actions may an agent or supervisor perform? |

An agent can have permission to use the Contact Control Panel but receive no calls because the correct queue is absent from their routing profile.

An agent can receive calls but be unable to review recordings because the security profile lacks that permission.

---

# 6. Sunday should change routing, not availability

## 6.1 Hours of operation

Northstar defines scheduling-agent hours:

```text
Monday–Friday
08:00–18:00
America/Montevideo or clinic-local time zone
```

The flow uses a **Check hours of operation** block.

```text
In hours
    → automation or human agent available

Out of hours
    → automation remains available
    → human fallback becomes task or callback
```

Connect flows can branch explicitly on in-hours, out-of-hours, and error outcomes. 

The bad design is:

```text
Out of hours
    → play closed message
    → disconnect
```

The better design is:

```text
Out of hours
    ├── cancel appointment
    ├── confirm appointment
    ├── hear clinic information
    └── request next-business-day follow-up
```

---

## 6.2 Holiday overrides

Hours should account for:

- public holidays;
- temporary closures;
- extended seasonal hours;
- emergency staffing changes.

The customer-service system should use configured hours and overrides rather than embedding weekday logic into Lambda source code. Connect supports hours-of-operation overrides and flow branching based on the effective schedule. 

---

# 7. The complete cancellation conversation

## 7.1 Entry

The caller hears:

> “Welcome to Northstar Care. You can say cancel an appointment, confirm an appointment, clinic hours, or speak to someone.”

Connect produces this prompt through Polly or plays a prerecorded recording.

The flow sends the caller’s response to Lex.

---

## 7.2 Intent recognition

Possible Lex intents are:

```text
CancelAppointment
ConfirmAppointment
RescheduleAppointment
ClinicHours
SpeakToAgent
MedicalQuestion
FallbackIntent
```

The caller says:

> “I need to cancel my doctor’s appointment tomorrow.”

Lex returns:

```text
intent:
    CancelAppointment

possible slot:
    requested_date = tomorrow
```

Lex intents represent the goals users want to accomplish, and slots collect the values required to fulfill an intent. 

---

## 7.3 Authentication

Before appointment details are spoken, the flow authenticates the caller.

A simplified baseline:

1. Treat the incoming phone number as a lookup hint.
2. Identify possible patient accounts associated with that number.
3. Send a one-time code to a previously registered contact channel.
4. Pause automated recording for sensitive input.
5. Ask the caller to enter the code using DTMF.
6. Validate the code and attempt count.
7. Store only an opaque verified-patient reference as a contact attribute.

The presented caller ID alone is not sufficient authentication.

---

## 7.4 Appointment lookup

After verification, Connect invokes a Lambda function:

```text
LookupAppointments(
    verified_patient_ref,
    requested_date
)
```

Possible response:

```json
{
  "result": "ONE_MATCH",
  "appointmentRef": "APT-7F91",
  "displayDate": "Monday, August 31",
  "displayTime": "10:30 AM",
  "displayLocation": "Northstar Downtown Clinic",
  "selfServiceCancellable": true
}
```

The Lambda response returns opaque and display-safe values.

It should not return the patient’s entire record into contact attributes.

---

## 7.5 Explicit confirmation

Polly says:

> “I found an appointment for Monday, August 31 at 10:30 AM at Northstar Downtown Clinic. Do you want to cancel this appointment?”

The caller must answer yes.

Lex confirmation state distinguishes:

```text
Confirmed
Denied
Not yet confirmed
```

Lex supports confirmation prompts before fulfillment. 

---

## 7.6 Transaction

Connect invokes:

```text
CancelAppointment(
    verified_patient_ref,
    appointment_ref,
    contact_id
)
```

The function performs a conditional transaction.

Possible results:

```text
CANCELLED
ALREADY_CANCELLED
NOT_CANCELLABLE
NOT_FOUND
STALE_SELECTION
BACKEND_UNAVAILABLE
```

Only `CANCELLED` and `ALREADY_CANCELLED` produce a success message.

---

## 7.7 Confirmation

For `CANCELLED`:

> “Your appointment has been cancelled. We have sent a confirmation to your registered contact method.”

For `ALREADY_CANCELLED`:

> “That appointment was already cancelled. No further action is required.”

The second response makes retries safe and reassuring.

---

## 7.8 Escalation

For `NOT_CANCELLABLE`:

```text
In business hours
    → transfer to specialized queue

Outside business hours
    → create a Connect Task
    → promise only that the request will be reviewed
```

The bot must not say:

> “Your appointment is cancelled.”

when the backend accepted only a review request.

---

# 8. Amazon Lex

## 8.1 Lex is not a general database agent

Lex owns conversational concepts:

```text
intent
utterance
slot
prompt
confirmation
fallback
session context
fulfillment hook
```

It does not own:

```text
appointment authorization
clinical cancellation policy
database transaction
auditable state transition
```

The uploaded materials describe Lex as the service for voice- and text-based chatbots and self-service IVR interaction. 

---

## 8.2 Intent

An intent is the user’s goal.

Example training utterances:

```text
I need to cancel my appointment.
Cancel my visit.
I cannot make it tomorrow.
Please remove my booking.
I need to call off my consultation.
```

Do not create a separate intent for every wording.

---

## 8.3 Slot

A slot is a value needed to complete the intent.

Possible slots:

```text
appointment date
location
appointment type
confirmation answer
```

However, Northstar should avoid asking the caller to speak unnecessary sensitive details.

After authentication, the backend can identify likely appointments and let the caller choose:

```text
Press or say 1 for Monday at 10:30.
Press or say 2 for Thursday at 14:00.
```

---

## 8.4 Dialog code hook versus fulfillment

A Lex Lambda code hook can:

- validate a slot;
- alter the conversation path;
- derive additional values;
- reject invalid input.

A fulfillment hook performs or initiates the requested operation after required slots and confirmation are complete. Lex V2 allows Lambda-based fulfillment but can also mark fulfillment complete without invoking Lambda. 

For Northstar:

```text
Lex:
    collect intent and conversational values

Connect flow Lambda:
    authenticate
    query appointment backend
    execute cancellation
```

This keeps contact orchestration visible in Connect rather than hiding the entire workflow inside one Lex function.

---

## 8.5 Fallback

The fallback intent handles input that does not match a supported intent.

After one failure:

> “I can help cancel or confirm an appointment, provide clinic hours, or connect you with scheduling.”

After repeated failures:

```text
In hours
    → human queue

Out of hours
    → create callback task
    → optionally offer DTMF menu
```

A bot should not trap a caller in an endless recognition loop.

---

## 8.6 Voice plus DTMF

The flow supports both:

```text
Say:
    cancel my appointment

or press:
    1
```

Lex provides convenience.

DTMF provides a deterministic fallback for:

- noisy environments;
- speech impairment;
- unsupported accents;
- recognition failures;
- sensitive numeric input.

Connect’s customer-input blocks support Lex and DTMF input. 

---

## 8.7 Do not automate every utterance

The bot recognizes:

```text
"I have chest pain and need to know whether I should cancel."
```

as a clinical or emergency-related request.

It does not generate medical advice.

It follows a clinic-approved branch such as:

```text
play approved safety message
transfer to clinical triage or emergency destination
do not continue administrative cancellation flow blindly
```

The conversational system should recognize its domain boundary.

---

# 9. Amazon Polly

## 9.1 Purpose

Polly converts text into speech.

Amazon Connect uses Polly to generate text-to-speech prompts from plain text or SSML. 

Dynamic prompt:

```text
Your appointment is scheduled for
Monday, August 31 at 10:30 AM.
```

The appointment date and time come from the backend; Polly speaks the resulting string.

---

## 9.2 Polly versus prerecorded prompts

### Polly

Use for:

- dates;
- times;
- locations;
- queue estimates;
- dynamic patient-safe information;
- multiple languages;
- rapidly changing wording.

### Prerecorded prompt

Use for:

- legally reviewed disclosure;
- clinical safety notice;
- brand-specific greeting;
- wording where exact human pronunciation matters;
- a message that changes rarely.

A contact flow can combine both. Connect supports prerecorded prompts and text-to-speech prompts. 

---

## 9.3 SSML

SSML can control:

- pauses;
- emphasis;
- pronunciation;
- speaking rate;
- how dates or numbers are spoken.

Example conceptual prompt:

```xml
Your appointment is at
<say-as interpret-as="time">10:30am</say-as>.
```

Connect supports a subset of Polly SSML tags for flow prompts. 

---

# 10. Caller authentication

## 10.1 Caller ID is a hint

The incoming number can help locate possible records.

It should not independently authorize cancellation because:

- family members may share a number;
- phone numbers are reassigned;
- a caller may use another device;
- displayed caller information is not a strong possession proof;
- multiple patients may share one household number.

Use it to reduce search space, not as the final decision.

---

## 10.2 Baseline OTP flow

```text
Incoming phone number
    ↓
Lookup possible patient account
    ↓
Send OTP to registered channel already on record
    ↓
Caller enters OTP through DTMF
    ↓
Validate OTP, expiry, attempts, and contact ID
    ↓
Issue opaque verified-session reference
```

The code is sent to the contact information already stored in the patient system, not simply to whatever number the current caller provides.

---

## 10.3 DynamoDB authentication-session record

Example:

```text
PK:
    CONTACT#<ConnectContactId>

verified_patient_ref:
    PATIENT#opaque-token

otp_hash:
    ...

attempts:
    1

expires_at:
    epoch timestamp

state:
    CHALLENGE_SENT
```

The application must check `expires_at` explicitly. DynamoDB TTL is appropriate for eventual cleanup but does not guarantee physical deletion at the precise expiration instant. 

---

## 10.4 Secure input

During OTP collection:

- pause automated-interaction recording;
- request DTMF rather than spoken digits;
- do not log the raw code;
- do not store it as a long-lived contact attribute;
- store a hash rather than plaintext;
- limit attempts;
- expire it quickly.

Amazon Connect can pause and resume automated interaction recording and provides secure customer-input patterns. 

---

## 10.5 Authentication is not appointment authorization

Successful OTP validation proves:

> The caller controls an approved authentication channel for this patient account.

The cancellation transaction must still prove:

```text
appointment belongs to verified patient
appointment status permits cancellation
appointment type allows self-service
requested transition is valid
```

Authentication and object-level authorization remain separate.

---

## 10.6 Why not Amazon Connect Voice ID?

Voice authentication might appear ideal for this use case, but Amazon Connect Voice ID reached end of support on May 20, 2026. It is therefore not a viable component for a new August 2026 architecture. 

For an exam question based on an older service snapshot, Voice ID may appear as a recognition-level distractor or legacy capability. For a current design, use another approved authentication mechanism.

---

# 11. Appointment backend

## 11.1 Why relational storage

Appointment scheduling contains relationships and constraints such as:

```text
patient
provider
location
appointment type
time interval
room
equipment
referral
insurance authorization
cancellation policy
```

A relational scheduling system is a reasonable source of truth.

Northstar uses:

```text
Aurora PostgreSQL
+
RDS Proxy
```

The contact-center automation does not create a second independent appointment database.

---

## 11.2 Why RDS Proxy

A burst of calls can create many short Lambda database connections.

RDS Proxy:

- pools database connections;
- reuses backend connections;
- limits pressure on the database;
- improves behavior during connection surges;
- provides a stable proxy endpoint.

AWS recommends RDS Proxy for Lambda functions that make frequent, short database connections or may otherwise exhaust database connections during high concurrency. 

---

## 11.3 Lookup transaction

The lookup query returns only appointments:

```text
owned by verified patient
inside relevant time window
not already completed
visible through self-service
```

The Lambda returns an opaque appointment reference rather than exposing the physical database identifier directly in the conversation.

---

## 11.4 Cancellation transaction

Conceptually:

```sql
UPDATE appointments
SET
    status = 'CANCELLED',
    cancelled_at = current_timestamp,
    cancelled_via = 'AMAZON_CONNECT',
    version = version + 1
WHERE
    appointment_id = :appointment_id
    AND patient_id = :verified_patient_id
    AND status IN ('BOOKED', 'CONFIRMED')
    AND self_service_cancellable = true
RETURNING appointment_id, status;
```

This enforces authorization and state validity in the transaction itself.

---

## 11.5 Idempotency

The same logical cancellation may be attempted several times because:

- the caller calls again;
- Lambda response is lost;
- the flow retries;
- the caller repeats “yes”;
- the notification fails;
- a human agent also tries to cancel.

The operation should converge:

```text
BOOKED
    → CANCELLED

CANCELLED
    → ALREADY_CANCELLED
```

It must not produce:

```text
duplicate penalty
duplicate notification
duplicate waitlist release
```

---

## 11.6 Contact ID is not the only idempotency key

The Connect contact ID protects retries inside one call.

A later call receives a new contact ID.

The stronger business idempotency rule is:

```text
appointment_id
+
transition = CANCEL
+
current appointment state
```

The database transition itself must be safe across multiple contacts.

---

## 11.7 Restricted appointments

Examples of appointments that may require human handling:

```text
surgery
infusion
procedure requiring preparation
high-risk follow-up
appointment tied to medication workflow
same-day restricted cancellation
research-study visit
```

The database returns:

```text
NOT_CANCELLABLE_BY_SELF_SERVICE
```

The bot does not infer policy from the appointment’s name.

---

# 12. Keep the synchronous flow short

Amazon Connect’s Lambda flow block waits at most eight seconds for a function response. After the configured timeout, the contact follows the Error branch. 

Therefore, synchronous functions should do bounded work:

```text
lookup verified profile
list a small set of appointments
execute one transaction
return display-safe result
```

They should not:

- wait several minutes for an external system;
- run a large report;
- poll an asynchronous workflow;
- perform open-ended retry;
- transcribe the entire call;
- send many notifications synchronously.

---

## 12.1 Slow backend behavior

If the scheduling system does not respond in time:

```text
Lambda timeout or error
    ↓
Connect Error branch
    ↓
do not claim cancellation
    ↓
create a follow-up Task
    ↓
tell caller request could not be completed automatically
```

Honest failure is safer than false success.

---

## 12.2 Asynchronous work after commit

After cancellation succeeds:

```text
database transaction
    ├── appointment status = CANCELLED
    └── outbox event = PENDING
```

A background publisher sends:

```text
AppointmentCancelled
```

to EventBridge.

Consumers may:

- send confirmation;
- release the slot to a waitlist;
- update analytics;
- notify the provider’s workflow;
- update external systems.

The spoken success depends on the appointment transaction, not on every downstream notification completing.

---

# 13. Dual-write risk

A naïve Lambda does:

```text
1. Update Aurora.
2. Publish EventBridge event.
```

Possible failure:

```text
Aurora update succeeds
    ↓
Lambda crashes before EventBridge publish
    ↓
appointment cancelled
confirmation and waitlist event missing
```

Reversing the order creates the opposite inconsistency:

```text
event published
    ↓
database update fails
    ↓
consumers believe appointment was cancelled
```

The safer design writes an **outbox record in the same database transaction** as the cancellation.

```text
Aurora transaction:
    update appointment
    insert cancellation event into outbox
```

An asynchronous publisher retries outbox delivery.

Consumers remain idempotent because event delivery can repeat.

---

# 14. Connect invokes Lambda

## 14.1 Function resource policy

Amazon Connect needs permission to invoke the Lambda function.

This is granted through a Lambda **resource-based policy**:

```text
Principal:
    connect.amazonaws.com

Action:
    lambda:InvokeFunction

Condition:
    intended AWS account
    intended Connect instance ARN
```

Associating a Lambda function with a Connect instance can add the required resource permission automatically. Connect does not use its service-linked role to invoke these flow functions; permission is placed on the function itself. 

### Memory rule

```text
Lambda resource policy:
    May Connect invoke the function?

Lambda execution role:
    What may the function do after invocation?
```

---

## 14.2 Same-Region baseline

Northstar places its primary Connect flow functions in the same Region as the Connect instance.

Cross-Region Lambda invocation is supported through explicit ARN and resource-policy configuration, but it adds latency and a second Regional dependency to a synchronous voice path. 

---

## 14.3 Connect-to-Lambda authorization trace

```text
Amazon Connect instance
    ↓
lambda:InvokeFunction
    ↓
LookupAppointmentFunction
    ↓ evaluates
Lambda resource policy
SourceAccount
SourceArn
    ↓
function starts
```

The function’s execution role is not evaluated to decide whether Connect may invoke it.

---

# 15. Lambda execution roles

Northstar uses separate roles.

## 15.1 Identity function

```text
IdentityVerificationRole

dynamodb:GetItem
dynamodb:PutItem
dynamodb:UpdateItem

send approved OTP notification
kms:Decrypt where required
```

---

## 15.2 Appointment lookup function

```text
AppointmentLookupRole

secretsmanager:GetSecretValue
or rds-db:connect

CloudWatch Logs permissions
VPC network-interface permissions
```

Database-level SQL permissions are read-only.

---

## 15.3 Cancellation function

```text
AppointmentCancellationRole

database cancellation user
write cancellation and outbox
read selected appointment state
no schema administration
no arbitrary patient-table access
```

The database user is permitted to execute only the required application operations.

---

## 15.4 Notification publisher

```text
NotificationPublisherRole

events:PutEvents
or sqs:SendMessage
```

The notification sender uses another role for:

```text
ses:SendEmail
SMS action
```

A compromised notification worker should not be able to cancel appointments.

---

# 16. Agent identity

## 16.1 SAML federation

Northstar agents authenticate through the corporate identity provider using SAML-based federation rather than maintaining separate long-lived Connect passwords.

Amazon Connect supports SAML 2.0 federation through AWS IAM for agent SSO. 

---

## 16.2 Connect user record

The federated employee still has a Connect user configuration containing concepts such as:

```text
routing profile
security profile
agent hierarchy
phone settings
proficiencies
```

Federated authentication does not eliminate Connect’s own authorization and routing model.

---

## 16.3 Identity layers

```text
Corporate IdP:
    Is this employee authenticated?

IAM federation role:
    May the employee federate into this Connect instance?

Connect security profile:
    What may the employee do inside Connect?

Connect routing profile:
    Which queues and channels may send work to the employee?
```

---

## 16.4 Least privilege examples

### Scheduling agent

Can:

- receive scheduling contacts;
- see minimum appointment context;
- update approved scheduling fields.

Cannot:

- edit contact flows;
- listen to arbitrary recordings;
- manage other users;
- change KMS or S3 configuration.

### Supervisor

Can additionally:

- monitor queue metrics;
- review selected recordings;
- manage agent states;
- perform quality reviews.

### Connect administrator

Can:

- modify flows;
- configure integrations;
- manage routing and users.

The administrator does not automatically need access to all patient records.

---

# 17. Amazon Connect Tasks and callbacks

## 17.1 Connect Task

A Connect Task is work that should be routed to an agent but does not require the patient to remain on the telephone.

Example:

```text
Task:
    Review restricted cancellation request

Patient:
    opaque reference

Appointment:
    opaque reference

Requested by:
    automated Sunday call

Service level:
    before 09:00 next business day
```

Connect Tasks can be created directly from flows and can remain active over service-level periods measured in hours or days. 

---

## 17.2 Connect Task versus SQS

### Connect Task

Use for:

```text
human work
agent routing
contact-center SLA
agent workspace
```

### SQS

Use for:

```text
machine work
retryable background processing
consumer scaling
DLQ
```

A restricted appointment should create a Connect Task.

A notification that needs machine retry should enter SQS.

---

## 17.3 Queued callback

During busy staffed hours, the caller may choose a callback rather than wait.

The callback remains in a queue until an agent is available, and Connect then calls the customer and joins the agent. 

Queued callback is most appropriate when:

- agents are operating;
- the caller wants to preserve their place in queue;
- an agent interaction is expected soon.

An after-hours Task is better when the work is not expected until the next business period.

---

# 18. Flow, queue, and routing example

```text
Incoming call
    ↓
Lex: SpeakToAgent
    ↓
Check hours
    ├── In hours
    │      ↓
    │   Determine language and topic
    │      ↓
    │   Set working queue
    │      ↓
    │   Transfer to queue
    │      ↓
    │   routing profile selects eligible agent
    │
    └── Out of hours
           ↓
        Offer automation
           ├── automation succeeds → end
           └── human required
                    ↓
               create Task
                    ↓
               next-day routing profile
                    ↓
               eligible agent receives task
```

Amazon Connect routing combines flow logic, queue hours, queues, and agent routing profiles. 

---

# 19. Networking architecture

## 19.1 Caller to Amazon Connect

```text
Patient telephone
    ↓
public telephone network
    ↓
Amazon Connect telephony infrastructure
```

This is not traffic entering a Northstar VPC through an Internet Gateway.

Northstar does not place a security group in front of the public telephone number.

Amazon Connect manages the telephony entry point.

---

## 19.2 Agent to Connect

```text
Agent browser / headset
    ↓
corporate Internet connection
    ↓ HTTPS and real-time media
Amazon Connect agent workspace
```

The corporate network must permit the domains, DNS, protocols, and media paths required by the Contact Control Panel or agent workspace. AWS recommends domain-based network allowlisting rather than trying to maintain large changing IP-range lists. 

---

## 19.3 Connect to Lex

```text
Connect flow
    ↓ managed AWS service call
Lex bot alias
```

Associating the bot updates its resource-based policy so the Connect instance may invoke it. 

No VPC peering is needed between Connect and Lex.

---

## 19.4 Connect to Lambda

```text
Connect flow
    ↓ Lambda service endpoint
Lambda function
```

The function resource policy grants invocation.

The function may then use VPC networking for its backend.

---

## 19.5 Lambda to appointment database

```text
Lambda execution environment
    ↓ managed VPC attachment
private application subnet
    ↓
Lambda-SG
    ↓ TCP 5432
RDS-Proxy-SG
    ↓
RDS Proxy
    ↓ TCP 5432
Aurora-SG
    ↓
Aurora PostgreSQL
```

Required controls include:

- correct subnet route;
- security-group relationships;
- database endpoint;
- TLS configuration;
- database authentication;
- SQL authorization.

IAM permission to invoke the Lambda does not create the database path.

---

## 19.6 Security groups

### Lambda security group

```text
Outbound:
    TCP 5432 to RDS-Proxy-SG
    HTTPS to required AWS endpoints
```

### RDS Proxy security group

```text
Inbound:
    TCP 5432 from Lambda-SG

Outbound:
    TCP 5432 to Aurora-SG
```

### Aurora security group

```text
Inbound:
    TCP 5432 from RDS-Proxy-SG
```

Do not allow:

```text
PostgreSQL from the entire Internet
PostgreSQL from all VPC resources
```

merely because the database belongs to a contact-center application.

---

## 19.7 Lambda to external scheduling SaaS

If the authoritative scheduler is a third-party public API:

```text
VPC-attached Lambda
    ↓
private-subnet default route
    ↓
NAT Gateway
    ↓
Internet Gateway
    ↓ HTTPS 443
Scheduling SaaS
```

If the Lambda does not need any private VPC resources, leaving it outside the VPC may provide a simpler public-service path.

The VPC decision follows the required destinations, not a generic rule that regulated workloads must place every Lambda in a VPC.

---

## 19.8 Recordings to S3

```text
Amazon Connect
    ↓ managed service delivery
S3 recording bucket
    ↓
KMS encryption
```

This is a service-to-service delivery path.

It does not require VPC peering from the Connect instance to a recording VPC.

Call recordings are delivered to the configured S3 bucket and are encrypted with KMS. 

---

# 20. Packet and authorization walks

## 20.1 Caller asks to cancel

```text
1. Caller reaches the Connect phone number.

2. Inbound flow begins.

3. Flow sets language and Polly voice.

4. Flow checks hours of operation.

5. Get customer input sends speech to Lex.

6. Lex returns CancelAppointment.

7. Flow begins authentication.

8. Caller enters OTP through DTMF.

9. Connect invokes Identity Lambda.

10. Lambda resource policy authorizes Connect.

11. Lambda execution role accesses DynamoDB.

12. Verified patient reference returns to the flow.

13. Connect invokes appointment lookup Lambda.

14. Lambda reaches RDS Proxy through private VPC networking.

15. Database user reads eligible appointments.

16. Polly asks for explicit confirmation.

17. Connect invokes cancellation Lambda.

18. Database transaction changes state and writes outbox event.

19. Lambda returns CANCELLED.

20. Polly confirms the cancellation.

21. Background event processing sends written confirmation.
```

---

## 20.2 Timeout interpretation

Suppose appointment lookup times out.

The following may have succeeded:

```text
telephone path
Connect flow
Lex recognition
caller authentication
Connect-to-Lambda invocation
```

The failure may be:

```text
Lambda cold or overloaded
VPC ENI path
security group
RDS Proxy
Aurora
database lock
slow query
```

The Error branch should retain this distinction.

---

## 20.3 `AccessDenied` interpretation

### Connect cannot invoke Lambda

Investigate:

```text
Lambda resource-based policy
Connect instance SourceArn
SourceAccount
function alias ARN
Region
```

### Lambda starts but cannot read DynamoDB

Investigate:

```text
Lambda execution role
table ARN
KMS
SCP
permissions boundary
```

### Lambda reaches database but SQL is denied

Investigate:

```text
database user
database role
table or procedure grants
```

These are three different authorization systems.

---

# 21. Recording and analytics

## 21.1 Recording policy

Northstar does not automatically assume that every call should be recorded forever.

The policy distinguishes:

```text
automated self-service recording
agent/customer recording
sensitive-input segment
clinical escalation
retention class
legal jurisdiction
```

Connect enables voice recording through a **Set recording and analytics behavior** block in the flow. Automated-interaction recording can be paused and resumed independently from later agent/customer recording. 

---

## 21.2 Sensitive segment

For OTP input:

```text
recording ON
    welcome and intent

recording OFF
    sensitive verification input

recording ON
    appointment-selection and outcome
```

Whether appointment details themselves should be recorded depends on the organization’s privacy, legal, and retention policy.

---

## 21.3 S3 storage

Recordings and analytics files use an S3 bucket associated with the Connect instance.

Controls include:

- Block Public Access;
- KMS encryption;
- restrictive bucket policy;
- separation between recording writers and reviewers;
- lifecycle rules;
- retention policy;
- access logging and CloudTrail data events where justified.

Any principal that can read the recording object can potentially hear sensitive information, so recording access is more privileged than ordinary Connect agent access.

---

## 21.4 Recording access

A supervisor may need Connect security-profile permission to find and review recordings.

That does not automatically mean the supervisor should receive broad direct S3 access.

Prefer access through the controlled Connect interface when it satisfies the operational requirement.

---

# 22. Contact Lens conversational analytics

## 22.1 Integrated analytics

Amazon Connect Contact Lens conversational analytics can provide real-time and post-contact analysis for supported channels, including:

- transcription;
- sentiment;
- talk time and non-talk time;
- categories;
- issue, outcome, and action-item detection;
- sensitive-data redaction;
- supervisor alerts;
- contact summaries. 


Northstar can define categories such as:

```text
CANCELLATION_SUCCEEDED
CALLER_COULD_NOT_AUTHENTICATE
BOT_FAILED_TO_UNDERSTAND
REQUESTED_MEDICAL_ADVICE
REPEATED_CALL_AFTER_CANCELLATION
AGENT_ESCALATION
```

---

## 22.2 Real-time use

Real-time analytics can alert a supervisor when an agent contact contains a configured phrase or category.

Example:

```text
"I've tried to cancel three times."
    ↓
category match
    ↓
supervisor notification
```

The automated self-service path should normally resolve the problem without a supervisor, but analytics can reveal where the system is failing.

---

## 22.3 Post-contact use

Post-contact analytics helps answer:

- Why are callers escalating?
- Which phrases precede bot failure?
- Are callers confused by the confirmation prompt?
- Which clinics receive the most cancellation calls?
- Does negative sentiment improve after agent transfer?
- How much silence or waiting occurs?
- Are agents following the approved process?

---

## 22.4 Redaction is not perfect

Contact Lens redaction is machine-learning based and may fail to identify every sensitive value.

AWS explicitly warns that its redacted output does not constitute de-identification under HIPAA and should continue to be treated as protected health information. 

Therefore:

```text
redacted transcript
    ≠
public or non-sensitive data
```

Apply access controls, encryption, and retention as though protected information may remain.

---

# 23. Lex versus Transcribe versus Polly versus Comprehend

| Service | Input | Output | Role in this lesson |
|---|---|---|---|
| Lex | Speech or text conversation | Intent, slots, dialog state | Understand what caller wants |
| Transcribe | Audio | Text transcript | Custom speech-to-text or call analytics |
| Polly | Text | Speech audio | Speak prompts and dynamic values |
| Comprehend | Text | Sentiment, entities, key phrases, PII, syntax | Custom text analytics |
| Contact Lens | Connect contact | Integrated transcript and contact analytics | Purpose-built Connect analytics |

---

## 23.1 Lex

Question answered:

> What is the caller trying to do, and which values are needed?

```text
"I need to cancel tomorrow"
    ↓
CancelAppointment
requested_date = tomorrow
```

---

## 23.2 Transcribe

Question answered:

> What words were spoken?

Standalone Amazon Transcribe Call Analytics supports real-time and post-call transcription together with contact-center-oriented analytics such as categories, issue detection, sentiment, and PII handling. 

Use standalone Transcribe when:

- the audio comes from a non-Connect contact center;
- a custom audio-processing pipeline is needed;
- recordings already exist in S3;
- Connect’s integrated analytics do not fit the workflow.

---

## 23.3 Polly

Question answered:

> How should this text be spoken?

```text
"Your appointment has been cancelled."
    ↓
audio prompt
```

---

## 23.4 Comprehend

Question answered:

> What can be inferred from this existing text?

Examples:

```text
sentiment
entities
key phrases
language
PII
```

Comprehend does not convert raw audio into text. The transcript must already exist.

---

## 23.5 Contact Lens versus custom pipeline

### Contact Lens

Prefer when:

- the contact already runs through Amazon Connect;
- integrated agent and supervisor views are valuable;
- standard contact-center analytics satisfy the requirement;
- minimal custom data plumbing is desired.

### Transcribe plus Comprehend

Prefer when:

- audio originates elsewhere;
- custom transcript processing is required;
- analytics must feed a specialized domain model;
- output needs a bespoke downstream pipeline.

Do not build a custom transcription-and-sentiment stack merely because the names Transcribe and Comprehend appear in the question when Contact Lens directly satisfies the Connect requirement.

---

# 24. Contact records and streaming

## 24.1 Contact record

A Connect contact record captures lifecycle information such as:

- contact ID;
- channel;
- initiation and disconnect times;
- queue;
- agent;
- routing;
- transfer relationships;
- durations;
- outcome-related attributes.

Connect’s real-time and historical contact-center metrics derive from contact records. 

---

## 24.2 Kinesis streaming

Amazon Connect can export contact records and agent events to Kinesis for near-real-time custom analysis. 

Example:

```text
Connect contact records
    ↓
Kinesis Data Streams
    ↓
Data Firehose
    ↓
S3 analytical lake
    ↓
Glue / Athena / dashboards
```

Possible real-time consumers:

```text
queue-overload alert
bot-failure detector
clinic-level demand monitor
agent-state dashboard
fraud or abuse monitor
```

---

## 24.3 Recordings versus contact records

```text
Recording:
    audio content of interaction

Transcript:
    words spoken

Contact record:
    structured lifecycle and routing metadata

Agent event:
    login, logout, state changes

Flow log:
    execution path through flow blocks
```

They answer different operational questions.

---

## 24.4 Kinesis is not required for the basic cancellation

The cancellation works without a custom streaming platform.

Kinesis is justified when Northstar needs:

- near-real-time external analytics;
- multiple custom consumers;
- historical event processing outside native Connect reports.

Do not add streaming infrastructure merely because the contact center emits events.

---

# 25. Healthcare data protection

## 25.1 Eligible does not mean compliant

As of August 3, 2026, AWS lists Amazon Connect, Lex, Polly, Transcribe, Comprehend, Lambda, DynamoDB, Aurora, S3, Kinesis, EventBridge, SQS, KMS, and related services as HIPAA-eligible.

AWS also states that a covered entity or business associate must enter into an AWS Business Associate Agreement before using eligible services with protected health information, and customers remain responsible for compliant configuration. 

Therefore:

```text
HIPAA-eligible service
    ≠
HIPAA-compliant architecture
```

---

## 25.2 Data minimization

Do not copy the complete patient record into:

- Lex session attributes;
- Connect contact attributes;
- Lambda logs;
- CloudWatch flow logs;
- EventBridge events;
- SQS messages;
- analytics tags.

Use opaque references:

```text
PATIENT#7f8a
APPOINTMENT#81d2
```

The authorized backend resolves them.

---

## 25.3 Separate administrative and clinical data

The automated contact center needs:

```text
appointment time
location
cancellation eligibility
contact preference
verification state
```

It generally does not need:

```text
diagnosis
clinical notes
test results
prescriptions
full medical history
```

Architectural least privilege applies to data fields as well as IAM actions.

---

## 25.4 Encryption

Protect:

- recordings in S3;
- transcripts;
- DynamoDB verification state;
- Aurora data;
- secrets;
- Kinesis streams;
- SQS queues where required;
- pipeline artifacts.

KMS permission is an additional authorization gate.

```text
s3:GetObject allowed
+
kms:Decrypt denied
    =
recording unreadable
```

---

## 25.5 Retention

Different data has different retention requirements:

```text
OTP state:
    minutes

contact flow logs:
    operational period

call recordings:
    legal/business retention

contact analytics:
    quality-analysis period

appointment transaction:
    healthcare record policy
```

“Keep everything forever” increases:

- breach impact;
- discovery scope;
- storage cost;
- compliance burden.

---

# 26. Reliability model

## 26.1 Lex recognition failure

```text
Lex does not confidently recognize intent
    ↓
reprompt with narrower options
    ↓
offer DTMF
    ↓
human queue or Task
```

The system degrades from natural conversation to deterministic selection rather than disconnecting.

---

## 26.2 Lambda failure

```text
Connect invokes Lambda
    ↓
timeout or function error
    ↓
Error branch
    ↓
do not claim success
    ↓
retry bounded operation or create human task
```

Every Lambda block should have an intentionally designed Error path.

---

## 26.3 Database outage

```text
Aurora unavailable
    ↓
RDS Proxy cannot complete transaction
    ↓
Lambda returns BACKEND_UNAVAILABLE
    ↓
Connect apologizes
    ↓
creates follow-up Task
```

A contact-center availability target cannot make an unavailable scheduling database accept a cancellation.

---

## 26.4 Notification outage

```text
appointment transaction succeeds
    ↓
notification service fails
```

The caller can still receive a spoken success response because the authoritative cancellation committed.

The durable outbox and SQS retry notification delivery later.

---

## 26.5 Agent shortage

```text
human queue overloaded
    ↓
offer queued callback
    ↓
preserve place in queue
```

Do not force the caller to remain listening to hold music for routine work. Connect supports callbacks that remain queued until an agent becomes available. 

---

## 26.6 Service quotas

Connect quotas apply by account, Region, instance, or resource depending on the quota. Northstar must forecast:

- concurrent calls;
- phone numbers;
- Lex bot aliases;
- Lambda integrations;
- agents;
- queues;
- API transactions.

New environments may start with quotas too low for production demand, so increases and load testing must occur before cutover. 

---

## 26.7 Region failure

The baseline Connect instance is Regional.

A full Regional failure can make its telephony and flow environment unavailable even when Aurora has a separate recovery strategy.

Amazon Connect Global Resiliency can create a replica instance in another Region and use a traffic distribution group to associate phone numbers and distribute traffic between the paired instances. 

A complete cross-Region design must also replicate or redeploy:

- Lambda functions;
- Lex bots;
- DynamoDB state;
- database access;
- KMS keys;
- recording destinations;
- queues and notifications;
- quotas;
- external dependencies.

AWS’s Global Resiliency guidance specifically calls out matching quotas and aligning Lambda and Lex integrations across Regions. 

---

# 27. Global Resiliency architecture variant

```text
                     Traffic distribution group
                                │
                     Connect phone number
                                │
                ┌───────────────┴────────────────┐
                │                                │
                ▼                                ▼
       Connect primary instance         Connect replica instance
             Region A                         Region B
                │                                │
           Lex bot A                       Lex bot B
           Lambda A                        Lambda B
                │                                │
       Regional backend path             DR backend path
```

Phone and agent traffic can be shifted between instances through the traffic distribution group.

This does not automatically solve database consistency or failover.

---

# 28. Deployment and change safety

## 28.1 Flow changes are production changes

A small visual-flow edit can:

- bypass authentication;
- route calls to the wrong queue;
- expose appointment information;
- disconnect every caller;
- disable recordings;
- invoke the wrong Lambda alias.

Treat flow publication like application deployment.

---

## 28.2 Environment separation

Use:

```text
development Connect instance
test phone number
test Lex bot alias
test Lambda aliases
synthetic patient records
```

before production publication.

Do not test cancellation logic against real appointments.

---

## 28.3 Lambda aliases

The production flow points to a stable production Lambda alias rather than an uncontrolled mutable function version.

A canary deployment can move a small amount of function traffic to a new version, subject to compatibility with the Connect flow’s response contract.

---

## 28.4 Lex aliases

Use separate Lex aliases for:

```text
development
staging
production
```

The Connect flow binds to the approved alias.

Changing training utterances or slot behavior can alter call routing even without Lambda code changes.

---

## 28.5 Contract testing

Test scenarios include:

```text
single appointment
multiple appointments
already cancelled
restricted procedure
wrong OTP
expired OTP
backend timeout
Lex fallback
DTMF fallback
after-hours task creation
notification failure
Spanish-language path
caller hangs up during transaction
```

The test must verify both:

```text
spoken outcome
database outcome
```

---

# 29. Observability

## 29.1 Contact-center metrics

Monitor:

```text
contacts offered
contacts handled
contacts abandoned
contacts transferred
queue wait time
longest waiting contact
callback volume
after-hours contacts
concurrent calls
agent occupancy
agent availability
```

---

## 29.2 Bot metrics

Monitor:

```text
intent recognition rate
FallbackIntent rate
slot retry rate
authentication completion rate
DTMF fallback rate
bot-to-agent transfer rate
self-service completion rate
average turns per completion
```

A low transfer rate is not automatically good if callers are abandoning the system.

---

## 29.3 Transaction metrics

Monitor:

```text
appointment lookup latency
cancellation success
already-cancelled result
restricted-cancellation result
database timeout
incorrect-state conflict
outbox backlog
notification delivery
```

---

## 29.4 Business metrics

The most important measures are:

```text
appointments successfully cancelled without agent
slots returned to inventory before appointment time
recontact rate after automated cancellation
false-success rate
wrong-appointment incidents
no-show rate
average agent time saved
patient satisfaction
```

The goal is not to maximize “bot containment.”

The goal is to resolve appropriate work correctly.

---

## 29.5 CloudWatch

CloudWatch collects:

- Connect service metrics;
- flow logs;
- Lambda duration, errors, and throttles;
- DynamoDB metrics;
- RDS Proxy and Aurora metrics;
- SQS queue metrics;
- Kinesis metrics;
- application custom metrics.

Amazon Connect flow logging can be enabled so contact progression through flow blocks is visible in CloudWatch Logs. 

---

## 29.6 CloudTrail

CloudTrail answers:

```text
Who published the new flow?
Who associated a Lambda function?
Who changed the recording bucket?
Who modified the Lambda resource policy?
Who changed the KMS key?
Who edited agent permissions?
```

CloudTrail does not contain the call’s audio content.

---

# 30. Cost model

Major cost dimensions include:

```text
claimed phone numbers
inbound and outbound telephony
Connect contact usage
agent usage
Lex speech and text requests
Polly voice type
Lambda requests and duration
Contact Lens analytics
S3 recordings and retention
Kinesis streams
DynamoDB
Aurora and RDS Proxy
SMS and email
CloudWatch logs
cross-Region resiliency
```

No exact cost claim should be made without the Region, channel mix, call duration, language, recording policy, and agent workload.

---

## 30.1 Automation is valuable only when it resolves work

A bot that produces:

```text
high misunderstanding
long conversations
repeated authentication failure
frequent recontact
incorrect cancellations
```

may cost more than a well-routed human interaction.

Measure:

\[
\text{effective automation value}
=
\text{correctly completed contacts}
-
\text{recontacts}
-
\text{incident cost}
-
\text{customer harm}
\]

---

## 30.2 Keep simple intents simple

Clinic hours do not require:

- Lambda;
- Aurora;
- Step Functions;
- an LLM;
- an agent.

The flow can play a configured prompt.

Cancellation requires business integration.

Medical advice requires human or clinical routing.

Different intents deserve different architectures.

---

## 30.3 Recording lifecycle

Storing every recording indefinitely creates continuing S3 and governance cost.

Use lifecycle policies aligned with:

- legal retention;
- quality review;
- complaint handling;
- investigation;
- healthcare-record policy.

Do not transition recordings to deep archive before the required retrieval-time objective is understood.

---

## 30.4 Contact Lens scope

Enable richer analytics where its value exceeds the additional cost.

Possible differentiated policy:

```text
100% analytics:
    complaints
    clinical escalations
    bot failures

sampled analytics:
    routine successful cancellations
```

The exact sampling and retention policy must remain compatible with operational and legal requirements.

---

# 31. Why not a general generative-AI agent?

A general AI agent might produce a more natural conversation, but the core cancellation action is small and high consequence.

The critical sequence is:

```text
authenticate
identify exact appointment
check policy
ask explicit confirmation
perform conditional transaction
report exact outcome
```

A general model may assist with:

- interpreting unusual phrasing;
- summarizing a transferred contact;
- helping agents retrieve policy;
- producing post-contact summaries.

It should not bypass the deterministic transaction boundary.

The final tool call must still use typed, validated values:

```json
{
  "patientRef": "PATIENT-OPAQUE",
  "appointmentRef": "APT-OPAQUE",
  "operation": "CANCEL",
  "confirmed": true
}
```

Conversational flexibility and transactional correctness should be layered rather than conflated.

---

# 32. Changed-requirement variants

## Variant 1: Only a simple keypad IVR is required

The clinic supports:

```text
Press 1 to confirm.
Press 2 to cancel.
Press 3 for hours.
```

Lex may be unnecessary.

Use Connect flows with DTMF and Lambda.

This may be cheaper and more predictable, at the cost of a less natural interaction.

---

## Variant 2: Web and mobile chat are required

Use the same Connect contact-center routing with chat flows and a Lex text interface.

Reuse:

- intents;
- backend Lambda functions;
- authentication principles;
- escalation queues.

Channel-specific privacy and transcript behavior still need separate testing.

---

## Variant 3: The clinic already has a conventional contact center

Keep the existing telephony platform and use:

- Amazon Transcribe Call Analytics;
- Comprehend;
- a Contact Lens connector where applicable;
- custom Kinesis/S3 analytics.

Do not migrate telephony merely to obtain transcription.

---

## Variant 4: Appointment backend is on premises

```text
Lambda in private VPC
    ↓
Transit Gateway
    ↓
Site-to-Site VPN or Direct Connect
    ↓
on-premises scheduling API
```

The call path now depends on hybrid connectivity.

Use redundant connections and a fallback Task when the backend is unreachable.

---

## Variant 5: Cancellation is allowed but fee calculation is complex

A Step Functions Standard workflow may coordinate:

```text
policy lookup
fee calculation
payment/refund
appointment update
notification
human exception
```

The live call should not remain blocked on a long workflow.

Create a request, communicate that it is pending, and notify the patient after completion.

---

## Variant 6: Rescheduling is introduced

The flow must:

1. authenticate;
2. identify current appointment;
3. query valid replacement slots;
4. reserve one slot;
5. confirm with patient;
6. atomically release old slot and commit new slot;
7. expire abandoned reservations;
8. notify patient.

This is substantially harder than cancellation because two capacity states must change consistently.

---

## Variant 7: Appointment cancellation must be immediate across two Regions

Use a multi-Region scheduling data strategy and Connect Global Resiliency.

The contact-center replication does not itself replicate Aurora writes or resolve cross-Region booking conflicts.

---

## Variant 8: Patients cannot receive SMS

Provide an approved fallback such as:

- portal authentication;
- email to an existing verified address;
- appointment reference plus additional identity factors;
- human verification.

Do not weaken authentication to caller ID alone.

---

## Variant 9: Every cancellation requires staff approval

The automated channel should create a Connect Task rather than claiming to complete cancellation.

The benefit becomes:

```text
24/7 request capture
+
structured information
+
prioritized agent work
```

not full automation.

---

## Variant 10: Clinical emergency routing is required

Create a separately reviewed emergency flow with:

- approved prompts;
- defined external destination;
- failure handling;
- periodic test calls;
- monitoring.

Do not let an ordinary scheduling queue become the emergency path by accident.

---

# 33. Failure drills

## Failure A: Sunday callers still hear only “We are closed”

The out-of-hours branch terminates the contact before offering self-service.

Move supported automation before the disconnect path.

---

## Failure B: Lex recognizes cancellation, but the wrong appointment is cancelled

Possible causes:

```text
caller not authenticated
appointment ownership not checked
multiple appointments not disambiguated
confirmation omitted
stale appointment reference
transaction lacks patient condition
```

This is not primarily a speech-recognition problem.

---

## Failure C: Incoming phone number automatically authenticates caller

The design confuses lookup convenience with proof of identity.

Add an approved verification factor.

---

## Failure D: OTP appears in recordings and transcripts

The sensitive-input segment was not excluded from recording, or digits were stored in contact attributes or logs.

Pause recording and avoid retaining the raw value.

---

## Failure E: Connect returns an error immediately when invoking Lambda

Investigate:

```text
function associated with Connect
Lambda resource policy
connect.amazonaws.com principal
SourceArn
SourceAccount
function alias
Region
```

---

## Failure F: Lambda runs but cannot reach Aurora

Investigate:

```text
VPC subnet selection
route
Lambda-SG
RDS-Proxy-SG
Aurora-SG
DNS
RDS Proxy health
port 5432
```

---

## Failure G: Database returns invalid credentials

The network path reached the database.

Investigate:

```text
Secrets Manager value
rotation
database user
IAM database authentication
RDS Proxy configuration
```

---

## Failure H: Lambda works in tests but times out in the Connect flow

The operation exceeds Connect’s maximum synchronous Lambda wait or has poor tail latency.

Optimize the synchronous path or convert the operation to an asynchronous Task workflow.

---

## Failure I: Caller hears “cancelled,” but database still says booked

The flow treated Lex fulfillment or Lambda invocation as success without validating the database result.

Only a committed transactional response may trigger the success prompt.

---

## Failure J: Appointment is cancelled, but no confirmation is sent

The cancellation succeeded and the second write failed.

Use a transactional outbox and retryable notification processing.

---

## Failure K: Confirmation is sent twice

The event or SQS message was delivered more than once.

Use an idempotency key such as:

```text
appointment ID
+
cancellation version
+
notification channel
```

---

## Failure L: Restricted procedure is automatically cancelled

The bot inferred policy or the query failed to enforce `self_service_cancellable`.

Make policy data-driven and fail closed.

---

## Failure M: Agent is logged in but receives no scheduling calls

Investigate:

```text
routing profile
queue membership
channel enabled
agent status
proficiency
queue hours
```

The security profile may be correct.

---

## Failure N: Agent receives calls but cannot review recordings

Investigate the Connect security profile’s recording and analytics permissions.

Routing-profile changes will not grant recording access.

---

## Failure O: Recordings are absent from S3

Investigate:

```text
Set recording and analytics behavior block
published flow version
S3 configuration
bucket policy
KMS policy
recording segment configuration
```

---

## Failure P: Redacted transcript still contains health information

This is possible because redaction is probabilistic and is not HIPAA de-identification.

Continue treating the output as protected data.

---

## Failure Q: Contact records are not arriving in Kinesis

Investigate:

```text
Connect data streaming enabled
correct Kinesis stream
same account/Region requirements
stream permissions
KMS
stream capacity
```

---

## Failure R: Bot fallback rate suddenly increases

Possible causes:

```text
new caller wording
language mismatch
Lex alias changed
audio quality
prompt changed
slot configuration
backend validation failure appearing as dialog failure
```

Use bot analytics and flow logs before retraining blindly.

---

## Failure S: Queue grows after a holiday

The hours override or agent schedule may be wrong, or callers were routed into a queue with no eligible agents.

Check:

```text
hours of operation
routing profile
agent status
queue priority
holiday override
```

---

## Failure T: Connect is healthy, but callers cannot cancel

The scheduling backend is unavailable.

Contact-center availability and transaction-system availability are separate.

---

## Failure U: Connect Region fails and phone number does not fail over

Global Resiliency, replica instance, or traffic distribution group was not configured and tested.

A backup Aurora database alone does not reroute telephony.

---

## Failure V: Agent browser connects but audio fails

HTTPS access may work while the real-time media path is blocked.

Investigate the corporate firewall, domain allowlist, DNS, media protocols, headset, and agent network quality.

---

# 34. SAP-C02 decision snippets

## Amazon Connect versus API Gateway

**Requirement:** Accept ordinary phone calls, route to agents, queues, and IVR.

```text
Amazon Connect
```

**Requirement:** Expose a normal HTTP API.

```text
API Gateway
```

API Gateway is not a PSTN contact center.

---

## Lex versus Polly

**Understand what the caller means:**

```text
Amazon Lex
```

**Speak text to the caller:**

```text
Amazon Polly
```

---

## Transcribe versus Polly

```text
Speech → text
    → Transcribe

Text → speech
    → Polly
```

---

## Lex versus Transcribe

```text
Intent and slots during dialog
    → Lex

General transcript of spoken audio
    → Transcribe
```

---

## Comprehend versus Transcribe

```text
Generate text from audio
    → Transcribe

Analyze existing text
    → Comprehend
```

---

## Contact Lens versus custom Transcribe pipeline

**Connect-native transcript, sentiment, categories, supervisor experience:**

```text
Contact Lens conversational analytics
```

**Custom or non-Connect audio processing:**

```text
Amazon Transcribe Call Analytics
```

---

## Flow versus queue

```text
Decide contact path
    → flow

Hold contact for agent
    → queue
```

---

## Routing profile versus security profile

```text
Which contacts reach the agent
    → routing profile

What the agent may do
    → security profile
```

---

## Connect Task versus SQS

```text
Human follow-up work
    → Connect Task

Machine background work
    → SQS
```

---

## Connect Lambda resource policy versus execution role

```text
May Connect invoke Lambda?
    → Lambda resource-based policy

What may Lambda do after starting?
    → Lambda execution role
```

---

## Caller ID versus authentication

```text
Caller ID
    → lookup hint

OTP or other approved factor
    → authentication evidence
```

---

## Amazon Connect hours of operation

**Requirement:** Provide human agents only at certain times while preserving 24/7 automation.

```text
Check hours in flow
    ├── in hours → queue possible
    └── out of hours → self-service or Task
```

---

## Recording versus contact record

```text
Audio conversation
    → recording

Structured routing/lifecycle metadata
    → contact record
```

---

## S3 versus Kinesis

```text
Durable recording and transcript objects
    → S3

Near-real-time contact and agent event stream
    → Kinesis Data Streams
```

---

## RDS Proxy

**Requirement:** Bursty Lambda functions make many short relational database connections.

```text
RDS Proxy
```

---

## Single-Region Connect versus Global Resiliency

```text
Normal Regional contact center
    → one Connect instance

Cross-Region instance and phone traffic failover
    → Connect Global Resiliency
```

---

# 35. Retrieval practice

## 1

Why is appointment cancellation a good automation target?

## 2

What is the distinction between the conversational layer and business layer?

## 3

What does an Amazon Connect flow do?

## 4

What is a Connect queue?

## 5

What does a routing profile control?

## 6

What does a security profile control?

## 7

Why should out-of-hours routing not simply disconnect callers?

## 8

What is an Amazon Lex intent?

## 9

What is a Lex slot?

## 10

Why should Lex not directly decide whether an appointment is cancellable?

## 11

What does Polly do?

## 12

When is a prerecorded prompt preferable to Polly?

## 13

Why is caller ID insufficient authentication?

## 14

Why is the OTP sent to a previously registered channel?

## 15

Why should sensitive input use DTMF with recording paused?

## 16

What is the difference between patient authentication and appointment authorization?

## 17

Why is Voice ID not selected?

## 18

Why does the baseline use Aurora rather than treating Connect as the appointment database?

## 19

Why is RDS Proxy useful?

## 20

What makes cancellation idempotent?

## 21

Why is the Connect contact ID not the complete idempotency solution?

## 22

What is the maximum Lambda wait in an ordinary Connect flow block?

## 23

What should happen if the scheduling backend takes too long?

## 24

What is the dual-write problem after cancellation?

## 25

How does an outbox help?

## 26

What policy lets Amazon Connect invoke a Lambda function?

## 27

What policy lets that Lambda read DynamoDB or a secret?

## 28

Why does Connect-to-Lambda invocation not require VPC peering?

## 29

What network path does a VPC-attached Lambda use to reach Aurora?

## 30

What is the difference between a Connect Task and SQS?

## 31

When is a queued callback useful?

## 32

What does Contact Lens provide?

## 33

Why should a redacted transcript still be treated as protected information?

## 34

What is the difference between Lex and Transcribe?

## 35

What is the difference between Transcribe and Comprehend?

## 36

What do Connect contact records contain?

## 37

Why stream contact records to Kinesis?

## 38

Does Kinesis store the call recording?

## 39

What does a HIPAA-eligible service guarantee?

## 40

Why should patient data be minimized in contact attributes?

## 41

What happens when Lex confidence is poor?

## 42

Why must every Lambda block have an Error branch?

## 43

Why can a notification fail without invalidating the cancellation?

## 44

What must be replicated for cross-Region contact-center recovery?

## 45

What are the most important business metrics for the bot?

## 46

Why is a low transfer rate not sufficient evidence of success?

## 47

Which service answers who changed the Connect flow?

## 48

Which service shows Lambda timeout and Connect operational metrics?

## 49

Why might a general generative agent be unnecessary here?

## 50

What is the largest failure boundary handled by the baseline?

---

# 36. Answer key

## 1

It is frequent, deterministic, requires little human judgment for ordinary appointments, and can return valuable appointment capacity immediately.

## 2

The conversational layer recognizes what the caller wants. The business layer authenticates, authorizes, validates policy, and commits the transaction.

## 3

It orchestrates prompts, input, integrations, branching, recording, queues, tasks, and transfer behavior for a contact.

## 4

A waiting area for contacts that require an agent.

## 5

Which queues and channels can route work to an agent, including their priority and concurrency.

## 6

What the Connect user may view and do inside the contact-center environment.

## 7

Administrative automation can remain available even when human agents are not working.

## 8

The goal the caller is trying to accomplish.

## 9

A structured value required to complete the intent.

## 10

Cancellability depends on authenticated ownership, appointment state, and clinic policy stored in authoritative systems.

## 11

It converts text into spoken audio.

## 12

For legally or clinically reviewed fixed wording, highly controlled pronunciation, or rarely changed content.

## 13

Numbers can be shared, reassigned, or otherwise fail to prove the identity of the caller.

## 14

So the caller cannot redirect the authentication challenge to a newly supplied channel they control.

## 15

It reduces recognition ambiguity and limits sensitive values from entering recordings, transcripts, or logs.

## 16

Authentication proves the caller’s identity. Appointment authorization proves that the appointment belongs to the verified patient and allows the requested transition.

## 17

Amazon Connect Voice ID ended support on May 20, 2026.

## 18

Connect manages contact interactions. The relational scheduling system remains the authoritative store for providers, slots, patients, and appointment state.

## 19

It pools and reuses connections so bursty Lambda concurrency does not create excessive database connections.

## 20

A conditional state transition treats repeated cancellation of an already cancelled appointment as the same completed outcome rather than a new destructive operation.

## 21

A later telephone call gets another contact ID. Idempotency must also be expressed in appointment state.

## 22

Eight seconds.

## 23

Follow the Error branch, avoid claiming success, and create a human follow-up task or other honest fallback.

## 24

The database update may succeed while event or notification publication fails, or vice versa.

## 25

It records the cancellation and pending event in one database transaction, allowing publication to retry afterward.

## 26

A Lambda resource-based policy granting `lambda:InvokeFunction` to the Connect service principal, preferably restricted by source account and Connect instance ARN.

## 27

The Lambda execution role, together with relevant resource and KMS policies.

## 28

It is an AWS managed service-to-service API call rather than a private-IP connection between customer VPCs.

## 29

Through its VPC network interface, subnet route, Lambda security group, RDS Proxy security group, proxy endpoint, and Aurora security group.

## 30

A Connect Task is human work routed through the contact center. SQS is a machine-processing queue.

## 31

When agents are available or will be available soon and the caller prefers not to remain on hold.

## 32

Integrated transcripts, sentiment, categories, conversation characteristics, redaction, summaries, and real-time or post-contact analytics.

## 33

Machine-learning redaction may miss information and is not medical de-identification.

## 34

Lex interprets a conversation into intents and slots. Transcribe converts general speech audio into text.

## 35

Transcribe produces text from audio. Comprehend analyzes already existing text.

## 36

Structured contact lifecycle, routing, queue, agent, timing, and relationship data.

## 37

To support near-real-time custom analytics and downstream consumers outside native Connect reporting.

## 38

No. Recordings are stored as S3 objects; Kinesis carries selected structured streams or analytics segments.

## 39

That AWS permits the properly contracted and configured service to process ePHI under the shared-responsibility model. It does not certify the customer’s architecture as compliant.

## 40

To reduce unauthorized disclosure, logging exposure, storage scope, and breach impact.

## 41

Reprompt narrowly, offer DTMF, and eventually route to a human queue or Task.

## 42

Backend, permission, timeout, or response errors are inevitable, and the caller needs a defined truthful outcome.

## 43

The authoritative scheduling transaction already committed. Notification is a retryable downstream side effect.

## 44

Connect instance configuration, phone traffic setup, Lex bots, Lambda functions, state, database access, queues, keys, quotas, and supporting integrations.

## 45

Correct automated completion, wrong-appointment incidents, false success, recontact, slot recovery, no-show reduction, transfer rate, and patient satisfaction.

## 46

Callers may simply abandon, become trapped, or call again later.

## 47

CloudTrail.

## 48

CloudWatch.

## 49

The supported action is narrow, structured, and high consequence. Lex plus deterministic backend validation offers a clearer and safer transaction boundary.

## 50

Component and Availability Zone failures within the selected Region. Full Regional telephony recovery requires Global Resiliency and replicated backend dependencies.

---

# 37. What to memorize now

```text
Amazon Connect
    → managed contact center
    → voice, chat, agents, flows, queues
```

```text
Flow
    → what happens next

Queue
    → work waiting for an agent

Routing profile
    → which queues reach an agent

Security profile
    → what the agent may do
```

```text
Amazon Lex
    → intent
    → slots
    → dialog
    → confirmation

Amazon Polly
    → text to speech

Amazon Transcribe
    → speech to text

Amazon Comprehend
    → analyze text
```

```text
Contact Lens
    → integrated Connect conversation analytics
```

```text
Caller ID
    → lookup hint

OTP / approved factor
    → authentication
```

```text
Authentication
    → who is calling?

Authorization
    → may this patient cancel this appointment?

Transaction
    → did the authoritative state change?
```

```text
Connect invokes Lambda
    → Lambda resource policy

Lambda accesses backend
    → execution role
```

```text
Connect Lambda timeout
    → maximum 8 seconds
    → keep synchronous work bounded
```

```text
Connect Task
    → human follow-up

SQS
    → machine work queue
```

```text
Recording
    → audio in S3

Contact record
    → structured lifecycle metadata

Kinesis
    → real-time event stream
```

```text
RDS Proxy
    → pool Lambda database connections
```

```text
Hours of operation
    → human availability

Self-service flow
    → can remain available 24/7
```

```text
Contact Lens redaction
    ≠
guaranteed removal
    ≠
HIPAA de-identification
```

```text
HIPAA eligible
    ≠
automatically compliant
```

```text
Successful conversation
    ≠
successful transaction

Only committed backend state
    → success prompt
```

---

# 38. What can remain recognition-level

You do not yet need perfect recollection of:

- every Connect flow block;
- exact Lex event and response JSON;
- SSML syntax;
- Contact Lens output schemas;
- Kinesis contact-record field names;
- Global Resiliency API commands;
- agent-workspace embedding;
- Customer Profiles identity-resolution rules;
- every Connect service quota;
- RDS Proxy pool settings;
- SAML assertion syntax;
- call-recording S3 key structure;
- Amazon Connect Cases;
- outbound campaign dialer configuration;
- every supported analytics language.

The durable model is:

```text
Patient
    ↓ telephone
Amazon Connect
    ↓ flow
Lex understands intent
    ↓
authentication
    ↓
Lambda business integration
    ↓
private scheduling database
    ↓
conditional cancellation transaction
    ↓
Polly confirmation
    ↓
event, notification, and recovered appointment slot
```

At every interaction, continue applying Lesson 0:

```text
Authorization:
    Who is the principal?
    Is this an AWS resource policy, execution role,
    Connect security profile, or database permission?
    Does the verified patient own the appointment?

Networking:
    Is this PSTN telephony, an AWS service API call,
    an agent browser/media path, or a private database connection?
    Which endpoint, route, protocol, port,
    security group, and return path are involved?
```