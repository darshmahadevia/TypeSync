# TypeSync

A collaborative rich-text editor with live cursors, document sharing, and an AI co-editor. Write together in real time and review AI suggestions before they change the document.

[Try TypeSync](https://typesync.darshmahadevia.tech)

## What you can do

- Edit together with live cursors and collaborator presence.
- Write rich text with tables, task lists, images, code blocks, and slash commands.
- Share documents by email with owner, editor, and viewer permissions.
- Ask AI to rewrite, shorten, fix grammar, or follow a custom instruction. Suggestions stream to collaborators for review and remain in shared history.
- Search and sort your documents, and export them as HTML, plain text, or JSON.

## How it works

TipTap handles the editor, while Yjs merges concurrent edits using a conflict-free replicated data type, or CRDT. Socket.IO carries document updates and presence between clients and the Express server. REST endpoints handle document management and sharing. PostgreSQL stores document state and AI suggestion history.

Sync, permissions, and AI acceptance follow these rules:

- The client queues pending edits and retries delivery after reconnecting. It marks a document as synced only after the server confirms PostgreSQL persistence.
- The server enforces document permissions when collaborators join and submit edits.
- Yjs relative positions keep AI suggestions attached to selected text as surrounding text moves. Before acceptance, TypeSync checks the original text, formatting, and character identity. A changed passage blocks acceptance.

## Built with

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TipTap |
| Collaboration | Yjs, Socket.IO |
| Backend | Node.js, Express, PostgreSQL, Drizzle ORM |
| Auth and AI | Better Auth, Resend, OpenRouter |

The npm workspace separates the frontend in `client/`, backend in `server/`, and shared schemas and socket contracts in `shared/`.

## Run locally

Use Node.js 24 or later, npm, and Docker.

1. Install dependencies, start PostgreSQL, and copy the environment template.

   ```sh
   npm install
   docker compose up -d
   cp server/.env.example server/.env
   ```

2. Edit `server/.env`. Set `BETTER_AUTH_SECRET` to a random secret of at least 32 characters. Set `RESEND_API_KEY` and `EMAIL_FROM` to credentials and a sender for your verified Resend domain. Signup requires email verification, including in development. The template's database and localhost URLs match the local setup.

   To enable AI suggestions, also set `OPENROUTER_API_KEY`. Without it, document editing still works.

3. Apply migrations and start the app.

   ```sh
   npm run db:migrate
   npm run dev
   ```

Open [localhost:5173](http://localhost:5173), create an account, and verify your email before signing in. The backend runs on port 3000.

Run `npm run check` for lint, type checks, regression tests, and a production build.

## Production deployment

Vercel builds `client/` and serves [typesync.darshmahadevia.tech](https://typesync.darshmahadevia.tech). Render builds the root Dockerfile and serves [api.typesync.darshmahadevia.tech](https://api.typesync.darshmahadevia.tech). Both deploy from the GitHub repository's `main` branch. `render.yaml` records the backend configuration. Neon hosts PostgreSQL. Resend sends verification emails from `no-reply@mail.typesync.darshmahadevia.tech`.

Set `VITE_API_URL=https://api.typesync.darshmahadevia.tech` in Vercel's production environment. Keep database credentials, the auth secret, and provider keys in Render's environment settings. The migration login owns the schema. The runtime login has table access only.

Run `node scripts/verify-deployment.mjs` to check the public frontend, database readiness, auth endpoint, CORS, and Socket.IO handshake. To check provider URLs before custom DNS is ready, set `FRONTEND_URL`, `BACKEND_URL`, and `CLIENT_ORIGIN`. Keep `CLIENT_ORIGIN=https://typesync.darshmahadevia.tech` to match the server's allowed origin.

## Diagnose failed HTTP requests

Express responses include a generated `X-Request-ID`. Each completed response with status 400 or higher emits one `Request failed` record. It includes the request ID, final status, allowlisted method, a known route template when available, and failure kind. Match the browser response header to the server log. Request records omit concrete URLs, query strings, headers, bodies, document and user IDs, and raw errors.

These records cover completed Express responses. Socket.IO failures, requests rejected before Express, and aborted responses need separate diagnostics. Other application and dependency logs follow their own rules.

## Diagnose email delivery

Successful verification sends log Resend's accepted message ID. To receive delivery events, create a TypeSync webhook in Resend for `POST https://<backend-host>/api/webhooks/resend`. Subscribe to `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`, `email.complained`, and `email.suppressed`. Save its signing secret as `RESEND_WEBHOOK_SECRET` on the backend, deploy, and then enable the endpoint. Omit this variable to disable the route. An invalid configured signing secret prevents startup.

Match the accepted `messageId` to the delivery logs. Webhook events cover the Resend account and may include other applications' messages. A delivery event means the recipient's mail server accepted the email. It does not confirm inbox placement or that someone read it. Resend retries and replays can produce duplicate log entries. The handler acknowledges duplicates but does not track delivery state or guarantee exactly-once processing.

## Deployment database credentials

Set `MIGRATION_DATABASE_URL` to the PostgreSQL login that owns the schema and runs migrations. Production requires this variable.

Set `DATABASE_URL` to a separate runtime login. Grant `CONNECT` on the database and `USAGE` on the public schema and `collaborator_role` enum. Grant `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `user`, `session`, `account`, `verification`, `document`, and `document_collaborator`. Keep schema creation, table ownership, and the Drizzle migration ledger restricted to the migration login. Configure both URLs to verify the database server's TLS certificate.

Docker runs migrations first, removes `MIGRATION_DATABASE_URL` from the environment, and starts the server as PID 1. A failed migration prevents server startup. The migration credential remains in the hosting provider's configuration.

Locally, migration commands use `DATABASE_URL` when `MIGRATION_DATABASE_URL` is omitted. An explicit empty or invalid migration URL fails.

When changing an existing deployment, add `MIGRATION_DATABASE_URL` before deploying this version. Verify that deployment before changing `DATABASE_URL` to the restricted login. Rolling back to a version without this credential split also requires restoring the schema owner's `DATABASE_URL`.

## Deployment shutdown

Give the server at least 30 seconds after SIGTERM before forcibly killing it. At 20 seconds, if draining has not finished, the server starts a document flush or reuses one already running. The flush has up to five more seconds to finish. A 30-second host grace period leaves five seconds of margin. Failed or timed-out shutdowns exit with a nonzero status.

[Render's default shutdown delay](https://render.com/docs/deploys#graceful-shutdown) is 30 seconds. Keep it at 30 seconds or longer. For Docker, set `docker run --stop-timeout 30` when creating the server container, or `stop_grace_period: 30s` for a Compose server service. [Docker's default for Linux containers](https://docs.docker.com/reference/cli/docker/container/run/#stop-timeout) is only 10 seconds. The Compose file in this repository starts PostgreSQL only.
