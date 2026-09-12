# Lesson 7 — A Hybrid Enterprise Network with Shared Services

## Transit Gateway, Direct Connect, VPN, private DNS, Directory Service, PrivateLink, and network inspection

We return to the main curriculum after the customer-service interlude. Lesson 7 connects the accounts and workloads established in Lessons 5 and 6—but **only along the paths the business actually needs**.

The uploaded material provides the core treatment of multi-VPC connectivity, hybrid networking, Direct Connect virtual interfaces, shared directories, and DNS configuration. The Northstar scenario, address plan, route tables, and failure exercises below are teaching examples. Detailed Resolver, RAM, and inspection behavior is expanded from official AWS documentation; material differences from the older guide are identified explicitly.

---

# 1. The project

## 1.1 Business brief

Northstar now has a governed multi-account environment and an internal developer platform.

Its workloads are distributed across approximately 20 VPCs. However, important corporate systems remain in two data centers:

```text
Enterprise resource planning
Microsoft Active Directory
Corporate DNS
File and license servers
Legacy databases
Partner integrations
```

Cloud applications need selected access to these systems.

The current network has grown through individual requests:

```text
one VPC peering connection
one VPN
another VPN
a manually configured DNS forwarder
another peering connection
```

The result is difficult to understand and easy to break.

Northstar also acquires **Meridian Logistics**. Meridian’s AWS VPC uses the same address range as Northstar’s Orders VPC. Northstar needs to call Meridian’s inventory API, but the companies cannot renumber either environment immediately.

---

## 1.2 Business requirements

Northstar needs a network that supports four distinct relationships:

| Relationship | Requirement |
| --- | --- |
| Cloud workloads ↔ corporate systems | Private, predictable connectivity with resilient fallback |
| Workload VPCs ↔ shared services | Central DNS, directory, and selected internal applications |
| Production ↔ nonproduction | No general connectivity |
| Northstar → Meridian inventory API | Private service access despite overlapping CIDRs |

Additional requirements are:

- The Network team centrally manages inter-VPC and hybrid routing.
- Application teams retain ownership of their workload resources.
- Critical paths survive a connection, device, or Availability Zone failure.
- Normal data-center traffic uses Direct Connect; encrypted Internet VPN is an acceptable emergency fallback.
- Corporate names resolve from AWS, and private AWS names resolve from the data centers.
- Internet egress from selected production workloads is inspected centrally.
- Joining the AWS Organization must **not** automatically grant access to every corporate system.

The baseline uses one primary AWS Region. A second Region is considered later as a networking extension, not as a complete application disaster-recovery design.

---

## 1.3 The central lesson

A working hybrid interaction usually requires several independent conditions:

\[
\text{Successful interaction}
=

\text{correct name resolution}
\land
\text{forward route}
\land
\text{return route}
\land
\text{permitted traffic}
\land
\text{valid authentication and authorization}
\]

Not every request uses DNS, and not every application uses IAM. But the separation matters:

```text
DNS:
    What address should I contact?

Routing:
    Where should packets go?

Network security:
    Which traffic may pass?

IAM:
    Who may configure AWS or invoke an IAM-authorized API?

Application or directory security:
    Who may use the destination service?
```

---

# 2. Baseline architecture

```text
                         Northstar data centers
                 ┌────────────────┴────────────────┐
                 │                                 │
              Data center A                    Data center B
              Corporate DNS                    Corporate DNS
              Active Directory                 Active Directory
              ERP                              Legacy systems
                 │                                 │
                 └──────── diverse connectivity ────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
       Direct Connect paths                    Site-to-Site VPNs
       separate devices/locations              independent Internet paths
              │                                         │
         Transit VIFs                                   │
              │                                         │
      Direct Connect gateway                            │
              │                                         │
              └──────────────────┬──────────────────────┘
                                 ▼
                     Transit Gateway — primary Region
                         owned by Network account
                                 │
          ┌──────────────────────┼──────────────────────────┐
          │                      │                          │
          ▼                      ▼                          ▼
   Production VPCs       Nonproduction VPCs        Shared Services VPC
   Orders                Development                Resolver endpoints
   Logistics                                        Managed Microsoft AD
                                                    Internal services
                                 │
                                 ▼
                       Inspection / Egress VPC
                       Network Firewall endpoints
                       NAT Gateways
                                 │
                                 ▼
                              Internet
```

Meridian is connected differently:

```text
Orders VPC                                   Meridian VPC
10.10.0.0/16                                 10.10.0.0/16
                                                OVERLAPS

Orders application
       │
       ▼
Interface endpoint ─────── PrivateLink ──────► NLB
in Orders VPC                                  │
                                               ▼
                                         Inventory API
```

The Direct Connect gateway connection in the first diagram represents a **logical connectivity association**, not an EC2 appliance installed in a subnet.

The important architectural decision is that Northstar does **not** solve every requirement by joining complete networks:

> Use routing when networks need connectivity. Use PrivateLink when consumers need a particular service without merging network address spaces.

---

# 3. Address planning before connectivity

## 3.1 The address plan

For this lesson, use these example ranges:

| Environment | CIDR |
| --- | --- |
| Data center A | `172.20.0.0/16` |
| Data center B | `172.21.0.0/16` |
| Orders production VPC | `10.10.0.0/16` |
| Logistics production VPC | `10.11.0.0/16` |
| Development VPC | `10.20.0.0/16` |
| Shared Services VPC | `10.100.0.0/16` |
| Inspection/Egress VPC | `10.200.0.0/16` |
| Future European application VPC | `10.60.0.0/16` |
| Meridian VPC | `10.10.0.0/16` — overlaps Orders |

The first seven networks can participate in ordinary routing because their address ranges do not overlap.

Meridian cannot simply join that same routed address space.

---

## 3.2 Why overlap is a real problem

Suppose Orders needs to reach:

```text
10.10.50.8
```

But both companies use that address.

The address alone no longer identifies which network owns the intended destination.

Adding another route does not fix the fundamental ambiguity.

Possible solutions include:

```text
Renumber one environment.
Translate addresses.
Expose selected services through PrivateLink.
Use an application proxy with a nonoverlapping reachable address.
```

The appropriate answer depends on whether the requirement is **general network access** or **access to one service**.

VPC peering cannot be created between VPCs with overlapping CIDRs. Transit Gateway also does not make overlapping VPCs mutually routable; an overlapping VPC CIDR is not propagated as an ordinary usable route to the same destinations.  

---

## 3.3 Reserve address space centrally

Northstar’s account-vending process should allocate VPC ranges from a controlled plan rather than letting each team choose:

```text
10.0.0.0/16
```

independently.

The design should reserve space for:

- future VPCs;
- additional Regions;
- acquisitions;
- on-premises networks;
- container and interface-endpoint growth;
- migration environments.

AWS VPC IP Address Manager is a useful later extension. For now, the principle is sufficient:

> Address allocation is an organization-level design decision when the networks may eventually need to communicate.

---

# 4. VPC peering: the small-network option

## 4.1 What peering provides

A VPC peering connection supplies direct private routing between two VPCs.

```text
Orders VPC
    ↔
Logistics VPC
```

It can cross account and Region boundaries. Each side still needs the appropriate routes and security controls.

Peering is a strong choice when Northstar has only two VPCs that need straightforward connectivity and does not need a central transit hub.

---

## 4.2 Peering is non-transitive

```text
Orders ↔ Shared Services
Logistics ↔ Shared Services
```

does not imply:

```text
Orders ↔ Logistics through Shared Services
```

Nor does it let Orders automatically use the Shared Services VPC’s VPN or Direct Connect path to reach a data center.

Peering does not provide ordinary edge-to-edge transit through a peer’s Internet Gateway, NAT device, VPN, or Direct Connect connection.

---

## 4.3 Peering scale depends on the required graph

For 20 VPCs requiring full connectivity:

\[
\frac{20(20-1)}{2}=190
\]

peering connections would be needed.

That is not the cost of every peering architecture. A design where every VPC needs only one shared service could use a smaller graph.

The actual reason Northstar rejects peering as its main backbone is the combination of:

```text
many VPCs
shared hybrid connectivity
central routing control
segmentation
future growth
```

A managed transit hub fits that combination better.

---

# 5. Transit Gateway: a router, not a security policy

## 5.1 The basic model

AWS Transit Gateway is a Regional Layer 3 routing hub.

Its connections are called **attachments**.

For Northstar:

```text
Orders VPC attachment
Logistics VPC attachment
Development VPC attachment
Shared Services VPC attachment
VPN attachment
Direct Connect gateway attachment
Inspection VPC attachment
```

The uploaded guide presents Transit Gateway as the managed alternative to a custom transit VPC with routing appliances.

---

## 5.2 An attachment is not the complete configuration

A VPC needs:

```text
TGW attachment
+
appropriate VPC subnet routes
+
appropriate TGW routes
+
security controls
+
return path
```

**Source clarification:** The cheat sheet says a newly created VPC is automatically connected and available to other attached networks. That is too broad. Creating a VPC alone does not connect it. Attachments and routing must be configured, either directly or through automation.  

---

## 5.3 Attachment subnets

A VPC attachment selects one subnet in each Availability Zone that should access the TGW.

These subnets provide the TGW’s network presence in the VPC. They do not mean that only resources inside those particular subnets can use it.

For Northstar, an attachment is enabled in each active workload AZ. A workload in an AZ without an enabled attachment subnet cannot simply use a TGW route as though the attachment existed there.

---

## 5.4 Two different route-table layers

A packet crosses two routing decisions:

```text
Workload subnet route table
    → send destination toward TGW

TGW route table
    → select destination attachment
```

For example:

```text
Orders subnet:
    10.100.0.0/16 → TGW

TGW:
    10.100.0.0/16 → Shared Services attachment
```

Configuring only the first route does not configure the second.

---

# 6. Association versus propagation

This is the most important new Transit Gateway distinction.

## 6.1 Association

An attachment is associated with **one TGW route table**.

That table is used when packets **arrive at the TGW from that attachment**.

```text
Packet arrives from Orders attachment
    ↓
look up destination in RT-Production
```

Association answers:

> Which routing table governs traffic entering from this network?

---

## 6.2 Propagation

An attachment can propagate routes into **one or more TGW route tables**.

For a VPC attachment, this advertises the VPC’s CIDR blocks.

```text
Shared Services attachment
    ↓ propagates 10.100.0.0/16 into
RT-Production
RT-Development
RT-Corporate
```

Propagation answers:

> Which routing tables learn how to reach this network?

AWS documents these as separate operations: one associated table per attachment, with propagation into multiple tables.

---

## 6.3 Memory rule

```text
Association:
    Which table do packets FROM me use?

Propagation:
    Which tables learn routes TO me?
```

Do not memorize them as two interchangeable ways of “attaching a route table.”

---

# 7. Segmentation through concrete route tables

## 7.1 Routing policy

Northstar decides:

```text
Production may reach:
    other approved production networks
    Shared Services
    corporate systems

Development may reach:
    Shared Services

Corporate systems may reach:
    approved production networks
    Shared Services

Development may not generally reach:
    production
    corporate production systems
```

This is a **routing policy**, not yet a port-level authorization policy.

Security groups and firewalls narrow the reachable networks to actual allowed services.

---

## 7.2 Associations

| Incoming attachment | Associated TGW table |
| --- | --- |
| Orders production | `RT-Production` |
| Logistics production | `RT-Production` |
| Development | `RT-Development` |
| Shared Services | `RT-Shared` |
| Direct Connect gateway | `RT-Corporate` |
| VPN backup | `RT-Corporate` |

The inspection attachment will receive its own table when centralized egress is added.

---

## 7.3 Selected routes

### `RT-Production`

```text
10.10.0.0/16   → Orders attachment
10.11.0.0/16   → Logistics attachment
10.100.0.0/16  → Shared Services attachment
172.20.0.0/16  → preferred corporate connection
172.21.0.0/16  → preferred corporate connection
```

No general route to Development.

### `RT-Development`

```text
10.100.0.0/16  → Shared Services attachment
```

### `RT-Shared`

```text
10.10.0.0/16   → Orders attachment
10.11.0.0/16   → Logistics attachment
10.20.0.0/16   → Development attachment
172.20.0.0/16  → preferred corporate connection
172.21.0.0/16  → preferred corporate connection
```

### `RT-Corporate`

```text
10.10.0.0/16   → Orders attachment
10.11.0.0/16   → Logistics attachment
10.100.0.0/16  → Shared Services attachment
```

The preferred corporate connection is selected from the available Direct Connect and VPN routes, discussed shortly.

---

## 7.4 Packet walk: Orders to shared service

Assume:

```text
Orders application: 10.10.1.25
Shared API:         10.100.20.10:443
```

Forward path:

```text
Orders application
    ↓ subnet route: 10.100.0.0/16 → TGW
Orders attachment
    ↓ associated table = RT-Production
TGW route: 10.100.0.0/16 → Shared Services attachment
    ↓
Shared API
```

Return path:

```text
Shared API
    ↓ subnet route: 10.10.0.0/16 → TGW
Shared Services attachment
    ↓ associated table = RT-Shared
TGW route: 10.10.0.0/16 → Orders attachment
    ↓
Orders application
```

**The return packet does not reuse `RT-Production`.** It arrives through a different attachment and therefore uses that attachment’s associated table.

---

## 7.5 Shared reachability is not unrestricted trust

The Shared Services VPC has return routes to production and development.

That does not mean every shared server should be able to initiate arbitrary connections to both.

Northstar still limits:

```text
destination ports
source addresses or supported SG references
application credentials
administrative access
forwarding/proxy behavior
```

A compromised shared service is particularly dangerous because it sits near several trust boundaries.

---

## 7.6 Missing routes versus blackhole routes

Without a matching route, traffic is dropped.

But consider a later change:

```text
0.0.0.0/0 → central egress
```

Now a formerly unreachable production address might match the default route and travel to another routing layer.

Therefore, explicitly prohibited networks may need blackhole routes:

```text
RT-Development:
    10.10.0.0/16 → blackhole
    10.11.0.0/16 → blackhole
```

A blackhole route discards matching traffic. Longest-prefix selection lets the specific block override the general default route.

**Never review a route in isolation from the rest of the possible path.**

---

# 8. Sharing the network through AWS RAM

## 8.1 Owner and participant

The Network account owns the TGW and shares it through **AWS Resource Access Manager**.

```text
Network account:
    owns TGW
    owns TGW routing policy

Workload account:
    owns VPC
    creates permitted attachment
    owns workload subnet routes
    owns application security controls
```

A participant using a shared TGW does not gain permission to edit the owner’s TGW route tables or associations.

---

## 8.2 RAM is not role assumption

RAM shares supported resources for use by other principals or accounts.

It does not mean:

```text
Every participant becomes an administrator
in the resource-owner account.
```

The participant still needs appropriate IAM permission to perform its allowed operations. Resource ownership remains with the owner.

---

## 8.3 Controlled attachment workflow

Northstar’s platform workflow is:

```text
Allocate approved CIDR
    ↓
Create workload VPC
    ↓
Use RAM-shared TGW
    ↓
Create attachment
    ↓
Network team approves attachment
    ↓
Associate correct TGW route table
    ↓
Configure selected propagation
    ↓
Install VPC routes
    ↓
Validate allowed and forbidden paths
```

Automatic acceptance and default propagation can simplify a flat network, but Northstar disables broad automatic behavior because segmentation is a requirement.

---

## 8.4 Removing a share is not immediate disconnection

Unsharing a TGW does not automatically delete existing attachments.

Therefore:

```text
Remove RAM share
    ≠
quarantine connected VPC
```

Quarantine requires explicit routing, attachment, or network-policy changes.

---

## 8.5 Shared VPC versus shared-services VPC

These names describe different patterns.

**Shared-services VPC:**

```text
One VPC hosts DNS, directory, or internal applications.
Other VPCs connect to those services.
```

**Shared VPC/subnets through RAM:**

```text
The Network account owns the VPC and subnets.
Participant accounts launch supported resources
inside those shared subnets.
```

In the second pattern, participants own their application resources while the VPC owner controls the underlying network. VPC subnet sharing applies within an AWS Organization and does not make every service support every shared-subnet operation.

Northstar’s baseline keeps separate workload VPCs. Shared subnets remain an alternative when centralized VPC ownership is a stronger requirement.

---

# 9. Site-to-Site VPN

## 9.1 What VPN provides

AWS Site-to-Site VPN provides IPsec-encrypted network connectivity between AWS and a customer network.

The AWS side terminates on:

```text
Virtual private gateway
    → one attached VPC

Transit Gateway
    → many connected networks
```

The uploaded guide recommends TGW as the scalable termination point when several VPCs need the hybrid connection.

---

## 9.2 Customer gateway resource versus device

These are different objects:

```text
Customer gateway resource:
    AWS configuration describing the remote gateway

Customer gateway device:
    actual customer router, firewall, or software appliance
```

Creating the AWS resource does not configure the physical router in the data center. Its tunnel and routing configuration must also be installed.

---

## 9.3 Two tunnels

One AWS Site-to-Site VPN connection includes two tunnels.

Both should be configured so maintenance or failure of one AWS-side endpoint does not unnecessarily interrupt connectivity.

However:

```text
Two tunnels
    ≠
two customer routers
    ≠
two ISPs
    ≠
two data centers
```

Northstar adds independent customer gateways and connections where those failure domains matter.

---

## 9.4 Static routing versus BGP

**Static routing:** administrators configure destination networks explicitly.

**Dynamic routing with BGP:** routers exchange reachable network prefixes and withdraw routes when paths disappear.

For Northstar, BGP is preferable because Direct Connect and VPN must cooperate during failover.

A route advertisement is approximately:

> “This network prefix is reachable through me.”

An **Autonomous System Number**, or ASN, identifies a routing domain participating in that exchange. The Direct Connect material introduces BGP sessions and ASNs for precisely this role.

---

## 9.5 When VPN is the better initial choice

VPN is attractive when:

- connectivity is needed quickly;
- traffic volume is moderate;
- encryption is required;
- dedicated connectivity is not yet provisioned;
- a backup path is needed.

It is not automatically sufficient for a large, predictable bandwidth requirement. The Internet path, customer equipment, tunnel characteristics, and traffic pattern all affect performance.

---

# 10. Direct Connect: connection, VIF, and gateway

These three concepts should not be memorized as one object.

## 10.1 Connection

A Direct Connect connection supplies dedicated network connectivity between the customer network and AWS through a Direct Connect location.

Northstar still needs a path from each data center to that location, potentially involving a carrier.

Direct Connect improves control over the network path and can provide more predictable performance. It is not a guarantee that every application becomes low latency: distant databases and chatty protocols remain distant and chatty.

---

## 10.2 Virtual interface

A **virtual interface**, or VIF, is a logical connection carried over Direct Connect.

Different VIF types reach different AWS destinations:

| VIF | Destination pattern |
| --- | --- |
| **Private VIF** | A VPC through a VGW, directly or through a DX gateway |
| **Transit VIF** | A Direct Connect gateway associated with a TGW |
| **Public VIF** | Public AWS service endpoints |

A physical connection may carry several logical VIFs. Their configuration includes VLAN and BGP information.

---

## 10.3 Direct Connect gateway

A **Direct Connect gateway**, or DX gateway, is a globally available logical resource connecting Direct Connect virtual interfaces to supported AWS gateway associations.

It helps reuse connectivity across VPCs, accounts, and Regions.

It is not:

```text
an Internet Gateway
a NAT Gateway
a customer-managed EC2 router
a replacement for TGW route tables
```

Do not treat it as a general transit router between all its associated networks.

---

## 10.4 The three chains to remember

```text
One VPC:

Customer router
    → Direct Connect
    → private VIF
    → VGW
    → VPC
```

```text
Several VPCs through their VGWs:

Customer router
    → Direct Connect
    → private VIF
    → DX gateway
    → VGWs
    → VPCs
```

```text
Scalable hub:

Customer router
    → Direct Connect
    → transit VIF
    → DX gateway
    → Transit Gateway
    → attached VPCs
```

These are the architectural alternatives presented in the Domain 1 material. Its numerical limits are source-era details; the topology distinction is the durable learning target.

Northstar chooses the third chain.

---

## 10.5 Public VIF does not mean ordinary Internet transit

A public VIF can reach public AWS endpoints such as S3.

It is not a general Internet connection for:

```text
Google APIs
arbitrary package repositories
every external SaaS provider
```

Also, public endpoint addressing does not mean anonymous access. S3 still evaluates the signed request and its policies.

**Source clarification:** Accessing AWS public endpoints through a public VIF does not itself require a VPN. A VPN over that path is a separate encrypted-overlay design.

---

## 10.6 Allowed prefixes

For a TGW association, the DX gateway’s allowed-prefix configuration controls what AWS advertises toward the customer network.

This is not an application firewall.

Advertising:

```text
10.10.0.0/16
```

does not prove that:

- the TGW has a valid next hop;
- the destination security group permits access;
- the application is running.

The TGW-associated prefix mechanism can advertise configured prefixes even when no matching VPC currently provides them. Keep advertisements aligned with actual reachability.

---

# 11. Private connectivity, encryption, and resilience

## 11.1 Direct Connect is not encrypted by default

These are separate properties:

```text
Private path:
    avoids ordinary public Internet routing

Encrypted traffic:
    cannot be read without the relevant keys
```

Direct Connect does not automatically encrypt application traffic. Use TLS, IPsec, or supported MACsec configurations according to the requirement.

Northstar requires TLS for sensitive application protocols in the baseline.

---

## 11.2 Stronger requirement: encrypt all hybrid packets

When policy requires IPsec protection independent of application protocols, combine Direct Connect with a VPN overlay.

Two important patterns are:

```text
Classic pattern:
    public VIF
    → public AWS VPN endpoints
    → IPsec tunnel
    → TGW or VGW
```

```text
Private-IP VPN over Direct Connect:
    transit VIF
    → DX gateway
    → TGW
    → private-IP VPN termination
```

The underlay transports packets; IPsec protects their contents.

---

## 11.3 VPN over DX is not independent DX backup

```text
IPsec tunnel carried over Direct Connect
    ↓
Direct Connect path fails
    ↓
tunnel also loses its transport
```

For independent backup, Northstar uses separate Internet connectivity:

```text
Primary:
    Direct Connect

Backup:
    Site-to-Site VPN over independent Internet path
```

These solve different problems:

```text
VPN over DX:
    encryption

VPN alongside DX:
    alternative transport
```

---

## 11.4 MACsec

MACsec encrypts the supported Ethernet link between adjacent devices.

It is useful for link-layer protection, but it is not automatically end-to-end encryption across every carrier segment and application hop.

Do not treat:

```text
MACsec enabled on one supported link
```

as proof that all traffic is encrypted from application to application.

---

## 11.5 Diverse connections

Northstar’s critical connectivity uses separate:

- customer routers;
- Direct Connect locations;
- carrier paths where feasible;
- power and facility dependencies.

A Link Aggregation Group can combine links, but links in one location do not protect against losing that entire location. AWS’s resiliency guidance distinguishes connection redundancy from device and location diversity.

---

## 11.6 Backup capacity must match the recovery objective

Suppose the normal path carries substantial batch replication plus a small amount of interactive business traffic.

The VPN backup may preserve:

```text
authentication
DNS
interactive ERP operations
administrative access
```

while pausing bulk transfer.

That is a valid design **only if degraded operation is accepted**.

A backup path that technically connects but becomes saturated immediately is not a useful recovery design.

---

# 12. Failover routing and longest-prefix traps

## 12.1 Route preference is not “DX always wins”

For TGW routes with the **same destination prefix**, a propagated Direct Connect gateway route is preferred over a propagated Internet VPN route.

But prefix specificity is evaluated first.

Example:

```text
172.20.0.0/16   → Direct Connect
172.20.20.0/24  → VPN
```

Traffic to:

```text
172.20.20.10
```

uses the VPN because `/24` is more specific than `/16`.

---

## 12.2 Static-route trap

Suppose an administrator installs a static route to the VPN for the same prefix that is learned through Direct Connect.

The static route can override the preferred propagated path.

A harmless-looking “backup route” may become the active primary route.

This is why Northstar tests the **effective route**, not just whether both connections show healthy status.

---

## 12.3 Both directions need policy

AWS selects the path toward the data center.

The customer router independently selects the path toward AWS.

Northstar must align both sides so failover does not create undesirable asymmetry, especially when stateful firewalls lie on the paths.

A BGP session being up proves that routing peers can exchange routes. It does not prove that ERP transactions succeed.

---

## 12.4 Failure test

Northstar tests:

```text
Disable one DX connection.
Disable one customer router.
Withdraw an advertised prefix.
Disable one VPN tunnel.
Simulate loss of a DX location.
Restore the preferred connection.
```

For each test, record:

```text
time to recover
effective route in each direction
available throughput
application behavior
DNS and authentication behavior
stateful session disruption
```

---

# 13. Adding a second Region

## 13.1 A TGW is Regional

A VPC in a second Region uses a TGW in that Region.

Northstar can peer the two TGWs:

```text
TGW primary Region
    ↔
TGW Europe
```

Ordinary TGW peering requires explicit routes toward the peering attachment on both sides; routes are not automatically propagated across that peering relationship.

---

## 13.2 Source-era limitation to discard

The uploaded Domain 1 guide says TGWs cannot be peered within the same Region.

Current AWS documentation supports TGW peering in the **same or different Regions**, including across accounts.  

The enduring lesson is still that each gateway has its own routing policy.

---

## 13.3 Connectivity is not disaster recovery

Adding:

```text
a second TGW
a second VPC
an inter-Region route
```

does not replicate:

- databases;
- object data;
- application capacity;
- credentials;
- DNS failover policy.

This creates a network path. A later disaster-recovery lesson designs the service that uses it.

---

# 14. DNS: learn the name path separately

## 14.1 DNS is not an application proxy

Consider:

```text
erp.corp.northstar.example
    → 172.20.20.10
```

There are two separate interactions:

```text
DNS transaction:
    client asks resolver for an address

Application transaction:
    client connects directly to that address
```

The application’s HTTPS packets do not ordinarily pass through the DNS server.

This distinction prevents a common misleading diagram:

```text
Client → DNS → application
```

The arrows should be read as two transactions, not one packet-forwarding chain.

---

## 14.2 Northstar namespaces

For the lesson:

```text
corp.northstar.example
    authoritative corporate DNS on premises

aws.northstar.example
    Route 53 private hosted zones for AWS applications

ad.northstar.example
    AWS Managed Microsoft AD namespace
```

Separate namespaces reduce accidental forwarding loops and ambiguity.

---

## 14.3 Private hosted zone

A Route 53 private hosted zone holds records visible through associated VPCs.

Example:

```text
orders.aws.northstar.example
    → internal application destination
```

The zone is not a DNS appliance installed in the Shared Services subnet.

Associating it with a VPC makes the namespace available to that VPC’s resolver. It does not establish application routing to the returned addresses.

---

# 15. Route 53 Resolver inbound and outbound endpoints

The detailed endpoint design here expands the guide’s DNS material using official AWS documentation.

## 15.1 Inbound endpoint

An inbound Resolver endpoint lets a network outside the VPC ask AWS Resolver to resolve names.

```text
Corporate DNS
    → inbound Resolver endpoint
    → private AWS name resolution
```

**Inbound means into the AWS Resolver environment**, not “DNS replies are coming inward.”

---

## 15.2 Outbound endpoint

An outbound Resolver endpoint lets AWS Resolver forward selected queries to another DNS system.

```text
AWS workload
    → VPC Resolver
    → forwarding rule
    → outbound Resolver endpoint
    → corporate DNS
```

**Outbound means the DNS query is forwarded from AWS toward the external resolver.**

---

## 15.3 Endpoint placement

Northstar creates endpoint IPs in two AZs in the Shared Services VPC.

Example:

```text
Inbound:
    10.100.1.10
    10.100.2.10

Outbound:
    10.100.1.20
    10.100.2.20
```

AWS requires at least two IP addresses in different AZs for these endpoint configurations. Ordinary DNS designs must permit both UDP and TCP port 53 along the required path.

---

## 15.4 Corporate query for an AWS name

The corporate DNS servers have a conditional forwarder:

```text
aws.northstar.example
    → 10.100.1.10
    → 10.100.2.10
```

Query walk:

```text
Employee asks:
    orders.aws.northstar.example

Corporate DNS
    ↓ conditional forwarder
DX or VPN
    ↓
TGW
    ↓
Shared Services inbound endpoint
    ↓
Route 53 Resolver
    ↓
associated private hosted zone
    ↓
private address returned
```

The private hosted zone must be associated with the inbound endpoint’s VPC so that its Resolver context can answer the query.

The employee then opens a **separate** connection to the returned application address.

---

## 15.5 AWS query for a corporate name

Northstar creates a forwarding rule:

```text
Domain:
    corp.northstar.example

Targets:
    172.20.10.10
    172.21.10.10

Outbound endpoint:
    shared corporate DNS endpoint
```

Query walk:

```text
Orders workload
    ↓
local Amazon-provided Resolver
    ↓ matching forwarding rule
shared outbound endpoint
    ↓ VPC/TGW/DX-or-VPN route
corporate DNS
    ↓
ERP address returned
```

The outbound endpoint’s VPC—not necessarily the original workload VPC—needs the network path to the corporate DNS servers.

---

## 15.6 Share forwarding rules with RAM

The DNS team shares the forwarding rule through RAM.

Each authorized workload VPC associates the shared rule.

This allows many VPCs to use one centrally managed outbound endpoint rather than deploying identical endpoint pairs everywhere. Sharing the rule also shares use of the associated outbound endpoint.

Receiving a RAM share does not replace the required rule-to-VPC association.

---

## 15.7 Cross-account private hosted zones

For ordinary direct cross-account association:

```text
Zone owner:
    authorizes the target VPC association

VPC owner:
    associates its VPC with the zone
```

The relevant APIs include:

```text
CreateVPCAssociationAuthorization
AssociateVPCWithHostedZone
```

This is separate from TGW attachment and separate from sharing Resolver forwarding rules.

---

# 16. DNS failure patterns

## 16.1 Resolution does not prove connectivity

Development may use a shared DNS rule to resolve:

```text
erp.corp.northstar.example
```

while its TGW routing policy prevents reaching the ERP subnet.

That is not contradictory.

```text
Knowing the address
    ≠
being allowed to connect
```

Whether Development should even learn the name is a separate information-exposure decision.

---

## 16.2 Do not forward to another VPC’s `.2` resolver

The Amazon-provided VPC resolver address is not a general DNS endpoint to target from arbitrary connected networks.

Use a Route 53 Resolver inbound endpoint for supported inbound hybrid resolution.

---

## 16.3 Missing private record does not imply public fallback

Suppose a private hosted zone matches:

```text
northstar.example
```

but lacks:

```text
www.northstar.example
```

A query from an associated VPC can receive `NXDOMAIN` rather than falling back to the public hosted zone.

A private zone is authoritative for its matching namespace in that resolution context. Plan split-horizon DNS deliberately.

---

## 16.4 Avoid forwarding loops

A loop can look like:

```text
Corporate DNS forwards aws.northstar.example to AWS.
AWS forwards the same namespace back to corporate DNS.
```

The query circulates until it fails.

Assign a clear authoritative owner to every namespace and use the most specific appropriate forwarding rules.

---

## 16.5 DHCP option sets

DHCP option sets configure values such as the DNS servers advertised to EC2 instances.

For ordinary AWS applications, Northstar keeps Amazon-provided DNS and uses Resolver rules for corporate namespaces.

For domain-joined Windows systems, Northstar may use AD DNS servers configured with the required forwarding paths.

The guide notes that a VPC has one associated DHCP option set at a time; changing its values requires creating and associating another set rather than editing the existing set.

---

# 17. Directory Service: identities that are not IAM roles

## 17.1 Why a directory remains necessary

Some legacy applications require:

```text
Windows domain join
Kerberos
LDAP
Group Policy
Windows-integrated authentication
```

IAM Identity Center does not replace all those operating-system and application protocols.

The distinction is:

```text
IAM / Identity Center:
    workforce access to AWS accounts and applications

Active Directory:
    directory identities, domain membership,
    Kerberos/LDAP, and domain policy
```

The source’s shared-directory section assumes exactly this kind of directory-aware workload.

---

## 17.2 AWS Managed Microsoft AD

For selected production Windows workloads, Northstar creates a managed resource forest in AWS.

AWS operates the domain-controller infrastructure, with domain controllers deployed across AZs. Northstar manages directory users, groups, policy, trust, and application permissions within the supported administrative model.

In this baseline:

```text
Corporate directory:
    corp.northstar.example
    existing employee identities

AWS resource directory:
    ad.northstar.example
    cloud Windows resources
```

A trust relationship allows approved corporate identities to access selected resources in the AWS directory.

---

## 17.3 Trust is not replication

A trust says approximately:

> This directory can accept identities authenticated by the other directory for permitted resource access.

It does not automatically copy every corporate user into the AWS directory.

Therefore, newly authenticating corporate users may still depend on corporate domain-controller reachability, even when the AWS resource forest remains available.

---

## 17.4 AD Connector

AD Connector proxies supported authentication requests to an existing Active Directory.

It is appropriate when the requirement is:

```text
Use existing on-premises AD.
Do not maintain a copy of directory identities in AWS.
```

It does not create a new managed AD forest or remove the dependency on the original directory. This is also the explicit selection scenario in the study guide.  

---

## 17.5 Current alternatives

Two current details should not be confused with the older foundational comparison:

**Managed Microsoft AD Hybrid Edition** can deploy AWS-managed domain controllers as an extension of an existing on-premises domain. That is different from the baseline’s separate resource forest plus trust.

**Simple AD** is a more limited directory option and is closed to new customers. It is not Northstar’s new hybrid enterprise-directory choice.

The useful distinction to learn now remains:

```text
Managed directory in AWS:
    AWS Managed Microsoft AD

Proxy existing on-premises directory:
    AD Connector
```

---

# 18. Directory sharing, trust, and application access

## 18.1 Directory sharing

Northstar can share its Managed Microsoft AD with approved workload accounts in the Region.

That lets supported resources in those accounts use the centrally owned directory.

Sharing does not create:

- TGW routes;
- security-group rules;
- domain credentials;
- an AD trust;
- application permissions.

The source explicitly requires network connectivity before directory-aware resources can use a shared directory.

---

## 18.2 Important ownership detail

The `ORGANIZATIONS` sharing method requires the directory to be owned in the organization’s management account.

Northstar’s directory is intentionally in a **Shared Services member account**.

It therefore uses the `HANDSHAKE` method, which can share with accounts either inside or outside the organization. Do not move ordinary directory workloads into the management account merely to use the organization-sharing shortcut.

---

## 18.3 Four gates for a Windows application

```text
AWS control plane:
    Was the directory correctly shared and associated?

Networking and DNS:
    Can the machine discover and contact the required DCs?

Directory authentication:
    Does the user or computer authenticate successfully?

Application authorization:
    Is that identity allowed to use this application?
```

An IAM role that can call `ec2:RunInstances` does not automatically grant a Windows user permission to access a file share.

---

## 18.4 Network ports

Active Directory uses several protocols, not just HTTPS.

Relevant families include:

```text
DNS
Kerberos
LDAP or LDAPS
SMB
RPC
time synchronization
```

Northstar uses the documented port requirements for the selected domain-join, trust, and application operations rather than assuming “allow 443” is sufficient.

The ordinary Development network remains isolated from corporate production systems. Any required directory path is a specific reviewed exception, not permission to route the entire corporate estate into Development.

---

# 19. Meridian: publish the service, not the network

## 19.1 Requirement

Northstar’s Orders application must call:

```text
Meridian inventory availability API
```

It does not need:

```text
Meridian databases
Meridian administrator ports
every Meridian subnet
general bidirectional routing
```

Both VPCs use `10.10.0.0/16`.

**PrivateLink is a stronger fit than a forced network merger.**

---

## 19.2 Provider side

For the NLB-backed endpoint-service pattern, Meridian configures:

```text
Inventory application
    behind
Network Load Balancer
    exposed as
VPC endpoint service
```

It allows only approved consumer principals and requires acceptance of connection requests.

---

## 19.3 Consumer side

Northstar creates an interface endpoint in the Orders VPC.

```text
Endpoint ENI:
    10.10.5.50

Orders application:
    connects to 10.10.5.50:443
```

That address belongs to Northstar’s own VPC.

The connection reaches Meridian’s service through PrivateLink without introducing a route to Meridian’s overlapping CIDR. This is why service connectivity can succeed while ordinary network routing cannot.

---

## 19.4 Connection direction

For this pattern:

```text
consumer initiates connection
provider returns responses
```

PrivateLink does not give Meridian general permission to initiate arbitrary new connections into Northstar.

It is not a full bidirectional VPC connection.

---

## 19.5 Authorization remains layered

The provider’s allowed-principal list and connection acceptance control whether the consumer can establish an endpoint connection.

They do not decide whether a particular caller may read a particular inventory record.

The application still uses:

```text
TLS
service authentication
customer or tenant authorization
request validation
```

---

## 19.6 Packet and identity trace

```text
Orders runtime
    ↓ obtains approved service credential
Secrets Manager
    ↓
inventory service request
    ↓
local interface endpoint ENI
    ↓
PrivateLink
    ↓
Meridian NLB
    ↓
inventory application
    ↓
application validates caller and requested operation
```

IAM authorizes retrieval of the service credential.

The inventory application authorizes the business request.

PrivateLink supplies the private transport boundary.

---

# 20. Private access to AWS services

## 20.1 Gateway endpoints

S3 and DynamoDB gateway endpoints are route-table targets for workloads in the endpoint’s VPC.

For example:

```text
Orders VPC route:
    S3 prefix list → S3 gateway endpoint
```

They are not general shared gateways that on-premises clients can traverse through TGW, VPN, or peering.

---

## 20.2 On-premises S3 access

Northstar has two relevant designs:

```text
Public AWS endpoint path:
    on premises
    → Direct Connect public VIF
    → public S3 endpoint
```

```text
Private endpoint path:
    on premises
    → DX or VPN
    → TGW/VPC routing
    → S3 interface endpoint
    → S3
```

S3 interface endpoints support access from on-premises networks over Direct Connect or VPN.

Do not answer “use the central S3 gateway endpoint” for that second requirement.

---

## 20.3 Central interface endpoints

Northstar can centralize selected interface endpoints when several VPCs need the same AWS service.

But centralization requires more than network reachability:

```text
routes to endpoint ENIs
endpoint security group
correct private DNS
endpoint policy where supported
IAM and service-resource permissions
```

The endpoint’s private DNS configuration does not automatically become visible in every TGW-connected VPC. Design the DNS associations or forwarding explicitly.

---

## 20.4 Endpoint-policy clarification

The uploaded cheat sheet says interface endpoints do not support endpoint policies. That is not a valid general rule today.

Supported AWS services can use interface endpoint policies. Those policies constrain use through the endpoint; they do not replace IAM or resource-policy grants.

For a customer-published custom endpoint service, do not assume that an endpoint policy supplies a generic IAM authorization layer for the application API.  

---

# 21. Centralized network inspection

## 21.1 Why another security layer?

Security groups already answer:

```text
May this source communicate with this destination and port?
```

Northstar additionally needs:

```text
central egress filtering
known malicious-destination blocking
intrusion detection and prevention
inspection of selected cross-network flows
consistent network policy
```

AWS Network Firewall is designed for managed network inspection using firewall policies and stateless/stateful rule groups. The attached cheat sheet also stresses that routes must send traffic through its endpoints.

---

## 21.2 Deploying a firewall does not route traffic through it

This is insufficient:

```text
Create Network Firewall.
Attach policy.
Assume the VPC is protected.
```

The actual path must be:

```text
source
    → firewall endpoint
    → destination
```

and the return path must be compatible with the stateful inspection path.

A firewall not on the route is not protecting that flow.

---

## 21.3 Egress path

For the VPC-based centralized egress pattern:

```text
Workload
    ↓
TGW
    ↓
Egress VPC attachment subnet
    ↓
same-AZ Network Firewall endpoint
    ↓
same-AZ NAT Gateway
    ↓
Internet Gateway
    ↓
Internet destination
```

The firewall inspects traffic.

The NAT Gateway translates addresses.

They are not substitutes.

---

## 21.4 Return path

The return path is equally important:

```text
Internet response
    ↓
Internet Gateway
    ↓
NAT Gateway reverses translation
    ↓
Network Firewall endpoint
    ↓
TGW
    ↓
original workload VPC
```

The NAT subnet’s routes for workload CIDRs must send responses through the firewall, rather than bypassing inspection directly to TGW.

---

## 21.5 Preserve segmentation after adding default egress

Suppose Development has:

```text
0.0.0.0/0 → Egress attachment
```

and the egress-associated TGW table knows routes back to all VPCs.

Without additional controls, a supposedly blocked internal destination could follow the default route into a path that eventually reaches production.

Northstar therefore retains explicit blocked-prefix routes and appropriate firewall policy. Central egress must not accidentally become a back door between segments.

---

## 21.6 East-west inspection and appliance mode

For stateful inspection **between VPC attachments**, packets must traverse the same inspection path in both directions.

TGW appliance mode on the inspection VPC attachment helps keep a flow in the same inspection AZ. Northstar also configures the pre-inspection and post-inspection route tables deliberately.

Conceptually:

```text
Source attachment
    ↓ pre-inspection TGW table
Inspection VPC
    ↓ firewall
TGW again
    ↓ post-inspection table
Destination attachment
```

Do not infer that appliance mode is universally mandatory for every centralized NAT-egress design. The requirement depends on the traffic pattern; AWS’s pure centralized IPv4 NAT-egress example does not require it.

---

## 21.7 Encryption and inspection

A stateful firewall cannot inspect arbitrary encrypted application content merely because traffic passes through it.

Full TLS inspection requires an explicit supported configuration and certificate/trust design. Network metadata or TLS handshake information is not the same as decrypted application payload.

---

## 21.8 Current deployment option

AWS now also supports Network Firewall integration through a TGW network-function attachment, reducing the need to manage a separate inspection VPC manually.

The lesson uses the established VPC-endpoint pattern because it exposes the routing and symmetry concepts clearly. The newer integration does not eliminate the need to decide which traffic must traverse inspection.

---

# 22. Network Firewall versus other controls

| Requirement | Appropriate control |
| --- | --- |
| Allow application port from one workload group | Security group |
| Coarse subnet-level allow/deny | Network ACL |
| Inspect and filter routed network traffic | Network Firewall |
| Deploy a required third-party inspection appliance | Gateway Load Balancer pattern |
| Inspect HTTP requests at a supported web entry point | AWS WAF |
| Protect against DDoS attacks | AWS Shield |
| Centrally distribute supported firewall policies | AWS Firewall Manager |

These controls solve different problems. Firewall Manager governs policy deployment; it is not itself the packet-inspection engine. A Gateway Load Balancer becomes relevant when the requirement specifies a third-party firewall or appliance rather than AWS-native Network Firewall.

---

# 23. IAM architecture and delegated ownership

## 23.1 Identity map

| Actor | Identity and responsibility |
| --- | --- |
| Network engineer | Federated role in Network account; manages TGW, DX, VPN, and routes |
| Workload deployment pipeline | Role in workload account; creates VPC resources and approved attachments |
| DNS administrator | Role managing hosted zones, Resolver endpoints, and rules |
| Directory administrator | AWS directory-management permissions plus separate AD administrative rights |
| Meridian provider administrator | Manages NLB endpoint service and approved consumers |
| Orders application | Runtime role for AWS APIs; separate application identity for inventory API |
| Security engineer | Firewall-policy and investigation authority |
| Auditor | Read-only network configuration and logs |

---

## 23.2 Network control plane versus application data plane

Consider an Orders application calling ERP.

**Network engineer’s IAM role:**

```text
creates attachment
edits route table
configures security group
```

**Application packet:**

```text
10.10.1.25 → 172.20.20.10:443
```

That ordinary HTTPS packet does not require the application to possess an IAM permission called “use Transit Gateway.”

The destination’s own authentication and authorization still apply.

---

## 23.3 Control who can create bypass paths

Network segmentation is weak if every workload administrator can create:

```text
unapproved peering
unapproved VPN
public endpoint
broad route
alternate Internet egress
```

Northstar’s IAM roles, SCPs, and infrastructure pipeline limit who may change those components.

An SCP can restrict creation or modification of network resources. It does not inspect each application packet.

---

## 23.4 Security-group reference update

The older guide says cross-VPC security-group references cannot be used through TGW.

Current AWS support permits **inbound** SG referencing between supported VPC attachments on the same TGW when the required settings are enabled. It does not generally extend through TGW peering or inspection paths.  

For hybrid destinations, Northstar still needs address-based rules because an on-premises router or server is not an AWS security group.

---

# 24. Operations, troubleshooting, and change

## 24.1 Provision networking through the platform

Lesson 6’s deployment process now creates:

```text
CIDR allocation
VPC and subnets
TGW attachment
explicit route associations
selected propagation
Resolver-rule associations
private-zone associations
security groups
logging
```

Every deployment tests both:

```text
Allowed flow succeeds.
Forbidden flow fails.
```

A green “stack deployed” result is not proof of the intended network policy.

---

## 24.2 Observability

| Question | Evidence |
| --- | --- |
| Who changed a route or security group? | CloudTrail |
| What is the resource configuration? | AWS Config |
| Is the DX connection or VPN tunnel healthy? | CloudWatch connection/tunnel metrics |
| Where is traffic flowing or being rejected? | VPC and TGW Flow Logs |
| Which DNS queries fail? | Resolver query logs |
| What did the firewall detect or drop? | Network Firewall logs |
| Can this configuration theoretically permit a path? | Reachability Analyzer |
| Does the application actually respond correctly? | Synthetic and application tests |

Flow logs record network-flow metadata, not complete packet payloads. An accepted network flow does not prove that TLS or application authentication succeeded.  

---

## 24.3 Reachability Analyzer

Reachability Analyzer evaluates the configured path between supported resources.

It does not send test packets and does not prove:

```text
the process is listening
the certificate is valid
the database password works
the application returns the correct result
```

Use configuration analysis together with actual connection and application tests.

---

## 24.4 Shared-service blast radius

Centralization saves duplication but increases the consequence of failure.

A bad shared change can affect:

```text
all corporate DNS lookups
all Internet egress
all hybrid access
all directory authentication
```

Northstar stages route, DNS, and firewall changes in a test VPC before expanding them, just as it staged SCP changes in Lesson 5.

---

## 24.5 Recovery objectives

A network recovery plan must specify more than “there is a backup link.”

It should define:

```text
maximum interruption
minimum backup throughput
which traffic is prioritized
whether existing sessions survive
whether reauthentication works
how preferred routing is restored
how rollback is performed
```

Network availability does not guarantee application availability if both paths lead to the same failed database.

---

# 25. Cost tradeoffs

The main cost drivers are:

```text
TGW attachments and data processing
Direct Connect ports and data transfer
carrier connectivity
VPN connections
Resolver endpoint capacity and queries
PrivateLink endpoints and data processing
NAT
Network Firewall
inter-Region transfer
logging and retention
Managed Microsoft AD
```

The useful optimization is architectural, not merely choosing the lowest hourly price.

**Peering** can be economical for a small number of direct relationships.

**TGW** can justify its additional cost by replacing complex routing and enabling central hybrid access.

**PrivateLink** can be economical when publishing a narrow service avoids a large network-integration project.

**Central endpoints and inspection** reduce duplication, but add shared dependencies and possibly additional TGW processing.

**Local S3 gateway endpoints** remain attractive for local VPC traffic rather than sending large S3 transfers through a central interface endpoint and routing hub.

Centralization is not automatically cheaper; compare the complete traffic path and the operational burden.

---

# 26. Changed-requirement variants

## Variant 1: Two VPCs, no shared hybrid transit

Use VPC peering if their CIDRs do not overlap and the relationship is simple.

A TGW may add cost and complexity without enough benefit.

---

## Variant 2: Connectivity is needed tomorrow

Start with Site-to-Site VPN.

Provision Direct Connect in parallel and later migrate primary routing while keeping VPN as the tested backup.

---

## Variant 3: Backup must carry full production load

A smaller Internet VPN fallback may be insufficient.

Use appropriately sized diverse Direct Connect paths and validate capacity after a device or location failure.

---

## Variant 4: Meridian needs complete network integration

PrivateLink is no longer a complete answer.

Plan renumbering or a deliberate address-translation/proxy architecture, and inventory protocols that embed IP addresses or initiate callbacks.

---

## Variant 5: Only one partner API is required

PrivateLink is preferable to broad peering or TGW access when the provider can publish a supported endpoint-service pattern.

Do not connect a complete network to solve a single-service requirement.

---

## Variant 6: No directory information may be maintained in AWS

AD Connector is a candidate for supported integrations.

The design remains dependent on the existing on-premises directory and its network path.

---

## Variant 7: AWS must extend the existing AD domain

Evaluate Managed Microsoft AD Hybrid Edition or a deliberately managed AD-extension architecture.

A separate forest plus trust is not the same requirement.

---

## Variant 8: The security team mandates a specific firewall vendor

Use Gateway Load Balancer with the supported virtual appliances and a suitable symmetric routing design.

Do not substitute AWS Network Firewall without confirming that the vendor requirement can be changed.

---

## Variant 9: Central team must own all VPCs

Use RAM-shared subnets where supported.

Keep workload resource ownership and IAM separation, but recognize that VPC routing and subnet administration now belong to the owner account.

---

## Variant 10: The company needs a worldwide WAN

Evaluate a broader global network-control model, potentially including AWS Cloud WAN.

Do not expand one manually managed TGW route table indefinitely simply because it worked for the first Region.

---

# 27. Failure drills

## A. The attachment is available, but the application cannot connect

Check both the workload subnet route and the TGW route selected by the source attachment’s association. Then check the return path and security controls.

An attachment is only one part of reachability.

## B. Orders reaches Shared Services, but replies never arrive

The forward route works. Inspect `RT-Shared`, the shared subnet’s return route, and stateless NACL response rules.

## C. Development suddenly reaches production after central egress is added

A default route may have created an indirect path through the egress VPC and its return-routing table.

Add or repair explicit segmentation and firewall policy.

## D. A RAM share was removed, but traffic still flows

Existing TGW attachments can remain. Remove or restrict the actual attachment/routing path rather than treating unsharing as quarantine.

## E. Direct Connect is healthy, but ERP uses VPN

The VPN may advertise a more-specific prefix, or a static route may override propagation.

Inspect effective route selection rather than link status.

## F. Both VPN tunnels fail together

They may share the same customer router, Internet circuit, or power source.

Two AWS tunnels do not remove those failure domains.

## G. Corporate DNS resolves an AWS name, but HTTPS times out

DNS succeeded. Test the separate application route, security groups, firewall, return path, and listener.

## H. AWS resolves public names but not corporate names

Check the forwarding rule, its VPC association, the shared outbound endpoint, and its route to the corporate DNS servers.

## I. On-premises queries sent to the VPC `.2` address fail

Use a Resolver inbound endpoint rather than targeting another network’s Amazon-provided resolver address.

## J. A public record disappears only for AWS clients

A matching private hosted zone may exist without that record. Private-zone matching does not automatically fall back to the public zone.

## K. PrivateLink endpoint is accepted, but the API returns `401`

Connectivity may be working. Endpoint acceptance is not application authentication.

## L. A central S3 gateway endpoint works for EC2 but not the data center

Gateway endpoints are not transit-accessible in that way. Use an appropriate S3 interface endpoint or public AWS endpoint path.

## M. Windows domain join fails even though the domain DNS name resolves

Check directory sharing, DC discovery, required ports, time synchronization, credentials, and directory permissions.

DNS success alone is insufficient.

## N. Corporate users cannot newly authenticate after WAN failure

A trust relationship did not replicate their identities into the AWS resource forest. The original authentication system may still be required.

## O. Firewall logs show only one direction

The return route may bypass the firewall, or cross-VPC traffic may use an inconsistent inspection AZ. Review symmetry and the appropriate appliance-mode setting.

## P. Small requests work, but larger transfers stall

Investigate MTU and fragmentation behavior along the VPN, inspection, and hybrid paths. A successful small ping does not prove that large application packets work.

## Q. An engineer can describe a database but cannot connect to it

IAM-authorized AWS control-plane access succeeded. Private database connectivity and database authentication are separate.

## R. Flow Logs show `ACCEPT`, but the database rejects the request

Network filtering permitted the flow. The database can still reject the username, password, TLS configuration, or SQL permission.

---

# 28. SAP-C02 decision boundaries

| Requirement | Strong candidate |
| --- | --- |
| Connect two nonoverlapping VPCs directly | VPC peering |
| Connect many VPCs and shared hybrid networks | Transit Gateway |
| Segment attached networks | Multiple TGW route tables plus security controls |
| Let another account use a central TGW | AWS RAM |
| Let accounts launch resources in centrally owned subnets | VPC sharing through RAM |
| Private access to one provider service | PrivateLink |
| One provider service despite overlapping CIDRs | PrivateLink endpoint-service pattern |
| Rapid encrypted hybrid connection | Site-to-Site VPN |
| Dedicated, predictable hybrid transport | Direct Connect |
| Direct Connect to TGW | Transit VIF → DX gateway → TGW |
| Direct Connect to a VGW/VPC | Private VIF |
| Direct Connect to public AWS endpoints | Public VIF |
| On-premises DNS asks AWS | Resolver inbound endpoint |
| AWS DNS forwards to on-premises | Resolver outbound endpoint and rule |
| Share corporate forwarding across VPCs | RAM-shared Resolver rule |
| AWS-hosted Microsoft directory | AWS Managed Microsoft AD |
| Proxy existing on-premises AD | AD Connector |
| Managed network inspection | Network Firewall |
| Required third-party appliance fleet | Gateway Load Balancer |
| Analyze configured network reachability | Reachability Analyzer |

The decisive words are not merely “private,” “hybrid,” or “secure.”

They are combinations such as:

```text
many networks + transitive routing
    → Transit Gateway

one service + overlapping CIDRs
    → PrivateLink

dedicated link + every packet encrypted
    → Direct Connect plus appropriate encryption
```

---

# 29. Retrieval practice

Try these without looking back.

1. Why does Northstar use both TGW and PrivateLink rather than choosing one for everything?
2. What does overlapping CIDR space make ambiguous?
3. Why can peering not let a spoke use the hub’s ordinary VPN connection?
4. What is the difference between a VPC route table and a TGW route table?
5. What determines which TGW route table evaluates an incoming packet?
6. What is the difference between association and propagation?
7. Which table handles replies from Shared Services to Orders?
8. Why can adding a default route weaken isolation?
9. What authority does a workload account receive from a RAM-shared TGW?
10. Does removing the RAM share necessarily disconnect existing attachments?
11. What is the difference between a shared-services VPC and RAM-shared subnets?
12. What is the difference between a customer gateway resource and device?
13. What do two VPN tunnels protect against—and what do they not protect against?
14. What do BGP peers exchange?
15. Which VIF connects Direct Connect to TGW?
16. Which VIF reaches public AWS endpoints?
17. Does Direct Connect encrypt traffic by default?
18. Why is VPN over DX different from VPN used alongside DX?
19. Why can a VPN route beat a Direct Connect route?
20. Why is a LAG not sufficient protection against a location failure?
21. What does the DX gateway allowed-prefix list fail to prove?
22. Which Resolver endpoint handles corporate queries for private AWS names?
23. Which endpoint forwards AWS queries to corporate DNS?
24. What else must happen after a Resolver rule is shared through RAM?
25. Does a private hosted zone create routes to its returned addresses?
26. Why might an AWS client receive `NXDOMAIN` for a name that exists publicly?
27. What is the difference between AD Connector and a managed AD resource forest?
28. Does an AD trust replicate all users into the other directory?
29. Which directory-sharing method fits a directory owned by Northstar’s Shared Services member account?
30. Why does PrivateLink solve the Meridian API problem?
31. Can on-premises clients use a VPC’s S3 gateway endpoint through TGW?
32. Why must both directions pass through a stateful firewall?
33. Does a normal application packet need an IAM permission to “use TGW”?
34. What can Reachability Analyzer prove—and what can it not prove?
35. Why does a redundant hybrid network not by itself provide application disaster recovery?

---

# 30. Answer key

| # | Answer |
| ---: | --- |
| 1 | TGW connects routed networks. PrivateLink exposes a selected service without merging networks, which is especially useful for Meridian’s overlap. |
| 2 | A destination address may exist in both networks, so it no longer identifies one unambiguous endpoint. |
| 3 | Peering is non-transitive and does not provide ordinary edge-to-edge use of a peer’s VPN or Direct Connect path. |
| 4 | The VPC table sends subnet traffic toward a target such as TGW. The TGW table chooses the next attachment. |
| 5 | The route table associated with the attachment through which the packet arrived. |
| 6 | Association chooses the table used by traffic **from** an attachment. Propagation installs routes **to** that attachment in selected tables. |
| 7 | `RT-Shared`, because the return packet enters TGW through the Shared Services attachment. |
| 8 | A previously unmatched destination may now follow an indirect path through egress or inspection infrastructure. |
| 9 | Permitted use of the shared gateway, such as creating its VPC attachment—not ownership of the TGW’s route tables. |
| 10 | No. Existing attachments can remain connected. |
| 11 | A shared-services VPC hosts common services for other VPCs. Shared subnets let multiple accounts place supported resources inside a centrally owned VPC. |
| 12 | The resource is AWS configuration describing the remote gateway. The device is the actual customer router or appliance. |
| 13 | They provide alternative AWS tunnel endpoints. They do not remove shared customer-router, ISP, power, or site failures. |
| 14 | Reachable network prefixes and routing information, including withdrawals when paths are lost. |
| 15 | A transit VIF through a Direct Connect gateway. |
| 16 | A public VIF. |
| 17 | No. Select TLS, IPsec, or supported MACsec protection according to the requirement. |
| 18 | VPN over DX uses DX as its transport and fails with it. An independent Internet VPN supplies another transport path. |
| 19 | Its prefix may be more specific, or a static route may override the propagated route. |
| 20 | Its member links still share the relevant location and associated failure dependencies. |
| 21 | It does not prove a working downstream route, security permission, listener, or application. |
| 22 | An inbound endpoint. |
| 23 | An outbound endpoint selected by a forwarding rule. |
| 24 | The consumer VPC must associate the rule, and the shared endpoint must have network access to the target DNS servers. |
| 25 | No. It supplies name resolution, not connectivity. |
| 26 | A matching private hosted zone lacks the name and does not fall back automatically to the public zone. |
| 27 | AD Connector forwards authentication to an existing directory. Managed Microsoft AD provides managed directory infrastructure in AWS. |
| 28 | No. Trust permits a defined authentication relationship; it is not automatic user replication. |
| 29 | `HANDSHAKE`, because the directory is not owned by the management account. |
| 30 | Orders connects to a local endpoint IP that exposes Meridian’s service without routing Meridian’s overlapping CIDR. |
| 31 | No. Use a suitable S3 interface endpoint or public AWS endpoint path. |
| 32 | The firewall tracks a flow; bypassing it or sending the reverse flow through an incompatible stateful path can break processing or inspection. |
| 33 | No. IAM governs TGW configuration. Ordinary application traffic is governed by routing, network controls, and application authentication. |
| 34 | It analyzes supported network configuration. It does not send packets or validate listeners, certificates, passwords, or application behavior. |
| 35 | The paths may remain healthy while the database or application fails. Data replication, capacity, recovery, and failover require separate design. |

---

# 31. What to memorize now

```text
VPC peering
    → two networks
    → non-transitive
    → no overlapping CIDRs

Transit Gateway
    → many networks
    → transitive routing
    → separate routing domains

PrivateLink
    → selected service
    → no general network merger
    → useful with overlapping CIDRs
```

```text
TGW association:
    Which table does traffic FROM this attachment use?

TGW propagation:
    Which tables learn routes TO this attachment?
```

```text
VPC subnet route
    → TGW

TGW route
    → destination attachment

Return traffic
    → a separate routing decision
```

```text
RAM
    → share use of supported resources

IAM
    → permit configuration operations

Routes and filters
    → permit packet paths
```

```text
Private VIF
    → VGW / VPC

Transit VIF
    → DX gateway → TGW

Public VIF
    → public AWS endpoints
```

```text
Direct Connect
    → private connectivity
    ≠ automatic encryption

VPN over DX
    → encrypted overlay

Independent Internet VPN
    → alternative transport
```

```text
Resolver inbound
    → external DNS asks AWS

Resolver outbound
    → AWS forwards to external DNS

Private hosted zone
    → private name records

DNS answer
    ≠ network reachability
```

```text
AWS Managed Microsoft AD
    → managed directory infrastructure

AD Connector
    → proxy existing directory

Directory share
    ≠ network connection
    ≠ AD trust
    ≠ application permission
```

```text
Network Firewall
    → inspect routed traffic

NAT Gateway
    → translate addresses

Stateful inspection
    → design the return path too
```

---

# 32. What can remain recognition-level

Do not try to memorize every networking limit or configuration field yet.

Keep these for later focused review:

```text
Detailed BGP attribute tuning
ECMP behavior for every attachment type
Direct Connect port and tunnel throughput limits
ASN selection edge cases
TGW Connect and SD-WAN integration
Every Active Directory port
Resolver DNS-over-HTTPS options
Route 53 Profiles
PrivateLink cross-Region configuration
Network Firewall TLS inspection setup
Advanced NAT designs for overlapping networks
AWS Cloud WAN policy syntax
```

The durable exercise is to take one interaction—such as Orders calling the corporate ERP—and explain it in two independent traces:

```text
Name and packet trace:
    corporate name
    → Resolver rule
    → outbound endpoint
    → corporate DNS
    → returned ERP address

    application packet
    → VPC route
    → TGW source-associated table
    → Direct Connect or VPN
    → corporate firewall
    → ERP listener
    → correctly routed response
```

```text
Identity and authority trace:
    network administrators configure the path through IAM
    → application authenticates to ERP
    → ERP authorizes the requested business operation
```

**A shared network should make approved interactions possible without making every interaction possible.**
