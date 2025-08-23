import { defineStore } from 'pinia'
import api from '@/services/api'

export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    products: [],
    categories: [],
    projects: [],
    transactions: [],
    stats: {
      totalProducts: 0,
      lowStockItems: 0,
      todayTransactions: 0,
      totalValue: 0
    },
    loading: false,
    error: null
  }),

  getters: {
    lowStockProducts: (state) => {
      return state.products.filter(product => product.stock <= product.min_stock)
    },
    
    getProductByBarcode: (state) => {
      return (barcode) => state.products.find(product => product.barcode === barcode)
    },
    
    getProductById: (state) => {
      return (id) => state.products.find(product => product.id === id)
    },
    
    getCategoryName: (state) => {
      return (categoryId) => {
        const category = state.categories.find(cat => cat.id === categoryId)
        return category ? category.name : '未分类'
      }
    },
    
    getProjectName: (state) => {
      return (projectId) => {
        const project = state.projects.find(proj => proj.id === projectId)
        return project ? project.name : '未指定项目'
      }
    }
  },

  actions: {
    async loadInitialData() {
      this.loading = true
      this.error = null
      
      try {
        await Promise.all([
          this.loadProducts(),
          this.loadCategories(),
          this.loadProjects(),
          this.loadStats(),
          this.loadRecentTransactions()
        ])
      } catch (error) {
        this.error = error.message || '加载数据失败'
        console.error('Failed to load initial data:', error)
        // Don't throw error, just log it
      } finally {
        this.loading = false
      }
    },

    async loadProducts() {
      try {
        // 默认加载前1000个产品
        const response = await api.get('/products?limit=1000')
        this.products = response.data.products || []
      } catch (error) {
        console.error('Failed to load products:', error)
        this.products = []
      }
    },

    async loadAllProducts() {
      try {
        // 专门用于需要加载所有产品的场景（如条码管理）
        const response = await api.get('/products?all=true')
        this.products = response.data.products || []
        return this.products
      } catch (error) {
        console.error('Failed to load all products:', error)
        this.products = []
        return []
      }
    },

    async loadCategories() {
      try {
        const response = await api.get('/categories')
        this.categories = response.data || []
      } catch (error) {
        console.error('Failed to load categories:', error)
        this.categories = []
      }
    },

    async loadProjects() {
      try {
        const response = await api.get('/projects')
        this.projects = response.data || []
      } catch (error) {
        console.error('Failed to load projects:', error)
        this.projects = []
      }
    },

    async loadStats() {
      try {
        const response = await api.get('/products/stats/dashboard')
        this.stats = response.data || {
          totalProducts: 0,
          lowStockItems: 0,
          todayTransactions: 0,
          totalValue: 0,
          monthlyChange: 0,
          transactionGrowth: 0,
          valueGrowth: 0
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
        // Fallback to basic stats if enhanced stats fail
        try {
          const fallbackResponse = await api.get('/products/stats/overview')
          this.stats = {
            ...fallbackResponse.data,
            monthlyChange: 0,
            transactionGrowth: 0,
            valueGrowth: 0
          }
        } catch (fallbackError) {
          console.error('Failed to load fallback stats:', fallbackError)
        }
      }
    },

    async loadRecentTransactions() {
      try {
        const response = await api.get('/transactions/recent/20')
        this.transactions = response.data || []
      } catch (error) {
        console.error('Failed to load recent transactions:', error)
        this.transactions = []
      }
    },

    async searchProducts(query) {
      try {
        const response = await api.get('/products', {
          params: { search: query }
        })
        return response.data.products || []
      } catch (error) {
        console.error('Failed to search products:', error)
        // Fallback to client-side search
        return this.performClientSearch(query)
      }
    },

    performClientSearch(query) {
      if (!query || query.length < 1) return []
      
      const searchTerm = query.toLowerCase()
      return this.products.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.barcode.toLowerCase().includes(searchTerm) ||
        (product.category_name && product.category_name.toLowerCase().includes(searchTerm)) ||
        (product.description && product.description.toLowerCase().includes(searchTerm))
      ).slice(0, 10)
    },

    async createProduct(productData) {
      try {
        const response = await api.post('/products', productData)
        this.products.push(response.data)
        await this.loadStats()
        return response.data
      } catch (error) {
        console.error('Failed to create product:', error)
        throw error
      }
    },

    async updateProduct(id, productData) {
      try {
        const response = await api.put(`/products/${id}`, productData)
        const index = this.products.findIndex(p => p.id === id)
        if (index !== -1) {
          this.products[index] = response.data
        }
        await this.loadStats()
        return response.data
      } catch (error) {
        console.error('Failed to update product:', error)
        throw error
      }
    },

    async deleteProduct(id) {
      try {
        await api.delete(`/products/${id}`)
        this.products = this.products.filter(p => p.id !== id)
        await this.loadStats()
      } catch (error) {
        console.error('Failed to delete product:', error)
        throw error
      }
    },

    async createTransaction(transactionData) {
      try {
        console.log('Creating transaction:', transactionData)
        const response = await api.post('/transactions', transactionData)
        console.log('Transaction response:', response.data)
        this.transactions.unshift(response.data)
        
        console.log('Reloading products and stats...')
        await this.loadProducts()
        await this.loadStats()
        console.log('Data reloaded successfully')
        
        return response.data
      } catch (error) {
        console.error('Failed to create transaction:', error)
        console.error('Error response:', error.response)
        throw error
      }
    },

    async createBulkTransactions(transactions) {
      try {
        // 添加调试日志
        console.log('发送批量交易请求:', JSON.stringify(transactions, null, 2))
        
        const response = await api.post('/transactions/bulk', transactions)
        await this.loadProducts()
        await this.loadStats()
        await this.loadRecentTransactions()
        return response.data
      } catch (error) {
        console.error('Failed to create bulk transactions:', error)
        // 添加更详细的错误信息
        if (error.response) {
          console.error('Error response:', error.response.data)
          console.error('Error status:', error.response.status)
        }
        throw error
      }
    },

    async createCategory(categoryData) {
      try {
        const response = await api.post('/categories', categoryData)
        this.categories.push(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to create category:', error)
        throw error
      }
    },

    async updateCategory(id, categoryData) {
      try {
        const response = await api.put(`/categories/${id}`, categoryData)
        const index = this.categories.findIndex(c => c.id === id)
        if (index !== -1) {
          this.categories[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Failed to update category:', error)
        throw error
      }
    },

    async deleteCategory(id) {
      try {
        await api.delete(`/categories/${id}`)
        this.categories = this.categories.filter(c => c.id !== id)
      } catch (error) {
        console.error('Failed to delete category:', error)
        throw error
      }
    },

    async createProject(projectData) {
      try {
        const response = await api.post('/projects', projectData)
        this.projects.push(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to create project:', error)
        throw error
      }
    },

    async updateProject(id, projectData) {
      try {
        const response = await api.put(`/projects/${id}`, projectData)
        const index = this.projects.findIndex(p => p.id === id)
        if (index !== -1) {
          this.projects[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Failed to update project:', error)
        throw error
      }
    },

    async deleteProject(id) {
      try {
        await api.delete(`/projects/${id}`)
        this.projects = this.projects.filter(p => p.id !== id)
      } catch (error) {
        console.error('Failed to delete project:', error)
        throw error
      }
    }
  }
})
