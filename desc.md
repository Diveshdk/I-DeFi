# ENS-First Personalized DeFi Wallet and Market Assistant

## Short abstract
This project builds an ENS-native DeFi assistant: during login it maps user preferences and wallet addresses to the user’s ENS identity, then delivers a personalized market feed and "best buys" derived from past transactions. Users can swap tokens and send funds using ENS names instead of long hex addresses (for example, `divesh.eth`). A risk-monitoring module can issue alerts or offer an optional transaction-freeze during unsafe or crisis scenarios, using multi-channel notifications (email, SMS, in-app) to help users secure funds when needed.

## Problem statement
Cryptocurrency UX commonly exposes long hexadecimal addresses, generic market data, and limited, non-personalized guidance. Users need simpler payments, tailored trading suggestions, and proactive protection when markets or global events create risk.

## Solution overview
On first login the app collects required preferences and wallet addresses and (with explicit consent) maps them to the user's ENS name. A personalization engine analyzes on-chain history to present a customized market feed and ranked "best buys". Users can send tokens and execute swaps using ENS names instead of raw addresses. A risk-monitoring service detects unsafe conditions (high volatility, suspicious destinations, global crises) and can notify the user or temporarily block transactions per user policy.

## Key features
- Onboarding that captures preferences and wallet addresses and links them to ENS.
- ENS-native identity: user-facing records and mappings anchored to the ENS name.
- Personalized market feed and best-buy recommendations based on transaction history and holdings.
- ENS-based sending: resolve ENS names to addresses for transfers and swaps (e.g., send 0.1 ETH to `divesh.eth`).
- In-app token swaps via integrated DEX router.
- Risk & crisis handling (ideation): alerts and an optional freeze to stop or delay risky transactions.
- Multi-channel notifications: in-app, email, SMS.
- Privacy controls and opt-in telemetry.

## Technical approach
- Client: Web/mobile front-end with wallet integrations (MetaMask, WalletConnect) to collect addresses and preferences at login.
- ENS mapping: use ENS resolution libraries to read/write ENS profile pointers (with explicit user consent) or store an off-chain mapping keyed by ENS.
- Personalization engine: an on-chain indexer or third-party node provider ingests transactions, derives signals (frequency, preferred tokens, trade sizes) and scores opportunities.
- Swap/send flow: resolve ENS → address, show transaction preview, route swaps through existing DEX router contracts.
- Risk monitoring: stream market data and event feeds; run heuristics/ML to detect volatility, flagged regions, or suspicious destinations; the policy engine triggers alerts or optional pre-signature freezes.
- Notifications: integrate with transactional email (SendGrid) and SMS (Twilio) plus in-app push.

## Data & privacy
- Collects minimal data: ENS name, wallet addresses, preference flags (opt-in).
- Sensitive details remain client-side where possible; aggregated signals power personalization without exposing raw transaction details.
- Users can unlink ENS mappings and revoke consent at any time.

## Architecture (concise)
- Client: wallet UI, ENS resolver, feed/swap UI, notification preferences.
- Optional Backend: indexer/processor, personalization engine, risk monitor, notification gateway, ENS mapping service.
- On-chain: DEX router interactions and optional on-chain freeze guard (user-controlled multisig/time-lock patterns).

## Success metrics
- Reduction in friction: time-to-send using ENS vs long address.
- Engagement: click-through / conversion rate on recommended "best buys".
- Safety: reduction in user-reported unsafe transactions and positive response to alerts.

## Risks & mitigations
- Gas cost for ENS writes — mitigate with off-chain pointers and explicit consent.
- False positives in freeze logic — make freezing optional, reversible, and transparent with override paths.
- Legal/regulatory concerns about blocking transactions — keep control user-first; freezes should be local or user-controlled multisig/time-locked contracts.

## Future work
- Cross-chain name resolution and multi-chain ENS-like lookups.
- On-device ML for personalization to further reduce backend data needs.
- Additional alert channels (Telegram, WhatsApp) and richer reputation signals.

## Ideation: Freeze & Crisis Alerts
In crisis scenarios (extreme volatility, geopolitical events, widespread scams) the system can:
- Notify users through configurable channels (email, SMS, in-app) with clear recommended actions.
- Offer a temporary, user-controlled "freeze" that prevents transaction execution until the user re-authorizes, or route transactions through safer flows (time-locks, multi-sig approvals).
- Provide contextual warnings and reputation checks for ENS names and resolved addresses.

## Submission-ready one-paragraph pitch
An ENS-first DeFi assistant that maps login-time preferences and wallet addresses to the user's ENS identity, providing a personalized market feed and "best buys" based on past transactions. Users can send tokens and perform swaps using ENS names (e.g., `divesh.eth`) rather than long hex addresses, and an optional risk-monitoring module issues alerts or freezes to help secure funds during unsafe or crisis situations via email, SMS, and in-app notifications.

---
_File created/updated: `desc.md` — contains the full project description and ideation details for submission._
