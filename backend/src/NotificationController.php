<?php
declare(strict_types=1);

namespace App;

use PDO;

final class NotificationController
{
    public function __construct(private readonly PDO $db) {}

    public function index(array $identity): never
    {
        if ($identity['role'] !== 'client') Api::json(['notifications' => []]);

        $statement = $this->db->prepare('SELECT id, message FROM notifications WHERE user_id = ? AND scheduled_for = CURDATE() AND read_at IS NULL ORDER BY id');
        $statement->execute([$identity['id']]);
        $notifications = $statement->fetchAll();
        if ($notifications) {
            $ids = array_column($notifications, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $markRead = $this->db->prepare("UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND id IN ({$placeholders})");
            $markRead->execute(array_merge([$identity['id']], $ids));
        }
        Api::json(['notifications' => $notifications]);
    }
}
