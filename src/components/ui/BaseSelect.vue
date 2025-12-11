<script setup lang="ts">
interface Option {
  id: number | string;
  name: string;
}

defineProps<{
  label?: string;
  modelValue: string | number;
  options: Option[];
  placeholder?: string;
  error?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>();
</script>

<template>
  <div class="base-select">
    <label v-if="label">{{ label }}</label>
    <select
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      :class="{ 'has-error': error }"
    >
      <option value="" disabled selected>{{ placeholder || 'Select...' }}</option>
      <option v-for="opt in options" :key="opt.id" :value="opt.id">
        {{ opt.name }}
      </option>
    </select>
    <span v-if="error" class="error-text">{{ error }}</span>
  </div>
</template>

<style scoped>
.base-select {
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
