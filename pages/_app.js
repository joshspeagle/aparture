import Head from 'next/head';
import PropTypes from 'prop-types';
import { Source_Serif_4, Inter, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
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
      <main className={`${sourceSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
        <Component {...pageProps} />
      </main>
    </>
  );
}

App.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired,
};
