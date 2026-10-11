# Container builds

Run all builds from the repository root. Dockerfiles live here, but their build
context remains the whole repository so workspace packages and frontend artifacts
keep the same paths.

| Image | Dockerfile | Build input |
| --- | --- | --- |
| Klisteni web | `b2c-web/Dockerfile` | `apps/b2c-web/dist` from `pnpm build:demo` or `pnpm build:instance` |
| Klisteni API | `b2c-api/Dockerfile` | API source and production workspace dependencies |
| Gym API | `b2b-api/Dockerfile` | B2B source and production workspace dependencies |
| Gym web | `b2b-web/Dockerfile` | One B2B artifact including member and gym management sections from `pnpm build:b2b` |

```sh
docker build --platform linux/amd64 -f docker/b2c-web/Dockerfile -t klisteni-web:local .
docker build --platform linux/amd64 -f docker/b2c-api/Dockerfile -t klisteni-api:local .
docker build --platform linux/amd64 -f docker/b2b-api/Dockerfile -t klisteni-b2b-api:local .
docker build --platform linux/amd64 -f docker/b2b-web/Dockerfile -t klisteni-b2b-web:local .
```

The API and gym web builds each have an adjacent `Dockerfile.dockerignore`.
These allowlists take precedence over the root `.dockerignore`; the Klisteni web
build uses the root allowlist. Keep credentials and local operator files outside
all image contexts. A different build tool must preserve these context exclusions.

Nginx configuration stays in this directory. Compose definitions and database
initialization live in `deploy/`; the root `compose.yaml` starts development databases.
See [deployment](../docs/deployment.md) and [B2B runtime validation](../docs/b2b-runtime-validation.md).
