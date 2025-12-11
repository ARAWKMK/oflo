<script setup lang="ts">
defineProps<{
  label?: string;
  modelValue: string | number;
  type?: string;
  placeholder?: string;
  error?: string;
  step?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>();
</script>

<template>
  <div class="base-input">
    <label v-if="label">{{ label }}</label>
    <input
      :type="type || 'text'"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      :placeholder="placeholder"
      :step="step"
      :class="{ 'has-error': error }"
    />
    <span v-if="error" class="error-text">{{ error }}</span>
  </div>
</template>

<style scoped>
.base-input {
  display: flex;
  flex-direction: column;
}

.has-error {
  border-color: var(--color-danger);
}

.error-text {
  font-size: 0.7rem;
  color: var(--color-danger);
  margin-top: 0.25rem;
}
</style>
