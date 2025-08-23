import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token')
      // Redirect to login or show login modal
    }
    return Promise.reject(error)
  }
)

// Auth APIs
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  changePassword: (passwordData) => api.post('/auth/change-password', passwordData),
  verify: () => api.get('/auth/verify')
}

// Product APIs
export const productAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getQRCode: (id) => api.get(`/products/${id}/qrcode`),
  getStats: () => api.get('/products/stats/overview')
}

// Category APIs
export const categoryAPI = {
  getAll: () => api.get('/categories'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
  getProducts: (id, params) => api.get(`/categories/${id}/products`, { params })
}

// Project APIs
export const projectAPI = {
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  getTransactions: (id, params) => api.get(`/projects/${id}/transactions`, { params })
}

// Transaction APIs
export const transactionAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  getRecent: (limit) => api.get(`/transactions/recent/${limit}`)
}

// Report APIs
export const reportAPI = {
  getInventoryStatus: () => api.get('/reports/inventory-status'),
  getTransactionFlow: (params) => api.get('/reports/transaction-flow', { params }),
  getMonthlySummary: (params) => api.get('/reports/monthly-summary', { params }),
  getLowStockAlert: (params) => api.get('/reports/low-stock-alert', { params }),
  getAnalytics: (params) => api.get('/reports/analytics', { params })
}

// Ledger APIs
export const ledgerAPI = {
  getMonthlyData: (params) => api.get('/ledger/monthly', { params }),
  getProductTransactions: (id, params) => api.get(`/ledger/product/${id}/transactions`, { params }),
  getCategorySummary: (id, params) => api.get(`/ledger/category/${id}/summary`, { params }),
  getOutboundRecords: (params) => api.get('/ledger/outbound-records', { params })
}

// Snapshot APIs
export const snapshotAPI = {
  getStats: () => api.get('/snapshots/stats'),
  getList: (params) => api.get('/snapshots/list', { params }),
  getDetail: (year, month) => api.get(`/snapshots/detail/${year}/${month}`),
  generateSnapshot: (year, month) => api.post('/snapshots/generate', { year, month }),
  generateCurrentSnapshot: () => api.post('/snapshots/generate-current'),
  generateBatch: (data) => api.post('/snapshots/generate-batch', data),
  deleteSnapshot: (year, month) => api.delete(`/snapshots/${year}/${month}`),
  cleanupOldSnapshots: () => api.delete('/snapshots/cleanup')
}

// Settings APIs
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (settings) => api.put('/settings', { settings }),
  getSystemInfo: () => api.get('/settings/system-info'),
  changePassword: (passwordData) => api.put('/settings/admin-password', passwordData),
  exportData: (tables) => api.get('/settings/export', { params: { tables: tables?.join(',') } }),
  createBackup: () => api.post('/settings/backup'),
  listBackups: () => api.get('/settings/backup/list'),
  downloadBackup: (filename, config = {}) => api.get(`/settings/backup/download/${filename}`, {
    responseType: 'blob',
    ...config
  }),
  deleteBackup: (filename) => api.delete(`/settings/backup/${filename}`),
  cleanupSystem: (days) => api.post('/settings/cleanup', { days }),
  resetSystem: () => api.post('/settings/reset-system')
}

// Utility functions
export const showMessage = (message, type = 'info') => {
  const messageContainer = document.getElementById('messageContainer')
  if (!messageContainer) return

  const messageEl = document.createElement('div')
  messageEl.className = `message message-${type}`
  messageEl.innerHTML = `
    <div class="message-content">
      <span class="message-icon">
        ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
      </span>
      <span class="message-text">${message}</span>
    </div>
  `

  messageContainer.appendChild(messageEl)

  // Auto remove after 3 seconds
  setTimeout(() => {
    messageEl.style.opacity = '0'
    messageEl.style.transform = 'translateX(100%)'
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl)
      }
    }, 300)
  }, 3000)
}

export const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export const formatNumber = (number) => {
  return new Intl.NumberFormat('zh-CN').format(number)
}

export const generateBarcode = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 5)
}

export default api
