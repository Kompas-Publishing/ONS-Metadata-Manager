# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Development Commands
```bash
# Install dependencies
npm install

# Start development server (serves both frontend and backend)
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Push database schema changes
npm run db:push

# Start production server
npm start
```

### Docker Commands
```bash
# External database (default - recommended)
docker-compose up -d

# With included PostgreSQL
docker-compose -f docker-compose-with-postgres.yml up -d
```

## Architecture Overview

This is a full-stack metadata management application with the following key architectural components:

### Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui components
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js (local + Google OAuth)
- **Session Management**: PostgreSQL-backed sessions

### Project Structure
- `client/` - React frontend application
  - `src/components/` - Reusable UI components (shadcn/ui based)
  - `src/pages/` - Page components for different routes
  - `src/hooks/` - Custom React hooks (useAuth, etc.)
  - `src/lib/` - Utility functions and configuration
- `server/` - Express backend application
  - `index.ts` - Main server entry point with middleware setup
  - `routes.ts` - All API endpoints and business logic
  - `storage.ts` - Database abstraction layer using Drizzle
  - `auth.ts` & `authSetup.ts` - Authentication strategies and middleware
  - `permissions.ts` - Role-based access control logic
  - `ai-service.ts` & `ai-chat.ts` - AI integration features
- `shared/` - Shared TypeScript code
  - `schema.ts` - Database schema definitions and Zod validation schemas
- `api/` - Vercel serverless functions (for production deployment)

### Database Schema (Key Tables)
- **users**: User accounts with role-based permissions and group assignments
- **groups**: User groups for file visibility control
- **metadataFiles**: Core metadata files with 25+ fields for broadcast content
- **licenses**: Content licensing information
- **series**: Series/show information with relationships to licenses
- **tasks**: Task tracking for metadata files
- **sessions**: Session storage for authentication

### Authentication & Authorization
- **Role-Based Permissions**: Read/write permissions for metadata, licenses, tasks, AI features
- **File Visibility Scopes**: "own" (user's files), "group" (group files), "all" (system-wide)
- **User Status**: pending → active → archived lifecycle
- **Multi-Group Support**: Users can belong to multiple groups

### Key Features
- **Auto-Incrementing IDs**: Format xxx-xxx-xxx with automatic generation
- **Batch Operations**: Create multiple episodes at once with complex season/episode logic
- **Export Functionality**: XLSX and XML export formats
- **AI Integration**: Content analysis and chat features (Google Generative AI)
- **Multi-format Support**: Handle various content types (Series, Movies, Documentaries)

### API Architecture
- RESTful API design with Express routes in `server/routes.ts`
- All endpoints use authentication middleware and permission checking
- Frontend uses React Query for data fetching and state management
- WebSocket support for real-time features

### Frontend Architecture
- React Router (using Wouter for routing)
- Component-based architecture with shadcn/ui design system
- Form handling with react-hook-form + Zod validation
- Responsive design with TailwindCSS
- State management via React Query and React Context (useAuth)

### Database Operations
- All database operations go through `server/storage.ts` abstraction layer
- Uses Drizzle ORM for type-safe database queries
- Complex relationships between metadata, licenses, and series
- Automatic timestamp management for created/updated fields

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key (32+ characters)
- `POSTGRES_PASSWORD` - For included PostgreSQL container
- Optional: Google OAuth credentials for authentication

## Common Patterns

### Adding New Database Fields
1. Update schema in `shared/schema.ts`
2. Run `npm run db:push` to update database
3. Update validation schemas in same file
4. Update frontend forms and display components

### Adding New API Endpoints
1. Add route handler in `server/routes.ts`
2. Implement database operations in `server/storage.ts`
3. Add permission checks using `requirePermission()`
4. Update frontend API calls and React Query hooks

### Permission System
Use `requirePermission()` middleware for route protection:
- `canReadMetadata`, `canWriteMetadata`
- `canReadLicenses`, `canWriteLicenses`  
- `canReadTasks`, `canWriteTasks`
- `canUseAI`, `canUseAIChat`
- `isAdmin` for administrative functions