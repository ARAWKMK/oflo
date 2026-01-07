<script setup lang="ts">
import { ref } from 'vue';
import { accessControlService } from '../../services/accessControlService';
import { ArrowRight } from 'lucide-vue-next';

const emit = defineEmits(['unlock']);

const password = ref('');
const loading = ref(false);

const handleUnlock = async () => {
    if (!password.value) return;
    loading.value = true;
    
    try {
        // Try Admin First
        const isAdmin = await accessControlService.verifyAdmin(password.value);
        if (isAdmin) {
            emit('unlock', 'admin');
            return;
        }

        // Try Viewer
        const isViewer = await accessControlService.verifyViewer(password.value);
        if (isViewer) {
            emit('unlock', 'viewer');
            return;
        }

        // Silent Failure: Stay locked, do NOT clear input
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="lock-container">
        <div class="input-wrapper">
            <input 
                type="password" 
                v-model="password" 
                class="minimal-input" 
                @keyup.enter="handleUnlock"
                autofocus
            >
            <button class="arrow-btn" @click="handleUnlock" :disabled="loading">
                <ArrowRight class="w-6 h-6" :class="{ 'animate-pulse': loading }" />
            </button>
        </div>
    </div>
</template>

<style scoped>
.lock-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 70vh; /* Optical center */
    width: 100%;
}

.input-wrapper {
    display: flex;
    align-items: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 999px; /* Pill shape */
    padding: 0.5rem 0.5rem 0.5rem 1.5rem;
    box-shadow: var(--shadow-lg);
    width: 300px;
    transition: all 0.2s;
}

.input-wrapper:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light);
}

.minimal-input {
    border: none;
    background: transparent;
    outline: none;
    flex: 1;
    font-size: 1.1rem;
    color: var(--color-text-primary);
    min-width: 0; /* Prevent overflow */
}

.arrow-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary);
    color: var(--color-primary-fg);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    cursor: pointer;
    transition: transform 0.1s;
    margin-left: 0.5rem;
}

.arrow-btn:hover {
    transform: translateX(2px);
}

.arrow-btn:active {
    transform: scale(0.95);
}

.arrow-btn:disabled {
    opacity: 0.7;
    cursor: default;
}
</style>
