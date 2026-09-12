# Lesson 17 — Black Friday: The Primary Region Is Failing

## A company-wide disaster-recovery program

### RTO and RPO, backup and restore, pilot light, warm standby, active-active, AWS Backup, Elastic Disaster Recovery, cross-Region data, traffic failover, split-brain prevention, and failback

We will take the second jump proposed after Lesson 11: **Lesson 17**. It is one of the most useful SAP-C02 projects because nearly every earlier lesson becomes a dependency of the recovery design.

## Source note

The curriculum defines Lesson 17 as:

```text
A company-wide disaster-recovery program

RTO and RPO
backup and restore
pilot light
warm standby
multi-site
AWS Backup
Elastic Disaster Recovery
cross-Region replication
database replication
Route 53 health checks and failover
capacity activation
reverse replication
failback
```

The attached comparison material presents the familiar cost-and-recovery progression:

```text
Backup and restore
    → slowest and least continuously provisioned

Pilot light
    → critical core remains available

Warm standby
    → scaled-down complete environment

Multi-site
    → active-active and fastest, but most expensive
```

It also stresses a commonly forgotten requirement: after operating in the recovery environment, changing data must be replicated back before returning safely to the original site.  

The study guide gives an important exam warning: a warm standby answer is useful for a short RTO only when the standby can detect failure, scale to production capacity, and redirect traffic quickly enough. A nominally cheaper strategy that cannot meet the stated objectives is not the correct answer.

### Current-service notes

Several modern AWS capabilities extend the source-era material:

- AWS Backup now supports scheduled **restore testing**, cross-account copies, Vault Lock, and logically air-gapped vaults.
- Amazon Application Recovery Controller, or **ARC**, now includes **Region switch plans** for orchestrating multi-Region recovery. ARC readiness checks are no longer open to new customers, although routing controls, Region switch, zonal shift, and zonal autoshift remain available.
- DynamoDB global tables now support both multi-Region eventual consistency and multi-Region strong consistency.

These are current expansions. The four classic recovery strategies remain essential SAP-C02 knowledge.

---

# 1. The incident

## 1.1 Black Friday, 09:17 UTC

Northstar Commerce is experiencing its largest sales event of the year.

Normal order traffic is:

```text
3,000 orders/minute
```

Current traffic is:

```text
22,000 orders/minute
```

Most production services run in:

```text
Primary Region:
    us-east-1
```

Northstar has a recovery Region in:

```text
Recovery Region:
    us-west-2
```

At 09:17, several symptoms begin simultaneously:

```text
ALB 5xx responses increase.
Aurora write latency rises.
Some new ECS tasks remain pending.
KMS and Secrets Manager calls intermittently time out.
One Availability Zone appears healthy.
Two others show severe impairment.
Some clients can still create orders.
Other clients cannot.
```

This is more dangerous than a clean outage.

The primary Region is not simply:

```text
OFF
```

It is:

```text
partly available
+
unpredictable
+
still accepting some writes
```

At 09:19, the incident commander asks:

> Should we fail over?

The technical team must answer several questions before redirecting traffic:

```text
Is the recovery Region sufficiently current?

Can it support Black Friday traffic?

Can the payment processor accept traffic from its egress IPs?

Can the recovery application decrypt its data?

Which Region is allowed to accept writes?

Will DNS caches continue sending traffic to the primary?

Can queued work be recovered?

What data may be lost?

How will we return after the primary Region recovers?
```

This is the lesson:

> **A second Region is not a disaster-recovery program. It is merely one possible location in which recovery may occur.**

---

# 2. Northstar’s workloads do not all need the same strategy

Northstar performs a business-impact analysis and defines these case-study objectives.

| Workload | Business impact | RTO | RPO | Strategy |
| --- | --- | ---: | ---: | --- |
| Payment authorization | Sales stop immediately | 5 min | Under 1 min | Warm standby |
| Order submission | Revenue and customer trust | 15 min | 1 min | Warm standby |
| Product catalog reads | Customers cannot browse | 5 min | 15 min | Active-active/read-local |
| Appointment self-service | Administrative inconvenience | 1 hour | 15 min | Pilot light or warm standby |
| Legacy warehouse management | Fulfillment slows | 2 hours | 15 min | Elastic Disaster Recovery |
| Finance ERP | Back-office interruption | 4 hours | 1 hour | Pilot light |
| Insight Hub dashboards | Decisions delayed | 12 hours | 4 hours | Backup/rebuild |
| Historical data-science jobs | Low immediate impact | 24 hours | 24 hours | Backup and restore |
| Security evidence | Investigation impaired | 4 hours | Near-zero evidence loss target | Cross-account, cross-Region immutable copies |

These numbers are Northstar’s hypothetical business decisions.

They are not service guarantees.

---

# 3. Recovery objectives

## 3.1 Recovery Time Objective

**RTO** is the maximum acceptable time between interruption and restoration of the workload.

```text
Failure begins:
    09:17

Service must be restored by:
    09:32

RTO:
    15 minutes
```

AWS defines RTO as the maximum acceptable delay between service interruption and restoration.

---

## 3.2 Recovery Point Objective

**RPO** is the maximum acceptable age of the recovery point.

Suppose:

```text
Failure:
    09:17

Newest usable data in recovery Region:
    09:16:20
```

Potential data loss:

```text
40 seconds
```

If the RPO is one minute, that recovery point may satisfy the objective.

AWS defines RPO as the maximum acceptable period between the latest usable recovery point and the disruption.

---

## 3.3 Timeline

```text
             RPO                                  RTO
              │                                    │
              ▼                                    ▼

Last usable   Data that may     Failure          Service restored
recovery      be lost           occurs
point
    │              │               │                    │
    ├──────────────┤               ├────────────────────┤
```

```text
RPO asks:
    How much recent data may be lost?

RTO asks:
    How long may the service remain unavailable?
```

---

## 3.4 RTO is end-to-end

Promoting a database in two minutes does not prove a two-minute application RTO.

A simplified recovery-time equation is:

\[
T_{\text{recovery}}
=

T_{\text{detect}}
+
T_{\text{declare}}
+
T_{\text{fence}}
+
T_{\text{data}}
+
T_{\text{capacity}}
+
T_{\text{validate}}
+
T_{\text{route}}
+
T_{\text{client convergence}}
\]

Where:

```text
detect:
    recognize the incident

declare:
    authorize recovery

fence:
    stop unsafe writes in the old site

data:
    promote or restore authoritative stores

capacity:
    start or scale compute

validate:
    prove the recovery stack works

route:
    redirect new traffic

client convergence:
    DNS caches, connections, and retries settle
```

The slowest dependency may dominate the workload RTO.

---

## 3.5 RPO is also end-to-end

Suppose:

```text
Aurora lag:
    20 seconds

DynamoDB lag:
    under one second

S3 object replication:
    4 minutes

Critical settlement file:
    copied only every hour
```

The complete payment workflow does not have a 20-second RPO merely because Aurora does.

Its recovery point depends on every authoritative state required to complete the business operation.

---

# 4. Availability, backup, disaster recovery, and cyber recovery

These concepts overlap, but they are not interchangeable.

## 4.1 High availability

High availability handles relatively local component failures.

```text
EC2 instance fails
ECS task crashes
Aurora writer fails
Availability Zone is impaired
```

Typical mechanisms:

```text
Multi-AZ
load balancing
Auto Scaling
replicas
automatic failover
```

A Multi-AZ design usually remains inside one Region.

```text
Multi-AZ
    ≠
cross-Region disaster recovery
```

---

## 4.2 Backup

A backup preserves a recoverable copy from an earlier point in time.

It helps with:

```text
accidental deletion
logical corruption
ransomware
malicious change
failed migration
complete resource loss
```

Backup does not automatically provide:

```text
running application capacity
network configuration
DNS failover
application validation
fast restoration
```

---

## 4.3 Disaster recovery

Disaster recovery restores an operational service after a major disruption.

It includes:

```text
data
compute
networking
identity
secrets
traffic
dependencies
people
runbooks
testing
failback
```

---

## 4.4 Cyber recovery

Cyber recovery assumes that the ordinary production environment may be untrustworthy.

Examples:

```text
compromised administrator
ransomware
malicious deletion
stolen deployment credentials
corrupted infrastructure definitions
```

A cyber-recovery design may require:

- a separately administered recovery account;
- immutable backups;
- independent credentials;
- clean-room restoration;
- malware validation;
- delayed reconnection to production;
- multi-party authorization.

A highly replicated environment can still replicate an attacker’s destructive changes quickly.

---

# 5. Failure classes

The correct recovery mechanism depends on what failed.

| Failure | Likely mechanism |
| --- | --- |
| One ECS task | ECS service replacement |
| One EC2 instance | Auto Scaling replacement |
| One database writer | Multi-AZ database failover |
| One Availability Zone | Multi-AZ architecture or ARC zonal shift |
| Entire Region | Cross-Region recovery |
| Bad deployment | Application rollback |
| Data corruption | Point-in-time restore or clean backup |
| Deleted S3 objects | Version recovery or backup |
| Compromised AWS account | Cross-account recovery |
| Stolen credentials | Credential containment and forensic recovery |
| Payment processor outage | Alternate provider or degraded business mode |
| DNS provider/client caching issue | Alternative traffic strategy and client retry |
| Corporate IdP outage | Tested emergency identity path |

### Important

```text
Replication:
    protects against infrastructure loss

Backup:
    protects against historical corruption

Neither alone:
    protects against every failure
```

---

# 6. Dependency mapping

## 6.1 Order submission dependency graph

```text
Customer
    ↓
Route 53
    ↓
WAF / ALB
    ↓
ECS orders service
    ├──► Cognito / application identity
    ├──► Secrets Manager
    ├──► KMS
    ├──► Aurora
    ├──► DynamoDB idempotency table
    ├──► SQS
    ├──► EventBridge
    └──► payment processor
```

The orders service is not recovered merely because ECS tasks are running.

---

## 6.2 Hidden dependencies

Common hidden dependencies include:

```text
container image exists only in primary ECR
secret exists only in primary Region
KMS key policy lacks recovery role
ACM certificate was never issued in recovery Region
third-party firewall allows only primary NAT IP
Route 53 health check monitors the wrong endpoint
recovery Region service quota is too low
deployment pipeline exists only in failed Region
corporate IdP path depends on the failed network
DNS private zone is not associated with recovery VPC
```

A disaster-recovery plan is often defeated by a small dependency that was never included in the architecture diagram.

---

## 6.3 Recovery groups

Northstar groups resources that must recover together.

```text
Commerce recovery group
    ALB
    ECS services
    Aurora
    DynamoDB
    SQS
    secrets
    networking
    external processor integration

Legacy ERP recovery group
    EC2 servers
    database
    file storage
    directory/DNS
    licenses
    batch scheduler
```

A group receives one business RTO/RPO and one integrated test.

---

# 7. The four classic recovery strategies

## 7.1 Backup and restore

```text
Normal state:
    backups exist
    recovery compute mostly absent

Disaster:
    restore data
    deploy infrastructure
    launch compute
    validate
    redirect traffic
```

### Characteristics

```text
Lowest continuous cost
Highest recovery time
Potentially older recovery point
Strong for low-criticality workloads
Strong protection against historical corruption
```

### Northstar example

Insight Hub dashboards can be rebuilt from:

```text
cross-Region S3 data
Glue catalog definitions
CloudFormation
Redshift snapshots
versioned transformation code
```

A 12-hour RTO makes continuously running a second full analytics estate unnecessary.

---

## 7.2 Pilot light

A pilot light keeps the critical core alive.

```text
Running continuously:
    data replication
    essential network
    minimum core services

Started during disaster:
    most application compute
    full capacity
    peripheral services
```

### Characteristics

```text
Faster than backup and restore
Lower cost than warm standby
Requires significant activation work
Requires tested automation
```

### Northstar example

The legacy ERP maintains:

```text
continuous block replication
recovery VPC
launch configuration
directory path
minimal supporting infrastructure
```

The application servers are launched through Elastic Disaster Recovery when needed.

---

## 7.3 Warm standby

A complete but scaled-down application is already running.

```text
Normal:
    recovery service is functional
    minimum ECS tasks
    Aurora secondary
    queues and endpoints
    limited capacity

Disaster:
    promote data
    scale compute
    validate
    redirect traffic
```

### Characteristics

```text
Shorter RTO
Higher continuous cost
Most components already exist
Capacity activation remains necessary
Usually active-passive
```

### Northstar example

Commerce and Pay use warm standby because their RTOs are measured in minutes.

---

## 7.4 Multi-site or active-active

Two or more sites serve production traffic simultaneously.

```text
Region A:
    active

Region B:
    active
```

### Characteristics

```text
Lowest potential traffic failover time
Highest cost
Highest data-consistency complexity
Requires conflict and ownership semantics
Failure of one site shifts load to the others
```

The uploaded study material describes multi-site as the fastest and most expensive of the classic strategies.

### Northstar example

The public product catalog is read-heavy and can be served from both Regions.

Northstar does **not** initially make relational order creation active-active because it has not yet proven safe:

```text
write ownership
inventory reservation
payment idempotency
order-number generation
conflict resolution
```

---

# 8. Strategy comparison

| Characteristic | Backup and restore | Pilot light | Warm standby | Multi-site |
| --- | --- | --- | --- | --- |
| Recovery compute | Absent | Core only | Complete but small | Production-capable |
| Data | Backups | Replicated core | Continuously replicated | Available in all active sites |
| Traffic normally served | Primary only | Primary only | Primary only | Multiple sites |
| Typical relative RTO | Highest | Medium-high | Low | Lowest |
| Typical relative RPO | Backup-dependent | Replication-dependent | Replication-dependent | Data-model-dependent |
| Cost | Lowest | Low-medium | Medium-high | Highest |
| Activation complexity | Highest | High | Medium | Low for traffic, high overall |
| Data complexity | Lower | Medium | Medium | Highest |
| Best clue | Restore everything | Core remains lit | Scaled-down full stack | Both sites serve |

### Exam decision rule

Choose the **least expensive strategy that can demonstrably satisfy the stated RTO and RPO**.

Do not choose backup and restore for a five-minute RTO merely because it is cheapest.

Do not choose active-active for a 24-hour RTO merely because it is most resilient.

---

# 9. Northstar’s baseline recovery architecture

```text
                           Global control plane
                    Route 53 + ARC routing controls
                               │
                  ┌────────────┴─────────────┐
                  │                          │
                  ▼                          ▼
          Primary Region              Recovery Region
            us-east-1                    us-west-2
┌───────────────────────────┐  ┌───────────────────────────┐
│                           │  │                           │
│ WAF + ALB                 │  │ WAF + ALB                 │
│ ECS production capacity  │  │ ECS minimum capacity      │
│                           │  │                           │
│ Aurora primary            │  │ Aurora global secondary  │
│ DynamoDB replica          │  │ DynamoDB replica          │
│ S3 primary buckets        │  │ S3 replicated buckets     │
│ SQS/EventBridge           │  │ Regional queues/buses     │
│ Secrets Manager           │  │ Replicated/separate       │
│ ECR repositories          │  │ Replicated images         │
│ KMS Regional keys         │  │ KMS Regional keys         │
│                           │  │                           │
│ Primary NAT/firewall      │  │ DR NAT/firewall           │
│ Primary TGW/routes        │  │ DR TGW/routes             │
│                           │  │                           │
└───────────────────────────┘  └───────────────────────────┘
                  │                          │
                  └──────────┬───────────────┘
                             ▼
                       Backup account
              ┌──────────────────────────────┐
              │ Cross-account backup vaults │
              │ Cross-Region copies          │
              │ Vault Lock                   │
              │ Logically air-gapped vault  │
              │ Restore-testing environment │
              └──────────────────────────────┘

                       Legacy workloads
                  Source EC2 / on premises
                             │
                    continuous block copy
                             ▼
              Elastic Disaster Recovery staging
                    in recovery account/Region
```

## Architecture in one sentence

> Critical cloud-native workloads use warm standby with continuously replicated data and predeployed regional infrastructure; legacy server workloads use Elastic Disaster Recovery; low-criticality systems use backup and restore; and independent backup accounts protect historical recovery points from production compromise.

---

# 10. What must already exist before the outage?

For a 15-minute warm-standby RTO, Northstar predeploys:

```text
Recovery VPC and subnets
route tables
security groups
NAT and firewall paths
ALB
WAF configuration
ACM certificates
ECS cluster and minimum service capacity
container images
Aurora secondary
DynamoDB replica
S3 replication
regional queues and event buses
secrets
KMS keys and policies
CloudWatch alarms
IAM execution and runtime roles
DNS and failover controls
third-party allowlisting
service quotas
```

During the incident, it performs only bounded activation work:

```text
fence old writer
promote data
scale existing services
validate
redirect traffic
```

Trying to create every network and IAM component during the outage is closer to pilot light than warm standby.

---

# 11. Capacity activation

## 11.1 The idle Region problem

The recovery Region has:

```text
2 Orders tasks
```

Black Friday needs:

```text
120 Orders tasks
```

Changing desired count is easy.

Obtaining and stabilizing the capacity may not be.

Possible blockers:

```text
Fargate capacity
EC2 instance availability
subnet IP exhaustion
ECS service quota
ALB target-registration rate
database connection limits
NAT port capacity
third-party rate limit
KMS request rate
```

---

## 11.2 Pre-scaling during known risk periods

Before Black Friday, Northstar can temporarily raise recovery capacity.

```text
Ordinary week:
    10% standby capacity

Black Friday:
    40% standby capacity
```

The additional cost reduces uncertain activation work during the highest-risk event.

---

## 11.3 Quotas are part of recovery capacity

A CloudFormation template that describes 120 tasks does not guarantee that the recovery account can launch them.

Northstar validates:

```text
service quotas
IP capacity
instance or Fargate availability assumptions
concurrent Lambda capacity
database maximum connections
NAT capacity
API limits
```

A recovery plan that depends on an emergency quota increase does not have a deterministic short RTO.

---

# 12. AWS Backup

## 12.1 Core objects

```text
Backup plan:
    schedule, lifecycle, copy, and retention policy

Backup selection:
    resources protected by the plan

Backup vault:
    logical container for recovery points

Recovery point:
    one backup of a protected resource

Copy action:
    duplicate recovery point to another vault,
    account, or Region where supported

Restore job:
    create a resource from a recovery point
```

---

## 12.2 Organization-wide backup

Northstar defines policies based on:

```text
OU
account
resource type
resource tags
data classification
```

Example:

```text
Production databases:
    continuous or frequent recovery
    cross-account copy
    cross-Region copy
    seven-year retention where required

Nonproduction:
    daily backup
    shorter retention
```

Feature support differs by resource type, including whether continuous backup, cross-account copy, cross-Region copy, cold storage, and restore testing are available.

---

## 12.3 Cross-account copies

Production workloads copy recovery points into a dedicated backup account.

```text
Production account
    ↓ copy
Backup vault in Backup account
```

The destination vault uses a resource-based access policy to permit approved cross-account copy operations.

This protects against an attacker who compromises only the workload account.

It does not help if:

- the same compromised identity administers both accounts;
- vault deletion is broadly permitted;
- the KMS key can be destroyed;
- copies have never been tested.

---

## 12.4 Cross-Region copies

Northstar also copies selected recovery points to another Region.

```text
Primary Region loss
    ↓
recovery point remains in recovery Region
```

Cross-account and cross-Region properties should be treated independently.

A backup in another account but the same Region protects against account compromise better than Regional loss.

A backup in another Region but under the same broadly compromised authority may protect against Regional loss better than account compromise.

For critical data, Northstar considers both.

---

## 12.5 Vault Lock

AWS Backup Vault Lock can protect recovery points through governance or compliance modes.

### Governance mode

Authorized principals can alter or remove the lock.

### Compliance mode

After the configured grace period, the lock and protected recovery points become immutable until retention requirements are satisfied; AWS documentation states that the locked configuration cannot then be changed or deleted by users or AWS.

### Design warning

Before compliance locking:

```text
test retention values
test restore
test lifecycle
test KMS access
test deletion of expired recovery points
```

An incorrect long retention period can create durable cost and operational consequences.

---

## 12.6 Logically air-gapped vault

A logically air-gapped vault adds strong isolation and immutable controls around supported recovery points. AWS recommends cross-Region copies into such vaults in the same or separate accounts for greater resiliency.

Current AWS Backup can also associate multi-party approval with a logically air-gapped vault so recovery access can require approval by a separate trusted group. This is an advanced cyber-recovery control rather than core SAP-C02 memorization.

---

## 12.7 Restore testing

A backup job marked:

```text
COMPLETED
```

proves that AWS created a recovery point.

It does not prove that Northstar can restore and use the application.

AWS Backup restore testing lets Northstar schedule restore-test plans and select specific or randomized recovery points. A validation workflow can then inspect the restored resource.

A useful validation performs more than:

```text
resource status = AVAILABLE
```

It checks:

```text
database opens
schema exists
sample rows are valid
encrypted objects can be read
application can connect
recovery point falls inside RPO
restore completes inside RTO
```

AWS Well-Architected guidance explicitly recommends periodically restoring and validating data rather than assuming that the existence of a backup proves recoverability.

---

## 12.8 Restore behavior

AWS Backup generally performs nondestructive restoration by creating a new resource rather than overwriting the existing one. AWS also does not provide a restore-time SLA; restore duration can vary with resource and capacity conditions.

Therefore:

```text
Backup frequency
    → influences RPO

Measured restore and integration time
    → influences RTO
```

---

# 13. Backup is not replication

## 13.1 Replication

```text
Primary write
    ↓
copied quickly to secondary
```

Advantages:

- low potential RPO;
- secondary may be quickly promoted.

Risk:

```text
accidental deletion
corrupt write
malicious encryption
bad application update
```

may also be replicated.

---

## 13.2 Backup

```text
Historical recovery points
```

Advantages:

- return to state before corruption;
- immutable retention possible.

Risk:

- restoration is slower;
- the newest point may be older;
- application infrastructure still needs recovery.

---

## 13.3 Northstar uses both

```text
Replication:
    Regional infrastructure failure

Backup:
    historical and cyber recovery
```

A replica is not a substitute for historical recovery.

A backup is not a substitute for a low-latency standby.

---

# 14. AWS Elastic Disaster Recovery

## 14.1 Purpose

AWS Elastic Disaster Recovery, or DRS, continuously replicates supported server disks at the block level into a staging area. During a drill or recovery, it converts and launches those replicated servers as native EC2 instances.

It is useful for:

```text
legacy EC2 applications
on-premises servers
applications that cannot yet be refactored
server groups requiring low-RPO block replication
```

It is not the normal recovery mechanism for:

```text
Lambda
DynamoDB
S3-native applications
managed SaaS
container images alone
```

---

## 14.2 Normal state

```text
Source servers
    ↓ replication agent
continuous block-level replication
    ↓
low-cost staging resources
in recovery account/Region
```

The staging environment is not the final production fleet.

---

## 14.3 Drill

A drill launches isolated recovery instances without declaring a production disaster.

```text
Replicated data
    ↓
Drill instances
    ↓
application validation
    ↓
terminate drill instances
```

AWS recommends periodic nondisruptive recovery and failback drills.

---

## 14.4 Recovery

During a real event:

```text
choose recovery point
    ↓
launch recovery instances
    ↓
post-launch conversion and scripts
    ↓
validate application
    ↓
redirect traffic
```

DRS launches the recovered compute.

It does **not** redirect the application’s external traffic; AWS documents routing as a separate customer-controlled operation, commonly implemented with Route 53.

---

## 14.5 Launch settings

Northstar preconfigures:

```text
target VPC
subnets
security groups
instance types
private/public addressing
IAM instance profile
tags
licensing behavior
post-launch scripts
```

A drill that launches into the wrong subnet does not establish recovery readiness.

---

## 14.6 Application-consistency caveat

Block replication typically gives a crash-consistent recovery point unless the application coordinates a more specific consistent state.

A multi-server application may require:

```text
database-consistent recovery
application quiescing
ordered startup
cluster identity changes
license updates
shared-file recovery
```

DRS can reproduce servers. It cannot infer every application’s business consistency requirements.

---

# 15. DRS failback

After the incident, the recovered EC2 instances contain new writes.

Northstar must not simply boot the old source machines and redirect traffic back.

The safe flow is:

```text
Recovered instances are production
    ↓
start reversed replication
    ↓
copy current recovery-state data
back toward source environment
    ↓
wait until replication is healthy
    ↓
perform controlled failback
    ↓
validate source environment
    ↓
redirect traffic
```

AWS DRS supports reversed replication for failback and recommends initializing the service in both relevant accounts and Regions before an incident.

### Memory rule

```text
Failover:
    original → recovery

Failback:
    recovery → original

Before failback:
    reverse replication
```

---

# 16. Aurora Global Database

## 16.1 Normal topology

```text
Primary Region:
    read/write Aurora cluster

Recovery Region:
    secondary Aurora cluster
    cross-Region replication
```

The secondary is kept current through Aurora Global Database replication.

---

## 16.2 Planned switchover

During a healthy planned exercise:

```text
wait for replication
    ↓
switchover
    ↓
secondary becomes primary
    ↓
old primary becomes secondary
```

Aurora’s managed switchover is intended for healthy environments and can relocate the primary without data loss when its prerequisites, including compatible engine versions, are satisfied.

Use this for:

```text
planned Regional rotation
DR exercise
maintenance
controlled failback
```

---

## 16.3 Unplanned failover

During a primary-Region outage:

```text
choose recovery secondary
    ↓
promote it to primary
```

Any write that had not reached that secondary can be lost. AWS also warns that unplanned Aurora global-database failover is susceptible to split-brain conditions.

### Critical distinction

```text
Transactionally consistent promoted database
    ≠
contains every acknowledged primary write
```

The promoted database can be internally consistent while missing the most recent unreplicated transactions.

---

## 16.4 Write forwarding is not multi-writer

Aurora can forward writes issued against a secondary Region to the primary Region.

The data is still changed first in the primary cluster and then replicated back.

Therefore:

```text
Secondary write forwarding
    ≠
independent local writer
    ≠
survival of primary-region write path
```

If the primary is unavailable, the secondary must be promoted before it becomes the new authoritative writer.

---

## 16.5 Application endpoint

After promotion, the application must connect to the new writer path.

Possible techniques include:

- Regional configuration updated through the failover plan;
- a stable application-level database name;
- RDS Proxy in each Region;
- an Aurora global writer endpoint where supported by the chosen architecture.

When RDS Proxy is used with Aurora Global Database, the application must use the proxy associated with the newly promoted primary Region.

---

# 17. Ordinary RDS cross-Region recovery

## 17.1 Cross-Region read replica

For supported engines:

```text
Primary RDS instance
    ↓ asynchronous replication
Cross-Region read replica
```

During disaster recovery:

```text
promote read replica
    ↓
new standalone writable DB
    ↓
redirect application
```

RDS read replicas use asynchronous replication, and cross-Region replicas generally require deliberate promotion for recovery.

---

## 17.2 Promotion changes the topology

After promotion, the replica is no longer an ordinary replica of the lost primary.

For continued protection:

```text
promoted DB becomes production
    ↓
create a new replica
toward repaired or replacement Region
```

---

## 17.3 Cross-Region automated backups

For a cheaper, higher-RTO option, RDS can replicate automated snapshots and transaction logs to another Region.

This supports restoration in the recovery Region, but it does not provide an already running database.

```text
Cross-Region read replica:
    lower RTO
    continuously running cost

Cross-Region backup:
    higher RTO
    lower continuous database cost
```

---

# 18. DynamoDB global tables

## 18.1 Multi-Region eventual consistency

MREC is the default global-table consistency model.

```text
Write in Region A
    ↓ asynchronous replication
Region B and Region C
```

AWS states that changes are typically replicated to other replicas within a second or less, although the model remains eventually consistent.

MREC provides low-latency Regional writes, but concurrent writes may require conflict-aware application design.

---

## 18.2 Active-active table does not require active-active application writes

DynamoDB global tables are active-active at the table level.

Northstar may still route all writes to one designated Region during normal operation:

```text
Region A:
    writes and reads

Region B:
    reads or standby

Failover:
    writes move to Region B
```

AWS explicitly describes single-primary application routing as a useful mode for avoiding MREC write conflicts.

---

## 18.3 Idempotency table

Northstar’s order-idempotency table is a strong global-table candidate.

Key:

```text
merchant_id + client_request_id
```

The application must still reason about:

- simultaneous first writes in two Regions;
- conflict behavior;
- duplicate business side effects;
- TTL and retention;
- consistency mode.

A global table does not make a non-idempotent payment operation safe.

---

## 18.4 Multi-Region strong consistency

Current DynamoDB global tables also support MRSC.

AWS documents MRSC as requiring exactly three locations—three replicas, or two replicas and a witness—and providing strong multi-Region consistency with zero RPO for committed writes.

Tradeoffs include:

- topology restrictions;
- higher cross-Region write latency than MREC;
- additional cost;
- no ability to change consistency mode after creating the global table.

This is a current advanced option, not a universal replacement for MREC.

---

## 18.5 Backup remains necessary

Global tables replicate current state.

They can also replicate:

```text
accidental overwrite
application corruption
malicious write
```

Enable point-in-time recovery or AWS Backup according to the logical-recovery requirement.

---

# 19. Amazon S3 replication

## 19.1 Cross-Region Replication

S3 Cross-Region Replication can copy selected objects to another Regional bucket.

```text
Primary object
    ↓
replication rule
    ↓
recovery bucket
```

Possible uses:

- regional resilience;
- data residency design;
- lower-latency local reads;
- independent analytical copies.

---

## 19.2 Replication Time Control

S3 Replication Time Control provides a predictable replication objective and associated metrics. Current S3 documentation states that RTC replicates 99.99% of new objects within 15 minutes under its SLA.

This does not mean:

```text
every object is guaranteed to replicate instantly
```

Northstar monitors pending bytes, pending operations, and failure events.

---

## 19.3 Existing objects

Ordinary live replication rules primarily address objects written after the applicable replication configuration is in effect.

S3 Batch Replication can copy:

- existing objects;
- previously failed objects;
- objects from another source population.

Northstar verifies historical coverage rather than assuming that adding a replication rule copied the complete existing bucket.

---

## 19.4 Deletes and versions

Deletion semantics require deliberate configuration.

Delete-marker replication has restrictions and does not receive the RTC 15-minute SLA.

For recovery-sensitive buckets, Northstar documents:

```text
Are delete markers replicated?
Are specific version deletions replicated?
Can recovery users access older versions?
What happens after lifecycle expiration?
```

---

## 19.5 Replication is not immutable backup

A replicated bucket can receive:

- new corrupted objects;
- replicated delete markers;
- unwanted overwrites as new versions;
- destructive lifecycle configuration.

Use:

```text
Versioning
Object Lock where required
AWS Backup
cross-account destination
restricted destination administration
```

according to the threat model.

---

# 20. Supporting resources people forget

## 20.1 Container images

The recovery ECS services cannot start when the required image exists only in the primary Regional ECR repository.

Northstar replicates or deliberately publishes release digests to the recovery Region during every production release.

```text
Application release is complete only when:
    image exists in all required recovery Regions
```

---

## 20.2 Secrets

A Regional application needs its credentials in the recovery Region.

Options include:

- Secrets Manager multi-Region secret replication;
- independently provisioned Regional secrets;
- a recovery workflow that creates or rotates a replacement credential.

The external payment processor must also recognize the recovery credential.

---

## 20.3 KMS keys

Encrypted copies must be usable by recovery roles.

Validate:

```text
key exists in recovery Region
key policy permits recovery principal
grants and encryption context work
backup copy used intended destination key
key administrator remains available
```

A replicated database that cannot decrypt its dependent secret or object is not recoverable.

---

## 20.4 Certificates

ACM certificates are Regional for resources such as ALBs.

The recovery ALB must already have an appropriate certificate.

Certificate issuance during an outage may depend on:

- DNS validation;
- certificate authority;
- service availability;
- domain ownership.

---

## 20.5 Queues and events

SQS queues and ordinary EventBridge event buses are Regional.

Northstar must decide what happens to work that was:

```text
accepted but not completed
in flight
waiting in primary queue
already processed but not acknowledged
```

Possible mechanisms include:

- transactional outbox retained in replicated database;
- durable raw event copy;
- controlled producer retry;
- application-level dual publication;
- EventBridge global endpoint for suitable event-routing cases;
- reconciliation against authoritative state.

Do not merely create an empty queue with the same name in the recovery Region.

---

## 20.6 Cache

Cache state should normally be reconstructible.

A cache recovery strategy may be:

```text
launch empty
    ↓
warm from database
```

or, where justified:

```text
cross-Region ElastiCache global datastore
```

The source material describes global datastore as cross-Region replication with promotion of a secondary.

Avoid making the recovery RTO depend on a cache containing irreplaceable state.

---

# 21. Route 53 failover

## 21.1 Failover records

A basic active-passive configuration uses:

```text
Primary record
    → primary ALB
    → associated health evaluation

Secondary record
    → recovery ALB
```

When the primary is considered unhealthy, Route 53 can return the secondary record according to the failover configuration.

The attached materials emphasize Route 53 health evaluation and DNS routing as part of multi-Region resilience.

---

## 21.2 A healthy ALB is not a healthy business transaction

Weak health check:

```text
GET /health
    → process returns 200
```

Better recovery check:

```text
Can the application:
    accept a representative request?
    read required configuration?
    reach authoritative data?
    perform a safe dependency check?
```

Do not make the health check so deep that a minor optional dependency removes the entire Region.

Use a carefully chosen business-readiness endpoint.

---

## 21.3 DNS convergence

DNS failover affects new name resolution.

It does not immediately move:

- established TCP connections;
- clients that ignore TTL;
- recursive resolvers with cached records;
- applications that resolved the address once at startup;
- mobile clients currently retrying one old endpoint.

A shorter TTL can reduce cache duration, but increases steady-state DNS query volume and does not force all clients to obey perfectly.

---

## 21.4 Do not fail over traffic first

Dangerous sequence:

```text
1. Route all customers to recovery Region.
2. Discover database is still read-only.
3. Discover capacity is too small.
```

Safer sequence:

```text
1. Fence old writes.
2. Activate authoritative data.
3. Scale recovery capacity.
4. Validate privately.
5. Redirect traffic.
```

---

# 22. Amazon Application Recovery Controller

## 22.1 Routing controls

ARC routing controls provide deliberate controls that can turn traffic routing on or off through associated Route 53 health checks.

The health check associated with a routing control is a routing mechanism; AWS explicitly notes that it does not itself validate application health.

```text
Application monitor:
    determines whether recovery is needed

ARC routing control:
    deliberate failover switch
```

This separation can be desirable for high-consequence failover.

---

## 22.2 Safety rules

ARC safety rules can prevent unsafe combinations.

Example assertion:

```text
At least one Region must remain ON.
```

This prevents:

```text
Primary OFF
Recovery OFF
```

Gating rules can require another control to be enabled before a dangerous change proceeds.

ARC also permits explicitly authorized break-glass overrides of safety rules, which should be tightly controlled and audited.

---

## 22.3 Region switch

Current ARC Region switch lets Northstar define a recovery plan made of ordered or parallel steps and execution blocks.

Possible steps include:

```text
scale capacity
promote Aurora Global Database
update Route 53 health-check state
change ARC routing controls
run Lambda checks
pause for approval
```

Region switch supports both active-passive failover/failback and active-active shift-away/return workflows, including cross-account resources.

### Current caveat

ARC readiness checks are no longer open to new customers. Existing customers can continue using them; new designs should examine Region switch plan evaluation and AWS Resilience Hub for related readiness assessment.

This is current knowledge beyond the core source-era exam material.

---

# 23. Route 53 versus ARC routing control

## Automatic Route 53 health failover

Strong when:

- endpoint health is reliable;
- immediate automated failover is safe;
- recovery site is always ready;
- split-brain risk is controlled.

```text
Endpoint unhealthy
    ↓
DNS failover
```

---

## ARC routing control

Strong when:

- failover is high consequence;
- operators or tested automation must coordinate data and traffic;
- a manual override is required;
- safety rules should prevent invalid states.

```text
Incident declared
    ↓
recovery steps complete
    ↓
routing control changed
```

---

## ARC Region switch

Strong when:

- recovery requires a sequence of coordinated AWS operations;
- several accounts and resource types participate;
- failover and failback should be represented as one managed plan.

---

# 24. Global Accelerator alternative

Global Accelerator provides static anycast IP addresses and directs connections to healthy Regional endpoints.

It is useful when:

- clients require fixed IP addresses;
- DNS caching would be problematic;
- TCP/UDP applications need Regional endpoint failover;
- partner allowlists should not change during a Regional shift.

Route 53 remains stronger when DNS-level policies and hostname routing are sufficient.

```text
Route 53:
    DNS-based destination selection

Global Accelerator:
    static anycast entry addresses
    and network-level endpoint selection
```

Using Global Accelerator does not activate the database, scale standby compute, or resolve write conflicts. Traffic control remains only one recovery layer.

---

# 25. The split-brain problem

## 25.1 Partial availability

At 09:22:

```text
Primary Region:
    still accepts 20% of writes

Recovery Region:
    ready to accept writes
```

If Northstar simply enables the recovery writer:

```text
Primary accepts Order 1001.
Recovery accepts another Order 1001.
Inventory reservations diverge.
Payments may execute twice.
```

This is split brain.

---

## 25.2 DNS alone does not fence the old writer

Changing DNS does not stop:

- cached clients;
- internal workers;
- direct service endpoints;
- existing connections;
- scheduled jobs;
- partner callbacks.

Failover must include a write-fencing strategy.

---

## 25.3 Possible fencing mechanisms

Depending on the workload:

```text
Database promotion demotes or disconnects old writer.

Application configuration marks only one Region writable.

A globally coordinated lease identifies the active writer.

Primary ingress is disabled.

Worker event-source mappings are stopped.

Primary runtime role loses write authority.

Firewall or routing blocks primary write path.

External processor sends callbacks only to active Region.
```

Do not rely on a control-plane mutation that may itself be unavailable without testing that assumption.

---

## 25.4 Writer epoch

An advanced application pattern stores:

```text
active_region = us-west-2
writer_epoch = 42
```

Every write includes the active epoch.

A stale Region still using:

```text
epoch = 41
```

is rejected by the authoritative transaction layer.

This protects against a process that remains alive after traffic is nominally shifted.

The storage mechanism for this lease must itself satisfy the availability and consistency requirement.

---

# 26. Active-active is a data model, not a routing setting

Deploying the same application to two Regions and using latency routing does not create a correct active-active system.

The application must define:

```text
Where may each entity be written?
How are IDs generated?
How are concurrent writes resolved?
How are inventory reservations serialized?
How are duplicate payments prevented?
How are events ordered?
What happens during network partition?
What happens when Regions rejoin?
```

Useful patterns include:

### Home Region per tenant

```text
Tenant A writes Region 1.
Tenant B writes Region 2.
```

### Home Region per entity

```text
Order is owned by the Region that created it.
```

### Conflict-free or commutative data

```text
independent counters or set additions
```

### Strong multi-Region store

Use a database whose actual consistency and topology meet the requirement.

### Single writer with fast promotion

Often simpler and safer for transactional relational workloads.

---

# 27. Network recovery

## 27.1 Recovery VPC must preexist

For a short RTO, Northstar precreates:

```text
nonoverlapping CIDR
subnets in several AZs
route tables
Internet Gateway
NAT Gateways
firewall endpoints
VPC endpoints
Transit Gateway attachments
Resolver endpoints and rules
security groups
flow logs
```

A database replica in a Region without application connectivity is not a usable recovery environment.

---

## 27.2 No primary-Region transit dependency

Bad design:

```text
Recovery Region
    ↓
must route through firewall in Primary Region
    ↓
Internet or corporate systems
```

A primary-Region outage breaks the recovery path.

The recovery cell has its own:

- egress;
- DNS;
- inspection;
- service endpoints;
- hybrid path where required.

---

## 27.3 Third-party allowlists

The payment processor accepts requests only from known public addresses.

Northstar must register:

```text
Primary NAT EIPs
Recovery NAT EIPs
or stable Global Accelerator addresses where applicable
```

before the incident.

Changing a vendor allowlist through an emergency support ticket is unlikely to satisfy a five-minute RTO.

---

## 27.4 Hybrid connectivity

Corporate applications may need both Regions.

Lesson 7’s design therefore extends:

```text
Direct Connect / VPN
    ↓
DX gateway
    ↓
TGW in Primary Region

and

TGW in Recovery Region
```

Routes, advertisements, DNS, firewalls, and bandwidth must be validated for recovery traffic.

A backup Direct Connect or VPN path that can carry only 5% of required production traffic may preserve administration but not full service.

---

# 28. IAM architecture

## 28.1 Identity map

| Actor | Identity | Authority |
| --- | --- | --- |
| Incident commander | `DRIncidentCommander` | Declare and coordinate recovery |
| Recovery orchestrator | ARC/Step Functions execution role | Run approved recovery operations |
| Database recovery role | `DatabaseRecoveryRole` | Promote selected databases |
| Capacity role | `RecoveryCapacityRole` | Scale approved ECS/ASG/Lambda resources |
| Traffic role | `TrafficFailoverRole` | Change ARC/Route 53 controls |
| Backup administrator | `BackupPolicyAdministrator` | Define protection policies |
| Backup copy service | AWS Backup service role | Copy recovery points |
| Restore operator | `BackupRestoreOperator` | Restore approved resource types |
| Vault custodian | `RecoveryVaultCustodian` | Manage restricted vault access |
| KMS administrator | Regional recovery key role | Manage key policy and lifecycle |
| Security investigator | Incident investigation role | Read evidence and findings |
| Application runtime | Recovery Regional task/function role | Perform business operations |
| Auditor | Read-only evidence role | Review recovery events and tests |

---

## 28.2 Separate backup deletion from restore

The principal that performs ordinary production administration should not automatically be allowed to:

```text
delete every backup
modify Vault Lock
destroy backup KMS key
```

Likewise, the role that restores a database does not necessarily need authority to change organization-wide backup policy.

---

## 28.3 Recovery automation role

An ARC Region switch or Step Functions recovery process may need authority to:

```text
promote Aurora
scale ECS
update Auto Scaling
enable event consumers
invoke validation Lambda
change Route 53 or ARC routing
publish incident events
```

The role should be limited to:

- named recovery resources;
- intended Regions;
- approved actions;
- controlled invocation principals.

---

## 28.4 `iam:PassRole`

Recovery automation may launch:

- ECS tasks;
- EC2 instances;
- DRS recovery instances;
- validation functions;
- restored databases with monitoring roles.

Its `iam:PassRole` permission must be restricted to the exact runtime and service roles required for recovery.

A broad pass-role permission can turn the DR system into an escalation path.

---

## 28.5 SCPs and recovery

An SCP that denies:

```text
all operations outside us-east-1
```

can make the recovery Region unusable.

The organizational policy must permit:

- approved recovery Regions;
- backup copies;
- KMS operations;
- cross-account restore;
- recovery orchestration.

Governance should prevent unapproved use without blocking the declared continuity plan.

---

## 28.6 Emergency identity

Suppose the corporate identity provider is unavailable during the Regional incident.

Northstar maintains a tightly controlled emergency path that:

- does not depend on the failed IdP;
- uses strong MFA;
- has limited sessions;
- is monitored immediately;
- is periodically tested;
- cannot become ordinary daily access.

---

# 29. The recovery runbook

## Phase 0 — Preparation

Before any incident:

```text
replication healthy
backups current
restore tests passing
recovery infrastructure deployed
images and secrets present
quotas validated
external allowlists configured
runbook approved
roles tested
game days completed
```

---

## Phase 1 — Detect

Signals include:

```text
synthetic transaction failures
ALB 5xx
Aurora failure
replication interruption
AWS Health event
KMS or Secrets Manager errors
business transaction success drop
```

Do not fail over merely because one low-level alarm fired.

Correlate customer and dependency impact.

---

## Phase 2 — Declare

The incident commander identifies:

```text
affected workload
failure scope
recovery strategy
selected recovery Region
acceptable recovery point
authority to proceed
```

The incident is recorded with a timestamp.

---

## Phase 3 — Fence

Stop unsafe primary writes.

```text
disable primary ingress or write operations
stop primary workers
confirm database writer state
block stale writer epoch
pause outbound payment execution if needed
```

---

## Phase 4 — Activate data

Examples:

```text
Promote Aurora secondary.
Promote RDS read replica.
Select restore point.
Activate DRS recovery instances.
Confirm DynamoDB replica state.
Verify S3 replication.
```

Record:

```text
recovery point timestamp
known replication lag
estimated data loss
```

---

## Phase 5 — Activate capacity

```text
scale ECS services
scale Auto Scaling groups
enable Lambda event sources
start scheduled jobs selectively
confirm NAT and endpoint capacity
```

Do not start noncritical analytics before payment and order capacity is stable.

---

## Phase 6 — Validate privately

Run synthetic operations against the recovery endpoint before exposing customers.

```text
create test order
authorize test payment
read order
publish event
consume event
send test notification
verify logs
verify tracing
```

Use synthetic tenants and reversible transactions.

---

## Phase 7 — Redirect traffic

```text
ARC routing control
or
Route 53 failover
or
Global Accelerator endpoint shift
```

Record the exact time of the traffic action.

---

## Phase 8 — Observe

Watch:

```text
transaction success
latency
capacity
replication
duplicate rate
queue age
database locks
processor errors
customer impact
```

---

## Phase 9 — Stabilize

The recovery Region is now production.

Immediately:

```text
enable backup of new primary
start reverse replication
raise monitoring level
restrict unnecessary change
preserve incident evidence
```

Recovery automation improves speed and repeatability, but AWS recommends that it also be possible to halt unsafe automation and investigate unexpected conditions.

---

# 30. Black Friday timeline

Northstar’s **target** order-recovery sequence is:

| Time | Action |
| ---: | --- |
| 09:17 | Customer-impact alarm fires |
| 09:18 | Incident commander validates Regional scope |
| 09:20 | Recovery declared |
| 09:21 | Primary write paths fenced |
| 09:22 | Aurora managed failover initiated |
| 09:25 | Recovery database writer available |
| 09:26 | ECS services scaled |
| 09:28 | Synthetic order and payment pass |
| 09:29 | ARC routing control changed |
| 09:31 | Most new traffic reaches recovery |
| 09:32 | Workload considered restored |

```text
Target RTO:
    15 minutes
```

This timeline is credible only because every phase has been measured during a representative drill.

---

# 31. Failback

## 31.1 Do not rush

At 13:00, AWS reports that the primary Region is recovering.

Northstar should not immediately reverse DNS.

The recovery Region is now:

```text
production
authoritative writer
source of newest data
```

The old primary may be stale or partially corrupted.

---

## 31.2 Safe failback process

```text
1. Keep recovery Region as production.

2. Repair and validate the original Region.

3. Recreate it as a secondary.

4. Replicate all recovery-period writes back.

5. Wait for replication to become healthy.

6. Validate original Region privately.

7. Perform a planned switchover.

8. Redirect traffic gradually.

9. Monitor.

10. Restore the recovery Region to standby status.
```

This is the reverse-replication requirement emphasized in the attached material.

---

## 31.3 Aurora failback

For a healthy Aurora Global Database:

```text
Recovery Region primary
    ↓ replication
Original Region secondary
    ↓
managed switchover
    ↓
Original Region primary again
```

A healthy planned switchover is preferable to treating failback as another emergency failover.

---

## 31.4 RDS failback

After promoting an ordinary RDS read replica:

```text
Recovery DB is standalone primary.
```

Northstar must:

1. create a new replica or migration path toward the original Region;
2. wait for synchronization;
3. stop or fence writes;
4. promote the original-side replacement;
5. update application endpoints;
6. rebuild ongoing DR protection.

---

## 31.5 DRS failback

DRS performs reversed replication from recovered EC2 instances toward the original source environment, followed by controlled failback.

Failback network and metadata-service prerequisites must be planned before the incident, not discovered afterward.

---

## 31.6 Failback has its own objectives

Northstar defines:

```text
Failback RTO:
    How much planned interruption is acceptable?

Failback RPO:
    How much recovery-site data may be lost?
```

The answer is not automatically identical to the emergency failover objective.

---

# 32. Cyber-recovery design

## 32.1 The ransomware scenario

Suppose the failure is not Regional.

An attacker:

```text
compromises deployment credentials
encrypts application data
deletes resources
attempts to delete backups
modifies monitoring
```

Automatically failing to a continuously replicated database may reproduce the corrupted state.

---

## 32.2 Recovery account

Northstar uses a separately administered recovery account with:

```text
restricted trust
no ordinary workload deployment
immutable vaults
independent KMS administration
minimal network connectivity
separate recovery roles
```

---

## 32.3 Clean-room restore

```text
Select pre-compromise recovery point
    ↓
restore into isolated VPC/account
    ↓
scan systems and data
    ↓
validate identity and infrastructure definitions
    ↓
rotate credentials
    ↓
rebuild trusted application
    ↓
reconnect controlled dependencies
```

The clean room should not immediately inherit every route and credential from the compromised environment.

---

## 32.4 Replication versus recovery point

The newest recovery point is not always the safest recovery point.

During cyber recovery, Northstar may deliberately restore older data:

```text
latest backup:
    potentially compromised

earlier backup:
    known clean
```

This may increase data loss beyond the ordinary RPO.

The business must explicitly decide how to reconcile post-recovery transactions.

---

# 33. Testing the program

## 33.1 A backup test is not a Region failover test

Different tests answer different questions.

| Test | What it validates |
| --- | --- |
| Restore one database | Recovery point is usable |
| Restore complete application | Dependencies can be reconstructed |
| DRS drill | Servers can launch from replicated state |
| AZ impairment test | In-Region high availability |
| Regional game day | Cross-Region recovery |
| Failback test | Return path works |
| Cyber-recovery exercise | Recovery from untrusted production |
| Capacity test | Standby supports production load |
| Identity-loss exercise | Emergency access works |

---

## 33.2 AWS Resilience Hub

AWS Resilience Hub lets Northstar define RTO and RPO targets in resiliency policies and assess whether a modeled application is estimated to meet them. It can recognize patterns such as cross-Region snapshots, read replicas, and Aurora Global Database secondaries.

An assessment is useful evidence.

It does not replace a timed recovery drill. AWS documentation still expects the organization to maintain and test its recovery procedure.

---

## 33.3 AWS Fault Injection Service

AWS FIS can introduce controlled faults into supported AWS resources.

Examples:

```text
stop EC2 instances
impair resource behavior
test ECS/EKS response
test RDS-related resilience scenarios
```

AWS Well-Architected guidance recommends combining known recovery tests with fault-injection experiments and using successful experiments as repeatable regression tests.

FIS should begin with:

```text
defined hypothesis
small blast radius
stop conditions
monitoring
rollback
authorized window
```

Do not begin a chaos program by randomly terminating production resources.

---

## 33.4 Game days

A game day tests both systems and people.

Scenario:

```text
Primary Region unavailable.
Payment processor support cannot be contacted.
One recovery operator is absent.
Aurora replica lag is 45 seconds.
DNS still has old records cached.
```

Teams perform the real process:

- incident declaration;
- authority assumption;
- fencing;
- promotion;
- traffic shift;
- customer communication;
- failback.

AWS recommends regular game days to test technical recovery and incident-response procedures in a controlled environment.

---

## 33.5 Example cadence

| Frequency | Test |
| --- | --- |
| Daily | Replication and backup freshness validation |
| Weekly | Recovery-image, secret, certificate, and quota checks |
| Monthly | Automated sample restore and validation |
| Quarterly | Workload-specific Regional recovery game day |
| Twice yearly | Full payment and commerce failover/failback |
| Annually | Company-wide business-continuity exercise |
| After major architectural change | Targeted DR reassessment and test |

A test that never includes failback validates only half the lifecycle.

---

# 34. Recovery readiness dashboard

For each workload, Northstar tracks:

```text
Last successful backup
Last successful cross-account copy
Last successful cross-Region copy
Oldest acceptable recovery point
Restore-test status and duration
Aurora replication lag
RDS replica lag
DynamoDB replica status
S3 pending replication bytes
DRS replication state
Recovery-region task capacity
Subnet available IPs
Service quotas
Container image digest availability
Secret replication status
KMS key enabled state
Certificate expiry
Route 53 / ARC configuration
External allowlist validation
Last failover drill
Last failback drill
Measured RTO
Measured RPO
```

A dashboard cell marked green because:

```text
secondary resource exists
```

is insufficient.

Readiness means the integrated recovery path has recently worked.

---

# 35. Observability during an incident

## 35.1 Business signals

```text
successful orders/minute
payment authorization success
duplicate payment rate
checkout abandonment
inventory reservation conflict
queue age
refund errors
```

These determine whether customers have recovered.

---

## 35.2 Infrastructure signals

```text
ALB healthy hosts
ECS running/pending tasks
Aurora promotion state
replication lag
DynamoDB errors
S3 replication metrics
KMS and secret errors
NAT and firewall behavior
Lambda concurrency
```

---

## 35.3 Recovery workflow signals

```text
current runbook phase
completed actions
failed actions
operator
start and completion times
selected recovery point
known data loss
traffic-control state
```

---

## 35.4 Audit evidence

CloudTrail records actions such as:

```text
Who promoted the database?
Who changed the routing control?
Who restored the backup?
Who assumed the emergency role?
Who altered Vault Lock?
Who scheduled KMS-key deletion?
```

The incident record adds business context:

```text
why the action was approved
what impact was observed
which recovery point was selected
```

---

# 36. Cost model

Major cost categories include:

```text
idle or scaled-down recovery compute
Aurora and RDS cross-Region replicas
DynamoDB global-table replication
S3 replication and RTC
cross-Region data transfer
AWS Backup storage and copies
Vault Lock retention
DRS replication and staging
duplicate NAT and firewall infrastructure
VPC endpoints
replicated ECR images
Regional secrets and KMS keys
Route 53 health checks
ARC resources
Global Accelerator
restore tests and game days
```

---

## 36.1 Cost ladder

```text
Backup and restore
    lowest steady-state cost
        ↓
Pilot light
        ↓
Warm standby
        ↓
Active-active
    highest steady-state cost
```

This is a tendency, not an exact invoice formula.

A badly operated backup estate can be expensive.

A small serverless active-active workload may be inexpensive.

---

## 36.2 Tiering controls cost

Do not give a monthly analytics dashboard the same architecture as payment authorization.

```text
Payment:
    minutes of downtime are expensive

Historical report:
    several hours may be acceptable
```

The largest DR cost optimization is usually assigning honest business objectives rather than declaring every application “mission critical.”

---

## 36.3 Warm standby sizing

Too small:

```text
cheap
but fails RTO under load
```

Too large:

```text
meets capacity
but approaches active-active cost
```

Use measured scaling time and predictable business periods to choose the standby baseline.

---

## 36.4 Backup lifecycle

Older recovery points may move to lower-cost storage where supported.

But lower storage cost can increase retrieval time.

The lifecycle must remain compatible with:

- legal retention;
- cyber-recovery horizon;
- restore-time objective;
- service support;
- test frequency.

---

# 37. Failure drills

## Failure A: The team says “Aurora is Multi-AZ, so we have Regional DR”

Multi-AZ protects against supported failures inside one Region.

Use Aurora Global Database, cross-Region backups, or another cross-Region strategy for Regional loss.

---

## Failure B: Backups exist, but restoration takes nine hours

The backup may satisfy data retention while violating the workload RTO.

Measure restore and application-integration time.

---

## Failure C: Route 53 fails over before database promotion

Customers reach a read-only or stale environment.

Activate and validate authoritative state before traffic.

---

## Failure D: Route 53 changed, but some clients continue using the primary

Existing connections and cached DNS answers remain.

Fence the primary writer independently of DNS.

---

## Failure E: Both Regions accept writes

This is split brain.

Stop one writer, establish authoritative ownership, and reconcile conflicts before normal operation.

---

## Failure F: Recovery ECS tasks stay pending

Investigate:

```text
Fargate or EC2 capacity
service quota
subnet IPs
task execution role
ECR image
security groups
```

---

## Failure G: Tasks launch but cannot pull the image

The image was not copied to the recovery Region, or the task execution role and ECR network path are wrong.

---

## Failure H: Application starts but cannot decrypt its secret

Investigate:

```text
secret exists in Region
secret resource policy
runtime role
KMS key policy
key state
encryption context
VPC endpoint
```

---

## Failure I: Database restored, but application cannot connect

Restore created a new endpoint.

Update:

```text
DNS/configuration
security groups
RDS Proxy
database credential
database-level permissions
```

---

## Failure J: Recovery Region can support normal traffic but not Black Friday

The standby was capacity-tested only at average load.

Pre-scale for known peaks or accept a different objective.

---

## Failure K: Payment processor rejects every recovery request

Its allowlist contains only the primary NAT address, or the recovery credential was never registered.

---

## Failure L: Aurora promotion loses recent orders

Those writes had not reached the selected secondary before failover.

Compare actual lag with RPO and reconcile from external evidence where possible.

---

## Failure M: RDS replica was promoted, but the application still uses the old endpoint

Promotion does not automatically update every application configuration.

---

## Failure N: New S3 objects replicated, but historical objects are absent

The replication rule did not backfill the existing bucket.

Use S3 Batch Replication for the required historical population.

---

## Failure O: S3 recovery bucket contains a deletion marker

Deletion replication behavior matched the configured rule.

Recover the required object version and review whether delete-marker replication fits the recovery objective.

---

## Failure P: DRS recovery instance boots, but the application fails

Possible causes:

```text
license binding
hard-coded IP
directory/DNS dependency
database order
shared storage
certificate
post-launch script
```

Server boot is not application recovery.

---

## Failure Q: DRS launches the application but users still reach the old site

DRS does not redirect production traffic.

Execute the separate routing step.

---

## Failure R: Backup account is also compromised

The same administrator or automation had authority in both workload and backup accounts.

Strengthen separation, Vault Lock, independent recovery roles, and multi-party controls.

---

## Failure S: Restore testing reports success, but the database contains unusable data

The test checked only resource creation.

Add application-level validation queries and consistency tests.

---

## Failure T: The air-gapped vault is secure, but no one can recover from it

Recovery access, role trust, KMS, network, or multi-party approval was never rehearsed.

Isolation without tested access can become unrecoverability.

---

## Failure U: Failback begins before reverse replication completes

Recovery-period writes are lost or environments diverge.

Keep recovery authoritative until synchronization and validation are complete.

---

## Failure V: Queue in recovery Region is empty

Regional queues are not automatically copies of the primary queue.

Recover work from replicated authoritative state, outbox, event archive, or producer reconciliation.

---

## Failure W: ACM certificate is missing in recovery Region

The ALB cannot provide the intended TLS identity.

Provision and validate certificates before the incident.

---

## Failure X: Health check says healthy while checkout fails

The check only verifies the web process.

Use an appropriately deep business-readiness signal.

---

## Failure Y: Automatic health failover sends traffic to an unscaled standby

Detection worked.

Capacity readiness did not.

Use ARC safety controls, pre-scaling, or coordinated recovery.

---

## Failure Z: Security automation turns both Regions off

Failover controls lacked an assertion that at least one site remain active.

ARC safety rules can prevent this category of invalid state.

---

## Failure AA: Recovery Region depends on primary DNS or firewall

The supposed independent cell has a cross-Region dependency.

Move the required infrastructure into the recovery cell.

---

## Failure AB: Active-active creates duplicate payments

Both Regions performed the external side effect without shared idempotency or ownership.

Traffic distribution does not supply transaction semantics.

---

## Failure AC: KMS key was scheduled for deletion

Backups and replicas may become unreadable.

Cancel deletion during the waiting period where permitted, investigate authority, and validate every dependent recovery point.

---

## Failure AD: Resilience Hub says the policy is met, but the game day fails

The assessment estimated resource-level resilience.

The runbook, identities, dependencies, or application behavior failed.

Actual drills remain necessary.

---

## Failure AE: Failover works, but failback does not

The organization tested only the dramatic first half.

Reverse replication, planned switchover, traffic return, and restoration of protection must all be rehearsed.

---

# 38. Changed-requirement variants

## Variant 1: RTO is 24 hours and RPO is 12 hours

Use backup and restore.

Do not pay for warm standby without another requirement.

---

## Variant 2: RTO is 15 minutes and RPO is 5 minutes

Use warm standby or a thoroughly automated pilot light, depending on measured activation time.

The word “pilot light” is not disqualifying if the actual implementation meets the objectives.

---

## Variant 3: Committed writes must have zero Regional RPO

Consider a suitably supported strongly consistent multi-Region data store such as DynamoDB MRSC for compatible access patterns.

A relational single-writer architecture may require a different business or data model.

---

## Variant 4: The application is almost entirely read-only

Active-active can be substantially simpler:

```text
replicate objects/data
serve reads in both Regions
send writes to one authoritative Region
```

---

## Variant 5: Clients cannot tolerate DNS changes

Evaluate Global Accelerator with stable anycast IP addresses.

The backend still requires complete Regional recovery.

---

## Variant 6: The threat is ransomware rather than Regional failure

Prioritize:

```text
cross-account immutable backup
clean-room restore
independent identity
credential rotation
historical recovery points
```

A low-lag replica alone is insufficient.

---

## Variant 7: Data must remain inside the European Union

Use a recovery Region that satisfies the approved geographic constraint.

Do not replicate to the cheapest arbitrary Region.

---

## Variant 8: Legacy servers remain on premises

Use DRS to replicate them to AWS, combined with:

- recovery networking;
- directory and DNS;
- application-consistent procedures;
- traffic failover;
- failback.

---

## Variant 9: Kubernetes is the runtime

Replicate or redeploy:

```text
EKS cluster infrastructure
node or Fargate capacity
add-ons
container images
secrets
storage
ingress
DNS
Pod Identity/IAM
application manifests
```

A second empty EKS cluster is not application DR.

---

## Variant 10: The recovery Region may become primary for months

Treat it as full production immediately after failover:

```text
backups
monitoring
security
capacity
deployment
on-call
new recovery protection
```

Do not leave it in a temporary, weakly protected mode.

---

# 39. SAP-C02 decision snippets

## High availability versus disaster recovery

```text
Automatic failover across AZs in one Region:
    high availability

Recovery after complete Regional failure:
    disaster recovery
```

---

## RTO versus RPO

```text
Maximum acceptable downtime:
    RTO

Maximum acceptable recent data loss:
    RPO
```

---

## Backup and restore

```text
Lowest continuous cost
Highest recovery time
Restore infrastructure and data after event
```

---

## Pilot light

```text
Critical core remains running
Most compute starts during recovery
```

---

## Warm standby

```text
Scaled-down complete environment
Scale up and redirect traffic
```

---

## Multi-site

```text
Multiple sites serve production
Lowest potential RTO
Highest cost and data complexity
```

---

## AWS Backup versus DRS

```text
Central protection and restoration of supported AWS resources:
    AWS Backup

Continuous block replication and EC2 launch
for server workloads:
    Elastic Disaster Recovery
```

---

## Replication versus backup

```text
Low-lag copy of current state:
    replication

Historical recovery point:
    backup
```

---

## Aurora Global Database

```text
Cross-Region relational secondary
Planned switchover
Unplanned failover may lose unreplicated writes
```

---

## RDS cross-Region read replica

```text
Asynchronous replica
Promote manually for recovery
Redirect application
Create new protection afterward
```

---

## RDS cross-Region automated backup

```text
Lower-cost recovery copy
Restore required
Higher RTO than live replica
```

---

## DynamoDB global table

```text
Multi-Region table replicas
MREC:
    eventual consistency

MRSC:
    strong multi-Region consistency
    constrained topology
```

---

## S3 CRR versus Batch Replication

```text
Ongoing eligible object replication:
    CRR

Existing or previously failed object population:
    Batch Replication
```

---

## Route 53 failover versus ARC routing control

```text
Health-based DNS automation:
    Route 53 failover

Deliberate highly available recovery switch
with safety rules:
    ARC routing control
```

---

## ARC Region switch

```text
Orchestrate ordered multi-Region recovery steps:
    ARC Region switch
```

---

## Vault Lock

```text
Authorized override remains:
    governance mode

Immutable after grace period:
    compliance mode
```

---

## Restore testing

```text
Backup exists:
    protection evidence

Backup restores and application validates:
    recovery evidence
```

---

## Failback

```text
Repair original
Reverse replicate
Validate
Planned switchover
Return traffic
Reestablish DR
```

---

# 40. Retrieval practice

## 1

What does RTO measure?

## 2

What does RPO measure?

## 3

Why is database-promotion time not the same as application RTO?

## 4

Why is one component’s replication lag not necessarily the workload RPO?

## 5

What is the difference between high availability and disaster recovery?

## 6

What failure does replication handle better than historical backup?

## 7

What failure does historical backup handle better than replication?

## 8

What are the four classic DR strategies?

## 9

What remains running in a pilot-light design?

## 10

What remains running in a warm standby?

## 11

Why is warm standby more expensive than pilot light?

## 12

Why is active-active substantially more complex than DNS routing?

## 13

What should determine which strategy a workload receives?

## 14

What is a recovery group?

## 15

Why must the recovery Region have its own NAT and service endpoints?

## 16

Why must quotas be verified before an incident?

## 17

What is an AWS Backup plan?

## 18

What does cross-account backup protect against?

## 19

What does cross-Region backup protect against?

## 20

What does Vault Lock compliance mode provide?

## 21

What does restore testing prove that a successful backup job does not?

## 22

Does AWS Backup guarantee a particular restore duration?

## 23

Why does a restore normally create a new resource?

## 24

What type of workload is AWS DRS designed to protect?

## 25

What does DRS replicate during normal operation?

## 26

What is the difference between a DRS drill and recovery?

## 27

Does DRS reroute production traffic?

## 28

What must happen before DRS failback?

## 29

What is the difference between an Aurora switchover and failover?

## 30

Can an unplanned Aurora global-database failover lose writes?

## 31

Does Aurora write forwarding make the secondary an independent writer?

## 32

What must happen after promoting an RDS cross-Region read replica?

## 33

What is the difference between an RDS read replica and replicated automated backup?

## 34

What is DynamoDB MREC?

## 35

Why might an application use a single writer even with a global table?

## 36

What is DynamoDB MRSC?

## 37

Why does a DynamoDB global table still need backup?

## 38

What does S3 RTC provide?

## 39

Why might historical objects be absent after enabling CRR?

## 40

Why is S3 replication not an immutable backup?

## 41

Why must container images be present in the recovery Region?

## 42

Why must a Regional ALB certificate be prepared in advance?

## 43

What is write fencing?

## 44

Why does changing DNS not fence the primary Region?

## 45

What is split brain?

## 46

What does an ARC routing-control health check represent?

## 47

What do ARC safety rules prevent?

## 48

What does ARC Region switch add?

## 49

Why might Global Accelerator be useful instead of DNS-only failover?

## 50

What is the correct order of major recovery operations?

## 51

Why should Northstar not immediately fail back when the original Region returns?

## 52

What is reverse replication?

## 53

Why does failback need testing?

## 54

Why is cyber recovery different from Regional failover?

## 55

Why might the latest recovery point be unsafe during ransomware recovery?

## 56

What does AWS Resilience Hub provide?

## 57

Does a Resilience Hub assessment replace a drill?

## 58

What does AWS FIS provide?

## 59

What is a game day?

## 60

What is the largest conceptual mistake in disaster-recovery design?

---

# 41. Answer key

## 1

The maximum acceptable delay between interruption and restoration of the workload.

## 2

The maximum acceptable amount of recent data that may be lost, expressed as the age of the newest required recovery point.

## 3

The complete service still needs detection, decision, fencing, compute, networking, validation, and traffic convergence.

## 4

Other authoritative stores or files may have greater lag or older recovery points.

## 5

High availability handles component and often AZ failures while remaining operational. Disaster recovery restores service after a major failure such as Regional loss.

## 6

Loss of current infrastructure when the replica remains current and promotable.

## 7

Logical corruption, malicious change, or deletion that was also copied to replicas.

## 8

Backup and restore, pilot light, warm standby, and multi-site/active-active.

## 9

Critical core resources, usually including current data and essential infrastructure.

## 10

A complete but reduced-capacity functional application environment.

## 11

More application components and compute capacity run continuously.

## 12

Both Regions may perform business writes, requiring ownership, conflict resolution, ordering, idempotency, and partition behavior.

## 13

Measured business RTO, RPO, risk, dependencies, and cost.

## 14

The resources and dependencies that must recover together to restore one business service.

## 15

A primary-Region dependency would make the recovery cell unavailable during the same incident.

## 16

The infrastructure definition can request capacity that the account or Region is not permitted or able to launch.

## 17

A policy describing backup schedules, retention, lifecycle, selection, and copy behavior.

## 18

Compromise, deletion, or administrative failure isolated to the workload account.

## 19

Loss or unavailability of the source Region.

## 20

After its grace period, protected recovery points and lock configuration cannot be altered before required retention ends.

## 21

That a recovery point can create a usable resource and pass application-level validation within the required objectives.

## 22

No.

## 23

To avoid destructively overwriting the existing resource during recovery.

## 24

Supported EC2 or on-premises/cloud server workloads that need block-level replication and EC2 recovery.

## 25

Server disk blocks into a low-cost staging area.

## 26

A drill launches test instances without declaring production recovery. Recovery launches the instances intended to become production.

## 27

No. Traffic redirection is a separate operation.

## 28

Current writes from the recovery instances must be replicated back toward the original source environment.

## 29

A switchover is planned while both sides are healthy and synchronized. A failover responds to an unplanned outage and may accept data loss.

## 30

Yes, if acknowledged writes had not reached the selected secondary.

## 31

No. Writes are forwarded to and applied first on the primary.

## 32

Redirect application traffic and create a new replica or other protection path from the promoted database.

## 33

A read replica is a running asynchronous database that can be promoted. A replicated backup must first be restored.

## 34

The default global-table mode in which writes replicate asynchronously and become eventually consistent across Regions.

## 35

To reduce concurrent-write conflicts and simplify ownership semantics.

## 36

A strongly consistent global-table mode with a constrained three-location topology.

## 37

Current-state replication can propagate corruption or malicious writes.

## 38

Predictable object-replication timing, metrics, and an SLA for the stated percentage of new objects.

## 39

Ordinary live replication does not necessarily backfill objects that existed before the rule.

## 40

Changes and deletion behavior can also replicate, and the destination may share administrative compromise.

## 41

ECS cannot launch the intended application revision when its image is available only in the failed Region.

## 42

ALB certificates are Regional, and emergency issuance introduces an unnecessary dependency and delay.

## 43

Ensuring that the old site can no longer make authoritative writes before the new writer is enabled.

## 44

Cached clients, existing connections, direct endpoints, workers, and scheduled jobs may continue using it.

## 45

Two sites independently accepting writes for the same authoritative state and diverging.

## 46

A deliberate Route 53 traffic-control switch, not necessarily a real application-health measurement.

## 47

Invalid control combinations such as routing traffic to no Region or shifting to an unprepared site.

## 48

A managed plan that coordinates ordered or parallel recovery operations across resources and accounts.

## 49

It provides stable anycast entry addresses and avoids relying entirely on client DNS convergence.

## 50

Fence old writes, activate data, activate capacity, validate, and then redirect traffic.

## 51

The recovery Region contains the newest authoritative writes, and the original may still be stale or unsafe.

## 52

Copying recovery-period changes from the active recovery site toward the repaired original site.

## 53

It contains data, network, application, traffic, and protection steps that can fail independently.

## 54

Cyber recovery assumes the production identities, systems, data, or automation may be compromised and requires an independently trusted recovery path.

## 55

It may already contain the attacker’s encryption, corruption, or malicious changes.

## 56

Modeled resiliency policies, estimated RTO/RPO assessments, and recommendations for recognized application resources.

## 57

No.

## 58

Controlled fault-injection experiments against supported resources.

## 59

A controlled exercise in which systems and people perform realistic incident and recovery procedures.

## 60

Treating the existence of a replica, backup, or second Region as proof that the complete business service can recover.

---

# 42. What to memorize now

```text
RTO
    → maximum downtime

RPO
    → maximum recent data loss
```

```text
Multi-AZ
    → high availability inside a Region

Multi-Region
    → possible disaster-recovery foundation
```

```text
Backup and restore
    → restore everything after failure
    → cheapest
    → slowest
```

```text
Pilot light
    → data and critical core stay running
    → most compute starts later
```

```text
Warm standby
    → complete small environment
    → scale and redirect
```

```text
Multi-site
    → multiple active sites
    → fastest potential recovery
    → highest cost and data complexity
```

```text
Replication
    → current-state infrastructure recovery

Backup
    → historical and logical recovery
```

```text
AWS Backup
    → backup plans
    → vaults
    → cross-account / cross-Region copies
    → Vault Lock
    → restore testing
```

```text
Elastic Disaster Recovery
    → continuous block replication
    → low-cost staging
    → launch EC2 drill/recovery instances
    → does not redirect traffic
```

```text
Aurora Global Database
    → Regional secondary
    → switchover when healthy
    → failover during disaster
    → unreplicated writes can be lost
```

```text
RDS cross-Region read replica
    → asynchronous
    → promote
    → redirect application

RDS replicated backup
    → restore required
```

```text
DynamoDB global tables

MREC:
    eventual cross-Region consistency

MRSC:
    strong cross-Region consistency
    constrained topology
```

```text
S3 CRR
    → ongoing replication

S3 Batch Replication
    → existing and failed objects

S3 RTC
    → predictable replication objective
```

```text
Recovery order:

fence old writer
    ↓
activate data
    ↓
activate capacity
    ↓
validate
    ↓
route traffic
```

```text
DNS failover
    ≠
write fencing
    ≠
capacity activation
```

```text
ARC routing control
    → deliberate traffic switch

ARC safety rule
    → prevent unsafe switch combinations

ARC Region switch
    → orchestrate recovery plan
```

```text
Failover
    → primary to recovery

Failback
    → reverse replicate
    → validate
    → planned return
```

```text
A backup that has never been restored
    → an assumption

A tested restore
    → evidence
```

```text
Second Region
    ≠
disaster-recovery program
```

---

# 43. What can remain recognition-level

You do not yet need perfect recollection of:

- every AWS Backup resource-support matrix;
- all Vault Lock API properties;
- logically air-gapped vault multi-party approval setup;
- DRS replication-agent ports;
- DRS conversion-server internals;
- Aurora Global Database endpoint variations;
- every DynamoDB MRSC topology rule;
- S3 replication XML;
- ARC execution-block schemas;
- ARC safety-rule API syntax;
- Global Accelerator traffic-dial configuration;
- Route 53 health-checker IP ranges;
- Resilience Hub application-import syntax;
- FIS experiment-template syntax;
- every cross-Region KMS option;
- exact service quotas.

The durable model is:

```text
Business impact
    ↓
RTO and RPO
    ↓
recovery strategy
    ↓
data protection
    ↓
predeployed infrastructure
    ↓
write fencing
    ↓
capacity activation
    ↓
validation
    ↓
traffic failover
    ↓
stabilization
    ↓
reverse replication
    ↓
failback
```

At every step, continue applying Lesson 0:

```text
Authorization:
    Who may declare recovery?
    Which service role promotes data?
    Which role changes traffic?
    Who may restore or delete backups?
    Which SCP, KMS policy, vault policy,
    or PassRole permission applies?
```

```text
Networking:
    Is the recovery cell independent?
    Does it have DNS, routes, endpoints,
    NAT, firewall, hybrid connectivity,
    certificates, and third-party allowlisting?
    Does the return path work?
```

And add the Lesson 17 questions:

```text
Data:
    Which site is authoritative?
    What is the newest safe recovery point?
    How are old writers fenced?

Capacity:
    Can the standby carry real production load?

Recovery:
    Has the complete path been timed?

Failback:
    How do recovery-period writes return
    without creating divergence?
```
