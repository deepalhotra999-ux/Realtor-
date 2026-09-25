# Subscriptions, plans and entitlements

Dwellwise launches **free**. Monetisation is fully data-driven and switched off by default.

## Admin settings (Admin → Settings → Monetization)

| Setting             | Default | Effect                                                          |
| ------------------- | ------- | --------------------------------------------------------------- |
| Subscription system | OFF     | Master switch. OFF = every feature is free.                     |
| Free trial          | ON      | Whether new subscriptions start with a trial.                   |
| Trial duration      | 14 days | Used when a plan doesn't define its own trial length.           |
| Free listings       | ∞       | Active listings allowed without a plan (applies in both modes). |
| Free agent accounts | ON      | OFF + subscriptions ON ⇒ pro accounts must pick a plan.         |
| Paid features       | none    | Feature keys that require a plan when subscriptions are ON.     |
| AI features         | ON      | Global kill switch for every `ai.*` feature.                    |
| Featured listings   | ON      | Global kill switch for `listings.featured`.                     |
| Advertising         | OFF     | Global kill switch for `marketing.ads`.                         |

## Model: Plans → Entitlements → Features

- **Feature** (`features` table): a gateable capability with a kind — `boolean`, `limit` or `metered` — e.g.
  `listings.active` (limit), `ai.requests` (metered), `crm.access` (boolean). The starter catalogue lives in
  `src/lib/entitlements/catalog.ts`; admins can add more.
- **Plan** (`plans`): price per month/year (minor units), trial days, audience, visibility, `is_default`.
  Admins create as many as they like.
- **Entitlement** (`plan_entitlements`): plan × feature → enabled + optional limit (NULL = unlimited).

No plan names or rules are hard-coded. The seed inserts editable templates (Starter, Agent Pro, Team, Brokerage,
Property Manager).

## Resolution order

`resolveEntitlement(feature, ctx)` in `src/lib/entitlements/engine.ts` (pure, unit-tested):

1. Globally disabled (kill switch)? → deny.
2. Subscription system OFF → allow; apply free allowances (e.g. free listings).
3. Feature not in _Paid features_ → allow (free feature).
4. User's effective subscription (active, in-trial, past-due grace, or cancelled-but-paid-through) grants it → allow with plan limit.
5. Default plan grants it → allow with its limit.
6. A positive free allowance exists → allow up to it.
7. Otherwise deny.

Server code calls `can()`, `assertCan()` (throws `EntitlementError`, also checks usage vs. limit) and
`recordUsage()` from `src/server/entitlements.ts`.

## Payments

Checkout goes through `PaymentProvider`. The default mock provider signs a short-lived session, shows a local
checkout page, and lets you simulate success or a decline. Subscriptions and payments are stored locally with the
provider name, so a Stripe adapter can be added later without changing billing logic.
