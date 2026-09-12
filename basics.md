# Part 0: Foundations

## 0.0 A very small shared AWS model

Before IAM, I would add perhaps six short snippets establishing vocabulary used by both foundations:

1. **AWS account as a boundary**
   Resources, identities, billing, and many policies exist within an account. Multiple accounts are usually stronger isolation boundaries than multiple VPCs or IAM groups.

2. **Region and Availability Zone**
   A Region contains multiple Availability Zones. Resources can be global, Regional, zonal, or tied to a particular network interface.

3. **Resource and ARN**
   An AWS resource is something such as an S3 bucket, role, EC2 instance, or Lambda function. An ARN is AWS’s standardized resource identifier.

4. **AWS API request**
   Console actions, CLI commands, SDK calls, and service-to-service interactions eventually become API requests.

5. **Control plane versus data plane**
   Creating a database is a control-plane operation. Connecting to the database and running SQL is a data-plane interaction. IAM and networking can affect these differently.

6. **The two gates**
   An API request must be authorized. A network interaction must also have a valid route and permitted traffic.

This should be only a brief bridge, not a third large foundation.

## 0.1 IAM: identity, authority, and delegation

The IAM introduction should not begin with a catalog of policy types. It should follow the lifecycle of one request:

```text
Human, application, or AWS service
              ↓ authenticates
Principal or temporary session
              ↓ submits
Action + resource + request context
              ↓ evaluated against
Applicable policies and guardrails
              ↓
Allow or deny
```

### Recommended sequence

| Section                                | Concepts                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **1. The security question**           | Principal, action, resource, context                                                                  |
| **2. Authentication vs authorization** | Proving identity versus deciding permitted actions                                                    |
| **3. AWS account and root user**       | Account ownership and why root is exceptional                                                         |
| **4. IAM users**                       | Persistent identity inside one account; long-term credentials                                         |
| **5. IAM groups**                      | A policy-assignment convenience for users, not an identity that applications assume                   |
| **6. IAM roles**                       | Assumable identities without permanent credentials                                                    |
| **7. STS and sessions**                | Temporary credentials created when a role is assumed                                                  |
| **8. Policies**                        | JSON documents containing authorization statements                                                    |
| **9. Policy statement anatomy**        | `Effect`, `Action`, `Resource`, `Principal`, `Condition`                                              |
| **10. Identity-based policies**        | Permissions attached to users, groups, or roles                                                       |
| **11. Resource-based policies**        | Permissions attached to resources such as S3 buckets                                                  |
| **12. Trust policies**                 | Who or what may assume a role                                                                         |
| **13. Role permission policies**       | What the resulting role session may do                                                                |
| **14. Service roles**                  | AWS services acting on behalf of a customer                                                           |
| **15. `iam:PassRole`**                 | Letting a caller assign a role to a service without assuming that role                                |
| **16. Policy evaluation**              | Default deny, applicable allow, explicit deny                                                         |
| **17. Permission ceilings**            | Permissions boundaries, SCPs, and session policies narrow authority but do not independently grant it |
| **18. Cross-account access**           | Resource policies versus assuming a role in the target account                                        |
| **19. Federation**                     | External identity provider, IAM Identity Center, SAML/OIDC, temporary AWS sessions                    |
| **20. Tags and conditions**            | Attribute-based access at a conceptual level                                                          |

The material strongly emphasizes cross-account roles and the distinction between IAM policies and SCPs. In particular, it notes that an SCP defines which actions can be available but does not itself grant permissions.  

### The central policy model

For the introductory chapter, I would use this deliberately simplified model:

1. Everything begins denied.
2. Some applicable policy must allow the request.
3. Any applicable explicit deny wins.
4. Guardrails such as SCPs and permissions boundaries can reduce the available authority.
5. A guardrail does not create authority that was never granted.

Conceptually:

[
\text{effective permissions}
\approx
\text{granted permissions}
\cap
\text{permission ceilings}
--------------------------

\text{explicit denies}
]

That is not the complete IAM evaluation algorithm—resource-based policies and role sessions introduce edge cases—but it is the correct initial mental model. The exceptions should be introduced later when a project actually needs them.

### The most important IAM distinction

A role has two logically different sides:

```text
Trust policy:
    Who may become this role?

Permission policies:
    What may the resulting role session do?
```

A cross-account role assumption usually requires:

```text
Caller in Account B
    has permission to call sts:AssumeRole
                  +
Role in Account A
    trusts the caller or Account B
                  ↓
STS issues temporary role-session credentials
                  ↓
Role permissions determine what the session can do in Account A
```

The uploaded Domain 1 material introduces this exact cross-account pattern and uses roles to avoid creating duplicate IAM users in every account.

### Example IAM snippet

#### IAM role

**Concept:** A role is an identity that is assumed temporarily. It does not normally represent one permanent human and does not require long-term access keys.

**To assume it:** The caller must be permitted to call `sts:AssumeRole`, and the role’s trust policy must accept that caller.

**After assumption:** AWS STS issues temporary credentials. The role’s permission policies determine what that session can do.

**Memory rule:** A trust policy answers **who may enter**. A permission policy answers **what they may do after entering**.

### What should be deferred

The introduction should not yet spend time on:

* `NotPrincipal` and difficult `NotAction` policies;
* role-session ARN edge cases;
* KMS key-policy peculiarities;
* role chaining and maximum session duration;
* service-specific policy condition keys;
* detailed SCP inheritance edge cases;
* complex ABAC patterns.

Those belong inside the later regulated-enterprise, landing-zone, deployment, and cross-account projects.

## 0.2 Networking: reachability and traffic flow

The VPC cheat sheet begins directly with VPCs, CIDR ranges, subnets, route tables, security groups, NACLs, gateways, and network interfaces.

For someone learning networking at the same time as AWS, that order is too abrupt. The chapter should begin with generic networking concepts and then map them onto AWS.

### Recommended sequence

| Section                                 | Concepts                                                               |
| --------------------------------------- | ---------------------------------------------------------------------- |
| **1. A network interaction**            | Source, destination, protocol, port, request, response                 |
| **2. Packets and connections**          | What is transmitted and what “connected” means                         |
| **3. OSI and TCP/IP models**            | A conceptual map, not seven isolated definitions                       |
| **4. Layer 3**                          | IP addresses, networks, routing                                        |
| **5. Layer 4**                          | TCP, UDP, ports, connection state                                      |
| **6. Layer 7**                          | HTTP, DNS, application-aware routing                                   |
| **7. Public and private addresses**     | Routability rather than secrecy                                        |
| **8. IPv4 and IPv6**                    | Basic differences and why NAT is mainly an IPv4 concern                |
| **9. CIDR notation**                    | `/16`, `/24`, `/32`, containment, overlap                              |
| **10. Subnetting**                      | Dividing one address range into smaller networks                       |
| **11. Routes**                          | Destination prefix and next-hop target                                 |
| **12. Longest-prefix match**            | Most specific matching route wins                                      |
| **13. Stateful vs stateless filtering** | Whether return traffic is remembered automatically                     |
| **14. DNS**                             | Names resolving to addresses or service targets                        |
| **15. TLS**                             | Encryption and identity for connections                                |
| **16. AWS Region, VPC, and subnet**     | Regional VPC; Availability Zone-scoped subnet                          |
| **17. ENIs**                            | The network identity attached to compute resources                     |
| **18. Route tables**                    | How subnet traffic selects a destination                               |
| **19. Internet Gateway**                | Internet routing for publicly addressed resources                      |
| **20. NAT Gateway**                     | Outbound IPv4 connectivity for privately addressed workloads           |
| **21. Security groups**                 | Stateful, allow-oriented filtering attached to network interfaces      |
| **22. Network ACLs**                    | Stateless, ordered allow/deny filtering at subnet boundaries           |
| **23. Load balancers**                  | Layer-aware traffic distribution                                       |
| **24. VPC endpoints**                   | Private paths to AWS or privately published services                   |
| **25. Connectivity families**           | Peering, Transit Gateway, VPN, and Direct Connect at recognition level |
| **26. Packet walks**                    | Trace an actual request through all relevant components                |

### OSI should be practical

The uploaded material mentions the OSI model principally while discussing DDoS protection: WAF for application-layer inspection and Shield for common infrastructure-layer attacks. It does not provide a systematic networking introduction, so that part would be added as general networking background rather than extracted from the guide.

I would teach all seven layers once, but concentrate almost all later attention on layers 3, 4, and 7:

| Layer | Exam-relevant intuition                    | Examples                                                                 |
| ----: | ------------------------------------------ | ------------------------------------------------------------------------ |
|     7 | Understands application protocol semantics | HTTP, DNS, ALB, WAF                                                      |
|     6 | Representation and encryption concepts     | TLS does not map perfectly, but is often discussed here conceptually     |
|     5 | Session-management concepts                | Rarely tested as an independent AWS design layer                         |
|     4 | Connections, reliability, and ports        | TCP, UDP, NLB                                                            |
|     3 | Addresses and routing                      | IP, CIDR, route tables, Transit Gateway                                  |
|     2 | Frames and local-link identity             | Ethernet, MAC address; mostly abstracted by AWS                          |
|     1 | Physical transmission                      | Cables, radio, fiber; relevant mainly to physical Direct Connect context |

The warning is important: **OSI is a model, not a perfect description of every modern protocol or AWS product.** It should help explain decisions, not create arguments about whether TLS is exactly layer 5, 6, or partly elsewhere.

### Public versus private subnets

The source material simplifies this as public subnets having Internet Gateway connectivity and private subnets not having it.

The curriculum should state the operational rule more precisely:

#### Public subnet

Its associated route table has a route such as:

```text
0.0.0.0/0 → Internet Gateway
```

That does **not** automatically make every resource in it publicly reachable. An IPv4 EC2 instance also needs a public or Elastic IP address, and its security group and NACL must permit the traffic.

#### Private subnet

It has no direct route to an Internet Gateway. It may still initiate outbound IPv4 connections through a NAT Gateway, reach AWS services through VPC endpoints, or reach corporate networks through VPN or Direct Connect.

### Example networking snippet

#### Security group versus network ACL

**Security group:** Attached to a network interface. It is stateful, so permitted response traffic is automatically recognized. It uses allow rules.

**Network ACL:** Attached to a subnet. It is stateless, so inbound and outbound directions must both be allowed. It supports ordered allow and deny rules.

**Use:** Security groups are the normal workload-level control. NACLs are a coarse subnet-level boundary.

**Exam hinge:** A response blocked only because its ephemeral port was not explicitly permitted usually points toward a stateless NACL issue, not a stateful security-group issue.

This distinction is presented directly in the cheat-sheet comparison table.

## The two foundations should converge

The final part should combine IAM and networking using small failure-analysis cases.

#### Case 1: permission but no path

A Lambda function’s role allows:

```text
s3:GetObject
```

The function runs in a private subnet without NAT or an appropriate S3 endpoint.

**Result:** IAM authorization may be sufficient, but the function has no usable network path to S3.

#### Case 2: path but no permission

An EC2 instance can reach an S3 endpoint, but its role does not allow `s3:GetObject`.

**Result:** Networking succeeds; S3 rejects the API request.

#### Case 3: database access

An application can reach an RDS endpoint on TCP port 5432 because routes and security groups allow it.

That does not necessarily mean the database accepts the login. Database credentials and database-level permissions are separate from network reachability.

#### Case 4: assuming a deployment role

A developer has Internet connectivity to AWS APIs and is authenticated in Account B. They try to assume a role in Account A.

The operation still fails unless:

* the developer is allowed to invoke `sts:AssumeRole`;
* the target role trusts the relevant principal;
* no permissions boundary or SCP blocks the action.

This “two gates plus service configuration” model should then appear in every project.

## Snippet format

Each item should remain around 60–120 words and contain only one central distinction:

```text
Concept:
Mental model:
Small example:
Closest contrast:
Exam hinge:
```

Not every snippet needs all five fields. For elementary ideas, three sentences may be enough.

After every six to eight snippets, there should be:

* one small diagram;
* one packet or authorization trace;
* three retrieval questions;
* one changed-requirement scenario.
