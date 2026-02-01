# Database Migrations

This directory contains SQL migration files for the PostFarm database schema.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Navigate to your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the contents of the migration file
4. Paste into the SQL editor
5. Click **Run**

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push --file migrations/002_oauth_states.sql
```

### Option 3: psql (Direct Connection)

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f migrations/002_oauth_states.sql
```

## Migration Files

- `002_oauth_states.sql` - Creates `oauth_states` table for OAuth 2.0 state management with PKCE

## Migration Order

Run migrations in numerical order:
1. `001_*.sql` (if exists)
2. `002_oauth_states.sql`
3. Future migrations...

## Verifying Migrations

After running migrations, verify in Supabase Dashboard:

1. Go to **Table Editor**
2. Confirm `oauth_states` table exists with columns:
   - `state` (VARCHAR(64), PRIMARY KEY)
   - `user_id` (VARCHAR(255))
   - `platform` (VARCHAR(50))
   - `code_verifier` (VARCHAR(128))
   - `created_at` (TIMESTAMP WITH TIME ZONE)
   - `expires_at` (TIMESTAMP WITH TIME ZONE)
3. Confirm indexes exist:
   - `idx_oauth_states_expires_at`
   - `idx_oauth_states_user_id`

## Rollback

To rollback a migration:

```sql
-- Rollback 002_oauth_states.sql
DROP TABLE IF EXISTS oauth_states;
```

## Notes

- Migrations are not automatically run by the application
- Manual execution required for each environment (dev, staging, production)
- Always backup your database before running migrations in production
- Test migrations in a non-production environment first
