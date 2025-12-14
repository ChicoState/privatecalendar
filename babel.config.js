//required babel framework for jest testing to work with typescript

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};

/*==========================================================================================================================
"However, there are some caveats to using TypeScript with Babel. Because TypeScript support in Babel is purely transpilation, 
Jest will not type-check your tests as they are run. If you want that, you can use ts-jest instead, 
or just run the TypeScript compiler tsc separately (or as part of your build process).
-jest site

as such it might be required to tinker with this more if the need arises.
===========================================================================================================================*/