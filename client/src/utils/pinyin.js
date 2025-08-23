import { pinyin } from 'pinyin'

export const pinyinUtils = {
  // 转换为全拼
  toFullPinyin(text) {
    if (!text) return ''
    return pinyin(text, {
      style: 'normal',
      tone: false
    }).flat().join('').toLowerCase()
  },
  
  // 转换为首字母
  toFirstLetters(text) {
    if (!text) return ''
    return pinyin(text, {
      style: 'normal',
      tone: false
    }).flat().map(p => p[0]).join('').toLowerCase()
  },
  
  // 检查是否匹配
  isMatch(text, query) {
    if (!text || !query) return false
    
    const lowerQuery = query.toLowerCase()
    const fullPinyin = this.toFullPinyin(text)
    const firstLetters = this.toFirstLetters(text)
    
    // 支持多种匹配方式
    return fullPinyin.includes(lowerQuery) || 
           firstLetters.includes(lowerQuery) ||
           fullPinyin.startsWith(lowerQuery) ||
           firstLetters.startsWith(lowerQuery)
  },
  
  // 获取匹配得分（用于排序）
  getMatchScore(text, query) {
    if (!text || !query) return 0
    
    const lowerQuery = query.toLowerCase()
    const fullPinyin = this.toFullPinyin(text)
    const firstLetters = this.toFirstLetters(text)
    
    // 完全匹配得分最高
    if (fullPinyin === lowerQuery || firstLetters === lowerQuery) return 100
    
    // 开头匹配得分较高
    if (fullPinyin.startsWith(lowerQuery)) return 80
    if (firstLetters.startsWith(lowerQuery)) return 75
    
    // 包含匹配得分中等
    if (fullPinyin.includes(lowerQuery)) return 50
    if (firstLetters.includes(lowerQuery)) return 45
    
    return 0
  }
}
