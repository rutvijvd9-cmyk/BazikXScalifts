<?php
/**
 * Manubhai Gathiyawala - WhatsApp CRM Integration Client
 * 
 * Standalone, zero-dependency PHP helper to trigger WhatsApp automations:
 * 1. Abandoned Cart Recovery (30m delay)
 * 2. Order Placed / Completed (Cancels recovery automatically)
 * 
 * Security: Uses HMAC-SHA256 signature verification so no one can spoof requests.
 */

class ManubhaiWhatsAppCRM {

    // Your CRM Backend URL (change to your production domain when deployed)
    private static $crmBaseUrl = "http://localhost:8000";

    // Shared Secret Key (matches WEBHOOK_SECRET in your backend .env)
    private static $webhookSecret = "manubhai_webhook_secret_key_987654";

    /**
     * Call this when a user adds items to cart or updates their cart.
     * 
     * @param string $cartToken Unique session ID or cart ID
     * @param string $customerPhone Customer phone (e.g. "9876543210" or "+919876543210")
     * @param float $cartTotal Total amount of items in the cart
     * @param array $items Array of items, e.g. [["item" => "Vanela Gathiya 500g", "qty" => 2]]
     * @param int $delaySeconds Delay before sending message (default 1800s = 30 minutes)
     * @return array Response from CRM backend
     */
    public static function sendCartEvent($cartToken, $customerPhone, $cartTotal, $items = [], $delaySeconds = 1800) {
        $formattedPhone = self::formatPhone($customerPhone);

        $payload = [
            "cart_token"     => (string)$cartToken,
            "customer_phone" => $formattedPhone,
            "cart_value"     => (float)$cartTotal,
            "items"          => $items
        ];

        $endpoint = self::$crmBaseUrl . "/api/webhooks/cart-event?delay_seconds=" . intval($delaySeconds);
        return self::sendPostRequest($endpoint, $payload);
    }

    /**
     * Call this on successful order completion / payment success.
     * This immediately marks the cart as RECOVERED and prevents any recovery WhatsApp message from firing.
     * 
     * @param string $cartToken Cart or order token
     * @param string $customerPhone Customer phone number
     * @return array Response from CRM backend
     */
    public static function sendOrderCompleted($cartToken, $customerPhone) {
        $formattedPhone = self::formatPhone($customerPhone);

        $endpoint = self::$crmBaseUrl . "/api/webhooks/order-completed"
            . "?cart_token=" . urlencode($cartToken)
            . "&customer_phone=" . urlencode($formattedPhone);

        return self::sendPostRequest($endpoint, []);
    }

    /**
     * Internal helper to send secure signed POST request with 2-second timeout
     * so it never slows down the user's browsing experience.
     */
    private static function sendPostRequest($url, $payloadArray) {
        $jsonPayload = json_encode($payloadArray);

        // Generate HMAC-SHA256 signature for security
        $signature = "sha256=" . hash_hmac('sha256', $jsonPayload, self::$webhookSecret);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-Hub-Signature-256: " . $signature
        ]);
        // Set short timeouts so customer store is never blocked if network lags
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
     * Normalizes phone number to standard international format (+91XXXXXXXXXX)
     */
    private static function formatPhone($phone) {
        $clean = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($clean) === 10) {
            return "+91" . $clean;
        }
        if (strlen($clean) === 12 && substr($clean, 0, 2) === "91") {
            return "+" . $clean;
        }
        return "+" . $clean;
    }
}
?>
