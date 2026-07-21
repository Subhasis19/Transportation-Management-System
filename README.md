# TruckLink TMS

Live demo: https://transportation-management-system-ochre.vercel.app/


TruckLink is a Transportation Management System for a single fleet operator. It supports vehicle quoting, booking, dispatch, delivery confirmation, invoicing, and secure transport documents.

## Capabilities

- Role-based customer, driver, and administrator workspaces
- Route-based vehicle quotes with fare, toll, and GST calculation
- Transactional vehicle reservation to prevent double booking
- Driver, vehicle, and document compliance checks
- Booking lifecycle from reservation through trip closure
- Private lorry receipt and invoice PDF storage

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, TypeScript, Zod, JWT, bcrypt
- Data: PostgreSQL, Prisma, Supabase Storage
- Documents: PDFKit

## Project structure

```text
.
├── client/          React application
├── server/          Express API, Prisma schema, migrations, and seed data
├── README.md
└── SETUP.md
```

## Quick start

Follow [SETUP.md](SETUP.md) to configure Supabase and environment variables. Then run the API and frontend in separate terminals:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@trucklink.demo` | `Demo@123` |
| Driver | `driver@trucklink.demo` | `Demo@123` |
| Customer | `customer@trucklink.demo` | `Demo@123` |

## Common commands

| Area | Command | Purpose |
| --- | --- | --- |
| Server | `npm run dev` | Start the development API |
| Server | `npm run build` | Compile the production API |
| Server | `npm start` | Run the compiled API |
| Server | `npm test` | Run server tests |
| Server | `npm run generate` | Generate Prisma Client |
| Server | `npm run seed` | Seed demo data |
| Client | `npm run dev` | Start the Vite development server |
| Client | `npm run build` | Build the production frontend |
| Client | `npm test` | Run client tests |

## Documentation

- [Setup guide](SETUP.md)
- API health check: `GET /healthz`
