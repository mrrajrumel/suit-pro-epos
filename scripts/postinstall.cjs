const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = path.join(root, 'dist');

if (!fs.existsSync(target)) {
  fs.mkdirSync(target, { recursive: true });
}

const filesToEnsure = [
  'dist/.gitkeep',
  'public/favicon.ico',
  'public/icon.png'
];

for (const file of filesToEnsure) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) {
    const dir = path.dirname(absolute);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absolute, '');
  }
}

console.log('Postinstall bootstrap completed.');
