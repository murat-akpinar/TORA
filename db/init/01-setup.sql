-- Runs on first database initialization only.
-- Şifre entrypoint-wrapper ile her başlangıçta da senkronlanır; burada ilk kurulum garantisi.

ALTER USER postgres PASSWORD 'postgres';

-- Not: pg_stat_statements bazı Docker PostgreSQL imajlarında paketlenmez ve CREATE EXTENSION
-- tüm init'i başarısız kılıp konteyneri "unhealthy" yapabilir. İhtiyaç halinde admin olarak
-- elle: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
