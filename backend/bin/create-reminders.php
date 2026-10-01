<?php
declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Database;
use Dotenv\Dotenv;

Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
date_default_timezone_set('America/Sao_Paulo');

$db = Database::connect();
$statement = $db->prepare("INSERT IGNORE INTO notifications (user_id, appointment_id, message, scheduled_for) SELECT a.client_id, a.id, CONCAT('Seu atendimento de ', s.name, ' está marcado para hoje às ', DATE_FORMAT(a.confirmed_at, '%H:%i'), '.'), CURDATE() FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.status = 'approved' AND DATE(a.confirmed_at) = CURDATE()");
$statement->execute();
fwrite(STDOUT, $statement->rowCount() . " lembrete(s) criado(s).\n");
