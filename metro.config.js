const { getDefaultConfig } = require('expo/metro-config');

// Consumer bundles do not initialize the staff Storybook or telemetry pipeline.
module.exports = getDefaultConfig(__dirname);
