# Lesson 2 — Taking a Web Application Global

## Edge delivery, caching, traffic routing, and private content

### Source note

This lesson continues the Northstar application from Lesson 1. The business scenario and final architecture are a teaching synthesis.

The attached material supplies the underlying service concepts:

- CloudFront distributions, origins, cache behaviors, HTTPS, logging, origin failover, and edge security;  
- improving cache-hit ratio by controlling TTLs, cookies, headers, and query strings;
- S3 pre-signed URLs versus CloudFront signed URLs and Origin Access Control;
- Route 53 latency and weighted routing;
- WAF and Shield protection at the application and infrastructure layers;
- fault-tolerant Redis caching with replication and Multi-AZ failover.

Current terminology and behavior—particularly cache policies, origin-request policies, trusted key groups, and CloudFront VPC origins—were checked against current AWS documentation.

---

# 1. The project

## 1.1 Business brief

Northstar’s customer portal from Lesson 1 has become successful.

The company now has customers in:

```text
North America
South America
Europe
Asia-Pacific
```

Users interact with several types of content:

| Content | Example |
| --- | --- |
| Public static content | JavaScript, CSS, images, product pages |
| Public dynamic content | Product catalog, pricing summaries |
| Personalized content | Account information, subscriptions, billing |
| Private downloadable content | Reports and purchased documents |
| Write operations | Purchases, profile changes, support requests |

The application still runs in one AWS Region because:

- the engineering team is small;
- the relational database is the source of truth;
- the business has not yet specified a Regional-outage RTO;
- multi-Region writes would add significant consistency and operational complexity.

The new requirements are:

- reduce latency for globally distributed users;
- reduce traffic and connection load on the Regional application;
- distribute static and private files efficiently;
- prevent direct access to the S3 origin;
- prevent users from downloading another customer’s report;
- absorb sudden traffic spikes from marketing campaigns;
- protect the public application from common web attacks and DDoS events;
- accelerate common reads without weakening transactional correctness;
- preserve the IAM and network isolation established in Lesson 1.

---

## 1.2 The central architectural distinction

A globally used application is not necessarily a multi-Region application.

Northstar can have:

```text
Global entry point
Global edge delivery
Global caching
Regional application origin
Regional transactional database
```

CloudFront can move content and the initial network entry point closer to users while the application and database remain in one Region.

Therefore:

```text
Global delivery
    ≠
Regional disaster recovery

Edge caching
    ≠
Multi-Region data replication
```

The baseline architecture improves global performance and origin resilience, but it does not yet survive complete loss of the application Region.

---

# 2. Constraint ledger

| Dimension | Requirement |
| --- | --- |
| Audience | Globally distributed customers |
| Protocol | HTTPS web application and APIs |
| Static content | Cache aggressively |
| Dynamic public content | Cache selectively |
| Personalized content | Never leak between users |
| Private files | Delivered globally to authorized users |
| Transactions | Strongly consistent central writes |
| Availability | Survive instance and AZ failures |
| Security | WAF, DDoS protection, private origins, least privilege |
| Performance | Lower latency and database load |
| Operations | Small team; managed services preferred |
| Cost | Avoid unnecessary origin traffic and overprovisioning |
| Disaster recovery | Full Regional outage not yet covered |

---

# 3. Baseline architecture

```text
                                      Global AWS edge
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                Route 53                                    │
│                                   │                                        │
│                         portal.northstar.example                            │
│                                   │ Alias                                  │
│                                   ▼                                        │
│                              CloudFront                                    │
│                         AWS WAF + Shield                                    │
│                                   │                                        │
│              ┌────────────────────┼──────────────────────┐                 │
│              │                    │                      │                 │
│      /assets/* and /*       /downloads/*             /api/*               │
│              │                    │                      │                 │
│              ▼                    ▼                      ▼                 │
│       Static S3 origin     Private S3 reports      Regional ALB origin     │
│             OAC              OAC + signed                 │                │
│                           URL or signed cookie            │                │
└───────────────────────────────────────────────────────────┼────────────────┘
                                                            │ HTTPS
                                                            ▼
                                      Application Region
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                        Internet-facing ALB                                 │
│                    restricted to CloudFront                                │
│                              │                                             │
│                 ┌────────────┴────────────┐                                │
│                 ▼                         ▼                                │
│          Private app subnet A      Private app subnet B                    │
│              EC2 ASG                    EC2 ASG                            │
│                 │                         │                                │
│                 └────────────┬────────────┘                                │
│                              │                                             │
│              ┌───────────────┼────────────────┐                            │
│              ▼               ▼                ▼                            │
│      ElastiCache Redis    RDS primary      RDS read replica                │
│       Multi-AZ group      + Multi-AZ       for suitable reads              │
│                                                                            │
│       CloudWatch metrics, logs and alarms                                  │
│       CloudTrail configuration history                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

## Architecture in one sentence

> Route 53 directs users to CloudFront, where WAF inspects requests and cache behaviors select either a private S3 origin or the Regional application origin; the application remains stateless across two Availability Zones and uses Redis and an RDS read replica to reduce pressure on the transactional database.

---

# 4. What changed from Lesson 1?

Lesson 1 used this path:

```text
User
  → Route 53
  → ALB
  → EC2
  → RDS / S3
```

Lesson 2 inserts a global edge layer:

```text
User
  → Route 53
  → CloudFront
  → S3 or ALB
  → EC2
  → Redis / RDS
```

This adds several new architectural concepts:

1. **An origin** is the system from which CloudFront retrieves content.
2. **A cache behavior** determines how CloudFront handles requests matching a path pattern.
3. **A cache key** determines which requests may share one cached response.
4. **An origin-request policy** determines what CloudFront sends to the origin without necessarily varying the cached object.
5. **Viewer authorization** controls who may request private content from CloudFront.
6. **Origin authorization** controls whether CloudFront may retrieve content from S3.
7. **Edge caching** reduces global latency and Regional load.
8. **Regional caching** through Redis reduces repeated application and database work.

CloudFront cache behaviors associate path patterns with origins and policies. Cache policies determine TTLs and which headers, cookies, and query strings contribute to the cache key; origin-request policies can forward additional values without including them in the cache key.

---

# 5. The global request path

## 5.1 Route 53: name to global entry point

Northstar creates a Route 53 alias record:

```text
portal.northstar.example
    ↓
CloudFront distribution
```

Route 53 answers the DNS question:

> Which AWS entry point corresponds to this hostname?

It does not:

- cache HTTP objects;
- inspect web requests;
- authenticate users;
- route requests by URL path;
- connect directly to the database.

The baseline uses a simple alias because CloudFront itself is already the global application entry point.

---

## 5.2 CloudFront: edge proxy and cache

The viewer establishes HTTPS with a nearby CloudFront edge location.

CloudFront then:

1. matches the request to a cache behavior;
2. computes its cache key;
3. checks whether an unexpired matching response exists;
4. returns the cached response on a hit;
5. contacts the selected origin on a miss;
6. optionally stores the origin response;
7. returns the result to the viewer.

CloudFront caching reduces both latency and the number of requests that the origin must process. The proportion of requests served from cache is the **cache-hit ratio**.

---

## 5.3 Regional ALB

Dynamic requests that require the application are forwarded from CloudFront to the Regional ALB.

The ALB still performs:

- HTTP listener processing;
- target-group selection;
- target health checking;
- distribution across healthy EC2 instances;
- Availability Zone-level workload balancing.

CloudFront and ALB are not alternatives here:

```text
CloudFront
    → global edge, caching, viewer security

ALB
    → Regional Layer 7 load balancing among application targets
```

---

# 6. CloudFront distribution design

## 6.1 Origins

Northstar configures two logical origins:

```text
StaticOrigin
    private S3 bucket

ApplicationOrigin
    Regional Application Load Balancer
```

A later architecture might add:

```text
SecondaryStaticOrigin
SecondaryRegionalApplicationOrigin
Media origin
API Gateway origin
```

An origin is where CloudFront goes when it cannot satisfy a request from its cache.

---

## 6.2 Cache behaviors

A useful baseline is:

| Path pattern | Origin | Cache behavior |
| --- | --- | --- |
| `/assets/*` | S3 | Long TTL, public viewer access |
| `/downloads/*` | S3 | Cacheable, signed viewer access |
| `/api/catalog/*` | ALB | Short TTL if response is public and identical |
| `/api/*` | ALB | Caching disabled |
| `/*` | S3 | Frontend application shell |

CloudFront processes nondefault cache behaviors in configured order. A poorly ordered behavior can accidentally route a private path through a public behavior, so path design is a security concern as well as a performance concern.

### Example danger

Suppose:

```text
/downloads/*
    requires signed access

/*
    is public
```

If configuration causes the broad public behavior to match first, private files can become available without signatures.

**Memory rule:**

> A cache behavior is simultaneously a routing rule, cache rule, protocol rule, and viewer-access rule.

---

# 7. Cache keys

## 7.1 The fundamental cache equation

Conceptually, CloudFront identifies a cached object through:

\[
K =
(
\text{path},
\text{selected query strings},
\text{selected headers},
\text{selected cookies},
\text{encoding variant}
)
\]

Two requests with the same key may receive the same cached response.

That produces two symmetric risks.

### Too few dimensions

The cache key does not include something that changes the response.

```text
User A requests /api/dashboard
User B requests /api/dashboard

Cache key:
    only /api/dashboard
```

If the response is personalized, User B could receive User A’s cached response.

This is a critical security failure.

### Too many dimensions

The key includes irrelevant request variation:

```text
tracking query parameter
session cookie
unneeded browser header
random request ID
```

Every request becomes a different cache object.

Result:

```text
low cache-hit ratio
high origin load
higher cost
higher latency
```

The attached material specifically recommends forwarding only query parameters, cookies, and headers that produce distinct origin responses.

---

## 7.2 Cache policy versus origin-request policy

### Cache policy

Answers:

> Which viewer-request values define a distinct cached representation?

It controls:

- cache-key headers;
- cache-key cookies;
- cache-key query strings;
- minimum, default, and maximum TTL;
- compressed-content variants.

### Origin-request policy

Answers:

> Which additional viewer-request values must the origin receive even though they should not split the cache?

For example:

```text
Cache key:
    path + product language

Origin request:
    path + product language + tracing header
```

The tracing header is useful to the application but does not change the returned product representation.

Any value included in the cache key is automatically forwarded to the origin. Origin-request policies supply additional values without adding them to the key.

---

## 7.3 Personalized APIs

Northstar disables caching for:

```text
/api/account/*
/api/billing/*
/api/subscriptions/*
/api/orders/*
```

These endpoints are:

- authenticated;
- personalized;
- frequently modified;
- correctness-sensitive.

CloudFront can still provide:

- the edge network entry point;
- TLS;
- WAF inspection;
- persistent origin connections;
- request normalization;
- DDoS protection.

“Not cached” does not mean “CloudFront provides no value.”

---

## 7.4 Public API caching

Northstar may cache:

```text
GET /api/catalog/product-42?language=es
```

provided that:

- the method is safe and idempotent;
- the response is not customer-specific;
- authorization does not change it;
- the cache key includes every response-changing parameter;
- an acceptable TTL is defined;
- stale content is tolerable for that TTL.

A possible key is:

```text
path
+
language
+
currency
```

A poor key might also include:

```text
analytics cookie
session ID
request ID
```

Those values would fragment the cache without changing the catalog result.

---

# 8. TTLs, versioning, and invalidation

## 8.1 Long-lived immutable assets

Frontend builds generate versioned objects:

```text
/assets/app.7f31ab2.js
/assets/vendor.a421f0c.css
/images/logo.2026-08.svg
```

Because a content change creates a new name, these objects can receive long cache lifetimes.

```text
new release
    → new object key
    → no need to overwrite cached object
```

This is usually preferable to repeatedly invalidating the same filenames.

---

## 8.2 Short-lived public data

Product catalog responses might use a short TTL:

```text
30 seconds
5 minutes
15 minutes
```

The correct duration depends on:

\[
\text{latency and origin savings}
\quad\text{versus}\quad
\text{tolerated staleness}
\]

There is no universally correct TTL.

---

## 8.3 Invalidations

An invalidation tells CloudFront to stop serving selected cached paths before ordinary expiry.

Use it for cases such as:

- a security-sensitive asset must disappear immediately;
- an accidentally published file must be removed;
- a deployment reused a nonversioned name;
- a serious correctness bug requires urgent cache removal.

Do not make invalidation the normal release mechanism when immutable versioned names can solve the problem more predictably.

---

# 9. Private S3 content: three separate mechanisms

This is one of the most important SAP-C02 comparisons.

## 9.1 Origin Access Control

Northstar’s S3 bucket remains private.

CloudFront uses **Origin Access Control**, or OAC, to make authenticated origin requests to S3. The bucket policy permits the CloudFront service principal only for the intended distribution.

OAC answers:

> May this CloudFront distribution retrieve the object from S3?

It does not answer:

> Is this particular customer allowed to download the report?

OAC prevents direct S3 access from bypassing CloudFront. AWS recommends OAC for S3 origins, and an S3 website endpoint cannot be used with OAC because CloudFront treats that endpoint as a custom HTTP origin.

---

## 9.2 CloudFront signed URL

A signed URL authorizes a viewer to request an individual CloudFront resource.

Example:

```text
https://downloads.northstar.example/reports/report-42.pdf
    ?Expires=...
    &Signature=...
    &Key-Pair-Id=...
```

The application can restrict access by:

- expiration time;
- optional valid-from time;
- optional source IP range;
- path.

CloudFront verifies the signature using a public key in a trusted key group. The signing service retains the corresponding private key. AWS recommends trusted key groups rather than legacy trusted AWS-account signers.

Use a signed URL when:

```text
one customer
one or a few individual files
possibly a client without cookie support
```

---

## 9.3 CloudFront signed cookie

Signed cookies express the same basic viewer authorization without changing every object URL.

Use them when an authenticated user needs access to:

```text
many files
an entire subscriber area
all segments of a video
a path hierarchy
```

AWS recommends signed URLs for individual files and signed cookies for multiple restricted files or when existing URLs should remain unchanged.

---

## 9.4 S3 pre-signed URL

An S3 pre-signed URL grants time-limited access directly to S3.

```text
Viewer
    ↓
S3 URL
    ↓
S3 object
```

This bypasses CloudFront.

Use it when:

- a browser must upload directly to S3;
- a one-off direct download is acceptable;
- global edge caching is unnecessary;
- the object should be accessed through the S3 API path.

A pre-signed URL can authorize operations such as:

```text
GET
PUT
```

using the permissions of the AWS principal that creates it.

---

## 9.5 Comparison

| Mechanism | Protects which interaction? | Typical use |
| --- | --- | --- |
| OAC | CloudFront → S3 | Prevent direct origin access |
| CloudFront signed URL | Viewer → one CloudFront resource | One private report |
| CloudFront signed cookie | Viewer → a set of CloudFront resources | Subscriber area or many files |
| S3 pre-signed URL | Viewer → S3 directly | Direct upload or one-off S3 access |

The attached comparison chapter presents precisely this distinction: OAC restricts the S3 origin to CloudFront, CloudFront signed mechanisms control viewer access at the distribution, and S3 pre-signed URLs grant direct time-limited object access.

---

## 9.6 The two-gate model

A private report download succeeds only when both gates succeed:

```text
Viewer authorization
    signed URL or cookie is valid
                AND
Origin authorization
    CloudFront OAC may read from S3
```

Formally:

\[
\text{private download succeeds}
=

\text{viewer accepted by CloudFront}
\land
\text{CloudFront accepted by S3}
\]

A valid signed URL cannot compensate for a broken OAC bucket policy.

A valid OAC configuration does not give every viewer permission to download private files.

---

# 10. IAM architecture

## 10.1 Identity map

| Actor | Identity or mechanism | Authority |
| --- | --- | --- |
| Customer | Application account/session | Use Northstar application |
| EC2 application | `AppRuntimeRole` | Access approved AWS resources |
| Report generator | Runtime role | Write generated reports to S3 |
| URL signer | `ReportSignerRole` plus signing key | Produce CloudFront signatures |
| CloudFront | Service principal through OAC | Read designated S3 origin |
| Deployment pipeline | `DeploymentRole` | Modify infrastructure |
| Engineer | Federated operations role | Inspect or administer environment |

Customers are not IAM users. Their identity exists in Northstar’s application authentication system.

---

## 10.2 Report-generation authorization trace

```text
Report generator
    ↓ obtains temporary credentials
ReportGeneratorRole session
    ↓
s3:PutObject
    ↓
arn:aws:s3:::northstar-private-reports/customer-42/report-7.pdf
    ↓ evaluates
role policy
bucket policy
KMS key policy, if applicable
SCPs and explicit denies
    ↓
object written
```

The role does not require:

```text
s3:GetObject on every customer's reports
cloudfront:UpdateDistribution
s3:PutBucketPolicy
AdministratorAccess
```

---

## 10.3 Signed-URL generation trace

```text
Customer
    ↓ authenticates
Northstar application
    ↓ checks business authorization
"May this customer access report 7?"
    ↓
ReportSigner service
    ↓ reads protected private signing key
    ↓ signs CloudFront policy
    ↓
signed URL returned to customer
```

The signer’s private key is not an IAM access key.

CloudFront stores or references the public key through a trusted key group. The signer uses the private half to produce signatures; CloudFront verifies them using the public half.

The private signing key should be protected like a credential, for example through Secrets Manager and KMS-backed encryption.

---

## 10.4 OAC authorization trace

```text
CloudFront distribution
    ↓ signs origin request
CloudFront service principal
    ↓
s3:GetObject
    ↓
specific private bucket/prefix
    ↓ bucket policy condition
request must come from intended distribution
    ↓
ALLOW or DENY
```

The customer does not assume an AWS role and does not receive S3 credentials.

---

## 10.5 Runtime versus deployment authority

### Runtime role

Can:

```text
write generated report
read application secret
publish application metric
```

Cannot:

```text
modify CloudFront distribution
change WAF rules
edit bucket policy
replace signing public keys
```

### Deployment role

Can:

```text
update CloudFront configuration
modify WAF web ACL
deploy application version
update IAM roles through approved infrastructure stack
```

It does not automatically need to read customer reports.

---

# 11. Network architecture

## 11.1 CloudFront and S3 are not placed in Northstar subnets

CloudFront is a global edge service.

An S3 bucket is a Regional service resource but is not deployed into an application subnet.

The VPC contains:

- the ALB network interfaces;
- EC2 application interfaces;
- Redis nodes;
- RDS interfaces;
- NAT gateways and VPC endpoints.

This distinction remains important:

```text
Private S3 bucket
    → authorization property

Private subnet
    → routing property
```

---

## 11.2 CloudFront to ALB

The straightforward exam-oriented design uses an internet-facing ALB as a CloudFront custom origin:

```text
CloudFront
    ↓ HTTPS
Internet-facing ALB
    ↓
Private EC2 targets
```

Northstar should prevent viewers from bypassing CloudFront and calling the ALB directly.

One supported pattern is:

1. CloudFront adds a randomly generated secret origin header.
2. An ALB listener rule forwards only requests carrying that header.
3. The default ALB rule returns `403`.
4. CloudFront uses HTTPS to the origin.
5. The ALB security group can also be limited using the AWS-managed CloudFront origin-facing prefix list.

AWS documents this pattern specifically for restricting direct access to an ALB origin.

### Current capability note

CloudFront now also supports certain ALBs, NLBs, and EC2 instances in private subnets as **VPC origins**, making CloudFront the sole public entry point. That is a useful modern option, but the public-ALB-with-origin-restriction model remains valuable for exam reasoning and existing architectures.

---

## 11.3 TLS certificates

Northstar needs two conceptually different certificates when HTTPS is used end to end.

### Viewer-to-CloudFront certificate

```text
portal.northstar.example
```

For a custom CloudFront domain, the ACM certificate must be requested or imported in:

```text
us-east-1
```

because CloudFront is a global service.

### CloudFront-to-ALB certificate

The Regional ALB uses a certificate in the ALB’s own Region.

```text
Viewer
    ↓ certificate in us-east-1
CloudFront
    ↓ certificate in application Region
ALB
```

---

## 11.4 Application to Redis

```text
Application EC2
    ↓ resolves cache endpoint
VPC local route
    ↓
Cache-SG allows TCP 6379 from App-SG
    ↓
ElastiCache primary or reader endpoint
```

No Internet Gateway or NAT is needed because this is private VPC traffic.

Redis authentication and TLS settings remain separate from security-group permission.

---

## 11.5 Application to RDS

```text
Application EC2
    ↓
RDS primary endpoint:5432
or read-replica endpoint:5432
    ↓
DB-SG permits App-SG
    ↓
PostgreSQL authentication
    ↓
SQL authorization
```

The application must choose the correct endpoint according to consistency requirements.

---

# 12. Packet walks

## 12.1 Static asset: cache hit

```text
1. Browser resolves portal.northstar.example.

2. Route 53 returns the CloudFront distribution.

3. Browser opens HTTPS to a nearby edge location.

4. WAF evaluates the request.

5. /assets/app.7f31ab2.js matches the static behavior.

6. CloudFront computes the cache key.

7. Matching unexpired object exists.

8. CloudFront returns the object.

9. No request reaches S3, the ALB, EC2, Redis, or RDS.
```

This is the ideal origin-offload path.

---

## 12.2 Static asset: cache miss

```text
1–6. Same initial path.

7. Object is absent or expired.

8. CloudFront signs an S3 origin request using OAC.

9. S3 bucket policy accepts the intended distribution.

10. S3 returns the object.

11. CloudFront may cache it according to policy.

12. CloudFront returns it to the browser.
```

---

## 12.3 Private report

```text
1. Customer authenticates to Northstar.

2. Application verifies ownership of report 7.

3. Signer creates a short-lived CloudFront signed URL.

4. Browser sends the signed URL to CloudFront.

5. CloudFront verifies:
       signature
       key ID
       expiration
       policy restrictions

6. On a cache hit, CloudFront returns the report.

7. On a miss, CloudFront uses OAC to read it from S3.

8. S3 does not grant the viewer direct access.
```

---

## 12.4 Personalized API request

```text
1. Browser sends:
       GET /api/account

2. CloudFront matches /api/*.

3. WAF evaluates the request.

4. Caching is disabled.

5. Authentication token or session information is forwarded
   through the origin-request policy.

6. CloudFront sends HTTPS to the ALB.

7. ALB accepts the CloudFront origin restriction.

8. ALB selects a healthy EC2 target.

9. Application authenticates and authorizes the customer.

10. Application reads Redis and/or RDS.

11. Response returns through ALB and CloudFront.
```

CloudFront must not treat personalized responses as globally interchangeable objects.

---

# 13. Three different read-acceleration layers

Northstar now has three mechanisms that can reduce database or origin load.

| Mechanism | Scope | Best for | Source of truth? |
| --- | --- | --- | ---: |
| CloudFront | Global edge | HTTP objects and responses | No |
| ElastiCache | Inside application Region | Repeated key-based application reads | No |
| RDS read replica | Relational database | Broad SQL read scaling | Durable copy, but not primary |

They are not interchangeable.

---

## 13.1 CloudFront edge cache

Best for:

- JavaScript and CSS;
- images;
- public catalog content;
- private reports;
- cacheable HTTP responses.

It operates before the request reaches the application Region.

---

## 13.2 ElastiCache Redis

Best for:

- session state;
- hot product summaries;
- authorization metadata with careful TTL;
- rate-limit counters;
- frequently accessed computed results;
- expensive database query results.

It operates between the application and durable data stores.

The attached material identifies ElastiCache as an in-memory cache suitable for session state, hot data, and replicated Multi-AZ configurations.

---

## 13.3 RDS read replica

Best for:

- reporting queries;
- dashboards;
- broad read-heavy relational access;
- queries that cannot be represented as simple cache keys;
- reducing read load on the primary database.

RDS read replicas receive changes asynchronously, so they can lag behind the primary. They scale reads but are not the same as the synchronous Multi-AZ standby.

---

# 14. Redis cache strategies

## 14.1 Lazy loading

The application checks the cache first.

```text
Application
    ↓ GET product:42
Redis
    ├── hit  → return value
    └── miss → query RDS
                  ↓
              write Redis with TTL
                  ↓
              return value
```

Pseudocode:

```python
value = cache.get(key)

if value is None:
    value = database.query(...)
    cache.set(key, value, ttl=300)

return value
```

Lazy loading stores only requested data and allows the application to continue after cache loss by falling back to the database. Its disadvantages are miss latency and potential stale data.

---

## 14.2 Write-through

On a database write:

```text
update database
    ↓
update cache
```

This keeps cached data fresher but adds:

- write latency;
- more cache writes;
- possible inconsistency if one operation succeeds and the other fails;
- cache pollution for data that is never read.

---

## 14.3 Cache invalidation

An alternative is:

```text
update database
    ↓
delete affected cache key
```

The next read repopulates the cache.

This avoids having to reproduce every database transformation in the cache-write path.

---

## 14.4 TTL

A TTL bounds how long a value may remain cached.

```text
short TTL
    → fresher
    → more database load

long TTL
    → faster and cheaper
    → more staleness
```

TTL is not a correctness mechanism by itself. A value can remain stale for the entire TTL.

---

## 14.5 Cache stampede

Suppose one popular key expires:

```text
10,000 requests
    ↓
all observe cache miss
    ↓
10,000 database queries
```

Mitigations include:

- request coalescing or locking;
- refreshing before expiry;
- adding small random variation to TTLs;
- allowing one worker to regenerate the value;
- serving briefly stale data where acceptable.

This is application design, not an automatic ElastiCache feature.

---

# 15. Fault-tolerant Redis

Northstar uses a replication group distributed across Availability Zones.

Conceptually:

```text
Redis primary in AZ A
        │ asynchronous replication
        ├────────► replica in AZ B
        └────────► optional replica in AZ C
```

With Multi-AZ automatic failover:

```text
primary fails
    ↓
replica promoted
    ↓
primary endpoint resolves to new primary
    ↓
application reconnects
```

ElastiCache automatically promotes a replica after a primary or AZ failure when Multi-AZ is configured. Traditional Redis OSS replication is asynchronous, so a small amount of recent cache data can be lost because of replication lag; AWS now also offers newer durability modes for supported Valkey versions, but the conventional exam model remains asynchronous replication and automatic promotion.

### Architectural implication

Do not place irreplaceable transaction state only in the cache.

For example:

```text
acceptable:
    cached product summary
    regenerable session
    rate-limit approximation

dangerous:
    only copy of completed payment
    authoritative subscription record
    only copy of an order
```

The application should be able to reconstruct essential state from a durable system.

---

# 16. RDS Multi-AZ versus read replica

Northstar now uses both, for different reasons.

```text
RDS primary
    ├── synchronous standby in another AZ
    └── asynchronous read replica
```

## Multi-AZ standby

Purpose:

```text
high availability
automatic failover
AZ resilience
```

The traditional standby does not serve application reads.

## Read replica

Purpose:

```text
read scaling
reporting workload isolation
reducing primary query load
```

It may return stale data because replication is asynchronous.

---

## 16.1 Correct read routing

Suitable for replica:

```text
monthly usage report
historical dashboard
catalog analytics
eventual-consistency-tolerant search
```

Unsuitable immediately after a write:

```text
customer updates billing address
    ↓
application redirects to confirmation page
    ↓
confirmation must display new address
```

That flow should read from the primary or use another read-your-writes mechanism.

### Memory rule

```text
Multi-AZ:
    failure availability

Read replica:
    read capacity

Redis:
    low-latency repeated access
```

---

# 17. Route 53 routing policies

The baseline uses a simple alias to CloudFront, but SAP-C02 expects you to recognize when a different routing policy is required.

| Policy | Decision |
| --- | --- |
| Simple | One logical destination |
| Weighted | Proportional traffic split |
| Latency | Lowest-latency AWS Region |
| Failover | Primary while healthy, secondary otherwise |
| Geolocation | User’s geographic location |
| Geoproximity | Resource/user geography with traffic bias |
| IP-based | Source CIDR mapping |
| Multivalue | Return several health-checked records |

AWS documents these as distinct policies governing how Route 53 answers DNS queries.

---

## 17.1 Weighted routing

Example:

```text
version A weight 95
version B weight 5
```

Approximate DNS answer proportion:

\[
P(B) =
\frac{5}{95 + 5}
=

5\%
\]

Uses include:

- canary release;
- gradual migration;
- active-active traffic allocation;
- testing a new Region.

Weights influence DNS responses, not exact individual HTTP requests. DNS resolver caching and connection reuse mean observed application traffic will be approximate. Route 53 weighted routing distributes responses according to relative record weights.

---

## 17.2 Latency routing

Use when equivalent application stacks operate in multiple Regions and users should normally reach the Region with the lowest measured network latency.

```text
User in Europe
    ↓
Route 53 latency decision
    ↓
Europe or another currently lower-latency Region
```

Route 53 latency routing chooses among Regional resources based on latency measurements that can change over time.

### Critical limitation

Routing a user to the nearest compute stack is not sufficient when the data layer exists only in another Region.

```text
nearby application
    ↓
distant database
```

This may be slower than sending the whole request to the database’s Region.

Traffic routing and data placement must be designed together.

---

## 17.3 Failover routing

Use for active-passive DNS failover:

```text
Primary record
    health check fails
        ↓
Secondary record returned
```

Failover routing sends DNS traffic to the primary while healthy and to a secondary resource when the primary becomes unhealthy.

DNS failover is not instantaneous for clients that still have a cached answer.

---

## 17.4 Multivalue answer

Route 53 can return several healthy records—up to eight—to a resolver.

It can improve availability for simple endpoint sets, but AWS explicitly states that it is not a substitute for a load balancer.

An ALB provides:

- per-request target selection;
- continuous target health;
- connection handling;
- Layer 7 routing.

Multivalue DNS provides several endpoint addresses.

---

# 18. CloudFront versus Route 53 versus Global Accelerator

| Property | Route 53 | CloudFront | Global Accelerator |
| --- | --- | --- | --- |
| Main layer | DNS | HTTP/HTTPS edge proxy | TCP/UDP network accelerator |
| Caches content | No | Yes | No |
| Static entry IPs | Not its primary model | No fixed viewer IP contract | Yes |
| URL/path awareness | No | Yes | No |
| Signed viewer content | No | Yes | No |
| WAF integration | Indirect edge security | Yes | WAF remains at supported endpoint |
| Health-based Regional routing | Through DNS policies | Origin mechanisms | Yes |
| Non-HTTP TCP/UDP | DNS only | No general raw L4 service | Yes |
| Best fit | DNS policy | Websites, APIs, files, media | Static IPs and network acceleration |

---

## 18.1 Choose CloudFront when

Requirements emphasize:

- HTTP or HTTPS;
- caching;
- private content;
- path-based origin selection;
- edge WAF;
- static and dynamic web acceleration;
- reduced origin connections.

---

## 18.2 Choose Global Accelerator when

Requirements emphasize:

- static global anycast IP addresses;
- TCP or UDP;
- fixed IP allowlists;
- health-based routing to Regional endpoints;
- fast endpoint changes without depending primarily on DNS expiry;
- noncacheable application traffic.

Global Accelerator provides static anycast entry addresses and routes TCP or UDP traffic over the AWS global network to healthy ALB, NLB, EC2, or Elastic IP endpoints.

---

## 18.3 They can coexist

A company might use:

```text
CloudFront
    → website and HTTP API

Global Accelerator
    → game protocol, VoIP, or fixed-IP business integration
```

Do not select a global AWS service merely because the word “global” appears in the question. Select according to protocol and required behavior.

---

# 19. WAF and DDoS protection

## 19.1 AWS WAF

Northstar associates a WAF web ACL with CloudFront.

Possible rules include:

- AWS-managed common-threat rules;
- SQL-injection patterns;
- cross-site scripting patterns;
- known malicious IP sets;
- geo restrictions;
- bot-control rules;
- rate-based rules.

A rate-based rule groups and counts requests and rate-limits traffic that exceeds configured criteria.

WAF operates at the web-request layer.

It understands concepts such as:

```text
URI path
HTTP method
header
query string
request body
source IP
request rate
```

---

## 19.2 Shield

### Shield Standard

Included automatically for AWS customers and provides baseline infrastructure-layer DDoS protection for supported AWS services.

### Shield Advanced

A paid subscription that provides enhanced detection, mitigation, visibility, and response support for protected resources such as CloudFront, Route 53, load balancers, Global Accelerator, and EC2 Elastic IPs.

---

## 19.3 WAF versus Shield

```text
Malicious HTTP pattern
    → WAF

High-rate abusive HTTP client
    → WAF rate-based rule

Infrastructure-layer DDoS attack
    → Shield

Private EC2 port access
    → security group

Subnet-level packet deny
    → NACL
```

The attached exam notes emphasize WAF with CloudFront or ALB for application attacks and Shield for automated DDoS protection.

---

## 19.4 Why Auto Scaling alone is insufficient

Auto Scaling can absorb legitimate demand and some abusive load, but:

- capacity has limits;
- scaling takes time;
- the database may not scale at the same rate;
- attackers can create cost;
- malicious requests may still reach application code;
- network attacks should be handled closer to the edge.

The security architecture should prevent or absorb inappropriate traffic before relying on the origin to scale through it.

---

# 20. Reliability model

## 20.1 CloudFront edge issue

CloudFront is globally distributed and routes viewers through its edge network.

A single edge-location issue does not imply loss of the Regional application.

---

## 20.2 Application-instance failure

```text
EC2 instance fails
    ↓
ALB health check fails
    ↓
target removed from service
    ↓
remaining targets serve requests
    ↓
Auto Scaling restores capacity
```

---

## 20.3 Availability Zone failure

```text
AZ A fails
    ↓
ALB routes to AZ B targets
    ↓
Auto Scaling restores capacity where possible
    ↓
RDS fails over if primary was in AZ A
    ↓
Redis promotes a surviving replica
```

Application retry and reconnection logic remains necessary.

---

## 20.4 Cache failure

For regenerable data:

```text
Redis unavailable
    ↓
application queries RDS
    ↓
latency and DB load increase
```

The application should degrade rather than lose correctness.

A cache outage may still become an application outage if the database lacks capacity for the suddenly uncached load.

---

## 20.5 Origin problem

Valid, already cached CloudFront objects may continue to be served until expiry.

But:

```text
cache miss
expired object
uncached personalized API
write request
```

still requires a functioning origin.

---

## 20.6 CloudFront origin failover

CloudFront can group a primary and secondary origin and fail over for configured errors.

However, origin failover applies only to:

```text
GET
HEAD
OPTIONS
```

not ordinary write methods such as:

```text
POST
PUT
```

Therefore, origin failover is useful for read-oriented content but is not a complete transactional disaster-recovery mechanism.

---

## 20.7 Regional failure

A full Regional failure still removes:

- the ALB origin;
- application compute;
- Redis;
- RDS;
- uncached dynamic behavior.

This baseline has:

```text
global edge resilience
+
Multi-AZ Regional resilience
```

but not:

```text
multi-Region application resilience
```

---

# 21. Observability

## 21.1 CloudFront

Monitor:

```text
request count
cache-hit ratio
origin request count
origin latency
viewer 4xx
viewer 5xx
bytes transferred
```

A falling hit ratio can indicate:

- TTLs are too short;
- unnecessary cookies are in the cache key;
- tracking query parameters fragment the cache;
- excessive headers vary objects;
- responses prohibit caching;
- content is naturally unique.

---

## 21.2 WAF

Monitor:

```text
allowed requests
blocked requests
rate-limited requests
managed-rule matches
false-positive patterns
top source IPs
```

Deploy new rules in count mode where practical before blocking legitimate users.

---

## 21.3 ALB and application

Monitor:

```text
healthy target count
target response time
ALB 4xx and 5xx
target 4xx and 5xx
request count
application p95 and p99 latency
```

CloudFront origin latency and ALB target latency represent different parts of the path.

---

## 21.4 Redis

Monitor:

```text
cache hits
cache misses
hit ratio
evictions
memory usage
connections
replication lag
failover events
CPU
```

A high hit ratio is not automatically good if the cache is serving stale or unauthorized data.

---

## 21.5 RDS

Monitor:

```text
primary CPU
database connections
query latency
free storage
read-replica lag
read/write throughput
failover events
```

Replica lag should influence which business operations may safely read from it.

---

## 21.6 CloudWatch versus CloudTrail

```text
CloudWatch:
    Is cache performance degrading?
    Is WAF blocking a spike?
    Is replica lag excessive?

CloudTrail:
    Who changed the cache policy?
    Who disabled a WAF rule?
    Who modified the CloudFront distribution?
```

---

# 22. Cost model

Main costs now include:

```text
CloudFront requests and data transfer
WAF requests and rule groups
Shield Advanced, if selected
ALB usage
EC2
Redis
RDS primary, standby and read replica
S3 storage and requests
CloudWatch logs and metrics
cache invalidations
```

---

## 22.1 Good caching reduces more than latency

A cache hit avoids:

```text
CloudFront → origin connection
ALB processing
EC2 processing
Redis or RDS access
origin data transfer
```

The attached guide emphasizes that improving cache-hit ratio lowers both origin load and latency.

---

## 22.2 Bad caching can increase cost

A cache key containing irrelevant high-cardinality values produces:

```text
many cache objects
low reuse
high origin traffic
more requests
more storage pressure
```

Examples:

```text
unique session ID
random analytics parameter
request correlation ID
full browser User-Agent
```

---

## 22.3 Redis must justify its fixed cost

Redis is worthwhile when:

\[
\text{latency benefit}
+
\text{database capacity avoided}
+
\text{repeated computation avoided}
>
\text{cache cost and complexity}
\]

A cache added without measured repeated access can merely become another stateful service to operate.

---

## 22.4 Read replica must justify its fixed cost

A read replica is an additional database instance.

It is appropriate when:

- the primary is read-constrained;
- reporting isolation matters;
- broad SQL access is needed;
- the workload cannot be solved efficiently through object or key caching.

---

# 23. Changed-requirement variants

## Variant 1: Regional outage RTO is fifteen minutes

The baseline is insufficient.

Add a warm-standby application stack in another Region:

```text
Secondary ALB
minimum application capacity
replicated artifacts
cross-Region database replication
S3 replication where required
Route 53 failover or Global Accelerator
tested activation procedure
```

The architecture must also define:

- RPO;
- promotion;
- write ownership;
- reverse replication;
- failback.

The comparison material emphasizes that failback requires returning updates made in the DR environment to the recovered primary site rather than merely changing DNS back.

---

## Variant 2: Active-active global writes

This is not solved merely by deploying EC2 in another Region.

The data model must support:

- concurrent writers;
- conflict resolution;
- replication delay;
- uniqueness;
- idempotency;
- user affinity;
- failure recovery.

Possible technologies include DynamoDB global tables or carefully designed multi-Region database systems, but the business semantics must permit their consistency model.

---

## Variant 3: Partners require fixed IP allowlisting

Use Global Accelerator in front of suitable Regional endpoints.

CloudFront’s DNS names and edge address ranges are not a fixed pair of dedicated application IPs.

---

## Variant 4: Users upload large files directly

Generate an S3 pre-signed `PUT` URL.

```text
Browser
    ↓ direct upload
S3
```

This avoids sending the file through:

```text
CloudFront
ALB
EC2 application
```

The application still determines:

- object key;
- maximum size;
- content type;
- expiration;
- post-upload validation.

---

## Variant 5: A subscriber needs hundreds of private files

Use CloudFront signed cookies rather than generating one signed URL for every object.

---

## Variant 6: Every API response is personalized

Disable edge caching for those API behaviors.

Retain CloudFront for:

- WAF;
- DDoS posture;
- TLS;
- global network entry;
- origin connection reuse;
- centralized request handling.

---

## Variant 7: EU customer data must remain in the EU

Geolocation routing alone is not a data-residency control.

The application must also place and constrain:

- databases;
- object storage;
- backups;
- logs;
- processing;
- support access;
- replication.

Routing a user to Europe does not prove their data stayed there.

---

## Variant 8: The ALB must not be public

Use CloudFront VPC origins where supported, or another private-origin architecture.

The network design changes from:

```text
CloudFront → public ALB with restrictions
```

to:

```text
CloudFront → private VPC origin
```

IAM, application authorization, and backend security groups remain separate concerns.

---

# 24. Failure drills

## Failure A: CloudFront returns `AccessDenied` for every S3 object

Investigate:

```text
OAC associated with correct origin
bucket policy
CloudFront distribution ARN condition
S3 object key
KMS key policy
object ownership
```

A signed viewer URL does not repair CloudFront-to-S3 authorization.

---

## Failure B: Signed report URL returns `403`

Investigate:

```text
expired policy
not-yet-valid policy
incorrect path
wrong key ID
signature generation
trusted key group
cache behavior requiring a different signer
source-IP restriction
```

---

## Failure C: Direct S3 URL works

The origin is bypassable.

Investigate:

```text
public bucket permission
object ACL
bucket policy
OAC configuration
S3 website endpoint use
```

---

## Failure D: CloudFront hit ratio collapses

Investigate:

```text
TTL
cookies
query strings
headers
Cache-Control response directives
object naming
cache policy
personalized traffic mixed with public traffic
```

---

## Failure E: One customer receives another customer’s response

Treat this as a serious data-isolation incident.

Likely cause:

```text
personalized response cached under a shared cache key
```

Immediately:

- disable the affected cache behavior;
- invalidate relevant objects;
- inspect cache-key dimensions;
- determine affected users and content;
- separate personalized and public behaviors.

---

## Failure F: ALB works when addressed directly

CloudFront can be bypassed, so users may avoid:

- WAF attached at CloudFront;
- CloudFront viewer rules;
- signed-access expectations;
- edge logging.

Investigate:

- secret origin-header rule;
- CloudFront managed prefix-list restriction;
- VPC origin alternative;
- direct DNS exposure.

---

## Failure G: Redis fails and the whole application fails

The application treated the cache as mandatory authoritative storage.

Determine whether the cache should:

```text
fail open to RDS
```

or whether the business requirement actually makes Redis a stateful dependency requiring stronger durability and recovery design.

---

## Failure H: Customer updates a record and immediately sees the old value

The confirmation read may have been routed to:

```text
read replica
Redis cache
CloudFront cache
```

This is a consistency-routing problem, not necessarily a failed write.

---

## Failure I: Route 53 sends users to the lowest-latency Region, but the application is slow

The selected compute Region may still call a distant central database.

Global traffic placement and data placement are mismatched.

---

## Failure J: CloudFront origin failover handles downloads but not checkout

Expected behavior: origin failover does not fail over `POST` or `PUT` requests.

Checkout requires application and data-layer disaster recovery, not just a CloudFront origin group.

---

## Failure K: WAF blocks legitimate mobile clients

Possible causes:

```text
managed rule false positive
body-size or encoding difference
rate rule aggregates too broadly
shared carrier NAT IP
bot detection
missing allow exception
```

Use WAF logs and sampled requests rather than disabling the entire web ACL blindly.

---

# 25. Exam decision snippets

## CloudFront versus Global Accelerator

**Requirement:** Cache web assets, protect HTTP traffic with WAF, and deliver private reports.

**Choose:** CloudFront.

**Requirement:** Provide fixed global IP addresses for a TCP application.

**Choose:** Global Accelerator.

---

## OAC versus signed URL

**Requirement:** Prevent anyone from accessing the S3 bucket directly.

**Choose:** OAC.

**Requirement:** Permit one authenticated customer to download one report through CloudFront for ten minutes.

**Choose:** CloudFront signed URL.

Often both are required.

---

## Signed URL versus signed cookie

**One file:**

```text
signed URL
```

**Many restricted files or unchanged URLs:**

```text
signed cookie
```

---

## S3 pre-signed URL versus CloudFront signed URL

**Direct browser upload to S3:**

```text
S3 pre-signed PUT
```

**Globally distributed private download through CDN:**

```text
CloudFront signed URL
```

---

## Cache policy versus origin-request policy

**Value changes the cached representation:**

```text
cache policy
```

**Origin needs the value, but it should not split the cache:**

```text
origin-request policy
```

---

## Multi-AZ versus read replica

**Database failover:**

```text
Multi-AZ
```

**Read scaling:**

```text
read replica
```

---

## Redis versus read replica

**Repeated hot key with very low latency:**

```text
Redis
```

**Broad SQL reporting workload:**

```text
read replica
```

---

## WAF versus Shield

**Block malicious HTTP patterns or excessive web requests:**

```text
WAF
```

**DDoS protection:**

```text
Shield
```

---

## CloudFront certificate Region

**Viewer-facing ACM certificate for a CloudFront custom domain:**

```text
us-east-1
```

**Certificate on the Regional ALB origin:**

```text
the ALB's Region
```

---

# 26. Retrieval practice

Answer without looking back.

## 1

Why can Northstar have global delivery while its application remains in one Region?

## 2

What does a CloudFront origin represent?

## 3

What four major decisions can a cache behavior contain?

## 4

What is a cache key?

## 5

What happens when a response varies by customer but customer identity is absent from the cache key?

## 6

Why can forwarding every cookie lower cache efficiency?

## 7

What is the difference between a cache policy and an origin-request policy?

## 8

Why are versioned static-object names preferable to routine invalidations?

## 9

What problem does OAC solve?

## 10

What problem does a CloudFront signed URL solve?

## 11

Why might a private report require both OAC and a signed URL?

## 12

When should signed cookies be preferred?

## 13

When should an S3 pre-signed URL be preferred?

## 14

Does the customer assume an IAM role when using a CloudFront signed URL?

## 15

What does CloudFront store from the signing key pair?

## 16

Why should the ALB origin reject direct viewer requests?

## 17

What is the purpose of Redis in this architecture?

## 18

Why must Redis generally not be the sole store of completed orders?

## 19

What is lazy loading?

## 20

What is a cache stampede?

## 21

What is the difference between RDS Multi-AZ and a read replica?

## 22

Why can a read replica return stale results?

## 23

What does Route 53 weighted routing control?

## 24

Why is Route 53 multivalue routing not a substitute for an ALB?

## 25

What makes Global Accelerator different from CloudFront?

## 26

Which service should inspect malicious HTTP paths?

## 27

Which service primarily addresses infrastructure-layer DDoS attacks?

## 28

Why does CloudFront origin failover not provide full write-path DR?

## 29

Where must the viewer-facing ACM certificate for CloudFront exist?

## 30

What is the largest failure boundary covered by this baseline?

---

# 27. Answer key

## 1

CloudFront supplies the global edge and caching layer while forwarding cache misses and dynamic requests to a single Regional origin.

## 2

The system from which CloudFront retrieves content on a cache miss, such as S3 or an ALB.

## 3

Path routing, origin selection, cache behavior, protocol handling, and viewer-access restrictions are the central concerns.

## 4

The selected request attributes CloudFront uses to decide whether two requests can share the same cached response.

## 5

One user can receive another user’s cached response. This is a serious isolation failure.

## 6

Cookies often contain high-cardinality session or tracking values, creating many distinct cache keys with little reuse.

## 7

A cache policy determines the key and TTL. An origin-request policy forwards additional values to the origin without necessarily varying the cache.

## 8

A changed file receives a new key, so old and new versions coexist safely without waiting for global cache invalidation.

## 9

It permits the intended CloudFront distribution to read a private S3 origin while preventing direct S3 access.

## 10

It authorizes a viewer to access a restricted CloudFront resource under time or policy constraints.

## 11

The signed URL authorizes the viewer; OAC authorizes CloudFront to retrieve from S3.

## 12

When a user needs access to many restricted files or the application should retain ordinary URLs.

## 13

For direct time-limited S3 operations, especially browser uploads.

## 14

No. CloudFront verifies a signed policy; the customer receives no AWS role credentials.

## 15

CloudFront uses the public key through a trusted key group. The signer protects the private key.

## 16

Otherwise clients can bypass CloudFront, WAF, edge logging, and viewer-access controls.

## 17

To serve repeated hot application data with lower latency and reduce database work.

## 18

Cache replication can lag, cache data can be evicted, and the cache may fail or be flushed.

## 19

Check cache first; on a miss, query the durable store and populate the cache.

## 20

Many requests simultaneously miss the same expired key and overload the backing store while regenerating it.

## 21

Multi-AZ supplies synchronous standby failover. A read replica supplies asynchronous readable capacity.

## 22

Changes reach it asynchronously from the primary.

## 23

The approximate proportion of DNS responses directed to each record.

## 24

It returns several IP addresses but does not provide per-request Layer 7 routing, target groups, or connection management.

## 25

Global Accelerator supplies static anycast IPs and accelerates TCP/UDP network paths; CloudFront is an HTTP edge proxy and cache.

## 26

AWS WAF.

## 27

AWS Shield.

## 28

It fails over only read-oriented methods such as `GET`, `HEAD`, and `OPTIONS`, not normal transactional writes.

## 29

`us-east-1`.

## 30

Component and Availability Zone failures within the application Region. Complete Regional failure is not yet covered.

---

# 28. What to memorize now

```text
Route 53
    → DNS decision

CloudFront
    → global HTTP edge and cache

ALB
    → Regional Layer 7 load balancing
```

```text
Cache behavior
    → path
    → origin
    → cache policy
    → origin-request policy
    → viewer protocol and access
```

```text
Cache policy
    → what makes a distinct cached object

Origin-request policy
    → what the origin receives
```

```text
OAC
    → CloudFront may read S3

Signed URL / cookie
    → viewer may use CloudFront

S3 pre-signed URL
    → viewer may access S3 directly
```

```text
Signed URL
    → individual file

Signed cookie
    → many files
```

```text
CloudFront cache
    → global HTTP acceleration

Redis
    → hot application data

RDS read replica
    → relational read scaling
```

```text
Multi-AZ
    → availability

Read replica
    → reads
```

```text
WAF
    → web-request inspection

Shield
    → DDoS protection
```

```text
CloudFront
    → HTTP/HTTPS, caching, private content

Global Accelerator
    → static IP, TCP/UDP, network acceleration

Route 53
    → DNS routing policy
```

```text
Global edge
    ≠
Multi-Region application
```

---

# 29. What can remain recognition-level

You do not yet need perfect recollection of:

- every CloudFront managed cache policy;
- every WAF managed-rule group;
- exact signed-policy JSON syntax;
- key-group API operations;
- CloudFront Functions versus Lambda@Edge;
- Origin Shield;
- every Route 53 routing-policy field;
- Global Accelerator traffic dials;
- Redis cluster-mode mechanics;
- advanced cache prewarming;
- CloudFront VPC-origin limitations;
- multi-Region database conflict resolution.

The important result of Lesson 2 is the ability to trace a global request through:

```text
DNS
→ edge
→ cache behavior
→ viewer authorization
→ origin authorization
→ Regional load balancer
→ application cache
→ relational database
```

while keeping those layers conceptually separate.
