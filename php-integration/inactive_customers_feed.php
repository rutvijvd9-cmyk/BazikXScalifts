<?php
/**
 * Inactive Customers Data Feed for Manubhai Gathiyawala
 * 
 * Exposes customers whose last order was > 30 days ago.
 * Protected by shared HMAC signature so unauthorized visitors cannot read customer data.
 */

// 1. Shared Secret (matches WEBHOOK_SECRET in your backend .env)
$crmWebhookSecret = getenv('CRM_WEBHOOK_SECRET');
if (!$crmWebhookSecret) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "CRM_WEBHOOK_SECRET is not configured"]);
    exit;
}

// 2. Verify Authorization Header
$headers = getallheaders();
$receivedSig = isset($headers['X-Hub-Signature-256']) ? $headers['X-Hub-Signature-256'] : '';
$days = isset($_GET['days']) ? intval($_GET['days']) : 30;

// Verify signature
$expectedSig = "sha256=" . hash_hmac('sha256', "days=" . $days, $crmWebhookSecret);
if (!hash_equals($expectedSig, $receivedSig)) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Unauthorized: signature mismatch"]);
    exit;
}

// 3. Database Connection to Manubhai's PHP Database
// (Their developer points this to their existing MySQL/MariaDB database)
/*
$db = new PDO("mysql:host=localhost;dbname=manubhai_store", "db_user", "db_pass");
$cutoffDate = date('Y-m-d H:i:s', strtotime("-{$days} days"));

$sql = "
    SELECT u.id, u.name, u.phone, u.email, MAX(o.created_at) as last_order_date, COUNT(o.id) as total_orders
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    HAVING last_order_date <= :cutoff OR last_order_date IS NULL
    LIMIT 200
";
$stmt = $db->prepare($sql);
$stmt->execute([':cutoff' => $cutoffDate]);
$customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
*/

// Mock sample data demonstration for testing
$cutoffDate = date('Y-m-d', strtotime("-{$days} days"));
$sampleInactive = [
    [
        "phone" => "+919825123456",
        "name" => "Kishorebhai Mehta",
        "email" => "kishore@example.com",
        "last_order_date" => date('Y-m-d H:i:s', strtotime("-35 days")),
        "total_orders" => 4
    ],
    [
        "phone" => "+919898765432",
        "name" => "Pravinbhai Trivedi",
        "email" => "pravin@example.com",
        "last_order_date" => date('Y-m-d H:i:s', strtotime("-42 days")),
        "total_orders" => 2
    ]
];

header('Content-Type: application/json');
echo json_encode([
    "status" => "success",
    "days_threshold" => $days,
    "count" => count($sampleInactive),
    "customers" => $sampleInactive
]);
