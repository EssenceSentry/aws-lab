# AWS service decision guide
## The answer-changing details in your 391-question bank

**Scope:** `questions.jsonl`, all 391 questions. **AWS documentation checks:** September 13, 2026.

This is a reference for choosing between plausible answers, not a general AWS introduction or a reproduction of the answer key. Repeated scenarios are consolidated. Each service has only the capabilities, limitations, and configuration details that matter to this bank. **Q-numbers are question IDs from Q001 to Q391**. They stay with each question when practice order is shuffled. The separate [question index](aws_question_index.md) maps every question to the relevant sections and its decisive distinction.

**Important:** Some supplied answers are outdated, internally inconsistent, or omit a necessary implementation step. A **Bank caution** identifies these rather than teaching the incorrect statement as a rule. The selected AWS references at the end support the particularly subtle or time-sensitive distinctions; question references identify the source scenarios.

### Contents

[0. Decision method](#decision) · [1. Identity and authorization](#identity) · [2. Governance and cost](#governance) · [3. Networking and DNS](#network) · [4. Edge delivery and APIs](#edge) · [5. Compute and scaling](#compute) · [6. Storage and file transfer](#storage) · [7. Databases and caching](#database) · [8. Messaging and workflows](#messaging) · [9. Analytics and search](#analytics) · [10. Operations and security](#operations) · [11. Deployment and infrastructure as code](#deployment) · [12. Migration and disaster recovery](#migration) · [13. AI, IoT, and end-user services](#specialized) · [14. Recognition-only alternatives](#alternatives) · [15. Corrections to remember](#corrections) · [Sources](#sources)

---

<a id="decision"></a>
## 0. The decision method that applies across services

**First eliminate answers that violate a hard constraint; only then optimize cost or operational effort.** A cheap design that cannot preserve the protocol, finish within the time window, or meet the recovery requirement is not a candidate.

| Wording in the question | What must actually change |
|---|---|
| “Read-heavy database,” “reporting slows production” | Add read replicas, cache repeated reads, or precompute reports. A traditional Multi-AZ standby does not add read capacity. |
| “Too many database connections” | Pool/reuse connections, often with RDS Proxy. This is different from expensive SQL or insufficient write capacity. |
| “Bursty writes,” “do not lose requests,” “eventual processing is acceptable” | Put SQS or an appropriate stream before the consumer; scale consumers and database throughput separately. |
| “Every independent application must receive every event” | Fan out to a separate queue per application. Multiple consumers of one queue compete for messages. |
| “No public internet,” “only from this VPC” | Establish private connectivity **and** enforce endpoint/resource/IAM policies. A private route alone is not authorization. |
| “Prevent,” rather than “detect and remediate” | Use a preventive control such as IAM/SCP or S3 Block Public Access. Config plus Lambda runs after the change. |
| “Least operational overhead” | Prefer the managed service that preserves the requirements. “Fewest code changes” can favor rehosting instead. |
| “Lowest cost” | Right-size first; commit only to the reliable baseline; use interruption-tolerant capacity for eligible bursts. |
| “Improve global performance without migrating yet” | CloudFront can use the existing on-premises HTTP server as an origin. |
| “Immediately available archive” | Choose an instant-access storage class, not one requiring a restore job. |

**Availability is not capacity.** With three equally loaded AZs, losing one multiplies utilization in the surviving two by `3/2`. Starting at 90% becomes 135% unless spare capacity or rapid replacement exists. Multi-AZ placement alone does not solve this. Likewise, sticky sessions are routing affinity, not replicated session state. *Examples: Q083, Q213, Q102.*

**RPO is acceptable data loss; RTO is acceptable restoration time.** Backup frequency constrains RPO; restore/provision/promote/reroute time constrains RTO. An hourly full backup plus recoverable five-minute transaction logs can support a much tighter RPO than hourly, but only if those logs reach the recovery location. Targets in a scenario are not AWS guarantees. *Examples: Q048, Q229, Q363.*

<a id="identity"></a>
## 1. Identity, federation, and authorization

### IAM — permissions, trust, and credentials are separate

| Mechanism | Exact role in the answer |
|---|---|
| Identity policy | What a user or role may do. |
| Role trust policy | **Who may assume** the role, and under which conditions. Trust is not the role's S3/DynamoDB permissions. |
| Resource policy | Who may access a particular bucket, key, queue, repository, or other supported resource. |
| Permissions boundary / SCP | Maximum permitted scope; neither creates permissions by itself. |
| EC2 instance profile | The container through which an IAM role is attached to EC2. SDKs obtain rotating temporary credentials through instance metadata. |
| Explicit deny | Overrides applicable allows. Removing one allow is insufficient if another applicable policy still grants the action. |

For EC2 accessing S3 or DynamoDB, use an **instance role**, not an access key in user data, an AMI, a file, or a template. For account B's EC2 to use account A's role: A's role trusts B's specific source role; B's role is allowed `sts:AssumeRole`; A's role has the target resource permissions. You do not attach an account-A instance profile directly to account-B EC2. *Q107, Q116, Q130, Q227, Q365.*

For external auditing, put the limited audit role **in each account being audited** and trust the auditor's account/role. Consolidated billing does not establish that trust. A read-only IAM user is a historical answer in one question, but a federated/cross-account role avoids distributing persistent credentials. *Q008, Q122, Q123, Q181.*

**`PowerUserAccess` versus `AdministratorAccess`:** PowerUserAccess broadly allows workload services while excluding most IAM, Organizations, and account administration, with specific exceptions such as `organizations:DescribeOrganization`. It fits Q188's broad developer role better than AdministratorAccess among the choices, but is not application-specific least privilege. Its `Allow` with `NotAction` is **not an explicit deny** of excluded actions; another policy can still grant them. [Current policy](#src-poweruser).

### STS — choose the API by the identity presented

| Identity presented | API / pattern |
|---|---|
| Existing AWS identity switching to another role | `AssumeRole` |
| SAML assertion from a corporate IdP | `AssumeRoleWithSAML`: `RoleArn`, `PrincipalArn` of the SAML provider, and `SAMLAssertion` |
| OIDC token from a web identity provider or GitHub Actions | `AssumeRoleWithWebIdentity` |
| Legacy LDAP application with no compatible federation endpoint | Authenticate through a trusted broker, then issue scoped temporary AWS credentials; LDAP is not itself an STS token format. |

The role's trust policy must use the corresponding federated principal and action. For GitHub OIDC, restrict token **audience and subject**, including the intended repository/branch/environment; creating a provider without restricting claims is insufficient. For third-party `AssumeRole`, the **vendor supplies a customer-specific ExternalId**, and the customer's trust policy checks `sts:ExternalId`. It addresses the confused-deputy problem; it is not a password. *Q053, Q084, Q139, Q191, Q220, Q370.*

### IAM Identity Center, Directory Service, and Cognito

**IAM Identity Center:** workforce SSO across AWS accounts and supported business applications. Use permission sets and group/account assignments, not one IAM user in every account. An external SAML IdP handles authentication; **SCIM handles user/group provisioning**, which is a different operation. ABAC can carry user attributes as principal/session tags. *Q013, Q212, Q223, Q329.*

**AWS Managed Microsoft AD:** an actual managed directory. When Identity Center uses it to reach a self-managed AD, the trust must be **two-way**, not one-way: authentication and user/group metadata synchronization both matter. **AD Connector:** a proxy to an existing directory, not a new managed AD forest; Identity Center through AD Connector sees the attached domain, not arbitrary trusted forests. *Q223, Q225; [AD integration](#src-identityad).*

**Client VPN with directory MFA:** MFA can be enabled for **either AWS Managed Microsoft AD or AD Connector**. Do not treat AD Connector as an obligatory extra layer when the existing Managed AD integration already meets the need. All Client VPN authentication modes still require a server certificate in ACM; authentication does not replace authorization rules and routes. *Q349; [VPN directory authentication](#src-vpnad), [VPN authentication requirements](#src-vpnauth).*

**Cognito user pools authenticate application users** and issue tokens; **identity pools exchange supported identities for temporary AWS credentials**. User-pool tokens can authorize an API without giving the client direct AWS credentials. Identity-pool/STS credentials can instead permit direct, tightly scoped S3 or DynamoDB access. Customer identity is not the same requirement as employee AWS-account SSO. *Q022, Q044, Q099, Q224.*

### Policy details worth memorizing

| Need | Relevant detail |
|---|---|
| User-specific S3 folder | Match object ARN prefix to a trusted principal/session attribute, such as `${aws:PrincipalTag/userId}`. Separately restrict `s3:ListBucket` with `s3:prefix`. |
| List, upload, download | `ListBucket` is bucket-level; `PutObject` and `GetObject` are object-level. List/upload permission does **not** authorize a presigned download. |
| TLS-only S3 | Explicit deny with `aws:SecureTransport` equal to `false`; choose scope/exceptions carefully for AWS service calls. |
| Approved VPC endpoint | `aws:SourceVpce`; for a VPC, `aws:SourceVpc`; endpoint-originating IP conditions use `aws:VpcSourceIp`, not `aws:SourceIp`. |
| Resource access by organization | `aws:PrincipalOrgID`, on a supported resource policy. This does not remove the caller's permission requirements. |
| Protect production resources | Resource tags can scope the deny, but also prevent unauthorized changes/removal of the protective tags. |

**Cross-account S3 + SSE-KMS requires all three pieces:** bucket permission, KMS key policy permitting the external role, and the caller's identity policy permitting S3 reads and `kms:Decrypt`. Use a customer-managed KMS key for controllable cross-account sharing. Encrypting the object does not by itself restrict which authorized principals can decrypt it. *Q221; [S3/KMS reference](#src-s3kms).*

**Tag-policy trap:** `ForAllValues:StringEquals` on `aws:TagKeys` checks the submitted keys; it does not prove that every required tag was submitted. It can also match an absent set. Require each necessary `aws:RequestTag/<key>` explicitly, validate its value, and account for missing keys with `Null`. A condition requiring a key to exist still does not necessarily prohibit an empty string. *Q192, Q379; [IAM set operators](#src-tagsets).*

<a id="governance"></a>
## 2. Organization governance, sharing, and cost

### Organizations and SCPs

SCPs bound permissions in **member accounts, including member-account root users**. They do not restrict the management account or service-linked roles. An allowed action must survive every level of the root → OU → account path, and still needs an IAM/resource-policy grant. *Q173, Q190, Q269; [SCP reference](#src-scp).*

An OU allow cannot override a root-level explicit deny. For temporary onboarding exceptions, restructure the restrictive policy's attachment or its conditions: for example, put restrictions on the production OU and place new accounts in a separate onboarding OU before moving them. Do not answer “add a more permissive policy beneath the deny.” *Q042.*

For exceptions such as “only the supervisor may administer IAM,” scope the deny using the appropriate principal condition, often `aws:PrincipalArn`. For immutable security-group rules, blocking only `AuthorizeSecurityGroupIngress` is incomplete: also consider revoke, modify, delete, and tag-alteration paths. *Q359, Q334.*

**Created account versus invited account:** Organizations can create `OrganizationAccountAccessRole` as part of account creation; inviting an existing account does not automatically create it. Establish the cross-account role yourself where needed. *Q278.*

### Which governance service?

| Service | Choose it for | Do not confuse it with |
|---|---|---|
| Control Tower | A governed multi-account landing zone, account provisioning, and controls. | A permission grant or an application deployment pipeline. Precise arbitrary restrictions are implemented through the appropriate policy/control mechanism. |
| Resource Access Manager (RAM) | Share supported resources with accounts/OUs/organizations without copying them. Enable organization sharing/trusted access when required. | General-purpose IAM permission management or automatic network routing. |
| Service Catalog | Approved self-service products, versions, parameters, and launch constraints. | Unrestricted CloudFormation access for every requester. |
| AWS Config | Evaluate resource compliance and configuration history; aggregate findings across accounts. | Preventing the initial API call. |
| Tag policies | Standardize allowed tag spelling/case/values, with enforcement where supported. | Universal proof that every resource has all required tags. |
| SCP using request tags | Prevent supported create operations without required tags. | Retroactively tagging existing resources. |
| Resource Groups / Tag Editor | Find and bulk-tag existing resources. | Activating tags for billing reports. |

For **Service Catalog launch constraints**, a designated launch role provisions the product; the user needs permission to use the product, not broad permission to create every underlying resource. Useful for standardized encrypted SageMaker notebooks with small/medium parameter choices and a notebook URL in stack outputs. Tags must reach the intended underlying resources; not every service propagates stack/product tags identically. *Q186, Q207, Q255.*

For **shared VPC subnets**, the VPC owner controls networking and shares eligible subnets through RAM; participants create permitted resources in those subnets. The owner need not be the Organizations management account. For **shared transit gateways**, auto-accept is a setting on the owner's TGW, not a setting the participant can arbitrarily enable. *Q327, Q354.*

### Cost tools and commitment choices

| Question asks for… | Service / decisive detail |
|---|---|
| Interactive historical cost investigation | **Cost Explorer**; account/service/tag filters. |
| Threshold or forecast alerts | **AWS Budgets**; define the account/cost scope explicitly. A budget is not a service quota. |
| Detailed billing dataset and custom dashboards | **Cost and Usage Report (CUR)** in S3 → Athena/QuickSight. For OU reporting, join account IDs to organization/OU membership; apply row-level security if viewers must see only their units. |
| Memory-aware right-sizing | **Compute Optimizer**, with CloudWatch agent memory metrics where needed. EC2 eligibility includes sufficient recent metric history; idle DR servers require capacity-aware judgment. |
| Broad best-practice and waste checks | **Trusted Advisor**, not a precise application performance profiler. |
| Utilization approaching a service limit | **Service Quotas + CloudWatch usage metrics**; e.g. `usage / SERVICE_QUOTA(usage) * 100`. Use the quota's real unit, such as vCPU, not an unrelated task count. |

User-defined cost allocation tags must be **activated for billing**, typically centrally in the management account, after resources are tagged. Tagging alone does not instantly create historical tagged billing data. Automated delivery of a report is a separate step from creating a saved Cost Explorer view. *Q087, Q249, Q330–Q331, Q346.*

**Commitment hierarchy:** stable EC2 family/Region → EC2 Instance Savings Plan; flexibility across EC2 families/Regions and eligible Fargate/Lambda usage → Compute Savings Plan; steady RDS → RDS Reserved Instances; MemoryDB → reserved nodes. DynamoDB reserved capacity applies to **provisioned** capacity, not on-demand requests. Reserve the baseline, not rare peaks. *Q012, Q031, Q164, Q386.*

RI discount sharing is controlled centrally within consolidated billing, with matching requirements and regional scope. Disabling sharing isolates the benefit; an RI in one Region does not discount another Region's usage. Savings Plans and regional RIs are pricing commitments, not promises that capacity will be available when disaster strikes; capacity reservations are a separate concern. *Q162, Q172.*

<a id="network"></a>
## 3. Networking, private connectivity, and DNS

### VPC, security groups, NACLs, and routes

| Component | Distinction tested |
|---|---|
| Security group | Stateful **allow** rules on supported resources/ENIs; no explicit deny. Referencing another SG is preferable to tracking changing application IPs. |
| Network ACL | Subnet-level, stateless, ordered allow/deny rules. Both directions, including response/ephemeral ports, must work. Useful for explicit IP/CIDR blocks. |
| Route table | Selects the next hop; does not authorize the destination API or application. Longest matching prefix wins. |
| Internet gateway | A route to the internet, but an IPv4 instance still needs a public address for direct public connectivity. |
| ENI | Network identity, including MAC/private IPs/security groups; tied to an AZ. Reusing an ENI can preserve a MAC-bound license within its placement constraints. |

**MAC-bound licensing and static configuration:** pre-license a pool of ENIs, store the corresponding license files in S3, and allocate a matching unused ENI/license at launch in the correct AZ. Update database IP parameters separately, such as through Lambda → Parameter Store, and retrieve them during bootstrap rather than cloning stale IPs/licenses into every AMI. *Q004.*

For application → MySQL, allow application-SG egress to DB-SG TCP 3306 and DB-SG ingress from application-SG TCP 3306; stateful return traffic is implicit. A custom NACL may still block it. For a UDP NLB, do not blindly deny every TCP packet: target health checks may use TCP/HTTP/HTTPS. *Q135, Q259, Q292.*

**VPC peering is non-transitive and cannot connect overlapping VPC CIDRs.** A nonoverlapping hub can separately peer with two spokes whose CIDRs overlap each other, but cannot uniquely address the same IP in both at once. In Q064, a `/32` route for `10.0.0.77` to one peer beats a `/16` route to the other; return routes are still necessary.

### NAT and VPC endpoints

**The bank's zonal public NAT gateway pattern:** public NAT gateway + Elastic IP in a public subnet with an internet-gateway route; private-subnet `0.0.0.0/0` points to that NAT. Use a same-AZ NAT path in each AZ for the bank's high-availability design. A NAT instance needs patching, scaling, and failover management. A NAT gateway does not accept security groups. *Q005, Q025, Q060; [NAT comparison](#src-nat).*

**Timeout is not simply capacity:** the NAT instance/gateway comparison distinguishes FIN and RST behavior. A long idle connection may need keepalives or reconnect/retry handling; replacing the NAT instance does not preserve every indefinitely idle session. *Q093.*

| Endpoint | How to recognize the correct answer |
|---|---|
| S3/DynamoDB **gateway endpoint** | Route-table target; no NAT needed for the supported regional service traffic; no endpoint SG. Appropriate for the bank's same-Region S3 NAT-cost problem. |
| **Interface endpoint / PrivateLink** | Private ENIs with security groups and DNS configuration; for supported AWS APIs and private endpoint services. Endpoint policy support depends on the service. |
| **Gateway Load Balancer endpoint** | Inserts a network-appliance inspection service into the route path. Not the same thing as an S3 gateway endpoint. |

A gateway endpoint is not a transitive gateway for on-premises or peered-VPC clients. Use supported interface endpoints/private DNS for those access patterns. Restricting the endpoint policy to a bucket does not prevent someone accessing that bucket through another path; enforce the bucket's allowed endpoint/principal too. *Q006, Q246, Q374, Q375; [S3 endpoint reference](#src-endpoint).*

**Private Fargate image pull:** either provide NAT connectivity, or the required private endpoints—typically ECR `api`, ECR `dkr`, and S3 access for image layers, plus Logs/Secrets Manager endpoints as used. “An ECR gateway endpoint” is the wrong endpoint type. Putting VPC-connected Lambda in a public subnet does not give it a public IP; it still needs NAT or endpoints for destinations outside the VPC. *Q025, Q246.*

### Transit Gateway, PrivateLink, and inspection

**Transit Gateway (TGW)** is the routed hub for many VPCs and hybrid attachments. An attachment associates with **one TGW route table** but can propagate routes to multiple tables. Separate production/development route tables and control propagation to preserve isolation; a default full mesh defeats that objective. Sharing a TGW through RAM does not complete all the routes. *Q061, Q256.*

**PrivateLink exposes a service, not unrestricted access to an entire VPC.** For a central service, publish an NLB-backed endpoint service. An NLB can use eligible on-premises IP targets reachable through Direct Connect/VPN, allowing private service consumption without routing every consumer into the full on-premises network. NLB security groups, target security groups, endpoint security groups, NACLs, and health checks still need to agree. *Q046, Q367.*

**NLB/PrivateLink rule detail — Q046:** target SGs can allow the **NLB's SG**, including the target and health-check ports. If NLB inbound rules apply to PrivateLink traffic, the source is the **client's private IP, not the endpoint interface IP**; allowing only the endpoint subnet is not a general solution. This enforcement can be disabled for PrivateLink traffic. Associate an SG when creating the NLB: an NLB created without any cannot have its first SG added later. NLB health checks obey its outbound, not inbound, rules. [NLB security groups](#src-nlbsg).

**Network Firewall** supplies managed network inspection. **Gateway Load Balancer (GWLB)** distributes traffic through third-party appliances using GENEVE on UDP 6081. **Firewall Manager** centrally manages supported security policies across accounts. Centralized inspection requires correct forward **and return** routes and stateful-flow symmetry; a spoke usually routes to TGW, not directly to a remote VPC's firewall endpoint. Use multi-AZ appliances/endpoints for resilience. *Q016, Q061, Q355, Q389.*

A destination URL/domain allowlist requires an appropriate proxy or domain-aware firewall; SGs and NACLs cannot match arbitrary URLs. Remove bypass routes. TLS inspection requirements and encrypted DNS can affect what the firewall can actually observe. *Q182.*

### Direct Connect and VPN

| Requirement | Correct distinction |
|---|---|
| Predictable private hybrid link | Direct Connect; the connection is **not encrypted merely because it is private**. |
| Internet-based encrypted network-to-network link | Site-to-Site VPN. |
| Remote employee's laptop into private applications | Client VPN, with authentication, authorization rules, and destination routes. |
| Access a VPC through DX | Private VIF → VGW, or appropriate DX gateway association. |
| Connect DX to Transit Gateway | Transit VIF → Direct Connect gateway → TGW. |
| Access AWS public IP services through DX | Public VIF; “public” here describes addressed services, not traversal of the public internet. |
| Several VPCs/Regions from DX | Direct Connect gateway associations. It does not automatically enable all VPC-to-VPC transit. |
| Low-cost backup for one DX connection | VPN, accepting its different bandwidth/latency characteristics. |
| Remove on-premises device/location failure | Separate customer devices and preferably separate sites/paths; a VPN's two tunnels do not remove one customer gateway's failure. |

DX uses BGP; BGP authentication and allowed/advertised prefixes matter. For TGW associations, configured allowed prefixes determine advertised network reachability; do not treat them as a universal fine-grained traffic firewall. The public-VIF-plus-IPsec-VPN design encrypts the DX path; private-IP VPN designs also exist but require the matching supported topology. *Q068, Q103, Q138, Q165, Q197, Q231, Q243.*

**Allowed-prefix distinction — Q356:** a **VGW association filters VPC CIDRs**: its allowed prefix must cover the VPC CIDR for that CIDR to be advertised. A **TGW association advertises exactly the configured allowed prefixes**, even a smaller or unrelated prefix. Choose prefixes that cover the destinations you intend to reach; do not generalize the bank's “same or wider” wording into a TGW eligibility rule. Allowed prefixes cannot overlap across multiple TGW associations on one DX gateway. [Prefix behavior](#src-dxprefix).

**Current compatibility note:** transit VIFs support dedicated or hosted DX connections **of any speed**; Q356's 200 Mbps connection is not automatically invalid. Bandwidth must still meet the workload. [DX reference](#src-dx).

### Route 53 and hybrid DNS

**Routing policies:** latency = lowest measured network latency; geolocation = geographic location/policy; weighted = controlled distribution; failover = active/passive. Multivalue answers return healthy records but are not a substitute for a managed load balancer. Country-based DNS answers are not strong access control. *Q007, Q150, Q358.*

Use **alias** records for an ELB/CloudFront target, including a zone apex; a conventional CNAME cannot be the zone-apex record. For ELB aliases, **EvaluateTargetHealth** lets DNS routing use the load balancer's health. DNS changes affect new resolutions; they do not migrate live connections or promote a database. *Q125, Q185, Q262, Q319.*

For private names, associate the **private hosted zone** with the VPC and enable `enableDnsSupport` and `enableDnsHostnames`. An A record holds an IP; a CNAME holds another DNS name. Cross-account association: zone owner calls `CreateVPCAssociationAuthorization`; VPC owner calls `AssociateVPCWithHostedZone`. Deleting the authorization afterward does not delete the association. **VPC peering is not a prerequisite for the DNS association itself.** *Q024, Q036, Q283, Q381.*

**Resolver outbound endpoint:** AWS → on-premises DNS, using forwarding rules for domains such as the AD namespace. **Inbound endpoint:** on-premises → AWS Resolver/private zones. Retain AmazonProvidedDNS where AWS private endpoint resolution depends on it; forward selected corporate domains instead of replacing all resolution with an unaware on-premises server. *Q199.*

**DNSSEC signing** authenticates your authoritative zone's responses; **Resolver DNSSEC validation** verifies signed responses received by the resolver. Neither encrypts HTTP traffic. For Q001, protect the public zone with signing and protect application traffic separately with TLS. [DNSSEC reference](#src-dnssec).

<a id="edge"></a>
## 4. Edge delivery, load balancing, and APIs

### CloudFront — delivery, caching, and origin protection

CloudFront caches HTTP(S) content near users and can front S3, ALB, or an existing on-premises HTTP origin. Moving the origin into AWS is not a prerequisite. Precompute a daily report on a read replica, publish it to S3, and cache it for the tolerated freshness interval rather than execute SQL for every download. *Q017, Q055, Q203, Q238, Q276.*

**Cache behavior is selected by path and points to an origin.** To move `/static/*` from ALB to S3, add both an S3 origin and the matching behavior; leave dynamic paths on ALB. Uploading files to S3 without changing routing leaves requests hitting the old server. Cache only reusable output; personalized/authenticated responses need appropriate cache keys or bypass. *Q318.*

**Cache-key nuances:** include the query parameters, cookies, and headers that really change the response; exclude irrelevant variability. Normalize query ordering or case **before lookup**, but lowercase values only when application semantics are case-insensitive. Device-specific responses must vary by the selected device classification. TTL/`Cache-Control: max-age` trades freshness for hit rate; invalidate or version objects when appropriate. *Q272–Q273, Q274, Q380.*

| Mechanism | What it protects / changes |
|---|---|
| OAC | CloudFront → private S3 origin access. Use the CloudFront service principal and restrict the bucket grant to the distribution's `AWS:SourceArn`; add KMS permission for SSE-KMS objects. |
| CloudFront signed URL/cookie | Viewer → CloudFront authorization for restricted content. OAC alone does not make viewer access private. |
| S3 presigned URL | Time-limited direct S3 operation using the signer's permissions. It does not use CloudFront caching. |
| CloudFront geo restriction | Country-level viewer restriction. Route 53 geolocation is routing, not the equivalent access control. |
| Custom origin header | A secret header CloudFront adds for origin validation, for example by ALB/WAF; complement it with TLS and origin-access restrictions. |
| Field-level encryption | Encrypt selected sensitive request fields with a public key so only the downstream private-key holder can read them. Separate from HTTPS and unrelated to caching confidential form submissions. |

**Critical origin distinction:** OAC/OAI works with an S3 **REST bucket origin**, not an S3 **website endpoint**. A website endpoint is a custom origin and cannot use OAC/OAI. OAC is not the old OAI-style “special IAM user.” Choose a private bucket + REST origin + OAC for the bank's protected static content. *Q275, Q314–Q317, Q326; [OAC reference](#src-oac).*

Signed URLs are **bearer access**: another person who possesses a valid URL can generally use it, subject to its conditions. They do not inherently enforce “the same logged-in customer only.” A presigned URL cannot outlive the temporary credentials that signed it; also check method, signature, expiry, and actual `GetObject` permission. *Q126, Q290, Q316; [S3 presigned URLs](#src-presigned).*

**Custom error response ≠ origin failover.** An error response can serve an S3 error page for an ALB 502. An origin group can retry an eligible request against a secondary origin. CloudFront origin failover applies to **GET, HEAD, OPTIONS**, not POST/PUT: it is not transparent failover for a login POST. *Q271, Q326; [origin failover](#src-cffailover).*

### CloudFront Functions versus Lambda@Edge

**CloudFront Functions** fits lightweight viewer-request/response work: normalization, redirects, simple header/token logic. **Lambda@Edge** fits more capable request processing and origin events. Do not select the more expensive/heavier mechanism merely to sort query parameters. Check runtime restrictions before proposing libraries, network calls, or request-body inspection in Functions. Authentication means verifying a token's signature and claims, not merely decoding it. Neither runtime is an automatic load-aware scheduler. *Q271, Q273, Q274, Q361, Q380; [Functions restrictions](#src-cffunctions).*

For geographic origin selection on **cache misses**, regional S3 replicas plus origin-request Lambda@Edge logic can select a nearby origin; edge caching already serves cache hits locally. Replication and routing are separate steps. Q295's literal `eu-east-1` is invalid: retain the intended pattern, not that identifier.

### TLS: ACM, ALB, CloudFront, and CloudHSM

| Connection / requirement | Exact configuration |
|---|---|
| Viewer → custom CloudFront domain | ACM certificate in **`us-east-1`**, covering every alternate hostname. |
| CloudFront → ALB | Valid origin certificate on the ALB **in the ALB's Region**; matching hostname; origin policy requiring HTTPS. |
| Viewer HTTP → HTTPS | Viewer protocol policy: redirect HTTP to HTTPS, or HTTPS-only. This does not independently force origin HTTPS. |
| Default `*.cloudfront.net` hostname | CloudFront's default certificate; no custom-domain certificate needed. |
| Multiple domains on an ALB listener | Multiple certificates selected using **SNI: Server Name Indication**. |
| Security team owns TLS material, app operators must not read it | Terminate TLS at the managed load balancer and separate certificate permissions from EC2 administration. |
| Private key must remain in a customer-controlled HSM | CloudHSM-backed TLS on the application tier; TCP pass-through load balancing; HSMs across AZs for resilience. |

A normal CloudFront distribution has one attached viewer certificate, which must cover its names. **Dedicated-IP SSL does not allow arbitrary unrelated certificates/names on that distribution**; it addresses clients that cannot use SNI. Q071's suggested workaround is not a valid rule. Integrated non-exportable ACM public certificates and exportable certificate offerings also have different cost/key-handling properties; do not memorize “all ACM certificates are free and never exportable.” *Q023, Q039, Q056, Q057, Q071, Q082, Q108; [TLS requirements](#src-cftls), [certificate limits](#src-cflimits), [ACM exportable certificates](#src-acmexport).*

### ALB, NLB, Global Accelerator, and API services

| Service | Decisive capability |
|---|---|
| ALB | HTTP(S), host/path routing, HTTP WebSockets, application-layer rules and authentication integrations. Enable every target AZ intended to receive traffic. |
| NLB | TCP/UDP/TLS transport, static per-AZ addressing, raw protocols, TCP pass-through, and PrivateLink service patterns. |
| Global Accelerator | Stable anycast IPs and AWS-network routing to healthy regional endpoints; useful for global TCP/UDP or uncached traffic. **Not a CDN cache.** |
| API Gateway REST API | Managed API methods, authorization, throttling, integrations, optional caching; WAF can protect the supported REST API stage. |
| API Gateway WebSocket API | Bidirectional connections; backend sends to clients through the management API's `@connections`. |
| AppSync | Managed GraphQL and subscriptions for real-time application updates. Do not confuse its subscriptions with API Gateway's `@connections` API. |
| Lambda Function URL | Simple direct HTTP endpoint when API Gateway's richer features are unnecessary. Use AWS_IAM or NONE as appropriate; validate a third-party webhook's signature in the application. |

**AWS_IAM API authorization** requires permission such as `execute-api:Invoke` and a SigV4-signed request. CORS controls browser behavior; API keys identify/meter consumers; neither replaces authentication. Use X-Ray for request tracing, not CORS or a manually passed secret. *Q002, Q010, Q115, Q167, Q335.*

**Bank caution — Q390:** ALB also supports WebSockets on configurable HTTP(S) listener ports. NLB is clearly required for raw transport/UDP or its addressing characteristics, not solely because “WebSockets use ports 5000 and 8080.”

<a id="compute"></a>
## 5. Compute, containers, and scaling

### EC2 and Auto Scaling

An **Auto Scaling group (ASG)** replaces unhealthy instances and adjusts desired capacity; a load balancer distributes traffic; the launch template describes new instances. These are different responsibilities. Put the group in multiple AZs, with all relevant AZs enabled on the load balancer. An ASG is regional, not one group spanning Regions. *Q037, Q051, Q105, Q127.*

| Problem | Answer-changing action |
|---|---|
| Every new instance spends 15 minutes installing the same framework | Bake the framework into an AMI; keep only changing configuration in bootstrap. |
| Boot downloads 500 GB of common content | Put shared content on a suitable shared file system, such as EFS; do not repeatedly download it onto disposable instances. |
| Daily OS image refresh but frequent application releases | Image/patch pipeline for the AMI; CodeDeploy for application versions. |
| Updated AMI in a launch template | Replace existing instances using a rolling update/instance refresh. A new template version alone does not change already running machines. |
| Scale down one instance below a threshold | Step/simple scaling configured with the required adjustment, not an unrelated schedule. |
| Predictable release-day spike | Scheduled scaling before demand; reactive scaling may arrive too late. |
| Need evidence from an unhealthy instance before replacement | Suspend the relevant termination process temporarily for investigation, or use a termination lifecycle hook for log collection. Resume normal protection afterward. |
| Underlying EC2 host fails, preserve instance identity | Supported EC2 recovery on `StatusCheckFailed_System`; not an application repair script or an ASG replacement. |
| Broken guest configuration / lost access | Systems Manager Automation/EC2Rescue, for example `AWSSupport-ExecuteEC2Rescue`. |

Health checks should not turn a shared dependency outage into a replacement storm. A DB-dependent health endpoint may mark every healthy web server unhealthy when the DB fails. Separate local liveness from dependency/end-to-end monitoring; use caching or graceful degradation where applicable. *Q041, Q066, Q117, Q119–Q120, Q261, Q264, Q287, Q297.*

A **termination lifecycle hook** pauses termination, invokes automation to collect logs, and then completes the lifecycle action. Run Command's `SendCommand` runs a **Command document**; `StartAutomationExecution` runs an **Automation runbook**. These APIs are not interchangeable. *Q328.*

### Placement and purchasing

**Cluster placement group:** tightly coupled, low-latency communication within one AZ; combine with **EFA** for suitable HPC communication and **FSx for Lustre** for high-throughput shared storage. This prioritizes performance, not multi-AZ resilience. A stopped eligible instance can be moved into a placement group and restarted; recreation is not always required. *Q074, Q100.*

**Spot:** use for retryable, checkpointable, interruption-tolerant work. Diversify instance types and AZs, keep persistent data in S3 or durable shared storage, and drain ECS instances where appropriate. Do not put irreplaceable local state or the only essential service instance on Spot merely because the workload is busy. An On-Demand baseline plus eligible Spot burst capacity is a pattern, not an availability guarantee. *Q031, Q156, Q168, Q213, Q233.*

### ECS, EKS, Fargate, ECR, and Batch

| Service / option | Use it when |
|---|---|
| ECS on EC2 | Managed container scheduling with control of host type, packing, capacity, and purchasing options. `binpack` can pack by memory/CPU for long-running jobs. |
| ECS on Fargate | Run containers without managing worker hosts; good for sporadic jobs longer than a Lambda invocation and independently scaling web services. |
| EKS | Kubernetes is actually required, including ecosystem/portability requirements. Kubernetes portability does not mean AWS Fargate runs in another cloud. |
| ECS Anywhere | ECS management for eligible external/on-premises hosts using the EXTERNAL capacity pattern; AWS Fargate remains AWS-hosted. |
| ECR | Container image registry, not compute. Repository permissions and lifecycle rules control sharing and cleanup. |
| AWS Batch | Job queues, scheduling, dependencies/retries, and managed compute environments, including eligible Spot capacity. Not an online request load balancer. |

With ECS **`awsvpc`**, each task has its own ENI and task-level security groups; it is the networking mode used for Fargate. Splitting browsing and checkout into separate services allows independent scaling; routing alone does not remove their shared scaling boundary. *Q141, Q277, Q361.*

**Task role versus execution role:** application AWS API calls use the **task role**. Pulling images, delivering supported logs, and resolving a configured Secrets Manager secret at startup use the **task execution role**. Supply a secret through `containerDefinitions[].secrets[].valueFrom`, not by placing the password itself in ordinary environment configuration. Rotation does not refresh an already-running container's environment; redeploy or fetch dynamically. *Q144, Q242; [execution role](#src-executionrole), [secret injection](#src-ecssecrets).*

For ECR organization-wide pull access, use the appropriate repository policy with `aws:PrincipalOrgID`, and still permit `ecr:GetAuthorizationToken` through the caller's identity policy. To retain the latest five **untagged** images, select untagged images and a count-based lifecycle rule; do not expire tagged release images accidentally. *Q376.*

### Lambda

A **standard Lambda function invocation has a maximum of 900 seconds / 15 minutes**, even when packaged as a container image. A 40-minute encode or a two-hour job therefore belongs in a container/Batch/EC2 worker, unless it can genuinely be decomposed into shorter invocations. A Lambda function can launch `ECS RunTask` and finish immediately; it need not wait through the job. Longer-lived orchestration/durable constructs are not permission for one ordinary invocation to run forever. *Q111, Q200, Q342, Q364, Q368; [Lambda quotas](#src-lambda).*

**Reserved concurrency** both reserves a share and caps simultaneous execution. **Provisioned concurrency** pre-initializes environments to reduce cold-start latency. Neither increases a downstream DynamoDB table's WCU. Inspect `Throttles`/`TooManyRequests` separately from database throttling. *Q047, Q184.*

Reuse SDK/database clients outside the handler when safe. RDS Proxy can pool connections under fan-out; set consumer/concurrency limits consistent with downstream capacity. Lower memory can increase duration enough to increase cost; benchmark total GB-seconds and latency. Lowering a timeout below normal runtime causes failure, not an optimization. Compute Optimizer can recommend eligible Lambda memory settings and export recommendations to S3 for scheduled review. *Q284, Q339–Q340.*

For sparse five-minute processing, S3 events or SQS → Lambda → S3 eliminate idle workers. Make handlers idempotent: retries and duplicate event delivery remain possible. *Q304, Q371.*

<a id="storage"></a>
## 6. Object storage, block storage, file systems, and transfer

### S3 storage classes and lifecycle

| Class | The distinction the bank tests |
|---|---|
| S3 Standard | Frequent access; regional multi-AZ object storage. |
| S3 Standard-IA | Infrequent access **with immediate reads**; retrieval charges and a 30-day minimum storage duration. |
| S3 One Zone-IA | Infrequent, recreatable data where single-AZ storage is acceptable—not the only copy of irreplaceable regional data. |
| S3 Intelligent-Tiering | Unknown/changing access patterns; managed tiering, with optional archive tiers that have different access behavior. |
| S3 Glacier Instant Retrieval | Rarely read data that must still be retrieved immediately; a 90-day minimum duration. |
| S3 Glacier Flexible Retrieval | Restore required; retrieval time varies by expedited/standard/bulk mode; 90-day minimum duration. |
| S3 Glacier Deep Archive | Lowest-cost long-term archive with hours-scale restores; 180-day minimum duration. Bulk restore can take up to 48 hours, so it does not satisfy a universal “within 24 hours” condition. |

Do not select an archive solely by storage price: include restore delay, minimum duration, retrieval cost, and request/object-size economics. Transition old but immediately needed records to Standard-IA or Glacier Instant Retrieval, not automatically to a restore-required tier. Lifecycle expiration is not WORM retention enforcement; use Object Lock when immutability is required. *Q065, Q166, Q233, Q251; [storage classes](#src-storageclasses).*

**Versioning:** enabling it does not retroactively assign new IDs to old objects; an existing object's version ID remains `null`. Subsequent overwrites create versions. Versioning protects recoverability but does not prevent every permanent deletion; MFA Delete and Object Lock address different deletion/retention controls. *Q183, Q124.*

### S3 access, replication, and transfer

**Block Public Access** is the preventive answer to accidental public buckets/objects. Modern bucket-owner-enforced ownership disables ACLs; a historical `PutObjectAcl` → EventBridge → Lambda private-ACL remediation is not the first choice for a new bucket. Direct S3 website hosting is a different, public-origin pattern; custom-hostname bucket naming and apex/redirect configuration still matter. *Q091, Q137, Q303.*

**Access Points** provide application-specific access policies/endpoints. For network confinement, create a **VPC-origin access point** and restrict bucket use to the approved access point(s). Merely allowing an access-point ARN is insufficient if that access point allows internet-origin traffic. An SCP can deny `CreateAccessPoint` unless `s3:AccessPointNetworkOrigin` is `VPC`. *Q374, Q378.*

**Cross-Region Replication (CRR)** asynchronously copies eligible objects between versioned buckets. Configure role/policies, destination permissions, encryption handling, and the intended filters. Existing objects require the appropriate backfill/Batch Replication process; replication is not simply “all historical contents automatically copied.” *Q028, Q196.*

**S3 Replication Time Control (RTC)** targets **99.99% of new objects within 15 minutes**, backed by its SLA—not 100% synchronous replication. Filter the rule to the required prefix, such as master media rather than all derivatives. RTC missed-threshold events are tied to 15 minutes; a requested 30-minute alarm needs suitable metric/filter/automation logic. *Q302; [RTC](#src-rtc).*

**Transfer Acceleration** optimizes distant uploads/downloads through the S3 accelerate endpoint, e.g. `bucket.s3-accelerate.amazonaws.com`; it is not the same as CloudFront caching popular downloads. **Requester Pays** charges the authenticated requester for qualifying requests/data transfer, while the bucket owner pays storage; anonymous website access is not the model. **Storage Lens advanced metrics** provides a **15-month query window**, versus **14 days** for free metrics; this distinguishes the six-month analytics answer. Underlying retention and the query window are not identical concepts. *Q157, Q217, Q344–Q345; [Storage Lens](#src-storagelens).*

### S3 encryption, KMS, and CloudHSM

| Choice | Who controls the key / exact consequence |
|---|---|
| SSE-S3 | S3 manages keys. New uploads are encrypted by default. Per-object encryption plus protected data keys is envelope encryption, not “multi-factor encryption.” |
| SSE-KMS | KMS authorization/audit and customer-managed key controls where selected. S3 permissions and KMS permissions are separate. |
| SSE-C | The customer supplies the encryption key with each relevant request and retains responsibility for it. HTTPS is mandatory; S3 does not store the key for later retrieval. |
| Client-side encryption | Encrypt before uploading; readers must decrypt themselves. This changes compatibility with services expecting plaintext objects. |

For SSE-C, relevant headers include `x-amz-server-side-encryption-customer-algorithm` (`AES256`), `...-key`, and `...-key-MD5`. Do not transmit the key over HTTP or assume a URL alone supplies all required headers. **Current correction:** SSE-C is blocked by default for new buckets unless explicitly enabled. *Q058, Q069; [SSE-C](#src-ssec), [SSE-S3](#src-sses3).*

For “data lake queried by Redshift Spectrum, control key rotation, TLS only,” choose compatible SSE-KMS plus a bucket TLS policy, not SSE-C. Changing default encryption does not rewrite all old objects. *Q075.*

To import externally generated key material into KMS: create an `EXTERNAL`-origin key, obtain the import token/public wrapping key with `GetParametersForImport`, wrap the material, and import it. This is not the same as a CloudHSM custom key store. **Automatic rotation** applies to eligible AWS-generated symmetric KMS keys; current KMS also supports **on-demand rotation for eligible imported symmetric material**. Avoid the old blanket statement “imported keys cannot be rotated.” Rotation does not re-encrypt every stored object. *Q086; [KMS rotation](#src-kmsrotation).*

CloudHSM gives customer-controlled HSM operations and key custody, including the bank's non-exportable TLS-key requirement. KMS is integrated key management; ACM is certificate management; none is interchangeable merely because all involve cryptography. *Q039, Q045.*

### EBS, EFS, and FSx

| Storage | Access model / choose when |
|---|---|
| EBS | AZ-scoped block volume for EC2; appropriate filesystem/database semantics on the attached host. Not a general multi-AZ shared file service. |
| EFS | Managed shared NFS/POSIX file system for Linux-style access across instances; suitable for autoscaled apps requiring the same files. |
| FSx for Windows File Server | Shared SMB, Windows ACLs, AD integration; Multi-AZ deployment for a resilient Windows file share. |
| FSx for Lustre | High-performance parallel filesystem, especially HPC/batch workloads and S3-linked datasets. |

**EBS type selection:** `gp3` is general-purpose SSD with a 3,000 IOPS baseline; `io2` is for demanding/provisioned IOPS; `st1` favors frequently accessed sequential throughput; `sc1` favors infrequently accessed sequential data. HDD is not the answer to a random-I/O Oracle database just because older records are rarely read; HDD volumes are not boot volumes. RAID 0 increases striping/performance, not durability. *Q011, Q112, Q321; [EBS types](#src-ebs).*

EFS **Provisioned Throughput specifies throughput, not a universal IOPS reservation**. For a “3,000 IOPS” requirement, validate file sizes, operations, latency, and concurrency rather than equating MiB/s with IOPS. *Q112.*

For FSx Windows Single-AZ → Multi-AZ in the bank, create the Multi-AZ filesystem, copy/synchronize with DataSync, and cut over; do not assume the deployment type is an in-place toggle. Monitor `FreeStorageCapacity` and automate supported `UpdateFileSystem` increases before it fills. *Q247–Q248, Q299–Q300.*

For a monthly 72-hour batch over 200 TB in S3, create S3-linked Lustre only when needed, use lazy loading where appropriate, and delete it afterward. Persist new/changed output back to S3 before deleting ephemeral filesystem capacity. *Q280.*

### Storage Gateway, DataSync, and Transfer Family

| Service / mode | The protocol and placement detail |
|---|---|
| S3 File Gateway | Existing NFS/SMB-style file access backed by S3 objects with local cache. Useful when keeping a file-oriented application. |
| Volume Gateway — cached | iSCSI block volumes; primary data in AWS with a local hot-data cache. Size the design within per-volume/gateway limits. |
| Volume Gateway — stored | Full working block dataset remains local; asynchronous snapshots support AWS backup/restore. Restore appropriate snapshots as EBS for EC2 DR. |
| Tape Gateway | iSCSI virtual tape library for existing tape-backup software; archive virtual tapes without redesigning the backup protocol. |
| DataSync | Managed bulk/incremental transfer between supported file/object endpoints; recurring on-premises SMB → FSx Windows is a typical case. |
| Transfer Family | Managed SFTP/FTPS/FTP and supported transfer workflows, commonly landing files in S3/EFS. Preserves a partner-facing transfer interface instead of maintaining an EC2 SFTP server. |

CHAP authenticates iSCSI sessions; **it does not encrypt the data payload**. For partner IP allowlisting and preserved Elastic IP/host-key requirements, select the appropriate **VPC-hosted internet-facing Transfer Family endpoint**, security groups, and imported host keys; the generic public endpoint type does not supply every one of those controls. *Q073, Q128, Q202, Q244, Q257, Q266.*

<a id="database"></a>
## 7. Databases, replication, and caching

### RDS and Aurora: distinguish four separate goals

| Goal | Mechanism | What it does not solve |
|---|---|---|
| Survive a DB-instance/AZ failure | RDS Multi-AZ / appropriate Aurora replica topology | Not automatically regional DR or extra writer capacity. |
| Offload reads/reports | Read replicas; Aurora reader endpoint | Does not scale all writes, and replica lag may matter. |
| Reduce repeated SQL work | ElastiCache or precomputed results | Requires cache correctness/invalidation; not a backup. |
| Reduce connection churn / connection count | RDS Proxy and client connection reuse | Not a result cache and not an optimizer for expensive SQL. |

**Traditional RDS Multi-AZ DB instance:** the standby is not a read endpoint. **RDS Multi-AZ DB cluster:** a different deployment option with readable instances. Do not generalize the classic “standby cannot serve reads” rule to every modern product named Multi-AZ. *Q011, Q049, Q062, Q226; [Multi-AZ](#src-multiaz).*

**Aurora Auto Scaling changes the number of Aurora Replicas**, not the capacity of a single writer. Aurora Serverless capacity scaling is a different mechanism. Route application writes to the cluster/writer endpoint and eligible reads to readers. For failover, use DNS endpoints and reconnect correctly; hardcoded database IPs break when the endpoint's target changes. *Q054, Q102, Q242, Q324.*

**Aurora Global Database:** a primary write Region plus secondary Regions for low-latency reads and DR. A secondary-region reader endpoint does not become an independent local writer merely because Route 53 routes users there; supported write forwarding still forwards writes to the primary. Promotion/switchover is separate from DNS failover. *Q076, Q179, Q363.*

RDS Proxy can reduce disruption during a database failover, but “no application will ever pause more than 20 seconds” is not a hard general guarantee. Transactions, session state, engine behavior, and recovery logic still matter. *Q235, Q339, Q352; [RDS Proxy](#src-rdsproxy).*

### Engine and replication restrictions

**Oracle RAC / RAC One Node:** not a normal RDS for Oracle feature. An Oracle architecture that truly requires RAC points toward a supported self-managed solution, with explicit cluster/storage/network/licensing validation; merely drawing EC2 instances in two AZs does not establish a valid RAC deployment. *Q049, Q063, Q193.*

**SQL Server read replicas:** currently supported, including cross-Region configurations, subject to engine/edition/version/instance restrictions. The documented read-replica requirement includes **Enterprise Edition**; do not infer availability for every SQL Server edition from the generic RDS read-replica capability. *Q372; [SQL Server reference](#src-sqlserver).*

For external MySQL replication, enable/retain appropriate binlogs, seed a consistent snapshot/dump with matching log coordinates, and establish connectivity. Copying a dump and “starting replication” without a consistent position can lose or duplicate data. *Q121.*

**Aurora cross-account clone:** RAM-based sharing can enable a same-Region copy-on-write clone. A clone is not ongoing replication of later source writes. Coordinate synchronization/cutover for a live migration; copying Lambda deployment artifacts also requires recreating roles/configuration/triggers in the destination account. *Q343.*

### DynamoDB

DynamoDB is managed key-value/document storage. Choose it for independently addressed preferences, sessions, metadata, votes, and high-volume events when its access model fits—not as a no-change replacement for arbitrary relational queries. Small preferences can fit directly in an item; adding an S3 pointer to a few kilobytes is unnecessary complexity. *Q038, Q110, Q167.*

**Provisioned capacity** specifies read/write throughput, optionally with Auto Scaling. **On-demand** accommodates uncertain traffic without preselecting throughput. SQS can absorb bursts before writes, but durable backlog only drains if long-run consumer/database capacity exceeds arrival rate. Diagnose write throttling separately from Lambda concurrency. *Q015, Q047, Q085, Q263.*

**Streams** expose item changes for event-driven consumers such as Lambda. **Global tables** replicate tables across Regions and support multi-Region access; they are not a custom Streams replication project. Consistency mode and regional support matter: the bank's traditional eventual-consistency global-table model is not a promise of globally serializable transactions. *Q033, Q152, Q282, Q390.*

For time-series access, use a well-distributed entity/device partition key and timestamp sort key when matching the query pattern. Whole-period tables can be archived/deleted cheaply for batch retention. **TTL deletion is asynchronous**, not exact-time deletion at midnight; use a different mechanism for a strict deletion deadline. Avoid one universally hot partition key. *Q164, Q169, Q263.*

### ElastiCache, MemoryDB, and other engines

**ElastiCache** holds cached results or shared session state. Redis/Valkey-compatible replication and failover/read endpoints address different needs from Memcached's simpler distributed caching model. Externalizing sessions lets replacement instances serve the same user; ALB stickiness alone does not survive losing the server holding that session. Cross-Region web deployment does not automatically replicate caches. *Q062, Q089, Q094, Q096.*

**MemoryDB** is a durable Redis-compatible database rather than merely a disposable cache; the bank tests its reserved-node pricing separately from EC2/Lambda Savings Plans. **DocumentDB** is MongoDB-compatible, not a guarantee that every MongoDB feature/application migrates unchanged. **Neptune** is graph storage/query, not a generic relational replacement. **Keyspaces** is Cassandra-compatible and now has native multi-Region replication; Q033's dismissal on the basis that this is unavailable is outdated. *Q140, Q246, Q386; [Keyspaces replication](#src-keyspaces).*

<a id="messaging"></a>
## 8. Messaging, streams, email, and workflows

### SQS, SNS, EventBridge, and Amazon MQ

| Service | Core model | Decisive distinction |
|---|---|---|
| SQS | Durable work queue; consumers pull work | Buffers bursts and permits retries. Multiple workers on one queue divide work. |
| SNS | Publish/subscribe fan-out | Send an event to multiple subscribers; use one SQS queue per independent durable consumer. Also supports relevant email/mobile-push notification patterns. |
| EventBridge | Event routing by source/content; scheduled/event-driven integration | Match events and invoke targets; not the same as a worker backlog with visibility and explicit deletion. |
| Amazon MQ | Managed ActiveMQ/RabbitMQ brokers | Preserve supported broker/protocol semantics when migrating messaging; not a drop-in managed IBM MQ engine. |
| SES | Application email delivery, including SMTP | For SMTP use SES SMTP credentials and TLS, e.g. STARTTLS on port 587. SNS email notifications are not a full SMTP service. |

Queue consumers should be idempotent and delete messages **after** successful processing. The visibility timeout hides an in-flight message from other consumers; it is not message retention. A dead-letter queue isolates repeated failures; `maxReceiveCount` controls how many receives precede redrive. In Q265, a one-hour visibility timeout already covers a 20–40-minute job: `maxReceiveCount=1` is the overly aggressive setting. Increasing visibility does not fix that retry policy. *Q028, Q161, Q239, Q265, Q347.*

SQS FIFO addresses supported ordering/deduplication needs, but it does not remove the need for idempotent external side effects. If ordering is not required, do not impose it at the cost of unnecessary coordination. Publish to SNS with **separate queues** when every service must receive the event; one shared queue would cause services to steal each other's events. *Q239.*

### Kinesis Data Streams and Amazon Data Firehose

**Kinesis Data Streams** supports real-time ingestion, retained stream records, partition-key ordering, and independent consumers. A session/device partition key preserves ordering within the appropriate stream partition; it does not provide global ordering. The **Kinesis Producer Library** helps producers write records; the **Consumer Library** coordinates consumption. *Q010, Q151.*

**Amazon Data Firehose** (older name: Kinesis Data Firehose) buffers and delivers data to destinations such as S3, Redshift-oriented ingestion, or OpenSearch, with supported Lambda transformation. Buffering is the key tradeoff: **near-real-time delivery is not instantaneous record-by-record processing**. Choose it for low-operations delivery when minutes of delay are acceptable; choose Streams/consumers for the bank's stricter streaming requirements. *Q035, Q043, Q145–Q146, Q281.*

Do not solve backpressure by naming a stream alone. Configure producer retry behavior, consumer batches/concurrency, and downstream throughput. A throttled DynamoDB table and a throttled Lambda function are separate limits. *Q047.*

### Step Functions

Step Functions orchestrates stateful workflows across services: branching, retries, parallelism, waiting, callbacks, and error handling. **Map** applies work to a collection; **Parallel** runs separate branches. A 45-minute overall workflow can use shorter Lambda tasks; it does not extend any task's Lambda invocation limit. Use callbacks/task tokens for human or shipping-system completion rather than a continuously running polling Lambda. *Q111, Q208, Q279.*

`Retry` handles selected transient failures before `Catch` routes persistent failures. Catchers belong on supported states such as Task, Map, and Parallel. For JSONPath workflows, use **`ResultPath: "$.error"`** to add error details while preserving input; omitting it defaults to replacing input with the error. Preserve the original execution input deliberately if intermediate states have already transformed it. *Q387; [error handling](#src-stepfunctions).*

**`States.ALL` is not literally everything:** it does not catch `States.Runtime` or implicitly catch `States.DataLimitExceeded`. Current documentation permits explicit handling of the latter. For alerts about any failed Standard workflow execution, also consider execution-status events through EventBridge. SNS publishing additionally requires the state-machine role's permission; putting an SNS state in the graph does not grant that permission. [Error handling](#src-stepfunctions).

<a id="analytics"></a>
## 9. Analytics, search, and visualization

| Service | Choose it for | Distinction that changes answers |
|---|---|---|
| Redshift | Analytical warehouse, large joins/aggregations, BI | Not the primary transactional checkout database. |
| Redshift Spectrum | Query external S3 data from Redshift | Does not require loading every external object into warehouse tables. |
| Athena | Serverless SQL over supported S3 datasets | Often simpler/cheaper than an always-on EMR Presto cluster for intermittent SQL on ORC/Parquet. |
| Glue Data Catalog / crawlers | Discover schema/partitions and maintain metadata | A classifier/crawler identifies structure; it does **not** mask card numbers or rewrite records. |
| Glue ETL / Lambda transformation | Change, clean, convert, or redact records | Choose runtime and scale that fit; do not expose unredacted intermediate data. |
| EMR | Managed Spark/Hadoop and related big-data frameworks | Distinguish cluster roles and preserve persistent storage independently of disposable task compute. |
| OpenSearch | Full-text search, document/log indexing, interactive search analytics | S3 stores source documents; a search index provides search. |
| QuickSight | BI dashboards and controlled distribution | Needs a prepared dataset and permissions; organizational membership is not magically a cost dimension. |

**EMR Spot nuance:** in the bank's HDFS topology, keep primary/core capacity reliable and use Spot for **task nodes**, which add compute without storing HDFS data. Losing core nodes is a storage/topology risk, not just losing an executor. *Q158–Q159.*

For Athena/Spectrum, columnar **Parquet/ORC** and useful partitions reduce scanned data. For flow logs, Parquet with hourly partitions enables efficient time-filtered queries; gzipping undifferentiated text does not provide column pruning. *Q357, Q385.*

**Redshift concurrency scaling** addresses bursts of concurrent eligible queries by supplying additional capacity; it is not a promise to speed up one intrinsically slow query. For cross-Region encrypted snapshot copying, establish the **destination KMS key/snapshot-copy grant** and then enable copying. Scheduled snapshots satisfy RPO only if frequency/copy lag fit; restore duration must be tested against RTO. *Q014, Q098, Q383.*

**OpenSearch storage tiers:** hot for recent active data, UltraWarm for lower-cost less-active data, cold for detached infrequent data. The bank's tiering path moves data **hot → UltraWarm → cold**; cold data must be attached to suitable capacity before interactive queries. ISM automates index transitions/deletion; a separate S3 archive is not the same as an online searchable index. *Q281, Q338.*

**Searchable scanned documents:** S3 holds originals; Textract produces text/structure; OpenSearch indexes searchable content; an application serves results, with CloudFront for suitable static content. A bucket alone is not a full-text search engine. *Q153, Q286, Q289.*

<a id="operations"></a>
## 10. Monitoring, security, patching, and backups

### Which service answers which question?

| Service | The question it answers |
|---|---|
| CloudWatch metrics/alarms | “What is the system doing, and has a numerical threshold been crossed?” |
| CloudWatch Logs / Logs Insights | “What did the application log?” / “How do I query those logs?” |
| CloudTrail | “Who called which AWS API, against what, and when?” |
| AWS Config | “What was this resource's configuration, how did it change, and is it compliant?” |
| X-Ray | “Where did this request spend time or fail across services?” |
| VPC Flow Logs | “Which network flows were accepted/rejected?” **Metadata**, not packet payloads. |
| VPC Traffic Mirroring | “What packets traversed this supported interface?” Payload visibility still depends on encryption. |
| IAM Access Analyzer | “Where is unintended/external access?” and “What policy can be suggested from observed activity?” |
| Inspector | “Which supported compute/container/function workloads have vulnerabilities?” |
| GuardDuty | “Which supported activity patterns look like threats?” Not a general source-code scanner. |
| Macie | “Where is sensitive data such as PII in S3?” Not direct inspection of arbitrary RDS database rows. |
| Security Hub | “How do I centrally aggregate and assess security findings/posture?” Not a substitute for every preventive control or remediation workflow. |
| WAF | “Which HTTP(S) requests should be filtered?” SQL injection, XSS, IP/rate/bot rules on supported resources. |
| Shield | “How is the application protected from DDoS?” Standard protection versus Advanced's additional paid capabilities/support. |
| Firewall Manager | “How do I apply supported security policies consistently across accounts?” |

*Source scenarios: Q002, Q008, Q021, Q034, Q095–Q097, Q101, Q142, Q143, Q154, Q187.*

### CloudWatch and CloudTrail: the missing setting often decides it

Default EC2 metrics do not provide every guest metric. Install/configure the **CloudWatch agent** for guest memory, filesystem utilization, and application logs; having SSM Agent installed is not equivalent. For an application log pattern alert: agent → Logs → **metric filter** → metric alarm → SNS. Logs Insights is for queries, not the missing metric filter. *Q034, Q250, Q301.*

CloudTrail **management events** cover control-plane activity; **data events** are needed for object/item access such as S3 `GetObject` where supported/configured. A monthly audit of file access needs those events captured first; an Athena query cannot recover events that were never logged. A multi-Region organization trail can cover existing and future member accounts. Include global service events when configuring the relevant trail. *Q013, Q097, Q170, Q176, Q350.*

Centralize trails in a protected S3 bucket with appropriate cross-account delivery policy, encryption, and retention/deletion protection. **Log-file integrity validation** verifies tamper evidence; encryption does not prove a log was never deleted. CloudTrail records activity; Config records supported resource configuration. Organization account-movement alerts should use the relevant CloudTrail/EventBridge events, not assume Config records organization membership transitions. *Q124, Q170, Q305.*

Access Analyzer's CloudTrail-derived policy generation needs a representative observation period and appropriate event coverage. It suggests observed permissions; it does not prove that unobserved disaster-recovery or infrequent operational paths need no access. *Q101.*

### Systems Manager — choose the component, not just “SSM”

| Component | Job |
|---|---|
| Patch Manager | Define approved patches/baselines, scan/install, and report compliance for managed nodes. |
| Maintenance Windows | Schedule when disruptive actions may run; target tagged groups and control concurrency/error thresholds. |
| Run Command | Execute a command document on selected managed nodes, including shell commands. |
| Automation | Execute multi-step operational runbooks, including AWS API operations and instance-recovery workflows. |
| State Manager | Maintain a desired configuration through associations. |
| Session Manager | Interactive access without opening SSH/RDP inbound ports or distributing SSH keys. |
| Parameter Store | Configuration and `SecureString` secrets/configuration values; not a complete automatic database-password rotation service. |
| Distributor | Package distribution, not patch approval policy or a maintenance schedule. |
| OpsCenter / Explorer | Operational issues and aggregated operational visibility, not the underlying patch executor. |

Patch Manager requires enrolled/reachable managed nodes, appropriate IAM permissions, and SSM Agent where required. `AWS-RunPatchBaseline` is the command document for scanning/installing against the applicable baseline. Use **different patch groups/baselines and nonoverlapping windows** for development versus production or for availability-preserving batches. Separate OS-specific baseline requirements. “Install patches everywhere at once” can violate availability even if it achieves compliance. Hybrid on-premises servers can be registered as managed nodes; a major OS-version migration is not merely patch installation. *Q009, Q026, Q032, Q142, Q307, Q337.*

For key rotation, deleting an EC2 key-pair object does **not** remove the corresponding public key from an existing instance. Use an authorized management path such as Run Command to replace `authorized_keys` and remove the old entry; merely adding a new key leaves the old one valid. Session Manager can remove the need for inbound SSH altogether. *Q104, Q258.*

### Inspector, WAF, and responsive controls

**Inspector Classic assessment templates are legacy:** Inspector Classic shut down on May 20, 2026. Current Inspector scanning differs from the old agent/template/run-assessment workflow. For Lambda, **standard scanning** identifies eligible dependency vulnerabilities, including supported layers; **code scanning** examines supported application code. To exclude a function from **code scanning** while preserving the distinct standard-scanning intent, use `InspectorCodeExclusion=LambdaCodeScanning`. Container-image vulnerability scanning belongs to the relevant ECR scanning path. *Q070, Q391; [shutdowns](#src-shutdown), [exclusion tag](#src-inspectortag).*

Use WAF on a supported entry point such as CloudFront, ALB, or an API Gateway REST stage—not “attach WAF to a Lambda function.” Shield Advanced and WAF address different layers; deploying Advanced is not always the least-cost answer when CloudFront, Shield Standard, WAF, and resilient capacity meet the requirement. NACL IP denies can block specific sources but are not SQL-injection detection. *Q019, Q021, Q030, Q154–Q155.*

EventBridge → Lambda/Step Functions can remediate changes and request approval, but this is **detective/reactive**. A workflow that removes a new user's permissions after creation can race with subsequent changes; a preventive SCP/boundary/provisioning process is a different guarantee. *Q088, Q303, Q306.*

### AWS Backup and Data Lifecycle Manager

**AWS Backup:** centralized policy/scheduling/retention and supported cross-account/cross-Region copies across resource types. Define separate daily/weekly/monthly rules when their retention requirements differ. **Data Lifecycle Manager (DLM):** targeted lifecycle management for supported EBS snapshots/AMIs, not the bank's centralized RDS+EFS+EC2 backup service. *Q063, Q193, Q388.*

For failure notifications, select actual supported **failure events**, such as `BACKUP_JOB_FAILED`, or filter job-state events in EventBridge. `BACKUP_JOB_COMPLETED` is an event name, not a reliable synonym for “all successes and no failures.” Q388's wording is not an implementation-ready filter. Cross-Region copy is asynchronous; “configure a copy action” does not guarantee an instantaneous complete second copy. *[Backup notifications](#src-backupalerts).*

RDS automated backups/PITR and AWS Backup continuous backup are not arbitrary `mysqldump` files in a bucket you own. **Macie scans S3 objects, not AWS-internal RDS backup storage.** The bank's “hourly full backup + five-minute logs in S3” pattern requires a database/backup mechanism that actually supports generating and restoring those artifacts. Ordinary RDS MySQL managed backups cannot simply be treated as customer-controlled S3 files. *Q027, Q229, Q232; [RDS PITR](#src-pitr).*

<a id="deployment"></a>
## 11. Deployment and infrastructure as code

### CloudFormation, CDK, SAM, and StackSets

| Tool / feature | Exact purpose |
|---|---|
| CloudFormation | Declarative infrastructure resources and dependencies, managed as stacks. |
| CDK | Infrastructure expressed in languages such as TypeScript/Python and synthesized into CloudFormation. |
| SAM | Serverless-oriented template extensions/tooling, including supported deployment configuration. |
| StackSets | Deploy stacks across accounts/Regions; organization-integrated service-managed permissions can automatically deploy to new accounts in targeted OUs. |
| Change set | Preview proposed stack changes before execution; **not** an application integration test or proof of safety. |
| CloudFormation dynamic reference | Resolve a secret/configuration value at deployment/use by the supported resource; not a universal live-update mechanism. |

**`Ref` versus `GetAtt`:** for `AWS::SQS::Queue`, `Ref` returns the queue URL; `Fn::GetAtt: [Queue, Arn]` supplies its ARN for an SNS subscription. The queue also needs a policy allowing the SNS topic to send. *Q134.*

**Deletion policy:** `Retain` preserves a resource when removed/deleted through the relevant stack operation; `Snapshot` takes a supported final snapshot, such as for an RDS instance. **UpdateReplacePolicy** separately controls what happens to an old resource during replacement. Keep a long-lived database outside an ephemeral Beanstalk environment lifecycle where required. *Q132, Q136, Q369.*

**Rolling EC2 image update:** `UpdatePolicy.AutoScalingRollingUpdate` controls CloudFormation's batch replacement behavior for the ASG. An SSM public parameter for the latest AMI avoids hardcoding an ID, but you still need a stack update/replacement process to apply a new image. *Q066, Q120.*

**StackSets automation:** enable the appropriate Organizations trusted access, select service-managed permissions, target the OUs/Regions, and enable automatic deployment when the requirement includes future accounts. A one-time deployment does not meet “every new account automatically.” *Q219, Q332.*

**Bank correction — Q296:** CDK is appropriate for familiar programming languages and reusable constructs, but “CloudFormation has no loops” is obsolete. `Fn::ForEach` exists through the `AWS::LanguageExtensions` transform. [ForEach reference](#src-foreach).

### Pipeline components and deployment strategies

| Service | What it does |
|---|---|
| CodePipeline | Orchestrates source/build/test/approval/deploy stages. |
| CodeBuild | Runs build, unit/integration-test, and security-check commands. |
| CodeDeploy | Deploys application revisions with supported rolling/blue-green or traffic-shifting strategies. |
| CodeArtifact | Stores software packages; not a replacement for source control or CloudFormation. |
| Serverless Application Repository | Catalog of reusable serverless applications; not a function runtime or pipeline executor. |
| Elastic Beanstalk | Managed application environment provisioning and deployment using underlying AWS resources. |

Feature-branch code can deploy into a separate test account, run tests, and await manual approval before production. EventBridge can route failed pipeline/build events to SNS. A change set reviews infrastructure changes; CodeBuild integration tests validate behavior after deployment. *Q020, Q080, Q254, Q267, Q311.*

**Canary versus linear:** canary moves a small fraction first, waits, then moves the rest; linear moves equal increments at regular intervals. `LambdaCanary10Percent5Minutes` means 10% initially, then the remaining 90% after five minutes. Traffic must go through the deployment-controlled alias/integration; invoking an unrelated fixed version bypasses that split. Use alarms/rollback and tracing as appropriate. *Q090.*

**Beanstalk blue/green:** create a separate environment, validate it, and swap environment CNAMEs/URLs; swap back for rollback, subject to DNS/connection behavior and data compatibility. **Immutable deployment:** launch a new complete set of instances, validate it, then replace the old set; this is not the same mechanism as swapping two environment URLs. Platform hooks or supported `.ebextensions` configure software/mounts, such as EFS. *Q003, Q147–Q148, Q369.*

**Secrets Manager versus Parameter Store:** choose Secrets Manager for managed secret lifecycle/rotation patterns. A rotation schedule in CloudFormation must be paired with the actual supported rotation integration/function and database permissions; it does not magically change any arbitrary database password. ECS startup injection and deployment-time dynamic references do not continuously refresh running applications. *Q018, Q236, Q288.*

<a id="migration"></a>
## 12. Migration, hybrid modernization, and disaster recovery

### Migration services: identify which phase is being solved

| Service / approach | Choose it for |
|---|---|
| AWS Transform / discovery and assessment tooling | Inventory, dependencies, usage/right-sizing, application grouping, migration waves, and supported modernization assessments/workflows. |
| Application Discovery Service | The bank's server configuration, utilization, and dependency discovery tasks. |
| Migration Evaluator | The bank's TCO/business-case and utilization-based migration assessment. |
| Migration Hub | Track/group migration work; not the engine that copies every server/database. |
| Cloud Adoption Readiness Tool / readiness assessment | Organizational readiness and planning, not block replication. |
| AWS Transform MGN / Application Migration Service | Continuous block-level server replication, test launches, and low-downtime rehosting of supported physical/virtual/cloud servers. |
| VM Import/Export | Import a supported VM disk/image artifact into EC2; unlike MGN, not ongoing live change replication. |
| SCT / supported schema-conversion tooling | Convert incompatible schemas/database code, especially heterogeneous engine migrations. |
| DMS | Move data with full load and/or change data capture (CDC); not a blanket guarantee of automatic application/schema conversion. |
| DataSync | Move/synchronize supported files/objects while preserving the needed data-transfer behavior. |
| Data Transfer Terminal | Transfer a physically transported bulk dataset at an AWS location when the available WAN cannot meet the deadline. |

These tools solve different phases. “Discover dependencies” is not “replicate servers”; “convert schema” is not “copy database changes.” Strongly coupled servers belong in a coordinated migration wave when their dependencies make independent cutover unsafe. *Q195, Q198, Q209–Q211, Q320, Q322, Q333, Q336, Q373, Q382; [MGN](#src-mgn).*

**MGN** generally uses replication agents on the source servers for the bank's agent-based pattern; installing something only on the hypervisor is not the same operation. Replicate, test, validate, then cut over. **Elastic Disaster Recovery (DRS)** similarly uses continuous replication and staging for recovery, but its purpose is ongoing disaster readiness, not completing a one-time migration. *Q209, Q218, Q363.*

For **VM Import**, upload a supported disk/image format and configure the required `vmimport` role/permissions. An **OVF descriptor alone is not the VM disk**; retain/upload the actual supported image artifact. *Q348; [VM Import prerequisites](#src-vmimport).*

**Heterogeneous DB migration:** assess/convert schema and incompatible code, provision the target, perform full load plus CDC, validate, stop or coordinate writes, catch up, and cut over. Oracle/SQL Server/Db2 → Aurora or another engine may require application changes. IBM MQ → Amazon MQ also requires broker/protocol compatibility analysis. “Managed compatible service” does not mean every source-specific feature is preserved. *Q198, Q228, Q252, Q323.*

### Bandwidth arithmetic eliminates several distractors

For decimal units, an optimistic lower bound is:

`transfer days ≈ data_TB × 8,000,000 / (bandwidth_Mbps × 86,400)`

| Dataset / connection | Ideal continuous-transfer time, before overhead | Consequence |
|---|---:|---|
| 60 TB / 50 Mbps | 111 days | Cannot meet a 30-day bulk-migration deadline over that link. |
| 40 TB / 12 Mbps | 309 days | Cannot meet a three-month deadline; prioritize/seed by another path. |
| 25 TB / 50 Mbps | 46 days | Cannot meet three weeks without an alternative bulk path. |
| 1 TB / 50 Mbps | 1.85 days | Pre-seed before the outage window, then transfer a small final delta. |

These are calculations from the question inputs, not service performance promises. Allow protocol overhead, competing traffic, preparation, validation, and logistics. An offline/terminal bulk seed still needs a **delta/CDC strategy** if writes continue. Do not order a new dedicated connection or invent a full rewrite when early online pre-seeding already meets the requirement. *Q195, Q201, Q210, Q294.*

**Rehost:** preserve the server/application architecture as much as possible. **Replatform:** change the hosting/managed platform without a fundamental application rewrite, such as suitable containers or RDS. **Refactor:** materially change architecture/code, such as decomposing a monolith. A Java licensing-cost question may favor supported OpenJDK/Corretto and containers, not automatically Lambda. *Q194, Q228.*

### DR strategies: what is already running?

| Strategy | Recovery-site state before disaster | Typical tradeoff |
|---|---|---|
| Backup and restore | Backups and infrastructure definitions; application may need creation and data restore | Lowest standing cost; longest restore path. |
| Pilot light | Essential data/services replicated; much application capacity stopped or absent | Start/provision application capacity, promote data, then route traffic. |
| Warm standby | Scaled-down but functioning complete environment | Scale up and fail over; faster than building the environment. |
| Multi-site active/active | Multiple locations actively serve traffic | Low disruption potential, highest cost and data-consistency complexity. |

Use **warm standby** for the bank's five-minute RTO with an already usable secondary stack; an ASG at zero plus a replicated DB is closer to **pilot light**. A stateless application can often recover from an AMI/template while the large database requires continuous replication to meet a short RPO. *Q048, Q077, Q325.*

The recovery order matters: verify replica health → promote/enable a writer where required → start/scale the application → verify readiness → route clients. Route 53 health-based failover alone neither creates compute nor promotes a read replica. Failback also requires write reconciliation and preventing split-brain; restoring DNS is not the whole procedure. *Q196, Q325, Q360, Q372.*

Preserve recovery dependencies: AMIs, configuration/secrets, KMS permissions, certificates, network routes, quotas/capacity, and backup access in the recovery Region. An RTO measured only from database promotion ignores the rest of the user-visible recovery path. *Q014, Q076, Q285, Q363.*

<a id="specialized"></a>
## 13. AI, media, IoT, and end-user services

### AI and media: choose by input and operation

| Service | Distinction in this bank |
|---|---|
| Textract | OCR plus supported document structure, forms, and tables. Use it before text analytics on scanned documents. |
| Comprehend | NLP on text: entities, sentiment, classification, and related analysis. Not the OCR stage. |
| Transcribe | Speech/audio → text. Call recordings can land in S3 and trigger asynchronous transcription. |
| Polly | Text → speech, the opposite direction from Transcribe. |
| Lex | Conversational intent recognition/dialogue, including speech/text bot interactions. |
| Connect | Contact-center/call-routing platform; combine with Lex and Lambda for automated service requests. |
| Rekognition | Supported image/video analysis, including face matching and content analysis; not arbitrary model training. |
| SageMaker | Build/train/deploy custom ML workflows; governed notebook provisioning can be a Service Catalog product. |
| Elemental MediaConvert | File-based transcoding, such as MP4 → HLS; queue jobs, store outputs in S3, deliver through CloudFront. |

Rekognition **face collections store feature representations, not a replacement copy of the original photographs**. Persist the stills/original media in S3 and metadata in an appropriate store; index/search the derived information separately. File Gateway can preserve an existing media application's file interface during migration. *Q215–Q216.*

A transcription or media-conversion job can be asynchronous. A Lambda trigger starts/coordinates the work; it need not process an entire multi-hour recording itself. Store original media in a storage class matching its future retrieval latency, not automatically in a restore-required archive. *Q206, Q251.*

### IoT services

**IoT Core** supplies managed device connectivity/message brokering and rules. **Basic Ingest** sends eligible device messages directly into the Rules Engine without the normal broker distribution path, useful for low-cost ingestion when broader publish/subscribe is unnecessary. Rules → Firehose → S3 is appropriate when the permitted buffering interval fits. *Q043.*

**IoT Device Management** handles fleet onboarding, organization, monitoring, and jobs. **IoT Device Defender** handles device-security auditing and anomaly/security monitoring. **IoT SiteWise** focuses on industrial equipment data/models. A connectivity-health question and a security-posture question are not asking for the same service. *Q059.*

**IoT Greengrass** runs components and local processing/inference on edge devices, including supported offline operation. Train a model centrally with SageMaker, deploy it to Greengrass, and serve local predictions when connectivity is absent. IoT Core alone is not a local offline inference runtime. *Q308.*

Migrating MQTT clients to IoT Core requires compatible authentication, certificates, endpoint configuration, and delivery semantics. **A DNS CNAME by itself does not establish a valid custom TLS domain or client authorization.** Configure the custom domain properly and choose QoS/persistent-session behavior consistent with the no-loss requirement. *Q309.*

### End-user computing and blockchain

**WorkSpaces:** hosted desktops. **WorkSpaces Applications** (formerly AppStream 2.0): stream individual desktop applications to users without installing them locally. For WorkSpaces office-IP restrictions, update **IP access control groups** when the office's public egress address changes; this is not a generic application SG issue. *Q092, Q353; [application streaming](#src-appstream).*

**WorkDocs:** the bank's historical managed document collaboration/versioning service. It shut down **April 25, 2025**; Q114 is historical knowledge, not a deployable current recommendation. *[Service shutdowns](#src-shutdown).*

**Managed Blockchain:** for the bank's tamper-evident, permissioned audit design, place the immutable commitment/hash on the ledger and retain sensitive personal records **off-chain** in a deletable data store such as DynamoDB. Do not put raw PII on an immutable ledger and then promise it can be deleted normally. A hash can still have privacy implications if linkable to a person. *Q362.*

<a id="alternatives"></a>
## 14. Recognition-only alternatives mentioned in distractors

These names appear without needing a separate detailed study chapter. The purpose here is to recognize the mismatch, not to recommend every historical product for a new deployment. Availability/support should be checked before adopting older products; several appear in AWS lifecycle notices. The source is their usage in the supplied options.

| Functionality | Service / distinction |
|---|---|
| Simpler application hosting | **Lightsail:** simplified bundled infrastructure. **App Runner:** managed web application/container hosting. **Amplify:** frontend/full-stack app tooling. None is the missing specialized control-plane/network/DR mechanism merely because it runs applications. |
| Hybrid/edge infrastructure | **Outposts:** AWS infrastructure at a customer site. **Wavelength:** compute near supported carrier networks. **Local Zones:** AWS infrastructure closer to specific metros. Not needed simply to send a mobile push notification. |
| Kubernetes outside ordinary EKS | **EKS Anywhere:** Kubernetes lifecycle tooling for customer infrastructure. **EKS Distro:** Kubernetes distribution. Neither means Fargate is installed on a customer's servers. |
| Migration packaging | **App2Container:** analyze/containerize supported existing applications. **License Manager:** manage software-license usage/compliance, not automatically relocate a MAC-bound license. |
| Data integration | **AppFlow:** supported SaaS data transfers. **Data Exchange:** subscribe/share data products. **Data Pipeline:** historical scheduled data workflow service. Different from a crawler, live message bus, or database CDC tool. |
| Streaming | **MSK:** managed Apache Kafka. **Managed Service for Apache Flink:** stateful stream processing. **Kinesis Video Streams:** video-stream ingestion/storage. Not interchangeable with Firehose delivery buffering. |
| Data governance/search | **Lake Formation:** data-lake access governance. **Kendra:** enterprise search. **Managed Grafana:** observability dashboards. None is itself the S3 object store or the ETL transformation. |
| Specialized data/ML | **Timestream:** time-series database family. **Fraud Detector:** fraud-detection service in historical options. **SageMaker Canvas:** no/low-code ML interface. Match the workload, not merely the word “data.” |
| Security investigation/compliance | **Detective:** security investigation. **Audit Manager:** collect/map audit evidence. **CloudTrail Lake:** query/store audit events. **Network Access Analyzer:** analyze network-access paths. These are not substitutes for inline blocking or package vulnerability scanning. |
| Operational support | **AWS Health:** service/account health events. **Support plans:** support entitlements. **Incident Manager:** incident response coordination. **Systems Manager Explorer:** operations aggregation. None provides the missing EC2 memory agent or actual patch baseline. |
| Engineering tooling | **CodeGuru:** code/performance analysis family. **Device Farm:** application testing on devices/browsers. **Proton:** platform/environment template tooling in historical questions. **Copilot:** ECS application tooling. These are not organizational SCP enforcement. |
| Image/configuration tooling | **EC2 Image Builder:** image-building pipeline. **AppConfig:** controlled runtime configuration/feature flags. **Lambda SnapStart:** eligible snapshot-based startup optimization. Not the same as ordinary code deployment, reserved concurrency, or memory right-sizing. |
| Inventory versus aggregate analytics | **S3 Inventory:** object listings/metadata reports. **Storage Lens:** aggregate storage metrics/trends. Listing objects does not provide six months of historical aggregate metrics retroactively. |
| Media and communications | **MediaLive:** live video processing. **MediaConnect:** live video transport. **Elastic Transcoder:** historical file transcoding. **Translate:** language translation. **Pinpoint:** engagement/messaging capabilities in historical options. **Alexa:** voice-assistant ecosystem. **Ground Station:** satellite communications. |
| Platform code and libraries | **Corretto:** Amazon's OpenJDK distribution. **AWS SDK/CLI:** API clients. **AMI:** machine image, not a running server or a backup policy. **CloudFormation template:** infrastructure declaration, not the data itself. |
| Database-specific accelerators | **RDS Optimized Reads / Optimized Writes:** supported engine/instance-specific optimizations. Do not assume either is a generic replacement for connection pooling, replica routing, or every high-CPU diagnosis. |

<a id="corrections"></a>
## 15. Corrections and caveats to retain instead of the flawed wording

This is the short list to revisit when a practice result conflicts with the rules above. **“Incomplete” does not necessarily mean the chosen option is the worst among the choices; it means the explanation must not be generalized literally.**

| Question(s) | Retain this corrected rule |
|---|---|
| Q001 | Authoritative DNSSEC **signing** and Resolver **validation** are different. SNI means Server Name **Indication**. |
| Q024, Q327, Q354 | Cross-account DNS association does not require peering; shared networking configuration belongs to the actual resource owner, not automatically the management account or participant. |
| Q046 | NLB inbound rules for PrivateLink traffic use the client private IP, not the endpoint interface IP. |
| Q027 | RDS managed backup storage is not your arbitrary S3 bucket; Macie does not directly scan RDS backups/database contents. |
| Q033 | Keyspaces now supports native multi-Region replication. DynamoDB may still be the right answer for the stated data/access model. |
| Q058, Q069 | S3 default encryption and SSE-C defaults have changed; envelope encryption is not “multi-factor encryption.” |
| Q070, Q114 | Inspector Classic and WorkDocs are retired; recognize the historical intent without using those old implementations. |
| Q071 | CloudFront dedicated-IP SSL does not bypass viewer-certificate hostname coverage or create ALB-style multiple certificate selection. |
| Q093 | Replacing a NAT instance is not a complete remedy for long-idle connection behavior. |
| Q112 | EFS Provisioned Throughput is not an IOPS reservation; modern gp3 has a 3,000 IOPS baseline. |
| Q126, Q316 | Presigned GET requires read permission; signed URLs are bearer tokens, not intrinsically tied to the original user's identity. |
| Q187, Q305–Q306 | Findings aggregation, configuration tracking, reactive remediation, and preventive governance are different controls. |
| Q192, Q379 | `ForAllValues` on submitted tag keys does not prove that every required tag is present and nonempty. |
| Q271 | CloudFront origin failover does not retry login POSTs at a secondary origin. |
| Q295 | `eu-east-1` in the question is not a valid Region identifier. Interpret the intended regional-origin routing pattern, not the literal identifier. |
| Q296 | CloudFormation has `Fn::ForEach`; CDK's advantage is broader language/abstraction capabilities, not the absolute absence of template iteration. |
| Q302 | RTC's 15-minute commitment is an SLA percentage, not a guarantee for every object; a 30-minute alarm needs matching logic. |
| Q309 | MQTT migration requires valid TLS/authentication/delivery configuration, not just a CNAME. |
| Q321, Q323 | Cold HDD is not a blanket Oracle DB choice; Amazon MQ is not a managed IBM MQ engine. |
| Q317, Q326 | OAC is not OAI; private OAC access cannot be combined with an S3 website endpoint. |
| Q328, Q334 | Match Command versus Automation APIs; protecting SG rules requires more than denying new ingress rules. |
| Q343, Q348 | Aurora cloning is not ongoing replication; an OVF descriptor alone is not an importable VM disk. |
| Q356 | VGW allowed prefixes filter VPC CIDRs; TGW allowed prefixes are the advertisements themselves. Current transit VIF support also permits sub-1-Gbps connections. |
| Q349 | Client VPN supports MFA with Managed Microsoft AD or AD Connector; these are distinct directory integration choices. |
| Q372 | SQL Server read replicas have edition/version requirements; the cross-Region feature does exist. |
| Q387 | Preserve workflow input explicitly; `States.ALL` is not a literal catch-all. |
| Q388 | Configure actual failure events/status filters; cross-Region backup copying is asynchronous. |
| Q390 | ALB supports HTTP WebSockets, including configurable ports; NLB needs a transport/addressing/other concrete justification. |

**Final elimination check:** identify the protocol, duration, data model, consistency need, recovery target, policy principal/action/resource/condition, account/Region/AZ scope, and the exact bottleneck. Many wrong answers choose the right service family but change just one of these.

<a id="sources"></a>
## Selected AWS references

The bank itself supplies the scenarios and Q-identifiers. The references below were used to check the most consequential nuances and corrections; this is not a claim that every sentence of every supplied explanation was independently validated. Links are grouped by subject so they remain useful for study.

| Reference | Official documentation |
|---|---|
| <a id="src-scp"></a>SCP scope and permissions | [Service control policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html) |
| <a id="src-tagsets"></a>IAM set operators | [Single-valued versus multivalued context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-single-vs-multi-valued-context-keys.html) |
| <a id="src-endpoint"></a>S3 endpoint routing and policies | [Gateway endpoints for S3](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html) |
| <a id="src-nat"></a>NAT behavior | [Compare NAT gateways and NAT instances](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-comparison.html) |
| <a id="src-dx"></a>DX interface types and speeds | [Direct Connect virtual interfaces](https://docs.aws.amazon.com/directconnect/latest/UserGuide/WorkingWithVirtualInterfaces.html) |
| <a id="src-dnssec"></a>DNSSEC signing | [Configuring DNSSEC signing](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec.html) |
| <a id="src-oac"></a>CloudFront private S3 origin | [Restrict access to an S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) |
| <a id="src-cftls"></a>CloudFront certificates | [SSL/TLS certificate requirements](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html) |
| <a id="src-cffailover"></a>CloudFront origin failover | [Optimize high availability with origin failover](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html) |
| <a id="src-cffunctions"></a>CloudFront Functions runtime | [Restrictions on CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-function-restrictions.html) |
| <a id="src-executionrole"></a>ECS role responsibilities | [Task execution IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html) |
| <a id="src-ecssecrets"></a>ECS secret injection | [Pass Secrets Manager secrets through environment variables](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html) |
| <a id="src-lambda"></a>Lambda invocation limits | [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) |
| <a id="src-storageclasses"></a>S3 class selection | [Understanding S3 storage classes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) |
| <a id="src-sses3"></a>S3-managed encryption | [Using SSE-S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) |
| <a id="src-ssec"></a>SSE-C restrictions/defaults | [Using customer-provided keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ServerSideEncryptionCustomerKeys.html) |
| <a id="src-s3kms"></a>S3 and KMS authorization | [Using SSE-KMS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html) |
| <a id="src-kmsrotation"></a>Imported-key rotation | [Rotate AWS KMS keys](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html) |
| <a id="src-rtc"></a>Replication timing | [S3 Replication Time Control](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-time-control.html) |
| <a id="src-ebs"></a>EBS workload/type fit | [EBS volume types](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html) |
| <a id="src-multiaz"></a>RDS deployment models | [RDS Multi-AZ deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html) |
| <a id="src-sqlserver"></a>SQL Server replica restrictions | [SQL Server read replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.ReadReplicas.html) |
| <a id="src-rdsproxy"></a>Connection pooling/failover | [RDS Proxy for Aurora](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html) |
| <a id="src-pitr"></a>RDS recovery | [Restoring to a specified time](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html) |
| <a id="src-keyspaces"></a>Cassandra-compatible replication | [Keyspaces multi-Region replication](https://docs.aws.amazon.com/keyspaces/latest/devguide/multiRegion-replication.html) |
| <a id="src-stepfunctions"></a>Workflow catches and input | [Handling errors in Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html) |
| <a id="src-backupalerts"></a>Backup event names | [Notification options with AWS Backup](https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-notifications.html) |
| <a id="src-inspectortag"></a>Lambda code-scan exclusions | [Excluding functions from Lambda code scanning](https://docs.aws.amazon.com/inspector/latest/user/scanning_resources_lambda_code_exclude_functions.html) |
| <a id="src-foreach"></a>CloudFormation iteration | [Fn::ForEach](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-foreach.html) |
| <a id="src-mgn"></a>Server migration naming/capabilities | [What is AWS Transform MGN?](https://docs.aws.amazon.com/mgn/latest/ug/what-is-mgn.html) |
| <a id="src-appstream"></a>Application streaming naming | [What is WorkSpaces Applications?](https://docs.aws.amazon.com/appstream2/latest/developerguide/what-is-appstream.html) |
| <a id="src-shutdown"></a>Retired services | [AWS services in full shutdown](https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html) |
| <a id="src-poweruser"></a>Managed developer permissions | [PowerUserAccess policy](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/PowerUserAccess.html) |
| <a id="src-identityad"></a>Identity Center and AD trusts | [Connect a self-managed AD](https://docs.aws.amazon.com/singlesignon/latest/userguide/connectonpremad.html) |
| <a id="src-vpnad"></a>Client VPN directory MFA | [Active Directory authentication](https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/ad.html) |
| <a id="src-vpnauth"></a>Client VPN authentication prerequisites | [Client authentication](https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/client-authentication.html) |
| <a id="src-nlbsg"></a>PrivateLink source and NLB rules | [Network Load Balancer security groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-security-groups.html) |
| <a id="src-dxprefix"></a>VGW versus TGW prefix semantics | [Allowed prefixes for DX gateways](https://docs.aws.amazon.com/directconnect/latest/UserGuide/allowed-to-prefixes.html) |
| <a id="src-presigned"></a>S3 bearer access and expiry | [Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) |
| <a id="src-cflimits"></a>Distribution certificate limits | [CloudFront SSL/TLS limits](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-limits.html) |
| <a id="src-acmexport"></a>Exportable public certificates | [ACM exportable certificates](https://docs.aws.amazon.com/acm/latest/userguide/acm-exportable-certificates.html) |
| <a id="src-storagelens"></a>Metrics query windows | [Understanding S3 Storage Lens](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage_lens_basics_metrics_recommendations.html) |
| <a id="src-vmimport"></a>Importable VM artifacts | [VM Import prerequisites](https://docs.aws.amazon.com/vm-import/latest/userguide/prerequisites.html) |
