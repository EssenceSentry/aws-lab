# AWS question-to-rule index

Companion to [AWS service decision guide](aws_service_decision_guide.md). All **391** questions in `questions.jsonl` are mapped below by their sequential question IDs.

Use the **question ID** to locate a missed question, then review the linked service sections. The final column gives the distinguishing rule, not an option letter or an uncritical reproduction of the answer key. Where the bank is outdated or incomplete, the guide explains the caveat.

**Q-ID** is the question’s three-digit `id`, from `001` to `391`. It stays the same when practice order is shuffled. This index is a navigation aid, not a second chapter to memorize.

## Questions 001–050

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 001 | [3. Networking and DNS](aws_service_decision_guide.md#network); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Public-zone DNSSEC signing; independent TLS configuration; SNI terminology. |
| 002 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | AWS_IAM requires SigV4 and invoke permission; X-Ray traces requests. |
| 003 | [11. Deployment](aws_service_decision_guide.md#deployment) | Beanstalk blue/green swaps environment CNAMEs; hooks configure the environment. |
| 004 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute); [11. Deployment](aws_service_decision_guide.md#deployment) | Reuse AZ-compatible ENIs for MAC-bound licensing; bootstrap from Parameter Store. |
| 005 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Replace failed NAT-instance topology with resilient NAT routing. |
| 006 | [3. Networking and DNS](aws_service_decision_guide.md#network); [1. Identity](aws_service_decision_guide.md#identity) | S3 gateway endpoint plus endpoint, role, and bucket restrictions. |
| 007 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | CloudFront country restriction is access control; DNS geolocation is routing. |
| 008 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Audit with CloudTrail and limited credentials; prefer temporary audit roles. |
| 009 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch Manager executes baseline-driven patching; Maintenance Windows schedules it. |
| 010 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Kinesis Producer Library ingests; WebSocket management API sends to clients. |
| 011 | [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | Multi-AZ availability, read replicas, and static-content delivery solve different problems. |
| 012 | [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Right-size and reserve the five-instance baseline; autoscale the burst. |
| 013 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Principal-tag ABAC plus CloudTrail S3 data events for access audits. |
| 014 | [9. Analytics](aws_service_decision_guide.md#analytics); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-Region Redshift snapshots; verify copy frequency and restoration time. |
| 015 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Buffer write bursts in SQS; scale consumers and DynamoDB throughput. |
| 016 | [3. Networking and DNS](aws_service_decision_guide.md#network) | TGW central egress with firewall inspection and correct return routes. |
| 017 | [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Precompute reports on a replica; serve S3 output through CloudFront. |
| 018 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | CodeDeploy supports hybrid deployment; protect configuration with SecureString. |
| 019 | [3. Networking and DNS](aws_service_decision_guide.md#network); [10. Operations and security](aws_service_decision_guide.md#operations) | NACL IP denial and Shield Advanced address distinct attack controls. |
| 020 | [11. Deployment](aws_service_decision_guide.md#deployment) | SAM plus build/deploy/pipeline tooling; repository is not pipeline execution. |
| 021 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | WAF on a supported REST API stage; Config tracks configuration. |
| 022 | [1. Identity](aws_service_decision_guide.md#identity); [7. Databases](aws_service_decision_guide.md#database); [6. Storage](aws_service_decision_guide.md#storage) | Cognito users; DynamoDB metadata; private S3 media and CloudFront. |
| 023 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | ALB certificates must exist in each load balancer's Region. |
| 024 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Cross-account private hosted-zone authorization/association; peering not inherently required. |
| 025 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute) | Private Fargate needs public-subnet NAT or complete private-endpoint access. |
| 026 | [10. Operations and security](aws_service_decision_guide.md#operations) | Separate patch groups and nonoverlapping windows avoid simultaneous outages. |
| 027 | [10. Operations and security](aws_service_decision_guide.md#operations); [12. Migration and DR](aws_service_decision_guide.md#migration) | Recovery logs tighten RPO; distinguish RDS-managed backups from Macie-scannable S3. |
| 028 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [6. Storage](aws_service_decision_guide.md#storage); [12. Migration and DR](aws_service_decision_guide.md#migration) | Replicate input data; parallelize queued workers; recreate regional infrastructure. |
| 029 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch baselines and Config approved-image checks are different compliance controls. |
| 030 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudFront/WAF/resilient capacity can meet lower-budget DDoS requirements. |
| 031 | [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Commit steady compute/database usage; Spot requires interruption tolerance. |
| 032 | [10. Operations and security](aws_service_decision_guide.md#operations) | Target patch policies by environment and operating system; stage rollouts. |
| 033 | [7. Databases](aws_service_decision_guide.md#database) | DynamoDB global tables; Keyspaces replication dismissal is outdated. |
| 034 | [10. Operations and security](aws_service_decision_guide.md#operations) | CloudWatch agent supplies memory/filesystem/log metrics; Logs Insights queries logs. |
| 035 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics) | Real-time stream ingestion; S3 aggregation and Redshift analytics. |
| 036 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Private A record to private IP; enable both VPC DNS settings. |
| 037 | [11. Deployment](aws_service_decision_guide.md#deployment); [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Regional multi-AZ ASG/ALB; resilient Aurora; preserve long-lived database resources. |
| 038 | [1. Identity](aws_service_decision_guide.md#identity); [7. Databases](aws_service_decision_guide.md#database) | Small user preferences fit DynamoDB; use scoped temporary credentials. |
| 039 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | HSM-held non-exportable TLS key; TCP pass-through; protected log encryption. |
| 040 | [2. Governance and cost](aws_service_decision_guide.md#governance); [10. Operations and security](aws_service_decision_guide.md#operations) | Alarm on actual usage divided by its service quota. |
| 041 | [5. Compute](aws_service_decision_guide.md#compute); [11. Deployment](aws_service_decision_guide.md#deployment); [6. Storage](aws_service_decision_guide.md#storage) | Baked OS image; CodeDeploy application updates; EFS avoids massive boot downloads. |
| 042 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Root explicit deny cannot be overridden by an OU allow. |
| 043 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | IoT Basic Ingest plus buffered Firehose fits delay-tolerant low-operations ingestion. |
| 044 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | API/Lambda authentication; DynamoDB metadata; authorized presigned S3 transfers. |
| 045 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | TLS private key stays in CloudHSM; load balancer passes TCP through. |
| 046 | [3. Networking and DNS](aws_service_decision_guide.md#network); [15. Corrections](aws_service_decision_guide.md#corrections) | Targets can reference the NLB SG; enforced PrivateLink inbound rules use the client private IP, not the endpoint IP. |
| 047 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Lambda concurrency and DynamoDB write throttling require separate fixes. |
| 048 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Warm standby keeps a scaled-down complete application ready for rapid recovery. |
| 049 | [7. Databases](aws_service_decision_guide.md#database) | RDS Oracle Multi-AZ is managed HA, not Oracle RAC. |
| 050 | [1. Identity](aws_service_decision_guide.md#identity); [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Authenticate separately; queue checkout work; persist durable state. |

## Questions 051–100

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 051 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Multi-AZ application and transactional DB; cache suitable web content. |
| 052 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | SQS processing plus DynamoDB and SNS mobile push; no carrier-edge requirement. |
| 053 | [1. Identity](aws_service_decision_guide.md#identity) | SAML trust principal and AssumeRoleWithSAML parameters must match. |
| 054 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | Use RDS DNS endpoint and reconnect; do not pin changing instance IPs. |
| 055 | [11. Deployment](aws_service_decision_guide.md#deployment); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Versioned infrastructure definitions plus CloudFront distribution. |
| 056 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity) | Separate certificate administration; terminate TLS outside application-managed instances. |
| 057 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Integrated ACM certificate for the ALB; distinguish certificate offering/cost. |
| 058 | [6. Storage](aws_service_decision_guide.md#storage) | SSE-S3 envelope encryption and default encryption, not multi-factor encryption. |
| 059 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Device Management fleet operations versus Device Defender security monitoring. |
| 060 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Correct NAT placement, Elastic IP, and private-subnet default route. |
| 061 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Shared TGW and centralized GWLB-based egress inspection at account scale. |
| 062 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Stateless autoscaling, shared sessions/cache, read replicas, and DB availability. |
| 063 | [7. Databases](aws_service_decision_guide.md#database); [10. Operations and security](aws_service_decision_guide.md#operations) | RAC requires supported self-management; patching and snapshot lifecycle remain necessary. |
| 064 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Longest-prefix /32 route selects one overlapping spoke address; return routes required. |
| 065 | [6. Storage](aws_service_decision_guide.md#storage); [7. Databases](aws_service_decision_guide.md#database); [10. Operations and security](aws_service_decision_guide.md#operations) | Immediate old-object access favors Standard-IA; Multi-AZ and Macie solve other needs. |
| 066 | [11. Deployment](aws_service_decision_guide.md#deployment); [5. Compute](aws_service_decision_guide.md#compute) | CloudFormation ASG rolling UpdatePolicy replaces instances for AMI changes. |
| 067 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Remote users need client VPN into private applications, not public exposure. |
| 068 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Two VPN tunnels do not remove a single customer-device/location failure. |
| 069 | [6. Storage](aws_service_decision_guide.md#storage) | SSE-C needs HTTPS and customer-key headers; current default blocks new use. |
| 070 | [10. Operations and security](aws_service_decision_guide.md#operations) | Inspector Classic workflow is retired; retain current scanning/approved-image intent. |
| 071 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | ALB multiple certificates use SNI; CloudFront dedicated IP does not bypass coverage. |
| 072 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Default CloudFront certificate with HTTPS-only or redirect policy. |
| 073 | [6. Storage](aws_service_decision_guide.md#storage); [12. Migration and DR](aws_service_decision_guide.md#migration) | Stored Volume Gateway snapshots can restore as EBS for EC2 recovery. |
| 074 | [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Cluster placement/EFA and FSx Lustre fit tightly coupled HPC. |
| 075 | [6. Storage](aws_service_decision_guide.md#storage) | Spectrum-compatible SSE-KMS plus TLS bucket policy; not SSE-C. |
| 076 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Aurora Global Database plus promotion and regional traffic failover. |
| 077 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database) | Replicate the large database; restore stateless application from image/template. |
| 078 | [7. Databases](aws_service_decision_guide.md#database); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Reporting on a read replica; SNS notification versus full SMTP delivery. |
| 079 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | SQS buffers relational writes without forcing a DynamoDB redesign. |
| 080 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Parallel queued workers with shared S3 input/output. |
| 081 | [11. Deployment](aws_service_decision_guide.md#deployment) | Test in nonproduction; inspect changes; blue/green deployment supports rollback. |
| 082 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Viewer HTTPS and origin HTTPS require separate policies and valid certificates. |
| 083 | [0. Decision method](aws_service_decision_guide.md#decision); [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Three AZs need spare failure capacity; commit baseline rather than peaks. |
| 084 | [1. Identity](aws_service_decision_guide.md#identity) | OIDC web identity supplies temporary S3/DynamoDB credentials. |
| 085 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Queue write bursts and control downstream database throughput. |
| 086 | [6. Storage](aws_service_decision_guide.md#storage) | Import wrapped external KMS material; distinguish automatic and on-demand rotation. |
| 087 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Bulk-tag existing resources; activate billing tags; enforce future request tags. |
| 088 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Config/Lambda termination is reactive, not prevention of an unapproved launch. |
| 089 | [7. Databases](aws_service_decision_guide.md#database) | ElastiCache replicas provide applicable read scaling and failover capabilities. |
| 090 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | Lambda canary 10% then 90% after five minutes; trace and alarm. |
| 091 | [6. Storage](aws_service_decision_guide.md#storage) | Block Public Access prevents accidental public exposure. |
| 092 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Application streaming preserves desktop-app experience; managed backend scales separately. |
| 093 | [3. Networking and DNS](aws_service_decision_guide.md#network) | FIN/RST and idle timeout behavior are not fixed by capacity alone. |
| 094 | [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Cache database work separately from cacheable HTTP content. |
| 095 | [10. Operations and security](aws_service_decision_guide.md#operations) | WAF handles application-layer rules; Shield Advanced addresses DDoS capabilities. |
| 096 | [3. Networking and DNS](aws_service_decision_guide.md#network); [7. Databases](aws_service_decision_guide.md#database) | Latency routing with health; cross-Region cache state is not automatic. |
| 097 | [10. Operations and security](aws_service_decision_guide.md#operations) | Macie identifies S3 sensitive data; CloudTrail data events record object access. |
| 098 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | Encrypted cross-Region Redshift snapshots require destination KMS copy grant. |
| 099 | [1. Identity](aws_service_decision_guide.md#identity); [4. Edge and APIs](aws_service_decision_guide.md#edge); [7. Databases](aws_service_decision_guide.md#database) | Federated temporary credentials; static frontend and scoped direct data access. |
| 100 | [5. Compute](aws_service_decision_guide.md#compute) | Stop and move eligible instances into cluster placement group, then restart. |

## Questions 101–150

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 101 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Access Analyzer uses representative CloudTrail activity, including needed data events. |
| 102 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Sticky routing is not session durability; Aurora Auto Scaling adds readers. |
| 103 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Direct Connect gateway supports eligible multi-Region VPC associations. |
| 104 | [10. Operations and security](aws_service_decision_guide.md#operations); [5. Compute](aws_service_decision_guide.md#compute); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Session Manager removes SSH exposure; layered resilience and edge protection. |
| 105 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Multi-AZ ASG/ALB and RDS protect independent tiers. |
| 106 | [5. Compute](aws_service_decision_guide.md#compute); [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage) | Fargate web tier, retryable Spot workers, Rekognition, and durable S3. |
| 107 | [1. Identity](aws_service_decision_guide.md#identity); [11. Deployment](aws_service_decision_guide.md#deployment) | CloudFormation creates IAM role and EC2 instance profile, not static credentials. |
| 108 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront viewer certificate in us-east-1; ALB origin certificate in its Region. |
| 109 | [10. Operations and security](aws_service_decision_guide.md#operations) | Approved-image Config evaluation and notifications are post-deployment controls. |
| 110 | [1. Identity](aws_service_decision_guide.md#identity); [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Cognito authorization and SQS decoupling for durable voting writes. |
| 111 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Split an overall long workflow into short Lambda tasks with Map/Parallel. |
| 112 | [6. Storage](aws_service_decision_guide.md#storage) | EFS shared access; provisioned throughput is not a guaranteed IOPS count. |
| 113 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity) | Load-balancer TLS termination separates certificate access from EC2 operations. |
| 114 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Historical WorkDocs collaboration answer; service shut down April 25, 2025. |
| 115 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | AppSync subscriptions push GraphQL updates rather than repeated polling. |
| 116 | [1. Identity](aws_service_decision_guide.md#identity) | EC2 role trust says who assumes; permission policy says what it can access. |
| 117 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | EC2Rescue automation repairs guest/access problems, not host recovery metrics. |
| 118 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [3. Networking and DNS](aws_service_decision_guide.md#network) | Durable queue absorbs BASE-style write bursts before on-premises processing. |
| 119 | [1. Identity](aws_service_decision_guide.md#identity) | Corporate federation plus scoped S3 prefixes; avoid replicated IAM users. |
| 120 | [11. Deployment](aws_service_decision_guide.md#deployment) | SSM latest-AMI parameter still requires a stack update and instance replacement. |
| 121 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | External MySQL replication needs consistent seed and binlog coordinates. |
| 122 | [1. Identity](aws_service_decision_guide.md#identity) | Cross-account limited audit role, not shared permanent administrator credentials. |
| 123 | [1. Identity](aws_service_decision_guide.md#identity) | The audited target account owns the role that trusts the auditor. |
| 124 | [10. Operations and security](aws_service_decision_guide.md#operations); [6. Storage](aws_service_decision_guide.md#storage) | Centralize CloudTrail; protect encryption, retention, deletion, and integrity separately. |
| 125 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | ASG/ALB, Aurora replicas, and Route 53 alias form complementary layers. |
| 126 | [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Instance-role presigning needs GetObject for downloads, not only list/upload. |
| 127 | [5. Compute](aws_service_decision_guide.md#compute); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Targets receive ALB traffic only through enabled AZs and healthy configuration. |
| 128 | [6. Storage](aws_service_decision_guide.md#storage) | Cached Volume Gateway retains hot data locally and primary block data in AWS. |
| 129 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Partition/object layout and CloudFront private-origin caching for articles. |
| 130 | [1. Identity](aws_service_decision_guide.md#identity); [11. Deployment](aws_service_decision_guide.md#deployment) | EC2 instance role/profile grants DynamoDB access without stored access keys. |
| 131 | [1. Identity](aws_service_decision_guide.md#identity) | Trusted backend authenticates users and brokers scoped temporary credentials. |
| 132 | [11. Deployment](aws_service_decision_guide.md#deployment) | Retain S3 versus Snapshot RDS; distinguish deletion from replacement policies. |
| 133 | [1. Identity](aws_service_decision_guide.md#identity); [2. Governance and cost](aws_service_decision_guide.md#governance) | Tag-scoped explicit deny protects production; protect the tags as well. |
| 134 | [11. Deployment](aws_service_decision_guide.md#deployment); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | SQS GetAtt Arn, not Ref URL, for SNS subscription; queue policy needed. |
| 135 | [3. Networking and DNS](aws_service_decision_guide.md#network); [10. Operations and security](aws_service_decision_guide.md#operations) | SG/NACL directions and database port; Config explains configuration changes. |
| 136 | [11. Deployment](aws_service_decision_guide.md#deployment) | CloudFormation Retain/Snapshot preserve resources or recoverable data appropriately. |
| 137 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | Direct S3 website needs public access and correct hostname/redirect setup. |
| 138 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Direct Connect is not encrypted by default; layer supported IPsec VPN. |
| 139 | [1. Identity](aws_service_decision_guide.md#identity) | LDAP requires an identity broker or compatible federation endpoint for STS. |
| 140 | [7. Databases](aws_service_decision_guide.md#database) | DocumentDB compatibility is not universal MongoDB feature equivalence. |
| 141 | [5. Compute](aws_service_decision_guide.md#compute); [1. Identity](aws_service_decision_guide.md#identity) | awsvpc provides task network isolation; task IAM role scopes application access. |
| 142 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch Manager performs patching; Config evaluates compliance. |
| 143 | [10. Operations and security](aws_service_decision_guide.md#operations); [3. Networking and DNS](aws_service_decision_guide.md#network) | Traffic Mirroring captures packets; Flow Logs only summarize flows. |
| 144 | [5. Compute](aws_service_decision_guide.md#compute); [1. Identity](aws_service_decision_guide.md#identity) | Execution role resolves startup secrets; task role authorizes application calls. |
| 145 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics) | Streams for low-latency ingestion; EMR processing; Redshift analytical queries. |
| 146 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | Firehose buffers delivery; downstream EMR/Redshift and lifecycle handle other stages. |
| 147 | [11. Deployment](aws_service_decision_guide.md#deployment) | CodeDeploy blue/green and Beanstalk immutable deployment are different mechanisms. |
| 148 | [11. Deployment](aws_service_decision_guide.md#deployment) | Beanstalk blue/green uses two environments and CNAME swap. |
| 149 | [7. Databases](aws_service_decision_guide.md#database) | Cache repeated database reads or offload them to replicas. |
| 150 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | ALB alias is managed load balancing; multivalue DNS is not equivalent. |

## Questions 151–200

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 151 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Kinesis partition key supplies session-level ordering, not global ordering. |
| 152 | [7. Databases](aws_service_decision_guide.md#database); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | DynamoDB Streams trigger consumers from item changes. |
| 153 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [9. Analytics](aws_service_decision_guide.md#analytics); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Textract extracts scanned text; OpenSearch indexes; S3/CloudFront serve assets. |
| 154 | [10. Operations and security](aws_service_decision_guide.md#operations) | Combine L3/L4 DDoS protection with WAF HTTP attack filtering. |
| 155 | [3. Networking and DNS](aws_service_decision_guide.md#network); [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | Minimize exposed paths/ports and restrict origins; layered protection. |
| 156 | [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Batch on interruption-tolerant capacity; retries and S3 protect results. |
| 157 | [6. Storage](aws_service_decision_guide.md#storage) | Requester Pays moves eligible transfer/request costs, not storage, to authenticated requesters. |
| 158 | [9. Analytics](aws_service_decision_guide.md#analytics); [5. Compute](aws_service_decision_guide.md#compute) | EMR task nodes can use Spot without holding HDFS data. |
| 159 | [9. Analytics](aws_service_decision_guide.md#analytics); [5. Compute](aws_service_decision_guide.md#compute) | Reliable primary/core topology; Spot task nodes add disposable compute. |
| 160 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Scale-in adjustment must match the specified low-utilization threshold and count. |
| 161 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Queue location processing; durable offer metadata; SNS mobile notifications. |
| 162 | [2. Governance and cost](aws_service_decision_guide.md#governance) | RI benefits depend on matching usage and Region; not cross-Region sharing. |
| 163 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Client VPN provides remote-user entry to otherwise private applications. |
| 164 | [7. Databases](aws_service_decision_guide.md#database); [2. Governance and cost](aws_service_decision_guide.md#governance) | DynamoDB reserved capacity applies to provisioned mode; archive/drop period tables. |
| 165 | [3. Networking and DNS](aws_service_decision_guide.md#network) | VPN is a lower-cost DX backup with different performance characteristics. |
| 166 | [6. Storage](aws_service_decision_guide.md#storage); [7. Databases](aws_service_decision_guide.md#database) | Archive data cheaply but retain searchable metadata; choose a valid restore window. |
| 167 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [7. Databases](aws_service_decision_guide.md#database) | REST/Lambda/DynamoDB architecture; API keys do not replace user authentication. |
| 168 | [5. Compute](aws_service_decision_guide.md#compute) | Mixed On-Demand/Spot across AZs with load balancing and interruption tolerance. |
| 169 | [7. Databases](aws_service_decision_guide.md#database) | Device partition key, timestamp sort key, and period-based retention strategy. |
| 170 | [10. Operations and security](aws_service_decision_guide.md#operations) | Multi-Region CloudTrail plus global events and protected central log storage. |
| 171 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Enable RAM organization sharing/trusted access before organizational resource sharing. |
| 172 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Management-account RI discount-sharing controls isolate unit benefits. |
| 173 | [2. Governance and cost](aws_service_decision_guide.md#governance) | SCPs apply to member root but not management-account or service-linked roles. |
| 174 | [2. Governance and cost](aws_service_decision_guide.md#governance) | SCPs restrict allowed services; platform provisioning tools do not replace them. |
| 175 | [3. Networking and DNS](aws_service_decision_guide.md#network); [10. Operations and security](aws_service_decision_guide.md#operations) | Private routes plus Flow Logs and central subscriptions diagnose rejected traffic. |
| 176 | [10. Operations and security](aws_service_decision_guide.md#operations) | Global service events alone do not create an all-Region CloudTrail trail. |
| 177 | [3. Networking and DNS](aws_service_decision_guide.md#network) | DX gateway connects eligible regional VPCs without automatic full-mesh VPC transit. |
| 178 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Resource-policy sharing preserves caller identity; assumed-role context is different. |
| 179 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | Aurora global readers are local; writes remain tied to the primary. |
| 180 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | Use ownership-aligned OUs, target-account roles, and trusted ABAC attributes. |
| 181 | [1. Identity](aws_service_decision_guide.md#identity); [2. Governance and cost](aws_service_decision_guide.md#governance) | Consolidated billing does not grant account administration permissions. |
| 182 | [3. Networking and DNS](aws_service_decision_guide.md#network) | URL/domain restrictions require suitable proxy/firewall and no bypass routes. |
| 183 | [6. Storage](aws_service_decision_guide.md#storage) | Existing S3 objects retain null version IDs when versioning is enabled. |
| 184 | [5. Compute](aws_service_decision_guide.md#compute) | Reserved concurrency controls capacity/cap; provisioned concurrency prewarms environments. |
| 185 | [12. Migration and DR](aws_service_decision_guide.md#migration); [3. Networking and DNS](aws_service_decision_guide.md#network) | Active/passive regional stacks need health-driven routing and ready recovery resources. |
| 186 | [2. Governance and cost](aws_service_decision_guide.md#governance); [11. Deployment](aws_service_decision_guide.md#deployment) | Service Catalog tags/parameters must propagate to the intended underlying resources. |
| 187 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Security Hub centralizes findings but is not every preventive/remediation control. |
| 188 | [1. Identity](aws_service_decision_guide.md#identity) | PowerUserAccess allows broad workload administration and selected organization reads, but not most IAM administration; NotAction is not a deny. |
| 189 | [1. Identity](aws_service_decision_guide.md#identity) | Custom LDAP authentication needs brokerage or compatible SAML/OIDC federation. |
| 190 | [2. Governance and cost](aws_service_decision_guide.md#governance) | An SCP allowlist omitting S3 blocks it despite identity-policy permission. |
| 191 | [1. Identity](aws_service_decision_guide.md#identity) | Vendor-specific ExternalId in role trust prevents confused-deputy access. |
| 192 | [1. Identity](aws_service_decision_guide.md#identity); [2. Governance and cost](aws_service_decision_guide.md#governance) | ForAllValues on TagKeys does not require all named tags or nonempty values. |
| 193 | [7. Databases](aws_service_decision_guide.md#database); [10. Operations and security](aws_service_decision_guide.md#operations) | RAC One Node is not ordinary RDS; validate EC2 topology and backups. |
| 194 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Replatform changes hosting/managed services without fundamental application redesign. |
| 195 | [12. Migration and DR](aws_service_decision_guide.md#migration); [9. Analytics](aws_service_decision_guide.md#analytics) | WAN cannot seed 60 TB in time; bulk transfer plus conversion/CDC. |
| 196 | [12. Migration and DR](aws_service_decision_guide.md#migration); [11. Deployment](aws_service_decision_guide.md#deployment); [6. Storage](aws_service_decision_guide.md#storage) | StackSets and replication prepare DR; failback needs data reconciliation. |
| 197 | [3. Networking and DNS](aws_service_decision_guide.md#network) | DX router/VIF setup requires correct BGP and authentication configuration. |
| 198 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Heterogeneous migration needs schema conversion plus DMS data/CDC. |
| 199 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Resolver outbound forwarding for AD namespace; retain AWS-aware VPC DNS. |
| 200 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Thirty-minute work does not fit one standard Lambda invocation; queue workers. |

## Questions 201–250

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 201 | [12. Migration and DR](aws_service_decision_guide.md#migration); [6. Storage](aws_service_decision_guide.md#storage) | Pre-seed the bulk dataset before cutover; transfer only the final delta. |
| 202 | [6. Storage](aws_service_decision_guide.md#storage) | Tape Gateway preserves the virtual tape/iSCSI backup-software interface. |
| 203 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudFront can front an on-premises HTTP origin with WAF protection. |
| 204 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | SQS/Spot processing for retryable image jobs; archive completed media appropriately. |
| 205 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge); [2. Governance and cost](aws_service_decision_guide.md#governance) | Move duplicated static media to S3/CloudFront; investigate costs separately. |
| 206 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage) | S3-triggered asynchronous Transcribe jobs; lifecycle recorded audio by retention needs. |
| 207 | [2. Governance and cost](aws_service_decision_guide.md#governance); [11. Deployment](aws_service_decision_guide.md#deployment); [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Service Catalog constrains encrypted SageMaker notebook provisioning and outputs. |
| 208 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Step Functions persists order workflow and waits for external completion callbacks. |
| 209 | [12. Migration and DR](aws_service_decision_guide.md#migration) | MGN agent-based replication belongs on source servers, not only the hypervisor. |
| 210 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Prioritize online critical-server migration; bulk-seed data beyond WAN capacity. |
| 211 | [12. Migration and DR](aws_service_decision_guide.md#migration) | MGN continuously replicates server blocks, then supports test and cutover. |
| 212 | [1. Identity](aws_service_decision_guide.md#identity) | Corporate SAML federation supplies temporary access without new AWS passwords. |
| 213 | [5. Compute](aws_service_decision_guide.md#compute); [0. Decision method](aws_service_decision_guide.md#decision) | Diversified Spot is not guaranteed spare capacity during an AZ failure. |
| 214 | [1. Identity](aws_service_decision_guide.md#identity) | Authenticated backend brokers per-user temporary AWS credentials. |
| 215 | [6. Storage](aws_service_decision_guide.md#storage); [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Preserve file-oriented media workflows; S3 stores media; Rekognition derives metadata. |
| 216 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage) | Rekognition face collections hold representations, not the original image archive. |
| 217 | [6. Storage](aws_service_decision_guide.md#storage) | S3 Transfer Acceleration uses the accelerate endpoint for distant transfers. |
| 218 | [12. Migration and DR](aws_service_decision_guide.md#migration) | MGN supports low-downtime rehosting of eligible physical Windows/Linux servers. |
| 219 | [11. Deployment](aws_service_decision_guide.md#deployment); [2. Governance and cost](aws_service_decision_guide.md#governance) | Organization-integrated StackSets deploy across accounts and Regions. |
| 220 | [1. Identity](aws_service_decision_guide.md#identity) | Vendor generates unique ExternalId; customer checks it in AssumeRole trust. |
| 221 | [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Cross-account encrypted S3 needs bucket, caller IAM, and KMS permissions. |
| 222 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Long queue jobs fit EC2 workers, not a single short-lived Lambda invocation. |
| 223 | [1. Identity](aws_service_decision_guide.md#identity) | Identity Center with Managed AD requires a two-way trust to self-managed AD, not a one-way trust. |
| 224 | [1. Identity](aws_service_decision_guide.md#identity) | LDAP must become compatible SAML/OIDC identity or use a broker. |
| 225 | [1. Identity](aws_service_decision_guide.md#identity) | Managed AD trust preserves corporate identities without duplicating IAM users. |
| 226 | [7. Databases](aws_service_decision_guide.md#database) | Read replicas/cache offload reads; sharding is an application/data-model change. |
| 227 | [1. Identity](aws_service_decision_guide.md#identity) | Instance profile provides rotating temporary S3 credentials through SDK metadata access. |
| 228 | [12. Migration and DR](aws_service_decision_guide.md#migration); [5. Compute](aws_service_decision_guide.md#compute) | Supported OpenJDK/container replatforming and managed DB reduce licensing/operations. |
| 229 | [12. Migration and DR](aws_service_decision_guide.md#migration); [10. Operations and security](aws_service_decision_guide.md#operations) | Frequent recoverable transaction logs tighten RPO beyond full-backup frequency. |
| 230 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Connect is the contact center; Lex handles conversational intent. |
| 231 | [3. Networking and DNS](aws_service_decision_guide.md#network) | VPN backup to existing DX paths favors cost over identical link performance. |
| 232 | [10. Operations and security](aws_service_decision_guide.md#operations); [12. Migration and DR](aws_service_decision_guide.md#migration) | Managed continuous/PITR backup can meet short recovery-point requirements. |
| 233 | [5. Compute](aws_service_decision_guide.md#compute); [2. Governance and cost](aws_service_decision_guide.md#governance); [6. Storage](aws_service_decision_guide.md#storage) | Drain retryable Spot containers; commit steady DB; lifecycle retained data. |
| 234 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront distributes large game objects; private REST origin does not need website hosting. |
| 235 | [7. Databases](aws_service_decision_guide.md#database) | Aurora replicas/RDS Proxy reduce failover impact without an absolute interruption guarantee. |
| 236 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | Secrets Manager rotation needs both schedule and working rotation integration. |
| 237 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Queue answer writes; offload cacheable assets to S3/CloudFront. |
| 238 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Accelerate existing on-premises web delivery without migrating the origin first. |
| 239 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | SNS with one SQS per service; RDS Proxy pools DB connections. |
| 240 | [2. Governance and cost](aws_service_decision_guide.md#governance); [10. Operations and security](aws_service_decision_guide.md#operations) | Config detects missing tags; supported SCP request-tag checks prevent creation. |
| 241 | [6. Storage](aws_service_decision_guide.md#storage); [12. Migration and DR](aws_service_decision_guide.md#migration) | SMB data goes to FSx Windows via DataSync; VM import handles machine images. |
| 242 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | ECS secret reference uses execution role; writer endpoint and DB SG must match. |
| 243 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Additional DX path and gateway/VIF associations; diversify physical failure domains. |
| 244 | [6. Storage](aws_service_decision_guide.md#storage); [3. Networking and DNS](aws_service_decision_guide.md#network) | Transfer Family VPC internet-facing endpoint preserves EIPs/keys and permits IP allowlisting. |
| 245 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | Glue crawler discovers schema; transformation must actually redact sensitive fields. |
| 246 | [5. Compute](aws_service_decision_guide.md#compute); [3. Networking and DNS](aws_service_decision_guide.md#network) | VPC Lambda needs private DB reachability and a DynamoDB endpoint or NAT. |
| 247 | [6. Storage](aws_service_decision_guide.md#storage) | DataSync schedules incremental SMB transfer to FSx Windows. |
| 248 | [6. Storage](aws_service_decision_guide.md#storage) | Create new FSx Multi-AZ deployment, synchronize, and cut over. |
| 249 | [2. Governance and cost](aws_service_decision_guide.md#governance); [9. Analytics](aws_service_decision_guide.md#analytics) | CUR plus account-to-OU mapping and QuickSight access controls for unit dashboards. |
| 250 | [2. Governance and cost](aws_service_decision_guide.md#governance); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudWatch memory metrics inform right-sizing; preserve needed DR capacity. |

## Questions 251–300

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 251 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | MediaConvert creates HLS; instant-access archive preserves immediate original retrieval. |
| 252 | [12. Migration and DR](aws_service_decision_guide.md#migration) | SQL Server to MySQL is heterogeneous: schema conversion plus data/CDC. |
| 253 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Containerize supported .NET application; Fargate, Multi-AZ DB, and scoped secrets. |
| 254 | [11. Deployment](aws_service_decision_guide.md#deployment) | Feature branches build/test/deploy in isolated nonproduction accounts. |
| 255 | [2. Governance and cost](aws_service_decision_guide.md#governance); [11. Deployment](aws_service_decision_guide.md#deployment) | Service Catalog launch role provisions resources without broad requester permissions. |
| 256 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Separate TGW route tables/propagation preserve development-production isolation. |
| 257 | [6. Storage](aws_service_decision_guide.md#storage) | Managed Transfer Family replaces EC2 SFTP operations while retaining endpoint naming. |
| 258 | [10. Operations and security](aws_service_decision_guide.md#operations); [1. Identity](aws_service_decision_guide.md#identity) | Replace authorized_keys and remove the old key; key-pair deletion alone is insufficient. |
| 259 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Application and DB SG directions/port must agree; stateful return is implicit. |
| 260 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Textract extracts scanned content; Comprehend interprets text; Step Functions orchestrates. |
| 261 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Dependency-aware monitoring should not trigger fleet-wide liveness replacement storms. |
| 262 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | Global Accelerator supplies static anycast IPs and healthy regional endpoints. |
| 263 | [7. Databases](aws_service_decision_guide.md#database) | On-demand/scalable DynamoDB for small items; TTL is asynchronous deletion. |
| 264 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Temporarily suspend termination for investigation; use Session Manager and resume. |
| 265 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | One-hour visibility already fits the job; maxReceiveCount=1 causes premature DLQ. |
| 266 | [6. Storage](aws_service_decision_guide.md#storage) | CHAP authenticates iSCSI sessions but does not encrypt their payloads. |
| 267 | [11. Deployment](aws_service_decision_guide.md#deployment) | Test-stack change set/execution and CodeBuild integration tests serve different checks. |
| 268 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Client VPN needs user authorization and routes into intended connected VPCs. |
| 269 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | SCP permission ceiling does not grant the missing IAM allow. |
| 270 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge); [5. Compute](aws_service_decision_guide.md#compute) | Shared forecast files and freshness-aware cache; validate actual I/O/latency requirements. |
| 271 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Edge authentication must respect runtime and origin-failover method restrictions. |
| 272 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [11. Deployment](aws_service_decision_guide.md#deployment) | Valid custom-domain certificate and cache lifetime matching content freshness. |
| 273 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Device-specific edge logic requires correct cache-key variation. |
| 274 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Normalize query strings before cache lookup; preserve case-sensitive application semantics. |
| 275 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | Private S3 OAC origin plus signed viewer access; URL remains a bearer token. |
| 276 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront custom on-premises origin improves delivery without application migration. |
| 277 | [5. Compute](aws_service_decision_guide.md#compute) | ECS Anywhere manages external hosts; Fargate handles AWS-hosted containers. |
| 278 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | Invited accounts do not automatically receive OrganizationAccountAccessRole. |
| 279 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Step Functions coordinates states, parallelism, retry, and reprocessing. |
| 280 | [6. Storage](aws_service_decision_guide.md#storage); [5. Compute](aws_service_decision_guide.md#compute) | Ephemeral S3-linked Lustre fits monthly batch; persist output before deleting it. |
| 281 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics) | Firehose transforms/buffers into OpenSearch for near-real-time analytics. |
| 282 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute); [3. Networking and DNS](aws_service_decision_guide.md#network) | DynamoDB global tables and regional Fargate services enable eligible active/active design. |
| 283 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Zone owner authorizes VPC association; VPC owner associates; then remove authorization. |
| 284 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Reduce real duration/connection bottlenecks; API caching only for reusable responses. |
| 285 | [12. Migration and DR](aws_service_decision_guide.md#migration); [6. Storage](aws_service_decision_guide.md#storage) | Preprovision recovery capacity and restore supported backup artifacts to minimize RTO. |
| 286 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | S3 document storage plus OpenSearch indexing and application serving. |
| 287 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | System-status recovery preserves supported instance identity; replacement is different. |
| 288 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudFormation resolves Secrets Manager password; rotation integration updates it. |
| 289 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | OpenSearch supplies searchable index; S3 retains durable source documents. |
| 290 | [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Presigned URL depends on signature, permissions, method, expiry, and credential lifetime. |
| 291 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Resilient application/DB tiers plus static delivery and WAF filtering. |
| 292 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | UDP requires suitable NLB; do not block necessary TCP health checks. |
| 293 | [3. Networking and DNS](aws_service_decision_guide.md#network) | NACL can explicitly deny hostile IP ranges; SG cannot contain deny rules. |
| 294 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database) | Bulk seed beyond WAN limit, then CDC final changes and coordinated cutover. |
| 295 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage); [15. Corrections](aws_service_decision_guide.md#corrections) | Regional copies/origin selection can reduce misses; eu-east-1 is an invalid identifier. |
| 296 | [11. Deployment](aws_service_decision_guide.md#deployment) | CDK uses familiar languages; CloudFormation iteration does exist via Fn::ForEach. |
| 297 | [5. Compute](aws_service_decision_guide.md#compute); [11. Deployment](aws_service_decision_guide.md#deployment) | Bake the shared framework into an AMI to shorten startup. |
| 298 | [7. Databases](aws_service_decision_guide.md#database); [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Commit stable baseline; scale application and Aurora readers for variable demand. |
| 299 | [6. Storage](aws_service_decision_guide.md#storage) | Windows CMS sharing requires suitable SMB/AD filesystem, usually FSx Windows. |
| 300 | [6. Storage](aws_service_decision_guide.md#storage); [10. Operations and security](aws_service_decision_guide.md#operations) | Monitor FreeStorageCapacity and automate supported FSx storage increases before exhaustion. |

## Questions 301–350

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 301 | [10. Operations and security](aws_service_decision_guide.md#operations) | Logs agent, metric filter, alarm, and SNS each supply a required step. |
| 302 | [6. Storage](aws_service_decision_guide.md#storage); [10. Operations and security](aws_service_decision_guide.md#operations) | RTC is a 99.99%/15-minute SLA; align alerting with requested threshold. |
| 303 | [6. Storage](aws_service_decision_guide.md#storage); [10. Operations and security](aws_service_decision_guide.md#operations) | Public-ACL remediation is reactive; modern Block Public Access is preventive. |
| 304 | [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Event-driven ten-minute Lambda processing fits standard invocation duration. |
| 305 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | CloudTrail/EventBridge records organization actions; Config is not universal membership history. |
| 306 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Reactive IAM approval workflow needs awareness of races and preventive boundaries. |
| 307 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch Manager supports hybrid patching, not arbitrary major OS migration. |
| 308 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | SageMaker trains centrally; Greengrass runs local/offline inference components. |
| 309 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [3. Networking and DNS](aws_service_decision_guide.md#network) | IoT MQTT cutover requires custom-domain TLS, authentication, and delivery settings. |
| 310 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Connect plus Lex and Lambda provides automated conversational business actions. |
| 311 | [11. Deployment](aws_service_decision_guide.md#deployment) | Pipeline build/security checks, failure events, and manual approval gate production. |
| 312 | [7. Databases](aws_service_decision_guide.md#database) | RDS read replicas offload monthly reporting without loading the writer. |
| 313 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Field-level encryption protects selected form fields; TLS and caching are separate. |
| 314 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | OAC protects S3; validate CloudFront-added secret header at ALB/WAF origin. |
| 315 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | Private S3 REST bucket plus OAC restricts origin access. |
| 316 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Direct presigned S3 or signed CloudFront; neither intrinsically binds original identity. |
| 317 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | OAC uses CloudFront service-principal policy, not OAI's identity model. |
| 318 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Add S3 origin and static-path behavior; keep dynamic routes on ALB. |
| 319 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Multi-AZ application, managed DB migration, and Route 53 alias cutover. |
| 320 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Transform discovery/assessment versus organizational cloud-readiness evaluation. |
| 321 | [6. Storage](aws_service_decision_guide.md#storage); [7. Databases](aws_service_decision_guide.md#database) | sc1 fits cold sequential throughput, not arbitrary random-I/O database workloads. |
| 322 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Discovery gathers configuration, utilization, and dependencies before migration planning. |
| 323 | [12. Migration and DR](aws_service_decision_guide.md#migration); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Db2 conversion/data migration; WebSphere rehost; validate IBM MQ protocol compatibility. |
| 324 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Aurora Auto Scaling adds readers; sticky sessions do not replicate state. |
| 325 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Pilot light requires DB promotion and ASG scale-up before traffic cutover. |
| 326 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Custom error page needs correct behavior/origin; S3 website cannot use OAC. |
| 327 | [2. Governance and cost](aws_service_decision_guide.md#governance); [3. Networking and DNS](aws_service_decision_guide.md#network) | VPC owner shares subnets and controls networking; participants own their workloads. |
| 328 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Termination lifecycle hook captures logs; match Command versus Automation API. |
| 329 | [1. Identity](aws_service_decision_guide.md#identity) | External SAML authentication and SCIM provisioning are distinct Identity Center integrations. |
| 330 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Management activates cost allocation tags; CUR can then expose eligible tagged costs. |
| 331 | [2. Governance and cost](aws_service_decision_guide.md#governance); [9. Analytics](aws_service_decision_guide.md#analytics) | CUR/QuickSight organization dashboards need account-to-OU mapping and access rules. |
| 332 | [11. Deployment](aws_service_decision_guide.md#deployment); [2. Governance and cost](aws_service_decision_guide.md#governance) | StackSets trusted access and automatic OU deployment include newly created accounts. |
| 333 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Discovery/right-sizing and dependencies support application grouping and migration waves. |
| 334 | [2. Governance and cost](aws_service_decision_guide.md#governance); [3. Networking and DNS](aws_service_decision_guide.md#network) | Tag-scoped SG protection must cover authorize, revoke, modify, delete, and tag changes. |
| 335 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [5. Compute](aws_service_decision_guide.md#compute) | Function URL fits simple webhook; validate provider signature when not using IAM auth. |
| 336 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Hyper-V discovery/assessment collects utilization and dependency data before migration. |
| 337 | [10. Operations and security](aws_service_decision_guide.md#operations) | Register hybrid managed nodes, then apply Patch Manager policies and compliance reporting. |
| 338 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | OpenSearch hot to UltraWarm to cold; archive source data separately. |
| 339 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Reuse connections outside handler and pool with RDS Proxy. |
| 340 | [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Schedule Compute Optimizer Lambda recommendation export to S3. |
| 341 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [5. Compute](aws_service_decision_guide.md#compute) | Separate Lambda-backed API functions scale independently instead of one monolith. |
| 342 | [5. Compute](aws_service_decision_guide.md#compute) | Package long encoding as ECR image and launch Fargate task; not long Lambda. |
| 343 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-account Aurora clone is copy-on-write, not live replication; recreate Lambda configuration. |
| 344 | [6. Storage](aws_service_decision_guide.md#storage) | Storage Lens advanced metrics: 15-month query window versus 14 days for free metrics; Inventory is not historical aggregate analytics. |
| 345 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Accelerate distant S3 upload; edge-optimized REST API addresses API entry latency. |
| 346 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Budgets alert by account; Cost Explorer analyzes spending; delivery needs automation. |
| 347 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | SES SMTP uses separate credentials and STARTTLS 587, not insecure SMTP assumptions. |
| 348 | [12. Migration and DR](aws_service_decision_guide.md#migration) | VM Import needs actual supported disk/image artifact, not just an OVF descriptor. |
| 349 | [1. Identity](aws_service_decision_guide.md#identity); [3. Networking and DNS](aws_service_decision_guide.md#network); [15. Corrections](aws_service_decision_guide.md#corrections) | Client VPN supports MFA enabled on Managed Microsoft AD or AD Connector; the latter is not an obligatory extra layer. |
| 350 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Organization trail covers current/future member accounts with correct scope. |

## Questions 351–391

| Q-ID | Review | Decisive distinction |
|---|---|---|
| 351 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [9. Analytics](aws_service_decision_guide.md#analytics) | Kubernetes portability, serverless OLTP, and serverless analytics are distinct layers. |
| 352 | [7. Databases](aws_service_decision_guide.md#database) | ElastiCache reduces repeated queries; RDS Proxy reduces connection overhead. |
| 353 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Update WorkSpaces IP access control group for new office egress address. |
| 354 | [3. Networking and DNS](aws_service_decision_guide.md#network); [2. Governance and cost](aws_service_decision_guide.md#governance) | RAM shares TGW; its owner enables appropriate auto-accept settings. |
| 355 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute) | GWLB endpoints distribute traffic through configured autoscaled network appliances. |
| 356 | [3. Networking and DNS](aws_service_decision_guide.md#network); [15. Corrections](aws_service_decision_guide.md#corrections) | TGW advertises configured allowed prefixes; VGW filters VPC CIDRs. A 200 Mbps DX connection is not automatically invalid. |
| 357 | [9. Analytics](aws_service_decision_guide.md#analytics); [10. Operations and security](aws_service_decision_guide.md#operations) | Parquet and hourly partitions lower flow-log SQL scan cost. |
| 358 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Latency alias routing and EvaluateTargetHealth choose healthy low-latency ELBs. |
| 359 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | SCP IAM restriction needs principal exception and management-account scope awareness. |
| 360 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-Region MySQL replica must be promoted before application write failover. |
| 361 | [5. Compute](aws_service_decision_guide.md#compute); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Split browsing/checkout scaling boundaries; edge JWT logic must verify claims/signature. |
| 362 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [7. Databases](aws_service_decision_guide.md#database) | Keep PII off immutable blockchain; store only appropriate commitments on ledger. |
| 363 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database) | Aurora global replication plus DRS application recovery; test full RPO/RTO path. |
| 364 | [5. Compute](aws_service_decision_guide.md#compute) | Long video processing on event-launched Fargate avoids idle workers and Lambda timeout. |
| 365 | [1. Identity](aws_service_decision_guide.md#identity) | Target trusts source EC2 role; source can AssumeRole; no foreign instance profile. |
| 366 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Multi-AZ application load balancing plus Aurora reader capacity. |
| 367 | [3. Networking and DNS](aws_service_decision_guide.md#network) | NLB endpoint service can expose eligible on-premises IP targets over DX privately. |
| 368 | [5. Compute](aws_service_decision_guide.md#compute) | Long ECS-on-EC2 jobs can binpack memory; match scaling metrics and job duration. |
| 369 | [6. Storage](aws_service_decision_guide.md#storage); [11. Deployment](aws_service_decision_guide.md#deployment) | EFS preserves NFS contract; keep durable Aurora outside disposable Beanstalk lifecycle. |
| 370 | [1. Identity](aws_service_decision_guide.md#identity); [11. Deployment](aws_service_decision_guide.md#deployment) | GitHub OIDC role trust uses AssumeRoleWithWebIdentity and scoped token claims. |
| 371 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [6. Storage](aws_service_decision_guide.md#storage) | Sporadic short queue jobs favor Lambda and S3 over always-on workers. |
| 372 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-Region SQL Server replicas exist but require supported edition/version/configuration. |
| 373 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Migration Evaluator builds utilization-based TCO/assessment, not a live replication stream. |
| 374 | [6. Storage](aws_service_decision_guide.md#storage); [3. Networking and DNS](aws_service_decision_guide.md#network); [1. Identity](aws_service_decision_guide.md#identity) | S3 endpoint plus VPC-origin access point and bucket delegation confine approved access. |
| 375 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute) | S3 gateway endpoint removes eligible NAT charges; schedule predictable scaling ahead. |
| 376 | [5. Compute](aws_service_decision_guide.md#compute); [1. Identity](aws_service_decision_guide.md#identity) | ECR organization pull policy; identity token permission; expire only targeted untagged images. |
| 377 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | Local read replica reduces distant read latency while writer stays primary. |
| 378 | [6. Storage](aws_service_decision_guide.md#storage); [2. Governance and cost](aws_service_decision_guide.md#governance) | Deny access-point creation unless AccessPointNetworkOrigin is VPC. |
| 379 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | Tag policy validates standards; request-tag SCP enforces supported creation requirements. |
| 380 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront Functions is sufficient for lightweight viewer query normalization. |
| 381 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Private zone association and both DNS settings; retain correct DHCP resolver. |
| 382 | [12. Migration and DR](aws_service_decision_guide.md#migration); [9. Analytics](aws_service_decision_guide.md#analytics) | Analyze discovered dependencies; migrate tightly coupled servers in coordinated waves. |
| 383 | [9. Analytics](aws_service_decision_guide.md#analytics) | Redshift concurrency scaling handles eligible simultaneous queries, not every slow query. |
| 384 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Implement precise service/instance-class restrictions with supported controls/SCPs and dependencies. |
| 385 | [9. Analytics](aws_service_decision_guide.md#analytics) | Athena/Glue on S3 ORC can replace always-on EMR for intermittent SQL. |
| 386 | [2. Governance and cost](aws_service_decision_guide.md#governance) | EC2 Instance SP, Compute SP for Lambda, and MemoryDB reservations differ. |
| 387 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Catch preserves input only with appropriate ResultPath; States.ALL has exceptions. |
| 388 | [10. Operations and security](aws_service_decision_guide.md#operations); [12. Migration and DR](aws_service_decision_guide.md#migration) | AWS Backup schedules/retentions/copies; explicit failure events; copies are asynchronous. |
| 389 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Multi-AZ GWLB endpoints and appliances need symmetric forward/return inspection routes. |
| 390 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [7. Databases](aws_service_decision_guide.md#database) | NLB fits transport requirements; ALB supports WebSockets; global consistency needs explicit design. |
| 391 | [10. Operations and security](aws_service_decision_guide.md#operations) | Inspector dependency scanning versus code scanning; exact code-exclusion tag. |
