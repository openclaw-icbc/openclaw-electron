const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputCss = path.join(__dirname, 'renderer', 'styles.css');
const outputCss = path.join(__dirname, 'renderer', 'styles-compiled.css');

console.log('Building Tailwind CSS...');

try {
  // Use Tailwind CLI to build CSS
  execSync(`npx tailwindcss -i ${inputCss} -o ${outputCss} --minify`, {
    stdio: 'inherit'
  });

  console.log('CSS build complete!');
} catch (error) {
  console.error('CSS build failed:', error);
  process.exit(1);
}
