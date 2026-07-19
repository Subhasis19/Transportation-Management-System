# TruckLink TMS Setup

## Requirements

- Node.js 24
- A Supabase project with PostgreSQL and Storage enabled

## Install dependencies

```bash
git clone https://github.com/Subhasis19/Transportation-Management-System.git TruckLink-tms
cd TruckLink-tms

cd server
npm ci

cd ../client
npm ci
```

## Configure Supabase

1. Create a private Storage bucket named `tms-documents`.
2. Copy the PostgreSQL connection string from Supabase project settings.
3. Copy the project URL and service-role key from Supabase API settings.

The service-role key is server-only. Do not add it to the client or commit it to Git.

## Create environment files

Create `server/.env`:

```env
NODE_ENV="development"
PORT=5000
FRONTEND_URL="http://localhost:5173"
TRUST_PROXY="false"
DATABASE_URL="your-supabase-postgres-connection-string"
JWT_ACCESS_SECRET="at-least-32-characters"
JWT_REFRESH_SECRET="a-different-secret-of-at-least-32-characters"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
SUPABASE_STORAGE_BUCKET="tms-documents"
```

Create `client/.env`:

```env
VITE_API_URL="http://localhost:5000"
```

## Prepare the database

```bash
cd server
npm run generate
npx prisma migrate dev
npm run seed
```

## Run locally

Start the API:

```bash
cd server
npm run dev
```

Start the frontend in a second terminal:

```bash
cd client
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is available at `http://localhost:5000/health`.

## Production server commands

Run these from `server/`:

```bash
npm ci
npm run generate
npx prisma migrate deploy
npm run build
npm start
```

Set `NODE_ENV="production"`, configure the production `FRONTEND_URL`, and set `TRUST_PROXY="true"` when deploying behind a reverse proxy such as Render.

## Validate

```bash
cd server
npm test
npm run build

cd ../client
npm test
npm run build
```
