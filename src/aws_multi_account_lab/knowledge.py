from __future__ import annotations

from aws_multi_account_lab.models import SourceRef


LANDING_ZONE = SourceRef(
    "Landing-zone account separation",
    "42–43",
)
ORGANIZATIONS = SourceRef(
    "AWS Organizations, accounts, and OUs",
    "43",
)
CROSS_ACCOUNT_ROLES = SourceRef(
    "Cross-account IAM roles",
    "44–45",
)
SCP = SourceRef(
    "AWS Organizations service control policies",
    "45–46",
)
DIRECTORY_AND_FEDERATION = SourceRef(
    "Directory sharing and federation",
    "46–47",
)
S3_CROSS_ACCOUNT = SourceRef(
    "S3 Requester Pays and bucket policies",
    "48",
)
STACKSETS = SourceRef(
    "CloudFormation StackSets",
    "49",
)
SERVICE_CATALOG = SourceRef(
    "AWS Service Catalog",
    "50–51",
)
PROVISIONING_COMPARISON = SourceRef(
    "StackSets versus Service Catalog",
    "51",
)
VPC_PEERING = SourceRef(
    "VPC peering",
    "52–53",
)
TRANSIT_CONNECTIVITY = SourceRef(
    "Transit VPC and Transit Gateway",
    "53–54",
)
HYBRID_CONNECTIVITY = SourceRef(
    "VPN and Direct Connect patterns",
    "54–55",
)
DNS = SourceRef(
    "DHCP options and VPC DNS attributes",
    "56–58",
)
