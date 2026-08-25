FROM node:22-bookworm-slim

LABEL maintainer="MiniSocial Platform <dev@mini-social.online>"
LABEL description="Dedicated production OpenClaw AI harness container for MiniSocial"

ENV NODE_ENV=production
ENV OPENCLAW_STATE_DIR=/app/data
ENV OPENCLAW_CONFIG_PATH=/app/data/openclaw.json

# Install minimal system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install pinned OpenClaw global CLI & runtime
RUN npm install -g openclaw@2026.7.1-2 --omit=dev && \
    npm cache clean --force

# Create application directories
WORKDIR /app
RUN mkdir -p /app/data /app/workspace && \
    chown -R node:node /app

COPY --chown=node:node entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER node

EXPOSE 18789

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=20 \
  CMD node -e "fetch('http://127.0.0.1:18789/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
