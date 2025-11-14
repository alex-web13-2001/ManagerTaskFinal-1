/**
 * Simple in-memory rate limiting middleware
 * For production, consider using a package like express-rate-limit or Redis-based solution
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting
const store: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

/**
 * Creates a rate limiting middleware
 * @param options Configuration options
 * @returns Express middleware function
 */
export function createRateLimiter(options: {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string; // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
}) {
  const {
    windowMs,
    max,
    message = 'Слишком много запросов, попробуйте позже',
    keyGenerator = (req: Request) => {
      // Default: use IP address
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Initialize or get current rate limit data
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // Increment count
    store[key].count++;

    // Check if limit exceeded
    if (store[key].count > max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', store[key].resetTime.toString());
      
      return res.status(429).json({
        error: message,
        retryAfter: retryAfter,
      });
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', (max - store[key].count).toString());
    res.setHeader('X-RateLimit-Reset', store[key].resetTime.toString());

    next();
  };
}

// Predefined rate limiters for common use cases

/**
 * Strict rate limiter for authentication endpoints (signup, signin)
 * Allows 20 requests per 15 minutes per IP+email combination
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Слишком много попыток входа/регистрации. Попробуйте через 15 минут.',
  keyGenerator: (req: Request) => {
    // Generate key based on IP + email (each user gets their own limit)
    const email = req.body?.email || '';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // If email is provided, use combination of IP:email, otherwise just IP
    return email ? `${ip}:${email}`.toLowerCase() : ip;
  },
});

/**
 * Moderate rate limiter for file uploads
 * Allows 10 requests per 15 minutes per IP
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Слишком много попыток загрузки файлов. Попробуйте через 15 минут.',
});

/**
 * Lenient rate limiter for general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Слишком много запросов к API. Попробуйте через несколько минут.',
});

/**
 * Very strict rate limiter for password reset
 * Allows 3 requests per hour per IP
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Слишком много попыток сброса пароля. Попробуйте через час.',
});
