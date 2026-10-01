<?php
declare(strict_types=1);

namespace App;

use PDOException;

final class AuthController
{
    public function __construct(private readonly \PDO $db) {}

    public function register(array $body): never
    {
        $name = trim((string) ($body['name'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $phone = trim((string) ($body['phone'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if (mb_strlen($name) < 2 || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190 || mb_strlen($phone) < 8 || mb_strlen($phone) > 30 || strlen($password) < 8) {
            Api::json(['error' => 'Confira nome, e-mail, celular e senha (mínimo de 8 caracteres).'], 422);
        }

        try {
            $statement = $this->db->prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)');
            $statement->execute([$name, $email, $phone, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                Api::json(['error' => 'Este e-mail já possui cadastro.'], 409);
            }
            throw $exception;
        }

        $user = ['id' => (int) $this->db->lastInsertId(), 'name' => $name, 'email' => $email, 'phone' => $phone, 'role' => 'client'];
        Api::json(['token' => Api::issueToken($user), 'user' => $user], 201);
    }

    public function login(array $body): never
    {
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $statement = $this->db->prepare('SELECT id, name, email, phone, password_hash, role FROM users WHERE email = ? LIMIT 1');
        $statement->execute([$email]);
        $user = $statement->fetch();

        if (!$user || !password_verify((string) ($body['password'] ?? ''), $user['password_hash'])) {
            Api::json(['error' => 'E-mail ou senha incorretos.'], 401);
        }

        unset($user['password_hash']);
        $user['id'] = (int) $user['id'];
        Api::json(['token' => Api::issueToken($user), 'user' => $user]);
    }

    public function me(array $identity): never
    {
        $statement = $this->db->prepare('SELECT id, name, email, phone, role FROM users WHERE id = ? LIMIT 1');
        $statement->execute([$identity['id']]);
        $user = $statement->fetch();
        if (!$user) Api::json(['error' => 'Conta não encontrada.'], 404);
        $user['id'] = (int) $user['id'];
        Api::json(['user' => $user]);
    }
}
