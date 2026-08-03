from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Literal


class Severity(StrEnum):
    PASS = "pass"
    INFO = "info"
    WARNING = "warning"
    FAIL = "fail"


@dataclass(frozen=True, slots=True)
class SourceRef:
    topic: str
    guide_pages: str

    @property
    def label(self) -> str:
        return f"{self.topic} — guide pp. {self.guide_pages}"


@dataclass(frozen=True, slots=True)
class Finding:
    code: str
    severity: Severity
    title: str
    detail: str
    source: SourceRef
    remedy: str | None = None


ScpStrategy = Literal["none", "denylist", "allowlist"]
ScpScope = Literal["root", "ou", "account"]
IdentityStrategy = Literal[
    "local_iam",
    "cross_account_roles",
    "identity_center",
    "saml_oidc_federation",
]
DirectorySharingMode = Literal["none", "organization", "external_account"]


@dataclass(frozen=True, slots=True)
class OrganizationScenario:
    account_count: int = 8
    separate_lifecycle_environments: bool = True
    central_logging_required: bool = True
    central_security_required: bool = True
    central_admin_required: bool = True
    cross_account_human_access: bool = True
    external_identity_provider: bool = False
    shared_managed_directory: bool = False
    directory_same_region: bool = True
    partner_s3_access: bool = False
    partner_should_pay_request_costs: bool = False


@dataclass(frozen=True, slots=True)
class OrganizationDesign:
    use_organizations: bool = True
    all_features_enabled: bool = True
    separate_environment_accounts: bool = True
    logging_account: bool = True
    security_account: bool = True
    admin_shared_services_account: bool = True
    scp_strategy: ScpStrategy = "denylist"
    scp_scope: ScpScope = "ou"
    identity_strategy: IdentityStrategy = "identity_center"
    directory_sharing_mode: DirectorySharingMode = "none"
    directory_in_management_account: bool = False
    external_directory_handshake: bool = False
    directory_network_connected: bool = False
    s3_bucket_policy: bool = False
    requester_pays: bool = False


ProvisioningPattern = Literal[
    "none",
    "stacksets",
    "service_catalog",
    "both",
]
StackSetPermissionMode = Literal["service_managed", "self_managed"]


@dataclass(frozen=True, slots=True)
class ProvisioningScenario:
    target_accounts_in_organization: bool = True
    target_multiple_accounts: bool = True
    target_multiple_regions: bool = True
    identical_baseline_required: bool = True
    end_user_self_service_required: bool = False
    end_user_parameters_required: bool = False
    post_provision_changes_unacceptable: bool = False


@dataclass(frozen=True, slots=True)
class ProvisioningDesign:
    pattern: ProvisioningPattern = "stacksets"
    stackset_permission_mode: StackSetPermissionMode = "service_managed"
    organizations_all_features: bool = True
    trusted_access_enabled: bool = True
    external_execution_roles_created: bool = False


VpcConnectivity = Literal[
    "none",
    "vpc_peering",
    "transit_vpc",
    "transit_gateway",
]
HybridConnectivity = Literal[
    "none",
    "site_to_site_vpn",
    "vgw_per_vpc",
    "dx_private_vif_to_vgw",
    "dx_gateway_to_vgws",
    "dx_transit_vif_to_tgw",
    "vpn_to_tgw_over_dx_public_vif",
]


@dataclass(frozen=True, slots=True)
class NetworkScenario:
    vpc_count: int = 6
    region_count: int = 2
    transitive_routing_required: bool = True
    hub_and_spoke_required: bool = True
    cross_vpc_security_group_references_required: bool = False
    on_premises_connectivity_required: bool = True
    dedicated_private_line_required: bool = False
    high_bandwidth_low_latency_required: bool = False
    vpc_to_vpc_connectivity_required: bool = True
    public_aws_service_access_required: bool = False


@dataclass(frozen=True, slots=True)
class NetworkDesign:
    vpc_connectivity: VpcConnectivity = "transit_gateway"
    hybrid_connectivity: HybridConnectivity = "site_to_site_vpn"


@dataclass(frozen=True, slots=True)
class DnsScenario:
    custom_active_directory_dns: bool = True
    route53_private_names_required: bool = True
    private_link_private_dns_required: bool = False
    public_dns_hostnames_required: bool = False
    change_existing_dhcp_options_required: bool = False


@dataclass(frozen=True, slots=True)
class DnsDesign:
    use_custom_dhcp_options: bool = True
    enable_dns_hostnames: bool = True
    enable_dns_support: bool = True
    ad_forwards_to_route53_resolver: bool = True
    replace_dhcp_options_set: bool = True


@dataclass(frozen=True, slots=True)
class PermissionInputs:
    iam_policy_allows: bool
    scp_path_allows: bool
    explicit_deny_present: bool


@dataclass(frozen=True, slots=True)
class PermissionDecision:
    allowed: bool
    reason: str


@dataclass(frozen=True, slots=True)
class PracticeQuestion:
    id: str
    prompt: str
    options: tuple[str, ...]
    correct_index: int
    explanation: str
    source: SourceRef
    tags: tuple[str, ...]

    def validate(self) -> None:
        if not 0 <= self.correct_index < len(self.options):
            raise ValueError(f"Invalid correct_index for question {self.id!r}")
