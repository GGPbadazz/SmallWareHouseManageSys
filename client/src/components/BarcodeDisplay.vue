<template>
  <div class="barcode-display" v-if="show">
    <div class="barcode-overlay" @click="close">
      <div class="barcode-modal" @click.stop>
        <div class="barcode-header">
          <h3>产品条码信息</h3>
          <button class="close-btn" @click="close">&times;</button>
        </div>
        
        <div class="barcode-content" v-if="product">
          <div class="product-info">
            <h4>{{ product.name }}</h4>
            <p>{{ product.description || '暂无描述' }}</p>
          </div>
          
          <div class="barcode-section">
            <div class="barcode-item">
              <h5>条码数字</h5>
              <div class="barcode-text">{{ product.barcode }}</div>
              <button class="btn btn-outline btn-sm" @click="copyBarcode">复制条码</button>
            </div>
            
            <div class="barcode-item">
              <h5>条码图像</h5>
              <div class="barcode-image-container">
                <img v-if="barcodeData.barcode" :src="barcodeData.barcode" alt="Barcode" class="barcode-image">
                <div v-else class="barcode-loading">生成中...</div>
              </div>
              <button class="btn btn-outline btn-sm" @click="downloadBarcode">下载条码</button>
            </div>
            
            <div class="barcode-item">
              <h5>二维码</h5>
              <div class="qrcode-container">
                <img v-if="barcodeData.qrCode" :src="barcodeData.qrCode" alt="QR Code" class="qrcode-image">
                <div v-else class="qrcode-loading">生成中...</div>
              </div>
              <button class="btn btn-outline btn-sm" @click="downloadQRCode">下载二维码</button>
            </div>
          </div>
          
          <div class="barcode-actions">
            <button class="btn btn-primary" @click="printBarcode">打印条码</button>
            <button class="btn btn-secondary" @click="close">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { generateBarcodeData } from '@/utils/barcode'

export default {
  name: 'BarcodeDisplay',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    product: {
      type: Object,
      required: false,
      default: null
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const barcodeData = ref({
      barcode: null,
      qrCode: null,
      text: ''
    })
    
    const generateBarcodes = async () => {
      if (!props.product || !props.product.barcode) return
      
      try {
        // 优先使用已存储的条码图片
        if (props.product.barcode_image && props.product.qr_code_image) {
          barcodeData.value = {
            barcode: props.product.barcode_image,
            qrCode: props.product.qr_code_image,
            text: props.product.barcode
          }
        } else {
          // 如果没有存储的图片，则实时生成
          const data = await generateBarcodeData(props.product.barcode, props.product.name)
          barcodeData.value = data
        }
      } catch (error) {
        console.error('Failed to generate barcode:', error)
      }
    }
    
    const copyBarcode = () => {
      if (!props.product || !props.product.barcode) return
      navigator.clipboard.writeText(props.product.barcode)
      showMessage('条码已复制到剪贴板', 'success')
    }
    
    const downloadBarcode = () => {
      if (!barcodeData.value.barcode || !props.product) return
      
      const link = document.createElement('a')
      link.href = barcodeData.value.barcode
      link.download = `barcode-${props.product.barcode}.png`
      link.click()
    }
    
    const downloadQRCode = () => {
      if (!barcodeData.value.qrCode || !props.product) return
      
      const link = document.createElement('a')
      link.href = barcodeData.value.qrCode
      link.download = `qrcode-${props.product.barcode}.png`
      link.click()
    }
    
    const printBarcode = () => {
      if (!barcodeData.value.barcode || !props.product) return
      
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <html>
          <head>
            <title>打印条码 - ${props.product.name}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
              .product-name { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
              .barcode-image { max-width: 100%; height: auto; margin: 10px 0; }
              .barcode-text { font-family: monospace; font-size: 14px; margin-top: 5px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="product-name">${props.product.name}</div>
            <img src="${barcodeData.value.barcode}" alt="Barcode" class="barcode-image">
            <div class="barcode-text">${props.product.barcode}</div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
    
    const close = () => {
      emit('close')
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
        background: ${type === 'success' ? '#38a169' : '#3182ce'};
        animation: slideIn 0.3s ease;
      `
      
      document.body.appendChild(messageEl)
      setTimeout(() => messageEl.remove(), 3000)
    }
    
    watch(() => props.show, (newVal) => {
      if (newVal && props.product) {
        generateBarcodes()
      }
    })
    
    onMounted(() => {
      if (props.show && props.product) {
        generateBarcodes()
      }
    })
    
    return {
      barcodeData,
      copyBarcode,
      downloadBarcode,
      downloadQRCode,
      printBarcode,
      close
    }
  }
}
</script>

<style scoped>
.barcode-display {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.barcode-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.barcode-modal {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.barcode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.barcode-header h3 {
  margin: 0;
  color: #2d3748;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #4a5568;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.barcode-content {
  padding: 20px;
}

.product-info {
  margin-bottom: 20px;
  text-align: center;
}

.product-info h4 {
  margin: 0 0 8px 0;
  color: #2d3748;
}

.product-info p {
  margin: 0;
  color: #4a5568;
  font-size: 14px;
}

.barcode-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .barcode-section {
    grid-template-columns: repeat(3, 1fr);
  }
}

.barcode-item {
  text-align: center;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f7fafc;
}

.barcode-item h5 {
  margin: 0 0 12px 0;
  color: #2d3748;
  font-size: 14px;
}

.barcode-text {
  font-family: monospace;
  font-size: 16px;
  font-weight: bold;
  color: #2d3748;
  background: white;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  margin-bottom: 12px;
}

.barcode-image-container, .qrcode-container {
  margin-bottom: 12px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.barcode-image {
  max-width: 100%;
  height: auto;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.qrcode-image {
  max-width: 120px;
  height: auto;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.barcode-loading, .qrcode-loading {
  color: #4a5568;
  font-style: italic;
}

.barcode-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
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

.btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
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
</style>
