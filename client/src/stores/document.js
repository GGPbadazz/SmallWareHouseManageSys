/**
 * 单据状态管理 - Document Store
 * 
 * 管理单据的创建、编辑、提交等操作
 */

import { defineStore } from 'pinia'
import api from '@/services/api'

// 相机服务URL - 从环境变量获取
const CAMERA_SERVICE_URL = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'

export const useDocumentStore = defineStore('document', {
  state: () => ({
    // 当前编辑的单据
    currentDocument: null,
    
    // 是否处于编辑模式（新建单据时为true，提交后为false）
    isEditing: false,
    
    // 当前单据中的产品列表
    documentItems: [],
    
    // 单据图片信息
    documentImage: null,
    
    // OCR扫描状态
    isScanning: false,
    ocrResult: null,
    
    // OCR识别摘要（用于界面显示）
    ocrSummary: null,
    
    // 是否正在识别中（用于显示加载状态）
    isRecognizing: false,
    
    // 识别进度信息
    recognizingProgress: '',  // 进度文字
    recognizingPercent: 0,    // 进度百分比
    
    // 单据号重复警告
    documentNumberWarning: null,
    
    // 单据列表（历史记录）
    documents: [],
    documentsTotal: 0,
    documentsPage: 1,
    
    // 加载状态
    loading: false,
    error: null
  }),

  getters: {
    // 当前单据是否处于可编辑状态（使用 isEditing 状态）
    isDraft: (state) => {
      return state.isEditing
    },
    
    // 当前单据是否已提交
    isSubmitted: (state) => {
      return !state.isEditing && state.currentDocument?.id != null
    },
    
    // 当前单据类型是否为入库
    isInbound: (state) => {
      return state.currentDocument?.document_type === 'IN'
    },
    
    // 当前单据类型是否为出库
    isOutbound: (state) => {
      return state.currentDocument?.document_type === 'OUT'
    },
    
    // 当前单据产品总数量
    totalQuantity: (state) => {
      return state.documentItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
    },
    
    // 当前单据总金额
    totalValue: (state) => {
      return state.documentItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
    },
    
    // 当前单据产品数量
    itemCount: (state) => {
      return state.documentItems.length
    },
    
    // 是否可以提交单据
    canSubmit: (state) => {
      if (!state.currentDocument || !state.isEditing) {
        return false
      }
      if (state.documentItems.length === 0) {
        return false
      }
      // 出库单必须有领料人和用途
      if (state.currentDocument.document_type === 'OUT') {
        if (!state.currentDocument.requester_name || !state.currentDocument.purpose) {
          return false
        }
      }
      // 入库单每个产品必须有价格
      if (state.currentDocument.document_type === 'IN') {
        const hasInvalidPrice = state.documentItems.some(item => !item.total_price || item.total_price <= 0)
        if (hasInvalidPrice) {
          return false
        }
      }
      return true
    }
  },

  actions: {
    /**
     * 开始识别 - 创建临时单据并显示识别中状态
     */
    async startRecognizing() {
      this.isRecognizing = true
      this.recognizingProgress = '正在连接相机...'
      this.recognizingPercent = 10
      this.ocrSummary = null
      this.documentImage = null
      
      // 创建一个临时单据（纯前端，不调用API）
      const date = new Date()
      const year = String(date.getFullYear()).slice(-2)  // 取后两位：25
      const month = String(date.getMonth() + 1).padStart(2, '0')  // 12
      const yearMonth = `${year}${month}`  // 2512
      const prefix = 'C'  // 默认出库
      const randomNum = String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
      
      this.currentDocument = {
        document_number: `${prefix}${randomNum}-${yearMonth}`,
        document_type: 'OUT',
        project_name: '',
        recipient_name: '',
        document_date: date.toISOString().split('T')[0],
        notes: ''
      }
      this.documentItems = []
      this.isEditing = true
      console.log('创建临时单据用于识别:', this.currentDocument.document_number)
    },
    
    /**
     * 更新识别进度
     * @param {string} progress - 进度文字
     * @param {number} percent - 进度百分比
     */
    updateRecognizingProgress(progress, percent) {
      this.recognizingProgress = progress
      this.recognizingPercent = percent
    },

    /**
     * 设置预览图片（拍照后立即显示，OCR识别前）
     * @param {Object} photoResult - 相机服务返回的拍照结果
     */
    setPreviewImage(photoResult) {
      if (photoResult && photoResult.temp_file_id) {
        const previewUrl = photoResult.cropped_image_url || photoResult.image_url
        this.documentImage = {
          url: `${CAMERA_SERVICE_URL}${previewUrl}`,
          fullImageUrl: photoResult.image_url ? `${CAMERA_SERVICE_URL}${photoResult.image_url}` : null,
          temp_file_id: photoResult.temp_file_id,
          fromOcr: false
        }
        console.log('预览图片已设置:', this.documentImage)
      }
    },

    /**
     * 更新识别结果 - 识别完成后更新单据信息
     * @param {Object} ocrResult - OCR识别结果
     */
    async updateFromOcr(ocrResult) {
      console.log('🔄 开始更新OCR结果到store...')
      console.log('📦 OCR结果数据:', JSON.stringify(ocrResult, null, 2))
      
      this.isRecognizing = false
      this.recognizingProgress = ''
      this.recognizingPercent = 0
      
      if (!this.currentDocument) {
        console.error('❌ 没有当前单据可更新')
        return
      }
      
      console.log('📝 更新OCR结果:', {
        serial_number: ocrResult.serial_number,
        document_type: ocrResult.document_type,
        confidence: ocrResult.confidence,
        ocr_summary: ocrResult.ocr_summary
      })
      
      // 更新单据信息（纯前端更新）
      if (ocrResult.document_type) {
        this.currentDocument.document_type = ocrResult.document_type
      }
      
      // 提取7位数字单号并构造完整单据号
      let middleNumber = null
      if (ocrResult.serial_number) {
        console.log('✏️ OCR返回的单据号:', ocrResult.serial_number)
        
        // 从识别结果中提取7位数字 - 支持多种格式
        // 格式1: C1234567-2512 或 R1234567-2512
        let match = ocrResult.serial_number.match(/[CR](\d{7})/)
        if (match) {
          middleNumber = match[1]
          console.log('🔢 提取到7位数字(格式1):', middleNumber)
          // 如果已经是完整格式，直接使用
          this.currentDocument.document_number = ocrResult.serial_number
          this.currentDocument.original_number = ocrResult.serial_number
        } else {
          // 格式2: 直接7位数字（需要补充前缀和后缀）
          match = ocrResult.serial_number.match(/(\d{7})/)
          if (match) {
            middleNumber = match[1]
            console.log('🔢 提取到7位数字(格式2):', middleNumber)
            
            // 构造完整单据号
            const date = new Date()
            const year = String(date.getFullYear()).slice(-2)
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const yearMonth = `${year}${month}`
            const prefix = this.currentDocument.document_type === 'IN' ? 'R' : 'C'
            const fullNumber = `${prefix}${middleNumber}-${yearMonth}`
            
            console.log('🔨 构造完整单据号:', fullNumber)
            this.currentDocument.document_number = fullNumber
            this.currentDocument.original_number = ocrResult.serial_number
          }
        }
      }
      
      if (ocrResult.confidence) {
        this.currentDocument.ocr_confidence = ocrResult.confidence
        console.log('📊 识别置信度:', ocrResult.confidence)
      }
      
      // 打印完整的OCR结果用于调试
      console.log('🔍 完整OCR结果:', JSON.stringify(ocrResult, null, 2))
      
      // 保存OCR识别摘要
      if (ocrResult.ocr_summary) {
        // 检查ocr_summary是字符串还是对象
        if (typeof ocrResult.ocr_summary === 'string') {
          // 相机服务返回的是字符串，需要转换为对象格式
          const serialRaw = ocrResult.serial_number ? 
            (ocrResult.serial_number.split('-')[0] || ocrResult.serial_number) : ''
          const confidencePercent = ocrResult.confidence ? 
            Math.round(ocrResult.confidence * 100) : 0
          
          this.ocrSummary = {
            doc_type_text: ocrResult.document_type === 'IN' ? '入库单' : '出库单',
            serial_raw: serialRaw,
            confidence_percent: confidencePercent,
            detected_keywords: this.extractKeywordsFromString(ocrResult.ocr_summary, ocrResult.document_type),
            recognition_tips: this.generateRecognitionTips(ocrResult.confidence)
          }
          console.log('📄 OCR摘要(从字符串转换):', JSON.stringify(this.ocrSummary, null, 2))
        } else {
          // 服务器端OCR返回的是对象格式
          this.ocrSummary = ocrResult.ocr_summary
          console.log('📄 OCR摘要(对象格式):', JSON.stringify(ocrResult.ocr_summary, null, 2))
        }
        console.log('📄 ocrSummary state:', this.ocrSummary)
      } else {
        console.warn('⚠️ OCR结果中没有ocr_summary字段')
        console.warn('⚠️ ocrResult keys:', Object.keys(ocrResult))
      }
      
      // 设置图片（优先使用裁剪后的预览图）
      const previewUrl = ocrResult.cropped_image_url || ocrResult.image_url
      if (previewUrl) {
        this.documentImage = {
          url: `${CAMERA_SERVICE_URL}${previewUrl}`,
          fullImageUrl: ocrResult.image_url ? `${CAMERA_SERVICE_URL}${ocrResult.image_url}` : null,
          temp_file_id: ocrResult.temp_file_id,
          fromOcr: true
        }
      }
      
      // 检查当月是否有相同的7位单号
      if (middleNumber) {
        try {
          const docType = this.currentDocument.document_type || 'OUT'
          const checkResult = await api.get(`/documents/check-monthly/${middleNumber}?type=${docType}`)
          if (checkResult.data.exists) {
            this.documentNumberWarning = checkResult.data.message + '，请确认或修改单号'
          } else {
            this.documentNumberWarning = null
          }
        } catch (error) {
          console.warn('检查当月单据号失败:', error)
          this.documentNumberWarning = null
        }
      }
      
      console.log('✅ OCR识别结果已更新完成')
      console.log('📋 最终单据信息:', {
        document_number: this.currentDocument.document_number,
        document_type: this.currentDocument.document_type,
        ocr_summary: this.ocrSummary
      })
    },

    /**
     * 结束识别状态（识别失败时调用）
     * @param {boolean} success - 是否识别成功
     */
    finishRecognizing(success = false) {
      this.isRecognizing = false
      this.recognizingProgress = ''
      this.recognizingPercent = 0
      if (!success) {
        this.ocrSummary = null
      }
    },

    /**
     * 结束识别状态但保留图片（识别失败但拍照成功时调用）
     * @param {Object} result - 相机服务返回的结果
     */
    finishRecognizingWithImage(result) {
      this.isRecognizing = false
      this.recognizingProgress = ''
      this.recognizingPercent = 0
      this.ocrSummary = null
      
      // 保留图片，允许用户重新识别（优先使用裁剪后的预览图）
      if (result && result.temp_file_id) {
        const previewUrl = result.cropped_image_url || result.image_url
        this.documentImage = {
          url: `${CAMERA_SERVICE_URL}${previewUrl}`,
          fullImageUrl: result.image_url ? `${CAMERA_SERVICE_URL}${result.image_url}` : null,
          temp_file_id: result.temp_file_id,
          fromOcr: false
        }
        console.log('识别失败但保留图片:', this.documentImage)
      }
    },

    /**
     * 重新拍照识别
     */
    async retakeAndRecognize() {
      this.isRecognizing = true
      this.ocrSummary = null
      
      try {
        const cameraServiceUrl = CAMERA_SERVICE_URL
        const response = await fetch(`${cameraServiceUrl}/camera/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backend_url: window.location.origin })
        })
        const result = await response.json()
        
        if (result.success && result.serial_number) {
          await this.updateFromOcr(result)
          return { success: true, result }
        } else {
          this.finishRecognizing(false)
          return { success: false, message: result.message || '识别失败' }
        }
      } catch (error) {
        console.error('重新识别失败:', error)
        this.finishRecognizing(false)
        return { success: false, message: '连接失败' }
      }
    },

    /**
     * 拍照并识别 - 用于手动模式下的拍照识别
     */
    async capturePhoto() {
      this.isRecognizing = true
      
      try {
        const cameraServiceUrl = CAMERA_SERVICE_URL
        const response = await fetch(`${cameraServiceUrl}/camera/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backend_url: window.location.origin })
        })
        const result = await response.json()
        
        if (result.success && result.serial_number) {
          await this.updateFromOcr(result)
          return { success: true, result }
        } else {
          // 识别失败但有图片（优先使用裁剪后的预览图）
          if (result.temp_file_id) {
            const previewUrl = result.cropped_image_url || result.image_url
            this.documentImage = {
              url: `${CAMERA_SERVICE_URL}${previewUrl}`,
              fullImageUrl: result.image_url ? `${CAMERA_SERVICE_URL}${result.image_url}` : null,
              temp_file_id: result.temp_file_id,
              fromOcr: false
            }
          }
          this.finishRecognizing(false)
          return { success: false, message: result.message || '识别失败' }
        }
      } catch (error) {
        console.error('拍照识别失败:', error)
        this.finishRecognizing(false)
        return { success: false, message: '连接失败' }
      }
    },

    /**
     * 仅拍照（不识别） - 用于重拍功能
     * 当图片不清晰但单号已识别时使用
     */
    async capturePhotoOnly() {
      try {
        const cameraServiceUrl = CAMERA_SERVICE_URL
        const response = await fetch(`${cameraServiceUrl}/camera/photo`, { method: 'POST' })
        const result = await response.json()
        
        if (result.success && result.temp_file_id) {
          const previewUrl = result.cropped_image_url || result.image_url
          this.documentImage = {
            url: `${CAMERA_SERVICE_URL}${previewUrl}`,
            fullImageUrl: result.image_url ? `${CAMERA_SERVICE_URL}${result.image_url}` : null,
            temp_file_id: result.temp_file_id,
            fromOcr: false
          }
          return { success: true, message: '拍照成功' }
        }
        return { success: false, message: result.message || '拍照失败' }
      } catch (error) {
        console.error('拍照失败:', error)
        return { success: false, message: '连接失败' }
      }
    },

    /**
     * 创建新单据
     * @param {Object} data - 单据数据
     * @param {string} data.document_type - 单据类型 'IN' 或 'OUT'
     * @param {string} data.original_number - OCR识别的原始单号
     * @param {string} data.requester_name - 领料人
     * @param {number} data.project_id - 领用部门ID
     * @param {string} data.purpose - 用途说明
     */
    async createDocument(data) {
      this.loading = true
      this.error = null
      
      try {
        const response = await api.post('/documents', data)
        this.currentDocument = response.data
        this.documentItems = []
        this.documentImage = null
        
        console.log('单据创建成功:', response.data.document_number)
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || '创建单据失败'
        console.error('创建单据失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 加载单据详情
     * @param {number} id - 单据ID
     */
    async loadDocument(id) {
      this.loading = true
      this.error = null
      
      try {
        const response = await api.get(`/documents/${id}`)
        this.currentDocument = response.data
        this.documentItems = response.data.transactions || []
        
        if (response.data.image_path) {
          this.documentImage = {
            path: response.data.image_path,
            filename: response.data.image_filename
          }
        }
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || '加载单据失败'
        console.error('加载单据失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 更新单据信息
     * @param {Object} data - 更新数据
     */
    async updateDocument(data) {
      if (!this.currentDocument) {
        throw new Error('没有当前单据')
      }
      
      try {
        const response = await api.put(`/documents/${this.currentDocument.id}`, data)
        this.currentDocument = { ...this.currentDocument, ...response.data }
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || '更新单据失败'
        console.error('更新单据失败:', error)
        throw error
      }
    },

    /**
     * 向单据添加产品
     * @param {Object} item - 产品数据
     * @param {number} item.product_id - 产品ID
     * @param {number} item.quantity - 数量
     * @param {number} item.unit_price - 单价
     * @param {number} item.total_price - 总价（入库时）
     * @param {Object} item.product - 产品信息（用于显示）
     */
    addItem(item) {
      if (!this.currentDocument) {
        throw new Error('请先创建或选择单据')
      }
      
      // 编辑模式：直接添加到前端数组
      if (this.isEditing) {
        // 生成临时ID
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        const newItem = {
          id: tempId,
          product_id: item.product_id,
          product_name: item.product?.name || item.product_name || '',
          barcode: item.product?.barcode || item.barcode || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total_price: item.total_price || 0,
          product: item.product
        }
        
        this.documentItems.push(newItem)
        console.log('添加产品到单据:', newItem)
        return newItem
      }
      
      // 非编辑模式：不应该到这里，抛出错误
      throw new Error('单据已提交，无法添加产品')
    },

    /**
     * 更新单据中的产品
     * @param {string|number} itemId - 产品项ID（临时ID或数据库ID）
     * @param {Object} data - 更新数据
     */
    updateItem(itemId, data) {
      if (!this.currentDocument) {
        throw new Error('没有当前单据')
      }
      
      // 编辑模式：直接更新前端数组
      if (this.isEditing) {
        const index = this.documentItems.findIndex(item => item.id === itemId)
        if (index !== -1) {
          this.documentItems[index] = {
            ...this.documentItems[index],
            ...data
          }
          console.log('更新产品:', this.documentItems[index])
          return this.documentItems[index]
        }
        throw new Error('未找到该产品')
      }
      
      throw new Error('单据已提交，无法更新产品')
    },

    /**
     * 从单据移除产品
     * @param {string|number} itemId - 产品项ID
     */
    removeItem(itemId) {
      if (!this.currentDocument) {
        throw new Error('没有当前单据')
      }
      
      // 编辑模式：直接从前端数组移除
      if (this.isEditing) {
        const index = this.documentItems.findIndex(item => item.id === itemId)
        if (index !== -1) {
          const removed = this.documentItems.splice(index, 1)
          console.log('移除产品:', removed[0])
          return true
        }
        throw new Error('未找到该产品')
      }
      
      throw new Error('单据已提交，无法移除产品')
    },

    /**
     * 刷新单据统计信息（编辑模式下不需要调用API）
     */
    async refreshDocumentStats() {
      if (!this.currentDocument) return
      
      try {
        const response = await api.get(`/documents/${this.currentDocument.id}`)
        this.currentDocument = {
          ...this.currentDocument,
          total_quantity: response.data.total_quantity,
          total_value: response.data.total_value,
          item_count: response.data.item_count
        }
      } catch (error) {
        console.error('刷新单据统计失败:', error)
      }
    },

    /**
     * 上传单据图片
     * @param {File} file - 图片文件
     */
    async uploadImage(file) {
      if (!this.currentDocument) {
        throw new Error('请先创建单据')
      }
      
      const formData = new FormData()
      formData.append('image', file)
      
      try {
        const response = await api.post(
          `/documents/${this.currentDocument.id}/image`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        
        this.documentImage = {
          path: response.data.image_path,
          filename: response.data.image_filename
        }
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || '上传图片失败'
        console.error('上传图片失败:', error)
        throw error
      }
    },

    /**
     * 提交单据 - 创建新单据并处理库存
     */
    async submitDocument() {
      if (!this.currentDocument) {
        throw new Error('没有当前单据')
      }
      
      if (this.documentItems.length === 0) {
        throw new Error('请至少添加一个产品')
      }
      
      this.loading = true
      this.error = null
      
      try {
        // 构建提交数据
        const submitData = {
          document_type: this.currentDocument.document_type,
          document_number: this.currentDocument.document_number,
          original_number: this.currentDocument.original_number || this.currentDocument.document_number,
          requester_name: this.currentDocument.requester_name || '',
          project_id: this.currentDocument.project_id || null,
          purpose: this.currentDocument.purpose || '',
          notes: this.currentDocument.notes || '',
          ocr_confidence: this.currentDocument.ocr_confidence || null,
          supplier: this.currentDocument.document_type === 'IN' ? (this.currentDocument.supplier || '') : null,  // 供应商（仅入库单）
          custom_created_at: this.currentDocument.custom_created_at || null,  // 自定义创建时间（延续上月单据）
          items: this.documentItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          }))
        }
        
        // 如果有图片，添加图片信息
        if (this.documentImage) {
          submitData.image_url = this.documentImage.url
          submitData.temp_file_id = this.documentImage.temp_file_id
        }
        
        // 调用API创建并提交单据
        const response = await api.post('/documents/submit', submitData)
        
        // 提交成功后更新状态
        this.currentDocument = response.data.document || {
          ...this.currentDocument,
          id: response.data.document_id,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        }
        
        // 结束编辑状态
        this.isEditing = false
        
        console.log('单据提交成功:', response.data)
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || '提交单据失败'
        console.error('提交单据失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 取消单据 - 清空当前编辑的单据
     */
    async cancelDocument() {
      // 直接清空，不需要调用API
      this.clearCurrentDocument()
    },

    /**
     * 删除单据
     */
    async deleteDocument() {
      if (!this.currentDocument) {
        throw new Error('没有当前单据')
      }
      
      try {
        await api.delete(`/documents/${this.currentDocument.id}`)
        this.clearCurrentDocument()
      } catch (error) {
        this.error = error.response?.data?.error || '删除单据失败'
        console.error('删除单据失败:', error)
        throw error
      }
    },

    /**
     * 加载单据列表
     * @param {Object} params - 查询参数
     */
    async loadDocuments(params = {}) {
      this.loading = true
      
      try {
        const response = await api.get('/documents', { params })
        this.documents = response.data.documents || []
        this.documentsTotal = response.data.total || 0
        this.documentsPage = response.data.page || 1
        
        return response.data
      } catch (error) {
        console.error('加载单据列表失败:', error)
        this.documents = []
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 调用OCR扫描（通过本地客户端）
     */
    async startOcrScan() {
      this.isScanning = true
      this.ocrResult = null
      this.error = null
      
      try {
        // 调用本地摄像头客户端
        const response = await fetch(`${CAMERA_SERVICE_URL}/camera/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backend_url: window.location.origin })
        })
        
        const result = await response.json()
        
        if (result.success) {
          this.ocrResult = {
            success: true,
            serial_number: result.serial_number,
            document_type: result.document_type || 'OUT',  // 直接使用服务器返回的类型
            confidence: result.confidence,
            temp_file_id: result.temp_file_id,
            image_url: result.image_url,  // 图片预览URL
            local_archive_path: result.local_archive_path
          }
          
          console.log('OCR识别结果:', this.ocrResult)
          return this.ocrResult
        } else {
          // OCR失败，返回允许手动输入的信息
          this.ocrResult = {
            success: false,
            error: result.error,
            message: result.message,
            allow_manual_input: result.allow_manual_input,
            temp_file_id: result.temp_file_id,
            image_url: result.image_url  // 即使失败也可能有图片
          }
          
          return this.ocrResult
        }
      } catch (error) {
        this.error = 'OCR服务连接失败，请确保摄像头客户端已启动'
        console.error('OCR扫描失败:', error)
        throw error
      } finally {
        this.isScanning = false
      }
    },

    /**
     * 检测单据类型（备用方法，如果服务器没有返回类型）
     * @param {Object} ocrResult - OCR结果
     */
    detectDocumentType(ocrResult) {
      // 如果OCR结果中已包含类型
      if (ocrResult.document_type) {
        return ocrResult.document_type
      }
      
      // 根据单号前缀判断
      const serial = ocrResult.serial_number || ''
      if (serial.startsWith('R')) {
        return 'IN'
      } else if (serial.startsWith('C')) {
        return 'OUT'
      }
      
      // 默认为出库
      return 'OUT'
    },

    /**
     * 从OCR结果创建单据
     * @param {Object} ocrResult - OCR识别结果
     */
    async createFromOcr(ocrResult) {
      const documentData = {
        document_type: ocrResult.document_type || 'OUT',
        original_number: ocrResult.serial_number,
        ocr_confidence: ocrResult.confidence,
        ocr_raw_text: JSON.stringify(ocrResult.recognized_texts || [])
      }
      
      const document = await this.createDocument(documentData)
      
      // 设置图片预览（来自摄像头客户端）
      if (ocrResult.image_url) {
        this.documentImage = {
          url: `${CAMERA_SERVICE_URL}${ocrResult.image_url}`,
          temp_file_id: ocrResult.temp_file_id,
          fromOcr: true
        }
        console.log('设置OCR图片:', this.documentImage)
      }
      
      // 保存OCR识别摘要供界面显示
      if (ocrResult.ocr_summary) {
        this.ocrSummary = ocrResult.ocr_summary
        console.log('设置OCR摘要:', this.ocrSummary)
      } else {
        this.ocrSummary = null
      }
      
      return document
    },

    /**
     * 初始化新单据（手动模式）
     */
    initNewDocument(documentType = 'OUT') {
      // 生成临时流水号，格式：C1234567-2512
      const date = new Date()
      const year = String(date.getFullYear()).slice(-2)  // 取后两位：25
      const month = String(date.getMonth() + 1).padStart(2, '0')  // 12
      const yearMonth = `${year}${month}`  // 2512
      const prefix = documentType === 'IN' ? 'R' : 'C'
      const randomNum = String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
      
      this.currentDocument = {
        document_number: `${prefix}${randomNum}-${yearMonth}`,
        document_type: documentType,
        project_name: '',
        recipient_name: '',
        document_date: date.toISOString().split('T')[0],
        notes: ''
      }
      this.documentItems = []
      this.documentImage = null
      this.ocrResult = null
      this.ocrSummary = null
      this.error = null
      this.isRecognizing = false
      this.isEditing = true  // 新建单据时设为编辑状态
    },

    /**
     * 清空当前单据
     */
    clearCurrentDocument() {
      this.currentDocument = null
      this.documentItems = []
      this.documentImage = null
      this.ocrResult = null
      this.ocrSummary = null
      this.documentNumberWarning = null
      this.error = null
      this.isEditing = false
    },

    /**
     * 清除单据号警告
     */
    clearDocumentNumberWarning() {
      this.documentNumberWarning = null
    },

    /**
     * 检查单据号是否存在
     */
    async checkDocumentNumber(documentNumber) {
      try {
        const result = await api.get(`/documents/check/${encodeURIComponent(documentNumber)}`)
        if (result.data.exists) {
          this.documentNumberWarning = result.data.message + '，请修改单据号码后再提交'
          return true
        } else {
          this.documentNumberWarning = null
          return false
        }
      } catch (error) {
        console.warn('检查单据号失败:', error)
        this.documentNumberWarning = null
        return false
      }
    },

    /**
     * 从OCR摘要字符串中提取关键词
     */
    extractKeywordsFromString(summaryString, documentType) {
      const keywords = []
      const outKeywords = ['出库', '领料', '领用', '发料', '发货', '销售']
      const inKeywords = ['入库', '进货', '采购', '收货', '进料', '到货']
      
      const keywordList = documentType === 'OUT' ? outKeywords : inKeywords
      
      for (const keyword of keywordList) {
        if (summaryString.includes(keyword) && !keywords.includes(keyword)) {
          keywords.push(keyword)
        }
      }
      
      return keywords
    },
    
    /**
     * 根据置信度生成识别提示
     */
    generateRecognitionTips(confidence) {
      if (!confidence) return ['请核对单号']
      
      if (confidence >= 0.9) {
        return ['✅ 识别准确度很高']
      } else if (confidence >= 0.7) {
        return ['⚠️ 识别准确度一般，请核对单号']
      } else {
        return ['❌ 识别准确度较低，建议重新拍照或手动输入']
      }
    },

    /**
     * 重置所有状态
     */
    reset() {
      this.currentDocument = null
      this.documentItems = []
      this.documentImage = null
      this.isScanning = false
      this.ocrResult = null
      this.ocrSummary = null
      this.documentNumberWarning = null
      this.documents = []
      this.documentsTotal = 0
      this.documentsPage = 1
      this.loading = false
      this.error = null
      this.isEditing = false
    }
  }
})
