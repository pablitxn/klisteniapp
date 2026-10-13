<a id="invitaciones-acceso-a-la-nube-y-suscripciones"></a>

# Invitations, cloud access and subscriptions

Feature belongs to **explicitly operated instance**, with own API/DB/users. Public
demo neither creates accounts/consumes invitations nor offers checkout. Payments
default `disabled`; local example also disabled. [Separation/deployment](deployment.md).

Free device layer retained. Accounts add server persistence: each invitation
registration receives **15 days cloud access** from account creation. Checkout
is exclusively **Mercado Pago development**. Available code/tests establish no
configured merchant, actual payment or deployment.

<a id="alcance-del-producto"></a>

## Product scope

| Capability | Free device | Trial/current payment/lifetime account |
| --- | --- | --- |
| Catalog/animations/training | Yes | Yes |
| Routines/history/goals/available-data dashboards | Saved in browser | Saved in account |
| Personal export/import | Yes | Yes |
| Cross-device persistence/sync | No | Yes |
| Persistent account session | No account required | Valid session required |
| External health sync | Implementation pending | Implementation/provider enablement pending |

Health connectors are not sold as available. [Integration status](health-integrations.md)
separates Google Health API/Health Connect/existing file import.

Trial/paid-period expiry blocks **personal cloud writes**. User may log in/read/
export/delete records/manage access/use local app. Health deletion cannot add/
modify retained values. Expiry preserves history. Never treat
`402 CLOUD_ACCESS_REQUIRED` as saved or indefinitely retry payment-required writes.

Server owns access clock/dates. Browser clock/localStorage/password recovery/link
reuse does not restart trial. Expiry instant exclusive: access ends then.

<a id="invitaciones-para-amigos-y-publicaciones"></a>

## Invitations for friends and public posts

| Link type | Intended use | Limits |
| --- | --- | --- |
| Email-targeted invitation | Specific person | One use/24-hour expiry; choose trial/lifetime |
| Shareable link | Friends/post/community | Maximum registrations/expiry; always15-day trial |

Administrator creates links in account administration. Shareable permits1–10,000
registrations/expires1–90 days after issue. Validity enables registration, **not
changes each account's15 days**, which start at registration. Opening/previewing
consumes no slot. Account creation/slot consumption transaction prevents concurrent overflow.

Random tokens stored only as PostgreSQL hash, delivered via URL fragment
`#token=…`, removed by web. Lists never return token again: copy on creation.
Revocation blocks new registrations, not existing accounts; suspend account to block it.

Public shared link proves no recipient email ownership; `emailVerified=false`.
Do not use email as verified provider identity. Public password recovery retains
uniform response/SMTP delivery; administrator management remains available per
[accounts/operation](accounts.md).

<a id="acceso-vitalicio"></a>

## Lifetime access

Cloud entitlement separate from administrator role. Grants permanent cloud use
without administration permission, at invitation or for existing account.

Removing lifetime reevaluates original trial/paid periods, invents no trial.
Suspension still blocks login despite lifetime.

`account-access-v1` migration preserves existing beta accounts as lifetime on first
application: compatibility decision avoids charging earlier users. Repeated
migration does not grant lifetime to later accounts. Bootstrap administrator gets lifetime.

<a id="mercado-pago-contrato-y-referencia"></a>

## Mercado Pago: contract and reference

Optional Mercado Pago subscriptions API reconciles server-confirmed resources.
Each operator provisions dedicated application/test accounts; no credentials,
webhooks/shared services included in public repo.

Klisteni creates `POST /preapproval`, `pending`, opaque internal reference/test buyer
email/reason/return URL/**1 or12 months** recurrence in ARS. Server prices; browser
chooses `monthly`/`yearly`. No card data/second Mercado Pago trial. Buyer enters
payment method in provider-hosted `init_point`.
[Pending payment subscription](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments),
[creation reference](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/create-preapproval/post).

Subscription authorization permits charging, **does not prove payment**. Paid-period
update queries invoices/associated payment. Paginated
`GET /authorized_payments/search?preapproval_id=…&offset=…&limit=…`; each invoice
links `preapproval_id`/`payment.id`. [Invoices](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/get-authorized-payment/get),
[official SDK filters/pagination](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/invoice/search/types.ts).

Server checks ownership/seller/amount/currency/test mode/confirmed payment status.
Return URL/webhook body/checkout capture/`authorized` alone grants no access.
Repeated confirmations idempotent. Renewals extend confirmed period; rejected
payment does not. Canceling recurrence preserves already-paid period.

Lost creation response: reference persisted before provider call. Only first
attempt sends `POST /preapproval`; later searches test buyer subscriptions/exact
reference. Unlocated creation yields `CHECKOUT_UNCONFIRMED`, no second contract.
Selecting same plan recovers creation once provider exposes it. Never delete row/
change reference to bypass uncertainty; first check provider. Idempotency header
alone is not considered a sufficient duplication guarantee.

<a id="configuración"></a>

### Configuration

Beyond [accounts configuration](accounts.md), API uses:

| Variable | Value/purpose |
| --- | --- |
| `BILLING_MODE` | Default `disabled`; development `sandbox` |
| `MP_ACCESS_TOKEN` | Dedicated application's test seller credential |
| `MP_WEBHOOK_SECRET` | Application HMAC secret, at least32 characters |
| `MP_SANDBOX_PAYER_EMAIL` | Test buyer email replacing Klisteni account email in tests |
| `MP_MONTHLY_AMOUNT` | Positive ARS monthly amount, up to2 decimals |
| `MP_YEARLY_AMOUNT` | Positive ARS annual amount, up to2 decimals |
| `APP_ORIGIN` | HTTPS web/API origin for return/notifications |

No payment `production` mode in MVP. `NODE_ENV=production` hardens session/server,
not real billing. No secret in `VITE_*`, bundle/shared link/Git. Never infer environment
from token prefix: adapter verifies seller/rejects live-payment resources.

Authenticated routes: `GET /api/me/access`, `GET /api/me/billing`,
`POST /api/me/billing/checkout` with `{ "plan": "monthly" }` or
`{ "plan": "yearly" }`, `POST /api/me/billing/refresh`,
`POST /api/me/billing/cancel` with `{}`. Account derived from session; browser
writes also require allowed origin.

Instance server configuration owns `BILLING_MODE`/amounts, credentials injected
from operator secret manager. Requires HTTPS egress `api.mercadopago.com:443`, DB/DNS.
Adapt network policy/check egress before sandbox. Standard NetworkPolicy does not
filter hostname. Migrations need no Mercado Pago queries.

`POST /api/billing/webhook` receives external notifications. Excluding browser-cookie
protection does not trust body: valid signature/canonical provider reconciliation
required. Other `/api` authentication unchanged. HTTPS/correct API route, no cache/HTML fallback.

<a id="particularidad-de-las-notificaciones"></a>

### Notification limitation

Topics: `subscription_preapproval`, `subscription_authorized_payment`, `payment`.
Signature secret validates notice; canonical query confirms invoices/payments.
[Subscription webhooks](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).

Official documentation consulted October 4, 2026 excludes subscriptions from dashboard
notification setup/refers to creation-time configuration, while SDK
`PreApprovalRequest` exposes no `notification_url`. Verify automatic delivery with
specific test application/account. Existing route alone is not operational webhook.
[SDK contract](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/preApproval/commonTypes.ts).

If provider cannot configure/deliver notice, **Actualizar estado** requeries invoices/
payments. No signature exception or return-parameter manual activation. Production
billing not ready until delivery/periodic reconciliation actually validated.

<a id="prueba-manual-de-desarrollo"></a>

## Manual development test

1. Isolated development DB/migrations/administrator per [accounts](accounts.md).
   First verify registration/recovery/persistence without payments.
2. Dedicated Mercado Pago app/test seller/buyer, distinct/same country; adapter
   expects Argentina. Exact test-account data, never personal account.
   [Test accounts](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/your-integrations/test/accounts).
3. Provide variables/development HTTPS routing web/`/api`. Preserve existing local
   storage origin; separate test profile.
4. Shareable invitation/redeem test Klisteni user/check15 days. Monthly plan opens
   Mercado Pago checkout/still identifies test.
5. Sign in test buyer/use official test-card table. At documented review, approved
   fixture: Visa credit `4509 9535 6623 3704`, code `123`, expiry `11/30`, holder
   `APRO`, DNI `12345678`. Reopen table if form/date changes; no real card.
   [Test cards](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/your-integrations/test/cards).
6. Return/refresh. Server-query-confirmed `live_mode=false`, expected amount/currency/
   paid period. Retain sanitized IDs/status only, no tokens/cookies/passwords/personal data.
7. Repeat refresh/redeliver notice where available: no repeated period addition.
   Annual with another account/check12-month recurrence. Initial test payment does
   not establish future renewal.
8. `OTHE` rejected/`CONT` pending per provider table; neither grants paid access.
   Unsupported subscription scenario: record exact limit, no real credentials/cards.
9. Cancel/check provider/Klisteni state; current approved payment access lasts to end date.

Disposable-user automated tests: invalid signature/foreign payment/wrong amount-
currency/live sandbox resource/refund/concurrent capacity/revoked link/repeated
registration/exact trial end/post-expiry export. Simulated provider tests do not replace steps4–9.

<a id="publicación-y-recuperación"></a>

## Publication and recovery

Release needs account/billing migration before UI enablement. Preserve earlier
accounts through compatibility migration/check new user trial. Retain
`BILLING_MODE=disabled` until development setup verified.

Provider issue: `BILLING_MODE=disabled` stops checkout without deleting history/
lifetime/confirmed periods. **Does not cancel Mercado Pago contracts**; explicitly
cancel test subscriptions/confirm response. Never delete billing tables for rollback;
follow Klisteni DB recovery/preserve reconciliation references.

Rollback requires `account_access`-compatible API enforcing cloud access. Earlier
API may accept writes beyond trial/paid expiry. Frontend rollback/disabled billing
needs no account/table deletion.

Real charging needs explicit production mode/definitive credentials-prices/seller-
environment validation/notification delivery/periodic missed-notice recovery/agreed
refund behavior/full tests. MVP keeps decisions separate from free invitation/local use.
