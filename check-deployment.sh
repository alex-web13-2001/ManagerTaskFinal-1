#!/bin/bash

# Deployment Verification Script
# This script helps diagnose why changes are not visible on the server
# Скрипт для диагностики проблем с обновлением на сервере

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="${APP_DIR:-/var/www/taskmanager}"
PROCESS_NAME="${PROCESS_NAME:-taskmanager-api}"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Server Update Verification Tool${NC}"
echo -e "${BLUE}  Проверка обновлений на сервере${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Check if we're in the right directory
echo -e "${YELLOW}[1/10] Checking application directory...${NC}"
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}Error: Directory $APP_DIR not found${NC}"
    echo "Please set APP_DIR environment variable or create the directory"
    exit 1
fi
print_status 0 "Directory exists: $APP_DIR"
echo ""

# Navigate to app directory
cd "$APP_DIR"

# Check git status
echo -e "${YELLOW}[2/10] Checking Git status...${NC}"
git status --short
if [ -z "$(git status --porcelain)" ]; then
    print_status 0 "Working directory is clean"
else
    print_status 1 "WARNING: You have uncommitted changes"
fi
echo ""

# Check current branch
echo -e "${YELLOW}[3/10] Checking current branch...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_status 1 "WARNING: Not on 'main' branch"
else
    print_status 0 "On 'main' branch"
fi
echo ""

# Check local vs remote commits
echo -e "${YELLOW}[4/10] Checking for updates from GitHub...${NC}"
if git fetch origin -q 2>/dev/null; then
    LOCAL_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH 2>/dev/null || echo "")

    if [ -z "$REMOTE_COMMIT" ]; then
        print_status 1 "WARNING: Cannot access remote branch"
        echo "This may be normal in CI/CD environments"
    else
        echo "Local commit:  $LOCAL_COMMIT"
        echo "Remote commit: $REMOTE_COMMIT"

        if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
            print_status 0 "Local and remote are in sync"
        else
            print_status 1 "WARNING: Local and remote differ"
            echo ""
            echo "Commits on remote not on local:"
            git log HEAD..origin/$CURRENT_BRANCH --oneline 2>/dev/null || echo "Cannot display commits"
            echo ""
            echo -e "${YELLOW}Run 'git pull origin $CURRENT_BRANCH' to update${NC}"
        fi
    fi
else
    print_status 1 "WARNING: Cannot fetch from remote"
    echo "This is normal in CI/CD environments"
    echo "In production, ensure you have internet access and credentials"
fi
echo ""

# Check last commit details
echo -e "${YELLOW}[5/10] Last commit information...${NC}"
git log -1 --pretty=format:"Commit: %h%nAuthor: %an%nDate:   %ar%nMessage: %s%n"
echo ""
echo ""

# Check if node_modules exists and is up to date
echo -e "${YELLOW}[6/10] Checking dependencies...${NC}"
if [ -f "package.json" ] && [ -d "node_modules" ]; then
    print_status 0 "node_modules directory exists"
    if [ "package.json" -nt "node_modules" ]; then
        print_status 1 "WARNING: package.json is newer than node_modules"
        echo -e "${YELLOW}Run 'npm install --production' to update${NC}"
    else
        print_status 0 "Dependencies appear up to date"
    fi
else
    print_status 1 "WARNING: node_modules not found"
    echo -e "${YELLOW}Run 'npm install --production'${NC}"
fi
echo ""

# Check if frontend is built
echo -e "${YELLOW}[7/10] Checking frontend build...${NC}"
if [ -d "dist" ]; then
    print_status 0 "dist directory exists"
    DIST_AGE=$(find dist -type f -name "index.html" -mmin +60 2>/dev/null | wc -l)
    if [ $DIST_AGE -gt 0 ]; then
        BUILD_TIME=$(stat -c %y dist/index.html 2>/dev/null || stat -f %Sm dist/index.html)
        echo "Last build: $BUILD_TIME"
        print_status 1 "WARNING: Build is more than 1 hour old"
        echo -e "${YELLOW}Run 'npm run build' to rebuild${NC}"
    else
        print_status 0 "Build is recent"
    fi
else
    print_status 1 "WARNING: dist directory not found"
    echo -e "${YELLOW}Run 'npm run build' to create it${NC}"
fi
echo ""

# Check backend process
echo -e "${YELLOW}[8/10] Checking backend process...${NC}"
if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 jlist 2>/dev/null)
    if echo "$PM2_STATUS" | grep -q "\"name\":\"$PROCESS_NAME\""; then
        print_status 0 "PM2 process '$PROCESS_NAME' found"
        
        # Check process uptime
        UPTIME=$(pm2 jlist | grep -A 20 "\"name\":\"$PROCESS_NAME\"" | grep "pm_uptime" | head -1 | grep -oP '\d+')
        if [ ! -z "$UPTIME" ]; then
            CURRENT_TIME=$(date +%s)
            UPTIME_SECONDS=$(( ($CURRENT_TIME * 1000 - $UPTIME) / 1000 ))
            UPTIME_MINUTES=$(( $UPTIME_SECONDS / 60 ))
            
            echo "Process uptime: $UPTIME_MINUTES minutes"
            
            if [ $UPTIME_MINUTES -gt 60 ]; then
                print_status 1 "WARNING: Process running for $UPTIME_MINUTES minutes"
                echo -e "${YELLOW}If you deployed code changes, run 'pm2 restart $PROCESS_NAME'${NC}"
            else
                print_status 0 "Process was recently restarted"
            fi
        fi
    else
        print_status 1 "WARNING: PM2 process '$PROCESS_NAME' not found"
        echo -e "${YELLOW}Run 'pm2 start ecosystem.config.js'${NC}"
    fi
else
    print_status 1 "PM2 not found - cannot check process status"
fi
echo ""

# Check database migrations
echo -e "${YELLOW}[9/10] Checking database migrations...${NC}"
if [ -d "prisma" ]; then
    print_status 0 "Prisma directory found"
    if command -v npx &> /dev/null; then
        # This command will show if migrations are pending
        MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || true)
        if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
            print_status 0 "Database migrations are up to date"
        elif echo "$MIGRATION_STATUS" | grep -q "following migrations have not yet been applied"; then
            print_status 1 "WARNING: Pending database migrations"
            echo "$MIGRATION_STATUS"
            echo -e "${YELLOW}Run 'npx prisma migrate deploy'${NC}"
        else
            echo "Migration status: unknown or needs attention"
            echo "$MIGRATION_STATUS"
        fi
    fi
else
    print_status 1 "WARNING: prisma directory not found"
fi
echo ""

# Check environment variables
echo -e "${YELLOW}[10/10] Checking environment configuration...${NC}"
if [ -f ".env" ]; then
    print_status 0 ".env file exists"
    
    # Check critical variables
    if grep -q "DATABASE_URL" .env && grep -q "JWT_SECRET" .env; then
        print_status 0 "Critical environment variables present"
    else
        print_status 1 "WARNING: Some critical variables may be missing"
    fi
else
    print_status 1 "WARNING: .env file not found"
    echo -e "${YELLOW}Copy .env.example to .env and configure it${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Summary / Резюме${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check if we could compare with remote
REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH 2>/dev/null || echo "")
LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ ! -z "$REMOTE_COMMIT" ] && [ ! -z "$LOCAL_COMMIT" ] && [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo -e "${RED}⚠ ACTION REQUIRED: Pull latest changes${NC}"
    echo -e "Run: ${YELLOW}git pull origin $CURRENT_BRANCH${NC}"
    echo ""
fi

if [ "package.json" -nt "node_modules" ] 2>/dev/null; then
    echo -e "${RED}⚠ ACTION REQUIRED: Update dependencies${NC}"
    echo -e "Run: ${YELLOW}npm install --production${NC}"
    echo ""
fi

if [ ! -d "dist" ] || [ $(find dist -type f -name "index.html" -mmin +60 2>/dev/null | wc -l) -gt 0 ]; then
    echo -e "${RED}⚠ ACTION REQUIRED: Rebuild frontend${NC}"
    echo -e "Run: ${YELLOW}npm run build${NC}"
    echo ""
fi

if command -v pm2 &> /dev/null; then
    PM2_RUNNING=$(pm2 jlist 2>/dev/null | grep -c "\"name\":\"$PROCESS_NAME\"" || echo "0")
    if [ "$PM2_RUNNING" -eq 0 ]; then
        echo -e "${RED}⚠ ACTION REQUIRED: Start backend process${NC}"
        echo -e "Run: ${YELLOW}pm2 start ecosystem.config.js${NC}"
        echo ""
    fi
fi

echo -e "${GREEN}✓ Verification complete${NC}"
echo ""
echo "For detailed troubleshooting, see:"
echo "  - SERVER_UPDATE_VISIBILITY_GUIDE.md (English)"
echo "  - QUICK_FIX_DEPLOYMENT_RU.md (Russian)"
echo ""
