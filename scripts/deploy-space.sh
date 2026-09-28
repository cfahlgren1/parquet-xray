#!/usr/bin/env bash
# Uploads the committed source to the Hugging Face Space, which builds it with `npm run build`.
# The Space's README is space.yml as front matter followed by README.md.
set -euo pipefail

SPACE="${SPACE:-cfahlgren1/parquet-xray}"
root="$(git rev-parse --show-toplevel)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

git -C "$root" archive HEAD | tar -x -C "$stage"
{
  echo "---"
  grep -v '^#' "$stage/space.yml"
  echo "---"
  echo
  cat "$stage/README.md"
} > "$stage/README.md.tmp"
mv "$stage/README.md.tmp" "$stage/README.md"
rm -rf "$stage/.github"
# Keep the Space's own .gitattributes, which --delete would otherwise remove.
hf download "$SPACE" .gitattributes --repo-type space --local-dir "$stage" > /dev/null
rm -rf "$stage/.cache"

hf upload "$SPACE" "$stage" . --repo-type space --delete "*" \
  --commit-message "deploy $(git -C "$root" rev-parse --short HEAD)"
