<script setup lang="ts">
import { 
  LayoutDashboard, 
  FileText, 
  Settings as SettingsIcon, 
  DatabaseBackup, 
  BarChart3, 
  Menu,
  ArrowLeft
} from 'lucide-vue-next';
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const goBack = () => {
    router.back();
};

// Show back button on any route except root (Dashboard)
const showBack = computed(() => route.path !== '/');

// Close menu on route change (mobile friendly)
router.afterEach(() => {
    isMenuOpen.value = false;
});

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Companies', path: '/companies', icon: FileText },
  { name: 'Customers', path: '/customers', icon: FileText },
  { name: 'Products', path: '/products', icon: FileText }, 
  { name: 'Invoices', path: '/invoices', icon: FileText },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
  { name: 'Backup', path: '/backup', icon: DatabaseBackup },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];
</script>

<template>
  <div class="app-layout">
    <!-- Fixed Controls (Top-Left) -->
    <div class="fixed-controls">
        <button class="icon-toggle" @click="toggleMenu" aria-label="Toggle Menu">
            <Menu :size="24" />
        </button>
        <button v-if="showBack" class="icon-back" @click="goBack" aria-label="Go Back">
            <ArrowLeft :size="24" />
        </button>
    </div>

    <!-- Top Drawer Navigation -->
    <nav class="top-drawer" :class="{ open: isMenuOpen }">
        <div class="nav-content">
            <router-link 
                v-for="item in navItems" 
                :key="item.path" 
                :to="item.path" 
                class="nav-item"
            >
                <component :is="item.icon" :size="20" />
                <span>{{ item.name }}</span>
            </router-link>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
        <router-view></router-view>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
    position: relative;
    min-height: 100vh;
}

/* Fixed Controls */
.fixed-controls {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 100;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.icon-toggle, .icon-back {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    color: var(--color-fg-primary);
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.icon-toggle:hover, .icon-back:hover {
    background: var(--color-bg-muted);
    border-color: var(--color-fg-secondary);
}

/* Top Drawer */
.top-drawer {
    background: var(--color-bg-card);
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.4s ease-in-out;
    border-bottom: 1px solid transparent;
}

.top-drawer.open {
    /* Desktop: Single row height approximation or auto if flex row works */
    max-height: 80px; 
    border-bottom-color: var(--color-border);
}

.nav-content {
    display: flex;
    padding: 1.25rem 1rem;
    padding-left: 8rem; /* Clear fixed controls (Menu 40 + Back 40 + Gaps) */
    gap: 1rem;
    align-items: center;
    height: 100%;
    /* Horizontal scroll for smaller desktop screens */
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: thin; /* Firefox */
}
.nav-content::-webkit-scrollbar {
    height: 4px;
}
.nav-content::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 4px;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    color: var(--color-fg-secondary);
    text-decoration: none;
    border-radius: var(--radius-sm);
    transition: background 0.2s;
    background: transparent;
    font-size: 0.9rem;
    white-space: nowrap;
    flex-shrink: 0; /* Prevent shrinking */
}

.nav-item:hover, .nav-item.router-link-active {
    background: var(--color-bg-muted);
    color: var(--color-fg-primary);
}

/* Main Content */
.main-content {
    padding-top: 0; /* Let PageHeader handle the top spacing */
    transition: padding-top 0.3s;
}

/* Mobile: Vertical Stack (Increased breakpoint) */
@media (max-width: 1024px) {
    .fixed-controls { /* Ensure controls stay on top */
        z-index: 101; 
    }

    .top-drawer.open {
        max-height: 100vh;
    }

    .nav-content {
        flex-direction: column;
        align-items: stretch;
        padding-top: 5rem; /* Push first item below buttons */
        padding-left: 1rem; /* Reset left padding */
        overflow-y: auto; /* Vertical scroll if needed */
        overflow-x: hidden;
    }
}
</style>
