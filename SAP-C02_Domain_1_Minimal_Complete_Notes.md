---
title: "SAP-C02 Domain 1: Organizational Complexity"
subtitle: "Minimal high-coverage core, written as dense formal notes"
author: "Prepared for Agustin"
date: "Verified against current AWS documentation: 2026-08-03"
lang: en-US
---

# Scope and use

This is a first-principles study text for **SAP-C02 Domain 1: Design Solutions for Organizational Complexity**. The current exam guide assigns this domain **26% of scored content** and divides it into five tasks:

1. architect network connectivity strategies;
2. prescribe security controls;
3. design reliable and resilient architectures;
4. design a multi-account AWS environment;
5. determine cost-optimization and visibility strategies.

The official outline is explicitly non-exhaustive. Therefore, this document is a **minimal high-coverage core**, not a proof that no other AWS detail can appear. Use mock-exam errors to add only the missing deltas.

**Source convention.** `[TD]` denotes the uploaded Tutorials Dojo chapter (pages 40-58). `[AWS]` denotes current official AWS documentation. `[SYN]` denotes a compact consequence or exam heuristic derived from those facts. Current AWS documentation takes precedence over older study material.

# Corrections to learn before the chapter

The uploaded chapter is useful but contains terminology and product behavior that have changed.

| Older statement or omission | Current rule to learn |
|---|---|
| "Master account" | The current term is **management account**. Keep it nearly empty, tightly restrict access, and delegate service administration to member accounts where supported. |
| SCP as a permission policy | An **SCP never grants**. It is a principal-side maximum-permission boundary for member accounts. It does not constrain identities in the management account. |
| No resource-side organization boundary | **Resource control policies (RCPs)** now provide a resource-side maximum-permission boundary for supported resources in member accounts. They also never grant and do not affect management-account resources. |
| Transit gateways in the same Region cannot peer | Transit gateways can now peer **intra-Region or inter-Region**. Routes through the peering attachment are configured explicitly. |
| Transit Gateway never supports security-group references across VPCs | It now supports inbound security-group references between VPCs attached to the **same** transit gateway when enabled on the transit gateway and attachments. It is not supported across transit-gateway peering. |
| Both VPC DNS attributes are true by default | `enableDnsSupport=true` by default. `enableDnsHostnames=false` for a nondefault VPC and true for a default VPC. The two attributes have distinct meanings. |
| Transit VPC as the normal hub solution | Treat Transit VPC as a custom/legacy appliance pattern. Prefer managed **Transit Gateway** unless a requirement specifically needs custom virtual routers or appliances. |
| Memorize old Direct Connect numeric limits | Learn the topology and VIF semantics. Quotas change; consult the current quota page if a question explicitly depends on a number. |

# 0. Formal model

## 0.1 Objects and isolation boundaries

**Definition 0.1 (Region).** A geographic AWS deployment area containing multiple isolated Availability Zones. Most workload services and resources are Regional.

**Definition 0.2 (Availability Zone, AZ).** A physically separated fault domain inside one Region. A subnet belongs to exactly one AZ.

**Definition 0.3 (AWS account).** A native boundary for identity administration, billing, quotas, API ownership, and blast radius. An account is stronger isolation than a VPC.

**Definition 0.4 (VPC).** A Regional, logically isolated IP network owned by one account. A VPC contains AZ-scoped subnets, route tables, gateways, endpoints, and network controls.

**Definition 0.5 (Organization).** A rooted tree of AWS accounts managed by AWS Organizations:

```text
organization root
  -> organizational unit (OU)*
      -> child OU* or member account
```

Each member account has one parent in the tree and belongs to at most one organization.

**Definition 0.6 (Management account).** The account that creates and owns the organization and pays the consolidated bill. It has organization-wide authority; SCPs and RCPs do not constrain it. Therefore, use it only for organization-level operations that cannot be delegated.

**Definition 0.7 (Delegated administrator).** A member account authorized to administer one integrated AWS service across the organization. It reduces use of the management account, but remains a member account and is constrained by applicable organization policies.

**Definition 0.8 (OU).** A policy-inheritance node containing accounts or child OUs. OUs should usually group accounts with the same controls, not mechanically reproduce the human org chart.

**Boundary ordering.** For common architectural reasoning:

```text
Region failure domain > AZ failure domain > resource failure domain
account isolation > VPC isolation > subnet segmentation
```

The symbols mean "broader failure/isolation scope," not that one mechanism replaces another.

## 0.2 Authorization algebra

Let `r` be an AWS API request.

A safe exam-level model is:

```text
Allowed(r)
  = at least one applicable Allow
    AND every applicable permission ceiling admits r
    AND no applicable explicit Deny exists.
```

- **Grant-capable policies:** identity policies, resource policies, role permissions, KMS key policies/grants.
- **Ceilings:** permissions boundaries, session policies, SCPs, RCPs, and some service-specific boundaries.
- **Default:** implicit deny.
- **Dominance:** explicit deny overrides allow.
- **Cross-account:** the requesting account evaluation **and** the resource-owning account evaluation must both allow the request.

Compactly:

```text
cross_account_allow = source_side_allow AND destination_side_allow
```

Do not simplify this to "the SCP allows it." An SCP can only fail to block an otherwise granted request.

## 0.3 Network reachability algebra

For a client `s` to reach destination `d`:

```text
Reachable(s,d)
  = name resolution, if a name is used
    AND a forward route exists at every routing hop
    AND every network function forwards the traffic
    AND every applicable filter permits it
    AND the destination/service authorization accepts it
    AND a valid return path exists.
```

Consequences:

- A DNS answer does not imply reachability.
- A route does not imply authorization.
- A security group does not create a route.
- A stateless filter requires explicit return-path rules.
- Service endpoint policies, IAM, and resource policies can reject traffic after network delivery succeeds.

## 0.4 Reliability and optimization algebra

**RTO** = maximum acceptable time from failure to restored service.

**RPO** = maximum acceptable amount of lost data, expressed as time before the failure.

```text
required recovery design must satisfy:
actual_RTO <= required_RTO
actual_RPO <= required_RPO
```

The exam's usual optimization problem is:

```text
minimize  money cost + operational burden + change risk
subject to security, latency, throughput, residency, RTO, RPO,
availability, compatibility, and deadline constraints.
```

Hard constraints dominate price. Among all valid designs, prefer the managed, simpler, and less operationally intensive one unless the question explicitly values another objective.

# 1. Multi-account environment and governance

## 1.1 Why multiple accounts exist

**Proposition 1.1.** Split workloads into different accounts when at least one of these differs materially:

- blast-radius requirement;
- data sensitivity or compliance boundary;
- ownership or administrative team;
- lifecycle, such as production versus development;
- required organization controls;
- billing/chargeback identity;
- service quotas;
- incident-containment requirement.

**Consequence.** A single large account is usually inferior for a complex organization because identity, quotas, cost ownership, and accidental-impact boundaries become entangled.

**Counter-condition.** Do not create an account for every tiny component when the workloads share the same owners, controls, lifecycle, and cost center; account proliferation has operational cost.

## 1.2 Minimal landing-zone structure

A common high-quality baseline is:

```text
Management account          organization-only operations and payer

Security OU
  Log archive account       immutable/central audit logs and backups
  Security tooling account  delegated security administration

Infrastructure OU
  Network account           shared VPCs, TGW, DNS, inspection, DX/VPN
  Shared services account   directory, CI/CD, artifact and ops services

Workloads OU
  Production OU             production workload accounts
  Nonproduction OU          development/test workload accounts

Sandbox OU                  experimentation with strict limits
Suspended OU                quarantined or closed accounts
```

Names are not normative. The invariant is separation of **organization administration**, **security evidence**, **security operations**, **shared infrastructure**, and **workload blast radii**.

**Rule 1.2.** Put accounts in OUs according to the policy set they must inherit. If two accounts need different guardrails, they probably should not share the same lowest OU.

## 1.3 AWS Organizations

AWS Organizations provides the tree, consolidated billing, account lifecycle, organization policies, trusted service integrations, and delegated administration.

**All-features mode** is required for authorization policies such as SCPs/RCPs and for many organization-wide service integrations.

**Trusted access** permits an integrated AWS service to perform organization-wide operations on behalf of the organization.

**Delegated administration** assigns that service's organization-wide administration to a member account.

```text
trusted access: service may operate across the organization
+
delegated admin: a chosen member account controls that service
```

**Management-account invariant.** Do not run ordinary workloads there. It is outside SCP/RCP protection and has unusually broad authority.

## 1.4 Organization policy types

| Mechanism | Acts primarily on | Grants access? | Main purpose |
|---|---|---:|---|
| IAM identity/resource policy | A principal or resource | Yes | Actual authorization. |
| SCP | Principals in member accounts | No | Maximum permissions available to identities. |
| RCP | Supported resources in member accounts | No | Maximum permissions available through resource access, including external principals. |
| Permissions boundary | One IAM user/role | No | Maximum permissions that identity policies may grant. |
| Tag policy | Resource tags | No | Standardize and, for supported operations, enforce tag keys/values. |
| Backup policy | Backup configuration | No | Apply backup plans across accounts/OUs. |
| Declarative policy | Supported service configuration | No | Centrally enforce selected service settings. |
| AWS Config rule | Resource state | No | Detect configuration compliance; optionally trigger remediation. |

### SCP evaluation

Let `P(root...account)` be the SCPs on the path from root through OUs to the account.

```text
SCP ceiling = intersection of permissions admitted along the path.
```

- An explicit deny at any level wins.
- In an allowlist strategy, an action must remain allowed at every level.
- The default `FullAWSAccess` SCP allows all actions to pass SCP evaluation; it grants nothing.
- SCPs affect principals in member accounts, including the member-account root user, with documented exceptions such as service-linked roles.
- SCPs do not affect the management account.

**Denylist strategy.** Keep broad allow and add explicit denies for prohibited actions. Easier migration; larger permitted surface.

**Allowlist strategy.** Permit only enumerated services/actions; everything else is implicitly denied. Stronger restriction; substantially higher maintenance and outage risk.

**Deployment rule.** Test restrictive SCP/RCP changes in a dedicated test OU, then roll outward progressively. A policy error can disable account administration at scale.

### RCP evaluation

RCPs complement SCPs:

```text
SCP: what organization principals may do
RCP: what organization resources may accept
```

RCPs are especially useful for preventing organization resources from being accessed by principals outside an approved trust boundary. They support a subset of services and do not affect management-account resources.

## 1.5 AWS Control Tower

**Definition.** Control Tower builds and governs a multi-account landing zone on top of Organizations. Core functions include:

- standardized landing-zone setup;
- a log archive account and an audit/security account;
- Account Factory for governed account provisioning;
- account enrollment and baselines;
- a control catalog and compliance dashboard.

**Control behavior:**

| Control | Time of evaluation | Typical implementation | Meaning |
|---|---|---|---|
| Preventive | During API/configuration attempt | SCP, RCP, declarative policy | Disallows violating actions/settings. |
| Proactive | Before CloudFormation resource provisioning | CloudFormation hook | Rejects a noncompliant planned resource. |
| Detective | After resource state exists | AWS Config rule | Reports noncompliance; may remediate. |

Do not confuse **behavior** (preventive/proactive/detective) with guidance categories such as mandatory, strongly recommended, and elective.

## 1.6 Infrastructure deployment and governed self-service

### CloudFormation StackSets

**Purpose.** Administrator-driven deployment of one CloudFormation template to many target accounts and Regions.

```text
one template -> many stack instances(account, Region)
```

Use when the organization wants a uniform baseline: IAM roles, Config recorders, logging, security agents, VPC components, or standard resources.

- **Service-managed permissions:** targets accounts/OUs in the organization; requires Organizations trusted access; AWS creates required roles; can auto-deploy to new accounts added to targeted OUs.
- **Self-managed permissions:** administrator and execution roles are created manually; useful for accounts outside the organization or custom trust arrangements.

StackSets push infrastructure. They do not, by themselves, make resources immutable after deployment. Manual changes can cause drift if the actor has permissions.

### AWS Service Catalog

**Purpose.** User-driven self-service from centrally approved products.

```text
portfolio -> products -> versions + constraints + launch roles
```

Use when end users need choice, but only among approved templates and parameters. Products are Regional, so multi-Region distribution requires explicit replication/automation.

### Selection theorem

```text
uniform admin-pushed baseline across accounts/Regions -> StackSets
approved user-selectable products and parameters       -> Service Catalog
both requirements                                      -> combine both
```

## 1.7 Cross-account resource sharing patterns

| Requirement | Primary mechanism |
|---|---|
| Let a principal operate with permissions defined in the target account | Cross-account IAM role + STS. |
| Let an external principal call a resource directly | Resource-based policy, if the service supports one. |
| Share a supported infrastructure resource without transferring ownership | AWS Resource Access Manager (RAM). |
| Central network team owns VPC/subnets; workload accounts launch resources there | VPC sharing through RAM. |
| Expose only one private service, not full network reachability | AWS PrivateLink. |
| Partner pays S3 request/data-transfer charges | S3 Requester Pays **plus** normal access authorization. |

**RAM.** Shares supported resources with accounts, OUs, or the organization. Within an organization, trusted sharing avoids per-account invitation workflows. Typical shared resources include subnets, Transit Gateways, Route 53 Resolver rules, and IPAM pools.

**VPC sharing.** The owner account controls the VPC, subnets, routes, gateways, and shared network. Participant accounts create and own supported workload resources in shared subnets. Choose it when centralized network ownership and account-level workload separation are both required.

**Managed Microsoft AD sharing.** AWS Managed Microsoft AD can be shared to other accounts/VPCs in the same Region. Directory sharing does not replace network connectivity: routes and security controls must permit directory traffic. Organization sharing is streamlined; external accounts use an invitation/acceptance workflow.

## 1.8 Central logging, compliance, security, and events

A canonical pattern is:

```text
all workload accounts/Regions
  -> organization audit collection
  -> immutable log archive account
  -> security tooling/delegated-admin account
  -> central event bus / notification targets
```

| Service | Central role | Important non-equivalence |
|---|---|---|
| CloudTrail organization trail | Records API/activity events from all organization accounts into central S3/CloudWatch destinations. Member accounts cannot modify/delete the organization trail. | CloudTrail is an audit event history, not resource-state compliance. |
| AWS Config recorder + aggregator | Record configuration history in each source account/Region; aggregate inventory/compliance centrally. | An aggregator does not turn on Config recording in source accounts. |
| Organization Config rules/conformance packs | Deploy common compliance rules and remediations across accounts. | Primarily detective unless remediation is configured. |
| Security Hub CSPM | Aggregate normalized security findings and centrally configure standards/controls through a delegated administrator and home Region. | It aggregates/posture-manages; it is not the underlying detector for every finding. |
| GuardDuty | Threat detection from AWS telemetry; organization delegated admin can auto-enable members. | It detects suspicious behavior, not software vulnerabilities. |
| EventBridge | Route account/organization events to a central event bus and targets using resource policies and IAM roles. | Event delivery still needs receiver authorization and target policy. |

**Log-protection rule.** Place logs/backups in a separate account, restrict deletion, use independent KMS keys and retention controls, and avoid granting workload administrators the ability to destroy their own evidence.

# 2. Identity, cross-account access, and security controls

## 2.1 Authentication, federation, and provisioning

**Authentication** proves who the subject is. **Authorization** decides what it may do.

**IAM Identity Center** is the normal workforce-access plane for multiple AWS accounts. Users/groups receive account assignments through **permission sets**, which materialize roles in target accounts.

For an external identity provider:

```text
SAML 2.0 = browser/workforce authentication federation
SCIM 2.0 = user/group provisioning, update, and deprovisioning
OIDC      = token-based federation, common for applications/web identities
```

SCIM does not authenticate. SAML does not keep users/groups synchronized.

Prefer temporary credentials from federation or roles. Long-lived IAM users are an exception, not the multi-account default.

## 2.2 Cross-account role theorem

Suppose principal `p` in account `A` needs permissions in account `B` through role `R`.

All of these are required:

1. `R`'s **trust policy** in `B` trusts `p` or account `A`, with any conditions.
2. `p`'s identity permissions in `A` allow `sts:AssumeRole` on `R`.
3. `R`'s permission policies allow the requested target action.
4. Applicable boundaries, session policies, SCPs, and explicit denies permit the request.

```text
AssumeRole success != permission to perform the final action
```

**External ID.** Require an external ID when a third-party multi-tenant provider assumes customer roles. It prevents the confused-deputy problem by binding the request to the intended customer context.

**MFA condition.** A role trust policy can require MFA for privileged human access.

## 2.3 Resource-based cross-account access

Services such as S3, SQS, SNS, EventBridge, Secrets Manager, and KMS support resource policies. A resource policy names trusted principals and allowed actions.

For cross-account direct resource access:

```text
source principal must be permitted
AND destination resource policy must trust it
AND no boundary or explicit deny may block it.
```

Use a role when you want the target account to define a reusable permission persona over multiple services. Use a resource policy when direct access to one supported resource is simpler.

## 2.4 KMS and certificate rules

**KMS key.** A Regional cryptographic resource whose key policy is the primary access-control document.

**Cross-account KMS theorem.** To use a KMS key owned by another account:

```text
key policy in key-owning account allows external account/principal
AND IAM policy in caller account delegates allowed KMS operations.
```

One side alone is insufficient.

**Grants.** KMS grants provide scoped delegation, often used by integrated AWS services.

**Multi-Region KMS keys.** Related keys share key ID/material and can decrypt one another's ciphertext, but each Regional key is an independent resource with its own policy, grants, aliases, and lifecycle state.

**Envelope encryption.** Data is encrypted with a data key; the data key is encrypted under a KMS key. This avoids sending large payloads to KMS and separates data encryption from master-key protection.

**ACM.** Use AWS Certificate Manager for TLS certificates integrated with AWS services. Public ACM certificates can be automatically renewed when eligibility conditions are met; imported certificates require customer-managed renewal. Use ACM Private CA when private PKI issuance is required. Use CloudHSM only when requirements demand single-tenant HSM control or specialized key custody beyond ordinary KMS.

## 2.5 Network and application security controls

| Control | Scope | State | Rules | Best use |
|---|---|---:|---|---|
| Route table | Subnet/gateway path | N/A | Destination -> next hop | Reachability; not a firewall. |
| Security group | ENI/resource | Stateful | Allow only | Workload-level least-privilege traffic. Return traffic is automatically allowed. |
| Network ACL | Subnet | Stateless | Allow and deny, ordered | Coarse subnet boundary or explicit CIDR deny; configure return ports. |
| AWS Network Firewall | VPC routing path | Stateful/stateless | L3-L7 rules | Central inspection, domain/IP/protocol filtering, IDS/IPS-style controls. |
| AWS WAF | HTTP(S) application layer | Request-aware | Web rules | SQLi/XSS/bot/rate/IP controls for CloudFront, ALB, API Gateway, etc. |
| AWS Shield | Edge/DDoS | Managed | DDoS protections | Network/transport DDoS protection; Advanced adds enhanced protection/support. |
| Firewall Manager | Organization-wide policy plane | N/A | Central policies | Apply WAF, Shield, security-group, Network Firewall, DNS Firewall, and related controls across accounts. |

**Selection consequences.**

- Need to filter HTTP request semantics -> WAF, not NACL.
- Need stateful filtering of arbitrary VPC traffic -> Network Firewall or an appliance, not WAF.
- Need resource-local allow rules -> security groups.
- Need subnet-level explicit deny -> NACL.
- Need organization-wide consistency -> Firewall Manager plus Organizations.

## 2.6 Security-service semantic map

| Question | Service |
|---|---|
| Who called which AWS API, when, and from where? | CloudTrail. |
| What resource configuration existed, changed, or violated a rule? | AWS Config. |
| Is behavior suspicious based on AWS telemetry? | GuardDuty. |
| Are EC2/ECR/Lambda workloads vulnerable or unintentionally exposed? | Inspector. |
| Does S3 contain sensitive data? | Macie. |
| Where are security findings and posture controls aggregated? | Security Hub CSPM. |
| Which identities/resources are shared outside the intended zone of trust, or have unused access? | IAM Access Analyzer. |
| How are organization-wide firewall policies deployed? | Firewall Manager. |
| How is audit evidence collected against frameworks? | Audit Manager. |

# 3. Network connectivity strategies

## 3.1 Region, AZ, and placement decisions

Choose Regions using the intersection of: required service availability, legal/data-residency constraints, user and dependency latency, connectivity to on-premises sites, cost, and disaster independence. Use multiple AZs inside one Region for ordinary high availability; use multiple Regions only when Regional failure, sovereignty, global latency, or business-continuity requirements justify the extra data and operational complexity.

A placement is invalid if a required service or feature is unavailable in the chosen Region, even if every other property is attractive. Cross-AZ and cross-Region communication can add latency and data-transfer cost; colocating tightly coupled chatty components can be cheaper and faster, but must not collapse required fault-domain independence.

## 3.2 VPC primitives from zero

**CIDR.** An IPv4 block `/n` contains `2^(32-n)` addresses before AWS reservations. Smaller `n` means a larger block.

**VPC.** Regional CIDR space. **Subnet.** One CIDR slice in one AZ.

**Route selection.** AWS uses longest-prefix match:

```text
more specific route wins: /24 over /16 over /0
```

**Public subnet.** A subnet whose route table sends internet-bound traffic to an Internet Gateway; a resource also needs a public address and permissive security controls.

**Private IPv4 egress.** Private subnet -> NAT Gateway -> Internet Gateway. NAT Gateway supports outbound-initiated IPv4 traffic; it does not make instances directly reachable from the internet.

**IPv6 egress-only.** Use an egress-only Internet Gateway for outbound-initiated IPv6 without inbound initiation.

**VPC endpoint.** Private service access without traversing an Internet Gateway/NAT:

- **Gateway endpoint:** route-table target for S3 and DynamoDB.
- **Interface endpoint:** private ENIs powered by PrivateLink for many AWS/partner/customer services.
- **Gateway Load Balancer endpoint:** transparent insertion of virtual network appliances.

An endpoint policy is an additional filter; it does not replace IAM or the destination resource policy.

**IPAM.** Amazon VPC IP Address Manager centrally allocates, monitors, and audits CIDR use across accounts/Regions, detects overlap, and shares pools through RAM. Use it before network growth makes address conflicts structural.

**Container-network consequence.** ECS tasks using `awsvpc` networking and EKS pods using the VPC CNI can consume VPC ENIs and subnet IP addresses. Therefore, container scale is also an IP-capacity problem: plan non-overlapping CIDRs, subnet headroom, and IPAM before large multi-account or multi-cluster growth.

## 3.3 VPC-to-VPC and account-to-account connectivity

### VPC peering

Properties:

- one-to-one VPC relationship;
- private routing across same/different accounts and Regions;
- no transitive routing;
- overlapping CIDRs are not supported;
- route tables must be updated on both sides;
- mesh connection count grows approximately as `n(n-1)/2`;
- security-group references are supported across peering only under documented same-Region conditions.

Use for a small number of VPCs requiring simple direct connectivity and no transit hub.

### Transit Gateway (TGW)

A Regional managed Layer-3 transit hub connecting VPCs, Site-to-Site VPNs, Direct Connect gateways, and other attachments.

```text
attachment -> associated TGW route table used for ingress lookup
attachment -> may propagate routes into one or more TGW route tables
```

- Each attachment associates with one TGW route table.
- An attachment can propagate routes to multiple route tables.
- Multiple route tables create routing domains and segmentation.
- TGW provides transitive hub-and-spoke routing.
- Overlapping attached VPC CIDRs are not routable.
- TGWs can peer intra-Region or inter-Region; add explicit routes to peering attachments.
- Security-group references can work for inbound rules between VPCs on the same TGW when enabled at both levels; not across TGW peering.

Use for many VPCs, centralized inspection, hybrid connectivity, or routing domains.

### VPC sharing

Use when a central network account must own subnets and routing while application teams retain separate workload accounts. It avoids connecting many independently owned VPCs because participants deploy into shared subnets of one owner VPC.

### AWS PrivateLink

PrivateLink exposes a **service**, not an entire routed network.

Provider:

```text
service -> Network Load Balancer -> endpoint service
```

Consumer:

```text
interface endpoint ENIs -> private service connection
```

Properties:

- no full VPC-to-VPC routing;
- strong provider/consumer separation;
- works with overlapping CIDRs because consumer does not route into provider CIDRs;
- naturally suited to one-directional client-to-service access;
- scales better than broad peering when many consumers need one service.

### Transit VPC / custom appliances

A Transit VPC uses virtual routers or firewalls and VPN overlays to implement transit. It creates appliance licensing, scaling, HA, patching, and routing-operation burden. Choose it only when a specific appliance, protocol, or advanced network function is required and managed TGW/GWLB patterns do not satisfy it.

## 3.4 Selection matrix

| Requirement | Prefer |
|---|---|
| Two or a few VPCs; direct full connectivity; no transit | VPC peering. |
| Many VPCs; transitive hub; hybrid routing; segmentation | Transit Gateway. |
| Central network ownership with separate workload accounts | VPC sharing. |
| Expose one private service to many consumers; overlapping CIDRs | PrivateLink. |
| Insert scalable third-party firewalls transparently | Gateway Load Balancer, often with TGW appliance-mode routing. |
| Custom routing appliance or unsupported protocol is mandatory | Transit VPC/custom appliance. |

## 3.5 Hybrid connectivity

### Site-to-Site VPN

- IPsec-encrypted connectivity over the internet.
- Fast to provision and relatively inexpensive.
- Two tunnels provide redundancy; use both.
- Dynamic routing uses BGP; static routing is possible.
- Performance and latency depend on internet paths.
- Connect one/few VPCs through a Virtual Private Gateway (VGW); connect many VPCs through TGW.

### Direct Connect (DX)

A dedicated network connection from a customer/co-location environment to AWS. It offers more consistent bandwidth and latency than internet VPN, but is not automatically a complete HA design and is not encrypted by default.

**Virtual interfaces:**

| VIF | Connects to | Purpose |
|---|---|---|
| Private VIF | VGW or Direct Connect gateway | Private VPC prefixes. |
| Transit VIF | Direct Connect gateway associated with TGW | Scalable access to TGW-attached networks. |
| Public VIF | AWS public service endpoints | Public AWS IP prefixes without ordinary internet transit. |

**Direct Connect gateway.** A globally available association resource connecting VIFs to VGWs or TGWs across supported Regions/accounts. A DX gateway associated with multiple VGWs does **not** provide VPC-to-VPC transit between those VPCs; use TGW when transit is required.

**Encryption.** If encryption over DX is required, use supported MACsec or run Site-to-Site VPN over a suitable DX/public connectivity design.

**Resilience rule.** A production hybrid design commonly needs redundant routers, connections, and preferably distinct DX locations; VPN can serve as backup. One DX circuit is not high availability.

### Hybrid choice

```text
fast/cheap/encrypted, variable path       -> VPN
predictable private bandwidth/latency     -> Direct Connect
DX performance + IPsec encryption         -> VPN over DX where appropriate
many VPCs through one hybrid hub           -> DX gateway + transit VIF + TGW
```

## 3.6 Hybrid and private DNS

**Route 53 Resolver (AmazonProvidedDNS).** The built-in VPC resolver.

VPC attributes:

- `enableDnsSupport`: queries to the Amazon-provided resolver succeed; default true.
- `enableDnsHostnames`: instances with public IPs can receive public DNS hostnames; default false for nondefault VPCs.
- Both must be true for Route 53 private hosted zones and private DNS on interface endpoints.

**Private hosted zone (PHZ).** A private DNS namespace whose records are visible in associated VPCs. Associate additional VPCs explicitly, including cross-account authorization where required.

**Resolver inbound endpoint.** DNS traffic enters AWS: on-premises/custom DNS forwards AWS/private-zone queries to endpoint IPs.

**Resolver outbound endpoint + forwarding rule.** DNS traffic leaves AWS: VPC Resolver forwards selected domains to on-premises/custom DNS servers.

```text
on-prem -> AWS private names  : inbound endpoint
AWS -> on-prem private names  : outbound endpoint + rule
```

Share Resolver rules across accounts through RAM. Deploy endpoints across at least two AZs for availability.

**DHCP option set.** Supplies DNS servers, domain name, NTP, and selected Windows/NetBIOS settings to VPC resources. One set can be associated with a VPC at a time. A set is immutable: create a replacement and re-associate it.

## 3.7 Global traffic and failover

| Service | Decision primitive | Best fit |
|---|---|---|
| Route 53 | DNS answers, routing policies, health checks, TTL | Global endpoint selection and DNS failover. Client/resolver caching affects failover speed. |
| Global Accelerator | Static anycast IPs and Layer-4 routing over the AWS global network | TCP/UDP applications needing fixed IPs, rapid endpoint failover, and global path optimization. |
| CloudFront | Edge caching/proxy for HTTP(S) content | Web delivery, caching, origin protection, WAF at the edge. |

Do not choose CloudFront merely because the workload is global if the traffic is arbitrary TCP/UDP. Do not choose Global Accelerator when the central requirement is cacheable HTTP content.

## 3.8 Network monitoring and troubleshooting

| Tool | Observes or computes | Use it when |
|---|---|---|
| VPC Flow Logs | IP flow metadata accepted/rejected at ENI/subnet/VPC | You need traffic evidence, not payloads. |
| Reachability Analyzer | Static configuration analysis of one source-to-destination path | You need to locate the blocking/missing network component without sending packets. |
| Network Access Analyzer | Static analysis against access-scope requirements | You need to find unintended reachable paths across many resources. |
| Traffic Mirroring | Copies actual packets from ENIs to appliances | You need packet payload/protocol analysis. |
| CloudWatch metrics/logs | Service and appliance telemetry | You need time-series health, alarms, or application/network-device logs. |

**Troubleshooting order:**

1. Verify source/destination IPs and DNS answer.
2. Trace subnet/VPC/TGW/DX/VPN routes in both directions.
3. Check route propagation/association and longest-prefix selection.
4. Check SG, NACL, firewall, endpoint, and appliance policy.
5. Check service-level IAM/resource policy.
6. Use Flow Logs and static analyzers to confirm the hypothesis.

# 4. Reliable and resilient architectures

## 4.1 Failure domains

**High availability (HA)** handles expected component or AZ failures while the service remains operational.

**Disaster recovery (DR)** restores service after a larger event such as Region loss, destructive operator action, ransomware, or loss of a primary environment.

```text
Multi-AZ usually addresses AZ failure.
Multi-Region addresses Regional failure and some independence requirements.
Cross-account copies address administrative compromise/blast radius.
Backups address recoverability and historical points.
Replication alone does not guarantee recovery from corruption or malicious deletion.
```

## 4.2 Four canonical DR strategies

| Strategy | Secondary environment before disaster | Relative cost | Relative RTO/RPO potential |
|---|---|---:|---|
| Backup and restore | Backups and IaC; application not running | Lowest | Slowest recovery; RPO depends on backup interval. |
| Pilot light | Data and critical core services live; most compute absent/minimal | Low-medium | Faster than restore; scale/provision remaining tiers. |
| Warm standby | Complete but scaled-down environment running | Medium-high | Minutes-scale recovery is plausible; scale to full load. |
| Multi-site active-active | Full-capacity environments serve traffic | Highest | Lowest failover time and potentially near-zero data loss, with highest consistency/operations complexity. |

The ordering is not a guaranteed numeric SLA. Actual RTO/RPO depend on automation, data technology, scale, dependencies, and testing.

**Selection theorem.** Choose the cheapest strategy whose tested RTO/RPO satisfy the requirement. Do not pay for active-active when a four-hour RTO permits restore; do not claim backup-and-restore meets a seconds-level RTO.

## 4.3 Recovery architecture components

A complete DR design needs all of:

```text
recoverable data
+ deployable infrastructure
+ application artifacts/configuration/secrets
+ sufficient quotas and capacity
+ traffic failover
+ dependency ordering
+ tested runbook/automation
+ failback plan
```

A backup that has never been restored is an unverified hypothesis.

### AWS Backup

- Central backup plans and organization backup policies.
- Cross-account copies isolate recovery points from workload administrators.
- Cross-Region copies protect against Regional loss/residency requirements.
- Vault policies restrict access.
- Vault Lock in compliance mode can make retention immutable after its grace period.
- Restore testing schedules actual restore jobs and validates recoverability.

Use both cross-account and cross-Region copies when both administrative and Regional independence are requirements.

### AWS Elastic Disaster Recovery (DRS)

DRS continuously replicates server block storage into a low-cost staging area and orchestrates launch of recovery EC2 instances. It is suited to server-level disaster recovery from on premises or another environment, with RPO commonly in seconds and RTO commonly in minutes when designed and tested correctly.

## 4.4 Common service recovery semantics

| Mechanism | What it gives | What it does not give |
|---|---|---|
| EC2 Auto Scaling across AZs + load balancer | Replaces unhealthy instances and spreads stateless capacity | Regional DR or state recovery. |
| RDS Multi-AZ DB instance deployment | Same-Region HA with managed failover | The standby is not a read-scaling target; independent Region recovery. Multi-AZ DB clusters have different readable-replica semantics. |
| RDS read replica | Asynchronous read scaling; can be promoted | Synchronous zero-loss failover by default. |
| Aurora Global Database | Cross-Region replicas and managed global-database recovery patterns | Automatic correctness for every application consistency model. |
| DynamoDB global tables | Multi-Region active-active replication | Conflict-free application semantics for arbitrary business logic. |
| S3 versioning + replication | Historical object versions and cross-bucket/Region copies | Protection if replication faithfully copies an unwanted change and no retained version is usable. |
| EBS snapshots / EFS replication | Recoverable block/file-system state | Application-consistent recovery without appropriate orchestration. |

## 4.5 Automatic recovery and scaling

**Scale up** increases one resource's size. **Scale out** adds resources. Scale-out stateless tiers behind load balancers usually improve both elasticity and failure tolerance.

A resilient workload normally uses:

- multiple AZs;
- health checks and automated replacement;
- stateless application nodes;
- durable replicated state;
- queues/decoupling where load spikes or dependency failures occur;
- preconfigured alarms and incident automation;
- Service Quotas monitoring and pre-approved increases;
- IaC and immutable artifacts;
- regular failure and restore testing.

**Static-stability rule.** Recovery should not depend on making many fragile control-plane changes during the incident. Pre-provision critical roles, routes, health checks, artifacts, keys, quotas, and runbooks where the RTO demands it.

# 5. Cost optimization and visibility

## 5.1 Consolidated billing

In an organization, the management account pays the bill. Consolidated billing combines usage for volume pricing and can share Reserved Instance and Savings Plans discounts across accounts when sharing is enabled.

```text
account separation does not forfeit consolidated volume economics
```

The management account can enable or disable RI/Savings Plans discount sharing by account. Member accounts remain useful cost-allocation boundaries even though payment is consolidated.

## 5.2 Allocation model

A robust cost identity is hierarchical:

```text
organization/account
  -> business unit / product / environment
      -> application / owner / cost center
          -> resource
```

Use:

- **accounts** for coarse ownership and hard boundaries;
- **user-defined cost allocation tags** for resource-level dimensions; tags must be activated in Billing before they appear as cost dimensions;
- **tag policies** for standardized keys/values, not billing activation;
- **Cost Categories** to map accounts, tags, services, and charge types into business structures and split shared costs.

Missing tags should have an explicit allocation policy; otherwise "untagged" becomes a permanent cost center.

## 5.3 Visibility tools

| Need | Tool |
|---|---|
| Interactive trend analysis, filtering, forecasting, RI/SP recommendations | Cost Explorer. |
| Most detailed line-item cost and usage dataset for SQL/BI analysis | Cost and Usage Report (CUR), commonly queried with Athena. |
| Threshold alerts and optional actions on cost/usage/coverage/utilization | AWS Budgets. |
| Detect statistically unusual spend and likely causes | Cost Anomaly Detection. |
| Performance-informed rightsizing and idle-resource recommendations | Compute Optimizer. |
| Broad best-practice checks including cost | Trusted Advisor. |
| Organization-wide S3 usage/activity/efficiency analytics | S3 Storage Lens. |
| Estimate a proposed architecture before deployment | AWS Pricing Calculator. |

```text
CUR = detailed dataset
Cost Explorer = interactive analysis
Budgets = planned-threshold control
Anomaly Detection = unexpected-pattern detection
Compute Optimizer = rightsizing recommendation
```

## 5.4 Compute purchasing options

| Option | Commitment/interruption | Capacity guarantee | Best fit |
|---|---|---:|---|
| On-Demand | None; no interruption contract | No | Variable, short-lived, uncertain workloads. |
| Spot | Can be interrupted by AWS | No | Fault-tolerant, checkpointable, flexible workloads. |
| Compute Savings Plan | Commit dollars/hour; broad compute flexibility | No | Stable aggregate compute spend across EC2/Fargate/Lambda and changing configurations. |
| EC2 Instance Savings Plan | Commit dollars/hour for instance family in one Region | No | Stable family/Region usage; deeper but less flexible discount. |
| Reserved Instance | Billing discount matching attributes | Zonal RI reserves capacity; Regional RI generally does not | Existing EC2 commitment model and specific matching needs. |
| On-Demand Capacity Reservation | No long-term discount by itself | Yes, in a specific AZ | Capacity assurance; combine with matching SP/Regional RI for discount. |

**Standard RI** is less flexible and typically deeper-discounted than **Convertible RI**, which can be exchanged subject to rules.

**Regional RI** provides regional billing flexibility and no capacity reservation. **Zonal RI** is tied to an AZ and includes a capacity reservation.

**Separation theorem.** Discount and capacity are different dimensions:

```text
Savings Plan / Regional RI = discount, not capacity
Capacity Reservation       = capacity, not discount
matching combination       = both
```

## 5.5 Hidden cost terms

Total architecture cost is not just instance price:

```text
TCO = compute + storage + requests + data transfer
      + managed-service processing + licenses + operations + failure risk.
```

Common exam cost levers:

- cross-AZ, inter-Region, and internet data transfer;
- NAT Gateway hourly and per-GB processing charges;
- unnecessary public IPv4 addresses;
- duplicated logs and excessive retention;
- idle databases, load balancers, EBS volumes, snapshots, and provisioned capacity;
- over-sized instances and low utilization;
- storage class and lifecycle policy;
- architecture that hairpins traffic through firewalls/NAT/TGW unnecessarily;
- highly available or active-active capacity beyond the actual RTO/RPO/SLA.

**Endpoint consequence.** Gateway/interface endpoints can improve privacy and sometimes reduce NAT/data-path cost, but interface endpoints themselves have hourly and data-processing charges. Compare the complete path, not one line item.

# 6. High-yield decision rules

## 6.1 Accounts and governance

1. Need the strongest native separation for security, billing, quotas, or lifecycle -> separate AWS accounts.
2. Need hierarchical policy inheritance -> OUs; group by control requirements.
3. Need a governed multi-account landing zone quickly -> Control Tower over Organizations.
4. Need organization-wide maximum permissions for member-account principals -> SCP.
5. Need organization-wide maximum access accepted by supported resources -> RCP.
6. Need an actual permission grant -> IAM/resource/key policy, not SCP/RCP.
7. Need to minimize management-account exposure -> delegated administrator.
8. Need to let an AWS service operate across the organization -> trusted access.
9. Need a uniform baseline in many accounts/Regions -> StackSets.
10. Need approved end-user self-service with constrained parameters -> Service Catalog.
11. Need both multi-account distribution and user-selectable approved products -> StackSets + Service Catalog.
12. Need centrally owned subnets used by workload accounts -> VPC sharing through RAM.
13. Need to share a supported resource without duplicating it -> RAM.
14. Need centrally protected audit history -> organization CloudTrail trail to a log archive account.
15. Need configuration/compliance view across accounts/Regions -> Config recorders in sources + central aggregator.
16. Need centralized findings and security posture -> Security Hub delegated admin and central configuration.
17. Need organization events delivered centrally -> EventBridge cross-account bus policies/roles.

## 6.2 Identity and security

18. Workforce access to many accounts -> IAM Identity Center and permission sets.
19. External corporate IdP login -> SAML; user/group lifecycle sync -> SCIM.
20. Temporary cross-account permissions defined by target account -> STS AssumeRole.
21. Third-party provider assumes customer role -> require ExternalId.
22. Direct access to one supported resource -> resource policy may be simpler than a role.
23. Cross-account KMS use -> key policy in key account + IAM permission in caller account.
24. Need resource-level stateful allow controls -> security groups.
25. Need subnet-level ordered allow/deny controls -> NACL.
26. Need application HTTP filtering -> WAF.
27. Need arbitrary VPC traffic inspection/IDS-style rules -> Network Firewall or appliance.
28. Need organization-wide firewall policy rollout -> Firewall Manager.
29. Need API audit -> CloudTrail; need resource state/compliance -> Config.
30. Need threat detection -> GuardDuty; vulnerabilities -> Inspector; sensitive S3 data -> Macie.

## 6.3 Networking

31. Two/few non-overlapping VPCs, no transit -> peering.
32. Many VPCs or transitive/hybrid hub -> Transit Gateway.
33. One service to many consumers, no broad routing, or overlapping CIDRs -> PrivateLink.
34. Central network team owns subnets while app teams own resources/accounts -> VPC sharing.
35. S3/DynamoDB private access -> gateway endpoint.
36. Private access to most other AWS/partner/customer services -> interface endpoint.
37. Quick encrypted hybrid link -> Site-to-Site VPN.
38. Predictable dedicated hybrid bandwidth -> Direct Connect.
39. Many VPCs over DX -> transit VIF -> DX gateway -> TGW.
40. Public AWS service prefixes over DX -> public VIF.
41. On-premises DNS must resolve AWS private names -> Resolver inbound endpoint.
42. AWS workloads must resolve on-premises names -> Resolver outbound endpoint + rule.
43. Need fixed global IPs and fast TCP/UDP failover -> Global Accelerator.
44. Need DNS policy routing/failover -> Route 53.
45. Need HTTP caching and edge delivery -> CloudFront.
46. Need metadata about accepted/rejected flows -> VPC Flow Logs.
47. Need static proof of one path -> Reachability Analyzer.
48. Need search for unintended access paths at scale -> Network Access Analyzer.
49. Need packet payloads -> Traffic Mirroring.

## 6.4 Reliability and cost

50. RTO/RPO are loose and cost dominates -> backup and restore.
51. Core data/services must be ready, compute can be created -> pilot light.
52. Full stack must exist at reduced capacity -> warm standby.
53. Near-immediate failover and cost/complexity are acceptable -> active-active.
54. Need protection against workload-account compromise -> cross-account backups.
55. Need protection against Region loss -> cross-Region copies/replication.
56. Need immutable retention -> Backup Vault Lock compliance mode, after testing policy and grace-period implications.
57. Need server-level replication/recovery from on premises or another environment -> Elastic Disaster Recovery.
58. Need an interactive current cost view -> Cost Explorer; detailed SQL-grade data -> CUR.
59. Need alerts against planned limits -> Budgets; unusual-spend detection -> Cost Anomaly Detection.
60. Need stable discount without capacity guarantee -> Savings Plans/Regional RI.
61. Need AZ capacity assurance -> Capacity Reservation or zonal RI.
62. Need interruptible cheap compute -> Spot, only if the workload tolerates interruption.
63. Need cost allocation by business semantics -> activated tags + Cost Categories.
64. Need rightsizing evidence -> Compute Optimizer.

# 7. Minimal mastery checklist

You are ready to move from study mode to closed-book questions when you can answer all of these without notes:

1. Why is an AWS account a stronger boundary than a VPC?
2. Why should the management account contain almost no workloads?
3. What is the difference among Organizations, Control Tower, an OU, and Account Factory?
4. Why can an SCP block an administrator policy but never grant a permission?
5. How do SCPs and RCPs differ?
6. How do trusted access and delegated administration differ?
7. When do StackSets and Service Catalog solve different problems?
8. What are the four steps required for a cross-account role to perform an action?
9. Why does third-party role access use an ExternalId?
10. Why does cross-account KMS use require two policy sides?
11. What is the exact difference among security groups, NACLs, WAF, Network Firewall, Shield, and Firewall Manager?
12. What does CloudTrail know that Config does not, and vice versa?
13. Why is VPC peering non-transitive, and when does its mesh become unmanageable?
14. How do TGW association and propagation determine reachability and segmentation?
15. Why can PrivateLink support overlapping CIDRs?
16. Which Direct Connect VIF is used for VPCs, TGW, and public AWS endpoints?
17. Why is one Direct Connect circuit not a resilient architecture?
18. Which Resolver endpoint direction is used for each hybrid DNS flow?
19. What do `enableDnsSupport` and `enableDnsHostnames` separately control?
20. Which tool gives flow metadata, static path analysis, unintended-path analysis, and packet payloads?
21. What are RTO and RPO, and how do they constrain DR strategy?
22. What distinguishes pilot light from warm standby?
23. Why are replication and backups not substitutes?
24. Why must backups be tested by restore?
25. What is the difference among On-Demand, Spot, Savings Plans, RIs, and Capacity Reservations?
26. Why must cost allocation tags be activated?
27. Which cost tool is the detailed dataset, interactive explorer, threshold monitor, anomaly detector, and rightsizing engine?
28. How can NAT/data-transfer topology dominate the apparent compute savings of an architecture?

# 8. Source map

## Uploaded basis

**[TD]** Tutorials Dojo, *AWS Certified Solutions Architect Professional Study Guide and Cheat Sheets*, Domain 1 excerpt, pages 40-58. Used for the chapter's original framing of landing zones, Organizations, SCPs, cross-account roles, StackSets/Service Catalog, multi-VPC connectivity, Direct Connect/VPN, and DNS. Current AWS documentation overrides the stale items listed at the beginning of these notes.

## Current official AWS references

- **[AWS-EXAM]** *AWS Certified Solutions Architect - Professional (SAP-C02) Exam Guide*: Domain 1 tasks, 26% weighting, and non-exhaustive scope.
- **[AWS-ORG]** *AWS Organizations User Guide*: Organizations, management/member accounts, OUs, trusted access, delegated administrators, SCPs, RCPs, and policy inheritance.
- **[AWS-CT]** *AWS Control Tower User Guide and Control Reference*: landing zones, Account Factory, baselines, preventive/detective/proactive controls.
- **[AWS-IAM]** *IAM User Guide*: policy evaluation, cross-account roles, resource policies, permissions boundaries, federation, and confused-deputy prevention.
- **[AWS-SSO]** *IAM Identity Center User Guide*: permission sets, external identity providers, SAML, and SCIM.
- **[AWS-KMS]** *KMS Developer Guide*: key policies, cross-account use, grants, and multi-Region keys.
- **[AWS-CFN]** *CloudFormation User Guide*: StackSets and Organizations trusted access.
- **[AWS-SC]** *AWS Service Catalog Administrator Guide*: portfolios, products, constraints, and sharing.
- **[AWS-RAM]** *AWS RAM User Guide*: organization resource sharing and VPC sharing.
- **[AWS-VPC]** *Amazon VPC User Guide*: VPCs, subnets, route tables, endpoints, security groups, NACLs, DNS attributes, DHCP options, peering, Flow Logs, and network analyzers.
- **[AWS-TGW]** *AWS Transit Gateway Guide*: attachments, route-table association/propagation, peering, and security-group references.
- **[AWS-DX]** *AWS Direct Connect User Guide*: VIF types, DX gateways, TGW associations, routing, encryption, and resiliency.
- **[AWS-R53]** *Route 53 Developer Guide*: private hosted zones, Resolver endpoints/rules, health checks, and routing policies.
- **[AWS-SEC]** Official guides for CloudTrail, Config, GuardDuty, Security Hub CSPM, Inspector, Macie, Network Firewall, WAF, Shield, and Firewall Manager.
- **[AWS-DR]** *AWS Well-Architected Reliability Pillar*, *Disaster Recovery of Workloads on AWS*, *AWS Backup Developer Guide*, and *Elastic Disaster Recovery User Guide*.
- **[AWS-COST]** *AWS Billing and Cost Management*, *Savings Plans*, and *EC2 User Guide*: consolidated billing, allocation, cost tools, purchasing options, and capacity reservations.

