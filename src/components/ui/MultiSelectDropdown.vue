<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';

const props = defineProps<{
    modelValue: number[];
    options: { id?: number; name: string }[];
    label: string;
}>();

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const toggleOpen = () => {
    isOpen.value = !isOpen.value;
};

const close = (e: MouseEvent) => {
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
        isOpen.value = false;
    }
};

onMounted(() => {
    document.addEventListener('click', close);
});

onUnmounted(() => {
    document.removeEventListener('click', close);
});

const isSelected = (id: number) => {
    return props.modelValue.includes(id);
};

const toggleSelection = (id: number) => {
    const newVal = [...props.modelValue];
    const idx = newVal.indexOf(id);
    if (idx === -1) {
        newVal.push(id);
    } else {
        newVal.splice(idx, 1);
    }
    emit('update:modelValue', newVal);
};

const displayLabel = computed(() => {
    if (props.modelValue.length === 0) return props.label; // Placeholder
    if (props.modelValue.length === 1) {
        const item = props.options.find(o => o.id === props.modelValue[0]);
        return item ? item.name : props.label;
    }
    return `${props.modelValue.length} Selected`;
});
</script>

<template>
    <div class="multi-select" ref="containerRef">
        <button class="select-trigger" @click.stop="toggleOpen" :class="{ active: isOpen }">
            <span class="label-text" :class="{ placeholder: modelValue.length === 0 }">
                {{ displayLabel }}
            </span>
            <ChevronDown :size="16" class="chevron" :class="{ rotate: isOpen }" />
        </button>

        <div class="dropdown-menu" v-if="isOpen">
            <div class="option-item" 
                v-for="opt in options" 
                :key="opt.id" 
                @click.stop="toggleSelection(opt.id!)"
                :class="{ selected: isSelected(opt.id!) }"
            >
                <div class="checkbox">
                    <Check v-if="isSelected(opt.id!)" :size="12" stroke-width="3" />
                </div>
                <span>{{ opt.name }}</span>
            </div>
            <div v-if="options.length === 0" class="empty-msg">No options available</div>
        </div>
    </div>
</template>

<style scoped>
.multi-select {
    position: relative;
    width: 100%;
}

.select-trigger {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-bg-app);
    border: 1px solid var(--color-border);
    color: var(--color-fg-primary);
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    height: 38px;
    transition: all 0.2s;
}

.select-trigger.active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.label-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: left;
}

.label-text.placeholder {
    color: var(--color-fg-secondary);
}

.chevron {
    color: var(--color-fg-secondary);
    transition: transform 0.2s;
    flex-shrink: 0;
    margin-left: 0.5rem;
}
.chevron.rotate {
    transform: rotate(180deg);
}

.dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 50;
    max-height: 250px;
    overflow-y: auto;
    padding: 0.5rem 0;
}

.option-item {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--color-fg-primary);
    transition: background 0.1s;
}

.option-item:hover {
    background: var(--color-bg-muted);
}

.checkbox {
    width: 16px;
    height: 16px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-app);
    color: white;
    transition: all 0.1s;
}

.option-item.selected .checkbox {
    background: var(--color-primary);
    border-color: var(--color-primary);
}

.empty-msg {
    padding: 1rem;
    text-align: center;
    color: var(--color-fg-secondary);
    font-size: 0.9rem;
}
</style>
