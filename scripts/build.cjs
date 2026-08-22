const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const distDir = path.join(root, 'dist');

function run(command, args) {
  const entryPoints = {
    vite: path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    esbuild: path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild')
  };

  const entryPoint = entryPoints[command];
  const executable = entryPoint ? process.execPath : command;
  const commandArgs = entryPoint ? [entryPoint, ...args] : args;

  execFileSync(executable, commandArgs, { stdio: 'inherit', cwd: root });
}

async function removeDir(target) {
  if (!fs.existsSync(target)) return;

  try {
    fs.rmSync(target, { recursive: true, force: true });
    return;
  } catch (err) {
    console.warn(`Warning: unable to remove ${target} before build. Proceeding with existing directory. ${err.message}`);
  }
}

async function main() {
  await removeDir(distDir);
  await run('vite', ['build']);
  await run('esbuild', ['server.ts', '--bundle', '--platform=node', '--format=cjs', '--sourcemap', '--outfile=dist/server.cjs']);
  console.log('Build completed successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
