<?php
declare(strict_types=1);

namespace App;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Throwable;

final class Api
{
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function body(): array
    {
        $body = json_decode(file_get_contents('php://input'), true);
        return is_array($body) ? $body : [];
    }

    public static function issueToken(array $user): string
    {
        $secret = $_ENV['JWT_SECRET'] ?? '';
        if (strlen($secret) < 32) {
            throw new \RuntimeException('JWT_SECRET precisa ter pelo menos 32 caracteres.');
        }

        $now = time();
        return JWT::encode([
            'sub' => (int) $user['id'],
            'role' => $user['role'],
            'iat' => $now,
            'exp' => $now + 60 * 60 * 8,
        ], $secret, 'HS256');
    }

    public static function currentUser(): array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            self::json(['error' => 'Entre na sua conta para continuar.'], 401);
        }

        try {
            $claims = JWT::decode($matches[1], new Key($_ENV['JWT_SECRET'] ?? '', 'HS256'));
            return ['id' => (int) $claims->sub, 'role' => (string) $claims->role];
        } catch (Throwable) {
            self::json(['error' => 'Sua sessão expirou. Entre novamente.'], 401);
        }
    }

    public static function requireRole(array $user, string $role): void
    {
        if ($user['role'] !== $role) {
            self::json(['error' => 'Você não tem permissão para esta ação.'], 403);
        }
    }
}
