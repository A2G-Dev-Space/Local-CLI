module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': './src',
            '@core': './src/core',
            '@ui': './src/ui',
            '@types': './src/types',
          },
        },
      ],
    ],
  };
};
