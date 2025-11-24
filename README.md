# Broadcast Metadata Management System

A comprehensive web application for managing broadcast server metadata with auto-incrementing IDs, role-based access control, and multi-group support.

## Features

- **Metadata Management**: Create, edit, browse, and export metadata files with 25+ fields
- **Auto-Incrementing IDs**: Format xxx-xxx-xxx with automatic generation
- **Role-Based Access Control (RBAC)**:
  - Granular permissions (read, write)
  - File visibility scopes (own, group, all)
  - User status management (pending, active, archived)
  - Admin panel for user and group management
- **Hybrid Authentication**:
  - Username/password with bcrypt hashing
  - Google OAuth integration (optional) (not working yet)
- **Batch Operations**: Create multiple episodes at once
- **Export Functionality**: XLSX and XML export formats
- **Multi-Group Support**: Users can belong to multiple groups with group-based file visibility

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express.js, Passport.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Local strategy + Google OAuth
- **Session Management**: PostgreSQL-backed sessions

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Initialize database:
   ```bash
   npm run db:push
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## Production Deployment

For self-hosting on your own server with Docker, see [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Quick Docker Deployment

**Option A: External Database** (Default - Recommended for Neon, AWS RDS, etc.)

```bash
# Configure environment with your external DATABASE_URL
cp .env.example .env
# Edit .env and set DATABASE_URL=postgresql://user:pass@host/db

# Start with Docker Compose (default)
docker-compose up -d

# Create first admin user (see DEPLOYMENT.md)
```

**Option B: Included PostgreSQL** (Complete self-hosted solution)

```bash
# Configure environment
cp .env.example .env
# Edit .env with DATABASE_URL and POSTGRES_PASSWORD

# Start with Docker Compose (use postgres variant)
docker-compose -f docker-compose-with-postgres.yml up -d

# Create first admin user (see DEPLOYMENT.md)
```

## First Admin User Setup

After deployment, you need to create the first admin user manually:

```bash
# Generate a password hash
docker-compose exec app node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 12))"

# Connect to database and insert admin user
docker-compose exec postgres psql -U postgres -d metadata_db

INSERT INTO users (id, email, password, first_name, last_name, status, can_read, can_write, can_edit, is_admin, file_visibility_scope)
VALUES (gen_random_uuid()::text, 'admin@yourdomain.com', 'PASTE_HASH_HERE', 'Admin', 'User', 'active', 1, 1, 1, 1, 'all');
```

## Environment Variables

See `.env.example` for all available configuration options.

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
  - Local Docker: `postgresql://postgres:password@postgres:5432/metadata_db`
  - External (e.g., Neon): `postgresql://user:pass@host.region.neon.tech/db?sslmode=require`
- `SESSION_SECRET`: Secret for session encryption (min 32 characters)
- `POSTGRES_PASSWORD`: Only needed when using the included PostgreSQL container

**Optional:**
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_CALLBACK_URL`: Google OAuth callback URL

**Examples:**

```bash
# Using included PostgreSQL (Docker Compose)
DATABASE_URL=postgresql://postgres:mypass@postgres:5432/metadata_db
POSTGRES_PASSWORD=mypass
SESSION_SECRET=$(openssl rand -base64 32)

# Using external database (Neon, AWS RDS, etc.)
DATABASE_URL=postgresql://user:pass@ep-example.region.neon.tech/dbname?sslmode=require
SESSION_SECRET=$(openssl rand -base64 32)
# No POSTGRES_PASSWORD needed
```

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                # Backend Express application
│   ├── auth.ts           # Authentication strategies
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database abstraction layer
│   └── index.ts          # Server entry point
├── shared/               # Shared code between client/server
│   └── schema.ts         # Database schema and validation
├── Dockerfile            # Docker image configuration
├── docker-compose.yml    # Docker Compose orchestration
└── DEPLOYMENT.md         # Deployment guide
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Register new user
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Get current user
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback

### Metadata Files
- `GET /api/metadata` - List all files (with pagination)
- `GET /api/metadata/:id` - Get single file
- `POST /api/metadata` - Create new file
- `PATCH /api/metadata/:id` - Update file
- `DELETE /api/metadata/:id` - Delete file
- `POST /api/metadata/batch` - Create batch of files
- `GET /api/metadata/next-id` - Get next auto-incremented ID
- `GET /api/metadata/recent` - Get recent files

### Export
- `GET /api/export/:id/json` - Export file as JSON
- `GET /api/export/:id/xml` - Export file as XML
- `POST /api/export/batch/json` - Export multiple files as JSON
- `POST /api/export/batch/xml` - Export multiple files as XML

### Admin (Admin Only)
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id` - Update user permissions
- `GET /api/admin/groups` - List all groups
- `POST /api/admin/groups` - Create group
- `DELETE /api/admin/groups/:id` - Delete group

## User Permissions

### User Status
- **Pending**: New registrations, no access until approved by admin
- **Active**: Full access based on assigned permissions
- **Archived**: Account disabled, no access

### Permissions
- **Read**: View metadata files
- **Write**: Create new metadata files
- **Edit**: Modify existing metadata files

### File Visibility
- **Own**: See only files created by the user
- **Group**: See files from users in the same group(s)
- **All**: See all files in the system

## Security Features

- Password hashing with bcrypt (12 rounds)
- Session management with PostgreSQL storage
- CSRF protection
- Permission-based access control
- Tenant isolation for multi-group support
- Field whitelisting for user updates

