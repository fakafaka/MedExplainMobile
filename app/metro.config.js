const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Нужно для импортов вида "pkg/subpath" (react-native-css-interop/jsx-runtime и т.п.)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
