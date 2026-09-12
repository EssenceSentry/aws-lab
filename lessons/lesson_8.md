# Lesson 8 — A Regulated Payment Platform

## Least privilege, encryption and key custody, private service paths, security operations, and audit evidence

## Source note

The planned curriculum defines Lesson 8 as a regulated financial or healthcare workload covering:

```text
least privilege
KMS versus CloudHSM
Secrets Manager versus Parameter Store
ACM
private endpoints
WAF, Shield, and Firewall Manager
GuardDuty, Macie, Inspector, Detective, and Security Hub
Artifact and Audit Manager
evidence retention
data residency
```



The uploaded material supplies the exam-oriented service distinctions. In particular, it separates:

- Inspector vulnerability findings;
- GuardDuty threat detection;
- Macie sensitive-data discovery;
- Detective investigation;
- Security Hub aggregation and posture;
- Network Firewall traffic inspection;
- Artifact’s AWS compliance documents from Audit Manager’s evidence about the customer’s AWS usage.  

The business architecture below is a teaching synthesis. We use a **financial workload** because the earlier contact-center interlude already covered healthcare.

### Current-service clarifications

Three changes since much of the study material was written are worth knowing:

1. **AWS Audit Manager is in maintenance mode and has not accepted setup in new accounts since April 30, 2026.** Existing customers can continue using it. It remains important for SAP-C02 recognition, but Northstar’s new architecture does not depend on it. 
2. Current AWS documentation distinguishes **AWS Security Hub**, the unified security solution that correlates and prioritizes signals, from **Security Hub CSPM**, which performs standards-based posture checks and aggregates compliance status. Older material commonly uses “Security Hub” for both functions. 
3. The old blanket rule that an ACM-issued public certificate can never be exported is no longer correct. ACM now offers **exportable public certificates** when export is enabled at issuance. Ordinary ACM-managed use on integrated AWS services remains the simpler baseline. 

---

# 1. The project

## 1.1 Business brief

Northstar Group is launching **Northstar Pay**, a common payment platform for its Commerce, Logistics, and subscription businesses.

The platform performs:

```text
payment authorization
payment capture
refund initiation
transaction status lookup
settlement-file production
dispute-document storage
financial reconciliation
```

Northstar Pay is not a card network or bank. It integrates with external payment processors.

The company wants to minimize the amount of highly sensitive payment information that enters Northstar systems. The customer’s raw card details are therefore collected using the processor’s hosted fields or tokenization client:

```text
Customer browser
    ↓ raw card information
Payment processor tokenization endpoint
    ↓
Opaque payment token
    ↓
Northstar Pay API
```

Northstar normally receives:

```text
payment token
merchant/customer reference
amount
currency
order reference
transaction result
limited masked payment metadata
```

It does not intentionally store the full card number or security code.

This reduces sensitive-data exposure, but it does **not** by itself prove that Northstar is outside every regulatory scope. The compliance team and external assessor determine the applicable boundary based on the complete transaction flow and controls.

---

## 1.2 Geographic model

Northstar operates two independent Regional payment cells:

```text
United States cell
    us-east-1

European cell
    eu-west-1
```

Each merchant or business tenant has a designated **home Region**.

```text
US tenant
    → api.us.pay.northstar.example

EU tenant
    → api.eu.pay.northstar.example
```

The transaction databases, cryptographic keys, evidence buckets, secrets, and operational logs remain in the tenant’s assigned geography unless an explicitly approved replication policy says otherwise.

The baseline does not route transactions according only to the customer’s current IP location. A European customer travelling in the United States still belongs to the tenant’s assigned data Region.

---

## 1.3 Regulatory assumptions for this lesson

These are case-study assumptions rather than claims about one particular law or certification:

- transaction records must remain recoverable and auditable;
- selected evidence must be retained immutably for seven years;
- production changes require traceable approval;
- cryptographic administration and data access must be separated;
- public payment endpoints require strong DDoS and web-application protection;
- access to production data must be attributable to a temporary identity;
- sensitive payment information must not appear in ordinary logs;
- EU transaction data must not be copied into the US processing cell;
- key destruction must require exceptional, separated authority;
- security services must operate across all production accounts and approved Regions.

---

# 2. Constraint ledger

| Dimension | Requirement |
|---|---|
| API | Public HTTPS payment API |
| Sensitive data | Minimize raw card-data handling |
| Transactions | Strong relational consistency and idempotency |
| Availability | Survive task, instance, and Availability Zone failures |
| Accounts | Dedicated payment, security, and evidence boundaries |
| Identity | Federated workforce; temporary runtime credentials |
| Encryption | In transit and at rest, with customer-controlled key policy where required |
| Key custody | Separation between key administration and cryptographic use |
| Secrets | Rotation for processor and database credentials |
| Networking | Private application and database tiers |
| AWS service access | Private VPC endpoints where appropriate |
| External processor | Controlled outbound HTTPS path |
| Public protection | WAF and DDoS controls |
| Detection | Threat, vulnerability, configuration, and data-exposure findings |
| Investigation | Correlate events across accounts and resources |
| Evidence | Durable, restricted, tamper-resistant records |
| Data residency | Explicit Region assignment, not incidental routing |
| Operations | Central security administration across the organization |
| Recovery | Backups, immutable evidence, and tested restoration |
| Cost | Controls proportional to risk rather than every service enabled everywhere |

---

# 3. Baseline architecture

The following diagram represents one Regional cell. The other cell is deployed independently with separate data, keys, secrets, and endpoints.

```text
                            Customer checkout
                                   │
                    Raw card fields│
                                   ├──────────────► Processor tokenization
                                   │                    endpoint
                                   │                         │
                                   │                    payment token
                                   ▼                         │
                  api.eu.pay.northstar.example ◄────────────┘
                                   │
                              Route 53
                                   │
                                   ▼
                       Internet-facing ALB
                  ACM certificate + Shield Advanced
                            AWS WAF web ACL
                                   │ HTTPS
                                   ▼
┌────────────────────────── Payment VPC ────────────────────────────────────┐
│                                                                           │
│ Public ingress subnets — multiple AZs                                     │
│     Application Load Balancer                                             │
│                                                                           │
│ Private application subnets — multiple AZs                                │
│     ECS Fargate payment tasks                                              │
│         PaymentRuntimeRole                                                │
│         Payment-SG                                                        │
│         no public IP                                                       │
│              │                                                            │
│              ├────► Secrets Manager interface endpoint                    │
│              ├────► KMS interface endpoint                                │
│              ├────► CloudWatch Logs interface endpoint                    │
│              ├────► ECR interface endpoints                              │
│              ├────► S3 gateway endpoint                                   │
│              │                                                            │
│              ├────► RDS Proxy                                             │
│              │          │                                                 │
│              │          ▼                                                 │
│              │    Aurora PostgreSQL Multi-AZ                              │
│              │    isolated database subnets                               │
│              │                                                            │
│              └────► Network Firewall                                      │
│                           │                                               │
│                           ▼                                               │
│                     NAT Gateway                                           │
│                           │                                               │
└───────────────────────────┼───────────────────────────────────────────────┘
                            │ TLS
                            ▼
                   External payment processor


                         Business and audit data
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│ Payment account                                                           │
│     Aurora transaction state                                              │
│     S3 dispute and settlement objects                                      │
│     Regional customer-managed KMS keys                                    │
│                                                                           │
│ Regional Log Archive account                                              │
│     CloudTrail organization logs                                          │
│     Config snapshots                                                      │
│     WAF / ALB / firewall logs                                              │
│     security-finding exports                                               │
│     S3 Versioning + Object Lock + KMS                                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘


                      Organization security operations
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│ Security Tooling account                                                  │
│                                                                           │
│     GuardDuty delegated administrator                                     │
│     Inspector delegated administrator                                     │
│     Macie administrator                                                   │
│     Security Hub / Security Hub CSPM delegated administrator              │
│     Detective administrator                                               │
│     Firewall Manager administrator                                        │
│                                                                           │
│                    findings and posture                                    │
│                              │                                            │
│                              ▼                                            │
│                         EventBridge                                        │
│                              │                                            │
│                  ┌───────────┼─────────────┐                              │
│                  ▼           ▼             ▼                              │
│              notify      investigation   approved                         │
│              responders  workflow        remediation                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Architecture in one sentence

> Each payment Region is an isolated cell with a protected public ingress, private application and database tiers, Regional keys and secrets, controlled processor egress, organization-wide security monitoring, and separately retained audit evidence.

---

# 4. Functional decisions at a glance

| Function | Baseline choice | Main reason |
|---|---|---|
| Public DNS | Route 53 | Explicit Regional API names |
| TLS certificate | ACM-issued public certificate | Managed certificate lifecycle on ALB |
| Public ingress | Application Load Balancer | HTTPS API traffic to ECS targets |
| Web filtering | AWS WAF | Layer 7 request inspection and rate controls |
| DDoS baseline | Shield Standard | Automatic AWS DDoS protection |
| Enhanced DDoS | Shield Advanced | Higher-risk payment entry point |
| Organizational firewall policy | Firewall Manager | Apply policies across accounts and resources |
| Runtime | ECS on Fargate | Isolated, replaceable, private container tasks |
| Transaction store | Aurora PostgreSQL Multi-AZ | Relational constraints and transactional state |
| Connection pooling | RDS Proxy | Protect database from connection bursts |
| Data encryption | Customer-managed KMS keys | Explicit key policy, lifecycle, and audit control |
| Specialized key custody | CloudHSM only when required | Direct HSM and cryptographic control |
| Rotating credentials | Secrets Manager | Secret lifecycle and automatic rotation |
| Ordinary configuration | Parameter Store | Hierarchical configuration |
| Private AWS access | VPC endpoints | Avoid unnecessary public/NAT service paths |
| External processor access | Network Firewall + NAT | Controlled outbound public HTTPS |
| Immutable evidence | S3 Object Lock | Retention against overwrite or deletion |
| Threat detection | GuardDuty | Suspicious or malicious activity |
| Sensitive S3 discovery | Macie | Find sensitive data in S3 |
| Vulnerability management | Inspector | EC2, ECR, and Lambda vulnerability findings |
| Security aggregation | Security Hub | Correlate and prioritize security signals |
| Security posture | Security Hub CSPM | Standards and configuration checks |
| Investigation | Detective | Behavior-graph-based investigation |
| AWS compliance documents | Artifact | AWS reports, certifications, and agreements |
| Customer evidence | Config, CloudTrail, Security Hub, evidence lake | Demonstrate Northstar’s controls |
| Legacy evidence automation | Audit Manager recognition | Existing customers only |

---

# 5. Compliance begins with scope reduction

## 5.1 Do not collect data merely because it can be encrypted

Encryption is important, but it does not eliminate:

- access-control requirements;
- key-management requirements;
- logging risk;
- incident-response obligations;
- retention requirements;
- regulatory scope;
- insider risk.

The strongest protection for data that Northstar does not need is:

```text
Do not receive it.
Do not store it.
Do not log it.
```

Tokenization therefore precedes most other controls in the architecture.

---

## 5.2 Data classes

Northstar defines explicit classes.

| Class | Examples | Typical controls |
|---|---|---|
| Public | API documentation, public keys | Integrity and availability |
| Internal | service configuration, operational metadata | Authenticated access |
| Confidential | transaction details, dispute documents | Encryption, least privilege, monitoring |
| Restricted | processor credentials, signing keys, sensitive payment artifacts | Strong separation, narrow access, rotation |
| Audit evidence | CloudTrail, Config history, approvals | Integrity, immutability, restricted read |
| Prohibited | security codes after authorization, full raw card data outside approved flow | Prevent collection and retention |

A KMS key policy cannot repair a system that writes prohibited values into application logs.

---

## 5.3 Data-flow inventory

For each field, Northstar records:

```text
source
destination
purpose
legal/business basis
storage location
encryption
retention
authorized roles
logging behavior
replication behavior
```

Example:

```text
payment_token
    source: processor
    destination: payment service and transaction DB
    purpose: future capture/refund
    Region: tenant home Region
    retention: transaction lifecycle
    logs: never log full token
```

The architecture is reviewed around actual data flows rather than around a generic statement that “everything is encrypted.”

---

# 6. Account and Region boundaries

## 6.1 Dedicated payment accounts

Northstar uses separate accounts such as:

```text
northstar-pay-us-production
northstar-pay-eu-production
northstar-pay-nonproduction
northstar-security-tooling
northstar-log-archive-us
northstar-log-archive-eu
```

This separates:

- production from testing;
- US data from EU data;
- runtime access from security administration;
- security analysis from evidence storage.

The account boundary is not a substitute for encryption or application authorization, but it sharply reduces the ordinary administrative blast radius.

---

## 6.2 Region restrictions

An SCP prevents ordinary payment resources from being created outside approved Regions.

The policy must preserve access to required global AWS services and control planes rather than denying every nonmatching `aws:RequestedRegion` call indiscriminately.

Region restrictions are one guardrail among several:

```text
SCP
+
deployment pipeline
+
service configuration
+
Config rules
+
data-flow monitoring
```

An SCP cannot determine whether application code copies data to an already permitted destination inside another Region.

---

## 6.3 Region-specific names

Northstar uses explicit names:

```text
api.us.pay.northstar.example
api.eu.pay.northstar.example
```

rather than only:

```text
api.pay.northstar.example
    → geolocation routing
```

Geolocation routing guesses from the requester’s apparent location. It does not know the tenant’s contractual home Region.

---

## 6.4 Regional cells

Each cell owns:

```text
compute
database
secrets
KMS keys
queues
buckets
logs
deployment pipeline configuration
```

An EU transaction should not need to call a US KMS key or US database during ordinary operation.

This reduces both:

- residency ambiguity;
- cross-Region runtime dependencies.

---

# 7. Least privilege as a system property

## 7.1 Identity map

| Actor | Identity | Main authority |
|---|---|---|
| Customer | Northstar application identity | Submit and view own payments |
| Merchant system | OAuth client or mTLS identity | Use assigned merchant API operations |
| ALB | AWS-managed service operation | Forward network requests |
| Payment task | `PaymentRuntimeRole` | Perform payment runtime operations |
| Settlement task | `SettlementRole` | Produce and upload settlement batches |
| Reconciliation task | `ReconciliationRole` | Read provider results and reconcile |
| Notification task | `PaymentNotificationRole` | Send limited notifications |
| Key administrator | `PaymentKeyAdministrator` | Manage KMS key lifecycle and policy |
| Key user | Runtime role or approved cryptographic role | Use approved cryptographic operations |
| Security analyst | Federated investigation role | Read findings and selected evidence |
| Evidence reviewer | `AuditEvidenceReader` | Read immutable audit material |
| Firewall administrator | Delegated Firewall Manager role | Manage organizational firewall policies |
| Deployment pipeline | `PaymentDeploymentRole` | Deploy approved infrastructure and code |
| Break-glass operator | Time-limited emergency role | Exceptional recovery operations |

---

## 7.2 Public API identity is not IAM identity

A merchant calling Northstar Pay does not ordinarily become an IAM user.

The external interaction may use:

```text
OAuth client credentials
signed application token
mTLS client certificate
Northstar API key plus stronger authentication
```

The application verifies the merchant identity and authorizes the requested transaction.

IAM governs:

- AWS resource configuration;
- runtime calls from AWS workloads;
- administrative and deployment access.

---

## 7.3 Runtime-role separation

### `PaymentRuntimeRole`

Can:

```text
read the payment-processor secret
use the transaction encryption key
write payment state
publish approved payment events
write application metrics
```

Cannot:

```text
change the KMS key policy
schedule the key for deletion
read security evidence
modify WAF rules
deploy new task definitions
read every merchant's dispute archive
```

### `SettlementRole`

Can:

```text
read settlement-ready transactions
produce settlement files
write only the settlement prefix
sign an approved settlement artifact
```

It does not need to authorize live payments.

### `PaymentDeploymentRole`

Can:

```text
register task definitions
update ECS services
modify approved stacks
pass approved runtime roles
```

It does not need to decrypt payment records.

---

## 7.4 Key administration versus key use

A regulated design often separates:

```text
Key administrator:
    configure policy
    enable rotation
    manage alias
    disable key
    schedule deletion under controlled process

Key user:
    encrypt
    decrypt
    generate data keys
    sign or verify where approved
```

A key administrator does not automatically need `kms:Decrypt`.

A runtime role does not need `kms:PutKeyPolicy`.

This is separation of duties, not merely two differently named administrator roles.

---

## 7.5 Break-glass authority

The emergency role is:

- excluded from ordinary group assignment;
- protected by strong MFA;
- assumed only through an approved emergency procedure;
- session-limited;
- monitored immediately;
- reviewed after use.

A break-glass role that is used every Friday is an ordinary administrator role with misleading documentation.

---

# 8. AWS KMS mental model

## 8.1 What KMS provides

AWS KMS is a managed service for creating and controlling keys used to encrypt, decrypt, sign, and verify data. KMS keys are protected by AWS-managed HSM infrastructure and do not leave KMS unencrypted. 

The normal application interacts with:

```text
AWS KMS API
```

not directly with an individual hardware module.

---

## 8.2 Three ownership levels

### AWS-owned key

```text
Owned and managed entirely by AWS
Not visible or configurable by Northstar
Used transparently by some AWS services
```

Useful when encryption-by-default is sufficient and no customer-specific key policy is required. AWS-owned keys cannot be reconfigured, disabled, or audited as Northstar-owned KMS resources. 

### AWS-managed key

```text
Created in Northstar's account by an AWS service
AWS controls much of its policy and lifecycle
Visible through KMS
```

Usually named conceptually like:

```text
aws/s3
aws/rds
```

### Customer-managed key

```text
Created and controlled by Northstar
Key policy controlled by Northstar
Lifecycle and rotation choices controlled by Northstar
Can be disabled or scheduled for deletion
Usage appears in CloudTrail
```

Northstar uses customer-managed keys where the organization needs explicit control over:

- who may use the key;
- separation of duties;
- cross-account use;
- encryption context;
- rotation policy;
- disablement;
- deletion;
- evidence.

---

## 8.3 A key is not the encrypted data

The KMS key protects or unwraps other cryptographic material.

It does not contain:

```text
payment records
S3 objects
database rows
secrets
```

Disabling the key does not delete those objects. It can make them unreadable when decryption next requires the key.

---

## 8.4 Aliases

A KMS alias is a friendly pointer:

```text
alias/northstar-pay/transactions
```

The underlying key has its own key ID and ARN.

An alias can later point to another key. Therefore:

```text
Alias
    → operational name

Key ARN
    → exact cryptographic resource
```

Policies that rely on aliases must account for the fact that alias association can change.

---

# 9. Envelope encryption

## 9.1 Why KMS does not encrypt every large payload directly

Applications normally use **envelope encryption**:

```text
KMS key
    encrypts
data key

Data key
    encrypts
application data
```

A `GenerateDataKey` operation returns:

```text
plaintext data key
+
encrypted copy of data key
```

The application:

1. encrypts the payload locally with the plaintext data key;
2. immediately removes the plaintext key from memory when practical;
3. stores the encrypted payload;
4. stores the encrypted data-key copy with it.

To decrypt:

1. send the encrypted data key to KMS;
2. receive the plaintext data key when authorized;
3. decrypt the payload locally.

AWS KMS documents this exact data-key model, and AWS services such as S3 use envelope encryption for SSE-KMS. 

---

## 9.2 Conceptual record

```text
Encrypted transaction record
    ciphertext
    encrypted_data_key
    encryption_context
    algorithm/version metadata
```

The application does not store the plaintext data key.

---

## 9.3 Service-integrated encryption

Northstar does not need to implement client-side envelope encryption for every AWS resource.

Services such as:

```text
S3
Aurora
EBS
SQS
Secrets Manager
```

can integrate with KMS for service-side encryption.

Use application-level encryption only when there is an actual requirement beyond service-level encryption, such as:

- selected fields must remain encrypted from database administrators;
- ciphertext moves between storage systems;
- application-level cryptographic separation by tenant;
- external-format compatibility.

More layers of encryption also mean more key lifecycle, availability, and recovery obligations.

---

# 10. KMS authorization

## 10.1 Key policy

Every KMS key has exactly one key policy.

The key policy is the primary resource policy controlling access to that key. IAM policies and grants can participate, but the key policy determines whether IAM delegation is available or which principals are directly authorized. 

---

## 10.2 IAM policy alone may be insufficient

Suppose `PaymentRuntimeRole` has:

```json
{
  "Effect": "Allow",
  "Action": "kms:Decrypt",
  "Resource": "the-key-arn"
}
```

That grant is effective only when the key policy permits the relevant account or role to receive that authority.

```text
IAM allow
+
key policy does not permit it
    =
DENY
```

---

## 10.3 Key policy alone may delegate rather than directly grant

A default-style key-policy statement naming the account principal can allow the account to use IAM policies to delegate key permissions.

It does not mean that every identity in the account can automatically use the key. 

---

## 10.4 Cross-account KMS use

Suppose the regional Log Archive account owns an evidence key and a payment account must encrypt audit exports with it.

Cross-account use requires:

```text
Key policy in key-owning account
    allows payment account or specific role

AND

IAM policy on payment role
    allows use of exact key
```

AWS KMS explicitly requires both the key policy and the external account’s IAM delegation for cross-account use. 

The S3 bucket policy and KMS policy remain separate gates.

---

## 10.5 Grants

A KMS grant delegates a defined subset of key use, often to support integrated AWS services.

A grant can:

- permit selected cryptographic operations;
- constrain usage;
- be created and retired without rewriting the entire key policy.

Grants are particularly common when an AWS service needs temporary or resource-specific authority to use a key on a customer’s behalf.

---

## 10.6 Encryption context

An encryption context is a set of nonsecret key-value pairs supplied during encryption and required again during decryption.

Example:

```json
{
  "application": "northstar-pay",
  "tenant_id": "TENANT-42",
  "record_type": "refund-document"
}
```

KMS treats it as additional authenticated data.

It can also appear in CloudTrail and policy conditions.

Therefore:

```text
Do not put secrets in the encryption context.
```

When a different context is supplied for decryption, the operation fails. 

---

# 11. KMS lifecycle

## 11.1 Rotation

Rotation creates new cryptographic material for future encryption while preserving the ability to decrypt data protected under previous material.

Rotation does not:

- re-encrypt every existing object immediately;
- repair excessive key-user permissions;
- rotate application passwords;
- remove old encrypted data.

Northstar enables or schedules rotation according to the key type and approved key policy.

---

## 11.2 Disablement

Disabling a key is a reversible emergency control.

```text
KMS key disabled
    ↓
new cryptographic operations fail
    ↓
dependent applications and data may become unavailable
```

This is powerful containment but can become a self-inflicted outage.

---

## 11.3 Deletion

Scheduling key deletion is one of the most destructive operations in the environment.

Deleting a key can make encrypted data permanently unrecoverable even though:

- the S3 objects still exist;
- the Aurora snapshot still exists;
- Object Lock still protects the evidence;
- backups still exist.

Object Lock explicitly does not protect against loss or deletion of a KMS key needed to decrypt locked objects. 

Northstar restricts key deletion through:

```text
dedicated role
approval
MFA-backed emergency procedure
SCP where appropriate
CloudTrail alert
waiting period
dependency inventory
```

---

## 11.4 One key for everything is not simplification

A single organization-wide key would couple:

```text
all payment data
all logs
all backups
all Regions
all applications
```

to one policy and lifecycle.

Northstar normally separates keys by:

- Region;
- account;
- data purpose;
- blast radius;
- administrative ownership.

Too many keys add cost and management overhead, so the division should represent real control boundaries.

---

# 12. Multi-Region KMS keys and residency

## 12.1 Baseline: single-Region keys

AWS recommends ordinary single-Region KMS keys for most requirements. Northstar uses them because each payment cell should remain cryptographically independent. 

```text
EU ciphertext
    → EU KMS key

US ciphertext
    → US KMS key
```

---

## 12.2 Multi-Region key model

Related multi-Region KMS keys share:

- key ID;
- key material;
- certain cryptographic properties.

But each Regional replica has independently managed:

- key policy;
- grants;
- aliases;
- enabled state.

Multi-Region keys are useful when the same ciphertext or signature must be processed in several Regions without re-encryption. AWS recommends using them only when that requirement exists. 

---

## 12.3 Why Northstar does not use them by default

A multi-Region key intentionally places related key material in more than one Region.

That is valuable for some disaster-recovery and active-active workloads.

It is not the appropriate default when the desired property is:

```text
The European cryptographic boundary
must remain independent from the US boundary.
```

A multi-Region key does not itself replicate application data, but its use must still be reconciled with the organization’s residency and key-custody requirements.

---

# 13. KMS versus CloudHSM

## 13.1 The central distinction

```text
AWS KMS:
    managed key-management service
    AWS API and service integrations
    AWS manages HSM fleet and availability

AWS CloudHSM:
    dedicated HSM cluster
    customer controls HSM users and cryptographic objects
    applications can use PKCS#11/JCE/OpenSSL-style integrations
    customer owns more operational responsibility
```

CloudHSM provides end-to-end encrypted data-plane interaction and customer-managed HSM users outside ordinary IAM-role management. That additional control comes with additional responsibility. 

---

## 13.2 Baseline choice: KMS

Northstar chooses KMS because it needs:

- S3, Aurora, EBS, Secrets Manager, and application integration;
- highly available managed cryptographic APIs;
- key policies and grants;
- CloudTrail auditability;
- no custom cryptographic algorithm requirement;
- no requirement that Northstar directly administer every HSM user.

A regulated workload does not automatically require CloudHSM.

---

## 13.3 Choose direct CloudHSM when

A requirement explicitly calls for capabilities such as:

- exclusive customer management of HSM users;
- direct PKCS#11, JCE, or compatible cryptographic interfaces;
- cryptographic mechanisms not exposed through KMS;
- an application-managed certificate authority;
- legacy HSM-compatible application migration;
- explicit single-tenant HSM control;
- quorum-controlled HSM administration.

CloudHSM users and cryptographic operations have their own authentication model. IAM controls CloudHSM’s AWS control-plane APIs—such as cluster administration—but does not replace the HSM’s internal crypto-user system. 

---

## 13.4 CloudHSM network path

CloudHSM creates ENIs in selected customer subnets.

An application using CloudHSM needs:

```text
CloudHSM client
+
route to HSM ENIs
+
security-group permission
+
HSM user credentials
+
cryptographic key permissions
```

AWS recommends distributing HSMs across Availability Zones for availability. 

```text
Application
    ↓ CloudHSM client protocol
private VPC network
    ↓
HSM ENI in AZ A or B
    ↓
HSM cryptographic operation
```

An IAM `cloudhsm:DescribeClusters` permission does not authorize a direct cryptographic operation inside the HSM.

---

## 13.5 KMS custom key store

A KMS AWS CloudHSM key store combines:

```text
KMS API and many KMS integrations
+
key material and cryptographic operation in CloudHSM
```

AWS KMS creates the key material in the associated CloudHSM cluster, and KMS cryptographic operations are performed in that cluster. 

Use this only when there is a genuine requirement that KMS key material live in Northstar-controlled CloudHSMs.

---

## 13.6 Availability tradeoff

Ordinary KMS availability is largely managed by AWS.

A custom key store adds dependencies:

```text
KMS
+
custom-key-store connection
+
CloudHSM cluster health
+
HSM capacity
```

When the custom key store is disconnected, its KMS keys become unavailable for cryptographic operations. 

That means an architecture can satisfy a stricter key-custody requirement while becoming operationally less available.

---

## 13.7 Comparison

| Requirement | KMS | Direct CloudHSM | KMS CloudHSM key store |
|---|---:|---:|---:|
| Managed AWS key API | Yes | No | Yes |
| Broad AWS-service integration | Strong | Application-specific | Strong, subject to support |
| Customer manages HSM users | No | Yes | Partly; KMS uses dedicated HSM user |
| Direct PKCS#11-style application use | No | Yes | No; applications use KMS API |
| Custom cryptographic mechanisms | Limited to KMS offerings | Stronger | KMS-supported operations only |
| Customer operates HSM capacity | No | Yes | Yes |
| Additional network dependency | No application VPC dependency | Yes | KMS-to-HSM dependency |
| Ordinary baseline | Yes | Only with explicit requirement | Only with explicit requirement |

---

# 14. Secrets Manager versus Parameter Store

## 14.1 Secrets Manager

Northstar stores:

```text
payment processor API credential
database credential
merchant webhook signing secret
third-party OAuth client secret
private credential used by settlement integration
```

in Secrets Manager.

Secrets Manager is purpose-built to manage, retrieve, and rotate secrets. It supports automatic rotation for appropriate secrets and updates both the stored secret and the target database or service through the configured rotation process. 

---

## 14.2 Parameter Store

Northstar stores ordinary hierarchical configuration such as:

```text
/pay/eu/processor/base-url
/pay/eu/refund/max-days
/pay/eu/features/new-reconciliation
/pay/eu/settlement/cutoff-time
```

in Systems Manager Parameter Store.

Parameter Store supports:

```text
String
StringList
SecureString
```

and hierarchical names.

It can hold lightweight secrets, but it does not provide automatic secret rotation. AWS recommends Secrets Manager when credentials require automatic rotation, cross-account access, or fine-grained secret lifecycle auditing. 

The uploaded study guide uses the same exam-oriented rule: Parameter Store is a candidate when secret rotation is not required. 

---

## 14.3 `SecureString` does not make a value nonsecret

A Parameter Store `SecureString` is encrypted using KMS.

The application still needs:

```text
ssm:GetParameter
+
kms:Decrypt where applicable
```

The value must still be:

- excluded from logs;
- limited by IAM;
- rotated manually if needed;
- removed when no longer valid.

---

## 14.4 Secret rotation flow

Conceptually:

```text
AWSCURRENT:
    credential used by application

AWSPENDING:
    replacement under validation
```

A safe rotation process:

1. creates or changes the pending credential;
2. tests that it works;
3. promotes it;
4. retires the old credential after an overlap period where appropriate.

Rotation is a distributed change. The secret and the target system must agree.

---

## 14.5 Application caching

The payment service caches a secret only for a bounded period.

Potential failure:

```text
secret rotates successfully
    ↓
application retains old value indefinitely
    ↓
processor rejects requests
```

The client must:

- refresh after authentication failure;
- use bounded cache lifetime;
- tolerate a temporary overlap during rotation;
- avoid fetching the secret on every transaction unnecessarily.

---

# 15. AWS Certificate Manager and PKI

## 15.1 Public certificate

The Regional ALB uses an ACM-issued public certificate for:

```text
api.eu.pay.northstar.example
```

ACM manages public, private, and imported certificates and can manage renewal for eligible ACM-issued certificates. 

The certificate enables TLS and proves control of the endpoint’s name.

It does not determine:

- which merchant may call the API;
- which payment the merchant may access;
- whether the request body is valid;
- whether the transaction is authorized.

---

## 15.2 Certificate Region

An ALB uses a certificate in the ALB’s Region.

A CloudFront distribution, if later introduced, uses its viewer certificate through the CloudFront certificate requirements, conventionally in `us-east-1` for the standard distribution model. 

The same hostname can therefore involve different certificates at different TLS termination points.

---

## 15.3 ACM-issued versus imported certificates

### ACM-issued certificate

Advantages:

- integrated issuance;
- supported managed renewal;
- simpler attachment to AWS services.

### Imported certificate

Use when:

- a required external CA issued it;
- an existing enterprise PKI must remain authoritative;
- certificate properties are not available through the ACM issuance path.

Imported certificates require Northstar to obtain and reimport replacements when they expire. 

---

## 15.4 Current exportability distinction

Current ACM supports optional exportable public certificates.

```text
Nonexportable managed use:
    private key remains within ACM-integrated service path

Exportable public certificate:
    encrypted private key can be exported
    Northstar must protect its distribution and storage
```

Enabling export adds operational responsibility. It should not be selected merely because it is available. 

---

## 15.5 Private certificates

For internal mutual TLS, Northstar can use certificates issued through AWS Private CA and managed through ACM.

Examples:

```text
settlement client certificate
internal payment service identity
administrative service endpoint
```

Private certificates are not publicly trusted unless the relevant trust chain is installed.

The PKI design must include:

- issuing CA;
- trust distribution;
- revocation;
- certificate renewal;
- private-key storage;
- service identity mapping.

---

# 16. Network architecture

## 16.1 Subnet model

One payment Region contains:

```text
Public ingress subnet A
Public ingress subnet B
    ALB

Private application subnet A
Private application subnet B
    ECS Fargate tasks

Private endpoint subnet A
Private endpoint subnet B
    interface endpoint ENIs

Isolated database subnet A
Isolated database subnet B
    RDS Proxy
    Aurora

Firewall subnet A
Firewall subnet B
    Network Firewall endpoints

Public egress subnet A
Public egress subnet B
    NAT Gateways
```

Subnets are separated because the components have different routing and inspection requirements—not because naming a subnet `secure` changes packet behavior.

---

## 16.2 Public ingress route

```text
Customer
    ↓ HTTPS :443
Route 53 alias
    ↓
internet-facing ALB
    ↓
Payment task private IP
```

Only the ALB has public-facing network placement.

The payment tasks and database have no public addresses.

---

## 16.3 Security groups

### `ALB-SG`

```text
Inbound:
    TCP 443 from approved Internet sources
    or 0.0.0.0/0 when the service is globally public

Outbound:
    application port to Payment-SG
```

### `Payment-SG`

```text
Inbound:
    application port from ALB-SG

Outbound:
    PostgreSQL to RDSProxy-SG
    HTTPS to Endpoint-SG
    approved egress path
```

### `Endpoint-SG`

```text
Inbound:
    TCP 443 from Payment-SG
```

### `RDSProxy-SG`

```text
Inbound:
    TCP 5432 from Payment-SG

Outbound:
    TCP 5432 to Aurora-SG
```

### `Aurora-SG`

```text
Inbound:
    TCP 5432 from RDSProxy-SG
```

---

## 16.4 No “regulated workload” security group exists

A security group does not understand:

```text
PCI
financial transaction
customer consent
payment authorization
```

It understands network relationships:

```text
source
destination
protocol
port
```

Compliance comes from the complete system.

---

# 17. VPC endpoints

## 17.1 Interface endpoints

Northstar creates interface endpoints for services such as:

```text
KMS
Secrets Manager
CloudWatch Logs
ECR API
ECR registry
STS where required
```

An interface endpoint places endpoint ENIs with private addresses in selected subnets. Private DNS can cause ordinary regional service names to resolve to those private endpoint addresses. 

---

## 17.2 Gateway endpoint

S3 access from the payment VPC uses a gateway endpoint:

```text
S3 prefix list
    → S3 gateway endpoint
```

This avoids sending S3 traffic through NAT. Gateway endpoint traffic is selected through the associated subnet route tables. 

---

## 17.3 Endpoint policy

A VPC endpoint policy constrains which principals and operations may use the endpoint to reach the supported AWS service.

It does not grant the underlying service permission by itself.

```text
Endpoint policy allows
+
task role denies
    =
DENY
```

```text
Task role allows
+
endpoint policy denies
    =
DENY through that endpoint
```

AWS describes endpoint policies as an additional resource-based control that does not replace identity or service-resource policies. 

---

## 17.4 Endpoint does not make the service Regional-data-residency compliant

A private endpoint changes the network path.

It does not independently determine:

- where the AWS service stores data;
- whether the service replicates metadata;
- whether application code sends data elsewhere;
- which Region a resource was created in.

Network privacy and data residency are separate requirements.

---

# 18. Packet walk: customer payment request

```text
1. Merchant resolves:
       api.eu.pay.northstar.example

2. Route 53 returns the Regional ALB destination.

3. Merchant opens:
       TCP client-port → ALB:443

4. Shield provides DDoS protection at the supported edge/service layer.

5. WAF evaluates the HTTP request.

6. ALB terminates TLS using the ACM certificate.

7. ALB selects a healthy Payment target.

8. ALB-SG permits forwarding to Payment-SG.

9. Payment service authenticates the merchant.

10. Payment service checks:
       tenant
       amount
       currency
       idempotency key
       allowed operation

11. Application performs the payment workflow.

12. Result returns over the established connection.
```

WAF and TLS do not perform merchant-level payment authorization.

---

# 19. Packet walk: task retrieves a secret

```text
1. Payment task resolves the Secrets Manager regional name.

2. Private DNS returns the interface endpoint address.

3. Payment task opens HTTPS to Endpoint-SG.

4. Endpoint policy evaluates use of the endpoint.

5. Request is signed with PaymentRuntimeRole credentials.

6. Secrets Manager evaluates:
       task-role policy
       secret resource policy
       SCPs
       explicit denies

7. Secrets Manager uses KMS envelope encryption.

8. KMS authorization is evaluated on behalf of the request.

9. Secret value returns over the private endpoint path.
```

Secrets Manager uses KMS and data keys to protect secret values. Access may therefore depend on both secret permission and relevant KMS permission. 

---

# 20. Packet walk: task reaches Aurora

```text
1. Payment task resolves RDS Proxy endpoint.

2. VPC-local routing reaches proxy ENI.

3. Payment-SG permits outbound PostgreSQL.

4. RDSProxy-SG permits inbound from Payment-SG.

5. Proxy obtains or validates database credentials.

6. Proxy reuses or creates a backend database connection.

7. Aurora-SG permits connection from RDSProxy-SG.

8. PostgreSQL authenticates database user.

9. PostgreSQL authorizes transaction operations.

10. Transaction executes.
```

Possible interpretation:

```text
Timeout
    → DNS, route, SG, proxy, database listener

Password rejected
    → networking worked; authentication failed

Permission denied on table
    → networking and authentication worked;
      database authorization failed
```

---

# 21. Packet walk: external processor

The payment processor exposes a public HTTPS API.

```text
Payment task
    ↓ private-subnet route
Transit or local firewall route
    ↓
same-AZ Network Firewall endpoint
    ↓
NAT Gateway
    ↓
Internet Gateway
    ↓
processor endpoint:443
```

The return path must traverse the compatible NAT and stateful-firewall path.

The processor then evaluates:

```text
TLS
client credential
merchant or platform account
requested operation
idempotency key
```

A VPC interface endpoint cannot be created for an arbitrary public processor unless that provider publishes a supported PrivateLink service.

---

# 22. WAF, Shield, Network Firewall, and Firewall Manager

## 22.1 AWS WAF

WAF inspects supported Layer 7 web requests.

Northstar uses rules for:

```text
known exploit patterns
malformed requests
excessive request rates
unexpected countries where business policy allows
known malicious IP sets
request-size limits
approved HTTP methods
```

A rate-based rule can slow or block an abusive source.

WAF does not know whether a refund is valid.

---

## 22.2 Shield Standard

Shield Standard is enabled automatically and protects against common network and transport-layer DDoS attacks at no additional Shield subscription cost. 

---

## 22.3 Shield Advanced

Northstar subscribes the critical payment ingress to Shield Advanced because an outage has high financial impact.

Shield Advanced adds enhanced detection, visibility, and response capabilities for explicitly protected supported resources. It does not automatically protect every resource merely because the account is subscribed. 

---

## 22.4 Network Firewall

Network Firewall inspects routed network traffic.

Northstar uses it for:

```text
outbound destination policy
known malicious destination blocking
protocol enforcement
central network logging
selected intrusion detection/prevention
```

It does not replace:

- WAF for HTTP semantics;
- security groups for service relationships;
- NAT for address translation;
- IAM for AWS API authorization.

The uploaded guide likewise models Network Firewall as firewall, firewall policy, and stateless/stateful rule groups, with route tables required to send traffic through the endpoints. 

---

## 22.5 Firewall Manager

Firewall Manager centrally manages security policies across accounts and resources.

Supported policy families include:

- WAF;
- Shield Advanced;
- security groups;
- network ACLs;
- Network Firewall;
- Route 53 Resolver DNS Firewall;
- supported third-party firewall policies. 


### Memory rule

```text
WAF / Network Firewall / Shield:
    provide protection

Firewall Manager:
    distributes and governs protection policies
```

Firewall Manager does not inspect a packet itself.

---

## 22.6 Organizational scope

Northstar uses its Security Tooling account as Firewall Manager administrator and applies policies by:

```text
OU
account
resource type
resource tag
Region
```

Firewall Manager requires AWS Organizations all-features mode and organization-level setup. Many policies also rely on Config being enabled in covered accounts and Regions. 

A new account entering the Payment Production OU can therefore receive the required protection automatically.

---

# 23. Security-service map

| Question | Primary service |
|---|---|
| Is an AWS identity or workload behaving suspiciously? | GuardDuty |
| Does S3 contain sensitive data unexpectedly? | Macie |
| Does this image, EC2 instance, or Lambda have known vulnerabilities? | Inspector |
| Which findings are most important across the organization? | Security Hub |
| Do resources satisfy configured security standards? | Security Hub CSPM |
| What events and entities explain this threat? | Detective |
| What configuration did the resource have? | Config |
| Who called which AWS API? | CloudTrail |
| Is web traffic malicious? | WAF |
| Is routed network traffic prohibited or suspicious? | Network Firewall |
| Are firewall policies consistently deployed? | Firewall Manager |
| What AWS reports and agreements can be supplied to an auditor? | Artifact |
| What evidence demonstrates Northstar’s controls? | Config, CloudTrail, findings, records, or Audit Manager for existing customers |

These services are complementary. None is “the AWS security service.”

---

# 24. Amazon GuardDuty

## 24.1 Purpose

GuardDuty is a continuous threat-detection service.

It analyzes AWS data sources and uses threat intelligence and behavioral techniques to identify suspicious or potentially malicious activity. 

Examples include:

```text
stolen credential behavior
unexpected API calls
communication with malicious infrastructure
malware-related activity
suspicious data-access behavior
```

---

## 24.2 GuardDuty is not a firewall

A finding means:

> GuardDuty observed activity that may represent a threat.

It does not mean:

- the request was blocked;
- the credential was revoked;
- the workload was isolated;
- the incident was confirmed.

Response requires a playbook.

---

## 24.3 Organization deployment

GuardDuty is Regional.

Northstar designates the same Security Tooling account as delegated administrator in every required Region and configures automatic member enrollment and relevant protection plans. AWS recommends using a member account rather than the organization management account as the delegated administrator. 

Enabling it in `us-east-1` does not automatically prove that it is enabled in `eu-west-1`.

---

# 25. Amazon Macie

## 25.1 Purpose

Macie discovers and reports sensitive data in Amazon S3 by using pattern matching and machine-learning techniques. 

Northstar uses it to detect:

```text
raw card numbers in an analytics export
identity-document data in the wrong bucket
processor credentials accidentally written to S3
unprotected dispute documents
unexpectedly public or shared sensitive buckets
```

---

## 25.2 Automated discovery versus jobs

### Automated sensitive-data discovery

Provides broad, continuing visibility using daily inventory evaluation and sampling.

### Sensitive-data discovery job

Targets explicitly selected buckets, prefixes, time windows, or data classes. 


Northstar uses:

```text
automated discovery
    → broad organizational visibility

targeted jobs
    → high-assurance payment and evidence locations
```

---

## 25.3 Macie is S3-focused

Macie does not directly crawl every Aurora row.

To analyze data originating elsewhere, Northstar would need an approved export into S3 and then run a discovery job. AWS explicitly documents this export-to-S3 pattern for sources such as RDS, Aurora, or DynamoDB. 

### Exam hinge

```text
Sensitive data in S3:
    Macie

Known software vulnerability:
    Inspector

Suspicious runtime behavior:
    GuardDuty
```

---

## 25.4 A Macie finding does not prove exfiltration

A finding may prove:

```text
sensitive data exists in this object
```

It does not necessarily prove:

```text
an attacker read it
```

Investigate access through:

- CloudTrail data events;
- S3 access information;
- GuardDuty;
- application logs;
- Detective.

---

# 26. Amazon Inspector

## 26.1 Purpose

Inspector continually scans supported:

```text
EC2 instances
ECR container images
Lambda functions
```

for software vulnerabilities and unintended network exposure. 

Northstar uses it for:

- payment container images in ECR;
- supporting Lambda functions;
- any EC2-based security or legacy components.

---

## 26.2 Build scan versus continuous vulnerability management

An image may be clean when built.

A new CVE can be published tomorrow.

With the relevant continuous-scanning configuration, Inspector can reassess images when new vulnerability intelligence becomes available. 

Therefore:

```text
Passed deployment scan
    ≠
permanently vulnerability-free
```

---

## 26.3 Inspector does not detect stolen credentials

Inspector answers:

> Which known vulnerabilities or exposure conditions affect this workload?

GuardDuty answers:

> Is this identity or workload behaving suspiciously?

A clean Inspector result does not prove that the runtime identity is uncompromised.

---

## 26.4 Coverage

Northstar monitors not only findings but also scan coverage.

```text
No findings
```

can mean:

```text
nothing vulnerable was detected
```

or:

```text
the resource was not being scanned
```

Security Hub coverage findings can also identify missing GuardDuty, Inspector, Macie, or Security Hub CSPM coverage. 

---

# 27. Security Hub and Security Hub CSPM

## 27.1 Current distinction

### AWS Security Hub

The current unified service:

- ingests signals from services such as GuardDuty, Inspector, Macie, and posture management;
- correlates and enriches signals;
- prioritizes critical security issues;
- helps coordinate response. 


### Security Hub CSPM

The posture-management capability:

- runs security controls;
- evaluates standards and best practices;
- aggregates compliance status;
- receives findings from integrated services;
- supports central multi-account and multi-Region configuration. 


---

## 27.2 Exam-era mental model

For SAP-C02 questions, the following remains a useful approximation:

```text
Security Hub
    → central security findings
    → standards and posture view
```

But for current architectural work, recognize the CSPM naming and configuration split.

---

## 27.3 Security Hub does not replace source services

Security Hub can display and correlate an Inspector finding.

It does not perform the image scan itself.

It can show a GuardDuty finding.

It does not independently analyze every GuardDuty source.

It can surface Macie sensitive-data findings.

It does not inspect the S3 object in place of Macie.

---

## 27.4 Central configuration

The delegated administrator can use Security Hub CSPM configuration policies to manage:

- service enablement;
- security standards;
- controls;
- control parameters;

across selected accounts, OUs, and linked Regions. 

This is preferable to manually configuring every payment account independently.

---

# 28. Amazon Detective

## 28.1 Purpose

Detective helps an analyst investigate security findings by constructing a behavior graph from sources such as:

```text
CloudTrail
VPC Flow Logs
GuardDuty findings
```

It links entities and activity over time to support root-cause analysis. 

---

## 28.2 Example investigation

GuardDuty reports:

```text
PaymentRuntimeRole made unusual KMS and S3 calls
from an unexpected network source.
```

In Detective, an analyst investigates:

```text
Which role session was involved?
Which IP addresses interacted with it?
What API calls occurred before and after?
Which resources were contacted?
Is the behavior new?
Are related findings present?
Which other identities used the same infrastructure?
```

---

## 28.3 Detective is not the primary detector

Detective usually begins after a suspicious finding or hypothesis.

```text
GuardDuty:
    detect suspicious activity

Security Hub:
    correlate and prioritize

Detective:
    investigate context and relationships
```

Detective does not replace immediate containment.

---

# 29. Findings and response pipeline

## 29.1 Common flow

```text
Security service
    ↓ finding
Security Hub
    ↓ normalization / correlation / prioritization
EventBridge
    ↓
triage workflow
    ├── notify responder
    ├── collect evidence
    ├── open incident
    ├── invoke approved Automation
    └── suppress or close after review
```

---

## 29.2 Automatic remediation should be narrow

Good automatic actions may include:

```text
apply missing S3 public-access block
quarantine one known-malicious network path
disable one newly exposed access key
tag resource for isolation
capture snapshots and evidence
```

Risky automatic actions include:

```text
delete production database
disable every KMS key
terminate all payment tasks
block all merchant traffic
```

A security finding is evidence with severity and confidence—not always complete proof.

---

## 29.3 Preserve evidence before destructive containment

Where response time permits:

```text
capture relevant logs
record current configuration
snapshot storage
preserve image digest
record session identity
```

before terminating or rebuilding the resource.

Containment remains the priority when ongoing harm is likely, but incident response should avoid destroying the only useful evidence.

---

# 30. Incident example: sensitive card data in S3

## 30.1 Detection

Macie produces a finding:

```text
Possible payment-card number
in:
s3://northstar-analytics-eu/ad-hoc-export.csv
```

---

## 30.2 Triage

The security workflow asks:

```text
Is this a true positive?
Who owns the bucket?
Is the object encrypted?
Is the bucket externally accessible?
Who has read it?
How was it created?
Does the object contain prohibited data?
Does it belong in this Region?
```

---

## 30.3 Evidence sources

```text
Macie:
    what sensitive pattern exists

CloudTrail:
    who created and read the object

Config:
    bucket and policy configuration over time

GuardDuty:
    suspicious access behavior

Detective:
    related identities, IPs, and activity

Security Hub:
    consolidated issue and related signals
```

---

## 30.4 Response

Possible response:

1. restrict object and bucket access;
2. preserve a controlled evidence copy;
3. determine all access;
4. remove prohibited copies under approved retention policy;
5. rotate exposed credentials if any;
6. correct the exporting application;
7. run targeted Macie jobs for similar objects;
8. update preventive pipeline controls;
9. complete required notification and audit processes.

Simply deleting the object may destroy evidence without proving that other copies do not exist.

---

# 31. Incident example: compromised runtime role

## 31.1 GuardDuty finding

GuardDuty reports anomalous use of:

```text
PaymentRuntimeRole
```

The role is calling:

```text
s3:ListAllMyBuckets
kms:ListKeys
secretsmanager:ListSecrets
```

from an unexpected context.

---

## 31.2 Containment questions

```text
Can the ECS task be isolated?
Can the task role policy be restricted temporarily?
Must sessions be invalidated?
Is the task image compromised?
Did a secret leak?
Can payment processing fail over safely?
```

---

## 31.3 Investigation

Detective and CloudTrail help reconstruct:

```text
initial task deployment
role-session activity
network connections
resource access
related findings
timeline
```

Inspector determines whether the deployed image has a relevant known vulnerability.

Macie determines whether suspicious S3 objects contain sensitive data.

Each service answers a different question.

---

# 32. Evidence architecture

## 32.1 Evidence categories

Northstar needs evidence of:

```text
AWS provider controls
Northstar infrastructure configuration
Northstar user and API activity
software vulnerability status
security findings and response
production change approval
key usage
data access
backup and recovery tests
```

No single AWS service provides all of this.

---

## 32.2 CloudTrail

CloudTrail records AWS API activity such as:

```text
Who changed the KMS key policy?
Who disabled GuardDuty?
Who associated a new WAF ACL?
Who read a secret?
Who scheduled key deletion?
Which role modified the evidence bucket?
```

Selected high-value data events are enabled where object- or function-level access evidence is required.

---

## 32.3 AWS Config

Config records:

```text
resource configuration
configuration history
resource relationships
compliance evaluations
```

Examples:

```text
Was the S3 bucket public at any point?
Was the payment database publicly accessible?
Did a security group allow an unapproved source?
Was encryption configured?
```

CloudTrail and Config remain complementary:

```text
CloudTrail:
    who performed the action

Config:
    what the resource state became
```

---

## 32.4 Security findings

Northstar retains:

```text
GuardDuty findings
Macie findings and discovery results
Inspector findings
Security Hub issues and posture findings
Detective case references
remediation records
```

Finding retention should preserve:

- original evidence;
- analyst disposition;
- timestamps;
- remediation action;
- exception approval;
- closure rationale.

---

# 33. S3 Object Lock

## 33.1 Purpose

The regional evidence buckets use:

```text
S3 Versioning
+
S3 Object Lock
+
KMS encryption
```

Object Lock works with versioned buckets and protects individual object versions from overwrite or deletion according to retention or legal-hold rules. 

---

## 33.2 Governance mode

In governance mode, users normally cannot overwrite or delete protected versions unless they have explicit bypass authority such as:

```text
s3:BypassGovernanceRetention
```

Use it when trusted administrators need a controlled exceptional override. 

---

## 33.3 Compliance mode

In compliance mode, a protected object version cannot be overwritten or deleted—even by the account root user—until its retention period expires. The retention mode cannot be weakened and its retention date cannot be shortened. 

This is a strong and potentially dangerous commitment.

A mistaken 100-year retention policy cannot be casually reversed.

---

## 33.4 Legal hold

A legal hold prevents overwrite or deletion without using an expiration date.

It remains until explicitly removed by an authorized operation. 

```text
Retention period:
    time-based protection

Legal hold:
    case-based indefinite protection
```

---

## 33.5 Object Lock is not backup by itself

Object Lock protects object versions from deletion or overwrite.

It does not automatically protect against:

- loss of the KMS key;
- unauthorized reading;
- Region-wide loss without another recovery copy;
- missing objects that were never written;
- incorrect evidence;
- an unavailable application used to query the evidence.

---

# 34. AWS Artifact versus customer evidence

## 34.1 AWS Artifact

Artifact provides:

- AWS security and compliance reports;
- certifications and audit documents;
- selected third-party reports;
- AWS agreements and agreement status. 


Examples include provider-side evidence concerning AWS infrastructure and services.

Artifact answers:

> What independent reports and agreements are available concerning AWS and its controls?

---

## 34.2 Artifact does not inspect Northstar

Downloading an AWS report does not prove that Northstar:

- encrypted its database;
- configured least privilege;
- retained CloudTrail;
- rotated credentials;
- blocked public access;
- tested recovery.

AWS explicitly states that customers remain responsible for evidence concerning their own companies and systems. 

---

## 34.3 Agreements

Artifact can also be used to review and manage certain agreements for an account or organization.

Agreement acceptance is a legal and organizational process, not a technical shortcut. AWS recommends involving legal, privacy, and compliance teams. 

---

# 35. AWS Audit Manager

## 35.1 Exam-era purpose

The uploaded material defines the useful distinction:

```text
Artifact:
    evidence about AWS infrastructure and agreements

Audit Manager:
    collect and organize evidence about the customer's
    AWS usage against control frameworks
```



Audit Manager can collect evidence from services such as:

```text
CloudTrail
Config
Security Hub CSPM
```

and organize it into assessments and controls. 

---

## 35.2 It does not certify compliance

Audit Manager helps collect, review, and manage evidence.

It does not independently decide that Northstar is legally compliant or that a control is effective in its full business context.

Human review and external assessment remain necessary.

---

## 35.3 Current architecture

Because Audit Manager is unavailable for setup in new accounts, Northstar’s new platform uses:

```text
CloudTrail organization trails
Config organization conformance packs
Security Hub CSPM
security-service findings
S3 immutable evidence buckets
deployment and change records
external or internally built GRC workflows
```

Existing Audit Manager customers can continue using it while planning for its maintenance-only future. 

### Exam memory

```text
Question asks for AWS reports and agreements:
    Artifact

Question asks to automate collection of evidence
about the customer's AWS usage:
    Audit Manager
```

---

# 36. Data-residency architecture

## 36.1 Region selection is explicit

Tenant creation stores:

```text
tenant_id
home_region
approved_processors
data_classification
retention_policy
```

Every request is routed to the tenant’s designated endpoint.

A mismatch is rejected rather than silently forwarded across Regions.

---

## 36.2 Data services remain Regional

The EU cell uses EU resources for:

```text
Aurora
S3
Secrets Manager
KMS
SQS/EventBridge where applicable
CloudWatch logs
security-service processing configuration
evidence bucket
```

No automatic cross-Region replication is enabled unless the residency and recovery design explicitly permits it.

---

## 36.3 Security aggregation requires care

Central security visibility does not mean that every raw payload must be copied to one global account or Region.

Northstar distinguishes:

```text
finding metadata
configuration metadata
audit records
raw customer data
recordings or documents
```

A central security team may receive finding metadata while sensitive business data remains in-region.

---

## 36.4 Global services and metadata

A data-residency statement must be validated service by service.

Some AWS services use global control planes or globally distributed infrastructure even when the underlying workload resource is Regional.

Therefore, the architecture team does not make an unsupported claim such as:

> “Every byte and every piece of metadata remains physically within this Region.”

It documents precisely:

- which customer data is stored;
- where it is processed;
- which control-plane metadata exists;
- which logs or findings leave the Region;
- which service commitments apply.

---

## 36.5 Multi-Region recovery tension

A requirement for strict Regional isolation can conflict with:

```text
cross-Region backup
active-active availability
global evidence aggregation
multi-Region keys
```

The business must define the priority and permitted destinations.

There is no architecture that simultaneously keeps the only data copy inside one Region and also guarantees recovery after permanent loss of that Region.

---

# 37. Reliability model

## 37.1 Application task failure

```text
Fargate task fails
    ↓
ALB health check removes target
    ↓
ECS restores desired capacity
    ↓
other tasks continue
```

Authoritative transaction state remains outside the task.

---

## 37.2 Availability Zone failure

```text
AZ A fails
    ↓
ALB uses healthy AZ B targets
    ↓
ECS launches replacement capacity
    ↓
Aurora performs the appropriate Multi-AZ recovery
    ↓
same-AZ endpoint, firewall, and NAT paths remain in AZ B
```

Availability requires every critical network tier to exist across the intended AZs.

---

## 37.3 KMS outage or policy failure

A payment service may remain computationally healthy but be unable to:

```text
decrypt secret
generate data key
read encrypted database snapshot
write encrypted object
```

KMS is therefore a critical application dependency whenever cryptographic operations are on the synchronous path.

Monitor KMS errors separately from ordinary database or application failures.

---

## 37.4 Secret rotation failure

Possible sequence:

```text
new processor credential created
    ↓
Secrets Manager promotes it
    ↓
processor-side activation actually failed
    ↓
all payment requests receive authentication errors
```

Rotation requires a valid test step and rollback strategy.

---

## 37.5 Network Firewall failure or routing mistake

A healthy firewall resource does not help if:

```text
route bypasses it
```

A bad route can also send legitimate traffic into a blackhole or asymmetric path.

Network policy rollout should test:

- approved processor call;
- denied destination;
- return path;
- each AZ;
- failover.

---

## 37.6 Security-tooling outage

Temporary unavailability of Security Hub or Detective should not necessarily stop every payment transaction.

The preventive runtime controls remain:

```text
IAM
WAF
security groups
KMS
application authorization
```

But loss of required monitoring creates a degraded security state that must alarm and may require controlled operational action.

---

## 37.7 Region failure

One Regional cell does not survive complete loss of its Region.

A recovery design must decide whether EU data may be replicated to:

```text
another EU Region
```

and whether its cryptographic keys and secrets may also exist there.

A multi-Region key, replicated database, and second payment service are separate requirements. None creates the others automatically.

---

# 38. Cost model

Major costs include:

```text
customer-managed KMS keys and API operations
Secrets Manager secrets and API operations
CloudHSM HSM instances if used
ACM Private CA if used
interface VPC endpoints
Network Firewall
NAT Gateway
WAF requests and managed rule groups
Shield Advanced subscription
GuardDuty data analysis and protection plans
Macie object analysis
Inspector scanning
Security Hub / CSPM
Detective data ingestion
CloudTrail data events
Config configuration items and evaluations
S3 evidence retention
Object Lock-compatible storage
cross-account and cross-Region transfer
```

---

## 38.1 KMS cost optimization

Do not call KMS for every byte.

Envelope encryption and service integration reduce the number of direct cryptographic calls.

For high-volume SSE-KMS S3 workloads, S3 Bucket Keys can reduce KMS request volume while preserving SSE-KMS protection. 

---

## 38.2 CloudHSM fixed cost

CloudHSM requires an HSM cluster sized for:

- performance;
- maintenance;
- Availability Zone failure;
- durability.

It therefore carries substantial fixed cost and operational responsibility compared with ordinary KMS.

Use it because a specific control requires it—not because the word “regulated” appears in the question.

---

## 38.3 VPC endpoint versus NAT

Interface endpoints have hourly and data-processing costs.

NAT has hourly and data-processing costs.

Use endpoints where they improve:

- privacy;
- availability;
- policy;
- high-volume AWS service access.

Retain NAT or an approved proxy for external payment processors that expose public endpoints.

---

## 38.4 Security service scope

Not every service needs the same depth in every account.

Examples:

```text
Macie:
    prioritize buckets likely to contain confidential data

Inspector:
    scan actual supported workloads and images

CloudTrail data events:
    enable for high-value resources rather than every low-risk object

Contact or payload logs:
    avoid collecting unnecessary sensitive content
```

Cost optimization should not create unmonitored security blind spots.

Coverage itself must be measured.

---

## 38.5 Evidence retention

Seven years of:

```text
verbose application logs
every WAF request
every object data event
duplicate security findings
```

can be expensive.

Classify evidence:

```text
mandatory immutable evidence
operational logs
debug logs
derived reports
duplicated copies
```

Then assign retention and storage class deliberately.

---

# 39. Changed-requirement variants

## Variant 1: Regulator requires direct single-tenant HSM control

Use AWS CloudHSM.

The application must manage:

- HSM users;
- crypto-user credentials;
- client libraries;
- key creation and sharing;
- cluster sizing;
- Availability Zone distribution;
- backup and recovery;
- cryptographic throughput.

Do not assume ordinary KMS satisfies a direct-HSM-interface requirement.

---

## Variant 2: AWS services must use HSM-backed customer-controlled key material

Use a KMS AWS CloudHSM custom key store where the service integration supports the intended KMS key use.

This preserves the KMS API but adds CloudHSM availability and operations to the dependency chain.

---

## Variant 3: Processor offers PrivateLink

Replace public egress:

```text
Network Firewall
→ NAT
→ Internet
```

with:

```text
Payment task
→ interface endpoint
→ PrivateLink
→ processor endpoint service
```

Application authentication, processor authorization, endpoint policy, and security groups remain required.

---

## Variant 4: No client data may pass through a global edge network

Keep a Regional ingress such as the baseline ALB or Regional API endpoint.

Do not insert CloudFront solely because it is a common web best practice.

---

## Variant 5: Raw card data must enter Northstar

Create a tightly isolated cardholder-data path:

- dedicated endpoint and service;
- stricter IAM and network segmentation;
- field-level or application-layer encryption;
- no ordinary payload logging;
- tokenization immediately after receipt;
- narrower operational access;
- separate evidence and retention;
- independent threat model.

This materially changes the compliance boundary.

---

## Variant 6: Business-to-business callers only

Remove public Internet ingress where possible.

Expose the payment service through:

- PrivateLink;
- private API Gateway;
- VPN or Direct Connect;
- controlled partner connectivity.

The merchant still needs application identity and authorization.

---

## Variant 7: Same ciphertext must be processed in two permitted Regions

Consider KMS multi-Region keys.

First confirm:

- data is allowed in both Regions;
- identical key material is acceptable;
- key policies are independently configured;
- application data and secrets are replicated separately;
- failover is tested.

---

## Variant 8: Secret never rotates and is low risk

A Parameter Store `SecureString` may be sufficient.

Document:

- owner;
- manual replacement process;
- KMS key;
- access policy;
- expiry or review date.

“No automatic rotation” should be an explicit requirement, not an accidental omission.

---

## Variant 9: External CA certificate is mandatory

Import the externally issued certificate into ACM.

Northstar owns renewal monitoring and reimport.

Do not assume ACM will automatically renew a certificate it did not issue.

---

## Variant 10: Existing account already uses Audit Manager

Continue using existing assessments and evidence collection while:

- retaining exported assessment evidence;
- documenting service maintenance status;
- planning a future evidence-management path.

---

# 40. Failure drills

## Failure A: Runtime role has `kms:Decrypt`, but KMS returns `AccessDenied`

Investigate:

```text
key policy
correct key ARN
IAM delegation enabled
SCP
permissions boundary
grant
encryption context condition
key state
```

IAM permission alone may not be sufficient.

---

## Failure B: Key policy grants the whole account, but the role is denied

The account grant may only enable IAM delegation.

Investigate whether the role has the required IAM permission.

---

## Failure C: Cross-account S3 read succeeds, but decryption fails

The S3 bucket policy allowed object access.

The external role also needs:

- KMS key-policy permission in the key account;
- IAM `kms:Decrypt` permission;
- correct encryption-context conditions.

---

## Failure D: Key administrator can read transaction plaintext

The key policy combined key administration and key usage.

Separate administrative operations from `Encrypt`, `Decrypt`, and `GenerateDataKey`.

---

## Failure E: Decryption fails only for one tenant

The stored or supplied encryption context may not match.

Check:

```text
tenant ID
record type
case and spelling
serialization
key version
```

---

## Failure F: Object Lock protects evidence, but files are unreadable

The KMS key may be disabled, deleted, or inaccessible.

Immutability does not preserve cryptographic usability.

---

## Failure G: Custom key store shows `DISCONNECTED`

KMS keys in the custom store cannot perform cryptographic operations.

Restore the KMS-to-CloudHSM connection and validate HSM health before treating application failures as data corruption.

---

## Failure H: One CloudHSM HSM fails and throughput collapses

The cluster may have been sized for normal demand without failure headroom.

CloudHSM availability and capacity are customer design responsibilities.

---

## Failure I: IAM administrator can create a CloudHSM cluster but cannot use a cryptographic key

IAM governs the AWS CloudHSM control plane.

The HSM’s internal user and key permissions govern direct cryptographic operations.

---

## Failure J: Processor credential rotates, but applications continue using the old value

The task cached the secret indefinitely or received it only at startup.

Refresh the value or redeploy tasks according to the chosen secret-delivery pattern.

---

## Failure K: Parameter Store credential never rotates

Parameter Store does not provide automatic secret rotation.

Use Secrets Manager when rotation is required.

---

## Failure L: ALB certificate expires although it is stored in ACM

It may be an imported certificate, or managed renewal prerequisites may have failed.

Inspect certificate origin, validation, renewal status, and attachment.

---

## Failure M: WAF blocks valid payment requests

Possible causes:

```text
managed-rule false positive
body-size handling
JSON encoding
rate aggregation too broad
merchant NAT concentration
method allowlist
```

Use count mode, sampled requests, logs, and narrowly scoped exceptions rather than disabling the whole ACL.

---

## Failure N: Shield Advanced subscription exists, but one ALB is not protected

Shield Advanced protects explicitly selected resources or those covered by a Firewall Manager policy.

Subscription alone is insufficient.

---

## Failure O: Firewall Manager policy does not cover a new account

Investigate:

```text
OU or account scope
resource type
resource tags
Region
Firewall Manager administrator
AWS Config coverage
policy remediation setting
```

---

## Failure P: Network Firewall is healthy, but processor traffic bypasses it

The route tables do not place the firewall endpoint on the path.

A deployed firewall is not automatically inline.

---

## Failure Q: Payment task can reach Secrets Manager only through NAT

Private DNS or the interface endpoint route/security configuration may be wrong.

The endpoint may exist without being used.

---

## Failure R: VPC endpoint works, but Secrets Manager returns `AccessDenied`

The private path succeeded.

Investigate IAM, secret resource policy, endpoint policy, KMS, and SCPs.

---

## Failure S: All AWS endpoints work, but payment processor is unreachable after NAT removal

VPC endpoints cover supported AWS services.

They do not provide a path to an arbitrary public payment processor.

---

## Failure T: Macie reports no sensitive data in Aurora

Macie is S3-focused.

Export approved data to S3 for a targeted job or use a database-specific assessment process.

---

## Failure U: Inspector reports no vulnerabilities, but the task role is compromised

Inspector is vulnerability management.

GuardDuty, CloudTrail, and Detective address suspicious activity and investigation.

---

## Failure V: GuardDuty generates a high-severity finding, but traffic continues

GuardDuty detects; it does not automatically block.

A response workflow must apply containment.

---

## Failure W: Detective has little useful context

Possible causes:

```text
service not enabled in the Region
member account not participating
insufficient historical data
source coverage missing
finding not from supported context
```

---

## Failure X: Security Hub shows no findings from one account

Investigate:

```text
member enrollment
delegated administrator
Region
source-service enablement
integration
central configuration policy
coverage findings
```

---

## Failure Y: Audit Manager cannot be enabled in the new compliance account

This is expected after the April 30, 2026 availability change.

Use the current evidence architecture and retain Audit Manager as exam/existing-estate knowledge.

---

## Failure Z: Auditor receives an AWS SOC report, but rejects Northstar’s evidence package

Artifact supplied evidence about AWS’s controls.

Northstar still needs evidence concerning its own configuration, access, changes, and operations.

---

## Failure AA: EU data appears in a US evidence bucket

Centralization violated the residency design.

Review:

```text
organization trail destination
application log subscription
Security Hub finding export
Macie results repository
backup replication
incident evidence copies
```

---

## Failure AB: Merchant receives `403` from WAF but no application logs exist

The request was rejected before it reached the payment application.

Inspect WAF logs and rule matches rather than searching only ECS logs.

---

## Failure AC: Payment API times out, while ALB and ECS look healthy

Investigate:

```text
RDS Proxy
Aurora locks
KMS latency/errors
Secrets Manager
processor egress
Network Firewall
NAT
downstream throttling
```

A healthy container process does not prove the transaction dependency chain is healthy.

---

# 41. SAP-C02 decision snippets

## KMS versus CloudHSM

**Requirement:** Managed encryption keys integrated with S3, EBS, RDS, and other AWS services.

```text
AWS KMS
```

**Requirement:** Direct control of dedicated HSMs, HSM users, and PKCS#11-compatible operations.

```text
AWS CloudHSM
```

**Requirement:** KMS API with cryptographic key material inside CloudHSM.

```text
KMS custom key store backed by CloudHSM
```

---

## AWS-owned versus AWS-managed versus customer-managed key

```text
Transparent service encryption, no customer key administration:
    AWS-owned key

Service-created visible key with limited customer control:
    AWS-managed key

Explicit policy, lifecycle, cross-account, and audit control:
    customer-managed key
```

---

## Key policy versus IAM policy

```text
Resource-side authority on the KMS key:
    key policy

Authority delegated to a role:
    IAM policy
```

Cross-account KMS use ordinarily needs both.

---

## Envelope encryption

```text
KMS key
    → encrypts data key

Data key
    → encrypts payload
```

Do not send large application datasets to KMS as though it were bulk-storage encryption.

---

## Secrets Manager versus Parameter Store

**Credential requires rotation:**

```text
Secrets Manager
```

**Hierarchical configuration or lightweight nonrotating secure value:**

```text
Parameter Store
```

---

## ACM-issued versus imported certificate

```text
AWS-integrated managed certificate lifecycle:
    ACM-issued certificate

Required external CA certificate:
    import into ACM
    manage renewal yourself
```

---

## WAF versus Shield versus Network Firewall

```text
HTTP request inspection:
    WAF

DDoS protection:
    Shield

Routed network traffic inspection:
    Network Firewall
```

---

## Firewall Manager

```text
Centrally deploy and govern firewall policies
across accounts and resources:
    Firewall Manager
```

It is not itself the inspection engine.

---

## GuardDuty versus Inspector

```text
Suspicious or malicious behavior:
    GuardDuty

Known software vulnerability or unintended exposure:
    Inspector
```

---

## Macie

```text
Discover sensitive data in S3:
    Macie
```

---

## Security Hub versus Detective

```text
Aggregate, correlate, prioritize:
    Security Hub

Investigate behavior and timeline:
    Detective
```

---

## Artifact versus Audit Manager

```text
AWS reports, certifications, and agreements:
    Artifact

Evidence about customer's AWS use:
    Audit Manager
```

Current caveat:

```text
Audit Manager:
    existing customers only
```

---

## S3 Object Lock

```text
Administratively bypassable exceptional retention:
    governance mode

No deletion or shortening before expiry:
    compliance mode

Case-specific indefinite retention:
    legal hold
```

---

## VPC endpoint versus IAM

```text
Private network path:
    VPC endpoint

Permission to call AWS service:
    IAM/resource policies
```

Both may be required.

---

# 42. Retrieval practice

Answer without looking back.

## 1

Why does Northstar tokenize card information before it reaches its payment API?

## 2

Does tokenization automatically prove that Northstar has no payment-security obligations?

## 3

Why does the design use explicit US and EU API names?

## 4

What is the difference between a data class and a KMS key?

## 5

Why should prohibited information not merely be encrypted and retained?

## 6

What is the difference between `PaymentRuntimeRole` and `PaymentDeploymentRole`?

## 7

Why should a KMS key administrator not automatically receive `kms:Decrypt`?

## 8

What is the difference among AWS-owned, AWS-managed, and customer-managed KMS keys?

## 9

What does envelope encryption mean?

## 10

What two forms of the data key can `GenerateDataKey` return?

## 11

What is a KMS key policy?

## 12

Why might an IAM `kms:Decrypt` allow be ineffective?

## 13

What is normally required for cross-account use of a KMS key?

## 14

What is a KMS grant?

## 15

What is encryption context?

## 16

Why must secrets not be placed in encryption context?

## 17

Does automatic KMS rotation immediately re-encrypt every existing object?

## 18

Why is KMS-key deletion more dangerous than deleting an alias?

## 19

Why does Object Lock not protect against deletion of the encryption key?

## 20

Why are single-Region KMS keys the baseline?

## 21

When is a multi-Region KMS key useful?

## 22

What is the central difference between KMS and CloudHSM?

## 23

Which identity system governs direct CloudHSM cryptographic users?

## 24

What does a KMS CloudHSM custom key store provide?

## 25

What new availability dependency does a custom key store introduce?

## 26

When should Secrets Manager be selected over Parameter Store?

## 27

Can Parameter Store hold encrypted values?

## 28

Why might an application fail immediately after secret rotation?

## 29

What does ACM manage?

## 30

Why does an imported certificate require a different renewal plan?

## 31

Does a TLS certificate authorize a refund operation?

## 32

What does an interface VPC endpoint provide?

## 33

What does an endpoint policy do?

## 34

Can an endpoint policy grant an operation that IAM denies?

## 35

Why does the payment platform still need NAT?

## 36

What is the difference between WAF and Network Firewall?

## 37

What is the difference between Shield Standard and Shield Advanced?

## 38

What does Firewall Manager do?

## 39

Which service looks for suspicious AWS activity?

## 40

Which service finds sensitive data in S3?

## 41

Which service scans ECR images for vulnerabilities?

## 42

Which service aggregates and prioritizes findings?

## 43

Which capability checks security standards and configuration posture?

## 44

Which service helps investigate the entities and timeline behind a GuardDuty finding?

## 45

Why should coverage be monitored in addition to finding count?

## 46

What is the difference between Artifact and customer-generated audit evidence?

## 47

What was Audit Manager designed to do?

## 48

Why is Audit Manager not the baseline for this new architecture?

## 49

What are the three important S3 Object Lock mechanisms?

## 50

What is the largest failure boundary covered by one payment cell?

---

# 43. Answer key

## 1

To reduce the amount of raw card information handled, stored, logged, and protected by Northstar systems.

## 2

No. The complete transaction design and the applicable regulatory assessment determine scope.

## 3

To route each tenant explicitly to its contracted data Region rather than guessing from the caller’s physical location.

## 4

A data class describes business sensitivity and handling requirements. A KMS key is one technical control used to protect selected data.

## 5

Retention still creates access, breach, key-management, and compliance risk. Data that has no justified purpose should not be collected.

## 6

The runtime role performs application operations. The deployment role changes infrastructure and releases.

## 7

Key administration and plaintext access are distinct responsibilities and should be separated where the control model requires it.

## 8

AWS-owned keys are entirely AWS-controlled; AWS-managed keys are created in the customer account for services with limited customer control; customer-managed keys have customer-defined policy and lifecycle.

## 9

Encrypt data with a data key, then encrypt that data key with a KMS key.

## 10

A plaintext copy for immediate local use and an encrypted copy for storage with the ciphertext.

## 11

The resource policy attached to a KMS key and the primary basis for controlling access to it.

## 12

The key policy may not authorize the account or role to receive that permission, or another boundary or deny may apply.

## 13

Permission in the owning key policy and permission in an IAM policy in the caller’s account.

## 14

A delegated set of permissions to use a KMS key, often created for an integrated AWS service or constrained use.

## 15

Nonsecret additional authenticated data supplied to encryption and decryption and usable in policy conditions.

## 16

Encryption context is not encrypted and can appear in logs such as CloudTrail.

## 17

No. It changes the material used for future cryptographic operations while previous material remains available for decryption.

## 18

An alias is a pointer. Deleting the key can permanently remove the ability to decrypt dependent data.

## 19

The object version may remain immutable but cannot be decrypted after the required key is destroyed.

## 20

The cells are intentionally Regionally isolated, and ordinary single-Region keys satisfy most workloads with less coupling.

## 21

When the same ciphertext or digital signature must be processed in multiple permitted Regions without changing key material.

## 22

KMS is a managed key service with AWS integrations; CloudHSM gives customers direct control of dedicated HSM users, keys, and interfaces.

## 23

CloudHSM’s own internal HSM-user and cryptographic permission model, not ordinary IAM roles alone.

## 24

KMS APIs and service integration while the key material and cryptographic operations reside in CloudHSM.

## 25

The connection and health of the CloudHSM cluster become part of KMS-key availability.

## 26

When a credential needs automatic rotation, specialized secret lifecycle, or stronger secret-oriented auditing.

## 27

Yes, through `SecureString` and KMS.

## 28

The application may still cache the previous credential, or the target service and secret may not have completed rotation consistently.

## 29

Public, private, and imported TLS certificates and the lifecycle of eligible ACM-issued certificates.

## 30

ACM did not issue it and cannot automatically obtain its replacement from the external CA.

## 31

No. TLS protects the connection and endpoint identity; application authorization decides whether the refund is allowed.

## 32

Private IP-based network reachability from a VPC to a supported AWS service.

## 33

It limits which principals, actions, and resources may be reached through that endpoint.

## 34

No. It is an additional limit, not a replacement grant.

## 35

The external payment processor exposes a public endpoint and is not automatically reachable through AWS VPC endpoints.

## 36

WAF interprets Layer 7 web requests. Network Firewall inspects traffic routed through its network endpoints.

## 37

Shield Standard is automatic baseline protection. Shield Advanced is a subscribed enhanced service for explicitly protected supported resources.

## 38

It centrally applies and manages supported firewall and protection policies across organizational accounts and resources.

## 39

GuardDuty.

## 40

Macie.

## 41

Inspector.

## 42

Security Hub.

## 43

Security Hub CSPM.

## 44

Detective.

## 45

“No findings” can mean either no issue was detected or the resource was not actually covered.

## 46

Artifact supplies AWS’s provider-side reports and agreements. Northstar must produce evidence of its own configurations and operations.

## 47

To collect and organize evidence about customer AWS usage against assessment frameworks.

## 48

It is closed to setup in new accounts and is in maintenance mode.

## 49

Governance retention, compliance retention, and legal holds.

## 50

Component and Availability Zone failures within the selected Region. Full Regional failure requires a separate permitted replication and recovery design.

---

# 44. What to memorize now

```text
Data minimization
    → do not collect what is not required

Encryption
    → protect data that must exist
```

```text
AWS-owned key
    → AWS controls everything

AWS-managed key
    → service-oriented key with limited customer control

Customer-managed key
    → customer policy and lifecycle
```

```text
KMS key
    → protects data keys

Data key
    → encrypts payload
```

```text
Key policy
    → KMS resource policy

IAM policy
    → principal permission

Cross-account KMS
    → key policy + IAM policy
```

```text
Key administrator
    → manages key

Key user
    → performs cryptographic operation
```

```text
KMS
    → managed AWS key service

CloudHSM
    → customer-controlled HSM cluster

KMS custom key store
    → KMS API + CloudHSM key material
```

```text
Secrets Manager
    → rotating secrets

Parameter Store
    → configuration and simpler secure values
```

```text
ACM
    → certificate lifecycle

Certificate
    → TLS endpoint identity

Application authorization
    → business permission
```

```text
Interface endpoint
    → private AWS-service network path

Endpoint policy
    → limits endpoint use

IAM/resource policy
    → underlying service authority
```

```text
WAF
    → web requests

Shield
    → DDoS

Network Firewall
    → routed traffic

Firewall Manager
    → organizational policy deployment
```

```text
GuardDuty
    → threat detection

Macie
    → sensitive data in S3

Inspector
    → vulnerabilities

Security Hub
    → correlate and prioritize

Security Hub CSPM
    → posture and standards

Detective
    → investigation
```

```text
Artifact
    → AWS reports and agreements

Audit Manager
    → customer-usage evidence
    → existing customers only
```

```text
Object Lock governance
    → privileged bypass possible

Object Lock compliance
    → no deletion before expiry

Legal hold
    → no fixed expiry
```

```text
Immutable encrypted object
    +
deleted KMS key
    =
immutable unreadable object
```

```text
Regional routing
    ≠
data-residency proof
```

---

# 45. What can remain recognition-level

You do not yet need perfect recollection of:

- every KMS key type and algorithm;
- KMS grant-token behavior;
- exact KMS rotation-period options;
- CloudHSM command syntax;
- PKCS#11 configuration;
- HSM quorum commands;
- custom-key-store quotas;
- ACM validation-record syntax;
- AWS Private CA hierarchy design;
- every WAF managed-rule group;
- Shield Advanced response procedures;
- Firewall Manager administrator-scope details;
- GuardDuty protection-plan names;
- Macie managed-data identifiers;
- Inspector rescan-duration settings;
- Security Hub OCSF schemas;
- Detective behavior-graph quotas;
- every Security Hub CSPM control;
- Audit Manager framework structure;
- S3 Object Lock API syntax;
- exact regulatory retention periods.

The durable architecture is:

```text
Minimize sensitive data
    ↓
separate Regional payment cells
    ↓
protect public ingress
    ↓
private runtime and database
    ↓
KMS-controlled encryption
    ↓
rotated secrets
    ↓
private AWS service paths
    ↓
controlled processor egress
    ↓
central detection and investigation
    ↓
immutable evidence
```

At every interaction, continue applying Lesson 0:

```text
Authorization:
    Which principal is acting?
    Is authority controlled by IAM,
    a resource policy, a KMS key policy,
    an application identity, or database privileges?
    Which ceiling or explicit deny applies?

Networking:
    Is the path public ingress, VPC-local,
    through a private endpoint, through inspection,
    or through NAT to an external processor?
    Which route, protocol, port, security group,
    endpoint policy, and return path are required?
```

And add the new Lesson 8 questions:

```text
Cryptography:
    Which key protects this data?
    Who administers the key?
    Who can use it?
    What happens when it is unavailable or deleted?

Evidence:
    Which system proves the control operated?
    Who can alter that evidence?
    How long is it retained?
    Can it still be decrypted when needed?

Residency:
    Which exact data crosses which Regional boundary?
    Is the claim based on architecture,
    or merely on a DNS routing assumption?
```