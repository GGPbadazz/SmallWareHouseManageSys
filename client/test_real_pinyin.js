// 使用真实拼音库测试
import { pinyin } from 'pinyin'

// 拼音工具函数
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

console.log('🧪 真实拼音库测试...')

// 测试产品
const products = [
  { id: 1, name: '电热管', category_name: '电仪' },
  { id: 2, name: '电热管件', category_name: '一次性' },
  { id: 3, name: '普通管子', category_name: '管材' },
  { id: 4, name: '热水器', category_name: '家电' }
]

// 显示拼音转换结果
console.log('\n📝 拼音转换测试:')
products.forEach(product => {
  const fullPinyin = pinyinUtils.toFullPinyin(product.name)
  const firstLetters = pinyinUtils.toFirstLetters(product.name)
  console.log(`${product.name} -> 全拼: ${fullPinyin}, 首字母: ${firstLetters}`)
})

// 测试搜索
console.log('\n🔍 搜索测试:')
const testQueries = ['dianre', 'drg', 'drgj', 'dianreguan', 'dianreguanjian', 'guan', 'dr']

testQueries.forEach(query => {
  console.log(`\n搜索: "${query}"`)
  const matches = products.filter(product => {
    const nameMatch = pinyinUtils.isMatch(product.name, query)
    const categoryMatch = pinyinUtils.isMatch(product.category_name, query)
    return nameMatch || categoryMatch
  }).sort((a, b) => {
    const scoreA = pinyinUtils.getMatchScore(a.name, query) + pinyinUtils.getMatchScore(a.category_name, query)
    const scoreB = pinyinUtils.getMatchScore(b.name, query) + pinyinUtils.getMatchScore(b.category_name, query)
    return scoreB - scoreA
  })
  
  if (matches.length > 0) {
    matches.forEach(product => {
      const score = pinyinUtils.getMatchScore(product.name, query) + pinyinUtils.getMatchScore(product.category_name, query)
      console.log(`  ✅ ${product.name} (分数: ${score})`)
    })
  } else {
    console.log('  ❌ 无匹配结果')
  }
})

console.log('\n✅ 测试完成！')
