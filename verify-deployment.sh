#!/bin/bash

# Deployment Verification Script
# Tests backend API endpoints and Nginx proxy configuration

set -e

DOMAIN="${DOMAIN:-kanban.24task.ru}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
PROTOCOL="${PROTOCOL:-https}"

echo "🔍 Verifying deployment for $PROTOCOL://$DOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

info() {
    echo -e "ℹ️  INFO: $1"
}

# Test 1: Backend health check (direct)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Test 1: Backend health check (direct)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:$BACKEND_PORT/api/health 2>/dev/null || echo "ERROR\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"status"'; then
        pass "Backend health check responds with 200 OK"
        info "Response: $BODY"
    else
        fail "Backend responds but without expected JSON format"
    fi
else
    fail "Backend health check failed (HTTP $HTTP_CODE)"
    if [ "$HTTP_CODE" = "000" ]; then
        warn "Cannot connect to backend on localhost:$BACKEND_PORT"
        warn "Is PM2 process running? Check: pm2 status"
    fi
fi

# Test 2: Backend /api/auth/signin (direct)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Test 2: Backend /api/auth/signin endpoint (direct)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:$BACKEND_PORT/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' 2>/dev/null || echo "ERROR\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
    pass "Backend /api/auth/signin endpoint exists and responds (HTTP $HTTP_CODE)"
    info "401/400 is expected for invalid credentials"
else
    if [ "$HTTP_CODE" = "404" ]; then
        fail "Backend /api/auth/signin returns 404 - route not found!"
        warn "Check that backend routes are defined with /api prefix"
    elif [ "$HTTP_CODE" = "000" ]; then
        fail "Cannot connect to backend"
    else
        warn "Unexpected HTTP code: $HTTP_CODE"
    fi
fi

# Test 3: Nginx health check (through proxy)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Test 3: Health check through Nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -k -w "\n%{http_code}" $PROTOCOL://$DOMAIN/api/health 2>/dev/null || echo "ERROR\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"status"'; then
        pass "Nginx proxy to /api/health works correctly"
        info "Response: $BODY"
    else
        warn "Nginx responds but unexpected format"
    fi
else
    fail "Nginx proxy to /api/health failed (HTTP $HTTP_CODE)"
    if [ "$HTTP_CODE" = "502" ]; then
        warn "502 Bad Gateway - backend might be down"
    elif [ "$HTTP_CODE" = "404" ]; then
        fail "404 Not Found - Nginx proxy configuration issue!"
        warn "Check Nginx config: location /api/ with correct proxy_pass"
    elif [ "$HTTP_CODE" = "000" ]; then
        fail "Cannot connect to $DOMAIN"
        warn "Check if Nginx is running and SSL certificates are valid"
    fi
fi

# Test 4: Nginx /api/auth/signin (through proxy)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Test 4: /api/auth/signin through Nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -k -w "\n%{http_code}" -X POST $PROTOCOL://$DOMAIN/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' 2>/dev/null || echo "ERROR\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
    pass "Nginx proxy to /api/auth/signin works correctly (HTTP $HTTP_CODE)"
    info "401/400 is expected for invalid credentials"
    if echo "$BODY" | grep -q '"error"'; then
        info "Response contains error message as expected"
    fi
else
    if [ "$HTTP_CODE" = "404" ]; then
        fail "404 Not Found - API route not found through Nginx!"
        warn "This is THE MAIN ISSUE described in the problem statement"
        warn "Backend is receiving requests without /api prefix"
        echo ""
        echo "🔧 SOLUTION:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Update Nginx configuration:"
        echo ""
        echo "location /api/ {"
        echo "    proxy_pass http://127.0.0.1:3001;"
        echo "    # Remove any path after 3001 (no trailing slash or /api/)"
        echo "    ..."
        echo "}"
        echo ""
        echo "Then reload: sudo systemctl reload nginx"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    elif [ "$HTTP_CODE" = "502" ]; then
        fail "502 Bad Gateway - backend might be down"
    elif [ "$HTTP_CODE" = "000" ]; then
        fail "Cannot connect to $DOMAIN"
    else
        warn "Unexpected HTTP code: $HTTP_CODE"
    fi
fi

# Test 5: PM2 process status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Test 5: PM2 Process Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 jlist 2>/dev/null)
    if echo "$PM2_STATUS" | grep -q '"pm2_env"'; then
        PM2_NAME=$(echo "$PM2_STATUS" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        PM2_STATUS_VAL=$(echo "$PM2_STATUS" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ "$PM2_STATUS_VAL" = "online" ]; then
            pass "PM2 process '$PM2_NAME' is online"
        else
            fail "PM2 process '$PM2_NAME' status: $PM2_STATUS_VAL"
        fi
    else
        warn "No PM2 processes found"
    fi
else
    warn "PM2 not installed or not in PATH"
fi

# Test 6: Port listening
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Test 6: Port Binding"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
        pass "Port $BACKEND_PORT is listening"
    else
        fail "Port $BACKEND_PORT is not listening"
        warn "Backend might not be running"
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
        pass "Port $BACKEND_PORT is listening"
    else
        fail "Port $BACKEND_PORT is not listening"
    fi
else
    warn "Neither netstat nor ss available for port check"
fi

# Test 7: Nginx configuration syntax
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Test 7: Nginx Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v nginx &> /dev/null; then
    NGINX_TEST=$(sudo nginx -t 2>&1)
    if echo "$NGINX_TEST" | grep -q "syntax is ok"; then
        pass "Nginx configuration syntax is valid"
    else
        fail "Nginx configuration has syntax errors"
        echo "$NGINX_TEST"
    fi
    
    # Check if Nginx is running
    if pgrep nginx > /dev/null; then
        pass "Nginx process is running"
    else
        fail "Nginx is not running"
    fi
else
    warn "Nginx not found in PATH"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Deployment is working correctly.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Check the output above for details.${NC}"
    echo ""
    echo "📚 For detailed troubleshooting, see:"
    echo "   - NGINX_FIX_GUIDE_RU.md"
    echo "   - PRODUCTION_DEPLOYMENT.md"
    exit 1
fi
