from __future__ import annotations

from aws_multi_account_lab.models import (
    NetworkDesign,
    NetworkScenario,
    OrganizationDesign,
    OrganizationScenario,
)


def organization_dot(
    scenario: OrganizationScenario,
    design: OrganizationDesign,
) -> str:
    lines = [
        "digraph organization {",
        "  rankdir=TB;",
        '  graph [pad="0.2", nodesep="0.35", ranksep="0.45"];',
        '  node [shape=box, style="rounded"];',
    ]

    if not design.use_organizations:
        lines.append(
            f'  standalone [label="{scenario.account_count} standalone accounts"];'
        )
        lines.append("}")
        return "\n".join(lines)

    lines.extend(
        [
            '  management [label="Management / master account"];',
            '  root [shape=folder, label="Organization root"];',
            '  management -> root [style=dashed, label="governs"];',
        ]
    )
    displayed_accounts = 1

    workload_parent = "root"
    if design.separate_environment_accounts:
        lines.extend(
            [
                '  nonprod [shape=folder, label="Non-production OU"];',
                '  prod [shape=folder, label="Production OU"];',
                "  root -> nonprod;",
                "  root -> prod;",
                '  dev [label="Development account"];',
                '  qa [label="QA / staging account"];',
                '  production [label="Production account"];',
                "  nonprod -> dev;",
                "  nonprod -> qa;",
                "  prod -> production;",
            ]
        )
        displayed_accounts += 3
        workload_parent = "root"
    else:
        lines.extend(
            [
                '  workloads [shape=folder, label="Workloads OU"];',
                "  root -> workloads;",
                '  shared_workload [label="Shared lifecycle account"];',
                "  workloads -> shared_workload;",
            ]
        )
        displayed_accounts += 1
        workload_parent = "workloads"

    if design.logging_account or design.security_account:
        lines.extend(
            [
                '  security_ou [shape=folder, label="Security OU"];',
                "  root -> security_ou;",
            ]
        )
        if design.logging_account:
            displayed_accounts += 1
            lines.extend(
                [
                    '  logging [label="Central logging account"];',
                    "  security_ou -> logging;",
                ]
            )
        if design.security_account:
            displayed_accounts += 1
            lines.extend(
                [
                    '  security [label="Security account"];',
                    "  security_ou -> security;",
                ]
            )

    if design.admin_shared_services_account:
        displayed_accounts += 1
        lines.extend(
            [
                '  shared_ou [shape=folder, label="Shared services OU"];',
                '  admin [label="Administration / shared services account"];',
                "  root -> shared_ou;",
                "  shared_ou -> admin;",
            ]
        )

    if scenario.account_count > displayed_accounts:
        remaining = scenario.account_count - displayed_accounts
        lines.extend(
            [
                f'  extra [label="+ {remaining} additional accounts"];',
                f"  {workload_parent} -> extra;",
            ]
        )

    if design.scp_strategy != "none":
        label = f"SCP: {design.scp_strategy} at {design.scp_scope}"
        lines.append(f'  scp [shape=note, label="{label}"];')
        if design.scp_scope == "root":
            lines.append("  scp -> root [style=dotted];")
        elif design.scp_scope == "ou":
            target = "nonprod" if design.separate_environment_accounts else "workloads"
            lines.append(f"  scp -> {target} [style=dotted];")
        else:
            target = (
                "dev"
                if design.separate_environment_accounts
                else "shared_workload"
            )
            lines.append(f"  scp -> {target} [style=dotted];")

    lines.append("}")
    return "\n".join(lines)


def network_dot(
    scenario: NetworkScenario,
    design: NetworkDesign,
) -> str:
    lines = [
        "digraph network {",
        "  rankdir=LR;",
        '  graph [pad="0.2", nodesep="0.35", ranksep="0.45"];',
        '  node [shape=box, style="rounded"];',
    ]

    vpc_count = min(scenario.vpc_count, 5)
    vpc_names = [f"vpc_{index}" for index in range(1, vpc_count + 1)]
    for index, name in enumerate(vpc_names, start=1):
        region = 1 + ((index - 1) % max(1, scenario.region_count))
        lines.append(f'  {name} [label="VPC {index}\nRegion {region}"];')

    if design.vpc_connectivity == "vpc_peering":
        for left, right in zip(vpc_names, vpc_names[1:], strict=False):
            lines.append(f'  {left} -> {right} [dir=both, label="peering"];')
    elif design.vpc_connectivity == "transit_vpc":
        lines.append('  hub [shape=ellipse, label="Transit VPC\nVPN/BGP hub"];')
        for name in vpc_names:
            lines.append(f'  {name} -> hub [dir=both, label="VPN"];')
    elif design.vpc_connectivity == "transit_gateway":
        lines.append('  hub [shape=ellipse, label="Transit Gateway"];')
        for name in vpc_names:
            lines.append(f"  {name} -> hub [dir=both];")

    if scenario.vpc_count > vpc_count:
        lines.append(
            f'  extra [label="+ {scenario.vpc_count - vpc_count} VPCs"];'
        )
        if design.vpc_connectivity in {"transit_vpc", "transit_gateway"}:
            lines.append("  extra -> hub [dir=both];")

    if scenario.on_premises_connectivity_required:
        lines.append('  onprem [shape=house, label="On-premises"];')
        attachment = {
            "none": "",
            "site_to_site_vpn": "Site-to-Site VPN",
            "vgw_per_vpc": "VPN to VGW(s)",
            "dx_private_vif_to_vgw": "DX private VIF → VGW",
            "dx_gateway_to_vgws": "DX gateway → VGWs",
            "dx_transit_vif_to_tgw": "Transit VIF → DXGW → TGW",
            "vpn_to_tgw_over_dx_public_vif": "VPN over DX public VIF",
        }[design.hybrid_connectivity]
        if attachment:
            target = (
                "hub"
                if design.vpc_connectivity in {"transit_vpc", "transit_gateway"}
                else vpc_names[0]
            )
            lines.append(
                f'  onprem -> {target} [dir=both, label="{attachment}"];'
            )

    lines.append("}")
    return "\n".join(lines)
