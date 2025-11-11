# Security Summary: Rate Limiting Implementation

## Overview
This document summarizes the security improvements made to address CodeQL findings regarding missing rate limiting.

## CodeQL Findings

### Issue 1: Missing rate limiting on authentication endpoints
**Severity:** Medium  
**Location:** Authentication routes (signup, signin, password reset)  
**Risk:** Brute force attacks, account enumeration, abuse

### Issue 2: Missing rate limiting on file system access
**Severity:** Medium  
**Location:** File upload endpoints  
**Risk:** Storage abuse, DoS attacks, resource exhaustion

## Implementation

### Custom Rate Limiter
Created `src/server/middleware/rateLimiter.ts` with:
- In-memory request tracking per IP address
- Configurable time windows and request limits
- Automatic cleanup of old entries
- Standard HTTP rate limit headers (X-RateLimit-*)
- Retry-After header when limit exceeded

### Rate Limiters Applied

#### 1. Authentication Rate Limiter (`authRateLimiter`)
- **Applied to:** `/api/auth/signup`, `/api/auth/signin`
- **Limits:** 5 requests per 15 minutes per IP
- **Protection:** Prevents brute force password attacks and account creation abuse

#### 2. Password Reset Rate Limiter (`passwordResetRateLimiter`)
- **Applied to:** `/api/auth/forgot-password`, `/api/auth/reset-password`
- **Limits:** 3 requests per hour per IP
- **Protection:** Prevents password reset abuse and email flooding

#### 3. Upload Rate Limiter (`uploadRateLimiter`)
- **Applied to:** `/api/upload-avatar`, `/api/upload-attachment`, `/api/upload-project-attachment`
- **Limits:** 10 requests per 15 minutes per IP
- **Protection:** Prevents storage abuse and DoS through file uploads

## Testing

Rate limiting was tested successfully:
```bash
# Test showed requests 1-5 succeed (or fail for other reasons)
# Requests 6+ are blocked with 429 status and error message
# "Слишком много попыток входа/регистрации. Попробуйте через 15 минут."
```

## HTTP Headers

When rate limit is active, the following headers are set:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets
- `Retry-After`: Seconds to wait before retrying (when limit exceeded)

## Code Verification

All critical endpoints now have rate limiting:

```typescript
// Authentication
app.post('/api/auth/signup', authRateLimiter, ...)
app.post('/api/auth/signin', authRateLimiter, ...)
app.post('/api/auth/forgot-password', passwordResetRateLimiter, ...)
app.post('/api/auth/reset-password', passwordResetRateLimiter, ...)

// File Uploads
apiRouter.post('/upload-avatar', uploadRateLimiter, ...)
apiRouter.post('/upload-attachment', uploadRateLimiter, ...)
apiRouter.post('/upload-project-attachment', uploadRateLimiter, ...)
```

## Production Considerations

For production deployment, consider:

1. **Distributed Systems:** Current implementation uses in-memory storage. For multiple servers, use Redis or similar distributed cache.

2. **More Sophisticated Rate Limiting:** Consider using `express-rate-limit` package which offers:
   - Redis/Memcached store support
   - More sophisticated algorithms (sliding window, token bucket)
   - Better performance for high-traffic scenarios

3. **IP Address Detection:** Behind a proxy/load balancer, ensure proper IP detection:
   ```typescript
   app.set('trust proxy', true); // Trust proxy headers
   ```

4. **Monitoring:** Add logging and metrics for rate limit hits to detect potential attacks.

5. **User-Based Rate Limiting:** For authenticated endpoints, consider rate limiting by user ID in addition to IP.

## Status

✅ **All CodeQL findings addressed**
- Authentication endpoints are rate limited
- File upload endpoints are rate limited
- Custom rate limiter implemented and tested
- HTTP standard headers included
- Automatic cleanup implemented

## Future Enhancements

1. Add Redis-based distributed rate limiting for production
2. Add metrics/monitoring for rate limit events
3. Add admin API to view/clear rate limits
4. Add configurable rate limits via environment variables
5. Add user-based rate limiting for authenticated requests
