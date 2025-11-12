# EMAIL NOTIFICATION & REGISTRATION TESTING GUIDE

## 📋 Overview
This guide covers testing the new email verification and notification system for Task Manager T24.

## 🔧 Prerequisites

### Environment Setup
1. Configure email settings in `.env`:
```bash
# Email Configuration (SMTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"  # Use App Password for Gmail
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_FROM_NAME="Task Manager T24"

# Frontend URL (for email links)
FRONTEND_URL="http://localhost:5173"
```

2. Start services:
```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Start frontend
npm run dev
```

## ✅ Test Scenarios

### Test 1: New User Registration with Email Verification

**Steps:**
1. Navigate to http://localhost:5173
2. Click "Регистрация" tab
3. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123" (min 8 chars)
4. Click "Зарегистрироваться"

**Expected Results:**
- ✅ User sees "Thank you for registration" page
- ✅ Email sent with "Task Manager T24" branding
- ✅ Email contains purple activation button (#7c3aed)
- ✅ Email link format: `http://localhost:5173/?token=...`
- ✅ User cannot login until email verified

**Verify Email:**
- Check database: `emailVerified = false`, `emailVerificationToken` present
- Backend log shows: `✅ Email service initialized`

---

### Test 2: Email Verification Flow

**Steps:**
1. Open email received in Test 1
2. Click "Активировать аккаунт" button
3. Verify URL redirects to verification page

**Expected Results:**
- ✅ Loading spinner shows "Активация аккаунта..."
- ✅ Success icon and message: "Аккаунт активирован!"
- ✅ Redirects to dashboard after 2 seconds
- ✅ Welcome modal appears on dashboard
- ✅ Modal shows: "Добро пожаловать в Task Manager T24!"
- ✅ Modal has green checkmark icon
- ✅ Button says "Начать пользоваться"

**Verify Database:**
- `emailVerified = true`
- `emailVerificationToken = null`
- JWT token stored in localStorage

---

### Test 3: Login with Unverified Email

**Steps:**
1. Register a new user (don't verify email)
2. Try to login with those credentials

**Expected Results:**
- ✅ Error message: "Пожалуйста, подтвердите ваш email перед входом"
- ✅ User not logged in
- ✅ Status code: 403

---

### Test 4: Project Invitation Email

**Steps:**
1. Login as user A (verified account)
2. Create a project
3. Navigate to project settings → Members
4. Invite "newuser@example.com" with role "collaborator"
5. Click "Отправить приглашение"

**Expected Results:**
- ✅ Toast: "Приглашение отправлено"
- ✅ Email sent to invitee
- ✅ Email subject: "Вас пригласили в проект Task Manager T24"
- ✅ Email shows project name and role
- ✅ Email has purple "Принять приглашение" button
- ✅ Backend log: `✅ Invitation email sent to: newuser@example.com`

**Verify Database:**
- New record in `invitations` table
- `status = 'pending'`
- `token` is unique 32-byte hex string

---

### Test 5: Accept Invitation (Existing User)

**Steps:**
1. Login as existing verified user
2. Click invitation link from email
3. Review invitation details
4. Click "Принять приглашение"

**Expected Results:**
- ✅ Shows project name, role, inviter name
- ✅ Success toast: "Приглашение принято! Добро пожаловать в проект."
- ✅ Redirects to dashboard
- ✅ Project appears in sidebar
- ✅ User can access project

**Verify Database:**
- `invitation.status = 'accepted'`
- New `project_members` record created
- `acceptedAt` timestamp set

---

### Test 6: Accept Invitation (New User - Registration Flow)

**Steps:**
1. Logout (if logged in)
2. Click invitation link from email
3. Verify shows "Not authenticated" prompt
4. Click accept invitation button

**Expected Results:**
- ✅ Redirects to registration page
- ✅ Email field pre-filled with invitation email
- ✅ URL: `/?mode=register&email=newuser@example.com`
- ✅ Registration tab is active

**Continue:**
5. Fill name and password
6. Register
7. Check email for verification
8. Click verification link

**Expected Results:**
- ✅ Account activated
- ✅ Invitation automatically accepted
- ✅ Redirects to dashboard (no welcome modal)
- ✅ Project immediately visible in sidebar

**Verify:**
- `sessionStorage.pendingInvitation` is cleared
- Backend accepts invitation using stored token

---

### Test 7: Password Reset Flow

**Steps:**
1. On login page, click "Забыли пароль?"
2. Enter email: "test@example.com"
3. Click send
4. Check email

**Expected Results:**
- ✅ Email received with subject: "Восстановление пароля в Task Manager T24"
- ✅ Email has purple "Сбросить пароль" button
- ✅ Link format: `http://localhost:5173/?reset-token=...`
- ✅ Email states: "Ссылка будет активна в течение 1 часа"

**Continue:**
5. Click reset link
6. Enter new password (min 8 chars)
7. Confirm password
8. Click "Сменить пароль"

**Expected Results:**
- ✅ Success toast: "Пароль успешно изменен!"
- ✅ Redirects to login page after 2 seconds
- ✅ Can login with new password
- ✅ Old password doesn't work

**Verify Database:**
- `resetPasswordToken` and `resetPasswordExpires` cleared
- `password` hash changed

---

### Test 8: Invalid/Expired Tokens

**Test 8a: Invalid Verification Token**
1. Visit: `http://localhost:5173/?token=invalidtoken`

**Expected:**
- ✅ Red X icon
- ✅ "Ошибка активации"
- ✅ Message: "Неверная ссылка активации"

**Test 8b: Expired Reset Token**
1. Generate reset token
2. Wait 1+ hours (or manually expire in DB)
3. Click reset link

**Expected:**
- ✅ Error: "Invalid or expired reset token"
- ✅ Cannot reset password

**Test 8c: Expired Invitation**
1. Create invitation
2. Manually set `expiresAt` to past date
3. Click invitation link

**Expected:**
- ✅ Status shows "expired"
- ✅ Cannot accept invitation
- ✅ Message about expiration

---

## 🎨 UI/UX Verification

### Branding Consistency
- ✅ All pages use purple-600 (#7c3aed) as primary color
- ✅ Gradients: `from-purple-50 via-white to-pink-50`
- ✅ All text in Russian language
- ✅ Consistent card styling across pages
- ✅ Icons from lucide-react

### Email Templates
- ✅ Subject lines mention "Task Manager T24"
- ✅ Purple button color: #7c3aed
- ✅ Footer: "Команда Task Manager T24"
- ✅ Responsive HTML design
- ✅ Plain text fallback

### Modal Behavior
- ✅ Welcome modal appears OVER dashboard (not separate page)
- ✅ Modal can be closed by clicking outside
- ✅ URL parameter `?welcome=true` triggers modal
- ✅ Parameter removed after closing modal
- ✅ Modal doesn't show for users who accepted invitations

---

## 🐛 Edge Cases to Test

1. **Multiple Registrations with Same Email**
   - Expected: Error "Пользователь с таким e-mail уже существует"

2. **Clicking Verification Link Twice**
   - First click: Success
   - Second click: Token not found (already cleared)

3. **Multiple Pending Invitations**
   - Expected: Error "There is already a pending invitation for this email"

4. **Invitation to Existing Project Member**
   - Expected: Error "User is already a member of this project"

5. **Email Service Not Configured**
   - Expected: Warning in console, but invitation created
   - No email sent

6. **Short Password (< 8 chars)**
   - Expected: Error "Пароль должен содержать минимум 8 символов"

7. **Network Error During Verification**
   - Expected: Red X with "Ошибка соединения с сервером"

---

## 📊 Database Verification Queries

```sql
-- Check user verification status
SELECT id, email, "emailVerified", "emailVerificationToken" 
FROM users 
WHERE email = 'test@example.com';

-- Check invitations
SELECT id, email, role, status, token, "expiresAt"
FROM invitations
WHERE email = 'newuser@example.com';

-- Check project members
SELECT pm.id, pm.role, u.email, p.name as project
FROM project_members pm
JOIN users u ON pm."userId" = u.id
JOIN projects p ON pm."projectId" = p.id
WHERE u.email = 'test@example.com';

-- Check reset tokens
SELECT email, "resetPasswordToken", "resetPasswordExpires"
FROM users
WHERE "resetPasswordToken" IS NOT NULL;
```

---

## 🔐 Security Verification

✅ **Completed:**
- CodeQL scan: 0 alerts
- Email tokens are cryptographically secure (32 bytes)
- Password hashing with bcrypt
- Reset tokens expire after 1 hour
- Invitation tokens included in database queries
- No sensitive data in URLs (tokens are meant to be in URLs)

---

## ✨ Success Criteria

All tests pass if:
- ✅ Users cannot login without email verification
- ✅ All emails contain "Task Manager T24" branding
- ✅ Invitation emails sent automatically on creation
- ✅ Welcome modal shows after verification
- ✅ Invitation flow works for both new and existing users
- ✅ Password reset works correctly
- ✅ All UI in Russian with purple theme
- ✅ No security vulnerabilities detected
- ✅ Build completes successfully
- ✅ No console errors in browser

---

## 📝 Notes for Testers

1. **Gmail App Passwords**: If using Gmail, create an App Password at https://myaccount.google.com/apppasswords
2. **Local Testing**: Use a service like MailHog or Mailtrap for testing emails locally
3. **Token Expiration**: Verification tokens don't expire, reset tokens expire in 1 hour
4. **URL Parameters**: Clear browser cache if parameters don't work correctly
5. **WebSocket**: Invitations also send real-time WebSocket notifications to logged-in users

---

## 🎯 Ready for Production

Before deploying to production:
1. ✅ Set strong `JWT_SECRET` in production .env
2. ✅ Configure production SMTP credentials
3. ✅ Set `FRONTEND_URL` to production domain (e.g., https://taskmanager.yourdomain.com)
4. ✅ Test with real email addresses
5. ✅ Verify SSL/TLS for email sending
6. ✅ Check spam folder deliverability
7. ✅ Monitor email sending logs
8. ✅ Set up email bounce handling (optional)
