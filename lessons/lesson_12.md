# Lesson 12 — The Factory That Keeps Running When the Internet Disappears

## Industrial IoT, edge computing, device identities, Greengrass, device shadows, fleet updates, and offline operation

After designing a data platform and a disaster-recovery program, we will take a different approach to resilience:

> **Some operations should not fail over to another AWS Region. They should continue locally without contacting AWS at all.**

This is the industrial IoT lesson we discussed earlier.

### Source note

Your uploaded exam overview lists IoT Core, Device Management, Device Defender, Greengrass, IoT Events, and SiteWise among the IoT services to study. It does not provide this complete factory architecture. The Northstar scenario below is illustrative, while the detailed service behavior comes from current AWS documentation. 

We use **AWS IoT Greengrass V2**. A short section near the end separates current service availability from names found in older materials.

---

# 1. The incident

## 1.1 Tuesday, 02:13

Northstar Manufacturing operates 20 factories producing components for its logistics business.

At Factory 07:

```text
A conveyor moves products past inspection cameras.

An edge model identifies visible defects.

A local controller directs defective products
toward a separate inspection lane.

Sensors report temperature, vibration, pressure,
production counts, and machine state.
```

Then a construction crew damages the factory’s Internet connection.

The control room sees:

```text
WAN connection:       DOWN
Production line:      RUNNING
Local inspection:     ACTIVE
Local operator panel: AVAILABLE
Cloud dashboard:      STALE
Telemetry upload:     BUFFERING
```

That is the desired outcome.

The bad architecture would be:

```text
Camera
    → Internet
    → cloud inference endpoint
    → Internet
    → production-line decision
```

A second AWS Region does not solve a severed factory connection.

---

## 1.2 Three things must not be confused

Northstar distinguishes:

| Function | Example | Architectural requirement |
|---|---|---|
| Safety control | Emergency stop and machine interlocks | Dedicated local safety system |
| Operational edge processing | Visual inspection and local anomaly detection | Local compute with tested latency |
| Cloud supervision | Fleet analytics, model distribution, dashboards | Can tolerate temporary disconnection |

For this case, safety engineers retain responsibility for the machine’s safety system. Neither a cloud message nor an ML prediction is allowed to bypass it.

**Greengrass is part of the application platform, not a substitute for a safety controller.**

---

# 2. Requirements

These are hypothetical Northstar requirements, not AWS guarantees.

| Dimension | Requirement |
|---|---|
| Inspection | Local decision within 100 milliseconds at the required percentile |
| Offline operation | Continue approved operations through an eight-hour WAN outage |
| Telemetry | Preserve required measurements through that outage, assuming local storage survives |
| Images | Keep selected images locally; upload only an approved subset |
| Devices | Thousands of individually identifiable cloud-connected devices and gateways |
| Legacy equipment | Integrate machines that cannot run an AWS SDK |
| Commands | Reject expired, unauthorized, or duplicated operations |
| Updates | Stage software and model updates without updating every factory simultaneously |
| Security | No shared fleet-wide production credential |
| Networking | No Internet-initiated connection directly to factory controllers |
| Analytics | Combine industrial measurements with Lesson 11’s data platform |
| Recovery | Reboot and recover locally while the WAN is still unavailable |

The final requirement is particularly important.

```text
Continues running after disconnection
    ≠
can restart successfully while disconnected
```

---

# 3. Baseline architecture

```text
                            FACTORY 07
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ Safety controller / PLC                                                 │
│     Local machine control and safety functions                          │
│                                                                         │
│ Cameras              Industrial controllers         MQTT sensors       │
│    │                    │ OPC UA                         │              │
│    └────────────────────┼────────────────────────────────┘              │
│                         ▼                                               │
│               Industrial gateway / edge computer                        │
│                                                                         │
│               AWS IoT Greengrass V2                                      │
│                                                                         │
│        ┌─────────────────────────────────────────────────────┐          │
│        │ Protocol collectors                                 │          │
│        │ Local MQTT broker, where required                   │          │
│        │ Image preprocessing and inference                   │          │
│        │ Approved configuration and local shadow manager     │          │
│        │ Command validation                                  │          │
│        │ Persistent telemetry spool                          │          │
│        │ Selected-image storage                              │          │
│        │ Upload and reconciliation components                │          │
│        └─────────────────────────────────────────────────────┘          │
│                         │                                               │
│                 Local operator interface                                │
│                         │                                               │
│                  Factory firewall/router                                │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │ outbound TLS connections
                          ▼
                            AWS REGION
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ AWS IoT Core                                                            │
│     device certificates and policies                                    │
│     MQTT message broker                                                 │
│     device shadows                                                      │
│     rules engine                                                        │
│              │                                                          │
│              ├──► industrial measurements → AWS IoT SiteWise             │
│              │                                                          │
│              └──► events → Kinesis → Data Firehose → S3 data lake        │
│                                                                         │
│ Direct bulk uploads ────────────────────────────────► S3                 │
│                                                                         │
│ Greengrass deployments / IoT Jobs                                        │
│     approved components, firmware, and model artifacts                   │
│                                                                         │
│ Device Defender Audit + monitoring + incident workflows                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Greengrass supplies edge-runtime and deployment capabilities. IoT Core supplies cloud device communication. SiteWise supplies industrial data modeling and analysis. These are complementary roles, not competing versions of one service. 

---

# 4. Why not simply use the services we already know?

## 4.1 Why not Lambda in an AWS Region?

A Regional function cannot execute a factory decision when the factory cannot reach the Region.

It remains useful for cloud-side processing after events arrive.

The requirement selects the execution location before it selects the compute service.

---

## 4.2 Why not Lambda@Edge?

CloudFront edge locations are not Northstar’s factory computers.

Moving execution closer to Internet users is different from executing inside an isolated production facility.

For this project, “edge” means:

```text
the gateway physically connected to the equipment
```

—not a CloudFront point of presence.

---

## 4.3 Why not Kubernetes?

Northstar has a small number of coordinated components per gateway, not a requirement for a Kubernetes API or a multi-node orchestration platform.

A Greengrass component can run a native process, a container, or supported Lambda-based code locally. Northstar therefore does not need Kubernetes merely to package and deploy its inference service. 

If a factory later becomes a substantial on-premises compute platform with existing Kubernetes applications, the Kubernetes interlude becomes relevant again.

---

## 4.4 Why not Kinesis as the device front door?

Kinesis is useful after measurements become a stream.

IoT Core addresses a different boundary: device connections, device authentication, publish/subscribe communication, and device-state interaction.

For this architecture:

```text
IoT Core:
    communicate with devices

Kinesis:
    distribute received events to analytical consumers
```

Northstar does not require every small sensor to become a general AWS API client.

---

# 5. Greengrass: the local application platform

## 5.1 Core device

A **Greengrass core device** is a physical or virtual computer running Greengrass Core software.

Examples include:

```text
industrial Linux gateway
factory server
supported edge appliance
```

The **nucleus** is the central Greengrass runtime component. It manages deployments and supports component operation. 

---

## 5.2 Components

A component is a deployable software module.

Northstar defines:

```text
northstar.CameraCollector
northstar.InspectionInference
northstar.TelemetryNormalizer
northstar.CommandValidator
northstar.CloudUploader
```

Each component has a versioned **recipe** describing its configuration, dependencies, artifacts, and lifecycle commands, such as installation and startup. 

A component might contain Python code, an executable, a container image reference, or model files.

---

## 5.3 Deployment

A deployment specifies which component versions and configurations should run on a device or device group.

```text
Factory07-InspectionGateways
    → CameraCollector 2.1
    → InspectionInference 4.3
    → model artifact 42
    → TelemetryNormalizer 1.8
```

Greengrass resolves component dependencies and deploys the required artifacts. Version compatibility must be planned; conflicting component requirements can make a deployment fail. 

---

## 5.4 Local execution is not automatically offline independence

A component can run locally but still depend on:

```text
fetching its model from S3 at startup
retrieving a secret before every inference
calling a cloud feature service
downloading a Python package after reboot
```

Northstar’s offline contract therefore requires all essential code, models, configuration, and local credentials to be available before disconnection.

This is an application-design obligation, not something a checkbox can infer.

---

# 6. Local inference

## 6.1 Training and inference belong in different places

Northstar’s design is:

```text
Cloud:
    assemble training data
    train candidate model
    evaluate and approve it
    publish immutable artifacts

Factory:
    load approved model
    run inference on local images
    record prediction and model version
    upload selected evidence later
```

This does not require retraining at every factory.

---

## 6.2 Record the complete prediction context

An inspection record includes:

```text
product_id
camera_id
capture_timestamp
model_version
preprocessing_version
configuration_version
prediction
decision
gateway_id
```

Otherwise, a future investigator may know that a product was rejected without knowing which model or configuration produced the result.

---

## 6.3 Retain a useful image sample

Northstar uploads:

```text
defect examples
uncertain examples
a sample of accepted products
```

Uploading only rejected products would make future evaluation blind to errors among accepted products.

The upload policy is separate from the local decision path. A slow upload must not delay the next inspection.

---

## 6.4 Latency must be measured end to end

The 100-millisecond target includes:

\[
T_{\text{decision}}
=
T_{\text{capture}}
+
T_{\text{preprocess}}
+
T_{\text{inference}}
+
T_{\text{postprocess}}
+
T_{\text{local handoff}}
\]

A model benchmark of 20 milliseconds does not prove a 20-millisecond production decision.

---

# 7. MQTT: device messaging

## 7.1 Broker and topics

MQTT uses a publish/subscribe model.

```text
Publisher
    → message broker
    → interested subscribers
```

An application publishes to a topic such as:

```text
northstar/factory-07/gateway-03/telemetry
```

Another application subscribes to a relevant topic filter.

IoT Core supports MQTT, MQTT over secure WebSockets, and HTTPS publishing. 

---

## 7.2 Northstar’s topic contract

```text
.../telemetry
    measurements sent by gateway

.../status
    operational state sent by gateway

.../commands
    approved commands sent to gateway

.../command-results
    device-reported execution outcomes
```

Topic names are part of the authorization boundary.

The device must not receive permission to publish to another factory’s namespace merely because it knows the name.

---

## 7.3 Quality of service

AWS IoT Core supports:

| MQTT level | Meaning |
|---|---|
| QoS 0 | At-most-once delivery |
| QoS 1 | At-least-once delivery; duplicates are possible |

It does not support MQTT QoS 2. 

Northstar uses QoS 1 for important device events, but still makes consumers idempotent.

**A broker acknowledgement is not evidence that a downstream database committed the event or a machine executed a command.**

---

## 7.4 Persistent sessions are not the factory’s disk buffer

Persistent MQTT sessions can preserve subscriptions and eligible queued messages for a disconnected client, subject to configured limits and expiry.

They cannot receive measurements that never left an offline factory.

```text
Cloud-side session:
    messages awaiting a disconnected subscriber

Local spool:
    measurements produced while cloud is unreachable
```

Both may be useful. They solve opposite sides of the disconnection. 

---

# 8. Device identity: thing, certificate, and policy

## 8.1 Thing

An IoT **thing** is a registry representation.

```text
Thing name:
    factory-07-gateway-03

Attributes:
    factory = 07
    hardware_family = gateway-v2
    owner = manufacturing
```

It is not an EC2 instance, an IAM user, or a credential.

---

## 8.2 X.509 certificate

The gateway authenticates using an X.509 client certificate and its corresponding private key.

The certificate must be registered and active for the intended IoT connection. Northstar provisions a unique operational identity for each cloud-connected gateway or device. 

During mutual TLS:

```text
Gateway verifies:
    Am I connecting to the expected AWS service?

AWS verifies:
    Does the client possess the private key
    corresponding to an accepted certificate?
```

---

## 8.3 One production certificate for the whole fleet is dangerous

If every gateway shares one private key:

```text
one gateway is compromised
    ↓
attacker impersonates the fleet
    ↓
revoking that certificate disconnects the fleet
```

Unique credentials allow scoped revocation and investigation. AWS’s IoT security guidance emphasizes device-specific credentials and least-privilege policies. 

Protect private keys with appropriate device storage, permissions, and hardware-backed protection where justified.

---

## 8.4 Legacy equipment has a different trust boundary

An old controller may expose OPC UA but have no AWS certificate.

The gateway authenticates to AWS and forwards its measurements.

Therefore:

```text
AWS authenticated gateway-03.

It did not independently authenticate
every physical sensor behind gateway-03.
```

Northstar constrains which equipment identifiers each gateway may report and protects the local collection path.

---

# 9. IoT policies: four permissions worth remembering

For certificate-authenticated MQTT, an **AWS IoT policy** controls the device’s allowed actions.

| Action | What it permits | Resource family |
|---|---|---|
| `iot:Connect` | Connect with an approved client ID | `client/...` |
| `iot:Publish` | Send a message | `topic/...` |
| `iot:Subscribe` | Register a subscription | `topicfilter/...` |
| `iot:Receive` | Receive delivered messages | `topic/...` |

Subscription permission and receipt permission are evaluated separately. 

---

## 9.1 Gateway policy

Northstar grants gateway 03:

```text
Connect:
    only as factory-07-gateway-03

Publish:
    its telemetry, status, and command results

Subscribe and receive:
    its approved command topics
```

It cannot:

```text
publish another gateway’s measurements
subscribe to all factory commands
create certificates
alter IoT policies
administer AWS resources
```

---

## 9.2 Bind the name to the authenticated device

A caller-selected client ID is not proof of identity.

Policies using thing variables must establish the proper relationship between the certificate, registered thing, and connection identity. AWS provides variables such as:

```text
iot:Connection.Thing.ThingName
iot:Connection.Thing.IsAttached
```

to help enforce that binding. 

Do not let a device gain another device’s permissions merely by changing the client ID it sends.

---

## 9.3 Three authorization systems now coexist

```text
IoT policy:
    certificate-authenticated device messaging

IAM policy:
    AWS service APIs and administrative actions

Greengrass/local OS policy:
    what a local component may access or invoke
```

Greengrass components can use its interprocess communication interface, while their operating-system identity also determines local permissions. 

A cloud policy does not automatically prevent a compromised root process from reading local files.

---

# 10. How a gateway accesses S3 without permanent AWS keys

## 10.1 Certificate authentication is not ordinary S3 authentication

The gateway’s IoT certificate does not directly become an S3 access key.

For direct AWS API calls, the gateway can use the **AWS IoT credentials provider**.

```text
Device certificate
    ↓
IoT credentials provider
    ↓ permitted role alias
IAM role
    ↓ STS temporary credentials
Signed S3 request
```

The IoT policy needs `iot:AssumeRoleWithCertificate` for the approved role alias. The IAM role trusts `credentials.iot.amazonaws.com`. Its IAM policy determines which AWS operations the resulting session may perform. 

---

## 10.2 Greengrass token exchange service

Greengrass’s token exchange service makes those temporary credentials available to components using supported AWS SDK credential discovery. 

Northstar’s gateway role permits:

```text
Read:
    approved model and component artifacts

Write:
    Factory 07’s approved image-upload prefix

Publish:
    selected operational metrics
```

It does not permit lake administration or arbitrary secret access.

---

## 10.3 Do not invent per-component IAM isolation

The token exchange role is a core-device role.

Do not assume that every component automatically receives a separate IAM role like separate ECS tasks.

Northstar treats components sharing a gateway and its credentials as belonging to a deliberate trust boundary. Stronger isolation may require separate hosts or an additional credential-isolation design. 

---

# 11. Cloud routing after telemetry arrives

## 11.1 Rules engine

An IoT rule selects messages and performs an action.

Conceptually:

```sql
SELECT *
FROM 'northstar/+/+/telemetry'
```

Northstar routes selected measurements to SiteWise and selected events into Lesson 11’s streaming pipeline.

The IoT rules engine provides message filtering and service integrations; it is not a replacement for a stateful Flink application. 

---

## 11.2 The rule has its own AWS authority

For a Kinesis destination:

```text
Gateway certificate
    ↓ IoT policy
MQTT publish accepted

IoT rule
    ↓ assumes rule IAM role
kinesis:PutRecord
    ↓
approved stream
```

The gateway does not need Kinesis permissions merely because an IoT rule sends its messages there.

AWS IoT assumes the rule’s configured IAM role to access the destination. 

---

## 11.3 Separate acknowledgement boundaries

Northstar distinguishes:

```text
Produced locally
Persisted locally
Accepted by IoT broker
Processed by rule
Committed to analytical storage
```

Those are not the same event.

For telemetry requiring end-to-end completeness, Northstar retains batch identities and verifies downstream commitment before declaring the batch delivered. The broker acknowledgement alone is insufficient.

---

# 12. Device shadows: desired state versus reported state

## 12.1 Purpose

A device shadow stores a JSON representation of desired and reported device state.

```json
{
  "state": {
    "desired": {
      "samplingIntervalSeconds": 10
    },
    "reported": {
      "samplingIntervalSeconds": 60
    }
  }
}
```

This means:

```text
Cloud wants:
    sample every 10 seconds

Device last reported:
    sampling every 60 seconds
```

IoT Core calculates the difference, or **delta**, between desired and reported state. 

---

## 12.2 What a shadow does not prove

The desired value does not prove the device applied it.

The reported value describes what the device reported—not an independent physical measurement proving current reality.

A dashboard must include:

```text
reported state
report timestamp
connection status
pending desired changes
```

A factory disconnected eight hours ago must not look healthy merely because its last reported status was `RUNNING`.

---

## 12.3 Offline reconciliation

While the gateway is offline:

```text
Cloud changes desired sampling interval.
Device continues its last approved local configuration.
```

After reconnection:

```text
device reads current desired state
    ↓
validates whether it may apply it
    ↓
applies configuration
    ↓
updates reported state
```

Shadows preserve state across device disconnection, but application code performs the actual change. 

---

## 12.4 Local shadows

Greengrass’s shadow manager can manage local shadows and synchronize selected shadows with IoT Core.

Synchronization is not enabled for every shadow automatically; it must be configured. 

Northstar defines which fields the cloud owns and which the device owns rather than letting two writers repeatedly overwrite each other.

---

# 13. State, commands, and jobs are different

| Need | Best conceptual model |
|---|---|
| “Sampling should be every 10 seconds” | Device shadow |
| “Capture a diagnostic bundle now” | Command with execution result |
| “Install firmware 3.8 across 500 devices” | IoT Jobs |
| “Deploy these application components to gateways” | Greengrass deployment |

IoT Jobs manages job documents and per-device execution status. Greengrass deployments manage component versions and configuration. 

---

## 13.1 Why a shadow is not a command queue

Suppose three desired-state updates occur while the gateway is offline:

```text
sampling interval = 30
sampling interval = 15
sampling interval = 10
```

On reconnect, the current desired value of 10 may be sufficient.

But these are different:

```text
perform calibration A
perform calibration B
capture diagnostic bundle C
```

They are separate operations whose execution histories matter.

Do not encode a business command log as one repeatedly overwritten state field.

---

## 13.2 Safe command envelope

Northstar’s commands include:

```json
{
  "commandId": "CMD-981",
  "deviceId": "factory-07-gateway-03",
  "action": "captureDiagnosticBundle",
  "expiresAt": "2026-09-06T15:10:00Z",
  "expectedConfigurationVersion": 18
}
```

The local handler checks:

```text
correct device
allowed action
not expired
compatible current state
not already completed
```

These are application requirements, not automatic MQTT properties.

---

## 13.3 Physical exactly-once execution is harder

Consider:

```text
Device performs action.
Device crashes before saving completion.
Command is delivered again.
```

A unique command ID helps, but does not magically make a physical action transactional with local storage.

For consequential operations, Northstar needs state inspection, operation-specific idempotency, or human reconciliation when the result is uncertain.

This is Lesson 17’s split-brain problem translated into physical equipment: **never confuse message delivery with authoritative execution.**

---

# 14. Offline storage: calculate it

## 14.1 Telemetry buffer

For one gateway, assume:

```text
200 measurements/second
200 stored bytes/measurement
8 hours offline
```

Required payload storage:

\[
200 \times 200 \times 8 \times 3600
=
1{,}152{,}000{,}000\text{ bytes}
\]

Approximately **1.15 GB**, before indexes, metadata, retries, and filesystem overhead.

With a two-times planning allowance:

```text
approximately 2.3 GB
```

That is manageable.

---

## 14.2 Images change the problem

Assume one inspection workload produces:

```text
10 images/second
2 MB/image
8 hours
```

Then:

\[
10 \times 2\text{ MB} \times 28{,}800
=
576\text{ GB}
\]

The policy cannot simply be:

> Buffer everything until the Internet returns.

Northstar defines separate retention priorities for measurements, defect images, accepted-image samples, and disposable intermediate files.

---

## 14.3 Explicit storage behavior

Greengrass offers different buffering mechanisms.

**Stream Manager** supports local streams and export to destinations such as S3, Kinesis, and SiteWise.

**MQTT spooling** is separate. The nucleus’s documented default storage type is memory; disk-backed spooling requires the appropriate configuration and component. 

Therefore:

```text
Greengrass installed
    ≠
all outgoing data persists through reboot
```

---

## 14.4 A local spool is not S3

Northstar must protect the local disk against:

```text
power loss
filesystem corruption
disk failure
disk exhaustion
unauthorized reading
unexpected cleanup
```

Stream Manager does not automatically encrypt all local stream data. Local disk encryption and host security remain Northstar’s responsibility. 

An eight-hour **WAN-outage** requirement does not automatically promise zero loss after simultaneous gateway destruction.

---

# 15. Reconnection can be its own incident

## 15.1 Backlog drain time

After eight hours, connectivity returns.

New telemetry continues arriving at rate \(R\). Upload capacity is \(U\). Backlog is \(B\).

When \(U>R\):

\[
T_{\text{drain}}=\frac{B}{U-R}
\]

Using the earlier example:

```text
Backlog:       1.152 GB
New input:     40 KB/s
Upload rate:   200 KB/s
Net drain:     160 KB/s
```

The backlog takes approximately **two hours** to clear.

If \(U \le R\), it never clears under that sustained load.

---

## 15.2 Do not replay old alarms as current emergencies

Each record includes:

```text
device_id
boot_id
sequence_number
observed_at
ingested_at
```

Northstar uses event time for historical measurements and separate logic for current operational alerts.

An overheating measurement from six hours ago may matter for maintenance analysis. It is not proof that the machine is overheating now.

---

## 15.3 Do not let backlog overwrite fresh state

A “latest value” table must not blindly overwrite on arrival order.

```text
Fresh reading arrives.
Older buffered reading arrives afterward.
```

The update condition should compare an appropriate source version or timestamp.

The event remains valid historical data; it should not become the current state.

---

## 15.4 Reconnect gradually

Northstar’s recovery order is:

```text
restore authenticated connection
    ↓
reconcile current configuration and pending commands
    ↓
publish current health
    ↓
send urgent events
    ↓
drain historical telemetry
    ↓
upload selected images at lower priority
```

Retries use backoff and jitter so thousands of devices do not reconnect and download a new model simultaneously.

---

# 16. Rebooting while offline

Northstar’s acceptance test is not merely “pull the WAN cable.”

It is:

```text
Disconnect WAN.
Reboot gateway.
Restart local clients.
Continue inspection.
Generate telemetry.
Fill part of the buffer.
Restore WAN.
Reconcile everything.
```

The gateway must find its installed components, models, and configuration locally. Local Greengrass deployments can use local artifacts, but missing dependencies cannot be downloaded from an unreachable cloud. 

---

## 16.1 Local MQTT authentication needs preparation

For Greengrass client-device offline authentication, initial device validation occurs while the core is connected. The core caches the information needed for later offline validation.

A brand-new, never-seen device should not be assumed to onboard during a complete outage. 

---

## 16.2 Temporary AWS credentials expire

Cached temporary AWS credentials are not an offline substitute for AWS.

When disconnected, the gateway may be unable to refresh credentials or call S3 anyway.

The critical local processing path must not require a fresh token exchange to classify the next image.

---

# 17. AWS IoT SiteWise: give measurements industrial meaning

## 17.1 Why not just store every number in S3?

This measurement is technically valid:

```text
sensor-928 = 71.4
```

It becomes useful when Northstar knows:

```text
Factory 07
    → Packaging line 2
    → Conveyor motor 4
    → Bearing temperature
    → degrees Celsius
```

SiteWise provides industrial asset modeling, data collection, storage, transforms, and metrics. 

---

## 17.2 Asset model versus asset

```text
Asset model:
    definition of a conveyor motor

Asset:
    the particular motor on Factory 07, Line 2
```

The hierarchy can represent factory → line → machine.

Properties include:

| Property type | Example |
|---|---|
| Attribute | Manufacturer or rated power |
| Measurement | Temperature or vibration |
| Transform | Unit conversion |
| Metric | Average utilization over a period |

SiteWise distinguishes per-input transforms from interval-based metrics and supports relationships among modeled assets. 

---

## 17.3 OPC UA and SiteWise Edge

OPC UA is a common industrial interface for equipment data.

A SiteWise Edge gateway can collect from local OPC UA servers and send industrial measurements to SiteWise. It integrates with Greengrass V2. 

Northstar can therefore support both:

```text
Modern device:
    MQTT → IoT Core → SiteWise rule action

Legacy controller:
    OPC UA → SiteWise Edge → SiteWise
```

The second path does not require rewriting the controller to speak MQTT.

---

## 17.4 SiteWise is not the whole company data platform

SiteWise organizes industrial operations.

Lesson 11’s S3, Glue, Lake Formation, Athena, and warehouse architecture combines that information with:

```text
orders
maintenance costs
staffing
supplier quality
delivery performance
```

Northstar publishes selected industrial data products into Insight Hub rather than forcing all corporate analytics into the equipment model.

---

# 18. Provisioning and updating the fleet

## 18.1 Provisioning options

Two important patterns are:

**Device already has a trusted manufacturing certificate:** just-in-time provisioning can create the required IoT resources when the device first connects, according to a provisioning template.

**Device lacks its unique operational certificate:** fleet provisioning can bootstrap the device and issue its operational identity. 

---

## 18.2 Bootstrap credential is not a production fleet identity

Fleet provisioning by claim can use a restricted claim credential during enrollment.

Northstar restricts it to provisioning operations and validates whether the device is entitled to enroll. The resulting device receives its own operational certificate.

A shared bootstrap credential must not become:

```text
one unrestricted certificate used forever by every gateway
``` 


---

## 18.3 Controlled rollouts

Northstar uses rollout rings:

```text
Lab
    → one test line
    → one production factory
    → selected factories
    → fleet
```

IoT Jobs supports rollout rates, scheduling, abort conditions, retries, and execution timeouts. 

But a job document does not install firmware by itself. Device-side software must understand and execute it.

---

## 18.4 Abort is not rollback

Stopping a deployment prevents more devices from receiving it.

It does not necessarily restore devices already updated.

Northstar explicitly provides:

```text
previous approved artifact
local health check
compatible rollback configuration
recovery boot path where required
```

For Greengrass deployments, component dependencies must be pinned and tested; otherwise a new deployment can select a newer compatible dependency unexpectedly. 

---

# 19. Networking: from factory to cloud

## 19.1 Ordinary public-endpoint path

```text
Gateway
    ↓ factory LAN
Factory firewall/router
    ↓ outbound TCP
Internet
    ↓
IoT Core account-specific endpoint
    ↓ TLS authentication
MQTT connection
```

MQTT with client certificates commonly uses port 8883. Supported port-443 configurations require the appropriate protocol and authentication settings; “open 443” is not a complete MQTT configuration. 

---

## 19.2 Receiving commands does not require inbound Internet access

The gateway initiates the MQTT connection.

The broker sends subscribed messages over that established connection.

```text
Cloud command
    → existing authenticated connection
    → gateway
```

Northstar does not open an Internet-facing port on the machine controller.

---

## 19.3 AWS security groups do not protect the factory LAN automatically

An on-premises gateway is not an EC2 ENI.

Local protection comes from:

```text
factory firewalls
network segmentation
host firewall
local authentication
operating-system permissions
industrial protocol controls
```

AWS security groups become relevant when the path reaches resources such as VPC interface endpoints.

---

## 19.4 Private connectivity variant

A factory with VPN or Direct Connect can reach IoT Core through supported interface VPC endpoints.

```text
Factory
    → VPN/DX
    → VPC routing
    → endpoint ENI
    → IoT Core
```

Current IoT Core documentation requires manually configured private DNS for its data-plane and credentials-provider endpoints. These endpoint types do not support ordinary VPC endpoint policies; use supported IoT-policy conditions and other network controls instead. 

This is a useful reminder from Lesson 7:

> Do not assume every PrivateLink service has identical DNS and policy behavior.

---

## 19.5 Other dependencies have separate paths

The gateway may also need:

```text
IoT credentials provider
S3 model and component artifacts
Greengrass APIs
CloudWatch
time synchronization
approved package repositories
```

A successful MQTT connection does not prove all these paths work. Greengrass’s documented network requirements include separate IoT data, credentials, and S3 connectivity. 

---

# 20. End-to-end identity trace

Consider a temperature measurement sent through a gateway and an IoT rule.

```text
1. Local collector reads an approved industrial data source.

2. Gateway publishes using its X.509 certificate.

3. IoT Core authenticates the gateway.

4. IoT policy authorizes the client ID and telemetry topic.

5. A matching IoT rule executes.

6. AWS IoT assumes the rule's IAM role.

7. The role writes the approved destination.

8. Storage and KMS permissions are evaluated where required.
```

Now consider uploading a defect image directly:

```text
1. Gateway authenticates to the IoT credentials provider.

2. IoT policy permits the approved role alias.

3. Credentials provider assumes the token-exchange IAM role.

4. Gateway receives temporary AWS credentials.

5. Uploader signs an S3 request.

6. IAM, bucket policy, and KMS permissions govern the upload.
```

These are two different ways to move data to AWS. The first delegates cloud delivery to a rule; the second gives the gateway scoped temporary API credentials. 

---

# 21. Device security and current service availability

## 21.1 Device Defender Audit

Northstar uses Device Defender Audit to inspect fleet security configuration, including certificate and policy concerns.

Examples include:

```text
overly permissive policies
expiring certificates
problematic identity configuration
```

Audit identifies security configuration problems; it is not a replacement for local host hardening or factory network segmentation. 

---

## 21.2 Availability changes as of September 6, 2026

| Service or feature | Current distinction |
|---|---|
| **AWS IoT Events** | Reached end of support on May 20, 2026. Do not select it for this new implementation. |
| **Device Defender Detect** | Closed to new customers from August 31, 2026; existing customers can continue. Audit remains available. |
| **Timestream for LiveAnalytics** | Closed to new customers from June 20, 2025; existing eligible customers can continue. |

These are explicit AWS lifecycle changes, not reasons to discard the underlying concepts. 

For Northstar’s new deployment:

```text
Local operational detection:
    tested Greengrass application logic

Cloud streaming detection:
    appropriate processing from Lesson 11

Fleet configuration security:
    Device Defender Audit

Device-behavior monitoring:
    IoT metrics/logs and an approved monitoring pipeline

Industrial history:
    SiteWise and the S3 data platform
```

Timestream for InfluxDB is a separate managed time-series option, not simply a rename of LiveAnalytics. 

---

## 21.3 Offline revocation is not instantaneous

If a local gateway is isolated from AWS, it cannot immediately learn that a cloud administrator revoked a client.

Northstar therefore defines:

```text
maximum offline trust period
local credential validity
cached authorization policy
local emergency isolation procedure
reconciliation on reconnect
```

Availability during isolation and instantaneous centralized revocation cannot both be assumed without an independent communication path.

---

# 22. Why not Outposts?

Outposts is appropriate when Northstar needs AWS infrastructure and supported AWS services physically on premises.

Greengrass is appropriate when Northstar needs software deployment and local processing on its own supported edge computers.

During an Outposts service-link interruption, existing instances can continue local operation, but Regional dependencies and control-plane operations can be unavailable. Outposts is not an automatically autonomous disconnected Region. 

For this fleet:

```text
Small industrial gateways
Local collectors and inference
Limited hardware footprint
No EC2 service-API requirement
```

Greengrass is the more direct choice.

For a large factory data center requiring AWS-managed hardware and EC2-oriented infrastructure, revisit Outposts.

---

# 23. Operations and acceptance tests

## 23.1 Monitor freshness, not just values

The fleet dashboard displays:

```text
last contact
last measurement time
cloud ingestion delay
buffer utilization
current component versions
current model version
desired versus reported configuration
certificate expiry
failed command count
```

A green temperature value from yesterday is not a current healthy measurement.

IoT Core publishes CloudWatch metrics for authentication, messaging, rules, shadows, jobs, provisioning, and credential-provider activity. 

---

## 23.2 Test the failure classes separately

| Test | What it validates |
|---|---|
| Disconnect WAN for eight hours | Local autonomy and buffer capacity |
| Reboot gateway during outage | Offline startup |
| Restart previously enrolled sensor | Offline authentication |
| Introduce a new sensor while offline | Honest handling of provisioning limits |
| Fill the disk | Defined priority and backpressure behavior |
| Deliver command twice | Idempotency |
| Deliver command after expiry | Stale-command rejection |
| Restore all factory links together | Reconnect and backlog control |
| Deploy bad component version | Rollout abort and recovery |
| Revoke one certificate | Scoped containment |
| Corrupt a model artifact | Integrity validation |
| Fail the gateway hardware | Separate local redundancy/replacement plan |

Passing the WAN test does not prove the gateway-failure test passes.

---

## 23.3 Cost follows the data-reduction decision

The largest savings may come before any AWS service receives a byte:

```text
Local image
    → inference
    → small result
    → selected evidence image
```

Compare this with uploading every frame.

Other costs include edge hardware, storage replacement, connectivity, IoT messaging, shadows, jobs, SiteWise ingestion, telemetry processing, and fleet operations.

For this project, operational simplicity means **one well-defined fleet process**, not pretending physical hardware requires no maintenance.

---

# 24. Failure drills

### A. The gateway is a registered thing but cannot connect

Registry membership is not sufficient. Check the certificate, private key, certificate state, endpoint, TLS setup, client ID, and IoT policy.

### B. The gateway connects but receives no commands

Check `Subscribe` and `Receive` separately, the topic filter, publisher destination, and whether the device is actually subscribed.

### C. Two gateways disconnect each other repeatedly

They may be using the same MQTT client ID. IoT Core does not keep two simultaneous clients connected under the same client ID. 

### D. MQTT works but S3 uploads return `AccessDenied`

Investigate the token-exchange role, role alias, `AssumeRoleWithCertificate`, S3 prefix, bucket policy, and KMS—not only the telemetry IoT policy.

### E. The shadow shows the new configuration, but the machine still uses the old one

Determine whether you are looking at desired or reported state. Inspect the device’s reconciliation and acknowledgement.

### F. The factory works offline until the gateway reboots

A component may depend on downloading an artifact, renewing a credential, discovering a device, or reading cloud-only configuration at startup.

### G. Telemetry disappears after reboot

The queue may have been memory-backed, or the application acknowledged work before durable local persistence.

### H. Old telemetry generates hundreds of “current” alarms after reconnect

The consumer used arrival time rather than the measurement’s event time or lacked separate historical-replay handling.

### I. The fleet reconnects, but backlog never shrinks

Sustained upload throughput is no greater than new input, or a downstream quota limits the effective drain rate.

### J. The rollout was aborted, but updated devices remain broken

Abort stopped further rollout. It did not implement rollback for devices that had already changed.

### K. The cloud dashboard says the line is running during a WAN outage

It is displaying a last-known value without an age or connectivity indicator.

### L. A second AWS Region does not restore factory access

The failed component is the factory WAN path. Regional redundancy does not repair the last-mile connection.

---

# 25. SAP-C02 decision boundaries

| Requirement clue | Strong candidate or conclusion |
|---|---|
| Authenticate and communicate with many devices | IoT Core |
| Run application logic locally during cloud disconnection | Greengrass |
| Preserve desired and reported device configuration | Device Shadow |
| Distribute tracked firmware or maintenance operations | IoT Jobs |
| Deploy versioned application modules to gateways | Greengrass deployments |
| Model factories, equipment, measurements, and metrics | SiteWise |
| Collect OPC UA industrial data at the edge | SiteWise Edge |
| Audit fleet certificates and policies | Device Defender Audit |
| Obtain temporary AWS credentials using a device certificate | IoT credentials provider and role alias |
| Several analytical consumers need replay | Kinesis or MSK after ingestion |
| Upload large images and model artifacts | S3 path rather than oversized MQTT messages |
| Need AWS-managed infrastructure on premises | Consider Outposts |
| Need only local components on small gateways | Greengrass is usually more direct |
| “QoS 1 therefore execute exactly once” | Incorrect inference |
| “Cloud shadow therefore device has applied it” | Incorrect inference |
| “Local runtime therefore no cloud dependencies” | Must be tested |

The lesson’s selection pattern is:

```text
Device connectivity:
    IoT Core

Local execution:
    Greengrass

Industrial meaning:
    SiteWise

Fleet operation:
    provisioning + deployments/jobs + monitoring
```

---

# 26. Retrieval practice

Answer these before reading the key.

1. Why would a second AWS Region not solve the factory outage?
2. What must remain separate from the ML inspection application?
3. What is a Greengrass core device?
4. What does a component recipe describe?
5. Why might local inference still fail after an offline reboot?
6. What is the difference between an IoT thing and a certificate?
7. Why should gateways have unique operational credentials?
8. What is the difference between `Subscribe` and `Receive`?
9. Which policy authorizes certificate-based MQTT?
10. How does the gateway obtain credentials for direct S3 access?
11. Does every Greengrass component automatically have a separate IAM role?
12. What do desired, reported, and delta mean?
13. Why is a shadow not a command queue?
14. Why does QoS 1 require idempotent processing?
15. Where must measurements be stored while the factory is offline?
16. Why might the backlog never drain?
17. Why can old buffered readings corrupt a “latest state” table?
18. What is the difference between a SiteWise asset model and asset?
19. What does stopping a rollout fail to guarantee?
20. Why is Outposts not automatically an autonomous disconnected Region?

## Answer key

| # | Answer |
|---:|---|
| 1 | The factory cannot reach either Region through its failed connection. |
| 2 | Dedicated local safety controls and interlocks. |
| 3 | A supported edge computer running Greengrass Core software. |
| 4 | Component version, dependencies, artifacts, configuration, and lifecycle commands. |
| 5 | Startup may still require cloud downloads, secrets, discovery, or authentication. |
| 6 | The thing is registry metadata; the certificate and private key support device authentication. |
| 7 | To isolate compromise, revoke one device, and attribute activity. |
| 8 | Subscribe authorizes registration of a topic filter; Receive authorizes delivery of matching messages. |
| 9 | The AWS IoT policy associated with the authenticated device identity. |
| 10 | Its certificate authenticates to the IoT credentials provider, which assumes an approved IAM role and returns temporary credentials. |
| 11 | No. The core’s token-exchange role is a shared trust consideration. |
| 12 | Desired is the requested state; reported is the device’s last report; delta identifies differences. |
| 13 | It represents current state, not an ordered history of independently executable operations. |
| 14 | Messages can be delivered more than once. |
| 15 | In explicitly configured persistent local storage. Cloud buffering cannot receive unsent data. |
| 16 | Upload capacity may be less than or equal to continuing input. |
| 17 | Arrival order can differ from source order; a late old value must not overwrite a newer one. |
| 18 | The model defines an equipment type; the asset represents a particular instance or modeled resource. |
| 19 | That devices already updated have returned to their previous working version. |
| 20 | Existing local workloads may continue, but Regional dependencies and control-plane operations can fail during service-link loss. |

---

# 27. What to memorize now

```text
Thing
    → device registry representation

Certificate + private key
    → device authentication

IoT policy
    → permitted device messaging

IAM role
    → AWS API authority
```

```text
Connect
    → connect as an approved client

Publish
    → send to a topic

Subscribe
    → register interest in a topic filter

Receive
    → receive a delivered message
```

```text
Greengrass
    → local application execution

IoT Core
    → cloud device communication

SiteWise
    → industrial asset data and metrics
```

```text
Shadow
    → desired versus reported state

Command
    → one operation with an outcome

Job
    → tracked fleet operation

Deployment
    → component versions and configuration
```

```text
Cloud persistent session
    ≠
local telemetry spool

MQTT acknowledgement
    ≠
downstream durable commit
    ≠
physical action completed
```

```text
Offline operation requires:
    local code
    local model
    local configuration
    local authentication
    local storage
    local recovery procedure
```

The most important connection to the earlier lessons is this:

**Lesson 11** taught us how to process data once AWS receives it.

**Lesson 17** taught us how to recover when a Region fails.

**Lesson 12** asks what must remain possible when the physical site cannot reach the cloud at all.

The architectural question is no longer only:

> “How highly available is the cloud service?”

It is:

> **“Which decisions must the factory remain able to make without that service?”**