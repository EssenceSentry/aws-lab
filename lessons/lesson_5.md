# Lesson 5 — A Corporate Landing Zone for Many Business Units

## AWS Organizations, Control Tower, federation, centralized evidence, and cost accountability

## Source note

The curriculum defines Lesson 5 as a corporate landing-zone project covering AWS Organizations, Control Tower, accounts and organizational units, SCPs versus IAM policies, IAM Identity Center, federation, centralized CloudTrail and AWS Config, logging and security accounts, consolidated billing, tagging, and cost attribution. 

This project draws primarily from the uploaded Domain 1 and cheat-sheet material. The source’s landing-zone diagram on page 42 separates development, production, logging, security, and administrative/shared-service responsibilities into different accounts. Its next diagram organizes accounts into nested OUs governed by different SCPs.  

The uploaded guide describes this as a major SAP-C02 topic: Domain 1 covers multi-account environments, security controls, network strategy, resilience, and cost visibility, and represents 26% of the exam. 

### Current terminology

Older material often calls the central account the **master account**. AWS now uses **management account**.

Older material often calls Control Tower rules **guardrails**. AWS now generally calls them **controls**, while still acknowledging the older term.

Control Tower currently has three control behaviors:

```text
Preventive
Detective
Proactive
```

Preventive controls use AWS Organizations mechanisms such as SCPs, RCPs, and declarative policies. Detective controls use AWS Config rules. Proactive controls use CloudFormation hooks to reject noncompliant CloudFormation resources before provisioning. Exact default controls vary by landing-zone version, so the exam-relevant knowledge is the behavior and implementation—not a memorized inventory. 

---

# 1. The project

## 1.1 Business brief

Northstar has become **Northstar Group**, a corporation with four business units:

```text
Northstar Commerce
Northstar Logistics
Northstar Analytics
Northstar Research
```

Over several years, its teams created AWS accounts independently.

The company now has:

- 48 existing AWS accounts;
- development and production workloads mixed in some accounts;
- duplicated IAM users;
- inconsistent administrator roles;
- locally configured CloudTrail trails;
- accounts operating in unapproved Regions;
- inconsistent tags;
- no reliable business-unit cost report;
- several accounts in which local administrators can disable security tools;
- workloads running in the account that also manages company-wide billing;
- two recently acquired subsidiaries with pre-existing AWS accounts.

Northstar expects to exceed 100 accounts within two years.

The company wants business units to retain meaningful autonomy:

```text
Commerce teams manage Commerce workloads.
Logistics teams manage Logistics workloads.
Research teams can experiment rapidly.
```

But it also requires central controls:

```text
Security evidence cannot be disabled by workload teams.
Production accounts use stricter policies than sandboxes.
Employees authenticate through the corporate identity provider.
Every account has an identified owner and cost center.
New accounts receive a standard baseline.
The security team can inspect all governed accounts.
Central procurement controls commitment purchases.
```

The landing zone must not accidentally create network connectivity between every business unit. Network architecture will be designed separately in Lesson 7.

---

## 1.2 The central problem

A large AWS environment needs both:

```text
Decentralized workload ownership
                AND
Centralized organizational governance
```

Too little central control produces:

- inconsistent security;
- unknown resources;
- duplicated identities;
- missing logs;
- uncontrolled cost;
- difficult incident response.

Too much centralized operational control produces:

- slow delivery;
- one cloud team becoming a bottleneck;
- excessive privileges in central accounts;
- business teams unable to operate independently.

The landing zone therefore separates three questions:

```text
Where should the workload live?
    → AWS account structure

What is the maximum it may do?
    → organizational controls

Who may operate it?
    → workforce identities and IAM permissions
```

Networking remains a fourth, independent question:

```text
Which systems may exchange packets?
    → VPC and connectivity design
```

---

# 2. Constraint ledger

| Dimension | Requirement |
|---|---|
| Scale | More than 100 AWS accounts expected |
| Ownership | Business units operate their own workloads |
| Isolation | Production, nonproduction, security, and infrastructure separated |
| Identity | Corporate federation; avoid individual IAM users |
| Governance | Central preventive and detective controls |
| Audit | Organization-wide, durable activity history |
| Configuration | Organization-wide resource and compliance inventory |
| Account lifecycle | Standard creation, enrollment, suspension, and closure |
| Cost | Consolidated billing and business-unit attribution |
| Tags | Consistent business metadata |
| Regions | Only approved Regions for ordinary workloads |
| Operations | Minimize use of the management account |
| Networking | Accounts are not automatically interconnected |
| Migration | Existing and acquired accounts must be enrolled safely |
| Exceptions | Some workloads may need controlled exceptions |
| Resilience | A mistake in one account should not compromise all workloads |

---

# 3. Baseline organizational architecture

```text
                              AWS Organization
                                     │
                                     ▼
                           Organization Root
                                     │
       ┌─────────────────────────────┼──────────────────────────────┐
       │                             │                              │
       ▼                             ▼                              ▼
Management account             Security OU                Infrastructure OU
No workloads                  ┌───────────────┐           ┌─────────────────┐
Organizations                 │ Log Archive   │           │ Network account │
Control Tower                 │ account       │           │                 │
Billing                       │               │           │ Shared Services │
Limited admins                │ Security /    │           │ account         │
                              │ Audit account │           └─────────────────┘
                              └───────────────┘
                                     │
                                     │
                                     ▼
                                Workloads OU
                                     │
                   ┌─────────────────┴──────────────────┐
                   │                                    │
                   ▼                                    ▼
             Production OU                       Nonproduction OU
                   │                                    │
       ┌───────────┼───────────┐            ┌───────────┼───────────┐
       │           │           │            │           │           │
       ▼           ▼           ▼            ▼           ▼           ▼
 Commerce OU   Logistics OU Analytics OU  Commerce OU Logistics OU Research OU
       │           │           │            │           │           │
       ▼           ▼           ▼            ▼           ▼           ▼
commerce-     logistics-   analytics-   commerce-   logistics-   research-
orders-prod   routing-prod platform-prod development development experiments
commerce-
catalog-prod

       ┌────────────────────┬────────────────────┬─────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
   Sandbox OU          Policy-Staging OU     Suspended OU
 temporary             test new SCPs and     accounts awaiting
 experimentation       controls safely       closure or investigation
```

Every account also receives organization-level metadata such as:

```text
BusinessUnit = Commerce
Environment  = Production
Owner        = commerce-platform
CostCenter   = CC-4100
DataClass    = Internal
```

## Architecture in one sentence

> AWS Organizations supplies the account hierarchy and policy framework, Control Tower establishes and governs the landing zone, IAM Identity Center federates employees into account-specific roles, organization-level CloudTrail and Config centralize evidence, and consolidated billing plus tags and Cost Categories provide financial accountability.

---

# 4. Functional decisions at a glance

| Function | Baseline choice | Reason |
|---|---|---|
| Multi-account hierarchy | AWS Organizations with all features | Central accounts, OUs, policies, and service integrations |
| Landing-zone orchestration | AWS Control Tower | Standard shared accounts, account vending, and controls |
| Workforce access | IAM Identity Center | Central user/group-to-account access |
| Corporate directory | External IdP through federation and SCIM | Keep identity lifecycle in corporate directory |
| Permission definition | Permission sets | Reusable job-role access across accounts |
| Organizational permission ceiling | SCPs | Restrict maximum principal authority in member accounts |
| Resource-policy ceiling | RCPs, where required | Restrict maximum resource-based exposure |
| Preventive governance | Control Tower preventive controls | Block prohibited actions |
| Detective governance | Config-based controls | Find configuration violations |
| Predeployment governance | Proactive controls | Reject noncompliant CloudFormation resources |
| Activity record | Organization CloudTrail trail | Central account and API activity history |
| Configuration inventory | AWS Config in each account/Region | Resource configuration and compliance history |
| Central Config view | Organization Config aggregator | Read-only multi-account, multi-Region view |
| Shared log storage | Log Archive account | Separate durable evidence from workload operators |
| Security administration | Security/Audit account | Delegated administration and investigation |
| Account vending | Control Tower Account Factory | Standardized account creation and enrollment |
| Billing | Organizations consolidated billing | Combined invoice and eligible aggregated discounts |
| Cost analysis | Cost Explorer | Interactive analysis and forecasting |
| Detailed cost data | Cost and Usage Report / CUR 2.0 | Granular billing dataset |
| Threshold alerts | AWS Budgets | Cost and usage threshold notifications |
| Business mapping | Cost allocation tags and Cost Categories | Attribute spend to business dimensions |
| Tag consistency | Organizations tag policies | Standardize tag keys, values, and case |

AWS Organizations is the foundational service: it creates and groups accounts, applies policies, integrates services, centralizes audit mechanisms, and supplies consolidated billing. Control Tower is built on top of Organizations, IAM Identity Center, Service Catalog, and other services to provide a more opinionated landing-zone workflow. 

---

# 5. Why use multiple accounts?

## 5.1 The AWS account is a strong boundary

An AWS account is a natural boundary for:

- identity administration;
- permissions;
- service quotas;
- billing;
- security findings;
- resource ownership;
- operational blast radius;
- workload lifecycle.

AWS explicitly recommends multi-account environments as organizations scale because accounts provide natural boundaries for permissions, security, costs, and workloads. 

---

## 5.2 Account versus VPC

A VPC is principally a network boundary.

An account is a broader administrative and ownership boundary.

```text
Two VPCs in one account:
    separate routes and network controls
    shared account administrators
    shared account root
    shared service quotas
    shared billing boundary
    many shared control-plane permissions

Two accounts:
    separate resource ownership
    separate account administrators
    separate quotas
    separate policy scope
    separate cost boundary
```

A production and development VPC inside one account still allow an account administrator to affect both.

Separate accounts make it easier to express:

```text
Development administrators may administer the development account.
They have no role in the production account.
```

---

## 5.3 Account versus organizational unit

An OU is not a workload boundary.

An OU:

- groups accounts;
- inherits organization policies;
- can contain nested OUs;
- helps administer accounts as a unit.

An OU does not directly contain:

- EC2 instances;
- S3 buckets;
- IAM users;
- VPCs;
- invoices.

Those belong to accounts.

```text
OU
    → governance grouping

Account
    → resource and administrative boundary
```

---

## 5.4 Account versus application

Not every microservice needs its own account.

An account boundary is justified when some combination differs materially:

- ownership;
- data sensitivity;
- production lifecycle;
- regulatory scope;
- blast radius;
- billing accountability;
- service quotas;
- administrator population.

A useful initial pattern is:

```text
one account
per workload
per environment
```

For example:

```text
commerce-orders-production
commerce-orders-nonproduction
```

Whether catalog and orders need separate production accounts depends on their ownership and isolation needs.

---

# 6. AWS Organizations mental model

## 6.1 Organization

An organization is a centrally managed collection of AWS accounts.

It provides:

```text
account creation and invitation
account grouping
policy inheritance
trusted service integration
delegated administration
consolidated billing
```

A member account can belong to only one organization at a time. The uploaded cheat sheet emphasizes the same management-account, member-account, root, OU, and policy hierarchy. 

---

## 6.2 Management account

The management account:

- creates or owns the organization;
- manages organization-wide policies;
- enables trusted access for supported services;
- handles ordinary consolidated billing;
- performs operations reserved for organization management.

It is uniquely sensitive because SCPs do not restrict its users or roles.

AWS therefore recommends:

- tightly limiting access;
- using it only for operations that require it;
- delegating supported service administration;
- avoiding ordinary workloads and data in it. 

### Baseline rule

```text
Management account
    ≠
shared production account
```

Northstar does not run:

- applications;
- databases;
- analytics jobs;
- CI workers;
- ordinary security tools;

in the management account unless the service explicitly requires it.

---

## 6.3 Member account

Every other account is a member account.

Examples:

```text
commerce-orders-prod
log-archive
network
security-audit
research-sandbox-14
```

Member accounts remain separate AWS accounts even though:

- they receive one consolidated bill;
- they inherit organizational policies;
- trusted services can administer organization-wide features.

---

## 6.4 Organization root

The root is the top of the account hierarchy.

Policies attached to the root affect every member account through inheritance.

The management account itself is special and is not restricted by SCPs attached to the root. 

---

## 6.5 Organizational unit

An OU groups accounts that should receive a common set of policies or controls.

OUs can be nested:

```text
Root
    ↓
Workloads OU
    ↓
Production OU
    ↓
Commerce OU
    ↓
commerce-orders-prod account
```

The account inherits policies attached at every ancestor level. Moving an account to another OU changes which ancestor policies apply. 

---

## 6.6 All features versus consolidated-billing-only

Organizations can operate with only consolidated billing or with all features.

The baseline enables **all features** because Northstar needs:

- SCPs;
- tag policies;
- trusted service integrations;
- delegated administration;
- Control Tower.

The uploaded material makes the same distinction: consolidated billing is universally available, while advanced organizational policy features require all features. 

---

# 7. Designing the OU hierarchy

## 7.1 Organize by controls, not the corporate chart alone

Northstar’s reporting hierarchy changes frequently:

```text
Commerce reports to Digital Products this year.
Next year it may report to Customer Experience.
```

Security requirements are more stable:

```text
Production must not permit uncontrolled Regions.
Sandbox permits broader experimentation.
Security accounts require exceptional protection.
Suspended accounts should perform almost nothing.
```

AWS recommends designing OUs around functions or common control sets rather than simply reproducing the company’s management chart. 

---

## 7.2 Why the baseline starts with environment

The first major policy distinction is:

```text
Production
versus
Nonproduction
```

Production receives controls such as:

- deny unsupported Regions;
- deny disabling central audit services;
- restrict dangerous IAM changes;
- require stronger change paths;
- prohibit public data exposure.

Nonproduction permits more experimentation.

Business-unit OUs are nested beneath those control boundaries:

```text
Production
    ├── Commerce
    ├── Logistics
    └── Analytics
```

This allows both:

```text
Production-wide policy
+
Commerce-specific policy
```

---

## 7.3 The alternative ordering

Northstar could instead use:

```text
Workloads
    ├── Commerce
    │   ├── Production
    │   └── Nonproduction
    └── Logistics
        ├── Production
        └── Nonproduction
```

Neither tree is universally correct.

Choose the higher-level dimension according to:

> Which policy boundary is more universal and stable?

The other dimensions can remain visible through:

- nested OUs;
- account names;
- account tags;
- Cost Categories.

---

## 7.4 Security OU

The Security OU contains accounts whose purpose is organization-wide evidence and security administration.

### Log Archive account

Stores:

- CloudTrail logs;
- Config snapshots and history;
- other organization security logs;
- long-retention evidence.

### Security/Audit account

Provides:

- delegated security administration;
- cross-account investigation;
- central Config aggregation;
- security dashboards;
- controlled read access to log data.

Separating these accounts means that compromise of the security analysis tools does not automatically provide permission to delete the underlying log archive.

---

## 7.5 Infrastructure OU

The Infrastructure OU contains organization-wide platform resources.

Examples:

```text
Network account
Shared Services account
CI/CD account
Identity-supporting services
```

The network account will become the owner of centralized Transit Gateway and hybrid connectivity in Lesson 7.

---

## 7.6 Sandbox OU

Sandbox accounts allow experimentation with:

- shorter lifetimes;
- strict spending limits;
- no production data;
- no connectivity to production;
- fewer approved services;
- automated cleanup.

A sandbox is not merely a development account with no controls.

---

## 7.7 Policy-Staging OU

New SCPs can have organization-wide impact.

Northstar first attaches them to:

```text
Policy-Staging OU
```

containing representative test accounts.

The progression is:

```text
draft policy
    ↓
attach to policy-staging OU
    ↓
test console, CLI, workloads, and service integrations
    ↓
move a small number of ordinary accounts
    ↓
gradually expand
```

AWS strongly recommends testing SCPs on an OU with a small number of accounts before attaching them broadly, particularly before applying them to the root. 

---

## 7.8 Suspended OU

Accounts pending investigation, decommissioning, or closure move to a restrictive OU.

A suspended account might retain only the permissions needed for:

- security investigation;
- billing review;
- data export;
- backup;
- final closure.

Moving an account is not deletion. Logs and retained evidence remain available centrally.

---

# 8. AWS Organizations versus AWS Control Tower

## 8.1 AWS Organizations

Organizations supplies the primitives:

```text
accounts
OUs
organizational policies
trusted access
delegated administration
billing consolidation
```

An organization can build a landing zone manually using these primitives.

---

## 8.2 AWS Control Tower

Control Tower assembles an opinionated landing-zone framework on top of:

- AWS Organizations;
- IAM Identity Center;
- Service Catalog;
- CloudTrail;
- Config;
- CloudFormation;
- other integrated services.

It supplies:

- dedicated shared-account patterns;
- controls;
- Account Factory;
- OU and account governance;
- a central governance dashboard;
- drift reporting. 

### Memory rule

```text
Organizations
    → multi-account primitives

Control Tower
    → managed landing-zone orchestration
```

Control Tower does not replace Organizations.

---

## 8.3 When Organizations alone may be sufficient

A company may use Organizations without Control Tower when:

- it already has a mature custom landing zone;
- existing automation conflicts with Control Tower;
- the organization needs unusual account baselines;
- another governance system already manages equivalent capabilities;
- migration risk exceeds the benefit.

The burden then remains with the company to design and maintain:

- account vending;
- logging;
- Config deployment;
- controls;
- drift detection;
- identity integration;
- dashboarding.

---

## 8.4 Why Control Tower wins for Northstar

Northstar has:

- many inconsistent accounts;
- no mature custom landing-zone automation;
- a growing account population;
- a small central cloud team;
- standard governance requirements.

Control Tower gives the team a supported starting point rather than requiring it to build every governance workflow independently.

---

# 9. The Control Tower landing zone

## 9.1 Shared accounts

The baseline landing zone uses:

```text
Management account
Log Archive account
Audit account
```

Control Tower terminology describes these as shared accounts used for organization management, centralized logging, and security/audit access. 

Northstar gives them customized names:

```text
northstar-management
northstar-log-archive
northstar-security-audit
```

---

## 9.2 Governed OUs and enrolled accounts

Creating an OU in Organizations does not automatically mean Control Tower governs it.

Conceptually:

```text
Organizations OU
    ↓ register with Control Tower
Governed OU
    ↓ enroll accounts
Governed accounts
```

Registering an existing OU brings its accounts under the controls and baselines applied to that OU. Existing individual accounts can also be enrolled into already governed OUs. 

---

## 9.3 Account Factory

Account Factory is a standardized account-vending mechanism.

A request contains information such as:

```text
account name
account email
target OU
business owner
cost center
environment
network baseline
identity assignments
```

The resulting account receives:

- organization membership;
- Control Tower enrollment;
- selected controls;
- account baseline resources;
- standardized access;
- organizational metadata.

Control Tower implements Account Factory as an abstraction over AWS Service Catalog provisioned products. 

Lesson 6 will examine the broader governed-developer-platform role of Service Catalog and infrastructure templates.

---

## 9.4 Account Factory for Terraform

An organization that standardizes on Terraform can use Account Factory for Terraform to connect account requests and customization to Control Tower.

This is not required merely because some workload teams use Terraform.

The architectural requirement is:

```text
repeatable account vending
+
standard baseline
+
lifecycle management
```

The implementation can be:

- built-in Account Factory;
- Account Factory for Terraform;
- Account Factory Customization;
- another controlled automation mechanism.

---

## 9.5 Control Tower drift

Control Tower manages specific landing-zone resources and relationships.

Manual changes can produce drift, such as:

- detaching a managed SCP;
- moving an enrolled account outside its expected OU;
- deleting required IAM roles;
- disabling trusted access;
- altering protected log resources.

Control Tower detects several categories of governance and landing-zone drift, and some conditions must be repaired or reset before normal enrollment or updates continue. 

### Memory rule

```text
Workload configuration drift
    ≠
Landing-zone governance drift
```

---

# 10. Control behaviors

## 10.1 Preventive controls

A preventive control blocks a prohibited action.

```text
Caller attempts forbidden API operation
    ↓
organizational policy evaluation
    ↓
request denied
```

Examples:

- disallow leaving the organization;
- deny resource creation in unapproved Regions;
- prevent modification of central log buckets;
- block public exposure;
- restrict dangerous service actions.

Preventive controls are currently implemented with Organizations policy mechanisms such as SCPs, RCPs, and declarative policies. 

---

## 10.2 Detective controls

A detective control evaluates resource configuration and reports noncompliance.

```text
Resource is created or changed
    ↓
AWS Config records configuration
    ↓
Config rule evaluates it
    ↓
COMPLIANT or NON_COMPLIANT
```

Example:

```text
An EBS volume is created without required encryption.
```

A detective control generally does not prevent that creation. It detects the resulting state.

Remediation can be:

- manual;
- notification-driven;
- Systems Manager automation;
- another workflow.

Detective Control Tower controls use AWS Config rules. 

---

## 10.3 Proactive controls

A proactive control evaluates a CloudFormation resource before it is provisioned.

```text
CloudFormation proposes resource
    ↓
hook evaluates configuration
    ├── PASS → provisioning may continue
    └── FAIL → resource is not provisioned
```

This is different from an SCP:

```text
SCP:
    applies to covered AWS API activity,
    regardless of console, CLI, SDK, or CloudFormation origin

Proactive control:
    validates CloudFormation provisioning path
```

A resource created outside CloudFormation is not automatically governed by a proactive CloudFormation hook. Proactive Control Tower controls use CloudFormation hooks. 

---

## 10.4 Comparison

| Behavior | When evaluated | Typical mechanism | Outcome |
|---|---|---|---|
| Preventive | During prohibited action | SCP, RCP, declarative policy | API request denied |
| Proactive | Before CloudFormation provisioning | CloudFormation hook | Noncompliant resource rejected |
| Detective | After resource configuration exists | AWS Config rule | Violation reported |

### Exam hinge

```text
Must make action impossible
    → preventive control

Must reject bad CloudFormation before deployment
    → proactive control

Must continuously identify resources in bad state
    → detective control
```

---

# 11. Service control policies

## 11.1 What an SCP does

An SCP defines the maximum permissions available to principals in affected member accounts.

It applies to:

- IAM users in member accounts;
- IAM roles in member accounts;
- role sessions in member accounts;
- the member account root user.

It does not grant permission.

It does not restrict the management account’s users or roles. 

---

## 11.2 The basic equation

For an ordinary member-account principal:

\[
\text{effective authority}
\approx
\text{IAM grants}
\cap
\text{SCP ceiling}
\cap
\text{permissions boundary}
\cap
\text{session policy}
-
\text{explicit denies}
\]

Not every request uses every term, but the important relationship is:

```text
SCP permits
    AND
IAM does not grant
    =
DENY
```

and:

```text
IAM grants
    AND
SCP blocks
    =
DENY
```

---

## 11.3 AdministratorAccess does not escape an SCP

Suppose a production account role has:

```text
AdministratorAccess
```

The Production OU SCP denies:

```text
ec2:TerminateInstances
```

The role cannot terminate an instance.

The account administrator cannot repair this by attaching a broader IAM policy because the SCP defines a ceiling outside the account administrator’s control. AWS explicitly notes that even an IAM policy allowing all actions cannot override a permission blocked at an ancestor SCP level. 

---

## 11.4 Inheritance path

For this account:

```text
Root
    ↓
Workloads OU
    ↓
Production OU
    ↓
Commerce OU
    ↓
commerce-orders-prod
```

the effective SCP ceiling depends on every level.

Conceptually:

\[
C_{\text{effective}}
=
C_{\text{root}}
\cap
C_{\text{workloads}}
\cap
C_{\text{production}}
\cap
C_{\text{commerce}}
\cap
C_{\text{account}}
\]

An explicit deny at any point wins.

A child OU cannot restore an action that an ancestor denied.

---

## 11.5 Deny-list strategy

The common starting strategy retains:

```text
FullAWSAccess
```

and adds explicit denies.

Example:

```text
Allow all actions as the organizational ceiling,
except:
    leaving organization
    closing member account
    disabling central audit
    using unapproved Regions
```

The actual workload principal still needs an IAM grant.

The AWS Organizations examples generally use this model and retain `FullAWSAccess` alongside deny SCPs. 

### Advantages

- easier adoption;
- lower risk of accidentally omitting service dependencies;
- new AWS actions remain available unless explicitly denied.

### Disadvantages

- policy authors must identify dangerous actions;
- newly released services may become usable automatically;
- weaker default restriction.

---

## 11.6 Allow-list strategy

A strict OU can remove the broad allow and permit only approved services and actions.

Example conceptual ceiling:

```text
Allow:
    S3
    DynamoDB
    Lambda
    CloudWatch
    required IAM actions
```

For an action to remain available, it must be allowed at every level in the account’s path. If an allow is missing at the root, an OU, or the account level, the action remains denied. 

### Advantages

- stronger default restriction;
- new services do not become automatically usable.

### Disadvantages

- high maintenance;
- easy to omit hidden service dependencies;
- can break AWS service integrations;
- policy size and complexity grow quickly.

---

## 11.7 Root-level organizational protection

A useful root-level preventive policy denies member accounts from leaving or closing themselves without central approval:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventUnapprovedDepartureOrClosure",
      "Effect": "Deny",
      "Action": [
        "organizations:LeaveOrganization",
        "account:CloseAccount"
      ],
      "Resource": "*"
    }
  ]
}
```

AWS recommends this type of control because uncontrolled departure or closure can disrupt governance, billing, and security controls. 

---

## 11.8 Region-deny policies

A Region restriction may deny actions outside:

```text
us-east-1
eu-west-1
```

But some AWS services are global or require calls through particular endpoints.

A naïve rule can break:

- IAM;
- Route 53;
- CloudFront;
- Organizations;
- billing;
- global support operations;
- service-specific control planes.

Region-deny policies therefore commonly use carefully tested exceptions, often through `NotAction` and condition logic.

### Exam hinge

> “Restrict workloads to approved Regions” does not mean “deny every API whose request Region is different.”

---

## 11.9 SCP versus IAM policy

| Question | IAM policy | SCP |
|---|---|---|
| Where attached? | User, group, role, or supported resource | Root, OU, or account |
| Can grant permission? | Yes | No |
| Main purpose | Give a principal authority | Bound maximum authority |
| Managed by | Account administrators or central platform | Organization administration |
| Applies to management account? | Yes, when attached there | No |
| Can local administrator override? | Potentially, if authorized to edit IAM | No, unless organization policy is changed |

The attached study material repeatedly emphasizes that SCPs resemble IAM permission policies syntactically but do not grant permissions. 

---

# 12. Other organization policy types

## 12.1 Tag policies

Tag policies standardize:

- tag-key spelling;
- tag-key case;
- allowed values;
- value case;
- compliance reporting;
- enforcement for supported tagging operations and resource types.

Example:

```text
Required convention:
    CostCenter

Not:
    cost-center
    costcenter
    COST_CENTER
```

However, ordinary tag-policy rules evaluate tags when they exist. An entirely untagged resource is not automatically made compliant or blocked merely because a tag policy defines `CostCenter`. 

---

## 12.2 Resource control policies

RCPs are a newer Organizations authorization-policy type.

```text
SCP:
    maximum permissions of principals in member accounts

RCP:
    maximum permissions that organization resources
    can expose through resource-based authorization
```

An RCP can help prevent resources such as supported S3 resources from being exposed outside organizational policy boundaries.

Like an SCP, an RCP does not grant access. Actual identity-based or resource-based permission is still required. 

For SAP-C02 study, retain RCP at recognition level unless current practice questions emphasize it.

---

## 12.3 Backup policies

Organizations backup policies can apply central backup plans across accounts.

They are not equivalent to SCPs:

```text
SCP
    limits actions

Backup policy
    defines organizational backup configuration
```

Backup policy design returns in the disaster-recovery lesson.

---

## 12.4 Control Tower control versus raw policy

A Control Tower control is a high-level governance rule.

Its implementation may be:

- SCP;
- RCP;
- declarative policy;
- Config rule;
- CloudFormation hook.

Therefore:

```text
Control
    → desired governance behavior

SCP / Config rule / hook
    → underlying implementation
```

---

# 13. IAM Identity Center

## 13.1 The workforce problem

Without centralized federation, Northstar might create:

```text
Agustín-commerce-dev
Agustín-commerce-prod
Agustín-logistics-dev
Agustín-security-audit
...
```

Each identity would require:

- separate lifecycle management;
- separate MFA;
- credential removal when employment ends;
- access reviews;
- password and key management.

This does not scale.

---

## 13.2 External identity provider

Northstar keeps employee identity in its corporate IdP.

Examples could include:

- Microsoft Entra ID;
- Okta;
- another SAML-compatible provider.

Two processes occur:

### User and group provisioning

```text
Corporate directory
    ↓ SCIM
IAM Identity Center
```

SCIM synchronizes users and groups.

### Authentication

```text
Employee
    ↓
Corporate IdP login and MFA
    ↓ SAML federation
IAM Identity Center session
```

IAM Identity Center requires relevant users and groups to be provisioned before they can receive account assignments; external IdPs can automate this through SCIM. 

---

## 13.3 Permission sets

A permission set is a reusable template defining account access.

Examples:

```text
ProductionReadOnly
NonproductionDeveloper
CommerceOperator
SecurityAudit
NetworkAdministrator
BillingAnalyst
EmergencyAdministrator
```

A permission set can contain:

- AWS-managed policies;
- customer-managed policy references;
- an inline policy;
- a permissions boundary;
- session settings.

A permission set by itself is not yet an active role in every account.

---

## 13.4 Assignment

Northstar creates an assignment:

```text
Group:
    CommerceDevelopers

Permission set:
    NonproductionDeveloper

Accounts:
    commerce-development
    commerce-integration-test
```

IAM Identity Center then creates and manages corresponding IAM roles in those accounts. Authorized group members can assume those roles through the access portal or AWS CLI. 

### Memory rule

```text
Permission set
    → reusable role blueprint

Assignment
    → group/user + permission set + account

Provisioned IAM role
    → actual account identity assumed by user
```

---

## 13.5 Example access matrix

| Group | Permission set | Account scope |
|---|---|---|
| CommerceDevelopers | NonproductionDeveloper | Commerce nonproduction |
| CommerceOnCall | ProductionOperator | Commerce production |
| CommerceManagers | ProductionReadOnly | Commerce production |
| SecurityAnalysts | SecurityAudit | All governed member accounts |
| NetworkTeam | NetworkAdministrator | Network and shared-services accounts |
| FinOps | BillingAnalyst | Cost-management scope |
| CloudPlatform | AccountAdministrator | Selected infrastructure accounts |

Assign access to groups rather than maintaining a large list of individual user assignments.

---

## 13.6 Authorization path

```text
1. Employee authenticates to corporate IdP.

2. IdP establishes the employee's federated identity.

3. IAM Identity Center identifies synchronized group memberships.

4. Employee selects:
       commerce-orders-prod
       ProductionReadOnly

5. IAM Identity Center permits assumption of the
   corresponding role in that account.

6. STS supplies temporary role-session credentials.

7. The employee calls an AWS API.

8. IAM evaluates the role's policies.

9. SCPs limit the role's maximum authority.

10. Resource policies, boundaries, conditions,
    and explicit denies may also affect the request.
```

The final principal is an assumed IAM role session in the target account—not a permanent IAM user copied from the corporate directory.

---

## 13.7 Authentication versus authorization

The corporate IdP answers:

> Is this employee who they claim to be?

IAM Identity Center assignment answers:

> Which account roles may this employee assume?

The permission set answers:

> What permissions should those roles receive?

The SCP answers:

> What is the maximum that any role in this account may do?

The target service finally evaluates the requested action.

---

## 13.8 Identity Center does not connect networks

An employee may successfully assume:

```text
NetworkAdministrator
```

in the network account but still be unable to connect to a private EC2 address.

IAM Identity Center provides AWS identity and temporary credentials.

Private resource access additionally requires:

- VPN or Direct Connect;
- VPC routes;
- security groups;
- NACLs;
- application authentication.

---

# 14. Created accounts versus invited accounts

## 14.1 Account created through Organizations

When Organizations creates a member account, it automatically creates an administrative cross-account role named:

```text
OrganizationAccountAccessRole
```

This permits appropriately authorized principals in the management account to assume the role and administer the new member account. The role remains subject to the SCPs applied to that member account. 

---

## 14.2 Existing account invited into the organization

An invited account does not automatically receive that role.

If Northstar needs equivalent administrative access, an administrator in the invited account must create a trusted role manually—commonly using the same `OrganizationAccountAccessRole` name. 

### Exam hinge

```text
Organization-created account
    → access role created automatically

Invited existing account
    → no automatic access role
```

Joining an organization does not inherently grant the management account full administrative control of every pre-existing account.

The uploaded practice material emphasizes exactly this distinction. 

---

## 14.3 Daily workforce access

Northstar does not use `OrganizationAccountAccessRole` as the ordinary employee access mechanism.

Daily access uses:

```text
IAM Identity Center
    ↓
job-specific permission sets
```

The organization access role remains a controlled administrative and bootstrap mechanism.

---

# 15. Delegated administration

## 15.1 Why delegate

The management account has unusually broad organizational authority and is not protected by SCPs.

Northstar therefore delegates supported services to member accounts.

Examples:

```text
AWS Config
    → Security/Audit account

CloudTrail administration
    → Security/Audit account, where configured

Security services
    → Security Tooling account

Network services
    → Network account

Cost operations
    → controlled FinOps access
```

AWS recommends delegating supported responsibilities and reserving the management account for tasks that require it. 

---

## 15.2 What delegated administration means

A delegated administrator account can administer a specific integrated AWS service for the organization.

It does not become:

- the Organizations management account;
- universally administrative across every AWS service;
- immune to SCPs;
- owner of every member resource.

SCPs continue to apply because the delegated administrator is still a member account. 

---

## 15.3 Trusted access

A supported AWS service can be granted **trusted access** to the organization.

This allows the service to perform organization-aware operations and often create service-linked roles in member accounts.

Conceptually:

```text
Management account enables trusted access
    ↓
Integrated AWS service
    ↓
service-linked roles or organization APIs
    ↓
member-account functionality
```

Trusted access is not equivalent to granting arbitrary human administrators access to member accounts.

---

## 15.4 Service-specific delegation

Delegation is configured separately for each supported service.

```text
Security account is delegated administrator for Config
```

does not imply:

```text
Security account can modify every ECS service,
database, or IAM policy in every account.
```

The service contract defines the delegated authority.

---

# 16. Centralized CloudTrail

## 16.1 Organization trail

Northstar configures a multi-Region organization trail.

```text
All governed accounts
    ↓ management events
CloudTrail organization trail
    ↓
S3 bucket in Log Archive account
```

An organization trail:

- includes member accounts;
- automatically begins logging newly added accounts;
- can be administered by the management or configured delegated administrator;
- is visible to member accounts;
- cannot be modified or deleted by member-account users. 

---

## 16.2 What CloudTrail answers

CloudTrail answers questions such as:

```text
Who changed this bucket policy?
Which role terminated the instance?
Was MFA present?
Which API action modified the SCP?
Which account disabled a service?
Was the request made through console, CLI, SDK, or AWS service?
What source IP or AWS service initiated it?
```

It principally records AWS account and API activity.

---

## 16.3 Event History is not the organization archive

Every account has recent CloudTrail Event History for management events.

But Event History:

- is limited to the previous 90 days;
- is Regional;
- shows management events;
- does not provide organization-level aggregation;
- is not a permanent organization archive.

An organization trail or organization event data store is needed for ongoing centralized evidence. 

---

## 16.4 Management events versus data events

### Management events

Examples:

```text
CreateBucket
RunInstances
PutBucketPolicy
CreateRole
StopLogging
```

Trails log management events by default.

### Data events

Examples:

```text
S3 GetObject
S3 PutObject
Lambda Invoke
DynamoDB item-level operations
```

Data events are often high volume and are not logged by default. Northstar enables selected data events for high-value resources rather than indiscriminately logging every object read across the company. 

---

## 16.5 Log archive bucket

The Log Archive account owns the destination bucket.

The bucket design includes:

- Block Public Access;
- bucket-owner control;
- a bucket policy permitting the CloudTrail service to write expected prefixes;
- KMS encryption when required;
- lifecycle and retention policies;
- restrictive human read roles;
- deny rules preventing ordinary deletion or policy changes;
- optional S3 Object Lock for regulatory immutability.

Workload administrators do not receive write or delete access to the archive.

---

## 16.6 CloudTrail delivery authorization trace

```text
CloudTrail service
    ↓
organization trail configuration
    ↓
s3:PutObject
    ↓
Log Archive bucket/account prefix
    ↓ evaluates
bucket policy
source trail ARN condition
KMS key policy, if configured
organizational controls
    ↓
log object written
```

The originating workload account does not need VPC peering with the Log Archive account.

CloudTrail performs an AWS service-to-service API operation.

---

## 16.7 Account removal

If an account leaves the organization:

- the organization trail no longer records new activity from it;
- previously delivered log files remain in the central S3 bucket.

This preserves historical evidence from the period during which the account was governed. 

---

## 16.8 Duplicate trails during enrollment

Existing accounts may already have local trails.

If Control Tower later configures an organization trail while the old trails remain, Northstar can incur duplicate event logging and cost.

Account enrollment therefore includes an explicit inventory and consolidation decision for:

- CloudTrail trails;
- Config recorders;
- delivery channels;
- existing log destinations. 

---

# 17. Centralized AWS Config

## 17.1 What Config records

AWS Config records:

- resource configuration;
- configuration history;
- resource relationships;
- compliance against Config rules.

Example:

```text
EC2 instance i-123
    associated with
Security group sg-456
    which changed from
port 443 only
    to
0.0.0.0/0 on port 22
```

The uploaded cheat sheet describes Config as an inventory, configuration-history, relationship, and compliance service. 

---

## 17.2 Recording occurs in source accounts and Regions

Config must record resources where they exist.

Conceptually:

```text
Account A / us-east-1 recorder
Account A / eu-west-1 recorder
Account B / us-east-1 recorder
...
```

Each relevant account and Region needs the appropriate Config recording setup.

---

## 17.3 Organization aggregator

Northstar creates an organization aggregator in the Security/Audit account.

```text
AWS Config in member accounts and Regions
    ↓
organization aggregator
    ↓
central read-only inventory and compliance view
```

The aggregator collects data only from accounts and Regions where Config is enabled. It does not itself enable Config in those source locations. 

---

## 17.4 Aggregator is read-only

The aggregator can answer:

```text
Which accounts have public S3 buckets?
Which Regions contain unencrypted volumes?
Where is security group sg-123 referenced?
Which resources violate this Config rule?
```

It cannot directly:

- change the member resource;
- deploy a rule into the source account;
- push a configuration snapshot back;
- remediate through aggregation alone.

AWS explicitly describes the aggregator as a replicated, read-only view. 

---

## 17.5 Organization conformance packs

A conformance pack groups:

- Config rules;
- optional remediation actions;
- related parameters.

An organization conformance pack can deploy a common set across member accounts while allowing configured exclusions. 

Examples:

```text
Production baseline
    encryption rules
    public-access rules
    logging rules
    backup rules

Sandbox baseline
    basic security rules
    cost-limiting rules
```

---

## 17.6 CloudTrail versus Config

| Question | Service |
|---|---|
| Who changed the security group? | CloudTrail |
| What did the security group configuration become? | Config |
| Was the security group compliant with the rule? | Config |
| Is the application currently returning 500s? | CloudWatch |
| What API call created the instance? | CloudTrail |
| Which resources are related to the instance? | Config |

### Memory rule

```text
CloudTrail
    → activity and actor

Config
    → resource state and compliance

CloudWatch
    → operational behavior
```

---

# 18. Log Archive versus Security/Audit account

## 18.1 Log Archive account

The Log Archive account is optimized for:

- receiving evidence;
- retaining evidence;
- preventing modification;
- narrow write paths;
- narrow human access.

It should not host general security automation that needs broad permissions.

---

## 18.2 Security/Audit account

The Security/Audit account is optimized for:

- investigator access;
- organization Config aggregation;
- delegated administration;
- threat and compliance dashboards;
- incident-response workflows;
- cross-account inspection.

It can receive read access to the Log Archive account without receiving permission to delete or rewrite logs.

---

## 18.3 Why separate them?

Suppose a security automation role is compromised.

If logging and tooling share one account and role boundary, the attacker may be able to:

```text
alter the tools
AND
delete the evidence
```

Separation allows:

```text
Security tooling account
    → analyze logs

Log Archive account
    → preserve logs
```

The additional account is justified by the different trust and lifecycle requirements.

---

# 19. Networking in a landing zone

## 19.1 Organizations does not connect VPCs

Placing two accounts in the same organization does not create:

- routes;
- VPC peering;
- Transit Gateway attachments;
- shared security groups;
- private DNS;
- VPN connectivity;
- Direct Connect connectivity.

Likewise, placing two accounts in the same OU does not let their workloads exchange packets.

```text
Same organization
    ≠
same network
```

---

## 19.2 Identity access is not private network access

A Commerce engineer can assume a role in:

```text
commerce-orders-prod
```

and call:

```text
ec2:DescribeInstances
```

without any VPC peering between the engineer’s home account and the production account.

That is an AWS control-plane API call through AWS endpoints.

But connecting to:

```text
10.20.14.18:5432
```

requires an actual network path.

---

## 19.3 Central logs do not require VPC peering

CloudTrail and Config deliver through managed AWS service interactions.

Northstar does not need:

```text
48 VPC peering connections
```

merely to centralize CloudTrail logs.

The key controls are:

- service configuration;
- IAM and resource policies;
- KMS;
- destination permissions;
- organization integration.

---

## 19.4 Network account

Northstar creates a dedicated Network account in the Infrastructure OU.

That account will later own or administer:

- Transit Gateway;
- shared DNS;
- egress inspection;
- hybrid connectivity;
- centralized network services.

The account’s existence does not automatically make it the packet path. Routes and attachments must still be configured.

---

## 19.5 Account boundary and network boundary are independent

Four cases are possible:

| Account relationship | Network relationship | Result |
|---|---|---|
| Same account | Same VPC | Potential local path |
| Same account | Separate unconnected VPCs | No private path |
| Different accounts | Connected VPCs | Private path possible |
| Different accounts | No connectivity | No private path |

IAM authority is another independent dimension.

---

# 20. Integrated traces

## 20.1 Employee assumes a production role

### Identity and authorization trace

```text
Employee
    ↓ authenticates
Corporate IdP
    ↓ SAML
IAM Identity Center
    ↓ group assignment
ProductionReadOnly permission set
    ↓
IAM Identity Center-managed role
in commerce-orders-prod
    ↓ STS temporary credentials
ec2:DescribeInstances
    ↓
IAM role policy permits
Production OU SCP permits
resource and condition evaluation permits
    ↓
API succeeds
```

### Network trace

```text
Employee device
    ↓ HTTPS
corporate IdP
    ↓ HTTPS
AWS access portal / STS / EC2 API endpoint
```

No connection to the production VPC is required for the control-plane API call.

---

## 20.2 Security analyst reads central logs

### Authorization trace

```text
Security analyst
    ↓
SecurityAudit permission set
    ↓
role in Security/Audit account
    ↓ assumes or accesses approved reader role
Log Archive account
    ↓
s3:GetObject
    ↓
CloudTrail prefix
    ↓
bucket policy + IAM + KMS
```

### Network trace

The analyst may query:

- CloudTrail Lake;
- Athena over S3 logs;
- S3 API;
- a security analysis platform.

A VPC path is required only when Northstar intentionally places the analysis endpoint behind private networking.

---

## 20.3 Workload tries to reach private database in another account

```text
Commerce application
    ↓ has IAM permission
to retrieve database secret

Database:
    private IP in Shared Services account
```

The connection still fails when no:

- Transit Gateway route;
- VPC peering;
- PrivateLink design;
- security-group permission;
- database listener path;

exists.

```text
Secret access
    ≠
database reachability
```

---

## 20.4 Config aggregator receives compliance data

```text
Config recorder in member account
    ↓
AWS Config service
    ↓ organization integration
Security/Audit aggregator
    ↓
read-only central view
```

An SCP denying the investigator direct EC2 modification does not prevent the aggregator from displaying compliance data when the service integration is correctly configured.

---

# 21. Account lifecycle

## 21.1 Request

A team requests an account with:

```text
BusinessUnit
Environment
Workload
Owner
CostCenter
DataClassification
Target OU
Required Regions
Networking profile
```

A request missing an accountable owner or cost center is rejected before account creation.

---

## 21.2 Provision

Account Factory:

1. creates the account;
2. places or enrolls it into the intended governed OU;
3. applies landing-zone baselines;
4. configures central logging and Config;
5. provisions identity assignments;
6. applies account metadata;
7. invokes customization workflows.

---

## 21.3 Validate

The account is not handed to the team until validation confirms:

```text
organization trail active
Config recording active
required controls applied
Identity Center assignment works
billing metadata present
approved Regions configured
no unwanted default resources
baseline stack healthy
```

---

## 21.4 Operate

During operation:

- Control Tower reports governance state;
- Config reports compliance;
- CloudTrail records administrative activity;
- budgets and anomaly mechanisms monitor cost;
- account ownership is reviewed;
- temporary exceptions expire.

---

## 21.5 Suspend

When a workload is retired or an account is under investigation:

1. move it to the Suspended OU;
2. preserve logs and backups;
3. remove ordinary workforce assignments;
4. restrict network connectivity;
5. stop or archive resources;
6. retain only central investigation access.

Moving the account can immediately change its effective organizational policies, so this step must be planned carefully. 

---

## 21.6 Close

Before closure:

```text
confirm legal and retention obligations
export required data
remove delegated-administrator designations
resolve commitments and marketplace subscriptions
verify central logs
remove dependencies
close through controlled process
```

An account designated as a delegated administrator for an integrated service must be replaced or deregistered before it leaves the organization. 

---

# 22. Enrolling existing accounts

## 22.1 Inventory first

Northstar inventories each acquired or legacy account:

- existing Organizations membership;
- current CloudTrail trails;
- Config recorders and delivery channels;
- IAM users and roles;
- root credential state;
- Regions in use;
- network dependencies;
- billing commitments;
- public resources;
- resource naming and tags;
- external integrations.

Enrollment is not merely an invitation click.

---

## 22.2 Invite to Organizations

An account owner accepts an invitation from Northstar’s organization.

The account:

- becomes a member;
- begins participating in consolidated billing;
- becomes subject to applicable root policies;
- does not automatically receive `OrganizationAccountAccessRole`.

The administrative role must be established explicitly when required. 

---

## 22.3 Enroll in Control Tower

After prerequisites are resolved, the account is enrolled into a governed OU.

Possible preparation includes:

- reconciling existing Config setup;
- consolidating duplicate CloudTrail trails;
- creating required Control Tower roles;
- resolving resource conflicts;
- testing SCP impact;
- validating identity access.

Control Tower supports enrollment of existing accounts and registration of existing OUs in the same Organizations environment. 

---

## 22.4 Quarantine migration pattern

For uncertain acquired accounts:

```text
Invitation
    ↓
Enrollment OU / quarantine
    ↓
inventory and remediation
    ↓
control validation
    ↓
move to target workload OU
```

This prevents one unusual account from interfering with broader OU enrollment.

AWS Control Tower documentation similarly recommends using an enrollment-oriented OU when an account’s readiness is uncertain. 

---

# 23. Consolidated billing

## 23.1 One billing family

With consolidated billing, Northstar receives a combined view of account charges.

Benefits include:

- one consolidated bill;
- account-level cost visibility;
- aggregated usage for eligible volume pricing;
- sharing of eligible Reserved Instance and Savings Plans discounts;
- centralized cost-management analysis.

Consolidated billing has no additional Organizations fee. 

---

## 23.2 Billing consolidation does not merge accounts

Accounts remain separate:

```text
IAM
resources
quotas
networking
administration
```

Only the billing relationship is consolidated.

```text
One invoice
    ≠
one AWS account
```

---

## 23.3 Commitment sharing

By default or according to configured sharing policy, eligible Reserved Instance and Savings Plans discounts can apply across accounts in the consolidated billing family.

The management account can modify sharing preferences, including deactivating sharing for selected accounts. Disabling sharing may increase total cost or leave commitments underutilized. 

---

## 23.4 Central commitment procurement

Northstar wants only FinOps to purchase long-term commitments.

A Production OU SCP can deny member-account actions such as purchasing or modifying Reserved Instance offerings.

The centralized procurement process then purchases commitments through approved accounts and manages sharing policy.

The uploaded study guide gives this as a representative organizational scenario: use an SCP to prohibit decentralized RI purchases rather than expecting billing consolidation itself to prevent them. 

---

# 24. Cost attribution

## 24.1 Account is the first cost dimension

A dedicated account provides a strong natural attribution boundary:

```text
commerce-orders-prod
    → Commerce / Orders / Production
```

This is more reliable than attempting to tag every resource perfectly inside one enormous shared account.

---

## 24.2 Account tags

Northstar tags accounts in Organizations:

```text
BusinessUnit = Commerce
Environment  = Production
Owner        = commerce-platform
CostCenter   = CC-4100
```

Account tags can be activated for cost allocation so they appear in supported cost-management data. 

---

## 24.3 Resource tags

Inside an account, resources receive:

```text
Application = Orders
Component   = API
Project     = CheckoutModernization
Owner       = commerce-orders
CostCenter  = CC-4100
ManagedBy   = CloudFormation
```

Resource tags support finer attribution than the account boundary.

---

## 24.4 Activating cost allocation tags

Applying a tag to a resource is not enough for billing analysis.

The tag key must be activated in Billing and Cost Management.

```text
Tag exists on resource
    ↓
management account activates tag key
    ↓
tag appears as cost-allocation dimension
```

AWS requires user-defined tag keys to be activated before they appear in cost allocation reports and tools. 

---

## 24.5 Tag policy is not cost activation

These are independent operations:

```text
Tag policy:
    Is the organization's tag usage standardized?

Cost allocation activation:
    Does this tag appear in billing data?
```

A perfectly compliant `CostCenter` tag is not automatically a billing dimension until activated.

---

## 24.6 Tag policy does not automatically add tags

A tag policy can say:

```text
When CostCenter is used,
its key must be exactly "CostCenter"
and its value must come from this set.
```

That does not automatically attach `CostCenter` to every resource.

To require tags at creation, Northstar may combine:

- Account Factory and infrastructure templates;
- Service Catalog tag options;
- IAM or SCP conditions using request tags where supported;
- proactive CloudFormation controls;
- detective Config rules;
- remediation.

Tag enforcement must be tested because not every resource supports identical tag-on-create behavior. 

---

## 24.7 Cost Categories

Cost Categories map raw billing dimensions into business concepts.

Example:

```text
If account tag BusinessUnit = Commerce
    → Cost Category BusinessUnit = Commerce

If account is Network or Log Archive
    → Cost Category CostType = Shared Services

If service = Enterprise Support
    → Cost Category CostType = Corporate Overhead
```

Cost Categories can be represented in Cost and Usage Reports and used to organize costs beyond one raw tag or account field. 

---

## 24.8 Shared costs

Some accounts serve everyone:

```text
Network
Log Archive
Security Tooling
Shared CI/CD
Enterprise Support
```

Northstar can use one of several allocation models:

### Direct assignment

```text
Each business unit pays its own dedicated resources.
```

### Proportional allocation

```text
Shared network cost allocated by transferred bytes.
```

### Headcount allocation

```text
Shared collaboration cost allocated by user count.
```

### Revenue allocation

```text
Corporate overhead allocated by business-unit revenue.
```

The technical billing dataset does not decide the fair business formula. It provides the inputs.

---

## 24.9 Showback versus chargeback

### Showback

```text
Commerce consumed $420,000 this month.
```

The amount is visible but no internal financial transfer occurs.

### Chargeback

```text
Commerce's internal budget is formally charged $420,000.
```

Chargeback usually requires accounting processes beyond the AWS invoice.

AWS Billing Conductor and billing views can support custom pro forma views, but the organization still defines the commercial allocation logic.

---

# 25. Cost-management tools

## 25.1 Cost Explorer

Use Cost Explorer for:

- interactive analysis;
- filtering by account, service, Region, tag, or category;
- trends;
- forecasts;
- commitment utilization and coverage views.

The management account can see organization-wide cost data, while member-account access is normally limited to that member’s own data and organizational preferences. 

---

## 25.2 AWS Budgets

Use Budgets for threshold-oriented notifications:

```text
Commerce nonproduction exceeds forecast.
Sandbox account approaches monthly limit.
Savings Plan utilization falls below target.
```

Budgets is not a real-time packet filter or instantaneous spending kill switch. Cost data is updated periodically, often hours apart. 

---

## 25.3 Cost and Usage Report

The Cost and Usage Report contains the most detailed cost and usage data.

Use it for:

- hourly or daily analysis;
- resource identifiers;
- cost allocation tags;
- Savings Plan and RI attribution;
- custom FinOps analytics;
- Athena or warehouse queries;
- historical allocation models.

CUR 2.0 provides a more consistent schema than the original variable-column report model. 

---

## 25.4 Comparison

| Need | Tool |
|---|---|
| Explore spend interactively | Cost Explorer |
| Alert on threshold or forecast | AWS Budgets |
| Build detailed custom analysis | CUR / CUR 2.0 |
| Map raw dimensions into business groups | Cost Categories |
| Standardize resource metadata | Tag policies |
| Obtain eligible combined discounts | Consolidated billing |

---

# 26. IAM and billing access

Billing data is sensitive.

Northstar creates permission sets such as:

```text
BillingReadOnly
BudgetAdministrator
CostAllocationAdministrator
CommitmentPurchaser
```

It does not give every production administrator:

```text
full Billing and Cost Management access
```

The roles are separated because:

- viewing cost;
- modifying budgets;
- purchasing commitments;
- changing discount sharing;
- editing payment settings;

are different authorities.

---

# 27. Security and governance layers

```text
AWS account
    → workload and administrative boundary

OU
    → inherited governance grouping

SCP
    → principal permission ceiling

RCP
    → resource-policy permission ceiling

IAM Identity Center
    → workforce access federation

Permission set
    → reusable account-role permissions

Control Tower preventive control
    → blocked prohibited action

Control Tower proactive control
    → blocked noncompliant CloudFormation resource

Config detective control
    → detected noncompliant state

CloudTrail organization trail
    → centralized API and account activity

Config aggregator
    → centralized resource and compliance view

Log Archive account
    → durable evidence

Security/Audit account
    → central investigation and delegated administration

Consolidated billing
    → organization-wide billing family

Tags and Cost Categories
    → business attribution
```

No one mechanism supplies complete governance.

---

# 28. Reliability and governance failure modes

## 28.1 Management-account compromise

This is among the most severe control-plane failures because the account can modify:

- organization policies;
- account membership;
- delegated administration;
- trusted access;
- billing configuration.

Mitigations include:

- no workloads;
- very few assignments;
- strong MFA;
- tightly controlled root recovery;
- CloudTrail;
- separation of duties;
- delegated service administration;
- emergency procedures.

---

## 28.2 Policy blast radius

An erroneous root-level SCP can disrupt every member account.

Use:

```text
policy-staging OU
small rollout
effective-policy inspection
service-last-accessed information
documented rollback
```

The management account remains able to repair SCP mistakes because the SCP does not restrict it.

That exceptional recovery capability is also why the management account must be heavily protected.

---

## 28.3 Account-move blast radius

Moving an account changes the inherited policy path.

Example:

```text
Research account
    moved from Sandbox
    to Production
```

It may immediately lose permission to:

- use experimental Regions;
- launch unsupported instance types;
- modify its own networking;
- use unapproved services.

Account movement is a governance change, not a cosmetic reorganization.

---

## 28.4 Identity-provider outage

If the corporate IdP or federation path fails, ordinary workforce access may stop.

Northstar maintains tightly controlled emergency access that:

- does not depend on the failing IdP;
- is not used for normal operations;
- has strong MFA and monitored credentials;
- is tested periodically;
- produces immediate alerts when used.

An emergency administrator should not become a routine convenience account.

---

## 28.5 Config cost explosion

Config charges are driven by recorded configuration items and rule evaluations.

Ephemeral resources that are repeatedly created and deleted across many accounts and Regions can generate substantial Config activity. Control Tower itself has no extra service fee, but the services it enables—including Config, CloudTrail, S3, and CloudWatch—incur usage charges. 

The answer is not to disable governance blindly. Instead:

- understand recording scope;
- eliminate unnecessary Regions;
- avoid duplicate configurations;
- review rule value;
- measure cost by OU and workload type.

---

## 28.6 Duplicate or missing evidence

Possible failures include:

```text
duplicate CloudTrail trails
Config not enabled in one Region
new account not enrolled
log bucket KMS policy rejects service
organization trail disabled centrally
aggregator excludes future Regions
```

Governance services themselves need monitoring and periodic validation.

---

# 29. Failure drills

## Failure A: AdministratorAccess cannot terminate an EC2 instance

Investigate:

```text
SCP explicit deny
permissions boundary
session policy
resource condition
```

`AdministratorAccess` does not override an organizational ceiling.

---

## Failure B: SCP allows EC2, but the engineer receives `AccessDenied`

The SCP does not grant authority.

Investigate:

```text
Identity Center permission set
provisioned IAM role
permissions boundary
session policy
resource policy
explicit deny
```

---

## Failure C: A management-account role can perform an action denied at the root SCP

This is expected.

SCPs do not restrict management-account principals.

The architectural mistake may be that ordinary workloads or administrators were placed in that account.

---

## Failure D: A delegated security account is blocked by an SCP

This is also possible.

A delegated administrator remains a member account and remains subject to applicable SCPs.

---

## Failure E: An acquired account joined the organization, but central administrators cannot assume `OrganizationAccountAccessRole`

Invited accounts do not receive that role automatically.

Create the intended cross-account role in the member account and configure both caller permission and target trust.

---

## Failure F: An account created through Organizations lacks ordinary developer access

`OrganizationAccountAccessRole` is not the workforce-access system.

Create the appropriate IAM Identity Center assignment and permission set.

---

## Failure G: Employee appears in the IdP but not in IAM Identity Center

Investigate:

```text
SCIM provisioning
attribute mapping
group synchronization
user activation
identity source
```

Authentication federation and directory provisioning are related but distinct.

---

## Failure H: Employee can sign in but cannot select one AWS account

Investigate:

```text
user/group assignment
target account
permission set
account enrollment
Identity Center provisioning status
```

---

## Failure I: Employee enters the account but an API action is denied

The role assumption succeeded.

Investigate:

```text
permission-set policy
SCP
permissions boundary
resource policy
conditions
KMS key policy
```

---

## Failure J: New account does not appear in the Control Tower dashboard

Possible causes:

```text
account is in an unregistered OU
account was not enrolled
enrollment prerequisites failed
landing zone drift
baseline operation incomplete
```

Organizations membership alone is not Control Tower governance.

---

## Failure K: Member administrator can see the organization trail but cannot change it

That is expected.

Member accounts can view organization-trail metadata but cannot modify or delete the organization trail. 

---

## Failure L: New account produces no central CloudTrail logs

Investigate:

```text
organization trail status
account organization membership
service-linked role
bucket policy
KMS policy
trail event selectors
Control Tower enrollment
```

---

## Failure M: S3 object reads are absent from CloudTrail

Object-level S3 access is a data event.

Data events are not logged by default and must be selected explicitly. 

---

## Failure N: Config aggregator does not show one Region

Investigate:

```text
Config recorder enabled in source Region
aggregator Region selection
future-Region setting
organization integration
source account enrollment
```

The aggregator cannot collect configuration that the source account never recorded.

---

## Failure O: Security team attempts remediation through Config aggregator and cannot modify the resource

Expected behavior.

The aggregator is a read-only centralized view. Remediation needs a separate cross-account role or automated remediation mechanism. 

---

## Failure P: Moving an account to Production breaks its deployment

The Production OU’s inherited SCPs now apply.

Review the complete root-to-account policy path before moving accounts.

---

## Failure Q: CostCenter exists on resources but cannot be selected in Cost Explorer

The tag key may not have been activated as a cost allocation tag, or billing data has not yet incorporated it.

Applying a tag and activating it for billing are separate steps.

---

## Failure R: Tag-compliance report is green, but some resources have no tags

Ordinary tag-policy compliance may not evaluate entirely untagged resources.

Use additional proactive, preventive, or detective controls to require tag presence.

---

## Failure S: One business unit cannot receive a Savings Plan discount purchased centrally

Investigate:

```text
discount-sharing preferences
purchase ownership
usage eligibility
sharing group or restrictions
time and product compatibility
```

Consolidated billing does not guarantee every commitment applies to every possible usage line.

---

## Failure T: Private RDS in another account is unreachable despite a valid cross-account role

The role solves AWS authorization.

It does not create:

- routes;
- Transit Gateway attachments;
- VPC peering;
- PrivateLink;
- security-group rules.

---

## Failure U: Control Tower reports drift after an administrator “fixed” a managed SCP manually

The administrator changed a Control Tower-managed resource outside its expected lifecycle.

Repair or reset the landing-zone baseline rather than treating the control as an ordinary unmanaged policy.

---

## Failure V: Region-deny SCP breaks IAM or Route 53 operations

The policy failed to account for global-service behavior and necessary exceptions.

Test Region restrictions comprehensively before broad attachment.

---

# 30. Changed-requirement variants

## Variant 1: Northstar already has a mature custom landing zone

Retain Organizations and compare Control Tower adoption against:

- custom automation;
- existing SCPs;
- existing account vending;
- current CloudTrail and Config;
- migration effort;
- drift ownership.

Control Tower is not automatically superior to a well-operated existing platform.

---

## Variant 2: Subsidiary must retain separate legal billing

A separate organization may be justified when:

- invoices must remain legally separate;
- management-account control cannot be shared;
- contracts prohibit common governance;
- commitment sharing must not cross the boundary.

The cost is loss of one common:

- OU hierarchy;
- SCP policy tree;
- Identity Center organization instance;
- consolidated discount family;
- organization trail.

Cross-organization governance then requires explicit federation and integration.

---

## Variant 3: Research needs unrestricted experimentation

Do not weaken the Production OU.

Create a separate Sandbox or Research OU with:

- broader service access;
- no production connectivity;
- synthetic data;
- strict budgets;
- short-lived accounts;
- automatic cleanup.

---

## Variant 4: Resource policies must never expose data outside the organization

Use an RCP for supported resources, combined with ordinary identity and resource policies.

```text
RCP
    → maximum resource exposure

Bucket policy
    → actual allowed principals
```

The RCP does not replace the bucket policy.

---

## Variant 5: New account volume becomes very high

Adopt a stronger account-vending platform:

- Account Factory for Terraform;
- Account Factory Customization;
- workflow-based approvals;
- automated account tags;
- automated Identity Center assignments;
- network-profile selection;
- account lifecycle database.

Control Tower remains the landing-zone governance layer.

---

## Variant 6: Log retention must be tamper-resistant for seven years

Add:

- dedicated KMS keys;
- S3 Object Lock in compliance mode where required;
- retention policies;
- narrowly separated key administration;
- legal-hold workflow;
- tested retrieval.

A lifecycle rule alone is not an immutability control.

---

## Variant 7: Security tooling must inspect private workload traffic

This becomes a network-design problem.

Use an appropriate combination of:

- Network Firewall;
- Gateway Load Balancer;
- centralized inspection VPC;
- Transit Gateway routing;
- VPC Flow Logs.

Organizations and Control Tower can govern the configuration, but they do not provide the packet path.

---

## Variant 8: Every account needs the same infrastructure baseline

Use CloudFormation StackSets with Organizations integration to deploy:

- IAM roles;
- Config resources;
- EventBridge rules;
- VPC Flow Logs;
- security tooling;
- standard buckets.

That becomes a major part of Lesson 6.

---

## Variant 9: Business-unit leaders need only their own cost data

Use account-scoped access, Cost Categories, and custom billing views rather than giving them access to the management account’s complete billing data. AWS supports custom billing views filtered by accounts or cost-allocation dimensions. 

---

## Variant 10: Temporary exception is required

Do not move the account permanently into a weak OU merely to bypass one restriction.

Prefer:

- narrowly scoped exception policy;
- approved exemption principal;
- expiration date;
- ticket reference;
- automatic removal;
- CloudTrail monitoring.

An exception without an expiry becomes ordinary policy.

---

# 31. SAP-C02 decision snippets

## Organizations versus Control Tower

**Requirement:** Centrally group accounts, apply policies, and consolidate billing.

```text
AWS Organizations
```

**Requirement:** Establish and govern a standardized multi-account landing zone with account vending and prepackaged controls.

```text
AWS Control Tower
```

---

## Account versus OU

**Need an isolation, ownership, quota, and billing boundary:**

```text
AWS account
```

**Need to apply common organizational policies to several accounts:**

```text
OU
```

---

## SCP versus IAM policy

**Grant a developer permission to launch EC2:**

```text
IAM policy / permission set
```

**Prevent all principals in an OU from using an unapproved service:**

```text
SCP
```

---

## Preventive versus detective versus proactive

**Block an API operation:**

```text
preventive control
```

**Find a resource already in a bad configuration:**

```text
detective control
```

**Reject a bad CloudFormation resource before creation:**

```text
proactive control
```

---

## IAM Identity Center permission set

```text
Permission set
    → reusable permission blueprint

Assignment
    → user/group + account + permission set

Generated account role
    → actual temporary workforce identity
```

---

## Created versus invited account

```text
Created in Organizations
    → OrganizationAccountAccessRole created automatically

Invited existing account
    → create equivalent role manually when required
```

---

## CloudTrail versus Config

```text
Who changed it?
    → CloudTrail

What configuration did it have?
    → Config
```

---

## Organization trail

**Requirement:** Central activity history that member-account administrators cannot disable.

```text
CloudTrail organization trail
```

---

## Config aggregator

**Requirement:** Central read-only view of resource configuration and compliance across accounts and Regions.

```text
AWS Config organization aggregator
```

**Important:** It does not enable recording or provide mutation access.

---

## Log Archive versus Audit account

```text
Preserve evidence
    → Log Archive

Analyze and administer security
    → Security/Audit
```

---

## Tag policy versus cost allocation tag

```text
Standardize spelling and values
    → tag policy

Make tag available in billing reports
    → activate cost allocation tag
```

---

## Cost Explorer versus Budgets versus CUR

```text
Interactive cost analysis
    → Cost Explorer

Threshold notification
    → AWS Budgets

Detailed custom billing dataset
    → CUR / CUR 2.0
```

---

## Consolidated billing

```text
One billing family
+
eligible combined discounts
+
account-level breakdown
```

It does not merge IAM, resources, quotas, or networks.

---

## Cross-account IAM versus networking

```text
Assume role in another account
    → authorization

Reach a private IP in another VPC
    → network connectivity
```

Often both are required.

---

# 32. Retrieval practice

## 1

What are the three primary questions a landing zone separates?

## 2

Why is an AWS account a stronger isolation boundary than a VPC alone?

## 3

What does an OU contain?

## 4

Do resources such as EC2 instances belong to an OU?

## 5

Why should OUs normally reflect common controls rather than only the reporting hierarchy?

## 6

Why does Northstar separate Production and Nonproduction high in the hierarchy?

## 7

What is the purpose of the Policy-Staging OU?

## 8

Why is the management account kept free of ordinary workloads?

## 9

What is the relationship between AWS Organizations and Control Tower?

## 10

What does Account Factory provide?

## 11

Does creating an OU in Organizations automatically govern it through Control Tower?

## 12

What are the three Control Tower control behaviors?

## 13

Which mechanism normally implements detective controls?

## 14

Which mechanism implements proactive controls?

## 15

What does an SCP grant?

## 16

Can AdministratorAccess override an SCP deny?

## 17

Does an SCP affect the management account?

## 18

Does an SCP affect a delegated administrator member account?

## 19

What is the difference between deny-list and allow-list SCP strategies?

## 20

Can a child OU re-enable an action denied by its parent?

## 21

What does an RCP control at a high level?

## 22

What is the difference between a tag policy and an SCP?

## 23

What is a permission set?

## 24

When does IAM Identity Center create the corresponding role in an AWS account?

## 25

What is the difference between SCIM and SAML in this architecture?

## 26

Why are Identity Center assignments normally made to groups?

## 27

What role is automatically created in an account created through Organizations?

## 28

Is that role automatically created in an invited existing account?

## 29

Why use delegated administration?

## 30

Does a delegated administrator become the management account?

## 31

What does an organization CloudTrail trail provide?

## 32

Can a member account administrator modify the organization trail?

## 33

Are S3 object-level events logged by default?

## 34

What is the difference between the Log Archive and Security/Audit accounts?

## 35

What does an AWS Config aggregator collect?

## 36

Does creating an aggregator enable Config recording in source accounts?

## 37

Can the aggregator modify a noncompliant member resource?

## 38

What is the difference between CloudTrail and Config?

## 39

Does membership in one organization provide private VPC connectivity?

## 40

Why can an employee describe EC2 resources without VPC peering?

## 41

Why might the same employee be unable to connect to the instance’s private IP?

## 42

What does consolidated billing combine?

## 43

Does consolidated billing merge member accounts?

## 44

What is commitment discount sharing?

## 45

Why might Northstar deny RI-purchase APIs in member accounts?

## 46

Why is applying a resource tag insufficient for cost reports?

## 47

What does a tag policy fail to do automatically?

## 48

What are Cost Categories for?

## 49

What is the difference between showback and chargeback?

## 50

What is the largest organizational risk in this design?

---

# 33. Answer key

## 1

Where the workload lives, what maximum authority is permitted, and who may operate it. Networking remains a separate reachability question.

## 2

An account separates resource ownership, administrators, root authority, quotas, billing, and many service-level boundaries. A VPC principally separates networking.

## 3

Accounts and nested OUs.

## 4

No. Resources belong to AWS accounts.

## 5

Security and infrastructure control requirements are generally more stable than management reporting lines.

## 6

Production and nonproduction require substantially different preventive controls, change policies, and risk tolerance.

## 7

To test SCPs and other controls on representative accounts before expanding their blast radius.

## 8

SCPs do not restrict management-account users or roles, and the account has exceptional organization and billing authority.

## 9

Organizations provides the multi-account primitives. Control Tower builds a standardized landing-zone governance framework on top of them.

## 10

Standardized account creation, configuration, enrollment, and baseline application.

## 11

No. The OU must be registered or otherwise brought under Control Tower governance, and accounts must be enrolled.

## 12

Preventive, detective, and proactive.

## 13

AWS Config rules.

## 14

CloudFormation hooks.

## 15

Nothing. It defines the maximum permissions available to member-account principals.

## 16

No.

## 17

No.

## 18

Yes. A delegated administrator remains a member account.

## 19

A deny-list begins broadly available and adds explicit denies. An allow-list permits only explicitly approved actions and requires the action to remain allowed throughout the hierarchy.

## 20

No.

## 21

The maximum permissions that resources in affected accounts can expose through resource-based authorization.

## 22

An SCP limits principal authority. A tag policy standardizes how tags are used and can enforce supported tagging operations.

## 23

A reusable definition of account permissions that IAM Identity Center can provision into target accounts.

## 24

When the permission set is assigned to a user or group for that account.

## 25

SCIM provisions users and groups. SAML handles federated authentication.

## 26

Group assignments follow job responsibilities and are easier to review, provision, and remove than many individual assignments.

## 27

`OrganizationAccountAccessRole`.

## 28

No.

## 29

To reduce use of the highly privileged management account and let specialized accounts administer supported organization-wide services.

## 30

No. Delegation is service-specific.

## 31

Central ongoing activity logging across organization accounts, including newly added accounts.

## 32

No.

## 33

No. Data events must be selected explicitly.

## 34

The Log Archive account preserves evidence. The Security/Audit account analyzes evidence and administers security capabilities.

## 35

Configuration and compliance data from enabled source accounts and Regions.

## 36

No.

## 37

No. The aggregator is read-only.

## 38

CloudTrail records actions and actors. Config records resource configuration and compliance history.

## 39

No.

## 40

`DescribeInstances` is an AWS control-plane API call made with temporary AWS credentials through an AWS endpoint.

## 41

Private-IP access requires network routing, security-group permission, and a listening service.

## 42

Billing visibility, eligible usage aggregation, and eligible discounts.

## 43

No. IAM, resources, quotas, and networking remain separate.

## 44

Eligible RI and Savings Plans discounts purchased in one account may benefit qualifying usage in other accounts according to sharing configuration.

## 45

To ensure that only central FinOps procurement creates long-term commitments.

## 46

The tag key must also be activated for cost allocation.

## 47

It does not automatically attach tags to every resource or guarantee that untagged resources are rejected.

## 48

To map raw accounts, tags, services, and charges into business-defined financial groupings.

## 49

Showback reports responsibility without internal transfer. Chargeback formally allocates the cost to an internal budget or ledger.

## 50

Compromise or misuse of the management account, followed closely by a faulty organization-wide policy with a large blast radius.

---

# 34. What to memorize now

```text
AWS account
    → ownership, permissions, quotas, cost, blast radius

OU
    → policy grouping

Organization root
    → top of hierarchy
```

```text
Organizations
    → accounts
    → OUs
    → policies
    → delegated administration
    → consolidated billing
```

```text
Control Tower
    → landing zone
    → Log Archive account
    → Audit account
    → controls
    → Account Factory
    → governance dashboard
```

```text
Preventive
    → block action

Detective
    → identify bad state

Proactive
    → reject bad CloudFormation resource
```

```text
IAM policy
    → grants authority

SCP
    → limits principal authority

RCP
    → limits resource-policy exposure
```

```text
SCP allow
    ≠
permission grant
```

```text
Management account
    → not restricted by SCPs
    → no ordinary workloads
    → minimal access
```

```text
Permission set
    → reusable account-role definition

Assignment
    → group/user + account + permission set

IAM Identity Center role
    → temporary workforce identity
```

```text
SCIM
    → provision users and groups

SAML
    → authenticate employee
```

```text
Created account
    → OrganizationAccountAccessRole automatically

Invited account
    → create equivalent role manually
```

```text
CloudTrail
    → who did what

Config
    → what configuration existed
```

```text
Organization trail
    → all member accounts
    → members cannot modify it

Config aggregator
    → multi-account read-only view
    → does not enable Config
```

```text
Log Archive
    → preserve evidence

Security/Audit
    → analyze and administer
```

```text
Same organization
    ≠
same network
```

```text
Consolidated billing
    → one billing family
    → eligible aggregated discounts
    → accounts remain separate
```

```text
Tag policy
    → tag consistency

Cost allocation activation
    → billing visibility

Cost Category
    → business mapping
```

```text
Cost Explorer
    → interactive analysis

Budgets
    → threshold alerts

CUR
    → detailed cost dataset
```

---

# 35. What can remain recognition-level

You do not yet need perfect recollection of:

- every Control Tower mandatory control;
- landing-zone version details;
- every Organizations policy type;
- SCP JSON edge cases;
- policy-size limits;
- exact Identity Center-generated role names;
- every SCIM attribute mapping;
- Control Tower account-enrollment prerequisites;
- Config recorder resource exclusions;
- CloudTrail advanced event selector syntax;
- CloudTrail Lake SQL;
- Account Factory for Terraform repository structure;
- Cost Category rule syntax;
- CUR column names;
- Billing Conductor configuration;
- resource-control-policy service coverage;
- centralized root-access mechanics.

The durable architecture is:

```text
Corporate identity
    ↓
IAM Identity Center
    ↓
temporary role in one member account
    ↓
IAM permission
    ∩
organization policy ceiling
```

around an account hierarchy governed through:

```text
Organizations
    ↓
Control Tower
    ↓
OUs and controls
    ↓
central logs and configuration evidence
    ↓
consolidated cost visibility
```

At every step, continue applying Lesson 0:

```text
Authorization:
    Which principal performs the operation?
    Which policy grants it?
    Which organizational policy limits it?

Networking:
    Is this an AWS control-plane API call,
    a managed service-to-service delivery,
    or traffic to a private endpoint?
    What actual path exists?
```