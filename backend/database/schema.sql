CREATE DATABASE IF NOT EXISTS marta_nails CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE marta_nails;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('client', 'manicure') NOT NULL DEFAULT 'client',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  price_cents INT UNSIGNED NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  requested_at DATETIME NOT NULL,
  confirmed_at DATETIME NULL,
  proposed_at DATETIME NULL,
  description TEXT NOT NULL,
  status ENUM('pending', 'approved', 'alternative_proposed', 'rejected', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_client FOREIGN KEY (client_id) REFERENCES users(id),
  CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_appointments_schedule (status, requested_at),
  INDEX idx_appointments_client (client_id, requested_at)
) ENGINE=InnoDB;

CREATE TABLE reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT UNSIGNED NOT NULL UNIQUE,
  client_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_reviews_client FOREIGN KEY (client_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NOT NULL,
  type ENUM('reminder') NOT NULL DEFAULT 'reminder',
  message VARCHAR(255) NOT NULL,
  scheduled_for DATE NOT NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_notifications_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  UNIQUE KEY uq_notification_once (appointment_id, type, scheduled_for)
) ENGINE=InnoDB;

CREATE TABLE portfolio_posts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  caption VARCHAR(1000) NOT NULL DEFAULT '',
  media_url VARCHAR(1000) NOT NULL,
  media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_portfolio_public (is_published, created_at)
) ENGINE=InnoDB;

CREATE TABLE portfolio_likes (
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_portfolio_likes_post FOREIGN KEY (post_id) REFERENCES portfolio_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_portfolio_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO services (name, description, duration_minutes, price_cents) VALUES
  ('Manicure em gel', 'Acabamento resistente e elegante.', 90, NULL),
  ('Alongamento', 'Consulte disponibilidade e tecnica indicada.', 150, NULL),
  ('Manicure tradicional', 'Cuidado essencial com acabamento caprichado.', 60, NULL),
  ('Nail art', 'Detalhes personalizados para o seu estilo.', 30, NULL);
