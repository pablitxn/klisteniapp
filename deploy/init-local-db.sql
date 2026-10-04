-- Runs only on the new, dedicated local Compose volume. Not a live migration.
\getenv app_password KLISTENI_DB_PASSWORD
CREATE ROLE klisteni LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_password';
CREATE DATABASE klisteni OWNER klisteni;
REVOKE ALL ON DATABASE klisteni FROM PUBLIC;
\connect klisteni
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO klisteni;
