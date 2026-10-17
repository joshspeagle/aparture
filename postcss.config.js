module.exports = {
  plugins: {
    // Tailwind 4 also inlines globals.css's imports and adds vendor
    // prefixes, which autoprefixer used to do.
    '@tailwindcss/postcss': {},
  },
};
