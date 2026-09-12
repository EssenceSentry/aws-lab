# Proposed 20-project curriculum

This is a synthesis of the uploaded domains, common scenarios, comparison material, and migration material. The PDFs do not present this exact ordering.

| # | Context | Main architectural decisions |
| ---: | --- | --- |
| **1** | **A small but production-grade web application** | AWS accounts, Regions and Availability Zones; VPCs and subnets; security groups vs NACLs; Route 53; ALB; EC2 Auto Scaling; EC2 vs Elastic Beanstalk, App Runner, or Lightsail; RDS/Aurora; S3, EBS, and EFS; CloudWatch; backups and baseline cost. |
| **2** | **A global SaaS or e-commerce application** | CloudFront; Origin Access Control; signed access; Route 53 routing policies; Global Accelerator vs CloudFront; WAF and Shield; ElastiCache; database read scaling; multi-Region strategies; cache behavior; latency, availability, and cost. |
| **3** | **A serverless mobile and web backend** | Amplify; Cognito user pools vs identity pools; API Gateway vs AppSync; Lambda; DynamoDB vs Aurora Serverless; S3; SQS, SNS, and EventBridge; Step Functions; X-Ray; Device Farm; Pinpoint and SES. |
| **4** | **A containerized microservices platform** | ECR; ECS on EC2 vs ECS on Fargate vs EKS; App Runner and Elastic Beanstalk as simpler alternatives; ECS task role vs task execution role; `awsvpc`; ALB vs NLB; service scaling; service discovery; deployment and tracing. |
| **5** | **A corporate landing zone for many business units** | AWS Organizations; Control Tower; accounts and OUs; SCPs vs IAM policies; IAM Identity Center; federation; centralized CloudTrail and Config; logging and security accounts; consolidated billing; tagging and cost attribution. |
| **6** | **A governed internal developer platform** | CloudFormation; StackSets; Service Catalog; SAM and Proton; CodeArtifact, CodeBuild, CodePipeline, and CodeDeploy; approved templates and AMIs; blue/green and canary deployment; Config rules; Systems Manager; rollback and change control. |
| **7** | **A hybrid enterprise network with shared services** | VPC peering vs Transit Gateway; PrivateLink; Resource Access Manager; Site-to-Site VPN vs Direct Connect; virtual interfaces and Direct Connect gateways; Route 53 Resolver; Directory Service; shared-services VPCs; overlapping CIDRs; Network Firewall. |
| **8** | **A regulated financial or healthcare workload** | Least privilege; KMS vs CloudHSM; Secrets Manager vs Parameter Store; ACM; private endpoints; WAF, Shield, and Firewall Manager; GuardDuty, Macie, Inspector, Detective, and Security Hub; Artifact and Audit Manager; evidence retention and data residency. |
| **9** | **A cloud customer-service contact center** | Amazon Connect; Lex; Polly; Transcribe; Comprehend; Lambda; DynamoDB; S3 call recordings; streaming analytics; routing and escalation; encryption, retention, observability, and cost. |
| **10** | **A media platform delivering private content globally** | S3; CloudFront; OAC; CloudFront signed URLs and cookies vs S3 pre-signed URLs; Kinesis Video Streams; Elastic Transcoder; Lambda@Edge; WAF and Shield; upload paths; cache keys; content lifecycle and archival. |
| **11** | **A company-wide data platform** | Batch vs streaming; Kinesis Data Streams vs Data Firehose vs MSK; Managed Flink; S3 data lake; Glue; Lake Formation; Athena; EMR; Redshift; OpenSearch; Amazon Quick; governance, schema, partitioning, retention, and query cost. |
| **12** | **An industrial IoT and edge-computing system** | IoT Core; Device Management; Device Defender; IoT Events; SiteWise; Greengrass; Timestream; Kinesis; Lambda; S3; device identity; intermittent connectivity; ordered processing; offline operation; Outposts and Wavelength recognition. |
| **13** | **An ML-assisted document and media-processing workflow** | S3 event ingestion; Textract, Rekognition, Transcribe, Translate, and Comprehend; SageMaker; Kendra, Personalize, and Fraud Detector recognition; Batch; Step Functions; queues; retries; idempotency; human escalation; accelerator cost. |
| **14** | **Hybrid storage and managed partner file exchange** | S3 vs EBS vs EFS vs FSx; Storage Gateway File, Volume, and Tape modes; DataSync; Transfer Family; S3 Transfer Acceleration vs VPN vs Direct Connect; AWS Backup; Glacier classes; file protocols; transfer windows and recovery requirements. |
| **15** | **Migration of a large application portfolio** | Application Discovery Service; dependency mapping; Migration Hub; Application Migration Service; the seven migration strategies; migration waves; VMware relocation; licensing; stakeholder sequencing; rollback; retaining and retiring workloads. |
| **16** | **Database migration and modernization** | DMS vs SCT; homogeneous vs heterogeneous migration; full load and change data capture; cutover validation; rollback; RDS and Aurora; DynamoDB; DocumentDB; Keyspaces; Neptune; Redshift; rehost vs replatform vs refactor. |
| **17** | **A company-wide disaster-recovery program** | RTO and RPO; backup and restore vs pilot light vs warm standby vs multi-site; AWS Backup; Elastic Disaster Recovery; cross-Region replication; database replication; Route 53 health checks and failover; capacity activation; reverse replication and failback. |
| **18** | **Rescuing an expensive, unreliable existing system** | CloudWatch, Logs, X-Ray, CloudTrail, Grafana, and Prometheus; Systems Manager; Config; Auto Scaling metrics; Compute Optimizer; Trusted Advisor; Health Dashboard; Service Quotas; Reserved Instances, Savings Plans, Spot, Budgets, Cost Explorer, and CUR. |
| **19** | **A secure digital workforce for a large company** | WorkSpaces vs AppStream; full desktop vs application streaming; Directory Service and AD Connector; IAM Identity Center and SAML; Client VPN; FSx; License Manager; WorkDocs and Alexa for Business recognition; remote-access security and predictable cost. |
| **20** | **A B2B data product and partner ecosystem** | AWS Data Exchange and Redshift datashares; AppFlow; PrivateLink; RAM; S3 bucket policies; Requester Pays; Transfer Family; partner identities; read-only sharing; cost attribution; Managed Blockchain as a recognition-level option for shared-ledger requirements. |

## Recommended progression

The order above is intentional:

1. **Projects 1–4:** establish ordinary cloud application architecture.
2. **Projects 5–8:** introduce enterprise governance, hybrid networking, and regulation.
3. **Projects 9–14:** broaden into business applications, data, streaming, IoT, ML, and storage.
4. **Projects 15–17:** migration, modernization, and disaster recovery.
5. **Projects 18–20:** optimization and less-common enterprise contexts.
