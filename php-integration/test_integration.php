<?php
require_once __DIR__ . '/ManubhaiWhatsAppCRM.php';

echo "=== 1. Testing Cart Abandonment Webhook from PHP ===\n";
$cartResponse = ManubhaiWhatsAppCRM::sendCartEvent(
    "php_cart_9988",
    "9825098250",
    850.00,
    [
        ["item" => "Bhavnagari Gathiya 500g", "qty" => 2],
        ["item" => "Methi Khakhra 250g", "qty" => 1]
    ],
    1800 // 30 minutes delay
);
print_r($cartResponse);

echo "\n=== 2. Testing Order Placed Webhook from PHP ===\n";
$orderResponse = ManubhaiWhatsAppCRM::sendOrderCompleted(
    "php_cart_9988",
    "9825098250"
);
print_r($orderResponse);

echo "\n=== 3. Testing Customer Registration / Profile Sync from PHP ===\n";
$syncResponse = ManubhaiWhatsAppCRM::syncCustomer(
    "9825098250",
    "Bhavik Shah",
    "bhavik@example.com",
    "Ahmedabad",
    [
        "tags" => "Website Registered, VIP",
        "birth_day" => 15,
        "birth_month" => 8,
        "membership_tier" => "Gold"
    ]
);
print_r($syncResponse);

echo "\n✅ PHP Client integration test finished.\n";
?>
