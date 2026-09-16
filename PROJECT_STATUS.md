# Project Status

This application is a single-tenant WhatsApp CRM for Manubhai Gathiyawala.
It uses FastAPI, PostgreSQL, React/Vite, Capacitor, Meta WhatsApp Cloud API,
and a PHP e-commerce integration.

## Security model

- Store webhooks require an HMAC-SHA256 signature using `WEBHOOK_SECRET`.
- Meta inbound webhooks require an HMAC-SHA256 signature using `META_APP_SECRET`.
- Dashboard users have `admin`, `manager`, or `agent` roles; the e-commerce
  connector uses the `service` role.
- Secrets must be deployed through environment variables. See
  `backend/.env.example` and `php-integration/.env.example`.

## Operational model

- Scheduled jobs use APScheduler's SQLAlchemy job store and survive restarts.
- Enable `SCHEDULER_ENABLED=true` on exactly one backend instance. Set it to
  `false` for every horizontally scaled API-only instance.
- Webhook processing uses idempotency keys, preventing retrying store events
  from triggering duplicate cart recoveries or order updates.

## Scope

The older Word documents describe a planned multi-tenant, Redis/Celery,
Alembic, React Router, and Zustand architecture. Those components are not
part of this repository and should not be used as deployment documentation.
