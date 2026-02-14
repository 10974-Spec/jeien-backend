#!/bin/bash

# Test M-Pesa Webhook Handler
# This script simulates an M-Pesa callback to test the webhook handler

echo "Testing M-Pesa Webhook Handler"
echo "================================"

# Get order ID from command line or use default
ORDER_ID="${1:-6990be7f5569cafb35df8f80}"
TRANSACTION_ID="${2:-ws_CO_14022026212716492117041805}"

echo "Order ID: $ORDER_ID"
echo "Transaction ID: $TRANSACTION_ID"
echo ""

# Test local endpoint
echo "Testing LOCAL endpoint..."
curl -X POST http://localhost:5000/api/payments/mpesa/callback \
  -H "Content-Type: application/json" \
  -d "{
    \"Body\": {
      \"stkCallback\": {
        \"CheckoutRequestID\": \"$TRANSACTION_ID\",
        \"ResultCode\": 0,
        \"ResultDesc\": \"Success. Request accepted for processing\",
        \"CallbackMetadata\": {
          \"Item\": [
            {\"Name\": \"Amount\", \"Value\": 1},
            {\"Name\": \"MpesaReceiptNumber\", \"Value\": \"TEST$(date +%s)\"},
            {\"Name\": \"PhoneNumber\", \"Value\": \"254712345678\"}
          ]
        }
      }
    }
  }" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "================================"
echo "Check server logs for detailed output"
echo "================================"
