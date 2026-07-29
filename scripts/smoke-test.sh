#!/bin/sh
set -eu

base_url="${1:-http://127.0.0.1:3100}"
cookie_jar="$(mktemp)"
image_file="$(mktemp)"
trap 'rm -f "$cookie_jar" "$image_file"' EXIT

suffix="$(date +%s)"
email="smoke-${suffix}@mini-social.invalid"
password="SmokeTest-${suffix}-secure"

signup="$(
  curl -fsS \
    -c "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"name\":\"Smoke Test\"}" \
    "$base_url/api/auth/sign-up/email"
)"

user_id="$(printf '%s' "$signup" | jq -r '.user.id // empty')"
if [ -z "$user_id" ]; then
  echo "Sign-up did not return a user id" >&2
  exit 1
fi

session_user="$(
  curl -fsS -b "$cookie_jar" "$base_url/api/auth/get-session" |
    jq -r '.user.id // empty'
)"
if [ "$session_user" != "$user_id" ]; then
  echo "Session check failed" >&2
  exit 1
fi

post_id="$(
  curl -fsS \
    -b "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d "{\"table\":\"posts\",\"method\":\"POST\",\"select\":\"id,content\",\"body\":{\"user_id\":\"$user_id\",\"content\":\"deployment smoke test\"},\"filters\":[],\"order\":[],\"single\":\"single\"}" \
    "$base_url/api/data/query" |
    jq -r '.data.id // empty'
)"
if [ -z "$post_id" ]; then
  echo "Authenticated database write failed" >&2
  exit 1
fi

printf '%s' \
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' |
  base64 -d > "$image_file"
image_path="$user_id/smoke-test.png"
upload_result="$(
  curl -fsS \
    -X PUT \
    -b "$cookie_jar" \
    -H 'Content-Type: image/png' \
    --data-binary "@$image_file" \
    "$base_url/api/storage/upload?bucket=post-images&path=$image_path" |
    jq -r '.path // empty'
)"
if [ "$upload_result" != "$image_path" ]; then
  echo "Object storage upload failed" >&2
  exit 1
fi

curl -fsS \
  -X DELETE \
  -b "$cookie_jar" \
  -H 'Content-Type: application/json' \
  -d "{\"bucket\":\"post-images\",\"paths\":[\"$image_path\"]}" \
  "$base_url/api/storage" >/dev/null

deleted="$(
  curl -fsS \
    -b "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d '{"confirm":"DELETE"}' \
    "$base_url/api/account/delete" |
    jq -r '.ok // false'
)"
if [ "$deleted" != "true" ]; then
  echo "Smoke-test account cleanup failed" >&2
  exit 1
fi

echo "Smoke test passed: auth, session, RLS write, object storage and cleanup"
