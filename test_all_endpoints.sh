#!/bin/bash
# ========================================================
# Jeien Marketplace - Full Endpoint Test Suite
# ========================================================
set -e
BASE="http://localhost:5000/api"
PASS=0
FAIL=0
ERRORS=()

green="\e[32m"
red="\e[31m"
yellow="\e[33m"
blue="\e[34m"
reset="\e[0m"

check() {
    local label="$1"
    local method="$2"
    local url="$3"
    local token="$4"
    local body="$5"
    local expect_field="$6"

    if [ -n "$token" ] && [ -n "$body" ]; then
        response=$(curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$body" 2>&1)
    elif [ -n "$token" ]; then
        response=$(curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" 2>&1)
    elif [ -n "$body" ]; then
        response=$(curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$body" 2>&1)
    else
        response=$(curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" 2>&1)
    fi

    # Check for connection refused or curl error
    if echo "$response" | grep -q "Connection refused\|curl:"; then
        echo -e "${red}✗${reset} $label  ${red}[SERVER DOWN]${reset}"
        FAIL=$((FAIL+1))
        ERRORS+=("$label: Server Unreachable")
        return
    fi

    # Check for actual error response
    if echo "$response" | grep -qE '"message":".*error|"message":"Not authorized|"message":"Not found' ; then
        # If specific field expected, search for it
        if [ -n "$expect_field" ] && echo "$response" | grep -q "$expect_field"; then
            echo -e "${green}✓${reset} $label"
            PASS=$((PASS+1))
            return
        fi
        echo -e "${red}✗${reset} $label  ${red}← $(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','unknown error'))" 2>/dev/null)${reset}"
        FAIL=$((FAIL+1))
        ERRORS+=("$label: $(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','unknown error'))" 2>/dev/null)")
        return
    fi

    # Check if field expected and present
    if [ -n "$expect_field" ]; then
        if echo "$response" | grep -q "$expect_field"; then
            echo -e "${green}✓${reset} $label"
            PASS=$((PASS+1))
        else
            echo -e "${red}✗${reset} $label  ${red}← field '$expect_field' not in response${reset}"
            echo "    Response: $(echo "$response" | head -c 200)"
            FAIL=$((FAIL+1))
            ERRORS+=("$label: Expected field '$expect_field' missing")
        fi
    else
        if echo "$response" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
            echo -e "${green}✓${reset} $label"
            PASS=$((PASS+1))
        else
            echo -e "${red}✗${reset} $label  ${red}← non-JSON or error${reset}"
            echo "    Response: $(echo "$response" | head -c 200)"
            FAIL=$((FAIL+1))
            ERRORS+=("$label: Non-JSON or error")
        fi
    fi
}

echo ""
echo -e "${blue}============================================${reset}"
echo -e "${blue}  JEIEN API ENDPOINT TEST SUITE${reset}"
echo -e "${blue}============================================${reset}"

# ── HEALTH CHECK ──────────────────────────────
echo ""
echo -e "${yellow}[1/10] Health Check${reset}"
check "GET / (health)" "GET" "http://localhost:5000/" "" "" "status"

# ── AUTH ───────────────────────────────────────
echo ""
echo -e "${yellow}[2/10] Auth Endpoints${reset}"

# Login as admin
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"caprufru@gmail.com","password":"jeien@2026MAIN@"}' 2>&1)


ADMIN_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${red}✗${reset} POST /auth/login (admin) ← No token returned. Response: $(echo "$LOGIN_RESP" | head -c 300)"
    FAIL=$((FAIL+1))
    ERRORS+=("Admin Login: No token. Response: $(echo "$LOGIN_RESP" | head -c 200)")
    echo -e "${red}Cannot continue without admin token. Exiting.${reset}"
    exit 1
else
    echo -e "${green}✓${reset} POST /auth/login (admin) ← Token acquired"
    PASS=$((PASS+1))
fi

# Register a test buyer
BUYER_REG=$(curl -s -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Buyer","email":"testbuyer_ci@jeien.com","password":"test1234","phone":"0700000001","role":"user"}' 2>&1)
BUYER_TOKEN=$(echo "$BUYER_REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -n "$BUYER_TOKEN" ]; then
    echo -e "${green}✓${reset} POST /auth/register (buyer) ← Token acquired"
    PASS=$((PASS+1))
else
    # Maybe already registered - try login
    LOGIN_BUYER=$(curl -s -X POST "$BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"testbuyer_ci@jeien.com","password":"test1234"}' 2>&1)
    BUYER_TOKEN=$(echo "$LOGIN_BUYER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
    if [ -n "$BUYER_TOKEN" ]; then
        echo -e "${green}✓${reset} POST /auth/register (buyer already exists, login ok)"
        PASS=$((PASS+1))
    else
        echo -e "${red}✗${reset} POST /auth/register (buyer) ← $(echo "$BUYER_REG" | head -c 200)"
        FAIL=$((FAIL+1))
        ERRORS+=("Register Buyer: failed")
    fi
fi

# Register a test vendor
VENDOR_REG=$(curl -s -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Vendor","email":"testvendor_ci@jeien.com","password":"test1234","phone":"0700000002","role":"vendor","storeName":"CI Test Store","storeDescription":"A CI store","idNumber":"12345678"}' 2>&1)
VENDOR_TOKEN=$(echo "$VENDOR_REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -n "$VENDOR_TOKEN" ]; then
    echo -e "${green}✓${reset} POST /auth/register (vendor) ← Token acquired"
    PASS=$((PASS+1))
else
    LOGIN_VENDOR=$(curl -s -X POST "$BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"testvendor_ci@jeien.com","password":"test1234"}' 2>&1)
    VENDOR_TOKEN=$(echo "$LOGIN_VENDOR" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
    if [ -n "$VENDOR_TOKEN" ]; then
        echo -e "${green}✓${reset} POST /auth/register (vendor already exists, login ok)"
        PASS=$((PASS+1))
    else
        echo -e "${red}✗${reset} POST /auth/register (vendor) ← $(echo "$VENDOR_REG" | head -c 200)"
        FAIL=$((FAIL+1))
        ERRORS+=("Register Vendor: failed")
    fi
fi

check "GET /auth/profile (admin)" "GET" "$BASE/auth/profile" "$ADMIN_TOKEN" "" "email"
check "PUT /auth/profile (admin)" "PUT" "$BASE/auth/profile" "$ADMIN_TOKEN" '{"name":"Main Admin Updated"}' "email"
# Reset back
curl -s -X PUT "$BASE/auth/profile" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"name":"Main Admin"}' > /dev/null 2>&1

# ── CATEGORIES ────────────────────────────────
echo ""
echo -e "${yellow}[3/10] Category Endpoints${reset}"
check "GET /categories" "GET" "$BASE/categories" "" "" "_id"

# Get a category ID for use in product test
CATS=$(curl -s "$BASE/categories" 2>/dev/null)
CAT_ID=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print(cats[0]['_id'] if cats else '')" 2>/dev/null)
CAT_NAME=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print(cats[0]['name'] if cats else 'Electronics')" 2>/dev/null)

# ── PRODUCTS ─────────────────────────────────
echo ""
echo -e "${yellow}[4/10] Product Endpoints${reset}"
check "GET /products (public)" "GET" "$BASE/products" "" "" "_id"

# Get a product ID for later tests
PRODS=$(curl -s "$BASE/products" 2>/dev/null)
PROD_ID=$(echo "$PRODS" | python3 -c "import sys,json; prods=json.load(sys.stdin); plist=prods.get('products',prods) if isinstance(prods,dict) else prods; print(plist[0]['_id'] if plist else '')" 2>/dev/null)

if [ -n "$PROD_ID" ]; then
    check "GET /products/:id" "GET" "$BASE/products/$PROD_ID" "" "" "_id"
fi

check "GET /products/mine (vendor)" "GET" "$BASE/products/mine" "$VENDOR_TOKEN" "" ""

# ── VENDORS ───────────────────────────────────
echo ""
echo -e "${yellow}[5/10] Vendor Endpoints${reset}"
check "GET /vendors/top" "GET" "$BASE/vendors/top" "" "" ""
check "GET /vendors/me/followers" "GET" "$BASE/vendors/me/followers" "$VENDOR_TOKEN" "" ""

# ── ORDERS ────────────────────────────────────
echo ""
echo -e "${yellow}[6/10] Order Endpoints${reset}"
check "GET /orders/myorders (buyer)" "GET" "$BASE/orders/myorders" "$BUYER_TOKEN" "" ""
check "GET /orders/vendor (vendor)" "GET" "$BASE/orders/vendor" "$VENDOR_TOKEN" "" ""

# Create a test order as buyer if we have a product
if [ -n "$PROD_ID" ]; then
    ORDER_BODY="{\"orderItems\":[{\"product\":\"$PROD_ID\",\"name\":\"Test Product\",\"quantity\":1,\"price\":100,\"image\":\"\"}],\"shippingAddress\":{\"address\":\"123 Test St\",\"city\":\"Nairobi\",\"county\":\"Nairobi\",\"postalCode\":\"00100\",\"phone\":\"0712345678\"},\"paymentMethod\":\"mpesa\",\"totalPrice\":100}"
    ORDER_RESP=$(curl -s -X POST "$BASE/orders" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $BUYER_TOKEN" \
        -d "$ORDER_BODY" 2>&1)
    ORDER_ID=$(echo "$ORDER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('_id',''))" 2>/dev/null)
    if [ -n "$ORDER_ID" ]; then
        echo -e "${green}✓${reset} POST /orders (create order)"
        PASS=$((PASS+1))
        check "GET /orders/:id" "GET" "$BASE/orders/$ORDER_ID" "$BUYER_TOKEN" "" "_id"
    else
        echo -e "${red}✗${reset} POST /orders ← $(echo "$ORDER_RESP" | head -c 200)"
        FAIL=$((FAIL+1))
        ERRORS+=("Create Order: $(echo "$ORDER_RESP" | head -c 200)")
    fi
else
    echo -e "${yellow}⚠${reset} POST /orders ← Skipped (no product ID)"
fi

# ── PAYMENTS ──────────────────────────────────
echo ""
echo -e "${yellow}[7/10] Payment Endpoints${reset}"
check "GET /payments (admin)" "GET" "$BASE/payments" "$ADMIN_TOKEN" "" ""

# ── SETTINGS (Public) ─────────────────────────
echo ""
echo -e "${yellow}[8/10] Settings Endpoints${reset}"
check "GET /settings" "GET" "$BASE/settings" "" "" "siteName"

# ── NOTIFICATIONS ────────────────────────────
echo ""
echo -e "${yellow}[9/10] Notification Endpoints${reset}"
check "GET /notifications" "GET" "$BASE/notifications" "$BUYER_TOKEN" "" ""

# ── ADMIN ENDPOINTS ───────────────────────────
echo ""
echo -e "${yellow}[10/10] Admin Endpoints${reset}"
check "GET /admin/stats" "GET" "$BASE/admin/stats" "$ADMIN_TOKEN" "" ""
check "GET /admin/users" "GET" "$BASE/admin/users" "$ADMIN_TOKEN" "" ""
check "GET /admin/products" "GET" "$BASE/admin/products" "$ADMIN_TOKEN" "" "_id"
check "GET /admin/orders" "GET" "$BASE/admin/orders" "$ADMIN_TOKEN" "" ""
check "GET /admin/payments" "GET" "$BASE/admin/payments" "$ADMIN_TOKEN" "" ""
check "GET /admin/settings" "GET" "$BASE/admin/settings" "$ADMIN_TOKEN" "" "siteName"
check "GET /admin/reports/revenue" "GET" "$BASE/admin/reports/revenue" "$ADMIN_TOKEN" "" ""

# Admin: approve vendor
VENDOR_USER_ID=$(curl -s "$BASE/admin/users" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null | \
    python3 -c "import sys,json; users=json.load(sys.stdin); vends=[u for u in users if u.get('role')=='vendor']; print(vends[0]['_id'] if vends else '')" 2>/dev/null)
if [ -n "$VENDOR_USER_ID" ]; then
    check "PUT /admin/vendor/:id/verify (approve)" "PUT" "$BASE/admin/vendor/$VENDOR_USER_ID/verify" "$ADMIN_TOKEN" '{"status":"approved"}' "vendorStatus"
fi

# Admin: approve product
if [ -n "$PROD_ID" ]; then
    check "PUT /admin/products/:id/approve" "PUT" "$BASE/admin/products/$PROD_ID/approve" "$ADMIN_TOKEN" '{"isApproved":true}' "isApproved"
    check "PUT /admin/products/:id/feature" "PUT" "$BASE/admin/products/$PROD_ID/feature" "$ADMIN_TOKEN" "" ""
fi

# Admin: update settings
check "PUT /admin/settings" "PUT" "$BASE/admin/settings" "$ADMIN_TOKEN" '{"siteName":"Jeien Marketplace","announcement":"Test Announcement"}' "siteName"

# Security check: non-admin cannot access admin routes
UNAUTH_RESP=$(curl -s "$BASE/admin/users" \
    -H "Authorization: Bearer $BUYER_TOKEN" 2>/dev/null)
if echo "$UNAUTH_RESP" | grep -q "Not authorized\|admin\|access denied"; then
    echo -e "${green}✓${reset} Auth Guard: Non-admin blocked from /admin/users"
    PASS=$((PASS+1))
else
    echo -e "${red}✗${reset} Auth Guard: Non-admin may have accessed /admin endpoint! Response: $(echo "$UNAUTH_RESP" | head -c 150)"
    FAIL=$((FAIL+1))
    ERRORS+=("Security: Buyer could access /admin/users")
fi

# No token check
NOTOKEN_RESP=$(curl -s "$BASE/admin/stats" 2>/dev/null)
if echo "$NOTOKEN_RESP" | grep -qE "Not authorized|token|Unauthorized"; then
    echo -e "${green}✓${reset} Auth Guard: Unauthenticated request properly blocked from /admin/stats"
    PASS=$((PASS+1))
else
    echo -e "${red}✗${reset} Auth Guard: Unauthenticated request not blocked! Response: $(echo "$NOTOKEN_RESP" | head -c 150)"
    FAIL=$((FAIL+1))
    ERRORS+=("Security: No-token access to /admin/stats succeeded")
fi

# ── SUMMARY ───────────────────────────────────
TOTAL=$((PASS+FAIL))
echo ""
echo -e "${blue}============================================${reset}"
echo -e "${blue}  RESULTS: $PASS/$TOTAL tests passed${reset}"
if [ $FAIL -gt 0 ]; then
    echo -e "${red}  FAILURES: $FAIL${reset}"
    echo ""
    for err in "${ERRORS[@]}"; do
        echo -e "${red}  ✗ $err${reset}"
    done
fi
echo -e "${blue}============================================${reset}"
echo ""
