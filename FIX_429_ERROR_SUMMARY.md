# Fix for 429 Rate Limit Error on User Login

## Problem Summary

Users were experiencing 429 (Too Many Requests) errors when attempting to login to the system, even on their first attempt with correct credentials. This issue affected multiple users from different IP addresses simultaneously.

**Error Message:**
```
Error: Слишком много попыток входа/регистрации. Попробуйте через 15 минут.
Failed to load resource: the server responded with a status of 429 ()
```

## Root Causes

### 1. Duplicate Authentication Requests from React (Primary Issue)

**Location:** `src/App.tsx`, lines 147-229

The React `useEffect` hook was sending multiple duplicate requests to `/api/auth/signin` due to:
- `checkAuth()` calling `authAPI.getCurrentUser()`
- `onAuthStateChange()` also calling `authAPI.getCurrentUser()` (duplicate check)
- Both triggered on every `location.pathname` or `location.search` change

**Request Multiplication Scenario:**
```
User opens website
  ↓
useEffect → authAPI.getCurrentUser() → REQUEST 1
  ↓
onAuthStateChange → authAPI.getCurrentUser() → REQUEST 2
  ↓
User navigates to /projects
  ↓
useEffect fires again → REQUESTS 3-4
  ↓
5 requests exhausted → 429 ERROR!
```

### 2. Overly Strict Rate Limiter

**Location:** `src/server/middleware/rateLimiter.ts`, lines 90-95

Problems:
- Limit of **only 5 requests per 15 minutes** was too restrictive
- Key generator used only IP address (not email)
- Users behind the same NAT/WiFi shared the rate limit

## Solution Implemented

### Change 1: Removed Duplicate `onAuthStateChange` in App.tsx

**Lines Removed:** 207-217 (and subscription variable on line 149)

```typescript
// ❌ REMOVED: Duplicate subscription
try {
  const { data } = authAPI.onAuthStateChange((user) => {
    if (isMounted) {
      setIsAuthenticated(!!user);
    }
  });
  subscription = data.subscription;
} catch (error) {
  console.error('Auth subscription error:', error);
}
```

**Result:**
- Only `checkAuth()` now makes authentication requests
- Eliminates duplicate API calls
- Reduces request count significantly

### Change 2: Improved Rate Limiter Configuration

**File:** `src/server/middleware/rateLimiter.ts`

```typescript
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // ✅ Increased from 5 to 20
  message: 'Слишком много попыток входа/регистрации. Попробуйте через 15 минут.',
  keyGenerator: (req: Request) => {
    // ✅ Generate key based on IP + email (each user gets their own limit)
    const email = req.body?.email || '';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // If email is provided, use combination of IP:email, otherwise just IP
    return email ? `${ip}:${email}`.toLowerCase() : ip;
  },
});
```

**Improvements:**
1. **Increased limit:** 5 → 20 requests per 15 minutes (4x more lenient)
2. **Per-user rate limiting:** Uses `IP:email` combination instead of just IP
3. **Better isolation:** Users behind the same NAT/WiFi no longer share limits

## Verification

### Build Status
✅ Project builds successfully without errors

### TypeScript Compilation
✅ No TypeScript errors in changed files

### Security Scan
✅ CodeQL: 0 alerts found

### Rate Limiter Tests
✅ All tests passed:
- Different users with same IP have separate limits (30/30 requests passed)
- Single user can make 20 requests (20/25 passed, 5/25 rejected as expected)
- Requests beyond limit are properly rejected

### Test Output
```
🧪 Testing Rate Limiter Configuration

1️⃣ Test: Different users with same IP should have separate limits
   User 1 (user1@example.com): 15/15 requests passed
   User 2 (user2@example.com): 15/15 requests passed
   Total accepted: 30, Rejected: 0
   ✅ Both users can make requests independently (rate limit is per IP:email)

2️⃣ Test: Single user should be able to make at least 20 requests
   Requests passed: 20/25
   Requests rejected: 5/25
   ✅ Rate limit is at least 20 requests (expected: 20)
   ✅ Requests beyond limit are properly rejected
```

## Expected Results

✅ Users can login on first attempt without 429 errors  
✅ Each user gets individual rate limit (20 attempts per 15 minutes)  
✅ React no longer sends duplicate authentication requests  
✅ Brute force protection remains effective (20 attempts is sufficient for legitimate use)  

## Security Considerations

- Rate limiting still protects against brute force attacks
- 20 requests per 15 minutes is reasonable for legitimate usage patterns:
  - Failed password attempts: ~5-10 per session
  - Navigation-triggered auth checks: ~5-10 per session
  - Total buffer: 20 requests provides comfortable margin
- Per-user (IP:email) limiting prevents single attacker from blocking legitimate users
- Protection maintained against automated attack tools

## Files Changed

1. **src/App.tsx**
   - Removed: 22 lines (duplicate subscription code)
   - Impact: Eliminates redundant API calls

2. **src/server/middleware/rateLimiter.ts**
   - Added: 7 lines (custom key generator)
   - Modified: 2 lines (increased limit, updated comment)
   - Impact: Better rate limit isolation and more lenient limit

3. **test_rate_limiter.ts** (New)
   - Added: 170 lines
   - Purpose: Validates rate limiter configuration

## Migration Notes

No database migrations or configuration changes required. Changes are backwards compatible and take effect immediately upon deployment.

## Rollback Plan

If issues arise, revert commits:
```bash
git revert HEAD
```

Original settings:
- Rate limit: 5 requests per 15 minutes
- Key generator: IP only

## Monitoring Recommendations

After deployment, monitor:
1. 429 error rate (should decrease significantly)
2. Successful login rate (should improve)
3. Rate limiter store size (should remain reasonable)
4. Brute force attack attempts (should still be blocked)

---

**Commit:** d2cf8c5  
**Author:** GitHub Copilot  
**Date:** 2025-11-14  
**Status:** ✅ Ready for Merge
