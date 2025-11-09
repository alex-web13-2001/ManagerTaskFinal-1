# 📧 Email Notification System - Setup Guide

Complete guide for configuring and using the email notification system in Task Manager.

---

## 📋 Overview

The Task Manager now includes email notification functionality for:
1. **Welcome emails** - Sent when users register
2. **Password reset emails** - Sent when users request password recovery
3. **Password changed confirmation** - Sent after successful password reset

---

## 🔧 Configuration

### 1. SMTP Settings

The system uses SMTP to send emails. You'll need SMTP credentials from your email provider.

#### Option A: Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Generate password
   - Copy the 16-character password

3. **Update .env**:
```env
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-16-char-app-password"
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_FROM_NAME="Task Manager"
APP_URL="http://localhost:5173"
```

#### Option B: Other SMTP Providers

**SendGrid:**
```env
EMAIL_HOST="smtp.sendgrid.net"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="apikey"
EMAIL_PASSWORD="your-sendgrid-api-key"
```

**Mailgun:**
```env
EMAIL_HOST="smtp.mailgun.org"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="postmaster@your-domain.mailgun.org"
EMAIL_PASSWORD="your-mailgun-smtp-password"
```

**AWS SES:**
```env
EMAIL_HOST="email-smtp.us-east-1.amazonaws.com"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="your-aws-iam-smtp-username"
EMAIL_PASSWORD="your-aws-iam-smtp-password"
```

**Office 365:**
```env
EMAIL_HOST="smtp.office365.com"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="your-email@outlook.com"
EMAIL_PASSWORD="your-password"
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# Email Configuration (SMTP)
EMAIL_HOST="smtp.gmail.com"              # SMTP server host
EMAIL_PORT=587                            # SMTP port (587 for TLS, 465 for SSL)
EMAIL_SECURE=false                        # true for SSL (port 465), false for TLS (port 587)
EMAIL_USER="your-email@gmail.com"        # SMTP username
EMAIL_PASSWORD="your-app-password"       # SMTP password or app password
EMAIL_FROM="noreply@yourdomain.com"      # Sender email address
EMAIL_FROM_NAME="Task Manager"           # Sender name

# Application URL (for email links)
APP_URL="http://localhost:5173"          # Frontend URL (for reset links)
```

---

## 🚀 Usage

### Sending Welcome Emails

Automatically sent when a user registers:

```typescript
// In signup endpoint (already implemented)
app.post('/api/auth/signup', async (req, res) => {
  // ... create user logic ...
  
  // Send welcome email (async, doesn't block response)
  emailService.sendWelcomeEmail(user.email, user.name);
  
  res.status(201).json({ user, token });
});
```

### Password Reset Flow

**Step 1: User requests password reset**

```bash
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

Response:
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Step 2: User receives email with reset link**

The email contains a link like:
```
http://localhost:5173/reset-password?token=abc123...
```

**Step 3: User resets password**

```bash
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"abc123...",
    "password":"newPassword123"
  }'
```

Response:
```json
{
  "message": "Password has been reset successfully"
}
```

**Step 4: User receives confirmation email**

---

## 📝 API Endpoints

### POST /api/auth/signup

Registers a new user and sends welcome email.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null
  },
  "token": "jwt-token"
}
```

**Email Sent:** Welcome email

---

### POST /api/auth/forgot-password

Requests a password reset link.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Email Sent:** Password reset email with token

**Security Note:** Always returns success, even if email doesn't exist (prevents user enumeration).

---

### POST /api/auth/reset-password

Resets password using the token from email.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "newPassword123"
}
```

**Response:**
```json
{
  "message": "Password has been reset successfully"
}
```

**Email Sent:** Password changed confirmation

**Token Expiry:** 1 hour

---

## 🧪 Testing

### 1. Test Email Configuration

Create a test endpoint (development only):

```typescript
// Add to src/server/index.ts (dev only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/test-email', async (req, res) => {
    const result = await emailService.sendEmail({
      to: 'test@example.com',
      subject: 'Test Email',
      html: '<h1>Test email works!</h1>',
    });
    res.json({ success: result });
  });
}
```

### 2. Test Welcome Email

```bash
# Register a new user
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"password123",
    "name":"Test User"
  }'
```

Check the email inbox for the welcome email.

### 3. Test Password Reset

```bash
# Step 1: Request password reset
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Step 2: Check email for reset link
# Copy token from email

# Step 3: Reset password
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"TOKEN_FROM_EMAIL",
    "password":"newPassword123"
  }'

# Step 4: Check email for confirmation
```

---

## 🎨 Email Templates

The email templates are styled with inline CSS and include:

### Welcome Email Features:
- ✅ Branded header with Task Manager branding
- ✅ Personalized greeting
- ✅ Feature highlights
- ✅ Responsive design
- ✅ Professional footer

### Password Reset Email Features:
- ✅ Clear call-to-action button
- ✅ Token expiry warning (1 hour)
- ✅ Security note
- ✅ Plain text fallback link

### Customizing Templates

Edit `src/lib/email.ts` to customize email templates:

```typescript
// Example: Change colors
const html = `
  <style>
    .header { background-color: #YOUR_COLOR; }
    .button { background-color: #YOUR_COLOR; }
  </style>
`;
```

---

## 🔒 Security Considerations

### 1. Token Security
- Reset tokens are hashed before storage (SHA-256)
- Tokens expire after 1 hour
- Tokens are single-use (deleted after password reset)

### 2. User Enumeration Protection
- Forgot password always returns success message
- No indication if email exists or not

### 3. Email Privacy
- User emails are never exposed in logs
- SMTP credentials stored in environment variables only

### 4. Rate Limiting (Recommended)

Add rate limiting to prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per 15 minutes
  message: 'Too many password reset requests, please try again later'
});

app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
  // ... handler
});
```

---

## 🐛 Troubleshooting

### Issue: Emails not sending

**Check 1: SMTP credentials**
```bash
# Verify environment variables are set
echo $EMAIL_HOST
echo $EMAIL_USER
```

**Check 2: Server logs**
```bash
# Look for email service initialization message
✅ Email service initialized
```

If you see:
```bash
⚠️ Email service not configured
```
Then SMTP credentials are missing or invalid.

**Check 3: Test SMTP connection**

Use a tool like `telnet` or create a test script:

```bash
# Test SMTP connection (Gmail)
telnet smtp.gmail.com 587
```

### Issue: Emails going to spam

**Solutions:**
1. **SPF Record**: Add to your domain DNS
   ```
   v=spf1 include:_spf.google.com ~all
   ```

2. **DKIM**: Configure with your email provider

3. **Use professional email address**: 
   - ✅ noreply@yourdomain.com
   - ❌ youremail@gmail.com

4. **Warm up your domain**: Start with small volume

### Issue: Gmail blocking sign-ins

**Solutions:**
1. Enable "Less secure app access" (not recommended)
2. **Use App Passwords** (recommended)
3. Add application to "allowed apps" in Google account

### Issue: Reset link not working

**Check:**
1. APP_URL is correct in .env
2. Token hasn't expired (1 hour)
3. Token was copied correctly from email
4. Frontend route `/reset-password` exists

---

## 📊 Database Schema

### User Model Updates

```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  password              String
  name                  String
  avatarUrl             String?
  emailVerified         Boolean   @default(false)       // NEW
  emailVerificationToken String?                        // NEW
  resetPasswordToken    String?                        // NEW
  resetPasswordExpires  DateTime?                      // NEW
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@map("users")
}
```

**Run migrations after schema update:**
```bash
npx prisma migrate dev --name add_email_fields
npx prisma generate
```

---

## 🚀 Production Deployment

### 1. Use Production SMTP Service

For production, use a reliable SMTP service:
- **SendGrid** (free tier: 100 emails/day)
- **AWS SES** (free tier: 62,000 emails/month)
- **Mailgun** (free tier: 5,000 emails/month)
- **Postmark** (free tier: 100 emails/month)

### 2. Secure Environment Variables

```bash
# Generate secure values
JWT_SECRET=$(openssl rand -base64 64)
EMAIL_PASSWORD="use-smtp-api-key"

# Never commit .env file
echo ".env" >> .gitignore
```

### 3. Configure Domain

```env
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_FROM_NAME="Your App Name"
APP_URL="https://yourdomain.com"
```

### 4. Monitor Email Delivery

- Set up bounce handling
- Monitor delivery rates
- Track open rates (optional)

---

## 📚 Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail SMTP Setup](https://support.google.com/mail/answer/7126229)
- [Email Template Best Practices](https://www.emailonacid.com/blog/article/email-development/email-development-best-practices-2/)

---

## ✅ Checklist

Before going to production:

- [ ] SMTP credentials configured
- [ ] Test welcome email sending
- [ ] Test password reset flow
- [ ] Verify email templates display correctly
- [ ] Check emails don't go to spam
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Document SMTP provider setup
- [ ] Add proper error handling
- [ ] Set up bounce handling

---

**Email system is now ready for production! 📧✅**
