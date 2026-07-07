<template>
  <div class="app-container">
    <!-- 如果在登录页面，只显示登录页面 -->
    <div v-if="$route.name === 'Login'">
      <router-view />
    </div>
    
    <!-- 主应用界面 -->
    <div v-else>
      <!-- 顶部导航栏 -->
      <nav class="navbar">
        <div class="navbar-content">
          <div class="navbar-brand">
            <div class="navbar-logo">库</div>
            <div>
              <div class="navbar-title">备品备件管理系统</div>
              <div class="navbar-subtitle">Spare Parts Management System</div>
            </div>
          </div>
          
          <!-- 导航菜单 -->
          <div class="navbar-menu">
            <button 
              class="navbar-tab" 
              :class="{ active: currentTab === 'scanner' }"
              @click="switchTab('scanner')"
            >
              <span>🔍 出库入库</span>
            </button>
            <button 
              class="navbar-tab" 
              :class="{ active: currentTab === 'inventory' }"
              @click="switchTab('inventory')"
            >
              <span>📦 库存管理</span>
            </button>
            <button 
              class="navbar-tab" 
              :class="{ active: currentTab === 'ledger' }"
              @click="switchTab('ledger')"
            >
              <span>📒 月度账本</span>
            </button>
            <button 
              class="navbar-tab" 
              :class="{ active: currentTab === 'reports' }"
              @click="switchTab('reports')"
            >
              <span>📊 报告中心</span>
            </button>
            <button 
              class="navbar-tab" 
              :class="{ active: currentTab === 'barcode_management' }"
              @click="switchTab('barcode_management')"
            >
              <span>🏷️ 条码管理</span>
            </button>
            <button 
              class="navbar-tab" 
              :class="{ active: currentTab === 'settings' }"
              @click="switchTab('settings')"
            >
              <span>⚙️ 系统设置</span>
            </button>
          </div>
          
          <div class="navbar-actions">
            <button class="nav-button logout-button" @click="handleLogout">
              <span>🚪</span>
              <span>退出</span>
            </button>
          </div>
        </div>
      </nav>

      <!-- 主要内容区域 -->
      <main class="main-content">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载...</div>
        </div>

        <!-- 页面内容 -->
        <div v-else class="page-content">
          <!-- 如果是详情页面路由，显示路由组件 -->
          <router-view v-if="isDetailRoute" />
          
          <!-- 否则显示主要页面组件 -->
          <template v-else>
            <ScannerPage v-if="currentTab === 'scanner'" />
            <InventoryPage v-if="currentTab === 'inventory'" />
            <LedgerPage v-if="currentTab === 'ledger'" />
            <ReportsPage v-if="currentTab === 'reports'" />
            <BarcodeManagement v-if="currentTab === 'barcode_management'" />
            <SettingsPage v-if="currentTab === 'settings'" />
          </template>
        </div>
      </main>

      <!-- 消息提示容器 -->
      <div id="messageContainer" class="message-container"></div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useInventoryStore } from '@/stores/inventory'

const ScannerPage = defineAsyncComponent(() => import('@/components/ScannerPage.vue'))
const InventoryPage = defineAsyncComponent(() => import('@/components/InventoryPage.vue'))
const LedgerPage = defineAsyncComponent(() => import('@/components/LedgerPage.vue'))
const ReportsPage = defineAsyncComponent(() => import('@/components/ReportsPage.vue'))
const BarcodeManagement = defineAsyncComponent(() => import('@/components/BarcodeManagement.vue'))
const SettingsPage = defineAsyncComponent(() => import('@/components/SettingsPage.vue'))

export default {
  name: 'App',
  components: {
    ScannerPage,
    InventoryPage,
    LedgerPage,
    ReportsPage,
    BarcodeManagement,
    SettingsPage
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const currentTab = ref('scanner')
    const loading = ref(true)
    const inventoryStore = useInventoryStore()

    // 检测是否是详情页面路由
    const isDetailRoute = computed(() => {
      return route.name === 'ProductLedgerDetail'
    })

    const switchTab = (tab) => {
      loading.value = true
      currentTab.value = tab
      
      // 模拟加载延迟，提供更好的用户体验
      setTimeout(() => {
        loading.value = false
      }, 300)
    }

    const handleLogout = () => {
      if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('auth_token')
        router.push('/login')
      }
    }

    onMounted(async () => {
      try {
        await inventoryStore.loadInitialData()
        loading.value = false
      } catch (error) {
        console.error('Failed to load initial data:', error)
        loading.value = false
      }
    })

    return {
      currentTab,
      loading,
      isDetailRoute,
      switchTab,
      handleLogout
    }
  }
}
</script>

<style scoped>
.app-container {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

.navbar {
  background-color: #35495e;
  color: white;
  padding: 12px 20px;
  position: relative;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.navbar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1600px;
  margin: 0 auto;
}

.navbar-brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.navbar-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 20px;
  flex: 1;
  justify-content: center;
}

.navbar-tab {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 8px 16px;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.navbar-tab:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.navbar-tab.active {
  background: rgba(255, 255, 255, 0.95);
  color: #35495e;
  border-color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

.navbar-logo {
  font-size: 1.5em;
  font-weight: bold;
  margin-right: 10px;
}

.navbar-title {
  font-size: 1.2em;
  margin: 0;
}

.navbar-subtitle {
  font-size: 0.9em;
  margin: 0;
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.nav-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 8px 12px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.logout-button {
  background: rgba(254, 215, 215, 0.9) !important;
  color: #c53030 !important;
  border: 1px solid rgba(254, 178, 178, 0.9) !important;
}

.logout-button:hover {
  background: rgba(254, 178, 178, 0.9) !important;
  color: #742a2a !important;
}

.camera-button {
  background: rgba(198, 246, 213, 0.9) !important;
  color: #276749 !important;
  border: 1px solid rgba(154, 230, 180, 0.9) !important;
}

.camera-button:hover {
  background: rgba(154, 230, 180, 0.9) !important;
  color: #22543d !important;
}

.camera-button.loading {
  background: rgba(237, 242, 247, 0.9) !important;
  color: #718096 !important;
  border: 1px solid rgba(203, 213, 224, 0.9) !important;
  cursor: wait;
}

.camera-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 200px);
}

.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-top: 10px;
  color: #666;
}

.page-content {
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  margin: 12px auto;
  max-width: 1600px;
}

.main-content {
  min-height: calc(100vh - 120px);
}

.message-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .navbar-menu {
    gap: 4px;
    margin: 0 10px;
  }
  
  .navbar-tab {
    padding: 6px 12px;
    font-size: 13px;
  }
}

@media (max-width: 768px) {
  .navbar-content {
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .navbar-menu {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
    margin: 10px 0 0 0;
    overflow-x: auto;
    padding-bottom: 5px;
  }
  
  .navbar-tab {
    flex-shrink: 0;
    padding: 6px 10px;
    font-size: 12px;
  }
  
  .page-content {
    margin: 10px;
    padding: 15px;
  }
}

/* 消息提示样式 */
.message-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
  font-size: 14px;
}

.message-success {
  background: #c6f6d5;
  color: #276749;
  border: 1px solid #9ae6b4;
}

.message-error {
  background: #fed7d7;
  color: #c53030;
  border: 1px solid #feb2b2;
}

.message-info {
  background: #bee3f8;
  color: #2b6cb0;
  border: 1px solid #90cdf4;
}

.message.fade-out {
  animation: fadeOut 0.3s ease forwards;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
