# Self-Hosting Deployment Guide

This guide explains how to deploy the Broadcast Metadata Management System on your own server using Docker.

## Deployment Options

Choose the deployment option that fits your needs:

### Option A: External Database (Recommended)

Use this if you have an external PostgreSQL database (Neon, AWS RDS, Supabase, etc.).

**Advantages:**
- Smaller Docker image
- No database container to manage
- Database backups handled by your provider
- Better scalability
- Easier maintenance

**Use:** `docker-compose.yml` (default file)

### Option B: Included PostgreSQL

Use this for a complete self-hosted solution with local database.

**Advantages:**
- Everything in one place
- No external dependencies
- Full control over database
- Works offline

**Use:** `docker-compose-with-postgres.yml`

---

## Prerequisites

- Docker and Docker Compose installed on your server
- A server with at least 2GB RAM and 10GB disk space
- Domain name (optional, for production use)
- SSL certificate (optional, for HTTPS)

---

## Quick Start - External Database (Option A - Default)

### 1. Upload Files to Your Server

```bash
# Upload the application files to your server
# or clone from the repository
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file
nano .env
```

**Required settings for external database:**

```bash
# Your external database connection string
DATABASE_URL=postgresql://username:password@host.region.neon.tech/dbname?sslmode=require

# Generate a secure session secret (at least 32 characters)
SESSION_SECRET=$(openssl rand -base64 32)
```

**Optional settings:**

```bash
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback
```

**Important: Cookie Security Settings**

```bash
# For local testing or HTTP-only deployments (without HTTPS)
SECURE_COOKIES=false

# For production with HTTPS (behind nginx/reverse proxy with SSL)
SECURE_COOKIES=true
```

 **Why this matters:** 
- When `SECURE_COOKIES=true`, browsers will ONLY send session cookies over HTTPS
- If testing locally on `http://localhost:5000` with `SECURE_COOKIES=true`, login will fail
- For production deployments with HTTPS, always set `SECURE_COOKIES=true`

### 3. Start the Application

```bash
# Build and start the application (using default docker-compose.yml)
docker-compose up -d

# View logs
docker-compose logs -f app

# Check service status
docker-compose ps
```

The application will be available at `http://your-server-ip:5000`

### 4. Initialize Database Schema

```bash
# Run database migrations to create tables
docker-compose exec app npm run db:push
```

### 5. Create First Admin User

**Step 1: Generate a password hash**

```bash
# Generate a bcrypt hash for your admin password
docker-compose exec app node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 12))"

# Example output: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3h3nVZKyC
```

**Step 2: Create the admin user in your database**

Connect to your external database (using your provider's console or psql):

```sql
INSERT INTO users (
  id, 
  email, 
  password, 
  first_name, 
  last_name, 
  status, 
  can_read, 
  can_write, 
  can_edit, 
  is_admin, 
  file_visibility_scope
) VALUES (
  gen_random_uuid()::text,
  'admin@yourdomain.com',
  '$2a$12$YOUR_GENERATED_HASH_HERE',
  'Admin',
  'User',
  'active',
  1,
  1,
  1,
  1,
  'all'
);
```

Now you can log in at `http://your-server:5000` with the email and password you set.

---

## Quick Start - Included PostgreSQL (Option B)

### 1. Upload Files to Your Server

```bash
# Upload the application files to your server
# or clone from the repository
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file
nano .env
```

**Required settings for included PostgreSQL:**

```bash
# Database configuration (using included PostgreSQL container)
DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/metadata_db
POSTGRES_PASSWORD=your_secure_password

# Generate a secure session secret
SESSION_SECRET=$(openssl rand -base64 32)
```

**Generate secure passwords:**

```bash
# Generate session secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 24
```

### 3. Start the Application

```bash
# Build and start all services (app + PostgreSQL)
docker-compose -f docker-compose-with-postgres.yml up -d

# View logs
docker-compose -f docker-compose-with-postgres.yml logs -f app

# Check service status
docker-compose -f docker-compose-with-postgres.yml ps
```

The application will be available at `http://your-server-ip:5000`

### 4. Create First Admin User

**Step 1: Generate a password hash**

```bash
# Generate a bcrypt hash for your admin password
docker-compose -f docker-compose-with-postgres.yml exec app node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 12))"

# Example output: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3h3nVZKyC
```

**Step 2: Create the admin user**

```bash
# Connect to the PostgreSQL database
docker-compose -f docker-compose-with-postgres.yml exec postgres psql -U postgres -d metadata_db

# In the PostgreSQL prompt, paste this INSERT statement with your generated hash:
INSERT INTO users (
  id, 
  email, 
  password, 
  first_name, 
  last_name, 
  status, 
  can_read, 
  can_write, 
  can_edit, 
  is_admin, 
  file_visibility_scope
) VALUES (
  gen_random_uuid()::text,
  'admin@yourdomain.com',
  '$2a$12$YOUR_GENERATED_HASH_HERE',
  'Admin',
  'User',
  'active',
  1,
  1,
  1,
  1,
  'all'
);

# Exit PostgreSQL
\q
```

Now you can log in at `http://your-server:5000` with the email and password you set.

---

## Production Deployment

### Using Nginx as Reverse Proxy

1. Install Nginx:

```bash
sudo apt update
sudo apt install nginx
```

2. Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/metadata
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/metadata /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Setting up HTTPS with Let's Encrypt

1. Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

2. Obtain SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

3. Update `.env` file:

```bash
# Update the callback URL for your domain
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback
```

### Google OAuth Setup (NOT WORKING YET)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - `https://your-domain.com/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env` file

---

## Maintenance

### Viewing Logs

**For external database (default):**
```bash
docker-compose logs -f app
```

**For included PostgreSQL:**
```bash
docker-compose -f docker-compose-with-postgres.yml logs -f app
docker-compose -f docker-compose-with-postgres.yml logs -f postgres
```

### Backup Database (Included PostgreSQL Only)

```bash
# Create backup
docker-compose -f docker-compose-with-postgres.yml exec postgres pg_dump -U postgres metadata_db > backup_$(date +%Y%m%d).sql

# Restore from backup
docker-compose -f docker-compose-with-postgres.yml exec -T postgres psql -U postgres metadata_db < backup_20250118.sql
```

### Access Database Console

**For external database:**
```bash
# Use your provider's console or psql with connection string
psql "postgresql://username:password@host:port/database"
```

**For included PostgreSQL:**
```bash
docker-compose -f docker-compose-with-postgres.yml exec postgres psql -U postgres -d metadata_db
```

---

## Updating the Application

**For external database (default):**
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

**For included PostgreSQL:**
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose-with-postgres.yml down
docker-compose -f docker-compose-with-postgres.yml up -d --build
```

### Updating Database Schema

After updating the application code, you may need to sync the database schema to include new fields or changes.

**When to update schema:**
- After pulling code that adds new database fields (like tags, new metadata fields, etc.)
- When you see database errors about missing columns
- After upgrading to a new version with schema changes

**For external database (default):**
```bash
# Sync database schema safely (recommended)
docker-compose exec app npm run db:push

# Force sync if you encounter issues
docker-compose exec app npm run db:push --force

# Verify application is working
docker-compose logs -f app
```

**For included PostgreSQL:**
```bash
# Sync database schema safely (recommended)
docker-compose -f docker-compose-with-postgres.yml exec app npm run db:push

# Force sync if you encounter issues
docker-compose -f docker-compose-with-postgres.yml exec app npm run db:push --force

# Verify application is working
docker-compose -f docker-compose-with-postgres.yml logs -f app
```

**Example: Adding the tags field**

If you're upgrading from a version without tags to one with tags support, you'll see this error:
```
error: column "tags" of relation "metadata_files" does not exist
```

**Option 1: Update schema with container running (Recommended)**
```bash
# With the application running, sync the schema
docker-compose exec app npm run db:push

# If you see warnings, force the update
docker-compose exec app npm run db:push --force

# Verify it's working
docker-compose logs -f app
```

**Option 2: Update schema after pulling new code**
```bash
# Pull latest code and rebuild
docker-compose down
docker-compose up -d --build

# Once container is running, sync the schema
docker-compose exec app npm run db:push --force

# Verify it's working
docker-compose logs -f app
```

**Option 3: One-off schema update (if container is stopped)**
```bash
# Run schema sync as a one-time command
docker-compose run --rm app npm run db:push --force

# Start the application normally
docker-compose up -d

# Verify it's working
docker-compose logs -f app
```

**For included PostgreSQL deployment:**

Replace `docker-compose` with `docker-compose -f docker-compose-with-postgres.yml` in any of the above commands.

Example:
```bash
# Sync schema with included PostgreSQL
docker-compose -f docker-compose-with-postgres.yml exec app npm run db:push --force
```

⚠️ **Important Notes:**
- Always backup your database before running schema updates in production
- The `db:push` command is safe and won't delete data
- If `db:push` shows warnings, use `db:push --force` to proceed
- Test schema updates in a staging environment first
- Choose Option 1 for zero-downtime updates

---

## Troubleshooting

### Application won't start

**Check logs:**

```bash
# For external database
docker-compose logs app

# For included PostgreSQL
docker-compose -f docker-compose-with-postgres.yml logs app
```

**Common issues:**
- Missing or incorrect `DATABASE_URL`
- Missing `SESSION_SECRET`
- Database connection issues

### Database connection errors

**For included PostgreSQL:**
- Ensure PostgreSQL container is running: `docker-compose -f docker-compose-with-postgres.yml ps`
- Check DATABASE_URL matches POSTGRES_PASSWORD

**For external database:**
- Verify DATABASE_URL is correct
- Check firewall rules allow connections
- Ensure SSL mode is correct (`sslmode=require`)

### Can't access the application

- Check if port 5000 is open in firewall
- Verify Docker container is running: `docker ps`
- Check Nginx configuration if using reverse proxy

---

## Security Best Practices

1. **Use strong passwords:**
   - Generate with `openssl rand -base64 32`
   - Never commit `.env` to version control

2. **Enable HTTPS:**
   - Use Let's Encrypt for free SSL certificates
   - Always use HTTPS in production

3. **Regular backups:**
   - Automate database backups
   - Store backups in secure location
   - Test restore procedures

4. **Keep software updated:**
   - Regularly update Docker images
   - Monitor for security advisories
   - Update dependencies

5. **Restrict access:**
   - Use firewall rules
   - Implement rate limiting
   - Monitor access logs

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review application logs
- Check database connectivity
