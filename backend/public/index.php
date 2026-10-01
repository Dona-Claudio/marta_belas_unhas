<?php
declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Api;
use App\AppointmentController;
use App\AuthController;
use App\Database;
use App\NotificationController;
use App\PortfolioController;
use Dotenv\Dotenv;
use Throwable;

Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
date_default_timezone_set('America/Sao_Paulo');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigin = $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173';
if ($origin === $allowedOrigin) {
    header("Access-Control-Allow-Origin: {$allowedOrigin}");
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $db = Database::connect();
    $auth = new AuthController($db);
    $appointments = new AppointmentController($db);
    $notifications = new NotificationController($db);
    $portfolio = new PortfolioController($db);
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = preg_replace('#^/api#', '', $path) ?: '/';
    $body = Api::body();

    if ($method === 'POST' && $path === '/auth/register') $auth->register($body);
    if ($method === 'POST' && $path === '/auth/login') $auth->login($body);
    if ($method === 'GET' && $path === '/services') $appointments->services();
    if ($method === 'GET' && $path === '/portfolio') {
        $identity = isset($_SERVER['HTTP_AUTHORIZATION']) ? Api::currentUser() : null;
        $portfolio->index($identity);
    }

    $identity = Api::currentUser();
    if ($method === 'POST' && $path === '/portfolio') $portfolio->create($identity, $body);
    if ($method === 'POST' && preg_match('#^/portfolio/(\d+)/like$#', $path, $matches)) $portfolio->toggleLike($identity, (int) $matches[1]);
    if ($method === 'GET' && $path === '/me') $auth->me($identity);
    if ($method === 'GET' && $path === '/appointments') $appointments->index($identity);
    if ($method === 'GET' && $path === '/notifications') $notifications->index($identity);
    if ($method === 'POST' && $path === '/appointments') $appointments->create($identity, $body);
    if ($method === 'PATCH' && preg_match('#^/appointments/(\d+)$#', $path, $matches)) $appointments->update($identity, (int) $matches[1], $body);
    if ($method === 'POST' && preg_match('#^/appointments/(\d+)/review$#', $path, $matches)) $appointments->review($identity, (int) $matches[1], $body);

    Api::json(['error' => 'Rota não encontrada.'], 404);
} catch (Throwable $exception) {
    error_log((string) $exception);
    Api::json(['error' => ($_ENV['APP_ENV'] ?? 'production') === 'local' ? $exception->getMessage() : 'Erro interno. Tente novamente mais tarde.'], 500);
}
