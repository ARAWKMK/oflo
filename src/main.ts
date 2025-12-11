import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import { createRouter, createWebHashHistory } from 'vue-router';

// Views
import DashboardView from './views/DashboardView.vue';
import CompaniesView from './views/CompaniesView.vue';
import CustomersView from './views/CustomersView.vue';
import ProductsView from './views/ProductsView.vue';
import SettingsView from './views/SettingsView.vue';
import BackupView from './views/BackupView.vue';
import ReportsView from './views/ReportsView.vue';
// import InvoiceList from './components/invoices/InvoiceList.tsx';
// import InvoiceForm from './components/invoices/InvoiceForm.tsx';
import InvoicesView from './views/InvoicesView.vue';
import InvoiceForm from './views/InvoiceForm.vue';

// Router
const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/', component: DashboardView },
        { path: '/invoices', component: InvoicesView },
        { path: '/invoices/new', component: InvoiceForm },
        { path: '/invoices/:invoiceNo', component: () => import('./views/InvoiceDetails.vue') },
        { path: '/invoices/edit/:invoiceNo', component: InvoiceForm },
        { path: '/companies', component: CompaniesView },
        { path: '/customers', component: CustomersView },
        { path: '/products', component: ProductsView },
        { path: '/settings', component: SettingsView },
        { path: '/backup', component: BackupView },
        { path: '/reports', component: ReportsView },
    ]
});

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.mount('#app');
