# Runtime-only web image. Build the default demo first with `pnpm build`.
# An operator can instead supply an explicitly built instance dist; see docs/deployment.md.
ARG NGINX_IMAGE=nginx:1.30.5-alpine@sha256:8f84ed99befc3891b8f329c5c202785278a2cfb7c25107d57fb2a134a3117433
FROM ${NGINX_IMAGE}
ARG OCI_REVISION=dev
LABEL org.opencontainers.image.title="Klisteni web" \
      org.opencontainers.image.revision="${OCI_REVISION}"
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --chown=1000:1000 apps/b2c-web/dist/ /usr/share/nginx/html/
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx", "-g", "daemon off;"]
