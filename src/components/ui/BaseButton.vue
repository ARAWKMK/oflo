<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';

defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}>();
</script>

<template>
  <button 
    class="btn" 
    :class="[`btn-${variant || 'primary'}`]" 
    :disabled="loading"
  >
    <Loader2 v-if="loading" class="animate-spin" :size="16" />
    <slot />
  </button>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.btn-secondary {
  background-color: var(--color-bg-muted);
  color: var(--color-fg-primary);
}
.btn-secondary:hover {
  background-color: var(--color-border-hover);
}

.btn-danger {
  background-color: var(--color-danger);
  color: white;
}
</style>
