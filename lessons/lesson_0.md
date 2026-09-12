# Lesson 0 — Identity and Reachability

## Why these foundations come first

Nearly every AWS architecture question contains two independent problems:

1. **Authorization:** Is this actor allowed to perform the operation?
2. **Reachability:** Can traffic travel from the source to the destination?

A complete interaction also requires the destination service or application to accept the request:

\[
\text{Success}
=

\text{authentication}
\land
\text{authorization}
\land
\text{network reachability}
\land
\text{service acceptance}
\]

Consider an application reading an S3 object:

- It needs valid AWS credentials.
- Its effective permissions must allow `s3:GetObject`.
- It needs a network path to an S3 endpoint.
- The bucket and object must exist and accept the request.

The uploaded SAP-C02 guide assumes considerable Associate-level knowledge and describes itself as a supplementary resource. This lesson supplies the IAM and networking model that the later scenario-based projects will reuse.  

The AWS-specific material below follows the uploaded guide and current AWS documentation. The OSI, TCP/IP, and subnetting sections add general networking background that the guide largely assumes.

---

## Learning objectives

After this lesson, you should be able to:

- describe an authorization request as **principal–action–resource–context**;
- distinguish IAM users, groups, roles, policies, and role sessions;
- explain how trust policies and permission policies interact;
- apply the basic IAM evaluation rules;
- distinguish policies that **grant** permissions from policies that only **limit** them;
- explain IP addresses, CIDR blocks, ports, protocols, DNS, and routing;
- distinguish a VPC from a subnet and a route from a firewall rule;
- compare security groups with network ACLs;
- trace packets through an Internet Gateway, NAT Gateway, or VPC endpoint;
- classify a failure as authentication, authorization, networking, or application-level.

---

# 0.1 The shared AWS model

## 0.1.1 AWS accounts

An **AWS account** is a major ownership and isolation boundary. Resources, identities, permissions, service quotas, billing records, and much of the audit history belong to an account.

A company can place everything in one account, but larger organizations usually separate production, development, security, logging, and business units into different accounts. The uploaded guide’s landing-zone example uses separate development, production, logging, security, and administration accounts.

**Mental model:** An account is closer to an administrative and security boundary than to a username.

An IAM user is **inside** an account. It is not itself an AWS account.

---

## 0.1.2 Regions and Availability Zones

An **AWS Region** is a separate geographic area. A Region contains multiple **Availability Zones**, which are isolated infrastructure locations within that Region.

A VPC is Regional: it can span the Availability Zones of one Region. A subnet is zonal: each subnet belongs to exactly one Availability Zone. Placing redundant resources in multiple subnets is useful only when those subnets are in different Availability Zones.

```text
AWS
└── Account
    ├── Region: us-east-1
    │   ├── VPC: 10.0.0.0/16
    │   │   ├── Subnet A in AZ 1
    │   │   └── Subnet B in AZ 2
    │   └── Other Regional resources
    └── Region: eu-west-1
        └── Separate Regional resources
```

**Exam hinge:** Different Availability Zones protect against a localized failure. Different Regions address larger failures, geography, latency, residency, or business-continuity requirements.

---

## 0.1.3 Resources and ARNs

An AWS **resource** is an object managed by AWS: an EC2 instance, S3 bucket, IAM role, Lambda function, database, queue, and so forth.

An **Amazon Resource Name**, or ARN, identifies a resource:

```text
arn:partition:service:region:account-id:resource
```

Example:

```text
arn:aws:iam::123456789012:role/ProductionReader
```

An ARN is an **identifier**, not a network address. It tells IAM which resource a policy refers to. It does not tell a packet where to travel.

That distinction will recur:

```text
ARN       → authorization identity
IP / DNS  → network destination
```

---

## 0.1.4 Console, CLI, SDK, and API

The AWS Management Console is mostly a graphical client for AWS APIs. The CLI and SDKs call the same service APIs programmatically.

For example, these may all cause an `ec2:RunInstances` request:

- clicking **Launch instance** in the console;
- running `aws ec2 run-instances`;
- calling `RunInstances` through Boto3.

IAM authorizes the **API action**, not the interface used to invoke it. A policy allowing `ec2:RunInstances` can therefore affect console, CLI, and SDK use.

---

## 0.1.5 Control plane and data plane

The distinction is approximate but useful.

### Control plane

Operations that create, configure, inspect, or delete infrastructure:

```text
CreateBucket
RunInstances
CreateDBInstance
UpdateFunctionConfiguration
```

These usually target AWS service APIs.

### Data plane

Operations that use the resulting system:

```text
Download an S3 object
Send a message to SQS
Execute SQL against a database
Send an HTTP request to an application
```

Both planes can involve IAM. Networking is especially visible in the data plane.

Example:

```text
Creating an RDS database       → control plane
Connecting to PostgreSQL:5432  → data plane
```

Permission to create a database does not automatically grant permission to log in to it.

---

## 0.1.6 Not every AWS resource is “inside the VPC”

A VPC is a logically isolated virtual network in which supported resources can receive IP addresses and network interfaces. It is not a box containing every service in the account.

For example:

- An EC2 instance normally has a network interface in a subnet.
- An RDS database is reachable through addresses associated with selected subnets.
- An S3 bucket is not placed in one of your subnets.
- A VPC workload reaches S3 through an AWS service endpoint, optionally using a VPC endpoint.

This prevents a common misconception:

> “Private S3 bucket” is an authorization statement, not a statement that the bucket lives in a private subnet.

---

# 0.2 IAM foundations

## 0.2.1 The IAM sentence

Every authorization problem can initially be expressed as:

> A **principal** attempts an **action** on a **resource** under a particular **context**.

```text
Principal: arn:aws:sts::123456789012:assumed-role/AppRole/session-42
Action:    s3:GetObject
Resource:  arn:aws:s3:::northstar-reports/2026/report.csv
Context:   time, source network, tags, organization, MFA, requested Region...
```

IAM answers whether this request should be allowed.

AWS describes IAM as the system controlling both who is authenticated and what an authenticated identity is authorized to do.

---

## 0.2.2 Authentication versus authorization

### Authentication

> Who are you?

Authentication establishes an identity using something such as:

- a password and MFA;
- an access key;
- an external identity-provider token;
- an existing AWS identity assuming a role;
- workload identity supplied by an AWS service.

### Authorization

> What may this authenticated principal do?

Authorization evaluates policies against:

- the requested action;
- the requested resource;
- the principal;
- request conditions.

A user can authenticate successfully and still receive `AccessDenied`.

---

## 0.2.3 Principal, identity, and credentials

These terms are related but not interchangeable.

### Identity

An IAM object to which permissions can be assigned:

- IAM user;
- IAM group;
- IAM role.

### Principal

An authenticated actor making a request:

- account root user;
- IAM user;
- assumed-role session;
- federated principal;
- AWS service principal.

### Credentials

Evidence used to authenticate the principal:

- password;
- access key and secret key;
- temporary access key, secret key, and session token;
- federated token.

An IAM group can carry policies, but it cannot authenticate or make a request. Therefore, a group is not usable as a `Principal` in a resource policy.

---

## 0.2.4 Root user, IAM user, group, role, and session

| Object | Meaning | Credentials | Typical role |
| --- | --- | --- | --- |
| **Account root user** | Identity created with the AWS account | Long-lived account credentials | Exceptional account-level operations |
| **IAM user** | Persistent identity inside one account | Password and/or access keys | Legacy or exceptional long-lived identity |
| **IAM group** | Collection of IAM users | None | Assign the same policies to multiple users |
| **IAM role** | Assumable identity with a permission set | No ordinary permanent credentials | Humans, workloads, services, and cross-account access |
| **Role session** | Temporary instantiation of a role | Temporary STS credentials | The actual principal making requests after role assumption |

AWS currently recommends temporary credentials through roles for both humans and workloads where practical. IAM users remain available for cases that cannot use roles.

### Memory rule

```text
User    = persistent identity
Group   = policy-assignment convenience
Role    = assumable identity
Session = temporary use of a role
```

---

## 0.2.5 IAM users

An IAM user is a persistent identity in one AWS account. It can have:

- a console password;
- access keys;
- identity-based policies;
- group memberships;
- MFA devices.

The user’s permissions are the combination of policies attached directly to the user and policies inherited from its groups, subject to any applicable limits and denies.

**Do not associate “user” exclusively with a person.** An IAM user can technically represent software, although workload roles and temporary credentials are generally preferable.

---

## 0.2.6 IAM groups

An IAM group is a collection of IAM users used to assign permissions efficiently.

```text
Developers group
├── Alice
├── Bob
└── Carol
```

Attaching a policy to `Developers` gives its permissions to all three users.

Important properties:

- a user can belong to multiple groups;
- groups contain users, not roles or other groups;
- a group cannot be assumed;
- a group has no credentials;
- a group cannot be the principal making an API request.

---

## 0.2.7 IAM roles

An IAM role is an identity designed to be **assumed**. It has a permission set but is not permanently associated with one person or workload.

Common role users include:

- an EC2 application;
- a Lambda function;
- an AWS service such as CloudFormation;
- an engineer performing production support;
- a user in another account;
- a federated employee.

When a principal assumes a role, AWS Security Token Service issues temporary credentials. Requests made with those credentials are made by the resulting **role session**. Temporary credentials are central to federation, delegation, workload identity, and cross-account access.

---

## 0.2.8 Policies

An IAM policy is usually a JSON document that contributes to an authorization decision.

A basic identity-based policy might be:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadReports",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::northstar-reports/reports/*"
    }
  ]
}
```

If attached to `AppReaderRole`, this statement allows sessions of that role to request objects under the specified prefix.

### Policy elements

| Element | Question answered |
| --- | --- |
| `Effect` | Does this statement allow or deny? |
| `Action` | Which API operation or operations? |
| `Resource` | Which resource ARN or ARNs? |
| `Principal` | Who is affected? Used primarily in resource-based and trust policies |
| `Condition` | Under which request circumstances? |
| `Sid` | Optional statement identifier |
| `Version` | Version of the policy language |

The `Version` field is not the revision number of your business policy.

AWS distinguishes identity-based policies attached to identities from resource-based policies attached directly to supported resources.

---

## 0.2.9 Identity-based policies

An **identity-based policy** is attached to:

- a user;
- a group;
- a role.

It answers:

> What may this identity do?

The principal is implied by where the policy is attached, so an identity-based policy normally does not contain a `Principal` element.

Example:

```text
Attached to: ProductionReader role

Allow:
    s3:GetObject

On:
    arn:aws:s3:::northstar-reports/reports/*
```

---

## 0.2.10 Resource-based policies

A **resource-based policy** is attached to a supported resource.

It answers:

> Who may do what to this resource?

Examples include policies attached to:

- S3 buckets;
- SQS queues;
- SNS topics;
- KMS keys;
- supported VPC endpoints;
- IAM roles, where the resource policy is called a trust policy.

A bucket policy could allow a role in another account to read one prefix:

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::222222222222:role/PartnerReader"
  },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::northstar-reports/shared/*"
}
```

The uploaded material uses an S3 bucket policy as an example of granting cross-account access directly to a resource.

---

## 0.2.11 Trust policies

Every role has a **trust policy**. It is a resource-based policy attached to the role itself.

It answers:

> Who or what may assume this role?

For example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::222222222222:role/EngineerBase"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

This does **not** say what `EngineerBase` may do after assuming the role. It only allows that principal to request the role.

### Central distinction

```text
Trust policy:
    Who may become the role?

Permission policies:
    What may the resulting role session do?
```

AWS and the uploaded guide both describe cross-account roles in terms of this two-sided trust and permissions relationship.  

---

## 0.2.12 Assuming a role

A normal cross-account flow is:

```text
1. Caller authenticates in Account B.

2. Caller is permitted to call:
       sts:AssumeRole
   on a role in Account A.

3. Role in Account A trusts the caller.

4. STS creates a temporary role session.

5. The session uses the role's permissions in Account A.
```

Visually:

```text
Account B                                       Account A

EngineerBase role
    │
    │ identity policy allows sts:AssumeRole
    ├──────────────────────────────────────────► ProductionReader role
                                                 │
                                                 │ trust policy accepts caller
                                                 ▼
                                            STS role session
                                                 │
                                                 │ role permission policies
                                                 ▼
                                            Production resources
```

For foundational reasoning, treat cross-account authorization as requiring consent on both sides:

- the caller side permits the assumption or request;
- the target side trusts or permits the caller.

Some resource-policy cases have finer details, which can be learned later.

---

## 0.2.13 Temporary credentials and role sessions

STS temporary credentials contain:

- an access key ID;
- a secret access key;
- a session token;
- an expiration time.

They expire automatically. The temporary principal normally appears in ARNs such as:

```text
arn:aws:sts::123456789012:assumed-role/ProductionReader/session-name
```

A session is not simply the original user plus additional permissions. When a user switches to a role, the role’s permissions become the active permission set rather than accumulating with the original user’s permissions.

---

## 0.2.14 Service roles

A **service role** is a role that an AWS service assumes to perform work on your behalf.

Examples:

- CloudFormation creates resources in a stack.
- Lambda code reads from an S3 bucket.
- CodeBuild writes build artifacts.
- EC2 applications call AWS APIs.

A role used by a service still has the same two sides:

```text
Trust policy:
    The AWS service may assume this role.

Permission policy:
    The service's resulting session may perform these actions.
```

The uploaded material repeatedly uses service roles for CloudFormation, Systems Manager, ECS, and migration workflows.

---

## 0.2.15 `iam:PassRole`

`iam:PassRole` is frequently confused with `sts:AssumeRole`.

Suppose Alice creates a Lambda function and selects `PowerfulLambdaRole`.

Alice is telling Lambda:

> Use this role when the function executes.

To do that, Alice needs permission to **pass** the role to Lambda. Lambda—not Alice—later assumes it.

```text
Alice
  │
  │ iam:PassRole
  ▼
Lambda configuration references PowerfulLambdaRole
  │
  │ Lambda assumes the role during execution
  ▼
Function receives temporary permissions
```

### Memory rule

```text
AssumeRole = I become the role.

PassRole   = I authorize a service to use the role.
```

A dangerous `PassRole` permission can become a privilege-escalation path when a user can pass a role more powerful than their own identity. AWS therefore recommends restricting which role ARNs may be passed and to which services.

---

## 0.2.16 Federation and IAM Identity Center

With **federation**, identities remain in an external identity system such as:

- Microsoft Active Directory;
- Microsoft Entra ID;
- Okta;
- another SAML or OIDC identity provider.

A typical flow is:

```text
Employee
   │
   ▼
Corporate identity provider authenticates employee
   │
   ▼
Identity assertion or token
   │
   ▼
AWS trusts the identity provider
   │
   ▼
STS issues temporary role credentials
```

IAM Identity Center centralizes workforce access across AWS accounts and maps users or groups to permission sets that result in roles in the target accounts.

The important conceptual point is:

> Federation avoids creating a separate permanent IAM user and long-term access key for every employee in every account.

The uploaded material presents IAM Identity Center and SAML/OIDC federation as central approaches to multi-account workforce access.

---

## 0.2.17 Basic policy evaluation

The introductory model is:

1. A request begins **implicitly denied**.
2. An applicable permission policy must allow it.
3. An applicable **explicit deny** overrides allows.
4. Permission ceilings can narrow an otherwise valid allow.
5. A ceiling does not grant a permission by itself.

A useful approximation is:

\[
\text{effective permissions}
\approx
\left(
\text{identity grants}
\cup
\text{resource grants}
\right)
\cap
\text{boundary}
\cap
\text{SCP}
\cap
\text{session policy}
-

\text{explicit denies}
\]

Only include the intersections that actually apply to the request.

This is deliberately not the complete IAM algorithm. Resource policies, role-session principals, cross-account requests, and some service-specific policies introduce edge cases. It is nevertheless the correct initial model. AWS documents the union of applicable grants, the limiting effect of boundaries and SCPs, and the precedence of explicit deny.

---

## 0.2.18 Policies that grant versus policies that limit

| Policy type | Can contribute a grant? | Primary purpose |
| --- | ---: | --- |
| Identity-based policy | Yes | Grant actions to a user, group, or role |
| Resource-based policy | Yes | Grant access to a resource |
| Role trust policy | Yes, for role assumption | Specify who may assume the role |
| Permissions boundary | No | Limit the maximum permissions of a user or role |
| Service control policy | No | Limit permissions available in affected organization accounts |
| Session policy | No beyond the base role/user | Further limit a temporary session |

### Permissions boundary

A boundary defines the maximum permissions an IAM user or role can receive from its identity policies.

```text
Identity policy allows S3 and EC2
Boundary allows only S3
Effective identity permission: S3
```

### SCP

An SCP defines the maximum available permissions in affected AWS Organizations accounts. It does not independently authorize an action.

```text
SCP allows EC2
IAM policy allows nothing
Result: EC2 is still denied
```

The uploaded guide repeatedly emphasizes that an SCP is a guardrail, not a permission grant.

---

## 0.2.19 Explicit deny

An applicable explicit deny wins even when multiple policies allow the operation.

```text
Identity policy: Allow s3:GetObject
Bucket policy:   Allow s3:GetObject
SCP:             Deny s3:GetObject

Result: Denied
```

This is why an exam option that says “add another allow” may be irrelevant. An explicit deny must be removed or made inapplicable.

---

## 0.2.20 Conditions and tags

Conditions make a statement apply only when request context matches.

Examples of conceptual conditions:

- require MFA;
- allow only from a particular organization;
- limit access to a Region;
- require transport encryption;
- compare principal and resource tags;
- limit which service receives a passed role.

Tags can support attribute-based access control:

```text
Principal tag:
    project = atlas

Resource tag:
    project = atlas

Policy:
    Allow access when the tags match
```

This can scale better than maintaining one policy per project, but the tagging process itself must be governed.

---

## 0.2.21 IAM trace: application reading S3

Suppose an EC2 application needs to read:

```text
s3://northstar-reports/reports/daily.csv
```

The complete authorization sequence is:

```text
1. EC2 is allowed to use AppReaderRole.

2. The application receives temporary role credentials.

3. The SDK signs an s3:GetObject request.

4. AWS identifies the role session as the principal.

5. IAM evaluates:
       - AppReaderRole identity policies
       - relevant bucket policy
       - permissions boundary, if any
       - SCP, if applicable
       - explicit denies

6. S3 allows or denies the request.
```

The network path to S3 is a separate concern. A perfect IAM policy does not create network connectivity.

---

## 0.2.22 Common IAM misconceptions

| Misconception | Correction |
| --- | --- |
| “The user authenticated, so access should work.” | Authentication does not imply authorization. |
| “The SCP allows the service, so the user may use it.” | An SCP is a ceiling, not a grant. |
| “The role trusts me, so I can assume it.” | The caller also normally needs permission to invoke `sts:AssumeRole`. |
| “The trust policy gives the role access to S3.” | Trust controls role assumption; permission policies control later actions. |
| “An IAM group can be a principal.” | A group cannot authenticate or make requests. |
| “PassRole means I temporarily become the role.” | PassRole lets a service use the role. |
| “Security groups can grant S3 permission.” | Security groups filter traffic; IAM authorizes AWS actions. |
| “A role is just a policy.” | A role is an identity; policies define its permissions and trust. |

---

# 0.3 Networking foundations

## 0.3.1 The network sentence

A network interaction can initially be expressed as:

> A source sends traffic to a destination using a protocol and, where relevant, a port.

```text
Source:
    10.0.10.25:49152

Destination:
    10.0.20.80:5432

Protocol:
    TCP
```

Here:

- `10.0.10.25` is the source IP;
- `49152` is the client’s temporary source port;
- `10.0.20.80` is the server IP;
- `5432` is the destination port, commonly used by PostgreSQL;
- TCP is the transport protocol.

---

## 0.3.2 Packets, flows, and connections

A **packet** is one unit of network transmission.

A **flow** is a sequence of related packets, commonly identified by:

```text
source IP
source port
destination IP
destination port
protocol
```

A TCP **connection** is a stateful transport relationship between endpoints. UDP provides a lighter datagram mechanism without TCP’s connection and reliability machinery.

AWS networking components may inspect individual packets, flows, or application requests depending on where they operate.

---

## 0.3.3 A practical OSI model

The OSI model is a conceptual decomposition, not a perfect mapping of every modern protocol or AWS service.

| Layer | Main concern | Examples relevant to AWS |
| ---: | --- | --- |
| **7 — Application** | Meaning of application requests | HTTP, DNS, gRPC, ALB, WAF, API Gateway |
| **6 — Presentation** | Representation and encryption concepts | Serialization, encryption; TLS is often discussed around this area |
| **5 — Session** | Conversation and session management | Rarely tested independently |
| **4 — Transport** | Connections, ports, ordering | TCP, UDP, NLB |
| **3 — Network** | Addressing and routing | IP, CIDR, route tables, Transit Gateway |
| **2 — Data link** | Local-link frames and addresses | Ethernet, MAC addresses; largely abstracted by AWS |
| **1 — Physical** | Physical transmission | Fiber, routers, Direct Connect facilities |

For SAP-C02, most day-to-day reasoning happens at:

```text
Layer 7: What application request is this?
Layer 4: Which protocol and port?
Layer 3: Which IP destination and route?
```

An AWS product can span more than one layer. The table is a reasoning aid, not a strict product taxonomy.

---

## 0.3.4 Layer 7 versus Layer 4

Suppose two HTTP requests arrive:

```text
GET /images/cat.jpg
GET /api/orders
```

A Layer 7 component understands HTTP and can route them differently based on paths, hostnames, headers, or methods.

A Layer 4 component primarily sees connections such as:

```text
TCP destination port 443
```

It does not normally make routing decisions based on `/api/orders`.

This distinction explains much of the difference between Application Load Balancers and Network Load Balancers. The uploaded comparison chapter associates ALB with HTTP, HTTPS, gRPC, and application-aware routing, while NLB operates with TCP, UDP, and TLS traffic.

---

## 0.3.5 TCP, UDP, and ports

### TCP

TCP provides a connection-oriented transport with sequencing and reliability mechanisms.

Typical examples:

- HTTPS;
- SSH;
- PostgreSQL;
- MySQL.

### UDP

UDP sends datagrams with less protocol machinery and without TCP’s delivery guarantees.

Typical examples:

- many DNS requests;
- real-time traffic;
- certain streaming or telemetry protocols.

### Ports

A port identifies an application endpoint on a host.

Common associations:

| Port | Typical protocol |
| ---: | --- |
| 22 | SSH |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |

Ports are conventions, not immutable laws. An application can listen on a different port.

---

## 0.3.6 Client ports and return traffic

When a client connects to a server, the server uses a known destination port while the client usually selects an ephemeral source port:

```text
Client:
    10.0.10.25:49152

Server:
    10.0.20.80:5432
```

The response returns to:

```text
10.0.10.25:49152
```

This matters for stateless network ACLs: both the initial direction and the response direction must be permitted.

A stateful security group remembers the allowed flow and automatically recognizes the response.

---

## 0.3.7 IP addresses

An IP address identifies a network interface for routing purposes.

### Private IPv4 ranges

RFC 1918 reserves three ranges for private networks:

```text
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
```

The same private addresses can exist in independently managed networks because they are not globally unique. This creates problems when two networks with overlapping addresses later need direct connectivity.

### Public IPv4 address

A public address is globally routable through the Internet, subject to routing and filtering.

### Important distinction

```text
Private IP ≠ encrypted
Public IP  ≠ automatically reachable
```

Privacy, encryption, routing, and authorization are separate properties.

---

## 0.3.8 IPv4 versus IPv6

IPv4 addresses contain 32 bits. IPv6 addresses contain 128 bits.

For this lesson, retain three architectural consequences:

1. IPv4 private networks frequently use NAT for Internet egress.
2. IPv6 addresses are generally globally unique, so NAT is not the normal egress mechanism.
3. IPv4 and IPv6 routes and security rules are configured separately.

AWS provides an egress-only Internet Gateway for outbound-initiated IPv6 connectivity without accepting unsolicited inbound connections.

The deeper IPv6 addressing and transition mechanisms can wait until later projects.

---

## 0.3.9 CIDR notation

CIDR notation represents an address prefix:

```text
10.0.0.0/16
```

The `/16` means the first 16 bits identify the network prefix. The remaining bits identify addresses inside it.

For IPv4:

\[
\text{total addresses} = 2^{32-\text{prefix length}}
\]

| CIDR | Total IPv4 addresses | Typical interpretation |
| --- | ---: | --- |
| `/16` | 65,536 | Large VPC range |
| `/24` | 256 | Common small subnet |
| `/28` | 16 | Small subnet |
| `/32` | 1 | One exact address |

A subnet CIDR must be contained in its VPC CIDR and cannot overlap another subnet in the same VPC. AWS reserves some addresses inside every IPv4 subnet, so total addresses are not identical to usable workload addresses.  

---

## 0.3.10 Subnetting example

Suppose the VPC is:

```text
10.0.0.0/16
```

It might contain:

```text
10.0.0.0/24    Public subnet, AZ A
10.0.1.0/24    Public subnet, AZ B

10.0.10.0/24   Application subnet, AZ A
10.0.11.0/24   Application subnet, AZ B

10.0.20.0/24   Database subnet, AZ A
10.0.21.0/24   Database subnet, AZ B
```

Each `/24` belongs to the larger `/16`, but the subnet ranges do not overlap.

The repeated last digit pattern is only an administrative convention. AWS does not infer application purpose from the addresses.

---

## 0.3.11 VPCs and subnets

A **VPC** is a Regional virtual network with one or more IP address ranges.

A **subnet** is an IP range in that VPC and belongs to one Availability Zone. Resources with network interfaces are deployed into specific subnets.  

```text
VPC: 10.0.0.0/16
│
├── Subnet 10.0.0.0/24 in AZ A
├── Subnet 10.0.1.0/24 in AZ B
├── Subnet 10.0.10.0/24 in AZ A
└── Subnet 10.0.11.0/24 in AZ B
```

**Mental model:** The VPC defines the network universe. Subnets partition that universe by address and Availability Zone.

---

## 0.3.12 Elastic Network Interfaces

An **Elastic Network Interface**, or ENI, is a virtual network interface.

It can carry properties such as:

- private IP addresses;
- IPv6 addresses;
- a MAC address;
- associated security groups;
- an optional public-IP mapping;
- routing-related metadata.

An EC2 instance’s network identity is largely expressed through its ENI. Interface VPC endpoints also create ENIs in selected subnets.

**Memory rule:** Security groups attach to network interfaces, not conceptually to an entire subnet.

---

## 0.3.13 Route tables

A route table contains rules of the form:

```text
destination → target
```

Example:

```text
Destination       Target
10.0.0.0/16       local
10.20.0.0/16      pcx-0123456789
0.0.0.0/0         nat-0123456789
```

Interpretation:

- VPC-local addresses use the local route.
- `10.20.0.0/16` travels through a peering connection.
- all other IPv4 destinations use the NAT Gateway.

Every subnet is associated with a route table. A route selects **where traffic should go**. It does not itself authorize the traffic.

---

## 0.3.14 Longest-prefix match

When multiple routes match, AWS normally selects the most specific destination prefix.

Suppose the route table contains:

```text
10.0.0.0/8      → transit gateway
10.20.0.0/16    → peering connection
10.20.30.0/24   → network appliance
0.0.0.0/0       → NAT gateway
```

For destination `10.20.30.15`, all four prefixes except perhaps the default match, but `/24` is the most specific:

```text
10.20.30.0/24 → network appliance
```

For destination `10.20.80.9`, `/16` wins.

For `8.8.8.8`, only the default route matches.

AWS calls this **longest-prefix match**.

---

## 0.3.15 A route is not a firewall rule

A route answers:

> Which next target should receive this packet?

A security rule answers:

> Is this traffic permitted?

You generally need both:

```text
Correct route
    AND
Permissive security controls
```

A packet can have a perfect route and still be rejected by a security group. It can also be allowed by every security group but have no valid route.

---

## 0.3.16 Public, private, and isolated subnets

Subnet type is determined primarily by its routing.

### Public subnet

Has a direct route to an Internet Gateway:

```text
0.0.0.0/0 → Internet Gateway
```

For an IPv4 EC2 instance to communicate directly with the Internet, it also needs:

- a public or Elastic IPv4 address;
- compatible security-group rules;
- compatible network ACL rules.

A route to an Internet Gateway does not magically assign public addresses or open ports.

### Private subnet

Does not have a direct route to an Internet Gateway. It may still reach:

- the Internet through a NAT device;
- AWS services through VPC endpoints;
- another VPC;
- an on-premises network through VPN or Direct Connect.

### Isolated subnet

Has no route to destinations outside the VPC.

Current AWS documentation distinguishes these subnet types by their configured routing.

---

## 0.3.17 Internet Gateway

An **Internet Gateway**, or IGW, is attached to a VPC and serves as a route target for Internet traffic.

A typical public-subnet route is:

```text
0.0.0.0/0 → igw-...
```

A public application normally also needs:

- a publicly addressable entry point;
- inbound security permission;
- a process listening on the requested port;
- a return path.

The IGW is a connectivity component. It is not an application proxy, IAM policy, or web firewall.

---

## 0.3.18 NAT Gateway

A public NAT Gateway lets resources with private IPv4 addresses initiate connections to Internet destinations without making those resources directly addressable from the Internet.

Typical layout:

```text
Private application subnet
    0.0.0.0/0 → NAT Gateway

Public NAT subnet
    0.0.0.0/0 → Internet Gateway
```

Packet flow:

```text
Private instance: 10.0.10.25
        │
        ▼
NAT Gateway translates source to its Elastic IP
        │
        ▼
Internet Gateway
        │
        ▼
Internet destination
```

Return traffic is translated back to the private instance. An arbitrary Internet host cannot initiate a new connection through the NAT Gateway to that instance.

AWS uses NAT devices for IPv4 egress; IPv6 uses different mechanisms such as an egress-only Internet Gateway.

---

## 0.3.19 Security groups

A security group is a stateful network filter associated with network interfaces.

Properties:

- inbound and outbound rules are separate;
- rules allow traffic rather than explicitly deny it;
- all applicable rules are considered together;
- response traffic for an allowed flow is recognized automatically;
- rules can reference IP ranges and, in supported situations, other security groups.

Example:

```text
Application security group

Inbound:
    TCP 8080 from the ALB security group

Outbound:
    TCP 5432 to the database security group
    HTTPS 443 as required
```

AWS recommends security groups as the primary VPC workload-level access control.

---

## 0.3.20 Network ACLs

A network ACL, or NACL, is a stateless filter associated with a subnet.

Properties:

- inbound and outbound rules are separate;
- rules support both allow and deny;
- numbered rules are evaluated in order;
- return traffic is not remembered;
- every subnet is associated with one NACL;
- one NACL can be associated with multiple subnets.

Because NACLs are stateless, a rule permitting an inbound server request does not automatically permit the outbound response.

---

## 0.3.21 Security group versus NACL

| Property | Security group | Network ACL |
| --- | --- | --- |
| Attachment | Network interface/resource | Subnet |
| State | Stateful | Stateless |
| Rules | Allow | Allow and deny |
| Evaluation | Applicable rules combined | Ordered by rule number |
| Return traffic | Automatically recognized | Must be explicitly permitted |
| Normal role | Workload-level control | Coarse subnet guardrail |
| Can reference another SG | Yes, where supported | No |

The uploaded cheat sheet makes this comparison explicitly.

### Exam hinge

If a connection succeeds in one direction but response traffic is blocked because an ephemeral port was not opened, suspect a stateless NACL.

If the requirement says “deny this specific CIDR at the subnet boundary,” a NACL may be relevant because security groups do not have explicit deny rules.

---

## 0.3.22 DNS

DNS converts names into records that applications can use.

Example:

```text
orders.internal.example.com
            ↓
        10.0.20.80
```

DNS answers:

> Which address or target corresponds to this name?

It does **not** answer:

- whether a route exists;
- whether a security group permits traffic;
- whether the destination is listening;
- whether the caller is authorized.

A successful DNS lookup can therefore be followed by a connection timeout.

AWS provides Route 53 Resolver for VPC DNS resolution. Private hosted zones can define names visible only to associated VPCs. Custom DNS servers can be configured through VPC DHCP options.  

---

## 0.3.23 TLS and HTTPS

TLS provides encrypted transport and normally authenticates the server using a certificate.

A simplified HTTPS interaction is:

```text
1. DNS resolves the hostname.
2. A TCP connection opens to port 443.
3. TLS validates the server identity and negotiates encryption.
4. HTTP requests travel through the encrypted connection.
```

Different failures indicate different layers:

```text
DNS failure          → name resolution
TCP timeout          → routing or filtering
Connection refused  → endpoint reachable, no listener
Certificate mismatch → TLS identity problem
HTTP 403             → application or authorization rejection
```

TLS does not make an IAM decision, and IAM does not establish TLS encryption.

---

## 0.3.24 VPC endpoints

A VPC endpoint provides private connectivity from a VPC to a supported service without requiring a public Internet path.

Two important families are:

### Gateway endpoints

Route-table targets used for supported services, principally S3 and DynamoDB.

```text
AWS service prefix list → gateway endpoint
```

### Interface endpoints

ENIs with private IP addresses in selected subnets, powered by AWS PrivateLink.

```text
Application
    │
    ▼
Private endpoint IP
    │
    ▼
AWS service
```

A VPC endpoint solves the **network path** problem. It does not automatically grant service permissions.

```text
S3 endpoint exists
    AND
AppRole lacks s3:GetObject
    =
AccessDenied
```

The uploaded VPC material emphasizes that PrivateLink avoids requiring an Internet Gateway, NAT device, VPN, public IP, or Direct Connect connection for the service path.

---

## 0.3.25 VPC connectivity families

These are only recognition-level distinctions for now.

### VPC peering

A direct private connection between two VPCs.

- point-to-point;
- non-transitive;
- can cross accounts or Regions;
- the two VPCs in a peering pair cannot have matching or overlapping CIDR blocks.

```text
A ↔ B
B ↔ C

does not imply:

A ↔ C
```

### Transit Gateway

A managed regional routing hub for many:

- VPCs;
- VPNs;
- Direct Connect paths;
- other Transit Gateways through peering.

Useful for hub-and-spoke networks.

### Site-to-Site VPN

An encrypted IPsec connection over Internet connectivity between AWS and an external network.

- relatively quick to provision;
- encrypted;
- performance can vary with Internet conditions.

### Direct Connect

A dedicated private network connection from an organization’s network to AWS.

- more consistent network experience;
- suitable for substantial or predictable hybrid traffic;
- not inherently redundant;
- not automatically encrypted merely because it is private;
- can be combined with VPN when IPsec encryption is required.

The uploaded guide contrasts VPN and Direct Connect primarily through provisioning speed, bandwidth consistency, private connectivity, encryption, and cost.

---

## 0.3.26 Load balancers and the network layers

### Application Load Balancer

Use when the routing decision depends on application information:

- HTTP or HTTPS;
- hostname;
- URL path;
- headers;
- methods;
- gRPC.

### Network Load Balancer

Use for high-performance Layer 4 traffic:

- TCP;
- UDP;
- TLS;
- static IP requirements;
- source-IP preservation requirements.

### Gateway Load Balancer

Use to insert and scale network appliances such as:

- firewalls;
- intrusion-detection systems;
- traffic-inspection appliances.

The uploaded comparison chapter provides the detailed ALB, NLB, and GWLB feature matrix.

---

# 0.4 Packet walks

## 0.4.1 Internet client to a private application

Consider this architecture:

```text
                         AWS Region
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Public subnets                     Private subnets     │
│                                                         │
│   ┌───────────────┐                 ┌────────────────┐   │
│   │ Application   │   TCP 8080      │ Application    │   │
│   │ Load Balancer ├────────────────►│ instances      │   │
│   └───────▲───────┘                 └───────┬────────┘   │
│           │                                 │            │
│           │ HTTPS 443                       │ TCP 5432   │
│           │                                 ▼            │
│   Internet Gateway                  ┌────────────────┐   │
│                                    │ RDS database   │   │
│                                    └────────────────┘   │
└─────────────────────────────────────────────────────────┘
            ▲
            │
         Internet
```

The request proceeds conceptually as follows:

1. DNS resolves the application hostname to the load balancer.
2. The client opens TCP port 443.
3. The load balancer accepts HTTPS traffic.
4. The load balancer evaluates its listener and routing rules.
5. It opens a connection to an application target.
6. The application security group permits traffic from the load-balancer security group.
7. The application processes the request.
8. A database operation requires a separate connection to the database.
9. The database security group permits port 5432 from the application security group.
10. Database credentials and database-level permissions must still be valid.

Notice the independent controls:

```text
Route to application       ≠ application security-group permission
Security-group permission  ≠ database login
Database login             ≠ IAM permission to manage RDS
```

---

## 0.4.2 Private application to the Internet through NAT

```text
Application instance:
    10.0.10.25:49152
        │
        │ private route: 0.0.0.0/0 → NAT
        ▼
NAT Gateway:
    translates source to 198.51.100.20
        │
        │ public route: 0.0.0.0/0 → IGW
        ▼
Internet server:
    203.0.113.50:443
```

A return packet travels back to the NAT Gateway, which maps it to the original private flow.

Potential failure points include:

- missing private-subnet route to the NAT Gateway;
- NAT Gateway not reachable through its public subnet;
- NACL blocking the ephemeral port;
- application security group blocking outbound HTTPS;
- remote endpoint failure;
- DNS resolution failure.

---

## 0.4.3 Private application to S3 through a VPC endpoint

```text
Application
   │
   │ signed HTTPS request
   ▼
Subnet route table
   │
   │ S3 prefix list → gateway endpoint
   ▼
S3 service endpoint
   │
   │ IAM and bucket-policy evaluation
   ▼
Object
```

This path does not need NAT merely to reach S3.

The endpoint solves:

```text
private network reachability
```

The application role and bucket policies solve:

```text
authorization
```

Both are required.

---

## 0.4.4 Engineer administering AWS

```text
Engineer
   │
   ▼
Corporate identity provider
   │
   ▼
IAM Identity Center
   │
   ▼
Assumed Administrator role session
   │
   ▼
AWS control-plane API
```

Network security groups around application instances do not control this AWS API permission. IAM policies, SCPs, boundaries, and the assumed role do.

An engineer can therefore be allowed to inspect EC2 configuration through AWS APIs while being unable to connect to the instances’ application ports.

---

# 0.5 Integrated example: Northstar customer portal

## Business brief

Northstar operates a customer portal.

- Customers access it over HTTPS.
- Application servers must not accept direct Internet connections.
- A PostgreSQL database stores transactions.
- The application reads generated reports from S3.
- Engineers authenticate through the corporate identity provider.
- Engineers may inspect production, but only a deployment service may update the application.

## Baseline architecture

```text
                               AWS account
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Workforce identity                                            │
│                                                                │
│  Corporate IdP → IAM Identity Center → EngineerReadOnly role   │
│                                        Deployment role         │
│                                                                │
│  VPC: 10.0.0.0/16                                              │
│                                                                │
│  Public subnets                                                │
│      Internet Gateway                                          │
│             │                                                  │
│             ▼                                                  │
│      Application Load Balancer                                 │
│             │                                                  │
│  Private application subnets                                   │
│             ▼                                                  │
│      Application instances                                    │
│        AppRuntimeRole                                          │
│          │          │                                          │
│          │          └────────► S3 through VPC endpoint         │
│          ▼                                                     │
│      PostgreSQL database                                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## IAM decisions

### Engineers

Engineers authenticate through the corporate identity provider and receive temporary sessions through IAM Identity Center.

`EngineerReadOnly` can inspect application and infrastructure state but cannot modify production.

### Application

`AppRuntimeRole` allows only the actions needed by the application, such as reading the report prefix.

Its trust relationship allows the appropriate compute service to use it.

### Deployment

The deployment system uses a separate role with update permissions.

Engineers may be allowed to initiate a deployment without receiving the deployment role’s runtime privileges. Any necessary `iam:PassRole` permission is limited to the approved role and service.

### Organization guardrail

An SCP might prohibit disabling mandatory audit services. The SCP does not give engineers read access; their role policies do that.

---

## Network decisions

### Load balancer

The Internet-facing load balancer is placed in public subnets.

Its security group allows:

```text
Inbound TCP 443 from approved Internet sources
```

### Application

Application instances are placed in private subnets without public IP addresses.

Their security group allows:

```text
Inbound application port only from the load-balancer security group
```

### Database

The database is not Internet-facing.

Its security group allows:

```text
Inbound TCP 5432 only from the application security group
```

### S3

The application reaches S3 through a VPC endpoint. Its IAM role still needs `s3:GetObject`, and any explicit bucket-policy deny still wins.

---

## Changed-requirement variants

### Variant A: No general Internet egress

Remove the NAT dependency and add the required VPC endpoints for AWS services used by the application.

This changes networking, not the application’s IAM permissions.

### Variant B: A partner account needs one report prefix

Use either:

- a resource policy granting the partner role access to that prefix; or
- a cross-account role in Northstar’s account.

The right choice depends on whether the partner should act as its own principal or assume a Northstar identity.

### Variant C: Engineers may deploy but must not read customer data

Separate:

```text
deployment authorization
```

from:

```text
data-plane authorization
```

The deployment role can update infrastructure while lacking permission to read the data itself.

### Variant D: One Availability Zone may fail

Place redundant load-balancer nodes, application capacity, and database resilience mechanisms across multiple Availability Zones.

IAM is largely unchanged. The new requirement is primarily about placement, routing, capacity, and data resilience.

---

# 0.6 Diagnosing failures

Use the following order when something does not work.

## For AWS API operations

```text
1. Does the caller have credentials?
2. Are the credentials valid and unexpired?
3. Which principal/session is actually making the request?
4. Is there an applicable allow?
5. Is there an explicit deny?
6. Do an SCP, boundary, or session policy limit the request?
7. Does a resource policy or trust policy also need to permit it?
8. Is the request targeting the intended account, Region, and resource?
```

## For network interactions

```text
1. Does DNS return the expected address?
2. Does the source have the expected IP and subnet?
3. Which route matches the destination?
4. Is the route target available?
5. Does the security group allow the flow?
6. Does the NACL allow both directions?
7. Is the destination listening on the protocol and port?
8. Is the return path valid?
9. Does TLS succeed?
10. Does the application accept the request?
```

## Symptom heuristics

| Symptom | First suspects |
| --- | --- |
| `AccessDenied` | IAM policy, resource policy, SCP, boundary, explicit deny |
| Invalid or expired token | Authentication or STS session |
| DNS name not found | DNS record, resolver, private hosted-zone association |
| Connection timeout | Route, gateway, security group, NACL, unhealthy endpoint |
| Connection refused | Destination reachable but no listener on that port |
| TLS certificate error | Hostname, certificate, trust chain, TLS configuration |
| HTTP 401/403 | Application authentication or authorization |
| Database “password authentication failed” | Database credentials, not basic VPC routing |
| Role cannot be attached to service | `iam:PassRole`, role trust, wrong account |
| Role can be assumed but cannot access resource | Role permission policy or target resource policy |

These are diagnostic heuristics rather than proofs. A poorly designed application may convert an upstream timeout into an HTTP 500, for example.

---

# 0.7 Memory map

## IAM

```text
Who can do what to which resource under what conditions?
```

```text
Principal → Action → Resource + Context
```

```text
Trust policy      → who may assume the role
Permission policy → what the role session may do
```

```text
Default deny
+ applicable allow
- explicit deny
∩ applicable ceilings
```

```text
AssumeRole → caller becomes role session
PassRole   → service is authorized to use role
```

## Networking

```text
Can this source reach this destination using this protocol and port?
```

```text
DNS name
   ↓
Destination address
   ↓
Longest-prefix route
   ↓
Gateway or local target
   ↓
Security group
   ↓
Network ACL
   ↓
Listener
   ↓
Application
```

## Combined

```text
IAM says permission.
Networking says reachability.
The service says whether the operation is valid.
```

---

# 0.8 Retrieval practice

Try to answer these without looking back.

### 1

An SCP allows all S3 actions, but a role has no S3 policy. Can the role read an object?

### 2

A role’s trust policy names an engineer’s role as a trusted principal. Does that trust policy grant the resulting session permission to terminate EC2 instances?

### 3

What is the conceptual difference between `sts:AssumeRole` and `iam:PassRole`?

### 4

Can an IAM group appear as the `Principal` in an S3 bucket policy?

### 5

An application has `s3:GetObject`, but a bucket policy explicitly denies the action. What is the result?

### 6

An EC2 instance is in a subnet with:

```text
0.0.0.0/0 → Internet Gateway
```

Does that alone guarantee direct Internet access?

### 7

Why might a NACL need an outbound ephemeral-port rule for a server that accepts inbound traffic on port 443?

### 8

A route table contains:

```text
10.0.0.0/8      → transit gateway
10.20.0.0/16    → peering connection
0.0.0.0/0       → NAT Gateway
```

Which target is selected for `10.20.5.8`?

### 9

DNS correctly resolves a database name to `10.0.20.80`, but the connection times out. What has DNS proved?

### 10

An S3 gateway endpoint exists, but an application receives `AccessDenied`. Why is this possible?

### 11

What makes a subnet public?

### 12

What are the two logically distinct policy sides of an IAM role?

### 13

An engineer can create a Lambda function but receives an error when selecting its execution role. Which IAM permission should be investigated?

### 14

An application can connect to PostgreSQL port 5432 but receives an invalid-password error. Which foundation succeeded, and which layer rejected the request?

### 15

Why does connecting VPC A to VPC B and VPC B to VPC C not automatically connect A to C?

---

# Answer key

### 1

No. The SCP merely leaves S3 available; it does not grant the role permission.

### 2

No. The trust policy controls who may assume the role. The role’s permission policies control what the resulting session may do.

### 3

`AssumeRole` creates a session in which the caller uses the role. `PassRole` authorizes an AWS service to use a role.

### 4

No. A group cannot authenticate or make a request, so it is not a usable principal.

### 5

Denied. The explicit deny takes precedence.

### 6

No. The instance also needs a public IPv4 or appropriate IPv6 address, compatible security controls, and a valid application/listener configuration.

### 7

Because a NACL is stateless. It does not remember that the response belongs to an allowed inbound connection.

### 8

The peering connection. `/16` is more specific than `/8` and `/0`.

### 9

Only that name resolution works and returns that address. It has not proved routing, filtering, listener availability, TLS, or database authentication.

### 10

The endpoint supplies network reachability. IAM and bucket policies still determine authorization.

### 11

Its associated route table has a direct route to an Internet Gateway. Individual resources still need suitable addressing and security rules.

### 12

The trust policy defines who may assume it. Its permission policies define what an assumed-role session may do.

### 13

`iam:PassRole`, together with checking that the role trusts Lambda.

### 14

Network reachability and the TCP listener succeeded. The database’s own authentication layer rejected the credentials.

### 15

VPC peering is non-transitive. A direct connection or a transitive routing service such as Transit Gateway is required.

---

# What to memorize now

Retain these relationships before beginning Project 1:

```text
Account > Region > VPC > Availability-Zone subnet > network interface
```

```text
User = persistent
Group = collection
Role = assumable
Session = temporary principal
```

```text
Identity policy = what an identity may do
Resource policy = who may use a resource
Trust policy = who may assume a role
Boundary / SCP = maximum, not grant
```

```text
Route = where
Security group / NACL = whether traffic is permitted
IAM = whether an AWS action is permitted
```

```text
Public subnet = direct IGW route
Private subnet = no direct IGW route
NAT = private IPv4 egress
VPC endpoint = private path to supported service
```

```text
Security group = stateful, ENI-level, allow rules
NACL = stateless, subnet-level, ordered allow/deny rules
```

The detailed IAM exceptions, KMS policy peculiarities, advanced Transit Gateway routing, Direct Connect virtual interfaces, and uncommon IPv6 mechanisms should remain deferred until a project provides a reason to learn them.
