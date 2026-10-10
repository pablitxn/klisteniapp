#!/bin/sh
set -eu
# psql quotes the password as a SQL literal. Never interpolate it into SQL text.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=b2b_password="$B2B_DB_PASSWORD" --set=b2b_database="$POSTGRES_DB" <<'SQL'
CREATE ROLE klisteni_b2b LOGIN PASSWORD :'b2b_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE ALL ON DATABASE :"b2b_database" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"b2b_database" TO klisteni_b2b;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO klisteni_b2b;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO klisteni_b2b;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO klisteni_b2b;
SQL
