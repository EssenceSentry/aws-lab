from __future__ import annotations

from collections.abc import Iterable

from aws_multi_account_lab import knowledge
from aws_multi_account_lab.models import (
    DnsDesign,
    DnsScenario,
    Finding,
    NetworkDesign,
    NetworkScenario,
    OrganizationDesign,
    OrganizationScenario,
    PermissionDecision,
    PermissionInputs,
    ProvisioningDesign,
    ProvisioningScenario,
    Severity,
    SourceRef,
)


def _finding(
    code: str,
    severity: Severity,
    title: str,
    detail: str,
    source: SourceRef,
    remedy: str | None = None,
) -> Finding:
    return Finding(
        code=code,
        severity=severity,
        title=title,
        detail=detail,
        source=source,
        remedy=remedy,
    )


def fit_label(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if Severity.FAIL in severities:
        return "Poor fit"
    if Severity.WARNING in severities:
        return "Partial fit"
    return "Strong fit"


def permission_decision(inputs: PermissionInputs) -> PermissionDecision:
    """Evaluate the simplified IAM/SCP intersection taught in the chapter.

    This deliberately excludes resource-based-policy and service-linked-role
    edge cases. It models an IAM principal in a member account.
    """

    if inputs.explicit_deny_present:
        return PermissionDecision(
            allowed=False,
            reason="Denied: an explicit deny takes precedence.",
        )
    if not inputs.scp_path_allows:
        return PermissionDecision(
            allowed=False,
            reason=(
                "Denied: the SCP path does not make this action available, "
                "even if IAM allows it."
            ),
        )
    if not inputs.iam_policy_allows:
        return PermissionDecision(
            allowed=False,
            reason=(
                "Denied: SCPs define the available permission ceiling; they "
                "do not grant the IAM permission."
            ),
        )
    return PermissionDecision(
        allowed=True,
        reason="Allowed by both the SCP path and the IAM policy.",
    )


def evaluate_organization(
    scenario: OrganizationScenario,
    design: OrganizationDesign,
) -> list[Finding]:
    findings: list[Finding] = []

    if scenario.account_count > 1 and not design.use_organizations:
        findings.append(
            _finding(
                "org.central_management_missing",
                Severity.FAIL,
                "No central multi-account control plane",
                (
                    "The design has multiple accounts but does not use AWS "
                    "Organizations for central governance and grouping."
                ),
                knowledge.ORGANIZATIONS,
                "Enable AWS Organizations and place accounts into OUs.",
            )
        )
    elif design.use_organizations:
        findings.append(
            _finding(
                "org.central_management_present",
                Severity.PASS,
                "Central account governance is present",
                (
                    "AWS Organizations can group member accounts into OUs and "
                    "apply shared governance across the hierarchy."
                ),
                knowledge.ORGANIZATIONS,
            )
        )

    if (
        scenario.separate_lifecycle_environments
        and not design.separate_environment_accounts
    ):
        findings.append(
            _finding(
                "org.environment_isolation_missing",
                Severity.WARNING,
                "Lifecycle environments are not isolated by account",
                (
                    "The chapter's landing-zone pattern places development "
                    "lifecycle environments in separate accounts to improve "
                    "isolation and flexibility."
                ),
                knowledge.LANDING_ZONE,
                "Use separate accounts for development, test, and production.",
            )
        )

    minimum_accounts = (
        1
        + (3 if design.separate_environment_accounts else 1)
        + int(design.logging_account)
        + int(design.security_account)
        + int(design.admin_shared_services_account)
    )
    if design.use_organizations and scenario.account_count < minimum_accounts:
        findings.append(
            _finding(
                "org.account_count_inconsistent",
                Severity.FAIL,
                "The selected account layout exceeds the scenario account count",
                (
                    f"The chosen design contains at least {minimum_accounts} "
                    "accounts once the management, workload, and dedicated "
                    "functions are counted."
                ),
                knowledge.LANDING_ZONE,
                (
                    "Increase the account count or consolidate/remove selected "
                    "dedicated accounts."
                ),
            )
        )

    dedicated_requirements = (
        (
            scenario.central_logging_required,
            design.logging_account,
            "logging",
            "logging",
        ),
        (
            scenario.central_security_required,
            design.security_account,
            "security",
            "security",
        ),
        (
            scenario.central_admin_required,
            design.admin_shared_services_account,
            "admin_shared_services",
            "administration/shared services",
        ),
    )
    for required, present, code_slug, account_label in dedicated_requirements:
        if required and not present:
            findings.append(
                _finding(
                    f"org.{code_slug}.account_missing",
                    Severity.WARNING,
                    f"No dedicated {account_label} account",
                    (
                        "The landing-zone example separates this function from "
                        "workload accounts."
                    ),
                    knowledge.LANDING_ZONE,
                    f"Add a dedicated {account_label} account.",
                )
            )

    if design.scp_strategy != "none":
        if not design.use_organizations:
            findings.append(
                _finding(
                    "org.scp_without_organizations",
                    Severity.FAIL,
                    "SCPs require AWS Organizations",
                    "The selected governance policy cannot exist as designed.",
                    knowledge.SCP,
                    "Enable AWS Organizations or remove the SCP strategy.",
                )
            )
        if not design.all_features_enabled:
            findings.append(
                _finding(
                    "org.scp_without_all_features",
                    Severity.FAIL,
                    "SCPs need all features enabled",
                    (
                        "The chapter states that SCPs are available only when "
                        "the organization has all features enabled."
                    ),
                    knowledge.SCP,
                    "Enable all features in the organization.",
                )
            )
        if design.use_organizations and design.all_features_enabled:
            strategy = (
                "deny selected APIs while FullAWSAccess remains attached"
                if design.scp_strategy == "denylist"
                else "allow only selected APIs and implicitly deny the rest"
            )
            findings.append(
                _finding(
                    "org.scp_valid",
                    Severity.PASS,
                    "The SCP strategy is structurally valid",
                    f"The chosen strategy will {strategy}.",
                    knowledge.SCP,
                )
            )
        if design.scp_scope == "root":
            findings.append(
                _finding(
                    "org.scp_root_cascade",
                    Severity.INFO,
                    "Root-level SCP has organization-wide reach",
                    (
                        "An SCP attached at the root cascades through OUs and "
                        "accounts below it."
                    ),
                    knowledge.SCP,
                )
            )

    if scenario.cross_account_human_access:
        if design.identity_strategy == "local_iam":
            findings.append(
                _finding(
                    "org.cross_account_local_users",
                    Severity.WARNING,
                    "Access is duplicated with local IAM users",
                    (
                        "The chapter recommends cross-account roles to avoid "
                        "creating and managing dedicated users in every account."
                    ),
                    knowledge.CROSS_ACCOUNT_ROLES,
                    (
                        "Use cross-account roles, IAM Identity Center, or a "
                        "federated identity design."
                    ),
                )
            )
        else:
            findings.append(
                _finding(
                    "org.cross_account_access_valid",
                    Severity.PASS,
                    "Cross-account access avoids duplicated IAM users",
                    (
                        "The selected identity strategy uses roles or federation "
                        "instead of creating a user in each target account."
                    ),
                    knowledge.CROSS_ACCOUNT_ROLES,
                )
            )

    if scenario.external_identity_provider:
        if design.identity_strategy not in {
            "identity_center",
            "saml_oidc_federation",
        }:
            findings.append(
                _finding(
                    "org.external_idp_not_integrated",
                    Severity.FAIL,
                    "External identity provider is not integrated",
                    (
                        "The chapter lists IAM Identity Center and IAM SAML/OIDC "
                        "identity providers as federation options."
                    ),
                    knowledge.DIRECTORY_AND_FEDERATION,
                    "Choose IAM Identity Center or SAML/OIDC federation.",
                )
            )

    if scenario.shared_managed_directory:
        if not design.directory_network_connected:
            findings.append(
                _finding(
                    "org.directory_network_missing",
                    Severity.FAIL,
                    "The directory consumers have no network path",
                    (
                        "The chapter requires connectivity and corresponding "
                        "routing/security configuration between participating VPCs."
                    ),
                    knowledge.DIRECTORY_AND_FEDERATION,
                    (
                        "Connect the VPCs with an appropriate peering, transit, "
                        "VPN, or Direct Connect design."
                    ),
                )
            )
        if not scenario.directory_same_region:
            findings.append(
                _finding(
                    "org.directory_cross_region",
                    Severity.FAIL,
                    "Managed Microsoft AD sharing is modeled as same-Region",
                    (
                        "The provided section limits directory sharing to other "
                        "VPCs and accounts in the same Region."
                    ),
                    knowledge.DIRECTORY_AND_FEDERATION,
                    "Place the participating VPCs/accounts in the same Region.",
                )
            )
        if design.directory_sharing_mode == "none":
            findings.append(
                _finding(
                    "org.directory_no_sharing_mode",
                    Severity.FAIL,
                    "No directory-sharing path is configured",
                    (
                        "Choose organization sharing or an external-account "
                        "handshake."
                    ),
                    knowledge.DIRECTORY_AND_FEDERATION,
                    "Select an appropriate directory-sharing mode.",
                )
            )
        elif design.directory_sharing_mode == "organization":
            if not (
                design.use_organizations
                and design.all_features_enabled
                and design.directory_in_management_account
            ):
                findings.append(
                    _finding(
                        "org.directory_org_prerequisites",
                        Severity.FAIL,
                        "Organization directory-sharing prerequisites are unmet",
                        (
                            "The chapter requires all features and places the "
                            "directory in the organization master/management "
                            "account for this sharing path."
                        ),
                        knowledge.DIRECTORY_AND_FEDERATION,
                        (
                            "Enable all features and host the directory in the "
                            "management account."
                        ),
                    )
                )
        elif (
            design.directory_sharing_mode == "external_account"
            and not design.external_directory_handshake
        ):
            findings.append(
                _finding(
                    "org.directory_handshake_missing",
                    Severity.FAIL,
                    "External directory share has no accepted handshake",
                    (
                        "Sharing with an external account requires a request and "
                        "recipient acceptance."
                    ),
                    knowledge.DIRECTORY_AND_FEDERATION,
                    "Initiate and accept the directory-sharing handshake.",
                )
            )

    if scenario.partner_s3_access:
        if not design.s3_bucket_policy:
            findings.append(
                _finding(
                    "org.s3_bucket_policy_missing",
                    Severity.FAIL,
                    "The partner account has no S3 resource permission",
                    (
                        "The chapter uses a bucket policy to grant another "
                        "account object API access."
                    ),
                    knowledge.S3_CROSS_ACCOUNT,
                    "Add a bucket policy for the partner principal and actions.",
                )
            )
        if (
            scenario.partner_should_pay_request_costs
            and not design.requester_pays
        ):
            findings.append(
                _finding(
                    "org.s3_requester_pays_missing",
                    Severity.WARNING,
                    "The bucket owner still pays request costs",
                    (
                        "Enable S3 Requester Pays when the requester should bear "
                        "request and data-transfer charges described by the guide."
                    ),
                    knowledge.S3_CROSS_ACCOUNT,
                    "Enable Requester Pays and require authenticated requests.",
                )
            )
        if design.requester_pays:
            findings.append(
                _finding(
                    "org.s3_requester_header",
                    Severity.INFO,
                    "Requester Pays changes the request contract",
                    (
                        "Authenticated requesters must identify themselves as the "
                        "payer in the request."
                    ),
                    knowledge.S3_CROSS_ACCOUNT,
                )
            )

    return findings


def evaluate_provisioning(
    scenario: ProvisioningScenario,
    design: ProvisioningDesign,
) -> list[Finding]:
    findings: list[Finding] = []
    uses_stacksets = design.pattern in {"stacksets", "both"}
    uses_catalog = design.pattern in {"service_catalog", "both"}

    if design.pattern == "none":
        findings.append(
            _finding(
                "provisioning.none",
                Severity.FAIL,
                "No multi-account provisioning mechanism is selected",
                "The scenario asks for centrally governed infrastructure.",
                knowledge.PROVISIONING_COMPARISON,
                "Select StackSets, Service Catalog, or both.",
            )
        )

    if (
        scenario.identical_baseline_required
        and (
            scenario.target_multiple_accounts
            or scenario.target_multiple_regions
        )
        and not uses_stacksets
    ):
        findings.append(
            _finding(
                "provisioning.baseline_without_stacksets",
                Severity.WARNING,
                "Identical cross-account baselines lack StackSets",
                (
                    "The guide positions StackSets as the direct mechanism for "
                    "deploying one template across accounts and Regions."
                ),
                knowledge.STACKSETS,
                "Use StackSets, optionally together with Service Catalog.",
            )
        )

    if scenario.end_user_self_service_required and not uses_catalog:
        findings.append(
            _finding(
                "provisioning.self_service_without_catalog",
                Severity.WARNING,
                "End users have no approved self-service portfolio",
                (
                    "Service Catalog lets users choose and launch approved "
                    "products without handling the underlying templates."
                ),
                knowledge.SERVICE_CATALOG,
                "Add Service Catalog or use the combined pattern.",
            )
        )

    if (
        scenario.target_multiple_regions
        and uses_catalog
        and not uses_stacksets
    ):
        findings.append(
            _finding(
                "provisioning.catalog_regional",
                Severity.WARNING,
                "Service Catalog products are Regional",
                (
                    "A catalog-only design needs repeated regional deployment or "
                    "additional automation."
                ),
                knowledge.PROVISIONING_COMPARISON,
                "Use StackSets to distribute catalog products across Regions.",
            )
        )

    if uses_stacksets:
        if scenario.target_accounts_in_organization:
            if design.stackset_permission_mode == "service_managed":
                if not (
                    design.organizations_all_features
                    and design.trusted_access_enabled
                ):
                    findings.append(
                        _finding(
                            "provisioning.service_managed_prerequisites",
                            Severity.FAIL,
                            "Service-managed StackSets prerequisites are unmet",
                            (
                                "For organization targets, the guide requires all "
                                "features and trusted access."
                            ),
                            knowledge.STACKSETS,
                            "Enable all features and trusted access.",
                        )
                    )
            else:
                findings.append(
                    _finding(
                        "provisioning.self_managed_inside_org",
                        Severity.INFO,
                        "Self-managed permissions add manual role administration",
                        (
                            "The organization path can instead let StackSets "
                            "create the required roles through trusted access."
                        ),
                        knowledge.STACKSETS,
                    )
                )
        elif design.stackset_permission_mode == "service_managed":
            findings.append(
                _finding(
                    "provisioning.service_managed_external_accounts",
                    Severity.FAIL,
                    "External targets need self-managed StackSet roles",
                    (
                        "The guide requires explicit administrator/execution role "
                        "trust when targets are outside the organization."
                    ),
                    knowledge.STACKSETS,
                    "Use self-managed permissions and create the execution roles.",
                )
            )
        elif not design.external_execution_roles_created:
            findings.append(
                _finding(
                    "provisioning.external_roles_missing",
                    Severity.FAIL,
                    "External target execution roles are missing",
                    (
                        "Each target account needs the StackSet execution role and "
                        "trust relationship described in the guide."
                    ),
                    knowledge.STACKSETS,
                    "Create the required execution roles in target accounts.",
                )
            )

    if scenario.end_user_parameters_required:
        if uses_catalog:
            findings.append(
                _finding(
                    "provisioning.parameters_supported",
                    Severity.PASS,
                    "Users can choose approved product parameters",
                    (
                        "The catalog or combined pattern preserves controlled "
                        "self-service customization."
                    ),
                    knowledge.PROVISIONING_COMPARISON,
                )
            )
        else:
            findings.append(
                _finding(
                    "provisioning.parameters_missing",
                    Severity.WARNING,
                    "The design does not expose a user-facing product choice",
                    (
                        "StackSets centrally push a template; Service Catalog is "
                        "the guide's self-service mechanism."
                    ),
                    knowledge.PROVISIONING_COMPARISON,
                    "Add Service Catalog if users must select parameters.",
                )
            )

    if scenario.post_provision_changes_unacceptable:
        findings.append(
            _finding(
                "provisioning.drift_not_fully_solved",
                Severity.WARNING,
                "The chapter does not establish an immutable post-launch design",
                (
                    "It explicitly warns that StackSet-created resources may be "
                    "modified after provisioning when users retain permission."
                ),
                knowledge.PROVISIONING_COMPARISON,
                (
                    "Add permission and compliance controls beyond the mechanisms "
                    "modeled in this chapter."
                ),
            )
        )

    if design.pattern == "both":
        findings.append(
            _finding(
                "provisioning.combined_pattern",
                Severity.PASS,
                "The combined pattern covers distribution and self-service",
                (
                    "StackSets handles multi-account/multi-Region rollout while "
                    "Service Catalog exposes approved configurable products."
                ),
                knowledge.PROVISIONING_COMPARISON,
            )
        )

    return findings


def evaluate_network(
    scenario: NetworkScenario,
    design: NetworkDesign,
) -> list[Finding]:
    findings: list[Finding] = []

    if (
        scenario.vpc_count > 1
        and scenario.vpc_to_vpc_connectivity_required
        and design.vpc_connectivity == "none"
    ):
        findings.append(
            _finding(
                "network.no_vpc_connectivity",
                Severity.FAIL,
                "The VPCs have no interconnection strategy",
                "The scenario requires communication among multiple VPCs.",
                knowledge.VPC_PEERING,
                "Choose peering, Transit VPC, or Transit Gateway.",
            )
        )

    if design.vpc_connectivity == "vpc_peering":
        if scenario.transitive_routing_required:
            findings.append(
                _finding(
                    "network.peering_non_transitive",
                    Severity.FAIL,
                    "VPC peering is non-transitive",
                    (
                        "A peering path from A to B and B to C does not let A "
                        "reach C through B."
                    ),
                    knowledge.VPC_PEERING,
                    "Add direct peerings or choose a transit architecture.",
                )
            )
        if scenario.hub_and_spoke_required:
            findings.append(
                _finding(
                    "network.peering_hub_spoke",
                    Severity.WARNING,
                    "VPC peering is a poor hub-and-spoke fit",
                    "The guide explicitly flags this topology mismatch.",
                    knowledge.VPC_PEERING,
                    "Use Transit VPC or Transit Gateway.",
                )
            )
        if scenario.vpc_count > 4:
            findings.append(
                _finding(
                    "network.peering_scale",
                    Severity.WARNING,
                    "The peering mesh grows operationally awkward",
                    (
                        "The guide presents peering as the simplest two-VPC "
                        "option and transit services for broader hub-and-spoke use."
                    ),
                    knowledge.VPC_PEERING,
                    "Consider a transit hub for a larger VPC estate.",
                )
            )

    if design.vpc_connectivity == "transit_vpc":
        findings.append(
            _finding(
                "network.transit_vpc_requirements",
                Severity.INFO,
                "Transit VPC uses a VPN overlay",
                (
                    "The hub-and-spoke pattern relies on BGP over IPsec and "
                    "requires VPN gateways/custom network components."
                ),
                knowledge.TRANSIT_CONNECTIVITY,
            )
        )

    if design.vpc_connectivity == "transit_gateway":
        if scenario.region_count > 1:
            findings.append(
                _finding(
                    "network.tgw_inter_region",
                    Severity.INFO,
                    "Multi-Region use needs Transit Gateway peering",
                    (
                        "Transit Gateway is Regional; the guide uses peering "
                        "between gateways in different Regions."
                    ),
                    knowledge.TRANSIT_CONNECTIVITY,
                )
            )
        if scenario.cross_vpc_security_group_references_required:
            findings.append(
                _finding(
                    "network.tgw_security_group_reference",
                    Severity.FAIL,
                    "The selected design needs unsupported SG references",
                    (
                        "For the Transit Gateway design described in the chapter, "
                        "rules must use IP addresses or ranges instead of another "
                        "VPC's security group."
                    ),
                    knowledge.TRANSIT_CONNECTIVITY,
                    "Use IP-based rules or change the connectivity requirement.",
                )
            )
        if (
            scenario.transitive_routing_required
            or scenario.hub_and_spoke_required
        ):
            findings.append(
                _finding(
                    "network.tgw_fit",
                    Severity.PASS,
                    "Transit Gateway fits centralized transitive routing",
                    (
                        "It connects multiple VPCs and can also attach VPN and "
                        "Direct Connect paths."
                    ),
                    knowledge.TRANSIT_CONNECTIVITY,
                )
            )

    if scenario.on_premises_connectivity_required:
        if design.hybrid_connectivity == "none":
            findings.append(
                _finding(
                    "network.no_hybrid_connectivity",
                    Severity.FAIL,
                    "No on-premises connection is configured",
                    "The scenario explicitly requires hybrid connectivity.",
                    knowledge.HYBRID_CONNECTIVITY,
                    "Choose a VPN or Direct Connect pattern.",
                )
            )

        if design.hybrid_connectivity in {
            "site_to_site_vpn",
            "vgw_per_vpc",
        }:
            if (
                scenario.dedicated_private_line_required
                or scenario.high_bandwidth_low_latency_required
            ):
                findings.append(
                    _finding(
                        "network.vpn_dedicated_requirement",
                        Severity.FAIL,
                        "An Internet VPN does not meet the dedicated-line goal",
                        (
                            "The guide contrasts VPN with Direct Connect's private "
                            "connection, lower latency, and higher bandwidth."
                        ),
                        knowledge.HYBRID_CONNECTIVITY,
                        "Use an appropriate Direct Connect architecture.",
                    )
                )

        if design.hybrid_connectivity == "vgw_per_vpc":
            if scenario.vpc_count > 3:
                findings.append(
                    _finding(
                        "network.vgw_scale",
                        Severity.WARNING,
                        "One VGW/VPN per VPC does not scale cleanly",
                        (
                            "The guide positions this as a one-to-one option for a "
                            "small number of VPCs and recommends Transit Gateway "
                            "as the environment grows."
                        ),
                        knowledge.HYBRID_CONNECTIVITY,
                        "Attach the VPN to Transit Gateway instead.",
                    )
                )

        if design.hybrid_connectivity == "dx_private_vif_to_vgw":
            if scenario.region_count > 1 or scenario.vpc_count > 3:
                findings.append(
                    _finding(
                        "network.dx_private_vif_scale",
                        Severity.WARNING,
                        "Private VIF-to-VGW is too narrow for this estate",
                        (
                            "The guide treats this as a Regional, per-VPC-oriented "
                            "pattern rather than the broadest scalable design."
                        ),
                        knowledge.HYBRID_CONNECTIVITY,
                        "Consider a Direct Connect gateway or transit VIF design.",
                    )
                )

        if design.hybrid_connectivity == "dx_gateway_to_vgws":
            findings.append(
                _finding(
                    "network.dxgw_no_vpc_transit",
                    Severity.INFO,
                    "Direct Connect gateway is not the VPC transit layer",
                    (
                        "The chapter explicitly excludes VPC-to-VPC connectivity "
                        "from this pattern; a separate VPC connectivity design is "
                        "still required when VPCs must communicate."
                    ),
                    knowledge.HYBRID_CONNECTIVITY,
                )
            )
            if scenario.region_count > 1:
                findings.append(
                    _finding(
                        "network.dxgw_multiregion_fit",
                        Severity.PASS,
                        "Direct Connect gateway reaches VGWs across Regions",
                        (
                            "This pattern associates a private VIF with multiple "
                            "VGWs attached to VPCs in different Regions."
                        ),
                        knowledge.HYBRID_CONNECTIVITY,
                    )
                )

        if design.hybrid_connectivity in {
            "dx_transit_vif_to_tgw",
            "vpn_to_tgw_over_dx_public_vif",
        } and design.vpc_connectivity != "transit_gateway":
            findings.append(
                _finding(
                    "network.hybrid_tgw_missing",
                    Severity.FAIL,
                    "The selected hybrid pattern requires Transit Gateway",
                    (
                        "The selected Direct Connect/VPN path terminates on or "
                        "associates with Transit Gateway, but the VPC design does "
                        "not include one."
                    ),
                    knowledge.HYBRID_CONNECTIVITY,
                    "Select Transit Gateway as the VPC connectivity pattern.",
                )
            )

        if design.hybrid_connectivity == "dx_transit_vif_to_tgw":
            if scenario.vpc_count > 1 or scenario.region_count > 1:
                findings.append(
                    _finding(
                        "network.dx_transit_scalable",
                        Severity.PASS,
                        "Transit VIF plus Transit Gateway fits the broad estate",
                        (
                            "The guide calls this the most scalable and manageable "
                            "option for multiple VPCs in multiple locations."
                        ),
                        knowledge.HYBRID_CONNECTIVITY,
                    )
                )

        if scenario.public_aws_service_access_required:
            if (
                design.hybrid_connectivity
                != "vpn_to_tgw_over_dx_public_vif"
            ):
                findings.append(
                    _finding(
                        "network.public_services_path",
                        Severity.WARNING,
                        "The chosen hybrid path does not model public AWS endpoints",
                        (
                            "The chapter's explicit public-endpoint pattern uses a "
                            "public VIF and a VPN attachment to Transit Gateway."
                        ),
                        knowledge.HYBRID_CONNECTIVITY,
                        (
                            "Use the public-VIF VPN pattern or model a separate "
                            "public-service access path."
                        ),
                    )
                )

    return findings


def evaluate_dns(
    scenario: DnsScenario,
    design: DnsDesign,
) -> list[Finding]:
    findings: list[Finding] = []

    if scenario.custom_active_directory_dns:
        if not design.use_custom_dhcp_options:
            findings.append(
                _finding(
                    "dns.no_custom_dhcp",
                    Severity.FAIL,
                    "Instances are not directed to the custom DNS servers",
                    (
                        "The chapter uses a DHCP options set to distribute the "
                        "domain name and custom DNS server addresses."
                    ),
                    knowledge.DNS,
                    "Associate a custom DHCP options set with the VPC.",
                )
            )
        if (
            scenario.route53_private_names_required
            and not design.ad_forwards_to_route53_resolver
        ):
            findings.append(
                _finding(
                    "dns.no_ad_forwarding",
                    Severity.FAIL,
                    "Active Directory DNS cannot resolve the VPC private names",
                    (
                        "The chapter forwards those queries from AD to a Route 53 "
                        "Resolver inbound endpoint."
                    ),
                    knowledge.DNS,
                    "Configure forwarding to a Route 53 Resolver inbound endpoint.",
                )
            )

    needs_both_attributes = (
        scenario.route53_private_names_required
        or scenario.private_link_private_dns_required
        or scenario.public_dns_hostnames_required
    )
    if needs_both_attributes and not (
        design.enable_dns_hostnames and design.enable_dns_support
    ):
        findings.append(
            _finding(
                "dns.attributes_disabled",
                Severity.FAIL,
                "The required VPC DNS attributes are not both enabled",
                (
                    "The guide requires both enableDnsHostnames and "
                    "enableDnsSupport for the modeled private hosted-zone and "
                    "PrivateLink private-DNS cases."
                ),
                knowledge.DNS,
                "Enable both VPC DNS attributes.",
            )
        )
    elif needs_both_attributes:
        findings.append(
            _finding(
                "dns.attributes_enabled",
                Severity.PASS,
                "Both VPC DNS attributes are enabled",
                (
                    "The design supports the Route 53/private-DNS behavior "
                    "described in the chapter."
                ),
                knowledge.DNS,
            )
        )

    if scenario.change_existing_dhcp_options_required:
        if not design.replace_dhcp_options_set:
            findings.append(
                _finding(
                    "dns.dhcp_mutation_attempt",
                    Severity.FAIL,
                    "The design tries to modify a DHCP options set in place",
                    "The chapter states that existing DHCP options sets are immutable.",
                    knowledge.DNS,
                    "Create a new DHCP options set and associate it with the VPC.",
                )
            )
        else:
            findings.append(
                _finding(
                    "dns.dhcp_replacement",
                    Severity.PASS,
                    "The DHCP options set is replaced rather than edited",
                    (
                        "This follows the chapter's create-and-reassociate "
                        "procedure."
                    ),
                    knowledge.DNS,
                )
            )

    return findings
