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
        <button class="btn btn-outline" @click="exportExcel" :disabled="exportingExcel || !product">
          <span v-if="exportingExcel">⏳</span>
          <span v-else>📊</span>
          <span v-if="exportingExcel">导出中...</span>
          <span v-else>导出Excel</span>
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
        <span class="summary-value">{{ formatQuantity(product.stock) }}</span>
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
          <div class="header-cell document-number">单号</div>
          <div class="header-cell datetime">操作时间</div>
          <div class="header-cell quantity">数量</div>
          <div class="header-cell unit-price">出入库单价</div>
          <div class="header-cell total-price">出入库总价</div>
          <div class="header-cell requester">领料人</div>
          <div class="header-cell project">领用部门</div>
          <div class="header-cell purpose">用途说明</div>
          <div class="header-cell current-stock">出入库后库存</div>
          <div class="header-cell stock-unit-price">库存单价</div>
          <div class="header-cell stock-value">库存价值</div>
          <div class="header-cell actions">操作</div>
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
          <div class="table-cell document-number">
            <span class="document-number-text">{{ extractDocumentNumber(transaction.document_number) }}</span>
          </div>
          <div class="table-cell datetime">
            <div class="datetime-info">
              {{ formatDateTime(transaction.created_at) }}
            </div>
          </div>
          <div class="table-cell quantity">
            <span class="quantity-value">{{ formatQuantity(transaction.quantity) }}</span>
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
              {{ formatQuantity(transaction.stock_after || 0) }}
            </span>
          </div>
          <div class="table-cell stock-unit-price">
            <span class="price-value stock-unit">{{ formatCurrency(transaction.stock_unit_price) }}</span>
          </div>
          <div class="table-cell stock-value">
            <span class="price-value stock">{{ formatCurrency(transaction.stock_value) }}</span>
          </div>
          <div class="table-cell actions">
            <button 
              v-if="transaction.document_id && transaction.document_image_path" 
              class="btn btn-sm btn-view-doc"
              @click="viewDocumentImage(transaction)"
            >
              查看
            </button>
            <span v-else class="no-doc">-</span>
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

    <!-- 单据图片预览弹窗 -->
    <div 
      v-if="showImagePreview" 
      class="image-preview-overlay"
      @click="closeImagePreview"
    >
      <div class="image-preview-hint">点击任意位置关闭预览</div>
      <div class="image-preview-info">
        单据号: {{ previewDocumentNumber || '-' }}
      </div>
      <img 
        :src="previewImageUrl" 
        class="preview-image"
        @click.stop
        @error="handleImageError"
        alt="单据图片"
      />
    </div>
  </div>
</template>

<script>
import { ledgerAPI } from '@/services/api'
import { exportProductDetailToExcel } from '@/utils/productDetailExporter'

export default {
  name: 'ProductLedgerDetail',
  data() {
    return {
      loading: false,
      exportingExcel: false,
      product: null,
      transactions: [],
      allTransactions: [], // 存储所有交易记录（用于导出）
      pagination: null,
      currentPage: 1,
      pageSize: 10,
      // 图片预览相关
      showImagePreview: false,
      previewImageUrl: '',
      previewDocumentNumber: ''
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
        
        // 获取分页数据（用于显示）
        const response = await ledgerAPI.getProductTransactions(productId, {
          year,
          month,
          page: this.currentPage,
          pageSize: this.pageSize
        })
        
        this.product = response.data.product
        this.transactions = response.data.transactions
        this.pagination = response.data.pagination
        
        // 如果是第一页，同时获取所有数据（用于导出）
        if (this.currentPage === 1) {
          try {
            const allDataResponse = await ledgerAPI.getProductTransactions(productId, {
              year,
              month,
              page: 1,
              pageSize: 1000 // 获取大量数据，确保包含所有记录
            })
            this.allTransactions = allDataResponse.data.transactions
          } catch (error) {
            console.warn('获取完整数据失败，使用当前页数据:', error)
            this.allTransactions = this.transactions
          }
        }
        
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
    async exportExcel() {
      if (this.exportingExcel || !this.product) return;
      
      this.exportingExcel = true;
      try {
        // 确保我们有完整的交易数据
        let exportData = this.allTransactions;
        
        // 如果没有完整数据，重新获取
        if (!exportData || exportData.length === 0) {
          const productId = this.$route.params.id;
          const year = this.$route.query.year || 2025;
          const month = this.$route.query.month || 7;
          
          const response = await ledgerAPI.getProductTransactions(productId, {
            year,
            month,
            page: 1,
            pageSize: 1000
          });
          exportData = response.data.transactions;
        }
        
        // 构建期间字符串
        const period = this.formatPeriod();
        
        // 导出Excel
        await exportProductDetailToExcel(this.product, exportData, period);
        
        // 显示成功消息
        if (this.$message) {
          this.$message.success('Excel导出成功！');
        } else {
          alert('Excel导出成功！');
        }
        
      } catch (error) {
        console.error('Excel导出失败:', error);
        if (this.$message) {
          this.$message.error('Excel导出失败：' + error.message);
        } else {
          alert('Excel导出失败：' + error.message);
        }
      } finally {
        this.exportingExcel = false;
      }
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
      const str = val.toString()
      // 仅去掉小数点后的尾零（如 300.00→300, 17.4100→17.41）
      // 不能对整数直接 replace(/\.?0+$/)，会把 900→9、300→3
      const cleaned = str.includes('.') ? str.replace(/\.?0+$/, '') : str
      return '¥' + (cleaned || '0')
    },
    formatQuantity(quantity) {
      if (quantity === null || quantity === undefined) return '0'
      const num = Number(quantity)
      if (isNaN(num)) return '0'
      
      // 如果是整数，显示为整数
      if (num === Math.floor(num)) {
        return num.toString()
      }
      
      // 如果是小数，最多显示3位小数，但移除末尾的0
      return num.toFixed(3).replace(/\.?0+$/, '')
    },
    viewDocumentImage(transaction) {
      if (!transaction.document_id) {
        this.$message?.warning('该交易记录没有关联单据（历史数据）')
        return
      }
      
      // 点击时才加载图片
      this.previewDocumentNumber = transaction.document_number || `交易ID: ${transaction.id}`
      this.previewImageUrl = `/api/documents/${transaction.document_id}/image`
      this.showImagePreview = true
    },
    closeImagePreview() {
      this.showImagePreview = false
      this.previewImageUrl = ''
      this.previewDocumentNumber = ''
    },
    handleImageError() {
      this.$message?.error('图片加载失败，文件可能已被删除')
      this.closeImagePreview()
    },
    extractDocumentNumber(documentNumber) {
      // 从完整单据号中提取7位数字部分
      // 格式: C1234567-2501 或 R1234567-2501 -> 1234567
      if (!documentNumber) return '-'
      
      // 使用正则表达式提取7位数字（在字母之后、连字符之前）
      const match = documentNumber.match(/[CR](\d{7})-/)
      return match ? match[1] : documentNumber
    }
  },
  filters: {
    currency(val) {
      if (typeof val !== 'number') return val
      // 显示精度：2位小数，财务标准
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

.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f7fafc;
  color: #a0aec0;
  border-color: #e2e8f0;
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
  grid-template-columns: 70px 120px 130px 70px 95px 95px 80px 100px 100px 90px 90px 90px 60px;
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
  grid-template-columns: 70px 120px 130px 70px 95px 95px 80px 100px 100px 90px 90px 90px 60px;
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

.document-number-text {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #4a5568;
  font-weight: 500;
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

/* 查看单据按钮 */
.btn-view-doc {
  padding: 4px 10px;
  font-size: 12px;
  background: #3182ce;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-view-doc:hover {
  background: #2c5282;
}

.btn-view-doc:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
}

/* 图片预览遮罩层 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}

.image-preview-hint {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.image-preview-info {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.preview-image {
  max-width: 95vw;
  max-height: 85vh;
  object-fit: contain;
  cursor: default;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
</style>
