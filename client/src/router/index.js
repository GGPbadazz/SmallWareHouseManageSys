import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Login from '@/views/Login.vue'

const routes = [
    {
        path: '/login',
        name: 'Login',
        component: Login
    },
    {
        path: '/',
        name: 'Home',
        component: Home,
        meta: { requiresAuth: true }
    },
    {
        path: '/scanner',
        name: 'Scanner',
        component: () => import('@/components/ScannerPage.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/inventory',
        name: 'Inventory',
        component: () => import('@/components/InventoryPage.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/ledger/product/:id',
        name: 'ProductLedgerDetail',
        component: () => import('@/components/ProductLedgerDetail.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/reports',
        name: 'Reports',
        component: () => import('@/components/ReportsPage.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/barcode-management',
        name: 'BarcodeManagement',
        component: () => import('@/components/BarcodeManagement.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('@/components/SettingsPage.vue'),
        meta: { requiresAuth: true }
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// 路由守卫 - 检查登录状态
router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('auth_token')
    
    if (to.matched.some(record => record.meta.requiresAuth)) {
        if (!token) {
            next('/login')
        } else {
            next()
        }
    } else {
        next()
    }
})

export default router
