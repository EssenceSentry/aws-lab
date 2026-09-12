# Interlude Project K — A Hybrid Industrial AI Platform on Amazon EKS

## Source note

The uploaded material identifies Amazon EKS as the managed AWS service for Kubernetes and discusses EKS in AWS, EKS on Outposts, EKS Anywhere, EKS Distro, EC2 nodes, and Fargate. It does not, however, contain a complete scenario demonstrating when Kubernetes should win over AWS-native alternatives. This project is therefore a teaching synthesis grounded in that material and expanded with current official AWS and Kubernetes documentation. fileciteturn6file0

Some current concepts—particularly **EKS Pod Identity, EKS access entries, EKS Auto Mode, and EKS Hybrid Nodes**—postdate much of the uploaded SAP-C02 guide. They are useful for understanding modern EKS but may exceed what the original exam material emphasizes.

---

# 1. The central answer

Your intuition is mostly correct:

> For a greenfield, AWS-only application, Kubernetes is often not the best default.

A composition such as:

```text
API Gateway
Lambda
ECS or App Runner
SQS
EventBridge
Step Functions
S3
DynamoDB or Aurora
```

usually provides:

- fewer components to manage;
- tighter AWS integration;
- simpler IAM;
- less cluster maintenance;
- smaller operational teams;
- clearer service-specific scaling;
- less undifferentiated infrastructure work.

AWS itself frames the container decision partly as a choice between a **serverless/AWS-managed operating model** and a **Kubernetes operating model**. Amazon ECS is the AWS-native container orchestrator, while Amazon EKS provides the Kubernetes API and ecosystem. citeturn509763view1turn509763view0

Kubernetes becomes compelling when several requirements occur together:

\[
\begin{aligned}
&\text{existing Kubernetes applications and skills} \\
+\;&\text{one deployment contract across environments} \\
+\;&\text{custom controllers and Kubernetes ecosystem software} \\
+\;&\text{heterogeneous workloads and hardware} \\
+\;&\text{platform-level extensibility} \\
>\;&\text{the extra operational complexity}
\end{aligned}
\]

The project below is designed so that removing Kubernetes would mean rebuilding a substantial internal platform rather than merely choosing another compute service.

---

# 2. The business brief

## 2.1 The company

**Asteria Vision** sells an industrial computer-vision platform to large manufacturers.

Its software performs:

- real-time defect detection from production-line cameras;
- GPU inference at factories;
- scheduled model evaluation;
- batch reprocessing of archived images;
- centralized fleet and model management;
- customer-specific inspection plugins;
- operational dashboards and alerts.

Asteria currently supports 25 factories and expects to support more than 100.

---

## 2.2 Existing technical assets

The product already consists of:

- 35 containerized services;
- approximately 80 Helm deployment templates;
- several Kubernetes custom resources;
- six custom Kubernetes operators;
- GPU and CPU workloads;
- node-level camera and telemetry agents;
- a Kubernetes-experienced platform team;
- third-party components distributed as Kubernetes packages.

The most important custom resource is conceptually:

```yaml
apiVersion: platform.asteria.example/v1
kind: InspectionPipeline
metadata:
  name: assembly-line-7
  namespace: factory-north
spec:
  model:
    uri: s3://asteria-models/defect-detector/v42/
  accelerator:
    type: nvidia-gpu
    count: 1
  cameras:
    - line-7-camera-a
    - line-7-camera-b
  replicas: 3
  maxLatencyMs: 40
```

A custom operator translates this high-level declaration into lower-level resources such as:

```text
Deployment
Service
HorizontalPodAutoscaler
ConfigMap
PodDisruptionBudget
NetworkPolicy
monitoring configuration
```

Kubernetes is therefore not merely hosting containers. It is the **platform API through which Asteria describes its product**.

---

# 3. Hard requirements

## 3.1 Deployment requirements

The same product release must run:

- in Asteria’s AWS environment;
- in customer data centers;
- eventually at smaller edge locations.

A release must use the same:

- container images;
- custom resource definitions;
- operator logic;
- deployment workflows;
- health model;
- configuration schema.

Environment-specific integrations may differ, but the product-level API must remain stable.

---

## 3.2 Data-locality requirements

Raw production images may not leave some customer facilities.

Only the following may be sent to AWS:

- defect classifications;
- aggregate metrics;
- model-performance summaries;
- operational health data;
- explicitly approved diagnostic samples.

---

## 3.3 Connectivity requirements

A factory must continue operating for at least eight hours when its WAN connection to AWS is unavailable.

Therefore, factory execution cannot depend continuously on:

- an AWS-hosted Kubernetes control plane;
- ECR;
- S3;
- AWS IAM;
- an AWS-hosted database;
- a central scheduling service.

The local platform must retain its own:

- Kubernetes control plane;
- container images;
- configuration;
- storage;
- model artifacts;
- service discovery;
- workload scheduling.

---

## 3.4 Workload requirements

The platform contains several different workload shapes:

| Workload | Behavior |
| --- | --- |
| Inference APIs | Long-running, latency-sensitive, GPU-backed |
| Web and control APIs | Long-running, stateless |
| Model validation | Batch, run-to-completion |
| Daily reports | Scheduled |
| Camera agents | Exactly one instance on relevant nodes |
| Message brokers and vendor tools | Occasionally stateful |
| Customer extensions | Dynamically installed and namespace-scoped |

---

## 3.5 Organizational requirements

- Eight engineers already operate Kubernetes.
- Asteria cannot rewrite the platform onto several AWS-specific APIs this year.
- Customers expect a supported self-hosted edition.
- Approved customer plugins must use the same extension API in cloud and on-premises editions.
- The AWS environment should still use managed AWS services when those services are superior.

---

# 4. Why Kubernetes wins here

## 4.1 It preserves the existing deployment contract

Amazon EKS runs conformant Kubernetes and supports the ordinary Kubernetes ecosystem. Standard Kubernetes applications can move to EKS without being rewritten for a proprietary orchestration API. AWS explicitly identifies existing Kubernetes estates and community tooling as strong reasons to choose EKS. citeturn509763view2turn509763view3

Replacing Kubernetes with ECS would require translating:

```text
Deployments
Services
Jobs
CronJobs
DaemonSets
StatefulSets
RBAC
NetworkPolicies
Helm charts
CRDs
operators
admission policies
```

into a mixture of:

```text
ECS services
ECS tasks
AWS Batch
EventBridge schedules
Lambda
Step Functions
IAM policies
CloudFormation
custom platform APIs
customer-specific on-premises orchestration
```

That replacement may be technically possible, but it would amount to rebuilding Asteria’s platform.

---

## 4.2 Kubernetes provides one reconciliation model

The user declares:

```text
I want three GPU-backed instances of model version 42.
```

The platform continuously tries to make reality match that declaration.

```text
Desired state
     │
     ▼
Kubernetes API
     │
     ▼
Controllers and operators
     │
     ▼
Scheduler selects nodes
     │
     ▼
Pods are created
     │
     ▼
Health is observed
     │
     └────────── reconcile again if reality differs
```

This model applies to both:

- built-in Kubernetes resources;
- Asteria’s custom resources.

Without Kubernetes, Asteria would need to build and maintain its own generalized control plane to achieve the same product-level behavior.

---

## 4.3 It supports heterogeneous workload forms

Kubernetes provides distinct workload controllers:

| Requirement | Kubernetes object |
| --- | --- |
| Long-running stateless service | `Deployment` |
| Stable identity or persistent state | `StatefulSet` |
| One node-local agent per node | `DaemonSet` |
| One-time processing | `Job` |
| Scheduled processing | `CronJob` |

Deployments declaratively manage stateless application replicas. StatefulSets retain stable identities for stateful workloads. DaemonSets place node-local Pods, while Jobs and CronJobs model finite and scheduled work. citeturn663792search16turn663792search0turn663792search8turn663792search12turn663792search4

The value is not that AWS lacks equivalent capabilities. It is that Kubernetes exposes all of them through one consistent API that also operates outside AWS.

---

## 4.4 It supports platform extensions

A Kubernetes operator can introduce domain-specific objects such as:

```text
InspectionPipeline
ModelDeployment
CameraFleet
BatchEvaluation
CustomerPlugin
```

Asteria can consequently expose a product API that does not require every application team to understand:

- EC2 instance types;
- ALB target groups;
- Auto Scaling groups;
- IAM implementation;
- GPU device plugins;
- health probes;
- rollout mechanisms;
- monitoring sidecars.

The operator becomes an internal abstraction layer.

This is one of the strongest legitimate reasons to choose Kubernetes:

> **Kubernetes is useful when the organization wants to build a platform, not merely deploy one service.**

---

# 5. Why the alternatives lose

## 5.1 Lambda, App Runner, and direct managed-service composition

These would be simpler for an AWS-only greenfield web application.

They lose here because Asteria also requires:

- GPU workers;
- node-level camera agents;
- arbitrary long-running customer extensions;
- custom controllers;
- operation during loss of AWS connectivity;
- identical product packaging on customer hardware.

This does not make serverless services inferior. It makes them mismatched to the platform contract.

---

## 5.2 Amazon ECS

ECS would be the strongest alternative.

It provides excellent AWS-native container orchestration and normally has a smaller conceptual and operational surface than Kubernetes. ECS Anywhere also supports external infrastructure.

ECS loses this particular decision because:

- the existing product is already described through Kubernetes APIs;
- its operators have no direct ECS equivalent;
- customer integrations depend on Helm and CRDs;
- customer environments already standardize on Kubernetes;
- switching would create two deployment models during the transition;
- Asteria’s team already has Kubernetes operational expertise.

### Memory rule

```text
Greenfield + AWS-only + minimize orchestration overhead
    → strongly consider ECS

Existing Kubernetes platform + Kubernetes ecosystem +
hybrid deployment contract
    → strongly consider EKS
```

---

## 5.3 SageMaker

SageMaker could be preferable for:

- managed model training;
- managed model endpoints;
- experiment tracking;
- model lifecycle management;
- AWS-only inference.

Asteria may still use SageMaker for central training.

It does not replace the complete platform because the platform also contains:

- device agents;
- customer plugins;
- non-ML APIs;
- workflow controllers;
- local factory execution;
- third-party Kubernetes applications.

The correct architecture is not necessarily:

```text
Kubernetes instead of SageMaker
```

It can be:

```text
SageMaker where managed ML wins
+
EKS where the portable application platform wins
```

---

## 5.4 AWS Batch

AWS Batch is highly suitable for AWS-hosted run-to-completion workloads.

It does not satisfy the complete system because Asteria also requires:

- long-running services;
- on-premises operation;
- node-local daemons;
- custom product APIs;
- customer extension deployment;
- unified lifecycle management.

Asteria could nevertheless send very large AWS-only reprocessing jobs to AWS Batch instead of forcing every computation into Kubernetes.

---

## 5.5 Self-managed Kubernetes on EC2

This preserves Kubernetes but makes Asteria responsible for the Kubernetes control plane.

Amazon EKS already provides a managed, highly available Kubernetes control plane. Managing the control plane directly would add responsibility without satisfying an unmet requirement. citeturn509763view1turn553422search8

---

# 6. Kubernetes vocabulary for this project

## 6.1 Cluster

A Kubernetes cluster contains:

```text
Control plane
    API server
    scheduler
    controllers
    cluster state

Worker nodes
    container runtime
    kubelet
    networking components
    workload Pods
```

With standard Amazon EKS, AWS manages the Kubernetes control plane. Asteria manages its workloads and, depending on the compute mode, some or all aspects of its worker capacity.

---

## 6.2 Pod

A Pod is the smallest ordinary scheduling unit.

A Pod may contain:

```text
application container
+
optional sidecar containers
+
shared network namespace
+
shared volumes
```

A Pod is not a durable machine. It can be:

- replaced;
- moved;
- recreated with a new IP address;
- terminated during scaling;
- lost with its node.

Controllers, rather than individual Pods, should normally express the desired application state.

---

## 6.3 Deployment

A Deployment describes a replicated, usually stateless application.

```text
Deployment
    desired replicas = 4
         │
         ▼
ReplicaSet
         │
         ├── Pod
         ├── Pod
         ├── Pod
         └── Pod
```

If one Pod disappears, the controller creates another.

---

## 6.4 Service

Pod addresses are not stable application endpoints.

A Kubernetes Service creates a stable logical destination for a group of Pods selected by labels.

```text
inference-api Service
       │
       ├── inference Pod A
       ├── inference Pod B
       └── inference Pod C
```

A Service exposes an application behind one stable endpoint even as its backing Pods change. citeturn753922search15

---

## 6.5 Ingress

Ingress describes HTTP or HTTPS routing into services:

```text
api.asteria.example/models/*
    → model-api Service

api.asteria.example/factories/*
    → factory-api Service
```

Ingress is declarative configuration. An **Ingress controller** must translate it into real networking infrastructure. In EKS, the AWS Load Balancer Controller can provision an ALB from an Ingress resource. citeturn753922search7turn509763view8

---

## 6.6 Namespace

A namespace creates a logical scope inside a cluster.

Asteria uses namespaces such as:

```text
platform-system
observability
factory-north
factory-south
customer-extensions
```

Namespaces help scope:

- object names;
- RBAC;
- resource quotas;
- network policies;
- service accounts.

A namespace is **not by itself a hard security boundary**. Strong tenant isolation may require multiple clusters, accounts, dedicated nodes, sandboxing, or other controls.

---

## 6.7 Service account

A Kubernetes service account identifies a workload to the Kubernetes API.

It is conceptually separate from an AWS IAM role:

```text
Kubernetes service account
    → identity inside Kubernetes

IAM role
    → authority to call AWS APIs
```

EKS can associate the two using EKS Pod Identity, but they remain distinct authorization systems.

---

## 6.8 Custom resource and operator

A **custom resource definition**, or CRD, extends the Kubernetes API with a new object type.

An **operator** is a controller that observes these resources and reconciles actual state toward desired state.

```text
InspectionPipeline resource
             │
             ▼
Inspection operator
             │
             ├── creates Deployment
             ├── creates Service
             ├── creates HPA
             ├── creates NetworkPolicy
             └── reports status
```

This is the architectural capability that makes Kubernetes particularly valuable to Asteria.

---

# 7. Baseline architecture

```text
                             Asteria organization
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Corporate identity provider                                       │
│             │                                                       │
│             ▼                                                       │
│      IAM Identity Center                                            │
│             │                                                       │
│       AWS IAM roles                                                 │
│             │                                                       │
│             ▼                                                       │
│       EKS access entries ─────────► Kubernetes RBAC                  │
│                                                                     │
│                         AWS Region                                  │
│                                                                     │
│  Route 53                                                           │
│      │                                                              │
│  AWS WAF                                                            │
│      │                                                              │
│  Application Load Balancer                                          │
│      │                                                              │
│      ▼                                                              │
│  Kubernetes Ingress                                                 │
│      │                                                              │
│  ┌──────────────────── Amazon EKS ───────────────────────────────┐  │
│  │                                                               │  │
│  │  AWS-managed Kubernetes control plane                         │  │
│  │                                                               │  │
│  │  Private node subnets across three AZs                        │  │
│  │                                                               │  │
│  │  System node group       General node groups      GPU nodes   │  │
│  │  ┌──────────────┐        ┌──────────────────┐     ┌─────────┐ │  │
│  │  │ CoreDNS      │        │ APIs             │     │Inference│ │  │
│  │  │ controllers  │        │ operators        │     │Batch    │ │  │
│  │  │ observability│        │ customer tools   │     │Models   │ │  │
│  │  └──────────────┘        └──────────────────┘     └─────────┘ │  │
│  │                                                               │  │
│  │  VPC CNI: Pods receive VPC addresses                          │  │
│  │  NetworkPolicies: east-west restrictions                      │  │
│  │  Pod Identity: workload-specific AWS roles                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│      │              │             │              │                 │
│      ▼              ▼             ▼              ▼                 │
│     ECR             S3          Aurora          SQS/EventBridge     │
│  container       models and     metadata        integration        │
│   images          artifacts                                          │
│                                                                     │
│  CloudWatch / Managed Prometheus / CloudTrail                       │
└─────────────────────────────────────────────────────────────────────┘


                 Customer factory — independent operation
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                       EKS Anywhere cluster                          │
│                                                                     │
│  Local Kubernetes control plane                                    │
│                                                                     │
│  CPU nodes                   GPU nodes             Camera nodes     │
│      │                           │                      │            │
│  platform APIs            inference Pods        DaemonSet agents   │
│                                                                     │
│  Local registry                                                    │
│  Local model cache                                                  │
│  Local storage                                                      │
│  Local ingress                                                      │
│                                                                     │
│  Same CRDs, operators, images and deployment conventions            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                 │
                 │ VPN / Direct Connect / customer WAN
                 ▼
            AWS when connectivity is available
```

The uploaded material describes Amazon EKS in AWS and EKS Anywhere as distinct deployment options: EKS in AWS uses AWS-managed Kubernetes capabilities, while EKS Anywhere runs a Kubernetes cluster on customer-controlled infrastructure. fileciteturn6file0

---

# 8. AWS-hosted EKS cluster design

## 8.1 VPC placement

Asteria creates subnets across three Availability Zones.

```text
Public edge subnets
    ALB
    NAT Gateways, if required

Private node subnets
    EKS worker nodes
    workload Pods

Private data subnets
    Aurora
    ElastiCache, if used
    other private data services
```

The EKS Kubernetes API server uses a private endpoint. Engineers and CI systems must reach it from:

- the VPC;
- a connected corporate network;
- an authorized private automation environment.

Amazon EKS supports private-only Kubernetes API endpoints. With public access disabled, `kubectl` and other API clients must originate from the VPC or a connected network, and endpoint reachability remains separate from IAM and Kubernetes authorization. citeturn346835search0

---

## 8.2 Node groups

Asteria does not place every workload on one undifferentiated pool.

### System node group

```text
Capacity:
    On-Demand

Workloads:
    DNS
    platform controllers
    ingress controller
    monitoring agents
    essential cluster add-ons

Placement:
    multiple AZs
```

These components must remain available even if interruptible application capacity disappears.

### General application node group

```text
Capacity:
    On-Demand baseline
    optional Spot expansion

Workloads:
    APIs
    control services
    operators
    customer extensions
```

### Batch node group

```text
Capacity:
    primarily Spot

Workloads:
    retryable image processing
    model evaluation
    non-urgent reprocessing
```

### GPU node group

```text
Capacity:
    GPU EC2 types
    scaled according to pending GPU workloads

Workloads:
    real-time model inference
    GPU batch jobs
```

Kubernetes can advertise GPU resources to the scheduler and let Pods request them explicitly. EKS supports GPU-backed EC2 nodes and Kubernetes device management, whereas EKS Fargate does not currently provide GPUs. citeturn553422search5turn553422search9turn553422search0

---

## 8.3 Why not use Fargate for the whole cluster?

EKS on Fargate reduces node-management work and is useful for compatible stateless Pods.

It is not the baseline here because Asteria requires:

- GPUs;
- DaemonSets;
- privileged or node-integrated agents;
- some EBS-backed persistent volumes;
- fine-grained control over specialized instance types.

EKS Fargate does not support DaemonSets, privileged containers, GPUs, or EBS volumes mounted to Fargate Pods. citeturn553422search0turn553422search2

Fargate could still host selected stateless services that do not require those capabilities.

---

## 8.4 Current implementation note: EKS Auto Mode

A contemporary AWS implementation could use EKS Auto Mode for substantial parts of the AWS cluster. Auto Mode can manage compute provisioning, scaling, networking, storage integration, and node lifecycle. It builds node scaling on Karpenter principles. citeturn825639search10turn825639search18turn825639search36

For exam-level understanding, retain the more general model:

```text
EKS manages the Kubernetes control plane.

Compute can run on:
    managed EC2 nodes
    self-managed EC2 nodes
    Fargate
    specialized hybrid or on-premises options
```

---

# 9. Workload mapping

| Platform component | Kubernetes representation | Reason |
| --- | --- | --- |
| Public API | Deployment + Service + Ingress | Replicated stateless HTTP workload |
| Model inference | Deployment | Long-running replicated service |
| Image reprocessing | Job | Runs to completion |
| Daily evaluation | CronJob | Scheduled Job creation |
| Camera collector | DaemonSet | One agent on each camera-connected node |
| Kafka-like vendor component | StatefulSet, only if retained in cluster | Stable identity and storage |
| Inspection pipeline | Custom resource | Product-level API |
| Inspection controller | Deployment + service account | Reconciles custom resources |
| Configuration | ConfigMap | Non-secret environment configuration |
| AWS-backed secret | Secrets Manager integration | External secret lifecycle |
| Customer environment | Namespace or separate cluster | Organizational isolation |

---

# 10. Keep durable business state outside Kubernetes

Kubernetes can run stateful applications, but that does not mean it should replace every managed data service.

Asteria places authoritative cloud state in:

```text
Aurora
    relational metadata

S3
    model artifacts
    approved sample images
    reports

SQS or EventBridge
    asynchronous integration

ECR
    immutable container images
```

The EKS cluster should remain replaceable.

```text
Cluster deleted
    ↓
Applications can be redeployed from declarations
    ↓
Business data remains in managed durable services
```

This is a stronger architecture than treating Kubernetes as an excuse to self-host:

```text
PostgreSQL
Kafka
object storage
secret management
backup control
monitoring database
```

inside the cluster.

---

# 11. Kubernetes storage

## 11.1 PersistentVolume abstraction

Applications request storage through a PersistentVolumeClaim:

```text
Application
    ↓ requests
PersistentVolumeClaim
    ↓ references
StorageClass
    ↓ provisions
environment-specific storage
```

The application may use the same claim interface across environments while the underlying storage differs.

### AWS cluster

```text
single-writer block storage → EBS CSI
shared filesystem          → EFS CSI
large immutable objects    → S3 API
```

The EBS CSI driver manages EBS-backed Kubernetes volumes. The EFS CSI driver makes EFS available as shared persistent storage. citeturn663792search6turn663792search2

### Factory cluster

```text
single-writer storage → customer SAN or local CSI implementation
shared filesystem     → local NFS or enterprise file platform
objects               → local object store
```

---

## 11.2 Portability limitation

The same `PersistentVolumeClaim` API does **not** mean the underlying storage has identical semantics.

Differences may include:

- latency;
- throughput;
- failure behavior;
- snapshot support;
- replication;
- access modes;
- backup mechanisms;
- volume expansion;
- topology restrictions.

Kubernetes provides a common interface, not magically equivalent infrastructure.

---

# 12. IAM architecture

EKS introduces several authorization systems that must not be conflated.

```text
1. AWS IAM
2. EKS cluster-access mapping
3. Kubernetes RBAC
4. Pod-to-AWS IAM
5. Application-level authorization
```

---

## 12.1 Workforce identity

Engineers authenticate through the corporate identity provider and IAM Identity Center.

They receive temporary AWS role sessions such as:

```text
PlatformAdministrator
ApplicationDeveloper
DataScientist
SecurityAuditor
ReadOnlyOperator
```

These IAM roles determine what the user may do through AWS APIs.

---

## 12.2 Access to the Kubernetes API

An IAM role does not automatically gain permission to manipulate Kubernetes objects.

Asteria creates an EKS access entry:

```text
IAM role:
    DataScientist

EKS access entry:
    associates IAM role with Kubernetes permissions

Scope:
    model-development namespace
```

Current EKS guidance recommends access entries for connecting IAM principals to Kubernetes API permissions. Permissions can be supplied through EKS access policies or by mapping the principal to Kubernetes groups governed by RBAC. citeturn509763view5turn825639search11

### Authentication and authorization sequence

```text
Corporate identity provider
        ↓
IAM Identity Center
        ↓
DataScientist IAM role session
        ↓
private network path to EKS API endpoint
        ↓
AWS authenticates IAM principal
        ↓
EKS access entry
        ↓
Kubernetes authorization
        ↓
allowed or forbidden operation
```

---

## 12.3 Kubernetes RBAC

Asteria may grant a data scientist:

```text
create
get
list
watch
update
```

for:

```text
InspectionPipeline
ModelDeployment
Job
Pod logs
```

inside:

```text
model-development namespace
```

The same user is denied:

```text
modify cluster-wide RBAC
read unrelated secrets
create privileged Pods
modify nodes
change admission policies
delete production namespaces
```

Kubernetes RBAC regulates actions on Kubernetes resources. It is independent from IAM permissions to call S3, EC2, or other AWS services. citeturn753922search11turn753922search35

---

## 12.4 Pod Identity

Application Pods need different AWS permissions.

For example:

```text
model-loader Pod
    needs:
        s3:GetObject on model prefix
        kms:Decrypt for model key

metrics-exporter Pod
    needs:
        cloudwatch:PutMetricData

inspection-operator Pod
    may need:
        sqs:SendMessage

ordinary frontend Pod
    needs:
        none of the above
```

Asteria creates separate Kubernetes service accounts:

```text
model-loader
metrics-exporter
inspection-operator
frontend
```

Each service account can be associated with a specific IAM role using EKS Pod Identity. AWS SDKs in the Pod then receive temporary workload credentials rather than using static keys or the broad EC2 node role. citeturn509763view4turn553422search10

### Example

```text
Namespace:
    factory-control

Service account:
    model-loader

Pod Identity association:
    ModelReaderRole

IAM permissions:
    s3:GetObject
        arn:aws:s3:::asteria-models/production/*

    kms:Decrypt
        specific model-artifact key
```

---

## 12.5 Node role versus Pod role

### Node IAM role

Used for node-level responsibilities such as:

- joining the cluster;
- interacting with required EKS infrastructure;
- pulling images where configured;
- operating node-level components.

### Pod IAM role

Used by one application workload to call AWS APIs.

### Wrong design

```text
All application permissions
    attached to
EC2 node role
```

Every Pod that can reach the instance metadata credentials may then inherit an unnecessarily large blast radius.

### Better design

```text
Minimal node role
+
workload-specific Pod Identity roles
+
restricted instance metadata access
```

AWS explicitly recommends workload-level credential isolation rather than distributing credentials or depending on a broad node instance role. citeturn553422search10turn113234search9

---

## 12.6 Controller permissions exist in two worlds

Consider the AWS Load Balancer Controller.

It needs Kubernetes permission to:

```text
watch Ingress objects
watch Services
watch endpoint information
update resource status
```

It also needs IAM permission to:

```text
create and modify ALBs
create target groups
register targets
read subnets and security groups
manage relevant AWS networking resources
```

Therefore:

\[
\text{Controller success}
=

\text{Kubernetes RBAC}
\land
\text{AWS IAM}
\land
\text{network reachability}
\]

An IAM policy alone does not let it watch an Ingress.

Kubernetes RBAC alone does not let it create an ALB.

---

## 12.7 `iam:PassRole` appears again

The administrator who creates a Pod Identity association must be allowed to associate the relevant IAM role. This involves controlled role-passing authority.

The mental model remains:

```text
AssumeRole:
    the caller becomes a role session

PassRole:
    the caller authorizes an AWS service or integration
    to use a specified role
```

---

# 13. Networking architecture

## 13.1 Control-plane endpoint

Asteria disables public Kubernetes API access.

```text
Engineer laptop
    ↓
corporate network
    ↓ VPN or Direct Connect
EKS VPC
    ↓
private EKS API endpoint:443
```

Two separate conditions must hold:

```text
Network:
    the engineer can reach the private endpoint

Authorization:
    the IAM principal maps to appropriate Kubernetes permissions
```

### Failure interpretation

```text
Timeout
    → DNS, route, VPN, SG, endpoint path

Unauthorized
    → AWS authentication or token problem

Forbidden
    → authenticated, but Kubernetes authorization denied
```

---

## 13.2 Pod networking with the VPC CNI

On AWS-hosted EC2 nodes, the Amazon VPC CNI assigns VPC addresses to Pods. It creates and manages ENIs on nodes and allocates private IPv4 or IPv6 addresses to individual Pods. citeturn509763view6turn346835search4

This means a Pod is not hidden exclusively behind an unrelated overlay address.

```text
VPC: 10.20.0.0/16

Node:
    10.20.10.40

Pods:
    10.20.10.101
    10.20.10.102
    10.20.10.103
```

The practical consequences are important:

- Pod traffic participates in VPC routing.
- VPC Flow Logs can observe relevant flows.
- ALBs can register Pod IP addresses directly.
- subnet IP capacity limits cluster growth;
- security groups and routing remain important;
- Pods are still ephemeral even though their addresses are VPC addresses.

---

## 13.3 IP-address capacity becomes compute capacity

A node may have spare CPU and memory but be unable to run another Pod because no Pod IP can be allocated.

```text
CPU available
Memory available
Subnet IPs exhausted
    ↓
Pod remains Pending
```

For large clusters, Asteria must plan:

- sufficiently large subnets;
- secondary VPC CIDR blocks;
- VPC CNI prefix mode;
- custom Pod subnets;
- potentially IPv6.

AWS specifically identifies IPv4 exhaustion and ENI/IP limits as common EKS scaling constraints. citeturn113234search10

---

## 13.4 External HTTP request

```text
1. Client resolves api.asteria.example through Route 53.

2. Traffic reaches AWS WAF and an internet-facing ALB.

3. The AWS Load Balancer Controller created the ALB
   from a Kubernetes Ingress declaration.

4. The ALB evaluates host and path rules.

5. The ALB selects the relevant Kubernetes Service.

6. In IP-target mode, the ALB sends traffic directly
   to a healthy Pod address.

7. The Pod's readiness state determines whether it
   remains a valid backend.

8. The application performs its own authentication
   and authorization.
```

The AWS Load Balancer Controller can provision ALBs for Kubernetes Ingress resources. ALBs provide Layer 7 routing, while a Kubernetes Service of type `LoadBalancer` can be used for Layer 4 NLB exposure. citeturn509763view8turn753922search2

---

## 13.5 Internal service-to-service flow

```text
frontend Pod
    ↓ DNS query
CoreDNS
    ↓
model-api.factory-control.svc.cluster.local
    ↓
ClusterIP Service
    ↓ selects
model-api Pods
```

The Service gives consumers a stable destination even though individual Pods are replaced.

---

## 13.6 Security group versus NetworkPolicy

### Security group

AWS/VPC-level network control.

Useful for relationships such as:

```text
ALB → ingress Pods
application Pods → Aurora
Pods → interface endpoints
nodes → EKS control plane
```

### Kubernetes NetworkPolicy

Pod-level Layer 3/4 communication policy.

Useful for:

```text
frontend namespace → API namespace
operator → Kubernetes webhook
model-loader → approved egress
deny customer namespace → platform-system
```

Kubernetes allows Pod-to-Pod communication by default unless network-policy enforcement and applicable policies are configured. AWS recommends default-deny policies for sensitive multi-tenant environments and then adding explicit permitted flows. citeturn113234search1turn113234search4

### Important distinction

```text
Security group:
    AWS network identity and VPC relationships

NetworkPolicy:
    Kubernetes labels, namespaces, Pods, ports
```

They complement each other.

---

## 13.7 Pod to S3

```text
model-loader Pod
    │
    │ DNS resolves S3 endpoint
    ▼
S3 gateway endpoint route
    │
    ▼
S3
    │
    │ signed request using Pod Identity credentials
    ▼
IAM + bucket policy + endpoint policy + KMS policy
    │
    ▼
model artifact
```

Network reachability is supplied by the endpoint path.

AWS authorization is supplied by the Pod’s IAM role and relevant resource policies.

---

## 13.8 Pod to Aurora

```text
metadata-api Pod
    ↓
Aurora DNS endpoint
    ↓
VPC route
    ↓
security group permits PostgreSQL
    ↓
database listener
    ↓
database credentials
    ↓
SQL authorization
```

Autoscaling Pods can cause database connection storms. Asteria must size connection pools and may introduce RDS Proxy or another appropriate pooling mechanism.

Kubernetes scaling does not automatically scale the database’s safe connection capacity.

---

## 13.9 Private cluster endpoints

A cluster without general Internet egress may use VPC endpoints for services such as:

```text
ECR API
ECR image registry
S3
CloudWatch
Secrets Manager
STS
Systems Manager
```

Deleting NAT without verifying all dependencies can break:

- image pulls;
- telemetry;
- secret retrieval;
- package downloads;
- third-party APIs;
- controller access to AWS APIs.

---

# 14. Autoscaling occurs at multiple layers

Kubernetes introduces at least two separate scaling problems.

## 14.1 Pod scaling

The Horizontal Pod Autoscaler changes the number of Pods.

```text
Request rate increases
    ↓
HPA changes replicas from 4 to 12
```

It can react to:

- CPU;
- memory;
- custom metrics;
- external metrics.

---

## 14.2 Node scaling

Twelve desired Pods do not help when existing nodes cannot host them.

```text
HPA requests more Pods
    ↓
Pods remain Pending
    ↓
node autoscaler detects unschedulable Pods
    ↓
additional EC2 capacity is created
    ↓
Pods are scheduled
```

EKS Auto Mode, Karpenter, or Cluster Autoscaler can address the node-capacity layer. EKS Auto Mode automatically creates compute when Pods cannot fit and can later consolidate unnecessary nodes. citeturn825639search18

---

## 14.3 Resource requests and limits

The scheduler places Pods based largely on resource **requests**, not observed future consumption.

```yaml
resources:
  requests:
    cpu: "2"
    memory: "4Gi"
  limits:
    cpu: "4"
    memory: "8Gi"
```

Requests that are too high cause:

- poor bin packing;
- unnecessary nodes;
- higher cost;
- unschedulable Pods.

Requests that are too low cause:

- node contention;
- evictions;
- latency instability;
- memory exhaustion.

Kubernetes schedules Pods by comparing requested resources with node capacity. citeturn663792search1

---

## 14.4 GPU scheduling

A GPU inference Pod explicitly requests an accelerator.

Conceptually:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

Asteria uses:

- node labels;
- node selectors or affinity;
- taints and tolerations;
- GPU resource requests.

This prevents ordinary CPU services from occupying expensive GPU nodes and prevents GPU workloads from landing on incompatible nodes.

---

# 15. Hybrid deployment choice

## 15.1 Why EKS Anywhere is the baseline at factories

A factory must keep operating during loss of AWS connectivity.

Therefore, it needs a local:

- Kubernetes API server;
- scheduler;
- controller manager;
- cluster state;
- image source;
- model source;
- service network.

EKS Anywhere runs the Kubernetes cluster on customer infrastructure, including its control plane. This is different from using AWS-hosted EKS nodes outside the Region. citeturn509763view9turn509763view3

```text
WAN unavailable
    ↓
factory EKS Anywhere control plane remains local
    ↓
local operators continue reconciling
    ↓
Pods continue running and being replaced
    ↓
factory continues inspection
```

---

## 15.2 Current alternative: EKS Hybrid Nodes

EKS Hybrid Nodes permit customer-managed on-premises or edge machines to join an EKS cluster whose Kubernetes control plane remains managed in AWS.

```text
AWS Region:
    EKS control plane

Customer site:
    hybrid worker nodes
```

This can unify management and reduce local control-plane operations, but it requires reliable connectivity between the site and AWS. citeturn753922search1turn753922search9

### Decision rule

```text
Reliable private connectivity
+
central AWS-managed control plane desired
    → consider EKS Hybrid Nodes

Site must continue independently through WAN loss
+
local control plane required
    → EKS Anywhere
```

---

## 15.3 EKS on Outposts

EKS on AWS Outposts becomes relevant when:

- AWS-managed infrastructure must physically run on-premises;
- local latency or residency is required;
- the customer accepts an Outposts deployment.

The uploaded guide includes EKS on Outposts as a separate on-premises deployment option using AWS Outposts infrastructure. fileciteturn6file0

---

## 15.4 Portability is incomplete

The same application package can reuse:

```text
Deployments
Services
Jobs
CronJobs
CRDs
operators
RBAC
ConfigMaps
most application manifests
```

But environment-specific components still differ:

| Concern | AWS EKS | EKS Anywhere |
| --- | --- | --- |
| Pod networking | VPC CNI | On-premises CNI |
| Ingress | ALB/NLB controller | Customer load balancer or ingress |
| Block storage | EBS CSI | Customer storage CSI |
| Shared file storage | EFS CSI | Customer NFS/file platform |
| Workload AWS identity | Pod Identity | Separate local/federated mechanism |
| Container images | ECR | Local or mirrored registry |
| DNS integration | Route 53/CoreDNS | Local DNS/CoreDNS |
| Hardware | EC2 | Customer servers |

Kubernetes standardizes the application control contract. It does not eliminate infrastructure-specific engineering.

---

# 16. Deployment architecture

## 16.1 Artifact pipeline

```text
Source commit
    ↓
CodeBuild or CI system
    ↓
unit and integration tests
    ↓
container image
    ↓
security scan and signing
    ↓
ECR
    ↓
versioned Helm chart and manifests
    ↓
promotion to environment
```

Deployments reference immutable image digests rather than mutable tags such as `latest`.

---

## 16.2 Cloud deployment

A deployment automation role:

1. authenticates to AWS;
2. reaches the private EKS endpoint;
3. is mapped through an EKS access entry;
4. receives namespace-scoped Kubernetes permissions;
5. applies the release definitions.

The automation needs both:

```text
AWS permissions
+
Kubernetes permissions
```

---

## 16.3 Factory deployment

Before release, Asteria packages:

- container images;
- model artifacts;
- Helm charts;
- CRDs;
- operators;
- migration instructions;
- required configuration.

These artifacts are mirrored to a local repository so the factory can:

- restart workloads;
- replace nodes;
- perform rollback;
- continue operation during disconnection.

---

## 16.4 Declarative rollout

For ordinary services:

```text
Deployment version 41
    ↓ rolling update
Deployment version 42
```

Kubernetes creates new Pods and gradually removes old ones according to rollout configuration and health.

Asteria can add:

- canary controllers;
- service-mesh traffic shifting;
- ALB-based routing;
- automated metric evaluation.

These add capabilities but also increase the platform’s operational surface. Kubernetes does not provide a complete production canary system merely because a Deployment supports rolling updates.

---

# 17. Availability model

## 17.1 Pod failure

```text
Pod process fails
    ↓
liveness or process failure detected
    ↓
container or Pod replaced
    ↓
Service sends traffic only to ready Pods
```

---

## 17.2 Node failure

```text
EC2 node fails
    ↓
Pods on node become unavailable
    ↓
controllers request replacement Pods
    ↓
scheduler places Pods on surviving capacity
    ↓
node autoscaler restores node capacity
```

This succeeds only if:

- remaining nodes have capacity;
- another AZ has capacity;
- Pod placement constraints permit rescheduling;
- required storage can attach;
- disruption budgets do not create deadlock;
- images and dependencies are reachable.

---

## 17.3 Availability Zone failure

Asteria spreads replicas across zones using:

- multiple node groups and subnets;
- topology-spread constraints;
- anti-affinity where justified;
- multiple application replicas;
- zonally resilient managed data services.

A Deployment with three replicas does not guarantee three-AZ placement unless scheduling constraints and capacity support it.

---

## 17.4 PodDisruptionBudget

A disruption budget can require that a minimum number of replicas remain available during voluntary disruptions such as node maintenance.

It cannot create unavailable capacity.

```text
PDB says:
    at least 2 replicas must remain

Only one healthy node exists
    ↓
maintenance may block
```

A PDB is a constraint on disruption, not replacement infrastructure.

---

## 17.5 Control-plane failure

In AWS, EKS manages the Kubernetes control plane and its availability.

Asteria remains responsible for:

- workload design;
- add-ons;
- node capacity;
- policies;
- upgrades of application APIs;
- compatible controllers;
- application observability.

Managed EKS removes an important class of work, but it does not turn Kubernetes into a fully managed application platform.

---

## 17.6 Regional failure

One EKS cluster in one Region does not survive a full Regional outage.

Asteria would need:

- a second cluster in another Region;
- replicated data services;
- image and artifact replication;
- traffic failover;
- duplicate IAM and access configuration;
- tested recovery procedures.

Kubernetes federation or multi-cluster tools do not remove the data-consistency and network-routing problems.

---

# 18. Tenant isolation

## 18.1 Namespace-based tenancy

For trusted internal teams, Asteria may use one namespace per factory or application environment.

Each namespace receives:

```text
RBAC
ResourceQuota
LimitRange
NetworkPolicy
Pod Security controls
service accounts
Pod Identity associations
```

Resource quotas can prevent one namespace from consuming unlimited CPU, memory, object counts, or other resources. citeturn113234search0

---

## 18.2 Default-deny network posture

For a customer namespace:

```text
Default:
    deny ingress
    deny egress

Explicitly allow:
    DNS
    approved internal APIs
    required AWS endpoints
    permitted database destination
    approved external destination
```

Network policy enforcement must be enabled and supported by the CNI implementation. Declaring a NetworkPolicy where no component enforces it provides false confidence. citeturn753922search3turn753922search32

---

## 18.3 Namespace is not enough for hostile code

If customers can run arbitrary untrusted containers, Asteria should not assume that namespaces alone provide a sufficiently strong boundary.

Potential stronger designs include:

```text
separate cluster per customer
separate AWS account
dedicated node groups
strong sandbox runtime
restricted admission policies
no privileged Pods
no host networking
no host-path volumes
tight egress controls
```

AWS EKS guidance treats RBAC, network policies, quotas, and compute separation as complementary tenant-isolation mechanisms rather than assuming one namespace control is sufficient. citeturn113234search1

---

# 19. Observability

## 19.1 Four observability planes

### AWS infrastructure

```text
EC2
ALB
EBS
Aurora
NAT
VPC endpoints
```

Observed through CloudWatch and AWS service metrics.

### Kubernetes control plane

```text
API server
scheduler
controller activity
audit events
```

EKS can send control-plane logs to CloudWatch.

### Kubernetes workload state

```text
Pod health
Deployment availability
Pending Pods
node pressure
restart counts
resource requests
HPA state
```

Prometheus-style metrics and Kubernetes state collectors are useful here.

### Application behavior

```text
inference latency
frame backlog
model error rate
camera availability
defect-detection rate
business failures
```

These require application instrumentation.

---

## 19.2 CloudTrail versus Kubernetes audit log

### CloudTrail

Answers:

```text
Who modified the EKS cluster configuration?
Who changed an IAM role?
Who created a node group?
Who modified an ALB?
```

### Kubernetes audit log

Answers:

```text
Who created this Deployment?
Who read this Secret?
Who changed this RoleBinding?
Who deleted this namespace?
```

Both are required because EKS spans both AWS APIs and Kubernetes APIs.

---

## 19.3 Important alarms

```text
No ready replicas for critical Deployment
Too many Pending Pods
Node group at maximum capacity
Subnet IP space nearly exhausted
GPU Pods waiting excessively
High Pod restart rate
ALB has no healthy targets
Aurora connection count near safe limit
Factory synchronization delayed
Operator reconciliation repeatedly failing
```

---

# 20. Cost model

## 20.1 Direct infrastructure costs

The AWS deployment pays for:

- EKS cluster control plane;
- EC2 worker nodes;
- GPU instances;
- load balancers;
- NAT gateways;
- EBS and EFS;
- Aurora;
- S3 and ECR;
- observability;
- inter-AZ and Internet transfer;
- backup and artifact replication.

---

## 20.2 Kubernetes fragmentation

Suppose three Pods request:

```text
Pod A: 5 CPU
Pod B: 5 CPU
Pod C: 5 CPU
```

and the available node type has:

```text
8 CPU
```

Each Pod may require a separate node:

```text
Node 1: 5 used, 3 stranded
Node 2: 5 used, 3 stranded
Node 3: 5 used, 3 stranded
```

The nominal workload uses 15 CPU, but 24 CPU is provisioned.

Kubernetes can improve bin packing, but inaccurate requests and incompatible constraints can also create costly fragmentation.

---

## 20.3 GPU cost

GPU nodes are particularly dangerous to leave idle.

Asteria uses:

- separate GPU node pools;
- scale-to-zero where latency permits;
- utilization-aware scaling;
- Spot only for interruptible workloads;
- quotas preventing accidental GPU requests;
- node taints so ordinary workloads do not occupy GPU nodes.

---

## 20.4 Operational cost

Kubernetes adds human and cognitive cost:

```text
version upgrades
CRD compatibility
controller upgrades
CNI behavior
CSI drivers
admission policies
RBAC
Pod security
cluster add-ons
autoscaler interactions
resource tuning
network policy
multi-cluster release management
```

The business justification is not:

> “Kubernetes compute is always cheaper.”

It is:

> “One Kubernetes platform avoids multiple platform rewrites, preserves existing operational assets, supports customer deployments, and provides a domain-specific extension model.”

---

# 21. What Kubernetes does not solve

Kubernetes does not automatically solve:

- AWS IAM;
- network routing;
- secure tenant isolation;
- database consistency;
- backups;
- disaster recovery;
- application authentication;
- secret rotation;
- good autoscaling metrics;
- IP exhaustion;
- image supply-chain security;
- cost allocation;
- dependency availability;
- multi-Region data replication.

It coordinates workloads. It does not repeal the rest of distributed-systems architecture.

---

# 22. Failure drills

## Failure A: `kubectl` times out

Investigate:

```text
DNS resolution for the EKS endpoint
private endpoint routing
VPN or Direct Connect
cluster security group
source network
port 443
```

This is likely a reachability problem before Kubernetes authorization is evaluated.

---

## Failure B: `kubectl` returns `Unauthorized`

Investigate:

```text
AWS credentials
expired role session
kubeconfig
authentication token
wrong cluster or Region
```

---

## Failure C: `kubectl` returns `Forbidden`

The caller is authenticated.

Investigate:

```text
EKS access entry
EKS access policy
Kubernetes Role
RoleBinding
ClusterRole
ClusterRoleBinding
namespace scope
requested Kubernetes verb
```

---

## Failure D: Pod receives `AccessDenied` from S3

Investigate:

```text
Pod service account
Pod Identity association
IAM role policy
bucket policy
endpoint policy
KMS key policy
object ARN
explicit deny
```

Do not expand the EC2 node role as the first response.

---

## Failure E: Pod cannot connect to S3

Investigate:

```text
DNS
gateway endpoint route
NAT path if no endpoint
NetworkPolicy egress
security controls
proxy configuration
```

IAM policy does not create a network path.

---

## Failure F: Pod remains `Pending`

Possible causes:

```text
insufficient CPU
insufficient memory
no GPU
node selector has no matching node
taint without toleration
PersistentVolume topology conflict
quota exceeded
no Pod IP available
node autoscaler maximum reached
unsupported Fargate requirement
```

“Pending” is a scheduling state, not an application crash.

---

## Failure G: HPA creates 30 Pods, but 24 remain Pending

Pod scaling worked.

Node capacity scaling did not yet supply sufficient compatible capacity.

Investigate:

```text
node autoscaler
EC2 quotas
subnet IPs
instance availability
node-pool constraints
GPU capacity
maximum node count
```

---

## Failure H: ALB returns 503

Investigate:

```text
Ingress
AWS Load Balancer Controller
Service selector
target registration
readiness probes
healthy Pod count
security groups
ALB target mode
```

---

## Failure I: Pods communicate despite a deny policy

Possible explanations:

```text
network-policy enforcement not enabled
CNI does not enforce the policy
policy selects the wrong labels
namespace selector is wrong
traffic path bypasses expected policy
```

Creating a YAML object is not proof that packets are being filtered.

---

## Failure J: Factory stops when WAN fails

The factory was probably using:

- EKS Hybrid Nodes;
- an AWS-hosted control plane;
- remote ECR only;
- remote model storage only;
- an AWS database;
- another undeclared central dependency.

The requirement called for an independently operable local cluster, making EKS Anywhere the more appropriate baseline.

---

## Failure K: Operator resource exists, but nothing happens

Investigate:

```text
operator Deployment health
CRD version
RBAC
leader election
watch namespace
admission webhook
controller logs
reconciliation errors
```

A CRD defines an API type. It does not implement the controller behavior.

---

## Failure L: Autoscaling causes Aurora failure

Possible sequence:

```text
traffic rises
    ↓
HPA rapidly creates Pods
    ↓
every Pod opens a large database pool
    ↓
database connections are exhausted
    ↓
latency and failures increase
```

The solution may involve:

- smaller pools;
- shared pooling or RDS Proxy;
- slower scale-up;
- database scaling;
- queue-based load regulation;
- connection-aware metrics.

---

# 23. Changed-requirement variants

## Variant 1: AWS-only, greenfield, five services

There are no existing Kubernetes assets, no customer-hosted edition, and the team is small.

**Reconsider EKS.**

ECS/Fargate, App Runner, Lambda, and managed AWS services will probably produce a simpler architecture.

---

## Variant 2: Factories have highly reliable private connectivity

The factory can tolerate an AWS-hosted control plane, and Direct Connect with backup connectivity meets the reliability target.

**Consider EKS Hybrid Nodes.**

This offloads control-plane operation to AWS while placing workload nodes on customer infrastructure.

---

## Variant 3: Customer wants AWS-managed hardware on-premises

**Consider EKS on Outposts.**

The decision changes from customer-managed commodity infrastructure to AWS-managed infrastructure physically installed on-premises.

---

## Variant 4: Only GPU model hosting is required

There are no general microservices, operators, customer plugins, or hybrid platform requirements.

**Consider SageMaker managed inference before EKS.**

Kubernetes may be unnecessary platform overhead.

---

## Variant 5: Only retryable AWS batch processing is required

**Consider AWS Batch.**

Its purpose-specific scheduling and resource provisioning may be simpler than maintaining a Kubernetes batch platform.

---

## Variant 6: Customer plugins are fully hostile

Namespace isolation is insufficient.

Use stronger boundaries such as:

- separate clusters;
- separate AWS accounts;
- dedicated nodes;
- stronger sandboxing;
- restricted networking;
- highly constrained identities.

---

## Variant 7: No application may access the Internet

Use:

- private EKS API;
- ECR endpoints;
- S3 endpoint;
- Secrets Manager endpoint;
- CloudWatch endpoints;
- STS endpoint where required;
- private package and artifact repositories.

Audit every workload and controller dependency before deleting NAT.

---

# 24. Exam-oriented decision snippets

## Existing Kubernetes environment

**Requirement:** Migrate standard Kubernetes applications to AWS with minimal application changes.

**Choose:** Amazon EKS.

**Reason:** It preserves the Kubernetes API and ecosystem while AWS manages the control plane. citeturn509763view2turn509763view3

---

## AWS-native container orchestration

**Requirement:** Run containers only in AWS with minimal orchestration complexity and no Kubernetes requirement.

**Choose:** Strongly consider ECS.

**Reject EKS as automatic default:** Kubernetes adds an operating model the requirement did not request.

---

## Local independent Kubernetes

**Requirement:** Run the entire Kubernetes cluster on customer-owned infrastructure and continue through loss of AWS connectivity.

**Choose:** EKS Anywhere.

---

## AWS-managed control plane with on-premises nodes

**Requirement:** Keep nodes on-premises while using the AWS-managed EKS control plane, with reliable private connectivity.

**Choose:** EKS Hybrid Nodes.

---

## Serverless Kubernetes Pods

**Requirement:** Run compatible Kubernetes Pods without managing EC2 nodes.

**Choose:** EKS on Fargate.

**Reject when:** GPU, DaemonSet, privileged-container, host-level, or EBS requirements exist.

---

## HTTP ingress

**Requirement:** Expose HTTP services with host- or path-based routing.

**Choose:** Kubernetes Ingress with AWS Load Balancer Controller and ALB.

---

## Raw TCP or UDP exposure

**Requirement:** Expose a Kubernetes service over Layer 4 TCP or UDP.

**Choose:** Service of type `LoadBalancer` with NLB configuration.

---

## Pod accesses S3

**Requirement:** Only one application workload should read a specific S3 prefix.

**Choose:** A dedicated Kubernetes service account associated with a least-privilege IAM role through Pod Identity.

**Reject:** Adding the S3 permissions to every node’s IAM role.

---

## Human cluster access

**Requirement:** A federated engineer needs namespace-scoped `kubectl` access.

**Choose:** IAM role plus EKS access entry and suitable EKS access policy or Kubernetes RBAC.

---

## Pod scaling versus node scaling

```text
Need more application replicas
    → HPA or workload controller

Need more machines to place Pods
    → node autoscaler / EKS Auto Mode / Karpenter / Cluster Autoscaler
```

---

# 25. Retrieval practice

## 1

Why is Kubernetes the correct choice in this project but probably not in Lesson 1’s ordinary web application?

## 2

What is the strongest reason Kubernetes wins here: container support, GPU support, or the common platform API?

## 3

What does Amazon EKS manage, and what does Asteria still manage?

## 4

Why is EKS Anywhere selected instead of EKS Hybrid Nodes for the factories?

## 5

What is the difference between a Pod and a Deployment?

## 6

Why do applications normally communicate through a Service rather than an individual Pod address?

## 7

Which Kubernetes controller fits each case?

- replicated API;
- one node-level camera agent;
- one-time reprocessing;
- nightly report;
- stable stateful peer.

## 8

What does a custom resource definition provide, and what does the operator provide?

## 9

Why does an IAM role not automatically grant `kubectl` permission?

## 10

What four things are involved when an engineer performs a Kubernetes operation on a private EKS cluster?

## 11

Why should a Pod use Pod Identity rather than inheriting broad permissions from its EC2 node?

## 12

What is the difference between Kubernetes RBAC and AWS IAM?

## 13

Why does the AWS Load Balancer Controller need both RBAC and IAM?

## 14

What important networking consequence follows from the VPC CNI assigning VPC IP addresses to Pods?

## 15

Why can a cluster run out of capacity even when nodes still have CPU and memory?

## 16

What is the difference between a security group and a NetworkPolicy in EKS?

## 17

Why is a NetworkPolicy object insufficient unless enforcement is enabled?

## 18

What is the difference between HPA and node autoscaling?

## 19

Why is EKS Fargate not appropriate for all workloads in this project?

## 20

Why should Aurora and S3 remain outside the Kubernetes cluster?

## 21

Does using the same PersistentVolumeClaim in AWS and on-premises guarantee identical storage behavior?

## 22

Why is a namespace not necessarily a sufficient boundary for hostile customer code?

## 23

What does `Forbidden` from the Kubernetes API imply that a network timeout does not?

## 24

Why could increasing the number of Pods make database performance worse?

## 25

What business value justifies the operational cost of Kubernetes in this scenario?

---

# 26. Answer key

## 1

The ordinary web application is AWS-only, greenfield, and can use simpler managed services. Asteria already has a Kubernetes platform, must deploy it across environments, relies on operators and CRDs, and must support customer-controlled infrastructure.

## 2

The common platform API. AWS has other ways to run containers and GPUs, but the Kubernetes API, controller model, ecosystem, and deployment contract are the decisive requirements.

## 3

EKS manages the Kubernetes control plane. Asteria remains responsible for its workloads, policies, application configuration, add-ons, capacity choices, networking design, identities, observability, and data architecture.

## 4

Factories must operate during extended WAN failure. EKS Anywhere keeps the control plane locally. Hybrid Nodes depend on an AWS-hosted control plane and reliable connectivity.

## 5

A Pod is one scheduling and execution unit. A Deployment declares and maintains a replicated application made of Pods.

## 6

Pod identities and addresses are ephemeral. A Service supplies a stable logical endpoint and selects the current healthy backing Pods.

## 7

- replicated API: Deployment;
- camera agent: DaemonSet;
- reprocessing: Job;
- nightly report: CronJob;
- stable stateful peer: StatefulSet.

## 8

The CRD adds a new object type to the Kubernetes API. The operator implements the reconciliation behavior for that object.

## 9

IAM authenticates the AWS principal, but Kubernetes authorization is separate. The role needs an EKS access entry and suitable Kubernetes permissions.

## 10

- network path to the private API endpoint;
- AWS authentication;
- EKS access mapping;
- Kubernetes authorization.

## 11

Pod Identity limits AWS permissions to one service account and workload. A broad node role risks exposing the same permissions to unrelated Pods.

## 12

Kubernetes RBAC governs operations on Kubernetes objects. IAM governs operations on AWS APIs and resources.

## 13

RBAC lets it observe and modify Kubernetes Ingress and Service objects. IAM lets it create and manage AWS load-balancing resources.

## 14

Pod addresses consume VPC subnet capacity and participate in VPC routing and network controls.

## 15

The subnet may have no allocatable Pod IPs, or placement constraints may prevent scheduling despite aggregate CPU and memory availability.

## 16

A security group is an AWS/VPC network control associated with network interfaces or supported Pod identities. NetworkPolicy is a Kubernetes Pod-level Layer 3/4 policy selected using labels, namespaces, and addresses.

## 17

The Kubernetes API can store the object even when no CNI or policy engine actually enforces its rules.

## 18

HPA changes Pod replicas. Node autoscaling changes the compute capacity available to schedule those Pods.

## 19

The project requires GPUs, DaemonSets, node-integrated agents, some privileged or host-level capabilities, and EBS-backed volumes, all of which conflict with Fargate limitations.

## 20

They provide durable managed state independently of cluster replacement and reduce the burden of self-managing critical data systems.

## 21

No. The interface can remain similar while the underlying storage differs in performance, durability, topology, snapshotting, and failure semantics.

## 22

Namespaces share a cluster control plane, nodes, kernel boundaries, and cluster-wide components. Strongly hostile code may require separate clusters, accounts, nodes, or sandboxing.

## 23

`Forbidden` means the request reached the API server and the caller was authenticated, but authorization rejected the operation. A timeout indicates that reachability may not have succeeded.

## 24

Every new Pod may create its own connection pool, causing the total database connection count to exceed safe capacity.

## 25

Kubernetes avoids rewriting the existing platform, provides the same product-level API in AWS and customer environments, supports custom operators and extensions, and permits one operating model across heterogeneous infrastructure.

---

# 27. What to memorize now

```text
ECS:
    AWS-native container orchestration

EKS:
    managed Kubernetes control plane

EKS Anywhere:
    Kubernetes control plane and nodes on customer infrastructure

EKS Hybrid Nodes:
    AWS-hosted EKS control plane + customer-managed on-prem nodes
```

```text
Pod:
    scheduling unit

Deployment:
    replicated usually stateless workload

StatefulSet:
    stable identity/stateful workload

DaemonSet:
    one Pod per relevant node

Job:
    run to completion

CronJob:
    scheduled Jobs
```

```text
Service:
    stable internal endpoint for changing Pods

Ingress:
    HTTP/HTTPS routing declaration

Ingress controller:
    turns Ingress into actual network infrastructure
```

```text
Human to cluster:
    IAM role
    + network path
    + EKS access entry
    + Kubernetes authorization

Pod to AWS:
    Kubernetes service account
    + Pod Identity IAM role
```

```text
Node role:
    node infrastructure permissions

Pod role:
    application AWS permissions
```

```text
Security group:
    VPC/AWS networking

NetworkPolicy:
    Pod-level Kubernetes networking
```

```text
HPA:
    more or fewer Pods

Node autoscaler:
    more or fewer machines
```

```text
Kubernetes is justified here because:
    Kubernetes itself is part of the product contract.
```

---

# 28. What can remain recognition-level

You do not yet need perfect recollection of:

- Helm syntax;
- CRD schemas;
- admission-webhook implementation;
- CNI internals;
- CSI internals;
- Karpenter configuration;
- topology-spread syntax;
- PodDisruptionBudget syntax;
- service-mesh behavior;
- ALB controller annotations;
- EKS version-upgrade procedures;
- exact GPU device-plugin mechanics;
- EKS Anywhere installation;
- multi-cluster GitOps tooling.

The immediate objective is to understand **why EKS was selected, which responsibilities it introduces, and how IAM and networking operate across both AWS and Kubernetes layers**.
