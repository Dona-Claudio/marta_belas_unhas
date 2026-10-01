<?php
declare(strict_types=1);

namespace App;

use DateTimeImmutable;
use PDO;
use Throwable;

final class AppointmentController
{
    public function __construct(private readonly PDO $db) {}

    public function services(): never
    {
        $services = $this->db->query('SELECT id, name, description, duration_minutes, price_cents FROM services WHERE active = 1 ORDER BY id')->fetchAll();
        foreach ($services as &$service) {
            $service['id'] = (int) $service['id'];
            $service['duration_minutes'] = (int) $service['duration_minutes'];
            $service['price_cents'] = $service['price_cents'] === null ? null : (int) $service['price_cents'];
        }
        Api::json(['services' => $services]);
    }

    public function index(array $identity): never
    {
        if ($identity['role'] === 'manicure') {
            $statement = $this->db->query("SELECT a.id, a.client_id, u.name AS client_name, u.phone AS client_phone, a.service_id, s.name AS service_name, a.requested_at, a.confirmed_at, a.proposed_at, a.description, a.status, r.rating AS review_rating, r.comment AS review_comment FROM appointments a JOIN users u ON u.id = a.client_id JOIN services s ON s.id = a.service_id LEFT JOIN reviews r ON r.appointment_id = a.id ORDER BY FIELD(a.status, 'pending', 'alternative_proposed', 'approved', 'completed', 'rejected', 'cancelled'), COALESCE(a.confirmed_at, a.proposed_at, a.requested_at)");
        } else {
            $statement = $this->db->prepare('SELECT a.id, a.client_id, a.service_id, s.name AS service_name, a.requested_at, a.confirmed_at, a.proposed_at, a.description, a.status, r.rating AS review_rating, r.comment AS review_comment FROM appointments a JOIN services s ON s.id = a.service_id LEFT JOIN reviews r ON r.appointment_id = a.id WHERE a.client_id = ? ORDER BY COALESCE(a.confirmed_at, a.proposed_at, a.requested_at) DESC');
            $statement->execute([$identity['id']]);
        }

        $appointments = $statement->fetchAll();
        foreach ($appointments as &$appointment) {
            $appointment['id'] = (int) $appointment['id'];
            $appointment['client_id'] = (int) $appointment['client_id'];
            $appointment['service_id'] = (int) $appointment['service_id'];
            $appointment['review'] = $appointment['review_rating'] === null ? null : [
                'rating' => (int) $appointment['review_rating'],
                'comment' => $appointment['review_comment'],
            ];
            unset($appointment['review_rating'], $appointment['review_comment']);
        }
        Api::json(['appointments' => $appointments]);
    }

    public function create(array $identity, array $body): never
    {
        Api::requireRole($identity, 'client');
        $serviceId = filter_var($body['service_id'] ?? null, FILTER_VALIDATE_INT);
        $description = trim((string) ($body['description'] ?? ''));
        $requestedAt = $this->parseDate((string) ($body['requested_at'] ?? ''));

        if (!$serviceId || $requestedAt === null || $requestedAt <= new DateTimeImmutable('+1 hour') || mb_strlen($description) > 1000) {
            Api::json(['error' => 'Informe um serviço, um horário futuro (com pelo menos 1 hora) e uma descrição de até 1.000 caracteres.'], 422);
        }

        $service = $this->db->prepare('SELECT id FROM services WHERE id = ? AND active = 1');
        $service->execute([$serviceId]);
        if (!$service->fetch()) Api::json(['error' => 'Este serviço não está disponível.'], 422);

        $statement = $this->db->prepare('INSERT INTO appointments (client_id, service_id, requested_at, description) VALUES (?, ?, ?, ?)');
        $statement->execute([$identity['id'], $serviceId, $requestedAt->format('Y-m-d H:i:s'), $description]);
        Api::json(['appointment' => ['id' => (int) $this->db->lastInsertId(), 'status' => 'pending']], 201);
    }

    public function update(array $identity, int $id, array $body): never
    {
        $this->db->beginTransaction();
        $this->db->query("SELECT id FROM users WHERE role = 'manicure' ORDER BY id LIMIT 1 FOR UPDATE")->fetch();
        $statement = $this->db->prepare('SELECT a.id, a.client_id, a.service_id, a.requested_at, a.proposed_at, a.status, s.duration_minutes FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.id = ?');
        $statement->execute([$id]);
        $appointment = $statement->fetch();
        if (!$appointment) Api::json(['error' => 'Agendamento não encontrado.'], 404);

        $nextStatus = (string) ($body['status'] ?? '');
        $isOwner = (int) $appointment['client_id'] === $identity['id'];
        $updates = null;

        if ($identity['role'] === 'manicure') {
            if ($nextStatus === 'alternative_proposed' && $appointment['status'] === 'pending') {
                $proposed = $this->parseDate((string) ($body['proposed_at'] ?? ''));
                if (!$proposed || $proposed <= new DateTimeImmutable('+1 hour')) Api::json(['error' => 'Informe uma nova data futura com pelo menos 1 hora de antecedência.'], 422);
                if (!$this->slotAvailable($proposed, (int) $appointment['duration_minutes'], $id)) Api::json(['error' => 'Este horário já está ocupado por outro atendimento.'], 409);
                $updates = ['alternative_proposed', null, $proposed->format('Y-m-d H:i:s')];
            } elseif ($nextStatus === 'approved' && $appointment['status'] === 'pending') {
                $requested = new DateTimeImmutable($appointment['requested_at']);
                if (!$this->slotAvailable($requested, (int) $appointment['duration_minutes'], $id)) Api::json(['error' => 'Este horário já está ocupado por outro atendimento.'], 409);
                $updates = ['approved', $appointment['requested_at'], null];
            } elseif ($nextStatus === 'rejected' && $appointment['status'] === 'pending') {
                $updates = ['rejected', null, null];
            } elseif ($nextStatus === 'completed' && $appointment['status'] === 'approved') {
                $updates = ['completed', $appointment['requested_at'], null];
            }
        } elseif ($isOwner && $appointment['status'] === 'alternative_proposed' && $nextStatus === 'approved') {
            $proposed = new DateTimeImmutable($appointment['proposed_at']);
            if ($proposed <= new DateTimeImmutable()) Api::json(['error' => 'O horário sugerido já passou. Entre em contato para combinar outro.'], 409);
            if (!$this->slotAvailable($proposed, (int) $appointment['duration_minutes'], $id)) Api::json(['error' => 'Este horário acabou de ficar indisponível. Entre em contato para combinar outro.'], 409);
            $updates = ['approved', $appointment['proposed_at'], null];
        } elseif ($isOwner && in_array($appointment['status'], ['pending', 'alternative_proposed'], true) && $nextStatus === 'cancelled') {
            $updates = ['cancelled', null, null];
        }

        if ($updates === null) Api::json(['error' => 'Esta alteração não é permitida para o estado atual do agendamento.'], 403);

        $save = $this->db->prepare('UPDATE appointments SET status = ?, confirmed_at = ?, proposed_at = ? WHERE id = ?');
        $save->execute([$updates[0], $updates[1], $updates[2], $id]);
        $this->db->commit();
        Api::json(['appointment' => ['id' => $id, 'status' => $updates[0], 'confirmed_at' => $updates[1], 'proposed_at' => $updates[2]]]);
    }

    public function review(array $identity, int $id, array $body): never
    {
        Api::requireRole($identity, 'client');
        $rating = filter_var($body['rating'] ?? null, FILTER_VALIDATE_INT);
        $comment = trim((string) ($body['comment'] ?? ''));
        if ($rating === false || $rating < 1 || $rating > 5 || mb_strlen($comment) > 1000) {
            Api::json(['error' => 'A nota deve ser de 1 a 5 e o comentário pode ter até 1.000 caracteres.'], 422);
        }

        $statement = $this->db->prepare("SELECT id FROM appointments WHERE id = ? AND client_id = ? AND status = 'completed'");
        $statement->execute([$id, $identity['id']]);
        if (!$statement->fetch()) Api::json(['error' => 'Só é possível avaliar um atendimento concluído da sua conta.'], 403);

        try {
            $save = $this->db->prepare('INSERT INTO reviews (appointment_id, client_id, rating, comment) VALUES (?, ?, ?, ?)');
            $save->execute([$id, $identity['id'], $rating, $comment]);
        } catch (\PDOException $exception) {
            if ($exception->getCode() === '23000') Api::json(['error' => 'Este atendimento já foi avaliado.'], 409);
            throw $exception;
        }
        Api::json(['review' => ['rating' => $rating, 'comment' => $comment]], 201);
    }

    private function parseDate(string $value): ?DateTimeImmutable
    {
        try {
            return new DateTimeImmutable($value);
        } catch (Throwable) {
            return null;
        }
    }

    private function slotAvailable(DateTimeImmutable $start, int $duration, int $exceptId): bool
    {
        $end = $start->modify("+{$duration} minutes")->format('Y-m-d H:i:s');
        $statement = $this->db->prepare("SELECT a.confirmed_at, s.duration_minutes FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.status = 'approved' AND a.confirmed_at < ? AND DATE_ADD(a.confirmed_at, INTERVAL s.duration_minutes MINUTE) > ? AND a.id <> ?");
        $statement->execute([$end, $start->format('Y-m-d H:i:s'), $exceptId]);
        return !$statement->fetch();
    }
}
