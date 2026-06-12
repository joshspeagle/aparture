import Head from 'next/head';
import PropTypes from 'prop-types';
import { Source_Serif_4, Inter, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
});

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>aparture</title>
        <meta name="description" content="Bringing the arXiv into focus" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* next/font registers HASHED family names, so the original names in
          tokens.css never match the loaded fonts. Expose the hashed names as
          --font-* on :root, where styles/tokens.css consumes them via
          var(--font-serif, …) fallback chains. Declaring on :root (rather
          than a className on <main>) matters twice over: (1) the
          --aparture-font-* tokens are themselves declared on :root, and
          custom-property var() substitution happens where the token is
          declared, so the --font-* values must be visible there; (2) Radix
          portals (dialogs, overlays) attach to document.body, OUTSIDE any
          wrapper element, and still inherit from :root. This <style> tag is
          server-rendered, so there is no font flash on first paint.
          dangerouslySetInnerHTML is required: React HTML-escapes string
          children of <style> (quotes become &#x27;), and raw-text elements
          do not decode entities, which would corrupt the CSS. The injected
          values come from next/font at build time, not from user input. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `:root {
        --font-serif: ${sourceSerif.style.fontFamily};
        --font-sans: ${inter.style.fontFamily};
        --font-mono: ${jetbrainsMono.style.fontFamily};
      }`,
        }}
      />
      <main>
        <Component {...pageProps} />
      </main>
    </>
  );
}

App.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired,
};
