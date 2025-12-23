<script setup lang="ts">
defineProps<{
    title: string;
    showBack?: boolean;
    actions?: any;
}>();
</script>

<template>
    <div class="page-header">
        <div class="header-center">
            <h1 class="page-title">
                <slot name="title">{{ title }}</slot>
            </h1>
        </div>
        <div class="right-actions">
            <slot name="actions"></slot>
        </div>
    </div>
</template>

<style scoped>
.page-header {
    display: flex;
    justify-content: space-between; /* Fallback */
    align-items: center;
    position: sticky;
    top: 0;
    background: var(--color-bg-app); 
    padding: 1rem;
    padding-left: 1rem; /* Reduced desktop padding since title is centered */
    padding-right: 1rem;
    z-index: 90; 
    min-height: 72px; 
    flex-wrap: wrap; 
    gap: 1rem;
    border-bottom: 1px solid transparent; 
    width: 100%; 
    box-sizing: border-box; 
    left: 0; 
}

/* Centered Title Container */
.header-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10; /* Above regular content but below app controls? No, app controls are z-100 */
    max-width: 60%;
}

.right-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto; /* Push to right */
    position: relative;
    z-index: 20; /* Ensure clickable */
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
    color: var(--color-fg-primary);
    white-space: nowrap; /* Keep single line on desktop usually */
}

@media (max-width: 768px) {
    .page-header {
        position: sticky; 
        top: 0;
        left: 0; 
        right: 0;
        width: 100%;
        z-index: 99;
        
        padding-left: 1rem; 
        padding-right: 1rem;
        padding-top: 0.8rem;
        padding-bottom: 0.8rem;
        min-height: 80px; 
        
        align-items: center; 
        flex-direction: column; 
        justify-content: center; 
    }

    .header-center {
        position: static; /* Reset absolute */
        transform: none;
        width: 100%;
        max-width: 100%;
        margin-bottom: 0.5rem;
    }

    .page-title {
        font-size: 1.1rem;
        margin-top: 0;
        text-align: center;
        width: 100%;
        padding: 0;
        white-space: normal; /* Allow wrapping on mobile */
    }

    .right-actions {
        width: 100%;
        justify-content: center;
        margin-top: 0;
        padding-left: 0; 
        margin-left: 0;
    }
}
</style>
