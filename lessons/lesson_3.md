# Lesson 3 — A Serverless Mobile and Web Backend

## Identity, GraphQL, offline synchronization, event-driven processing, and DynamoDB

## Source note

This lesson is grounded in the uploaded material’s treatment of:

- Amazon Cognito user pools and identity pools;
- AWS AppSync for GraphQL, real-time updates, and offline synchronization;
- API Gateway as an alternative API layer;
- Lambda as event-driven stateless compute;
- Step Functions for durable workflows and error handling;
- DynamoDB access-pattern-driven design;
- Amplify for frontend development and hosting.

The guide presents the useful first approximation:

```text
User pool     → authentication
Identity pool → authorization and AWS credentials
```

It also presents AppSync as the GraphQL-oriented API service and API Gateway as the REST/WebSocket-oriented alternative.  

Two current-service clarifications matter:

1. A user pool does more than merely verify identity. It issues tokens whose claims and scopes can also participate in application-level authorization. An identity pool has the narrower role of exchanging an authenticated or guest identity for temporary AWS credentials associated with IAM roles.
2. The guide’s suggestion that API token validation generally requires a Lambda authorizer is no longer the normal default. API Gateway REST APIs have native Cognito user-pool authorizers, while HTTP APIs support native JWT authorizers. Lambda authorizers remain useful when custom logic is actually required.

---

# 1. The project

## 1.1 Business brief

Northstar is launching **Northstar Assist**, a mobile and web application through which customers submit warranty and service claims.

A customer can:

- create an account or sign in through a social identity provider;
- register a product;
- open a service case;
- attach photographs, videos, receipts, and documents;
- continue drafting a case with intermittent connectivity;
- receive real-time status updates;
- exchange messages with support staff;
- receive email and mobile notifications;
- see the complete history of their cases.

The support team can:

- view queues of cases by status and priority;
- request additional evidence;
- approve or reject straightforward cases;
- escalate ambiguous cases to a human reviewer;
- observe attachment-processing results;
- see an auditable history of state changes.

Some cases complete within seconds. Others wait several days for:

- external validation;
- additional customer documents;
- human approval;
- supplier responses.

Traffic is highly variable:

```text
Normal day:
    modest request volume

Large product recall:
    very large spike in sign-ins, case creation, uploads,
    notifications, and background processing
```

The team does not want to manage:

- EC2 instances;
- operating-system patching;
- load balancers;
- container clusters;
- persistent application servers.

---

## 1.2 Why this is a good serverless project

This application has several characteristics that fit purpose-built serverless services:

```text
bursty interactive traffic
event-driven background processing
large direct file uploads
known key-value access patterns
real-time client updates
long waits between workflow steps
no requirement for a persistent application process
```

The baseline design therefore uses:

```text
Amplify Hosting
Cognito
AppSync
Lambda
DynamoDB
S3
EventBridge
SQS
Step Functions
SES
AWS End User Messaging Push
```

This does not mean that every line of business logic must run in Lambda or that every serverless service must be used. Each service is selected for a specific responsibility.

---

# 2. Constraint ledger

| Dimension | Requirement |
| --- | --- |
| Clients | Native mobile application and browser application |
| Authentication | Email/password, social identity, optional enterprise federation |
| Connectivity | Mobile clients may be temporarily offline |
| Updates | Customers should see case changes in real time |
| Data | Cases, events, comments, attachment metadata |
| Files | Large photos and documents should bypass application compute |
| Workflow | Seconds to days; includes human review |
| Scale | Highly bursty and unpredictable |
| Availability | Managed Multi-AZ services within one Region |
| Security | Each customer sees only their own cases and uploads |
| Operations | No server or cluster management |
| Consistency | Case creation must not duplicate; status transitions must be controlled |
| Integration | External partners use ordinary HTTP webhooks |
| Cost | Prefer consumption-based pricing during uncertain adoption |
| Recovery | Data backups and replayable asynchronous work |
| Regional DR | Not part of the initial requirement |

---

# 3. Baseline architecture

```text
                               Customers
                    ┌─────────────┴─────────────┐
                    │                           │
               Mobile app                  Web browser
                    │                           │
                    │                     Amplify Hosting
                    │                     CloudFront edge
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                         Cognito user pool
                    sign-up / sign-in / tokens
                                  │
                    ┌─────────────┴───────────────┐
                    │                             │
                    ▼                             ▼
              AWS AppSync                  Cognito identity pool
              GraphQL API                  temporary AWS credentials
                    │                             │
          ┌─────────┼──────────┐                  │
          │         │          │                  ▼
          ▼         ▼          ▼             S3 uploads bucket
      DynamoDB    Lambda    Subscriptions          │
       direct     business    WebSocket            │ Object Created
      resolvers    logic         │                 ▼
          │           │          │           EventBridge rule
          │           │          │                 │
          │           ▼          │                 ▼
          │     DynamoDB transaction             SQS
          │           │                            │
          │           ▼                            ▼
          │    DynamoDB Streams              Lambda processor
          │           │                       resize / scan /
          │           ▼                       extract metadata
          │   workflow starter                      │
          │           │                             ▼
          │           ▼                         DynamoDB
          │    Step Functions Standard               │
          │           │                              │
          │     ┌─────┼────────┐                     │
          │     │     │        │                     │
          │     ▼     ▼        ▼                     │
          │  validation   human review        EventBridge events
          │  external API task token                 │
          │                                           ├──► SQS notification queue
          │                                           │          │
          └───────────────────────────────────────────┘          ▼
                                                          notification Lambda
                                                               │     │
                                                               ▼     ▼
                                                              SES   End User
                                                                    Messaging Push


 External partner
       │ HTTPS webhook
       ▼
 API Gateway HTTP API
       │ JWT / signed partner request
       ▼
 Lambda adapter
       ▼
 EventBridge
```

## Architecture in one sentence

> Customers authenticate with Cognito, use an AppSync GraphQL API backed primarily by DynamoDB, upload files directly to S3 with narrowly scoped temporary credentials, and rely on EventBridge, SQS, Lambda, and Step Functions for asynchronous and long-running business processes.

---

# 4. Functional decisions at a glance

| Function | Baseline choice | Reason |
| --- | --- | --- |
| Web frontend | Amplify Hosting | Managed build, deployment, and CDN hosting |
| Customer authentication | Cognito user pool | Application user directory and token issuer |
| Direct AWS access | Cognito identity pool | Temporary scoped credentials for S3 uploads |
| Main client API | AppSync | GraphQL, subscriptions, offline synchronization |
| Partner webhook API | API Gateway HTTP API | Simple REST-style integration |
| Short business logic | Lambda | Event-driven execution without servers |
| Operational data | DynamoDB | Known access patterns and bursty key-value traffic |
| File storage | S3 | Durable direct uploads and event generation |
| Event routing | EventBridge | Route domain and service events |
| Work buffering | SQS | Durable queue, backpressure, retry, DLQ |
| Durable process | Step Functions Standard | Long-running, auditable workflow and human callback |
| Email | Amazon SES | Transactional email |
| Mobile push | AWS End User Messaging Push | APNs/FCM delivery |
| Metrics and logs | CloudWatch | Operational visibility |
| Tracing | X-Ray | Cross-service latency and error analysis |
| Infrastructure | SAM, CDK, or CloudFormation | Reproducible serverless infrastructure |

The uploaded guide explicitly identifies the common mobile combination of Cognito, API services, Lambda, and DynamoDB, while emphasizing that AppSync is preferable when GraphQL, aggregation, subscriptions, and offline synchronization are central.  

---

# 5. What “serverless” actually means

Serverless means that AWS operates much of the underlying:

- server provisioning;
- operating-system maintenance;
- capacity fleet;
- high-availability infrastructure;
- service scaling;
- basic runtime control plane.

It does **not** mean:

```text
no architecture
no capacity limits
no IAM
no networking
no deployment
no monitoring
no data modeling
no retry semantics
no cost risk
```

Northstar still owns:

- authorization rules;
- GraphQL schema design;
- DynamoDB keys and indexes;
- Lambda idempotency;
- concurrency limits;
- queue behavior;
- workflow semantics;
- error classification;
- observability;
- data retention;
- disaster recovery;
- cost governance.

A serverless application can fail under load even when every underlying service remains healthy. For example:

```text
Lambda scales successfully
    ↓
DynamoDB key becomes hot
    ↓
writes throttle
```

or:

```text
Lambda scales successfully
    ↓
third-party API accepts only 100 requests/second
    ↓
partner blocks the application
```

Managed scaling does not eliminate downstream limits.

---

# 6. Frontend architecture

## 6.1 Web application

Northstar stores its browser application in a source repository connected to Amplify Hosting.

A typical release path is:

```text
Git commit
    ↓
build
    ↓
automated tests
    ↓
versioned frontend artifact
    ↓
Amplify Hosting
    ↓
CloudFront delivery
```

The uploaded cheat sheet describes Amplify as a collection of frontend development, authentication, storage, API, deployment, and hosting tools; Amplify Hosting distributes the application through AWS’s content-delivery infrastructure.

Amplify is not required to use Cognito or AppSync. It is a frontend productivity and hosting choice around those services.

---

## 6.2 Mobile application

The native mobile client uses an AWS client library to:

- authenticate with Cognito;
- call AppSync;
- manage subscription connections;
- synchronize local data;
- obtain identity-pool credentials;
- upload files to S3.

The architecture remains valid if the team uses ordinary HTTP, GraphQL, OIDC, and AWS SDK clients instead. Amplify libraries reduce integration work; they are not an authorization boundary.

---

## 6.3 Device testing

Mobile behavior varies by:

- operating-system version;
- screen size;
- hardware;
- permissions;
- connectivity;
- background-execution rules;
- vendor-specific push behavior.

AWS Device Farm can run tests against real hosted Android and iOS devices and supports browser testing as well.  

Device Farm tests the client application. It does not prove that backend IAM, data isolation, or business workflows are correct.

---

# 7. Customer identity architecture

## 7.1 Three identities must remain separate

A customer may have three related but different identities:

```text
Application identity
    Cognito user pool user

AWS federated identity
    Cognito identity-pool identity

Business identity
    Northstar customer ID in application data
```

Example:

```text
User-pool sub:
    6384f5d2-...

Identity-pool identity ID:
    us-east-1:9f8a...

Business customer ID:
    CUSTOMER-18472
```

Do not assume these identifiers are interchangeable.

---

## 7.2 Cognito user pool

The user pool is the application’s user directory and identity provider.

It handles capabilities such as:

- sign-up;
- sign-in;
- account confirmation;
- password recovery;
- multi-factor authentication;
- social federation;
- SAML or OIDC federation;
- token issuance.

After successful authentication, the application receives signed tokens.

A useful conceptual division is:

| Token | Main purpose |
| --- | --- |
| ID token | Claims describing the authenticated user |
| Access token | Scopes and authorization information for protected APIs |
| Refresh token | Obtain replacement ID and access tokens |

The client does not send the user’s password to every backend API. It sends a signed token that the API validates.

---

## 7.3 User-pool token is not an IAM credential

A user-pool token is generally a JWT used by application APIs.

It is not:

```text
AWS access key
AWS secret key
AWS session token
IAM role session
```

For the main AppSync API:

```text
Customer
    ↓ authenticates
Cognito user pool
    ↓ receives JWT
Mobile app
    ↓ Authorization header
AppSync
    ↓ validates issuer, signature, expiry and claims
GraphQL resolver
```

AppSync supports Cognito user pools as a native authorization mode.

---

## 7.4 Authentication is not business authorization

A valid token proves something like:

> This request comes from the authenticated user represented by subject `U42`.

It does not prove:

> `U42` owns case `C123`.

The resolver must still enforce:

```text
case.customer_id == token.subject
```

or an equivalent ownership policy.

A common security failure is:

```text
API verifies token
    ↓
caller changes case ID in request
    ↓
resolver reads another customer's case
```

Token validation solved authentication. It did not solve object-level authorization.

---

## 7.5 Support staff identity

Support staff use the application, but they are not AWS administrators.

A separate staff authentication path can federate the company’s corporate identity provider into an application user pool or another OIDC-compatible identity system.

Their tokens can contain application roles such as:

```text
case-reader
case-reviewer
case-supervisor
```

AWS engineers and operators use IAM Identity Center for AWS-console and AWS-API access. Application roles and cloud-administration roles should not be conflated.

---

# 8. Cognito identity pools

## 8.1 Why an identity pool exists

Northstar wants a signed-in mobile user to upload several large files directly to S3 without sending the bytes through:

```text
AppSync
Lambda
API Gateway
application server
```

The flow is:

```text
User signs in to user pool
    ↓
user-pool token
    ↓
Cognito identity pool
    ↓ selects authenticated IAM role
AWS STS temporary credentials
    ↓
mobile client calls S3 directly
```

Identity pools issue temporary, limited-privilege AWS credentials to authenticated or guest identities. User pools and identity pools can be used separately or together.

---

## 8.2 Identity-pool role trust policy

The role’s trust policy answers:

> May Cognito Identity assume this role for a valid identity from this identity pool?

Conceptually:

```json
{
  "Effect": "Allow",
  "Principal": {
    "Federated": "cognito-identity.amazonaws.com"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "cognito-identity.amazonaws.com:aud": "IDENTITY_POOL_ID"
    },
    "ForAnyValue:StringLike": {
      "cognito-identity.amazonaws.com:amr": "authenticated"
    }
  }
}
```

The `aud` condition prevents the role from being used through an unrelated identity pool.

The `amr` condition restricts the role to authenticated identities rather than guest identities.

---

## 8.3 Identity-pool role permission policy

The permission policy answers:

> What may the resulting temporary session do?

Conceptually:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:AbortMultipartUpload"
  ],
  "Resource": "arn:aws:s3:::northstar-assist-uploads/private/${cognito-identity.amazonaws.com:sub}/*"
}
```

This confines each identity to its own prefix.

The `cognito-identity.amazonaws.com:sub` value is the identity-pool identity ID, not the original user-pool `sub`.

### Important

IAM prefix isolation is only useful when the application records which identity ID corresponds to which business customer and case.

The object key should not be freely chosen as:

```text
private/some-other-user/case-123/file.jpg
```

The policy and upload workflow must derive or constrain the prefix.

---

## 8.4 No guest credentials in the baseline

Identity pools can issue credentials to unauthenticated users.

Northstar disables that behavior because:

- every upload belongs to a known customer;
- anonymous upload is not a business requirement;
- guest credentials increase abuse and cost risk;
- uploaded content may contain sensitive information.

Do not enable a feature merely because the service supports it.

---

## 8.5 Identity pool versus pre-signed URL

Both can support direct uploads.

### Identity pool

```text
User pool token
    ↓
identity pool
    ↓
temporary AWS credentials
    ↓
multiple AWS SDK operations
```

Best when:

- the client uploads many files;
- retry and multipart upload are common;
- the client legitimately needs a small set of AWS API permissions;
- per-identity IAM scoping is desirable.

### S3 pre-signed URL

```text
Client requests upload permission
    ↓
backend returns signed URL
    ↓
client uploads directly to S3
```

Best when:

- the client needs one narrowly defined operation;
- AWS credentials should never be exposed to the client;
- the backend wants exact control of bucket, key, content type, and expiration;
- uploads are occasional.

The identity pool is selected here to teach and use its AWS-credential-brokering function. A pre-signed upload may be the simpler real-world design for a smaller upload surface.

---

# 9. Main API: AWS AppSync

## 9.1 Why AppSync wins here

The client needs:

- one data API for mobile and web;
- precisely selected fields;
- real-time case updates;
- offline synchronization;
- multiple backend data sources;
- user-pool authorization.

AppSync exposes a managed GraphQL endpoint and can connect GraphQL fields to DynamoDB, Lambda, HTTP services, and other supported data sources. It also manages real-time subscriptions.  

---

## 9.2 GraphQL operations

### Query

Reads data:

```graphql
query GetCase {
  getCase(id: "C123") {
    id
    status
    title
    updatedAt
  }
}
```

The client asks only for the required fields.

### Mutation

Changes data:

```graphql
mutation CreateCase {
  createCase(
    clientRequestId: "mobile-uuid-42"
    productId: "P100"
    description: "Device does not turn on"
  ) {
    id
    status
  }
}
```

### Subscription

Receives pushed updates:

```graphql
subscription WatchCase {
  onCaseUpdated(caseId: "C123") {
    id
    status
    updatedAt
  }
}
```

AppSync establishes and manages the secure WebSocket connection used for GraphQL subscriptions.

---

## 9.3 GraphQL is not automatically fewer backend operations

A client may submit one GraphQL request that resolves many fields:

```text
case
customer
attachments
events
support agent
product
```

The request may still produce:

- several DynamoDB operations;
- Lambda invocations;
- downstream HTTP calls;
- an N+1 query pattern;
- high response latency.

GraphQL gives the client a flexible query model. It does not guarantee efficient resolver execution.

---

## 9.4 Resolvers

A resolver connects a GraphQL field to a data source.

```text
GraphQL request
    ↓
resolver
    ↓
DynamoDB / Lambda / HTTP / other data source
    ↓
resolver shapes result
    ↓
GraphQL response
```

AppSync primarily supports JavaScript resolvers in its managed resolver runtime, while Lambda remains available for arbitrary code.

---

## 9.5 Direct resolver versus Lambda resolver

### Direct DynamoDB resolver

Use for:

- `GetItem`;
- `Query`;
- simple conditional update;
- straightforward field transformation;
- basic authorization derived from identity claims.

Advantages:

```text
fewer moving parts
lower latency
no Lambda cold start
no Lambda invocation cost
smaller IAM surface
```

### Lambda resolver

Use for:

- several business rules;
- third-party calls;
- complex validation;
- a transaction across several DynamoDB items;
- custom cryptography;
- business logic reused outside AppSync.

### Design rule

Do not use Lambda as ceremonial glue when a direct resolver expresses the operation safely.

Do not force complex domain behavior into an unreadable resolver merely to avoid Lambda.

---

# 10. AppSync versus API Gateway

The uploaded guide correctly emphasizes that the choice is not “which API service is better?” It is “which API interaction model and feature set fit the requirement?”

| Requirement | Strong candidate |
| --- | --- |
| GraphQL schema | AppSync |
| Client-selected fields | AppSync |
| Managed GraphQL subscriptions | AppSync |
| Offline synchronization | AppSync |
| Aggregate several data sources behind GraphQL | AppSync |
| Simple REST-style webhook | API Gateway HTTP API |
| API keys and usage plans | API Gateway REST API |
| Per-client throttling | API Gateway REST API |
| Request validation | API Gateway REST API |
| Private API endpoint | API Gateway REST API |
| Custom bidirectional protocol | API Gateway WebSocket API |
| Custom authorization logic | Lambda authorizer on supported API type |

AWS describes HTTP APIs as a lower-feature, lower-price API Gateway option; REST APIs should be selected when features such as API keys, per-client throttling, request validation, WAF integration, or private endpoints are required.

---

## 10.1 Partner webhook

A repair partner sends:

```http
POST /partner/case-status
```

The partner does not need:

- GraphQL;
- offline synchronization;
- subscriptions;
- the mobile schema.

Northstar therefore uses:

```text
API Gateway HTTP API
    ↓
JWT or request-signature validation
    ↓
Lambda adapter
    ↓
normalized CasePartnerStatusChanged event
    ↓
EventBridge
```

This prevents the internal GraphQL schema from becoming the integration contract for every external partner.

---

## 10.2 Native API authorizers

For API Gateway REST APIs, a native `COGNITO_USER_POOLS` authorizer can validate Cognito tokens and enforce scopes.

For HTTP APIs, a native JWT authorizer can validate tokens from Cognito or another compliant issuer.

A Lambda authorizer is appropriate when authorization depends on custom data or logic not expressible through the native mechanisms.

---

# 11. Offline synchronization

## 11.1 The offline problem

A customer begins a claim in an area with poor mobile reception.

The client may:

1. create a draft locally;
2. add notes and attachment metadata;
3. close the application;
4. reconnect later;
5. synchronize with the cloud;
6. receive changes made by support staff.

This is more than local caching. It requires:

- durable client-side state;
- synchronization checkpoints;
- mutation retries;
- duplicate prevention;
- conflict detection;
- conflict resolution;
- real-time updates after reconnecting.

---

## 11.2 Base sync and delta sync

Conceptually:

```text
First synchronization:
    download current relevant dataset

Later synchronization:
    download only changes after previous sync point
```

AppSync versioned DynamoDB data sources can maintain delta information so a client can retrieve changes since its last synchronization instead of downloading everything again.

The uploaded guide describes this client experience through Amplify DataStore. The durable concept to remember is:

```text
local data store
+
cloud source of truth
+
base synchronization
+
delta synchronization
+
conflict handling
```

---

## 11.3 Offline writes require stable client identities

Suppose a client submits `createCase`, times out, and retries.

Without an idempotency key:

```text
first request succeeds
response is lost
client retries
second request creates another case
```

The mobile client supplies a stable:

```text
clientRequestId
```

for the logical operation.

The backend records:

```text
customer ID
operation type
clientRequestId
resulting case ID
```

A retry returns the original result rather than creating another case.

---

## 11.4 Version-based conflict detection

Suppose both the customer and a support agent update a case based on version 7.

```text
Customer writes:
    version 7 → 8

Agent writes:
    expected version 7
```

The second update should not silently overwrite the first.

A conditional update can require:

```text
stored version == expected version
```

If the condition fails:

- reject and ask the client to refresh;
- automatically merge nonconflicting fields;
- apply a domain-specific rule;
- route the conflict for review.

DynamoDB conditional writes support optimistic concurrency control.

### Warning

“Last writer wins” is a policy, not a neutral technical outcome.

It may be acceptable for:

```text
last-opened timestamp
draft display preference
```

It may be unacceptable for:

```text
claim approval
payment status
legal acceptance
```

---

# 12. DynamoDB design

## 12.1 Start with access patterns

The uploaded cheat sheet contrasts relational modeling with DynamoDB’s access-pattern-first design. DynamoDB structures should be chosen after identifying the most important queries, data size, data shape, and traffic velocity.

Northstar first writes its required access patterns:

1. Get one case and its related events.
2. List cases for one customer, newest first.
3. List cases currently awaiting review.
4. Append an event to a case.
5. Add attachment metadata.
6. Update status only when the expected version matches.
7. Detect a retried `createCase` request.
8. Expire old idempotency records.
9. Retrieve cases updated after the last offline sync point.

Only then does it choose keys and indexes.

---

## 12.2 Table shape

A simplified single-table model:

```text
Table: NorthstarAssist
Primary key: PK + SK
```

### Case item

```text
PK       = CASE#C123
SK       = CASE

customer_id = U42
status      = NEEDS_REVIEW
version     = 8
created_at  = 2026-08-24T12:00:00Z
updated_at  = 2026-08-24T14:30:00Z

GSI1PK = CUSTOMER#U42
GSI1SK = CREATED#2026-08-24T12:00:00Z#C123

GSI2PK = STATUS#NEEDS_REVIEW
GSI2SK = UPDATED#2026-08-24T14:30:00Z#C123
```

### Case events

```text
PK = CASE#C123
SK = EVENT#2026-08-24T12:00:00Z#E001

type   = CASE_CREATED
actor  = CUSTOMER#U42
```

```text
PK = CASE#C123
SK = EVENT#2026-08-24T14:30:00Z#E002

type   = STATUS_CHANGED
actor  = AGENT#A19
from   = IN_REVIEW
to     = NEEDS_REVIEW
```

### Attachment metadata

```text
PK = CASE#C123
SK = ATTACHMENT#A774

object_key = private/<identity-id>/C123/A774.jpg
status     = PROCESSING
mime_type  = image/jpeg
```

### Idempotency record

```text
PK = IDEMPOTENCY#U42
SK = CREATE_CASE#mobile-request-8872

case_id    = C123
expires_at = <TTL timestamp>
```

---

## 12.3 Access-pattern mapping

| Access pattern | Operation |
| --- | --- |
| Get case metadata | `GetItem(PK=CASE#C123, SK=CASE)` |
| Get case with events | `Query(PK=CASE#C123)` |
| List customer cases | Query `GSI1PK=CUSTOMER#U42` |
| List cases awaiting review | Query `GSI2PK=STATUS#NEEDS_REVIEW` |
| Append case event | `PutItem` under case partition |
| Prevent duplicate creation | Conditional or transactional idempotency write |
| Conditional status transition | `UpdateItem` with version/status condition |
| Remove old idempotency entries | DynamoDB TTL |

A DynamoDB `Query` requires one partition-key value and can optionally constrain the sort key. A `Scan` reads across the table and applies filters only after items are read.

### Memory rule

```text
Query:
    go directly to one partition-key value

Scan:
    inspect the table or index broadly
```

A production API that repeatedly scans to answer routine requests usually has a missing access pattern or index.

---

## 12.4 Global secondary indexes

A GSI supplies an alternate key structure.

The base table is organized by case:

```text
PK = CASE#case-id
```

GSI1 is organized by customer:

```text
GSI1PK = CUSTOMER#customer-id
```

GSI2 is organized by workflow status:

```text
GSI2PK = STATUS#status
```

GSIs let one physical table support several access patterns, but they add:

- write cost;
- storage;
- index-maintenance traffic;
- additional throttling possibilities;
- eventual consistency.

GSI reads are eventually consistent. Strongly consistent reads are available from the base table and local secondary indexes, not from GSIs.

---

## 12.5 Read-after-write consequences

A user creates a case and immediately queries GSI1 to list their cases.

The new item might not yet appear in the GSI.

Safer confirmation flow:

```text
create mutation returns the authoritative case object
    ↓
client displays returned object
    ↓
background list query eventually includes it
```

Do not implement immediate read-your-writes confirmation through an eventually consistent index when the mutation already has the committed result.

---

## 12.6 Status hot partition

This key may become problematic:

```text
GSI2PK = STATUS#OPEN
```

Every open case shares one logical GSI partition-key value.

At moderate scale, this can be acceptable.

At extreme scale, shard the status:

```text
STATUS#OPEN#00
STATUS#OPEN#01
...
STATUS#OPEN#15
```

The application queries the required shards in parallel and merges the results.

The tradeoff is:

```text
more distributed write capacity
    versus
more complex reads
```

DynamoDB adaptive capacity helps uneven traffic, but it does not make a fundamentally concentrated key design irrelevant.

---

## 12.7 On-demand capacity

The application is new and traffic is unpredictable.

Northstar initially selects on-demand capacity because it provides consumption-based pricing and adapts automatically to changing request volume.  

Provisioned capacity with auto scaling may become more economical after the workload becomes:

- stable;
- predictable;
- continuously busy;
- well understood.

On-demand mode does not excuse bad partition keys or unlimited request bursts.

---

## 12.8 Transactions

Case creation must atomically create:

```text
case metadata
first case-history event
idempotency record
workflow-request marker
```

Use `TransactWriteItems` so either all required items appear or none appear.

DynamoDB transactions provide all-or-nothing writes across multiple items in one account and Region. A client request token can make the transaction request itself idempotent.

---

## 12.9 TTL

The idempotency record must remain long enough to cover meaningful client retries.

After that period it can expire through DynamoDB TTL.

TTL is asynchronous; an expired item may remain visible for some time before DynamoDB deletes it. Therefore, application logic should compare the stored expiry timestamp rather than assume the physical item disappears at the exact expiration second.

---

# 13. Creating a case safely

A naïve implementation is:

```text
1. Put case in DynamoDB.
2. Start Step Functions.
```

Failure between the two produces:

```text
case exists
workflow never started
```

Reversing the order produces:

```text
workflow starts
case write fails
```

This is the **dual-write problem**.

---

## 13.1 Durable workflow-request pattern

Northstar uses one DynamoDB transaction:

```text
TransactWriteItems
    ├── case item
    ├── first event
    ├── idempotency record
    └── workflow-request item
```

DynamoDB Streams captures the workflow-request insertion.

A Lambda stream consumer starts the Step Functions execution using a deterministic execution name derived from the case ID.

```text
DynamoDB transaction
    ↓
stream record
    ↓
workflow starter Lambda
    ↓
StartExecution(
    name = "case-C123",
    input = stable case input
)
```

Lambda event-source mappings process records at least once, so the consumer must tolerate duplicates.

For Standard workflows, `StartExecution` is idempotent while an execution with the same name and input is running; a closed execution with the same name produces `ExecutionAlreadyExists` until the name-reuse period passes. The application should treat the expected duplicate-start result as confirmation that the workflow already exists.

---

## 13.2 Why not publish directly after the transaction?

This implementation is unsafe:

```python
dynamodb.transact_write_items(...)
eventbridge.put_events(...)
```

The process may fail after the transaction but before publishing the event.

Persisting the workflow request in the same transaction gives the system durable evidence that publication remains necessary.

---

# 14. Lambda execution model

## 14.1 Stateless execution

A Lambda execution environment may be reused, but the application cannot depend on it.

Do not keep authoritative state only in:

- process memory;
- module globals;
- `/tmp`;
- one execution environment;
- a cached token that cannot be refreshed.

Persist durable state in services such as:

```text
DynamoDB
S3
Step Functions
SQS
```

The uploaded cheat sheet describes Lambda as stateless event-driven compute that automatically scales with concurrent invocation demand.

---

## 14.2 Reuse is still useful

Although correctness cannot depend on reuse, code can reuse:

- SDK clients;
- database connection objects;
- immutable configuration;
- compiled regular expressions;
- cached public keys.

Initialize reusable objects outside the handler when safe.

```text
reuse for efficiency
    ≠
depend on reuse for correctness
```

---

## 14.3 Lambda timeout

A Lambda invocation has a maximum execution duration.

A job that might require:

- hours of video processing;
- an unbounded data migration;
- long human waiting;
- days of business processing;

should not sleep or poll inside one Lambda invocation.

Use:

```text
Step Functions for process waiting
Fargate or Batch for long compute
SQS for queued work
EventBridge Scheduler for future invocation
```

The uploaded guide uses Lambda’s duration limit as a reason to decompose long processes through Step Functions.

---

## 14.4 Reserved concurrency

Reserved concurrency has two roles:

1. guarantee a portion of account concurrency for an important function;
2. cap how far that function can scale.

Northstar caps its attachment processor so that it cannot overwhelm:

- an antivirus service;
- an external document-validation API;
- downstream notification limits.

Reserved concurrency acts as both a reservation and a maximum for the function.

---

## 14.5 Provisioned concurrency

Provisioned concurrency pre-initializes execution environments to reduce startup latency.

It may be appropriate for:

- latency-sensitive synchronous AppSync resolvers;
- predictable business-hour traffic;
- functions with heavy initialization.

It is less attractive for:

- sporadic background tasks;
- asynchronous attachment processing;
- functions where occasional startup latency is acceptable.

Provisioned concurrency has an additional cost.

---

## 14.6 Concurrency is not throughput safety

Suppose:

```text
Lambda average duration = 2 seconds
Lambda concurrency      = 500
```

Approximate maximum completion rate:

\[
\frac{500}{2}
=

250 \text{ invocations per second}
\]

If a downstream API permits 50 calls per second, successful Lambda scaling can overload it.

Use:

- reserved concurrency;
- SQS event-source maximum concurrency;
- token-bucket rate limiting;
- batching;
- queues;
- downstream-aware retries.

AWS Lambda guidance explicitly recommends accounting for downstream throughput limits rather than assuming every dependency scales with Lambda.

---

# 15. Lambda and VPC networking

## 15.1 The default

A Lambda function does not need to be attached to Northstar’s VPC to call:

- DynamoDB;
- S3;
- EventBridge;
- SQS;
- Step Functions;
- SES;
- public HTTPS endpoints.

Lambda operates inside AWS-managed networking by default.

It should be attached to the customer VPC only when it needs access to resources reachable through that VPC, such as:

- private RDS;
- private ElastiCache;
- a private ALB;
- an on-premises network through VPN or Direct Connect;
- a private partner endpoint.

---

## 15.2 VPC attachment changes the network path

When attached to a VPC, Lambda creates or uses managed network interfaces associated with the selected subnets and security groups.

The function’s outbound connectivity now depends on the VPC:

```text
Lambda
    ↓ ENI
private subnet
    ↓ route table
NAT / VPC endpoint / private route
```

Connecting a Lambda function to a public subnet does **not** assign the function a public IP or provide Internet access. A VPC-connected function that requires public Internet access normally uses private subnets with a route through a NAT Gateway.

---

## 15.3 Baseline decision

Northstar’s baseline Lambda functions are not attached to a customer VPC because their dependencies are managed AWS services and public endpoints.

This removes:

- subnet-IP consumption;
- NAT requirements;
- security-group configuration;
- endpoint management;
- unnecessary network failure modes.

“Private is more secure” is too simplistic. A VPC attachment that serves no private-connectivity requirement adds complexity without automatically improving IAM authorization.

---

# 16. Messaging architecture

## 16.1 SQS, SNS, and EventBridge are not substitutes

| Service | Core mental model | Best use here |
| --- | --- | --- |
| SQS | Durable work queue | Attachment-processing backlog |
| SNS | Push fan-out topic | Send one notification event to several direct subscribers |
| EventBridge | Event routing by content | Route domain events to interested services |

AWS’s decision guidance describes SQS as a queue for decoupled processing, SNS as push-based pub/sub, and EventBridge as event routing between producers and targets. It also notes that combinations are frequently appropriate.

---

## 16.2 EventBridge

Domain components publish facts such as:

```json
{
  "source": "northstar.assist",
  "detail-type": "CaseStatusChanged",
  "detail": {
    "caseId": "C123",
    "customerId": "U42",
    "from": "IN_REVIEW",
    "to": "NEEDS_DOCUMENTS"
  }
}
```

Rules route events according to content:

```text
CaseStatusChanged
    ├──► notification queue
    ├──► analytics target
    └──► audit-enrichment target

AttachmentUploaded
    └──► attachment-processing queue

PartnerStatusReceived
    └──► workflow callback adapter
```

The producer does not need to know every consumer.

---

## 16.3 SQS

The attachment processor uses an SQS queue because work must remain durable when:

- Lambda is throttled;
- the processor is temporarily broken;
- a downstream service is unavailable;
- uploads arrive faster than processing capacity.

```text
S3 upload events
    ↓
EventBridge
    ↓
SQS
    ↓
Lambda at controlled concurrency
```

SQS creates backpressure:

```text
input rate > processing rate
    ↓
queue depth and message age grow
    ↓
work remains durable
```

---

## 16.4 Visibility timeout

When Lambda receives an SQS message, the message becomes temporarily invisible.

If processing succeeds:

```text
message deleted
```

If processing fails or times out:

```text
visibility timeout expires
message becomes visible again
```

The visibility timeout must be comfortably longer than the expected processing duration.

Too short:

```text
message becomes visible while first invocation still runs
    ↓
duplicate concurrent processing
```

Too long:

```text
failed work takes too long to retry
```

---

## 16.5 Partial batch response

Lambda may receive several SQS messages in one batch.

By default, one failed record can cause the whole batch to return to the queue.

Partial batch response lets the function identify only failed message IDs, reducing unnecessary reprocessing of successful records.

The processing logic still must be idempotent because SQS and Lambda event-source mappings provide at-least-once processing.

---

## 16.6 Dead-letter queue

After repeated processing failures:

```text
source queue
    ↓ redrive threshold exceeded
DLQ
```

A DLQ is not successful processing.

It is:

```text
durable isolation of work requiring investigation or repair
```

Monitor:

- DLQ message count;
- age of oldest source-queue message;
- receive count;
- redrive success;
- reason classification.

---

## 16.7 SNS fan-out variant

Suppose every approved case must trigger:

```text
customer email
mobile push
warehouse event
partner notification
```

An SNS topic with separate SQS subscriptions can fan out one publication:

```text
CaseApproved topic
    ├──► Email SQS
    ├──► Push SQS
    ├──► Warehouse SQS
    └──► Partner SQS
```

SNS provides immediate fan-out. SQS gives each consumer its own durable backlog and retry policy.

---

# 17. Attachment upload and processing

## 17.1 Upload-registration mutation

Before uploading, the client calls:

```text
registerAttachment(caseId, filename, contentType, size)
```

The backend:

1. verifies that the customer owns the case;
2. creates an attachment ID;
3. computes the permitted S3 key;
4. records attachment status as `AWAITING_UPLOAD`;
5. returns the key and upload constraints.

The client cannot arbitrarily attach an object to another customer’s case merely by guessing a key.

---

## 17.2 Direct upload network trace

```text
1. Mobile client authenticates with Cognito user pool.

2. Client exchanges the user-pool token through
   the Cognito identity pool.

3. STS returns temporary access key, secret key,
   and session token for the upload role.

4. Client resolves the S3 endpoint.

5. Client sends a signed HTTPS PutObject request.

6. S3 evaluates:
       temporary role policy
       bucket policy
       KMS key policy
       object key
       explicit denies

7. S3 stores the object.

8. S3 emits Object Created event.

9. EventBridge routes it to SQS.

10. Lambda processes the attachment.
```

The customer’s user-pool token authenticates the application identity.

The identity pool and IAM role authorize the AWS S3 operation.

The S3 bucket policy remains an independent resource-side control.

---

## 17.3 Bucket controls

The uploads bucket should normally have:

- Block Public Access;
- encryption at rest;
- TLS-required bucket policy;
- narrowly scoped write permissions;
- lifecycle rules for abandoned uploads;
- versioning when business recovery requires it;
- separate processed and quarantine prefixes;
- event logging as required.

An upload role should not receive:

```text
s3:ListAllMyBuckets
s3:DeleteBucket
s3:GetObject on all customers
s3:PutBucketPolicy
```

---

## 17.4 Processing states

Attachment metadata moves through an explicit state machine:

```text
AWAITING_UPLOAD
    ↓
UPLOADED
    ↓
PROCESSING
    ├──► ACCEPTED
    ├──► REJECTED
    └──► PROCESSING_FAILED
```

The processor may:

- verify file type;
- inspect actual content rather than trusting extension;
- scan for malware;
- extract metadata;
- generate thumbnails;
- perform OCR;
- move or copy the object to an approved prefix.

The original object key and processing result remain traceable.

---

## 17.5 Duplicate event handling

S3 or downstream delivery can cause the same logical object event to be processed more than once.

The processor uses a conditional update:

```text
Change status to PROCESSING
only if current status is UPLOADED
and object version/ETag matches expected value
```

A repeated event sees:

```text
status already ACCEPTED
```

and exits without repeating side effects.

---

# 18. Step Functions workflow

## 18.1 Why Step Functions

A case process has:

- sequential steps;
- parallel checks;
- retries;
- branching;
- human waiting;
- timeout policies;
- explicit success and failure states;
- an execution history.

The uploaded guide describes Step Functions as a state-machine service that decomposes serverless work into visible states and supplies built-in error and retry handling.

---

## 18.2 Baseline workflow

```text
Start
  │
  ▼
Validate case
  │
  ▼
Are required attachments ready?
  ├── No ──► Wait for documents ──► re-evaluate
  │
  └── Yes
       │
       ▼
    Parallel checks
       ├── warranty validation
       ├── product registration
       └── risk screening
       │
       ▼
    Evaluate results
       ├── automatic approval
       ├── automatic rejection
       └── human review
                 │
                 ▼
          Wait for task token
                 │
        ┌────────┴─────────┐
        ▼                  ▼
     approved           rejected
        │                  │
        └────────┬─────────┘
                 ▼
          update case status
                 │
                 ▼
        publish domain event
                 │
                 ▼
              Succeed
```

---

## 18.3 Task, Choice, Parallel, and Wait

| State | Purpose in this workflow |
| --- | --- |
| Task | Invoke Lambda or an AWS service |
| Choice | Branch on validation or risk result |
| Parallel | Run independent checks concurrently |
| Wait | Delay until a future time |
| Map | Process a collection of attachments |
| Succeed | End successfully |
| Fail | End with an explicit failure |
| Pass | Transform or pass data without external work |

The uploaded lesson material calls out Task, Choice, Parallel, Wait, Succeed, Fail, and Pass as core state-machine constructs.

---

## 18.4 Human callback

The workflow sends a review request containing a task token.

```text
Step Functions
    ↓ task token
review queue / review application
    ↓
human decision
    ↓ SendTaskSuccess or SendTaskFailure
Step Functions resumes
```

The Lambda that creates the review task exits immediately.

No function remains running for three days.

The token is a temporary capability and must be protected from unauthorized disclosure or replay.

---

## 18.5 Standard versus Express

### Standard workflow

Best for:

- long-running processes;
- human approval;
- durable execution history;
- `.waitForTaskToken`;
- non-idempotent business actions;
- workflows that may last days.

### Express workflow

Best for:

- very high event rate;
- short processes;
- event transformation;
- idempotent processing;
- workloads completing within five minutes.

AWS characterizes Standard workflows as long-running, durable, and auditable, while Express workflows target high-volume short-duration processing. Express does not support callback task-token or `.sync` integration patterns.

Northstar chooses **Standard** because a case may wait for human action.

---

## 18.6 Workflow exactly-once nuance

AWS documents exactly-once **workflow execution semantics** for Standard workflows.

That does not mean arbitrary external side effects become magically exactly once.

Example:

```text
Lambda calls external payment API
payment succeeds
Lambda response is lost
Step Functions retries Lambda
```

The external API may receive the operation twice.

Every non-idempotent side effect still needs:

- idempotency key;
- conditional state transition;
- transaction identifier;
- reconciliation logic.

---

## 18.7 Do not pass large files through workflow state

Step Functions state should contain references:

```json
{
  "caseId": "C123",
  "attachmentKey": "private/.../A774.jpg"
}
```

not:

```text
base64-encoded image
complete document
large model output
```

Large data belongs in S3 or another data store. The workflow passes an ARN or key.

---

# 19. Notifications

## 19.1 Notification event

The case workflow publishes:

```json
{
  "detail-type": "CustomerNotificationRequested",
  "detail": {
    "customerId": "U42",
    "caseId": "C123",
    "channels": ["EMAIL", "PUSH"],
    "template": "CASE_NEEDS_DOCUMENTS"
  }
}
```

EventBridge routes the request to a durable notification queue.

The notification Lambda reads customer preferences and sends through the appropriate channel.

---

## 19.2 Email

Amazon SES sends transactional email through its API or SMTP interface.

The notification role needs narrowly scoped permission such as:

```text
ses:SendEmail
```

It does not need case-table write access.

---

## 19.3 Mobile push

AWS End User Messaging Push supports mobile push channels such as APNs and FCM. Amazon SNS also supports direct mobile push endpoints and topic-based push delivery.

The right choice depends on the desired:

- endpoint management;
- campaign or messaging features;
- routing model;
- existing integrations.

---

## 19.4 Current Pinpoint note

Older SAP-C02 materials may refer to Amazon Pinpoint for mobile engagement.

As of August 2026:

- Amazon Pinpoint no longer accepts new customers;
- AWS plans to end Pinpoint support on October 30, 2026;
- messaging APIs such as push, SMS, and voice continue under AWS End User Messaging;
- email workloads should use or migrate toward SES as appropriate.

Therefore:

```text
Pinpoint
    → recognition-level for older questions and existing estates

SES + AWS End User Messaging
    → current baseline for a new architecture
```

---

# 20. IAM architecture

## 20.1 Identity map

| Actor | Identity | Authority |
| --- | --- | --- |
| Customer | Cognito user-pool token | Invoke authorized AppSync operations |
| Customer upload client | Cognito identity-pool role session | Write own S3 prefix |
| Support agent | Federated application token | Review assigned cases |
| AWS operator | IAM Identity Center role | Operate AWS environment |
| AppSync | Data-source service role | Access approved DynamoDB tables or Lambda |
| Create-case Lambda | Lambda execution role | DynamoDB transaction |
| Stream processor Lambda | Lambda execution role | Start one state machine |
| Attachment Lambda | Lambda execution role | Read upload, write processed data and metadata |
| Step Functions | State-machine execution role | Invoke approved tasks and publish events |
| EventBridge | Target role or target resource policy | Send to SQS, SNS, or Step Functions |
| Notification Lambda | Lambda execution role | Read preferences, send SES/push |
| Deployment pipeline | Deployment role | Deploy infrastructure and functions |

---

## 20.2 AppSync authorization trace

```text
Customer
    ↓
Cognito user-pool JWT
    ↓
AppSync validates token
    ↓
GraphQL operation authorization
    ↓
resolver checks customer ownership
    ↓
AppSync data-source role
    ↓ dynamodb:GetItem / Query
DynamoDB
```

Two identities are involved:

```text
Customer identity:
    who is requesting the GraphQL operation?

AppSync service role:
    which AWS principal calls DynamoDB?
```

Giving AppSync permission to read a table does not mean every authenticated customer may read every item.

---

## 20.3 Direct-upload authorization trace

```text
Customer user-pool identity
    ↓
identity pool
    ↓
STS role session
    ↓
s3:PutObject
    ↓
own identity prefix
    ↓
bucket policy + IAM policy + KMS policy
    ↓
ALLOW / DENY
```

The identity-pool role should be separate from Lambda execution roles.

---

## 20.4 Lambda execution role

Each function receives only the permissions required for its job.

### Create-case function

```text
dynamodb:TransactWriteItems
    on NorthstarAssist table
```

### Attachment processor

```text
s3:GetObject
    upload prefix

s3:PutObject
    processed prefix

dynamodb:UpdateItem
    attachment records
```

### Notification function

```text
dynamodb:GetItem
    notification preferences

ses:SendEmail
push-notification actions
```

One universal `ServerlessApplicationRole` would unnecessarily combine all these blast radii.

---

## 20.5 Step Functions execution role

The state machine’s role might need:

```text
lambda:InvokeFunction
dynamodb:UpdateItem
events:PutEvents
sqs:SendMessage
sns:Publish
```

only for the functions and resources referenced by the workflow.

The state machine does not inherit the permissions of the user who caused the workflow to begin.

---

## 20.6 EventBridge target authorization

Depending on the target, EventBridge uses:

- a target execution role; or
- a resource-based policy on the target.

For example, a role used to start a Step Functions state machine needs:

```text
states:StartExecution
```

on the intended state-machine ARN.

This is another instance of the same Lesson 0 model:

```text
Who is the principal?
Which action?
Which resource?
Under which conditions?
```

---

# 21. Networking architecture

## 21.1 Most baseline components are not placed in the VPC

These services are not deployed into Northstar-owned subnets:

```text
Cognito
AppSync
API Gateway
DynamoDB
S3 bucket
EventBridge
SQS
Step Functions
SES
```

They expose managed service endpoints.

The application still uses:

- DNS;
- HTTPS;
- TLS;
- service endpoints;
- IAM;
- resource policies.

“No VPC” does not mean “no networking.”

---

## 21.2 Customer to AppSync packet walk

```text
1. Client resolves the AppSync hostname.

2. Client establishes HTTPS to the managed endpoint.

3. Client sends GraphQL request and Cognito JWT.

4. AppSync validates the token.

5. AppSync selects the GraphQL resolver.

6. Resolver calls DynamoDB or Lambda.

7. Result returns through AppSync over HTTPS.
```

There is no customer security group between the mobile device and AppSync.

AppSync authorization, WAF, resolver logic, and application ownership checks are the relevant controls.

AWS WAF can protect AppSync GraphQL APIs.

---

## 21.3 Customer to S3 packet walk

```text
1. Client obtains temporary identity-pool credentials.

2. Client resolves the Regional S3 endpoint.

3. Client signs PutObject request with temporary credentials.

4. HTTPS request reaches S3.

5. S3 evaluates IAM, bucket, KMS, and explicit-deny policies.

6. Object is stored.
```

A security group does not grant this upload.

The mobile device is outside the VPC, and the access decision is based primarily on signed AWS credentials and S3 policies.

---

## 21.4 Lambda to DynamoDB

A non-VPC Lambda function calls the DynamoDB managed endpoint through AWS-managed networking.

```text
Lambda execution environment
    ↓ signed DynamoDB API request
DynamoDB endpoint
    ↓ IAM evaluation
table operation
```

The function does not need:

- a subnet;
- NAT;
- security group;
- DynamoDB gateway endpoint.

A gateway endpoint matters when resources **inside a customer VPC** need a private VPC route to DynamoDB.

---

## 21.5 VPC variant: private Aurora

Suppose a changed requirement introduces Aurora.

```text
Lambda
    ↓ VPC attachment
private application subnets
    ↓ local route
Aurora endpoint
    ↓ DB security group
database authentication
```

The Lambda security group must be permitted by the database security group.

If the same function also calls a public partner API:

```text
private Lambda ENI
    ↓
NAT Gateway
    ↓
Internet Gateway
    ↓
partner API
```

or it requires an approved proxy.

IAM permission to invoke Lambda or read Secrets Manager does not create the database network path.

---

# 22. Reliability model

## 22.1 Regional managed-service resilience

The baseline uses Regional managed services designed to operate across multiple Availability Zones.

Northstar does not place one application server in one AZ.

However:

```text
managed service availability
    ≠
correct application semantics
```

The system can still fail because of:

- bad IAM;
- hot DynamoDB keys;
- malformed events;
- poison SQS messages;
- unbounded Lambda concurrency;
- incorrect retries;
- expired tokens;
- logical conflicts;
- third-party outages.

---

## 22.2 Duplicate delivery

Several paths may deliver at least once:

```text
DynamoDB Streams → Lambda
SQS → Lambda
EventBridge target delivery
S3 event processing
client mutation retry
```

Therefore:

\[
\text{safe event-driven system}
=

\text{at-least-once delivery}
+
\text{idempotent consumers}
\]

Common techniques:

- idempotency key;
- conditional write;
- transaction token;
- deterministic workflow execution name;
- processed-event record;
- current-state condition;
- deduplication ID where FIFO semantics apply.

---

## 22.3 Poison messages

A malformed attachment event might always fail.

Without bounded retries:

```text
message received
    ↓ fails
message returns
    ↓ fails
message returns
    ↓ forever
```

Use:

- maximum receive count;
- DLQ;
- alarm;
- operator-visible failure reason;
- safe redrive tooling.

---

## 22.4 Backpressure

During a recall:

```text
10,000 uploads/minute arrive
processor safely handles 2,000/minute
```

The correct immediate behavior may be:

```text
queue grows
processing latency increases
no data is lost
downstream remains stable
```

Scaling to 10,000/minute is only correct if every downstream dependency can support it.

Monitor the **age of the oldest message**, not merely queue depth.

---

## 22.5 DynamoDB point-in-time recovery

Northstar enables backup and point-in-time recovery according to business requirements.

High availability does not protect against:

- accidental deletion;
- defective application updates;
- malicious writes;
- mass logical corruption.

A restored DynamoDB backup creates a separate table. Recovery planning must include:

- application cutover;
- stream behavior;
- index availability;
- reconciliation of writes after the restore point.

---

## 22.6 Regional outage

The baseline does not survive loss of the entire Region.

It has:

```text
serverless Regional resilience
```

not:

```text
multi-Region active-active resilience
```

A later project will examine multi-Region data and disaster recovery.

---

# 23. Security architecture

## 23.1 Security layers

```text
Cognito
    customer authentication

AppSync authorization
    GraphQL operation and token checks

Resolver logic
    object-level ownership

Identity-pool IAM role
    direct AWS API permissions

S3 bucket policy
    resource-side upload constraints

Lambda execution roles
    workload AWS permissions

DynamoDB conditions
    valid state transitions

KMS
    encryption-key authorization

WAF
    web-request inspection

CloudTrail
    AWS configuration and API history

CloudWatch / X-Ray
    operational detection
```

No single layer replaces the others.

---

## 23.2 Avoid API-key authentication for customer data

An AppSync API key identifies an application-level caller but is not a suitable identity mechanism for sensitive per-customer records.

Customer operations should normally use:

- Cognito user pools;
- OIDC;
- IAM;
- Lambda authorization where custom policy is needed.

API keys may be acceptable for limited public or development scenarios, subject to appropriate controls.

---

## 23.3 Token claims are untrusted until validated

A resolver should use identity information produced by the validated AppSync authorization context.

Do not trust a client-supplied field such as:

```json
{
  "customerId": "U42"
}
```

merely because the request also carries a valid token.

Derive the effective customer identity from the authenticated token and compare or overwrite the supplied value.

---

## 23.4 WAF

WAF can inspect AppSync requests for:

- malicious patterns;
- excessive request rates;
- blocked IP sets;
- geographic rules;
- known exploit signatures.

WAF does not determine whether customer U42 owns case C123.

Application authorization remains necessary.

---

## 23.5 Encryption

Use KMS keys when the application needs customer-managed key policy, separation of duties, audit controls, or lifecycle control beyond service-owned keys.

Remember:

```text
IAM allows s3:GetObject
    AND
KMS key policy does not permit decryption
    =
AccessDenied
```

Data-resource permission and key permission are separate gates.

---

# 24. Observability

## 24.1 User journey

A useful end-to-end trace is:

```text
mobile mutation
    ↓
AppSync resolver
    ↓
Lambda
    ↓
DynamoDB transaction
    ↓
DynamoDB Stream
    ↓
workflow starter
    ↓
Step Functions
    ↓
notification event
    ↓
email or push
```

CloudWatch and X-Ray can help identify which component contributed latency or errors. AppSync supports CloudWatch metrics/logging and X-Ray tracing.

---

## 24.2 Cognito

Monitor:

```text
sign-in success and failure
token errors
MFA challenges
account-confirmation failures
federation failures
request throttling
suspicious sign-in behavior
```

Avoid logging:

- passwords;
- full refresh tokens;
- identity-provider secrets;
- unredacted personal data.

---

## 24.3 AppSync

Monitor:

```text
request count
GraphQL errors
authorization failures
resolver latency
data-source latency
subscription connections
subscription delivery failures
throttles
```

A low overall API latency can hide one slow resolver field. Field-level logging and tracing should be used carefully because logs may contain customer data.

---

## 24.4 Lambda

Monitor:

```text
invocations
errors
duration
throttles
concurrent executions
iterator age for streams
SQS batch failures
cold-start contribution
memory usage
```

Memory configuration affects more than RAM; it also influences the compute resources allocated to the execution environment. Measure rather than always choosing the minimum.

---

## 24.5 DynamoDB

Monitor:

```text
successful request latency
throttled requests
consumed capacity
system errors
conditional-check failures
transaction conflicts
GSI throttling
hot partition indicators
```

A high conditional-check-failure rate may indicate:

- legitimate concurrency conflicts;
- broken version handling;
- repeated duplicate requests;
- an application bug.

It is not automatically a service outage.

---

## 24.6 SQS

Monitor:

```text
age of oldest message
visible messages
in-flight messages
receive count
DLQ count
Lambda processing errors
```

Queue depth without message age may be misleading because the application may be draining a large but healthy burst.

---

## 24.7 Step Functions

Monitor:

```text
executions started
executions succeeded
executions failed
executions timed out
execution duration
states retrying
human-review wait age
callback timeouts
```

Standard workflow execution history provides detailed audit and debugging information. Express workflow history depends more heavily on CloudWatch Logs.

---

## 24.8 Business metrics

Technical health is not enough.

Track:

```text
case creation success rate
time to first review
time waiting for customer
percentage auto-approved
attachment rejection rate
cases stuck in each status
notification delivery rate
duplicate case prevention count
offline conflict count
```

A workflow can have zero Lambda errors while customers wait five days in the wrong state.

---

# 25. Deployment architecture

## 25.1 Infrastructure as code

The uploaded cheat sheet identifies AWS SAM as a CloudFormation extension designed to simplify serverless resources such as Lambda, API Gateway, and DynamoDB.

Northstar may use:

### SAM

Good for:

- Lambda;
- API Gateway;
- Step Functions;
- DynamoDB;
- event sources;
- serverless-oriented templates.

### CDK

Good when:

- the team prefers general-purpose programming languages;
- reusable constructs are valuable;
- the stack contains many nonserverless services.

### CloudFormation directly

Good when:

- explicit native resource definitions are preferred;
- an organization standardizes on plain templates.

All three ultimately define reproducible desired infrastructure.

---

## 25.2 Lambda versions and aliases

A release publishes an immutable Lambda version.

An alias such as:

```text
production
```

points to the active version.

CodeDeploy can shift traffic between versions using:

- all-at-once;
- linear;
- canary.

The uploaded deployment section highlights gradual and canary traffic shifting for Lambda and ECS/Fargate workloads.

---

## 25.3 Safe deployment sequence

```text
1. Validate templates.
2. Run unit and contract tests.
3. Deploy to development.
4. Test Cognito, AppSync and IAM isolation.
5. Test DynamoDB migrations and indexes.
6. Run mobile tests.
7. Deploy Lambda version.
8. Route small canary percentage.
9. Evaluate alarms.
10. Complete or roll back.
```

A deployment is not safe merely because the Lambda code itself passed unit tests.

It may depend on:

- new GraphQL fields;
- changed token claims;
- a GSI becoming active;
- new IAM permissions;
- a changed event schema;
- mobile clients that cannot be updated immediately.

---

## 25.4 Backward-compatible client evolution

Mobile applications remain installed for long periods.

Backend changes should assume that several client versions coexist.

Prefer:

- adding optional GraphQL fields;
- deprecating before removal;
- version-tolerant event contracts;
- server defaults;
- compatibility tests.

Do not require every mobile user to upgrade within five minutes of a backend deployment.

---

# 26. Cost model

Major cost categories include:

```text
Amplify builds and hosting
CloudFront delivery
Cognito active users and advanced features
AppSync requests and real-time connections/messages
Lambda requests and duration
DynamoDB reads, writes, indexes and storage
S3 requests, storage and transfer
Step Functions state transitions or execution duration
EventBridge events
SQS requests
SES messages
push notifications
CloudWatch logs and custom metrics
X-Ray traces
KMS requests
```

---

## 26.1 Avoid unnecessary Lambda

This path:

```text
AppSync
    ↓
Lambda
    ↓
GetItem
    ↓
DynamoDB
```

may be replaced with:

```text
AppSync direct resolver
    ↓
DynamoDB
```

when authorization and transformation remain simple.

The direct path can reduce:

- latency;
- code;
- invocation cost;
- concurrency consumption;
- deployment surface.

---

## 26.2 On-demand versus provisioned DynamoDB

Start with on-demand when traffic is uncertain.

Re-evaluate after observing:

- stable baseline;
- peak-to-average ratio;
- per-table and per-index usage;
- forecast accuracy;
- growth.

A provisioned design can be cheaper for a steady high-volume workload, but requires capacity planning.

---

## 26.3 Step Functions type

Standard is selected because the workflow waits for human action.

Express may be more economical for short, high-volume, idempotent flows.

Do not use Express simply because it is cheaper when the process needs:

- task tokens;
- long waits;
- durable audit history;
- stronger workflow execution semantics.

---

## 26.4 Logs can become expensive

Avoid:

- full GraphQL request bodies for every production request;
- binary or base64 payloads in logs;
- unbounded retention;
- duplicate logging at every layer;
- high-cardinality custom metrics.

Use:

- sampled debug logging;
- redaction;
- retention policies;
- structured logs;
- metric extraction;
- tracing sampling.

---

# 27. Changed-requirement variants

## Variant 1: No offline or real-time requirement

The clients need a small CRUD API and ordinary REST endpoints.

Consider:

```text
API Gateway HTTP API
+
Lambda
+
DynamoDB
```

AppSync may be unnecessary.

---

## Variant 2: Partner API needs API keys and per-client throttling

Use API Gateway REST API rather than HTTP API.

REST APIs support usage plans, API keys, per-client throttling, request validation, WAF integration, and private endpoint options that HTTP APIs do not all provide.

---

## Variant 3: Clients need a custom bidirectional protocol

Use API Gateway WebSocket API when the application needs explicit connection and route management beyond GraphQL subscriptions.

AppSync remains preferable when the real-time model naturally follows GraphQL data mutations and subscriptions.

---

## Variant 4: No temporary AWS credentials may reach clients

Replace the identity-pool upload path with narrowly scoped S3 pre-signed URLs.

The backend becomes the only AWS principal deciding each upload key.

---

## Variant 5: Strong relational transactions are central

Suppose the application introduces:

- complex joins;
- arbitrary relational queries;
- ledger-like constraints;
- stored procedures;
- strong multi-row relational invariants.

Consider Aurora or RDS rather than forcing the model into DynamoDB.

Lambda functions that access private Aurora are attached to private subnets and usually use RDS Proxy or carefully managed connection pooling to avoid connection storms.

---

## Variant 6: Attachment processing lasts 45 minutes

Lambda is not appropriate for the processing unit.

Use:

```text
SQS
    ↓
ECS/Fargate task or AWS Batch job
```

Step Functions can orchestrate and wait for the task.

---

## Variant 7: Strict ordering is required per case

Use SQS FIFO with:

```text
MessageGroupId = case ID
```

Messages for one case are serialized, while different case groups can process concurrently.

Ordering does not replace idempotency.

---

## Variant 8: Active-active multi-Region application

The baseline must be redesigned.

Possible components include:

- DynamoDB global tables;
- duplicated AppSync or API stacks;
- replicated S3 objects;
- Regional Cognito planning;
- global traffic routing;
- globally unique idempotency keys;
- conflict and write-ownership policy.

Current DynamoDB global tables support both multi-Region eventual consistency and, under specific topology constraints, multi-Region strong consistency. The consistency model must be selected from business requirements rather than assumed.

---

## Variant 9: Fine-grained application policy becomes complex

Suppose authorization depends on:

```text
customer ownership
case state
product type
agent region
supervisor relationship
contract tier
time of day
```

Consider centralizing application authorization with Amazon Verified Permissions rather than scattering policy logic across resolvers and functions.

Cognito provides identity claims; Verified Permissions evaluates application policy.

---

# 28. Failure drills

## Failure A: User signs in but AppSync returns `Unauthorized`

Investigate:

```text
token type
token issuer
token expiry
AppSync authorization mode
user-pool ID
application client
required scopes
Authorization header
```

Successful Cognito authentication does not prove the client sent the correct token to the correct API.

---

## Failure B: User can query another customer’s case

Authentication worked.

Object-level authorization failed.

Investigate:

```text
resolver ownership check
token subject mapping
GSI query constraints
client-supplied customer ID
support-role rules
```

Do not attempt to fix this with a security group.

---

## Failure C: Identity-pool credentials are issued, but upload returns `AccessDenied`

Investigate:

```text
authenticated role selection
identity-pool trust conditions
S3 resource prefix
identity ID versus user-pool sub
bucket policy
KMS key policy
explicit deny
```

---

## Failure D: Upload works, but no processing starts

Investigate:

```text
S3 event configuration
EventBridge integration
rule pattern
SQS queue policy
EventBridge target role
queue metrics
Lambda event-source mapping
```

The S3 write and downstream event delivery are separate interactions.

---

## Failure E: One attachment is processed twice

This is possible under at-least-once delivery.

Fix the consumer with:

- conditional state transition;
- event ID record;
- object-version check;
- idempotent output naming.

Do not assume duplicate delivery proves that SQS is malfunctioning.

---

## Failure F: Every message in a batch retries because one file is malformed

Enable and correctly implement SQS partial batch response so only failed records are returned.

---

## Failure G: Queue depth keeps increasing

Possible causes:

```text
input rate exceeds processor capacity
reserved concurrency too low
Lambda throttling
poison messages
downstream API latency
DynamoDB throttling
processing duration increased
```

Check message age and processing rate before blindly increasing concurrency.

---

## Failure H: DynamoDB throttles despite on-demand mode

Possible causes:

```text
hot partition key
sudden new traffic peak
GSI bottleneck
account/table quota
large items
retry storm
```

On-demand is adaptive capacity, not infinite instantaneous capacity.

---

## Failure I: New case does not appear immediately in customer list

The list query uses a GSI and is eventually consistent.

Use the mutation result for immediate UI confirmation instead of assuming the write failed.

---

## Failure J: Two mobile retries create two cases

The client generated a new request ID on every retry, or the backend failed to persist the idempotency record atomically with the case.

Use one stable logical-operation ID and a transaction.

---

## Failure K: Workflow never starts although the case exists

The implementation performed a nontransactional database write followed by `StartExecution` and failed between them.

Use a durable workflow-request/outbox record written in the same transaction as the case.

---

## Failure L: Human approval never resumes the workflow

Investigate:

```text
task token storage
token expiry
wrong state-machine execution
SendTaskSuccess permissions
review-service failure
callback timeout
duplicate callback
```

---

## Failure M: Partner API becomes overloaded after a product recall

Lambda scaled faster than the partner.

Use:

- SQS buffering;
- reserved concurrency;
- rate limiting;
- exponential backoff;
- circuit breaker;
- partner-aware quotas.

---

## Failure N: VPC-connected Lambda cannot reach the Internet

Placing Lambda in a public subnet does not provide a public IP.

Investigate:

```text
private-subnet route to NAT
NAT in public subnet
Internet Gateway
security-group egress
NACLs
DNS
```

---

## Failure O: Notifications are sent twice

The event or queue message was redelivered, or the sender retried after an ambiguous response.

Use a notification idempotency key such as:

```text
case ID + event version + channel + template
```

---

## Failure P: AppSync latency is high, but Lambda duration is low

Possible causes:

```text
slow direct resolver
many sequential field resolvers
N+1 data-source calls
DynamoDB throttling
subscription overhead
network latency to HTTP data source
```

Use field-level metrics and X-Ray rather than inspecting only Lambda.

---

## Failure Q: Offline client overwrites an agent’s decision

Conflict resolution accepted a stale version or used unconditional last-writer-wins.

Use version checks and domain-specific conflict handling for sensitive state.

---

# 29. SAP-C02 decision snippets

## User pool versus identity pool

**Requirement:** Let users sign up and obtain tokens for an application API.

```text
Cognito user pool
```

**Requirement:** Exchange an authenticated identity for temporary AWS credentials.

```text
Cognito identity pool
```

They can be used together.

---

## AppSync versus API Gateway

**Requirement:** GraphQL, subscriptions, offline synchronization, and several data sources.

```text
AppSync
```

**Requirement:** Lightweight REST webhook.

```text
API Gateway HTTP API
```

**Requirement:** API keys, usage plans, request validation, WAF, or private REST endpoint.

```text
API Gateway REST API
```

---

## Direct resolver versus Lambda

**Simple DynamoDB get or query:**

```text
AppSync direct resolver
```

**Complex business logic or external call:**

```text
Lambda resolver
```

---

## SQS versus SNS versus EventBridge

**One durable work backlog:**

```text
SQS
```

**Push one message to many subscribers:**

```text
SNS
```

**Route events according to attributes and patterns:**

```text
EventBridge
```

---

## Standard versus Express Step Functions

**Human approval or workflow lasting days:**

```text
Standard
```

**Very high-volume workflow lasting seconds:**

```text
Express
```

---

## Reserved versus provisioned concurrency

**Cap function scaling or reserve account capacity:**

```text
reserved concurrency
```

**Reduce cold-start latency with preinitialized environments:**

```text
provisioned concurrency
```

---

## Identity-pool credentials versus pre-signed URL

**Client needs repeated narrowly scoped AWS SDK access:**

```text
identity pool
```

**Client needs one exact upload without AWS credentials:**

```text
pre-signed URL
```

---

## DynamoDB versus relational database

**Known key-based access patterns and bursty scale:**

```text
DynamoDB
```

**Complex joins and flexible relational queries:**

```text
Aurora or RDS
```

---

## Query versus Scan

**Known partition-key value:**

```text
Query
```

**Inspect entire table or index:**

```text
Scan
```

Routine APIs should generally avoid broad scans.

---

# 30. Retrieval practice

## 1

What are the three distinct identities a customer may have in this architecture?

## 2

What does a Cognito user pool issue after authentication?

## 3

Why is a user-pool JWT not an AWS credential?

## 4

What does a Cognito identity pool return?

## 5

Why does the identity-pool role trust policy include the identity-pool audience?

## 6

What is the difference between authentication and object-level authorization?

## 7

Why is AppSync selected as the main client API?

## 8

What are the three central GraphQL operation types?

## 9

What does an AppSync resolver do?

## 10

When is a direct DynamoDB resolver preferable to Lambda?

## 11

When is API Gateway HTTP API a better fit than AppSync?

## 12

Which API Gateway type is appropriate when API keys and usage plans are required?

## 13

What problem does delta sync solve?

## 14

Why does every offline mutation need a stable client request ID?

## 15

Why must DynamoDB schema design begin with access patterns?

## 16

How does the table retrieve all events for one case?

## 17

How does it list cases for one customer?

## 18

Why can a newly written item be temporarily absent from a GSI query?

## 19

What problem can `STATUS#OPEN` create at very high scale?

## 20

Why use `TransactWriteItems` during case creation?

## 21

What is the dual-write problem?

## 22

How does the durable workflow-request pattern reduce it?

## 23

Why must the DynamoDB Streams consumer be idempotent?

## 24

What is the difference between reserved and provisioned Lambda concurrency?

## 25

Why might successful Lambda scaling harm a downstream service?

## 26

Why is the baseline Lambda not VPC-attached?

## 27

Why does a VPC-connected Lambda in a public subnet not automatically have Internet access?

## 28

What does SQS provide that EventBridge alone does not provide in the attachment path?

## 29

What is the SQS visibility timeout?

## 30

What is a partial batch response?

## 31

Why does this workflow require Step Functions Standard rather than Express?

## 32

Does Standard workflow execution semantics guarantee exactly-once external side effects?

## 33

Why are task tokens useful for human review?

## 34

Why should large file contents not be stored in Step Functions state?

## 35

What are the two IAM evaluations involved in direct customer upload?

## 36

Why can a customer with a valid JWT still receive `AccessDenied` from S3?

## 37

What is the difference between CloudWatch and CloudTrail here?

## 38

Why is a DLQ not successful completion?

## 39

What replaced Pinpoint as the baseline push-messaging service in this lesson?

## 40

What is the largest failure boundary handled by the baseline?

---

# 31. Answer key

## 1

A user-pool application identity, an identity-pool AWS federated identity, and Northstar’s own business customer ID.

## 2

Signed application tokens such as ID, access, and refresh tokens.

## 3

It is an application/OIDC token, not an AWS access key, secret key, and STS session token.

## 4

Temporary limited-privilege AWS credentials associated with an IAM role.

## 5

To ensure that only identities from the intended identity pool can use the role.

## 6

Authentication establishes who the caller is. Object-level authorization decides whether that caller may act on a particular case or resource.

## 7

The application requires GraphQL, real-time subscriptions, offline synchronization, and access to several backend data sources.

## 8

Query, mutation, and subscription.

## 9

It translates a GraphQL field operation into an operation against a backend data source and transforms the result.

## 10

When the operation is a straightforward, safely authorized DynamoDB read or write that does not need arbitrary code.

## 11

When a client or partner needs a simple REST-style endpoint without GraphQL, subscriptions, or offline synchronization.

## 12

API Gateway REST API.

## 13

It lets a reconnecting client retrieve changes after a previous sync point instead of downloading the complete dataset again.

## 14

So retries of one logical operation can be recognized and do not create duplicate cases or side effects.

## 15

DynamoDB keys and indexes determine which queries are efficient; the model is designed around required reads and writes.

## 16

It queries the partition key `CASE#<case-id>` and uses sort-key prefixes for metadata, events, and attachments.

## 17

It queries GSI1 using `CUSTOMER#<customer-id>`.

## 18

GSI propagation is eventually consistent.

## 19

All open cases may concentrate traffic under one logical partition-key value, creating a hot partition.

## 20

To write the case, first event, idempotency record, and workflow request atomically.

## 21

One system is updated successfully while a second required update or publication fails.

## 22

It persists the need to start the workflow in the same transaction as the case, allowing a stream consumer to publish it later.

## 23

DynamoDB Streams-to-Lambda processing is at least once, so records can be delivered more than once.

## 24

Reserved concurrency reserves and caps function concurrency. Provisioned concurrency preinitializes environments to reduce startup latency.

## 25

The downstream service may have a much lower throughput or connection limit than Lambda.

## 26

Its dependencies are managed AWS endpoints and public services; it does not need access to private VPC resources.

## 27

Lambda does not receive a public IP merely by selecting a public subnet. Internet egress normally requires a route through NAT from private subnets.

## 28

A durable backlog, visibility timeout, controlled consumption, retries, and a DLQ.

## 29

The period during which a received message is hidden from other consumers while processing occurs.

## 30

A response that identifies only failed message IDs so successful messages in the batch are not retried.

## 31

The process can wait days for human action and requires callback task tokens and durable execution history.

## 32

No. External operations still need idempotency because task retries or ambiguous responses can repeat side effects.

## 33

They allow the workflow to suspend without keeping compute running and resume when an authorized external actor supplies the result.

## 34

Workflow state has payload constraints and is intended for coordination data; large objects belong in S3.

## 35

The identity-pool role permission evaluation and the S3 bucket/KMS resource-side evaluations.

## 36

The JWT authenticated AppSync access; S3 requires separate temporary AWS credentials and matching IAM, bucket, and KMS permissions.

## 37

CloudWatch shows operational state, metrics, logs, alarms, and traces. CloudTrail records AWS API and configuration activity.

## 38

It means the system isolated work it could not process. The business outcome remains unresolved.

## 39

AWS End User Messaging Push, with SES for email and SNS remaining another supported mobile-push option.

## 40

Failures of components or Availability Zones within the selected Region. Complete Regional failure is not covered.

---

# 32. What to memorize now

```text
Cognito user pool
    → application authentication and tokens

Cognito identity pool
    → temporary AWS credentials
```

```text
JWT
    ≠
AWS access credentials
```

```text
AppSync
    → GraphQL
    → subscriptions
    → offline synchronization
    → multiple data sources

API Gateway
    → REST / HTTP / WebSocket APIs
```

```text
Query
    → read GraphQL data

Mutation
    → change GraphQL data

Subscription
    → receive real-time GraphQL updates
```

```text
Direct resolver
    → simple backend operation

Lambda resolver
    → complex business logic
```

```text
DynamoDB
    → design from access patterns
    → partition key distributes data
    → sort key groups and orders related items
    → GSI supports alternate access pattern
```

```text
Query
    → one partition-key value

Scan
    → broad table/index inspection
```

```text
SQS
    → durable work queue

SNS
    → push fan-out

EventBridge
    → event routing
```

```text
Lambda reserved concurrency
    → reserve and cap

Lambda provisioned concurrency
    → preinitialize for latency
```

```text
Step Functions Standard
    → long-running
    → auditable
    → human callback

Step Functions Express
    → short
    → high volume
```

```text
At-least-once delivery
    → idempotent consumer
```

```text
Default Lambda networking
    → managed AWS networking

VPC-attached Lambda
    → customer subnet routes, SGs, NAT/endpoints
```

```text
Identity pool upload
    → user token
    → STS credentials
    → S3 IAM authorization

Pre-signed upload
    → backend signs one exact S3 operation
```

```text
Serverless
    ≠
architecture-free
```

---

# 33. What can remain recognition-level

You do not yet need perfect recollection of:

- exact Cognito hosted-UI configuration;
- every OAuth flow;
- AppSync resolver syntax;
- GraphQL directive syntax;
- Delta Sync table internals;
- DynamoDB single-table modeling tricks beyond the examples;
- Lambda event-source polling formulas;
- Step Functions Amazon States Language;
- task-token API syntax;
- SQS redrive configuration fields;
- SES reputation-management details;
- APNs and FCM credential configuration;
- AWS End User Messaging API details;
- DynamoDB global-table consistency topology;
- advanced Verified Permissions policies.

The durable mental model is:

```text
Customer identity
    ↓ Cognito tokens
AppSync GraphQL API
    ↓
DynamoDB and Lambda
    ↓
durable events and queues
    ↓
Step Functions business process
    ↓
real-time updates and notifications
```

At every arrow, continue asking the two Lesson 0 questions:

```text
Authorization:
    Which principal is allowed to perform which action?

Networking:
    Through which endpoint and path does the interaction occur?
```
