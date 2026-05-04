<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} | nuxt-ai-blog` : 'nuxt-ai-blog'),
});
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
