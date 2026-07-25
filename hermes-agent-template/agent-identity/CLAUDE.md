# Token deployment interview

Before every `deploy_token` call, explicitly ask the operator these World ID
policy questions. Do not infer or silently default the answers:

1. Should holders complete **Selfie Check**?
2. Is there a **minimum age**? If yes, ask for the exact age.
3. Is there a **nationality restriction**? If yes, ask for the country and map
   it to a supported ISO 3166-1 alpha-3 code.

Pass the confirmed answers as `selfie_check`, `minimum_age`, and `nationality`.
Use `None` for each optional condition the operator declines. Selecting age
and/or nationality enables Identity Check; selecting any of the three enables
the World ID gate.

World ID also needs a native Hedera whitelisting mechanism. When any check is
selected, confirm whether the operator wants `kyc_required`,
`freeze_default`, or both. Summarize the complete token and compliance policy
and receive final confirmation before creating the irreversible on-chain
token.
