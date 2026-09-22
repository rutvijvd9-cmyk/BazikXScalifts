# 📦 Manubhai Gathiyawala — Store-to-CRM Webhook Integration Manual

**Platform Target**: External PHP E-Commerce Website (Custom PHP, WooCommerce, Laravel, Magento, OpenCart)  
**CRM Service**: Manubhai Gathiyawala WhatsApp Automation Platform  
**Default Endpoint URL**: `https://manubhaigathiya-whatsapp.onrender.com`  

---

## 🎯 What This Integration Does

This integration links your PHP store to the WhatsApp CRM for 3 automatic actions:

1. **User Account Created / Profile Sync**:
   - Whenever a user registers an account, signs up, or updates their profile on your store, their contact details (Phone, Name, Email, City, Tags, Custom Fields) are quietly synced into the CRM database.
   - Quiet sync means **no spam** or unwanted messages are sent automatically unless an active Double Opt-in or Welcome automation is configured.

2. **Cart Abandonment Event**:
   - When a customer adds items to their cart and begins checkout, your store notifies the CRM.
   - If the user leaves without completing checkout, the CRM automatically delivers a WhatsApp reminder with special recovery offers (default 30-minute delay).

3. **Order Placed / Checkout Completed**:
   - When payment succeeds or an order is confirmed, your store notifies the CRM.
   - The CRM **immediately cancels** any scheduled cart recovery message so the customer is never spammed.
   - The CRM increments order history, awards VIP milestone offers (e.g. 5th, 10th order discount coupons), and updates customer metrics.

---

## 🔑 1. Setup & Credentials

You need **two configuration values** in your PHP project:

| Setting Key | Value | Description |
| :--- | :--- | :--- |
| `CRM_BASE_URL` | `https://manubhaigathiya-whatsapp.onrender.com` | Base URL of the WhatsApp CRM API (omit trailing slash). |
| `CRM_WEBHOOK_SECRET` | *(Provided securely by store admin)* | Shared secret key for HMAC-SHA256 request authentication. |

### Setting Environment Variables in PHP
You can supply these credentials in any of the following ways:
- In your `.env` file:
  ```env
  CRM_BASE_URL=https://manubhaigathiya-whatsapp.onrender.com
  CRM_WEBHOOK_SECRET=your_secret_key_here
  ```
- In `wp-config.php` (if using WordPress/WooCommerce):
  ```php
  define('CRM_BASE_URL', 'https://manubhaigathiya-whatsapp.onrender.com');
  define('CRM_WEBHOOK_SECRET', 'your_secret_key_here');
  ```
- Or call `ManubhaiWhatsAppCRM::init('your_secret_key_here')` directly before making any calls.

---

## 📁 2. Ready-to-Use PHP Helper Class (`ManubhaiWhatsAppCRM.php`)

Place this file in your project (e.g. `includes/ManubhaiWhatsAppCRM.php`). It has **zero external dependencies** and uses standard PHP cURL. It is strictly non-blocking with a **2-second timeout**, guaranteeing that checkout or page speed is never impacted.

```php
<?php
/**
 * Manubhai Gathiyawala - WhatsApp CRM Integration Client
 * Zero dependencies. Compatible with PHP 7.0 through PHP 8.3+.
 */
class ManubhaiWhatsAppCRM {

    public static $baseUrl = null;
    public static $secret = null;

    /**
     * Optional manual initialization if not using getenv() or define().
     * Example: ManubhaiWhatsAppCRM::init('YOUR_SECRET_KEY');
     */
    public static function init($secret, $baseUrl = 'https://manubhaigathiya-whatsapp.onrender.com') {
        self::$secret = $secret;
        self::$baseUrl = rtrim($baseUrl, '/');
    }

    private static function crmBaseUrl() {
        if (!empty(self::$baseUrl)) {
            return self::$baseUrl;
        }
        $value = getenv('CRM_BASE_URL') ?: (isset($_ENV['CRM_BASE_URL']) ? $_ENV['CRM_BASE_URL'] : (defined('CRM_BASE_URL') ? constant('CRM_BASE_URL') : null));
        return rtrim($value ?: 'https://manubhaigathiya-whatsapp.onrender.com', '/');
    }

    private static function webhookSecret() {
        if (!empty(self::$secret)) {
            return self::$secret;
        }
        $value = getenv('CRM_WEBHOOK_SECRET') ?: (isset($_ENV['CRM_WEBHOOK_SECRET']) ? $_ENV['CRM_WEBHOOK_SECRET'] : (defined('CRM_WEBHOOK_SECRET') ? constant('CRM_WEBHOOK_SECRET') : null));
        if (!$value) {
            throw new RuntimeException('CRM_WEBHOOK_SECRET is not configured.');
        }
        return $value;
    }

    /**
     * 1. Customer Account Registration or Profile Sync
     * Quietly syncs a contact to the CRM.
     */
    public static function syncCustomer($customerPhone, $name = null, $email = null, $city = null, $extraData = []) {
        $formattedPhone = self::formatPhone($customerPhone);

        $payload = array_merge([
            "phone" => $formattedPhone,
            "name"  => $name,
            "email" => $email,
            "city"  => $city,
            "tags"  => "Website Customer"
        ], $extraData);

        $endpoint = self::crmBaseUrl() . "/api/webhooks/customer-sync";
        return self::sendPostRequest($endpoint, $payload, "sync:" . $formattedPhone . ":" . time());
    }

    /**
     * 2. Shopping Cart Update / Abandoned Cart Reminder
     * Schedules a recovery message if checkout is not completed within $delaySeconds.
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
     * 3. Order Placed / Completed
     * Immediately cancels the pending cart reminder and logs purchase milestones.
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
     * Sends HMAC-SHA256 signed JSON POST request.
     */
    private static function sendPostRequest($url, $payloadArray, $idempotencyKey) {
        $jsonPayload = json_encode($payloadArray, JSON_UNESCAPED_SLASHES);
        $signature   = "sha256=" . hash_hmac('sha256', $jsonPayload, self::webhookSecret());
        $requestId   = bin2hex(random_bytes(16));

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
     * Formats phone numbers to international E.164 (+91XXXXXXXXXX)
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

## 🛠️ 3. Integration Code Examples

### A. When a Customer Creates an Account or Updates Profile
Add this to `register.php`, your account creation controller, or WooCommerce hook `woocommerce_created_customer`:

```php
require_once __DIR__ . '/includes/ManubhaiWhatsAppCRM.php';

// Optional: If not using environment variables:
// ManubhaiWhatsAppCRM::init('your_secret_key_here');

$result = ManubhaiWhatsAppCRM::syncCustomer(
    $_POST['phone'],              // Customer phone: "9876543210" or "+919876543210"
    $_POST['full_name'],          // e.g. "Bhavik Patel"
    $_POST['email'],              // e.g. "bhavik@example.com"
    $_POST['city'],               // e.g. "Ahmedabad"
    [
        "tags"            => "Website Registered, VIP",
        "birth_day"       => 15,
        "birth_month"     => 8,
        "membership_tier" => "Gold",
        "account_id"      => (string)$_SESSION['user_id']
    ]
);
```

---

### B. When Items Are Added to Cart or Cart Is Updated
Add this in `cart.php`, `ajax_cart_update.php`, or during the checkout step where the user enters their phone number:

```php
require_once __DIR__ . '/includes/ManubhaiWhatsAppCRM.php';

$cartToken = session_id(); // Or cart identifier
$phone     = $_POST['phone'] ?? $_SESSION['user_phone'];
$total     = 550.00;
$items     = [
    ["item" => "Special Nylon Papdi Gathiya 500g", "qty" => 2],
    ["item" => "Methi Sambharo & Kadhi Chutney Pack", "qty" => 1]
];
$userName  = $_SESSION['user_name'] ?? "Valued Customer";

// Trigger cart event with 1800 seconds (30 mins) recovery delay:
$result = ManubhaiWhatsAppCRM::sendCartEvent(
    $cartToken,
    $phone,
    $total,
    $items,
    1800,
    $userName
);
```

---

### C. When an Order Is Placed / Payment Completed
Add this in your order success page (`order_complete.php`, `thank_you.php`, or payment gateway callback like Razorpay / PayTM / Cash on Delivery handler):

```php
require_once __DIR__ . '/includes/ManubhaiWhatsAppCRM.php';

$cartToken = session_id(); // The same cartToken or order ID used above
$phone     = $order['customer_phone'];

// Immediately cancels pending recovery message and credits order count:
$result = ManubhaiWhatsAppCRM::sendOrderCompleted($cartToken, $phone);
```

---

## 📡 4. Direct HTTP API Reference (For cURL / Postman / Custom HTTP Clients)

If your platform prefers raw HTTP requests instead of the PHP class:

### 1. Customer Sync Endpoint
- **URL**: `POST https://manubhaigathiya-whatsapp.onrender.com/api/webhooks/customer-sync`
- **Headers**:
  ```http
  Content-Type: application/json
  X-Hub-Signature-256: sha256=<HMAC_SHA256_HEX>
  X-Idempotency-Key: sync:<phone>:<timestamp>
  ```
  *(Alternative Auth Header: `X-API-Key: <CRM_WEBHOOK_SECRET>` or `Authorization: Bearer <CRM_WEBHOOK_SECRET>`)*
- **Payload**:
  ```json
  {
    "phone": "+919876543210",
    "name": "Bhavik Shah",
    "email": "bhavik@example.com",
    "city": "Ahmedabad",
    "tags": "Website Customer",
    "birth_day": 15,
    "birth_month": 8
  }
  ```

### 2. Cart Event Endpoint
- **URL**: `POST https://manubhaigathiya-whatsapp.onrender.com/api/webhooks/cart-event?delay_seconds=1800`
- **Headers**:
  ```http
  Content-Type: application/json
  X-Hub-Signature-256: sha256=<HMAC_SHA256_HEX>
  X-Idempotency-Key: cart:<cart_token>
  ```
- **Payload**:
  ```json
  {
    "cart_token": "cart_abc123",
    "customer_phone": "+919876543210",
    "cart_value": 450.0,
    "items": [
      { "item": "Vanela Gathiya 500g", "qty": 2 }
    ],
    "customer_name": "Bhavik Shah"
  }
  ```

### 3. Order Completed Endpoint
- **URL**: `POST https://manubhaigathiya-whatsapp.onrender.com/api/webhooks/order-completed`
- **Headers**:
  ```http
  Content-Type: application/json
  X-Hub-Signature-256: sha256=<HMAC_SHA256_HEX>
  X-Idempotency-Key: order:<cart_token>
  ```
- **Payload**:
  ```json
  {
    "cart_token": "cart_abc123",
    "customer_phone": "+919876543210"
  }
  ```

---

## 🧪 5. Testing the Integration

To verify that your PHP store server can reach the CRM:
1. Open terminal on your PHP server or local environment.
2. Run:
   ```bash
   CRM_WEBHOOK_SECRET="your_secret_key" php php-integration/test_integration.php
   ```
3. You will see 3 success responses:
   - `HTTP 202 Accepted` on Cart Event.
   - `HTTP 200 OK` on Order Completed.
   - `HTTP 200 OK` on Customer Sync.
