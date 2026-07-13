# Setup Instructions

## Prerequisites

- Node.js 20+
- Git
- A Supabase project with PostgreSQL and Storage

## Install

```bash
git clone https://github.com/YOUR_USERNAME/tms-saas.git
cd tms-saas
(cd server && npm install)
(cd client && npm install)
```

## Supabase

1. Create a **private** Storage bucket named `tms-documents`.
2. Copy the database connection string from **Project Settings → Database**.
3. Copy the project URL and **service-role key** from **Project Settings → API**. The service-role key is server-only and must never be used in React.

## Environment files

Copy `server/.env.example` to `server/.env` and fill in all values:

```env
DATABASE_URL="your-supabase-postgres-connection-string"
PORT=5000
FRONTEND_URL="http://localhost:5173"
JWT_ACCESS_SECRET="a-long-random-secret"
JWT_REFRESH_SECRET="a-different-long-random-secret"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
SUPABASE_STORAGE_BUCKET="tms-documents"
```

Copy `client/.env.example` to `client/.env`:

```env
VITE_API_URL="http://localhost:5000"
```

Never put secrets, database URLs, or the service-role key in `client/.env`; `VITE_` values are visible in the browser.

## Database and demo data

```bash
cd server
npx prisma generate
npx prisma migrate dev
npm run seed
```

## Run

```bash
# terminal 1
cd server
npm run dev
```

```bash
# terminal 2
cd client
npm run dev
```

Visit `http://localhost:5173`.

## Demo walkthrough

1. Customer: quote Delhi → Jaipur and reserve a compliant vehicle.
2. Admin: assign the seeded driver, confirm, then mark departure.
3. Driver: submit a delivery note.
4. Admin: close the invoiced trip.

## Before GitHub

```bash
cd server && npm run build && npm run test:fare
cd ../client && npm run build
git status
```

The root `.gitignore` excludes `.env`, `node_modules`, build folders, and generated Prisma files. Never force-add `.env` files.
