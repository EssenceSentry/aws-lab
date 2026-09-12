# Lesson 11 — Northstar Insight Hub: A Company-Wide Data Platform

## Batch and streaming ingestion, S3 data lakes, Glue, Lake Formation, Athena, EMR, Redshift, OpenSearch, and Amazon Quick Sight

## Source note

The curriculum defines Lesson 11 as a company-wide data-platform project covering:

```text
batch versus streaming
Kinesis Data Streams versus Data Firehose versus MSK
Managed Service for Apache Flink
S3 data lake
AWS Glue
Lake Formation
Athena
EMR
Redshift
OpenSearch
Amazon Quick
governance
schema
partitioning
retention
query cost
```

The uploaded material supplies several important foundations:

- S3 can form the durable storage layer of a data lake.
- Athena runs SQL queries over structured data stored in S3.
- Amazon Quick can visualize Athena results either by importing data into SPICE or querying the source directly.
- OpenSearch is the managed AWS option for Elasticsearch-compatible search, document indexing, and operational analytics, and it integrates with services such as Data Firehose and CloudWatch Logs.
- Data Firehose is the managed delivery option for buffering, transforming, and delivering streaming data into destinations such as S3, Redshift, OpenSearch, Splunk, and supported third-party platforms.
- CloudWatch Logs subscription filters can send matching log events to Kinesis Data Streams, Data Firehose, or Lambda.

The more detailed Lake Formation, Apache Iceberg, schema-contract, cross-account, and current service-name material below is an expansion based on current AWS documentation.

### Current terminology

Older material and exam questions may say:

```text
Amazon Kinesis Data Firehose
Amazon Kinesis Data Analytics
Amazon QuickSight
```

Current terminology is:

```text
Amazon Data Firehose

Amazon Managed Service for Apache Flink
    formerly Amazon Kinesis Data Analytics

Amazon Quick Sight
    the BI capability within Amazon Quick
```

The old Kinesis Data Analytics SQL application offering has been discontinued; current streaming applications should use Managed Service for Apache Flink or another supported processing engine. Existing QuickSight APIs and integrations continue to work under the Amazon Quick naming transition.

---

# 1. The project

## 1.1 Business brief

Northstar Group operates several businesses:

```text
Northstar Commerce
Northstar Logistics
Northstar Pay
Northstar Care
Northstar Advertising
Northstar Research
```

Each business produces data independently.

### Commerce

```text
page views
searches
cart actions
orders
refunds
inventory changes
```

### Logistics

```text
shipment status
warehouse scans
route updates
delivery estimates
vehicle telemetry summaries
```

### Pay

```text
payment authorization
capture
refund
settlement
dispute events
```

### Care

```text
appointment state
cancellation outcomes
contact-center activity
clinic utilization
```

### Advertising

```text
hourly API extracts
daily campaign reports
channel and video metadata
classification results
```

### Corporate systems

```text
ERP
finance
human resources
CRM
master customer and product records
```

The data currently lives in:

- application databases;
- S3 buckets owned by individual teams;
- Kafka clusters inherited through an acquisition;
- CSV files copied through email;
- SaaS platforms;
- CloudWatch Logs;
- individual analyst databases;
- manually refreshed spreadsheets.

Executives do not trust company-wide numbers because every department calculates them differently.

A typical disagreement looks like:

```text
Commerce revenue:
    $18.2 million

Finance revenue:
    $17.5 million

Pay captured amount:
    $18.8 million
```

Each value may be internally correct because the teams use different:

- timestamps;
- currencies;
- refund rules;
- settlement periods;
- time zones;
- definitions of “completed”;
- late-arriving data;
- duplicate handling.

Northstar therefore creates **Northstar Insight Hub**, a shared data platform.

---

## 1.2 Business questions

The platform must answer questions at different speeds.

| Question | Required freshness |
| --- | ---: |
| Is one payment method suddenly failing? | Under 30 seconds |
| Is checkout conversion dropping? | Under 5 minutes |
| Which deliveries are likely to miss today’s promise? | Under 15 minutes |
| How many appointments were cancelled through automation? | Hourly |
| What was yesterday’s recognized revenue? | By 06:00 next morning |
| What was campaign profitability last quarter? | Daily is sufficient |
| Can a data scientist reproduce last month’s training dataset? | Historical snapshot required |
| Can an auditor reconstruct who accessed restricted data? | Multi-year evidence |

There is no single correct latency for “the data platform.”

The latency requirement belongs to the **business decision**.

---

## 1.3 Consumer groups

The platform serves different users:

```text
Operational applications
    need alerts and near-real-time derived state

Data engineers
    build ingestion and transformation pipelines

Analysts
    run exploratory SQL

Finance
    requires controlled and reconciled datasets

Executives
    consume dashboards

Data scientists
    need large reproducible datasets

Security teams
    search operational and audit events

Application teams
    consume approved data products
```

Giving every consumer direct access to every producer database would create:

- workload coupling;
- security exposure;
- unstable schemas;
- production database contention;
- inconsistent business logic;
- no durable historical record.

---

# 2. Platform requirements

| Dimension | Requirement |
| --- | --- |
| Scale | Billions of events and large historical datasets |
| Ingestion | Batch files, APIs, application events, logs, and Kafka |
| Latency | Seconds for selected operations; daily for others |
| Durability | Immutable raw history retained according to policy |
| Replay | Rebuild derived datasets after logic changes |
| Governance | Central discovery and fine-grained access |
| Ownership | Business domains remain responsible for their data |
| Schema | Versioned contracts and controlled evolution |
| Quality | Freshness, uniqueness, completeness, and validity checks |
| Privacy | Restricted columns and rows visible only to approved roles |
| Query | SQL without provisioning infrastructure for every analyst |
| Processing | Lightweight ETL and very large distributed jobs |
| Warehouse | Predictable BI performance and curated dimensional models |
| Search | Low-latency search across operational documents and logs |
| Visualization | Dashboards for business users |
| Multi-account | Producers and consumers remain in separate AWS accounts |
| Networking | Private database and Kafka connectivity |
| Security | Least-privilege service roles and KMS encryption |
| Cost | Workloads charged to domain, engine, and query group |
| Recovery | Raw data can reconstruct downstream products |
| Residency | Healthcare and payment data remain in approved Regions |

---

# 3. Baseline architecture

```text
                         PRODUCER ACCOUNTS
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ Commerce applications                                                   │
│    clickstream and order events ───────────────┐                        │
│                                                │                        │
│ Logistics applications                         │                        │
│    shipment and warehouse events ──────────────┤                        │
│                                                │                        │
│ Pay and Care                                    │                        │
│    approved business events ───────────────────┤                        │
│                                                │                        │
│ CloudWatch Logs ── subscription filters ───────┤                        │
│                                                │                        │
│ Acquired Kafka applications ───────► Amazon MSK                         │
│                                                │                        │
│ ERP / SaaS / advertising APIs ── batch files ──┴────► S3 landing       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                         INGESTION ACCOUNT
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ Amazon Kinesis Data Streams                                             │
│    durable event streams                                                │
│    multiple independent consumers                                       │
│                                                                         │
│ Amazon Data Firehose                                                    │
│    buffered managed delivery                                            │
│    format conversion and partitioning                                   │
│                                                                         │
│ Amazon MSK                                                              │
│    Kafka-compatible topics                                              │
│    existing Kafka ecosystem                                             │
│                                                                         │
│ Managed Service for Apache Flink                                        │
│    windows                                                              │
│    joins                                                                │
│    event-time calculations                                              │
│    stateful detection                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               │
             ┌─────────────────┴──────────────────┐
             │                                    │
             ▼                                    ▼
       Real-time outputs                    Durable lake copy
       OpenSearch                           Data Firehose
       alerts                               batch landing
       derived streams                            │
                                                ▼
                          DATA LAKE ACCOUNT
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ S3                                                                      │
│                                                                         │
│ raw/                                                                    │
│ quarantine/                                                             │
│ standardized/                                                           │
│ curated/                                                                │
│ products/                                                               │
│ query-results/                                                          │
│                                                                         │
│ AWS Glue Data Catalog                                                   │
│    databases                                                            │
│    tables                                                               │
│    partitions                                                           │
│    schemas                                                              │
│                                                                         │
│ AWS Lake Formation                                                      │
│    catalog permissions                                                  │
│    S3 credential vending                                                │
│    row, column, and cell filters                                         │
│    cross-account sharing                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                        PROCESSING ACCOUNT
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ AWS Glue ETL                                                            │
│    regular serverless integration jobs                                  │
│                                                                         │
│ Amazon EMR Serverless                                                   │
│    large Spark transformations and backfills                            │
│                                                                         │
│ Optional EMR on EC2                                                      │
│    long-running or highly customized clusters                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                         ANALYTICS ACCOUNT
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ Amazon Athena                                                           │
│    ad hoc SQL over S3                                                    │
│                                                                         │
│ Amazon Redshift                                                         │
│    curated warehouse                                                    │
│    high-concurrency BI                                                   │
│    Redshift Spectrum for lake data                                       │
│                                                                         │
│ Amazon OpenSearch Service                                               │
│    operational search                                                   │
│    log and document analytics                                           │
│                                                                         │
│ Amazon Quick Sight                                                      │
│    dashboards                                                           │
│    SPICE or direct query                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Architecture in one sentence

> Northstar preserves all approved source data in an S3 data lake, uses Kinesis or MSK where consumers need replayable streams, Data Firehose where managed buffered delivery is sufficient, Flink for stateful real-time computation, Glue and EMR for transformation, Lake Formation for governance, Athena for ad hoc SQL, Redshift for curated warehouse workloads, OpenSearch for operational search, and Quick Sight for business dashboards.

---

# 4. The central mental model

A data platform has several distinct layers.

```text
Storage
    Where are the bytes?

Catalog
    What do those bytes represent?

Governance
    Who may access which logical data?

Processing
    How are datasets transformed?

Query engine
    How are questions executed?

Serving store
    Where is data optimized for one access pattern?

Visualization
    How do business users consume results?
```

For Northstar:

```text
S3
    → storage

Glue Data Catalog
    → metadata

Lake Formation
    → governance

Glue / EMR / Flink
    → processing

Athena
    → serverless query engine over S3

Redshift
    → analytical warehouse

OpenSearch
    → search and operational analytics store

Quick Sight
    → business intelligence
```

A common exam mistake is to select one service as though it performs every layer.

---

# 5. The data lake is not a database engine

An S3 data lake stores:

```text
raw files
columnar datasets
table-format files
logs
images
model artifacts
exports
historical snapshots
```

S3 does not itself understand:

- SQL joins;
- table ownership;
- semantic definitions;
- row-level authorization;
- business metrics;
- event-time windows.

Those capabilities come from services layered above the objects.

The uploaded guide’s core architecture is precisely this combination: S3 provides the durable lake, Athena supplies SQL query capability, and Quick supplies visualization.

---

# 6. Batch versus streaming

## 6.1 Batch

Batch processing works on a bounded collection.

```text
Yesterday’s files
The previous month’s transactions
All campaign reports received by 03:00
A complete model-training snapshot
```

Example:

```text
02:00:
    ERP places daily export in S3

02:15:
    Glue validates and standardizes it

03:00:
    EMR calculates company-wide allocations

04:30:
    Redshift finance tables refresh

06:00:
    finance dashboard becomes available
```

Batch is appropriate when:

- the business can wait;
- data arrives in files or scheduled exports;
- processing benefits from complete periods;
- reconciliation is more important than immediacy;
- cost can be reduced by running compute only when needed.

---

## 6.2 Streaming

Streaming processing consumes an unbounded sequence of records.

```text
OrderCreated
PaymentAuthorized
ShipmentDelayed
AppointmentCancelled
PageViewed
```

A stream does not have a natural “final row.”

A streaming application must decide:

- how long to retain events;
- what ordering exists;
- how to handle duplicates;
- how to treat late events;
- when a time window is complete enough;
- how state is recovered after failure;
- how consumers replay old events.

---

## 6.3 Near-real-time does not always mean streaming

Suppose advertising reports arrive only once every hour from a third-party API.

Running a permanent streaming platform does not create fresher source data.

A scheduled API extraction may be the correct design.

Likewise:

```text
S3 file every five minutes
    +
Glue or Lambda processing
```

may satisfy a 15-minute objective without a general-purpose stream.

---

## 6.4 The decision test

Ask:

> What decision becomes wrong or less valuable if this data is delayed?

```text
Block suspected payment fraud:
    seconds matter

Warn warehouse about a stalled conveyor:
    seconds or minutes matter

Executive monthly revenue report:
    seconds do not matter

Historical model retraining:
    batch is normally appropriate
```

### Memory rule

```text
Streaming is a business-latency decision,
not a sign of architectural modernity.
```

---

# 7. Event contracts

Before choosing Kinesis or Kafka, Northstar defines the event.

Example:

```json
{
  "event_id": "01J...",
  "event_type": "OrderCreated",
  "event_version": 3,
  "occurred_at": "2026-09-02T18:24:51Z",
  "ingested_at": "2026-09-02T18:24:52Z",
  "producer": "commerce-orders",
  "tenant_id": "TENANT-42",
  "region": "uy",
  "payload": {
    "order_id": "ORD-991",
    "currency": "USD",
    "amount": 149.50
  }
}
```

Important fields include:

```text
event_id
    deduplication and traceability

event_type
    business meaning

event_version
    schema evolution

occurred_at
    event time

ingested_at
    platform-observation time

producer
    ownership

tenant/domain
    authorization and partitioning context
```

---

## 7.1 Event time versus processing time

### Event time

```text
When did the business event happen?
```

### Ingestion time

```text
When did the platform receive it?
```

### Processing time

```text
When did one consumer process it?
```

Suppose a warehouse device loses connectivity for 20 minutes.

```text
ShipmentLoaded occurred:
    10:00

Platform received event:
    10:20

Flink processed event:
    10:20:01
```

A business report for the 10:00 period should generally use event time.

An operational ingestion-latency metric uses the difference between event and ingestion time.

---

## 7.2 Late events

A five-minute event-time window may receive records after the nominal five minutes have passed.

Northstar must choose a policy:

```text
Wait for a permitted lateness period.
Update the previous result.
Send late records to correction processing.
Ignore records beyond a documented boundary.
```

There is no universal correct lateness threshold.

---

## 7.3 Schema compatibility

Adding an optional field is usually easier for existing consumers than:

```text
renaming a required field
changing integer to incompatible string
removing a field without transition
changing business meaning while keeping the name
```

The event schema and its semantic meaning form a contract.

AWS Glue Schema Registry supports schema versions and compatibility rules for Kinesis, MSK, Kafka, Flink, Lambda, and Glue streaming integrations. Compatibility modes control whether a proposed schema version can be registered.

---

# 8. Amazon Kinesis Data Streams

## 8.1 Purpose

Kinesis Data Streams is a durable real-time streaming service.

Producers write records.

One or more independent consumers read and process them.

```text
Producers
    ↓
Kinesis Data Stream
    ├── fraud consumer
    ├── lake-delivery consumer
    ├── operations consumer
    └── experimentation consumer
```

Data Streams is appropriate when the platform needs:

- several consumers;
- independent consumer progress;
- replay within the stream’s retention period;
- low-latency record availability;
- managed AWS-native streaming;
- partition-based ordering.

A stream consists of shards, and each record carries data, a partition key, and a sequence number within its shard.

---

## 8.2 Core concepts

```text
Stream
    named collection of streaming records

Shard
    ordered sequence and capacity unit

Producer
    writes records

Consumer
    reads records

Partition key
    influences which shard receives a record

Sequence number
    identifies ordering within a shard

Retention
    period during which records remain replayable
```

---

## 8.3 Ordering boundary

Kinesis does not provide one total global order across the entire stream.

Ordering exists within a shard.

To preserve order for one entity, Northstar commonly uses:

```text
partition_key = order_id
```

All events for the same order are then intended to follow the same partitioning path.

```text
OrderCreated
PaymentAuthorized
OrderPacked
OrderShipped
```

Using a random partition key distributes traffic better but loses a simple per-order ordering relationship.

---

## 8.4 Hot partition key

Suppose Northstar uses:

```text
partition_key = country
```

and 70% of records use:

```text
US
```

One shard may receive a disproportionate share of writes even when total stream capacity appears sufficient.

Symptoms include:

```text
write throttling
uneven shard utilization
consumer lag on one shard
```

Better partition keys have:

- high enough cardinality;
- reasonably distributed traffic;
- business ordering only where required.

---

## 8.5 On-demand versus provisioned

### On-demand capacity

Kinesis manages shard capacity automatically and charges according to actual throughput.

Use when:

- traffic is variable;
- growth is uncertain;
- the team wants minimal capacity planning.

### Provisioned capacity

Northstar explicitly controls shard count.

Use when:

- throughput is predictable;
- explicit capacity management is acceptable;
- provisioned economics are favorable;
- shard topology must be controlled.

Kinesis currently supports both on-demand and provisioned modes.

---

## 8.6 Multiple consumers

Standard polling consumers share available read capacity.

Enhanced fan-out gives a registered consumer dedicated per-shard read throughput and pushes records to the consumer rather than requiring ordinary shared polling.

Use enhanced fan-out when several latency-sensitive consumers would otherwise contend for shard reads.

---

## 8.7 Replay

A consumer records its progress.

If logic changes:

```text
new fraud algorithm
    ↓
start consumer from earlier sequence position
    ↓
reprocess retained events
```

Replay is one of the central distinctions between Kinesis Data Streams and a simple delivery pipeline.

For long-term replay beyond stream retention, Northstar preserves a raw copy in S3.

---

## 8.8 Large payloads

A stream event should not contain a 50 MB document.

Use:

```text
S3 object
    +
small stream record containing:
        object URI
        checksum
        event metadata
```

AWS similarly recommends storing large payloads in S3 and streaming references when a record exceeds the practical stream-record model.

---

# 9. Amazon Data Firehose

## 9.1 Purpose

Data Firehose is a managed delivery service.

It receives streaming records, buffers them, optionally transforms or partitions them, and delivers batches to supported destinations.

```text
Producer or Kinesis stream
    ↓
Data Firehose
    ↓ buffer
    ↓ optional transformation
    ↓ optional format conversion
    ↓
S3 / Redshift / OpenSearch / supported destination
```

It is designed to minimize delivery-pipeline operations, not to expose a general consumer API.

---

## 9.2 Buffering

Firehose does not normally write one S3 object per incoming event.

It buffers by:

```text
amount of data
or
elapsed interval
```

and delivers when the relevant condition is reached.

This reduces tiny files but means Firehose is not a guaranteed subsecond delivery mechanism.

---

## 9.3 Transformation

Firehose can invoke Lambda to transform buffered records before delivery.

Suitable transformations include:

```text
decompress
remove unneeded fields
normalize timestamp
convert record structure
mask a field
append metadata
```

A Lambda transformation is not the right place for:

- hours-long aggregation;
- stateful joins across millions of users;
- arbitrary event-time windows;
- large historical backfills.

Those belong in Flink, Glue, EMR, or another suitable engine.

---

## 9.4 Dynamic partitioning

Firehose can derive S3 prefixes from record fields.

Example:

```text
domain=commerce/
event_type=order/
year=2026/
month=09/
day=02/
hour=18/
```

This helps downstream engines scan only relevant files.

Dynamic partitioning maintains separate buffers for active partitions, so an uncontrolled high-cardinality key such as a unique transaction ID can create too many concurrent buffers and many small objects.

---

## 9.5 Error path

Northstar configures an S3 error prefix:

```text
quarantine/firehose-errors/
```

Records may arrive there because:

- JSON could not be parsed;
- partition key extraction failed;
- transformation failed;
- destination delivery failed.

A delivery pipeline is incomplete until failed records have:

- retention;
- alerts;
- ownership;
- replay procedure.

Firehose sends records that fail dynamic partition evaluation to the configured S3 error prefix.

---

## 9.6 Firehose is not a message bus

Firehose is strong when the requirement is:

> Deliver this stream reliably into an analytical destination with minimal management.

It is weaker when the requirement is:

> Five independent applications must consume, checkpoint, replay, and process every event differently.

Use Kinesis Data Streams or MSK for that second requirement.

---

# 10. Amazon MSK

## 10.1 Purpose

Amazon Managed Streaming for Apache Kafka runs managed Apache Kafka clusters.

AWS manages much of the broker infrastructure, while applications use ordinary Kafka concepts and APIs:

```text
topics
partitions
brokers
producers
consumers
consumer groups
offsets
replication
Kafka connectors
```

MSK is the strongest candidate when Kafka compatibility or the Kafka ecosystem is an actual requirement.

```text
Existing Kafka producers
Kafka Streams applications
Kafka Connect plugins
Kafka operational semantics
portable Kafka client ecosystem
```

MSK does not need to replace every Kinesis stream merely because Kafka is widely used.

---

## 10.2 Topic and partition

```text
Topic:
    named logical stream

Partition:
    ordered portion of a topic

Producer:
    writes records to partitions

Consumer group:
    cooperatively processes topic partitions

Offset:
    position of a record in a partition
```

Ordering is within a Kafka partition, not one global order across the complete topic.

---

## 10.3 Consumer groups

Suppose a topic has six partitions.

A consumer group with three consumers can divide those partitions:

```text
Consumer A:
    partitions 0 and 1

Consumer B:
    partitions 2 and 3

Consumer C:
    partitions 4 and 5
```

A second consumer group receives its own logical read of the topic.

```text
Fraud group
Lake-delivery group
Monitoring group
```

Each group tracks progress independently.

---

## 10.4 Provisioned versus Serverless

### MSK Provisioned

Northstar selects broker family, storage, and cluster configuration.

Use when:

- Kafka configuration control matters;
- throughput is large or predictable;
- broker sizing and tuning are justified;
- specific Kafka capabilities are required.

### MSK Serverless

AWS manages capacity without the same broker-sizing workflow.

Use when:

- workloads are variable;
- standard supported configuration is sufficient;
- low operational management is more important than detailed broker control.

MSK Serverless requires IAM access control and does not support Kafka ACLs as its authorization mechanism.

---

## 10.5 Kafka authentication and authorization

MSK supports several client-authentication patterns depending on cluster configuration.

With IAM access control:

```text
Kafka client
    ↓ signed IAM authentication
MSK
    ↓
IAM evaluates topic, group, and cluster actions
```

IAM can control both client authentication and Kafka data-plane authorization in that mode.

This differs from an ordinary self-managed Kafka design that may use:

```text
TLS certificates
SASL/SCRAM
Kafka ACLs
```

---

## 10.6 Network placement

MSK brokers are connected to VPC subnets.

A client requires:

```text
DNS resolution
route to broker addresses
security-group permission
supported authentication
Kafka authorization
```

A valid IAM policy does not create a route to the brokers.

For cross-account and cross-VPC clients, MSK supports managed multi-VPC private connectivity and cluster resource policies.

---

## 10.7 Why Northstar retains MSK

Northstar acquired a company whose systems already depend on:

- Kafka topics;
- Kafka Streams;
- Kafka Connect;
- Kafka consumer groups;
- Kafka-specific operational semantics.

Migrating all of that immediately to Kinesis would create risk with no immediate business benefit.

New ordinary AWS-native event pipelines use Kinesis unless Kafka compatibility provides specific value.

---

# 11. Kinesis Data Streams versus Data Firehose versus MSK

| Requirement | Kinesis Data Streams | Data Firehose | Amazon MSK |
| --- | --- | --- | --- |
| Primary role | Durable managed event stream | Managed buffered delivery | Managed Apache Kafka |
| Independent consumers | Yes | Not the primary model | Yes, through consumer groups |
| Replay | Within retention | No general consumer replay API | Through Kafka offsets and retention |
| Ordering | Per shard | Inherited/batched delivery behavior | Per partition |
| Capacity model | On-demand or provisioned | Service-managed delivery | Serverless or provisioned |
| Ecosystem | AWS-native APIs and libraries | Destination integrations | Kafka APIs and ecosystem |
| Stateful processing | External consumer or Flink | No | Kafka Streams, Flink, or consumers |
| S3 delivery | Usually through Firehose or consumer | Core use case | Through connectors or consuming pipelines |
| Multiple custom applications | Strong | Weak | Strong |
| Minimal delivery management | Moderate | Strongest | Lower |
| VPC broker networking | No customer broker fleet | No customer broker fleet | Yes |
| Strongest clue | Replayable AWS-native stream | “Deliver to S3/OpenSearch with least management” | Existing Kafka compatibility |

### Memory rule

```text
Kinesis Data Streams:
    stream for applications

Data Firehose:
    pipe to destinations

MSK:
    Kafka
```

---

# 12. Managed Service for Apache Flink

## 12.1 Purpose

Managed Service for Apache Flink runs stateful stream-processing applications using Java, Scala, Python, or SQL.

AWS manages much of the infrastructure, scaling, Availability Zone failover, and application-state backup mechanisms.

Northstar uses Flink for computations such as:

```text
five-minute checkout conversion
payment failure rate by processor
shipment delay detection
sessionization of website activity
stream-to-stream joins
deduplication with bounded state
rolling aggregates
```

---

## 12.2 Stateful processing

A stateless operation considers one record independently.

```text
Convert currency code to uppercase.
```

A stateful operation depends on previous records.

```text
Count failed payments for this merchant
during the last ten minutes.
```

Flink maintains application state for those windows and aggregations.

---

## 12.3 Window example

```text
Input:
    PaymentFailed events

Group by:
    processor_id

Window:
    five minutes

Output:
    failure_count
    failure_rate
    affected_merchants
```

If the rate exceeds an approved threshold:

```text
Flink
    ↓
operational alert stream
    ↓
incident workflow
```

---

## 12.4 Checkpoints

Flink checkpoints periodically preserve application state so that processing can recover after failure.

A checkpoint is for automatic fault recovery.

A snapshot is a retained application-state backup that can be used deliberately when restarting or changing the application.

```text
Checkpoint:
    automatic fault recovery

Snapshot:
    controlled application-state restore point
```

---

## 12.5 Exactly-once caveat

Flink can provide exactly-once state semantics and exactly-once behavior with supported transactional or checkpoint-aware sinks.

That does not mean every external side effect is globally exactly once.

Example:

```text
Flink calls external email API
    ↓
email sent
    ↓
application fails before checkpoint completes
    ↓
record replayed
    ↓
email sent again
```

End-to-end correctness still depends on:

- source semantics;
- checkpointing;
- sink semantics;
- transactional boundaries;
- idempotency.

---

## 12.6 Unbounded state

Suppose a deduplication operator remembers every event ID forever.

State grows without limit.

Eventually:

```text
checkpoint size increases
checkpoint duration increases
memory or storage pressure grows
recovery becomes slower
```

Use state expiration when the business can define a valid deduplication horizon.

AWS specifically warns that state not disposed of can grow indefinitely and destabilize a Flink application.

---

## 12.7 Flink versus Lambda

### Lambda consumer

Strong for:

```text
independent record transformation
simple filtering
short bounded processing
AWS service integration
```

### Flink

Strong for:

```text
windows
stream joins
event-time processing
large keyed state
continuous SQL
complex streaming topology
```

Do not implement a distributed stateful stream processor by storing every intermediate counter through ad hoc Lambda calls unless that simpler model genuinely meets the requirement.

---

## 12.8 Flink versus Firehose

```text
Firehose:
    transform and deliver buffered records

Flink:
    continuously compute over streams
```

A common combination is:

```text
Kinesis Data Streams
    ├──► Flink for real-time derived results
    └──► Firehose for durable raw S3 delivery
```

---

# 13. S3 data-lake zones

Northstar uses logical zones.

```text
raw/
quarantine/
standardized/
curated/
products/
query-results/
```

These may be separate buckets, access points, or prefixes depending on the control boundary.

---

## 13.1 Raw zone

The raw zone preserves source fidelity.

```text
Original event
Original source file
Original ingestion timestamp
Producer metadata
Checksum
```

Rules:

```text
append rather than overwrite
no analyst writes
limited delete authority
documented retention
encrypted
versioned where appropriate
```

Raw data is the replay and forensic foundation.

---

## 13.2 Quarantine zone

Data enters quarantine when:

- schema validation fails;
- required fields are missing;
- decompression fails;
- malware or policy scan fails;
- partition extraction fails;
- producer identity is invalid.

Quarantine is not a permanent dumping ground.

Every class of quarantined data needs:

```text
owner
alarm
retention
correction procedure
replay procedure
```

---

## 13.3 Standardized zone

The standardized zone normalizes technical representation.

Examples:

```text
timestamps converted to UTC
currency code standardized
field names normalized
nested source records converted to stable schema
PII classified
duplicates marked or removed
```

Business meaning remains close to the source.

---

## 13.4 Curated zone

The curated zone applies approved business logic.

Examples:

```text
recognized revenue
completed orders
active customer
on-time delivery
cancelled appointment
campaign spend
```

Curated data is more useful but less source-neutral.

The responsible domain must own the definition.

---

## 13.5 Product zone

A data product is a published dataset with:

```text
owner
description
schema
quality objective
freshness objective
access policy
retention
versioning
support contact
```

Example:

```text
finance.daily_recognized_revenue_v2
```

A random S3 prefix is not automatically a data product.

---

## 13.6 Query-results zone

Athena and other tools produce result files.

Those outputs may contain restricted data.

Query results therefore need:

- separate access policy;
- encryption;
- lifecycle cleanup;
- expected bucket ownership;
- isolation by workgroup or sensitivity.

Lake Formation permissions on source tables do not automatically secure every Athena result object written to S3. AWS recommends aligning workgroups, result locations, and IAM permissions with the Lake Formation access model.

---

# 14. File formats

## 14.1 JSON and CSV

Advantages:

```text
human-readable
easy producer support
good for raw landing
```

Disadvantages:

```text
larger
row-oriented
more parsing
weak type enforcement
expensive for broad analytical scans
```

---

## 14.2 Apache Parquet and ORC

Columnar formats store values by column rather than complete rows.

For a query selecting:

```sql
SELECT order_date, revenue
FROM orders
WHERE region = 'UY';
```

the engine can avoid reading unrelated payload columns.

Columnar storage and compression usually improve analytical scan performance and cost. Athena explicitly recommends columnar formats and data organization that reduce bytes scanned.

---

## 14.3 Avro

Avro is commonly useful for:

- row-oriented serialization;
- stream records;
- schema-based producer and consumer integration;
- data exchange where complete records are normally read.

It can be a good event format without being the optimal final analytical format.

---

## 14.4 Format progression

A reasonable pipeline is:

```text
Producer JSON or Avro
    ↓
raw S3 representation
    ↓
Glue / Flink / Firehose conversion
    ↓
Parquet or Iceberg analytical table
```

Do not reject a simple producer format when the platform can transform it once centrally.

---

# 15. The small-file problem

Suppose every event becomes one S3 object:

```text
10 billion events
    → 10 billion tiny objects
```

Even when the total byte volume is manageable, downstream engines must perform enormous amounts of:

- object listing;
- metadata lookup;
- request processing;
- file opening;
- task scheduling.

This increases cost and query latency.

Firehose buffering, Flink sinks, Glue compaction, and Iceberg optimization can create more appropriate file sizes.

### Memory rule

```text
Data volume is not the only scale.
Object count and file size matter.
```

---

# 16. Partitioning

## 16.1 Purpose

S3 partitioning places related data under predictable paths.

```text
s3://northstar-lake/curated/orders/
    year=2026/
    month=09/
    day=02/
    region=uy/
```

A query filtering on the partition fields can skip unrelated locations.

Athena partition pruning reduces data scanned, improving performance and lowering query cost.

---

## 16.2 Good partition keys

A good partition key is:

- frequently used in filters;
- not excessively high-cardinality;
- reasonably balanced;
- aligned with retention or lifecycle boundaries;
- stable in meaning.

Common choices:

```text
event date
hour for high-volume streams
business region
domain
event type
```

---

## 16.3 Bad partition key

```text
customer_id
```

may create millions of tiny partitions.

```text
transaction_id
```

may create one partition per record.

```text
country
```

alone may produce one enormous US partition and many tiny partitions.

Partitioning must reflect query shape and data distribution.

---

## 16.4 Too coarse versus too fine

### Too coarse

```text
year=2026/
```

A one-day query scans a year.

### Too fine

```text
second=17/
customer_id=...
transaction_id=...
```

Metadata and tiny-file overhead dominate.

The correct granularity depends on:

- data rate;
- typical query interval;
- file size;
- partition count;
- retention.

---

## 16.5 Partition projection

For highly predictable partition paths, Athena partition projection can calculate partition values and locations from table properties instead of relying on a large stored partition list.

This can reduce metadata lookup overhead for highly partitioned tables.

---

# 17. Apache Iceberg

## 17.1 Why files alone become difficult

A conventional external Parquet table works well for append-only analytics.

It becomes harder when Northstar needs:

```text
UPDATE
DELETE
concurrent writes
schema evolution
partition evolution
consistent snapshots
time travel
```

A table format such as Apache Iceberg adds metadata that manages collections of S3 files as transactional tables.

---

## 17.2 Iceberg capabilities in Athena

Athena supports Iceberg operations such as:

```text
SELECT
INSERT
UPDATE
DELETE
DDL
time travel
version travel
```

Each data-changing transaction creates a new snapshot, and Athena enforces snapshot-isolation behavior for supported updates and deletes.

---

## 17.3 Hidden partitioning

Traditional Hive-style partitions expose paths and partition columns directly.

Iceberg can manage partitioning through table metadata.

Applications query logical fields without manually adding and dropping every physical partition.

Athena’s Iceberg integration uses hidden partitioning rather than ordinary `ALTER TABLE ADD PARTITION` operations.

---

## 17.4 Iceberg does not eliminate maintenance

Frequent updates may create:

- many small data files;
- delete files;
- old snapshots;
- unused files.

Maintenance operations compact files and expire unnecessary table metadata according to the retention policy.

Athena provides optimization operations that rewrite files into a more efficient layout.

---

## 17.5 When Northstar uses Iceberg

Use Iceberg for:

- mutable curated tables;
- GDPR-style approved deletion workflows;
- incremental upserts;
- concurrent data-product writers;
- reproducible historical snapshots;
- schema evolution.

Use ordinary Parquet external tables when:

- data is append-only;
- transformation is simple;
- snapshot transactions are unnecessary;
- operational simplicity matters more.

---

# 18. AWS Glue Data Catalog

## 18.1 Catalog, not storage

The Glue Data Catalog stores metadata such as:

```text
database
table name
column names and types
partition metadata
S3 location
file format
serialization information
table properties
```

The actual data remains in S3 or another data source.

```text
Glue table:
    metadata pointer

S3:
    bytes
```

Glue describes the Data Catalog as the metadata store used by ETL and analytical services.

---

## 18.2 One logical table

```text
Database:
    commerce_curated

Table:
    orders

Location:
    s3://northstar-lake/curated/commerce/orders/
```

Athena, Glue, EMR, Redshift Spectrum, and Lake Formation can use this catalog representation.

---

## 18.3 Crawler

A Glue crawler:

1. scans a data source;
2. classifies files;
3. infers schema;
4. creates or updates Data Catalog tables and partitions.

Crawlers can discover metadata across S3, databases, and supported external sources.

---

## 18.4 Crawler is not a data contract

Suppose one malformed file contains:

```json
{"amount": "unknown"}
```

while every previous file used:

```json
{"amount": 149.50}
```

A crawler may infer or update metadata in an undesirable way.

For production data products, Northstar treats the approved schema as code:

```text
producer schema
schema registry
catalog definition
compatibility test
```

Crawlers are useful for:

- discovery;
- exploratory data;
- partition updates;
- onboarding unknown sources.

They should not silently redefine a governed production contract.

---

# 19. AWS Glue ETL

## 19.1 Purpose

AWS Glue is a serverless data-integration service.

Glue jobs can:

- extract data;
- clean and transform it;
- join datasets;
- convert formats;
- write to S3, Redshift, JDBC databases, and supported systems;
- process batch or streaming inputs.

Glue supplies managed Spark- and Ray-based job environments rather than requiring Northstar to maintain an ETL cluster.

---

## 19.2 Baseline Glue jobs

Northstar uses Glue for:

```text
raw JSON → standardized Parquet
daily ERP normalization
PII classification metadata
currency normalization
reference-data joins
partition compaction
curated-table generation
data-quality evaluation
```

---

## 19.3 Job role

Each Glue job receives an IAM role.

Example:

```text
CommerceOrdersStandardizationRole

Read:
    raw/commerce/orders/*

Write:
    standardized/commerce/orders/*

Catalog:
    read and update approved tables

KMS:
    decrypt raw key
    encrypt standardized key
```

It does not receive:

```text
s3:* on every lake bucket
kms:* on every key
glue:* on every catalog object
```

---

## 19.4 VPC access

Glue jobs run in AWS-managed infrastructure.

When a job must reach a private JDBC source or another VPC resource, Glue creates elastic network interfaces in the configured subnet and applies the selected security groups.

That job then depends on:

- subnet IP capacity;
- routes;
- security groups;
- DNS;
- NAT or VPC endpoints for other dependencies.

---

## 19.5 Job bookmarks

Glue job bookmarks persist processing state so supported recurring jobs can identify data already processed.

```text
First run:
    process files A, B, C

Second run:
    process new files D, E
```

Bookmarks reduce accidental reprocessing, but they do not make the target automatically idempotent.

Resetting or rewinding a bookmark does not automatically remove output written by earlier runs.

---

## 19.6 Bookmark danger

Suppose a producer overwrites an existing object without changing the characteristic Glue uses to detect new input.

The bookmark may not process it as expected.

The better ingestion contract is:

```text
immutable source objects
+
new object identity for corrections
+
explicit correction or backfill process
```

---

## 19.7 Glue Data Quality

Glue Data Quality applies rules written in Data Quality Definition Language.

Examples:

```text
order_id is complete
order_id is unique
amount is nonnegative
currency belongs to approved set
event timestamp is within expected range
row count does not fall unexpectedly
```

It provides managed quality evaluation, but Northstar still defines the actual business rules and response process.

---

## 19.8 Glue streaming

Glue also supports Spark Structured Streaming jobs over Kinesis and Kafka.

Glue streaming uses checkpoints rather than ordinary Glue job bookmarks.

It is a candidate when Northstar needs Spark-oriented streaming ETL and can accept that model.

Managed Flink remains the stronger baseline for complex event-time state, continuous windows, and Flink-native applications.

---

# 20. Glue Schema Registry

The Glue Schema Registry manages schemas for streaming records.

It supports formats such as:

```text
Avro
JSON Schema
Protocol Buffers
```

and integrates with Kinesis Data Streams, MSK, Kafka, Flink, Lambda, and Glue streaming.

## Contract example

Current schema:

```text
order_id: string
amount: decimal
currency: string
```

Proposed change:

```text
customer_segment: optional string
```

A backward-compatible policy may accept it.

Proposed change:

```text
amount: object
```

may be rejected.

### Distinction

```text
Schema Registry:
    validates streaming-message schemas and evolution

Glue Data Catalog:
    describes queryable datasets and tables
```

They can complement each other.

---

# 21. AWS Lake Formation

## 21.1 Purpose

Lake Formation centralizes permissions for data stored in S3 and represented in the Glue Data Catalog.

It supports permissions at levels including:

```text
database
table
column
row
cell
```

Integrated services include Athena, Glue, EMR, and Redshift Spectrum.

---

## 21.2 Why IAM and bucket policies alone become difficult

Without Lake Formation, Northstar might need to coordinate:

```text
IAM role policy
S3 bucket policy
KMS key policy
Glue Data Catalog policy
individual object prefixes
cross-account trust
```

for hundreds of datasets.

Lake Formation adds a logical data-permission layer:

```text
FinanceAnalyst:
    SELECT finance.daily_revenue

LogisticsAnalyst:
    SELECT logistics.shipments

RegionalManager:
    SELECT orders
    WHERE region = assigned_region

GeneralAnalyst:
    all columns except customer_email
```

---

## 21.3 Lake Formation does not replace all IAM

An analyst still needs IAM permission to:

```text
start Athena query
use approved workgroup
read catalog metadata through allowed APIs
write query results
call lakeformation:GetDataAccess
```

Lake Formation determines logical data access.

IAM determines whether the principal may invoke the surrounding AWS services.

---

## 21.4 Credential vending

For an S3 location registered with Lake Formation:

```text
Athena or Glue engine
    ↓
checks catalog and Lake Formation permissions
    ↓
Lake Formation provides temporary scoped credentials
    ↓
engine reads permitted S3 data
```

Principals or execution roles require `lakeformation:GetDataAccess`, and Lake Formation vends temporary access to registered locations after evaluating table permissions.

---

## 21.5 Row and column filters

Suppose the table contains:

```text
order_id
region
customer_email
customer_name
amount
```

A regional manager may receive:

```text
Rows:
    region = 'UY'

Columns:
    order_id
    region
    amount
```

Lake Formation data filters can implement row-, column-, and cell-level controls for supported integrated engines.

---

## 21.6 LF-Tags

Lake Formation tags are authorization attributes applied to catalog resources.

Example:

```text
Domain = Commerce
Sensitivity = Confidential
Residency = EU
QualityTier = Certified
```

Permissions can be granted using expressions:

```text
Domain = Commerce
AND
Sensitivity IN {Public, Internal}
```

LF-tag-based access control scales better than manually granting every role to every table.

LF-Tags are not ordinary AWS resource tags and should not be confused with cost-allocation or IAM ABAC tags.

---

## 21.7 Cross-account sharing

The Data Lake account can grant Lake Formation permissions to consumer accounts.

The consumer creates or uses shared catalog representations and grants access to local roles.

Cross-account sharing does not mean:

```text
every identity in consumer account receives data
```

Nor does it automatically create network paths to private databases.

Lake Formation supports cross-account grants, including hybrid-access migration patterns.

---

## 21.8 Hybrid access mode

Northstar may already have workloads using direct IAM and S3 permissions.

Hybrid access mode allows selected principals and resources to adopt Lake Formation permissions incrementally rather than requiring a single disruptive migration.

It must be configured carefully because direct IAM and Lake Formation access paths may coexist.

---

# 22. Athena

## 22.1 Purpose

Athena is a serverless SQL query service.

It reads data from S3 using table metadata such as the Glue Data Catalog.

```text
Analyst SQL
    ↓
Athena
    ↓
Glue table metadata
    ↓
Lake Formation permission
    ↓
S3 objects
    ↓
query result written to S3
```

The uploaded guide uses the same model: define a table over S3 data, execute SQL, and save results to a separate S3 location.

---

## 22.2 Strong use cases

```text
ad hoc exploration
investigating a new dataset
occasional compliance query
querying historical logs
validating transformation output
low-administration SQL over S3
CTAS conversion into Parquet
```

---

## 22.3 Weak use cases

Athena may be a poor default for:

- thousands of tightly latency-bound dashboard queries;
- frequent complex joins over poorly organized raw data;
- transactional updates to ordinary external files;
- an operational API requiring predictable millisecond responses.

Those requirements may favor Redshift, OpenSearch, DynamoDB, Aurora, or another serving store.

---

## 22.4 Cost and performance

For ordinary on-demand SQL, Athena cost is strongly affected by bytes scanned.

Reduce scans with:

```text
columnar formats
compression
partition pruning
selecting required columns
curated datasets
appropriate file sizes
```

Partitioning and bucketing can reduce scanned data and improve both cost and performance.

---

## 22.5 Bad query

```sql
SELECT *
FROM raw_clickstream;
```

Problems:

- reads every column;
- may scan every date;
- uses raw JSON;
- may process huge history.

---

## 22.6 Better query

```sql
SELECT
    event_date,
    country,
    COUNT(*) AS checkout_count
FROM curated_checkout_events
WHERE event_date BETWEEN DATE '2026-08-01'
                     AND DATE '2026-08-31'
GROUP BY event_date, country;
```

The curated table uses:

- Parquet;
- date partitioning;
- only approved fields;
- standardized semantics.

---

## 22.7 Workgroups

Athena workgroups separate:

```text
users
query history
result locations
encryption settings
metrics
cost controls
capacity assignments
```

Northstar creates:

```text
finance-certified
commerce-exploration
data-science
security-investigation
automated-pipelines
```

Per-query and per-workgroup data-scan controls can cancel oversized queries or generate notifications.

---

## 22.8 Result security

A workgroup can enforce:

```text
S3 result location
result encryption
expected bucket owner
client-setting override
```

Users need access to both:

- permitted source data;
- the result location.

A user denied access to a source table might still learn sensitive column names from shared query history unless workgroup access is separated properly.

---

# 23. Athena versus Redshift

| Requirement | Athena | Redshift |
| --- | --- | --- |
| Infrastructure management | Serverless query execution | Serverless or provisioned warehouse |
| Primary data | S3 files and lake tables | Warehouse tables plus external data |
| Best for | Ad hoc and intermittent SQL | Repeated BI and analytical workloads |
| Data loading required | No for S3 data | Usually for best warehouse performance |
| Performance tuning | Files, partitions, format, query | Table design, workload, capacity, materialization |
| Concurrency predictability | Less warehouse-like | Stronger warehouse workload controls |
| Cost pattern | Data scanned or reserved capacity | RPU or provisioned warehouse resources |
| SQL updates | Iceberg-specific where supported | Native warehouse tables |
| Persistent curated model | Possible in lake | Core strength |

### Exam rule

```text
Query S3 occasionally with SQL:
    Athena

Enterprise analytical warehouse,
repeated joins, dashboards, concurrency:
    Redshift
```

---

# 24. Amazon EMR

## 24.1 Purpose

EMR runs big-data frameworks and distributed analytical workloads.

Common use cases include:

```text
large Spark jobs
complex historical backfills
custom libraries
large-scale transformations
graph or specialized framework workloads
jobs requiring more control than ordinary Glue ETL
```

EMR is not a storage service.

Durable input and output normally belong in S3 or another persistent system.

---

## 24.2 EMR Serverless

EMR Serverless automatically provisions and scales workers for submitted jobs and decommissions them when work finishes.

Northstar uses it for:

```text
monthly full-history recalculation
large campaign-attribution joins
feature-generation backfills
multi-terabyte compaction
occasional complex Spark processing
```

### Strong fit

```text
variable workload
large distributed jobs
no permanent cluster required
Spark or supported framework
```

---

## 24.3 EMR on EC2

Use EMR on EC2 when Northstar needs:

- long-running clusters;
- direct instance-family control;
- custom bootstrap configuration;
- persistent interactive environment;
- specialized storage or network tuning;
- detailed On-Demand and Spot fleet design;
- frameworks or configurations not suitable for Serverless.

Spot Instances can reduce cost for fault-tolerant capacity but may be interrupted, so important cluster roles and workload recovery must be designed accordingly.

---

## 24.4 EMR on EKS

EMR on EKS runs EMR-managed analytics workloads in Kubernetes namespaces.

A virtual cluster maps EMR to one EKS namespace.

Use it when Northstar already has an EKS platform and deliberately wants Spark workloads sharing that Kubernetes resource plane.

Do not select it merely because “containers are modern.”

---

## 24.5 Glue versus EMR

### Glue

Stronger when:

```text
managed ETL
tight Data Catalog integration
standard Spark transformations
crawlers and data integration
minimal infrastructure choices
```

### EMR

Stronger when:

```text
framework flexibility
large or unusual Spark workloads
custom cluster/runtime control
long-running analytics environment
complex performance tuning
```

### EMR Serverless

A middle point:

```text
EMR runtime and job flexibility
without managing persistent clusters
```

---

## 24.6 IAM roles

Depending on the EMR model, relevant identities include:

```text
EMR service role
EC2 instance profile
job runtime role
EMR Serverless execution role
EMR on EKS job execution role
```

A job runtime role should reflect the data required by that job, not the maximum authority of the entire cluster.

---

# 25. Amazon Redshift

## 25.1 Purpose

Redshift is a managed analytical data warehouse.

Northstar uses it for:

```text
certified finance model
daily executive metrics
complex repeated joins
large aggregate tables
high dashboard concurrency
shared dimensional definitions
```

Redshift supports provisioned clusters and Redshift Serverless, which automatically manages and scales warehouse capacity.

---

## 25.2 Curated warehouse model

Example:

```text
fact_orders
fact_payments
fact_shipments

dim_customer
dim_product
dim_region
dim_date
dim_merchant
```

This model is designed for repeated analytical questions.

The raw lake remains the detailed historical source.

---

## 25.3 Serverless versus provisioned

### Redshift Serverless

Strong when:

- demand varies;
- the team wants less capacity administration;
- several intermittent analytical workloads share a workgroup;
- automatic scaling is desirable.

It uses concepts such as:

```text
namespace:
    databases, schemas, users, storage metadata

workgroup:
    compute and network configuration
```

Redshift Serverless automatically provisions and scales compute; costs still depend on the capacity consumed and configured controls.

### Provisioned Redshift

Strong when:

- workload is stable and continuously heavy;
- detailed capacity control is valuable;
- established warehouse operations exist;
- commitment economics are favorable.

---

## 25.4 Loading from S3

A typical path is:

```text
S3 curated files
    ↓
Redshift COPY
    ↓
warehouse tables
```

Data Firehose delivery to Redshift also uses S3 as an intermediate staging path rather than writing each record directly into a warehouse row.

---

## 25.5 Redshift Spectrum

Redshift Spectrum lets Redshift query structured and semistructured data in S3 without loading all of it into local warehouse tables.

Use:

```text
Redshift local tables:
    frequently queried curated data

Spectrum external tables:
    large or colder historical lake data
```

---

## 25.6 Data sharing

Redshift data sharing lets producer warehouses expose live data to consumer clusters or serverless workgroups without manually copying it.

Northstar can keep:

```text
Finance producer warehouse
```

while allowing:

```text
Executive BI consumer
Risk analytics consumer
```

to query approved shared objects.

The familiar baseline is read-oriented sharing; current Redshift also supports explicitly configured multi-warehouse writes in certain designs, but write-enabled sharing should not be assumed unless the question states that requirement.

---

# 26. Amazon OpenSearch Service

## 26.1 Purpose

OpenSearch is optimized for:

```text
full-text search
document search
log analytics
operational event investigation
time-series exploration
low-latency filtered retrieval
```

The uploaded guide positions it as the managed AWS option for Elasticsearch-style log search and document indexing.

---

## 26.2 Northstar use cases

```text
Search failed payment events by merchant and error text.
Search contact-center transcripts by category.
Investigate application logs around one trace ID.
Find recent shipment exceptions.
Power internal product or content search.
```

---

## 26.3 Derived index, not source of truth

Northstar stores durable events in S3.

OpenSearch receives a derived searchable representation.

```text
S3 raw data
    → authoritative replay source

OpenSearch index
    → optimized searchable view
```

If an index is corrupted or mappings change, Northstar can rebuild it from the durable source.

---

## 26.4 Managed domain versus Serverless

### Managed OpenSearch domain

Use when:

- node, shard, storage, or plugin control matters;
- workload is steady;
- the team has established OpenSearch operations;
- specific supported domain features are required.

### OpenSearch Serverless

Use when:

- workload is variable;
- server management should be minimized;
- supported collection behavior fits the use case.

Serverless collections include types optimized for search, time-series/log analytics, and vector search.

---

## 26.5 Ingestion

Possible ingestion paths include:

```text
Data Firehose
OpenSearch Ingestion
application client
Flink output
custom consumer
```

OpenSearch Ingestion is a managed serverless pipeline that can filter, enrich, transform, normalize, and aggregate records before indexing.

---

## 26.6 OpenSearch is not Redshift

```text
Search text, logs, flexible document fields:
    OpenSearch

Repeated relational analytics and BI:
    Redshift
```

Running a company-wide finance model in OpenSearch because it supports aggregations would usually create the wrong data and query model.

---

# 27. Amazon Quick Sight

## 27.1 Current name

Amazon QuickSight evolved into Amazon Quick.

The traditional business-intelligence capability continues as **Amazon Quick Sight**.

SAP-C02 materials and questions may still use:

```text
Amazon QuickSight
```

The BI capability still provides datasets, analyses, visualizations, dashboards, sharing, embedded analytics, and SPICE.

---

## 27.2 Flow

```text
Athena or Redshift
    ↓
Quick Sight dataset
    ↓
analysis
    ↓
published dashboard
    ↓
reader
```

Quick Sight does not replace the data lake, catalog, governance layer, or warehouse.

It is the consumption layer.

---

## 27.3 SPICE

SPICE is Quick Sight’s in-memory analytical engine.

```text
Source data
    ↓ scheduled or triggered ingestion
SPICE
    ↓
fast interactive dashboards
```

Advantages:

- responsive dashboard interaction;
- reduced repeated load on source systems;
- scalable reader experience.

Tradeoffs:

- data is a snapshot until refreshed;
- SPICE capacity is consumed;
- ingestion can fail;
- freshness depends on refresh policy.

---

## 27.4 Direct query

In direct-query mode:

```text
Dashboard interaction
    ↓
query source now
```

Advantages:

- fresher source data;
- no SPICE import requirement.

Tradeoffs:

- dashboard speed depends on source;
- every interaction can create warehouse or Athena work;
- source concurrency and cost matter;
- source outage affects dashboard availability.

---

## 27.5 Selection rule

```text
Fast dashboard over data refreshed hourly:
    SPICE

Operational dashboard requiring current warehouse state:
    direct query

Very high reader count over stable data:
    SPICE often stronger

Complex governed warehouse with reliable concurrency:
    direct Redshift may be appropriate
```

The uploaded guide makes the same SPICE-versus-direct-query distinction.

---

## 27.6 Reader versus author

### Author

Creates:

```text
datasets
analyses
visuals
dashboards
calculated fields
```

### Reader

Consumes published dashboards and permitted interactions.

Do not give every executive author permissions merely so they can view a chart.

---

# 28. One dataset, several serving systems

The platform should not force every access pattern into one engine.

For the same `PaymentFailed` event:

```text
S3 raw:
    durable historical copy

Flink:
    rolling failure rate

OpenSearch:
    operator search by error message

Redshift:
    daily processor-performance model

Quick Sight:
    executive dashboard
```

These copies serve different purposes.

The danger is not duplication itself.

The danger is uncontrolled duplication with no:

- lineage;
- owner;
- refresh objective;
- reconciliation rule;
- authoritative source.

---

# 29. Account architecture

## 29.1 Producer accounts

Producer teams own:

```text
operational applications
source databases
event publishers
source-data quality
business meaning
```

They do not receive direct write access to every curated platform location.

---

## 29.2 Ingestion account

Owns:

```text
Kinesis streams
Data Firehose streams
MSK where centrally operated
Flink applications
ingestion monitoring
```

This isolates high-volume ingestion authority from general analytics users.

---

## 29.3 Data Lake account

Owns:

```text
S3 lake
Glue Data Catalog
Lake Formation governance
lake KMS keys
cross-account data grants
```

The Data Lake account does not run ordinary business applications.

---

## 29.4 Processing account

Owns:

```text
Glue jobs
EMR applications
transformation pipelines
quality workflows
```

Execution roles receive scoped access to individual datasets.

---

## 29.5 Analytics account

Owns:

```text
Athena workgroups
Redshift
OpenSearch
Quick Sight
analyst identities and tools
```

Analysts should not need administrative access to the S3 bucket-owning account.

---

## 29.6 Why not one account?

One account would allow an accidental administrator or pipeline to affect:

```text
raw data
catalog
processing
warehouse
search
dashboards
```

Separate accounts create:

- clearer ownership;
- independent quotas;
- smaller IAM blast radius;
- better cost attribution;
- stronger production boundaries.

The accounts still need explicit cross-account grants and sometimes network connectivity.

---

# 30. IAM architecture

| Actor | Identity | Main permissions |
| --- | --- | --- |
| Commerce producer | `CommerceEventPublisherRole` | Write approved events to one stream |
| Firehose | `CommerceRawDeliveryRole` | Read stream, transform, encrypt, write raw prefix |
| Flink | `CheckoutAnalyticsRole` | Read selected streams, checkpoint, write derived outputs |
| Glue crawler | `CatalogDiscoveryRole` | Read approved locations and update selected catalog objects |
| Glue job | `OrdersStandardizationRole` | Read raw, write standardized, use catalog and KMS |
| EMR job | `AttributionBackfillRole` | Read selected historical data and write one product |
| Lake administrator | Federated administrative role | Define LF-Tags and grants; no ordinary analysis |
| Analyst | IAM Identity Center analyst role | Athena workgroup and Lake Formation table permissions |
| Athena | User session plus service execution | Query source and write controlled results |
| Redshift Spectrum | Redshift IAM role | Catalog, Lake Formation, S3, and KMS access |
| Quick Sight | Quick service role or configured identity | Access approved Athena or Redshift datasets |
| OpenSearch Ingestion | Pipeline role | Read source and index approved collection |
| Data-product publisher | Domain pipeline role | Publish one governed product |
| Auditor | Read-only governance role | Read catalog, lineage, activity, and evidence |

---

## 30.1 Producer role

```text
CommerceEventPublisherRole

Allow:
    kinesis:PutRecord
    kinesis:PutRecords

Resource:
    commerce-events stream
```

The role cannot:

```text
read the stream
delete the stream
write logistics events
change retention
update Flink application
```

---

## 30.2 Firehose service role

```text
CommerceRawDeliveryRole

Allow:
    read Kinesis source
    invoke approved transform Lambda
    write raw commerce prefix
    use exact KMS key
    write error prefix
```

Firehose assumes this role.

The producer does not receive the Firehose role’s S3 authority.

---

## 30.3 Glue job role

```text
OrdersStandardizationRole

Allow:
    read raw commerce orders
    write standardized commerce orders
    read reference currency table
    update approved catalog table
    lakeformation:GetDataAccess
    use required KMS keys
```

The role is passed to Glue by an authorized deployment or job-starting principal.

---

## 30.4 Analyst role

The analyst role needs several layers:

```text
Athena:
    StartQueryExecution
    GetQueryResults
    use specific workgroup

Glue:
    read permitted catalog metadata

Lake Formation:
    SELECT approved table/columns/rows

S3:
    write/read approved query-result prefix

KMS:
    use result key
```

Direct source-bucket permission may be replaced by Lake Formation temporary credential vending for registered locations.

---

## 30.5 `iam:PassRole`

Legitimate examples include:

```text
Pipeline passes Glue job role to Glue.
Pipeline passes Flink execution role to Flink.
EMR submitter supplies approved job runtime role.
OpenSearch administrator supplies ingestion role.
```

A user allowed to pass arbitrary data roles could use a processing service to read datasets they cannot access directly.

Restrict:

```text
exact role ARN
intended AWS service
approved job or application path
```

---

# 31. Authorization trace: producer to raw lake

```text
1. Commerce ECS task assumes CommerceEventPublisherRole.

2. Task calls PutRecords on commerce-events.

3. IAM policy permits the exact stream.

4. Stream resource policy and SCPs are evaluated where applicable.

5. Kinesis accepts records.

6. Firehose reads the stream using CommerceRawDeliveryRole.

7. Firehose optionally invokes its transform Lambda.

8. Firehose buffers records.

9. Firehose calls s3:PutObject on:
       raw/commerce/orders/...

10. Bucket policy permits the Firehose role.

11. KMS policy permits encryption.

12. Object is written to the raw zone.
```

No application task receives direct raw-lake write authority.

---

# 32. Authorization trace: analyst runs Athena

```text
1. Analyst authenticates through corporate IdP.

2. Analyst receives temporary credentials
   for CommerceDataAnalyst.

3. Analyst selects:
       commerce-exploration workgroup

4. IAM permits StartQueryExecution in that workgroup.

5. Athena reads table metadata from Glue Data Catalog.

6. Lake Formation evaluates:
       database
       table
       columns
       rows
       LF-Tag permissions

7. Athena requests temporary data credentials.

8. Lake Formation permits GetDataAccess.

9. Athena reads permitted S3 objects.

10. KMS decrypts objects under the authorized context.

11. Athena executes the query.

12. Result is written to the workgroup's S3 result prefix.

13. Analyst reads the result through Athena or approved S3 access.
```

`SELECT` in Lake Formation alone does not grant permission to start arbitrary Athena queries.

Athena IAM permission alone does not grant access to a Lake Formation-protected table.

---

# 33. Authorization trace: Redshift Spectrum

```text
1. Redshift query runs under database identity.

2. External schema references Glue Data Catalog.

3. Redshift uses its approved IAM role.

4. Lake Formation evaluates access to external table.

5. Lake Formation vends scoped S3 credentials.

6. Spectrum reads permitted S3 files.

7. KMS permits decryption.

8. External rows join with local Redshift tables.

9. Redshift applies its own database permissions
   to returned warehouse objects.
```

Redshift database authorization and AWS IAM/Lake Formation authorization are different layers.

---

# 34. Networking architecture

## 34.1 Managed service endpoint versus VPC resource

Services such as:

```text
Kinesis Data Streams
Data Firehose control plane
Glue Data Catalog
Lake Formation
Athena
```

are accessed through AWS service endpoints.

They are not ordinary EC2 servers placed into Northstar’s application subnets.

However, jobs and clients may need VPC connectivity to their sources or destinations.

---

## 34.2 MSK network

MSK brokers have VPC connectivity.

```text
Producer VPC
    ↓ route / managed VPC connection
MSK security group
    ↓ Kafka TLS port
MSK broker
    ↓
IAM, TLS, or SASL authentication
```

Required layers:

```text
DNS
route
security group
client TLS
Kafka authentication
topic authorization
```

---

## 34.3 Glue private source

```text
Glue job ENI
    ↓
private processing subnet
    ↓ security group
Aurora endpoint:5432
```

The Glue role authorizes AWS API operations.

The network path reaches the database.

The database user authorizes SQL operations.

---

## 34.4 S3 gateway endpoint

Processing subnets use an S3 gateway endpoint for large lake traffic.

```text
Glue / EMR / private application
    ↓ route table
S3 prefix-list route
    ↓
S3 gateway endpoint
    ↓
S3
```

The endpoint supplies the path.

IAM, bucket policy, Lake Formation, and KMS still govern access.

---

## 34.5 Redshift

Redshift Serverless workgroups or provisioned clusters can use private network configuration.

Clients need:

```text
route
security-group access
DNS
database credentials or supported IAM authentication
database privilege
```

Quick Sight may need a configured VPC connection when it connects directly to a private data source.

---

## 34.6 OpenSearch

A VPC-based OpenSearch domain is reached through private VPC networking.

```text
OpenSearch Ingestion or client
    ↓
route and security group
    ↓
domain endpoint
    ↓
IAM/domain access policy
    ↓
fine-grained OpenSearch permission
```

A successful TCP connection does not imply permission to search every index.

---

## 34.7 Cross-account role versus network path

Suppose a Glue job in the Processing account assumes a role that may query a producer’s Aurora database metadata.

That role does not create connectivity to:

```text
10.20.4.18:5432
```

The job still needs:

- VPC attachment or placement;
- Transit Gateway, peering, or PrivateLink where appropriate;
- route tables;
- security groups;
- DNS;
- database authentication.

---

# 35. Reliability and delivery semantics

## 35.1 Assume retries and duplicates

Distributed pipelines retry.

Duplicates may arise because:

- producer did not receive acknowledgement;
- consumer processed before checkpointing;
- delivery retried;
- job was restarted;
- source file was submitted twice;
- backfill overlapped normal processing.

Every important event has a stable event ID.

Every derived sink defines deduplication semantics.

---

## 35.2 Idempotent sink

Example unique business key:

```text
event_id
+
transformation_version
```

or:

```text
order_id
+
order_state_version
```

Repeated delivery should converge rather than double-count.

---

## 35.3 Checkpoint ordering

Dangerous sequence:

```text
1. Read event.
2. Mark source position complete.
3. Write destination.
```

If the destination write fails, the event may be lost.

Alternative danger:

```text
1. Read event.
2. Write destination.
3. Crash before source position is committed.
```

The event may be written again.

Transactional or idempotent sinks resolve this tension.

---

## 35.4 Raw S3 as replay source

The platform always writes an immutable lake copy for significant streams.

If:

- a consumer bug is found;
- a derived table is corrupted;
- a schema changes;
- a new metric is introduced;

Northstar can replay from raw history.

```text
Raw data
    +
versioned transformation
    =
reproducible derived dataset
```

---

## 35.5 Backfills

A backfill processes historical data through new logic.

It must not silently overlap the normal production writer.

Possible patterns:

```text
write to new table version
write to isolated prefix
use merge keyed by event ID
pause normal writer during controlled cutover
use Iceberg transaction and snapshot
```

---

## 35.6 Event stream is not indefinite archive

Kinesis and Kafka retention support operational replay.

S3 supports long-term history.

Keeping seven years of data in the primary stream simply to avoid designing a lake is usually the wrong storage model.

---

## 35.7 Region failure

The baseline is Regionally resilient but not automatically multi-Region.

A second Region would separately require:

```text
stream replication or producer failover
S3 replication
catalog and Lake Formation deployment
KMS keys
Glue and EMR jobs
Redshift recovery
OpenSearch rebuild or replication
Quick Sight assets
DNS and application failover
```

Copying S3 objects does not recreate the complete analytics platform.

---

# 36. Data quality

## 36.1 Four useful categories

```text
Validity:
    Does value satisfy its domain?

Completeness:
    Is required data present?

Uniqueness:
    Is entity or event duplicated?

Freshness:
    Did expected data arrive on time?
```

Additional dimensions include:

```text
consistency
referential integrity
accuracy
volume anomaly
schema conformity
```

---

## 36.2 Technical success versus data success

A Glue job can return:

```text
SUCCEEDED
```

while producing:

```text
zero rows
all amounts null
duplicate orders
yesterday's data
incorrect currency conversion
```

Infrastructure status is not data-quality status.

---

## 36.3 Freshness objective

Example data product:

```text
commerce.orders_curated

Freshness:
    99% of events visible within 15 minutes

Completeness:
    daily count within approved reconciliation tolerance

Uniqueness:
    one row per order version

Owner:
    Commerce Data
```

CloudWatch alarms should monitor these objectives, not only CPU and job failures.

---

## 36.4 Reconciliation

Northstar reconciles:

```text
producer event count
raw object count
standardized row count
curated business count
warehouse load count
```

Differences are not automatically errors.

Filtering and deduplication can reduce counts.

But the transformation must explain the difference.

---

# 37. Schema evolution

## 37.1 Additive change

```text
Add optional:
    delivery_method
```

Old consumers continue.

New consumers can use the field.

---

## 37.2 Breaking change

```text
Rename:
    amount
to:
    gross_amount

Remove:
    currency

Change:
    order_id from string to nested object
```

Use a new event version and a migration period.

---

## 37.3 Semantic breaking change

The type stays the same:

```text
amount: decimal
```

but meaning changes from:

```text
gross amount
```

to:

```text
net of refund
```

Schema validation does not detect this.

Data contracts must document semantics.

---

## 37.4 Curated product version

Rather than changing an executive table silently:

```text
finance.revenue_v1
finance.revenue_v2
```

Northstar:

1. publishes v2;
2. validates it against v1;
3. migrates consumers;
4. deprecates v1;
5. removes it after the support period.

---

# 38. Observability

## 38.1 Ingestion metrics

```text
records received
bytes received
producer errors
throttling
hot partitions
consumer lag
oldest unprocessed record
Firehose delivery freshness
failed transformation
error-prefix volume
MSK broker storage
consumer-group lag
```

---

## 38.2 Flink metrics

```text
records in and out
backpressure
checkpoint duration
checkpoint failures
state size
late events
restart count
watermark lag
sink failures
```

A growing checkpoint can be a state-retention problem even while output still appears correct.

---

## 38.3 Batch metrics

```text
job start delay
job duration
worker usage
input bytes
output bytes
shuffle
failed stages
bookmark position
files processed
rows read and written
```

---

## 38.4 Data metrics

```text
freshness
row count
duplicate rate
null rate
schema failures
quarantine volume
reconciliation difference
unpublished data products
```

---

## 38.5 Query metrics

```text
Athena bytes scanned
query failures
query duration
workgroup consumption
Redshift queue and execution time
warehouse utilization
OpenSearch indexing latency
search latency
rejected documents
Quick Sight ingestion failures
SPICE freshness
```

---

## 38.6 Audit

CloudTrail answers:

```text
Who changed a Lake Formation grant?
Who started the expensive Athena query?
Who altered a Firehose destination?
Who changed stream retention?
Who deleted a catalog table?
Who modified an MSK cluster policy?
Who published a Quick Sight dashboard?
```

Data-access evidence may additionally require:

- S3 data events;
- Lake Formation access events;
- Redshift audit logs;
- OpenSearch audit logs;
- application-level query evidence.

---

# 39. Cost model

## 39.1 S3

Cost drivers include:

```text
stored bytes
object count and requests
retrieval tier
replication
KMS operations
lifecycle transitions
data transfer
```

Use lifecycle rules by data class.

Example:

```text
raw recent:
    S3 Standard

older replay data:
    lower-cost storage class

query-result files:
    delete after approved period

quarantine:
    short retention unless investigation requires longer
```

Do not archive data before confirming that the selected query engine can use it at the required latency.

---

## 39.2 Kinesis Data Streams

Costs depend on:

```text
capacity mode
throughput
retention
enhanced fan-out consumers
data volume
```

Use enhanced fan-out for consumers that require it, not automatically for every consumer.

---

## 39.3 Data Firehose

Costs depend primarily on data processed and optional capabilities.

Cost and performance are influenced by:

```text
buffering
format conversion
Lambda transformation
dynamic partitioning
destination
backup copies
```

Larger buffers can create better S3 files but increase delivery latency.

---

## 39.4 MSK

Provisioned MSK carries ongoing broker and storage cost even during quiet periods.

MSK Serverless reduces broker-capacity management but is not automatically cheaper for every sustained high-volume workload.

Use MSK because Kafka compatibility has value.

Do not pay for a Kafka estate merely to deliver one log stream to S3.

---

## 39.5 Flink

Costs depend on continuous processing capacity, state, and runtime duration.

A Flink application that runs all month to compute one daily total is probably the wrong model.

A stateful fraud detector that must run continuously may justify it.

---

## 39.6 Glue

Glue costs depend on:

```text
worker capacity
job duration
crawler activity
data-quality evaluation
retries
```

Bookmarks and incremental processing can avoid repeatedly scanning unchanged data.

But a faulty bookmark can produce incorrect results, so cost optimization must not replace correctness.

---

## 39.7 Athena

The most important optimization is to scan less:

```text
Parquet instead of raw JSON
partition pruning
column selection
compaction
curated tables
Iceberg metadata pruning
```

Use workgroup controls to prevent one exploratory query from scanning the entire lake unexpectedly.

---

## 39.8 EMR

### EMR Serverless

Good for variable jobs and reduced operations.

### EMR on EC2

Potentially efficient for sustained workloads and deliberate instance-fleet design.

Spot is useful for retryable or replaceable capacity but should not create an unrecoverable critical dependency.

---

## 39.9 Redshift

### Serverless

Cost follows RPU capacity consumed, including scaled capacity.

Set:

```text
base capacity
maximum capacity
usage limits
workload controls
```

### Provisioned

Cost follows cluster resources and commitment decisions.

An idle large warehouse is still expensive.

A continuously used warehouse may be more predictable than repeated poorly optimized lake queries.

---

## 39.10 OpenSearch

Cost depends on:

```text
indexing capacity
search capacity
storage
replicas
shards
retention
warm/cold tiers or Serverless OCUs
```

Do not keep the only seven-year copy in an expensive searchable cluster.

Keep durable history in S3 and retain only operationally useful periods in OpenSearch.

---

## 39.11 Quick Sight

Cost depends on:

```text
authors
readers or capacity model
SPICE capacity
ingestion frequency
embedded use
reports
```

SPICE can reduce pressure on Athena and Redshift, but unnecessary duplicate imports and refreshes consume capacity.

---

## 39.12 Cost attribution

Every major platform resource carries:

```text
Domain
Product
Environment
Owner
CostCenter
DataClass
```

Athena workgroups, Redshift workgroups, EMR job roles, and domain-specific prefixes help attribute shared-platform spend to actual users.

---

# 40. Changed-requirement variants

## Variant 1: Only logs must reach S3

Use:

```text
CloudWatch Logs
    ↓ subscription
Data Firehose
    ↓
S3
```

Do not create MSK and Flink for simple buffered archival.

---

## Variant 2: Five independent applications need replay

Use Kinesis Data Streams or MSK.

Do not use Firehose as though it were a multi-consumer application stream.

---

## Variant 3: Company is standardized on Kafka

Use MSK and the existing Kafka ecosystem.

Still preserve raw history in S3 and govern analytical tables separately.

---

## Variant 4: Traffic is small and unpredictable

Use:

```text
Kinesis on-demand
MSK Serverless where Kafka is required
EMR Serverless
Redshift Serverless
OpenSearch Serverless where suitable
```

Serverless minimizes capacity administration but does not eliminate cost controls.

---

## Variant 5: All analytics are daily

Use:

```text
S3 landing
Glue
Athena
optional Redshift
```

Remove permanent Flink and stream infrastructure unless another use case justifies them.

---

## Variant 6: Subsecond stateful fraud detection is required

Use:

```text
Kinesis or MSK
    ↓
Managed Service for Apache Flink
    ↓
alerting and decision service
```

Preserve an asynchronous raw copy in S3.

---

## Variant 7: Analysts need frequent updates and deletes in the lake

Use Apache Iceberg tables.

Plan:

```text
compaction
snapshot retention
orphan-file cleanup
concurrent writers
catalog governance
```

---

## Variant 8: Thousands of dashboards run continuously

Move repeatedly queried curated data into Redshift and consider SPICE.

Athena remains useful for exploration and historical drill-down.

---

## Variant 9: Users search free text and trace IDs

Use OpenSearch.

Do not force full-text retrieval into Redshift merely because the source is analytical data.

---

## Variant 10: Data must remain owned by business domains

Retain domain producer accounts and publish governed cross-account data products through Lake Formation.

Centralize the control plane without making the central team responsible for every business definition.

---

## Variant 11: Sources remain on premises

Use the hybrid network from Lesson 7.

Possible ingestion paths include:

```text
Direct Connect or VPN
database export
Kafka replication
DMS CDC
DataSync
scheduled file transfer
```

The precise migration and CDC mechanisms return in Lessons 15 and 16.

---

## Variant 12: EKS is the shared compute platform

Use EMR on EKS only when the organization deliberately wants Spark jobs running in EKS namespaces.

Lake storage and governance remain independent of Kubernetes.

---

# 41. Failure drills

## Failure A: One Kinesis shard throttles while total traffic looks moderate

The partition key distribution is uneven.

Inspect per-shard traffic and redesign or salt the key without destroying required ordering.

---

## Failure B: One consumer is hours behind while others are current

The stream is healthy.

Investigate:

```text
consumer throughput
checkpoint progress
processing errors
hot shard
enhanced fan-out
downstream sink
```

---

## Failure C: Records arrive out of expected order

Possible causes:

```text
different partition keys
multiple shards
producer retry behavior
late source events
consumer parallelism
event time differs from ingestion order
```

Kinesis does not provide one global stream order.

---

## Failure D: Firehose S3 objects appear several minutes late

Firehose buffers by size or time.

Review the delivery-latency requirement and buffering configuration.

Use Kinesis plus a low-latency consumer when the business needs immediate processing.

---

## Failure E: Firehose creates thousands of tiny S3 objects

Possible causes:

```text
low traffic
small buffer
dynamic partitioning with excessive cardinality
too many active partition keys
```

---

## Failure F: Firehose records appear in the error prefix

Investigate:

```text
Lambda transformation
JSON parsing
dynamic partition expression
destination permission
KMS
record format
```

---

## Failure G: MSK client resolves brokers but times out

Investigate:

```text
route
managed VPC connection
security group
network ACL
Kafka port
TLS path
```

Authentication may not yet have been reached.

---

## Failure H: MSK client connects but receives authorization errors

Networking and authentication may have succeeded.

Investigate:

```text
IAM kafka-cluster actions
topic ARN
consumer-group ARN
cluster policy
Kafka ACL or selected auth mode
```

---

## Failure I: MSK consumers rebalance repeatedly

Possible causes:

```text
unstable clients
processing exceeds expected poll timing
partition count changes
network interruption
consumer crash
insufficient resources
```

---

## Failure J: Flink output pauses during checkpointing

Investigate:

```text
checkpoint duration
state size
sink latency
backpressure
insufficient parallelism
unbounded state
```

---

## Failure K: Flink restarts but repeats external notifications

State recovered, but the external side effect was not transactional or idempotent.

Exactly-once state does not guarantee exactly-once email or webhook delivery.

---

## Failure L: Late warehouse events change yesterday’s total

The original result closed before all permitted late events arrived.

Define correction and restatement semantics.

---

## Failure M: Glue crawler changes a column type unexpectedly

The crawler inferred schema from changed or malformed source data.

Restore governed schema and prevent automatic production-schema mutation.

---

## Failure N: Glue job reports success but output is empty

Infrastructure completed successfully.

Investigate:

```text
bookmark
source partition
filter
schema
permissions
business date
quality rules
```

---

## Failure O: Rewound Glue job duplicates target rows

The bookmark was rewound, but previous output remained.

Make the sink idempotent or write the backfill into an isolated version.

---

## Failure P: Glue job cannot connect to a private database

Investigate:

```text
subnet IPs
ENI creation
route
security groups
DNS
database listener
credentials
```

---

## Failure Q: Analyst has S3 permission but Athena says access denied

Lake Formation may deny the table or catalog operation.

Direct S3 permission is not sufficient for a Lake Formation-governed table.

---

## Failure R: Analyst has Lake Formation `SELECT` but cannot start query

The role may lack:

```text
Athena workgroup permission
glue:GetTable
lakeformation:GetDataAccess
query-result S3 access
KMS permission
```

---

## Failure S: Analyst can read another team’s Athena result file

Source-table governance worked, but the shared query-results bucket policy is too broad.

Separate result prefixes and workgroups.

---

## Failure T: Athena query cost increases tenfold

Possible causes:

```text
partition predicate removed
raw JSON queried
new SELECT *
partition metadata incorrect
many tiny files
compression lost
curated table not used
```

---

## Failure U: Athena returns different historical values after an Iceberg update

The current snapshot changed.

Use time travel or a recorded snapshot ID for reproducibility.

---

## Failure V: Iceberg query becomes slower after many deletes

Delete files and small files accumulated.

Run appropriate compaction and snapshot maintenance.

---

## Failure W: EMR Serverless job waits or cannot scale

Investigate:

```text
account quota
maximum application capacity
worker sizing
Region capacity
job dependency
execution-role permission
```

---

## Failure X: EMR on EC2 loses task nodes

Spot interruption may be expected.

The framework and job must tolerate task-node replacement, while critical state must not exist only on interrupted local storage.

---

## Failure Y: Redshift dashboard is fast, but numbers differ from Athena

Possible causes:

```text
warehouse load is stale
different business logic
late data
different snapshot
different time zone
duplicate handling
different Lake Formation filter
```

---

## Failure Z: Redshift Spectrum query is denied

Investigate:

```text
Redshift IAM role
Glue catalog access
Lake Formation grant
lakeformation:GetDataAccess
S3 location
KMS key
```

---

## Failure AA: OpenSearch misses some events

Investigate:

```text
ingestion failures
rejected documents
mapping conflict
bulk request errors
Firehose backup prefix
index policy
consumer checkpoint
```

Rebuild from S3 if necessary.

---

## Failure AB: OpenSearch storage grows indefinitely

The index lifecycle or Serverless time-series retention policy is missing.

OpenSearch is a serving store, not the only permanent archive.

---

## Failure AC: Quick Sight dashboard shows yesterday’s values

The dataset uses SPICE and its refresh did not run or failed.

Direct query would be fresher but would change source-load and latency behavior.

---

## Failure AD: Quick Sight direct-query dashboard times out

Investigate the underlying:

```text
Athena query
Redshift workload
network connection
Lake Formation permission
dataset SQL
source concurrency
```

Quick Sight cannot make an inefficient source query free.

---

## Failure AE: Cross-account Lake Formation table is visible but cannot be queried

The consumer may have received the shared catalog resource but lack:

```text
local principal grant
resource link
GetDataAccess
query-engine permission
KMS
result-bucket access
```

---

## Failure AF: Data product is fresh but incorrect

Freshness is only one quality dimension.

Check:

```text
validity
uniqueness
completeness
business semantics
reference data
```

---

## Failure AG: Backfill doubles finance revenue

The backfill and normal pipeline both wrote the same business periods without a merge or isolated version.

---

## Failure AH: Second Region has replicated S3 data but queries fail

Missing components may include:

```text
Glue catalog
Lake Formation grants
KMS keys
Athena workgroups
processing jobs
Redshift
OpenSearch
Quick assets
```

Storage replication is not platform recovery.

---

# 42. SAP-C02 decision snippets

## Batch versus streaming

```text
Complete dataset and delayed result acceptable:
    batch

Continuous events and action needed quickly:
    streaming
```

---

## Kinesis Data Streams versus Data Firehose

```text
Multiple custom consumers, replay, checkpoints:
    Kinesis Data Streams

Managed buffered delivery to S3 or OpenSearch:
    Data Firehose
```

---

## Kinesis Data Streams versus MSK

```text
AWS-native managed stream:
    Kinesis Data Streams

Kafka compatibility, topics, consumer groups, connectors:
    Amazon MSK
```

---

## Flink versus Firehose

```text
Stateful windows and joins:
    Managed Service for Apache Flink

Transform and deliver:
    Data Firehose
```

---

## Flink versus Lambda

```text
Independent short record processing:
    Lambda

Continuous stateful event computation:
    Flink
```

---

## Glue Data Catalog versus Lake Formation

```text
Describe tables and schemas:
    Glue Data Catalog

Govern who may access them:
    Lake Formation
```

---

## Glue crawler versus Schema Registry

```text
Discover and infer dataset metadata:
    Glue crawler

Enforce event-schema evolution contract:
    Glue Schema Registry
```

---

## Glue versus EMR

```text
Managed standard ETL and catalog integration:
    Glue

Greater big-data framework and runtime control:
    EMR
```

---

## EMR Serverless versus EMR on EC2

```text
Variable jobs, minimal cluster management:
    EMR Serverless

Long-running or highly customized cluster:
    EMR on EC2
```

---

## EMR on EKS

```text
Existing deliberate Kubernetes analytics platform:
    EMR on EKS
```

Not merely “we like containers.”

---

## Athena versus Redshift

```text
Ad hoc SQL directly over S3:
    Athena

Curated analytical warehouse and repeated BI:
    Redshift
```

---

## Redshift Spectrum

```text
Query S3 data from Redshift without loading all of it:
    Redshift Spectrum
```

---

## OpenSearch

```text
Full-text search, logs, operational documents:
    OpenSearch
```

---

## Quick Sight SPICE versus direct query

```text
Imported in-memory snapshot and fast interaction:
    SPICE

Query source at dashboard time:
    direct query
```

---

## Parquet versus JSON

```text
Raw interchange and readability:
    JSON

Efficient analytical column scans:
    Parquet
```

---

## Conventional Parquet table versus Iceberg

```text
Simple append-only external table:
    Parquet table

Updates, deletes, snapshots, schema evolution:
    Iceberg
```

---

## IAM versus Lake Formation

```text
May the principal invoke Athena or Glue?
    IAM

May the principal read this table, column, or row?
    Lake Formation
```

---

## Cross-account permission versus networking

```text
Role or Lake Formation grant:
    authorization

Route and security group to private source:
    networking
```

---

# 43. Retrieval practice

## 1

What is the central purpose of Northstar Insight Hub?

## 2

Why should a data-platform design begin with business latency rather than service selection?

## 3

What is the difference between batch and streaming data?

## 4

What are event time, ingestion time, and processing time?

## 5

Why does every important event need a stable event ID?

## 6

What does the event version represent?

## 7

What is Kinesis Data Streams primarily used for?

## 8

What is a shard?

## 9

What does a Kinesis partition key influence?

## 10

Does Kinesis provide one global order across every record?

## 11

What is a hot partition key?

## 12

What is the difference between Kinesis on-demand and provisioned modes?

## 13

What does enhanced fan-out provide?

## 14

Why preserve Kinesis data in S3?

## 15

What is Data Firehose primarily used for?

## 16

Why does Firehose buffer records?

## 17

Why is Firehose not a general multi-consumer event bus?

## 18

What is dynamic partitioning?

## 19

What is Amazon MSK?

## 20

What is the difference between a Kafka topic and partition?

## 21

What is a Kafka consumer group?

## 22

When is MSK a stronger choice than Kinesis?

## 23

Does valid MSK IAM permission create network connectivity to brokers?

## 24

What does Managed Service for Apache Flink provide?

## 25

What makes a stream operation stateful?

## 26

What is the difference between a Flink checkpoint and snapshot?

## 27

Why does Flink not automatically guarantee exactly-once external side effects?

## 28

What is the purpose of the S3 raw zone?

## 29

What belongs in a quarantine zone?

## 30

What is the difference between standardized and curated data?

## 31

Why are tiny S3 files a problem?

## 32

Why should analytical data often use Parquet?

## 33

What is the purpose of partitioning?

## 34

Why is transaction ID usually a bad S3 partition key?

## 35

What does Apache Iceberg add to an S3 data lake?

## 36

What does the Glue Data Catalog store?

## 37

Does the Glue Data Catalog contain the underlying table data?

## 38

What does a Glue crawler do?

## 39

Why is a crawler not necessarily a production schema contract?

## 40

What does a Glue job bookmark track?

## 41

Does resetting a job bookmark remove previous target output?

## 42

What is the difference between Glue Schema Registry and the Data Catalog?

## 43

What does Lake Formation govern?

## 44

Does Lake Formation replace every IAM permission?

## 45

What is Lake Formation credential vending?

## 46

What are LF-Tags?

## 47

What is Athena best suited for?

## 48

What primarily drives ordinary Athena query cost?

## 49

Why use Athena workgroups?

## 50

What is the difference between Athena and Redshift?

## 51

When is EMR Serverless appropriate?

## 52

When is EMR on EC2 appropriate?

## 53

When is EMR on EKS justified?

## 54

What does Redshift Spectrum provide?

## 55

What does Redshift data sharing provide?

## 56

What is OpenSearch best suited for?

## 57

Why should OpenSearch not be the only durable copy?

## 58

What is SPICE?

## 59

What is the difference between SPICE and direct query?

## 60

Why is “exactly once” an end-to-end property rather than merely a stream-engine setting?

---

# 44. Answer key

## 1

To provide governed, reproducible, company-wide ingestion, transformation, storage, query, search, and business intelligence without coupling consumers directly to operational systems.

## 2

Because the time by which a business decision must be made determines whether batch, near-real-time delivery, or continuous stream processing is justified.

## 3

Batch processes a bounded collection. Streaming continuously processes an unbounded sequence of records.

## 4

Event time is when the business event happened. Ingestion time is when the platform received it. Processing time is when one consumer processed it.

## 5

For deduplication, replay, tracing, and idempotent output.

## 6

The structured and semantic contract version used by producers and consumers.

## 7

A durable AWS-native real-time stream supporting independent consumers, replay, and partition-based processing.

## 8

An ordered portion of a Kinesis stream and a base unit of its capacity.

## 9

Which shard receives a record and therefore the ordering and load distribution relationship.

## 10

No. Ordering is within individual shards.

## 11

A key whose disproportionate traffic overloads one shard or partition while the rest remain underused.

## 12

On-demand lets Kinesis manage capacity automatically. Provisioned requires Northstar to configure shard capacity.

## 13

Dedicated per-shard read throughput for each registered consumer and push-based record delivery.

## 14

For long-term replay, audit, rebuilding derived data, and protection beyond stream retention.

## 15

Managed buffering, transformation, partitioning, and delivery into supported analytical destinations.

## 16

To create efficient destination batches and avoid one destination operation or S3 object per source record.

## 17

It delivers data to destinations and does not expose the same independent checkpointed consumer model as Kinesis or Kafka.

## 18

Deriving destination prefixes from record fields so related streaming data is grouped in S3.

## 19

AWS’s managed Apache Kafka service.

## 20

A topic is a named logical stream. A partition is an ordered portion of that topic.

## 21

One or more consumers that cooperatively divide topic partitions while maintaining one logical processing position.

## 22

When Kafka compatibility, Kafka clients, Kafka Streams, connectors, or existing Kafka semantics are required.

## 23

No. The client still needs DNS, routing, security-group permission, and a reachable broker endpoint.

## 24

Managed infrastructure for stateful continuous Apache Flink applications.

## 25

Its result depends on previously seen records, such as a windowed count or stream join.

## 26

A checkpoint supports automatic failure recovery. A snapshot is a deliberately retained application-state restore point.

## 27

An external system may perform a side effect before Flink records successful checkpoint completion. The side effect must also be transactional or idempotent.

## 28

To preserve an immutable, source-faithful replay and forensic record.

## 29

Records that fail schema, security, parsing, transformation, or delivery validation.

## 30

Standardized data normalizes technical representation. Curated data applies approved business definitions.

## 31

They cause excessive listing, metadata, request, file-open, and task-scheduling overhead.

## 32

It is columnar and compressed, allowing analytical engines to read only relevant columns and fewer bytes.

## 33

To let engines skip irrelevant data locations based on frequently filtered fields.

## 34

It has extremely high cardinality and usually creates one or very few rows per partition.

## 35

Transactional table metadata, snapshots, schema and partition evolution, updates, deletes, and time travel.

## 36

Metadata such as databases, tables, columns, partitions, formats, and data locations.

## 37

No. The bytes remain in S3 or another source.

## 38

It scans a data source, infers schema, and creates or updates Data Catalog metadata.

## 39

Inference can change because of malformed or unexpected source files; a governed schema should be explicitly versioned and tested.

## 40

Which supported source data a recurring job has already processed.

## 41

No. Output cleanup or idempotent replacement must be handled separately.

## 42

Schema Registry governs streaming-message schemas and compatibility. Data Catalog describes queryable datasets and tables.

## 43

Logical access to catalog databases, tables, columns, rows, cells, and registered S3 data.

## 44

No. IAM still controls the ability to invoke Athena, Glue, Lake Formation APIs, workgroups, and related AWS services.

## 45

Lake Formation supplies short-lived, scoped S3 credentials to an integrated engine after evaluating logical data permissions.

## 46

Lake Formation-specific authorization attributes applied to catalog resources.

## 47

Intermittent or ad hoc SQL analysis directly over data stored in S3.

## 48

The amount of data scanned, unless another Athena capacity-pricing model is deliberately used.

## 49

To separate identities, query history, result locations, encryption, metrics, capacity, and data-usage controls.

## 50

Athena queries S3 directly and is strong for ad hoc work. Redshift is a managed analytical warehouse optimized for repeated, curated, concurrent BI workloads.

## 51

For variable large Spark or analytical jobs where Northstar does not want to manage a persistent cluster.

## 52

For long-running, heavily customized, framework-specific, or carefully fleet-optimized analytical environments.

## 53

When the organization deliberately wants EMR analytics jobs scheduled into an existing EKS namespace and accepts Kubernetes as part of the platform.

## 54

Redshift SQL access to structured and semistructured data stored in S3 without loading every row into warehouse-local tables.

## 55

Controlled access to live Redshift data from other clusters or workgroups without manually copying it.

## 56

Full-text search, document retrieval, logs, operational events, and low-latency filtered search.

## 57

Indexes are derived and optimized for search; mappings, retention, or cluster failures may require rebuilding from a durable source.

## 58

Quick Sight’s in-memory analytical engine.

## 59

SPICE imports a snapshot for fast interaction. Direct query executes against the source during dashboard use.

## 60

Correctness depends on source delivery, processing checkpoints, destination commits, retries, and external side-effect semantics together.

---

# 45. What to memorize now

```text
Batch
    → bounded data
    → scheduled result

Streaming
    → unbounded events
    → continuous processing
```

```text
Kinesis Data Streams
    → replayable AWS-native stream
    → shards
    → partition keys
    → multiple consumers
```

```text
Data Firehose
    → buffer
    → transform
    → partition
    → deliver
```

```text
Amazon MSK
    → managed Kafka
    → topics
    → partitions
    → consumer groups
    → offsets
```

```text
Managed Flink
    → state
    → windows
    → joins
    → event time
    → checkpoints
```

```text
S3
    → durable lake storage

Glue Data Catalog
    → metadata

Lake Formation
    → data authorization
```

```text
Glue crawler
    → discover schema

Glue job
    → transform data

Glue bookmark
    → remember processed input

Glue Schema Registry
    → streaming schema contract
```

```text
Athena
    → ad hoc SQL over S3

EMR
    → large distributed processing

Redshift
    → analytical warehouse

OpenSearch
    → search and log analytics

Quick Sight
    → dashboards and BI
```

```text
SPICE
    → imported in-memory data

Direct query
    → query source now
```

```text
JSON
    → easy raw interchange

Parquet
    → efficient analytical scans

Iceberg
    → transactional lake table
```

```text
Partitioning
    → skip irrelevant data

Too many tiny partitions
    → metadata and small-file problem
```

```text
IAM
    → may invoke service

Lake Formation
    → may access logical data

S3/KMS policy
    → storage and cryptographic gates
```

```text
Cross-account access
    ≠
network connectivity
```

```text
Raw data
    +
versioned transformation
    =
reproducible data product
```

```text
Processing success
    ≠
data correctness
```

```text
Exactly once
    → source + processing + sink + side effects
```

---

# 46. What can remain recognition-level

You do not yet need perfect recollection of:

- exact Kinesis shard throughput limits;
- every enhanced fan-out quota;
- Kinesis resharding APIs;
- every Firehose destination;
- Kafka replication-factor tuning;
- Kafka ISR and leader-election internals;
- every Flink window operator;
- watermark configuration syntax;
- Glue DynamicFrame APIs;
- DQDL syntax;
- every Schema Registry compatibility mode;
- Lake Formation cross-account version numbers;
- Lake Formation resource-link APIs;
- Athena capacity-reservation details;
- Iceberg manifest structure;
- EMR release labels;
- Spark executor tuning;
- Redshift distribution and sort-key tuning;
- Redshift workload-management configuration;
- OpenSearch shard mathematics;
- Quick Sight embedded-dashboard APIs.

The durable architecture is:

```text
Business event or batch file
    ↓
appropriate ingestion mechanism
    ↓
immutable raw S3 history
    ↓
catalog and governance
    ↓
versioned transformation
    ↓
purpose-specific serving system
    ↓
approved consumer
```

At every interaction, continue applying Lesson 0:

```text
Authorization:
    Which producer, service role, job role,
    analyst session, or query engine is acting?

    Which IAM policy, resource policy,
    Lake Formation grant, bucket policy,
    endpoint policy, and KMS key policy applies?
```

```text
Networking:
    Is this an AWS managed service endpoint,
    an MSK broker connection,
    a Glue ENI reaching a private database,
    a Redshift client connection,
    or S3 data access?

    Which route, endpoint, protocol, port,
    security group, DNS name, and return path exist?
```

And add the Lesson 11 questions:

```text
Latency:
    When must the result become useful?

Semantics:
    What does this event or metric mean?

Durability:
    Can the result be rebuilt from raw history?

Schema:
    Which changes remain compatible?

Quality:
    Is the data merely fresh,
    or is it also valid, complete, and unique?

Cost:
    How many bytes, objects, partitions,
    workers, shards, nodes, and dashboard queries
    does this design create?
```
