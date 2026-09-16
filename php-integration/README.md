# 🔌 Manubhai Gathiyawala - WhatsApp CRM Integration Guide

This directory provides the exact, zero-dependency integration client for **manubhaigathiyawala.com** (Custom PHP ecommerce platform).

---

## 📁 File Included
- **`ManubhaiWhatsAppCRM.php`**: Standalone helper class using standard PHP cURL and `hash_hmac`. Zero external Composer libraries needed. Works on PHP 7.0, 7.4, 8.0, 8.1, 8.2+.

Before using it, configure `CRM_BASE_URL` and `CRM_WEBHOOK_SECRET` in the PHP
environment. Copy the names from `.env.example`; never place these values in PHP source code.

---

## 🚀 Quick Setup (Only 2 Hooks Needed)

### 1. In your Cart / Session Handler (`cart.php` or wherever cart is updated):
Whenever a logged-in customer adds an item or updates their shopping cart, add this snippet:

```php
require_once __DIR__ . '/path/to/ManubhaiWhatsAppCRM.php';

// Trigger abandoned cart recovery timer (30-minute delay)
ManubhaiWhatsAppCRM::sendCartEvent(
    session_id(),              // or unique Cart ID / Order Token
    $customer_phone,           // e.g. "9876543210"
    $cart_total_amount,        // e.g. 620.00
    [
        ["item" => "Bhavnagari Gathiya 500g", "qty" => 2],
        ["item" => "Special Sev 250g", "qty" => 1]
    ],
    1800                       // 1800 seconds = 30 minutes
);
```

---

### 2. In your Checkout / Payment Success Handler (`order_success.php` or `thank_you.php`):
When a customer completes their purchase, fire this to **cancel the recovery message immediately**:

```php
require_once __DIR__ . '/path/to/ManubhaiWhatsAppCRM.php';

// Marks the cart as RECOVERED so the WhatsApp message is NEVER sent
ManubhaiWhatsAppCRM::sendOrderCompleted(
    session_id(),              // matching Cart ID / Token
    $customer_phone            // matching Customer Phone
);
```

---

## 🛡️ Security & Performance Guarantees
1. **HMAC-SHA256 Cryptographic Signing**:
   - Every request is automatically signed with `X-Hub-Signature-256` matching the backend `WEBHOOK_SECRET`.
   - Prevents anyone from spoofing cart events or spamming the server.
2. **Non-Blocking 2-Second Timeout**:
   - The cURL request has a strict 2-second connection timeout, ensuring that even if the CRM backend is unreachable, the customer's browsing and checkout speed on Manubhai's website is never slowed down.
3. **Automatic Phone Number Normalization**:
   - Automatically handles `9876543210`, `09876543210`, or `+919876543210` and converts it into the exact format required by WhatsApp.
