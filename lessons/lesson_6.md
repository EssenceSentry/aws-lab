# Lesson 6 — A Governed Internal Developer Platform

## Infrastructure as code, self-service products, CI/CD, golden images, configuration management, and controlled change

## Source note

The curriculum defines Lesson 6 as a governed internal developer platform covering:

```text
CloudFormation
CloudFormation StackSets
AWS Service Catalog
AWS SAM
AWS Proton
CodeArtifact
CodeBuild
CodePipeline
CodeDeploy
approved templates and AMIs
blue/green and canary deployment
AWS Config
AWS Systems Manager
rollback and change control
```



The uploaded SAP-C02 material treats infrastructure as code, multi-account deployment, CI/CD, and configuration management as closely related design concerns. It especially emphasizes the combination of AWS Organizations, CloudFormation StackSets, Service Catalog, IAM, Config, and Systems Manager.  

Two source-era services require current context:

- The uploaded material describes **AWS Proton** as a self-service platform for approved container and serverless templates.  AWS stopped accepting new Proton customers on October 7, 2025, and will end support on October 7, 2026. It remains useful for recognizing older SAP-C02 scenarios, but it should not be selected for a new platform. 
- **Systems Manager Change Manager** stopped accepting new customers on November 7, 2025. Existing customers can continue using it, so it remains relevant to existing-estate and older exam scenarios. Northstar’s new platform instead uses CodePipeline approvals, CloudFormation change sets, Systems Manager Automation, and an external change-record process. 

---

# 1. The project

## 1.1 Business brief

Northstar Group now has the multi-account landing zone designed in Lesson 5.

Its business units operate more than 60 AWS accounts, and hundreds of developers deploy workloads such as:

```text
serverless APIs
ECS services
scheduled jobs
data-processing pipelines
legacy EC2 applications
internal web applications
```

The central cloud-platform team has become a bottleneck.

Today, a developer who needs a production service must open several tickets:

```text
one for an IAM role
one for a VPC configuration
one for an S3 bucket
one for a build pipeline
one for monitoring
one for production deployment
```

The tickets create long delays, but granting every developer broad AWS permissions creates different problems:

- inconsistent architecture;
- excessive IAM authority;
- public resources created accidentally;
- missing tags and alarms;
- unencrypted storage;
- unpatched AMIs;
- libraries downloaded directly from untrusted public registries;
- manual production deployments;
- infrastructure that cannot be reproduced;
- security fixes implemented differently by every team;
- console changes that diverge from source control.

Northstar wants an internal platform named **Northstar Launchpad**.

Launchpad must let developers provision and deploy approved application patterns without waiting for the platform team to operate each workload manually.

---

## 1.2 The platform objective

The platform must offer:

```text
self-service
+
standardization
+
least privilege
+
team ownership
+
auditable change
```

Developers should be able to say:

> Create a production serverless API with a DynamoDB table.

or:

> Create an ECS service behind an internal ALB.

They should not need direct permission to independently create:

```text
arbitrary IAM roles
public S3 buckets
unapproved VPCs
Internet-facing databases
unmonitored production compute
```

The platform team defines approved patterns. Application teams supply business-specific inputs and own their code.

---

## 1.3 The central tension

A governed platform must avoid two extremes.

### Extreme 1: unrestricted infrastructure access

```text
Developer gets AdministratorAccess
    ↓
developer can build quickly
    ↓
every team invents a different platform
```

### Extreme 2: centralized ticket operations

```text
Platform team creates every resource
    ↓
central consistency improves
    ↓
platform team becomes a deployment bottleneck
```

The better model is:

```text
Platform team defines safe capabilities.
Application teams consume those capabilities themselves.
```

This is sometimes called a **paved road** or **golden path**.

It should make the safe approach easier—not merely make every other approach impossible.

---

# 2. Constraint ledger

| Dimension | Requirement |
|---|---|
| Organization | More than 60 accounts across several OUs |
| Self-service | Developers provision approved workloads without tickets |
| Governance | Security and compliance defaults cannot be omitted |
| Flexibility | Teams may choose bounded application parameters |
| Identity | Developers use IAM Identity Center roles |
| Infrastructure | Everything reproducible from version-controlled definitions |
| Deployment | Automated development, staging, and production promotion |
| Supply chain | Approved internal dependencies and immutable artifacts |
| EC2 | Only approved, patched AMIs |
| Serverless | Standard SAM-based API pattern |
| Containers | Standard ECS/Fargate pattern |
| Production change | Reviewed, approved, observable, and reversible |
| Operations | Central Systems Manager management for EC2 fleets |
| Compliance | Config rules and automated remediation |
| Scope | Multiple accounts and Regions |
| Networking | No requirement for all workload VPCs to be connected |
| Exceptions | Temporary exceptions require explicit approval and expiry |
| Recovery | Infrastructure and application rollbacks must be planned separately |

---

# 3. Baseline architecture

```text
                                AWS Organization
                                      │
                         Platform Engineering account
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  Approved infrastructure source                                            │
│      CloudFormation templates                                              │
│      SAM templates                                                         │
│      Systems Manager runbooks                                              │
│      Image Builder recipes                                                 │
│                                                                            │
│  AWS Service Catalog                                                       │
│      Portfolios                                                            │
│      Approved products                                                     │
│      Product versions                                                      │
│      Launch and template constraints                                       │
│                                                                            │
│  CloudFormation StackSets                                                  │
│      Organization baselines                                                │
│      Launch roles                                                          │
│      Config rules                                                          │
│      Systems Manager roles/endpoints                                       │
│                                                                            │
│  CodeArtifact                                                              │
│      approved internal packages                                            │
│      controlled upstream access                                            │
│                                                                            │
│  CI/CD                                                                     │
│      CodePipeline                                                          │
│      CodeBuild                                                             │
│      S3 artifact store + KMS                                                │
│      cross-account deployment roles                                        │
│                                                                            │
│  EC2 Image Builder                                                         │
│      base AMI                                                              │
│      build components                                                      │
│      security tests                                                        │
│      approved AMI distribution                                             │
└────────────────────────────────────────────────────────────────────────────┘
                  │                                   │
                  │ StackSets                         │ portfolio sharing
                  ▼                                   ▼
┌─────────────────────────────┐          ┌─────────────────────────────┐
│ Production workload account │          │ Nonproduction account       │
│                             │          │                             │
│ StackSet baseline           │          │ StackSet baseline           │
│ Service Catalog portfolio   │          │ Service Catalog portfolio   │
│ Product launch roles        │          │ Product launch roles        │
│ CloudFormation service role │          │ CloudFormation service role │
│ Deployment role             │          │ Deployment role             │
│ Config rules                │          │ Config rules                │
│ Systems Manager             │          │ Systems Manager             │
│                             │          │                             │
│ ECS / Lambda / EC2 workload │          │ ECS / Lambda / EC2 workload │
└─────────────────────────────┘          └─────────────────────────────┘
                  │                                   │
                  └──────────────────┬────────────────┘
                                     ▼
                         Security/Audit account
                  Config aggregation and compliance
                  centralized operational evidence
                  remediation visibility
```

## Architecture in one sentence

> StackSets push mandatory account baselines, Service Catalog lets developers pull approved application products, CloudFormation and SAM define the infrastructure, CodePipeline and CodeBuild produce and promote immutable artifacts, CodeDeploy handles application rollouts where appropriate, Image Builder distributes approved AMIs, and Config plus Systems Manager maintain compliance after deployment.

---

# 4. The platform has three planes

## 4.1 Platform control plane

The platform control plane contains:

```text
templates
portfolios
pipelines
artifact repositories
image recipes
deployment roles
policy checks
```

It determines what developers are allowed to create and how changes are promoted.

---

## 4.2 Workload plane

The workload plane contains the actual applications:

```text
Lambda functions
ECS services
EC2 Auto Scaling groups
databases
queues
buckets
load balancers
```

These resources belong to workload accounts, not the platform account.

---

## 4.3 Operations and compliance plane

The operations plane contains:

```text
Config rules
Systems Manager
patch policies
Automation runbooks
CloudWatch alarms
CloudTrail
central compliance views
```

It identifies and corrects divergence after the initial deployment.

---

## 4.4 Four different authorities

A developer-platform interaction commonly involves four separate permission sets:

```text
Developer authority:
    May request or update an approved product.

Provisioning authority:
    May create the resources inside that product.

Deployment authority:
    May release application code.

Runtime authority:
    May be used by the running application.
```

Combining all four into one role defeats much of the platform’s security value.

---

# 5. The Northstar product catalog

Northstar initially offers four products.

| Product | Main implementation |
|---|---|
| Serverless API | SAM, API Gateway, Lambda, DynamoDB, alarms |
| ECS web service | CloudFormation, ECS/Fargate, ALB, alarms |
| Scheduled container job | EventBridge Scheduler, ECS task, logs |
| Legacy EC2 service | Approved AMI, launch template, Auto Scaling, ALB, Systems Manager |

Every product includes standard capabilities such as:

```text
resource tags
runtime IAM role
log retention
CloudWatch alarms
encryption
private subnet placement where appropriate
backup configuration where appropriate
deployment pipeline
security-group relationships
```

A developer selects the product and supplies bounded parameters.

---

## 5.1 Product contract

A product has inputs such as:

```text
application name
environment
owner
cost center
runtime size
desired capacity
data-retention tier
public or internal API
approved database option
```

It produces outputs such as:

```text
repository or artifact location
deployment pipeline
service endpoint
runtime-role ARN
log group
dashboard
alarm topic
```

The product contract hides unnecessary implementation details without concealing operational responsibilities.

---

## 5.2 Good parameters

A good parameter exposes a meaningful decision:

```text
Environment:
    development | staging | production

Availability tier:
    standard | business-critical

API exposure:
    internal | public

Database capacity mode:
    on-demand | provisioned
```

---

## 5.3 Dangerous parameters

A dangerous parameter bypasses the product’s policy:

```text
IamPolicy = arbitrary JSON
SecurityGroupIngress = arbitrary CIDR
PubliclyAccessible = true or false
KmsKeyPolicy = arbitrary JSON
ImageId = any AMI
```

A template is not governed merely because CloudFormation created it. Governance depends on what the template permits.

---

# 6. CloudFormation foundations

## 6.1 Template and stack

A CloudFormation **template** is a declarative description of AWS resources.

A **stack** is a deployed instance of that template in one account and Region.

```text
Template:
    desired infrastructure definition

Stack:
    actual managed deployment
```

The uploaded material identifies CloudFormation as AWS’s principal infrastructure-as-code service and notes that a template deploys resources as a stack. 

---

## 6.2 Declarative model

The template says:

```text
I want:
    an S3 bucket
    encrypted with this key
    with these tags
```

It does not normally contain an imperative sequence such as:

```text
open console
click Create bucket
wait ten seconds
click Encryption
```

CloudFormation determines the necessary AWS API operations and dependency order.

---

## 6.3 Template sections

A simplified template can contain:

```yaml
AWSTemplateFormatVersion: "2010-09-09"

Description: Approved internal API product

Parameters:
  ApplicationName:
    Type: String

  Environment:
    Type: String
    AllowedValues:
      - development
      - staging
      - production

Conditions:
  IsProduction: !Equals [!Ref Environment, production]

Resources:
  ApplicationLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      RetentionInDays: !If [IsProduction, 365, 30]

Outputs:
  LogGroupName:
    Value: !Ref ApplicationLogGroup
```

The `Resources` section is the only universally required template section. The source material also calls out parameters, outputs, nested stacks, custom resources, and macros as important CloudFormation concepts. 

---

## 6.4 Parameters are not arbitrary configuration storage

Parameters are useful for deployment-time choices:

```text
environment
instance size
retention tier
subnet IDs
approved certificate ARN
```

Do not place plaintext secrets in ordinary template parameters.

Use:

- Secrets Manager;
- Systems Manager Parameter Store;
- CloudFormation dynamic references;
- a controlled secret-provisioning process.

---

## 6.5 Outputs

Outputs expose information such as:

```text
service URL
load-balancer DNS name
runtime-role ARN
queue ARN
database endpoint
```

One stack can export an output for another stack in the same account and Region to import.

However, excessive cross-stack exports create deployment coupling because an exported value cannot be modified or removed while another stack imports it.

---

## 6.6 Nested stacks

A root stack can contain nested stacks:

```text
Application root stack
    ├── network module
    ├── compute module
    ├── data module
    └── observability module
```

Nested stacks support reuse and decomposition, but they share a stack hierarchy and failure lifecycle.

For independently owned systems, separate stacks connected through stable interfaces may be more appropriate than one large nested hierarchy.

---

## 6.7 Custom resources

A custom resource invokes custom provisioning logic during stack creation, update, or deletion.

Use it when CloudFormation lacks a required native resource or operation.

A custom resource introduces code with lifecycle obligations:

```text
Create
Update
Delete
retry
timeout
idempotency
rollback
```

A custom resource that handles `Create` but fails during `Delete` can leave the entire stack unable to delete.

---

# 7. CloudFormation lifecycle

## 7.1 Create, update, and delete

CloudFormation manages the resource lifecycle through stack operations:

```text
CreateStack
UpdateStack
DeleteStack
```

During updates, individual resource properties may support:

```text
no interruption
some interruption
replacement
```

CloudFormation documents the update behavior for every resource property. A seemingly small template change can replace a physical resource if the changed property is immutable. 

---

## 7.2 Replacement risk

Suppose a change requires replacement of a database resource:

```text
Old database
    ↓ replacement
New database
```

CloudFormation can create a new physical resource, but that does not automatically migrate all application data safely.

The platform pipeline must detect replacement indicators and require explicit review for stateful resources.

---

## 7.3 Change sets

A change set previews the proposed stack changes before execution.

It can show that CloudFormation intends to:

```text
add resource
modify resource
replace resource
remove resource
```

Change sets are therefore an important production approval artifact. 

A change set does **not** prove:

- the update will succeed;
- the application will remain correct;
- the database migration is safe;
- IAM permissions are appropriately narrow;
- the replacement resource contains the old data.

It previews infrastructure changes; it is not a full deployment test. 

---

## 7.4 Drift

A stack has drift when actual resource configuration differs from its template-defined state.

Example:

```text
Template:
    security group permits 443

Manual console change:
    security group also permits 22 from 0.0.0.0/0
```

CloudFormation drift detection can identify supported resource properties that differ from the expected stack configuration.  

### Traditional change-set limitation

A traditional change set primarily compares:

```text
previous template
versus
new template
```

It may not fully account for out-of-band changes.

AWS now also provides drift-aware change sets, which compare the desired update against actual resource state and can explicitly show drift reconciliation. This is useful current knowledge but not essential to the core SAP-C02 mental model. 

---

## 7.5 Automatic rollback

If stack creation or update fails, CloudFormation normally attempts to return the stack to the previous stable state.

Rollback can itself fail because:

- a resource was changed outside CloudFormation;
- a dependency no longer exists;
- an IAM permission was removed;
- a retained resource conflicts with recreation;
- rollback requires an unavailable service;
- a resource cannot return to its previous configuration.

A stack can enter:

```text
UPDATE_ROLLBACK_FAILED
```

An operator may need to correct the underlying issue and continue the rollback. 

---

## 7.6 Rollback triggers

CloudFormation can monitor CloudWatch alarms during and after an operation.

```text
Stack update
    ↓
CloudWatch alarm enters ALARM
    ↓
CloudFormation rolls back
```

This lets application symptoms such as elevated error rate or latency participate in infrastructure rollback decisions. 

---

## 7.7 Termination protection

Termination protection prevents an ordinary stack-deletion request from deleting a protected stack.

Use it for critical stacks such as:

```text
production network
central security infrastructure
shared KMS infrastructure
critical database stack
```

Termination protection does not prevent every resource update. It specifically protects against stack deletion. 

---

## 7.8 Stack policies

A stack policy protects selected stack resources from update actions.

Example:

```text
Deny updates to:
    ProductionDatabase

Allow updates to:
    application resources
```

A temporary override can be supplied for a deliberately approved database change.

A stack policy is not the same as termination protection:

```text
Stack policy:
    restrict updates to selected stack resources

Termination protection:
    prevent deleting the entire stack
```

---

## 7.9 `DeletionPolicy`

`DeletionPolicy` controls what happens when a resource is removed from the stack or the stack is deleted.

Common behaviors are:

```text
Delete
Retain
Snapshot
```

Example:

```yaml
ProductionDatabase:
  Type: AWS::RDS::DBInstance
  DeletionPolicy: Snapshot
```

`Retain` leaves the physical resource in place, but CloudFormation stops managing it after removal from the stack. `Snapshot` is available only for resource types that support snapshotting. 

---

## 7.10 `UpdateReplacePolicy`

`UpdateReplacePolicy` controls what happens to the **old** physical resource when an update requires replacement.

```text
DeletionPolicy:
    stack deletion or template removal

UpdateReplacePolicy:
    replacement during update
```

A critical stateful resource often needs both policies considered explicitly.

---

# 8. CloudFormation IAM

## 8.1 Caller credentials without a service role

Without a configured CloudFormation service role, CloudFormation performs operations using permissions derived from the caller’s session.

The caller therefore needs:

```text
CloudFormation operation permission
+
underlying resource permissions
```

That often results in broad developer roles.

---

## 8.2 CloudFormation service role

Northstar instead associates approved stacks with a CloudFormation service role.

```text
Developer or pipeline
    ↓ cloudformation:CreateStack / UpdateStack
CloudFormation
    ↓ assumes
ApprovedProductProvisioningRole
    ↓
creates AWS resources
```

The caller needs permission to perform the CloudFormation operation and to pass the approved service role when the role is attached or changed. CloudFormation then uses that role for stack operations. 

### Security implication

A caller who can update a stack that uses a powerful service role can potentially cause CloudFormation to exercise that role’s permissions.

Therefore, Northstar constrains:

- which templates may be used;
- which service roles may be passed;
- which stacks may be updated;
- which parameters may be supplied;
- which IAM resources templates may create.

---

## 8.3 `iam:PassRole`

The developer or pipeline does not become the CloudFormation service role.

```text
PassRole:
    allow CloudFormation to use the role

AssumeRole:
    caller obtains a session as the role
```

The caller’s `iam:PassRole` permission should name only approved roles and, where practical, be conditioned on the CloudFormation service. 

---

## 8.4 IAM capabilities

A template that creates or modifies IAM resources requires explicit acknowledgement through capabilities such as:

```text
CAPABILITY_IAM
CAPABILITY_NAMED_IAM
```

This acknowledgement is not an authorization grant. The CloudFormation execution identity still requires the necessary IAM API permissions.

---

## 8.5 CloudFormation does not create application runtime authority automatically

A template may create:

```text
LambdaExecutionRole
ECSTaskRole
EC2InstanceProfile
```

Those runtime roles are assumed later by their respective workloads.

They are distinct from:

```text
developer role
pipeline role
CloudFormation service role
```

---

# 9. CloudFormation StackSets

## 9.1 The multi-account problem

Northstar needs every workload account to contain:

```text
standard deployment roles
Config rules
Systems Manager configuration
central event forwarding
security contacts
baseline alarms
approved Service Catalog launch roles
```

Creating these separately in 60 accounts and several Regions would be slow and inconsistent.

StackSets extends one CloudFormation template across multiple accounts and Regions. 

---

## 9.2 Core concepts

```text
StackSet
    one centrally managed template and configuration

Stack instance
    reference to one deployed stack
    in one target account and Region

Administrator account
    account from which the StackSet is managed

Target account
    account receiving the stack
```

A StackSet is managed from one Region but can create stack instances in several target Regions. 

---

## 9.3 Service-managed permissions

For accounts inside Northstar’s AWS Organization, the platform uses service-managed permissions.

Requirements include:

```text
Organizations all features
trusted access for StackSets
management account or delegated administrator
```

CloudFormation creates and manages the required organizational execution relationship. A delegated administrator can manage service-managed StackSets, although the service-managed operations are performed through the organization’s management-account authority. 

---

## 9.4 Self-managed permissions

Use self-managed permissions when:

- target accounts are not in the same organization;
- the organization cannot enable trusted access;
- a custom administration/execution-role relationship is required.

This requires explicit roles such as:

```text
administration role in controlling account
execution role in every target account
```

The execution role trusts the administration account and carries the permissions needed by the template. 

---

## 9.5 OU targeting

A service-managed StackSet can target:

```text
the organization
one or more OUs
specific accounts through deployment targets
```

Targeting an OU also affects accounts in its child OUs according to the deployment configuration. The uploaded material emphasizes that StackSets can target an organization or selected OUs and their descendant accounts. 

---

## 9.6 Automatic deployment

StackSets can automatically deploy to newly added accounts in targeted OUs.

Northstar uses this for mandatory baselines:

```text
New production account joins Production OU
    ↓
deployment role stack appears
Config baseline appears
Systems Manager baseline appears
```

When an account leaves the target OU, Northstar can choose whether StackSets should delete or retain the stack and its resources. 

---

## 9.7 Operation preferences

A StackSet operation can control:

```text
Region order
concurrency
failure tolerance
whether concurrency is strict or soft
```

Example:

```text
Deploy first to us-east-1
then eu-west-1

Maximum concurrent accounts:
    10

Failure tolerance:
    1 account
```

This reduces the risk of applying a broken baseline to every account simultaneously.

---

## 9.8 StackSets do not deploy to the management account

Service-managed StackSets do not deploy stack instances to the organization management account, even when it appears within the target hierarchy. The management account must be handled separately if it requires equivalent resources. 

---

## 9.9 StackSets IAM trace

```text
Platform pipeline
    ↓ assumes
StackSetAdministratorRole
in delegated platform account
    ↓
CloudFormation StackSets
    ↓ organization trusted access
target-account execution authority
    ↓
create/update baseline stack
    ↓
target-account resources
```

The target account’s SCP still applies. StackSets trusted access is not a universal bypass of organizational policy.

---

## 9.10 StackSets are a push model

The platform team decides:

```text
Every production account must have this baseline.
```

Then StackSets pushes it.

That is different from a developer deciding:

```text
My application needs an approved serverless API.
```

That self-service decision belongs to Service Catalog.

---

# 10. AWS Service Catalog

## 10.1 The self-service problem

Northstar wants developers to choose from approved products without gaining permission to independently create every underlying AWS resource.

Service Catalog provides:

```text
approved products
organized portfolios
versioning
self-service launch
constraints
provisioned-product lifecycle
```

The source guide identifies Service Catalog as the tool for centrally managed approved services and user-specific portfolios. 

---

## 10.2 Product

A product is an approved deployable pattern.

Examples:

```text
Northstar Serverless API
Northstar ECS Service
Northstar Scheduled Job
Northstar EC2 Web Application
```

A CloudFormation product contains a CloudFormation template defining the underlying resources.

---

## 10.3 Product version

A product can have several provisioning-artifact versions:

```text
Serverless API v1
Serverless API v2
Serverless API v3
```

A new version becomes available to authorized users, but existing provisioned products do not automatically become the new version merely because it was published. Teams update their provisioned product deliberately. 

Northstar can mark versions:

```text
active
inactive
```

and eventually remove obsolete versions according to a migration policy.

---

## 10.4 Portfolio

A portfolio groups products and defines who may use them.

Example:

```text
Nonproduction Developer Portfolio
    Serverless API
    ECS Service
    Scheduled Job

Production Application Portfolio
    Serverless API
    ECS Service
```

The production portfolio can expose fewer products and stricter constraints than the sandbox portfolio.

---

## 10.5 Provisioned product

When a developer launches a product, the resulting managed deployment is a **provisioned product**.

Under a CloudFormation-backed product:

```text
Service Catalog provisioned product
    ↓
CloudFormation stack
    ↓
AWS resources
```

The developer should manage the resulting infrastructure through the provisioned-product lifecycle rather than editing the resources manually.

---

## 10.6 Portfolio access

Northstar grants portfolio access to IAM Identity Center-generated roles.

```text
NonproductionDeveloper role
    → may browse and launch nonproduction portfolio

ProductionDeployer role
    → may update approved production products

PlatformAdministrator role
    → may create products, versions, portfolios, and constraints
```

Access to one portfolio does not imply access to every product in the organization.

---

# 11. Service Catalog constraints

## 11.1 Launch constraint

A launch constraint associates a role with a product.

```text
Developer
    ↓ servicecatalog:ProvisionProduct
Service Catalog
    ↓ assumes launch role
CloudFormation
    ↓
underlying resources created
```

The developer does not need direct permission to create every EC2 instance, IAM role, or database in the product. Service Catalog uses the launch role when the end user launches, updates, or terminates the product.  

### Why this matters

Without a launch role:

```text
Developer needs all underlying provisioning permissions.
```

With a launch role:

```text
Developer needs Service Catalog permissions.
Approved product receives controlled provisioning authority.
```

---

## 11.2 Launch-role danger

A launch role with broad permissions remains dangerous when the template lets the developer supply arbitrary values.

For example:

```text
Launch role:
    can create IAM roles

Product parameter:
    arbitrary managed policy ARN
```

The developer could use the approved product as a privilege-escalation mechanism.

Governance requires both:

```text
safe launch role
AND
safe product template and parameters
```

---

## 11.3 Template constraint

A template constraint restricts parameter combinations available to users.

Example:

```text
Development:
    instance type = small or medium
    retention = 7 or 30 days

Production:
    instance type = medium or large
    Multi-AZ = required
    retention = 365 days
```

Template constraints let one generic CloudFormation template be exposed differently through different portfolios. 

---

## 11.4 Notification constraint

A notification constraint connects product stack events to an SNS topic.

It can notify:

- platform operations;
- a team-owned deployment channel;
- a central compliance workflow.

It is not a substitute for CloudWatch application alarms.

---

## 11.5 Tag update constraint

A tag update constraint controls whether end users may modify tags on resources associated with the provisioned product.

This helps preserve platform-managed tags such as:

```text
Owner
CostCenter
Environment
ManagedBy
DataClassification
```

The uploaded Service Catalog comparison lists launch, template, notification, and tag-update constraints as governance tools. 

---

## 11.6 Portfolio sharing

The Platform Engineering account shares portfolios with:

```text
specific workload accounts
selected OUs
the organization
```

Recipient-account administrators can distribute shared products to local users while the product definitions remain controlled by the portfolio owner. 

Service Catalog is Regional, so products and sharing must be planned for each required Region. 

---

# 12. StackSets versus Service Catalog

This is one of the most important Lesson 6 distinctions.

## 12.1 StackSets

Use StackSets when the central platform says:

> This infrastructure must exist in all targeted accounts or Regions.

Examples:

```text
deployment roles
Config rules
Systems Manager baseline
central EventBridge forwarding
security contacts
shared portfolio infrastructure
```

StackSets are centrally initiated.

---

## 12.2 Service Catalog

Use Service Catalog when the platform says:

> Teams may launch one of these approved infrastructure patterns when they need it.

Examples:

```text
serverless API
ECS service
data-processing job
approved EC2 application
```

Service Catalog is self-service.

---

## 12.3 Comparison

| Dimension | StackSets | Service Catalog |
|---|---|---|
| Primary model | Central push | Authorized self-service pull |
| Target | Accounts and Regions | End-user provisioned products |
| User choice | Limited | Product and bounded parameters |
| Main unit | StackSet and stack instance | Portfolio, product, provisioned product |
| Typical use | Mandatory baseline | Approved application pattern |
| Multi-account | Native target model | Portfolio sharing or StackSet constraints |
| Developer portal | No | Yes |

---

## 12.4 Use both

Northstar uses StackSets to deploy:

```text
Service Catalog launch roles
deployment roles
Config baseline
Systems Manager baseline
```

It uses Service Catalog to expose:

```text
approved workload products
```

The uploaded exam notes explicitly recommend combining them when a company needs both consistent multi-account infrastructure and user-selectable approved products. 

---

# 13. Serverless products with AWS SAM

## 13.1 SAM is a CloudFormation extension

AWS SAM provides shorthand resource types for serverless applications.

Example:

```yaml
Transform: AWS::Serverless-2016-10-31

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: app.handler
      Runtime: python3.13
      Events:
        ApiRequest:
          Type: Api
          Properties:
            Path: /items
            Method: get
```

During deployment, SAM transforms its higher-level syntax into ordinary CloudFormation resources.  

### Memory rule

```text
SAM template
    ↓ transform
CloudFormation template
    ↓ deploy
CloudFormation stack
```

SAM is not an alternative runtime to Lambda and is not a separate orchestration plane from CloudFormation.

---

## 13.2 Northstar serverless product

The approved product includes:

```text
API Gateway
Lambda function
Lambda execution role
CloudWatch Logs
alarms
tracing
dead-letter or failure destination
optional DynamoDB table
deployment pipeline
```

The team supplies:

```text
application name
source repository
memory tier
timeout tier
public/internal exposure
data-retention tier
```

The template determines the security and operational baseline.

---

## 13.3 SAM and safe Lambda deployment

SAM can configure:

```text
AutoPublishAlias
DeploymentPreference
```

to publish Lambda versions and use CodeDeploy for gradual traffic shifting.

Example conceptual policy:

```text
Canary10Percent5Minutes
```

means:

```text
10% of alias traffic → new version
wait five minutes
remaining traffic → new version
```

CloudWatch alarms and pre/post-traffic hooks can fail and roll back the deployment. `DeploymentPreference` requires an auto-published alias. 

---

## 13.4 SAM versus CloudFormation

| Need | Choice |
|---|---|
| General AWS infrastructure | CloudFormation |
| Serverless-focused shorthand and tooling | SAM |
| Multi-account rollout | StackSets using CloudFormation-compatible templates |
| Developer self-service | Service Catalog product, potentially backed by SAM-transformed infrastructure |
| Runtime deployment strategy | CodeDeploy through SAM configuration |

SAM does not replace StackSets or Service Catalog.

---

# 14. AWS Proton: source-era recognition

The uploaded material describes Proton as a platform-team service for:

```text
environment templates
service templates
approved container/serverless patterns
CI/CD integration
developer self-service
```



Historically, the mental model was:

```text
Environment template
    → shared infrastructure such as VPC or ECS cluster

Service template
    → application infrastructure and pipeline

Developer
    → instantiates approved template
```

That overlaps conceptually with Northstar Launchpad.

However, AWS Proton is approaching end of support and is not available to new customers. Northstar therefore implements the platform with:

```text
Service Catalog
CloudFormation / SAM
CodePipeline
CodeBuild
StackSets
an internal portal or workflow
``` 


### Exam memory

```text
Older question:
    centrally managed templates for container/serverless developer self-service
    → recognize Proton

New 2026 architecture:
    do not begin a new dependency on Proton
```

---

# 15. Approved dependencies with CodeArtifact

## 15.1 The dependency problem

Without a controlled package service, every build downloads dependencies directly from public registries:

```text
PyPI
npm
Maven Central
NuGet Gallery
```

This creates risks:

- public-registry outage;
- dependency version disappearance;
- unreviewed packages;
- dependency confusion;
- malware;
- nonreproducible builds;
- every build downloading the same package repeatedly.

---

## 15.2 CodeArtifact concepts

```text
Domain
    logical security and storage boundary

Repository
    package repository inside a domain

Package
    named software dependency

Package version
    one immutable version of a package

Upstream repository
    another CodeArtifact repository searched when package is absent

External connection
    connection to a supported public package repository
```

CodeArtifact requires authenticated access and does not expose repository packages publicly. Builds obtain temporary authorization tokens using their AWS identity. 

---

## 15.3 Northstar repository design

```text
northstar domain
│
├── public-mirror
│      external connection to approved public registry
│
├── quarantine
│      newly introduced packages
│
├── approved
│      validated third-party packages
│      approved internal packages
│
└── team-development
       team snapshots and prereleases
       upstream → approved
```

Production builds resolve packages only through:

```text
approved
```

The exact promotion workflow depends on package type, but the architectural objective is that unreviewed public packages do not silently enter production builds.

CodeArtifact upstream repositories can form controlled lookup chains, while one designated repository can hold the external public connection and cache retrieved packages for downstream repositories. 

---

## 15.4 CodeArtifact IAM trace

```text
CodeBuild project
    ↓ assumes
OrdersBuildRole
    ↓
codeartifact:GetAuthorizationToken
sts:GetServiceBearerToken
    ↓
temporary package-manager token
    ↓
read package from approved repository
```

Publishing an internal package requires separate permissions from reading it.

```text
application build
    → read only

library release pipeline
    → publish approved namespace
```

---

## 15.5 Pinning dependencies

A controlled repository does not replace dependency pinning.

Prefer:

```text
exact version
+
lock file
+
integrity hash where supported
+
immutable build artifact
```

Avoid unconstrained production dependencies such as:

```text
package >= 1.0
```

because a later build may silently resolve different code.

---

## 15.6 Private network access

CodeArtifact supports interface VPC endpoints through AWS PrivateLink.

A VPC-attached CodeBuild project can therefore reach CodeArtifact through private addresses without NAT for that service. 

---

# 16. The AWS CI/CD service model

## 16.1 CodePipeline

CodePipeline orchestrates the release process.

It defines:

```text
stages
actions
transitions
artifacts
approvals
```

Typical action categories are:

```text
source
build
test
deploy
approval
invoke
```

Actions within a stage can run serially or in parallel according to their run order.  

### Memory rule

```text
CodePipeline:
    decide what happens next.
```

---

## 16.2 CodeBuild

CodeBuild:

- runs commands in a managed build environment;
- compiles code;
- runs tests;
- builds packages or container images;
- produces reports;
- creates deployable artifacts.

Its instructions normally come from:

```text
buildspec.yml
```

The build project uses a service role to access source, dependencies, artifacts, logs, and other required AWS services. 

### Memory rule

```text
CodeBuild:
    turn source into tested artifacts.
```

---

## 16.3 CodeDeploy

CodeDeploy automates application deployment to supported compute platforms such as:

```text
EC2
on-premises instances
Lambda
ECS
```

It uses concepts such as:

```text
application
deployment group
deployment configuration
AppSpec file
lifecycle hooks
alarms
rollback configuration
```

CodeDeploy deploys application revisions to compute. It does not generally create the complete application infrastructure in the way CloudFormation does.  

### Memory rule

```text
CodeDeploy:
    move application revision onto existing compute.
```

---

## 16.4 CodeArtifact

```text
CodeArtifact:
    provide approved software dependencies.
```

---

## 16.5 CloudFormation

```text
CloudFormation:
    create and update infrastructure.
```

---

## 16.6 Combined model

```text
CodeArtifact
    supplies dependencies
         │
         ▼
CodeBuild
    builds and tests artifact
         │
         ▼
CodePipeline
    coordinates promotion
         │
         ├──► CloudFormation deploys infrastructure
         │
         └──► CodeDeploy deploys application revision
```

---

# 17. The standard application pipeline

## 17.1 Nonproduction path

```text
1. Source change detected.

2. CodePipeline begins execution.

3. CodeBuild:
       resolves approved CodeArtifact dependencies
       lints
       runs unit tests
       builds artifact
       generates test reports
       validates infrastructure template

4. Artifact is placed in the encrypted pipeline artifact store.

5. CloudFormation creates a development change set.

6. Automated policy checks inspect:
       replacements
       IAM changes
       public exposure
       tags
       encryption
       resource count

7. Pipeline executes the development change set.

8. Integration tests run.

9. Application deployment occurs.

10. Alarms and synthetic tests validate behavior.
```

---

## 17.2 Production path

```text
11. The exact tested artifact is promoted.

12. Pipeline assumes the production deployment role.

13. CloudFormation creates, but does not execute,
    a production change set.

14. Approval context includes:
       commit
       artifact digest
       test results
       security findings
       change-set summary
       rollback plan

15. Authorized approver accepts or rejects.

16. Pipeline executes the change set.

17. CodeDeploy or native service deployment shifts traffic.

18. CloudWatch alarms evaluate the release.

19. Deployment succeeds or rolls back.

20. CloudTrail preserves the control-plane history.
```

CodePipeline supports explicit manual approval actions that pause a pipeline until an authorized person approves or rejects the change. 

---

## 17.3 Artifact store

CodePipeline passes artifacts through an S3 artifact bucket.

The bucket should have:

- versioning;
- encryption;
- blocked public access;
- restrictive bucket policy;
- controlled retention;
- an appropriate KMS key.

CodePipeline artifacts are stored in a customer-owned S3 bucket and encrypted using an AWS KMS key. 

---

## 17.4 Manual approval is not sufficient evidence

A production approval saying only:

```text
Approve build 482?
```

forces the reviewer to approve blindly.

A useful approval includes:

```text
what changed
which accounts and Regions
which resources will be replaced
test evidence
security findings
artifact identity
deployment strategy
estimated blast radius
rollback mechanism
```

Approval quality depends on context, not merely the existence of a button.

---

# 18. Cross-account deployment

## 18.1 Central pipeline account

Northstar hosts pipelines in the Platform Engineering account.

Production resources remain in production workload accounts.

```text
Platform account
    CodePipeline
    artifact bucket
    KMS key

Workload account
    cross-account deployment role
    CloudFormation service role
    application resources
```

---

## 18.2 Role flow

```text
CodePipeline service role
    ↓ sts:AssumeRole
ProductionDeploymentRole
in workload account
    ↓ cloudformation:CreateChangeSet
CloudFormation
    ↓ assumes
ProductionCloudFormationRole
    ↓
creates or updates workload resources
```

These are separate roles:

```text
Pipeline service role
    orchestrates pipeline resources

Cross-account deployment role
    accepts deployment from central pipeline

CloudFormation service role
    creates workload infrastructure

Application runtime role
    used by running application
```

---

## 18.3 Cross-account artifact access

The workload-account action must be able to:

- read the pipeline artifact from S3;
- decrypt it with the artifact KMS key;
- use the deployment role;
- pass the approved CloudFormation service role.

Cross-account pipelines require coordinated S3, KMS, and IAM policies. A customer-managed KMS key is used because the target account must be authorized to decrypt the artifact. 

---

## 18.4 Cross-account deployment does not require VPC peering

The pipeline invokes AWS control-plane APIs:

```text
STS
CloudFormation
CodeDeploy
S3
KMS
```

This is primarily an IAM and service-endpoint problem.

VPC connectivity is required only when a build or test must directly reach a private workload endpoint.

---

# 19. CodeBuild networking

## 19.1 Default build networking

A normal CodeBuild environment can reach public and AWS service endpoints through AWS-managed networking.

It does not need to enter a workload VPC merely to:

```text
compile code
read CodeArtifact
write pipeline artifact
invoke CloudFormation APIs
```

---

## 19.2 VPC-attached build

Attach CodeBuild to a VPC when the build or integration test must reach:

```text
private database
internal API
private package registry
on-premises system
private test environment
```

A VPC-attached build receives access through selected subnets and security groups. It requires the necessary routes and endpoints for every dependency. AWS recommends private build subnets across multiple AZs and ordinarily no inbound security-group rules. 

---

## 19.3 Private build path

```text
CodeBuild ENI
    ├──► CodeArtifact interface endpoint
    ├──► ECR interface endpoints
    ├──► S3 gateway endpoint
    ├──► CloudWatch Logs endpoint
    ├──► Secrets Manager endpoint
    └──► NAT / proxy for required public sources
```

A CodeArtifact endpoint cannot reach GitHub or an arbitrary public package registry.

---

## 19.4 Build cache

CodeBuild supports S3 and local cache types for reusable build content. Caching can reduce build time but must not become a hidden correctness dependency. A clean uncached build should still produce the same artifact. 

---

# 20. Application deployment strategies

Infrastructure and application deployment are related but not identical.

```text
CloudFormation:
    change infrastructure

CodeDeploy:
    change application revision on supported compute
```

A release may require both.

---

## 20.1 EC2 in-place deployment

```text
Existing instances
    ↓
application stopped or taken out of service
    ↓
new revision installed
    ↓
application restarted and validated
```

Advantages:

- no full duplicate fleet;
- lower temporary cost;
- simple for noncritical workloads.

Disadvantages:

- capacity may fall during deployment;
- the old instance has been modified;
- rollback requires another deployment;
- partial fleet version mixtures can exist;
- accumulated host drift remains.

The uploaded guide presents in-place deployment as appropriate when redundant capacity can absorb instances being updated or temporary interruption is acceptable. 

---

## 20.2 EC2 blue/green deployment

```text
Blue fleet:
    current production AMI/application

Green fleet:
    replacement AMI/application
```

Process:

```text
create green
    ↓
test green
    ↓
register green with load balancer
    ↓
shift traffic
    ↓
retain blue temporarily
    ↓
terminate blue after bake period
```

Advantages:

- fast traffic rollback;
- clean replacement hosts;
- preproduction validation;
- reduced configuration drift.

Disadvantages:

- temporary duplicate capacity;
- more networking and target-group configuration;
- stateful schema changes can block rollback.

CodeDeploy supports blue/green deployment for EC2 instances; blue/green is not supported for ordinary on-premises instances in the same way. 

---

## 20.3 Lambda canary

```text
Lambda alias production
    │
    ├── 90% → version 41
    └── 10% → version 42
```

After an evaluation period:

```text
100% → version 42
```

If an alarm fires:

```text
100% → version 41
```

SAM can generate the CodeDeploy integration for canary, linear, or all-at-once alias shifting. 

---

## 20.4 ECS blue/green

The source material emphasizes CodeDeploy-controlled ECS blue/green with:

```text
original task set
replacement task set
two target groups
production listener
optional test listener
canary, linear, or all-at-once shift
```



Amazon ECS now also has native blue/green and canary deployment capabilities. For SAP-C02, retain CodeDeploy as an important recognition answer, especially in scenarios using deployment groups and two target groups. 

---

## 20.5 Database compatibility

Blue and green versions may operate simultaneously.

Therefore, database changes should usually follow an expand-and-contract sequence:

```text
1. Add backward-compatible schema.
2. Deploy code that supports old and new forms.
3. Backfill.
4. Move all traffic to new code.
5. Verify.
6. Remove obsolete schema in a later release.
```

A destructive schema migration can make application rollback impossible even when the old compute environment still exists.

---

# 21. Golden AMIs

## 21.1 The EC2 image problem

Teams currently launch EC2 instances from:

- old distribution images;
- hand-maintained AMIs;
- marketplace images;
- snapshots of unknown provenance;
- instances manually patched several months ago.

Northstar needs a reproducible, tested **golden AMI** pipeline.

---

## 21.2 EC2 Image Builder pipeline

The central image pipeline contains:

```text
base image
    ↓
image recipe
    ↓
build components
    ↓
test components
    ↓
approved AMI
    ↓
distribution configuration
```

EC2 Image Builder can build AMIs and container images, test them, and distribute outputs across Regions, accounts, Organizations, and OUs. 

---

## 21.3 Golden-image contents

An approved Northstar Linux AMI may contain:

```text
supported operating-system version
current security patches
SSM Agent
CloudWatch Agent
approved endpoint protection
organization certificate authorities
hardened SSH configuration
approved audit configuration
runtime prerequisites
```

It must not contain:

```text
application secrets
shared private keys
customer credentials
long-lived AWS access keys
environment-specific database passwords
```

---

## 21.4 Image tests

Before approval, Image Builder tests:

```text
system boots
SSM Agent registers
required service starts
critical vulnerability threshold passes
filesystem permissions match baseline
unapproved listening ports are absent
CloudWatch Agent starts
disk encryption is enabled
```

A successful image build is not sufficient; the resulting image must satisfy operational and security tests.

---

## 21.5 Distribution

After approval:

```text
Golden AMI
    ├──► production accounts
    ├──► nonproduction accounts
    ├──► us-east-1
    └──► eu-west-1
```

Image Builder supports cross-account AMI distribution and organization-aware sharing, subject to the required IAM and KMS configuration. 

---

## 21.6 Pin the deployment

The platform may publish:

```text
/launchpad/ami/linux/current
```

in Parameter Store.

The deployment pipeline should resolve that pointer to an explicit AMI ID and record the ID in the launch-template or stack version.

```text
current pointer
    → discovery convenience

explicit AMI ID
    → reproducible deployment
```

Resolving “latest” independently on every instance launch can cause one Auto Scaling group to contain multiple unplanned image versions.

---

## 21.7 Image rollback

A bad AMI release is rolled back by:

```text
select previous approved AMI
    ↓
create new launch-template version
    ↓
replace instances
```

Do not manually repair every instance when the intended model is immutable replacement.

---

# 22. Immutable replacement versus in-place patching

## 22.1 Immutable model

```text
new patch available
    ↓
Image Builder creates new AMI
    ↓
tests run
    ↓
AMI promoted
    ↓
Auto Scaling group replaces instances
```

Advantages:

- reproducible fleet;
- cleaner rollback;
- less host drift;
- image tested before production.

Disadvantages:

- replacement takes time;
- stateful or manually configured hosts are difficult;
- fleet rollout consumes temporary capacity.

---

## 22.2 In-place model

```text
Patch Manager
    ↓
installs patch on running managed node
```

Advantages:

- useful for long-lived servers;
- fewer replacement dependencies;
- supports some legacy workloads.

Disadvantages:

- fleet members may patch at different times;
- rollback may be difficult;
- host drift accumulates;
- reboots require coordination.

Northstar uses immutable replacement for ordinary stateless Auto Scaling fleets and Patch Manager for workloads that genuinely require long-lived managed nodes.

---

# 23. Systems Manager mental model

## 23.1 Managed-node prerequisites

An EC2 instance becomes a Systems Manager managed node when it has:

```text
SSM Agent
+
IAM permissions
+
network reachability to Systems Manager
```

The uploaded guide emphasizes all three prerequisites for automated patching and management. 

---

## 23.2 Systems Manager tool selection

| Requirement | Systems Manager capability |
|---|---|
| Interactive shell without inbound SSH | Session Manager |
| Execute a command once across nodes | Run Command |
| Maintain desired node configuration | State Manager |
| Multi-step operational workflow | Automation |
| Install organization software package | Distributor |
| Scan/install OS and application patches | Patch Manager |
| Run disruptive work in a precise window | Maintenance Windows |
| Organization-wide patch configuration | Quick Setup patch policy |
| View patch and association state | Compliance |
| Control allowed change periods | Change Calendar |
| Formal approved change workflow for an existing customer | Change Manager |

The source cheat sheet presents these capabilities as related but distinct Systems Manager tools. 

---

## 23.3 Session Manager

Session Manager provides interactive managed-node access without requiring:

```text
public IP
inbound port 22
bastion host
distributed SSH keys
```

Access is controlled through IAM and can be logged according to the session configuration. 

### IAM path

```text
Operator role
    ↓ ssm:StartSession
Systems Manager
    ↓
SSM Agent on instance
```

The operator does not need direct TCP reachability to the instance’s private SSH port for an ordinary Session Manager shell.

---

## 23.4 Run Command

Run Command executes commands once across selected managed nodes.

Example:

```text
restart a service
collect diagnostic files
run one configuration query
install an urgent package
```

Targets can be selected through:

- instance IDs;
- tags;
- resource groups.

A one-time Run Command does not continuously enforce that the configuration remains present.

---

## 23.5 State Manager

State Manager maintains a desired configuration through an association.

Example:

```text
Every instance tagged:
    Monitoring = Standard

must have:
    CloudWatch Agent installed and running
```

State Manager periodically applies or checks the association.

### Memory rule

```text
Run Command:
    do this now

State Manager:
    keep this true
```

---

## 23.6 Automation

Automation uses runbooks to perform multi-step maintenance, deployment, and remediation workflows.

Example:

```text
1. Create AMI backup.
2. Stop application traffic.
3. Update configuration.
4. Restart service.
5. Validate health.
6. Restore traffic.
7. Roll back if validation fails.
```

Automation can target AWS resources beyond EC2 and can run across accounts and Regions with administration and execution roles. 

---

## 23.7 Distributor

Distributor packages software for managed nodes.

Example packages:

```text
organization monitoring agent
security scanner
internal command-line utility
certificate bundle
```

Run Command can install a package once.

State Manager can maintain the desired package version continuously. AWS recommends State Manager when nodes should remain on the current approved package version. 

---

## 23.8 Patch Manager

Patch Manager:

- scans for missing patches;
- applies approved patches;
- uses baselines and approval rules;
- reports compliance;
- can target groups of managed nodes.

A patch baseline can express rules such as:

```text
approve critical and important security patches
seven days after release
exclude specified patches
```

The uploaded Domain 3 material emphasizes Patch Manager and patch baselines as the purpose-built alternative to ad hoc update scripts. 

---

## 23.9 Maintenance Windows

Maintenance Windows define:

```text
schedule
duration
targets
tasks
concurrency
error threshold
```

Use them when work must occur during a specific permitted period:

```text
Sunday 02:00–05:00
no new tasks after 04:30
maximum 10% of fleet concurrently
stop after 3% failures
```

The uploaded guide pairs Maintenance Windows with Patch Manager for controlled disruptive patching. 

---

## 23.10 Current patch-policy model

AWS now recommends Systems Manager Quick Setup **patch policies** for centrally configuring patch operations, especially across several accounts and Regions.

A patch policy combines:

```text
patch baseline
schedule
scan or install behavior
target accounts/OUs
target Regions
```

This is the modern organization-scale alternative to separately creating a maintenance-window or State Manager patch configuration in every account and Region. 

### Exam memory

```text
Classic scenario:
    Patch Manager + Maintenance Windows

Current organization-scale baseline:
    Quick Setup patch policy
```

---

## 23.11 State Manager versus Maintenance Windows

Use State Manager when the objective is:

```text
maintain configuration compliance
```

Use Maintenance Windows when the objective is:

```text
perform high-priority or disruptive work
during an explicitly controlled period
```

Both can perform some similar commands, but their intent differs. 

---

# 24. Systems Manager networking

## 24.1 Outbound management path

The managed node’s SSM Agent initiates outbound HTTPS connections.

```text
Private EC2 instance
    ↓ TCP 443
Systems Manager service endpoints
```

Ordinary Session Manager and Run Command operation do not require an inbound management port.

---

## 24.2 Private endpoint design

A private workload VPC can use interface endpoints for required Systems Manager services.

```text
managed node subnet
    ↓
interface endpoint ENI
    ↓
Systems Manager
```

The endpoint security group allows TCP 443 from managed-node security groups.

---

## 24.3 Patching may need additional egress

Systems Manager connectivity alone does not guarantee that the operating system can download patches.

The node may also require access to:

- Amazon Linux repositories;
- Windows Update;
- Red Hat repositories;
- Ubuntu mirrors;
- internal package repositories.

That path may use:

- NAT;
- a proxy;
- internal mirrors;
- S3 repositories;
- other approved connectivity.

---

# 25. AWS Config and remediation

## 25.1 Platform compliance rules

Northstar defines rules such as:

```text
EC2 instances use approved AMIs
EBS volumes are encrypted
security groups do not expose SSH publicly
S3 Block Public Access is enabled
required tags are present
CloudTrail is enabled
RDS is not publicly accessible
production resources use approved Regions
```

Config records resource configuration and evaluates it against these rules.

---

## 25.2 Detection is not prevention

A Config rule normally observes a resource after configuration exists.

```text
Developer creates noncompliant security group
    ↓
Config records it
    ↓
rule marks it NON_COMPLIANT
```

This is detective control.

To prevent the configuration before creation, use controls such as:

- SCPs;
- CloudFormation hooks;
- Control Tower proactive controls;
- safe Service Catalog templates;
- restricted IAM permissions.

---

## 25.3 Automated remediation

Config can invoke a Systems Manager Automation document to remediate a noncompliant resource.

Example:

```text
Config detects public S3 access
    ↓
SSM Automation runbook
    ↓
enable Block Public Access
    ↓
Config reevaluates resource
```

AWS Config remediation actions use Systems Manager Automation documents. 

---

## 25.4 Remediation IAM

```text
AWS Config
    ↓ invokes
SSM Automation
    ↓ assumes
ConfigRemediationRole
    ↓
changes target resource
```

The remediation role should be scoped to:

- the required actions;
- supported resource types;
- target account/Region;
- approved tag or resource boundaries where possible.

---

## 25.5 Remediation must be idempotent

The same remediation may run more than once.

A good runbook can safely encounter:

```text
resource already compliant
```

and exit without harmful side effects.

Automatic remediation can operate from a compliance snapshot, so the runbook should re-check current resource state before making a destructive change. 

---

## 25.6 Config versus CloudFormation drift

### CloudFormation drift

```text
Does actual resource state differ from this stack’s template?
```

### Config compliance

```text
Does resource state satisfy this organization rule?
```

Examples:

```text
Manual tag added:
    CloudFormation may report drift.
    Config may still report compliant.

Template creates public SSH:
    CloudFormation reports no drift.
    Config reports noncompliant.
```

Both views matter.

---

## 25.7 Conformance packs

A conformance pack groups Config rules and optional remediation configurations.

Northstar creates:

```text
Production Platform Pack
Nonproduction Platform Pack
EC2 Managed Fleet Pack
Serverless Security Pack
```

Conformance packs can be deployed across an organization, and Systems Manager Quick Setup can distribute them across selected accounts and Regions. 

---

# 26. Change control

## 26.1 A change is more than a code commit

A production change record should identify:

```text
business purpose
affected accounts and Regions
affected services
artifact identity
infrastructure change set
security impact
test evidence
deployment strategy
monitoring window
rollback conditions
rollback mechanism
approver
exception expiry
```

---

## 26.2 Standard infrastructure change

```text
Pull request
    ↓
template validation
    ↓
development change set
    ↓
development execution
    ↓
integration tests
    ↓
production change set
    ↓
manual approval
    ↓
execute
    ↓
rollback-trigger monitoring
```

---

## 26.3 Standard application change

```text
Pull request
    ↓
CodeBuild
    ↓
immutable artifact
    ↓
development deployment
    ↓
integration and security tests
    ↓
production approval
    ↓
canary or blue/green deployment
    ↓
alarm evaluation
    ↓
complete or roll back
```

---

## 26.4 Emergency change

During an incident, an operator may need to make a change before the ordinary pipeline can complete.

The emergency process should include:

```text
break-glass role
time-limited access
strong MFA
CloudTrail monitoring
incident reference
smallest possible change
post-change review
immediate reconciliation into IaC
```

A manual incident fix that never returns to source control becomes permanent drift.

---

## 26.5 Change Calendar

Systems Manager Change Calendar can represent:

```text
open change periods
closed freeze periods
planned blackout windows
```

Automation runbooks can check the calendar before proceeding with an operation. 

---

## 26.6 Change Manager recognition

For existing customers, Systems Manager Change Manager can use:

```text
change templates
approvers
change requests
Automation runbooks
Change Calendar integration
```

The uploaded cheat sheet describes multi-level approvals followed by execution of an associated Automation runbook. 

Because Change Manager is closed to new customers, Northstar uses:

```text
CodePipeline approval
+
external change record
+
Automation runbook
+
Change Calendar
```

for new workflows. 

---

# 27. IAM architecture

## 27.1 Identity map

| Actor | Identity | Main authority |
|---|---|---|
| Developer | IAM Identity Center developer role | Browse and provision approved products |
| Product administrator | Platform administrator role | Manage products, portfolios, versions, constraints |
| Service Catalog | Product launch role | Provision approved product resources |
| CloudFormation | Stack service role | Create and update stack resources |
| StackSets administrator | Delegated platform role | Manage organization-wide StackSets |
| StackSets target operation | Target execution authority | Create baseline resources in member accounts |
| CodePipeline | Pipeline service role | Orchestrate actions and artifacts |
| CodeBuild | Build service role | Read source/dependencies and write artifacts |
| Cross-account deploy action | Workload deployment role | Create change sets and start deployments |
| CodeDeploy | CodeDeploy service role | Manage deployment targets and traffic |
| EC2 application | Instance profile | Runtime AWS access and Systems Manager |
| Lambda/ECS application | Execution/task role | Runtime AWS access |
| Config remediation | Automation assume role | Correct specified noncompliance |
| Operator | Systems Manager operator role | Start sessions, commands, or approved runbooks |

---

## 27.2 Service Catalog launch trace

```text
Developer
    ↓ servicecatalog:ProvisionProduct
Service Catalog
    ↓ assumes
ApprovedServerlessLaunchRole
    ↓ invokes
CloudFormation
    ↓
creates approved stack
```

The developer does not receive the launch-role credentials.

---

## 27.3 Pipeline deployment trace

```text
CodePipeline
    ↓ assumes
ProductionDeploymentRole
    ↓
cloudformation:CreateChangeSet
    ↓ passes
ProductionCloudFormationRole
    ↓
CloudFormation creates resources
```

The deployment role and CloudFormation role should not have permission to read ordinary customer data merely because they deploy the application.

---

## 27.4 CodeDeploy trace

```text
CodePipeline
    ↓ starts deployment
CodeDeploy
    ↓ assumes
CodeDeployServiceRole
    ↓
manages target groups, task sets,
instances, or Lambda alias traffic
```

For EC2 deployments, the CodeDeploy agent on the instance also needs an instance profile and outbound service/artifact connectivity.

---

## 27.5 Systems Manager trace

```text
Operator
    ↓ ssm:StartAutomationExecution
Systems Manager Automation
    ↓ assumes
ApprovedAutomationRole
    ↓
changes approved resources
```

An operator can be allowed to start one approved runbook without being given all the runbook’s underlying resource permissions directly.

This resembles Service Catalog’s launch-role model.

---

# 28. Networking architecture

## 28.1 Control-plane deployment does not require workload-network connectivity

These operations use AWS service APIs:

```text
Service Catalog provisioning
CloudFormation stack update
StackSets deployment
CodePipeline action
CodeBuild start
Config evaluation
Systems Manager Automation API
```

The Platform account does not need VPC peering with every workload account merely to invoke these APIs.

---

## 28.2 Private integration tests may require connectivity

A CodeBuild test that calls:

```text
https://orders.internal.northstar
```

must have a real route to that private endpoint.

Possible designs include:

- run the test build inside the workload VPC;
- use a test runner in the target account;
- connect through Transit Gateway;
- expose the service through PrivateLink;
- invoke a test Lambda inside the workload VPC.

IAM permission to start the test does not create packet reachability.

---

## 28.3 Private EC2 deployment

An EC2 instance in a private subnet can receive CodeDeploy and Systems Manager instructions through outbound service connectivity.

It does not need:

```text
public IP
inbound SSH
direct connection from the pipeline server
```

The instance’s agents initiate HTTPS communication. CodeDeploy agent communication uses outbound HTTPS, and private designs can use supported VPC endpoints or approved egress paths for CodeDeploy and S3 artifacts. 

---

## 28.4 Cross-account artifacts

A production deploy action accesses an S3 artifact in the Platform account.

That requires:

```text
S3 bucket permission
KMS decrypt permission
cross-account role permission
```

It does not inherently require:

```text
VPC peering
Transit Gateway
shared subnet
```

---

## 28.5 Package access

A VPC-attached build can use:

```text
CodeArtifact interface endpoint
S3 gateway endpoint
CloudWatch Logs interface endpoint
```

It still needs NAT or a proxy when it must reach a public system such as an external Git host that is not mirrored internally.

---

# 29. Reliability and rollback

## 29.1 Platform outage versus workload outage

The Platform account can become temporarily unavailable while existing workloads continue running.

```text
Platform unavailable:
    new deployments blocked
    account baselines cannot update
    existing applications may still serve traffic
```

The recovery objectives for the deployment platform can therefore differ from the recovery objectives of customer-facing workloads.

---

## 29.2 Immutable artifacts

Rollback depends on preserving:

```text
previous application artifact
previous image digest
previous task definition
previous Lambda version
previous AMI
previous template
previous parameter values
```

A mutable `latest` reference weakens rollback because the old name may no longer identify the old content.

---

## 29.3 CloudFormation rollback limitation

CloudFormation can restore infrastructure configuration, but it cannot automatically undo every application or data effect.

Example:

```text
new Lambda version runs
    ↓
rewrites customer records incorrectly
    ↓
stack alarm triggers rollback
    ↓
old Lambda version restored
```

The corrupted records remain unless the application has a separate data-recovery mechanism.

---

## 29.4 Service Catalog rollback

A provisioned product can be updated to a previous supported product version if:

- the older version remains available;
- the template supports the transition;
- stateful resources are compatible.

Keeping a previous product version visible does not guarantee that every downgrade is safe.

---

## 29.5 StackSet partial failure

A StackSet operation may succeed in:

```text
57 accounts
```

and fail in:

```text
3 accounts
```

Northstar must distinguish:

- global operation status;
- per-account stack-instance status;
- retryable failures;
- policy or quota failures;
- accounts intentionally excluded.

Failure tolerance should stop broad rollout before a defective template affects the entire organization.

---

## 29.6 Patch rollback

Operating-system patches do not always support reliable uninstallation.

For immutable fleets, rollback usually means:

```text
replace nodes with previous AMI
```

For long-lived patched nodes, recovery may require:

- snapshot;
- AMI backup;
- package rollback;
- application restore;
- node replacement.

“Run patch command again” is not a rollback plan.

---

## 29.7 Dependency-repository failure

Because CodeArtifact caches approved dependencies, an outage of the original public repository does not necessarily prevent builds that use already retained package versions.

A build should fail closed rather than silently switch to an uncontrolled registry.

---

# 30. Cost model

Major platform costs include:

```text
CodeBuild compute
CodePipeline executions
CodeArtifact storage and requests
S3 artifacts
KMS keys and requests
Service Catalog API usage
Config recording and evaluations
Systems Manager Automation
CloudWatch Logs
EC2 Image Builder build instances
EBS snapshots for AMIs
temporary blue/green capacity
NAT and VPC endpoints
```

CloudFormation itself generally has no extra service charge for ordinary AWS resource management; the provisioned resources and certain extensions or related services carry their own charges. 

---

## 30.1 Standardization can reduce cost

Approved products can enforce:

```text
reasonable default sizes
short nonproduction retention
automatic scaling
mandatory owner and cost center
scheduled shutdown
lifecycle rules
approved storage classes
```

The platform can prevent every team from discovering cost practices independently.

---

## 30.2 Standardization can also institutionalize waste

A product that always creates:

```text
three NAT Gateways
large database
dedicated ALB
365-day logs
```

may be appropriate for production but wasteful for small development environments.

Use tiered products or parameters with safe bounds:

```text
development tier
standard production tier
business-critical tier
```

---

## 30.3 Build cost

Reduce build cost and time through:

- CodeArtifact dependency caching;
- CodeBuild caching;
- parallel tests where justified;
- right-sized build environments;
- avoiding repeated builds of the same artifact;
- promoting rather than rebuilding.

---

## 30.4 Blue/green cost

Blue/green temporarily runs:

```text
blue capacity
+
green capacity
```

For large fleets, this may approach double normal compute capacity.

The cost buys:

- pretraffic validation;
- reduced deployment interruption;
- faster traffic rollback.

---

## 30.5 AMI lifecycle

Every AMI can retain EBS snapshots.

Northstar automatically deprecates and eventually removes old images while retaining:

- current image;
- recent rollback candidates;
- images required by running launch templates;
- images required for investigations or legal retention.

---

## 30.6 Config cost

Config can become expensive in accounts with highly ephemeral resources because every creation, change, and deletion may produce configuration items and rule evaluations.

The platform should measure compliance value rather than indiscriminately enabling every rule for every ephemeral resource. The uploaded Control Tower material also warns that ephemeral workloads can increase Config cost. 

---

# 31. Changed-requirement variants

## Variant 1: Developers need arbitrary infrastructure

Service Catalog products are too restrictive for one advanced team.

Allow direct CloudFormation or CDK deployment through a bounded deployment role, while retaining:

- permissions boundaries;
- SCPs;
- proactive controls;
- Config;
- change sets;
- pipeline enforcement;
- approved artifact repositories.

Do not weaken every team’s platform because one team has a legitimate exception.

---

## Variant 2: Terraform is the organization standard

The architectural goals remain:

```text
approved modules
self-service
cross-account roles
plan review
immutable artifacts
policy checks
drift management
```

Service Catalog supports Terraform-oriented product workflows, or Northstar can use a separate controlled Terraform platform.

For SAP-C02, CloudFormation and StackSets remain the primary AWS-native exam model.

---

## Variant 3: Every workload is serverless

Remove:

- golden AMI pipeline;
- Patch Manager;
- CodeDeploy agent;
- EC2 instance profiles.

Retain:

- SAM;
- CodePipeline;
- CodeBuild;
- CodeArtifact;
- Service Catalog;
- Config;
- gradual Lambda deployment.

---

## Variant 4: Every workload uses Kubernetes

The internal platform exposes EKS namespaces, operators, or workload templates rather than ECS and Lambda products.

Use the Kubernetes interlude’s reasoning for:

- EKS access entries;
- Kubernetes RBAC;
- Pod Identity;
- network policies;
- cluster and workload scaling.

CloudFormation, pipelines, artifact governance, and account baselines remain relevant.

---

## Variant 5: Production cannot use manual approval

The company deploys hundreds of times per day and requires full automation.

Replace human approval with stronger automated evidence:

```text
policy checks
integration tests
security scans
canary deployment
automatic alarm rollback
progressive promotion
signed artifacts
```

Manual approval is not inherently safer than a mature automated gate.

---

## Variant 6: Regulatory policy requires human approval

Keep a manual approval action and ensure:

- approver is independent of developer;
- approval evidence is retained;
- emergency path is monitored;
- approval cannot be self-granted through role escalation.

---

## Variant 7: New baseline must reach all future accounts

Use a service-managed StackSet with OU targeting and automatic deployment.

Service Catalog alone is insufficient because it depends on a user electing to launch the product.

---

## Variant 8: Teams may choose whether to deploy a standard database

Expose the database as a Service Catalog product.

Do not use a StackSet, because the database should not automatically appear in every account.

---

## Variant 9: Existing estate already uses Change Manager

Continue using its change templates, approval hierarchy, Automation runbooks, and calendar integration while planning around its maintenance-only future.

Do not redesign a stable existing workflow merely because new accounts cannot adopt the service without first evaluating migration cost.

---

## Variant 10: Build environment must access an on-premises registry

Attach CodeBuild to suitable private subnets with:

- Transit Gateway or VPN/Direct Connect route;
- DNS resolution;
- security groups;
- on-premises firewall permission;
- certificate trust;
- approved fallback behavior.

A CodeArtifact IAM policy does not create connectivity to the on-premises registry.

---

# 32. Failure drills

## Failure A: Developer can view a Service Catalog product but cannot launch it

Investigate:

```text
servicecatalog:ProvisionProduct
portfolio access
product version status
launch constraint
launch-role trust
CloudFormation permission
target Region
```

---

## Failure B: Product launches, but underlying EC2 creation is denied

The developer’s own EC2 permission may be irrelevant.

Investigate:

```text
Service Catalog launch role
CloudFormation service role
SCP
permissions boundary
template resource
AMI sharing
service quota
```

---

## Failure C: Developer uses the product to create an administrator role

The launch role or template contract is too broad.

Investigate:

```text
IAM actions in provisioning role
arbitrary policy parameters
arbitrary role names
CAPABILITY_NAMED_IAM
template constraints
permissions boundary
```

---

## Failure D: New account lacks the platform baseline

Investigate:

```text
account OU
StackSet target
automatic deployment
trusted access
stack-instance status
Region selection
delegated administrator
```

---

## Failure E: StackSet succeeds in most accounts but fails in three

Investigate per stack instance:

```text
SCP
service quota
name collision
missing Region support
KMS permission
pre-existing resource
execution-role issue
```

Do not rerun the entire organization blindly.

---

## Failure F: StackSet does not deploy to the management account

Expected behavior for a service-managed StackSet.

Deploy any required management-account baseline separately. 

---

## Failure G: Change set shows database replacement

Do not approve automatically.

Determine:

```text
data migration
snapshot or retention
cutover
downtime
rollback
dependent applications
```

---

## Failure H: Stack update rolls back, but customer data remains corrupted

CloudFormation restored infrastructure, not business data.

Use the application’s backup, point-in-time recovery, or reconciliation process.

---

## Failure I: Stack is stuck in `UPDATE_ROLLBACK_FAILED`

Investigate:

```text
resource changed manually
missing permission
deleted dependency
name conflict
resource cannot return to old state
```

Correct the cause and continue rollback.

---

## Failure J: Drift detection reports a manual emergency fix

Decide whether the fix should:

```text
be incorporated into the template
```

or:

```text
be overwritten by restoring declared state
```

Do not simply ignore the drift indefinitely.

---

## Failure K: CodeBuild cannot download an approved package

Investigate:

```text
CodeArtifact token permission
sts:GetServiceBearerToken
repository read permission
domain policy
upstream configuration
VPC endpoint
DNS
token expiry
```

---

## Failure L: CodeBuild in a VPC cannot reach GitHub

VPC attachment changed the network path.

Investigate:

```text
private-subnet route
NAT or proxy
DNS
security-group egress
network firewall
GitHub allowlist
```

A CodeArtifact endpoint does not provide GitHub connectivity.

---

## Failure M: Cross-account deploy cannot decrypt artifact

Investigate:

```text
artifact bucket policy
KMS key policy
deployment-role permission
correct key ARN
cross-account action configuration
```

---

## Failure N: Pipeline deploys a different artifact than the one tested

The production stage rebuilt the application or used a mutable reference.

Promote the exact tested artifact digest instead.

---

## Failure O: New Lambda version produces 5xx responses only under load

Use:

```text
canary traffic
CloudWatch alarms
automatic CodeDeploy rollback
```

A successful function creation is not a successful application deployment.

---

## Failure P: CodeDeploy EC2 instance never receives the revision

Investigate:

```text
CodeDeploy agent
instance profile
outbound HTTPS
S3 artifact access
deployment-group tags
service role
agent logs
```

---

## Failure Q: Patch Manager reports node as unmanaged

Investigate:

```text
SSM Agent
instance profile
Systems Manager connectivity
Region
agent health
registration
```

---

## Failure R: Session Manager fails, but SSH works

Direct network access proves only the SSH path.

Investigate the separate Systems Manager path:

```text
SSM Agent
instance IAM role
service endpoint connectivity
operator IAM
session preferences
```

---

## Failure S: Patch command executes, but packages cannot be downloaded

Systems Manager connectivity works.

The operating-system package-repository network path does not.

Investigate NAT, proxy, repository mirror, DNS, and firewall configuration.

---

## Failure T: Config marks resource noncompliant after CloudFormation succeeds

CloudFormation created exactly what the template requested.

The template itself violates the Config rule.

```text
no drift
+
noncompliant
```

is possible.

---

## Failure U: Config remediation changes a resource that an operator already fixed

The remediation may have acted from stale compliance information.

The runbook should re-read current state and remain idempotent before applying changes.

---

## Failure V: Product version v3 is published, but existing applications remain on v2

Expected behavior.

Publishing a version makes it available; it does not automatically update every provisioned product.

---

## Failure W: Approved AMI is unavailable in one workload account

Investigate:

```text
distribution account list or OU
target Region
AMI launch permission
KMS key sharing
image-copy failure
product parameter
```

---

## Failure X: Auto Scaling replacement launches old AMI

The launch template still points to the old AMI, or an uncontrolled “latest” lookup resolved differently.

Pin and version the approved image explicitly.

---

## Failure Y: Manual console change fixes production but disappears later

CloudFormation, State Manager, an instance refresh, or immutable replacement restored declared state.

The emergency change must be reconciled into the authoritative definition.

---

# 33. SAP-C02 decision snippets

## CloudFormation versus CodeDeploy

**Create VPC, ALB, Auto Scaling group, and database:**

```text
CloudFormation
```

**Install a new application revision on existing EC2 instances:**

```text
CodeDeploy
```

---

## CloudFormation versus SAM

**General infrastructure:**

```text
CloudFormation
```

**Serverless shorthand that transforms into CloudFormation:**

```text
SAM
```

---

## StackSets versus Service Catalog

**Mandatory baseline in every target account:**

```text
StackSets
```

**Developer-selectable approved application product:**

```text
Service Catalog
```

**Need both:**

```text
StackSets distribute platform baseline.
Service Catalog provides self-service workloads.
```

---

## Launch constraint

**Requirement:** Developer may launch an approved stack without direct permission to create every underlying resource.

```text
Service Catalog launch constraint role
```

---

## Template constraint

**Requirement:** Limit which product parameters a user may select.

```text
Service Catalog template constraint
```

---

## CodePipeline versus CodeBuild versus CodeDeploy

```text
Coordinate stages
    → CodePipeline

Compile and test
    → CodeBuild

Deploy application revision
    → CodeDeploy
```

---

## CodeArtifact

**Requirement:** Central private dependency repository with controlled public upstreams.

```text
CodeArtifact
```

---

## EC2 Image Builder

**Requirement:** Repeatedly build, test, and distribute approved AMIs.

```text
EC2 Image Builder
```

---

## Change set versus drift detection

```text
Preview proposed stack update
    → change set

Identify out-of-band configuration difference
    → drift detection
```

---

## Termination protection versus stack policy

```text
Prevent deleting whole stack
    → termination protection

Protect selected resources from stack updates
    → stack policy
```

---

## `DeletionPolicy` versus `UpdateReplacePolicy`

```text
Stack deletion or resource removal
    → DeletionPolicy

Old physical resource after replacement
    → UpdateReplacePolicy
```

---

## Run Command versus State Manager

```text
Do this once now
    → Run Command

Keep this configuration true
    → State Manager
```

---

## Automation versus Maintenance Windows

```text
Multi-step operational workflow
    → Automation

Run tasks during controlled period
    → Maintenance Windows
```

---

## Patch Manager

```text
Select, scan, install, and report patches
    → Patch Manager
```

---

## Config remediation

```text
Config detects
    ↓
Systems Manager Automation corrects
```

---

## Proton

```text
Older SAP-C02 self-service platform-template scenario
    → recognize AWS Proton

New 2026 platform
    → Proton is not a viable new dependency
```

---

# 34. Retrieval practice

## 1

What business problem does Northstar Launchpad solve?

## 2

What are the three planes of the internal platform?

## 3

What are the four permission categories that should remain separate?

## 4

What is the difference between a CloudFormation template and a stack?

## 5

Which CloudFormation template section is universally required?

## 6

What can a change set show?

## 7

What can a change set not prove?

## 8

What is CloudFormation drift?

## 9

What is the difference between termination protection and a stack policy?

## 10

What is the difference between `DeletionPolicy` and `UpdateReplacePolicy`?

## 11

Why can a CloudFormation rollback fail?

## 12

What is a CloudFormation service role?

## 13

Why does a caller need `iam:PassRole` when attaching that role?

## 14

Why can permission to update a stack be security-sensitive?

## 15

What is a StackSet?

## 16

What is a stack instance?

## 17

What is the difference between service-managed and self-managed StackSet permissions?

## 18

What does automatic StackSet deployment do?

## 19

Why use failure tolerance and limited concurrency?

## 20

Does a service-managed StackSet deploy to the management account?

## 21

What are the four central Service Catalog objects?

## 22

What does a launch constraint do?

## 23

What does a template constraint do?

## 24

Why does a launch role not completely guarantee safe provisioning?

## 25

What is the difference between StackSets and Service Catalog?

## 26

Why does Northstar use both?

## 27

What happens to a SAM template during deployment?

## 28

How does SAM support canary Lambda deployment?

## 29

Why is AWS Proton not selected for this new platform?

## 30

What are the principal CodeArtifact concepts?

## 31

Why should production builds use a controlled repository and pinned dependencies?

## 32

What is the responsibility of CodePipeline?

## 33

What is the responsibility of CodeBuild?

## 34

What is the responsibility of CodeDeploy?

## 35

Why should production promote rather than rebuild the artifact?

## 36

What identities are involved in a central cross-account pipeline deployment?

## 37

Does central cross-account deployment inherently require VPC peering?

## 38

When should CodeBuild be attached to a VPC?

## 39

What is the difference between EC2 in-place and blue/green deployment?

## 40

Why can a database migration prevent blue/green rollback?

## 41

What is a golden AMI?

## 42

What are the stages of an Image Builder pipeline?

## 43

Why should a launch template use an explicit AMI ID?

## 44

What is the difference between immutable replacement and in-place patching?

## 45

What three things make an EC2 instance a Systems Manager managed node?

## 46

What is the difference between Session Manager and Run Command?

## 47

What is the difference between Run Command and State Manager?

## 48

What does Systems Manager Automation provide?

## 49

What do Patch Manager and Maintenance Windows each contribute?

## 50

What is the current organization-scale patching recommendation?

## 51

What is the difference between Config compliance and CloudFormation drift?

## 52

How does Config perform automatic remediation?

## 53

Why should a remediation runbook re-check current resource state?

## 54

Why should a manual emergency fix be added back to infrastructure as code?

## 55

What is the largest operational risk of StackSets?

---

# 35. Answer key

## 1

It gives developers self-service access to approved workload patterns while preserving organizational security, consistency, deployment controls, and team ownership.

## 2

Platform control plane, workload plane, and operations/compliance plane.

## 3

Developer request authority, provisioning authority, deployment authority, and runtime authority.

## 4

The template is the desired declarative definition. The stack is one deployed and managed instance of that definition.

## 5

`Resources`.

## 6

Which resources CloudFormation proposes to add, modify, replace, or remove.

## 7

That the deployment will succeed, that application behavior is correct, or that data migration and IAM are safe.

## 8

Actual resource configuration differing from the configuration represented by the stack template.

## 9

Termination protection prevents deleting the whole stack. A stack policy restricts updates to selected stack resources.

## 10

`DeletionPolicy` controls removal or stack deletion. `UpdateReplacePolicy` controls the old resource when an update replaces it.

## 11

A dependency may no longer exist, permissions may have changed, a resource may have drifted, or the previous configuration may no longer be restorable.

## 12

An IAM role CloudFormation assumes to create, update, or delete stack resources.

## 13

The caller is authorizing CloudFormation to use that role later.

## 14

The caller can cause CloudFormation to use the stack’s powerful service role through template and parameter changes.

## 15

A centrally managed CloudFormation template and configuration deployed across target accounts and Regions.

## 16

A reference to one target-account, target-Region stack belonging to a StackSet.

## 17

Service-managed permissions use Organizations trusted access. Self-managed permissions require explicitly created administration and execution roles.

## 18

It adds or removes stack instances as accounts enter or leave targeted OUs according to the configured retention behavior.

## 19

To constrain blast radius and stop a faulty operation before it affects every account.

## 20

No.

## 21

Portfolio, product, product version/provisioning artifact, and provisioned product.

## 22

It specifies the role Service Catalog uses to provision, update, or terminate the product.

## 23

It limits the product parameter values available to the user.

## 24

The launch role may be too broad, and an unsafe template can expose arbitrary IAM, networking, or policy inputs.

## 25

StackSets centrally push required stacks. Service Catalog lets users pull approved products through self-service.

## 26

StackSets install the mandatory platform baseline, while Service Catalog exposes optional approved workloads.

## 27

SAM transforms into ordinary CloudFormation resources and is deployed as a CloudFormation stack.

## 28

It can publish versions and aliases and configure CodeDeploy traffic shifting with alarms and hooks.

## 29

AWS Proton is closed to new customers and reaches end of support on October 7, 2026.

## 30

Domain, repository, package, package version, upstream repository, and external connection.

## 31

To reduce supply-chain risk and ensure the same source resolves to the same reviewed dependency versions.

## 32

Coordinate source, build, test, approval, deployment, and invocation actions.

## 33

Compile, test, package, and produce artifacts in a managed build environment.

## 34

Automate application deployment to supported compute environments.

## 35

Rebuilding may resolve different dependencies, base images, or tools and therefore produce a different artifact.

## 36

Pipeline service role, target-account deployment role, CloudFormation service role, and application runtime roles.

## 37

No. The deployment primarily uses AWS control-plane APIs, S3, KMS, and IAM.

## 38

When the build or test must reach a resource available only through the target VPC or connected private network.

## 39

In-place modifies existing instances. Blue/green creates a replacement environment and shifts traffic after validation.

## 40

Old and new application versions may run simultaneously, and a destructive schema change may make the old version incompatible with the data.

## 41

A centrally built, patched, hardened, and tested machine image approved for organizational use.

## 42

Base image, recipe, build components, test components, output image, and distribution.

## 43

To make the deployed fleet reproducible and prevent later “latest” resolution from silently changing the image.

## 44

Immutable replacement builds a new image and replaces nodes. In-place patching modifies running nodes.

## 45

SSM Agent, an appropriate IAM role, and network reachability to Systems Manager.

## 46

Session Manager provides an interactive shell. Run Command executes a specified command across targets.

## 47

Run Command performs a one-time operation. State Manager continually maintains desired configuration.

## 48

A multi-step operational or remediation workflow expressed as a runbook.

## 49

Patch Manager selects, scans, installs, and reports patches. Maintenance Windows control when and how disruptive tasks run.

## 50

Systems Manager Quick Setup patch policies for centralized multi-account and multi-Region configuration.

## 51

Config asks whether a resource satisfies an organizational rule. CloudFormation drift asks whether actual state differs from one stack’s template.

## 52

It invokes a Systems Manager Automation document using a remediation role.

## 53

Config may invoke remediation from previously recorded compliance state, and repeated execution must be safe.

## 54

Otherwise the next CloudFormation update, State Manager association, or immutable replacement may undo it and the declared architecture remains inaccurate.

## 55

A defective template or policy can be pushed across many accounts and Regions with a very large blast radius.

---

# 36. What to memorize now

```text
CloudFormation template
    → desired infrastructure

CloudFormation stack
    → deployed managed instance
```

```text
Change set
    → preview proposed changes

Drift detection
    → find out-of-band differences
```

```text
Termination protection
    → prevent stack deletion

Stack policy
    → protect resources from updates
```

```text
DeletionPolicy
    → deletion or removal

UpdateReplacePolicy
    → old resource after replacement
```

```text
StackSets
    → centrally push stacks
    → many accounts
    → many Regions
```

```text
Service Catalog
    → approved self-service products
```

```text
Product
    → approved template

Portfolio
    → products + access

Launch constraint
    → provisioning role

Template constraint
    → bounded parameters

Provisioned product
    → launched product instance
```

```text
SAM
    → serverless shorthand
    → transforms into CloudFormation
```

```text
CodeArtifact
    → controlled dependencies

CodeBuild
    → build and test

CodePipeline
    → orchestrate release

CodeDeploy
    → deploy application revision

CloudFormation
    → deploy infrastructure
```

```text
EC2 Image Builder
    → build
    → test
    → distribute approved AMIs
```

```text
Session Manager
    → interactive access

Run Command
    → do once now

State Manager
    → maintain desired state

Automation
    → multi-step runbook

Patch Manager
    → patch selection and execution

Maintenance Windows
    → controlled time window
```

```text
Config
    → detect noncompliance

Systems Manager Automation
    → remediate
```

```text
Developer role
    ≠
launch role
    ≠
CloudFormation service role
    ≠
application runtime role
```

```text
Cross-account deployment
    → IAM + S3 + KMS
    ≠
automatic VPC connectivity
```

```text
Infrastructure rollback
    ≠
data rollback
```

---

# 37. What can remain recognition-level

You do not yet need perfect recollection of:

- every CloudFormation intrinsic function;
- template macro implementation;
- custom-resource response syntax;
- drift-aware change-set deployment modes;
- StackSet concurrency-mode formulas;
- Service Catalog provisioning-artifact APIs;
- Service Catalog Terraform product internals;
- CodeArtifact package-format commands;
- CodeBuild batch-build matrices;
- CodePipeline action-provider configuration;
- CodeDeploy AppSpec syntax;
- Image Builder component-document syntax;
- Systems Manager Automation action names;
- Patch Manager baseline JSON;
- Change Calendar document format;
- Config custom-rule Lambda implementation;
- exact cross-account KMS policy statements;
- every Proton template concept.

The durable architecture is:

```text
Platform team
    ↓
defines approved infrastructure and artifacts
    ↓
StackSets push mandatory baselines
    ↓
Service Catalog exposes self-service products
    ↓
CloudFormation / SAM provision infrastructure
    ↓
CodePipeline coordinates promotion
    ↓
CodeBuild creates tested immutable artifacts
    ↓
CodeDeploy shifts application versions
    ↓
Config detects divergence
    ↓
Systems Manager operates and remediates
```

At every interaction, continue applying Lesson 0:

```text
Authorization:
    Who initiates the operation?
    Which role does the AWS service assume?
    Which role ultimately creates or changes resources?
    Which SCP, boundary, or resource policy limits it?

Networking:
    Is this a control-plane API call?
    Does a build or agent need a private endpoint?
    Does it require NAT, a VPC endpoint, or hybrid routing?
    Is cross-account access being confused with network connectivity?
```

# Lesson 6 — A Governed Internal Developer Platform

## CloudFormation, StackSets, Service Catalog, software supply chains, CI/CD, approved images, and operational change

## Source note

The planned curriculum defines Lesson 6 as a **governed internal developer platform** covering CloudFormation, StackSets, Service Catalog, SAM, Proton, CodeArtifact, CodeBuild, CodePipeline, CodeDeploy, approved templates and AMIs, deployment strategies, AWS Config, Systems Manager, rollback, and change control. 

The uploaded SAP-C02 material gives particular emphasis to:

- CloudFormation and StackSets for repeatable multi-account infrastructure;
- Service Catalog for self-service deployment of approved products;
- SAM as a serverless extension of CloudFormation;
- CodePipeline, CodeBuild, and CodeDeploy as complementary CI/CD services;
- Systems Manager for fleet configuration, patching, automation, and controlled access. 

The source’s comparison between StackSets and Service Catalog is especially important: StackSets centrally **pushes** standardized infrastructure to accounts and Regions, whereas Service Catalog lets authorized users **select and launch** curated products under constraints. The two services can be combined. 

Two current-service changes must be separated from the older study material:

1. AWS will end support for **AWS Proton on October 7, 2026**. It stopped accepting new customers on October 7, 2025. It remains relevant to older SAP-C02 questions and existing estates, but it should not be selected for a new platform in August 2026. 
2. Systems Manager **Change Manager** stopped accepting new customers on November 7, 2025. Existing customers can continue using it, so it remains recognition-level material rather than the baseline change-approval mechanism for this project. 

---

# 1. The project

## 1.1 Business brief

After establishing the multi-account landing zone in Lesson 5, Northstar Group now has:

```text
48 AWS accounts
4 business units
approximately 70 application teams
3 principal workload models:
    serverless
    containers
    EC2-based applications
```

The landing zone provides:

- account isolation;
- organizational controls;
- workforce federation;
- central logging;
- central configuration evidence;
- consolidated cost visibility.

But application delivery remains inconsistent.

One team creates infrastructure manually in the console. Another maintains private Terraform modules. A third copies an old CloudFormation template. Several teams build AMIs manually. Production deployments depend on wiki instructions and administrator access.

Common failures include:

```text
publicly reachable databases
missing backup policies
unrestricted IAM roles
different log retention in every account
unpatched EC2 instances
mutable container tags
production changes without review
developers waiting weeks for infrastructure tickets
```

The central platform team wants to provide a **paved road**:

> Developers should be able to create and deploy ordinary services without opening an infrastructure ticket, while the organization retains control over security, networking, cost, observability, and change risk.

---

## 1.2 Platform products

The initial platform offers three standardized products.

### Serverless API

```text
API Gateway
Lambda
DynamoDB
CloudWatch
X-Ray / OpenTelemetry
deployment pipeline
standard IAM roles
```

### ECS web service

```text
ECR
ECS on Fargate
ALB target group
CloudWatch
deployment pipeline
standard task roles
```

### EC2 application

```text
approved AMI
Auto Scaling group
ALB target group
Systems Manager
CodeDeploy
patch and replacement policy
standard instance role
```

Developers may customize approved parameters such as:

```text
service name
CPU and memory
minimum and maximum capacity
data classification
alarm thresholds
approved runtime
approved database class
```

They may not customize unrestricted parameters such as:

```text
arbitrary IAM policy
public database setting
unapproved AMI
unrestricted security group
unapproved Region
unencrypted storage
disabled logging
```

---

## 1.3 The platform principle

The platform separates four concerns:

```text
Definition
    What infrastructure and software should exist?

Provisioning
    Who creates it, using which authority?

Deployment
    How does a version move safely into production?

Operation
    How is the resulting system maintained and governed?
```

The principal AWS services map as follows:

```text
CloudFormation
    → define and provision infrastructure

StackSets
    → distribute common infrastructure across accounts and Regions

Service Catalog
    → expose approved products as self-service

CodeArtifact / ECR / S3
    → store dependencies and release artifacts

CodeBuild
    → compile, test, validate, and package

CodePipeline
    → coordinate release stages and approvals

CodeDeploy
    → deploy application revisions and shift traffic

EC2 Image Builder
    → create tested and approved AMIs or container images

Systems Manager
    → configure, access, patch, and automate managed nodes

AWS Config
    → detect and optionally remediate configuration violations
```

---

# 2. Constraint ledger

| Dimension | Requirement |
|---|---|
| Users | Approximately 70 development teams |
| Accounts | Development, staging, and production workload accounts |
| Self-service | Developers launch standard patterns without administrator tickets |
| Governance | Only approved infrastructure configurations |
| Identity | IAM Identity Center federation; no shared IAM users |
| Privilege | Developers should not need broad resource-creation permissions |
| Artifacts | Controlled internal package and image repositories |
| Infrastructure | Versioned, reviewable, repeatable infrastructure as code |
| Delivery | Same tested artifact promoted across environments |
| Production | Approval, change preview, health validation, and rollback |
| EC2 | Approved and patched AMIs only |
| Compliance | Continuous configuration evaluation |
| Operations | No public SSH; controlled remote administration |
| Networking | Private builds and workloads where required |
| Multi-account | New accounts automatically receive platform baselines |
| Extensibility | Platform team can add new products and versions |
| Exceptions | Controlled escape path for unusual workloads |
| Cost | Avoid one-off infrastructure and uncontrolled resource sizes |

---

# 3. Baseline architecture

```text
                              AWS Organization
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Platform Engineering account                                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Service Catalog hub                                                   │  │
│  │   portfolios                                                          │  │
│  │   products                                                            │  │
│  │   launch constraints                                                  │  │
│  │   template constraints                                                │  │
│  │   TagOptions                                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ CloudFormation StackSets delegated administration                    │  │
│  │   baseline roles                                                     │  │
│  │   pipeline deployment roles                                          │  │
│  │   Systems Manager configuration                                      │  │
│  │   observability resources                                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────── Software supply chain ────────────────────────────┐  │
│  │                                                                       │  │
│  │ CodeArtifact domain                                                   │  │
│  │   internal packages                                                   │  │
│  │   approved public upstreams                                           │  │
│  │                                                                       │  │
│  │ ECR repositories                                                      │  │
│  │ S3 pipeline artifact buckets                                          │  │
│  │ customer-managed KMS keys                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────── Delivery plane ───────────────────────────────┐  │
│  │                                                                       │  │
│  │ Source                                                                │  │
│  │   ↓                                                                   │  │
│  │ CodePipeline                                                          │  │
│  │   ↓                                                                   │  │
│  │ CodeBuild                                                             │  │
│  │   lint / test / policy / package / scan                               │  │
│  │   ↓                                                                   │  │
│  │ immutable artifact                                                    │  │
│  │   ↓                                                                   │  │
│  │ development deployment                                                │  │
│  │   ↓ integration tests                                                 │  │
│  │ staging deployment                                                    │  │
│  │   ↓                                                                   │  │
│  │ production CloudFormation change set                                  │  │
│  │   ↓ manual approval                                                   │  │
│  │ CloudFormation / CodeDeploy                                           │  │
│  │   ↓ alarms and rollback                                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────── Image factory ──────────────────────────────────┐  │
│  │ EC2 Image Builder                                                     │  │
│  │   base AMI → harden → install → test → scan → distribute              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Workload accounts                                                         │
│                                                                             │
│  Development account       Staging account       Production account        │
│  ┌──────────────────┐      ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Service Catalog  │      │ CloudFormation   │  │ CloudFormation       │  │
│  │ products         │      │ execution role   │  │ execution role       │  │
│  │                  │      │                  │  │                      │  │
│  │ CloudFormation   │      │ application      │  │ CodeDeploy           │  │
│  │ stacks           │      │ resources        │  │ deployment groups    │  │
│  │                  │      │                  │  │                      │  │
│  │ developer access │      │ pipeline role    │  │ restricted operator  │  │
│  └──────────────────┘      └──────────────────┘  └──────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Security/Audit account                                                     │
│                                                                             │
│  Config aggregator                                                          │
│  organization conformance packs                                             │
│  compliance dashboards                                                      │
│  remediation monitoring                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Architecture in one sentence

> The platform team distributes baseline roles and controls through StackSets, publishes approved infrastructure products through Service Catalog, builds artifacts through CodeBuild using controlled CodeArtifact and ECR repositories, orchestrates promotion with CodePipeline, provisions infrastructure through CloudFormation, deploys applications through CodeDeploy where appropriate, maintains approved AMIs through Image Builder, and continuously evaluates deployed resources through Config and Systems Manager.

---

# 4. Functional decisions at a glance

| Function | Baseline choice | Main reason |
|---|---|---|
| General infrastructure as code | CloudFormation | Native declarative AWS provisioning |
| Multi-account baseline | StackSets | Centrally push common stacks |
| Developer self-service | Service Catalog | Curated products with constrained parameters |
| Serverless shorthand | AWS SAM | Concise serverless syntax transformed into CloudFormation |
| Package repository | CodeArtifact | Controlled internal and upstream dependencies |
| Container registry | ECR | Immutable container artifacts |
| Generic build artifacts | S3 | Pipeline artifact exchange |
| Build and test | CodeBuild | Managed disposable build environments |
| Pipeline orchestration | CodePipeline | Stages, actions, artifacts, and approvals |
| EC2/Lambda/ECS application deployment | CodeDeploy where appropriate | Deployment lifecycle and traffic shifting |
| AMI production | EC2 Image Builder | Automated build, validation, testing, and distribution |
| EC2 remote access | Session Manager | No inbound SSH or bastion requirement |
| One-time fleet operation | Run Command | Execute commands at scale |
| Desired node state | State Manager | Reapply and report required configuration |
| Multi-step operational workflow | Systems Manager Automation | Runbook-based operations |
| Mutable fleet patching | Patch Manager | Patch policy, baselines, and compliance |
| Disruptive scheduled work | Maintenance Windows | Time-bounded operational work |
| Configuration detection | AWS Config | Resource-state and compliance evaluation |
| Automated remediation | Config + SSM Automation | Repair selected violations |
| Predeployment policy | CloudFormation Hooks / Guard | Reject bad infrastructure before creation |
| Production change preview | CloudFormation change set | Examine proposed modifications |
| Production approval | CodePipeline approval action | Pause release before execution |
| Infrastructure rollback | CloudFormation rollback | Restore prior stack state where possible |
| Application rollback | CodeDeploy or service-native rollback | Return traffic/code to prior revision |

---

# 5. The internal platform model

## 5.1 A paved road, not a ticket system

A weak platform says:

> Submit a request and the platform team will create your infrastructure.

A useful internal platform says:

> Select an approved product, provide a small number of business parameters, and receive a supported service with delivery, monitoring, security, and operations already configured.

The platform should reduce the cognitive load for common workloads.

```text
Developer supplies:
    service name
    business owner
    workload type
    capacity profile
    data classification

Platform supplies:
    IAM roles
    networking pattern
    encryption
    logs
    alarms
    pipeline
    deployment policy
    backup policy
    compliance controls
```

---

## 5.2 Paved road does not mean one design for everything

A platform product is appropriate when many teams share a sufficiently similar requirement.

Bad standardization:

```text
Every service must use DynamoDB,
including workloads requiring complex relational transactions.
```

Useful standardization:

```text
Every supported service receives:
    least-privilege deployment role
    central logs
    encryption
    owner and cost tags
    standard pipeline
    health alarms
```

The platform must offer an exception process for workloads that genuinely do not fit.

---

## 5.3 Product lifecycle

Each product has its own lifecycle:

```text
design
    ↓
security review
    ↓
implementation
    ↓
test account
    ↓
publish product version
    ↓
limited adoption
    ↓
general availability
    ↓
deprecation
    ↓
retirement
```

A product version should communicate:

- supported runtime versions;
- migration requirements;
- security status;
- compatibility;
- end-of-support date.

Publishing a new product version does not automatically mean every existing provisioned product has been updated.

---

# 6. CloudFormation foundations

## 6.1 Template, stack, and resource

A CloudFormation **template** is a declarative document describing desired AWS resources.

A **stack** is one deployed instance of that template in one account and Region.

```text
Template:
    reusable definition

Stack:
    deployed realization

Resources:
    actual S3 buckets, roles, queues, functions, and so on
```

The uploaded material describes CloudFormation as AWS’s principal infrastructure-as-code service and StackSets as its multi-account, multi-Region extension. 

---

## 6.2 Declarative desired state

The template says:

```yaml
OrdersQueue:
  Type: AWS::SQS::Queue
  Properties:
    VisibilityTimeout: 120
    MessageRetentionPeriod: 1209600
```

It does not normally say:

```text
1. Open the SQS console.
2. Click Create queue.
3. Enter the timeout.
4. Save the queue URL.
```

CloudFormation:

1. calculates dependencies;
2. calls the necessary APIs;
3. stores stack-resource relationships;
4. updates resources according to declared changes.

---

## 6.3 Important template sections

| Section | Purpose |
|---|---|
| `Parameters` | Values supplied when a stack is deployed |
| `Mappings` | Static lookup tables |
| `Conditions` | Conditional resource or property creation |
| `Resources` | AWS resources to provision |
| `Outputs` | Values exposed after deployment |
| `Metadata` | Additional information used by tools or interfaces |
| `Rules` | Validate parameter combinations |
| `Transform` | Process template extensions such as SAM |

`Resources` is the only required major section in an ordinary template.

---

## 6.4 Parameters are not secrets storage

A parameter can customize:

```text
environment
instance class
desired capacity
subnet IDs
alarm threshold
```

It should not normally contain a plaintext long-lived credential.

Use:

- Secrets Manager;
- Parameter Store secure values;
- CloudFormation dynamic references;
- workload identity through IAM roles.

`NoEcho` hides a parameter in some CloudFormation interfaces, but it does not convert the template or every downstream use into a secure secret store.

---

## 6.5 References and dependencies

CloudFormation infers a dependency when one resource references another.

```yaml
QueuePolicy:
  Properties:
    Queues:
      - !Ref OrdersQueue
```

Conceptually:

```text
OrdersQueue must exist
    before
QueuePolicy can reference it
```

Use explicit `DependsOn` only when the necessary dependency cannot be inferred from references or service behavior.

---

# 7. CloudFormation update behavior

## 7.1 Three broad update outcomes

A property change may cause:

### No interruption

The existing physical resource is modified in place.

### Some interruption

The resource remains the same physical resource but may be temporarily unavailable.

### Replacement

CloudFormation creates a new physical resource and later removes the old one.

AWS documents update behavior per property in each resource type. A seemingly small template edit can therefore replace a database, load balancer, or other resource. 

---

## 7.2 Logical ID versus physical ID

```text
Logical ID:
    ProductionDatabase

Physical ID:
    northstar-prod-db-abc123
```

The logical ID belongs to the template.

The physical ID identifies the deployed resource.

After a replacement, the logical ID can remain unchanged while the physical resource changes.

---

## 7.3 Replacement is not an ordinary edit

Suppose a proposed update changes a property that requires replacement:

```text
Old database
    ↓
CloudFormation creates new database
    ↓
dependent resources update
    ↓
CloudFormation deletes old database
```

That can affect:

- data;
- DNS endpoints;
- downtime;
- rollback;
- cost;
- dependent applications.

Never assume that declarative infrastructure means every update is nondisruptive.

---

# 8. CloudFormation change sets

## 8.1 What a change set does

A change set compares a proposed template and parameter set with the currently deployed stack.

It can show:

```text
Add OrdersDLQ
Modify OrdersQueue
Replace ProductionDatabase
Delete LegacyTopic
```

CloudFormation does not apply the modifications until the change set is executed. Change sets are specifically intended to reveal additions, modifications, removals, and replacements before a stack is changed. 

---

## 8.2 What a change set does not prove

A change set does not guarantee that execution will succeed.

Runtime failures may still arise from:

- service quotas;
- unavailable capacity;
- resource names that become unavailable;
- custom-resource behavior;
- IAM or KMS policies;
- service-side validation;
- external dependencies;
- health-check failures.

CloudFormation performs useful validation during change-set creation, but some runtime conditions cannot be proven in advance. 

---

## 8.3 Production flow

```text
Pipeline creates change set
    ↓
policy checks inspect it
    ↓
human or automated approval
    ↓
pipeline executes exact approved change set
```

The pipeline should not regenerate a different change set after approval unless the new plan is reviewed again.

---

## 8.4 Change set versus source diff

A Git diff might show:

```diff
- InstanceType: m6i.large
+ InstanceType: m7i.large
```

The CloudFormation change set shows the AWS consequence:

```text
EC2 instance:
    replacement
```

Both reviews matter:

```text
source review
    → intended code change

change-set review
    → intended infrastructure consequence
```

---

# 9. CloudFormation service roles

## 9.1 Default behavior

Without a service role, CloudFormation operates using a temporary session derived from the initiating principal’s credentials.

With a service role:

```text
Caller
    ↓ cloudformation:CreateStack / UpdateStack
CloudFormation
    ↓ assumes CloudFormationExecutionRole
AWS resource APIs
```

The service role allows CloudFormation to create, update, and delete resources independently of the caller’s direct resource permissions. 

---

## 9.2 Trust and permissions

### Trust policy

```text
Who may assume the role?
    CloudFormation service
```

### Permission policy

```text
What may CloudFormation create or modify?
    approved ECS, Lambda, S3, IAM, and monitoring resources
```

The platform should normally use different execution roles for products with materially different authority.

```text
ServerlessProductExecutionRole
ECSProductExecutionRole
EC2ProductExecutionRole
```

---

## 9.3 Important privilege-escalation risk

Once a service role is associated with a stack, CloudFormation continues to use it for later stack operations. A user who can operate that stack may indirectly use the role’s permissions even if the user does not personally have `iam:PassRole` for that role. AWS explicitly warns that an overly powerful CloudFormation service role can unintentionally escalate users who are allowed to update the stack. 

Therefore:

```text
cloudformation:UpdateStack
```

can be highly privileged when the stack has a powerful execution role.

Restrict both:

- which stacks a developer may operate;
- which resources and actions the execution role can perform.

---

## 9.4 `iam:PassRole`

The principal that initially associates a service role normally needs:

```text
iam:PassRole
```

This means:

> CloudFormation may use this approved execution role.

It does not mean that the developer becomes the role directly.

---

## 9.5 IAM capabilities

When a template creates IAM resources, the caller must explicitly acknowledge:

```text
CAPABILITY_IAM
```

or, for custom-named IAM resources:

```text
CAPABILITY_NAMED_IAM
```

This acknowledgment is a warning that the stack can change authorization. It is not a replacement for proper IAM permissions or template review. 

---

# 10. Protecting stateful resources

## 10.1 Termination protection

Stack termination protection prevents accidental deletion of the entire stack.

It does not prevent:

- stack updates;
- replacement during an update;
- direct modification of resources outside CloudFormation;
- data-level deletion by an application.

A stack with termination protection cannot be deleted until protection is disabled. 

---

## 10.2 Stack policy

A stack policy restricts which resources CloudFormation may update, replace, or delete during a stack update.

Example intention:

```text
Application resources may update.
ProductionDatabase may not be replaced or deleted.
```

A stack policy is a CloudFormation update safety mechanism, not a general IAM access policy. It applies to stack updates and does not authorize principals to call AWS APIs. 

---

## 10.3 `DeletionPolicy`

`DeletionPolicy` controls what happens when:

- the stack is deleted; or
- the resource is removed from the template.

Common values are:

```text
Delete
Retain
Snapshot
RetainExceptOnCreate
```

For example:

```yaml
ProductionDatabase:
  Type: AWS::RDS::DBInstance
  DeletionPolicy: Snapshot
```

CloudFormation can preserve or snapshot supported resources rather than deleting them immediately. `DeletionPolicy` does not protect the old physical resource when an update replaces it; that is handled separately. 

---

## 10.4 `UpdateReplacePolicy`

`UpdateReplacePolicy` controls the old physical resource when CloudFormation replaces it during an update.

Conceptually:

```text
DeletionPolicy:
    What happens when resource leaves the stack?

UpdateReplacePolicy:
    What happens to old physical resource after replacement?
```

A stateful production resource may use both.

---

## 10.5 Data rollback is separate

Suppose a deployment:

1. successfully adds a database column;
2. migrates values;
3. deletes old data;
4. later fails application health checks.

CloudFormation or CodeDeploy may restore the previous application version.

That does not automatically reconstruct the deleted data.

```text
Infrastructure rollback
    ≠
application rollback
    ≠
data rollback
```

Data changes require their own:

- backward-compatible migration;
- snapshot;
- point-in-time recovery;
- compensating transaction;
- tested restoration process.

---

# 11. CloudFormation rollback

## 11.1 Normal rollback

When a stack creation or update fails, CloudFormation normally attempts to return the stack to its previous stable state.

```text
UPDATE_IN_PROGRESS
    ↓ failure
UPDATE_ROLLBACK_IN_PROGRESS
    ↓
UPDATE_ROLLBACK_COMPLETE
```

CloudFormation can also monitor specified CloudWatch alarms as rollback triggers and roll back if an alarm enters `ALARM` during the monitoring period. 

---

## 11.2 `UPDATE_ROLLBACK_FAILED`

Rollback itself can fail because:

- a resource was modified manually;
- the old configuration is no longer valid;
- a resource was deleted outside CloudFormation;
- permissions changed;
- a dependency cannot be restored;
- a quota prevents reconstruction.

A stack in `UPDATE_ROLLBACK_FAILED` cannot receive a normal update until rollback is continued or repaired. The usual procedure is to fix the underlying problem and use `ContinueUpdateRollback`. 

---

## 11.3 Preserve successfully provisioned resources

For troubleshooting, CloudFormation can preserve resources that succeeded rather than rolling everything back immediately.

This can help inspect failures but leaves a partially provisioned environment that must be explicitly repaired. It should not be confused with a clean successful deployment. 

---

# 12. Drift detection

## 12.1 What drift means

A stack is drifted when the deployed configuration no longer matches the expected configuration represented by the template and parameters.

Example:

```text
Template:
    security group allows port 443

Actual resource:
    administrator manually added port 22
```

CloudFormation drift detection compares expected and current properties for supported resource types and reports modified, deleted, or otherwise differing resources. 

---

## 12.2 Drift is not automatically repaired

Drift detection answers:

> Does the deployed resource still match the stack definition?

It does not automatically choose whether:

- the template should adopt the manual change;
- the resource should be restored to the template;
- the resource should be imported;
- the manual change should remain as an exception.

The platform must define a reconciliation policy.

---

## 12.3 Preferred response

For an unauthorized manual change:

```text
detect drift
    ↓
confirm change is unauthorized
    ↓
update resource through CloudFormation
    ↓
remove direct mutation path
```

For a valid emergency change:

```text
document emergency
    ↓
update template to encode desired state
    ↓
reconcile or import resource
    ↓
review why normal pipeline was bypassed
```

---

# 13. Nested stacks and reusable modules

A large template can be divided into nested stacks.

```text
Root stack
    ├── network nested stack
    ├── application nested stack
    └── observability nested stack
```

Nested stacks are useful when components share one lifecycle and should be orchestrated under one root stack. Operations should normally begin from the root rather than modifying nested child stacks independently. 

Do not use nesting merely to split one file. Use it when there is a meaningful module and lifecycle boundary.

---

# 14. CloudFormation Hooks and policy as code

## 14.1 Predeployment validation

The platform wants to reject a template that proposes:

```text
public S3 bucket
unencrypted EBS volume
security group 0.0.0.0/0 on port 22
RDS database without backups
IAM role with Action: "*"
```

Possible layers include:

```text
CodeBuild:
    cfn-lint and policy checks before deployment

CloudFormation Guard:
    declarative policy-as-code rules

CloudFormation Hook:
    evaluate immediately before create, update, or delete

Control Tower proactive control:
    managed CloudFormation Hook behavior
```

CloudFormation Hooks can inspect templates, resources, or change sets before provisioning. Guard Hooks evaluate declarative CloudFormation Guard rules. 

---

## 14.2 Why check twice?

### CI validation

```text
fast developer feedback
before merge
```

### Deployment-time Hook

```text
enforcement even when another pipeline or user submits the stack
```

CI checks are useful but can be bypassed.

Deployment enforcement is stronger but provides later feedback.

Together:

```text
early feedback
+
hard deployment boundary
```

---

## 14.3 Hook versus Config rule

```text
CloudFormation Hook:
    evaluate before provisioning

Config rule:
    evaluate deployed resource state
```

A resource created outside CloudFormation may bypass a CloudFormation-only Hook but can still be detected by Config.

---

# 15. CloudFormation StackSets

## 15.1 StackSet, stack instance, and target

A StackSet contains:

```text
one CloudFormation template
+
deployment configuration
+
target accounts or OUs
+
target Regions
```

A **stack instance** represents the desired stack in one target account and Region.

```text
One StackSet:
    ManagedNodeBaseline

Stack instances:
    Account A / us-east-1
    Account A / eu-west-1
    Account B / us-east-1
    Account B / eu-west-1
```

StackSets can create, update, or delete stacks across many accounts and Regions in one operation. 

---

## 15.2 Baseline uses

Northstar uses StackSets to deploy:

- pipeline cross-account roles;
- CloudFormation execution roles;
- Systems Manager instance-profile foundations;
- standard CloudWatch alarms;
- EventBridge operational rules;
- organization-required Config resources not already supplied by Control Tower;
- approved KMS or logging policies where regional deployment is appropriate.

These are centrally mandated components.

Developers do not choose whether every production account receives them.

---

## 15.3 Service-managed permissions

For accounts in AWS Organizations, service-managed permissions use trusted access.

CloudFormation and Organizations establish the required service-linked role relationships, and the StackSet can target:

- the organization;
- one or more OUs;
- accounts under those OUs.

New accounts entering a targeted OU can receive stack instances automatically. 

### Best fit

```text
accounts are in one organization
OU targeting is useful
automatic deployment to new accounts is required
```

---

## 15.4 Self-managed permissions

Self-managed StackSets require explicitly configured roles.

Conceptually:

```text
StackSet administrator account
    ↓ assumes
AWSCloudFormationStackSetExecutionRole
in each target account
```

Use this model when:

- target accounts are outside the organization;
- explicit role relationships already exist;
- service-managed permissions are unavailable;
- custom trust control is required.

The uploaded Domain 1 material describes these two permission models directly. 

---

## 15.5 Delegated administrator

Northstar registers the Platform Engineering account as a delegated administrator for StackSets.

This avoids daily StackSet operation from the management account.

However, an important risk exists: a StackSets delegated administrator can deploy service-managed StackSets throughout the organization; the management account cannot restrict it to only particular OUs through the delegated-administrator registration itself. The platform account is therefore highly privileged. 

---

## 15.6 Automatic deployment

For a StackSet targeting the Production OU:

```text
new account enters Production OU
    ↓
StackSets automatically creates required stack instances
```

Northstar also chooses what happens when an account leaves the targeted OU:

```text
delete managed stack and resources
or
retain stack and resources but stop StackSet management
```

Automatic deployment is configured at the StackSet level rather than independently for every target OU or Region. 

---

## 15.7 Deployment controls

StackSet operation preferences include:

- Region order;
- sequential or parallel Regions;
- maximum concurrent accounts;
- failure tolerance;
- strict or soft failure-tolerance concurrency behavior.

A conservative rollout might use:

```text
lowest-impact Region first
one account at a time
zero tolerated failures
sequential Regions
```

AWS recommends beginning with small deployments and conservative operation preferences before expanding. 

---

## 15.8 Failure tolerance is not success

Suppose:

```text
100 target accounts
failure tolerance = 10
8 accounts fail
```

The overall operation may continue or report success within its configured tolerance.

That does not mean all 100 accounts are compliant.

Monitor individual stack-instance results and remediate failed targets.

---

## 15.9 Current limitations

StackSets with service-managed permissions do not support nested stacks or templates containing macros or transforms. This matters if a platform team attempts to distribute a SAM transform or another macro directly through that permission model. 

---

# 16. StackSets versus Service Catalog

## 16.1 StackSets is central push

```text
Platform team decides:
    Every production account must have this role.

StackSets:
    deploy it automatically.
```

The workload team is not selecting a product.

---

## 16.2 Service Catalog is governed pull

```text
Developer decides:
    I need a standard ECS service.

Service Catalog:
    lets the developer launch an approved product.
```

The platform team controls which options are available.

---

## 16.3 Comparison

| Question | StackSets | Service Catalog |
|---|---|---|
| Primary actor | Central administrator | Authorized end user |
| Main direction | Push | Self-service pull |
| Main scope | Accounts and Regions | Approved product launches |
| User chooses whether to launch? | Usually no | Yes |
| Standard baseline | Strong fit | Usually not primary fit |
| Curated application pattern | Possible but awkward | Strong fit |
| Parameter restrictions for user | Stack parameters and overrides | Template constraints and product interface |
| Separate launch role | StackSet execution role | Product launch constraint |
| Product/version experience | No | Yes |
| Portfolio by persona | No | Yes |

The uploaded exam notes explicitly recommend combining them when an organization needs both multi-account standardization and user-configurable approved products. 

---

# 17. AWS Service Catalog

## 17.1 Product

A Service Catalog product is an approved deployable definition.

Examples:

```text
Northstar Standard Serverless API
Northstar Standard ECS Service
Northstar Managed PostgreSQL Database
Northstar EC2 Worker
```

For the CloudFormation product type, the product is backed by a CloudFormation template. Every launched product becomes a CloudFormation-backed provisioned product. 

---

## 17.2 Portfolio

A portfolio groups products and controls who can use them.

```text
Application Developers portfolio:
    Serverless API
    ECS Service
    Static Website

Data Engineering portfolio:
    Glue Job
    S3 Data Product
    EMR Serverless Application

Database Administrators portfolio:
    PostgreSQL Database
    Redis Replication Group
```

A product can appear in more than one portfolio with different constraints.

---

## 17.3 Provisioned product

When a user launches a product:

```text
Service Catalog product
    ↓
CloudFormation stack
    ↓
provisioned product
```

The provisioned product is the user-visible managed instance of that catalog product.

---

## 17.4 Product versions

The platform publishes versions such as:

```text
ECS Service 1.0
ECS Service 1.1
ECS Service 2.0
```

A version can be active, inactive, or deleted in the source material’s model. Existing provisioned products are not automatically upgraded merely because a new version appears; an update operation is still required. 

---

# 18. Service Catalog constraints

## 18.1 Launch constraint

A launch constraint associates an IAM role with one product in one portfolio.

```text
Developer
    ↓ servicecatalog:ProvisionProduct
Service Catalog
    ↓ assumes approved launch role
CloudFormation
    ↓ creates product resources
```

The developer needs permission to use the catalog product but does not need direct permission to create every underlying resource. 

### Central IAM value

Without a launch constraint, a developer launching an ECS product might require:

```text
ecs:CreateService
iam:CreateRole
elasticloadbalancing:CreateTargetGroup
logs:CreateLogGroup
cloudwatch:PutMetricAlarm
```

With a launch constraint:

```text
Developer:
    may provision approved catalog product

Launch role:
    may create only the product's approved resources
```

---

## 18.2 Template constraint

A template constraint limits which parameter combinations users can select.

Example:

```text
Development:
    instance type ∈ {t3.small, t3.medium}

Production:
    instance type ∈ {m7g.large, m7g.xlarge}

Database:
    PubliclyAccessible must equal false
```

Template constraints are associated with a product in a particular portfolio. 

---

## 18.3 TagOptions

TagOptions present approved tag keys and values during product launch.

Example:

```text
BusinessUnit:
    Commerce
    Logistics
    Analytics

Environment:
    Development
    Staging
    Production
```

Selected values become tags on the provisioned product and supported resources. TagOptions can be shared with portfolios across accounts. 

---

## 18.4 Notification constraint

A notification constraint sends CloudFormation stack-event notifications to an SNS topic.

This can integrate product lifecycle events with:

- operational dashboards;
- ticket workflows;
- chat notifications;
- platform telemetry.

---

## 18.5 Stack Set constraint

A Stack Set constraint lets a Service Catalog product be deployed across selected accounts and Regions through CloudFormation StackSets.

This is appropriate when the **end user chooses the product**, but the product itself must have multi-account or multi-Region scope. 

---

## 18.6 Portfolio sharing

Northstar maintains portfolios in the Platform Engineering account and shares them through AWS Organizations.

Recipient account administrators can make imported products available to local users but cannot alter the centrally owned product definition. Shared portfolio references remain synchronized with the source portfolio. 

Service Catalog is Regional, so multi-Region availability still requires appropriate portfolio and product distribution. 

---

# 19. Service Catalog authorization trace

```text
1. Developer authenticates through IAM Identity Center.

2. Developer assumes PlatformDeveloper role in a workload account.

3. Role is allowed:
       servicecatalog:ProvisionProduct
   for the approved portfolio/product.

4. Developer selects:
       ECS Service product
       approved parameters

5. Template constraints validate the selections.

6. Service Catalog assumes:
       ECSProductLaunchRole

7. Service Catalog invokes CloudFormation.

8. CloudFormation uses the product's provisioning authority
   to create approved resources.

9. SCPs, permission boundaries, Hooks, and resource policies
   continue to apply.

10. Developer receives the provisioned product,
    not unrestricted infrastructure authority.
```

A launch constraint is not permission escalation when properly designed. It is controlled delegation to a narrowly defined product path.

---

# 20. Software supply-chain repositories

The platform uses three distinct artifact stores.

| Artifact | Service |
|---|---|
| Language packages | CodeArtifact |
| Container images | ECR |
| Pipeline bundles and generic files | S3 artifact bucket |

Do not treat them as interchangeable merely because they all store build outputs.

---

# 21. CodeArtifact

## 21.1 Domain

A CodeArtifact domain groups repositories under shared:

- storage and package metadata;
- KMS encryption;
- domain policies;
- package identity and deduplication;
- cross-account governance.

AWS recommends a central production domain for published organizational packages, with a separate preproduction domain where useful. 

Northstar creates:

```text
Domain:
    northstar-software
```

---

## 21.2 Repositories

Within the domain:

```text
public-upstream
internal-snapshots
internal-releases
commerce-releases
data-science-releases
```

A repository stores package versions for supported package formats.

Repositories can have upstream repositories, allowing one client endpoint to search a controlled chain. 

---

## 21.3 External connections

An external connection connects a CodeArtifact repository to a supported public package repository.

Conceptually:

```text
Build requests public package
    ↓
internal-releases repository
    ↓ upstream
public-upstream repository
    ↓ external connection
public package repository
```

Once retrieved, the package is available through CodeArtifact’s controlled path.

This supports:

- repeatability;
- reduced dependence on every build reaching the public registry;
- central package visibility;
- policy around which repository may connect externally.

---

## 21.4 Package promotion

A reasonable lifecycle is:

```text
Developer or CI publishes candidate
    ↓
internal-snapshots
    ↓ testing and policy
internal-releases
    ↓
production consumers
```

Production builds read only from the approved release repository.

They do not install directly from arbitrary Internet sources.

---

## 21.5 Cross-account access

CodeArtifact domains and repositories support resource policies.

A workload-account CodeBuild role needs:

- identity-based permission;
- domain or repository resource-policy permission where cross-account;
- an authorization token;
- KMS access as required.

Resource policies allow central repositories to be consumed without creating duplicate package stores in every workload account. 

---

## 21.6 Temporary authentication

Package managers authenticate through temporary CodeArtifact authorization tokens.

Tokens default to 12 hours and can be configured for shorter lifetimes, including alignment with the caller’s role session. 

The build role needs permissions such as:

```text
codeartifact:GetAuthorizationToken
sts:GetServiceBearerToken
codeartifact:GetRepositoryEndpoint
codeartifact:ReadFromRepository
```

AWS documents the separate STS service-bearer permission required to obtain a CodeArtifact token. 

---

# 22. CodeBuild

## 22.1 Purpose

CodeBuild provides disposable managed build environments that can:

- retrieve source or receive a CodePipeline source artifact;
- install dependencies;
- compile;
- run tests;
- perform infrastructure-policy validation;
- build Lambda packages;
- build container images;
- produce reports and artifacts.

The uploaded source simplifies CodeBuild as the compile-and-test component rather than the pipeline or deployment system. Current CodeBuild documentation also confirms that CodeBuild can directly use supported source providers; the durable distinction is that CodeBuild executes a build, whereas CodePipeline coordinates the overall release and CodeDeploy deploys application revisions.  

---

## 22.2 Build project

A CodeBuild project defines:

```text
source
build environment
compute size
service role
buildspec
network configuration
environment variables
cache
artifacts
logs
reports
timeout
```

The project is reusable across many builds.

---

## 22.3 Buildspec

A `buildspec.yml` contains phases such as:

```yaml
version: 0.2

phases:
  install:
    commands:
      - install-build-tools

  pre_build:
    commands:
      - authenticate-to-codeartifact
      - run-policy-checks

  build:
    commands:
      - compile
      - run-tests
      - build-artifact

  post_build:
    commands:
      - publish-test-reports
      - write-artifact-manifest

artifacts:
  files:
    - packaged-template.yaml
    - application.zip
```

The buildspec is the build procedure, not the complete pipeline.

---

## 22.4 CodeBuild service role

CodeBuild assumes a service role for operations such as:

- reading source or pipeline artifacts;
- downloading CodeArtifact packages;
- writing artifacts;
- pushing an ECR image;
- writing logs;
- reading approved build secrets;
- publishing test reports.

Use different roles for materially different projects.

A documentation build should not inherit the role used to publish production containers.

---

## 22.5 Build reports

CodeBuild can collect test result files into report groups.

This gives the pipeline structured evidence such as:

```text
1,842 tests
1,838 passed
4 failed
coverage 87%
```

rather than relying exclusively on unstructured console output. 

---

## 22.6 Build cache

A cache can reduce repeated downloads or compilation.

But a cache is not an immutable release artifact.

```text
Cache:
    performance optimization

Artifact:
    output promoted and deployed
```

A bad cache key can reuse incompatible dependencies, so correctness must not depend on unvalidated cache content.

---

# 23. CodeBuild networking

## 23.1 Default networking

A normal managed CodeBuild environment can reach supported source and AWS service endpoints without being attached to Northstar’s VPC.

Attach CodeBuild to a VPC only when the build or test needs private resources such as:

- a private integration-test database;
- an internal package proxy;
- a private service endpoint;
- an on-premises test system;
- a private license server.

---

## 23.2 VPC-attached CodeBuild

When configured for a VPC, CodeBuild creates network interfaces in the selected subnets.

It does not receive a public IP address.

A VPC-attached build that needs public endpoints therefore requires:

```text
private subnet
    ↓
NAT Gateway or approved proxy
    ↓
Internet Gateway
```

Placing the build in a public subnet is not sufficient because the managed ENI is not assigned a public or Elastic IP. 

---

## 23.3 Private service access

Northstar uses endpoints where appropriate:

```text
S3 gateway endpoint
CodeArtifact API interface endpoint
CodeArtifact repository interface endpoint
ECR API endpoint
ECR registry endpoint
CloudWatch Logs endpoint
Secrets Manager endpoint
STS endpoint
```

CodeArtifact requires separate endpoints for its control API and its package-repository traffic. 

---

## 23.4 Private integration tests across accounts

Suppose CodeBuild runs in the Platform account and must test:

```text
private API in the Staging account
```

Assuming a role in Staging solves authorization.

It does not create a packet path.

Northstar needs one of:

- Transit Gateway connectivity;
- VPC peering;
- PrivateLink;
- a build project placed in the Staging VPC/account;
- another approved test endpoint.

```text
Cross-account role
    ≠
cross-VPC connectivity
```

---

# 24. CodePipeline

## 24.1 Pipeline, stage, and action

```text
Pipeline:
    entire release workflow

Stage:
    logical phase

Action:
    one operation within a stage
```

Example:

```text
Pipeline: OrdersService

Stage: Source
    Action: retrieve commit

Stage: Build
    Action: CodeBuild tests
    Action: security analysis

Stage: DeployDevelopment
    Action: CloudFormation change set
    Action: execute change set

Stage: Test
    Action: integration tests

Stage: DeployProduction
    Action: create production change set
    Action: manual approval
    Action: execute
```

The uploaded guide makes the same distinction among pipelines, stages, actions, revisions, transitions, and artifacts. 

---

## 24.2 CodePipeline is an orchestrator

CodePipeline does not normally compile the application itself.

It tells CodeBuild to build.

It does not by itself implement every application deployment lifecycle.

It invokes CloudFormation, CodeDeploy, ECS, Lambda, or another action provider.

```text
CodePipeline:
    when and in what order

CodeBuild:
    build and test

CloudFormation:
    provision infrastructure

CodeDeploy:
    deploy application revision
```

---

## 24.3 Artifacts

Actions exchange immutable pipeline artifacts through an S3 artifact store.

Examples:

```text
source bundle
compiled package
packaged CloudFormation template
AppSpec file
task-definition file
test manifest
```

Container images normally go to ECR, while the pipeline artifact can contain the image digest or deployment manifest.

---

## 24.4 Manual approval

A manual approval action pauses the pipeline.

The approver receives information such as:

- change-set summary;
- test results;
- vulnerability report;
- release notes;
- operational risk;
- ticket reference.

The approver needs permission to approve or reject the pipeline action but does not need broad production administrator access. 

---

# 25. Cross-account pipeline

## 25.1 Central pipeline model

Northstar keeps pipeline orchestration in the Platform account and deploys into:

```text
Development account
Staging account
Production account
```

The Platform account contains:

- pipeline;
- artifact bucket;
- artifact KMS key;
- build projects;
- central source connection.

Each target account contains a cross-account action role.

---

## 25.2 Authorization path

```text
CodePipeline service role
    ↓ sts:AssumeRole
ProductionPipelineActionRole
    ↓
CloudFormation / CodeDeploy APIs
    ↓
Production resources
```

The target role trust policy accepts the Platform account pipeline role.

The target role permission policy defines what the action can deploy.

---

## 25.3 Artifact encryption

Cross-account actions need access to the shared artifact bucket and its encryption key.

A customer-managed KMS key is normally used with a key policy permitting the required cross-account roles. For cross-account CodePipeline actions, KMS aliases cannot substitute for the key ARN or key ID because aliases are account-local. 

---

## 25.4 No VPC peering is inherently required

The central pipeline invokes AWS control-plane APIs and exchanges artifacts through S3.

This is primarily:

```text
IAM
STS
S3
KMS
service API access
```

It does not inherently require VPC peering between the Platform and Production VPCs.

Private integration tests are different because they actually send packets to private endpoints.

---

## 25.5 Cross-Region actions

A pipeline can contain actions in another Region, but CodePipeline requires an artifact store in each action Region.

```text
Pipeline Region A
    artifact bucket A

Deployment action Region B
    artifact bucket B
```

CodePipeline copies the required artifacts into the action’s Region. 

---

# 26. The baseline release pipeline

```text
1. Source revision received.

2. CodeBuild retrieves dependencies through CodeArtifact.

3. Static analysis and unit tests run.

4. CloudFormation templates are linted.

5. CloudFormation Guard policies are evaluated.

6. Application artifact or container image is built.

7. Artifact is scanned and assigned an immutable identity.

8. Development change set is created and executed.

9. Integration tests run against development.

10. Staging change set is created and executed.

11. Performance and compatibility tests run.

12. Production change set is created.

13. Change set, test evidence, and release notes are reviewed.

14. Authorized approver approves.

15. The exact approved change set is executed.

16. Application revision is deployed or traffic shifted.

17. CloudWatch alarms and synthetic tests monitor the release.

18. Pipeline completes or rolls back.
```

The same built artifact is promoted across environments. Production is not rebuilt from source after staging approval.

---

# 27. CodeDeploy

## 27.1 Core objects

```text
Application:
    identifies the deployment target family

Deployment group:
    target selection, deployment configuration,
    service role, alarms, rollback settings

Revision:
    application version being deployed

AppSpec:
    deployment files, hooks, and target instructions

Deployment:
    one attempt to install or shift to a revision
```

CodeDeploy supports EC2/on-premises, Lambda, and ECS compute platforms. 

---

## 27.2 EC2 and on-premises deployment

EC2 and on-premises deployments use the CodeDeploy agent.

The agent:

- receives deployment instructions;
- downloads the application revision;
- runs lifecycle hooks;
- installs files;
- reports status.

It communicates outbound over HTTPS port 443. Private EC2 instances therefore need CodeDeploy/S3 endpoints or a NAT path. 

---

## 27.3 CodeDeploy service role versus instance role

### CodeDeploy service role

Allows the CodeDeploy service to:

- inspect target groups;
- interact with Auto Scaling;
- shift load-balancer traffic;
- manage deployment lifecycle resources.

### EC2 instance role

Allows the target instance to:

- retrieve application revisions;
- access required S3 objects;
- communicate with related AWS services.

### Application runtime role

Allows the deployed application to perform its business operations.

These are distinct authorities even when one EC2 instance uses one instance profile for several target-side needs.

---

# 28. Deployment strategies

## 28.1 In-place EC2 deployment

CodeDeploy updates the existing instances.

```text
Instance leaves service
    ↓
old application stopped
    ↓
new revision installed
    ↓
new application started and validated
    ↓
instance returns to service
```

Advantages:

- low additional infrastructure cost;
- simpler capacity model;
- existing instances retained.

Disadvantages:

- rollback means redeploying the previous revision;
- installation can leave host residue;
- reduced capacity during deployment;
- bad scripts can damage the existing host.

The uploaded guide associates in-place deployments with EC2 and on-premises fleets where interruptions or rolling reduction are acceptable. 

---

## 28.2 EC2 blue/green deployment

```text
Blue:
    existing Auto Scaling fleet

Green:
    replacement fleet
```

The new revision is installed on green.

After validation, the load balancer shifts production traffic to green.

Advantages:

- clean replacement hosts;
- old environment retained temporarily;
- fast traffic rollback;
- production validation before cutover.

Disadvantages:

- temporary duplicate capacity;
- data/schema compatibility requirements;
- environment provisioning time;
- session and state migration concerns.

For the EC2/on-premises CodeDeploy platform, blue/green is available for EC2 replacement instances, not ordinary registered on-premises instances. 

---

## 28.3 Lambda deployment

Lambda CodeDeploy shifts an alias from one function version to another.

Strategies include:

```text
All-at-once:
    100% immediately

Canary:
    small percentage
    wait
    remaining traffic

Linear:
    equal increments
    repeated intervals
```

CloudWatch alarms can stop and roll back the deployment.

---

## 28.4 ECS deployment

For CodeDeploy-controlled ECS blue/green:

```text
Blue task set
    current production target group

Green task set
    replacement target group

CodeDeploy
    shifts ALB/NLB traffic
```

Canary, linear, and all-at-once strategies are available according to the compute platform and load-balancer configuration. The uploaded material focuses on these traffic-shifting models for Lambda and ECS/Fargate. 

Lesson 4 also introduced current native ECS blue/green deployment. CodeDeploy remains important for existing environments and exam questions describing CodeDeploy applications, deployment groups, AppSpec files, task sets, and traffic-shifting configurations.

---

## 28.5 Canary versus linear

### Canary

```text
10% traffic
    ↓ wait 10 minutes
90% traffic
```

Best when:

- a small representative sample is sufficient;
- a clear bake period is desired;
- rapid full shift follows validation.

### Linear

```text
10% every 5 minutes
```

Best when:

- gradual exposure is preferred;
- risk should increase incrementally;
- metrics need observation at several traffic levels.

---

## 28.6 Deployment rollback does not undo all side effects

CodeDeploy can restore traffic to an old revision.

It does not automatically undo:

- database migrations;
- messages already published;
- emails already sent;
- payment operations;
- incompatible cache contents;
- external API side effects.

Application design still requires:

- idempotency;
- backward-compatible schemas;
- feature flags;
- compensating actions;
- migration rollback plans.

---

# 29. AWS SAM

## 29.1 Relationship to CloudFormation

AWS SAM provides a concise syntax for serverless resources.

```yaml
Transform: AWS::Serverless-2016-10-31

Resources:
  OrdersFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: python3.13
      Handler: app.handler
      Events:
        OrdersApi:
          Type: Api
```

During deployment, SAM transforms serverless resources into ordinary CloudFormation resources. SAM therefore extends CloudFormation rather than replacing it.  

---

## 29.2 What SAM simplifies

SAM provides higher-level definitions for concepts such as:

- Lambda functions;
- APIs;
- state machines;
- event sources;
- layers;
- serverless connectors.

The rest of the template can still contain ordinary CloudFormation resources.

---

## 29.3 SAM CLI

The SAM CLI can:

- build function packages;
- run selected workloads locally;
- invoke functions;
- start a local API approximation;
- package local code;
- deploy through CloudFormation.

`sam deploy` packages local artifacts and deploys the resulting CloudFormation application. 

---

## 29.4 Safe Lambda deployment

SAM can define an alias and deployment preference that produces the CodeDeploy resources needed for canary or linear Lambda deployment.

Conceptually:

```yaml
AutoPublishAlias: live

DeploymentPreference:
  Type: Canary10Percent10Minutes
  Alarms:
    - !Ref FunctionErrorAlarm
```

The serverless product can therefore make safe traffic shifting part of the approved template rather than requiring every team to construct it independently.

---

## 29.5 SAM versus CloudFormation

```text
General AWS infrastructure:
    CloudFormation

Concise serverless application definition:
    SAM, transformed into CloudFormation
```

SAM should not be selected merely because the architecture contains one Lambda function. It is most valuable when serverless resources are a central unit of application deployment.

---

# 30. AWS Proton

## 30.1 Source-era role

The uploaded material describes Proton as a service through which platform teams published approved environment and service templates for container and serverless workloads. Developers selected those templates through a self-service interface, and Proton coordinated infrastructure and CI/CD. 

That service model closely resembles the goal of this lesson:

```text
platform team defines standardized templates
developers instantiate approved services
CI/CD is attached automatically
```

---

## 30.2 Current status

AWS is discontinuing Proton on October 7, 2026. Existing CloudFormation stacks and deployed infrastructure remain after the service ends, but Proton’s delivery and management plane will no longer be available. AWS identifies alternatives including CloudFormation Git Sync and other infrastructure-as-code and pipeline approaches. 

Therefore:

```text
Older SAP-C02 scenario explicitly describing Proton templates:
    recognize Proton

New August 2026 platform:
    do not adopt Proton
```

Northstar instead combines:

```text
Service Catalog
CloudFormation
CodePipeline
CodeBuild
organization templates
```

to achieve the same broad business goal with supported services.

---

# 31. Approved AMIs with EC2 Image Builder

## 31.1 Why approved AMIs matter

A manually launched EC2 instance can use an image containing:

- unpatched packages;
- unauthorized agents;
- old credentials;
- incorrect logging;
- unsupported operating systems;
- inconsistent monitoring.

The platform team wants every standard EC2 product to begin from a tested image.

---

## 31.2 Image pipeline

```text
Approved base image
    ↓
build components
    install SSM Agent configuration
    install monitoring agent
    apply security hardening
    install runtime
    remove unnecessary software
    ↓
validation
    ↓
create candidate AMI
    ↓
launch test instance
    ↓
test components
    boot test
    SSM registration test
    vulnerability test
    application health test
    ↓
distribution
    target accounts
    target Regions
    launch-template update
```

EC2 Image Builder supports recipes, build and test components, pipeline scheduling, VPC infrastructure configuration, tests, KMS encryption, cross-account distribution, and launch-template integration. 

---

## 31.3 Image recipe

An image recipe specifies:

```text
base image
version
build components
test components
block-device configuration
```

A recipe is versioned so that the platform can reproduce how an AMI was created.

---

## 31.4 Build versus test components

### Build component

Changes the image:

```text
install runtime
apply hardening
configure agents
remove software
```

### Test component

Verifies the produced image:

```text
service starts
required port listens
SSM registration works
disk encryption exists
prohibited package absent
```

Image Builder distributes the image only after configured tests succeed. 

---

## 31.5 Distribution

The image pipeline can:

- copy AMIs to approved Regions;
- share or distribute them to workload accounts;
- apply KMS encryption;
- update launch-template versions;
- emit notifications.

Image Builder also integrates with AWS Organizations and RAM for central sharing and approved-image governance. 

---

## 31.6 Immutable fleet pattern

For an Auto Scaling fleet:

```text
Patch released
    ↓
Image Builder creates AMI v24
    ↓
tests pass
    ↓
launch template points to v24
    ↓
instance refresh or blue/green replacement
    ↓
old instances terminated
```

This is usually preferable to indefinitely patching the same production instances in place.

---

## 31.7 Image Builder versus Patch Manager

```text
Replaceable Auto Scaling fleet:
    rebuild image and replace instances

Long-lived mutable server:
    Patch Manager may patch it in place
```

Both services can coexist.

The decision follows workload lifecycle rather than a rule that one patching method is universally superior.

---

# 32. Systems Manager managed nodes

## 32.1 Requirements

An EC2 instance becomes a Systems Manager managed node when it has:

- SSM Agent;
- an IAM instance profile or another supported managed-node identity;
- network reachability to required Systems Manager endpoints;
- a supported operating environment.

SSM Agent receives instructions from the Systems Manager service and executes them on the node. 

---

## 32.2 IAM instance role

A standard EC2 platform product attaches a managed-node role.

The role permits the agent to:

- register and maintain its managed-node channel;
- receive commands;
- return command output;
- interact with approved logging or S3 destinations where configured.

It does not need general administrator access to the account.

---

## 32.3 Network path

A private instance can reach Systems Manager through:

```text
NAT Gateway
```

or private interface endpoints such as the relevant:

```text
ssm
ssmmessages
and, in some environments, ec2messages
```

Systems Manager endpoints allow management without public inbound access. 

The node initiates outbound connections. Session Manager does not require inbound TCP port 22.

---

# 33. Systems Manager tools

## 33.1 Session Manager

Session Manager provides interactive shell and port-forwarding access without:

- public IP addresses;
- inbound SSH;
- bastion hosts;
- distributing SSH private keys.

IAM controls who may start sessions, and session activity can be logged according to configuration. 

Use Session Manager for:

```text
interactive investigation
controlled administration
port forwarding
emergency diagnostics
```

Do not use it as the normal application deployment process.

---

## 33.2 Run Command

Run Command performs a one-time command across one or more managed nodes.

Examples:

```text
restart a service
collect diagnostics
remove a compromised certificate
run one maintenance script
```

Run Command is an imperative operation:

> Execute this command now against these targets.

It is not automatically a continuously maintained desired-state declaration. 

---

## 33.3 State Manager

State Manager creates associations describing required state.

Examples:

```text
CloudWatch agent must be installed.
SSM Agent must remain current.
A configuration file must have approved contents.
Inventory collection must run periodically.
```

When new Auto Scaling instances match the association target, State Manager can apply the required configuration and report compliance. 

### Memory rule

```text
Run Command:
    do this once

State Manager:
    maintain this state
```

---

## 33.4 Automation

Systems Manager Automation executes multi-step runbooks against AWS resources and managed nodes.

Examples:

```text
create an AMI
stop instance
snapshot volumes
modify configuration
restart instance
validate health
restore on failure
```

Automation runbooks are YAML or JSON documents containing steps, parameters, actions, and outputs. 

### Memory rule

```text
Run Command:
    command on nodes

Automation:
    multi-step operational workflow
```

---

## 33.5 Patch Manager

Patch Manager:

- scans managed nodes;
- installs approved patches;
- uses patch baselines or patch policies;
- reports compliance;
- controls concurrency and error thresholds.

Current AWS guidance recommends Systems Manager Quick Setup patch policies for organization-wide multi-account and multi-Region patching. Patch Manager does not itself test the publisher’s patches against Northstar’s application. 

Northstar uses rings:

```text
development
    ↓
canary production group
    ↓
ordinary production
```

---

## 33.6 Maintenance Windows

A Maintenance Window defines when potentially disruptive work may begin.

It can coordinate several task types within:

```text
start time
duration
cutoff
target set
task priority
concurrency
error threshold
```

Use it for:

- patching;
- driver updates;
- software installation;
- coordinated restart;
- database-client update.

Actions that started before the cutoff can finish after the window, but new actions will not begin outside the permitted start period. 

---

## 33.7 State Manager versus Maintenance Windows

```text
Maintain configuration continuously:
    State Manager

Perform disruptive work in an approved period:
    Maintenance Windows
```

The uploaded exam notes particularly associate Patch Manager with Maintenance Windows rather than custom cron scripts. 

---

## 33.8 Patch source networking

Systems Manager endpoints provide the management channel.

They do not automatically contain every operating-system package.

A private Linux server may still need access to:

- Amazon Linux repositories;
- Ubuntu repositories;
- Red Hat repositories;
- internal package mirrors;
- Windows Update infrastructure.

An isolated node can successfully connect to Systems Manager and still fail to download patches. 

---

## 33.9 Distributor

Distributor packages and distributes software to managed nodes.

A package can be installed:

- once through Run Command;
- recurrently through State Manager.

Examples:

```text
approved security agent
internal monitoring agent
corporate certificate bundle
licensed administration tool
```

The uploaded Systems Manager material explicitly maps Distributor packages to Run Command and State Manager. 

---

## 33.10 Change Calendar

Change Calendar represents open and closed periods for operational changes.

Automation workflows can check a calendar before modifying resources.

```text
Calendar open:
    approved change period

Calendar closed:
    production freeze
```

A calendar expresses timing policy. It does not itself perform a deployment or supply a full approval workflow. 

---

## 33.11 Change Manager

For existing customers, Change Manager supports:

- change templates;
- change requests;
- multiple approval levels;
- execution of approved Automation runbooks;
- organization-wide delegated administration.

The uploaded cheat sheet describes up to five levels of approvers and execution through an associated Automation runbook. 

For a new Northstar platform, Change Manager is not selected because it is closed to new customers. Northstar instead uses:

```text
CodePipeline approvals
ticket/change-system integration
Step Functions where a custom approval workflow is required
Systems Manager Automation
Change Calendar
CloudTrail
```

---

# 34. AWS Config in the platform

## 34.1 Prevent, detect, and remediate

The platform uses three layers.

### Prevent

```text
Service Catalog constraints
CloudFormation Hooks
SCPs
IAM permissions
```

### Detect

```text
AWS Config rules
CloudFormation drift detection
security findings
```

### Remediate

```text
Systems Manager Automation
pipeline correction
operator workflow
```

No single layer covers every creation path or every runtime change.

---

## 34.2 Config rules

Examples:

```text
EC2 instances must use approved AMIs.
EBS volumes must be encrypted.
S3 public access must be blocked.
Required tags must exist.
RDS public access must be disabled.
CloudTrail must remain enabled.
Security groups must not expose SSH globally.
```

A Config rule evaluates deployed resource configuration.

It does not normally stop the original API call that created the bad resource.

---

## 34.3 Automatic remediation

Config can associate a noncompliant rule result with a Systems Manager Automation document.

```text
Config detects:
    S3 public access block disabled

Automation:
    restore public access block
```

Config supports both manual and automatic remediation through Systems Manager Automation documents. 

---

## 34.4 Remediation risks

Automatic remediation is appropriate when:

- the correct state is unambiguous;
- the action is safe;
- the repair is idempotent;
- business interruption is acceptable;
- remediation has been tested.

Bad automatic remediation can cause:

```text
application changes resource
Config reverses change
application changes it again
Config reverses it again
```

or:

```text
Config automatically terminates a noncompliant
but business-critical instance
```

Some findings should open an incident rather than mutate production immediately.

---

## 34.5 Conformance packs

A conformance pack groups:

- Config rules;
- parameters;
- optional remediation actions.

Northstar deploys organization conformance packs for:

```text
Production baseline
Nonproduction baseline
Data platform baseline
EC2 managed-node baseline
```

AWS Config can centrally deploy organization conformance packs across member accounts and specify exclusions. 

---

# 35. The approved ECS product

A developer launches:

```text
Northstar Standard ECS Service 2.3
```

The product asks for:

```text
ServiceName
ContainerPort
CPUProfile
MemoryProfile
MinimumTasks
MaximumTasks
PublicOrInternal
BusinessOwner
CostCenter
DataClassification
```

The product provisions:

```text
ECR repository
ECS task definition
ECS service
target group
listener rule
task execution role
bounded task role
CloudWatch log group
alarms
deployment pipeline
dashboard
Config metadata
```

It does not let the developer submit an arbitrary task-role policy.

New service-specific permissions are requested through a reviewed extension mechanism.

---

# 36. The approved serverless product

The serverless product is based on SAM and provisions:

```text
API Gateway
Lambda
DynamoDB or SQS option
CloudWatch logs
X-Ray / OpenTelemetry configuration
Lambda execution role
CodePipeline
CodeBuild
CodeDeploy canary preference
alarms
```

The product makes the safe default easy:

```text
immutable Lambda versions
production alias
canary traffic shift
automatic alarm rollback
```

Developers may add business code without constructing the release machinery from scratch.

---

# 37. The approved EC2 product

The EC2 product provisions:

```text
approved AMI
launch template
Auto Scaling group
ALB target group
instance profile
Systems Manager access
CloudWatch agent
CodeDeploy agent
patch or replacement policy
alarms
backup policy where required
```

The AMI parameter is not free text.

The product accepts only:

- a platform-approved image family;
- a platform-published SSM parameter;
- a launch-template version updated by Image Builder.

This prevents arbitrary public AMIs from becoming production baselines.

---

# 38. IAM architecture

## 38.1 Identity map

| Actor | Identity | Main authority |
|---|---|---|
| Developer | IAM Identity Center role | Use approved products and view own stacks |
| Platform engineer | Platform administration role | Publish products and operate platform |
| Service Catalog | Launch-constraint role | Provision one approved product family |
| CloudFormation | Product execution role | Create product resources |
| StackSets | Service-managed or execution roles | Deploy organization baselines |
| CodePipeline | Pipeline service role | Coordinate approved actions |
| CodeBuild | Build-project role | Read dependencies, build, test, publish artifact |
| Cross-account action | Target-account pipeline role | Deploy into one environment |
| CodeDeploy | CodeDeploy service role | Operate deployment resources |
| EC2 target | Instance role | Retrieve revision and run managed services |
| Image Builder | Image Builder service role | Coordinate image production |
| Image build instance | Build instance profile | Install components and write logs |
| Managed EC2 node | Systems Manager instance role | Maintain SSM management channel |
| Config remediation | Automation assume role | Repair a specific violation |
| Approver | Approval-specific role | Approve or reject pipeline stage |

---

## 38.2 Developer permissions

The developer may:

```text
list approved products
provision approved product
update supported product parameters
start own application pipeline
view stack and deployment status
read own application logs
```

The developer may not directly:

```text
create IAM roles
modify launch constraints
edit production bucket policies
pass arbitrary roles
disable Config
replace approved AMI controls
execute production change set without approval
```

---

## 38.3 Platform role separation

Avoid one universal:

```text
PlatformAdministrator
```

for every task.

Separate authorities such as:

```text
CatalogProductPublisher
StackSetAdministrator
ArtifactRepositoryAdministrator
ImageFactoryAdministrator
PipelineAdministrator
ProductionApprover
ConfigRemediationAdministrator
```

This reduces the damage from one compromised platform credential.

---

## 38.4 `iam:PassRole` inventory

This platform contains many legitimate `PassRole` relationships:

```text
Developer or catalog administrator
    → passes Service Catalog launch role

Pipeline
    → passes CloudFormation execution role

Pipeline
    → passes ECS task and execution roles

Pipeline
    → passes CodeDeploy service role

Image Builder administrator
    → passes image build instance profile

Config administrator
    → passes Automation remediation role
```

Each should be constrained by:

- exact role ARN;
- intended service through `iam:PassedToService`;
- approved source principal;
- organizational policy where appropriate.

`iam:PassRole` is one of the highest-risk permissions in an internal platform.

---

# 39. Networking architecture

## 39.1 Managed control-plane services

These services are not placed inside Northstar’s workload subnets:

```text
CloudFormation
Service Catalog
CodePipeline
CodeArtifact control plane
StackSets
AWS Config
Systems Manager control plane
```

They expose AWS service endpoints.

VPC networking matters for the resources and execution environments that call those endpoints.

---

## 39.2 Build VPC

Northstar uses a dedicated build VPC for projects requiring private access.

```text
Private build subnets in two AZs
    │
    ├── S3 gateway endpoint
    ├── CodeArtifact API endpoint
    ├── CodeArtifact repository endpoint
    ├── ECR endpoints
    ├── CloudWatch Logs endpoint
    ├── Secrets Manager endpoint
    └── NAT or controlled proxy for approved public dependencies
```

Build security groups have no inbound rules.

They permit only the required outbound paths.

---

## 39.3 Image Builder VPC

Image Builder launches temporary EC2 instances in a controlled build subnet.

The build instance may require:

- package repositories;
- S3 components;
- Systems Manager;
- Inspector;
- CloudWatch Logs;
- KMS;
- ECR for container images.

The infrastructure configuration defines:

```text
subnet
security groups
instance types
instance profile
log destination
failure troubleshooting behavior
```

The image build environment should not have a broad path to production databases merely because it is operated by the platform team.

---

## 39.4 EC2 managed-node path

```text
EC2 instance
    ↓ outbound HTTPS
Systems Manager interface endpoints
    ↓
Systems Manager service
```

No inbound administrative port is needed.

For patching:

```text
EC2 instance
    ↓
approved OS repository or internal mirror
```

That second path must also exist.

---

## 39.5 CodeDeploy path

For EC2:

```text
CodeDeploy control plane
    ↓
CodeDeploy agent polls over HTTPS
    ↓
agent obtains deployment revision from S3
```

The instance needs:

- correct agent;
- correct instance role;
- CodeDeploy/S3 reachability;
- file-system and runtime prerequisites.

For Lambda and ECS deployment, no EC2 CodeDeploy agent is involved.

---

## 39.6 Cross-account does not imply cross-network

The Platform account pipeline can deploy to Production using STS and AWS APIs without VPC connectivity.

But a CodeBuild test that sends HTTP to a private Production ALB needs a real network path.

Always classify the interaction:

```text
Control-plane API call:
    IAM and AWS service endpoint

Private data-plane connection:
    route + security controls + application endpoint
```

---

# 40. Change control model

## 40.1 A change should carry evidence

A production change package contains:

```text
source revision
immutable artifact digest
CloudFormation template
parameter set
change set
test results
security scan
policy results
deployment strategy
rollback plan
ticket or business reference
approver identity
```

CloudTrail records the API actions, but it does not supply the full business rationale by itself.

---

## 40.2 Production gates

A high-risk release uses:

```text
peer review
    ↓
build and unit tests
    ↓
policy-as-code checks
    ↓
development deployment
    ↓
integration tests
    ↓
staging deployment
    ↓
performance and compatibility tests
    ↓
production change set
    ↓
human approval
    ↓
canary or blue/green deployment
    ↓
alarm monitoring
```

Not every low-risk change needs the same approval burden. The organization should classify changes by risk.

---

## 40.3 Emergency changes

An emergency path should be:

- faster;
- narrowly privileged;
- time-limited;
- fully logged;
- followed by template reconciliation;
- reviewed after the incident.

It should not mean:

```text
use permanent administrator role
make manual changes
never update infrastructure code
```

---

## 40.4 Change freeze

During a freeze:

```text
Change Calendar = CLOSED
```

Ordinary production workflows stop before mutation.

Emergency workflows may require a separately authorized override.

A calendar is a timing control, not a substitute for IAM, approval, or rollback.

---

# 41. Rollback layers

| Failure | Primary rollback mechanism |
|---|---|
| Bad source commit before deploy | Stop pipeline |
| Bad infrastructure plan | Reject change set |
| CloudFormation resource failure | Stack rollback |
| CloudWatch alarm during stack operation | CloudFormation rollback trigger |
| Bad EC2 application revision | CodeDeploy rollback |
| Bad Lambda version | Alias traffic rollback |
| Bad ECS revision | Return traffic to blue task set |
| Bad AMI | Previous launch-template/AMI version |
| Bad mutable configuration | State Manager or Automation restoration |
| Logical data corruption | Database-specific recovery or compensating action |
| Manual drift | CloudFormation reconciliation |
| Organization baseline failure | StackSet repair or previous template version |

There is no universal “rollback button” that reverses every category.

---

# 42. Observability

## 42.1 Platform service-level objectives

The platform should measure:

```text
time from account availability to first deployment
time from code merge to development
time from approval to production
pipeline success rate
rollback rate
change failure rate
mean time to recovery
product adoption
manual exception rate
drift rate
noncompliant resource count
patch compliance
age of critical vulnerabilities
```

A platform with perfect infrastructure compliance but a three-week lead time may cause teams to bypass it.

---

## 42.2 CloudFormation

Monitor:

```text
failed stack operations
rollback failures
drift
resource replacement
long-running operations
custom-resource failures
StackSet failed instances
```

---

## 42.3 CodePipeline and CodeBuild

Monitor:

```text
pipeline failures by stage
approval wait time
build queue time
build duration
test failures
cache effectiveness
artifact publication failures
cross-account assumption failures
```

---

## 42.4 CodeDeploy

Monitor:

```text
deployment success
lifecycle-hook failures
unhealthy hosts
traffic-shift status
rollback events
alarm breaches
```

---

## 42.5 Image Builder

Monitor:

```text
pipeline age
build failures
test failures
distribution failures
latest approved AMI age
critical findings
accounts still using deprecated AMIs
```

---

## 42.6 Systems Manager

Monitor:

```text
managed-node registration
association compliance
patch compliance
Run Command failures
Automation failures
Maintenance Window failures
Session Manager activity
agent version
```

---

## 42.7 Config

Monitor:

```text
noncompliant resources
rule evaluation failures
remediation success
remediation loops
conformance-pack deployment failures
accounts or Regions missing recording
```

---

## 42.8 CloudTrail

CloudTrail answers:

```text
Who approved production?
Who executed the change set?
Who altered a launch role?
Who manually changed the security group?
Who started an emergency Session Manager session?
Who modified a CodeArtifact policy?
```

CloudWatch shows operational status.

Config shows resource-state compliance.

CloudTrail shows API activity and actors.

---

# 43. Cost model

Major cost categories include:

```text
CodeBuild compute
CodePipeline executions
CodeArtifact storage and requests
S3 artifact storage
KMS requests
ECR storage and scanning
Image Builder temporary EC2 and EBS resources
CloudWatch logs and metrics
Config recording and rule evaluations
Systems Manager advanced features where applicable
duplicate blue/green capacity
NAT Gateway traffic
VPC endpoints
retained AMIs and snapshots
```

---

## 43.1 Standardization can reduce cost

Approved products can enforce:

```text
capacity limits
approved instance families
required auto scaling
log retention
backup lifecycle
nonproduction schedules
cost tags
Spot-compatible worker options
```

The cost benefit comes from repeatable decisions, not from Service Catalog itself making every resource cheaper.

---

## 43.2 Platform cost is partly organizational

The platform also consumes engineering capacity:

```text
product maintenance
runtime upgrades
policy updates
support
documentation
exception review
incident response
```

A product should be created when its repeated organizational value exceeds this maintenance burden.

---

## 43.3 VPC endpoint versus NAT tradeoff

VPC endpoints can reduce or avoid NAT-path processing and improve private service access, but interface endpoints have hourly and data-processing costs.

A small build VPC may be cheaper with NAT.

A high-volume private build environment may benefit from endpoints.

Select based on:

- traffic volume;
- availability;
- privacy requirements;
- service coverage;
- operational simplicity.

---

## 43.4 Blue/green cost

Blue/green may temporarily require almost twice the normal compute capacity.

That cost purchases:

- pre-cutover validation;
- rapid traffic rollback;
- reduced mutation of existing hosts;
- safer production exposure.

Use it when deployment risk justifies the additional capacity.

---

# 44. Failure drills

## Failure A: Developer can view a product but cannot launch it

Investigate:

```text
servicecatalog:ProvisionProduct
portfolio principal association
product version status
launch constraint
template constraint
target Region
```

---

## Failure B: Developer can launch the product but CloudFormation receives `AccessDenied`

The developer’s Service Catalog permission succeeded.

Investigate:

```text
Service Catalog launch role
CloudFormation execution role
iam:PassRole
SCP
permissions boundary
resource policy
KMS key policy
```

---

## Failure C: Product launch role has `AdministratorAccess`

The catalog path now provides indirect administrator capability.

Restrict the launch role to the product’s resource types, names, tags, and supporting actions.

---

## Failure D: Developer updates a stack using a powerful CloudFormation service role

Even without direct `iam:PassRole`, the developer may indirectly exercise the role because it is already attached to the stack.

Restrict the developer’s stack operations and narrow the CloudFormation service role. 

---

## Failure E: Change set shows database replacement

Do not execute it merely because CloudFormation generated the plan successfully.

Investigate:

```text
property update behavior
data migration
snapshot
new endpoint
application compatibility
UpdateReplacePolicy
rollback plan
```

---

## Failure F: Stack update reaches `UPDATE_ROLLBACK_FAILED`

Repair the resource or permission that blocks restoration and continue the rollback.

Do not repeatedly submit new updates to a stack that has not returned to an operable rollback state.

---

## Failure G: StackSet misses new production accounts

Investigate:

```text
target OU
automatic deployment enabled
account moved into OU after StackSet creation
trusted access
service-managed permission state
excluded account filters
target Regions
```

---

## Failure H: StackSet operation says succeeded but several accounts lack the baseline

Failure tolerance allowed the operation to continue.

Inspect stack-instance results rather than relying only on the parent operation state.

---

## Failure I: StackSet delegated administrator deploys to an unintended OU

Delegated StackSets administration is organization-wide authority.

The platform-account IAM and pipeline review failed to constrain how that privilege was used.

---

## Failure J: New Service Catalog version exists, but old services remain unchanged

Publishing a version makes it available.

Existing provisioned products require an update operation or migration process.

---

## Failure K: CodeBuild cannot download packages from CodeArtifact

Investigate:

```text
authorization token
sts:GetServiceBearerToken
codeartifact:GetAuthorizationToken
ReadFromRepository
domain owner ID
repository policy
KMS
CodeArtifact API endpoint
CodeArtifact repository endpoint
DNS and security groups
```

---

## Failure L: VPC-attached CodeBuild cannot reach a public dependency

A public subnet does not give the CodeBuild ENI a public IP.

Use NAT, an approved proxy, or a private artifact mirror.

---

## Failure M: Build succeeds locally but production artifact differs

The pipeline rebuilt the application independently in each environment or used mutable dependencies.

Build once, record the immutable digest, and promote that exact artifact.

---

## Failure N: Cross-account deployment cannot decrypt pipeline artifact

Investigate:

```text
target action role
S3 bucket policy
KMS key policy
key ARN rather than account-local alias
pipeline service role
artifact ownership
```

---

## Failure O: CodeDeploy agent never receives the EC2 deployment

Investigate:

```text
agent installed and running
outbound HTTPS 443
CodeDeploy endpoint
S3 revision access
instance role
deployment-group tags
Region
```

---

## Failure P: Lambda canary rolls back after 10%

The deployment may be functioning correctly.

A CloudWatch alarm detected unacceptable errors or latency.

Investigate the application metric before disabling rollback.

---

## Failure Q: EC2 instance is absent from Session Manager

Investigate:

```text
SSM Agent
instance profile
ssm/ssmmessages endpoint path
DNS
agent version
operating-system support
```

---

## Failure R: Systems Manager works, but patching fails

The management channel is healthy.

The node cannot reach its operating-system package repository, or the repository lacks the required package.

---

## Failure S: State Manager repeatedly overwrites a valid emergency change

The desired-state association still declares the old state.

Update the association or encode the accepted change in the platform definition rather than fighting reconciliation manually.

---

## Failure T: Config identifies a public bucket but does not stop its creation

Config is detective.

Use an SCP, RCP, CloudFormation Hook, Service Catalog product, or another preventive control when creation must be impossible.

---

## Failure U: Config automatic remediation disrupts production

The remediation action was not safe for automatic use or lacked a gradual/error-controlled rollout.

Move the rule to manual remediation until the operation is made safe.

---

## Failure V: New AMI passed build but fails at runtime

The image tests did not represent the production requirements.

Add:

- boot tests;
- SSM tests;
- application smoke tests;
- network tests;
- agent checks;
- architecture compatibility tests.

---

## Failure W: Auto Scaling continues launching an old AMI

The new AMI exists, but the launch template or Service Catalog product still references the old version.

Image production and workload rollout are separate steps.

---

## Failure X: CloudFormation drift remains after pipeline deployment

Possible causes:

```text
pipeline template does not own changed property
manual change reapplied after deployment
unsupported drift-detection property
custom resource
another controller owns the resource
```

---

## Failure Y: Application rollback succeeds, but database is incompatible

Traffic returned to the old code, but the schema change was destructive.

Use backward-compatible expand-and-contract migrations.

---

# 45. Changed-requirement variants

## Variant 1: Every team already uses Terraform

Service Catalog supports Terraform-oriented product types, and Account Factory for Terraform may already be present.

The business architecture remains:

```text
approved product
controlled launch authority
versioned modules
policy checks
pipeline
compliance
```

CloudFormation is no longer required as the sole workload IaC language, although AWS-native baselines and Control Tower integrations may still use it.

---

## Variant 2: Teams require unrestricted infrastructure experimentation

Keep production products strict.

Provide separate sandbox accounts with:

- broader development permission;
- strict budget;
- no production data;
- no production network path;
- short account lifetime;
- automatic cleanup.

Do not weaken production launch roles.

---

## Variant 3: Baseline must reach external accounts outside Organizations

Use StackSets with self-managed permissions and explicit administrator/execution-role trust.

Service-managed OU targeting is not available across an unrelated organization.

---

## Variant 4: One product must deploy to three Regions

Use:

- a Service Catalog Stack Set constraint; or
- a pipeline that operates StackSets.

Choose according to whether the end user selects and manages the product or the platform centrally mandates it.

---

## Variant 5: Production builds need a private on-premises license server

Attach CodeBuild to a VPC with:

- Transit Gateway or VPN/Direct Connect path;
- DNS resolution;
- security-group permission;
- license-server authorization.

An IAM role alone cannot reach the private server.

---

## Variant 6: EC2 fleet is entirely immutable

Remove routine in-place production patching.

Use:

```text
Image Builder
    ↓
new AMI
    ↓
instance refresh or blue/green
```

Retain Patch Manager primarily for compliance scanning and exceptional mutable nodes.

---

## Variant 7: Legacy servers cannot be replaced frequently

Use:

- Patch Manager;
- Maintenance Windows;
- Run Command;
- State Manager;
- CodeDeploy in-place;
- strong backups and health validation.

This accepts mutable-host complexity because replacement is not practical.

---

## Variant 8: Change requires three business approvals

For an existing Change Manager customer, a change template can provide multiple approval levels before running Automation.

For a new customer, construct the approval workflow with:

- CodePipeline approval stages;
- Step Functions callbacks;
- external ITSM integration;
- Automation runbooks;
- Change Calendar.

---

## Variant 9: Product uses only Lambda and API Gateway

Use SAM for the product implementation.

Do not require each team to express verbose low-level CloudFormation when the serverless abstraction accurately models the workload.

---

## Variant 10: Product requires Kubernetes portability

Service Catalog can still publish an EKS platform product, but the application delivery model should use Kubernetes-native mechanisms after the cluster boundary.

Apply the Kubernetes interlude’s IAM, networking, and operator reasoning.

---

# 46. SAP-C02 decision snippets

## CloudFormation versus Service Catalog

**Requirement:** Define and deploy infrastructure as code.

```text
CloudFormation
```

**Requirement:** Let users select approved products without broad resource permissions.

```text
Service Catalog
```

Service Catalog products commonly use CloudFormation underneath.

---

## StackSets versus Service Catalog

**Centrally deploy a baseline to every account and Region:**

```text
StackSets
```

**Let a developer choose an approved database product:**

```text
Service Catalog
```

**Need both central distribution and developer self-service:**

```text
combine them
```

---

## Service-managed versus self-managed StackSets

**Accounts in one Organizations hierarchy, OU targets, automatic deployment:**

```text
service-managed permissions
```

**External accounts or explicit custom trust roles:**

```text
self-managed permissions
```

---

## Launch constraint versus template constraint

**Which role provisions the product:**

```text
launch constraint
```

**Which parameter values the user may select:**

```text
template constraint
```

---

## CloudFormation change set versus drift detection

**What will a proposed update do?**

```text
change set
```

**How does the live resource differ from the template now?**

```text
drift detection
```

---

## Stack policy versus IAM policy

**Prevent CloudFormation from replacing one stack resource:**

```text
stack policy
```

**Control who may call UpdateStack:**

```text
IAM policy
```

---

## `DeletionPolicy` versus `UpdateReplacePolicy`

**Resource removed or stack deleted:**

```text
DeletionPolicy
```

**Old physical resource replaced during update:**

```text
UpdateReplacePolicy
```

---

## SAM versus CloudFormation

**Concise serverless application syntax:**

```text
SAM
```

**General AWS infrastructure:**

```text
CloudFormation
```

SAM transforms into CloudFormation.

---

## CodeArtifact versus ECR versus S3

```text
language packages
    → CodeArtifact

container images
    → ECR

generic pipeline artifacts
    → S3
```

---

## CodeBuild versus CodePipeline versus CodeDeploy

```text
build and test
    → CodeBuild

coordinate stages and actions
    → CodePipeline

install revision or shift application traffic
    → CodeDeploy
```

---

## In-place versus blue/green

**Minimize duplicate capacity and tolerate rolling host modification:**

```text
in-place
```

**Validate a replacement environment and retain rapid traffic rollback:**

```text
blue/green
```

---

## Run Command versus State Manager versus Automation

```text
one-time command
    → Run Command

maintain desired configuration
    → State Manager

multi-step operational runbook
    → Automation
```

---

## Patch Manager versus Maintenance Windows

```text
which patches constitute compliance
and how they are applied
    → Patch Manager

when disruptive work may run
    → Maintenance Windows
```

---

## Image Builder versus Patch Manager

```text
create new tested golden AMI
    → Image Builder

patch existing managed node
    → Patch Manager
```

---

## Hook versus Config

```text
reject noncompliant CloudFormation resource before creation
    → Hook

detect deployed noncompliant resource
    → Config rule
```

---

# 47. Retrieval practice

## 1

What is the central business purpose of the internal developer platform?

## 2

What does a paved road provide that a ticket-based infrastructure team does not?

## 3

What is the difference between a CloudFormation template and stack?

## 4

What are the three broad CloudFormation update behaviors?

## 5

Why can an apparently small property change be dangerous?

## 6

What does a change set show?

## 7

Does a successful change-set creation guarantee a successful update?

## 8

What is a CloudFormation service role?

## 9

Why can permission to update a stack with a powerful service role be dangerous?

## 10

What does `CAPABILITY_NAMED_IAM` acknowledge?

## 11

What does termination protection prevent?

## 12

What does a stack policy protect against?

## 13

What is the difference between `DeletionPolicy` and `UpdateReplacePolicy`?

## 14

What does CloudFormation drift mean?

## 15

Does drift detection automatically decide the correct state?

## 16

What does a CloudFormation Hook do?

## 17

How is a Hook different from a Config rule?

## 18

What is a StackSet stack instance?

## 19

What does service-managed StackSets permission require?

## 20

When should self-managed StackSets permissions be used?

## 21

What does automatic deployment do?

## 22

Why is StackSets delegated administration highly privileged?

## 23

What is the difference between StackSets and Service Catalog?

## 24

What is a Service Catalog product?

## 25

What is a portfolio?

## 26

What is a provisioned product?

## 27

What does a launch constraint specify?

## 28

What does a template constraint specify?

## 29

Does publishing a new product version update every existing instance automatically?

## 30

Which artifact belongs in CodeArtifact?

## 31

What is a CodeArtifact domain?

## 32

Why use an upstream repository and external connection?

## 33

Are CodeArtifact tokens permanent credentials?

## 34

What does CodeBuild do?

## 35

What does a buildspec define?

## 36

Why might CodeBuild be attached to a VPC?

## 37

Why does VPC-attached CodeBuild need NAT or a proxy for public endpoints?

## 38

What does CodePipeline do?

## 39

What is the difference between a pipeline stage and action?

## 40

Why should production receive the exact artifact tested in staging?

## 41

What does a cross-account pipeline action role do?

## 42

Does cross-account deployment require VPC peering?

## 43

What are the three CodeDeploy compute platforms?

## 44

What is the difference between an in-place and blue/green EC2 deployment?

## 45

What are canary and linear traffic shifts?

## 46

Why can application rollback fail to restore the complete previous business state?

## 47

What is the relationship between SAM and CloudFormation?

## 48

Why is Proton not selected for this new platform?

## 49

What does EC2 Image Builder produce?

## 50

What is the difference between a build component and test component?

## 51

Why is Image Builder preferable to in-place patching for a replaceable Auto Scaling fleet?

## 52

What three prerequisites make an EC2 instance a Systems Manager managed node?

## 53

What does Session Manager replace in the ordinary administration path?

## 54

What is the difference between Run Command and State Manager?

## 55

What does Systems Manager Automation provide?

## 56

What is the difference between Patch Manager and Maintenance Windows?

## 57

Why can an isolated managed node reach Systems Manager but still fail to patch?

## 58

What does Config automatic remediation use?

## 59

Why is automatic remediation not always appropriate?

## 60

What is the largest privilege risk repeated throughout this platform?

---

# 48. Answer key

## 1

To let development teams safely provision and deploy common workloads through self-service while central teams preserve organizational security, operational, cost, and change standards.

## 2

A repeatable product interface that gives developers immediate approved infrastructure without waiting for a human administrator to implement each request.

## 3

A template is the reusable desired-state definition. A stack is one deployed realization of that template in an account and Region.

## 4

No interruption, some interruption, and replacement.

## 5

The property may require CloudFormation to replace the entire physical resource, potentially changing endpoints, availability, or data.

## 6

The proposed additions, modifications, deletions, and replacements relative to the current stack.

## 7

No. Runtime conditions can still make execution fail.

## 8

An IAM role that CloudFormation assumes to create, update, and delete resources on behalf of stack callers.

## 9

A caller who can update the stack can indirectly cause CloudFormation to use that role’s permissions, even when the caller does not personally have those direct resource permissions.

## 10

That the template can create or update custom-named IAM resources.

## 11

Deletion of the entire stack.

## 12

CloudFormation update, replacement, or deletion actions against protected logical resources during stack updates.

## 13

`DeletionPolicy` applies when the resource is removed from the stack or the stack is deleted. `UpdateReplacePolicy` applies to the old physical resource when an update replaces it.

## 14

The deployed resource configuration differs from the configuration CloudFormation expects.

## 15

No. Operators must decide whether to restore the template state or adopt the live change.

## 16

It evaluates a proposed CloudFormation or Cloud Control operation before provisioning and can reject noncompliant resources.

## 17

A Hook acts before provisioning through the governed path. Config evaluates deployed resource state afterward.

## 18

The desired stack deployment in one target account and Region.

## 19

AWS Organizations trusted access and an all-features organization.

## 20

For external accounts or when explicit administrator and execution roles are needed.

## 21

It creates or removes stack instances as accounts enter or leave targeted OUs, according to the configured retention behavior.

## 22

The delegated administrator can deploy service-managed StackSets broadly across the organization.

## 23

StackSets centrally pushes infrastructure. Service Catalog lets an authorized user choose and launch a curated product.

## 24

An approved deployable infrastructure or service definition.

## 25

A collection of products, permissions, and constraints for a user population.

## 26

One launched and managed instance of a catalog product.

## 27

The IAM role Service Catalog assumes to provision the product.

## 28

The parameter values and combinations available to the end user.

## 29

No. Existing provisioned products require an update or migration operation.

## 30

A language package such as an internal Python, npm, Maven, or NuGet package.

## 31

A grouping and policy boundary for CodeArtifact repositories, package identity, encryption, and cross-account administration.

## 32

To expose approved internal and public dependencies through one controlled repository chain.

## 33

No. They are temporary authorization tokens.

## 34

It runs a managed build environment to compile, test, validate, package, and publish artifacts.

## 35

The commands, phases, reports, and artifacts of one build.

## 36

To reach private databases, services, license servers, package proxies, or on-premises endpoints.

## 37

Its managed network interface does not receive a public IP merely because it is placed in a public subnet.

## 38

It coordinates release stages, actions, transitions, approvals, and artifacts.

## 39

A stage is a logical release phase. An action is one operation within that phase.

## 40

Rebuilding can produce different dependencies or base content. Promoting one immutable artifact ensures that production runs what was tested.

## 41

It gives the central pipeline narrowly scoped deployment authority in the target account.

## 42

No. AWS control-plane APIs and S3 artifacts can be accessed through IAM and service endpoints. Private integration testing may separately require VPC connectivity.

## 43

EC2/on-premises, Lambda, and ECS.

## 44

In-place modifies existing hosts. Blue/green creates a replacement environment, validates it, and shifts traffic while retaining the old environment temporarily.

## 45

Canary exposes a small percentage and then shifts the remainder after a wait. Linear increases exposure through repeated equal increments.

## 46

The old code may already have produced irreversible database, messaging, payment, or external side effects.

## 47

SAM is a serverless-focused higher-level syntax that transforms into CloudFormation resources.

## 48

AWS Proton is approaching end of support on October 7, 2026 and is unavailable to new customers.

## 49

Tested AMIs or container images, along with managed image metadata and distribution.

## 50

A build component modifies the image. A test component validates the image created from those modifications.

## 51

Every replacement instance begins from a known tested image, avoiding continuing mutation and configuration drift on long-lived hosts.

## 52

SSM Agent, an appropriate IAM identity or instance profile, and network reachability to the required Systems Manager endpoints.

## 53

Ordinary public SSH/RDP access, bastion hosts, and widely distributed administration keys.

## 54

Run Command executes a one-time command. State Manager continually applies and reports a desired configuration.

## 55

A multi-step runbook for coordinated operational actions across AWS resources and managed nodes.

## 56

Patch Manager defines, installs, and reports patches. Maintenance Windows controls when disruptive operational tasks may begin.

## 57

The Systems Manager endpoints supply the management channel, but the node may lack a route to its operating-system package repository.

## 58

Systems Manager Automation documents or runbooks.

## 59

The correct repair may be ambiguous or disruptive, or automatic action may create a reconciliation loop.

## 60

Improper delegation or passing of overly powerful IAM roles—especially CloudFormation execution roles, Service Catalog launch roles, pipeline action roles, remediation roles, and broad `iam:PassRole`.

---

# 49. What to memorize now

```text
CloudFormation template
    → desired infrastructure definition

CloudFormation stack
    → deployed instance
```

```text
Change set
    → proposed future change

Drift detection
    → current live difference
```

```text
Termination protection
    → stop whole-stack deletion

Stack policy
    → protect resources during updates

DeletionPolicy
    → resource removed or stack deleted

UpdateReplacePolicy
    → old resource after replacement
```

```text
StackSets
    → centrally push stacks
    → many accounts
    → many Regions

Service Catalog
    → governed self-service
    → products
    → portfolios
    → constraints
```

```text
Launch constraint
    → which role provisions

Template constraint
    → which parameters are allowed
```

```text
Service-managed StackSets
    → Organizations trusted access
    → OU targeting
    → automatic deployment

Self-managed StackSets
    → explicit administrator/execution roles
```

```text
CodeArtifact
    → language packages

ECR
    → container images

S3
    → generic pipeline artifacts
```

```text
CodeBuild
    → build and test

CodePipeline
    → orchestrate release

CodeDeploy
    → deploy application revision
```

```text
In-place
    → modify existing hosts

Blue/green
    → replacement environment
    → validate
    → shift traffic
```

```text
Canary
    → small percentage, wait, remainder

Linear
    → repeated traffic increments
```

```text
SAM
    → serverless shorthand
    → transforms into CloudFormation
```

```text
Image Builder
    → build, test, distribute approved AMI

Patch Manager
    → patch existing node
```

```text
Session Manager
    → interactive administration

Run Command
    → one-time command

State Manager
    → desired node state

Automation
    → multi-step runbook

Maintenance Windows
    → approved time window
```

```text
CloudFormation Hook
    → prevent bad deployment

AWS Config
    → detect bad deployed state

Config + Automation
    → remediate
```

```text
Cross-account IAM role
    → authorization

Cross-VPC path
    → networking
```

```text
Infrastructure rollback
    ≠
application rollback
    ≠
data rollback
```

---

# 50. What can remain recognition-level

You do not yet need perfect recollection of:

- every CloudFormation intrinsic function;
- all resource-specific update behaviors;
- exact StackSet concurrency formulas;
- every Service Catalog constraint type;
- CodeArtifact package-manager commands;
- buildspec syntax details;
- CodePipeline action JSON;
- CodeDeploy AppSpec syntax;
- every CodeDeploy lifecycle hook;
- CloudFormation Guard rule syntax;
- Image Builder component syntax;
- every SSM document plugin;
- Patch Manager operating-system differences;
- Config custom-rule implementation;
- organization conformance-pack syntax;
- Proton migration commands;
- Change Manager approval-template syntax.

The durable architecture is:

```text
Platform team defines:
    approved templates
    approved roles
    approved packages
    approved images
    approved deployment strategies

StackSets distributes:
    mandatory account baselines

Service Catalog exposes:
    self-service products

CloudFormation provisions:
    declared infrastructure

CodeBuild produces:
    tested immutable artifacts

CodePipeline promotes:
    exact artifacts through environments

CodeDeploy shifts:
    application revisions and traffic

Image Builder supplies:
    tested machine images

Systems Manager operates:
    managed nodes

Config evaluates:
    deployed compliance
```

At every step, continue applying Lesson 0:

```text
Authorization:
    Which human or service principal performs the operation?
    Which role is assumed?
    Which role is passed?
    Which policy grants or limits the action?

Networking:
    Is this an AWS control-plane API call,
    an artifact transfer,
    a build reaching a private endpoint,
    or an agent reaching a managed service?
    Which route, endpoint, protocol, port,
    security group, and return path are required?
```