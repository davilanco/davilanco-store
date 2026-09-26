# Davilanco Store — fresh Cloudflare build

This repository is a new implementation and intentionally does **not** depend on the old GitHub tree.

## Stack

- Astro SSR + `@astrojs/cloudflare`
- Cloudflare Workers/Pages-compatible deployment
- Cloudflare D1 for users, products, carts, orders, payments, shipments, messages and notifications
- No Cloudflare R2 dependency
- Server-side PBKDF2 password hashing and hashed session tokens
- Paystack, Flutterwave, PayPal and bank-transfer payment architecture
- Resend-compatible transactional email integration
- Configurable SMS provider integration

## Routes

Public: `/`, `/products`, `/product/[slug]`, `/categories`, `/signup`, `/login`, `/verify-email`, `/cart`

Authenticated: `/dashboard`, `/checkout`, `/messages`

Seller: `/seller`

Admin: `/admin`, `/setup-admin`

System: `/robots.txt`, `/sitemap.xml`, `/api/*`

## Cloudflare setup

1. Create a D1 database named `davilanco_store` and put its ID in `wrangler.toml`.
2. Run `npm install`.
3. Run `npm run db:migrate:remote`.
4. Run `npm run db:seed:remote`.
5. Set secrets with Wrangler, especially `ADMIN_BOOTSTRAP_SECRET`, `RESEND_API_KEY`, `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, and PayPal credentials if those gateways will be enabled.
6. Set `PUBLIC_SITE_URL=https://shop.davilanco.com` and configure the custom domain on Cloudflare.
7. Visit `/setup-admin` once, create the first Admin, then rotate/remove the bootstrap secret.
8. Deploy with `npm run deploy`.

## Email/SMS

Email is sent through the configured Resend API credentials. SMS uses a generic JSON POST provider adapter (`SMS_PROVIDER_URL` + `SMS_PROVIDER_TOKEN`) so you can connect an African/Nigerian provider without changing checkout logic.

## Seller documents without R2

Because this version is explicitly designed to run without R2, seller application documents can be uploaded directly into D1 as small BLOBs (maximum 700KB per document), or the form can use secure external document URLs. Admin-only document routes protect stored uploads. For higher document volume, move this table to an external object store later without changing the seller-application data model.

## Product imports

Admin can import up to 200 products from an HTTPS JSON/CSV feed. Configure `ALLOWED_IMPORT_HOSTS` for production. AliExpress pages should not be scraped blindly; connect an authorized AliExpress/API/affiliate feed or export feed to the importer.

## Payments

- Bank transfer: order is created as pending; bank instructions and transaction reference are emailed/SMSed; Admin verifies the transfer and releases the order.
- Paystack: server-side initialization and gateway verification.
- Flutterwave: server-side initialization and gateway verification.
- PayPal: sandbox/live OAuth and checkout-order creation are included. The amount is converted from NGN to USD using the simple configurable baseline in the starter implementation; replace this with your live FX source before production use.

## Security notes before launch

- Set strong random secrets in Cloudflare, never commit `.env`.
- Configure a real email sender and SMS provider.
- Configure payment webhook endpoints in the gateway dashboards for asynchronous verification; the included callback is the browser-return path.
- Add rate limiting/WAF rules for authentication and setup routes.
- Review Nigerian privacy/data-retention obligations before storing identity documents.
- Replace the seed bank details before accepting bank transfers.
