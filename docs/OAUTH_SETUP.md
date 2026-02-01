# OAuth 2.0 Setup Guide

This guide walks you through setting up OAuth 2.0 authentication for Twitter and LinkedIn integrations in PostFarm.

## Prerequisites

- Supabase project (required for token storage)
- Domain or localhost for callback URLs
- Developer accounts on Twitter and LinkedIn

---

## Twitter OAuth 2.0 Setup

### 1. Create a Twitter App

1. Go to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new Project (if you don't have one)
3. Create a new App within your Project
4. Note your **Client ID** and **Client Secret**

### 2. Configure App Settings

In your Twitter app settings:

**OAuth 2.0 Settings:**
- **Type of App**: Web App
- **Callback URLs / Redirect URLs**:
  - Development: `http://localhost:3000/oauth/twitter/callback`
  - Production: `https://yourdomain.com/oauth/twitter/callback`
- **Website URL**: Your app's homepage URL

**Permissions:**
- Enable **OAuth 2.0**
- Required Scopes:
  - `tweet.read` - Read tweets
  - `tweet.write` - Post tweets
  - `users.read` - Read user profile
  - `offline.access` - Get refresh tokens

### 3. Environment Variables

Add to `backend/.env`:

```env
TWITTER_CLIENT_ID=your_twitter_client_id_here
TWITTER_CLIENT_SECRET=your_twitter_client_secret_here
TWITTER_REDIRECT_URI=http://localhost:3000/oauth/twitter/callback
```

For production, update `TWITTER_REDIRECT_URI` to your production domain.

### 4. Security Notes

- Twitter OAuth 2.0 uses **PKCE (Proof Key for Code Exchange)** for enhanced security
- Never commit your Client Secret to version control
- Use different credentials for development and production environments
- Rotate secrets regularly

---

## LinkedIn OAuth 2.0 Setup

### 1. Create a LinkedIn App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click **Create app**
3. Fill in app details:
   - App name
   - LinkedIn Page (create one if needed)
   - App logo
   - Legal agreement
4. Click **Create app**

### 2. Configure App Settings

In your LinkedIn app settings:

**OAuth 2.0 Settings:**
- Go to the **Auth** tab
- **Redirect URLs**:
  - Development: `http://localhost:3000/oauth/linkedin/callback`
  - Production: `https://yourdomain.com/oauth/linkedin/callback`

**Products:**
- Request access to **Share on LinkedIn** product (required for posting)
- Request access to **Sign In with LinkedIn** product

**Scopes:**
- `w_member_social` - Post on behalf of user
- `r_liteprofile` - Read basic profile info 

### 3. Environment Variables

Add to `backend/.env`:

```env
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:3000/oauth/linkedin/callback
```

### 4. Security Notes

- LinkedIn tokens expire after **60 days** and cannot be refreshed
- Users must re-authenticate after token expiry
- Never expose Client Secret in frontend code
- Use HTTPS for production callback URLs

---

## Supabase Setup

### 1. Run Database Migration

The OAuth flow requires an `oauth_states` table in Supabase:

```bash
# From project root
cd backend/migrations

# Copy the migration SQL
cat 002_oauth_states.sql
```

Then run it in your Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Click **Run**

### 2. Verify Table Creation

In Supabase Dashboard → Table Editor:
- Confirm `oauth_states` table exists
- Confirm `user_secrets` table exists (for token storage)

### 3. Environment Variables

Ensure these are set in `backend/.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
USE_SUPABASE=true
```

Get these from: Supabase Dashboard → Settings → API

---

## Testing OAuth Flow

### 1. Start the Application

```bash
# Terminal 1: Start backend
cd backend
python -m uvicorn app.main:app --reload

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 2. Test Twitter OAuth

1. Navigate to **Settings** page
2. Find the **Twitter** platform card
3. Click **Connect with OAuth**
4. A popup window should open with Twitter authorization
5. Approve the app
6. Popup closes automatically
7. Settings page shows "Connected" status

### 3. Test LinkedIn OAuth

1. Same steps as Twitter, but for LinkedIn platform
2. Verify connection status appears

### 4. Verify Token Storage

In Supabase Dashboard → Table Editor → `user_secrets`:
- Confirm row exists with `secret_type` = 'twitter' or 'linkedin'
- `secret_data` contains encrypted tokens

---

## Troubleshooting

### Popup Blocked

**Problem**: OAuth popup doesn't open

**Solutions**:
- Allow popups for localhost:3000 in browser settings
- Try different browser (Chrome, Firefox)
- Disable popup blockers

### Invalid Redirect URI

**Problem**: "Redirect URI mismatch" error

**Solutions**:
- Verify callback URLs match exactly in provider settings
- Check for trailing slashes (don't include them)
- Ensure protocol matches (http vs https)
- For Twitter: Use Twitter Developer Portal → App Settings → Edit → User authentication settings

### State Mismatch / Expired State

**Problem**: "Invalid or expired state" error

**Solutions**:
- States expire after 10 minutes - try again faster
- Check backend logs for errors
- Verify `oauth_states` table exists in Supabase
- Check system clock is synchronized

### Token Exchange Failed

**Problem**: "Failed to exchange code for token"

**Solutions**:
- Verify Client ID and Client Secret are correct
- Check backend logs for specific error from provider
- Ensure all required scopes are configured
- For Twitter: Verify PKCE is enabled (code_challenge_method=S256)

### No Tokens in Database

**Problem**: OAuth succeeds but tokens not stored

**Solutions**:
- Check `USE_SUPABASE=true` in backend/.env
- Verify Supabase credentials are correct
- Check backend logs for Supabase errors
- Verify `user_secrets` table has correct schema

---

## Security Best Practices

1. **Never commit secrets** - Use `.env` files, add to `.gitignore`
2. **Use HTTPS in production** - Required by OAuth 2.0 spec
3. **Rotate credentials regularly** - Especially after team changes
4. **Use different credentials per environment** - Dev, staging, production
5. **Monitor token usage** - Check for suspicious activity
6. **Implement rate limiting** - Prevent abuse
7. **Keep dependencies updated** - Security patches

---

## Production Deployment

### Update Callback URLs

1. **Twitter**: Add production callback URL in Developer Portal
2. **LinkedIn**: Add production callback URL in app Auth settings

### Environment Variables

Update `backend/.env` (or your deployment platform's env vars):

```env
TWITTER_REDIRECT_URI=https://yourdomain.com/oauth/twitter/callback
LINKEDIN_REDIRECT_URI=https://yourdomain.com/oauth/linkedin/callback
```

### HTTPS Requirement

- Production OAuth **requires HTTPS**
- Use SSL certificate (Let's Encrypt, Cloudflare, etc.)
- Ensure frontend and backend both use HTTPS

### CORS Configuration

Ensure backend CORS allows your production frontend domain:

```python
# backend/app/main.py
origins = [
    "https://yourdomain.com",
    # ... other allowed origins
]
```

---

## Support

For issues:
1. Check backend logs: `backend/logs/` or `docker logs`
2. Check browser console for frontend errors
3. Review provider documentation:
   - [Twitter OAuth 2.0 Docs](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
   - [LinkedIn OAuth 2.0 Docs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
4. File an issue in the PostFarm repository
