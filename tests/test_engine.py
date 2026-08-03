from aws_lab.engine import (
    evaluate_dns,
    evaluate_network,
    evaluate_organization,
    evaluate_provisioning,
    permission_decision,
)
from aws_lab.models import (
    DnsDesign,
    DnsScenario,
    Finding,
    NetworkDesign,
    NetworkScenario,
    OrganizationDesign,
    OrganizationScenario,
    PermissionInputs,
    ProvisioningDesign,
    ProvisioningScenario,
    Severity,
)


def codes(findings: list[Finding]) -> set[str]:
    return {finding.code for finding in findings}


def test_scp_requires_all_features() -> None:
    findings = evaluate_organization(
        OrganizationScenario(),
        OrganizationDesign(all_features_enabled=False),
    )
    assert "org.scp_without_all_features" in codes(findings)


def test_scp_does_not_grant_iam_permission() -> None:
    decision = permission_decision(
        PermissionInputs(
            iam_policy_allows=False,
            scp_path_allows=True,
            explicit_deny_present=False,
        )
    )
    assert not decision.allowed
    assert "do not grant" in decision.reason


def test_explicit_deny_wins() -> None:
    decision = permission_decision(
        PermissionInputs(
            iam_policy_allows=True,
            scp_path_allows=True,
            explicit_deny_present=True,
        )
    )
    assert not decision.allowed
    assert "explicit deny" in decision.reason


def test_external_stackset_targets_need_self_managed_roles() -> None:
    findings = evaluate_provisioning(
        ProvisioningScenario(target_accounts_in_organization=False),
        ProvisioningDesign(
            pattern="stacksets",
            stackset_permission_mode="service_managed",
        ),
    )
    assert "provisioning.service_managed_external_accounts" in codes(findings)


def test_peering_fails_transitive_requirement() -> None:
    findings = evaluate_network(
        NetworkScenario(
            on_premises_connectivity_required=False,
            transitive_routing_required=True,
        ),
        NetworkDesign(
            vpc_connectivity="vpc_peering",
            hybrid_connectivity="none",
        ),
    )
    assert "network.peering_non_transitive" in codes(findings)


def test_dx_gateway_is_not_itself_the_vpc_transit_layer() -> None:
    findings = evaluate_network(
        NetworkScenario(
            on_premises_connectivity_required=True,
            vpc_to_vpc_connectivity_required=True,
        ),
        NetworkDesign(
            vpc_connectivity="transit_gateway",
            hybrid_connectivity="dx_gateway_to_vgws",
        ),
    )
    finding = next(
        item for item in findings if item.code == "network.dxgw_no_vpc_transit"
    )
    assert finding.severity == Severity.INFO


def test_dns_private_names_need_both_attributes() -> None:
    findings = evaluate_dns(
        DnsScenario(route53_private_names_required=True),
        DnsDesign(enable_dns_support=False),
    )
    assert "dns.attributes_disabled" in codes(findings)
    failure = next(
        finding
        for finding in findings
        if finding.code == "dns.attributes_disabled"
    )
    assert failure.severity == Severity.FAIL


def test_dhcp_options_are_replaced_not_edited() -> None:
    findings = evaluate_dns(
        DnsScenario(change_existing_dhcp_options_required=True),
        DnsDesign(replace_dhcp_options_set=False),
    )
    assert "dns.dhcp_mutation_attempt" in codes(findings)


def test_selected_account_layout_must_fit_account_count() -> None:
    findings = evaluate_organization(
        OrganizationScenario(account_count=2),
        OrganizationDesign(),
    )
    assert "org.account_count_inconsistent" in codes(findings)


def test_shared_directory_needs_network_connectivity() -> None:
    findings = evaluate_organization(
        OrganizationScenario(shared_managed_directory=True),
        OrganizationDesign(
            directory_sharing_mode="organization",
            directory_in_management_account=True,
            directory_network_connected=False,
        ),
    )
    assert "org.directory_network_missing" in codes(findings)
