<?php
declare(strict_types=1);

namespace App;

use PDO;

final class PortfolioController
{
    public function __construct(private readonly PDO $db) {}

    public function index(?array $identity): never
    {
        $userId = $identity && $identity['role'] === 'client' ? $identity['id'] : 0;
        $statement = $this->db->prepare('SELECT p.id, p.title, p.caption, p.media_url, p.media_type, p.created_at, (SELECT COUNT(*) FROM portfolio_likes l WHERE l.post_id = p.id) AS like_count, EXISTS(SELECT 1 FROM portfolio_likes mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS liked_by_me FROM portfolio_posts p WHERE p.is_published = 1 ORDER BY p.created_at DESC, p.id DESC');
        $statement->execute([$userId]);
        $posts = $statement->fetchAll();
        foreach ($posts as &$post) {
            $post['id'] = (int) $post['id'];
            $post['like_count'] = (int) $post['like_count'];
            $post['liked_by_me'] = (bool) $post['liked_by_me'];
        }
        Api::json(['posts' => $posts]);
    }

    public function create(array $identity, array $body): never
    {
        Api::requireRole($identity, 'manicure');
        $title = trim((string) ($body['title'] ?? ''));
        $caption = trim((string) ($body['caption'] ?? ''));
        $url = trim((string) ($body['media_url'] ?? ''));
        $type = (string) ($body['media_type'] ?? 'image');
        $parts = parse_url($url);
        $secureUrl = is_array($parts) && ($parts['scheme'] ?? '') === 'https' && filter_var($url, FILTER_VALIDATE_URL);

        if (mb_strlen($title) < 2 || mb_strlen($title) > 120 || mb_strlen($caption) > 1000 || !$secureUrl || mb_strlen($url) > 1000 || !in_array($type, ['image', 'video'], true)) {
            Api::json(['error' => 'Informe título, mídia HTTPS válida, tipo de arquivo e legenda de até 1.000 caracteres.'], 422);
        }

        $statement = $this->db->prepare('INSERT INTO portfolio_posts (title, caption, media_url, media_type) VALUES (?, ?, ?, ?)');
        $statement->execute([$title, $caption, $url, $type]);
        Api::json(['post' => ['id' => (int) $this->db->lastInsertId()]], 201);
    }

    public function toggleLike(array $identity, int $postId): never
    {
        Api::requireRole($identity, 'client');
        $exists = $this->db->prepare('SELECT id FROM portfolio_posts WHERE id = ? AND is_published = 1');
        $exists->execute([$postId]);
        if (!$exists->fetch()) Api::json(['error' => 'Este trabalho não está disponível.'], 404);

        $like = $this->db->prepare('SELECT 1 FROM portfolio_likes WHERE post_id = ? AND user_id = ?');
        $like->execute([$postId, $identity['id']]);
        if ($like->fetch()) {
            $statement = $this->db->prepare('DELETE FROM portfolio_likes WHERE post_id = ? AND user_id = ?');
            $statement->execute([$postId, $identity['id']]);
            $liked = false;
        } else {
            $statement = $this->db->prepare('INSERT IGNORE INTO portfolio_likes (post_id, user_id) VALUES (?, ?)');
            $statement->execute([$postId, $identity['id']]);
            $liked = true;
        }

        $count = $this->db->prepare('SELECT COUNT(*) FROM portfolio_likes WHERE post_id = ?');
        $count->execute([$postId]);
        Api::json(['liked' => $liked, 'like_count' => (int) $count->fetchColumn()]);
    }
}
