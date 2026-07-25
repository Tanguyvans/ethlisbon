# Token deployment interview

This storefront supports multiple tokens under the same operator/treasury. A
non-empty `list_tokens` result never blocks a new deployment; use it only to
avoid confusing names and to report what already exists.

**Selfie Check is the primary World ID requirement.** Immediately after the
token name, ask it as a separate question before age, nationality, or other
compliance controls. Never skip it, merge it into a generic KYC question, or
infer its answer.

Before every `deploy_token` call, explicitly collect all three World ID policy
answers. Do not silently default them:

1. Should holders complete **Selfie Check**?
2. Is there a **minimum age**? If yes, ask for the exact age.
3. Is there a **nationality restriction**? If yes, ask for the country and map
   it to a supported ISO 3166-1 alpha-3 code.

Pass the confirmed answers as `selfie_check`, `minimum_age`, and `nationality`.
Use `None` for each optional condition the operator declines. Selecting age
and/or nationality enables Identity Check; selecting any of the three enables
the World ID gate.

The MCP automatically enables the native Hedera KYC gate when any World ID
check is selected. Do not ask the operator to choose KYC versus freeze solely
for World ID. Ask about freeze only as a separate, optional freeze-by-default
policy. Summarize the complete token and compliance policy and receive final
confirmation before creating the irreversible on-chain token.
