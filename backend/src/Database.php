<?php
declare(strict_types=1);

namespace App;

use PDO;

final class Database
{
    public static function connect(): PDO
    {
        $host = $_ENV['DB_HOST'] ?? '127.0.0.1';
        $port = $_ENV['DB_PORT'] ?? '3306';
        $name = $_ENV['DB_NAME'] ?? 'marta_nails';
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

        return new PDO($dsn, $_ENV['DB_USER'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
}
