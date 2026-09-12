# Proposed 20-project curriculum

This is a synthesis of the uploaded domains, common scenarios, comparison material, and migration material. The PDFs do not present this exact ordering.

|      # | Context                                                   | Main architectural decisions                                                                                                                                                                                                                                         |
| -----: | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  **1** | **A small but production-grade web application**          | AWS accounts, Regions and Availability Zones; VPCs and subnets; security groups vs NACLs; Route 53; ALB; EC2 Auto Scaling; EC2 vs Elastic Beanstalk, App Runner, or Lightsail; RDS/Aurora; S3, EBS, and EFS; CloudWatch; backups and baseline cost.                  |
|  **2** | **A global SaaS or e-commerce application**               | CloudFront; Origin Access Control; signed access; Route 53 routing policies; Global Accelerator vs CloudFront; WAF and Shield; ElastiCache; database read scaling; multi-Region strategies; cache behavior; latency, availability, and cost.                         |
|  **3** | **A serverless mobile and web backend**                   | Amplify; Cognito user pools vs identity pools; API Gateway vs AppSync; Lambda; DynamoDB vs Aurora Serverless; S3; SQS, SNS, and EventBridge; Step Functions; X-Ray; Device Farm; Pinpoint and SES.                                                                   |
|  **4** | **A containerized microservices platform**                | ECR; ECS on EC2 vs ECS on Fargate vs EKS; App Runner and Elastic Beanstalk as simpler alternatives; ECS task role vs task execution role; `awsvpc`; ALB vs NLB; service scaling; service discovery; deployment and tracing.                                          |
|  **5** | **A corporate landing zone for many business units**      | AWS Organizations; Control Tower; accounts and OUs; SCPs vs IAM policies; IAM Identity Center; federation; centralized CloudTrail and Config; logging and security accounts; consolidated billing; tagging and cost attribution.                                     |
|  **6** | **A governed internal developer platform**                | CloudFormation; StackSets; Service Catalog; SAM and Proton; CodeArtifact, CodeBuild, CodePipeline, and CodeDeploy; approved templates and AMIs; blue/green and canary deployment; Config rules; Systems Manager; rollback and change control.                        |
|  **7** | **A hybrid enterprise network with shared services**      | VPC peering vs Transit Gateway; PrivateLink; Resource Access Manager; Site-to-Site VPN vs Direct Connect; virtual interfaces and Direct Connect gateways; Route 53 Resolver; Directory Service; shared-services VPCs; overlapping CIDRs; Network Firewall.           |
|  **8** | **A regulated financial or healthcare workload**          | Least privilege; KMS vs CloudHSM; Secrets Manager vs Parameter Store; ACM; private endpoints; WAF, Shield, and Firewall Manager; GuardDuty, Macie, Inspector, Detective, and Security Hub; Artifact and Audit Manager; evidence retention and data residency.        |
|  **9** | **A cloud customer-service contact center**               | Amazon Connect; Lex; Polly; Transcribe; Comprehend; Lambda; DynamoDB; S3 call recordings; streaming analytics; routing and escalation; encryption, retention, observability, and cost.                                                                               |
| **10** | **A media platform delivering private content globally**  | S3; CloudFront; OAC; CloudFront signed URLs and cookies vs S3 pre-signed URLs; Kinesis Video Streams; Elastic Transcoder; Lambda@Edge; WAF and Shield; upload paths; cache keys; content lifecycle and archival.                                                     |
| **11** | **A company-wide data platform**                          | Batch vs streaming; Kinesis Data Streams vs Data Firehose vs MSK; Managed Flink; S3 data lake; Glue; Lake Formation; Athena; EMR; Redshift; OpenSearch; Amazon Quick; governance, schema, partitioning, retention, and query cost.                                   |
| **12** | **An industrial IoT and edge-computing system**           | IoT Core; Device Management; Device Defender; IoT Events; SiteWise; Greengrass; Timestream; Kinesis; Lambda; S3; device identity; intermittent connectivity; ordered processing; offline operation; Outposts and Wavelength recognition.                             |
| **13** | **An ML-assisted document and media-processing workflow** | S3 event ingestion; Textract, Rekognition, Transcribe, Translate, and Comprehend; SageMaker; Kendra, Personalize, and Fraud Detector recognition; Batch; Step Functions; queues; retries; idempotency; human escalation; accelerator cost.                           |
| **14** | **Hybrid storage and managed partner file exchange**      | S3 vs EBS vs EFS vs FSx; Storage Gateway File, Volume, and Tape modes; DataSync; Transfer Family; S3 Transfer Acceleration vs VPN vs Direct Connect; AWS Backup; Glacier classes; file protocols; transfer windows and recovery requirements.                        |
| **15** | **Migration of a large application portfolio**            | Application Discovery Service; dependency mapping; Migration Hub; Application Migration Service; the seven migration strategies; migration waves; VMware relocation; licensing; stakeholder sequencing; rollback; retaining and retiring workloads.                  |
| **16** | **Database migration and modernization**                  | DMS vs SCT; homogeneous vs heterogeneous migration; full load and change data capture; cutover validation; rollback; RDS and Aurora; DynamoDB; DocumentDB; Keyspaces; Neptune; Redshift; rehost vs replatform vs refactor.                                           |
| **17** | **A company-wide disaster-recovery program**              | RTO and RPO; backup and restore vs pilot light vs warm standby vs multi-site; AWS Backup; Elastic Disaster Recovery; cross-Region replication; database replication; Route 53 health checks and failover; capacity activation; reverse replication and failback.     |
| **18** | **Rescuing an expensive, unreliable existing system**     | CloudWatch, Logs, X-Ray, CloudTrail, Grafana, and Prometheus; Systems Manager; Config; Auto Scaling metrics; Compute Optimizer; Trusted Advisor; Health Dashboard; Service Quotas; Reserved Instances, Savings Plans, Spot, Budgets, Cost Explorer, and CUR.         |
| **19** | **A secure digital workforce for a large company**        | WorkSpaces vs AppStream; full desktop vs application streaming; Directory Service and AD Connector; IAM Identity Center and SAML; Client VPN; FSx; License Manager; WorkDocs and Alexa for Business recognition; remote-access security and predictable cost.        |
| **20** | **A B2B data product and partner ecosystem**              | AWS Data Exchange and Redshift datashares; AppFlow; PrivateLink; RAM; S3 bucket policies; Requester Pays; Transfer Family; partner identities; read-only sharing; cost attribution; Managed Blockchain as a recognition-level option for shared-ledger requirements. |

The landing-zone and hybrid-network projects directly reflect the source’s treatment of multi-account structures, business-unit isolation, shared security and logging accounts, Transit Gateway, VPN, Direct Connect, and centralized DNS.  

The migration projects follow the source’s seven migration strategies and its separation of discovery, tracking, server migration, database migration, schema conversion, and data transfer.

The disaster-recovery project should explicitly compare backup and restore, pilot light, warm standby, and multi-site rather than memorizing four independent definitions. The source’s comparison chapter is particularly useful for this and for other close alternatives such as ALB/NLB/GWLB, private-content mechanisms, and transfer connectivity.

## The projects should form a spiral curriculum

A service should not be “learned once.” It should reappear under progressively different constraints.

For example, S3 would appear as:

1. Static asset storage in Project 1.
2. A private CloudFront origin in Projects 2 and 10.
3. A data-lake foundation in Project 11.
4. A migration destination in Project 14.
5. A backup and replication target in Project 17.
6. A partner-controlled cost boundary in Project 20.

IAM would evolve from:

1. A service role in Project 1.
2. An application user identity in Project 3.
3. Task roles in Project 4.
4. Cross-account access, federation, SCPs, and permission boundaries in Project 5.
5. Regulated least-privilege controls in Project 8.

Route 53 would evolve from simple DNS, to latency routing, weighted deployment, health-based failover, private DNS, and hybrid resolution.

That repeated contextual retrieval will create much stronger memory than reading one uninterrupted IAM chapter followed by one uninterrupted S3 chapter.

## Standard structure for every project

Every case should use the same headings so that the content remains easy to navigate.

### 1. Business brief

No more than roughly 150 words:

* What the organization does.
* Who uses the system.
* What already exists.
* What must be achieved.

### 2. Constraint ledger

Separate constraints into:

| Type        | Examples                                                    |
| ----------- | ----------------------------------------------------------- |
| Functional  | Upload files, serve APIs, process payments                  |
| Scale       | Requests per second, dataset size, number of accounts       |
| Performance | Latency, throughput, IOPS                                   |
| Reliability | Availability target, RTO, RPO                               |
| Data        | Consistency, durability, retention, residency               |
| Security    | Authentication, isolation, encryption, auditing             |
| Operations  | Team size, managed-service preference, deployment frequency |
| Migration   | Downtime, compatibility, rollback, deadline                 |
| Cost        | Bursty vs steady use, commitment tolerance, transfer volume |

The exam commonly hides the answer in one of these constraints.

### 3. Functional slices

Use the same slices across projects:

1. Accounts and identity
2. Network and edge
3. Compute
4. Storage and databases
5. Messaging and integration
6. Security
7. Deployment and operations
8. Reliability and disaster recovery
9. Cost

A project need not use every slice. Irrelevant sections should be omitted rather than padded.

### 4. Decision snippets

Each snippet should cover **one decision only**, usually in 60–120 words:

```text
Context:
Hard requirement:
Choose:
Why:
Reject:
Scope:
Failure/cost implication:
Exam hinge:
```

No snippet should introduce ten unrelated services.

### 5. Changed-requirement variants

After the baseline solution, change one constraint:

* “The company now prohibits public Internet transit.”
* “RTO changes from eight hours to five minutes.”
* “Traffic becomes unpredictable.”
* “The application must remain Kubernetes-compatible.”
* “The company acquires 60 AWS accounts.”
* “The database engine is not supported by RDS.”

The learner then updates only the affected architectural decisions. This is very close to what SAP-C02 questions demand.

## Example of the desired snippet style

### Media project: private video delivery

**Requirement:** Authenticated subscribers must stream videos globally, but objects must not be directly readable from S3.

**Choose:** Keep the S3 bucket private, place CloudFront in front of it, and use Origin Access Control so only CloudFront can retrieve the objects. Use CloudFront signed URLs or signed cookies to authorize viewers.

**Reject:** An S3 pre-signed URL is designed for direct, time-limited access to an S3 object. It does not by itself express the desired CloudFront-only delivery path.

**Exam hinge:** Origin access and viewer authorization are separate controls. OAC protects S3 from direct access; signed URLs or cookies control which viewers may use CloudFront.

That is much more memorable than three independent definitions for OAC, CloudFront signed URLs, and S3 pre-signed URLs.

## Depth should be tiered

“Touch everything” should not mean giving every service equal attention.

### Decision-level knowledge

You should be able to design with and compare services such as:

* IAM, Organizations, Control Tower
* VPC, Route 53, ELB, CloudFront
* EC2, Lambda, ECS, EKS
* S3, EBS, EFS, FSx
* RDS, Aurora, DynamoDB, ElastiCache
* Direct Connect, VPN, Transit Gateway, PrivateLink
* CloudFormation, Systems Manager, CloudWatch, Config
* Migration and disaster-recovery services

### Recognition-and-selection knowledge

You need enough context to select services such as:

* AppStream, WorkSpaces
* Lex, Polly, Textract, Comprehend
* Athena, Glue, EMR, Redshift, OpenSearch
* IoT services
* AppFlow, Data Exchange, Transfer Family

### Recognition-only knowledge

Some appendix services need only a compact card saying:

* what problem they solve;
* the strongest phrase that selects them;
* the nearest alternative;
* why they are unlikely to be the answer in a generic scenario.

Trying to give every long-tail service a major role would make the projects artificial and harder to remember.

## How the PDFs and practice tests fit

The material should have three distinct roles:

* **The 20 projects:** primary learning order.
* **The four domain PDFs:** coverage audit and source material.
* **The comparison chapter:** decision-boundary cards.
* **Practice questions:** retrieval and diagnosis.

Every missed practice question should be assigned to both a project and a functional slice:

```text
Project: Enterprise landing zone
Slice: Accounts and identity
Decision: SCP vs IAM policy
Error: Treated an SCP as a permission grant
```

This produces a coherent knowledge base rather than a collection of unrelated question explanations.

The source guide recommends practice exams and multiple training modes, but for this curriculum they should come after enough projects have established the relevant vocabulary.

## Recommended progression

The order above is intentional:

1. **Projects 1–4:** establish ordinary cloud application architecture.
2. **Projects 5–8:** introduce enterprise governance, hybrid networking, and regulation.
3. **Projects 9–14:** broaden into business applications, data, streaming, IoT, ML, and storage.
4. **Projects 15–17:** migration, modernization, and disaster recovery.
5. **Projects 18–20:** optimization and less-common enterprise contexts.

Starting with the landing zone merely because Domain 1 is heavily weighted would be pedagogically backwards. Concepts such as cross-account roles, centralized DNS, SCPs, Direct Connect gateways, and StackSets are difficult to retain before accounts, VPCs, routes, IAM roles, and ordinary workloads have concrete meanings.
