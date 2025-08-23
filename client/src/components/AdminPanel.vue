<template>
  <div v-if="show" class="modal active">
    <div class="modal-content admin-modal-content">
      <div class="modal-header">
        <h2 class="modal-title">管理员面板</h2>
        <button class="modal-close" @click="close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="admin-tabs">
          <div class="tab-headers">
            <button 
              class="tab-header" 
              :class="{ active: activeTab === 'snapshots' }"
              @click="activeTab = 'snapshots'"
            >
              📸 快照管理
            </button>
            <button 
              class="tab-header" 
              :class="{ active: activeTab === 'system' }"
              @click="activeTab = 'system'"
            >
              ⚙️ 系统管理
            </button>
          </div>
          
          <!-- 快照管理选项卡 -->
          <div v-if="activeTab === 'snapshots'" class="tab-content">
            <div class="snapshot-overview">
              <h3>快照概览</h3>
              <div v-if="snapshotStats" class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">总月数</div>
                  <div class="stat-value">{{ snapshotStats.overview.total_months }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">产品快照</div>
                  <div class="stat-value">{{ snapshotStats.overview.total_product_snapshots }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">总价值</div>
                  <div class="stat-value">¥{{ formatCurrency(snapshotStats.overview.total_value) }}</div>
                </div>
              </div>
              <button class="btn btn-primary" @click="refreshSnapshotStats" :disabled="loading">
                🔄 {{ loading ? '刷新中...' : '刷新统计' }}
              </button>
            </div>
            
            <div class="snapshot-actions">
              <h3>快照操作</h3>
              <div class="action-row">
                <div class="form-group">
                  <label>生成单月快照:</label>
                  <div class="input-group">
                    <input 
                      type="number" 
                      v-model="generateForm.year" 
                      placeholder="年份" 
                      min="2020" 
                      max="2030"
                    >
                    <input 
                      type="number" 
                      v-model="generateForm.month" 
                      placeholder="月份" 
                      min="1" 
                      max="12"
                    >
                    <button 
                      class="btn btn-success" 
                      @click="generateSnapshot" 
                      :disabled="generating"
                    >
                      {{ generating ? '生成中...' : '生成快照' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="snapshot-list">
              <h3>现有快照</h3>
              <div v-if="snapshotList.length > 0" class="snapshot-table">
                <div class="table-header">
                  <div>年月</div>
                  <div>产品数</div>
                  <div>总价值</div>
                  <div>生成时间</div>
                  <div>操作</div>
                </div>
                <div 
                  v-for="snapshot in snapshotList" 
                  :key="`${snapshot.year}-${snapshot.month}`"
                  class="table-row"
                >
                  <div>{{ snapshot.year }}年{{ snapshot.month }}月</div>
                  <div>{{ snapshot.product_count }}</div>
                  <div>¥{{ formatCurrency(snapshot.total_value) }}</div>
                  <div>{{ snapshot.snapshot_date }}</div>
                  <div>
                    <button 
                      class="btn btn-danger btn-sm" 
                      @click="deleteSnapshot(snapshot.year, snapshot.month)"
                      :disabled="deleting === `${snapshot.year}-${snapshot.month}`"
                    >
                      {{ deleting === `${snapshot.year}-${snapshot.month}` ? '删除中...' : '删除' }}
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state">
                <p>暂无快照数据</p>
              </div>
            </div>
          </div>
          
          <!-- 系统管理选项卡 -->
          <div v-if="activeTab === 'system'" class="tab-content">
            <div class="empty-state">
              <div class="empty-state-icon">⚙️</div>
              <div class="empty-state-text">系统管理功能</div>
              <div class="empty-state-subtext">开发中...</div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import { snapshotAPI } from '../services/api.js'

export default {
  name: 'AdminPanel',
  emits: ['close', 'show-toast'],
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { emit }) {
    const activeTab = ref('snapshots')
    const loading = ref(false)
    const generating = ref(false)
    const deleting = ref(null)
    const snapshotStats = ref(null)
    const snapshotList = ref([])
    const generateForm = ref({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1
    })

    // 监听 show 状态变化
    watch(() => props.show, (newVal) => {
      if (newVal) {
        initializeData()
      }
    })

    const close = () => {
      emit('close')
    }

    const initializeData = async () => {
      await refreshSnapshotStats()
      await loadSnapshotList()
    }

    const refreshSnapshotStats = async () => {
      loading.value = true
      try {
        const response = await snapshotAPI.getStats()
        snapshotStats.value = response.data.data
      } catch (error) {
        console.error('获取快照统计失败:', error)
        emit('show-toast', '获取快照统计失败', 'error')
      } finally {
        loading.value = false
      }
    }

    const loadSnapshotList = async () => {
      try {
        const response = await snapshotAPI.getList()
        snapshotList.value = response.data.data.snapshots || []
      } catch (error) {
        console.error('获取快照列表失败:', error)
        emit('show-toast', '获取快照列表失败', 'error')
      }
    }

    const generateSnapshot = async () => {
      if (!generateForm.value.year || !generateForm.value.month) {
        emit('show-toast', '请输入有效的年份和月份', 'error')
        return
      }

      generating.value = true
      try {
        await snapshotAPI.generateSnapshot(generateForm.value.year, generateForm.value.month)
        emit('show-toast', `${generateForm.value.year}年${generateForm.value.month}月快照生成成功`, 'success')
        await initializeData() // 刷新数据
      } catch (error) {
        console.error('生成快照失败:', error)
        emit('show-toast', '生成快照失败: ' + (error.response?.data?.error || error.message), 'error')
      } finally {
        generating.value = false
      }
    }

    const deleteSnapshot = async (year, month) => {
      if (!confirm(`确定要删除 ${year}年${month}月 的快照吗？此操作不可撤销。`)) {
        return
      }

      deleting.value = `${year}-${month}`
      try {
        await snapshotAPI.deleteSnapshot(year, month)
        emit('show-toast', `${year}年${month}月快照删除成功`, 'success')
        await initializeData() // 刷新数据
      } catch (error) {
        console.error('删除快照失败:', error)
        emit('show-toast', '删除快照失败: ' + (error.response?.data?.error || error.message), 'error')
      } finally {
        deleting.value = null
      }
    }

    const formatCurrency = (value) => {
      if (!value) return '0'
      // 显示精度：4位小数，但移除末尾的0
      return parseFloat(value).toFixed(4).replace(/\.?0+$/, '')
    }

    return {
      activeTab,
      loading,
      generating,
      deleting,
      snapshotStats,
      snapshotList,
      generateForm,
      close,
      refreshSnapshotStats,
      generateSnapshot,
      deleteSnapshot,
      formatCurrency
    }
  }
}
</script><style scoped>
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.modal.active {
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--surface-color);
  border-radius: var(--radius-xl);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}

.admin-modal-content {
  max-width: 800px;
  width: 95%;
}

.modal-header {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: var(--background-color);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--spacing-xl);
}

.modal-footer {
  padding: var(--spacing-xl);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

/* 快照管理样式 */
.admin-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tab-headers {
  display: flex;
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 20px;
}

.tab-header {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-secondary);
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}

.tab-header:hover {
  color: var(--text-primary);
  background-color: var(--background-secondary);
}

.tab-header.active {
  color: #007bff;
  border-bottom-color: #007bff;
  background-color: var(--background-color);
}

.tab-content {
  flex: 1;
  padding: 0;
}

.snapshot-overview {
  margin-bottom: 30px;
}

.snapshot-overview h3 {
  margin-bottom: 15px;
  color: var(--text-primary);
  font-size: 18px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.snapshot-actions {
  margin-bottom: 30px;
}

.snapshot-actions h3 {
  margin-bottom: 15px;
  color: var(--text-primary);
  font-size: 18px;
}

.action-row {
  background: var(--background-secondary);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.input-group input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  width: 100px;
  background: var(--background-color);
  color: var(--text-primary);
}

.input-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.snapshot-list h3 {
  margin-bottom: 15px;
  color: var(--text-primary);
  font-size: 18px;
}

.snapshot-table {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr 1.5fr 1fr;
  background: var(--background-secondary);
  padding: 12px 15px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr 1.5fr 1fr;
  padding: 12px 15px;
  border-bottom: 1px solid var(--border-light);
  align-items: center;
  background: var(--background-color);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background-color: var(--background-secondary);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #bd2130;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state-text {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
}

.empty-state-subtext {
  font-size: 14px;
  opacity: 0.7;
}

.empty-state p {
  font-size: 16px;
  margin: 0;
}

@media (max-width: 768px) {
  .tab-headers {
    flex-wrap: wrap;
  }
  
  .tab-header {
    flex: 1;
    min-width: 120px;
    font-size: 14px;
    padding: 10px 16px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .input-group {
    flex-wrap: wrap;
  }
  
  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .table-header {
    display: none;
  }
  
  .table-row {
    padding: 15px;
    border: 1px solid var(--border-color);
    margin-bottom: 10px;
    border-radius: 4px;
  }
}
</style>
