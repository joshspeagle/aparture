// Custom theme setup for Aparture docs
import DefaultTheme from 'vitepress/theme';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Add custom app enhancements here if needed
  },
};
