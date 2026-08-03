from __future__ import annotations

from collections import Counter
from typing import cast

import streamlit as st

from aws_lab.engine import (
    evaluate_dns,
    evaluate_network,
    evaluate_organization,
    evaluate_provisioning,
    fit_label,
    permission_decision,
)
from aws_lab.export import questions_to_anki_tsv
from aws_lab.models import (
    DirectorySharingMode,
    DnsDesign,
    DnsScenario,
    Finding,
    HybridConnectivity,
    IdentityStrategy,
    NetworkDesign,
    NetworkScenario,
    OrganizationDesign,
    OrganizationScenario,
    PermissionInputs,
    ProvisioningDesign,
    ProvisioningPattern,
    ProvisioningScenario,
    ScpScope,
    ScpStrategy,
    Severity,
    StackSetPermissionMode,
    VpcConnectivity,
)
from aws_lab.practice import QUESTIONS
from aws_lab.visuals import network_dot, organization_dot

st.set_page_config(
    page_title="AWS Lab",
    page_icon="🏗️",
    layout="wide",
)


SEVERITY_LABELS = {
    Severity.PASS: "Satisfied",
    Severity.INFO: "Architectural note",
    Severity.WARNING: "Tradeoff / partial fit",
    Severity.FAIL: "Constraint violation",
}


def render_findings(findings: list[Finding]) -> None:
    counts = Counter(finding.severity for finding in findings)
    columns = st.columns(5)
    columns[0].metric("Fit", fit_label(findings))
    columns[1].metric("Violations", counts[Severity.FAIL])
    columns[2].metric("Tradeoffs", counts[Severity.WARNING])
    columns[3].metric("Satisfied", counts[Severity.PASS])
    columns[4].metric("Notes", counts[Severity.INFO])

    if not findings:
        st.info("No rule in this module was activated by the current scenario.")
        return

    order = {
        Severity.FAIL: 0,
        Severity.WARNING: 1,
        Severity.PASS: 2,
        Severity.INFO: 3,
    }
    for finding in sorted(findings, key=lambda item: order[item.severity]):
        body = finding.detail
        if finding.remedy:
            body += f"\n\n**Smallest modeled fix:** {finding.remedy}"
        body += f"\n\n**Source:** {finding.source.label}"
        if finding.severity == Severity.FAIL:
            st.error(f"**{finding.title}**\n\n{body}")
        elif finding.severity == Severity.WARNING:
            st.warning(f"**{finding.title}**\n\n{body}")
        elif finding.severity == Severity.PASS:
            st.success(f"**{finding.title}**\n\n{body}")
        else:
            st.info(f"**{finding.title}**\n\n{body}")


def labeled_selectbox(
    label: str,
    options: dict[str, str],
    default: str,
    key: str,
) -> str:
    values = list(options)
    return st.selectbox(
        label,
        values,
        index=values.index(default),
        format_func=options.__getitem__,
        key=key,
    )


st.title("AWS Lab")
st.caption(
    "A deterministic, source-linked study sandbox for the supplied Tutorials "
    "Dojo chapter on organizational complexity. It is a decision-boundary "
    "trainer, not an AWS emulator or an independent current-documentation "
    "audit."
)

st.markdown(
    "Change requirements on the **Scenario** side, choose an architecture on "
    "the **Design** side, and inspect hard violations, tradeoffs, and the "
    "smallest modeled fixes. The rules cite guide pages 42–58."
)

(
    org_tab,
    provisioning_tab,
    network_tab,
    dns_tab,
    practice_tab,
    source_tab,
) = st.tabs(
    [
        "Organization & access",
        "Provisioning",
        "Networking",
        "DNS",
        "Practice & Anki",
        "Coverage & sources",
    ]
)

with org_tab:
    st.header("Organization, account isolation, access, and SCPs")
    scenario_column, design_column = st.columns(2)

    with scenario_column:
        st.subheader("Scenario")
        account_count = st.slider(
            "Number of AWS accounts",
            min_value=1,
            max_value=100,
            value=8,
            key="org_account_count",
        )
        separate_lifecycle = st.checkbox(
            "Development lifecycle environments require isolation",
            value=True,
            key="org_scenario_lifecycle",
        )
        central_logging = st.checkbox(
            "Central logging account required",
            value=True,
            key="org_scenario_logging",
        )
        central_security = st.checkbox(
            "Central security account required",
            value=True,
            key="org_scenario_security",
        )
        central_admin = st.checkbox(
            "Central administration/shared-services account required",
            value=True,
            key="org_scenario_admin",
        )
        cross_account_access = st.checkbox(
            "Humans need access across accounts",
            value=True,
            key="org_scenario_cross_account",
        )
        external_idp = st.checkbox(
            "Users authenticate through an external identity provider",
            value=False,
            key="org_scenario_external_idp",
        )
        shared_directory = st.checkbox(
            "AWS Managed Microsoft AD must be shared",
            value=False,
            key="org_scenario_directory",
        )
        directory_same_region = st.checkbox(
            "Directory consumers are in the same Region",
            value=True,
            disabled=not shared_directory,
            key="org_scenario_directory_region",
        )
        partner_s3 = st.checkbox(
            "A partner account needs S3 object access",
            value=False,
            key="org_scenario_s3",
        )
        partner_pays = st.checkbox(
            "The partner should pay request costs",
            value=False,
            disabled=not partner_s3,
            key="org_scenario_s3_pays",
        )

    with design_column:
        st.subheader("Design")
        use_organizations = st.checkbox(
            "Use AWS Organizations",
            value=True,
            key="org_design_organizations",
        )
        all_features = st.checkbox(
            "Enable all organization features",
            value=True,
            disabled=not use_organizations,
            key="org_design_all_features",
        )
        separate_accounts = st.checkbox(
            "Use separate accounts for lifecycle environments",
            value=True,
            key="org_design_env_accounts",
        )
        logging_account = st.checkbox(
            "Dedicated logging account",
            value=True,
            key="org_design_logging",
        )
        security_account = st.checkbox(
            "Dedicated security account",
            value=True,
            key="org_design_security",
        )
        admin_account = st.checkbox(
            "Dedicated administration/shared-services account",
            value=True,
            key="org_design_admin",
        )
        scp_strategy = cast(
            ScpStrategy,
            labeled_selectbox(
                "SCP strategy",
                {
                    "none": "No SCPs",
                    "denylist": "Denylist / blacklist",
                    "allowlist": "Allowlist / whitelist",
                },
                "denylist",
                "org_design_scp_strategy",
            ),
        )
        scp_scope = cast(
            ScpScope,
            labeled_selectbox(
                "SCP attachment scope",
                {
                    "root": "Organization root",
                    "ou": "Organizational unit",
                    "account": "Individual account",
                },
                "ou",
                "org_design_scp_scope",
            ),
        )
        identity_strategy = cast(
            IdentityStrategy,
            labeled_selectbox(
                "Human identity strategy",
                {
                    "local_iam": "Local IAM users in each account",
                    "cross_account_roles": "Cross-account IAM roles",
                    "identity_center": "IAM Identity Center",
                    "saml_oidc_federation": "SAML/OIDC federation",
                },
                "identity_center",
                "org_design_identity",
            ),
        )
        directory_mode = cast(
            DirectorySharingMode,
            labeled_selectbox(
                "Directory sharing mode",
                {
                    "none": "No directory sharing",
                    "organization": "Share through AWS Organizations",
                    "external_account": "Share to an external account",
                },
                "none",
                "org_design_directory_mode",
            ),
        )
        directory_in_management = st.checkbox(
            "Directory is in the management/master account",
            value=False,
            disabled=directory_mode != "organization",
            key="org_design_directory_management",
        )
        external_handshake = st.checkbox(
            "External directory-sharing handshake is accepted",
            value=False,
            disabled=directory_mode != "external_account",
            key="org_design_directory_handshake",
        )
        directory_network = st.checkbox(
            "Participating VPCs have network, route, and security connectivity",
            value=False,
            disabled=directory_mode == "none",
            key="org_design_directory_network",
        )
        s3_bucket_policy = st.checkbox(
            "Bucket policy grants the partner access",
            value=False,
            disabled=not partner_s3,
            key="org_design_s3_policy",
        )
        requester_pays = st.checkbox(
            "Enable S3 Requester Pays",
            value=False,
            disabled=not partner_s3,
            key="org_design_requester_pays",
        )

    organization_scenario = OrganizationScenario(
        account_count=account_count,
        separate_lifecycle_environments=separate_lifecycle,
        central_logging_required=central_logging,
        central_security_required=central_security,
        central_admin_required=central_admin,
        cross_account_human_access=cross_account_access,
        external_identity_provider=external_idp,
        shared_managed_directory=shared_directory,
        directory_same_region=directory_same_region,
        partner_s3_access=partner_s3,
        partner_should_pay_request_costs=partner_pays,
    )
    organization_design = OrganizationDesign(
        use_organizations=use_organizations,
        all_features_enabled=all_features,
        separate_environment_accounts=separate_accounts,
        logging_account=logging_account,
        security_account=security_account,
        admin_shared_services_account=admin_account,
        scp_strategy=scp_strategy,
        scp_scope=scp_scope,
        identity_strategy=identity_strategy,
        directory_sharing_mode=directory_mode,
        directory_in_management_account=directory_in_management,
        external_directory_handshake=external_handshake,
        directory_network_connected=directory_network,
        s3_bucket_policy=s3_bucket_policy,
        requester_pays=requester_pays,
    )

    st.subheader("Architecture sketch")
    st.graphviz_chart(
        organization_dot(organization_scenario, organization_design),
        width="stretch",
    )

    st.subheader("Evaluation")
    render_findings(
        evaluate_organization(organization_scenario, organization_design)
    )

    with st.expander("Mini permission-ceiling simulator"):
        st.caption(
            "This intentionally models only the chapter's basic IAM/SCP "
            "intersection for a principal in a member account."
        )
        permission_columns = st.columns(3)
        iam_allows = permission_columns[0].checkbox(
            "IAM policy allows action",
            value=True,
            key="permission_iam",
        )
        scp_allows = permission_columns[1].checkbox(
            "Every SCP on the path allows action",
            value=True,
            key="permission_scp",
        )
        explicit_deny = permission_columns[2].checkbox(
            "An explicit deny is present",
            value=False,
            key="permission_deny",
        )
        decision = permission_decision(
            PermissionInputs(
                iam_policy_allows=iam_allows,
                scp_path_allows=scp_allows,
                explicit_deny_present=explicit_deny,
            )
        )
        if decision.allowed:
            st.success(decision.reason)
        else:
            st.error(decision.reason)

with provisioning_tab:
    st.header("Multi-account infrastructure provisioning")
    scenario_column, design_column = st.columns(2)

    with scenario_column:
        st.subheader("Scenario")
        targets_in_org = st.checkbox(
            "Target accounts belong to the AWS Organization",
            value=True,
            key="prov_scenario_in_org",
        )
        multiple_accounts = st.checkbox(
            "Deploy to multiple accounts",
            value=True,
            key="prov_scenario_accounts",
        )
        multiple_regions = st.checkbox(
            "Deploy to multiple Regions",
            value=True,
            key="prov_scenario_regions",
        )
        identical_baseline = st.checkbox(
            "The same baseline/template should be deployed everywhere",
            value=True,
            key="prov_scenario_baseline",
        )
        self_service = st.checkbox(
            "End users need an approved self-service catalog",
            value=False,
            key="prov_scenario_self_service",
        )
        parameters = st.checkbox(
            "End users need controlled parameter choices",
            value=False,
            key="prov_scenario_parameters",
        )
        immutable = st.checkbox(
            "Post-provision manual changes are unacceptable",
            value=False,
            key="prov_scenario_immutable",
        )

    with design_column:
        st.subheader("Design")
        pattern = cast(
            ProvisioningPattern,
            labeled_selectbox(
                "Provisioning pattern",
                {
                    "none": "None",
                    "stacksets": "CloudFormation StackSets",
                    "service_catalog": "AWS Service Catalog",
                    "both": "StackSets + Service Catalog",
                },
                "stacksets",
                "prov_design_pattern",
            ),
        )
        permission_mode = cast(
            StackSetPermissionMode,
            labeled_selectbox(
                "StackSet permission mode",
                {
                    "service_managed": "Service-managed permissions",
                    "self_managed": "Self-managed permissions",
                },
                "service_managed",
                "prov_design_permissions",
            ),
        )
        org_all_features = st.checkbox(
            "Organization has all features enabled",
            value=True,
            key="prov_design_all_features",
        )
        trusted_access = st.checkbox(
            "Trusted access is enabled",
            value=True,
            key="prov_design_trusted_access",
        )
        execution_roles = st.checkbox(
            "Execution roles exist in external target accounts",
            value=False,
            key="prov_design_execution_roles",
        )

    provisioning_scenario = ProvisioningScenario(
        target_accounts_in_organization=targets_in_org,
        target_multiple_accounts=multiple_accounts,
        target_multiple_regions=multiple_regions,
        identical_baseline_required=identical_baseline,
        end_user_self_service_required=self_service,
        end_user_parameters_required=parameters,
        post_provision_changes_unacceptable=immutable,
    )
    provisioning_design = ProvisioningDesign(
        pattern=pattern,
        stackset_permission_mode=permission_mode,
        organizations_all_features=org_all_features,
        trusted_access_enabled=trusted_access,
        external_execution_roles_created=execution_roles,
    )

    st.subheader("Evaluation")
    render_findings(
        evaluate_provisioning(provisioning_scenario, provisioning_design)
    )

    st.subheader("Decision boundary")
    st.dataframe(
        {
            "Mechanism": [
                "StackSets",
                "Service Catalog",
                "Both",
            ],
            "Best at": [
                "Pushing one template across accounts and Regions",
                "Approved self-service products and parameters",
                "Cross-account distribution plus controlled self-service",
            ],
            "Main chapter caveat": [
                "Resources can be changed later if users retain permission",
                "Products are Regional and user flexibility is reduced",
                "Users must understand how the products are configured",
            ],
        },
        hide_index=True,
        width="stretch",
    )

with network_tab:
    st.header("Multi-VPC and hybrid connectivity")
    scenario_column, design_column = st.columns(2)

    with scenario_column:
        st.subheader("Scenario")
        vpc_count = st.slider(
            "VPC count",
            min_value=1,
            max_value=50,
            value=6,
            key="net_scenario_vpcs",
        )
        region_count = st.slider(
            "Region count",
            min_value=1,
            max_value=6,
            value=2,
            key="net_scenario_regions",
        )
        transitive = st.checkbox(
            "Transitive VPC routing required",
            value=True,
            key="net_scenario_transitive",
        )
        hub_spoke = st.checkbox(
            "Hub-and-spoke topology required",
            value=True,
            key="net_scenario_hub",
        )
        sg_references = st.checkbox(
            "Cross-VPC security-group references required",
            value=False,
            key="net_scenario_sg",
        )
        on_prem = st.checkbox(
            "On-premises connectivity required",
            value=True,
            key="net_scenario_onprem",
        )
        dedicated = st.checkbox(
            "A dedicated private line is required",
            value=False,
            disabled=not on_prem,
            key="net_scenario_dedicated",
        )
        performance = st.checkbox(
            "High bandwidth / lower latency is required",
            value=False,
            disabled=not on_prem,
            key="net_scenario_performance",
        )
        vpc_transit = st.checkbox(
            "VPC-to-VPC connectivity is required",
            value=True,
            key="net_scenario_vpc_transit",
        )
        public_services = st.checkbox(
            "Hybrid path must reach public AWS service endpoints",
            value=False,
            disabled=not on_prem,
            key="net_scenario_public",
        )

    with design_column:
        st.subheader("Design")
        vpc_connectivity = cast(
            VpcConnectivity,
            labeled_selectbox(
                "VPC connectivity",
                {
                    "none": "None",
                    "vpc_peering": "VPC peering",
                    "transit_vpc": "Transit VPC",
                    "transit_gateway": "AWS Transit Gateway",
                },
                "transit_gateway",
                "net_design_vpc",
            ),
        )
        hybrid_connectivity = cast(
            HybridConnectivity,
            labeled_selectbox(
                "Hybrid connectivity",
                {
                    "none": "None",
                    "site_to_site_vpn": "Site-to-Site VPN",
                    "vgw_per_vpc": "One VPN/VGW per VPC",
                    "dx_private_vif_to_vgw": "DX private VIF to a VGW",
                    "dx_gateway_to_vgws": "DX gateway to VGWs",
                    "dx_transit_vif_to_tgw": (
                        "Transit VIF → Direct Connect gateway → Transit Gateway"
                    ),
                    "vpn_to_tgw_over_dx_public_vif": (
                        "VPN to Transit Gateway over a DX public VIF"
                    ),
                },
                "site_to_site_vpn",
                "net_design_hybrid",
            ),
        )

    network_scenario = NetworkScenario(
        vpc_count=vpc_count,
        region_count=region_count,
        transitive_routing_required=transitive,
        hub_and_spoke_required=hub_spoke,
        cross_vpc_security_group_references_required=sg_references,
        on_premises_connectivity_required=on_prem,
        dedicated_private_line_required=dedicated,
        high_bandwidth_low_latency_required=performance,
        vpc_to_vpc_connectivity_required=vpc_transit,
        public_aws_service_access_required=public_services,
    )
    network_design = NetworkDesign(
        vpc_connectivity=vpc_connectivity,
        hybrid_connectivity=hybrid_connectivity,
    )

    st.subheader("Architecture sketch")
    st.graphviz_chart(
        network_dot(network_scenario, network_design),
        width="stretch",
    )
    st.subheader("Evaluation")
    render_findings(evaluate_network(network_scenario, network_design))

with dns_tab:
    st.header("VPC DNS, DHCP options, and Active Directory")
    scenario_column, design_column = st.columns(2)

    with scenario_column:
        st.subheader("Scenario")
        custom_ad = st.checkbox(
            "Instances use custom Active Directory DNS servers",
            value=True,
            key="dns_scenario_ad",
        )
        route53_private = st.checkbox(
            "Route 53 private names must resolve",
            value=True,
            key="dns_scenario_route53",
        )
        privatelink_dns = st.checkbox(
            "Interface endpoint / PrivateLink private DNS is required",
            value=False,
            key="dns_scenario_privatelink",
        )
        public_hostnames = st.checkbox(
            "Instances with public IPs need public DNS hostnames",
            value=False,
            key="dns_scenario_public",
        )
        change_dhcp = st.checkbox(
            "Existing DHCP options need different values",
            value=False,
            key="dns_scenario_change_dhcp",
        )

    with design_column:
        st.subheader("Design")
        custom_dhcp = st.checkbox(
            "Associate a custom DHCP options set",
            value=True,
            key="dns_design_custom_dhcp",
        )
        dns_hostnames = st.checkbox(
            "enableDnsHostnames = true",
            value=True,
            key="dns_design_hostnames",
        )
        dns_support = st.checkbox(
            "enableDnsSupport = true",
            value=True,
            key="dns_design_support",
        )
        ad_forwarding = st.checkbox(
            "AD forwards VPC-name queries to a Route 53 Resolver inbound "
            "endpoint",
            value=True,
            key="dns_design_forwarding",
        )
        replace_dhcp = st.checkbox(
            "Create and associate a replacement DHCP options set",
            value=True,
            key="dns_design_replace",
        )

    dns_scenario = DnsScenario(
        custom_active_directory_dns=custom_ad,
        route53_private_names_required=route53_private,
        private_link_private_dns_required=privatelink_dns,
        public_dns_hostnames_required=public_hostnames,
        change_existing_dhcp_options_required=change_dhcp,
    )
    dns_design = DnsDesign(
        use_custom_dhcp_options=custom_dhcp,
        enable_dns_hostnames=dns_hostnames,
        enable_dns_support=dns_support,
        ad_forwards_to_route53_resolver=ad_forwarding,
        replace_dhcp_options_set=replace_dhcp,
    )

    st.subheader("Evaluation")
    render_findings(evaluate_dns(dns_scenario, dns_design))

with practice_tab:
    st.header("Original practice scenarios and mistake-to-Anki export")
    st.caption(
        "These are original questions derived from the chapter's decision "
        "rules; "
        "they do not reproduce Tutorials Dojo mock questions."
    )

    if "practice_answers" not in st.session_state:
        st.session_state.practice_answers = {}
    practice_answers = cast(
        dict[str, int],
        st.session_state["practice_answers"],
    )

    question_number = st.select_slider(
        "Question",
        options=list(range(1, len(QUESTIONS) + 1)),
        value=1,
        key="practice_question_number",
    )
    question = QUESTIONS[question_number - 1]
    st.markdown(f"### {question_number}. {question.prompt}")
    answer = st.radio(
        "Choose one answer",
        options=list(range(len(question.options))),
        format_func=lambda index: question.options[cast(int, index)],
        key=f"practice_choice_{question.id}",
    )

    action_columns = st.columns(3)
    if action_columns[0].button(
        "Check answer",
        key=f"practice_check_{question.id}",
        type="primary",
    ):
        practice_answers[question.id] = answer

    checked_answer = practice_answers.get(question.id)
    if checked_answer is not None:
        if checked_answer == question.correct_index:
            st.success("Correct.")
        else:
            st.error(
                "Not quite. Correct answer: "
                f"{question.options[question.correct_index]}"
            )
        st.info(
            f"{question.explanation}\n\n**Source:** {question.source.label}"
        )

    checked_questions = {
        question_id: selected
        for question_id, selected in practice_answers.items()
    }
    question_by_id = {item.id: item for item in QUESTIONS}
    mistakes = [
        question_by_id[question_id]
        for question_id, selected in checked_questions.items()
        if selected != question_by_id[question_id].correct_index
    ]
    correct_count = len(checked_questions) - len(mistakes)

    st.divider()
    metrics = st.columns(3)
    metrics[0].metric("Checked", len(checked_questions))
    metrics[1].metric("Correct", correct_count)
    metrics[2].metric("Mistakes", len(mistakes))

    if mistakes:
        tsv = questions_to_anki_tsv(mistakes)
        st.download_button(
            "Download missed concepts as Anki TSV",
            data=tsv,
            file_name="aws_lab_mistakes.tsv",
            mime="text/tab-separated-values",
        )
    else:
        st.caption(
            "A downloadable Anki TSV appears after at least one checked "
            "mistake."
        )

    if action_columns[2].button("Reset practice history"):
        st.session_state.practice_answers = {}
        st.rerun()

with source_tab:
    st.header("What this first version covers")
    st.markdown(
        "The supplied chapter is broad enough for four linked laboratories, "
        "not "
        "just an Organizations screen. The app deliberately models only claims "
        "supported by that chapter."
    )
    st.dataframe(
        {
            "Module": [
                "Organization & access",
                "Provisioning",
                "Networking",
                "DNS",
            ],
            "Concepts": [
                (
                    "Landing-zone account separation; Organizations/OUs; "
                    "cross-account roles; SCPs; federation; directory sharing; "
                    "S3 cross-account access"
                ),
                (
                    "StackSets permission modes; organization targets; Service "
                    "Catalog; when to combine both"
                ),
                (
                    "VPC peering; Transit VPC; Transit Gateway; VPN; VGW; "
                    "Direct "
                    "Connect VIF and gateway patterns"
                ),
                (
                    "DHCP options; VPC DNS attributes; custom AD DNS; Route 53 "
                    "Resolver forwarding"
                ),
            ],
            "Guide pages": ["42–48", "49–51", "52–55", "56–58"],
        },
        hide_index=True,
        width="stretch",
    )
    st.warning(
        "Mentioned but not substantively specified in the supplied pages—"
        "such as AWS Control Tower, Security Hub, detailed consolidated "
        "billing, and RI "
        "sharing—are intentionally not graded in this version."
    )
    st.markdown(
        "**Rule-engine philosophy:** hard failures represent explicit "
        "prerequisite or capability conflicts in the chapter. Warnings "
        "represent a stated tradeoff or a pattern that only partially meets "
        "the selected requirements. A blank area means the source did not "
        "give enough information to grade it."
    )
