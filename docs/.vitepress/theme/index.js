// Custom theme setup for Aparture docs
import DefaultTheme from 'vitepress/theme';
import Layout from './Layout.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app: _app }) {
    // Add custom app enhancements here if needed
  },
};
