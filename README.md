# Future Driving School — Windows Desktop Application

A full-stack, enterprise-grade **Windows Desktop Application** engineered for **Future Driving School**. This system automates customer vehicle document compliance, automated daily expiry calculation, WhatsApp and SMS reminder dispatching, and complete renewal history audit trails.

---

## 🌟 Key Features

1. **Desktop Application (Windows EXE)**:
   - Packaged with **Electron** & **electron-builder** as an installable `.exe` and portable standalone application.
   - Built-in lifecycle management: starts the backend API automatically and handles window controls.

2. **Customer & Fleet Management**:
   - Single-step customer + vehicle + multi-document onboarding.
   - Support for custom document types (Insurance, Fitness Certificate / FC, Road Tax, Pollution, Permits, etc.).
   - Full CRUD operations with search and filter capabilities.

3. **Intelligent Expiry Calculation & Tracking**:
   - Timezone-aware date calculations anchored to **Asia/Kolkata (IST)**.
   - Real-time status classifications:
     - 🟢 **ACTIVE**: Compliant, > 30 days remaining
     - 🔵 **UPCOMING**: 16 to 30 days remaining
     - 🟡 **DUE SOON**: 8 to 15 days remaining (triggers 15-day reminder)
     - 🔴 **CRITICAL**: &le; 7 days remaining (triggers daily reminder)
     - ⏰ **EXPIRES TODAY**: 0 days remaining
     - ❌ **EXPIRED**: Past expiration date
     - 🟣 **RENEWED**: Archived validity version

4. **Automated Reminders & Multi-Channel Dispatcher**:
   - Daily cron scheduler running at **08:00 AM IST**.
   - Generates notifications for 15-day and 7-day daily countdowns.
   - **Duplicate Prevention**: Multi-tier unique constraints ensure a customer is never spammed twice for the exact same document expiration event on the same calendar day.
   - **WhatsApp Business API** and **SMS Gateway** integration-ready services with automatic logging and delivery tracking.
   - **Auto-Cancellation**: Pending reminders are automatically cancelled upon document renewal.

5. **Complete Audit & Renewal History**:
   - Every renewal preserves the old document validity history, tracks previous start/end dates, and records the admin username who performed the renewal.
   - Dedicated **Notification Logs** and **Renewal History** dashboards.

6. **Modern, Responsive Glassmorphism UI**:
   - Dark mode & Light mode toggle.
   - High-contrast visual cues and status badges.
   - Instant search by customer name, phone number, or vehicle number.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **PostgreSQL**: Local or remote database server

---

### 1. Database & Environment Configuration

Ensure PostgreSQL is running and update `server/.env`:

```env
NODE_ENV="development"
PORT="3001"
CORS_ORIGIN="http://localhost:5173"

# PostgreSQL Connection String
DATABASE_URL="postgresql://postgres:Aspec@localhost:5432/future_driving_school"

# JWT Secrets
JWT_ACCESS_SECRET="your_secure_access_secret"
JWT_REFRESH_SECRET="your_secure_refresh_secret"

# Scheduler Configuration
SCHEDULER_ENABLED="true"
SCHEDULER_CRON="0 8 * * *"
TIMEZONE="Asia/Kolkata"
```

Run database migration & default admin seed:
```bash
npm run db:migrate
npm run db:seed
```

Default Admin Credentials:
- **Username**: `admin`
- **Password**: `Admin@123456`

---

### 2. Running in Development

Run both Express API (Port 3001) and React Frontend (Port 5173):
```bash
npm run dev
```

Run inside Desktop Electron window:
```bash
npm run dev:electron
```

---

### 3. Building Windows Desktop EXE Installer

To build the standalone Windows installer and portable `.exe`:
```bash
npm run dist:win
```

The output installers will be generated inside the `dist-electron/` directory:
- `Future Driving School Setup 1.0.0.exe` (NSIS Installer)
- `Future Driving School 1.0.0.exe` (Portable Executable)

---

## 📁 Project Architecture

```
future-driving-school/
├── client/                     # React 19 + Vite + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/         # Shared UI, Badges, Layout
│   │   ├── features/
│   │   │   ├── auth/           # Login & Auth State
│   │   │   ├── customers/      # Customer List, Detail, New, Edit
│   │   │   ├── documents/      # Master Document Expiry & Renewal Modal
│   │   │   ├── notifications/  # WhatsApp/SMS Dispatcher History
│   │   │   ├── renewals/       # Complete Renewal Audit Trail
│   │   │   ├── home/           # KPI Dashboard & Urgent Alerts
│   │   │   ├── dashboard/      # Advanced Search & Multi-Filter
│   │   │   └── settings/       # Theme, Password, Scheduler Trigger
│   │   ├── lib/api.ts          # Axios API Client
│   │   └── types/index.ts      # TypeScript Type Definitions
├── server/                     # Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/
│   │   ├── schema.prisma       # PostgreSQL Schema
│   │   └── seed.ts             # Admin User Seeder
│   └── src/
│       ├── controllers/        # Express Route Handlers
│       ├── services/           # Core Business Logic & Schedulers
│       │   ├── customer.service.ts
│       │   ├── document.service.ts
│       │   ├── documentStatus.service.ts
│       │   ├── scheduler.service.ts
│       │   ├── notification.service.ts
│       │   ├── renewal.service.ts
│       │   ├── whatsapp.service.ts
│       │   └── sms.service.ts
│       └── utils/dateHelpers.ts # IST Timezone Math
├── electron/
│   ├── main.cjs                # Electron Main Process & Server Spawner
│   └── preload.cjs             # IPC Context Bridge
└── package.json                # Workspaces & Electron Builder Configuration
```

---

## 🔒 Security & Best Practices
- **No static/mock customer data**: Every customer, vehicle, document, and notification log lives in PostgreSQL.
- **Transactional integrity**: Document renewals and notifications use Prisma database transactions.
- **Audit logging**: All mutations (create, update, delete, renew) record the admin ID and timestamp.
