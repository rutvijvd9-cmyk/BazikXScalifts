# 🔌 Manubhai Gathiyawala WhatsApp CRM — PHP Store Integration Guide

This document is the official developer guide for connecting the **Manubhai Gathiyawala e-commerce website (PHP)** with the **WhatsApp CRM Automation Backend**.

---

## 📌 Executive Overview

The WhatsApp CRM automatically handles two critical customer journeys via HMAC-SHA256 signed webhooks:
1. **Abandoned Cart Recovery**: Automatically schedules a personalized WhatsApp reminder with discount offers (default 30-minute delay) when customers leave items in their cart.
2. **Order Completed / Purchase**: Immediately cancels any pending abandoned cart recovery messages so the customer is not spammed, updates customer order count, and delivers milestone VIP discounts (e.g. 5th, 10th order rewards).

---

## 1. Credentials & Configuration Required

The PHP store requires **two configuration values**. Set these in your PHP environment (`.env`, `php.ini`, or VirtualHost/Server environment):

| Environment Variable | Description | Example Value |
|---|---|---|
| `CRM_BASE_URL` | Base URL of the deployed WhatsApp CRM API | `https://crm-api.manubhaigathiyawala.com` |
| `CRM_WEBHOOK_SECRET` | Shared secret key for HMAC-SHA256 request signing (min. 16 characters) | `wbhsec_98f3b482a174c891...` |

> ⚠️ **Security Requirement**: Never hardcode `CRM_WEBHOOK_SECRET` in version control or plain PHP source code.

---

## 2. Integration File: `ManubhaiWhatsAppCRM.php`

Copy the zero-dependency helper class below into your PHP project (e.g., in `includes/ManubhaiWhatsAppCRM.php` or `lib/ManubhaiWhatsAppCRM.php`):

```php
<?php
/**
 * Manubhai Gathiyawala - WhatsApp CRM Integration Client
 * 
 * Standalone, zero-dependency PHP helper:
 * - Compatible with PHP 7.0+ through 8.2+
 * - Uses native cURL and hash_hmac (no Composer required)
 * - Strict 2-second timeout so store browsing/checkout is never slowed down
 */

class ManubhaiWhatsAppCRM {

    private static function crmBaseUrl() {
        $value = getenv('CRM_BASE_URL');
        if (!$value) {
            throw new RuntimeException('CRM_BASE_URL must be configured in the PHP environment.');
        }
        return rtrim($value, '/');
    }

    private static function webhookSecret() {
        $value = getenv('CRM_WEBHOOK_SECRET');
        if (!$value) {
            throw new RuntimeException('CRM_WEBHOOK_SECRET must be configured in the PHP environment.');
        }
        return $value;
    }

    /**
     * Triggered when customer updates their shopping cart.
     *
     * @param string $cartToken      Unique cart session ID or cart token
     * @param string $customerPhone  Customer phone number (e.g. "9876543210")
     * @param float  $cartTotal      Total cart value (e.g. 450.00)
     * @param array  $items          Item details: [["item" => "Vanela Gathiya 500g", "qty" => 2]]
     * @param int    $delaySeconds   Delay before WhatsApp reminder (default 1800s = 30 minutes)
     * @param string $customerName   Optional customer full name
     * @return array                 Parsed response array
     */
    public static function sendCartEvent($cartToken, $customerPhone, $cartTotal, $items = [], $delaySeconds = 1800, $customerName = '') {
        $formattedPhone = self::formatPhone($customerPhone);

        $payload = [
            "cart_token"     => (string)$cartToken,
            "customer_phone" => $formattedPhone,
            "cart_value"     => (float)$cartTotal,
            "items"          => $items,
            "customer_name"  => (string)$customerName
        ];

        $endpoint = self::crmBaseUrl() . "/api/webhooks/cart-event?delay_seconds=" . intval($delaySeconds);
        return self::sendPostRequest($endpoint, $payload, "cart:" . $cartToken);
    }

    /**
     * Triggered on successful order completion / payment confirmation.
     * Cancels any pending recovery messages and increments customer order milestones.
     *
     * @param string $cartToken      Cart token or order ID matching the cart event
     * @param string $customerPhone  Customer phone number
     * @return array                 Parsed response array
     */
    public static function sendOrderCompleted($cartToken, $customerPhone) {
        $formattedPhone = self::formatPhone($customerPhone);

        $payload = [
            "cart_token"     => (string)$cartToken,
            "customer_phone" => $formattedPhone
        ];

        $endpoint = self::crmBaseUrl() . "/api/webhooks/order-completed";
        return self::sendPostRequest($endpoint, $payload, "order:" . $cartToken);
    }

    /**
     * Sends an HMAC-SHA256 signed JSON POST request.
     */
    private static function sendPostRequest($url, $payloadArray, $idempotencyKey) {
        $jsonPayload = json_encode($payloadArray, JSON_UNESCAPED_SLASHES);

        // Generate HMAC-SHA256 signature
        $signature = "sha256=" . hash_hmac('sha256', $jsonPayload, self::webhookSecret());

        $requestId = bin2hex(random_bytes(16));

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-Hub-Signature-256: " . $signature,
            "X-Idempotency-Key: " . $idempotencyKey,
            "X-Request-ID: " . $requestId
        ]);

        // Strict non-blocking timeouts (never slow down the store)
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ["status" => "error", "message" => $error];
        }

        return [
            "http_code" => $httpCode,
            "data"      => json_decode($response, true)
        ];
    }

    /**
     * Normalizes phone number to international E.164 (+91XXXXXXXXXX)
     */
    private static function formatPhone($phone) {
        $clean = preg_replace('/[^0-9]/', '', (string)$phone);
        if (strlen($clean) === 10) {
            return "+91" . $clean;
        }
        if (strlen($clean) === 12 && substr($clean, 0, 2) === "91") {
            return "+" . $clean;
        }
        return "+" . $clean;
    }
}
```

---

## 3. Implementation Steps (2 Integration Hooks)

### Hook 1: When Cart is Updated / Abandoned
Add this inside the cart controller or AJAX update handler (e.g. `cart.php`, `update_cart.php`, or checkout step 1 where the customer provides their phone number):

```php
require_once __DIR__ . '/includes/ManubhaiWhatsAppCRM.php';

// Fire when phone number and cart contents are present
$cartId = session_id(); // Or your internal cart ID / token
$customerPhone = $_POST['phone'] ?? $user['phone']; 
$cartTotal = 480.00;
$items = [
    ["item" => "Nylon Papdi Gathiya 500g", "qty" => 2],
    ["item" => "Special Kadhi Masala", "qty" => 1]
];
$customerName = "Rameshbhai Patel";

$result = ManubhaiWhatsAppCRM::sendCartEvent(
    $cartId,
    $customerPhone,
    $cartTotal,
    $items,
    1800, // 1800 seconds = 30 minutes recovery delay
    $customerName
);
```

---

### Hook 2: On Order Success / Payment Completed
Add this in the order completion or payment callback script (e.g. `order_success.php`, `thank_you.php`, Razorpay/PayTM webhook handler):

```php
require_once __DIR__ . '/includes/ManubhaiWhatsAppCRM.php';

// Cancels the scheduled recovery message immediately
$result = ManubhaiWhatsAppCRM::sendOrderCompleted(
    $order['cart_token'], // Or session_id() used during checkout
    $order['customer_phone']
);
```

---

## 4. Raw HTTP API Reference

If you prefer to make raw HTTP requests using Guzzle, Laravel HTTP Client, or WordPress HTTP API:

### A. Cart Event Webhook
- **Method & Path**: `POST /api/webhooks/cart-event?delay_seconds=1800`
- **Headers**:
  ```http
  Content-Type: application/json
  X-Hub-Signature-256: sha256=<HMAC_SHA256_HEX_DIGEST>
  X-Idempotency-Key: cart:<cart_token>
  X-Request-ID: <unique_uuid_or_random_hex>
  ```
- **Payload**:
  ```json
  {
    "cart_token": "cart_998877",
    "customer_phone": "+919876543210",
    "cart_value": 450.0,
    "items": [
      { "item": "Bhavnagari Gathiya 500g", "qty": 1 }
    ],
    "customer_name": "Ramesh Patel"
  }
  ```
- **Success Response (`202 Accepted`)**:
  ```json
  {
    "status": "received",
    "cart_event_id": 142,
    "workflow_session_id": 88,
    "scheduled_in_seconds": 1800,
    "message": "Cart event registered and recovery workflow scheduled in 1800s"
  }
  ```

---

### B. Order Completed Webhook
- **Method & Path**: `POST /api/webhooks/order-completed`
- **Headers**:
  ```http
  Content-Type: application/json
  X-Hub-Signature-256: sha256=<HMAC_SHA256_HEX_DIGEST>
  X-Idempotency-Key: order:<cart_token>
  X-Request-ID: <unique_uuid_or_random_hex>
  ```
- **Payload**:
  ```json
  {
    "cart_token": "cart_998877",
    "customer_phone": "+919876543210"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "message": "Cart cart_998877 marked as RECOVERED. Recovery message cancelled.",
    "milestone": "Milestone 5th order reward dispatched with coupon VIP5",
    "total_orders": 5
  }
  ```

---

## 5. Security & Verification Rules

1. **HMAC Signing**: All requests must be hashed using the shared `CRM_WEBHOOK_SECRET`.
   ```php
   $signature = "sha256=" . hash_hmac('sha256', $rawJsonBody, $secret);
   ```
   Requests with missing or invalid signatures will return `401 Unauthorized`.
2. **Phone Number Formatting**: Numbers can be passed as `9876543210`, `09876543210`, or `+919876543210`. The CRM normalizes all inputs to canonical international E.164 (`+919876543210`).
3. **Idempotency**: Passing a distinct `X-Idempotency-Key` guarantees that accidental network retries from your server do not create duplicate messages or duplicate orders.

---

## 6. Testing Your Integration

A test script is available in the CRM repository: `php-integration/test_integration.php`.

Run the test script via CLI:
```bash
CRM_BASE_URL="https://your-crm-domain.com" CRM_WEBHOOK_SECRET="your_shared_secret" php test_integration.php
```

**Expected output**:
```text
[1/2] Testing Cart Event Webhook...
Result: HTTP 202 - Status: received

[2/2] Testing Order Completed Webhook...
Result: HTTP 200 - Status: success
Integration tests completed successfully!
```
