# AWS question-to-rule index

Companion to [AWS service decision guide](aws_service_decision_guide.md). All **391** questions in `questions.jsonl` are mapped below in their original file order.

Use the **question ID** to locate a missed question, then review the linked service sections. The final column gives the distinguishing rule, not an option letter or an uncritical reproduction of the answer key. Where the bank is outdated or incomplete, the guide explains the caveat.

**No.** = one-based line/order in the uploaded file. **Q-ID** = its original `id` field. This index is a navigation aid, not a second chapter to memorize.

## Questions 1–50

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 1 | 6170 | [3. Networking and DNS](aws_service_decision_guide.md#network); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Public-zone DNSSEC signing; independent TLS configuration; SNI terminology. |
| 2 | 6445 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | AWS_IAM requires SigV4 and invoke permission; X-Ray traces requests. |
| 3 | 6658 | [11. Deployment](aws_service_decision_guide.md#deployment) | Beanstalk blue/green swaps environment CNAMEs; hooks configure the environment. |
| 4 | 6662 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute); [11. Deployment](aws_service_decision_guide.md#deployment) | Reuse AZ-compatible ENIs for MAC-bound licensing; bootstrap from Parameter Store. |
| 5 | 6776 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Replace failed NAT-instance topology with resilient NAT routing. |
| 6 | 6908 | [3. Networking and DNS](aws_service_decision_guide.md#network); [1. Identity](aws_service_decision_guide.md#identity) | S3 gateway endpoint plus endpoint, role, and bucket restrictions. |
| 7 | 7327 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | CloudFront country restriction is access control; DNS geolocation is routing. |
| 8 | 7891 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Audit with CloudTrail and limited credentials; prefer temporary audit roles. |
| 9 | 7892 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch Manager executes baseline-driven patching; Maintenance Windows schedules it. |
| 10 | 7893 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Kinesis Producer Library ingests; WebSocket management API sends to clients. |
| 11 | 7895 | [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | Multi-AZ availability, read replicas, and static-content delivery solve different problems. |
| 12 | 7897 | [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Right-size and reserve the five-instance baseline; autoscale the burst. |
| 13 | 7901 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Principal-tag ABAC plus CloudTrail S3 data events for access audits. |
| 14 | 7907 | [9. Analytics](aws_service_decision_guide.md#analytics); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-Region Redshift snapshots; verify copy frequency and restoration time. |
| 15 | 8194 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Buffer write bursts in SQS; scale consumers and DynamoDB throughput. |
| 16 | 9005 | [3. Networking and DNS](aws_service_decision_guide.md#network) | TGW central egress with firewall inspection and correct return routes. |
| 17 | 9013 | [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Precompute reports on a replica; serve S3 output through CloudFront. |
| 18 | 9023 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | CodeDeploy supports hybrid deployment; protect configuration with SecureString. |
| 19 | 9025 | [3. Networking and DNS](aws_service_decision_guide.md#network); [10. Operations and security](aws_service_decision_guide.md#operations) | NACL IP denial and Shield Advanced address distinct attack controls. |
| 20 | 9027 | [11. Deployment](aws_service_decision_guide.md#deployment) | SAM plus build/deploy/pipeline tooling; repository is not pipeline execution. |
| 21 | 9031 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | WAF on a supported REST API stage; Config tracks configuration. |
| 22 | 9032 | [1. Identity](aws_service_decision_guide.md#identity); [7. Databases](aws_service_decision_guide.md#database); [6. Storage](aws_service_decision_guide.md#storage) | Cognito users; DynamoDB metadata; private S3 media and CloudFront. |
| 23 | 9034 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | ALB certificates must exist in each load balancer's Region. |
| 24 | 9035 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Cross-account private hosted-zone authorization/association; peering not inherently required. |
| 25 | 9036 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute) | Private Fargate needs public-subnet NAT or complete private-endpoint access. |
| 26 | 9037 | [10. Operations and security](aws_service_decision_guide.md#operations) | Separate patch groups and nonoverlapping windows avoid simultaneous outages. |
| 27 | 9038 | [10. Operations and security](aws_service_decision_guide.md#operations); [12. Migration and DR](aws_service_decision_guide.md#migration) | Recovery logs tighten RPO; distinguish RDS-managed backups from Macie-scannable S3. |
| 28 | 9039 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [6. Storage](aws_service_decision_guide.md#storage); [12. Migration and DR](aws_service_decision_guide.md#migration) | Replicate input data; parallelize queued workers; recreate regional infrastructure. |
| 29 | 9040 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch baselines and Config approved-image checks are different compliance controls. |
| 30 | 9044 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudFront/WAF/resilient capacity can meet lower-budget DDoS requirements. |
| 31 | 9045 | [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Commit steady compute/database usage; Spot requires interruption tolerance. |
| 32 | 9063 | [10. Operations and security](aws_service_decision_guide.md#operations) | Target patch policies by environment and operating system; stage rollouts. |
| 33 | 9068 | [7. Databases](aws_service_decision_guide.md#database) | DynamoDB global tables; Keyspaces replication dismissal is outdated. |
| 34 | 9070 | [10. Operations and security](aws_service_decision_guide.md#operations) | CloudWatch agent supplies memory/filesystem/log metrics; Logs Insights queries logs. |
| 35 | 9073 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics) | Real-time stream ingestion; S3 aggregation and Redshift analytics. |
| 36 | 9074 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Private A record to private IP; enable both VPC DNS settings. |
| 37 | 9076 | [11. Deployment](aws_service_decision_guide.md#deployment); [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Regional multi-AZ ASG/ALB; resilient Aurora; preserve long-lived database resources. |
| 38 | 9078 | [1. Identity](aws_service_decision_guide.md#identity); [7. Databases](aws_service_decision_guide.md#database) | Small user preferences fit DynamoDB; use scoped temporary credentials. |
| 39 | 9085 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | HSM-held non-exportable TLS key; TCP pass-through; protected log encryption. |
| 40 | 9086 | [2. Governance and cost](aws_service_decision_guide.md#governance); [10. Operations and security](aws_service_decision_guide.md#operations) | Alarm on actual usage divided by its service quota. |
| 41 | 9088 | [5. Compute](aws_service_decision_guide.md#compute); [11. Deployment](aws_service_decision_guide.md#deployment); [6. Storage](aws_service_decision_guide.md#storage) | Baked OS image; CodeDeploy application updates; EFS avoids massive boot downloads. |
| 42 | 9095 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Root explicit deny cannot be overridden by an OU allow. |
| 43 | 9137 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | IoT Basic Ingest plus buffered Firehose fits delay-tolerant low-operations ingestion. |
| 44 | 9138 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | API/Lambda authentication; DynamoDB metadata; authorized presigned S3 transfers. |
| 45 | 9139 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | TLS private key stays in CloudHSM; load balancer passes TCP through. |
| 46 | 9140 | [3. Networking and DNS](aws_service_decision_guide.md#network); [15. Corrections](aws_service_decision_guide.md#corrections) | Targets can reference the NLB SG; enforced PrivateLink inbound rules use the client private IP, not the endpoint IP. |
| 47 | 9143 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Lambda concurrency and DynamoDB write throttling require separate fixes. |
| 48 | 9144 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Warm standby keeps a scaled-down complete application ready for rapid recovery. |
| 49 | 9145 | [7. Databases](aws_service_decision_guide.md#database) | RDS Oracle Multi-AZ is managed HA, not Oracle RAC. |
| 50 | 9148 | [1. Identity](aws_service_decision_guide.md#identity); [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Authenticate separately; queue checkout work; persist durable state. |

## Questions 51–100

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 51 | 9149 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Multi-AZ application and transactional DB; cache suitable web content. |
| 52 | 9150 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | SQS processing plus DynamoDB and SNS mobile push; no carrier-edge requirement. |
| 53 | 9155 | [1. Identity](aws_service_decision_guide.md#identity) | SAML trust principal and AssumeRoleWithSAML parameters must match. |
| 54 | 9160 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | Use RDS DNS endpoint and reconnect; do not pin changing instance IPs. |
| 55 | 9163 | [11. Deployment](aws_service_decision_guide.md#deployment); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Versioned infrastructure definitions plus CloudFront distribution. |
| 56 | 9164 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity) | Separate certificate administration; terminate TLS outside application-managed instances. |
| 57 | 9173 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Integrated ACM certificate for the ALB; distinguish certificate offering/cost. |
| 58 | 9175 | [6. Storage](aws_service_decision_guide.md#storage) | SSE-S3 envelope encryption and default encryption, not multi-factor encryption. |
| 59 | 9178 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Device Management fleet operations versus Device Defender security monitoring. |
| 60 | 9180 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Correct NAT placement, Elastic IP, and private-subnet default route. |
| 61 | 9183 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Shared TGW and centralized GWLB-based egress inspection at account scale. |
| 62 | 9187 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Stateless autoscaling, shared sessions/cache, read replicas, and DB availability. |
| 63 | 9199 | [7. Databases](aws_service_decision_guide.md#database); [10. Operations and security](aws_service_decision_guide.md#operations) | RAC requires supported self-management; patching and snapshot lifecycle remain necessary. |
| 64 | 9200 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Longest-prefix /32 route selects one overlapping spoke address; return routes required. |
| 65 | 9201 | [6. Storage](aws_service_decision_guide.md#storage); [7. Databases](aws_service_decision_guide.md#database); [10. Operations and security](aws_service_decision_guide.md#operations) | Immediate old-object access favors Standard-IA; Multi-AZ and Macie solve other needs. |
| 66 | 9207 | [11. Deployment](aws_service_decision_guide.md#deployment); [5. Compute](aws_service_decision_guide.md#compute) | CloudFormation ASG rolling UpdatePolicy replaces instances for AMI changes. |
| 67 | 9208 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Remote users need client VPN into private applications, not public exposure. |
| 68 | 9209 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Two VPN tunnels do not remove a single customer-device/location failure. |
| 69 | 9210 | [6. Storage](aws_service_decision_guide.md#storage) | SSE-C needs HTTPS and customer-key headers; current default blocks new use. |
| 70 | 9211 | [10. Operations and security](aws_service_decision_guide.md#operations) | Inspector Classic workflow is retired; retain current scanning/approved-image intent. |
| 71 | 9212 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | ALB multiple certificates use SNI; CloudFront dedicated IP does not bypass coverage. |
| 72 | 9215 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Default CloudFront certificate with HTTPS-only or redirect policy. |
| 73 | 9216 | [6. Storage](aws_service_decision_guide.md#storage); [12. Migration and DR](aws_service_decision_guide.md#migration) | Stored Volume Gateway snapshots can restore as EBS for EC2 recovery. |
| 74 | 9219 | [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Cluster placement/EFA and FSx Lustre fit tightly coupled HPC. |
| 75 | 9221 | [6. Storage](aws_service_decision_guide.md#storage) | Spectrum-compatible SSE-KMS plus TLS bucket policy; not SSE-C. |
| 76 | 9223 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Aurora Global Database plus promotion and regional traffic failover. |
| 77 | 9224 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database) | Replicate the large database; restore stateless application from image/template. |
| 78 | 9228 | [7. Databases](aws_service_decision_guide.md#database); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Reporting on a read replica; SNS notification versus full SMTP delivery. |
| 79 | 9230 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | SQS buffers relational writes without forcing a DynamoDB redesign. |
| 80 | 9231 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Parallel queued workers with shared S3 input/output. |
| 81 | 9232 | [11. Deployment](aws_service_decision_guide.md#deployment) | Test in nonproduction; inspect changes; blue/green deployment supports rollback. |
| 82 | 9233 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Viewer HTTPS and origin HTTPS require separate policies and valid certificates. |
| 83 | 9237 | [0. Decision method](aws_service_decision_guide.md#decision); [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Three AZs need spare failure capacity; commit baseline rather than peaks. |
| 84 | 9238 | [1. Identity](aws_service_decision_guide.md#identity) | OIDC web identity supplies temporary S3/DynamoDB credentials. |
| 85 | 9240 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Queue write bursts and control downstream database throughput. |
| 86 | 9241 | [6. Storage](aws_service_decision_guide.md#storage) | Import wrapped external KMS material; distinguish automatic and on-demand rotation. |
| 87 | 9244 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Bulk-tag existing resources; activate billing tags; enforce future request tags. |
| 88 | 9245 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Config/Lambda termination is reactive, not prevention of an unapproved launch. |
| 89 | 9247 | [7. Databases](aws_service_decision_guide.md#database) | ElastiCache replicas provide applicable read scaling and failover capabilities. |
| 90 | 9248 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | Lambda canary 10% then 90% after five minutes; trace and alarm. |
| 91 | 9258 | [6. Storage](aws_service_decision_guide.md#storage) | Block Public Access prevents accidental public exposure. |
| 92 | 9260 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Application streaming preserves desktop-app experience; managed backend scales separately. |
| 93 | 9262 | [3. Networking and DNS](aws_service_decision_guide.md#network) | FIN/RST and idle timeout behavior are not fixed by capacity alone. |
| 94 | 9263 | [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Cache database work separately from cacheable HTTP content. |
| 95 | 9264 | [10. Operations and security](aws_service_decision_guide.md#operations) | WAF handles application-layer rules; Shield Advanced addresses DDoS capabilities. |
| 96 | 9266 | [3. Networking and DNS](aws_service_decision_guide.md#network); [7. Databases](aws_service_decision_guide.md#database) | Latency routing with health; cross-Region cache state is not automatic. |
| 97 | 9267 | [10. Operations and security](aws_service_decision_guide.md#operations) | Macie identifies S3 sensitive data; CloudTrail data events record object access. |
| 98 | 9268 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | Encrypted cross-Region Redshift snapshots require destination KMS copy grant. |
| 99 | 9280 | [1. Identity](aws_service_decision_guide.md#identity); [4. Edge and APIs](aws_service_decision_guide.md#edge); [7. Databases](aws_service_decision_guide.md#database) | Federated temporary credentials; static frontend and scoped direct data access. |
| 100 | 9294 | [5. Compute](aws_service_decision_guide.md#compute) | Stop and move eligible instances into cluster placement group, then restart. |

## Questions 101–150

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 101 | 9295 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Access Analyzer uses representative CloudTrail activity, including needed data events. |
| 102 | 9296 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Sticky routing is not session durability; Aurora Auto Scaling adds readers. |
| 103 | 9305 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Direct Connect gateway supports eligible multi-Region VPC associations. |
| 104 | 9306 | [10. Operations and security](aws_service_decision_guide.md#operations); [5. Compute](aws_service_decision_guide.md#compute); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Session Manager removes SSH exposure; layered resilience and edge protection. |
| 105 | 9311 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Multi-AZ ASG/ALB and RDS protect independent tiers. |
| 106 | 9314 | [5. Compute](aws_service_decision_guide.md#compute); [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage) | Fargate web tier, retryable Spot workers, Rekognition, and durable S3. |
| 107 | 9316 | [1. Identity](aws_service_decision_guide.md#identity); [11. Deployment](aws_service_decision_guide.md#deployment) | CloudFormation creates IAM role and EC2 instance profile, not static credentials. |
| 108 | 9318 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront viewer certificate in us-east-1; ALB origin certificate in its Region. |
| 109 | 9325 | [10. Operations and security](aws_service_decision_guide.md#operations) | Approved-image Config evaluation and notifications are post-deployment controls. |
| 110 | 9326 | [1. Identity](aws_service_decision_guide.md#identity); [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Cognito authorization and SQS decoupling for durable voting writes. |
| 111 | 9330 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Split an overall long workflow into short Lambda tasks with Map/Parallel. |
| 112 | 9332 | [6. Storage](aws_service_decision_guide.md#storage) | EFS shared access; provisioned throughput is not a guaranteed IOPS count. |
| 113 | 9333 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity) | Load-balancer TLS termination separates certificate access from EC2 operations. |
| 114 | 9335 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Historical WorkDocs collaboration answer; service shut down April 25, 2025. |
| 115 | 9336 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | AppSync subscriptions push GraphQL updates rather than repeated polling. |
| 116 | 9343 | [1. Identity](aws_service_decision_guide.md#identity) | EC2 role trust says who assumes; permission policy says what it can access. |
| 117 | 9357 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | EC2Rescue automation repairs guest/access problems, not host recovery metrics. |
| 118 | 9475 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [3. Networking and DNS](aws_service_decision_guide.md#network) | Durable queue absorbs BASE-style write bursts before on-premises processing. |
| 119 | 9511 | [1. Identity](aws_service_decision_guide.md#identity) | Corporate federation plus scoped S3 prefixes; avoid replicated IAM users. |
| 120 | 9512 | [11. Deployment](aws_service_decision_guide.md#deployment) | SSM latest-AMI parameter still requires a stack update and instance replacement. |
| 121 | 9513 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | External MySQL replication needs consistent seed and binlog coordinates. |
| 122 | 9516 | [1. Identity](aws_service_decision_guide.md#identity) | Cross-account limited audit role, not shared permanent administrator credentials. |
| 123 | 9518 | [1. Identity](aws_service_decision_guide.md#identity) | The audited target account owns the role that trusts the auditor. |
| 124 | 9519 | [10. Operations and security](aws_service_decision_guide.md#operations); [6. Storage](aws_service_decision_guide.md#storage) | Centralize CloudTrail; protect encryption, retention, deletion, and integrity separately. |
| 125 | 9521 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | ASG/ALB, Aurora replicas, and Route 53 alias form complementary layers. |
| 126 | 9522 | [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Instance-role presigning needs GetObject for downloads, not only list/upload. |
| 127 | 9523 | [5. Compute](aws_service_decision_guide.md#compute); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Targets receive ALB traffic only through enabled AZs and healthy configuration. |
| 128 | 9525 | [6. Storage](aws_service_decision_guide.md#storage) | Cached Volume Gateway retains hot data locally and primary block data in AWS. |
| 129 | 9527 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Partition/object layout and CloudFront private-origin caching for articles. |
| 130 | 9528 | [1. Identity](aws_service_decision_guide.md#identity); [11. Deployment](aws_service_decision_guide.md#deployment) | EC2 instance role/profile grants DynamoDB access without stored access keys. |
| 131 | 9530 | [1. Identity](aws_service_decision_guide.md#identity) | Trusted backend authenticates users and brokers scoped temporary credentials. |
| 132 | 9531 | [11. Deployment](aws_service_decision_guide.md#deployment) | Retain S3 versus Snapshot RDS; distinguish deletion from replacement policies. |
| 133 | 9533 | [1. Identity](aws_service_decision_guide.md#identity); [2. Governance and cost](aws_service_decision_guide.md#governance) | Tag-scoped explicit deny protects production; protect the tags as well. |
| 134 | 9534 | [11. Deployment](aws_service_decision_guide.md#deployment); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | SQS GetAtt Arn, not Ref URL, for SNS subscription; queue policy needed. |
| 135 | 9535 | [3. Networking and DNS](aws_service_decision_guide.md#network); [10. Operations and security](aws_service_decision_guide.md#operations) | SG/NACL directions and database port; Config explains configuration changes. |
| 136 | 9537 | [11. Deployment](aws_service_decision_guide.md#deployment) | CloudFormation Retain/Snapshot preserve resources or recoverable data appropriately. |
| 137 | 9541 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | Direct S3 website needs public access and correct hostname/redirect setup. |
| 138 | 9558 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Direct Connect is not encrypted by default; layer supported IPsec VPN. |
| 139 | 9590 | [1. Identity](aws_service_decision_guide.md#identity) | LDAP requires an identity broker or compatible federation endpoint for STS. |
| 140 | 10603 | [7. Databases](aws_service_decision_guide.md#database) | DocumentDB compatibility is not universal MongoDB feature equivalence. |
| 141 | 10604 | [5. Compute](aws_service_decision_guide.md#compute); [1. Identity](aws_service_decision_guide.md#identity) | awsvpc provides task network isolation; task IAM role scopes application access. |
| 142 | 10618 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch Manager performs patching; Config evaluates compliance. |
| 143 | 10622 | [10. Operations and security](aws_service_decision_guide.md#operations); [3. Networking and DNS](aws_service_decision_guide.md#network) | Traffic Mirroring captures packets; Flow Logs only summarize flows. |
| 144 | 10631 | [5. Compute](aws_service_decision_guide.md#compute); [1. Identity](aws_service_decision_guide.md#identity) | Execution role resolves startup secrets; task role authorizes application calls. |
| 145 | 10881 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics) | Streams for low-latency ingestion; EMR processing; Redshift analytical queries. |
| 146 | 10882 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | Firehose buffers delivery; downstream EMR/Redshift and lifecycle handle other stages. |
| 147 | 10883 | [11. Deployment](aws_service_decision_guide.md#deployment) | CodeDeploy blue/green and Beanstalk immutable deployment are different mechanisms. |
| 148 | 10884 | [11. Deployment](aws_service_decision_guide.md#deployment) | Beanstalk blue/green uses two environments and CNAME swap. |
| 149 | 10885 | [7. Databases](aws_service_decision_guide.md#database) | Cache repeated database reads or offload them to replicas. |
| 150 | 10901 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | ALB alias is managed load balancing; multivalue DNS is not equivalent. |

## Questions 151–200

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 151 | 10902 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Kinesis partition key supplies session-level ordering, not global ordering. |
| 152 | 10904 | [7. Databases](aws_service_decision_guide.md#database); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | DynamoDB Streams trigger consumers from item changes. |
| 153 | 10907 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [9. Analytics](aws_service_decision_guide.md#analytics); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Textract extracts scanned text; OpenSearch indexes; S3/CloudFront serve assets. |
| 154 | 10908 | [10. Operations and security](aws_service_decision_guide.md#operations) | Combine L3/L4 DDoS protection with WAF HTTP attack filtering. |
| 155 | 10909 | [3. Networking and DNS](aws_service_decision_guide.md#network); [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | Minimize exposed paths/ports and restrict origins; layered protection. |
| 156 | 10914 | [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Batch on interruption-tolerant capacity; retries and S3 protect results. |
| 157 | 10915 | [6. Storage](aws_service_decision_guide.md#storage) | Requester Pays moves eligible transfer/request costs, not storage, to authenticated requesters. |
| 158 | 10918 | [9. Analytics](aws_service_decision_guide.md#analytics); [5. Compute](aws_service_decision_guide.md#compute) | EMR task nodes can use Spot without holding HDFS data. |
| 159 | 10919 | [9. Analytics](aws_service_decision_guide.md#analytics); [5. Compute](aws_service_decision_guide.md#compute) | Reliable primary/core topology; Spot task nodes add disposable compute. |
| 160 | 10920 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Scale-in adjustment must match the specified low-utilization threshold and count. |
| 161 | 10921 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | Queue location processing; durable offer metadata; SNS mobile notifications. |
| 162 | 10922 | [2. Governance and cost](aws_service_decision_guide.md#governance) | RI benefits depend on matching usage and Region; not cross-Region sharing. |
| 163 | 10923 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Client VPN provides remote-user entry to otherwise private applications. |
| 164 | 10924 | [7. Databases](aws_service_decision_guide.md#database); [2. Governance and cost](aws_service_decision_guide.md#governance) | DynamoDB reserved capacity applies to provisioned mode; archive/drop period tables. |
| 165 | 10925 | [3. Networking and DNS](aws_service_decision_guide.md#network) | VPN is a lower-cost DX backup with different performance characteristics. |
| 166 | 10926 | [6. Storage](aws_service_decision_guide.md#storage); [7. Databases](aws_service_decision_guide.md#database) | Archive data cheaply but retain searchable metadata; choose a valid restore window. |
| 167 | 10927 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [7. Databases](aws_service_decision_guide.md#database) | REST/Lambda/DynamoDB architecture; API keys do not replace user authentication. |
| 168 | 10928 | [5. Compute](aws_service_decision_guide.md#compute) | Mixed On-Demand/Spot across AZs with load balancing and interruption tolerance. |
| 169 | 10929 | [7. Databases](aws_service_decision_guide.md#database) | Device partition key, timestamp sort key, and period-based retention strategy. |
| 170 | 10982 | [10. Operations and security](aws_service_decision_guide.md#operations) | Multi-Region CloudTrail plus global events and protected central log storage. |
| 171 | 10983 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Enable RAM organization sharing/trusted access before organizational resource sharing. |
| 172 | 10984 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Management-account RI discount-sharing controls isolate unit benefits. |
| 173 | 10985 | [2. Governance and cost](aws_service_decision_guide.md#governance) | SCPs apply to member root but not management-account or service-linked roles. |
| 174 | 10986 | [2. Governance and cost](aws_service_decision_guide.md#governance) | SCPs restrict allowed services; platform provisioning tools do not replace them. |
| 175 | 10987 | [3. Networking and DNS](aws_service_decision_guide.md#network); [10. Operations and security](aws_service_decision_guide.md#operations) | Private routes plus Flow Logs and central subscriptions diagnose rejected traffic. |
| 176 | 10988 | [10. Operations and security](aws_service_decision_guide.md#operations) | Global service events alone do not create an all-Region CloudTrail trail. |
| 177 | 10989 | [3. Networking and DNS](aws_service_decision_guide.md#network) | DX gateway connects eligible regional VPCs without automatic full-mesh VPC transit. |
| 178 | 10990 | [1. Identity](aws_service_decision_guide.md#identity); [10. Operations and security](aws_service_decision_guide.md#operations) | Resource-policy sharing preserves caller identity; assumed-role context is different. |
| 179 | 10992 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | Aurora global readers are local; writes remain tied to the primary. |
| 180 | 10993 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | Use ownership-aligned OUs, target-account roles, and trusted ABAC attributes. |
| 181 | 10995 | [1. Identity](aws_service_decision_guide.md#identity); [2. Governance and cost](aws_service_decision_guide.md#governance) | Consolidated billing does not grant account administration permissions. |
| 182 | 10996 | [3. Networking and DNS](aws_service_decision_guide.md#network) | URL/domain restrictions require suitable proxy/firewall and no bypass routes. |
| 183 | 10997 | [6. Storage](aws_service_decision_guide.md#storage) | Existing S3 objects retain null version IDs when versioning is enabled. |
| 184 | 10999 | [5. Compute](aws_service_decision_guide.md#compute) | Reserved concurrency controls capacity/cap; provisioned concurrency prewarms environments. |
| 185 | 11000 | [12. Migration and DR](aws_service_decision_guide.md#migration); [3. Networking and DNS](aws_service_decision_guide.md#network) | Active/passive regional stacks need health-driven routing and ready recovery resources. |
| 186 | 11001 | [2. Governance and cost](aws_service_decision_guide.md#governance); [11. Deployment](aws_service_decision_guide.md#deployment) | Service Catalog tags/parameters must propagate to the intended underlying resources. |
| 187 | 11002 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Security Hub centralizes findings but is not every preventive/remediation control. |
| 188 | 11003 | [1. Identity](aws_service_decision_guide.md#identity) | PowerUserAccess allows broad workload administration and selected organization reads, but not most IAM administration; NotAction is not a deny. |
| 189 | 11005 | [1. Identity](aws_service_decision_guide.md#identity) | Custom LDAP authentication needs brokerage or compatible SAML/OIDC federation. |
| 190 | 11006 | [2. Governance and cost](aws_service_decision_guide.md#governance) | An SCP allowlist omitting S3 blocks it despite identity-policy permission. |
| 191 | 11008 | [1. Identity](aws_service_decision_guide.md#identity) | Vendor-specific ExternalId in role trust prevents confused-deputy access. |
| 192 | 11011 | [1. Identity](aws_service_decision_guide.md#identity); [2. Governance and cost](aws_service_decision_guide.md#governance) | ForAllValues on TagKeys does not require all named tags or nonempty values. |
| 193 | 11013 | [7. Databases](aws_service_decision_guide.md#database); [10. Operations and security](aws_service_decision_guide.md#operations) | RAC One Node is not ordinary RDS; validate EC2 topology and backups. |
| 194 | 11015 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Replatform changes hosting/managed services without fundamental application redesign. |
| 195 | 11020 | [12. Migration and DR](aws_service_decision_guide.md#migration); [9. Analytics](aws_service_decision_guide.md#analytics) | WAN cannot seed 60 TB in time; bulk transfer plus conversion/CDC. |
| 196 | 11022 | [12. Migration and DR](aws_service_decision_guide.md#migration); [11. Deployment](aws_service_decision_guide.md#deployment); [6. Storage](aws_service_decision_guide.md#storage) | StackSets and replication prepare DR; failback needs data reconciliation. |
| 197 | 11023 | [3. Networking and DNS](aws_service_decision_guide.md#network) | DX router/VIF setup requires correct BGP and authentication configuration. |
| 198 | 11024 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Heterogeneous migration needs schema conversion plus DMS data/CDC. |
| 199 | 11027 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Resolver outbound forwarding for AD namespace; retain AWS-aware VPC DNS. |
| 200 | 11028 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Thirty-minute work does not fit one standard Lambda invocation; queue workers. |

## Questions 201–250

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 201 | 11030 | [12. Migration and DR](aws_service_decision_guide.md#migration); [6. Storage](aws_service_decision_guide.md#storage) | Pre-seed the bulk dataset before cutover; transfer only the final delta. |
| 202 | 11031 | [6. Storage](aws_service_decision_guide.md#storage) | Tape Gateway preserves the virtual tape/iSCSI backup-software interface. |
| 203 | 11032 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudFront can front an on-premises HTTP origin with WAF protection. |
| 204 | 11034 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | SQS/Spot processing for retryable image jobs; archive completed media appropriately. |
| 205 | 11036 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge); [2. Governance and cost](aws_service_decision_guide.md#governance) | Move duplicated static media to S3/CloudFront; investigate costs separately. |
| 206 | 11040 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage) | S3-triggered asynchronous Transcribe jobs; lifecycle recorded audio by retention needs. |
| 207 | 11044 | [2. Governance and cost](aws_service_decision_guide.md#governance); [11. Deployment](aws_service_decision_guide.md#deployment); [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Service Catalog constrains encrypted SageMaker notebook provisioning and outputs. |
| 208 | 11045 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Step Functions persists order workflow and waits for external completion callbacks. |
| 209 | 11046 | [12. Migration and DR](aws_service_decision_guide.md#migration) | MGN agent-based replication belongs on source servers, not only the hypervisor. |
| 210 | 11047 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Prioritize online critical-server migration; bulk-seed data beyond WAN capacity. |
| 211 | 11051 | [12. Migration and DR](aws_service_decision_guide.md#migration) | MGN continuously replicates server blocks, then supports test and cutover. |
| 212 | 11060 | [1. Identity](aws_service_decision_guide.md#identity) | Corporate SAML federation supplies temporary access without new AWS passwords. |
| 213 | 11061 | [5. Compute](aws_service_decision_guide.md#compute); [0. Decision method](aws_service_decision_guide.md#decision) | Diversified Spot is not guaranteed spare capacity during an AZ failure. |
| 214 | 11084 | [1. Identity](aws_service_decision_guide.md#identity) | Authenticated backend brokers per-user temporary AWS credentials. |
| 215 | 11204 | [6. Storage](aws_service_decision_guide.md#storage); [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Preserve file-oriented media workflows; S3 stores media; Rekognition derives metadata. |
| 216 | 11205 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage) | Rekognition face collections hold representations, not the original image archive. |
| 217 | 11207 | [6. Storage](aws_service_decision_guide.md#storage) | S3 Transfer Acceleration uses the accelerate endpoint for distant transfers. |
| 218 | 11257 | [12. Migration and DR](aws_service_decision_guide.md#migration) | MGN supports low-downtime rehosting of eligible physical Windows/Linux servers. |
| 219 | 11464 | [11. Deployment](aws_service_decision_guide.md#deployment); [2. Governance and cost](aws_service_decision_guide.md#governance) | Organization-integrated StackSets deploy across accounts and Regions. |
| 220 | 11465 | [1. Identity](aws_service_decision_guide.md#identity) | Vendor generates unique ExternalId; customer checks it in AssumeRole trust. |
| 221 | 11479 | [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Cross-account encrypted S3 needs bucket, caller IAM, and KMS permissions. |
| 222 | 11483 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Long queue jobs fit EC2 workers, not a single short-lived Lambda invocation. |
| 223 | 11495 | [1. Identity](aws_service_decision_guide.md#identity) | Identity Center with Managed AD requires a two-way trust to self-managed AD, not a one-way trust. |
| 224 | 11496 | [1. Identity](aws_service_decision_guide.md#identity) | LDAP must become compatible SAML/OIDC identity or use a broker. |
| 225 | 11497 | [1. Identity](aws_service_decision_guide.md#identity) | Managed AD trust preserves corporate identities without duplicating IAM users. |
| 226 | 11498 | [7. Databases](aws_service_decision_guide.md#database) | Read replicas/cache offload reads; sharding is an application/data-model change. |
| 227 | 11517 | [1. Identity](aws_service_decision_guide.md#identity) | Instance profile provides rotating temporary S3 credentials through SDK metadata access. |
| 228 | 11527 | [12. Migration and DR](aws_service_decision_guide.md#migration); [5. Compute](aws_service_decision_guide.md#compute) | Supported OpenJDK/container replatforming and managed DB reduce licensing/operations. |
| 229 | 11528 | [12. Migration and DR](aws_service_decision_guide.md#migration); [10. Operations and security](aws_service_decision_guide.md#operations) | Frequent recoverable transaction logs tighten RPO beyond full-backup frequency. |
| 230 | 11532 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Connect is the contact center; Lex handles conversational intent. |
| 231 | 11533 | [3. Networking and DNS](aws_service_decision_guide.md#network) | VPN backup to existing DX paths favors cost over identical link performance. |
| 232 | 11540 | [10. Operations and security](aws_service_decision_guide.md#operations); [12. Migration and DR](aws_service_decision_guide.md#migration) | Managed continuous/PITR backup can meet short recovery-point requirements. |
| 233 | 11559 | [5. Compute](aws_service_decision_guide.md#compute); [2. Governance and cost](aws_service_decision_guide.md#governance); [6. Storage](aws_service_decision_guide.md#storage) | Drain retryable Spot containers; commit steady DB; lifecycle retained data. |
| 234 | 11561 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront distributes large game objects; private REST origin does not need website hosting. |
| 235 | 11577 | [7. Databases](aws_service_decision_guide.md#database) | Aurora replicas/RDS Proxy reduce failover impact without an absolute interruption guarantee. |
| 236 | 11578 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | Secrets Manager rotation needs both schedule and working rotation integration. |
| 237 | 11622 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Queue answer writes; offload cacheable assets to S3/CloudFront. |
| 238 | 11623 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Accelerate existing on-premises web delivery without migrating the origin first. |
| 239 | 11628 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [7. Databases](aws_service_decision_guide.md#database) | SNS with one SQS per service; RDS Proxy pools DB connections. |
| 240 | 11629 | [2. Governance and cost](aws_service_decision_guide.md#governance); [10. Operations and security](aws_service_decision_guide.md#operations) | Config detects missing tags; supported SCP request-tag checks prevent creation. |
| 241 | 11630 | [6. Storage](aws_service_decision_guide.md#storage); [12. Migration and DR](aws_service_decision_guide.md#migration) | SMB data goes to FSx Windows via DataSync; VM import handles machine images. |
| 242 | 11632 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | ECS secret reference uses execution role; writer endpoint and DB SG must match. |
| 243 | 11633 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Additional DX path and gateway/VIF associations; diversify physical failure domains. |
| 244 | 11634 | [6. Storage](aws_service_decision_guide.md#storage); [3. Networking and DNS](aws_service_decision_guide.md#network) | Transfer Family VPC internet-facing endpoint preserves EIPs/keys and permits IP allowlisting. |
| 245 | 11635 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | Glue crawler discovers schema; transformation must actually redact sensitive fields. |
| 246 | 11636 | [5. Compute](aws_service_decision_guide.md#compute); [3. Networking and DNS](aws_service_decision_guide.md#network) | VPC Lambda needs private DB reachability and a DynamoDB endpoint or NAT. |
| 247 | 11637 | [6. Storage](aws_service_decision_guide.md#storage) | DataSync schedules incremental SMB transfer to FSx Windows. |
| 248 | 11638 | [6. Storage](aws_service_decision_guide.md#storage) | Create new FSx Multi-AZ deployment, synchronize, and cut over. |
| 249 | 11639 | [2. Governance and cost](aws_service_decision_guide.md#governance); [9. Analytics](aws_service_decision_guide.md#analytics) | CUR plus account-to-OU mapping and QuickSight access controls for unit dashboards. |
| 250 | 11640 | [2. Governance and cost](aws_service_decision_guide.md#governance); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudWatch memory metrics inform right-sizing; preserve needed DR capacity. |

## Questions 251–300

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 251 | 11641 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | MediaConvert creates HLS; instant-access archive preserves immediate original retrieval. |
| 252 | 11642 | [12. Migration and DR](aws_service_decision_guide.md#migration) | SQL Server to MySQL is heterogeneous: schema conversion plus data/CDC. |
| 253 | 11643 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Containerize supported .NET application; Fargate, Multi-AZ DB, and scoped secrets. |
| 254 | 11644 | [11. Deployment](aws_service_decision_guide.md#deployment) | Feature branches build/test/deploy in isolated nonproduction accounts. |
| 255 | 11646 | [2. Governance and cost](aws_service_decision_guide.md#governance); [11. Deployment](aws_service_decision_guide.md#deployment) | Service Catalog launch role provisions resources without broad requester permissions. |
| 256 | 11647 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Separate TGW route tables/propagation preserve development-production isolation. |
| 257 | 11649 | [6. Storage](aws_service_decision_guide.md#storage) | Managed Transfer Family replaces EC2 SFTP operations while retaining endpoint naming. |
| 258 | 11650 | [10. Operations and security](aws_service_decision_guide.md#operations); [1. Identity](aws_service_decision_guide.md#identity) | Replace authorized_keys and remove the old key; key-pair deletion alone is insufficient. |
| 259 | 11667 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Application and DB SG directions/port must agree; stateful return is implicit. |
| 260 | 11668 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Textract extracts scanned content; Comprehend interprets text; Step Functions orchestrates. |
| 261 | 11711 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Dependency-aware monitoring should not trigger fleet-wide liveness replacement storms. |
| 262 | 11712 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | Global Accelerator supplies static anycast IPs and healthy regional endpoints. |
| 263 | 11713 | [7. Databases](aws_service_decision_guide.md#database) | On-demand/scalable DynamoDB for small items; TTL is asynchronous deletion. |
| 264 | 11714 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Temporarily suspend termination for investigation; use Session Manager and resume. |
| 265 | 11716 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | One-hour visibility already fits the job; maxReceiveCount=1 causes premature DLQ. |
| 266 | 11721 | [6. Storage](aws_service_decision_guide.md#storage) | CHAP authenticates iSCSI sessions but does not encrypt their payloads. |
| 267 | 11723 | [11. Deployment](aws_service_decision_guide.md#deployment) | Test-stack change set/execution and CodeBuild integration tests serve different checks. |
| 268 | 11724 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Client VPN needs user authorization and routes into intended connected VPCs. |
| 269 | 11725 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | SCP permission ceiling does not grant the missing IAM allow. |
| 270 | 11730 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge); [5. Compute](aws_service_decision_guide.md#compute) | Shared forecast files and freshness-aware cache; validate actual I/O/latency requirements. |
| 271 | 11733 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Edge authentication must respect runtime and origin-failover method restrictions. |
| 272 | 11736 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [11. Deployment](aws_service_decision_guide.md#deployment) | Valid custom-domain certificate and cache lifetime matching content freshness. |
| 273 | 11738 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Device-specific edge logic requires correct cache-key variation. |
| 274 | 11749 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Normalize query strings before cache lookup; preserve case-sensitive application semantics. |
| 275 | 11790 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | Private S3 OAC origin plus signed viewer access; URL remains a bearer token. |
| 276 | 11791 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront custom on-premises origin improves delivery without application migration. |
| 277 | 11817 | [5. Compute](aws_service_decision_guide.md#compute) | ECS Anywhere manages external hosts; Fargate handles AWS-hosted containers. |
| 278 | 11939 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | Invited accounts do not automatically receive OrganizationAccountAccessRole. |
| 279 | 12004 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Step Functions coordinates states, parallelism, retry, and reprocessing. |
| 280 | 12013 | [6. Storage](aws_service_decision_guide.md#storage); [5. Compute](aws_service_decision_guide.md#compute) | Ephemeral S3-linked Lustre fits monthly batch; persist output before deleting it. |
| 281 | 12014 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [9. Analytics](aws_service_decision_guide.md#analytics) | Firehose transforms/buffers into OpenSearch for near-real-time analytics. |
| 282 | 12226 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute); [3. Networking and DNS](aws_service_decision_guide.md#network) | DynamoDB global tables and regional Fargate services enable eligible active/active design. |
| 283 | 12227 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Zone owner authorizes VPC association; VPC owner associates; then remove authorization. |
| 284 | 12228 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Reduce real duration/connection bottlenecks; API caching only for reusable responses. |
| 285 | 12229 | [12. Migration and DR](aws_service_decision_guide.md#migration); [6. Storage](aws_service_decision_guide.md#storage) | Preprovision recovery capacity and restore supported backup artifacts to minimize RTO. |
| 286 | 12231 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | S3 document storage plus OpenSearch indexing and application serving. |
| 287 | 12232 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | System-status recovery preserves supported instance identity; replacement is different. |
| 288 | 12233 | [11. Deployment](aws_service_decision_guide.md#deployment); [10. Operations and security](aws_service_decision_guide.md#operations) | CloudFormation resolves Secrets Manager password; rotation integration updates it. |
| 289 | 12234 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | OpenSearch supplies searchable index; S3 retains durable source documents. |
| 290 | 12237 | [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Presigned URL depends on signature, permissions, method, expiry, and credential lifetime. |
| 291 | 12238 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Resilient application/DB tiers plus static delivery and WAF filtering. |
| 292 | 12239 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [3. Networking and DNS](aws_service_decision_guide.md#network) | UDP requires suitable NLB; do not block necessary TCP health checks. |
| 293 | 12240 | [3. Networking and DNS](aws_service_decision_guide.md#network) | NACL can explicitly deny hostile IP ranges; SG cannot contain deny rules. |
| 294 | 12241 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database) | Bulk seed beyond WAN limit, then CDC final changes and coordinated cutover. |
| 295 | 12388 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage); [15. Corrections](aws_service_decision_guide.md#corrections) | Regional copies/origin selection can reduce misses; eu-east-1 is an invalid identifier. |
| 296 | 12389 | [11. Deployment](aws_service_decision_guide.md#deployment) | CDK uses familiar languages; CloudFormation iteration does exist via Fn::ForEach. |
| 297 | 12390 | [5. Compute](aws_service_decision_guide.md#compute); [11. Deployment](aws_service_decision_guide.md#deployment) | Bake the shared framework into an AMI to shorten startup. |
| 298 | 12392 | [7. Databases](aws_service_decision_guide.md#database); [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Commit stable baseline; scale application and Aurora readers for variable demand. |
| 299 | 12405 | [6. Storage](aws_service_decision_guide.md#storage) | Windows CMS sharing requires suitable SMB/AD filesystem, usually FSx Windows. |
| 300 | 12406 | [6. Storage](aws_service_decision_guide.md#storage); [10. Operations and security](aws_service_decision_guide.md#operations) | Monitor FreeStorageCapacity and automate supported FSx storage increases before exhaustion. |

## Questions 301–350

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 301 | 12415 | [10. Operations and security](aws_service_decision_guide.md#operations) | Logs agent, metric filter, alarm, and SNS each supply a required step. |
| 302 | 12416 | [6. Storage](aws_service_decision_guide.md#storage); [10. Operations and security](aws_service_decision_guide.md#operations) | RTC is a 99.99%/15-minute SLA; align alerting with requested threshold. |
| 303 | 12417 | [6. Storage](aws_service_decision_guide.md#storage); [10. Operations and security](aws_service_decision_guide.md#operations) | Public-ACL remediation is reactive; modern Block Public Access is preventive. |
| 304 | 12418 | [5. Compute](aws_service_decision_guide.md#compute); [6. Storage](aws_service_decision_guide.md#storage) | Event-driven ten-minute Lambda processing fits standard invocation duration. |
| 305 | 12419 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | CloudTrail/EventBridge records organization actions; Config is not universal membership history. |
| 306 | 12420 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Reactive IAM approval workflow needs awareness of races and preventive boundaries. |
| 307 | 12421 | [10. Operations and security](aws_service_decision_guide.md#operations) | Patch Manager supports hybrid patching, not arbitrary major OS migration. |
| 308 | 12422 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | SageMaker trains centrally; Greengrass runs local/offline inference components. |
| 309 | 12423 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [3. Networking and DNS](aws_service_decision_guide.md#network) | IoT MQTT cutover requires custom-domain TLS, authentication, and delivery settings. |
| 310 | 12826 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Connect plus Lex and Lambda provides automated conversational business actions. |
| 311 | 12833 | [11. Deployment](aws_service_decision_guide.md#deployment) | Pipeline build/security checks, failure events, and manual approval gate production. |
| 312 | 12834 | [7. Databases](aws_service_decision_guide.md#database) | RDS read replicas offload monthly reporting without loading the writer. |
| 313 | 12866 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Field-level encryption protects selected form fields; TLS and caching are separate. |
| 314 | 12867 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [10. Operations and security](aws_service_decision_guide.md#operations) | OAC protects S3; validate CloudFront-added secret header at ALB/WAF origin. |
| 315 | 12868 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [6. Storage](aws_service_decision_guide.md#storage) | Private S3 REST bucket plus OAC restricts origin access. |
| 316 | 12869 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [1. Identity](aws_service_decision_guide.md#identity); [6. Storage](aws_service_decision_guide.md#storage) | Direct presigned S3 or signed CloudFront; neither intrinsically binds original identity. |
| 317 | 12870 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | OAC uses CloudFront service-principal policy, not OAI's identity model. |
| 318 | 12871 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Add S3 origin and static-path behavior; keep dynamic routes on ALB. |
| 319 | 12872 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Multi-AZ application, managed DB migration, and Route 53 alias cutover. |
| 320 | 12873 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Transform discovery/assessment versus organizational cloud-readiness evaluation. |
| 321 | 12874 | [6. Storage](aws_service_decision_guide.md#storage); [7. Databases](aws_service_decision_guide.md#database) | sc1 fits cold sequential throughput, not arbitrary random-I/O database workloads. |
| 322 | 12875 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Discovery gathers configuration, utilization, and dependencies before migration planning. |
| 323 | 12876 | [12. Migration and DR](aws_service_decision_guide.md#migration); [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Db2 conversion/data migration; WebSphere rehost; validate IBM MQ protocol compatibility. |
| 324 | 13170 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Aurora Auto Scaling adds readers; sticky sessions do not replicate state. |
| 325 | 13171 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Pilot light requires DB promotion and ASG scale-up before traffic cutover. |
| 326 | 13172 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | Custom error page needs correct behavior/origin; S3 website cannot use OAC. |
| 327 | 13173 | [2. Governance and cost](aws_service_decision_guide.md#governance); [3. Networking and DNS](aws_service_decision_guide.md#network) | VPC owner shares subnets and controls networking; participants own their workloads. |
| 328 | 13317 | [5. Compute](aws_service_decision_guide.md#compute); [10. Operations and security](aws_service_decision_guide.md#operations) | Termination lifecycle hook captures logs; match Command versus Automation API. |
| 329 | 13318 | [1. Identity](aws_service_decision_guide.md#identity) | External SAML authentication and SCIM provisioning are distinct Identity Center integrations. |
| 330 | 13319 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Management activates cost allocation tags; CUR can then expose eligible tagged costs. |
| 331 | 13320 | [2. Governance and cost](aws_service_decision_guide.md#governance); [9. Analytics](aws_service_decision_guide.md#analytics) | CUR/QuickSight organization dashboards need account-to-OU mapping and access rules. |
| 332 | 13321 | [11. Deployment](aws_service_decision_guide.md#deployment); [2. Governance and cost](aws_service_decision_guide.md#governance) | StackSets trusted access and automatic OU deployment include newly created accounts. |
| 333 | 13322 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Discovery/right-sizing and dependencies support application grouping and migration waves. |
| 334 | 13324 | [2. Governance and cost](aws_service_decision_guide.md#governance); [3. Networking and DNS](aws_service_decision_guide.md#network) | Tag-scoped SG protection must cover authorize, revoke, modify, delete, and tag changes. |
| 335 | 13325 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [5. Compute](aws_service_decision_guide.md#compute) | Function URL fits simple webhook; validate provider signature when not using IAM auth. |
| 336 | 13326 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Hyper-V discovery/assessment collects utilization and dependency data before migration. |
| 337 | 13327 | [10. Operations and security](aws_service_decision_guide.md#operations) | Register hybrid managed nodes, then apply Patch Manager policies and compliance reporting. |
| 338 | 13328 | [9. Analytics](aws_service_decision_guide.md#analytics); [6. Storage](aws_service_decision_guide.md#storage) | OpenSearch hot to UltraWarm to cold; archive source data separately. |
| 339 | 13685 | [7. Databases](aws_service_decision_guide.md#database); [5. Compute](aws_service_decision_guide.md#compute) | Reuse connections outside handler and pool with RDS Proxy. |
| 340 | 13686 | [2. Governance and cost](aws_service_decision_guide.md#governance); [5. Compute](aws_service_decision_guide.md#compute) | Schedule Compute Optimizer Lambda recommendation export to S3. |
| 341 | 13687 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [5. Compute](aws_service_decision_guide.md#compute) | Separate Lambda-backed API functions scale independently instead of one monolith. |
| 342 | 13688 | [5. Compute](aws_service_decision_guide.md#compute) | Package long encoding as ECR image and launch Fargate task; not long Lambda. |
| 343 | 13689 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-account Aurora clone is copy-on-write, not live replication; recreate Lambda configuration. |
| 344 | 13690 | [6. Storage](aws_service_decision_guide.md#storage) | Storage Lens advanced metrics: 15-month query window versus 14 days for free metrics; Inventory is not historical aggregate analytics. |
| 345 | 13691 | [6. Storage](aws_service_decision_guide.md#storage); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Accelerate distant S3 upload; edge-optimized REST API addresses API entry latency. |
| 346 | 13692 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Budgets alert by account; Cost Explorer analyzes spending; delivery needs automation. |
| 347 | 13693 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | SES SMTP uses separate credentials and STARTTLS 587, not insecure SMTP assumptions. |
| 348 | 13694 | [12. Migration and DR](aws_service_decision_guide.md#migration) | VM Import needs actual supported disk/image artifact, not just an OVF descriptor. |
| 349 | 14178 | [1. Identity](aws_service_decision_guide.md#identity); [3. Networking and DNS](aws_service_decision_guide.md#network); [15. Corrections](aws_service_decision_guide.md#corrections) | Client VPN supports MFA enabled on Managed Microsoft AD or AD Connector; the latter is not an obligatory extra layer. |
| 350 | 14179 | [10. Operations and security](aws_service_decision_guide.md#operations); [2. Governance and cost](aws_service_decision_guide.md#governance) | Organization trail covers current/future member accounts with correct scope. |

## Questions 351–391

| No. | Q-ID | Review | Decisive distinction |
|---:|---:|---|---|
| 351 | 14180 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database); [9. Analytics](aws_service_decision_guide.md#analytics) | Kubernetes portability, serverless OLTP, and serverless analytics are distinct layers. |
| 352 | 14181 | [7. Databases](aws_service_decision_guide.md#database) | ElastiCache reduces repeated queries; RDS Proxy reduces connection overhead. |
| 353 | 14182 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized) | Update WorkSpaces IP access control group for new office egress address. |
| 354 | 14183 | [3. Networking and DNS](aws_service_decision_guide.md#network); [2. Governance and cost](aws_service_decision_guide.md#governance) | RAM shares TGW; its owner enables appropriate auto-accept settings. |
| 355 | 14188 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute) | GWLB endpoints distribute traffic through configured autoscaled network appliances. |
| 356 | 14191 | [3. Networking and DNS](aws_service_decision_guide.md#network); [15. Corrections](aws_service_decision_guide.md#corrections) | TGW advertises configured allowed prefixes; VGW filters VPC CIDRs. A 200 Mbps DX connection is not automatically invalid. |
| 357 | 14192 | [9. Analytics](aws_service_decision_guide.md#analytics); [10. Operations and security](aws_service_decision_guide.md#operations) | Parquet and hourly partitions lower flow-log SQL scan cost. |
| 358 | 14193 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Latency alias routing and EvaluateTargetHealth choose healthy low-latency ELBs. |
| 359 | 14194 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | SCP IAM restriction needs principal exception and management-account scope awareness. |
| 360 | 14197 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-Region MySQL replica must be promoted before application write failover. |
| 361 | 14198 | [5. Compute](aws_service_decision_guide.md#compute); [4. Edge and APIs](aws_service_decision_guide.md#edge) | Split browsing/checkout scaling boundaries; edge JWT logic must verify claims/signature. |
| 362 | 14222 | [13. AI, IoT, end-user services](aws_service_decision_guide.md#specialized); [7. Databases](aws_service_decision_guide.md#database) | Keep PII off immutable blockchain; store only appropriate commitments on ledger. |
| 363 | 14223 | [12. Migration and DR](aws_service_decision_guide.md#migration); [7. Databases](aws_service_decision_guide.md#database) | Aurora global replication plus DRS application recovery; test full RPO/RTO path. |
| 364 | 14224 | [5. Compute](aws_service_decision_guide.md#compute) | Long video processing on event-launched Fargate avoids idle workers and Lambda timeout. |
| 365 | 14247 | [1. Identity](aws_service_decision_guide.md#identity) | Target trusts source EC2 role; source can AssumeRole; no foreign instance profile. |
| 366 | 14263 | [5. Compute](aws_service_decision_guide.md#compute); [7. Databases](aws_service_decision_guide.md#database) | Multi-AZ application load balancing plus Aurora reader capacity. |
| 367 | 14300 | [3. Networking and DNS](aws_service_decision_guide.md#network) | NLB endpoint service can expose eligible on-premises IP targets over DX privately. |
| 368 | 14307 | [5. Compute](aws_service_decision_guide.md#compute) | Long ECS-on-EC2 jobs can binpack memory; match scaling metrics and job duration. |
| 369 | 14308 | [6. Storage](aws_service_decision_guide.md#storage); [11. Deployment](aws_service_decision_guide.md#deployment) | EFS preserves NFS contract; keep durable Aurora outside disposable Beanstalk lifecycle. |
| 370 | 14309 | [1. Identity](aws_service_decision_guide.md#identity); [11. Deployment](aws_service_decision_guide.md#deployment) | GitHub OIDC role trust uses AssumeRoleWithWebIdentity and scoped token claims. |
| 371 | 14310 | [5. Compute](aws_service_decision_guide.md#compute); [8. Messaging and workflows](aws_service_decision_guide.md#messaging); [6. Storage](aws_service_decision_guide.md#storage) | Sporadic short queue jobs favor Lambda and S3 over always-on workers. |
| 372 | 14334 | [7. Databases](aws_service_decision_guide.md#database); [12. Migration and DR](aws_service_decision_guide.md#migration) | Cross-Region SQL Server replicas exist but require supported edition/version/configuration. |
| 373 | 14803 | [12. Migration and DR](aws_service_decision_guide.md#migration) | Migration Evaluator builds utilization-based TCO/assessment, not a live replication stream. |
| 374 | 14832 | [6. Storage](aws_service_decision_guide.md#storage); [3. Networking and DNS](aws_service_decision_guide.md#network); [1. Identity](aws_service_decision_guide.md#identity) | S3 endpoint plus VPC-origin access point and bucket delegation confine approved access. |
| 375 | 14835 | [3. Networking and DNS](aws_service_decision_guide.md#network); [5. Compute](aws_service_decision_guide.md#compute) | S3 gateway endpoint removes eligible NAT charges; schedule predictable scaling ahead. |
| 376 | 15281 | [5. Compute](aws_service_decision_guide.md#compute); [1. Identity](aws_service_decision_guide.md#identity) | ECR organization pull policy; identity token permission; expire only targeted untagged images. |
| 377 | 15283 | [7. Databases](aws_service_decision_guide.md#database); [3. Networking and DNS](aws_service_decision_guide.md#network) | Local read replica reduces distant read latency while writer stays primary. |
| 378 | 15284 | [6. Storage](aws_service_decision_guide.md#storage); [2. Governance and cost](aws_service_decision_guide.md#governance) | Deny access-point creation unless AccessPointNetworkOrigin is VPC. |
| 379 | 15285 | [2. Governance and cost](aws_service_decision_guide.md#governance); [1. Identity](aws_service_decision_guide.md#identity) | Tag policy validates standards; request-tag SCP enforces supported creation requirements. |
| 380 | 15286 | [4. Edge and APIs](aws_service_decision_guide.md#edge) | CloudFront Functions is sufficient for lightweight viewer query normalization. |
| 381 | 15313 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Private zone association and both DNS settings; retain correct DHCP resolver. |
| 382 | 15314 | [12. Migration and DR](aws_service_decision_guide.md#migration); [9. Analytics](aws_service_decision_guide.md#analytics) | Analyze discovered dependencies; migrate tightly coupled servers in coordinated waves. |
| 383 | 15328 | [9. Analytics](aws_service_decision_guide.md#analytics) | Redshift concurrency scaling handles eligible simultaneous queries, not every slow query. |
| 384 | 15353 | [2. Governance and cost](aws_service_decision_guide.md#governance) | Implement precise service/instance-class restrictions with supported controls/SCPs and dependencies. |
| 385 | 15363 | [9. Analytics](aws_service_decision_guide.md#analytics) | Athena/Glue on S3 ORC can replace always-on EMR for intermittent SQL. |
| 386 | 15365 | [2. Governance and cost](aws_service_decision_guide.md#governance) | EC2 Instance SP, Compute SP for Lambda, and MemoryDB reservations differ. |
| 387 | 15375 | [8. Messaging and workflows](aws_service_decision_guide.md#messaging) | Catch preserves input only with appropriate ResultPath; States.ALL has exceptions. |
| 388 | 15376 | [10. Operations and security](aws_service_decision_guide.md#operations); [12. Migration and DR](aws_service_decision_guide.md#migration) | AWS Backup schedules/retentions/copies; explicit failure events; copies are asynchronous. |
| 389 | 15377 | [3. Networking and DNS](aws_service_decision_guide.md#network) | Multi-AZ GWLB endpoints and appliances need symmetric forward/return inspection routes. |
| 390 | 15392 | [4. Edge and APIs](aws_service_decision_guide.md#edge); [7. Databases](aws_service_decision_guide.md#database) | NLB fits transport requirements; ALB supports WebSockets; global consistency needs explicit design. |
| 391 | 15481 | [10. Operations and security](aws_service_decision_guide.md#operations) | Inspector dependency scanning versus code scanning; exact code-exclusion tag. |
