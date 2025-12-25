# Environment Variables Setup

This project uses Supabase's new API key structure. Follow the guide below to set up your environment variables.

## Supabase API Keys

According to [Supabase's API keys documentation](https://supabase.com/docs/guides/api/api-keys), Supabase has moved from legacy JWT-based keys (`anon` and `service_role`) to new publishable and secret keys.

### Getting Your Keys

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API Keys**
3. You'll find your keys in the **API Keys** tab:
   - **Publishable key** (format: `sb_publishable_...`) - for client-side use
   - **Secret key** (format: `sb_secret_...`) - for server-side use

### Server Environment Variables

Create a `.env` file in the `server/` directory with the following:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server Configuration
PORT=4000
```

**Important:** 
- The `SUPABASE_SECRET_KEY` provides elevated access and bypasses Row Level Security
- **Never** expose this key in client-side code, public repositories, or logs
- Only use it in secure server environments

### Client Environment Variables

Create a `.env` file in the `client/` directory with the following:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# API Configuration
VITE_API_URL=http://localhost:4000/api
```

**Important:**
- The `VITE_SUPABASE_PUBLISHABLE_KEY` is safe to expose in client-side code
- It's designed for use in browsers, mobile apps, and other public-facing components
- Access is still protected by Row Level Security (RLS) policies

## Key Differences from Legacy Keys

| Legacy Key | New Key | Use Case |
|------------|---------|----------|
| `anon` (JWT) | `sb_publishable_...` | Client-side operations |
| `service_role` (JWT) | `sb_secret_...` | Server-side operations |

### Benefits of New Keys

1. **Independent rotation**: Rotate keys without affecting others
2. **Better security**: Secret keys cannot be used in browsers (returns 401)
3. **No JWT coupling**: Keys are no longer tied to the JWT secret
4. **Easier management**: Create multiple secret keys for different services

## Security Best Practices

### For Secret Keys (Server-side)
- ✅ Store in environment variables
- ✅ Use secure secret management tools
- ✅ Create separate keys for different services
- ✅ Rotate keys if compromised
- ❌ Never commit to version control
- ❌ Never use in browser or client-side code
- ❌ Never log or expose in error messages

### For Publishable Keys (Client-side)
- ✅ Safe to bundle in client applications
- ✅ Safe to expose in source code
- ✅ Protected by RLS policies
- ⚠️ Still requires proper RLS setup on all tables

## Migration from Legacy Keys

If you're currently using legacy `anon` and `service_role` keys:

1. Create new publishable and secret keys in the Supabase dashboard
2. Update your environment variables as shown above
3. Test your application thoroughly
4. Once confirmed working, you can deactivate the legacy keys in the dashboard

Both key types can coexist during migration for zero-downtime transitions.

