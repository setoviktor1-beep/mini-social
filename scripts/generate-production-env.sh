#!/bin/sh
set -eu

target="${1:-.env.production}"
if [ -e "$target" ]; then
  echo "Refusing to overwrite $target" >&2
  exit 1
fi

random_hex() {
  openssl rand -hex "$1"
}

umask 077
{
  echo "APP_URL=https://mini-social.online"
  echo "BETTER_AUTH_URL=https://mini-social.online"
  echo "NEXT_PUBLIC_SITE_URL=https://mini-social.online"
  echo "AUTH_TRUSTED_ORIGINS=https://mini-social.online,https://www.mini-social.online"
  echo "AUTH_REQUIRE_EMAIL_VERIFICATION=false"
  echo
  echo "POSTGRES_DB=mini_social"
  echo "POSTGRES_USER=mini_social"
  echo "POSTGRES_PASSWORD=$(random_hex 32)"
  echo "DATABASE_POOL_MAX=15"
  echo "POSTGREST_JWT_SECRET=$(random_hex 48)"
  echo "BETTER_AUTH_SECRET=$(random_hex 48)"
  echo "REDIS_PASSWORD=$(random_hex 32)"
  echo
  echo "MINIO_ROOT_USER=mini-social"
  echo "MINIO_ROOT_PASSWORD=$(random_hex 32)"
  echo "S3_REGION=us-east-1"
  echo "S3_PUBLIC_URL=https://mini-social.online/media"
  echo "NEXT_PUBLIC_S3_PUBLIC_URL=https://mini-social.online/media"
  echo
  echo "SMTP_HOST="
  echo "SMTP_PORT=587"
  echo "SMTP_SECURE=false"
  echo "SMTP_USER="
  echo "SMTP_PASSWORD="
  echo "EMAIL_FROM=Mini Social <noreply@mini-social.online>"
  echo
  echo "GOOGLE_CLIENT_ID="
  echo "GOOGLE_CLIENT_SECRET="
  echo "STRIPE_SECRET_KEY="
  echo "STRIPE_WEBHOOK_SECRET="
  echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="
  echo "GEMINI_API_KEY="
  echo "VAPID_PUBLIC_KEY="
  echo "VAPID_PRIVATE_KEY="
  echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY="
  echo "INTERNAL_API_SECRET=$(random_hex 48)"
} > "$target"

chmod 600 "$target"
echo "Created $target with mode 600"
