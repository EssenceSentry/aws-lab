# Lesson 1 — A Small but Production-Grade Web Application

> **Source note:** The exam emphasis and AWS service comparisons in this lesson are grounded in the uploaded Tutorials Dojo SAP-C02 material. The scenario, architecture, diagrams, and decision sequence are a teaching synthesis. Core service behavior was also checked against current official AWS documentation. The Tutorials Dojo guide itself describes the ebook as supplementary material to be combined with practice and hands-on work. fileciteturn5file2

---

# 1. The project

## 1.1 Business brief

Northstar is launching a customer portal.

Customers will use the portal to:

- sign in;
- view their subscriptions;
- update billing information;
- download reports;
- upload supporting documents.

The application is currently a conventional Python web application backed by PostgreSQL. It is not containerized and does not need a global multi-Region architecture yet.

The engineering team is small, but this is a real production workload. Northstar therefore requires:

- HTTPS for all customer traffic;
- no direct Internet access to application servers or the database;
- tolerance of an EC2 instance failure;
- tolerance of one Availability Zone becoming unavailable;
- automatic capacity changes during traffic spikes;
- durable storage for customer uploads;
- relational transactions;
- monitoring, alerting, auditability, and recoverable backups;
- reasonable operational effort and cost.

This is intentionally a **single-Region architecture**. Regional disaster recovery will be handled in a later project.

---

## 1.2 Why this is the first project

A single server can technically run:

```text
DNS
web server
application
database
uploaded files
logs
```

But this creates several coupled failure modes:

```text
One machine fails
    ↓
Everything fails

Traffic increases
    ↓
The whole machine must grow

Application is replaced
    ↓
Local uploads may disappear

Database needs maintenance
    ↓
The whole application is interrupted
```

A production architecture separates these responsibilities:

```text
Entry point
    ↓
Traffic distribution
    ↓
Replaceable compute
    ↓
Durable state
```

The central design principle is:

> **Make compute replaceable. Keep important state outside the compute instances.**

---

# 2. Constraint ledger

| Dimension | Requirement |
| --- | --- |
| Functional | Serve a web application, store relational data, accept file uploads |
| Scale | Moderate baseline traffic with occasional large spikes |
| Availability | Survive an instance failure and an Availability Zone failure |
| Security | HTTPS, least privilege, no public application or database instances |
| Data | Durable uploads and transactional relational data |
| Operations | Small team; automation preferred |
| Recovery | Restore deleted or corrupted data from backups |
| Cost | Avoid permanent overprovisioning |
| Scope | One production account and one AWS Region |

These constraints select the architecture. The application is not using EC2 merely because “EC2 runs servers”; EC2 is selected because the team needs a conventional server runtime and is prepared to manage the operating system. Auto Scaling, load balancing, managed databases, and external storage remove the main weaknesses of standalone servers.

---

# 3. Baseline architecture

```text
                                      AWS Region
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│                              Route 53                                     │
│                                 │                                         │
│                        portal.northstar.example                           │
│                                 │ Alias record                            │
│                                 ▼                                         │
│                     Application Load Balancer                             │
│                         HTTPS listener :443                               │
│                      ACM certificate + ALB SG                             │
│                        /                     \                             │
│                 Public subnet A       Public subnet B                     │
│                      AZ A                    AZ B                          │
│                        │                     │                             │
│                 NAT Gateway A        NAT Gateway B                        │
│                        │                     │                             │
│  ──────────────────────────────────────────────────────────────────────   │
│                        │                     │                             │
│                 Private app A         Private app B                       │
│                      AZ A                    AZ B                          │
│                        │                     │                             │
│                    EC2 instance         EC2 instance                      │
│                      └────── Auto Scaling Group ──────┘                   │
│                                 │                                         │
│                    AppRuntimeRole / instance profile                      │
│                         │                       │                         │
│                         │                       └──► S3 gateway endpoint   │
│                         │                                  │              │
│                         │                                  ▼              │
│                         │                            S3 uploads bucket     │
│                         ▼                                                 │
│                   RDS PostgreSQL endpoint                                 │
│                         │                                                 │
│                 Primary DB in AZ A                                        │
│                         │ synchronous standby                             │
│                 Standby DB in AZ B                                        │
│                                                                           │
│       CloudWatch metrics, logs and alarms                                 │
│       CloudTrail account activity                                         │
│       AWS Backup / service-native backups                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

AWS’s own VPC example uses this same broad pattern: public and private subnets in two Availability Zones, load balancer nodes and NAT gateways in public subnets, Auto Scaling instances in private subnets, and an S3 gateway endpoint for private S3 access. citeturn906813search2turn906813search10

## Architecture in one sentence

> Route 53 directs customers to an HTTPS Application Load Balancer, which sends requests only to healthy EC2 instances managed by an Auto Scaling group in private subnets; the application stores relational state in Multi-AZ RDS and objects in S3.

---

# 4. Functional decisions at a glance

| Function | Baseline choice | Main reason |
| --- | --- | --- |
| DNS | Route 53 | Map the application domain to the load balancer |
| TLS | ACM certificate on ALB | Central HTTPS termination |
| Traffic distribution | Application Load Balancer | HTTP-aware routing and target health checks |
| Compute | EC2 Auto Scaling group | Conventional application with OS/runtime control |
| Relational database | RDS PostgreSQL Multi-AZ | Managed database and automatic standby failover |
| Uploaded objects | S3 | Durable object storage independent of EC2 |
| Instance disks | EBS | Boot volume and node-local application storage |
| Shared filesystem | Not used initially | The application does not require POSIX shared files |
| Metrics and alarms | CloudWatch | Operational monitoring and automated alarms |
| API audit history | CloudTrail | Record control-plane and account activity |
| Infrastructure definition | CloudFormation | Reproducible infrastructure as code |
| Administrative access | Systems Manager Session Manager | Avoid public SSH and inbound port 22 |

The uploaded comparison material distinguishes ALB as the HTTP, HTTPS, and gRPC-oriented load balancer, while NLB handles TCP, UDP, and TLS traffic and GWLB is intended for network appliances. fileciteturn5file1

---

# 5. Account and Regional placement

## 5.1 Production account

Northstar places this workload in a dedicated **production AWS account**.

This does not yet require a sophisticated AWS Organizations landing zone. The useful principle is simply:

```text
Development resources  ≠  Production resources
```

Separating production into its own account gives Northstar a stronger boundary for:

- permissions;
- billing;
- resource quotas;
- audit records;
- accidental changes.

Later projects will expand this into organizational units, SCPs, centralized logging, and shared-service accounts.

---

## 5.2 One Region, multiple Availability Zones

The workload runs in one AWS Region but uses at least two Availability Zones.

```text
Region
├── Availability Zone A
└── Availability Zone B
```

The application is distributed across both AZs:

```text
ALB                    → both AZs
EC2 Auto Scaling group → both AZs
RDS Multi-AZ           → primary and standby in different AZs
```

This protects against a localized infrastructure failure without introducing multi-Region data replication, routing, and operational complexity. AWS Well-Architected guidance recommends deploying EC2 workloads to multiple AZs and configuring Auto Scaling across the selected subnets. citeturn906813search0turn906813search4

### Exam hinge

```text
Multiple instances in one AZ
    ≠
Multi-AZ architecture
```

Two instances in the same AZ protect against an instance failure but not an AZ failure.

---

# 6. Network architecture

## 6.1 Address plan

An illustrative address plan is:

```text
VPC: 10.0.0.0/16

Public subnet A:       10.0.0.0/24    AZ A
Public subnet B:       10.0.1.0/24    AZ B

Application subnet A:  10.0.10.0/24   AZ A
Application subnet B:  10.0.11.0/24   AZ B

Database subnet A:     10.0.20.0/24   AZ A
Database subnet B:     10.0.21.0/24   AZ B
```

The numerical pattern is an administrative convention. AWS does not infer that `10.0.20.0/24` is a database network.

The uploaded VPC cheat sheet establishes the same hierarchy: a VPC spans the Region, while subnets divide its address range and belong to Availability Zones. fileciteturn5file8

---

## 6.2 Public subnets

The public-subnet route tables contain:

```text
10.0.0.0/16 → local
0.0.0.0/0   → Internet Gateway
```

The public subnets contain:

- the network presence of the Internet-facing ALB;
- one public NAT Gateway per AZ.

A subnet is public because its route table has a direct route to an Internet Gateway. Individual EC2 instances would still need public addressing and permissive security controls to communicate directly with the Internet. citeturn906813search25

### Important distinction

```text
ALB in public subnets
    does not imply
EC2 targets in public subnets
```

The ALB is the public entry point. The application instances remain private.

---

## 6.3 Private application subnets

Application instances receive only private addresses.

Their route tables contain:

```text
Application subnet A:
10.0.0.0/16 → local
S3 prefix    → S3 gateway endpoint
0.0.0.0/0   → NAT Gateway A

Application subnet B:
10.0.0.0/16 → local
S3 prefix    → S3 gateway endpoint
0.0.0.0/0   → NAT Gateway B
```

The NAT paths let instances initiate outbound connections for uses such as:

- operating-system package repositories;
- external APIs;
- services for which no VPC endpoint has been configured.

External hosts cannot use the NAT Gateway to initiate arbitrary connections to the instances. citeturn906813search14turn953816search15

Using one NAT Gateway per AZ avoids making both application subnets dependent on a NAT device in one AZ. It also avoids unnecessary cross-AZ routing for normal egress. The tradeoff is higher fixed cost.

---

## 6.4 Private database subnets

The database subnets do not need general Internet egress.

Their route tables may contain only local and explicitly required private routes:

```text
10.0.0.0/16 → local
```

The database:

- has no public endpoint;
- accepts connections only from the application tier;
- is not administered through an Internet-facing database port.

The lack of an Internet route is one control. The database security group is another. Database authentication remains a third independent control.

---

## 6.5 Route tables versus security groups

A route answers:

> Where should the packet go?

A security group answers:

> Is this traffic allowed at this network interface?

Both must be correct.

```text
Correct route
    AND
Permissive security-group relationship
    AND
Healthy listening process
```

A route from the application subnet to the database does not grant database access. A security-group rule permitting PostgreSQL does not create a route.

---

# 7. Security-group architecture

Create security groups according to **relationships**, not merely broad IP ranges.

## 7.1 Load-balancer security group

```text
ALB-SG

Inbound:
    TCP 443 from 0.0.0.0/0
    TCP 443 from ::/0, if IPv6 is supported

Outbound:
    Application port to App-SG
```

The ALB is the only component accepting customer connections.

---

## 7.2 Application security group

```text
App-SG

Inbound:
    TCP 8080 from ALB-SG

Outbound:
    TCP 5432 to DB-SG
    TCP 443 as required for AWS services and external APIs
```

The source is `ALB-SG`, not the whole Internet and not the entire VPC.

This expresses:

> Traffic may reach the application port only when it comes through a network interface associated with the load-balancer security group.

---

## 7.3 Database security group

```text
DB-SG

Inbound:
    TCP 5432 from App-SG

Outbound:
    As required for the managed database
```

The database does not accept PostgreSQL connections from:

- the Internet;
- the load balancer;
- arbitrary instances in the VPC;
- engineers’ personal IP addresses.

---

## 7.4 Network ACLs

For the baseline architecture, Northstar keeps NACLs simple and relies primarily on security groups for workload-level control.

Custom NACLs become useful when a requirement calls for:

- coarse subnet-level controls;
- an explicit deny for an IP range;
- defense in depth;
- compliance-mandated segmentation.

Because NACLs are stateless, custom rules must accommodate both the original traffic and the return path, including ephemeral ports. The uploaded cheat sheet contrasts stateful, allow-only, interface-level security groups with stateless, ordered, subnet-level NACLs that support allow and deny rules. fileciteturn5file8

---

# 8. DNS and HTTPS

## 8.1 Route 53 hosted zone

Northstar owns:

```text
northstar.example
```

The public hosted zone contains an alias record:

```text
portal.northstar.example
    ↓
Northstar production Application Load Balancer
```

A Route 53 alias can point to an Elastic Load Balancing resource and can be used at either a subdomain or the zone apex, unlike an ordinary CNAME at the apex. citeturn962740search1

### What DNS does

DNS determines:

```text
portal.northstar.example
    ↓
the load balancer destination
```

DNS does not establish:

- the TCP connection;
- TLS;
- security-group permission;
- application authentication;
- IAM authorization.

---

## 8.2 TLS certificate

AWS Certificate Manager supplies a certificate for:

```text
portal.northstar.example
```

The ALB has an HTTPS listener on TCP port 443.

The certificate proves the server identity for the requested hostname and supports encrypted client-to-ALB communication. The certificate’s domain must match the custom DNS name used by clients. citeturn962740search22

The simplest baseline is:

```text
Client ── HTTPS ──► ALB ── HTTP or HTTPS ──► EC2
```

Whether Northstar also encrypts ALB-to-target traffic depends on the security requirement. TLS termination at the ALB removes certificate handling from every individual EC2 instance.

---

# 9. Application Load Balancer

## 9.1 Why ALB

The application uses HTTP and HTTPS. Northstar may later want:

```text
/api/*     → API target group
/admin/*   → administration target group
/*         → web target group
```

An ALB understands Layer 7 request information such as:

- hostname;
- URL path;
- HTTP method;
- headers;
- query parameters.

This makes it the natural choice for a conventional web application. The Tutorials Dojo comparison table identifies ALB with HTTP, HTTPS, gRPC, path routing, host routing, header routing, redirects, and user authentication features. fileciteturn5file1

---

## 9.2 Listener, rule, and target group

The concepts are:

```text
Listener
    Receives traffic on a protocol and port.

Rule
    Determines what to do with matching requests.

Target group
    Contains the backend destinations.
```

Baseline:

```text
HTTPS listener :443
    ↓ default forwarding rule
Web target group
    ↓
EC2 instances on TCP :8080
```

Target groups route requests to registered targets using the configured protocol and port. Health checks are configured per target group. citeturn962740search10turn962740search18

---

## 9.3 Health checks

The ALB periodically requests an endpoint such as:

```text
GET /health
```

A useful health endpoint checks enough to establish that the application can serve traffic, but it should not perform an expensive full-system diagnostic on every request.

A target must pass its initial checks before the ALB marks it healthy and sends customer requests to it. citeturn962740search2

### Failure sequence

```text
Application process hangs
    ↓
/health stops succeeding
    ↓
ALB marks target unhealthy
    ↓
ALB stops sending it customer traffic
    ↓
Auto Scaling eventually replaces or repairs capacity
```

The load balancer protects traffic routing. The Auto Scaling group protects desired capacity. These are related but distinct responsibilities.

---

## 9.4 Why not NLB or GWLB?

### Network Load Balancer

Prefer NLB when the requirement is dominated by:

- raw TCP or UDP;
- very high Layer 4 performance;
- static IP addresses;
- source-IP preservation;
- TLS pass-through or Layer 4 TLS termination.

### Gateway Load Balancer

Prefer GWLB when the targets are network appliances such as:

- firewalls;
- intrusion-prevention systems;
- packet-inspection appliances.

### Baseline choice

Northstar needs HTTP-aware routing, so ALB is the correct semantic match rather than merely “a more advanced load balancer.” fileciteturn6file5

---

# 10. EC2 compute

## 10.1 Anatomy of one application instance

Each EC2 instance is defined by several independent choices:

```text
AMI
    Operating system and machine image

Instance type
    CPU, memory, networking and hardware characteristics

EBS volumes
    Boot and node-local block storage

User data or bootstrapping
    Initial application configuration

Security groups
    Network permissions

IAM instance profile
    AWS API permissions

Subnet
    Network placement
```

A production system should not rely on an engineer manually configuring each new instance. Every instance launched from the same configuration should converge on the same application state.

---

## 10.2 Launch template

A launch template describes how Auto Scaling should create instances.

It normally references:

- AMI;
- instance type;
- EBS configuration;
- security groups;
- IAM instance profile;
- user data;
- tags;
- metadata-service settings.

A changed application image or configuration produces a new launch-template version. The Auto Scaling group can then be updated to use that version.

The uploaded material emphasizes that the Auto Scaling group uses its launch template to provision additional instances and that scaling must be based on the actual workload bottleneck rather than an arbitrary metric. fileciteturn6file8

---

## 10.3 Auto Scaling group

Northstar configures:

```text
Minimum capacity: 2
Desired capacity: 2
Maximum capacity: based on tested application and database limits
```

The group spans both application subnets:

```text
AZ A ── application instances
AZ B ── application instances
```

Amazon EC2 Auto Scaling maintains the desired number of instances and can add or remove instances as demand changes. citeturn906813search8

---

## 10.4 Scaling policies

### Target tracking

Example objective:

```text
Maintain average CPU utilization near 50%
```

Auto Scaling changes capacity to pursue that target.

### Step scaling

Example:

```text
CPU > 70%  → add 2
CPU > 90%  → add 5
```

### Scheduled scaling

Example:

```text
Weekdays at 08:00 → increase minimum capacity
Weekdays at 20:00 → reduce minimum capacity
```

### Predictive scaling

Useful when historical demand contains sufficiently stable recurring patterns.

The uploaded Domain 3 material distinguishes dynamic, scheduled, and predictive scaling and ties dynamic scaling to CloudWatch metrics. fileciteturn7file1

---

## 10.5 The metric must represent the bottleneck

CPU is not always the correct scaling signal.

Suppose application latency rises because every request waits for a saturated database connection pool:

```text
EC2 CPU remains at 25%
Database connections are exhausted
Latency becomes unacceptable
```

Adding instances based only on CPU may make the database problem worse.

Possible scaling signals include:

- request count per target;
- target response time;
- queue depth;
- active connections;
- memory utilization;
- a custom business-load metric.

Memory and disk-space utilization are not standard EC2 metrics automatically available in the same way as basic instance metrics; the CloudWatch agent can collect additional system-level measurements. fileciteturn10file6

---

## 10.6 Stateless application instances

An Auto Scaling instance can disappear at any time because of:

- failure;
- scaling in;
- a deployment;
- manual termination;
- AZ disruption.

Therefore, the application must not depend on one instance retaining unique durable state.

Do not store these only on the instance:

```text
customer uploads
authoritative reports
shopping carts
irreplaceable sessions
database records
```

Instead:

```text
uploads          → S3
transaction data → RDS
shared session   → database or dedicated shared store
configuration    → launch template, parameter service, or deployment artifact
logs             → centralized logging
```

Local EBS can still hold:

- the operating system;
- installed application files;
- caches;
- temporary processing data.

But the architecture must remain correct when the whole instance is replaced.

---

# 11. Storage decisions

AWS storage is commonly reasoned about in three broad forms:

```text
Object
Block
File
```

AWS decision guidance distinguishes these storage models, while EC2 documentation describes EBS as block storage and EFS as scalable file storage for compute workloads. citeturn906813search3turn906813search11turn906813search19

## 11.1 S3: object storage

Use S3 for:

- customer uploads;
- generated reports;
- static assets;
- log archives;
- deployment artifacts;
- backup-related data.

The application addresses objects using a bucket and object key:

```text
s3://northstar-prod-uploads/customer-42/document.pdf
```

For this architecture, S3 is used through its object model. It is independent of any individual EC2 instance or AZ.

### Baseline decision

```text
Customer uploads → S3
```

This means replacing or scaling an instance does not lose customer files.

---

## 11.2 EBS: block storage

EBS supplies block volumes used by EC2.

Typical uses:

- root filesystem;
- installed software;
- node-local persistent data;
- database storage when managing a database directly on EC2.

EBS is not the baseline shared upload repository. An upload written to instance A’s EBS volume does not automatically appear on instance B.

### Baseline decision

```text
EBS → operating system and replaceable node-local data
```

---

## 11.3 EFS: shared file storage

EFS is appropriate when multiple compute nodes require a shared filesystem interface.

Examples:

- a legacy application expects the same mounted directory on every instance;
- multiple web servers must read and write common POSIX files;
- code changes would be difficult if object APIs were introduced.

The uploaded study scenarios associate EFS with concurrent shared access by many Linux EC2 servers. fileciteturn9file4

### Baseline decision

Northstar does not need EFS because its application can use S3 for uploads.

Adding a shared filesystem merely because there are several instances would increase cost and coupling without satisfying a real requirement.

---

## 11.4 Decision rule

```text
Need a disk attached to one compute node?
    → EBS

Need a shared filesystem mounted by multiple nodes?
    → EFS

Need scalable durable objects addressed by key/API?
    → S3
```

---

# 12. Relational database

## 12.1 Why RDS

Northstar requires:

- transactions;
- relational constraints;
- SQL;
- compatibility with PostgreSQL.

Amazon RDS manages common database administration tasks and provides resizable relational database capacity. citeturn906813search34

This removes significant operational work compared with installing PostgreSQL directly on EC2:

```text
Operating-system management
Database host provisioning
Basic backup integration
Failover orchestration
Monitoring integration
Maintenance workflows
```

The application still owns:

- schema design;
- indexes;
- queries;
- transaction boundaries;
- connection behavior;
- application-level database permissions.

“Managed” does not mean “requires no database engineering.”

---

## 12.2 DB subnet group

RDS is configured with database subnets in at least two Availability Zones:

```text
DB subnet A → AZ A
DB subnet B → AZ B
```

The subnet group gives RDS possible network placements. The database receives a DNS endpoint that the application uses rather than hard-coding a physical database IP address.

---

## 12.3 Multi-AZ deployment

For the baseline, Northstar chooses an RDS Multi-AZ DB instance deployment.

Conceptually:

```text
Primary database in AZ A
        │
        │ synchronous replication
        ▼
Standby database in AZ B
```

If the primary becomes unavailable, RDS can fail over to the standby. The application continues using the database endpoint and must reconnect when the endpoint resolves to the new primary. AWS documents Multi-AZ as a high-availability configuration with a synchronously maintained standby in another AZ. citeturn906813search1turn906813search5

---

## 12.4 Multi-AZ is not a read-scaling feature

In a traditional Multi-AZ DB instance deployment, the standby is maintained for high availability. It does not serve application read traffic.

```text
Multi-AZ standby
    → availability

Read replica
    → read scaling
```

RDS read replicas are separate readable database instances. They generally use asynchronous replication and can be used to offload read-heavy workloads. AWS explicitly distinguishes the synchronous standby from a read replica and notes that the standby cannot serve reads. citeturn906813search9

### Exam hinge

Question says:

```text
Minimize downtime after primary failure
```

Think:

```text
Multi-AZ
```

Question says:

```text
Offload read-heavy reporting queries
```

Think:

```text
Read replica
```

A production database can use both.

---

## 12.5 Aurora recognition

Aurora is another relational choice compatible with PostgreSQL or MySQL ecosystems.

It becomes especially relevant when requirements emphasize combinations such as:

- substantial read scaling;
- multiple low-latency replicas;
- rapid failover;
- distributed, highly available storage;
- higher relational performance.

Aurora replicas can be promoted if the primary fails. citeturn906813search20turn906813search24

For Northstar’s initial workload, ordinary RDS PostgreSQL Multi-AZ is sufficient. Aurora is not selected merely because it is “more cloud-native.”

---

# 13. Database credentials

The application needs PostgreSQL credentials, but they must not be embedded in:

- source code;
- an AMI;
- user data;
- a Git repository;
- a plain environment file committed with the application.

Northstar stores the application database credentials in Secrets Manager.

```text
AppRuntimeRole
    ↓ secretsmanager:GetSecretValue
Database application secret
    ↓
Application opens PostgreSQL connection
```

Secrets Manager can manage and rotate database credentials, including RDS credentials. citeturn953816search4turn953816search8

### Important separation

IAM permission to retrieve the secret:

```text
secretsmanager:GetSecretValue
```

is not the same as database authorization.

The retrieved username still needs suitable PostgreSQL privileges:

```text
SELECT
INSERT
UPDATE
...
```

The application should use a limited database user rather than the RDS master user.

---

# 14. IAM architecture

## 14.1 Identity map

| Actor | Identity used | Purpose |
| --- | --- | --- |
| Customer | Application identity/session | Use the customer portal |
| Engineer | Temporary workforce role session | Inspect or operate AWS resources |
| Deployment pipeline | Deployment role | Release application versions |
| EC2 application | `AppRuntimeRole` | Call S3, Secrets Manager, CloudWatch |
| AWS services | Service or service-linked roles | Manage service-specific resources |

Customer authentication is an application concern. Customers do **not** become IAM users merely because the application runs in AWS.

---

## 14.2 Application role

The EC2 instances use:

```text
AppRuntimeRole
```

The role is delivered to EC2 through an **instance profile**. Applications on the instance can obtain temporary credentials without storing long-lived AWS access keys. citeturn962740search0turn962740search12

### Trust side

The role trusts the EC2 service:

```json
{
  "Effect": "Allow",
  "Principal": {
    "Service": "ec2.amazonaws.com"
  },
  "Action": "sts:AssumeRole"
}
```

This answers:

> Who may assume the role?

---

## 14.3 Permission side

A simplified application policy could contain:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadAndWriteCustomerUploads",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::northstar-prod-uploads/*"
    },
    {
      "Sid": "ReadApplicationDatabaseSecret",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:northstar/prod/database-*"
    }
  ]
}
```

This answers:

> What may a resulting EC2 role session do?

Notice what is not included:

```text
s3:DeleteBucket
s3:*
secretsmanager:*
rds:*
AdministratorAccess
```

The application can connect to the database data plane without receiving permission to create, delete, or reconfigure RDS infrastructure.

---

## 14.4 Does the application need `s3:ListBucket`?

Only when it must list object keys.

```text
Read a known object key:
    s3:GetObject

Upload a known object key:
    s3:PutObject

Enumerate objects in the bucket:
    s3:ListBucket
```

Least privilege requires understanding the operation rather than attaching a broad S3 policy because “the application uses S3.”

---

## 14.5 Deployment role

The deployment process needs permissions such as:

- publish an application artifact;
- update the launch-template version;
- initiate an instance refresh or deployment;
- update an Auto Scaling group;
- inspect deployment health.

It does not automatically need permission to read customer objects or database secrets.

This produces two separate roles:

```text
DeploymentRole
    → modifies infrastructure and releases

AppRuntimeRole
    → performs runtime application operations
```

### Why separation matters

Compromising the web process should not provide deployment authority.

Compromising the deployment pipeline should not automatically expose all production customer data.

---

## 14.6 `iam:PassRole`

When the deployment system creates or updates an EC2 launch configuration that references `AppRuntimeRole`, it may need:

```text
iam:PassRole
```

This means:

> The deployment principal may instruct EC2 to use this approved role.

It does not mean that the deployment process assumes `AppRuntimeRole`.

Restrict `iam:PassRole` to:

- the specific role;
- the intended AWS service;
- the deployment principals that genuinely need it.

---

# 15. Network packet walks

## 15.1 Customer request to application

```text
1. Customer requests:
       https://portal.northstar.example/orders

2. DNS resolves the name:
       Route 53 alias → ALB

3. Customer opens:
       TCP client-ephemeral-port → ALB:443

4. ALB-SG permits inbound TCP 443.

5. ALB completes TLS using the configured certificate.

6. Listener rule selects the web target group.

7. ALB chooses a healthy EC2 target.

8. ALB opens:
       ALB → EC2:8080

9. App-SG permits port 8080 from ALB-SG.

10. Application returns the response through the established flow.
```

The ALB’s subnet, listener, security group, target group, target health, and application listener must all agree.

---

## 15.2 Application request to RDS

```text
1. Application resolves the RDS endpoint.

2. DNS returns the current database destination.

3. Destination is inside the VPC.

4. Local VPC route handles the packet.

5. App-SG permits the required outbound flow.

6. DB-SG permits TCP 5432 from App-SG.

7. PostgreSQL accepts or rejects the supplied credentials.

8. PostgreSQL evaluates database privileges.
```

Possible outcomes:

```text
Timeout
    → route, SG, NACL, endpoint or listener problem

Connection refused
    → network destination reached, but service unavailable/listener issue

Password rejected
    → networking worked; database authentication failed

Permission denied on table
    → networking and authentication worked;
      database authorization failed
```

---

## 15.3 Application request to S3

Northstar configures an S3 gateway endpoint.

```text
EC2 application
    │ HTTPS request signed with AppRuntimeRole credentials
    ▼
Application-subnet route table
    │ S3 service prefix → gateway endpoint
    ▼
S3
    │ IAM + bucket policy + endpoint policy evaluation
    ▼
Object
```

Gateway endpoints provide S3 and DynamoDB connectivity without requiring a NAT device or Internet Gateway for that traffic. citeturn953816search7

### Two independent gates

```text
Network path:
    S3 gateway endpoint

Authorization:
    AppRuntimeRole + bucket policy + applicable guardrails
```

The endpoint does not grant `s3:GetObject`.

The IAM policy does not create the endpoint route.

---

## 15.4 Application request to an external API

```text
EC2 private address
    ↓ private route 0.0.0.0/0
Same-AZ NAT Gateway
    ↓
Internet Gateway
    ↓
External API:443
```

The request must be initiated from the private side. An Internet host cannot use the NAT Gateway to begin a new connection to the application instance. citeturn953816search31

---

## 15.5 Engineer administration

Northstar uses Systems Manager Session Manager instead of exposing SSH.

```text
Engineer role session
    ↓ authorized Systems Manager API request
Session Manager
    ↓
SSM Agent on private EC2 instance
```

This avoids:

```text
Public EC2 IP
Inbound TCP 22
Internet-facing bastion
Long-lived SSH keys
```

Session Manager supports node administration without opening inbound ports or maintaining bastion hosts. citeturn953816search1

The instance still requires:

- an appropriate IAM role;
- a functioning SSM Agent;
- network reachability to Systems Manager endpoints, through NAT or VPC endpoints.

An IAM permission to start a session does not solve a broken endpoint route.

---

# 16. Authorization traces

## 16.1 EC2 reads an S3 report

```text
EC2 instance
    ↓ obtains temporary credentials
AppRuntimeRole session
    ↓ calls
s3:GetObject
    ↓ targets
arn:aws:s3:::northstar-prod-uploads/reports/report-42.pdf
    ↓ evaluates
Role policy
Bucket policy
Endpoint policy
SCP or permissions boundary, if applicable
Explicit denies
    ↓
ALLOW or DENY
```

---

## 16.2 EC2 retrieves a database secret

```text
AppRuntimeRole session
    ↓
secretsmanager:GetSecretValue
    ↓
Specific database secret ARN
    ↓
Secret returned
    ↓
Application connects to RDS:5432
    ↓
PostgreSQL authenticates database user
```

Authorization to read a secret and network access to PostgreSQL are separate.

---

## 16.3 ALB sends traffic to EC2

Normal ALB-to-EC2 request forwarding is primarily a network and load-balancing decision:

```text
Listener rule
Target group
Target health
Security groups
Routes
Application port
```

The ALB does not need the application’s `AppRuntimeRole` to forward HTTP requests.

This is an important example of an interaction where **IAM controls configuration of the resources**, while the data-plane request is governed mainly by networking and application protocols.

---

# 17. Observability

## 17.1 CloudWatch

CloudWatch provides:

- metrics;
- alarms;
- dashboards;
- application and system logs;
- automated reactions to threshold conditions.

The uploaded cheat sheet describes CloudWatch as a metrics repository that receives service and custom metrics and supports alarms. It also notes that additional EC2 system metrics such as memory require the CloudWatch agent. fileciteturn10file6

---

## 17.2 Metrics to watch

### Load balancer

```text
Request count
Target response time
Healthy host count
Unhealthy host count
ALB 4xx and 5xx
Target 4xx and 5xx
Rejected or failed connections
```

### EC2 and Auto Scaling

```text
CPU utilization
Memory utilization through agent
Disk usage through agent
Instance status
Desired versus in-service capacity
Scaling activity failures
```

### RDS

```text
CPU
Free storage
Database connections
Read and write latency
Read and write throughput
Replica lag, when replicas exist
Failover and availability events
```

### Application

```text
p50, p95 and p99 request latency
Login failures
Order failures
Upload failures
Background-job backlog
```

A technical metric is useful only when it explains or predicts a service objective.

---

## 17.3 Alarms

Examples:

```text
HealthyHostCount < 1
    → urgent incident

Target 5xx rate above threshold
    → application failure investigation

RDS free storage below threshold
    → capacity action

p95 latency above objective
    → performance investigation

Auto Scaling unable to launch instances
    → capacity or configuration investigation
```

Alarms can notify an SNS topic or initiate an automated response. CloudWatch supports metric statistics and percentiles, which are usually more informative for latency than averages alone. fileciteturn10file8

---

## 17.4 Logs

Centralize:

- application logs;
- operating-system logs;
- web-server logs;
- deployment logs;
- database logs where supported;
- ALB access logs;
- VPC Flow Logs where useful.

CloudWatch Logs supports centralized search and analysis, while metric filters can convert matching log patterns into CloudWatch metrics. fileciteturn10file10

Avoid keeping the only application log copy on an EC2 filesystem. The instance may disappear precisely when its failure needs to be investigated.

---

## 17.5 CloudTrail

CloudTrail records account activity such as:

```text
Who modified the security group?
Who changed the Auto Scaling group?
Who deleted the S3 object policy?
Which role modified the database?
Was the action made through the console, CLI, SDK or service?
```

CloudTrail events provide a history of account activity and AWS API operations. CloudWatch focuses on operational metrics, logs, alarms, and reactions. The two services can be integrated by sending CloudTrail events to CloudWatch Logs and creating filters and alarms. citeturn962740search3turn962740search35turn962740search7

### Memory rule

```text
CloudWatch:
    What is the system doing?

CloudTrail:
    Who changed AWS, and what API activity occurred?
```

---

# 18. Infrastructure and deployment

## 18.1 CloudFormation

Northstar defines the architecture with CloudFormation rather than relying on a sequence of manual console actions.

The stack can include:

- VPC and subnets;
- route tables and gateways;
- security groups;
- ALB, listener, and target group;
- launch template;
- Auto Scaling group;
- RDS;
- S3 bucket and endpoint;
- IAM roles;
- CloudWatch alarms.

CloudFormation provisions resources from YAML or JSON templates and organizes them into stacks. Change sets allow upcoming infrastructure modifications to be inspected before execution. fileciteturn8file13

### Why this matters

Without infrastructure as code:

```text
Production configuration
    =
Whatever several engineers remember doing in the console
```

With infrastructure as code:

```text
Production configuration
    =
Versioned, reviewable desired state
```

---

## 18.2 Application deployment

A simple immutable deployment sequence is:

```text
1. Build and test application.
2. Produce a versioned deployment artifact or AMI.
3. Create a new launch-template version.
4. Start a controlled instance replacement.
5. Wait for new targets to pass ALB health checks.
6. Remove old instances only after the new version is healthy.
7. Roll back to the previous version if alarms fail.
```

A later project will compare:

- rolling;
- immutable;
- blue/green;
- canary;
- traffic-splitting deployments.

---

## 18.3 Elastic Beanstalk alternative

Elastic Beanstalk can provision and coordinate much of the EC2, load-balancing, Auto Scaling, deployment, and monitoring environment for a conventional web application.

It introduces separate IAM concerns:

```text
Elastic Beanstalk service role
    → what Elastic Beanstalk may do on the customer's behalf

EC2 instance profile
    → what application instances may do
```

The uploaded cheat sheet makes this exact distinction and notes that Elastic Beanstalk has no separate service charge beyond the underlying resources. fileciteturn10file13

### Why we do not choose it for this lesson

The purpose of Project 1 is to expose the underlying architecture:

```text
ALB
Auto Scaling
launch templates
subnets
routes
security groups
instance roles
```

For a real small team prioritizing lower operational burden, Elastic Beanstalk could be the better implementation.

---

# 19. Reliability model

## 19.1 Instance failure

```text
One EC2 instance fails
    ↓
ALB health check fails
    ↓
ALB stops routing to it
    ↓
Other healthy instance serves traffic
    ↓
Auto Scaling restores desired capacity
```

This requires enough remaining capacity in the other instance or AZ.

---

## 19.2 Availability Zone failure

```text
AZ A becomes unavailable
    ↓
ALB routes to healthy AZ B targets
    ↓
Auto Scaling attempts to maintain capacity in available placement
    ↓
RDS fails over if its primary was in AZ A
```

The architecture survives only if the surviving AZ has or can obtain enough capacity.

“Resources exist in two AZs” is not sufficient if the workload can operate only when both are present.

---

## 19.3 Database primary failure

```text
RDS primary fails
    ↓
RDS promotes/fails over to standby
    ↓
Database endpoint transitions
    ↓
Existing connections break
    ↓
Application retries and reconnects
```

Multi-AZ reduces infrastructure recovery work. It does not eliminate the need for application retry behavior.

---

## 19.4 NAT failure

With one NAT Gateway in each AZ:

```text
App subnet A → NAT A
App subnet B → NAT B
```

An AZ-local NAT failure does not remove both normal outbound paths.

S3 access can continue through the S3 gateway endpoint even when the NAT path is unavailable, assuming the endpoint and authorization configuration remain valid.

---

## 19.5 Region failure

The baseline system is unavailable after a full Regional failure.

```text
Multi-AZ
    ≠
Multi-Region
```

This is an accepted constraint, not an overlooked implementation detail.

A later disaster-recovery project will introduce:

- backup and restore;
- pilot light;
- warm standby;
- active-active;
- cross-Region data replication;
- DNS failover;
- RTO and RPO.

---

# 20. High availability is not backup

Multi-AZ protects primarily against infrastructure and availability failures.

It does not necessarily protect against:

- accidental `DELETE`;
- application corruption;
- malicious modification;
- a bad schema migration;
- credentials used to destroy both primary and standby data;
- a need to recover yesterday’s state.

```text
High availability:
    Keep serving through component failure.

Backup:
    Recover an earlier valid state.
```

The uploaded DR comparison material distinguishes backup-and-restore from continuously running standby architectures and identifies EBS snapshots, database snapshots, AMIs, and durable storage as recovery building blocks. fileciteturn9file1

---

## 20.1 Backup plan

A reasonable baseline includes:

### RDS

- automated backups;
- point-in-time recovery according to required retention;
- manual snapshots before risky changes;
- restore testing.

### EC2 and EBS

Application servers should be reproducible from code and images, but EBS or whole-instance backups may still be appropriate for operational recovery.

### S3

- versioning where recovery from overwrites or deletes is needed;
- lifecycle policies;
- AWS Backup when centralized policy-based protection is required.

AWS Backup centralizes and automates backup policies across supported services and can create recovery points for entire EC2 instances and their EBS volumes. citeturn953816search2turn953816search6

### Most important rule

> A backup that has never been restored is an unverified assumption.

---

# 21. Cost model

The main cost categories are:

```text
ALB usage
EC2 instance runtime
EBS storage and snapshots
RDS compute, storage and Multi-AZ standby
NAT Gateway runtime and processed data
S3 storage and requests
CloudWatch metrics, alarms and logs
Internet and cross-AZ data transfer
Backup storage
```

## 21.1 Compute purchasing

### On-Demand

Use initially when:

- demand is uncertain;
- architecture is still changing;
- no long commitment is justified.

### Savings Plans or Reserved Instances

Consider after stable baseline usage is understood.

The uploaded Domain 3 material notes that steady, long-running capacity is a candidate for commitment discounts, while Spot is suitable only where interruption is acceptable. fileciteturn8file9

### Spot

Spot capacity can later supplement stateless application capacity if the workload tolerates interruption.

Do not construct the minimum viable production capacity entirely from interruptible instances unless the business requirement permits it.

---

## 21.2 Auto Scaling reduces waste, not all cost

Auto Scaling can remove unused compute, but:

- minimum instances still run continuously;
- database cost remains;
- NAT gateways remain;
- the load balancer remains;
- badly chosen scaling metrics can create unnecessary instances;
- scaling EC2 cannot fix every database bottleneck.

---

## 21.3 NAT cost

NAT Gateways have fixed and data-processing cost dimensions.

A common optimization is to avoid routing S3 traffic through NAT:

```text
Private EC2 → S3 gateway endpoint
```

AWS’s VPC guidance identifies this as both a private connectivity pattern and a way to reduce NAT-path data processing. citeturn953816search39

Do not remove a NAT Gateway merely because it is expensive unless every required outbound dependency has another valid path.

---

## 21.4 Storage cost

Use the storage model that matches the access requirement.

```text
S3 for objects
EBS for attached block storage
EFS only when shared file semantics are required
```

Storing the same upload independently on every EC2 node would be both incorrect and expensive.

Lifecycle policies can move or expire logs and old objects according to business retention requirements.

---

# 22. Security layers

The application has several independent security layers:

```text
Route 53
    DNS integrity and routing

ALB
    TLS termination and controlled entry point

WAF, when required
    Layer 7 request inspection

Security groups
    Network-interface traffic relationships

Private subnets
    No direct Internet route for application/database

IAM roles
    AWS API permissions

Secrets Manager
    Credential storage and rotation

Database permissions
    SQL-level authorization

CloudTrail
    Account activity history

CloudWatch
    Detection and alerting
```

WAF can be associated with an ALB to inspect application-layer requests such as malicious patterns, SQL injection attempts, and other web threats. Shield provides DDoS protection, with Shield Standard included for supported AWS resources. The uploaded Domain 2 material specifically associates WAF with CloudFront, API Gateway, and ALB rather than direct EC2 or NLB integration. fileciteturn10file14

WAF is not a substitute for:

- secure application code;
- security groups;
- IAM;
- database permissions;
- rate and capacity planning.

---

# 23. Changed-requirement variants

## Variant 1: No general Internet egress is permitted

Remove the NAT dependency where possible.

Add the required VPC endpoints for services such as:

- S3;
- Systems Manager;
- Secrets Manager;
- CloudWatch;
- other supported AWS APIs.

Then verify every dependency:

```text
Operating-system repositories?
External fraud API?
Package downloads?
License server?
Time synchronization?
Container or artifact registry?
```

“No Internet access” is an architectural constraint, not merely the deletion of the NAT Gateway.

---

## Variant 2: The application requires a shared POSIX directory

Add EFS and mount it on all application instances.

Choose this only because the application requires file semantics such as:

```text
open()
rename()
directory traversal
file locking expectations
shared mounted path
```

Do not introduce EFS merely because the application runs on multiple EC2 instances.

---

## Variant 3: Database reads dominate

Add one or more read replicas and route suitable read-only queries to them.

The application must tolerate:

- replication lag;
- separate read and write endpoints;
- reads that may not immediately reflect the latest write.

Multi-AZ remains the high-availability mechanism. The read replicas solve a different requirement.

---

## Variant 4: Static content is requested globally

Place CloudFront in front of static content and possibly the application.

That introduces:

- edge caching;
- cache keys;
- cache invalidation;
- origin protection;
- WAF at the edge;
- signed access for private content.

This becomes Project 2 rather than expanding Project 1 indefinitely.

---

## Variant 5: Regional outage must be tolerated

The current architecture is insufficient.

Northstar must decide among:

- backup and restore;
- pilot light;
- warm standby;
- active-active.

The right decision depends on explicit RTO, RPO, consistency, failback, and cost constraints.

---

## Variant 6: The team wants less infrastructure management

Consider Elastic Beanstalk for this conventional web application.

If the application is later containerized, consider ECS or Fargate.

If the architecture becomes request-driven and serverless, consider API Gateway and Lambda.

The right compute service depends partly on what operational responsibility the team wants to retain.

---

# 24. Failure drills

## Failure A: S3 returns `AccessDenied`

Likely category:

```text
Authorization
```

Investigate:

- actual EC2 role session;
- role policy;
- bucket policy;
- endpoint policy;
- explicit deny;
- object ARN;
- encryption-key permission, if applicable.

Adding a NAT Gateway would not fix this.

---

## Failure B: S3 request times out

Likely category:

```text
Network path or endpoint resolution
```

Investigate:

- S3 endpoint route;
- DNS;
- endpoint configuration;
- security and NACL behavior;
- NAT route if no endpoint is used.

Adding `s3:*` would not repair a missing route.

---

## Failure C: ALB returns 503

Investigate:

```text
Does the target group have healthy targets?
Are instances registered?
Did health checks pass?
Is the application listening on the configured port?
Does App-SG allow traffic from ALB-SG?
Did a deployment make every target unhealthy?
```

---

## Failure D: ALB returns 502

Possible causes include:

```text
Target connection failure
Malformed target response
Target closes connection unexpectedly
Protocol or port mismatch
Application process failure
```

Do not assume every ALB error is a DNS problem.

---

## Failure E: Database connection times out

Investigate:

```text
RDS endpoint resolution
Route
App-SG outbound
DB-SG inbound
NACLs
Database availability
Correct port
```

---

## Failure F: Database says invalid password

This proves substantial network progress:

```text
DNS worked
Route worked
TCP connection reached database
Database listener responded
```

Investigate the secret, rotation, username, password, and database authentication configuration.

---

## Failure G: Auto Scaling adds instances, but latency worsens

Possible explanation:

```text
The bottleneck is not EC2 CPU.
```

Investigate:

- database saturation;
- lock contention;
- connection-pool exhaustion;
- downstream API latency;
- shared filesystem bottleneck;
- wrong scaling metric;
- cache misses.

---

## Failure H: New instances never become healthy

Investigate:

```text
AMI or bootstrapping
Launch-template version
Instance role
Artifact access
Secrets access
Security-group port
Application listener
Health-check path
Dependency readiness
```

The Auto Scaling service may be working perfectly while repeatedly launching a broken configuration.

---

# 25. Exam decision snippets

## ALB versus NLB

**Requirement:** Route HTTP requests by hostname or path.

**Choose:** ALB.

**Reject NLB:** NLB is primarily a Layer 4 choice and does not select targets using application paths.

---

## Multi-AZ versus read replica

**Requirement:** Automatically recover from database infrastructure failure.

**Choose:** Multi-AZ.

**Reject read replica as the direct answer:** A read replica primarily serves read scaling and normally requires different promotion or routing considerations.

---

## S3 versus EBS

**Requirement:** Uploaded files must survive replacement of any EC2 instance.

**Choose:** S3.

**Reject EBS attached to each app node:** The data would remain tied to individual compute-node storage and would not naturally be shared across the fleet.

---

## EFS versus S3

**Requirement:** Several Linux servers need the same mounted filesystem and the application cannot be rewritten for object APIs.

**Choose:** EFS.

**Reject ordinary S3 object access:** The requirement is shared filesystem semantics, not merely durable storage.

---

## NAT versus S3 endpoint

**Requirement:** Private instances need S3 without sending the traffic through Internet egress infrastructure.

**Choose:** S3 gateway endpoint.

**Reject NAT as necessary for S3:** NAT can provide a path, but the endpoint is the more direct private service path.

---

## Route versus permission

**Requirement:** Application has `s3:GetObject` but cannot establish a connection.

**Investigate:** Networking.

**Reason:** IAM permission does not create reachability.

---

## Permission versus route

**Requirement:** Application can reach the S3 endpoint but receives `AccessDenied`.

**Investigate:** IAM and resource policies.

**Reason:** Reachability does not grant an AWS API action.

---

## CloudWatch versus CloudTrail

**Requirement:** Alert when application latency exceeds the objective.

**Choose:** CloudWatch.

**Requirement:** Determine who changed the security group.

**Choose:** CloudTrail.

---

# 26. Full mental model

```text
Customer
    ↓ DNS
Route 53
    ↓ HTTPS :443
Application Load Balancer
    ↓ healthy-target selection
EC2 Auto Scaling group
    ├── IAM role → AWS API authority
    ├── S3 endpoint → object network path
    ├── NAT → external outbound path
    └── local VPC route → RDS
                         ↓
                 Database authentication
                         ↓
                 Database authorization
```

And around the whole system:

```text
CloudFormation → defines infrastructure
CloudWatch     → observes operations
CloudTrail     → records AWS activity
AWS Backup     → preserves recoverable states
```

---

# 27. Retrieval practice

Answer without looking back.

## 1

Why are the EC2 application instances in private subnets even though the application is public?

## 2

What makes the ALB reachable from the Internet?

## 3

Why does the application security group accept traffic from `ALB-SG` rather than `0.0.0.0/0`?

## 4

What is the difference between the ALB listener and the target group?

## 5

What happens when an EC2 target fails its ALB health check?

## 6

Why must the Auto Scaling group span more than one Availability Zone?

## 7

Why should customer uploads not be stored only on an application instance’s EBS root volume?

## 8

When would EFS be a better choice than S3?

## 9

What problem does RDS Multi-AZ solve?

## 10

What problem does an RDS read replica solve?

## 11

Can an RDS Multi-AZ standby normally be used to process application read queries?

## 12

What two logically separate things must succeed when an EC2 application reads S3 through a gateway endpoint?

## 13

What role does an EC2 instance profile play?

## 14

Why should the deployment role and application runtime role be separate?

## 15

What does `iam:PassRole` mean in this architecture?

## 16

Why does a PostgreSQL invalid-password response suggest that basic network reachability worked?

## 17

What does the NAT Gateway provide to private application instances?

## 18

Why add an S3 gateway endpoint when the application subnets already have NAT access?

## 19

Which service answers “Who changed this security group?”

## 20

Which service answers “Is application latency currently too high?”

## 21

Does Multi-AZ remove the need for database backups?

## 22

Why can scaling on CPU be ineffective even when the application is slow?

## 23

What component decides whether an HTTP target is healthy?

## 24

What is the largest failure boundary this architecture is explicitly designed to tolerate?

---

# 28. Answer key

## 1

Customers connect to the public ALB. The ALB forwards traffic privately to EC2. The instances therefore do not need direct Internet addressing or arbitrary inbound Internet access.

## 2

The ALB is Internet-facing, uses public subnets whose route tables reach an Internet Gateway, has a DNS name or Route 53 alias, and has a security group permitting the listener traffic.

## 3

Only the ALB should directly invoke the application port. Referencing `ALB-SG` expresses that relationship and avoids exposing the application port directly to the Internet.

## 4

The listener receives traffic on a protocol and port and evaluates rules. The target group identifies backend destinations, their protocol and port, and their health-check configuration.

## 5

The ALB stops sending customer requests to it. The Auto Scaling group separately works to maintain the required capacity.

## 6

Otherwise, an AZ failure could remove the entire application tier even if several instances were running.

## 7

The instance can be terminated or replaced. Other instances do not automatically share its EBS volume, and the fleet should not depend on one node retaining unique state.

## 8

When the application specifically requires a shared mounted filesystem or POSIX-style file operations across multiple compute nodes.

## 9

High availability and automatic database failover after infrastructure or AZ-level disruption.

## 10

Scaling read workloads by serving appropriate read-only queries from additional database instances.

## 11

No, not in a traditional Multi-AZ DB instance deployment. The standby is maintained for failover.

## 12

The network path through the endpoint must work, and the effective IAM/resource-policy decision must authorize the S3 operation.

## 13

It connects the IAM role to the EC2 instance so applications can obtain temporary role credentials.

## 14

The deployment process changes infrastructure and releases code. The runtime application accesses production data and services. Combining them unnecessarily increases the impact of a compromise.

## 15

A principal is allowed to configure EC2 to use the approved role. The principal does not itself assume that role merely by passing it.

## 16

The client reached a database listener that processed the login attempt. DNS, routing, packet filtering, and TCP connectivity therefore progressed far enough for database authentication to occur.

## 17

Outbound-initiated access from private IPv4 resources to destinations outside the VPC without permitting arbitrary new inbound Internet connections.

## 18

It gives S3 a direct private service path and avoids routing S3 traffic through the NAT Gateway.

## 19

CloudTrail.

## 20

CloudWatch.

## 21

No. Multi-AZ replicates the current database state, including potentially harmful logical changes. Backups preserve earlier recoverable states.

## 22

The actual bottleneck might be memory, database capacity, downstream latency, locks, connections, or another constrained dependency.

## 23

The ALB target group’s health-check mechanism.

## 24

A component or Availability Zone failure inside the selected Region. The architecture is not yet designed for a full Regional outage.

---

# 29. What to memorize now

```text
Public entry:
    Route 53 → ALB

Private compute:
    ALB → EC2 Auto Scaling group

Durable state:
    EC2 → RDS and S3
```

```text
ALB:
    HTTP-aware routing
    listeners
    rules
    target groups
    health checks
```

```text
Auto Scaling:
    launch template
    minimum / desired / maximum
    multiple AZs
    correct scaling metric
```

```text
Storage:
    EBS = block
    EFS = shared file
    S3  = object
```

```text
Database:
    Multi-AZ    = availability
    read replica = read scaling
```

```text
IAM:
    instance profile → role → temporary credentials
    runtime role ≠ deployment role
    PassRole ≠ AssumeRole
```

```text
Network:
    public ALB
    private EC2
    private RDS
    NAT for general outbound
    S3 endpoint for direct S3 path
```

```text
Operations:
    CloudWatch = operational state
    CloudTrail = AWS activity history
    backup     = recover earlier state
```

---

# 30. What can remain recognition-level for now

You do not yet need perfect recollection of:

- ALB advanced listener actions;
- every scaling-policy parameter;
- RDS engine-specific Multi-AZ behavior;
- Aurora storage internals;
- advanced EBS volume types;
- EFS throughput modes;
- complex WAF rules;
- cross-Region backup design;
- blue/green and canary implementation details;
- every VPC endpoint variation.

These will return when later projects create concrete reasons to learn them.
