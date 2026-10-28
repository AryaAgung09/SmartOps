# SmartOps

SmartOps is an enterprise-style operations management platform for coordinating people operations, attendance, employee requests, leave, payroll, finance, and company documents.

## Project overview

The application is a role-aware internal ERP-style workspace. Its Next.js App Router UI communicates with server-side API routes, which enforce session and feature access before reading or changing relational data through Prisma.

### Main modules

- **Dashboard** - role-appropriate operational summaries, recent activity, and shortcuts.
- **Employee management** - employee directory, details, profile editing, and import workflows.
- **User management** - user accounts, roles, and employee-account association.
- **Attendance** - clock-in/out, attendance history and reports, and correction requests with review.
- **Requests** - employee-submitted requests with details, editing, and approval workflows.
- **Leave and time off** - leave requests, balances, and review.
- **Payroll** - payroll periods and records, including employee self-service payroll views.
- **Finance** - dashboard, vendors, budgets, expenses, invoices, payments, and payroll-period views.
- **Documents** - document center, upload, details, and editing.
- **Notifications** - notification list, unread count, and mark-as-read interaction.
- **Profile** - the signed-in user's profile.
- **Feature Access** - administrator-facing role access configuration.
- **HR Dashboard** - workforce summaries and recent activity.

Performance Management is not presented as an implemented application module.

## User roles and access

The source defines these roles: `ADMIN`, `HR`, `STAFF`, `IT`, `FINANCE`, `GENERAL_AFFAIR`, `MARKETING`, `SALES`, `LOGISTICS`, and `OUTSOURCING`.

Feature defaults are role-based. Feature Access can also use persisted role-feature settings, so actual access depends on the application's current configuration. The navigation and server-side API checks enforce access; this README does not define or override permissions.

## Technology stack

- Next.js 16 App Router
- React 19
- NextAuth.js 4 with the Credentials provider and JWT sessions
- Prisma ORM 7
- MariaDB/MySQL through Prisma's MariaDB driver adapter
- ESLint 9

## Architecture

- `src/app/(app)` contains authenticated application pages.
- `src/app/api` contains server-side API route handlers used by the UI.
- `src/components` contains shared application navigation and UI components.
- `src/lib` contains shared authorization, database, and workflow helpers.
- `src/auth.js` configures sign-in and session callbacks; `src/proxy.js` guards application routes.
- `prisma/schema.prisma` defines the relational data model; `prisma/migrations` contains versioned database migrations.

Typical request flow:

1. A user signs in with email and password.
2. NextAuth verifies the stored password hash and issues a JWT-backed session.
3. The application route/API checks authentication and configured feature access.
4. An authorized API handler uses Prisma to read or persist data in MariaDB/MySQL.
5. The UI displays the result and handles loading, empty, and error states.

## Local development

### Prerequisites

- Node.js compatible with the installed Next.js version
- npm
- A local or development MariaDB/MySQL database

### Install and configure

```bash
npm install
```

Create a local `.env` file and configure:

```dotenv
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/smartops"
NEXTAUTH_SECRET="replace-with-a-long-random-local-secret"
```

The application and seed script can also use the following database connection variables when `DATABASE_URL` is not set:

```dotenv
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD=""
DB_NAME="smartops"
```

Keep `.env` and all credentials private. Use a distinct database and secret for each environment; never use local demo credentials or secrets in production.

### Database setup

Prisma reads the schema and datasource URL through `prisma.config.ts`.

For a new local development database:

```bash
npx prisma generate
npx prisma migrate dev
```

To apply already-created migrations in a deployment environment:

```bash
npx prisma migrate deploy
```

The optional seed command is:

```bash
npx prisma db seed
```

Run seed only against a fresh, isolated local/demo database. Review `prisma/seed.ts` first: it upserts demo accounts and department data and must not be used against a production database.

### Run the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run lint
npm run build
```

There is currently no test script defined in `package.json`.
