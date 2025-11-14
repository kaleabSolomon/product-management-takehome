# Product Management API

NestJS/TypeScript backend for a lightweight marketplace. It covers user onboarding, product management, checkout initiation with Chapa, and the full order lifecycle.

## Overview

- **Auth & Users** – JWT-based auth with profile/password management.
- **Products** – Owners create/update/delete inventory, while the public can read active listings and stock status.
- **Orders** – Buyers place orders, obtain a Chapa checkout URL, and webhook verification finalizes stock movement; product owners can review/update status.

## Architecture Highlights

- Modules: `auth`, `user`, `product`, `order`, each with DTOs, services, controllers.
- TypeORM/Postgres with soft deletion (status flags) and migrations under `src/migrations`.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker

### Environment Variables

Create `.env` in the repo root (sample values shown):

```
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5400
DB_USER=user
DB_PASSWORD=password
DB_DATABASE=db

AT_SECRET=super-secret-jwt-key
AT_EXPIRESIN=15m

CHAPA_TEST_SECRET_KEY=your-chapa-test-key
CHAPA_WEBHOOK_SECRET=your-webhook-secret
CALLBACK_URL=https://your-domain.com
```

> When using Docker Compose the DB\_\* values already match the bundled Postgres service.

### Local Installation & Run

```bash
pnpm install
pnpm migration:run      # applies TypeORM migrations (requires Postgres up)
pnpm start:dev          # watch mode on http://localhost:3000
```

Swagger UI lives at `http://localhost:${PORT}/api`.

### Docker Compose (Recommended)

```bash
docker compose up --build
```

or you can use the start script

```bash
./start_dev.sh
```

Services:

- `db` – Postgres 15 exposed on `localhost:5400`
- `app` – NestJS server on `localhost:3000`

### Webhook Tunneling (zrok/ngrok/etc.)

`POST /orders/verify` must be reachable from Chapa’s servers. For local development you’ll need to expose your machine through a tunneling service (ngrok, Cloudflare Tunnel, etc.). I used [zrok](https://zrok.io) to stand up a secure OpenZiti-powered tunnel—after running `zrok invite` ➝ `zrok enable` ➝ `zrok share http 3000`, it returns a public URL you can drop into `CALLBACK_URL` and your Chapa dashboard so webhooks reach the local server.

### Chapa Email Requirement

Chapa blocks obviously fake emails (e.g., `user@example.com`) during checkout initialization. When testing locally, sign up with a real mailbox you control or use a forwarding alias so payment attempts aren’t rejected.

## Short API Guide

| Module  | Method & Path                   | Notes                                                |
| ------- | ------------------------------- | ---------------------------------------------------- |
| Auth    | `POST /auth/signup`             | Public registration, returns JWT                     |
| Auth    | `POST /auth/signin`             | Public login, returns JWT                            |
| User    | `GET /user/me`                  | Fetch current profile                                |
| User    | `PATCH /user/me`                | Update profile fields                                |
| User    | `PATCH /user/me/password`       | Rotate password (requires current password)          |
| Product | `POST /product`                 | Create product (owner = caller)                      |
| Product | `PUT /products/adjust`          | Update price/stock/status (blocks setting `DELETED`) |
| Product | `GET /products`                 | Authenticated list (non-deleted)                     |
| Product | `GET /products/me`              | Caller’s products                                    |
| Product | `GET /products/:productId`      | Public view for active & in-stock items              |
| Product | `GET /status/:productId`        | Public availability snapshot                         |
| Product | `DELETE /products/:productId`   | Soft delete (owner only)                             |
| Order   | `POST /orders`                  | Create order & receive Chapa checkout URL            |
| Order   | `POST /orders/verify`           | Webhook endpoint validating `x-chapa-signature`      |
| Order   | `GET /orders/me`                | Buyer’s orders (`status` query supported)            |
| Order   | `GET /orders/my-products`       | Orders for caller’s products                         |
| Order   | `GET /orders/:orderId`          | Buyer or product owner can view                      |
| Order   | `PATCH /orders/:orderId/status` | Product owner updates status & stock                 |

All authenticated routes expect `Authorization: Bearer <token>`. DTO validation + schema metadata are visible in Swagger.

## Assumptions & Trade-offs

- **JWT-only session model** – Single short-lived access token (`AT_EXPIRESIN`); refresh tokens omitted for brevity.
- **Payment lifecycle** – Orders flip to `successful` only after Chapa verification; failures default to `failed` without automated retries/refunds.
- **Inventory consistency** – Stock is checked before order creation and again during verification; no optimistic locking, but verification revalidates quantity before decrementing.
- **Soft deletion** – Products move to `DELETED` instead of being removed, ensuring historical orders remain intact.
- **Filtering** – Order listings filter primarily by status; additional filters can be layered onto the existing query builders.

---
