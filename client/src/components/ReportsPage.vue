<template>
  <div class="reports-page">
    <!-- Compact Header with Stats and Filters -->
    <div class="reports-compact-header">
      <!-- Title and Stats Row -->
      <div class="header-row">
        <div class="reports-title-compact">
          <h2>报告中心</h2>
          <button class="btn btn-outline btn-sm" @click="refreshDashboardStats">
            <span>🔄</span>
            刷新
          </button>
        </div>
        
        <!-- Compact Dashboard Statistics -->
        <div class="dashboard-stats-compact">
          <div class="stat-item">
            <span class="stat-icon">📦</span>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalProducts }}</div>
              <div class="stat-label">产品</div>
            </div>
          </div>
          <div class="stat-item warning">
            <span class="stat-icon">⚠️</span>
            <div class="stat-info">
              <div class="stat-value">{{ stats.lowStockItems }}</div>
              <div class="stat-label">低库存</div>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-icon">📈</span>
            <div class="stat-info">
              <div class="stat-value">{{ stats.todayTransactions }}</div>
              <div class="stat-label">今日交易</div>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💰</span>
            <div class="stat-info">
              <div class="stat-value">¥{{ (stats.totalValue / 10000).toFixed(1) }}万</div>
              <div class="stat-label">库存总值</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Filters Row -->
      <div class="filters-row">
        <!-- 报告类型按钮组 -->
        <div class="filter-group-buttons">
          <label class="filter-label-compact">类型</label>
          <div class="button-group">
            <button 
              v-for="type in reportTypes" 
              :key="type.value"
              :class="['filter-btn', { active: reportType === type.value }]"
              @click="selectReportType(type.value)"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
        
        <!-- 时间范围按钮组 -->
        <div class="filter-group-buttons">
          <label class="filter-label-compact">范围</label>
          <div class="button-group">
            <button 
              v-for="range in timeRanges" 
              :key="range.value"
              :class="['filter-btn', { active: timeRange === range.value }]"
              @click="selectTimeRange(range.value)"
            >
              {{ range.label }}
            </button>
          </div>
        </div>
        
        <!-- 日期输入 -->
        <div class="filter-group-compact">
          <label class="filter-label-compact">开始</label>
          <input v-model="startDate" type="date" class="filter-input-compact" @change="loadReportData">
        </div>
        <div class="filter-group-compact">
          <label class="filter-label-compact">结束</label>
          <input v-model="endDate" type="date" class="filter-input-compact" @change="loadReportData">
        </div>
      </div>
    </div>

    <!-- Report Content -->
    <div class="report-content">
      <!-- Inventory Report -->
      <div v-if="reportType === 'inventory'" class="report-section">
        <div class="section-header">
          <h3>库存报告</h3>
        </div>
        <div class="report-table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>产品名称</th>
                <th>类别</th>
                <th>当前库存</th>
                <th>最小库存</th>
                <th>库存状态</th>
                <th>库存价值</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in inventoryReport" :key="item.id">
                <td class="product-name">{{ item.name }}</td>
                <td>{{ item.category_name }}</td>
                <td class="stock-value">{{ item.stock }}</td>
                <td class="min-stock">{{ item.min_stock }}</td>
                <td>
                  <span 
                    class="status-badge" 
                    :class="getStockStatus(item.stock, item.min_stock)"
                  >
                    {{ getStockStatusText(item.stock, item.min_stock) }}
                  </span>
                </td>
                <td class="value">¥{{ (item.stock * 10).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Transactions Report -->
      <div v-if="reportType === 'transactions'" class="report-section">
        <div class="section-header">
          <h3>交易报告</h3>
          <div class="header-actions">
            <button class="btn btn-success btn-sm" @click="exportTransactionsExcel">
              <span>📊</span>
              导出Excel
            </button>
          </div>
        </div>
        <div class="transaction-summary">
          <div class="summary-card">
            <div class="summary-label">总交易数</div>
            <div class="summary-value">{{ transactionSummary.total }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">入库交易</div>
            <div class="summary-value text-success">{{ transactionSummary.inbound }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">出库交易</div>
            <div class="summary-value text-danger">{{ transactionSummary.outbound }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">交易金额</div>
            <div class="summary-value">¥{{ transactionSummary.totalValue.toLocaleString() }}</div>
          </div>
        </div>
        
        <!-- 使用与主页面相同的交易记录格式 -->
        <div class="transactions-list-container">
          <!-- 表头 -->
          <div class="transaction-header">
            <div class="header-cell type">类型</div>
            <div class="header-cell product">产品信息</div>
            <div class="header-cell datetime">操作时间</div>
            <div class="header-cell quantity">数量</div>
            <div class="header-cell unit-price">出入库单价</div>
            <div class="header-cell total-price">出入库总价</div>
            <div class="header-cell requester">领料人</div>
            <div class="header-cell project">领用单位/部门</div>
            <div class="header-cell purpose">用途说明</div>
            <div class="header-cell current-stock">交易后库存</div>
            <div class="header-cell stock-unit-price">库存单价</div>
            <div class="header-cell stock-value">库存价值</div>
          </div>
          
          <!-- 数据行 -->
          <div 
            v-for="transaction in paginatedTransactions" 
            :key="transaction.id"
            class="transaction-row"
            :class="transaction.type"
          >
            <div class="table-cell type">
              <span class="transaction-type-badge" :class="transaction.type">
                {{ transaction.type === 'IN' ? '入库' : '出库' }}
              </span>
            </div>
            <div class="table-cell product">
              <div class="product-info">
                <div class="product-name">{{ transaction.product_name }}</div>
                <div class="product-code">{{ transaction.barcode || '-' }}</div>
              </div>
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
              <span class="price-value">¥{{ formatPrice(transaction.unit_price) }}</span>
            </div>
            <div class="table-cell total-price">
              <span class="price-value total">¥{{ formatPrice(transaction.total_price) }}</span>
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
              <span class="price-value stock-unit">¥{{ formatPrice(transaction.stock_unit_price) }}</span>
            </div>
            <div class="table-cell stock-value">
              <span class="price-value stock">¥{{ formatPrice(transaction.stock_value) }}</span>
            </div>
          </div>
          
          <!-- 分页控件 -->
          <div class="pagination-container" v-if="totalPages > 1">
            <div class="pagination-info">
              显示第 {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, transactionReport.length) }} 条，
              共 {{ transactionReport.length }} 条记录
            </div>
            <div class="pagination-controls">
              <button 
                class="pagination-btn"
                :disabled="currentPage === 1"
                @click="currentPage = 1"
              >
                首页
              </button>
              <button 
                class="pagination-btn"
                :disabled="currentPage === 1"
                @click="currentPage--"
              >
                上一页
              </button>
              <span class="pagination-numbers">
                <button 
                  v-for="page in visiblePages"
                  :key="page"
                  class="pagination-btn"
                  :class="{ active: page === currentPage }"
                  @click="currentPage = page"
                >
                  {{ page }}
                </button>
              </span>
              <button 
                class="pagination-btn"
                :disabled="currentPage === totalPages"
                @click="currentPage++"
              >
                下一页
              </button>
              <button 
                class="pagination-btn"
                :disabled="currentPage === totalPages"
                @click="currentPage = totalPages"
              >
                尾页
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Low Stock Report -->
      <div v-if="reportType === 'lowstock'" class="report-section">
        <div class="section-header">
          <h3>低库存报告</h3>
        </div>
        <div class="alert alert-warning">
          <strong>⚠️ 注意:</strong> 以下产品库存已达到最低库存警告线，请及时补货。
        </div>
        <div class="report-table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>产品名称</th>
                <th>类别</th>
                <th>当前库存</th>
                <th>最小库存</th>
                <th>缺货数量</th>
                <th>供应商</th>
                <th>紧急程度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in lowStockReport" :key="item.id">
                <td class="product-name">{{ item.name }}</td>
                <td>{{ item.category_name }}</td>
                <td class="stock-value danger">{{ item.stock }}</td>
                <td class="min-stock">{{ item.min_stock }}</td>
                <td class="shortage">{{ Math.max(0, item.min_stock - item.stock) }}</td>
                <td>{{ item.supplier || '-' }}</td>
                <td>
                  <span 
                    class="urgency-badge" 
                    :class="getUrgencyLevel(item.stock, item.min_stock)"
                  >
                    {{ getUrgencyText(item.stock, item.min_stock) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Categories Report -->
      <div v-if="reportType === 'categories'" class="report-section">
        <div class="section-header">
          <h3>分类报告</h3>
        </div>
        <div class="category-grid">
          <div v-for="category in categoryReport" :key="category.id" class="category-card">
            <div class="category-header">
              <h4>{{ category.name }}</h4>
              <span class="category-count">{{ category.product_count }} 产品</span>
            </div>
            <div class="category-stats">
              <div class="category-stat">
                <span class="stat-label">总库存</span>
                <span class="stat-value">{{ category.total_stock }}</span>
              </div>
              <div class="category-stat">
                <span class="stat-label">库存价值</span>
                <span class="stat-value">¥{{ category.total_value.toLocaleString() }}</span>
              </div>
              <div class="category-stat">
                <span class="stat-label">低库存</span>
                <span class="stat-value danger">{{ category.low_stock_count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import * as XLSX from 'xlsx'

export default {
  name: 'ReportsPage',
  setup() {
    const inventoryStore = useInventoryStore()
    
    // 报告类型选项
    const reportTypes = [
      { value: 'inventory', label: '库存' },
      { value: 'transactions', label: '交易' },
      { value: 'lowstock', label: '低库存' },
      { value: 'categories', label: '分类' }
    ]
    
    // 时间范围选项
    const timeRanges = [
      { value: 'today', label: '今天' },
      { value: 'week', label: '本周' },
      { value: 'month', label: '本月' },
      { value: 'quarter', label: '本季度' },
      { value: 'year', label: '本年' }
    ]
    
    // Reactive data
    const reportType = ref('inventory')
    const timeRange = ref('month')
    const startDate = ref('')
    const endDate = ref('')
    const inventoryReport = ref([])
    const transactionReport = ref([])
    const lowStockReport = ref([])
    const categoryReport = ref([])
    
    // 分页相关数据
    const currentPage = ref(1)
    const pageSize = ref(20)
    
    // Computed properties
    const stats = computed(() => {
      // 使用从数据库同步的统计数据，包括增长率
      const dbStats = inventoryStore.stats
      return {
        totalProducts: dbStats.totalProducts || 0,
        lowStockItems: dbStats.lowStockItems || 0,
        todayTransactions: dbStats.todayTransactions || 0,
        totalValue: dbStats.totalValue || 0,
        monthlyChange: dbStats.monthlyChange || 0,
        transactionGrowth: dbStats.transactionGrowth || 0,
        valueGrowth: dbStats.valueGrowth || 0
      }
    })
    
    const transactionSummary = computed(() => {
      const transactions = transactionReport.value
      return {
        total: transactions.length,
        inbound: transactions.filter(t => t.type === 'IN').length,
        outbound: transactions.filter(t => t.type === 'OUT').length,
        totalValue: transactions.reduce((sum, t) => sum + (t.total_price || t.quantity * (t.unit_price || 10)), 0)
      }
    })
    
    // 分页计算属性
    const totalPages = computed(() => {
      return Math.ceil(transactionReport.value.length / pageSize.value)
    })
    
    const paginatedTransactions = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return transactionReport.value.slice(start, end)
    })
    
    const visiblePages = computed(() => {
      const total = totalPages.value
      const current = currentPage.value
      const delta = 2
      
      const range = []
      const start = Math.max(1, current - delta)
      const end = Math.min(total, current + delta)
      
      for (let i = start; i <= end; i++) {
        range.push(i)
      }
      
      return range
    })
    
    // Methods
    const selectReportType = (type) => {
      reportType.value = type
      loadReportData()
    }
    
    const selectTimeRange = (range) => {
      timeRange.value = range
      handleTimeRangeChange()
    }
    
    const handleTimeRangeChange = () => {
      const today = new Date()
      
      // 本地日期格式化函数，避免时区问题
      const formatLocalDate = (date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      switch (timeRange.value) {
        case 'today':
          // 今天
          startDate.value = formatLocalDate(today)
          endDate.value = formatLocalDate(today)
          break
          
        case 'week':
          // 本周：周一到周日
          const currentDay = today.getDay() // 0=周日, 1=周一, ..., 6=周六
          const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay // 计算到周一的偏移
          
          const monday = new Date(today)
          monday.setDate(today.getDate() + mondayOffset)
          
          const sunday = new Date(monday)
          sunday.setDate(monday.getDate() + 6)
          
          startDate.value = formatLocalDate(monday)
          endDate.value = formatLocalDate(sunday)
          break
          
        case 'month':
          // 本月：当月第一天到最后一天
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
          const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
          
          startDate.value = formatLocalDate(firstDayOfMonth)
          endDate.value = formatLocalDate(lastDayOfMonth)
          break
          
        case 'quarter':
          // 本季度
          const currentQuarter = Math.floor(today.getMonth() / 3)
          const quarterStartMonth = currentQuarter * 3
          const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1)
          const quarterEnd = new Date(today.getFullYear(), quarterStartMonth + 3, 0)
          
          startDate.value = formatLocalDate(quarterStart)
          endDate.value = formatLocalDate(quarterEnd)
          break
          
        case 'year':
          // 本年
          const yearStart = new Date(today.getFullYear(), 0, 1)
          const yearEnd = new Date(today.getFullYear(), 11, 31)
          
          startDate.value = formatLocalDate(yearStart)
          endDate.value = formatLocalDate(yearEnd)
          break
          
        default:
          // 保持当前设置的日期不变
          break
      }
      
      // 时间范围变化后重新加载报告数据
      loadReportData()
    }
    
    const loadReportData = async () => {
      try {
        // 重置分页
        currentPage.value = 1
        
        switch (reportType.value) {
          case 'inventory':
            inventoryReport.value = inventoryStore.products.slice(0, 20)
            break
          case 'transactions':
            // 对于交易报告，加载所有数据，不再限制条数
            await loadAllTransactions()
            break
          case 'lowstock':
            lowStockReport.value = inventoryStore.lowStockProducts
            break
          case 'categories':
            await loadCategoryReport()
            break
        }
      } catch (error) {
        console.error('Failed to load report data:', error)
      }
    }
    
    const loadAllTransactions = async () => {
      try {
        // 构建查询参数
        const params = new URLSearchParams()
        if (startDate.value) params.append('start_date', startDate.value)
        if (endDate.value) params.append('end_date', endDate.value)
        // 设置一个大的限制值来获取所有数据
        params.append('limit', '10000')
        params.append('offset', '0')
        
        const response = await fetch(`/api/transactions?${params.toString()}`)
        const data = await response.json()
        
        if (response.ok) {
          transactionReport.value = data.transactions || []
        } else {
          console.error('Failed to load transactions:', data.error)
          transactionReport.value = []
        }
      } catch (error) {
        console.error('Failed to load transactions:', error)
        transactionReport.value = []
      }
    }
    
    const loadCategoryReport = async () => {
      try {
        const categories = inventoryStore.categories
        const products = inventoryStore.products
        
        categoryReport.value = categories.map(category => {
          const categoryProducts = products.filter(p => p.category_id === category.id)
          return {
            ...category,
            product_count: categoryProducts.length,
            total_stock: categoryProducts.reduce((sum, p) => sum + p.stock, 0),
            total_value: categoryProducts.reduce((sum, p) => sum + (p.stock * 10), 0),
            low_stock_count: categoryProducts.filter(p => p.stock <= p.min_stock).length
          }
        })
      } catch (error) {
        console.error('Failed to load category report:', error)
      }
    }
    
    const generateReport = async () => {
      try {
        const data = getCurrentReportData()
        const reportTypeText = getReportTypeText(reportType.value)
        const currentDate = new Date()
        const formattedDate = formatDate(currentDate)
        const timeRangeText = getTimeRangeText()
        
        let htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTypeText} - ${formattedDate}</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f7fa;
            color: #2d3748;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header h1 {
            color: #2d3748;
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        .header p {
            color: #718096;
            margin: 0;
            font-size: 14px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
            border-left: 4px solid #4299e1;
        }
        .stat-card.warning {
            border-left-color: #e53e3e;
        }
        .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 4px;
        }
        .stat-label {
            font-size: 14px;
            color: #4a5568;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .report-table th {
            background: #f7fafc;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #4a5568;
            border-bottom: 1px solid #e2e8f0;
        }
        .report-table td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .status-success {
            background: #c6f6d5;
            color: #2f855a;
        }
        .status-warning {
            background: #feebc8;
            color: #c05621;
        }
        .status-danger {
            background: #fed7d7;
            color: #c53030;
        }
        .chart-container {
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 20px;
        }
        .print-info {
            text-align: center;
            margin-top: 40px;
            color: #718096;
            font-size: 12px;
        }
        @media print {
            body { background: white; }
            .stat-card, .report-table { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${reportTypeText}</h1>
        <p>生成时间：${formattedDate} | 时间范围：${timeRangeText}</p>
    </div>
`
        
        // 添加统计概览
        if (reportType.value === 'inventory') {
          const totalProducts = data.length
          const lowStockCount = data.filter(item => item.stock <= item.min_stock).length
          const totalValue = data.reduce((sum, item) => sum + (item.stock * 10), 0)
          const avgStock = Math.round(data.reduce((sum, item) => sum + item.stock, 0) / data.length)
          
          htmlContent += `
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${totalProducts}</div>
            <div class="stat-label">总产品数</div>
        </div>
        <div class="stat-card warning">
            <div class="stat-value">${lowStockCount}</div>
            <div class="stat-label">低库存产品</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">¥${totalValue.toLocaleString()}</div>
            <div class="stat-label">库存总值</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${avgStock}</div>
            <div class="stat-label">平均库存</div>
        </div>
    </div>
`
          
          // 添加库存表格
          htmlContent += `
    <div class="chart-container">
        <div class="chart-title">库存详情</div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>产品名称</th>
                    <th>类别</th>
                    <th>当前库存</th>
                    <th>最小库存</th>
                    <th>库存状态</th>
                    <th>库存价值</th>
                </tr>
            </thead>
            <tbody>
`
          
          data.forEach(item => {
            const statusClass = item.stock === 0 ? 'status-danger' : 
                              item.stock <= item.min_stock ? 'status-warning' : 'status-success'
            const statusText = item.stock === 0 ? '缺货' : 
                              item.stock <= item.min_stock ? '低库存' : '正常'
            
            htmlContent += `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category_name}</td>
                    <td>${item.stock}</td>
                    <td>${item.min_stock}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>¥${(item.stock * 10).toLocaleString()}</td>
                </tr>
`
          })
          
          htmlContent += `
            </tbody>
        </table>
    </div>
`
        }
        
        // 其他报告类型的处理
        if (reportType.value === 'transactions') {
          const totalTransactions = data.length
          const inboundCount = data.filter(t => t.type === 'IN').length
          const outboundCount = data.filter(t => t.type === 'OUT').length
          const totalQuantity = data.reduce((sum, t) => sum + t.quantity, 0)
          
          htmlContent += `
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${totalTransactions}</div>
            <div class="stat-label">总交易数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${inboundCount}</div>
            <div class="stat-label">入库交易</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${outboundCount}</div>
            <div class="stat-label">出库交易</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalQuantity}</div>
            <div class="stat-label">总交易量</div>
        </div>
    </div>
    
    <div class="chart-container">
        <div class="chart-title">交易记录</div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>时间</th>
                    <th>产品</th>
                    <th>类型</th>
                    <th>数量</th>
                    <th>操作人</th>
                </tr>
            </thead>
            <tbody>
`
          
          data.forEach(item => {
            const typeClass = item.type === 'IN' ? 'status-success' : 'status-danger'
            const typeText = item.type === 'IN' ? '入库' : '出库'
            
            htmlContent += `
                <tr>
                    <td>${formatDate(item.created_at)}</td>
                    <td><strong>${item.product_name}</strong></td>
                    <td><span class="status-badge ${typeClass}">${typeText}</span></td>
                    <td>${item.quantity}</td>
                    <td>${item.requester_name || '-'}</td>
                </tr>
`
          })
          
          htmlContent += `
            </tbody>
        </table>
    </div>
`
        }
        
        if (reportType.value === 'lowstock') {
          const totalLowStock = data.length
          const criticalCount = data.filter(item => item.stock === 0).length
          const warningCount = data.filter(item => item.stock > 0 && item.stock <= item.min_stock).length
          const totalShortage = data.reduce((sum, item) => sum + Math.max(0, item.min_stock - item.stock), 0)
          
          htmlContent += `
    <div class="stats-grid">
        <div class="stat-card warning">
            <div class="stat-value">${totalLowStock}</div>
            <div class="stat-label">低库存产品</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${criticalCount}</div>
            <div class="stat-label">缺货产品</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${warningCount}</div>
            <div class="stat-label">警告产品</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalShortage}</div>
            <div class="stat-label">总缺货数量</div>
        </div>
    </div>
    
    <div class="chart-container">
        <div class="chart-title">低库存详情</div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>产品名称</th>
                    <th>类别</th>
                    <th>当前库存</th>
                    <th>最小库存</th>
                    <th>缺货数量</th>
                    <th>紧急程度</th>
                </tr>
            </thead>
            <tbody>
`
          
          data.forEach(item => {
            const shortage = Math.max(0, item.min_stock - item.stock)
            let urgencyClass = 'status-warning'
            let urgencyText = '中'
            
            if (item.stock === 0) {
              urgencyClass = 'status-danger'
              urgencyText = '紧急'
            } else if (item.stock <= item.min_stock / 2) {
              urgencyClass = 'status-warning'
              urgencyText = '高'
            }
            
            htmlContent += `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category_name}</td>
                    <td><span class="status-badge ${item.stock === 0 ? 'status-danger' : 'status-warning'}">${item.stock}</span></td>
                    <td>${item.min_stock}</td>
                    <td>${shortage}</td>
                    <td><span class="status-badge ${urgencyClass}">${urgencyText}</span></td>
                </tr>
`
          })
          
          htmlContent += `
            </tbody>
        </table>
    </div>
`
        }
        
        if (reportType.value === 'categories') {
          const totalCategories = data.length
          const totalProducts = data.reduce((sum, cat) => sum + cat.product_count, 0)
          const totalValue = data.reduce((sum, cat) => sum + cat.total_value, 0)
          const avgProductsPerCategory = Math.round(totalProducts / totalCategories)
          
          htmlContent += `
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${totalCategories}</div>
            <div class="stat-label">总分类数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalProducts}</div>
            <div class="stat-label">总产品数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">¥${totalValue.toLocaleString()}</div>
            <div class="stat-label">总价值</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${avgProductsPerCategory}</div>
            <div class="stat-label">平均产品数/分类</div>
        </div>
    </div>
    
    <div class="chart-container">
        <div class="chart-title">分类统计</div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>分类名称</th>
                    <th>产品数量</th>
                    <th>总库存</th>
                    <th>库存价值</th>
                    <th>低库存产品</th>
                </tr>
            </thead>
            <tbody>
`
          
          data.forEach(category => {
            htmlContent += `
                <tr>
                    <td><strong>${category.name}</strong></td>
                    <td>${category.product_count}</td>
                    <td>${category.total_stock}</td>
                    <td>¥${category.total_value.toLocaleString()}</td>
                    <td><span class="status-badge ${category.low_stock_count > 0 ? 'status-warning' : 'status-success'}">${category.low_stock_count}</span></td>
                </tr>
`
          })
          
          htmlContent += `
            </tbody>
        </table>
    </div>
`
        }
        
        htmlContent += `
    <div class="print-info">
        <p>本报告由库存管理系统自动生成 | 生成时间：${formattedDate}</p>
    </div>
</body>
</html>
`
        
        // 创建并下载HTML文件
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${reportTypeText}_${timeRangeText}_${formatDateForFile(currentDate)}.html`
        link.click()
        
        // 保存到历史记录
        const report = {
          id: Date.now(),
          title: `${reportTypeText} - ${formattedDate}`,
          type: reportType.value,
          created_at: new Date().toISOString(),
          data: data,
          htmlContent: htmlContent
        }
        
        reportHistory.value.unshift(report)
        showMessage('可视化报告生成成功，已自动下载HTML文件', 'success')
      } catch (error) {
        console.error('生成报告失败:', error)
        showMessage('报告生成失败', 'error')
      }
    }
    
    const exportAllData = () => {
      const data = {
        products: inventoryStore.products,
        transactions: inventoryStore.transactions,
        categories: inventoryStore.categories,
        timestamp: new Date().toISOString()
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `inventory_full_export_${formatDateForFile(new Date())}.json`
      link.click()
      
      showMessage('数据导出成功', 'success')
    }
    
    const exportTransactionsExcel = () => {
      const data = transactionReport.value
      
      if (!data || data.length === 0) {
        showMessage('没有交易数据可导出', 'warning')
        return
      }
      
      // 准备Excel数据 - 按照页面显示的完整格式，价格字段为纯数字便于后续处理
      const excelData = data.map(transaction => ({
        '操作时间': formatDateTime(transaction.created_at),
        '类型': transaction.type === 'IN' ? '入库' : '出库',
        '产品名称': transaction.product_name || '-',
        '条码': transaction.barcode || '-',
        '数量': transaction.quantity || 0,
        '出入库单价': transaction.unit_price ? parseFloat(transaction.unit_price.toFixed(2)) : 0,
        '出入库总价': transaction.total_price ? parseFloat(transaction.total_price.toFixed(2)) : 0,
        '领料人': transaction.requester_name || '-',
        '领用单位/部门': transaction.project_name || '-',
        '用途说明': transaction.purpose || '-',
        '交易后库存': transaction.stock_after || 0,
        '库存单价': transaction.stock_unit_price ? parseFloat(transaction.stock_unit_price.toFixed(2)) : 0,
        '库存价值': transaction.stock_value ? parseFloat(transaction.stock_value.toFixed(2)) : 0
      }))
      
      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)
      
      // 设置列宽
      const colWidths = [
        { wch: 18 }, // 操作时间
        { wch: 8 },  // 类型
        { wch: 25 }, // 产品名称
        { wch: 15 }, // 条码
        { wch: 8 },  // 数量
        { wch: 12 }, // 出入库单价
        { wch: 12 }, // 出入库总价
        { wch: 12 }, // 领料人
        { wch: 15 }, // 领用单位/部门
        { wch: 20 }, // 用途说明
        { wch: 10 }, // 交易后库存
        { wch: 12 }, // 库存单价
        { wch: 12 }  // 库存价值
      ]
      ws['!cols'] = colWidths
      
      // 添加工作表
      XLSX.utils.book_append_sheet(wb, ws, '交易记录')
      
      // 生成文件名
      const timeRangeText = getTimeRangeText()
      const filename = `交易记录_${timeRangeText}_${formatDateForFile(new Date())}.xlsx`
      
      // 下载Excel文件
      XLSX.writeFile(wb, filename)
      
      showMessage('Excel导出成功', 'success')
    }
    
    const getTimeRangeText = () => {
      const ranges = {
        today: '今天',
        week: '本周',
        month: '本月',
        quarter: '本季度',
        year: '本年'
      }
      
      if (timeRange.value && ranges[timeRange.value]) {
        return ranges[timeRange.value]
      }
      
      if (startDate.value && endDate.value) {
        return `${startDate.value}_${endDate.value}`
      }
      
      return '全部'
    }
    
    const getCurrentReportData = () => {
      switch (reportType.value) {
        case 'inventory':
          return inventoryReport.value
        case 'transactions':
          return transactionReport.value
        case 'lowstock':
          return lowStockReport.value
        case 'categories':
          return categoryReport.value
        default:
          return []
      }
    }
    
    const getReportTypeText = (type) => {
      const types = {
        inventory: '库存报告',
        transactions: '交易报告',
        lowstock: '低库存报告',
        categories: '分类报告'
      }
      return types[type] || '未知报告'
    }
    
    const getStockStatus = (stock, minStock) => {
      if (stock === 0) return 'danger'
      if (stock <= minStock) return 'warning'
      return 'success'
    }
    
    const getStockStatusText = (stock, minStock) => {
      if (stock === 0) return '缺货'
      if (stock <= minStock) return '低库存'
      return '正常'
    }
    
    const getUrgencyLevel = (stock, minStock) => {
      if (stock === 0) return 'critical'
      if (stock <= minStock / 2) return 'high'
      return 'medium'
    }
    
    const getUrgencyText = (stock, minStock) => {
      if (stock === 0) return '紧急'
      if (stock <= minStock / 2) return '高'
      return '中'
    }
    
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    const formatDateTime = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const formatPrice = (price) => {
      return (price || 0).toFixed(2)
    }
    
    const formatDateForFile = (date) => {
      return date.toISOString().split('T')[0]
    }
    
    const showMessage = (message, type = 'info') => {
      const messageEl = document.createElement('div')
      messageEl.className = `message message-${type}`
      messageEl.textContent = message
      messageEl.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        background: ${type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : '#3182ce'};
        animation: slideIn 0.3s ease;
      `
      
      document.body.appendChild(messageEl)
      setTimeout(() => messageEl.remove(), 3000)
    }
    
    // Initialize dates
    const initializeDates = () => {
      // 设置默认时间范围为"本月"，然后调用时间范围处理函数
      timeRange.value = 'month'
      handleTimeRangeChange()
    }
    
    // Load data on mount
    onMounted(() => {
      inventoryStore.loadInitialData().then(() => {
        initializeDates() // 先初始化日期
        // 确保统计数据是最新的
        refreshDashboardStats()
      })
    })
    
    // 刷新看板统计数据
    const refreshDashboardStats = async () => {
      try {
        await inventoryStore.loadStats()
        console.log('Dashboard stats refreshed:', inventoryStore.stats)
      } catch (error) {
        console.error('Failed to refresh dashboard stats:', error)
      }
    }
    
    return {
      reportTypes,
      timeRanges,
      reportType,
      timeRange,
      startDate,
      endDate,
      inventoryReport,
      transactionReport,
      lowStockReport,
      categoryReport,
      stats,
      transactionSummary,
      // 分页相关
      currentPage,
      pageSize,
      totalPages,
      paginatedTransactions,
      visiblePages,
      selectReportType,
      selectTimeRange,
      handleTimeRangeChange,
      loadReportData,
      generateReport,
      exportAllData,
      exportTransactionsExcel,
      getStockStatus,
      getStockStatusText,
      getUrgencyLevel,
      getUrgencyText,
      formatDate,
      formatDateTime,
      formatPrice,
      refreshDashboardStats
    }
  }
}
</script>

<style scoped>
/* Same styling structure as inventory page but with report-specific adjustments */
.reports-page {
  padding: 16px;
}

/* Compact Header Layout */
.reports-compact-header {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 16px;
  overflow: hidden;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.reports-title-compact {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reports-title-compact h2 {
  margin: 0;
  color: #2d3748;
  font-size: 18px;
}

/* Compact Stats */
.dashboard-stats-compact {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #f7fafc;
  border-radius: 6px;
  border-left: 3px solid #4299e1;
  min-width: 140px;
  flex: 1;
}

.stat-item.warning {
  border-left-color: #e53e3e;
}

.stat-item .stat-icon {
  font-size: 20px;
  min-width: 20px;
}

.stat-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  flex: 1;
}

.stat-info .stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #2d3748;
  line-height: 1.1;
  white-space: nowrap;
}

.stat-info .stat-label {
  font-size: 12px;
  color: #4a5568;
  line-height: 1;
  margin-top: 3px;
  white-space: nowrap;
}

/* Compact Filters */
.filters-row {
  display: flex;
  gap: 20px;
  padding: 12px 16px;
  background: #f7fafc;
  align-items: center;
  flex-wrap: wrap;
}

.filter-group-compact {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label-compact {
  font-size: 12px;
  font-weight: 500;
  color: #4a5568;
  white-space: nowrap;
  margin-right: 4px;
}

.button-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.filter-btn {
  flex: 1;
  padding: 12px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #4a5568;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  text-align: center;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-btn:hover {
  background: #f7fafc;
  border-color: #cbd5e0;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.filter-btn.active {
  background: #3182ce;
  color: white;
  border-color: #3182ce;
  box-shadow: 0 2px 8px rgba(49, 130, 206, 0.3);
}

.filter-btn.active:hover {
  background: #2c5aa0;
  border-color: #2c5aa0;
}

.filter-select-compact,
.filter-input-compact {
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  min-width: 80px;
  height: 32px;
}

.filter-select-compact {
  min-width: 90px;
}

.filter-input-compact {
  min-width: 110px;
}

/* Original styles for content areas */
.reports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.reports-title h2 {
  margin: 0;
  color: #2d3748;
}

.reports-title p {
  margin: 4px 0 0 0;
  color: #718096;
}

.reports-actions {
  display: flex;
  gap: 12px;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #4299e1;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-card.warning {
  border-left-color: #e53e3e;
}

.stat-icon {
  font-size: 32px;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #4a5568;
  margin-bottom: 4px;
}

.stat-change {
  font-size: 12px;
  font-weight: 500;
}

.stat-change.positive {
  color: #48bb78;
}

.stat-change.negative {
  color: #e53e3e;
}

.report-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
}

.filter-select,
.filter-input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  min-width: 120px;
}

.report-content {
  margin-bottom: 40px;
}

.report-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.section-header h3 {
  margin: 0;
  color: #2d3748;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-actions .btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.transaction-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.summary-card {
  text-align: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
}

.summary-label {
  font-size: 12px;
  color: #718096;
  margin-bottom: 4px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
}

.summary-value.text-success {
  color: #38a169;
}

.summary-value.text-danger {
  color: #e53e3e;
}

.report-table-container {
  overflow-x: auto;
  border-radius: 8px;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1200px;
}

.report-table th {
  background: #f7fafc;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 1px solid #e2e8f0;
}

.report-table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.success {
  background: #c6f6d5;
  color: #2f855a;
}

.status-badge.warning {
  background: #feebc8;
  color: #c05621;
}

.status-badge.danger {
  background: #fed7d7;
  color: #c53030;
}

.urgency-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.urgency-badge.critical {
  background: #fed7d7;
  color: #c53030;
}

.urgency-badge.high {
  background: #feebc8;
  color: #c05621;
}

.urgency-badge.medium {
  background: #fefcbf;
  color: #975a16;
}

.transaction-type {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.transaction-type.in {
  background: #c6f6d5;
  color: #2f855a;
}

.transaction-type.out {
  background: #fed7d7;
  color: #c53030;
}

.transaction-type-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.transaction-type-badge.type-in {
  background: #c6f6d5;
  color: #2f855a;
}

.transaction-type-badge.type-out {
  background: #fed7d7;
  color: #c53030;
}

.product-info {
  min-width: 150px;
}

.product-info .product-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 2px;
}

.product-info .product-code {
  font-size: 11px;
  color: #718096;
  font-family: monospace;
}

.unit-price, .total-price, .stock-value {
  font-weight: 600;
  color: #2d3748;
  text-align: right;
}

.current-stock {
  font-weight: 600;
  color: #38a169;
  text-align: center;
}

.requester, .project, .purpose {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
}

.category-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.category-header h4 {
  margin: 0;
  color: #2d3748;
}

.category-count {
  font-size: 12px;
  color: #718096;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-stat .stat-label {
  font-size: 14px;
  color: #4a5568;
}

.category-stat .stat-value {
  font-weight: 600;
  color: #2d3748;
}

.category-stat .stat-value.danger {
  color: #e53e3e;
}

.alert {
  padding: 12px;
  border-radius: 6px;
  margin: 16px;
}

.alert-warning {
  background: #fefcbf;
  color: #975a16;
  border: 1px solid #f6e05e;
}

.btn {
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

.btn-primary {
  background: #3182ce;
  color: white;
}

.btn-secondary {
  background: #4a5568;
  color: white;
}

.btn-outline {
  background: white;
  color: #4a5568;
  border: 1px solid #e2e8f0;
}

.btn-success {
  background: #38a169;
  color: white;
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.product-name {
  font-weight: 600;
  color: #2d3748;
}

.stock-value {
  font-weight: 600;
  color: #38a169;
}

.stock-value.danger {
  color: #e53e3e;
}

.timestamp {
  font-size: 12px;
  color: #718096;
}

@media (max-width: 768px) {
  .reports-page {
    padding: 12px;
  }
  
  .header-row {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .reports-title-compact {
    width: 100%;
    justify-content: space-between;
  }
  
  .dashboard-stats-compact {
    width: 100%;
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .stat-item {
    flex: 1;
    min-width: calc(50% - 8px);
    max-width: calc(50% - 8px);
  }
  
  .filters-row {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .filter-group-buttons {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  
  .button-group {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .filter-btn {
    padding: 14px 12px;
    font-size: 13px;
    min-height: 48px;
    text-align: center;
  }
  
  .filter-group-compact {
    width: 100%;
    justify-content: space-between;
  }
  
  .filter-select-compact,
  .filter-input-compact {
    flex: 1;
    min-width: 0;
  }
  
  .reports-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .dashboard-stats {
    grid-template-columns: 1fr;
  }
  
  .report-filters {
    flex-direction: column;
    gap: 12px;
  }
  
  .category-grid {
    grid-template-columns: 1fr;
  }
}

/* 交易列表样式 - 与主页面保持一致 */
.transactions-list-container {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.transaction-header {
  display: grid;
  grid-template-columns: 60px 1fr 140px 60px 80px 90px 100px 120px 150px 80px 90px 100px;
  background: #f8fafc;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  font-size: 12px;
  color: #374151;
}

.transaction-row {
  display: grid;
  grid-template-columns: 60px 1fr 140px 60px 80px 90px 100px 120px 150px 80px 90px 100px;
  border-bottom: 1px solid #f3f4f6;
  transition: all 0.2s ease;
}

.transaction-row:hover {
  background: #f9fafb;
}

.transaction-row.IN {
  border-left: 3px solid #10b981;
}

.transaction-row.OUT {
  border-left: 3px solid #ef4444;
}

.transaction-row:last-child {
  border-bottom: none;
}

.header-cell,
.table-cell {
  padding: 8px 6px;
  display: flex;
  align-items: center;
  font-size: 13px;
  border-right: 1px solid #f3f4f6;
}

.header-cell:last-child,
.table-cell:last-child {
  border-right: none;
}

.header-cell {
  font-weight: 600;
  color: #6b7280;
  text-align: center;
  justify-content: center;
}

.transaction-type-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  min-width: 40px;
}

.transaction-type-badge.IN {
  background: #dcfce7;
  color: #166534;
}

.transaction-type-badge.OUT {
  background: #fee2e2;
  color: #991b1b;
}

.product-info {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.product-name {
  font-weight: 500;
  color: #111827;
  font-size: 13px;
  line-height: 1.2;
}

.product-code {
  font-size: 11px;
  color: #6b7280;
  font-family: 'Courier New', monospace;
}

.datetime-info {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.3;
}

.quantity-value {
  font-weight: 600;
  color: #2563eb;
}

.price-value {
  font-weight: 500;
  color: #059669;
}

.price-value.total {
  font-weight: 600;
  color: #dc2626;
}

.price-value.stock-unit {
  color: #7c3aed;
  font-weight: 600;
}

.price-value.stock {
  color: #059669;
  font-weight: 600;
}

.requester-name,
.project-name,
.purpose-text {
  font-size: 12px;
  color: #374151;
}

.stock-value {
  font-weight: 600;
  color: #059669;
}

.stock-value.low-stock {
  color: #dc2626;
  background: #fee2e2;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 分页样式 */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
}

.pagination-info {
  font-size: 14px;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-btn:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.pagination-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.pagination-numbers {
  display: flex;
  gap: 4px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .transaction-header,
  .transaction-row {
    grid-template-columns: 50px 1fr 120px 50px 70px 80px 90px 100px 130px 70px 80px 90px;
    font-size: 11px;
  }
  
  .header-cell,
  .table-cell {
    padding: 6px 4px;
  }
}

@media (max-width: 768px) {
  .transaction-header,
  .transaction-row {
    grid-template-columns: 40px 1fr 100px 40px 60px 70px 80px 90px 110px 60px 70px 80px;
    font-size: 10px;
  }
  
  .header-cell,
  .table-cell {
    padding: 4px 2px;
  }
  
  .pagination-container {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
