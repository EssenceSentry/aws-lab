# Lesson 4 — A Containerized Microservices Platform

## Amazon ECR, ECS, Fargate, service networking, deployment, and tracing

## Source note

The curriculum defines Lesson 4 as a containerized microservices project covering ECR; ECS on EC2 versus Fargate versus EKS; App Runner and Elastic Beanstalk; ECS task and task-execution roles; `awsvpc`; ALB versus NLB; service discovery; scaling; deployment; and tracing.

The attached SAP-C02 guide specifically identifies three container topics to master:

```text
task role versus task execution role
EC2 capacity versus Fargate
ECR + ECS/Fargate + CI/CD
```

It also expects detailed knowledge of the protocols and capabilities of the load-balancer families.  

Three current-service clarifications matter:

1. Amazon ECS now has a native blue/green deployment model. AWS recommends it for new ECS blue/green configurations, while CodeDeploy-controlled blue/green remains important for existing systems and for SAP-C02-style questions.
2. AWS App Runner has not accepted new customers since March 31, 2026; existing customers can continue using it. It therefore remains useful for recognition and existing-estate questions but is not a sensible default for a new 2026 platform.
3. X-Ray remains the exam-recognition service for distributed tracing, but AWS now recommends OpenTelemetry instrumentation. The older X-Ray SDKs and daemon entered maintenance mode on February 25, 2026.

---

# 1. The project

## 1.1 Business brief

Northstar is launching **Northstar Commerce**, a business-to-business order and fulfillment platform.

The product contains several independently evolving capabilities:

```text
customer accounts
catalog
pricing
orders
inventory
payments
fulfillment
notifications
```

The engineering organization has separate teams responsible for these capabilities. They use several languages:

```text
Python
Go
Java
Node.js
```

The current monolith causes several problems:

- every team must release together;
- one memory leak requires replacing the whole application;
- catalog traffic scales the order-processing code unnecessarily;
- payment-provider dependencies increase risk for unrelated features;
- a change to one library can destabilize the entire runtime;
- long-running notification and fulfillment work competes with synchronous HTTP traffic.

The company wants independently deployable services, but it has **no Kubernetes portability requirement** and no existing investment in Kubernetes operators, CRDs, or Helm-based product packaging.

Northstar requires:

- public HTTPS APIs;
- internal service-to-service communication;
- long-running HTTP and gRPC services;
- asynchronous order-processing workers;
- independent scaling by service;
- independent IAM authority by service;
- no public IP addresses on application tasks;
- Multi-AZ operation;
- safe rolling and blue/green deployments;
- image vulnerability scanning;
- distributed metrics, logs, and traces;
- minimal server and cluster administration.

---

## 1.2 Why containers fit

Containers are useful here because each service needs:

- its own language runtime;
- its own dependency versions;
- a repeatable build artifact;
- a long-running process;
- connection pooling;
- application-specific startup behavior;
- independent deployment and scaling.

A container image packages:

```text
application code
runtime
libraries
operating-system dependencies
startup command
```

The same immutable image can move through:

```text
development
staging
production
```

with environment-specific configuration supplied separately.

---

## 1.3 Why microservices are not automatically better

Containers do not require microservices, and microservices do not guarantee good architecture.

A microservice architecture adds:

- network calls where function calls previously existed;
- partial failures;
- distributed tracing;
- eventual consistency;
- retry and idempotency requirements;
- versioned service contracts;
- independent deployment coordination;
- more IAM roles and security groups;
- more operational telemetry;
- more ways to create cascading failures.

The decomposition is justified here because:

- business capabilities have distinct ownership;
- services have meaningfully different scaling patterns;
- deployments are blocked by the monolith;
- runtime requirements differ;
- the organization can support the added operational complexity.

A five-person team with one modest application might be better served by one well-structured containerized application.

---

# 2. Constraint ledger

| Dimension | Requirement |
| --- | --- |
| Workload | Long-running HTTP/gRPC services and queue workers |
| Deployment | Services release independently |
| Scale | Different scaling profile per service |
| Runtime | Mixed programming languages and native dependencies |
| Availability | Survive task and Availability Zone failures |
| Networking | Public entry point; private east-west communication |
| Security | Least-privilege IAM and security groups per service |
| Data | Durable state outside containers |
| Operations | No Kubernetes requirement; minimize host management |
| Integration | Public payment-provider HTTPS API |
| Observability | Correlated metrics, logs, and traces |
| Cost | Consumption-based baseline, with later optimization |
| Recovery | Replace tasks without recovering local state |
| Scope | One Region across three Availability Zones |

---

# 3. Baseline architecture

```text
                                  Internet
                                     │
                                     ▼
                              Route 53 / CloudFront
                                     │
                                  AWS WAF
                                     │
                                     ▼
                       Internet-facing Application
                             Load Balancer
                    host- and path-based routing
                                     │
        ┌────────────────────────────┼──────────────────────────┐
        │                            │                          │
        ▼                            ▼                          ▼
  /catalog/*                    /orders/*                 /accounts/*
  Catalog target               Orders target             Accounts target
      group                        group                      group
        │                            │                          │
        ▼                            ▼                          ▼
┌──────────────────────────────── AWS Region ─────────────────────────────────┐
│                                                                            │
│                         Amazon ECS cluster                                 │
│                                                                            │
│       Private subnet A       Private subnet B       Private subnet C       │
│                                                                            │
│       ECS Fargate tasks      ECS Fargate tasks      ECS Fargate tasks      │
│                                                                            │
│       Catalog service        Orders service         Accounts service       │
│       Pricing service        Inventory service      Payments adapter       │
│                                                                            │
│       Each task:                                                           │
│         awsvpc ENI                                                         │
│         private IP                                                         │
│         task security group                                                │
│         task IAM role                                                      │
│         application container                                              │
│         telemetry / Service Connect proxy                                  │
│                                                                            │
│                   ECS Service Connect namespace                            │
│                        northstar.local                                     │
│                                                                            │
│      orders.northstar.local ──► Orders tasks                               │
│      inventory.northstar.local ──► Inventory tasks                         │
│      pricing.northstar.local ──► Pricing tasks                             │
│                                                                            │
│                Order events                                                │
│                     │                                                      │
│                     ▼                                                      │
│                    SQS                                                     │
│                     │                                                      │
│             Fulfillment workers                                            │
│             Notification workers                                           │
│       Fargate baseline + Fargate Spot where safe                           │
│                                                                            │
│        │                    │                     │                         │
│        ▼                    ▼                     ▼                         │
│     Aurora              DynamoDB              ElastiCache                  │
│                                                                            │
│   VPC endpoints: ECR, S3, CloudWatch Logs, Secrets Manager                 │
│   NAT Gateway: outbound calls to payment provider                          │
└────────────────────────────────────────────────────────────────────────────┘

                         Build and deployment plane

 Source → CodePipeline → CodeBuild → ECR → task-definition revision
                                           │
                                           ▼
                                  ECS service deployment

                         Observability plane

 CloudWatch Logs + Container Insights + OpenTelemetry traces → Trace Map
```

## Architecture in one sentence

> Public HTTP traffic reaches an ALB that routes to independently scalable ECS services running on Fargate in private subnets; internal services communicate through Service Connect, asynchronous work is buffered in SQS, each service has its own task role and security group, and images are built once into ECR and deployed through versioned ECS task definitions.

---

# 4. Functional decisions at a glance

| Function | Baseline choice | Reason |
| --- | --- | --- |
| Image registry | Amazon ECR | Managed private OCI-compatible image storage |
| Orchestrator | Amazon ECS | AWS-native container orchestration |
| Compute | AWS Fargate | No EC2 host or cluster-capacity management |
| Public ingress | ALB | HTTP/HTTPS/gRPC and path/host routing |
| Internal connectivity | ECS Service Connect | Service discovery and managed ECS service communication |
| Async work | SQS | Backpressure, retry, and DLQ |
| Application identity | ECS task role | Separate AWS permissions per service |
| ECS infrastructure identity | Task execution role | Image pull, logs, injected secrets |
| Secrets | Secrets Manager | Protected credentials and rotation lifecycle |
| Deployment | ECS rolling update initially | Simple incremental replacement |
| Safer critical deployment | ECS native blue/green | Test green revision and fast rollback |
| Registry security | Immutable tags/digests and Inspector scanning | Reproducibility and vulnerability visibility |
| Metrics | CloudWatch Container Insights | Cluster, service, task, and container metrics |
| Tracing | OpenTelemetry exported to CloudWatch/X-Ray | Distributed request visibility |
| Administration | ECS Exec | Controlled shell access without SSH |

---

# 5. The ECS mental model

## 5.1 Image

An **image** is the immutable application package.

Example:

```text
northstar/orders@sha256:a18f...
```

The image contains the process to run but does not determine:

- how many copies should exist;
- which subnet they use;
- which IAM role they receive;
- which load balancer sends them traffic;
- how they scale.

---

## 5.2 Repository

An ECR repository stores versions of one image family:

```text
northstar/catalog
northstar/orders
northstar/inventory
northstar/payments
```

A repository is not a running service.

---

## 5.3 Task definition

A **task definition** is an ECS blueprint.

It specifies concepts such as:

```text
container image
CPU and memory
entrypoint and command
ports
environment variables
secrets
task role
task execution role
network mode
logging
health checks
volumes
```

Task definitions are versioned:

```text
orders:41
orders:42
orders:43
```

A revision is immutable after registration. A new configuration produces a new revision.

---

## 5.4 Task

A **task** is one running instantiation of a task definition.

```text
Task definition:
    orders:43

Running tasks:
    task A
    task B
    task C
```

A task can run:

- as one member of a long-running service;
- as a one-time job;
- as a scheduled or event-driven standalone task.

---

## 5.5 Service

An ECS **service** maintains a desired number of tasks.

```text
Orders service:
    desired count = 6

ECS scheduler:
    maintain six healthy orders:43 tasks
```

If one task stops, the service launches a replacement.

A service also integrates with:

- load balancers;
- service discovery;
- Service Connect;
- Service Auto Scaling;
- deployments;
- health checks.

---

## 5.6 Cluster

An ECS **cluster** is a logical grouping for tasks, services, and capacity providers.

With Fargate, the cluster does not mean that Northstar owns a fleet of EC2 instances.

```text
ECS cluster
    ├── Fargate services
    ├── Fargate Spot workers
    └── optional EC2 capacity-provider services
```

ECS documents task definitions, tasks, services, cluster scaling, and service scaling as distinct concepts.

---

## 5.7 Capacity provider

A capacity provider answers:

> On which compute capacity should ECS place these tasks?

Relevant options include:

```text
FARGATE
FARGATE_SPOT
EC2 Auto Scaling group capacity provider
```

A cluster may contain different capacity-provider families, but a single capacity-provider strategy does not mix Fargate providers with EC2 Auto Scaling group providers. Separate services can use different strategies.

---

# 6. One task may contain several containers

A task can contain:

```text
application container
telemetry collector
Service Connect proxy
log router
small tightly coupled helper
```

Containers within one `awsvpc` task share the task network namespace and can communicate through:

```text
localhost
```

They also share the task lifecycle: if the task is replaced, all its containers are replaced together.

## Good same-task relationship

```text
orders application
+
OpenTelemetry collector sidecar
```

They:

- scale together;
- deploy together;
- have one lifecycle;
- are not independently useful.

## Poor same-task relationship

```text
orders service
+
inventory service
+
payments service
```

These have different:

- owners;
- scaling patterns;
- release cycles;
- availability risks;
- IAM permissions.

They should normally be separate ECS services.

### Memory rule

> Put tightly coupled implementation helpers in one task. Put independently deployable business capabilities in separate services.

---

# 7. Amazon ECR

## 7.1 Build once

The deployment pipeline builds an image once:

```text
source commit 9f31...
    ↓
CodeBuild
    ↓
orders image digest sha256:a18f...
```

The exact digest is promoted through environments.

```text
development → digest a18f
staging     → digest a18f
production  → digest a18f
```

Rebuilding separately in production could produce a different image because:

- base images changed;
- package repositories changed;
- dependency resolution changed;
- build tools changed.

Promotion should normally mean deploying the already tested artifact.

---

## 7.2 Tags versus digests

A tag is a convenient label:

```text
orders:v43
orders:release-2026-08-27
```

A digest identifies the immutable image content:

```text
orders@sha256:a18f...
```

For maximum deployment reproducibility, task definitions can pin the image digest.

ECR supports tag immutability so that an existing protected tag cannot silently be moved to different image content.

### Dangerous pattern

```text
image: orders:latest
```

A force deployment tomorrow may run different code even when the task definition did not change.

### Better pattern

```text
image: orders@sha256:a18f...
```

---

## 7.3 Vulnerability scanning

ECR basic scanning detects operating-system vulnerabilities.

Enhanced scanning integrates with Amazon Inspector and can continuously evaluate both operating-system and programming-language package vulnerabilities.

A deployment policy might require:

```text
no critical unapproved findings
no expired exception
approved base-image family
image signature or provenance check
```

A vulnerability scan is evidence, not proof that the application is secure. It does not detect:

- broken authorization logic;
- exposed credentials;
- SQL injection in application code;
- unsafe runtime configuration;
- business-logic flaws.

---

## 7.4 Lifecycle policies

Repositories accumulate:

- old releases;
- branch builds;
- untagged intermediate images;
- superseded base images.

ECR lifecycle policies can expire images according to controlled rules. Rules should retain:

- every active production digest;
- recent rollback candidates;
- images required for incident reconstruction.

ECR provides lifecycle policies specifically for automated repository cleanup.

---

# 8. Selecting the container platform

## 8.1 Baseline decision: ECS on Fargate

Northstar chooses ECS on Fargate because:

- workloads are AWS-only;
- there is no Kubernetes API requirement;
- services use ordinary Linux containers;
- tasks do not require GPUs or privileged host access;
- the company wants to avoid managing EC2 container hosts;
- each service can be independently sized and scaled.

Fargate manages the underlying compute infrastructure. ECS services on Fargate support ALB, NLB, and GWLB integrations, and Fargate offers both ordinary and interruption-tolerant Spot capacity.

---

## 8.2 ECS on EC2

ECS on EC2 is preferable when the requirement emphasizes:

- GPU instances;
- specialized or very large instance types;
- privileged or host-integrated containers;
- custom AMIs;
- host-level agents;
- stable high utilization where bin packing can lower cost;
- Savings Plans or Reserved Instance strategies tied to host capacity;
- direct control of kernel, storage, or networking configuration.

The tradeoff is that Northstar owns more responsibilities:

```text
EC2 patching
AMI updates
capacity fleet
instance replacement
ECS agent
host scaling
host security
bin packing
Spot draining
```

ECS can associate an EC2 Auto Scaling group with a capacity provider and manage cluster scaling, but the EC2 hosts remain customer-operated infrastructure.

---

## 8.3 Amazon EKS

EKS is the stronger choice when requirements include:

- a Kubernetes compatibility contract;
- Kubernetes operators or CRDs;
- Helm ecosystems;
- cross-cloud or on-premises Kubernetes portability;
- organization-wide Kubernetes skills and tooling;
- Kubernetes-native policy and extension mechanisms.

Northstar has none of those requirements.

Using EKS merely because the application has several containers would add:

```text
Kubernetes API
pods
Deployments
Services
Ingress
RBAC
CNI
CSI
cluster add-ons
Kubernetes upgrades
```

without solving an unmet business need.

---

## 8.4 Elastic Beanstalk

Elastic Beanstalk can run Docker applications and provision the underlying EC2, load balancing, Auto Scaling, deployment, and health-reporting environment.

It is a good candidate when the application is:

- one web application;
- one worker environment;
- deployed as one operational unit;
- better served by a platform abstraction over EC2.

It is less suitable when Northstar wants a first-class platform for many independently deployed services, service-to-service discovery, per-service roles, and per-service scaling. The attached material describes Beanstalk web and worker environments and its service-role and instance-profile separation.

---

## 8.5 App Runner

Historically, App Runner was a strong choice for:

```text
one public HTTP container
source or image repository
automatic build and deployment
automatic HTTPS
automatic scaling
minimal infrastructure configuration
```

It exposes less orchestration surface than ECS and is unsuitable for many internal topology and service-mesh requirements.

As of this lesson’s date, App Runner is not available to new customers, though existing customers can continue using it. Treat it as an existing-estate and exam-recognition service rather than the baseline for a new platform.

---

## 8.6 Selection table

| Requirement | Strong candidate |
| --- | --- |
| AWS-only containers, low infrastructure management | ECS on Fargate |
| Host control, GPU, privileged workload, high steady utilization | ECS on EC2 |
| Kubernetes contract or ecosystem | EKS |
| One conventional Docker web/worker application | Elastic Beanstalk |
| One simple App Runner service in an existing customer account | App Runner |
| Short event-driven code with no persistent process | Lambda |
| Large queued batch jobs and compute environments | AWS Batch |

---

# 9. Fargate task design

## 9.1 Task-level resources

A Fargate task definition specifies supported combinations of:

```text
vCPU
memory
operating system
CPU architecture
ephemeral storage where configured
```

Resource configuration should reflect measured:

- CPU utilization;
- working-set memory;
- startup memory;
- garbage-collection behavior;
- request concurrency;
- sidecar overhead.

Too little memory causes termination.

Too much memory produces persistent waste because Fargate charges according to provisioned task resources, not merely average usage.

---

## 9.2 Stateless task design

A task may stop because of:

- scaling in;
- deployment;
- infrastructure maintenance;
- health-check failure;
- application crash;
- Fargate Spot interruption;
- Availability Zone disruption.

Therefore, authoritative state belongs in:

```text
Aurora
DynamoDB
S3
ElastiCache only when state is reconstructible
SQS
```

Do not retain the only copy of:

- an order;
- a payment outcome;
- an uploaded document;
- an unacknowledged event;

on the task filesystem.

---

## 9.3 Fargate Spot

Fargate Spot is appropriate for interruption-tolerant work such as:

- regenerable reports;
- idempotent notification processing;
- queue workers whose messages remain in SQS;
- nonurgent catalog indexing;
- retryable batch transformation.

AWS can reclaim Spot capacity with a two-minute interruption notice. The workload must stop gracefully or allow the queue visibility timeout to return unfinished work.

Northstar does not place its minimum healthy synchronous API capacity entirely on Spot.

---

# 10. IAM architecture

## 10.1 The four important role categories

```text
Task execution role
    ECS infrastructure starts the task.

Task role
    Code inside the task calls AWS APIs.

ECS service-linked role
    ECS manages ENIs, target registration, scaling integrations.

Deployment role
    CI/CD registers task definitions and updates services.
```

The task role versus execution-role distinction is explicitly identified by the uploaded guide as an ECS exam priority.

---

## 10.2 Task execution role

The **task execution role** is used by the ECS agent or Fargate infrastructure.

Typical permissions include:

```text
authenticate to ECR
pull image layers
create CloudWatch Logs streams
write container logs
retrieve a secret injected by the task definition
authenticate to an external private registry
```

These permissions are not the application’s ordinary AWS permissions. AWS describes ECR pulls and CloudWatch logging as task-execution-role responsibilities.

### Memory rule

```text
Execution role:
    get the container running.
```

---

## 10.3 Task role

The **task role** supplies temporary credentials to the application containers.

Examples:

```text
OrdersTaskRole
    dynamodb:PutItem
    dynamodb:UpdateItem
    events:PutEvents

CatalogTaskRole
    dynamodb:GetItem
    dynamodb:Query
    s3:GetObject on catalog assets

NotificationWorkerRole
    sqs:ReceiveMessage
    ses:SendEmail

PaymentAdapterRole
    secretsmanager:GetSecretValue on payment credential
```

ECS delivers task-role credentials through the container credential provider. On Fargate, there is no EC2 instance profile exposed to the task as its application identity.

### Memory rule

```text
Task role:
    let the running application do its work.
```

---

## 10.4 One role per service

Avoid:

```text
NorthstarMicroservicesRole
    s3:*
    dynamodb:*
    secretsmanager:*
    sqs:*
    events:*
```

A compromise of the catalog service should not provide:

- payment credentials;
- order-write permissions;
- notification sending;
- unrelated customer data.

AWS recommends separate minimally scoped task roles for distinct task definitions or services.

---

## 10.5 Service-linked role

ECS itself must perform operations such as:

- creating and deleting task ENIs;
- registering and deregistering load-balancer targets;
- creating scaling-policy integrations.

ECS uses its service-linked role for these service-management actions.

This is not the same as:

```text
task execution role
task role
deployment role
```

---

## 10.6 Deployment role and `iam:PassRole`

The deployment pipeline registers a task definition containing:

```text
taskRoleArn
executionRoleArn
```

The pipeline is instructing ECS:

> Launch future tasks with these roles.

Therefore, the deployment role may need:

```text
iam:PassRole
```

for the approved task and execution roles.

It does not automatically assume those roles.

```text
PassRole:
    authorize ECS to use a role.

AssumeRole:
    become a temporary session of a role.
```

Restrict `iam:PassRole` by:

- exact role ARN;
- intended ECS service;
- approved deployment principals.

---

# 11. Secret delivery

## 11.1 Task-definition injection

A task definition can reference a Secrets Manager value and inject it as an environment variable.

In this path:

```text
ECS/Fargate infrastructure
    ↓ uses task execution role
Secrets Manager
    ↓
secret injected at task startup
```

The application need not call Secrets Manager directly.

However:

- the secret is available to processes and debugging tools that can inspect the environment;
- rotation does not update an already running task;
- a new task or forced deployment is required to receive the new value.

---

## 11.2 Runtime retrieval

The application can retrieve a secret programmatically.

```text
Payment adapter
    ↓ uses PaymentAdapterTaskRole
secretsmanager:GetSecretValue
    ↓
payment credential
```

This is preferable when:

- the application must refresh rotated values;
- the secret should not be an environment variable;
- retrieval and caching logic can be implemented safely.

In this path, Secrets Manager permission belongs to the task role.

---

## 11.3 Comparison

| Pattern | Role that retrieves secret | Rotation behavior |
| --- | --- | --- |
| Task-definition environment injection | Task execution role | Existing task keeps old value |
| Application retrieves through SDK | Task role | Application can retrieve current version |

---

# 12. `awsvpc` networking

## 12.1 One task, one network identity

With `awsvpc` mode, each ECS task receives:

- its own ENI;
- its own private IP address;
- one or more security groups;
- VPC routing behavior;
- Flow Log visibility.

This gives a task network properties similar to an EC2 instance. `awsvpc` is mandatory for Fargate and recommended for ECS on EC2 unless another mode is specifically required.

```text
Orders task A:
    10.20.10.41
    Orders-SG

Orders task B:
    10.20.11.87
    Orders-SG

Inventory task:
    10.20.20.32
    Inventory-SG
```

---

## 12.2 Security-group relationships

### ALB security group

```text
Inbound:
    HTTPS 443 from CloudFront or approved Internet sources

Outbound:
    Orders port to Orders-SG
    Catalog port to Catalog-SG
    Accounts port to Accounts-SG
```

### Orders security group

```text
Inbound:
    HTTP 8080 from ALB-SG
    service port from approved internal service SGs or proxy path

Outbound:
    PostgreSQL 5432 to OrdersDB-SG
    HTTPS 443 to AWS endpoints and approved external services
```

### Inventory security group

```text
Inbound:
    service port from Orders-SG or the approved Service Connect path
```

### Database security group

```text
Inbound:
    PostgreSQL 5432 only from services that require database access
```

Do not allow the whole VPC CIDR merely because every service lives in the VPC.

---

## 12.3 Load-balancer target type

For tasks using `awsvpc`, the load balancer registers the task’s IP address.

The target group must therefore use:

```text
target type = ip
```

not:

```text
target type = instance
```

The task has an ENI identity independent of the underlying Fargate infrastructure or EC2 host.

---

## 12.4 Private subnets

Northstar tasks run in private subnets without public IP addresses.

Inbound traffic reaches them through:

```text
CloudFront
    ↓
ALB
    ↓
task private IP
```

Outbound third-party traffic uses:

```text
task ENI
    ↓
private-subnet default route
    ↓
same-AZ NAT Gateway
    ↓
Internet Gateway
    ↓
payment provider
```

On ECS on EC2, task ENIs in `awsvpc` mode also do not receive public IP addresses and normally require NAT for public Internet egress.

---

## 12.5 VPC endpoints

Private AWS service paths can avoid NAT for services such as:

```text
ECR
S3
CloudWatch Logs
Secrets Manager
Systems Manager
```

The endpoint supplies network reachability.

The execution or task role supplies AWS authorization.

```text
ECR endpoint exists
    AND
execution role lacks ECR permission
    =
image pull fails
```

---

## 12.6 IP capacity is task capacity

Each `awsvpc` task consumes a subnet IP address.

A subnet can therefore prevent scaling even when:

- Fargate has capacity;
- service quotas are available;
- CPU demand justifies more tasks;
- the ECS desired count increased successfully.

```text
desired count = 100
available subnet IPs = 8
    ↓
many tasks remain pending
```

Subnet sizing is a compute-capacity concern in container platforms.

---

# 13. Packet walks

## 13.1 Client to orders service

```text
1. Client resolves the public application name.

2. Client establishes HTTPS with CloudFront or ALB.

3. WAF evaluates the HTTP request.

4. ALB listener matches:
       /orders/*

5. ALB selects the Orders target group.

6. Target group selects a healthy task IP.

7. ALB-SG permits outbound to Orders-SG.

8. Orders-SG permits inbound from ALB-SG.

9. Orders container listens on the configured port.

10. Application authenticates and authorizes the user.

11. Response returns over the established path.
```

IAM does not decide whether the ALB may forward ordinary HTTP traffic to the task. Load-balancer configuration, routing, security groups, and application authorization govern that data-plane path.

---

## 13.2 Orders service to inventory service

```text
1. Orders calls:
       inventory.northstar.local

2. Service Connect resolves the logical service name.

3. Local Service Connect proxy handles the client-side connection.

4. Traffic is routed to a healthy inventory task endpoint.

5. VPC routes and security controls permit the path.

6. Inventory application authorizes the service request.

7. Trace context is propagated.
```

Service discovery gives a destination. It does not by itself provide application identity or business authorization.

---

## 13.3 Task startup from ECR

```text
1. ECS decides to launch orders:43.

2. Fargate creates the task ENI.

3. ECS infrastructure uses the task execution role.

4. ECR authentication succeeds.

5. Image manifest and layers are retrieved.

6. CloudWatch log stream is prepared.

7. Secrets configured for startup injection are retrieved.

8. Container process starts.

9. Container and target-group health checks begin.

10. Task receives production traffic only after becoming healthy.
```

If image pulling fails, expanding the application task role is normally irrelevant: the execution role and network path are the first suspects.

---

## 13.4 Payment adapter to external provider

```text
1. Payment task resolves provider hostname.

2. Task opens TCP 443.

3. Private-subnet route chooses NAT.

4. NAT translates the source to its Elastic IP.

5. Provider validates TLS and application credential.

6. Response returns through the NAT mapping.
```

AWS IAM controls access to the stored payment credential.

The external provider controls authorization of the payment API request.

---

# 14. Public ingress: ALB versus NLB

The attached comparison material associates ALB with HTTP, HTTPS, and gRPC, and NLB with TCP, UDP, and TLS. It also highlights NLB static IP and source-IP behavior.

## 14.1 Application Load Balancer

Choose ALB when the routing decision depends on:

- hostname;
- URL path;
- HTTP method;
- headers;
- query parameters;
- HTTP/HTTPS;
- gRPC;
- WebSocket;
- WAF integration.

Northstar shares one ALB across several public services:

```text
/catalog/*  → Catalog target group
/orders/*   → Orders target group
/accounts/* → Accounts target group
```

ALB supports path-based routing and allows several ECS services to share one listener through separate target groups.

---

## 14.2 Network Load Balancer

Choose NLB when the requirement emphasizes:

- raw TCP;
- UDP;
- TLS at Layer 4;
- static IP addresses;
- Elastic IP addresses;
- source-IP preservation;
- very high connection scale;
- TLS pass-through.

Example:

```text
A legacy warehouse partner requires:
    fixed allowlisted IP addresses
    raw TLS over TCP
    no HTTP semantics
```

An NLB is the more natural entry point.

NLB does not route by:

```text
/orders/*
Host: api.northstar.example
HTTP header
```

---

## 14.3 Gateway Load Balancer

GWLB is not an ordinary application ingress.

It is used to deploy and scale network appliances such as:

- firewalls;
- intrusion-prevention systems;
- packet-inspection products.

---

## 14.4 WAF placement

WAF can protect the ALB or a CloudFront distribution in front of the ALB.

WAF is not directly attached to an NLB because NLB does not operate as an HTTP-aware Layer 7 proxy. The uploaded exam notes emphasize this distinction.

---

# 15. Internal service discovery

A microservice needs a stable logical destination even though tasks are continuously replaced.

```text
Inventory task IP today:
    10.20.10.44

Replacement tomorrow:
    10.20.11.91
```

Applications should not hard-code task IPs.

---

## 15.1 ECS Service Connect

Northstar uses Service Connect.

```text
Orders application calls:
    inventory:8080

Service Connect:
    resolves and routes to current inventory tasks
```

Service Connect supplies:

- ECS-managed service discovery;
- short logical service names;
- service-to-service connectivity;
- standardized connection metrics and logs;
- deployment-integrated endpoint updates.

AWS describes Service Connect as an ECS configuration that provides both service discovery and a service mesh for ECS services. It only interconnects ECS services.

### Important boundary

Service Connect does not make these into ECS services:

```text
Aurora
DynamoDB
Lambda
external payment provider
```

Those retain their own endpoints and authorization models.

---

## 15.2 AWS Cloud Map service discovery

ECS can register tasks in AWS Cloud Map.

A client might resolve:

```text
inventory.internal
    ↓
private task IP records
```

Cloud Map DNS-based discovery is simpler than a full Service Connect configuration, but the client must tolerate:

- DNS caching;
- task replacement;
- failed endpoints before records update;
- application-level retry behavior.

ECS service discovery registers task private addresses and is integrated with Route 53 private namespaces. Service-discovery traffic goes directly to tasks rather than through an associated load balancer.

---

## 15.3 Internal load balancer

An internal ALB or NLB can provide a stable VPC-private entry point.

Use it when:

- non-ECS consumers need a stable endpoint;
- Layer 7 routing is useful;
- centralized health checking is desired;
- several VPC-connected clients must reach the service;
- API Gateway uses a VPC link to private services.

The tradeoff is:

- load-balancer cost;
- another network hop;
- target-group management;
- potential shared dependency.

---

## 15.4 Selection rule

```text
ECS-to-ECS communication with integrated discovery and telemetry:
    Service Connect

Simple private DNS discovery:
    AWS Cloud Map

Stable endpoint for diverse VPC clients:
    internal ALB or NLB
```

---

# 16. Asynchronous services

An order is created synchronously, but fulfillment is asynchronous.

```text
Orders service
    ↓
transaction succeeds
    ↓
OrderCreated event or SQS message
    ↓
fulfillment queue
    ↓
Fulfillment worker tasks
```

SQS provides:

- durable buffering;
- retry;
- visibility timeout;
- DLQ;
- separation between producer rate and consumer rate.

The worker must be idempotent because the same message can be processed more than once.

Containers do not change the delivery semantics introduced in Lesson 3.

---

# 17. Service scaling

## 17.1 ECS Service Auto Scaling

Service Auto Scaling changes:

```text
desired number of ECS tasks
```

It supports:

- target tracking;
- step scaling;
- scheduled scaling;
- predictive scaling.

ECS publishes average service CPU and memory metrics, and Application Auto Scaling can also use other CloudWatch metrics.

---

## 17.2 Public API scaling

Possible orders-service signals:

```text
ALB request count per target
CPU utilization
memory utilization
p95 latency through a custom metric
active connection count
```

Example:

```text
Maintain:
    approximately 800 requests/minute per healthy task
```

Request count per target often reflects API work more directly than CPU when requests spend substantial time waiting on dependencies.

---

## 17.3 Worker scaling

CPU is often a weak metric for an SQS consumer.

A better measure is:

\[
\text{backlog per task}
=

\frac{\text{visible messages}}
     {\max(1,\text{running tasks})}
\]

A latency-oriented target can be derived from:

\[
\text{desired backlog per task}
\approx
\frac{\text{acceptable queue latency}}
     {\text{average processing time}}
\]

For example:

```text
acceptable delay = 60 seconds
average processing time = 3 seconds
desired backlog per task ≈ 20
```

The exact formula is only an approximation because workloads vary.

---

## 17.4 Downstream protection

Suppose:

```text
payment provider limit = 100 requests/second
one task can produce 20 requests/second
```

An upper bound near five active payment workers may be safer than unconstrained scaling.

Scaling policy must consider:

```text
application demand
AND
downstream safe capacity
```

Otherwise, successful ECS scaling can cause a provider outage or account ban.

---

## 17.5 Fargate scaling

With Fargate:

```text
service desired count rises
    ↓
AWS supplies task compute
```

Northstar does not separately scale an EC2 Auto Scaling group.

Fargate can still fail to launch tasks because of:

- unavailable capacity;
- subnet IP exhaustion;
- service quotas;
- incompatible task definition;
- permissions;
- image-pull failures.

---

## 17.6 ECS on EC2 has two scaling layers

```text
Service Auto Scaling
    → desired task count

Cluster Auto Scaling
    → EC2 host count
```

Example:

```text
Orders desired count rises from 10 to 30
    ↓
20 tasks cannot be placed
    ↓
capacity provider increases EC2 Auto Scaling group
    ↓
new instances register with ECS
    ↓
pending tasks are placed
```

Scaling tasks without scaling hosts produces pending tasks.

Scaling hosts without scaling tasks produces idle EC2 capacity.

---

# 18. Health models

## 18.1 Container health check

The task definition can run a command inside the container:

```text
Is the process internally healthy?
```

Example:

```text
curl localhost:8080/health
```

ECS can use container health in its service and deployment decisions.

---

## 18.2 Load-balancer health check

The ALB target group asks:

```text
May this target receive client traffic?
```

Example:

```text
GET /ready
```

This may verify:

- application process initialized;
- critical configuration loaded;
- listener ready;
- required dependency pool established.

---

## 18.3 Business health

A task can be technically healthy while the service is failing business operations.

```text
/ready returns 200
payment provider credentials expired
every payment fails
```

Detect this through:

- error-rate alarms;
- transaction success metrics;
- traces;
- synthetic tests;
- deployment alarms.

---

## 18.4 Avoid overly deep health checks

If `/ready` fails whenever a noncritical downstream dependency has a brief issue:

```text
dependency degrades
    ↓
all tasks report unhealthy
    ↓
ECS replaces healthy processes
    ↓
replacement storm
    ↓
outage worsens
```

Health checks should distinguish:

- “this task cannot serve anything”;
- “one downstream capability is degraded.”

---

# 19. Deployment pipeline

## 19.1 Build and release sequence

```text
1. Developer commits code.

2. CodePipeline starts.

3. CodeBuild runs:
       lint
       unit tests
       integration tests
       image build
       software-composition checks

4. Image is pushed to ECR.

5. ECR / Inspector scanning completes.

6. Deployment gate evaluates policy.

7. Pipeline registers a new task-definition revision
   pinned to the image digest.

8. ECS service deployment begins.

9. Health and application alarms are evaluated.

10. Deployment completes or rolls back.
```

The image is the application artifact.

The task definition is the runtime configuration.

The ECS service determines which revision is active.

---

# 20. Rolling deployment

## 20.1 How rolling replacement works

Baseline:

```text
orders:42 tasks serve traffic

ECS launches some orders:43 tasks
    ↓
new tasks become healthy
    ↓
old tasks are drained and stopped
    ↓
repeat until all tasks run orders:43
```

The service’s deployment configuration controls how much old and new capacity may coexist.

Rolling deployment is resource-efficient because it does not necessarily duplicate the entire fleet.

---

## 20.2 Deployment circuit breaker

The ECS deployment circuit breaker can stop a rolling deployment when tasks cannot reach steady state and can automatically roll back to the last successful service revision.

CloudWatch alarms can independently fail a rolling deployment based on application metrics such as error rate or latency. Both mechanisms can be used together.

### Circuit breaker catches

```text
container crashes
task cannot start
target never becomes healthy
bad port configuration
missing secret
image startup failure
```

### CloudWatch alarm catches

```text
5xx rate rises
p95 latency regresses
payment-success rate drops
business-error metric increases
```

A task can start successfully and still contain a serious application regression.

---

# 21. Blue/green deployment

## 21.1 Concept

```text
Blue:
    current production task revision

Green:
    new task revision
```

Both run simultaneously.

```text
production traffic → blue
test traffic       → green
```

After validation:

```text
production traffic → green
blue retained temporarily for rollback
```

Blue/green lowers deployment risk but temporarily increases capacity and cost.

---

## 21.2 Current native ECS blue/green

Native ECS blue/green deployments can:

- create the green service revision;
- register it with a separate target group;
- route test traffic;
- run lifecycle hooks;
- shift production traffic;
- monitor alarms;
- retain blue during a bake period;
- roll back when validation fails.

The current native ECS production shift is all-at-once after validation. Lifecycle hooks and pause points can govern progression around the shift.

---

## 21.3 CodeDeploy-controlled ECS blue/green

The attached exam material emphasizes CodeDeploy for ECS blue/green deployments. CodeDeploy can use:

```text
canary
linear
all-at-once
```

traffic shifting with ALB-based deployments. With NLB, CodeDeploy supports all-at-once shifting.

CodeDeploy requires:

- CodeDeploy application;
- deployment group;
- two target groups;
- production listener;
- optional test listener;
- CodeDeploy service role;
- ECS task sets;
- AppSpec configuration.

### Current versus exam memory

```text
Current new ECS design:
    consider native ECS blue/green

Legacy and SAP-C02 recognition:
    CodeDeploy blue/green
```

---

## 21.4 Database compatibility during deployment

Blue and green may run simultaneously.

Therefore, schema changes should follow a backward-compatible sequence:

```text
1. Add new nullable column or new table.
2. Deploy code that can work with old and new schema.
3. Backfill data.
4. Shift all traffic.
5. Stop old code.
6. Remove obsolete schema only later.
```

A destructive migration executed before green is validated can make rollback impossible even though the blue tasks still exist.

---

# 22. Service discovery during deployment

During rolling deployment, old and new tasks may both be discoverable.

Services must tolerate:

- mixed application versions;
- backward-compatible requests;
- staggered replacement;
- connection draining;
- clients holding existing connections.

A deployment strategy cannot compensate for an incompatible service contract.

Prefer:

- additive API changes;
- explicit versioning for incompatible contracts;
- tolerant readers;
- staged removals;
- bounded retry.

---

# 23. Observability

## 23.1 Three signal families

```text
Metrics:
    How much and how often?

Logs:
    What happened at a specific component?

Traces:
    Where did one distributed request spend time?
```

A microservices platform normally requires all three.

---

## 23.2 Container Insights

CloudWatch Container Insights collects and aggregates performance data from ECS at:

- cluster;
- service;
- task;
- container

levels.

Enhanced observability adds more detailed task and container metrics.

Monitor:

```text
running versus desired tasks
pending tasks
CPU
memory
network traffic
container restarts
task failures
service deployment state
```

---

## 23.3 Application logs

Each service writes structured logs:

```json
{
  "timestamp": "...",
  "service": "orders",
  "environment": "production",
  "trace_id": "...",
  "request_id": "...",
  "order_id": "...",
  "level": "ERROR",
  "event": "payment_authorization_failed"
}
```

Avoid logging:

- payment credentials;
- session tokens;
- full customer records;
- secret values;
- unnecessary high-volume payloads.

---

## 23.4 Distributed tracing

One request may flow through:

```text
ALB
  ↓
Orders
  ↓
Inventory
  ↓
Pricing
  ↓
Payments
  ↓
Aurora
```

An overall response time of 1.8 seconds does not reveal which dependency contributed the delay.

A trace records spans such as:

```text
Orders request                 1,800 ms
├── Inventory                    40 ms
├── Pricing                      55 ms
├── Payment provider          1,420 ms
└── Aurora write                120 ms
```

X-Ray provides a trace map and latency analysis for distributed applications. For new instrumentation, AWS recommends OpenTelemetry and can export OTel traces into CloudWatch/X-Ray views.

---

## 23.5 OpenTelemetry sidecar

A task may contain:

```text
application container
+
OpenTelemetry collector
```

The application emits:

- traces;
- metrics;
- logs or log correlation metadata.

The collector exports them to the selected backend.

AWS supports an ADOT sidecar configuration for ECS and X-Ray integration.

---

## 23.6 Async trace propagation

Synchronous HTTP can pass trace context in request headers.

For SQS, include trace or correlation context in:

- message attributes;
- message body envelope;
- OpenTelemetry propagation fields.

The worker starts a linked processing span rather than losing the relationship to the original order request.

A queue wait should appear separately from processing duration:

```text
request created message
    ↓ 45 seconds in queue
worker processed for 2 seconds
```

---

## 23.7 Service Connect telemetry

Service Connect provides standardized connection metrics and logs for ECS service communication.

It can help show:

- connection volume;
- errors;
- latency;
- client and server endpoints.

It does not replace application traces or business metrics.

---

# 24. ECS Exec

ECS Exec provides controlled command execution inside a running ECS container through Systems Manager infrastructure.

It can help investigate:

- current environment;
- network resolution;
- file layout;
- process state;
- application configuration;
- local health endpoints.

It avoids opening SSH or running a public bastion solely to access containers. ECS Exec requires appropriate user permissions and task-role support for its Systems Manager channel. Commands execute as root inside the container, so access must be tightly controlled and audited.

ECS Exec is an incident tool, not a deployment mechanism. A manual container change disappears when the task is replaced.

---

# 25. Reliability model

## 25.1 Task failure

```text
Orders task crashes
    ↓
ALB health check fails
    ↓
target is removed
    ↓
ECS service notices desired count is low
    ↓
replacement task starts
```

The service remains available if enough other healthy tasks exist.

---

## 25.2 Availability Zone failure

```text
AZ A fails
    ↓
tasks in AZ A disappear
    ↓
ALB routes to healthy tasks in AZ B/C
    ↓
ECS launches replacement tasks where capacity is available
```

This requires:

- service subnets in several AZs;
- load-balancer presence across them;
- enough remaining or obtainable capacity;
- Multi-AZ data services;
- no single-AZ NAT or endpoint dependency where independence is required.

---

## 25.3 Fargate capacity problem

A service may be unable to place new tasks because the selected Fargate capacity is temporarily constrained.

Mitigations include:

- several AZ subnets;
- suitable architecture/CPU choices;
- retained minimum healthy capacity;
- retries;
- capacity-provider strategy;
- workload tolerance for delayed scale-out.

---

## 25.4 ECS on EC2 host failure

```text
EC2 container instance fails
    ↓
all tasks on that host fail
    ↓
services replace tasks
    ↓
capacity provider replaces EC2 instance
```

A larger host may improve bin packing but increases the number of tasks lost together.

---

## 25.5 Service discovery failure

Possible symptoms:

```text
name does not resolve
connection refused
stale endpoint
proxy misconfiguration
service exists but no healthy tasks
```

Investigate separately:

- discovery namespace;
- service registration;
- task health;
- security groups;
- port names;
- Service Connect configuration;
- application listener.

---

## 25.6 Queue-worker failure

If a Fargate worker stops before deleting its SQS message:

```text
visibility timeout expires
    ↓
message becomes available
    ↓
another task retries it
```

Correctness depends on idempotent processing and durable state outside the task.

---

## 25.7 Regional failure

The baseline does not survive full Regional loss.

A multi-Region design would need:

- duplicated ECS services;
- image replication;
- replicated data;
- traffic failover;
- queue and event recovery;
- write-ownership policy;
- secrets and IAM in both Regions;
- tested failback.

Multi-AZ container placement is not multi-Region disaster recovery.

---

# 26. Security architecture

## 26.1 Security layers

```text
ECR scanning
    image vulnerability visibility

Immutable digest
    deployment reproducibility

Task execution role
    controlled task startup

Task role
    application AWS permissions

awsvpc security group
    per-service network relationships

Private subnet
    no direct Internet ingress

Secrets Manager
    protected runtime credentials

WAF
    public HTTP request inspection

CloudTrail
    infrastructure and IAM activity

Container Insights / traces
    operational detection
```

---

## 26.2 Containers are not an authorization boundary

A container image does not eliminate the need for:

- IAM;
- security groups;
- application authorization;
- secret isolation;
- data-store permissions.

AWS explicitly warns that containers are not inherently a security boundary. Fargate gives each task a dedicated isolation boundary, whereas tasks co-located on ECS EC2 hosts require particular care around host metadata, instance-role credentials, and co-tenant access.

---

## 26.3 EC2 instance role versus task roles

With ECS on EC2, the container instance itself needs an instance role for the ECS agent and host operations.

Application permissions should still be placed on task roles.

```text
EC2 instance role:
    register host with ECS
    agent and host operations

Orders task role:
    orders application permissions
```

Prevent application containers from obtaining broad instance-profile credentials through EC2 metadata.

---

## 26.4 Runtime hardening

Where compatible:

```text
run as non-root
use read-only root filesystem
drop unnecessary Linux capabilities
avoid privileged mode
use minimal base image
remove build tools from runtime image
set CPU and memory limits
do not bake secrets into image
```

These controls reduce blast radius but do not replace service-level IAM and network controls.

---

# 27. Cost model

## 27.1 Main cost categories

```text
Fargate vCPU and memory
Fargate Spot
ALB or NLB
NAT Gateway
inter-AZ data transfer
ECR storage and scanning
CloudWatch Logs
Container Insights
trace ingestion
Aurora / DynamoDB / ElastiCache
SQS
Secrets Manager
blue/green duplicate capacity
```

---

## 27.2 Fargate cost pattern

Fargate is often attractive when:

- services are small or variable;
- tasks scale down significantly;
- host utilization would be poor;
- operations time is expensive;
- workload isolation is important.

It can be less economical when:

- many services run continuously;
- workloads are highly predictable;
- tasks reserve much more memory than they use;
- EC2 bin packing would maintain high utilization;
- commitment discounts can be used effectively.

---

## 27.3 EC2 cost pattern

ECS on EC2 can be attractive when Northstar can efficiently pack:

```text
many tasks
onto
a stable set of hosts
```

But unused host capacity is still paid for.

Cost depends on:

\[
\text{host cost}
\div
\text{useful task utilization}
+
\text{operational cost}
\]

A cheaper instance fleet that requires frequent manual intervention may not be cheaper overall.

---

## 27.4 Fargate Spot

Use Spot for tasks where interruption causes bounded replay rather than customer-visible corruption.

Savings are not useful when interruption forces:

- a manual repair;
- an external payment duplication;
- loss of uncheckpointed state;
- missed latency objectives.

---

## 27.5 Load-balancer topology

### One shared ALB

Advantages:

- fewer fixed resources;
- centralized TLS and WAF;
- host/path routing;
- efficient for many HTTP services.

Disadvantages:

- shared configuration;
- larger blast radius;
- quotas and rule complexity;
- coupling around one ingress.

### One ALB per service

Advantages:

- stronger isolation;
- independent configuration and lifecycle.

Disadvantages:

- higher cost;
- more certificates and DNS;
- more operational objects.

The right answer depends on isolation and scale, not on an absolute microservices rule.

---

## 27.6 NAT cost

A task that sends large AWS-service traffic through NAT can incur unnecessary processing cost.

Use VPC endpoints where they simplify:

- ECR pulls;
- S3 access;
- log delivery;
- secret retrieval.

Public payment-provider calls still need approved Internet egress or a controlled proxy.

---

## 27.7 Observability cost

High-cardinality logs and traces can grow rapidly.

Control:

- log retention;
- trace sampling;
- debug-log duration;
- payload redaction;
- metric cardinality;
- duplicate telemetry;
- sidecar resource allocation.

Do not disable the telemetry required to diagnose a distributed platform merely to save a small amount.

---

# 28. Alternatives and changed requirements

## Variant 1: One public Docker web service

There are no internal services, queue workers, or advanced topology requirements.

For an existing App Runner customer, App Runner may provide the least operational surface.

For a new customer, consider:

- Elastic Beanstalk;
- ECS on Fargate;
- Lambda/API Gateway if the request model fits.

---

## Variant 2: Kubernetes becomes a contractual standard

The organization acquires:

- Kubernetes operators;
- Helm charts;
- cross-cloud portability;
- a Kubernetes platform team;
- customer-hosted Kubernetes requirements.

Choose EKS and apply the reasoning from the Kubernetes interlude.

---

## Variant 3: GPU inference service

Fargate does not satisfy the accelerator requirement.

Use:

- ECS on EC2 GPU capacity;
- EKS on GPU nodes;
- SageMaker managed inference;

depending on whether the primary requirement is container orchestration or managed ML serving.

---

## Variant 4: Privileged host agent

The workload requires:

- privileged mode;
- host networking;
- direct device access;
- a host daemon;
- custom kernel behavior.

Use ECS on EC2 rather than Fargate.

---

## Variant 5: Static IPs and raw TCP

A partner requires fixed IP allowlisting and a non-HTTP TCP protocol.

Use an NLB.

---

## Variant 6: Private service for non-ECS consumers

Lambda, EC2, and an on-premises application need one stable private service endpoint.

Use:

- internal ALB;
- internal NLB;
- PrivateLink for provider-consumer isolation;

according to protocol and account/network boundaries.

---

## Variant 7: Forty-minute compute jobs

The workload is finite and compute-heavy rather than a long-running service.

Consider:

- standalone ECS tasks;
- AWS Batch;
- Step Functions orchestrating ECS `.sync`;

rather than maintaining an always-running ECS service.

---

## Variant 8: No general Internet egress

Add the required VPC endpoints and private package/image infrastructure.

Audit:

```text
ECR
S3 image layers
CloudWatch Logs
Secrets Manager
STS
SQS
service-specific APIs
external payment provider
```

The external provider may require an approved proxy or another controlled path. Removing NAT without replacing required paths will prevent task startup or runtime operations.

---

## Variant 9: On-premises container workloads

Use ECS Anywhere when the organization wants ECS control-plane management for workloads running on customer-managed external infrastructure.

If Kubernetes itself is required, use an appropriate EKS hybrid or on-premises model instead.

---

## Variant 10: Extreme steady utilization

Most services run continuously at high, predictable utilization.

Evaluate ECS on EC2 with:

- capacity providers;
- Graviton where compatible;
- Savings Plans;
- Spot for tolerant capacity;
- measured bin packing.

The operational burden must be included in the comparison.

---

# 29. Failure drills

## Failure A: Task remains in `PENDING`

Investigate:

```text
Fargate or EC2 capacity
subnet IP exhaustion
task CPU/memory compatibility
service quotas
placement constraints
capacity-provider strategy
ENI quota
```

`PENDING` occurs before application business logic begins.

---

## Failure B: Task stops with image-pull error

Investigate:

```text
image URI or digest
ECR repository policy
task execution role
ECR authentication permission
VPC endpoint or NAT path
S3 image-layer path
platform architecture mismatch
```

Do not add ECR pull permission to the application task role as the first fix.

---

## Failure C: Logs appear, but application receives `AccessDenied` from DynamoDB

Task startup and log delivery succeeded through the execution role.

Investigate:

```text
OrdersTaskRole
table ARN
index ARN
requested action
permissions boundary
SCP
explicit deny
```

---

## Failure D: Secret rotated, but running task still uses old password

The secret was injected at task startup.

Force a new deployment or change the application to retrieve the secret programmatically.

---

## Failure E: ALB returns `503`

Investigate:

```text
healthy target count
task registration
target type = ip
target-group port
task security group
container listener
health-check path
service desired count
deployment state
```

---

## Failure F: ALB health check succeeds, but orders fail

The technical health endpoint is too shallow to detect the relevant failure, or the business dependency failed after readiness.

Investigate:

- application error metrics;
- traces;
- payment-provider status;
- data-store behavior;
- deployment alarms.

---

## Failure G: Service Connect name is unavailable

Investigate:

```text
namespace
client service configuration
server port name
Service Connect service name
proxy health
task deployment revision
service endpoint registration
```

---

## Failure H: Name resolves, but connection times out

Discovery worked.

Investigate:

```text
security groups
route
application listener
proxy configuration
target health
NACLs
```

---

## Failure I: Service scales from 10 to 40 tasks, but latency worsens

Possible causes:

```text
Aurora saturation
payment-provider throttling
shared Redis connection limit
downstream queue lock
cross-AZ traffic
wrong scaling metric
retry storm
```

More front-end tasks can amplify a downstream bottleneck.

---

## Failure J: ECS on EC2 tasks stay pending while desired count rises

Service scaling succeeded, but host capacity did not.

Investigate:

```text
capacity-provider managed scaling
EC2 Auto Scaling limits
instance launch failure
subnet capacity
instance-type resources
ENI density
placement constraints
```

---

## Failure K: New deployment never reaches steady state

Investigate:

```text
image startup
missing secret
wrong container port
health-check grace period
task IAM
database migration
security group
dependency availability
CPU/memory sizing
```

The deployment circuit breaker should prevent endless replacement loops.

---

## Failure L: Deployment rolls back even though new tasks started

A CloudWatch deployment alarm may have detected:

- elevated 5xx;
- latency regression;
- business-error increase.

Starting is not equivalent to behaving correctly.

---

## Failure M: Blue/green deployment cannot create green capacity

Blue and green run simultaneously.

Investigate:

```text
Fargate availability
service quota
subnet IP capacity
EC2 host capacity
database connection capacity
cost/capacity reservation
```

Blue/green requires temporary duplicate capacity.

---

## Failure N: Direct task IP is reachable from too many services

The task security group is too broad.

Replace:

```text
source = VPC CIDR
```

with approved service-to-service security-group relationships where practical.

---

## Failure O: Task cannot call payment provider

Investigate:

```text
DNS
private-subnet default route
NAT Gateway
Internet Gateway
security-group egress
NACL return path
provider IP allowlist
TLS
external credential
```

---

## Failure P: Traces stop at the orders service

Investigate:

```text
trace-context propagation
HTTP client instrumentation
Service Connect proxy telemetry
sampling decision
collector sidecar
task IAM for trace export
async message attributes
```

---

## Failure Q: Fargate Spot worker duplicates fulfillment

The task was interrupted after the external side effect but before deleting the SQS message.

Use an idempotency key and durable state transition around the fulfillment operation.

---

## Failure R: ECS EC2 task reads broader host credentials

The host metadata or instance role is accessible from the container.

Harden metadata access and keep application authority on task roles. Containers co-located on EC2 do not gain Fargate’s per-task isolation boundary.

---

# 30. SAP-C02 decision snippets

## ECS task role versus execution role

**Application code reads DynamoDB:**

```text
task role
```

**ECS pulls the image from ECR:**

```text
task execution role
```

**ECS injects a startup secret from Secrets Manager:**

```text
task execution role
```

**Application retrieves the latest secret at runtime:**

```text
task role
```

---

## ECS on Fargate versus ECS on EC2

**No host management, ordinary containers, variable traffic:**

```text
Fargate
```

**GPU, privileged operation, custom host, or highly optimized steady fleet:**

```text
ECS on EC2
```

---

## ECS versus EKS

**AWS-native container orchestration without Kubernetes requirement:**

```text
ECS
```

**Kubernetes API, operators, Helm, or portability requirement:**

```text
EKS
```

---

## ALB versus NLB

**HTTP, HTTPS, gRPC, host or path routing:**

```text
ALB
```

**TCP, UDP, TLS, static IPs, source-IP requirements:**

```text
NLB
```

---

## Service Connect versus Cloud Map

**ECS-to-ECS discovery plus managed connectivity and telemetry:**

```text
Service Connect
```

**Simple private DNS registration and direct task discovery:**

```text
Cloud Map
```

---

## Service Auto Scaling versus cluster scaling

```text
more service tasks
    → ECS Service Auto Scaling

more EC2 hosts
    → capacity-provider / cluster scaling
```

Fargate removes the second customer-managed layer.

---

## Rolling versus blue/green

**Lower duplicate capacity, gradual task replacement:**

```text
rolling
```

**Preproduction validation and rapid rollback with duplicate fleet:**

```text
blue/green
```

---

## ECR tag versus digest

```text
human-readable release label
    → tag

exact immutable image content
    → digest
```

---

## X-Ray versus OpenTelemetry

```text
SAP-C02 service-recognition answer:
    X-Ray

Current instrumentation standard:
    OpenTelemetry, exported to CloudWatch/X-Ray
```

---

# 31. Retrieval practice

## 1

What is the difference between an image and a task definition?

## 2

What is the difference between a task and an ECS service?

## 3

What does an ECS cluster represent when every service uses Fargate?

## 4

What does a capacity provider decide?

## 5

Why should production reference an immutable image digest?

## 6

What does ECR tag immutability prevent?

## 7

What can ECR enhanced scanning detect?

## 8

Why is ECS on Fargate selected for the baseline?

## 9

When is ECS on EC2 a stronger choice?

## 10

What requirement would make EKS preferable?

## 11

When might Elastic Beanstalk be simpler than this ECS platform?

## 12

What is the task execution role used for?

## 13

What is the task role used for?

## 14

Which role retrieves a secret injected by the task definition?

## 15

Which role retrieves a secret programmatically from application code?

## 16

Why does the deployment role need `iam:PassRole`?

## 17

What does `awsvpc` give each task?

## 18

Why must an `awsvpc` target group use target type `ip`?

## 19

Why can subnet IP exhaustion prevent Fargate scaling?

## 20

How does an ECS task in a private subnet reach a public payment API?

## 21

What is the difference between ALB and NLB?

## 22

Why is WAF associated with ALB rather than NLB?

## 23

What does Service Connect provide?

## 24

How is Cloud Map service discovery different from an internal load balancer?

## 25

What does ECS Service Auto Scaling change?

## 26

What additional scaling layer exists with ECS on EC2?

## 27

Why might SQS backlog per task be better than CPU for a worker?

## 28

What does the ECS deployment circuit breaker detect?

## 29

Why are CloudWatch deployment alarms still needed when the circuit breaker is enabled?

## 30

What is the main capacity tradeoff of blue/green deployment?

## 31

Why must database changes be backward-compatible during blue/green deployment?

## 32

What are the three principal observability signals?

## 33

Why is distributed tracing particularly important for microservices?

## 34

What is the current recommended instrumentation standard for AWS tracing?

## 35

Why should authoritative state not live only on a Fargate task filesystem?

## 36

What happens after one task in an ECS service crashes?

## 37

Why can adding more service tasks worsen an outage?

## 38

What is a safe use of Fargate Spot?

## 39

Why is one broad IAM role for all services dangerous?

## 40

What is the largest failure boundary handled by the baseline?

---

# 32. Answer key

## 1

An image contains the packaged application. A task definition describes how ECS should run one or more containers, including resources, roles, networking, logging, and configuration.

## 2

A task is one running instance. A service maintains a desired number of healthy tasks and manages their deployment and integrations.

## 3

A logical grouping of services, tasks, and capacity-provider configuration; it does not imply a customer-managed EC2 fleet.

## 4

Which compute capacity ECS should use to place a task or service.

## 5

So the deployed artifact cannot change under the same reference and the tested image is exactly the one running in production.

## 6

Moving an existing protected tag to different image content.

## 7

Known operating-system vulnerabilities and, with enhanced Inspector scanning, programming-language package vulnerabilities.

## 8

Northstar needs AWS-native containers without Kubernetes or host-level requirements and wants to avoid managing EC2 container hosts.

## 9

When GPU, privileged operation, custom AMIs, host integration, specialized instances, or optimized steady host utilization is required.

## 10

A Kubernetes API, operator, Helm, portability, or Kubernetes-platform requirement.

## 11

When the workload is essentially one conventional web or worker application deployed as one operational unit.

## 12

To let ECS/Fargate pull images, initialize logging, and retrieve startup-injected configuration or credentials.

## 13

To let the application code inside the task call AWS APIs.

## 14

The task execution role.

## 15

The task role.

## 16

The pipeline instructs ECS to launch tasks with specified roles; it is passing those roles to the service.

## 17

A dedicated task ENI, private IP, VPC routes, and security-group identity.

## 18

The target is the task ENI and IP, not the underlying EC2 host.

## 19

Each task consumes an address. No address means no ENI can be assigned even when compute capacity exists.

## 20

Through the private subnet’s default route to a NAT Gateway and then an Internet Gateway.

## 21

ALB is an HTTP-aware Layer 7 load balancer. NLB handles Layer 4 TCP, UDP, and TLS and supports static-IP-oriented requirements.

## 22

WAF inspects HTTP request semantics, while NLB does not operate as an HTTP-aware proxy.

## 23

ECS-managed service discovery, short service names, service-to-service connectivity, and standardized connection telemetry.

## 24

Cloud Map returns task discovery records and clients connect directly. An internal load balancer provides a stable proxy endpoint, health checking, and optional Layer 7 or Layer 4 routing.

## 25

The desired number of tasks in an ECS service.

## 26

The number of EC2 container hosts must also scale through a capacity provider or Auto Scaling group.

## 27

Queue backlog measures unfinished work directly; a worker may be waiting on I/O with low CPU while the queue grows.

## 28

Tasks that cannot start, remain running, or become healthy enough for the deployment to reach steady state.

## 29

A revision can start and pass basic health checks while producing high latency, 5xx responses, or incorrect business outcomes.

## 30

Blue and green run simultaneously, often approaching twice the normal task capacity during the deployment.

## 31

Old and new task revisions may access the database at the same time, and rollback must remain possible.

## 32

Metrics, logs, and traces.

## 33

One user request crosses several independently operated services, so aggregate latency or one service’s logs cannot identify the full dependency path.

## 34

OpenTelemetry, with export to CloudWatch/X-Ray or another compatible backend.

## 35

Tasks are replaceable and their local storage is ephemeral relative to the application lifecycle.

## 36

The service detects that desired capacity is low and launches a replacement; the load balancer stops routing to the failed task.

## 37

The real bottleneck may be a database, external provider, queue lock, or another shared dependency, and more callers can amplify the pressure.

## 38

An idempotent queue worker whose message remains durable and can be retried after interruption.

## 39

Compromise of any service would grant access to every other service’s data, queues, secrets, and actions.

## 40

Task, infrastructure, and Availability Zone failures within one AWS Region. Full Regional failure is not covered.

---

# 33. What to memorize now

```text
ECR:
    image registry

Task definition:
    runtime blueprint

Task:
    one running instance

Service:
    maintain desired tasks

Cluster:
    logical task/service grouping
```

```text
Task execution role:
    image pull
    logs
    startup-injected secrets

Task role:
    application AWS API calls
```

```text
awsvpc:
    one ENI and private IP per task
    task security groups
    target type = ip
```

```text
Fargate:
    AWS manages task compute

ECS on EC2:
    customer manages host fleet

EKS:
    Kubernetes API and ecosystem
```

```text
ALB:
    HTTP
    HTTPS
    gRPC
    host/path routing
    WAF

NLB:
    TCP
    UDP
    TLS
    static IP requirements
```

```text
Service Connect:
    ECS-to-ECS discovery and connectivity

Cloud Map:
    service registry and DNS/API discovery

Internal load balancer:
    stable private proxy endpoint
```

```text
Service Auto Scaling:
    task count

Cluster Auto Scaling:
    EC2 host count
```

```text
Rolling:
    replace tasks incrementally

Blue/green:
    run old and new revisions together
    validate
    shift traffic
    retain rollback
```

```text
Circuit breaker:
    tasks cannot become healthy

CloudWatch deployment alarm:
    application behaves badly
```

```text
Metrics:
    aggregate behavior

Logs:
    component events

Traces:
    one request across services
```

```text
Exam term:
    X-Ray

Current instrumentation:
    OpenTelemetry
```

---

# 34. What can remain recognition-level

You do not yet need perfect recollection of:

- every ECS task-definition field;
- every supported Fargate CPU and memory combination;
- bridge and host networking details;
- Service Connect proxy configuration syntax;
- Cloud Map API attributes;
- capacity-provider `base` and `weight` calculations;
- deployment minimum and maximum healthy percentages;
- ECS native blue/green lifecycle-stage names;
- CodeDeploy AppSpec syntax;
- OpenTelemetry collector configuration;
- FireLens log-routing syntax;
- ECS Exec Session Manager permissions;
- cross-Region ECR replication;
- ECS Managed Instances configuration.

The durable model is:

```text
Source code
    ↓
immutable image in ECR
    ↓
versioned ECS task definition
    ↓
ECS service
    ↓
Fargate tasks with private ENIs
    ↓
ALB ingress + Service Connect east-west traffic
    ↓
service-specific IAM and security groups
    ↓
independent scaling and deployment
    ↓
metrics + logs + distributed traces
```

At every interaction, continue applying Lesson 0:

```text
Authorization:
    Which principal performs the action,
    and which policy permits it?

Networking:
    Which source reaches which destination,
    through which route, endpoint, protocol,
    port, and security controls?
```
