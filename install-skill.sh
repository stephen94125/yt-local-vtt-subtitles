#!/usr/bin/env bash
set -euo pipefail

skill_name="translate-subtitles-to-zh-tw-by-llm"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
skill_src="$(cd "$script_dir/skills/$skill_name" && pwd -P)"
target_dir="$HOME/.agents/skills"
target="$target_dir/$skill_name"

mkdir -p "$target_dir"

if [[ -L "$target" ]]; then
  rm "$target"
elif [[ -e "$target" ]]; then
  echo "Refusing to replace existing non-symlink: $target" >&2
  exit 1
fi

ln -s "$skill_src" "$target"

echo "Installed skill:"
echo "  $target -> $skill_src"
