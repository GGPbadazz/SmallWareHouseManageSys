// Toast notification utility with stacking support
let toastContainer = null;

const createToastContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

export const showToast = (message, type = 'info', duration = 3000) => {
  const container = createToastContainer();
  
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  
  // Apply styles
  toast.style.cssText = `
    margin-bottom: 8px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    max-width: 300px;
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease, opacity 0.3s ease;
    background: ${getToastColor(type)};
    pointer-events: auto;
  `
  
  // Add to container
  container.appendChild(toast)
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)'
  }, 10)
  
  // Remove after duration
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)'
    toast.style.opacity = '0'
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
      // Clean up container if empty
      if (container.children.length === 0 && container.parentNode) {
        container.parentNode.removeChild(container)
        toastContainer = null
      }
    }, 300)
  }, duration)
}

const getToastColor = (type) => {
  switch (type) {
    case 'success':
      return '#38a169'
    case 'error':
      return '#e53e3e'
    case 'warning':
      return '#d69e2e'
    case 'info':
    default:
      return '#3182ce'
  }
}

// Keyboard shortcut handler utility
export const addGlobalKeyboardShortcuts = (shortcuts) => {
  const handler = (event) => {
    for (const shortcut of shortcuts) {
      if (matchesShortcut(event, shortcut.key)) {
        event.preventDefault()
        shortcut.action()
        break
      }
    }
  }
  
  document.addEventListener('keydown', handler)
  
  return () => {
    document.removeEventListener('keydown', handler)
  }
}

const matchesShortcut = (event, shortcut) => {
  const keys = shortcut.split('+')
  const hasCtrl = keys.includes('ctrl') || keys.includes('cmd')
  const hasShift = keys.includes('shift')
  const hasAlt = keys.includes('alt')
  const mainKey = keys[keys.length - 1]
  
  return (
    (hasCtrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey) &&
    (hasShift ? event.shiftKey : !event.shiftKey) &&
    (hasAlt ? event.altKey : !event.altKey) &&
    event.key.toLowerCase() === mainKey.toLowerCase()
  )
}

// Format utilities
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(amount)
}

export const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatNumber = (number) => {
  return new Intl.NumberFormat('zh-CN').format(number)
}

// Export utilities
export const exportToCSV = (data, filename) => {
  const csvContent = "data:text/csv;charset=utf-8," + data
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportToExcel = (data, filename) => {
  // Simple Excel export (could be enhanced with a library like xlsx)
  const csvData = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' ? `"${value}"` : value
    ).join(',')
  ).join('\n')
  
  const blob = new Blob(['\ufeff' + csvData], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Local storage utilities
export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

export const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    return defaultValue
  }
}

// Theme utilities
export const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
  saveToLocalStorage('theme', theme)
}

export const getTheme = () => {
  return loadFromLocalStorage('theme', 'light')
}

// Validation utilities
export const validateBarcode = (barcode) => {
  if (!barcode || typeof barcode !== 'string') return false
  return barcode.length >= 8 && barcode.length <= 20 && /^\d+$/.test(barcode)
}

export const validateProduct = (product) => {
  const errors = []
  
  if (!product.name || product.name.trim().length < 1) {
    errors.push('产品名称不能为空')
  }
  
  if (!product.barcode || !validateBarcode(product.barcode)) {
    errors.push('条码格式无效')
  }
  
  if (product.stock < 0) {
    errors.push('库存不能为负数')
  }
  
  if (product.min_stock < 0) {
    errors.push('最小库存不能为负数')
  }
  
  return errors
}

export default {
  showToast,
  addGlobalKeyboardShortcuts,
  formatCurrency,
  formatDate,
  formatNumber,
  exportToCSV,
  exportToExcel,
  saveToLocalStorage,
  loadFromLocalStorage,
  setTheme,
  getTheme,
  validateBarcode,
  validateProduct
}
