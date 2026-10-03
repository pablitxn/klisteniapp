# Runtime-only image. CI supplies the dist artifact produced by the quality job.
# Nginx stable 1.30.5, linux/amd64; resolved 2026-09-27.
ARG NGINX_IMAGE=nginx:1.30.5-alpine@sha256:8f84ed99befc3891b8f329c5c202785278a2cfb7c25107d57fb2a134a3117433
FROM ${NGINX_IMAGE}

ARG OCI_REVISION=dev
LABEL org.opencontainers.image.title="Klisteni" \
      org.opencontainers.image.source="https://gitlab.orchid-labs.xyz/orchid-labs/homelab/klisteniapp" \
      org.opencontainers.image.revision="${OCI_REVISION}"

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/umami.conf /etc/nginx/umami.conf
RUN test -s /etc/ssl/certs/ca-certificates.crt
COPY --chown=1000:1000 apps/web/dist/ /usr/share/nginx/html/

USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz || exit 1
# Bypass the upstream entrypoint; startup never modifies /etc or the web root.
ENTRYPOINT ["nginx", "-g", "daemon off;"]
