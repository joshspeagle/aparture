<script setup>
import DefaultTheme from 'vitepress/theme';
const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #nav-bar-title-before>
      <span class="aparture-navbar-title">
        Ap<span class="ar-highlight">ar</span>ture
      </span>
    </template>
  </Layout>
</template>
