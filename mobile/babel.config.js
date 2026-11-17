module.exports = function(api) {
  api.cache(true);
  return {
    // This app uses React Native's Animated API, not Reanimated. Disable the
    // preset's optional plugin so a globally installed package cannot break
    // builds when its peer dependencies are missing in this project.
    presets: [['babel-preset-expo', { reanimated: false }]],
  };
};
