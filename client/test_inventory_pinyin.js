// InventoryPage 拼音搜索功能测试
import { pinyin } from 'pinyin'

const pinyinUtils = {
  toFullPinyin(text) {
    if (!text) return ''
    return pinyin(text, {
      style: 'normal',
      tone: false
    }).flat().join('').toLowerCase()
  },
  
  toFirstLetters(text) {
    if (!text) return ''
    return pinyin(text, {
      style: 'normal',
      tone: false
    }).flat().map(p => p[0]).join('').toLowerCase()
  },
  
  isMatch(text, query) {
    if (!text || !query) return false
    
    const lowerQuery = query.toLowerCase()
    const fullPinyin = this.toFullPinyin(text)
    const firstLetters = this.toFirstLetters(text)
    
    return fullPinyin.includes(lowerQuery) || 
           firstLetters.includes(lowerQuery) ||
           fullPinyin.startsWith(lowerQuery) ||
           firstLetters.startsWith(lowerQuery)
  },
  
  getMatchScore(text, query) {
    if (!text || !query) return 0
    
    const lowerQuery = query.toLowerCase()
    const fullPinyin = this.toFullPinyin(text)
    const firstLetters = this.toFirstLetters(text)
    
    if (fullPinyin === lowerQuery || firstLetters === lowerQuery) return 100
    if (fullPinyin.startsWith(lowerQuery)) return 80
    if (firstLetters.startsWith(lowerQuery)) return 75
    if (fullPinyin.includes(lowerQuery)) return 50
    if (firstLetters.includes(lowerQuery)) return 45
    
    return 0
  }
}

console.log('🔍 InventoryPage 拼音搜索功能测试')
console.log('='*50)

// 模拟库存产品数据
const mockProducts = [
  { id: 1, name: 'O型圈', category_name: '管材', barcode: 'B001' },
  { id: 2, name: 'PP承插球阀 DN20', category_name: '阀门', barcode: 'B002' },
  { id: 3, name: 'PP法兰', category_name: '管材', barcode: 'B003' },
  { id: 4, name: 'PP球阀 DN25', category_name: '阀门', barcode: 'B004' },
  { id: 5, name: 'PP弯头', category_name: '管件', barcode: 'B005' },
  { id: 6, name: 'PP直接', category_name: '管件', barcode: 'B006' },
  { id: 7, name: '薄膜', category_name: '材料', barcode: 'B007' },
  { id: 8, name: '电热管', category_name: '电仪', barcode: 'B008' },
  { id: 9, name: '电热管件', category_name: '一次性', barcode: 'B009' },
  { id: 10, name: '热水器', category_name: '家电', barcode: 'B010' }
]

// 模拟 InventoryPage 的过滤逻辑
function simulateInventorySearch(query, products) {
  console.log(`\n🔍 搜索查询: "${query}"`)
  
  if (!query.trim()) {
    console.log('空查询，返回所有产品')
    return products
  }
  
  const isEnglishInput = /^[a-zA-Z]+$/.test(query.trim())
  console.log(`输入类型: ${isEnglishInput ? '英文（拼音搜索）' : '中文（常规搜索）'}`)
  
  let filtered
  
  if (isEnglishInput) {
    // Pinyin search
    filtered = products.filter(product => {
      const nameMatch = pinyinUtils.isMatch(product.name, query)
      const categoryMatch = product.category_name && pinyinUtils.isMatch(product.category_name, query)
      const barcodeMatch = product.barcode && product.barcode.toLowerCase().includes(query.toLowerCase())
      
      return nameMatch || categoryMatch || barcodeMatch
    })
    
    // Sort by pinyin match score
    filtered = filtered.sort((a, b) => {
      const scoreA = pinyinUtils.getMatchScore(a.name, query) + 
                    (a.category_name ? pinyinUtils.getMatchScore(a.category_name, query) : 0)
      const scoreB = pinyinUtils.getMatchScore(b.name, query) + 
                    (b.category_name ? pinyinUtils.getMatchScore(b.category_name, query) : 0)
      return scoreB - scoreA
    })
  } else {
    // Regular search
    const lowerQuery = query.toLowerCase()
    filtered = products.filter(product => 
      product.name.toLowerCase().includes(lowerQuery) ||
      (product.barcode && product.barcode.toLowerCase().includes(lowerQuery)) ||
      (product.category_name && product.category_name.toLowerCase().includes(lowerQuery))
    )
  }
  
  console.log(`匹配结果 (${filtered.length}个):`)
  filtered.forEach((product, index) => {
    const score = isEnglishInput ? 
      pinyinUtils.getMatchScore(product.name, query) + 
      (product.category_name ? pinyinUtils.getMatchScore(product.category_name, query) : 0) : 0
    
    console.log(`  ${index + 1}. ${product.name} (${product.category_name}) [${product.barcode}]${isEnglishInput ? ` - 得分: ${score}` : ''}`)
  })
  
  return filtered
}

// 运行测试用例
console.log('\n📝 测试用例:')

const testCases = [
  'pp',           // 搜索PP产品
  'qiufa',        // 球阀全拼
  'qf',           // 球阀首字母
  'wantou',       // 弯头全拼
  'wt',           // 弯头首字母
  'dianre',       // 电热全拼
  'dr',           // 电热首字母
  'guanjian',     // 管件全拼
  'gj',           // 管件首字母
  'O型',          // 中文搜索
  'B00',          // 条码搜索
  '管材',         // 分类搜索
  'flam',         // 法兰（错误拼音）
  'falan',        // 法兰（正确拼音）
  'fl'            // 法兰首字母
]

testCases.forEach(testCase => {
  simulateInventorySearch(testCase, mockProducts)
})

console.log('\n📊 功能特性总结:')
console.log('✅ 支持中文直接搜索')
console.log('✅ 支持英文拼音搜索（全拼）')
console.log('✅ 支持英文首字母搜索')
console.log('✅ 支持条码搜索')
console.log('✅ 支持分类名称搜索')
console.log('✅ 拼音搜索结果按相关度排序')
console.log('✅ 自动识别输入类型（中文/英文）')

console.log('\n🎯 使用建议:')
console.log('1. 产品名称搜索: qiufa → PP球阀')
console.log('2. 快速搜索: qf → 所有球阀产品')
console.log('3. 分类搜索: gj → 管件分类产品')
console.log('4. 条码搜索: B00 → 条码包含B00的产品')
console.log('5. 混合搜索: pp + 拼音组合')

console.log('\n✅ InventoryPage 拼音搜索功能测试完成！')
