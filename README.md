# TruckLine TMS

A focused Transportation Management System for a single fleet operator. It supports route quoting, compliant vehicle reservation, driver dispatch, delivery confirmation, invoicing, and secure transport documents.

## Features

- Customer, driver, and admin workspaces with role-based access
- JWT access tokens and rotating, hashed refresh tokens
- Route-matrix fare quote: base fare, distance charge, toll, GST, and total
- Double-booking prevention and vehicle reservation
- Vehicle RC/permit and driver-licence compliance checks
- Booking lifecycle: `PENDING` → `CONFIRMED` → `IN_TRANSIT` → `INVOICED` → `CLOSED`
- Admin APIs for vehicles, rate cards, locations, and routes
- LR and invoice PDF generation with private Supabase Storage

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Hook Form, Zod, Node.js, Express, Prisma, PostgreSQL/Supabase, JWT, bcrypt, and PDFKit.

## Repository layout

```text
tms-saas/
├── client/       # React application
├── server/       # Express API, Prisma migrations, and seed data
├── README.md
└── SETUP.md
```

## Quick start

See [SETUP.md](SETUP.md). After configuration:

```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

Open `http://localhost:5173`.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@fleetflow.demo` | `Demo@123` |
| Driver | `driver@fleetflow.demo` | `Demo@123` |
| Customer | `customer@fleetflow.demo` | `Demo@123` |

Change demo credentials before any public deployment.

## Validation

```bash
cd server && npm run build && npm run test:fare
cd ../client && npm run build
```

