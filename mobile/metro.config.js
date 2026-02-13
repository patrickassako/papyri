const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Expo Metro config
const config = getDefaultConfig(__dirname);

// Add the parent directory (monorepo root) to watchFolders
// This allows Metro to resolve the shared tokens
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

config.watchFolders = [monorepoRoot];

// Add node_modules from monorepo root and project root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Allow Metro to resolve the shared folder
config.resolver.extraNodeModules = {
  'shared': path.resolve(monorepoRoot, 'shared'),
};

module.exports = config;
