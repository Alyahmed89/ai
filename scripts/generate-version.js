#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Get the current git commit hash (short)
  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  
  // Create the version.ts file content
  const content = `// Auto-generated at build time - do not edit manually
export const VERSION = "${commitHash}";
export const BUILD_TIME = "${new Date().toISOString()}";
`;

  // Write to src/version.ts
  const versionPath = path.join(__dirname, '..', 'src', 'version.ts');
  fs.writeFileSync(versionPath, content);
  
  console.log(`✅ Generated version.ts with commit: ${commitHash}`);
} catch (error) {
  console.error('❌ Failed to generate version.ts:', error.message);
  // Fallback to dev version
  const fallbackContent = `// Auto-generated at build time - do not edit manually
export const VERSION = "dev";
export const BUILD_TIME = "${new Date().toISOString()}";
`;
  const versionPath = path.join(__dirname, '..', 'src', 'version.ts');
  fs.writeFileSync(versionPath, fallbackContent);
  console.log('✅ Generated version.ts with fallback: dev');
}