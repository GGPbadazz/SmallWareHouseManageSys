<template>
  <div class="product-ledger-detail">
    <!-- 页面头部 -->
    <div class="detail-header">
      <div class="header-left">
        <h2>{{ product?.name || '产品出入库详情' }}</h2>
        <div class="product-info" v-if="product">
          <span class="product-code">条码: {{ product.barcode || '-' }}</span>
          <span class="product-category">类别: {{ product.category_name || '-' }}</span>
          <span class="period-info">{{ formatPeriod() }}</span>
        </div>
      </div>
      <div class="header-right">
        <button class="btn btn-outline" @click="exportExcel">
          <span>📊</span>
          导出Excel
        </button>
        <button class="btn btn-secondary" @click="closeWindow">
          <span>✕</span>
          关闭
        </button>
      </div>
    </div>

    <!-- 产品库存汇总 -->
    <div v-if="product" class="product-summary">
      <div class="summary-card">
        <span class="summary-label">当前库存:</span>
        <span class="summary-value">{{ product.current_stock }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">库存单价:</span>
        <span class="summary-value">{{ formatCurrency(product.current_unit_price) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">库存价值:</span>
        <span class="summary-value">{{ formatCurrency(product.total_cost_value) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">本月出入库:</span>
        <span class="summary-value">{{ pagination?.total_records || 0 }} 笔</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载出入库记录...</div>
    </div>

    <!-- 交易记录表格 -->
    <div v-else-if="transactions.length > 0" class="transactions-container">
      <div class="transactions-table-container">
        <!-- 表头 -->
        <div class="transaction-header">
          <div class="header-cell type">类型</div>
          <div class="header-cell datetime">操作时间</div>
          <div class="header-cell quantity">数量</div>
          <div class="header-cell unit-price">出入库单价</div>
          <div class="header-cell total-price">出入库总价</div>
          <div class="header-cell requester">领料人</div>
          <div class="header-cell project">领用单位/部门</div>
          <div class="header-cell purpose">用途说明</div>
          <div class="header-cell current-stock">出入库后库存</div>
          <div class="header-cell stock-unit-price">库存单价</div>
          <div class="header-cell stock-value">库存价值</div>
        </div>
        
        <!-- 数据行 -->
        <div 
          v-for="transaction in transactions" 
          :key="transaction.id"
          class="transaction-row"
          :class="transaction.type"
        >
          <div class="table-cell type">
            <span class="transaction-type-badge" :class="transaction.type">
              {{ transaction.type === 'IN' ? '入库' : '出库' }}
            </span>
          </div>
          <div class="table-cell datetime">
            <div class="datetime-info">
              {{ formatDateTime(transaction.created_at) }}
            </div>
          </div>
          <div class="table-cell quantity">
            <span class="quantity-value">{{ transaction.quantity }}</span>
          </div>
          <div class="table-cell unit-price">
            <span class="price-value">{{ formatCurrency(transaction.unit_price) }}</span>
          </div>
          <div class="table-cell total-price">
            <span class="price-value total">{{ formatCurrency(transaction.total_price) }}</span>
          </div>
          <div class="table-cell requester">
            <span class="requester-name">{{ transaction.requester_name || '-' }}</span>
          </div>
          <div class="table-cell project">
            <span class="project-name">{{ transaction.project_name || '-' }}</span>
          </div>
          <div class="table-cell purpose">
            <span class="purpose-text">{{ transaction.purpose || '-' }}</span>
          </div>
          <div class="table-cell current-stock">
            <span class="stock-value" :class="{ 'low-stock': transaction.stock_after <= 5 }">
              {{ transaction.stock_after || 0 }}
            </span>
          </div>
          <div class="table-cell stock-unit-price">
            <span class="price-value stock-unit">{{ formatCurrency(transaction.stock_unit_price) }}</span>
          </div>
          <div class="table-cell stock-value">
            <span class="price-value stock">{{ formatCurrency(transaction.stock_value) }}</span>
          </div>
        </div>
      </div>

      <!-- 分页控件 -->
      <div class="pagination-container" v-if="pagination && pagination.total_pages > 1">
        <div class="pagination-info">
          显示第 {{ (pagination.current_page - 1) * pagination.page_size + 1 }}-{{ Math.min(pagination.current_page * pagination.page_size, pagination.total_records) }} 条，
          共 {{ pagination.total_records }} 条记录
        </div>
        <div class="pagination-controls">
          <button 
            class="pagination-btn"
            :disabled="pagination.current_page === 1"
            @click="goToPage(1)"
          >
            首页
          </button>
          <button 
            class="pagination-btn"
            :disabled="pagination.current_page === 1"
            @click="goToPage(pagination.current_page - 1)"
          >
            上一页
          </button>
          <span class="pagination-numbers">
            <button 
              v-for="page in visiblePages"
              :key="page"
              class="pagination-btn"
              :class="{ active: page === pagination.current_page }"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </span>
          <button 
            class="pagination-btn"
            :disabled="pagination.current_page === pagination.total_pages"
            @click="goToPage(pagination.current_page + 1)"
          >
            下一页
          </button>
          <button 
            class="pagination-btn"
            :disabled="pagination.current_page === pagination.total_pages"
            @click="goToPage(pagination.total_pages)"
          >
            尾页
          </button>
        </div>
      </div>
    </div>

    <!-- 无数据状态 -->
    <div v-else class="no-data">
      <div class="no-data-icon">📊</div>
      <div class="no-data-text">该产品在当前月份无出入库记录</div>
    </div>
  </div>
</template>

<script>
import { ledgerAPI } from '@/services/api'

export default {
  name: 'ProductLedgerDetail',
  data() {
    return {
      loading: false,
      product: null,
      transactions: [],
      pagination: null,
      currentPage: 1,
      pageSize: 10
    }
  },
  computed: {
    visiblePages() {
      if (!this.pagination) return []
      
      const totalPages = this.pagination.total_pages
      const currentPage = this.pagination.current_page
      const pages = []
      
      // 计算显示的页码范围
      let start = Math.max(1, currentPage - 2)
      let end = Math.min(totalPages, start + 4)
      
      if (end - start < 4) {
        start = Math.max(1, end - 4)
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      return pages
    }
  },
  async mounted() {
    await this.loadProductTransactions()
  },
  methods: {
    async loadProductTransactions() {
      this.loading = true
      try {
        const productId = this.$route.params.id
        const year = this.$route.query.year || 2025
        const month = this.$route.query.month || 7
        
        const response = await ledgerAPI.getProductTransactions(productId, {
          year,
          month,
          page: this.currentPage,
          pageSize: this.pageSize
        })
        
        this.product = response.data.product
        this.transactions = response.data.transactions
        this.pagination = response.data.pagination
        
        // 设置页面标题
        if (this.product) {
          document.title = `${this.product.name} - 出入库详情`
        }
        
      } catch (error) {
        console.error('加载产品出入库详情失败:', error)
        this.$message?.error('加载产品出入库详情失败')
      } finally {
        this.loading = false
      }
    },
    async goToPage(page) {
      if (page === this.currentPage || page < 1 || (this.pagination && page > this.pagination.total_pages)) {
        return
      }
      this.currentPage = page
      await this.loadProductTransactions()
    },
    formatPeriod() {
      const year = this.$route.query.year || 2025
      const month = this.$route.query.month || 7
      const startDate = `${year}年${month}月1日`
      const endDate = `${year}年${month}月${new Date(year, month, 0).getDate()}日`
      return `${startDate} - ${endDate}`
    },
    formatDateTime(dateTime) {
      if (!dateTime) return '-'
      return new Date(dateTime).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    exportExcel() {
      // Excel导出功能开发中
      this.$message?.info('Excel导出功能开发中...')
    },
    closeWindow() {
      // 如果是在新窗口中打开的，关闭窗口；否则返回主页
      if (window.opener) {
        window.close()
      } else {
        this.$router.push('/')
      }
    },
    formatCurrency(val) {
      if (typeof val !== 'number') val = 0
      return '¥' + val.toFixed(2)
    }
  },
  filters: {
    currency(val) {
      if (typeof val !== 'number') return val
      return '¥' + val.toFixed(2)
    }
  }
}
</script>

<style scoped>
.product-ledger-detail {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  background: #f8fafc;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.header-left h2 {
  margin: 0 0 8px 0;
  color: #2d3748;
  font-size: 24px;
}

.product-info {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #718096;
}

.header-right {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-outline {
  background: #fff;
  color: #3182ce;
  border-color: #3182ce;
}

.btn-outline:hover {
  background: #ebf8ff;
}

.btn-secondary {
  background: #718096;
  color: #fff;
}

.btn-secondary:hover {
  background: #4a5568;
}

/* 产品汇总 */
.product-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  flex: 1;
}

.summary-label {
  font-size: 12px;
  color: #718096;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: #fff;
  border-radius: 8px;
}

.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.loading-text {
  color: #666;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 交易记录表格 - 使用与ReportsPage相同的样式 */
.transactions-container {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
}

.transactions-table-container {
  overflow-x: auto;
}

.transaction-header {
  display: grid;
  grid-template-columns: 80px 140px 80px 100px 100px 100px 140px 120px 100px 100px 100px;
  background: #f7fafc;
  border-bottom: 2px solid #e2e8f0;
  font-weight: 600;
  font-size: 13px;
  color: #4a5568;
}

.header-cell {
  padding: 12px 8px;
  display: flex;
  align-items: center;
  border-right: 1px solid #e2e8f0;
}

.transaction-row {
  display: grid;
  grid-template-columns: 80px 140px 80px 100px 100px 100px 140px 120px 100px 100px 100px;
  border-bottom: 1px solid #e2e8f0;
  transition: background-color 0.2s;
}

.transaction-row:hover {
  background: #f7fafc;
}

.transaction-row.IN {
  background: linear-gradient(90deg, rgba(72, 187, 120, 0.05) 0%, transparent 100%);
}

.transaction-row.OUT {
  background: linear-gradient(90deg, rgba(245, 101, 101, 0.05) 0%, transparent 100%);
}

.table-cell {
  padding: 12px 8px;
  display: flex;
  align-items: center;
  border-right: 1px solid #e2e8f0;
  font-size: 13px;
}

.transaction-type-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  min-width: 60px;
}

.transaction-type-badge.IN {
  background: #c6f6d5;
  color: #22543d;
}

.transaction-type-badge.OUT {
  background: #fed7d7;
  color: #742a2a;
}

.price-value {
  font-weight: 500;
}

.price-value.total {
  color: #3182ce;
}

.price-value.stock {
  color: #059669;
}

.low-stock {
  color: #e53e3e;
  font-weight: 600;
}

/* 分页 */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f7fafc;
  border-top: 1px solid #e2e8f0;
}

.pagination-info {
  font-size: 14px;
  color: #718096;
}

.pagination-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.pagination-btn {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #4a5568;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f7fafc;
  border-color: #cbd5e0;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn.active {
  background: #3182ce;
  color: #fff;
  border-color: #3182ce;
}

.pagination-numbers {
  display: flex;
  gap: 4px;
  margin: 0 8px;
}

/* 无数据状态 */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: #fff;
  border-radius: 8px;
  color: #718096;
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.no-data-text {
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .product-ledger-detail {
    padding: 10px;
  }
  
  .detail-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .product-summary {
    flex-direction: column;
    gap: 12px;
  }
  
  .transaction-header,
  .transaction-row {
    grid-template-columns: repeat(11, minmax(100px, 1fr));
  }
}
</style>
