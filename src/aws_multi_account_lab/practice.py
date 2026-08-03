from __future__ import annotations

from aws_multi_account_lab import knowledge
from aws_multi_account_lab.models import PracticeQuestion


QUESTIONS: tuple[PracticeQuestion, ...] = (
    PracticeQuestion(
        id="scp-permission-ceiling",
        prompt=(
            "A role has an IAM policy that allows an API action. The SCP path "
            "for its member account does not allow that action. What happens?"
        ),
        options=(
            "The action succeeds because IAM grants it.",
            "The action is denied because the SCP path is a permission ceiling.",
            "The action succeeds only when the user is MFA-authenticated.",
            "The action is delegated to the management account.",
        ),
        correct_index=1,
        explanation=(
            "An SCP determines which actions are available to principals in the "
            "member account, but does not itself grant permission. Both the SCP "
            "path and IAM must permit the action, and explicit deny wins."
        ),
        source=knowledge.SCP,
        tags=("organizations", "scp", "iam"),
    ),
    PracticeQuestion(
        id="scp-all-features",
        prompt=(
            "An organization wants to attach SCPs to its OUs, but it is not "
            "operating with all features enabled. What is the key blocker?"
        ),
        options=(
            "SCPs require all features to be enabled.",
            "SCPs can be attached only to individual accounts.",
            "SCPs require a Direct Connect gateway.",
            "SCPs work only with standalone accounts.",
        ),
        correct_index=0,
        explanation=(
            "The chapter makes all-features mode a prerequisite for using SCPs."
        ),
        source=knowledge.SCP,
        tags=("organizations", "scp"),
    ),
    PracticeQuestion(
        id="cross-account-role",
        prompt=(
            "Administrators need access to several member accounts without "
            "maintaining a separate IAM user in each account. Which pattern is "
            "directly intended for this?"
        ),
        options=(
            "S3 Requester Pays",
            "A cross-account IAM role",
            "A DHCP options set",
            "A public virtual interface",
        ),
        correct_index=1,
        explanation=(
            "A cross-account role lets a trusted principal in another account "
            "assume permissions in the target account without a duplicated user."
        ),
        source=knowledge.CROSS_ACCOUNT_ROLES,
        tags=("iam", "cross-account", "roles"),
    ),
    PracticeQuestion(
        id="directory-org-share",
        prompt=(
            "AWS Managed Microsoft AD is to be shared through AWS Organizations. "
            "Which combination matches the chapter's prerequisites?"
        ),
        options=(
            (
                "All features enabled, same Region, and the directory in the "
                "management/master account"
            ),
            "Consolidated billing only and a directory in any external account",
            "A public VIF and an S3 bucket policy",
            "A VPC peering connection with no organization",
        ),
        correct_index=0,
        explanation=(
            "The organization-sharing path in the supplied guide requires all "
            "features, same-Region sharing, and the directory in the organization's "
            "management/master account."
        ),
        source=knowledge.DIRECTORY_AND_FEDERATION,
        tags=("directory-service", "organizations", "identity"),
    ),
    PracticeQuestion(
        id="s3-requester-pays",
        prompt=(
            "A partner account reads objects from your bucket and should bear the "
            "request cost. Which feature addresses the charging requirement?"
        ),
        options=(
            "S3 Requester Pays",
            "CloudFormation StackSets",
            "Transit Gateway",
            "IAM Identity Center",
        ),
        correct_index=0,
        explanation=(
            "Requester Pays moves the modeled request-cost responsibility to the "
            "authenticated requester. Cross-account object access still needs an "
            "appropriate bucket policy."
        ),
        source=knowledge.S3_CROSS_ACCOUNT,
        tags=("s3", "cross-account", "cost"),
    ),
    PracticeQuestion(
        id="stacksets-standard-baseline",
        prompt=(
            "A platform team already has one CloudFormation template and wants to "
            "push the same baseline into many accounts and Regions. Which mechanism "
            "is the direct fit?"
        ),
        options=(
            "CloudFormation StackSets",
            "VPC peering",
            "SAML federation",
            "Requester Pays",
        ),
        correct_index=0,
        explanation=(
            "StackSets extend a CloudFormation template across selected accounts "
            "and Regions from an administrator account."
        ),
        source=knowledge.STACKSETS,
        tags=("cloudformation", "stacksets", "governance"),
    ),
    PracticeQuestion(
        id="service-catalog-self-service",
        prompt=(
            "Teams need a controlled menu of approved infrastructure products and "
            "should be able to choose permitted parameters without editing IaC. "
            "Which mechanism best matches that interaction model?"
        ),
        options=(
            "AWS Service Catalog",
            "An SCP by itself",
            "A Direct Connect gateway",
            "A DHCP options set",
        ),
        correct_index=0,
        explanation=(
            "Service Catalog presents approved products and constraints to end "
            "users as provisioned products."
        ),
        source=knowledge.SERVICE_CATALOG,
        tags=("service-catalog", "self-service", "governance"),
    ),
    PracticeQuestion(
        id="stacksets-and-catalog",
        prompt=(
            "An enterprise needs approved self-service products and also needs to "
            "distribute them consistently across accounts and Regions. Which design "
            "covers both concerns in the chapter?"
        ),
        options=(
            "Service Catalog only",
            "StackSets only",
            "StackSets together with Service Catalog",
            "VPC peering together with IAM users",
        ),
        correct_index=2,
        explanation=(
            "The combined pattern uses StackSets for multi-account/multi-Region "
            "distribution and Service Catalog for controlled user choice."
        ),
        source=knowledge.PROVISIONING_COMPARISON,
        tags=("stacksets", "service-catalog", "multi-region"),
    ),
    PracticeQuestion(
        id="peering-transitivity",
        prompt=(
            "VPC A peers with B, and B peers with C. No direct A-C peering exists. "
            "Can A route to C through B using only these peerings?"
        ),
        options=(
            "Yes, peering is transitive by default.",
            "Yes, when all VPCs are in one account.",
            "No, VPC peering is non-transitive.",
            "No, because VPC peering never works across Regions.",
        ),
        correct_index=2,
        explanation=(
            "VPC peering does not provide transitive routing. A direct peering or a "
            "transit architecture is needed."
        ),
        source=knowledge.VPC_PEERING,
        tags=("vpc", "peering", "routing"),
    ),
    PracticeQuestion(
        id="tgw-hub-spoke",
        prompt=(
            "Many VPCs need centralized hub-and-spoke and transitive routing, plus "
            "the hub may later attach VPN or Direct Connect. Which service matches "
            "the chapter's managed pattern?"
        ),
        options=(
            "AWS Transit Gateway",
            "A mesh of DHCP options sets",
            "S3 Requester Pays",
            "One bucket policy per VPC",
        ),
        correct_index=0,
        explanation=(
            "Transit Gateway is the managed regional transit hub described for VPC, "
            "VPN, and Direct Connect attachments."
        ),
        source=knowledge.TRANSIT_CONNECTIVITY,
        tags=("transit-gateway", "vpc", "routing"),
    ),
    PracticeQuestion(
        id="dxgw-vpc-transit",
        prompt=(
            "A private VIF connects to a Direct Connect gateway associated with "
            "VGWs in several Regions. The company also needs those VPCs to route to "
            "one another through this design. What is the issue?"
        ),
        options=(
            "Direct Connect gateway does not provide the required VPC-to-VPC transit.",
            "Direct Connect gateway works only with public VIFs.",
            "VGWs cannot attach to VPCs.",
            "The design requires S3 Requester Pays.",
        ),
        correct_index=0,
        explanation=(
            "The guide explicitly notes that the Direct Connect gateway-to-VGW "
            "pattern is not a VPC-to-VPC connectivity mechanism."
        ),
        source=knowledge.HYBRID_CONNECTIVITY,
        tags=("direct-connect", "dx-gateway", "routing"),
    ),
    PracticeQuestion(
        id="dx-transit-vif",
        prompt=(
            "A large hybrid estate has many VPCs in multiple locations and needs a "
            "scalable Direct Connect attachment. Which pattern does the chapter call "
            "the most scalable and manageable?"
        ),
        options=(
            "One private VIF and VGW per VPC",
            "A transit VIF to a Direct Connect gateway associated with Transit Gateway",
            "A separate Internet gateway for every account",
            "VPC peering over a public VIF",
        ),
        correct_index=1,
        explanation=(
            "The supplied section favors the transit VIF + Direct Connect gateway + "
            "Transit Gateway architecture for multiple VPCs and locations."
        ),
        source=knowledge.HYBRID_CONNECTIVITY,
        tags=("direct-connect", "transit-vif", "transit-gateway"),
    ),
    PracticeQuestion(
        id="dhcp-options-immutable",
        prompt=(
            "A VPC needs different custom DNS servers than those in its current DHCP "
            "options set. What operation matches the chapter?"
        ),
        options=(
            "Edit the current set in place.",
            "Create a new DHCP options set and associate it with the VPC.",
            "Attach a second DHCP options set simultaneously.",
            "Disable all VPC route tables.",
        ),
        correct_index=1,
        explanation=(
            "DHCP options sets are treated as immutable: create a replacement and "
            "associate it. A VPC has one associated set at a time."
        ),
        source=knowledge.DNS,
        tags=("dns", "dhcp", "vpc"),
    ),
    PracticeQuestion(
        id="vpc-dns-attributes",
        prompt=(
            "A VPC will use Route 53 private hosted-zone names and interface endpoint "
            "private DNS. Which VPC attribute state matches the chapter?"
        ),
        options=(
            "Only enableDnsHostnames is true.",
            "Only enableDnsSupport is true.",
            "Both enableDnsHostnames and enableDnsSupport are true.",
            "Both attributes are false.",
        ),
        correct_index=2,
        explanation=(
            "The supplied guide requires both attributes for the modeled private "
            "hosted-zone and PrivateLink private-DNS behavior."
        ),
        source=knowledge.DNS,
        tags=("route53", "dns", "privatelink"),
    ),
)

for _question in QUESTIONS:
    _question.validate()
