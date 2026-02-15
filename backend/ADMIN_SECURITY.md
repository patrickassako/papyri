# AdminJS Security Configuration

## Environment Variables

Add these to your `.env` file:

```env
# AdminJS (Epic 10)
ADMIN_COOKIE_SECRET=your-secure-cookie-secret-32-chars-minimum
ADMIN_SESSION_SECRET=your-secure-session-secret-32-chars-minimum
NODE_ENV=production  # Force HTTPS cookies in production
```

## Security Features Implemented

### 1. Authentication
- ✅ Supabase Auth integration
- ✅ Admin role verification (`role === 'admin'`)
- ✅ Session-based authentication (no JWT in cookies)
- ✅ Secure password handling (Supabase bcrypt)

### 2. Session Security
- ✅ `httpOnly` cookies (JavaScript cannot access)
- ✅ `secure` flag in production (HTTPS only)
- ✅ `sameSite: 'lax'` (CSRF protection)
- ✅ 24-hour session expiry
- ✅ Session secret (min 32 characters)

### 3. Cookie Security
- ✅ Cookie password/secret (min 32 characters)
- ✅ Encrypted session data
- ✅ Automatic session cleanup

### 4. HTTPS Enforcement
- ✅ `secure` cookies enabled when `NODE_ENV=production`
- ⚠️ **CRITICAL**: AdminJS MUST run on HTTPS in production
- Configure reverse proxy (Nginx/Cloudflare) to force HTTPS

### 5. Content Security Policy (CSP)
- ✅ Helmet middleware with CSP disabled in development
- ⚠️ Production: Enable strict CSP in reverse proxy
  ```nginx
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
  ```

### 6. Audit Trail
- ✅ All admin actions logged to `audit_logs` table
- ✅ Login/logout tracking
- ✅ IP address and user agent logging
- ✅ CRUD operations logged (when enabled in future stories)

### 7. Rate Limiting (TODO: Story 10.2)
- ⏳ 10 requests/minute per IP on `/admin` routes
- ⏳ 5 login attempts per 15 minutes per email
- ⏳ DDoS protection via Cloudflare

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong secrets (32+ characters):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Update `.env` with production secrets
- [ ] Enable HTTPS on reverse proxy (Nginx/Cloudflare)
- [ ] Verify `secure` cookies are set (check browser DevTools)
- [ ] Enable strict CSP headers
- [ ] Configure rate limiting (TODO: Story 10.2)
- [ ] Test admin login works over HTTPS
- [ ] Verify audit logs are being created
- [ ] Set up monitoring/alerts for failed login attempts

## Creating an Admin User

### Option 1: SQL Migration (Recommended)

Create `/docs/migrations/021_create_initial_admin.sql`:

```sql
-- Create initial admin user
-- IMPORTANT: Change email and run this after creating a real password hash

-- First, create user in Supabase Auth Dashboard or via API
-- Then, update their role in profiles table

UPDATE profiles
SET role = 'admin'
WHERE email = 'admin@bibliotheque.app';

-- Verify
SELECT id, email, role FROM profiles WHERE role = 'admin';
```

### Option 2: Supabase Dashboard

1. Go to Supabase Dashboard > Authentication > Users
2. Create a new user with email/password
3. Copy the user ID
4. Go to Table Editor > `profiles`
5. Find the user by ID
6. Update `role` column to `'admin'`
7. Save

### Option 3: Node.js Script (TODO: Story 10.2)

Create `/backend/src/scripts/create-admin.js`:

```javascript
const { supabaseAdmin } = require('../config/database');

async function createAdmin(email, password, fullName) {
  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin' }
  });

  if (authError) throw authError;

  // Update profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'admin', full_name: fullName })
    .eq('id', authData.user.id);

  if (profileError) throw profileError;

  console.log(`✅ Admin created: ${email}`);
}

// Usage: node src/scripts/create-admin.js
createAdmin(
  process.argv[2] || 'admin@bibliotheque.app',
  process.argv[3] || 'SecurePassword123!',
  process.argv[4] || 'Admin System'
);
```

## Testing Admin Access

### Test 1: Access without authentication
```bash
curl http://localhost:3001/admin
# Expected: Redirect to login page (302)
```

### Test 2: Login with non-admin user
```bash
# Create regular user, try to login via AdminJS
# Expected: Authentication fails (401)
```

### Test 3: Login with admin user
```bash
# Login via AdminJS login page
# Expected: Redirect to dashboard (200)
```

### Test 4: Verify audit log
```sql
-- In Supabase SQL Editor
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
-- Expected: Login event logged with admin_id, ip_address, user_agent
```

### Test 5: HTTPS enforcement (Production only)
```bash
curl http://your-domain.com/admin
# Expected: Redirect to HTTPS or connection refused
```

## Security Monitoring

### Audit Log Queries

#### Failed login attempts (when implemented in Story 10.2)
```sql
SELECT * FROM audit_logs
WHERE action = 'login_failed'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

#### Suspicious activity (multiple IPs for same admin)
```sql
SELECT admin_id, COUNT(DISTINCT ip_address) as ip_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY admin_id
HAVING COUNT(DISTINCT ip_address) > 3;
```

#### Recent admin actions
```sql
SELECT a.email, al.action, al.resource, al.created_at
FROM audit_logs al
JOIN auth.users a ON al.admin_id = a.id
WHERE al.created_at > NOW() - INTERVAL '1 hour'
ORDER BY al.created_at DESC;
```

## Common Issues

### Issue: "Cannot access /admin" (404)
- **Cause**: AdminJS router not mounted correctly
- **Fix**: Verify `app.use(admin.options.rootPath, adminRouter)` in `index.js`

### Issue: "Session expired" immediately after login
- **Cause**: Cookie not being saved (secure flag issue)
- **Fix**:
  - Development: Set `NODE_ENV=development`
  - Production: Ensure HTTPS is enabled

### Issue: "CSRF token invalid"
- **Cause**: CSP blocking inline scripts
- **Fix**: Disable CSP in development, configure properly in production

### Issue: "User not found" after login
- **Cause**: User exists in `auth.users` but not in `profiles` or role not set
- **Fix**:
  ```sql
  -- Verify user profile exists
  SELECT * FROM profiles WHERE id = '<user-id>';

  -- Update role if needed
  UPDATE profiles SET role = 'admin' WHERE id = '<user-id>';
  ```

### Issue: Audit logs not being created
- **Cause**: Table doesn't exist or RLS blocking service_role
- **Fix**:
  - Run migration `020_create_audit_logs.sql`
  - Verify RLS policies allow service_role to insert

## Future Enhancements (Story 10.2+)

- [ ] Rate limiting on admin routes
- [ ] 2FA/MFA for admin users
- [ ] IP whitelist for admin access
- [ ] Brute force protection (account lockout)
- [ ] Admin activity dashboard
- [ ] Email alerts for suspicious activity
- [ ] Session management (force logout all sessions)
- [ ] Admin permission levels (super admin, moderator, etc.)

## References

- [AdminJS Security Best Practices](https://docs.adminjs.co/basics/security)
- [Express Session Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
