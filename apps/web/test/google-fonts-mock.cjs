/* eslint-disable */
// Mocked Google Fonts responses for `next build` where fonts.googleapis.com is unreachable (CI,
// cloud sandboxes). Enabled only through Next's own hook:
//   NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$PWD/test/google-fonts-mock.cjs next build   (pnpm build:ci)
// Nothing about the real fonts changes: without the variable the build fetches Inter and JetBrains
// Mono from Google exactly as before. With it, Next reads the CSS below instead and turns each
// non-path `src` url into a placeholder buffer, so the layout's font CSS variables still exist.
const face = (family, weight, file) => `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(${file}) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`;

module.exports = {
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap': [400, 500, 600]
    .map((w) => face('Inter', w, `mock-inter-${w}.woff2`))
    .join('\n'),
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap': [400, 500]
    .map((w) => face('JetBrains Mono', w, `mock-jetbrains-mono-${w}.woff2`))
    .join('\n'),
};
