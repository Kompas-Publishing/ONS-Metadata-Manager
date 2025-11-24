# Vercel Deployment Migration Guide

This document outlines the changes made to migrate from Express server to Vercel serverless functions.

## What's Been Done

### 1. Authentication System Conversion ✅

- **Replaced** session-based auth (`express-session` + `connect-pg-simple`) with JWT tokens
- **Created** JWT utilities in `server/jwt.ts`:
  - `signToken(user)` - Generate JWT for user
  - `verifyToken(token)` - Verify and decode JWT
  - `extractTokenFromHeader()` - Parse Authorization header
  - `extractTokenFromCookie()` - Parse cookie header

- **Created** API middleware in `api/_lib/apiHandler.ts`:
  - `authenticate()` - Extract and verify JWT from request
  - `requireAuth()` - Middleware to enforce authentication
  - `requirePermission()` - Middleware to check user permissions
  - `requireAdmin()` - Middleware for admin-only routes
  - `withCors()` - CORS handling
  - `apiHandler()` - Base wrapper for all API routes

### 2. Auth Routes Converted ✅

| Old Route | New Route | Status |
|-----------|-----------|--------|
| POST `/api/auth/register` | `api/auth/register.ts` | ✅ Done |
| POST `/api/auth/login` | `api/auth/login.ts` | ✅ Done |
| POST `/api/auth/logout` | `api/auth/logout.ts` | ✅ Done |
| GET `/api/auth/user` | `api/auth/user.ts` | ✅ Done |

### 3. Core Metadata Routes Converted ✅

| Old Route | New Route | Status |
|-----------|-----------|--------|
| GET `/api/metadata` | `api/metadata/index.ts` | ✅ Done |
| POST `/api/metadata` | `api/metadata/index.ts` | ✅ Done |
| GET `/api/metadata/next-id` | `api/metadata/next-id.ts` | ✅ Done |
| GET `/api/metadata/recent` | `api/metadata/recent.ts` | ✅ Done |
| GET `/api/metadata/:id` | `api/metadata/[id].ts` | ✅ Done |
| PATCH `/api/metadata/:id` | `api/metadata/[id].ts` | ✅ Done |
| DELETE `/api/metadata/:id` | `api/metadata/[id].ts` | ✅ Done |
| POST `/api/metadata/batch` | `api/metadata/batch.ts` | ✅ Done |

### 4. Stats Route Converted ✅

| Old Route | New Route | Status |
|-----------|-----------|--------|
| GET `/api/stats` | `api/stats.ts` | ✅ Done |

### 5. Frontend Updates ✅

- **Updated** `client/src/lib/queryClient.ts`:
  - Added `getAuthHeaders()` to include JWT in Authorization header
  - Stores JWT token in `localStorage`
  - Sends token with every API request

- **Updated** `client/src/hooks/use-auth.tsx`:
  - Stores JWT token on login
  - Clears JWT token on logout

### 6. Configuration Files ✅

- **Created** `vercel.json` - Vercel deployment configuration
- **Updated** `package.json` - Added `vercel-build` script
- **Installed** dependencies:
  - `jsonwebtoken` + `@types/jsonwebtoken`
  - `cookie`
  - `@vercel/node`

## Routes Still To Convert

The following routes from `server/routes.ts` still need to be converted to Vercel API routes:

### Metadata Routes (Remaining)

```typescript
// Bulk update
PATCH /api/metadata/bulk-update → api/metadata/bulk-update.ts

// Season routes
GET /api/metadata/season/:title/:season → api/metadata/season/[title]/[season].ts

// Download routes
GET /api/metadata/:id/download → api/metadata/[id]/download.ts
GET /api/metadata/download/series/:title/:format → api/metadata/download/series/[title]/[format].ts
GET /api/metadata/download/season/:title/:season/:format → api/metadata/download/season/[title]/[season]/[format].ts

// Adjacent episodes
GET /api/metadata/adjacent/:title/:season/:episode → api/metadata/adjacent/[title]/[season]/[episode].ts
```

### User Tags Routes

```typescript
GET /api/user-tags/:type → api/user-tags/[type].ts
POST /api/user-tags → api/user-tags/index.ts
DELETE /api/user-tags/:id → api/user-tags/[id].ts
```

### Admin Routes

All admin routes require `requireAdmin()` middleware:

```typescript
// User management
GET /api/admin/users → api/admin/users/index.ts
PATCH /api/admin/users → api/admin/users/index.ts (bulk update)
PATCH /api/admin/users/:id/status → api/admin/users/[id]/status.ts
PATCH /api/admin/users/:id/permissions → api/admin/users/[id]/permissions.ts
PATCH /api/admin/users/:id/visibility → api/admin/users/[id]/visibility.ts
PATCH /api/admin/users/:id/groups → api/admin/users/[id]/groups.ts
DELETE /api/admin/users/:id → api/admin/users/[id]/index.ts

// Group management
GET /api/admin/groups → api/admin/groups/index.ts
POST /api/admin/groups → api/admin/groups/index.ts
DELETE /api/admin/groups/:id → api/admin/groups/[id].ts
```

## How to Convert Remaining Routes

### Pattern for Converting Routes

1. **Create file** in `api/` directory matching the route structure:
   - Use `[param].ts` for dynamic segments (e.g., `[id].ts`, `[title].ts`)
   - Use `index.ts` for base routes

2. **Import required utilities**:
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler, requireAuth, requirePermission, requireAdmin, type AuthenticatedRequest } from "../_lib/apiHandler";
import { storage } from "../server/storage";
```

3. **Export default handler**:
```typescript
export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    // Your route logic here
    // Access req.user, req.permissions as needed
  })
);
```

### Example: Converting a Download Route

Old Express route (`server/routes.ts`):
```typescript
app.get("/api/metadata/:id/download", isAuthenticated, async (req: any, res) => {
  const userId = (req.user as any)?.id;
  const { allowed, permissions } = await requirePermission(userId, "read");

  const file = await storage.getMetadataFile(req.params.id, permissions!);
  const format = req.query.format;

  // ... download logic
});
```

New Vercel route (`api/metadata/[id]/download.ts`):
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler";
import { storage } from "../../../server/storage";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { id } = req.query;
    const { format } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Invalid ID" });
    }

    try {
      const file = await storage.getMetadataFile(id, req.permissions!);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // ... download logic (same as before)
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  })
);
```

### Helper Functions

For download routes that use `transformFileForDownload`, `buildItemXml`, and `buildMetadataXlsx`, you can either:

1. **Extract them** to a shared utility file (e.g., `api/_lib/downloadHelpers.ts`)
2. **Keep them** in `server/routes.ts` and import them

## Environment Variables for Vercel

Set these in your Vercel project settings:

```bash
DATABASE_URL=postgresql://...  # Your PostgreSQL connection string
JWT_SECRET=your-secret-key     # Or reuse SESSION_SECRET
NODE_ENV=production            # Set automatically by Vercel
```

### Adding Secrets in Vercel Dashboard

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
   - `DATABASE_URL` → Your database connection string
   - `JWT_SECRET` → A secure random string (min 32 characters)

Or use Vercel CLI:
```bash
vercel env add DATABASE_URL
vercel env add JWT_SECRET
```

## Deployment Steps

### 1. Prerequisites

- Vercel account
- GitHub repository connected to Vercel (or use Vercel CLI)
- PostgreSQL database (Neon, Vercel Postgres, or other)

### 2. First-Time Setup

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link project to Vercel
cd ONS-Metadata-Manager
vercel link
```

### 3. Configure Environment Variables

```bash
# Add environment variables
vercel env add DATABASE_URL
vercel env add JWT_SECRET

# Or use Vercel dashboard: Settings → Environment Variables
```

### 4. Deploy

```bash
# Deploy to production
vercel --prod

# Or just push to your main/master branch if linked to GitHub
git push origin vercel-deploy
```

### 5. Post-Deployment

1. **Database schema**: Run migrations if needed
   ```bash
   # Connect to your database and ensure tables exist
   # Or use Vercel CLI:
   vercel env pull .env.local
   npm run db:push
   ```

2. **Create admin user** (if needed):
   ```sql
   INSERT INTO users (id, email, password, first_name, last_name, status, can_read, can_write, can_edit, is_admin, file_visibility_scope)
   VALUES (
     gen_random_uuid()::text,
     'admin@example.com',
     '$2a$12$...', -- Use bcrypt to hash password
     'Admin',
     'User',
     'active',
     1, 1, 1, 1,
     'all'
   );
   ```

3. **Test authentication**:
   - Visit your deployed URL
   - Register a new user or login with admin
   - Verify JWT token is stored in localStorage
   - Check that API calls include Authorization header

## Important Notes

### JWT vs Sessions

- **JWT tokens** are stored in localStorage and sent via Authorization header
- **Cookies** are also set as backup for browser-based requests
- **Token expiry**: 7 days (matches old session TTL)
- **No server-side session storage** - fully stateless

### CORS Configuration

The API handler includes CORS middleware that:
- Allows credentials
- Allows all origins (`*`) - **⚠️ Tighten this in production**
- Allows common HTTP methods
- Handles preflight OPTIONS requests

To restrict CORS in production, edit `api/_lib/apiHandler.ts`:
```typescript
res.setHeader('Access-Control-Allow-Origin', 'https://yourdomain.com');
```

### File Visibility & Permissions

The permission system remains unchanged:
- `requirePermission()` checks user permissions
- File visibility filters (own/group/all) work the same
- Admin users bypass visibility restrictions

### Database Compatibility

No database changes required. The schema works as-is because:
- JWT payload only stores `userId` and `email`
- User lookup happens on every request (same as session deserialization)
- Permissions are fetched from database (not stored in JWT)

### Google OAuth

Google OAuth routes are NOT yet converted:
- `GET /api/auth/google`
- `GET /api/auth/google/callback`

These require different handling in serverless environment (callback URLs, state management).

## Testing Locally

You can test Vercel functions locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Run local dev server
vercel dev

# This will:
# - Build your frontend
# - Run API routes as serverless functions
# - Available at http://localhost:3000
```

Or keep using your existing setup:
```bash
npm run dev  # Still works with old Express server
```

## Troubleshooting

### "Unauthorized" on all requests

- Check that JWT_SECRET is set in Vercel environment
- Verify token is stored in localStorage after login
- Check browser console for Authorization header

### "Module not found" errors

- Ensure all imports use correct relative paths
- Check that `server/` and `shared/` directories are included in deployment
- Verify `tsconfig.json` path aliases work in Vercel build

### Function timeout

- Default: 10s (Hobby), 60s (Pro)
- Increase in `vercel.json`:
  ```json
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
  ```

### Database connection issues

- Use `@neondatabase/serverless` for Neon
- Enable connection pooling
- Check DATABASE_URL format

## Next Steps

1. **Complete route conversion** - Follow the patterns above to convert remaining routes
2. **Test thoroughly** - Especially permissions and file visibility
3. **Update CORS** - Restrict to your domain in production
4. **Monitor usage** - Check Vercel dashboard for function invocations and errors
5. **Consider edge functions** - For even faster response times (Vercel Edge Runtime)

## Migration Checklist

- [x] JWT authentication system
- [x] API middleware utilities
- [x] Auth routes (register, login, logout, user)
- [x] Core metadata routes (CRUD + batch)
- [x] Stats route
- [x] Frontend JWT handling
- [x] Vercel configuration
- [ ] Remaining metadata routes (bulk-update, season, download, adjacent)
- [ ] User tags routes
- [ ] Admin routes (users, groups)
- [ ] Google OAuth (optional)
- [ ] Production deployment
- [ ] Admin user creation
- [ ] End-to-end testing

## Support

For issues or questions:
- Check Vercel logs: `vercel logs`
- Review function logs in Vercel dashboard
- Test API routes directly: `curl https://your-app.vercel.app/api/auth/user -H "Authorization: Bearer YOUR_TOKEN"`
