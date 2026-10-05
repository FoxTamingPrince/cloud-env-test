#!/bin/zsh
set -e
cd "$(dirname "$0")"
node_bin="$(command -v node || true)"
if [[ -z "$node_bin" || "$("$node_bin" -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]]; then
  node_bin="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$node_bin" ]]; then
  echo '请先安装 Node.js 22 或更高版本。'; exit 1
fi
if [[ ! -d fox-voice/node_modules ]]; then
  echo '依赖尚未安装，请先运行 pnpm setup。'; exit 1
fi
exec "$node_bin" scripts/local-dev.mjs
