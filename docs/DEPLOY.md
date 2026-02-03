# Deployment Guide

Postfarm supports two deployment modes:

| Mode | Best for | Cost | Reliability |
|------|----------|------|-------------|
| **Cloud** (recommended) | Production, zero maintenance | Free | High (cloud infra) |
| **Self-hosted** | Privacy, full control, dev/testing | Free | Depends on your hardware |

---

## Cloud Mode (Vercel + Supabase) — Recommended

**Stack**: Vercel (frontend) + Supabase (DB + scheduler via pg_cron + Edge Functions)

No always-on backend needed. Supabase handles scheduled job execution. **100% free.**

### Why This Mode

- **Won't fail** — Cloud infrastructure, no home server dependency
- **Zero maintenance** — No Docker, no server, no reboots
- **Free** — Within Supabase/Vercel free tiers
- **Accessible everywhere** — No VPN needed

### Setup

#### 1. Deploy Frontend to Vercel
```bash
cd frontend
vercel
```

#### 2. Enable Extensions in Supabase
Go to Dashboard → Database → Extensions and enable:
- `pg_cron` — for scheduling
- `pg_net` — for HTTP calls from cron

#### 3. Deploy Edge Function
```bash
# Link your project (first time only)
supabase link --project-ref <PROJECT_REF>

# Deploy the function
supabase functions deploy publish-scheduled-posts --project-ref <PROJECT_REF>
```

The Edge Function code is at: `supabase/functions/publish-scheduled-posts/index.ts`

#### 4. Set Edge Function Secrets
```bash
supabase secrets set --project-ref <PROJECT_REF> \
  SUPABASE_URL=https://<PROJECT_REF>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### 5. Create pg_cron Job
Run this SQL in Supabase SQL Editor (Dashboard → SQL Editor):

```sql
-- Schedule the Edge Function to run every minute
SELECT cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/publish-scheduled-posts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` with your values.

#### 6. Verify Cron is Running
```sql
-- Check scheduled jobs
SELECT * FROM cron.job;

-- Check recent runs (after a minute)
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
```

### Environment Variables

```bash
# Frontend (.env.local)
VITE_API_URL=<your-existing-backend-url>
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### How It Works

1. User schedules a post → saved to `scheduled_posts` table with `status: scheduled`
2. pg_cron runs every minute → calls Edge Function
3. Edge Function queries for due posts (`scheduled_time <= now()`)
4. For each post: fetches OAuth token from `user_secrets`, posts to Twitter/LinkedIn
5. Updates post status to `posted` or `failed`

### Free Tier Limits & Management

Supabase free tier is generous for personal use:

| Resource | Limit | Your Usage |
|----------|-------|------------|
| Database | 500MB | ~100K posts before cleanup |
| Bandwidth | 2GB/month | API calls, plenty |
| Edge Functions | 500K invocations | 1/min = 44K/month |
| Projects | 2 | Using 1 |

**Staying under limits:**

1. **Delete old posts** — Run monthly cleanup:
   ```sql
   -- Delete posts older than 90 days
   DELETE FROM scheduled_posts
   WHERE posted_at < NOW() - INTERVAL '90 days';
   ```

2. **Monitor usage** — Dashboard → Settings → Usage

3. **If approaching limits** — Export data and clean up, or upgrade to Pro ($25/mo)

---

## Self-hosted Mode (Docker)

**Stack**: Docker (backend) + Vercel (frontend) + SQLite (local DB)

Runs on your own hardware. Good for privacy, development, or using old machines.

### When to Use

- You want 100% data control
- You're developing/testing locally
- You have a reliable home server (UPS, stable internet)
- You want to avoid any cloud dependency

### Setup on Ubuntu Server (e.g., old MacBook)

#### 1. Install Docker
```bash
# Ubuntu
sudo apt update
sudo apt install docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in
```

#### 2. Clone and Configure
```bash
git clone <repo>
cd postfarm
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

#### 3. Set Self-hosted Mode
```bash
# In backend/.env
USE_SUPABASE=false
```

#### 4. Run with Docker Compose
```bash
docker compose up -d --build
```

#### 5. Access
- Backend API: `http://<server-ip>:8000`
- Frontend: Deploy to Vercel, or run locally with `npm run dev`

### Environment Variables

```bash
# backend/.env
USE_SUPABASE=false
DATABASE_URL=sqlite:///./postfarm.db
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
CLERK_SECRET_KEY=...
```

### Keeping It Running

#### Auto-restart on reboot
Already configured in `docker-compose.yml`:
```yaml
restart: unless-stopped
```

#### systemd service (optional, extra reliability)
```bash
# /etc/systemd/system/postfarm.service
[Unit]
Description=Postfarm
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/path/to/postfarm
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable it:
```bash
sudo systemctl enable postfarm
sudo systemctl start postfarm
```

### Remote Access (Optional)

To access from anywhere without port forwarding:

**Option 1: Tailscale** (recommended)
```bash
# On server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Access via Tailscale IP from anywhere
```

**Option 2: Cloudflare Tunnel**
```bash
cloudflared tunnel create postfarm
cloudflared tunnel route dns postfarm your-domain.com
```

### Caveats

- **Power outage** → Posts won't publish until server is back
- **Internet outage** → Same issue
- **No redundancy** — Consider cloud mode for critical use

---

## Switching Modes

| Variable | Cloud | Self-hosted |
|----------|-------|-------------|
| `USE_SUPABASE` | true | false |

Backend code checks `USE_SUPABASE` to use Supabase or SQLite.
Scheduler: pg_cron (cloud) vs APScheduler (self-hosted).

---

## Testing Scheduled Execution

After deploying in either mode:

1. Create and schedule a post for 2 minutes from now
2. Wait for scheduled time
3. Verify post appears on Twitter/LinkedIn
4. Check post status updated to "posted"

**Debugging:**
- **Cloud**: Supabase logs (Dashboard → Logs → Edge Functions)
- **Self-hosted**: `docker compose logs -f backend`
