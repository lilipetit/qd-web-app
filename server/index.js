import express from 'express'
import cors from 'cors'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Load Excel data into memory
let scoreData = []
let enrollData = []

function loadData() {
  // Load 录取分数
  const scoreFile = path.join(__dirname, '..', '体育类录取分数.xlsx')
  const scoreWb = XLSX.readFile(scoreFile)
  scoreData = XLSX.utils.sheet_to_json(scoreWb.Sheets[scoreWb.SheetNames[0]])
  console.log(`✅ 录取分数数据加载成功: ${scoreData.length} 条`)

  // Load 招生数据
  const enrollFile = path.join(__dirname, '..', '体育类招生数据.xlsx')
  const enrollWb = XLSX.readFile(enrollFile)
  enrollData = XLSX.utils.sheet_to_json(enrollWb.Sheets[enrollWb.SheetNames[0]])
  console.log(`✅ 招生数据加载成功: ${enrollData.length} 条`)
}

// Query API
app.get('/api/query', (req, res) => {
  try {
    const { table, field, min, max, ...filters } = req.query

    if (table === 'score') {
      let results = [...scoreData]

      // Text filters (fuzzy match)
      const textFields = ['院校代码', '院校名称', '专业名称']
      for (const f of textFields) {
        if (filters[f]) {
          results = results.filter(row => {
            const val = String(row[f] || '')
            return val.includes(filters[f])
          })
        }
      }

      // Select filters
      if (filters['层次']) {
        results = results.filter(row => row['层次'] === filters['层次'])
      }
      if (filters['学校类型']) {
        results = results.filter(row => row['学校类型'] === filters['学校类型'])
      }

      // Range query for scores
      if (field && (min || max)) {
        results = results.filter(row => {
          const val = parseFloat(row[field])
          if (isNaN(val)) return false
          if (min && val < parseFloat(min)) return false
          if (max && val > parseFloat(max)) return false
          return true
        })
      }

      // Sort by 最低分 descending
      results.sort((a, b) => (parseFloat(b['最低分']) || 0) - (parseFloat(a['最低分']) || 0))

      const columns = ['院校代码', '层次', '院校名称', '学校类型', '专业名称', '录取数', '最高分', '最低分', '备注']
      res.json({ columns, rows: results, total: results.length })
    } else if (table === 'enroll') {
      let results = [...enrollData]

      const textFields = ['学校代码', '学校名称', '专业名字', '专业组号']
      for (const f of textFields) {
        if (filters[f]) {
          results = results.filter(row => {
            const val = String(row[f] || '')
            return val.includes(filters[f])
          })
        }
      }

      const columns = ['学校代码', '学校名称', '学校地址', '专业组号', '专业名字', '学费', '备注']
      res.json({ columns, rows: results, total: results.length })
    } else {
      res.status(400).json({ error: '未知的数据表' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '查询失败' })
  }
})

// Chat API - AI Assistant
app.post('/api/chat', (req, res) => {
  const { message } = req.body

  try {
    const reply = generateReply(message)
    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.json({ reply: '抱歉，处理您的问题时出现了错误，请稍后重试。' })
  }
})

// AI reply generator based on keywords and data
function generateReply(msg) {
  const lowerMsg = msg.toLowerCase()

  // Query database for relevant info
  if (lowerMsg.includes('院校') || lowerMsg.includes('学校') || lowerMsg.includes('大学')) {
    if (lowerMsg.includes('哪些') || lowerMsg.includes('可以报') || lowerMsg.includes('有哪些')) {
      const schoolNames = [...new Set(scoreData.map(s => s['院校名称']).filter(Boolean))]
      let reply = '根据数据，体育特长生可以报考以下院校：\n\n'
      schoolNames.slice(0, 25).forEach((name, i) => {
        const levels = [...new Set(scoreData.filter(s => s['院校名称'] === name).map(s => s['层次']))]
        reply += `${i + 1}. ${name}（${levels.join('/')}）\n`
      })
      if (schoolNames.length > 25) {
        reply += `...等共 ${schoolNames.length} 所院校\n`
      }
      reply += '\n如需查询具体院校的录取分数，请使用"数据查询"功能进行区间查询。'
      return reply
    }

    if (lowerMsg.includes('分数') || lowerMsg.includes('录取') || lowerMsg.includes('多少分')) {
      // Try to extract school name
      const patterns = [/(.+?)(?:大学|学院|学校)/]
      let foundSchool = null
      for (const pattern of patterns) {
        const match = msg.match(pattern)
        if (match) {
          foundSchool = match[0]
          break
        }
      }

      if (foundSchool) {
        const records = scoreData.filter(r => String(r['院校名称'] || '').includes(foundSchool))
        if (records.length > 0) {
          let reply = `${foundSchool} 的录取数据如下：\n\n`
          records.forEach((r, i) => {
            reply += `${i + 1}. 专业：${r['专业名称']}\n`
            reply += `   层次：${r['层次']} | 录取数：${r['录取数']}人\n`
            reply += `   最高分：${r['最高分']} | 最低分：${r['最低分']}\n`
            if (r['备注']) reply += `   备注：${r['备注']}\n`
            reply += '\n'
          })
          return reply
        } else {
          return `抱歉，未找到"${foundSchool}"的录取数据。请确认院校名称是否正确，或使用"数据查询"功能进行精确查询。`
        }
      }

      const scores = scoreData.map(r => parseFloat(r['最低分'])).filter(v => !isNaN(v))
      const minScore = Math.min(...scores)
      const maxScore = Math.max(...scores)
      const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      return `根据历年录取数据，体育类录取分数概况：\n\n• 最低分范围：${minScore} ~ ${maxScore}\n• 平均最低分：${avgScore}\n• 共收录 ${scoreData.length} 条录取记录\n\n建议使用"数据查询"功能，通过分数区间查询来筛选适合您的院校。`
    }
  }

  if (lowerMsg.includes('综合成绩') || lowerMsg.includes('怎么算') || lowerMsg.includes('计算')) {
    return `体育类综合成绩计算方式（以云南省为例）：\n\n综合成绩 = 文化成绩 ÷ 高考文化满分 × 30 + 专业成绩 ÷ 专业统考满分 × 70\n\n说明：\n• 文化成绩占30%权重\n• 体育专业统考成绩占70%权重\n• 不同院校可能有不同的计算方式，具体以各院校招生简章为准\n\n注意：部分院校（如云南大学足球项目）的公式为：\n综合成绩 = 文化成绩÷文化满分×30 + 足球专项成绩×2.5÷专业统考满分×70\n\n建议在填报志愿前仔细查看目标院校的招生章程。`
  }

  if (lowerMsg.includes('志愿') || lowerMsg.includes('填报') || lowerMsg.includes('技巧') || lowerMsg.includes('策略')) {
    return `体育特长生志愿填报技巧：\n\n1.【了解规则】\n   - 熟悉平行志愿投档规则\n   - 了解综合成绩计算方式\n   - 确认文化分和体育分双上线要求\n\n2.【合理定位】\n   - 根据自己的综合成绩排名选择院校\n   - 参考历年录取最低分进行区间筛选\n   - 本系统提供分数区间查询功能，可帮您快速定位\n\n3.【梯度填报】\n   - 冲一冲：选择分数略高于自己成绩的院校\n   - 稳一稳：选择与自己成绩相当的院校\n   - 保一保：选择录取分数低于自己成绩的院校\n\n4.【注意事项】\n   - 关注院校的专项要求（如足球、田径等）\n   - 注意公费师范生的定向任教要求\n   - 查看学费和办学地点等信息\n\n5.【善用工具】\n   - 使用本系统的"数据查询"功能按分数区间筛选\n   - 通过智能问答了解具体院校信息`
  }

  if (lowerMsg.includes('公费师范') || lowerMsg.includes('师范') || lowerMsg.includes('定向')) {
    const records = scoreData.filter(r =>
      (String(r['备注'] || '').includes('定向') || String(r['专业名称'] || '').includes('师范'))
    )
    let reply = '关于公费师范生/定向招生：\n\n'
    if (records.length > 0) {
      reply += '根据数据，以下院校有公费师范生/定向招生：\n\n'
      records.slice(0, 10).forEach((r, i) => {
        reply += `${i + 1}. ${r['院校名称']} - ${r['专业名称']}\n`
        reply += `   录取数：${r['录取数']}人 | 最低分：${r['最低分']}\n`
        if (r['备注']) reply += `   备注：${r['备注']}\n`
        reply += '\n'
      })
      if (records.length > 10) {
        reply += `...共 ${records.length} 条相关记录\n\n`
      }
    }
    reply += '公费师范生注意事项：\n• 入学前需签订定向就业协议\n• 毕业后须到指定地区从事教育工作\n• 在校期间享受免除学费、住宿费等待遇\n• 请仔细考虑定向任教地区是否符合个人发展意愿'
    return reply
  }

  if (lowerMsg.includes('专业') && (lowerMsg.includes('哪些') || lowerMsg.includes('有什么') || lowerMsg.includes('列表'))) {
    const majors = [...new Set(scoreData.map(r => r['专业名称']).filter(Boolean))]
    let reply = '体育特长生可报考的专业主要包括：\n\n'
    majors.forEach((m, i) => {
      const count = scoreData.filter(r => r['专业名称'] === m).length
      reply += `${i + 1}. ${m}（${count}条录取记录）\n`
    })
    reply += '\n不同专业对体育专项要求不同，建议结合自身专项特长进行选择。'
    return reply
  }

  if (lowerMsg.includes('学费') || lowerMsg.includes('费用')) {
    const tuitionInfo = []
    const seen = new Set()
    enrollData.forEach(r => {
      const key = `${r['学校名称']}-${r['学费']}`
      if (r['学费'] && !seen.has(key)) {
        seen.add(key)
        tuitionInfo.push({ name: r['学校名称'], fee: r['学费'] })
      }
    })
    let reply = '部分院校体育类专业学费信息：\n\n'
    tuitionInfo.slice(0, 20).forEach((t, i) => {
      reply += `• ${t.name}：${t.fee}\n`
    })
    reply += '\n注：具体学费以各院校当年招生简章为准。'
    return reply
  }

  if (lowerMsg.includes('地址') || lowerMsg.includes('在哪里') || lowerMsg.includes('位置')) {
    const schoolMatch = msg.match(/(.+?)(?:大学|学院|学校)/)
    if (schoolMatch) {
      const schoolName = schoolMatch[0]
      const records = enrollData.filter(r => String(r['学校名称'] || '').includes(schoolName))
      if (records.length > 0) {
        let reply = `${schoolName} 的地址信息：\n\n`
        const addrs = [...new Set(records.map(r => r['学校地址']).filter(Boolean))]
        addrs.forEach((addr, i) => {
          reply += `${i + 1}. ${addr}\n`
        })
        return reply
      }
    }
    return '请提供具体的学校名称，我可以帮您查询学校地址信息。例如："云南大学在哪里？"'
  }

  if (lowerMsg.includes('你好') || lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('在吗')) {
    return '您好！我是高考志愿填报助手（体育特长生版），很高兴为您服务！\n\n我可以帮您：\n• 查询院校录取分数信息\n• 了解体育类招生专业\n• 解答志愿填报相关问题\n• 提供报考建议和策略\n\n请问您想了解什么？'
  }

  if (lowerMsg.includes('谢谢') || lowerMsg.includes('感谢')) {
    return '不客气！如果还有其他关于体育类志愿填报的问题，随时可以问我。祝您志愿填报顺利，金榜题名！🎓'
  }

  if (lowerMsg.includes('招生') || lowerMsg.includes('计划')) {
    let reply = `目前系统收录了 ${enrollData.length} 条招生计划数据。\n\n`
    const schools = [...new Set(enrollData.map(r => r['学校名称']).filter(Boolean))]
    reply += `涉及 ${schools.length} 所院校，包括：\n`
    schools.slice(0, 15).forEach((s, i) => {
      reply += `${i + 1}. ${s}\n`
    })
    if (schools.length > 15) reply += `...等共 ${schools.length} 所\n`
    reply += '\n您可以使用"数据查询"功能，切换到"招生数据"表进行详细查询。'
    return reply
  }

  // Default response
  return `感谢您的提问！关于"${msg}"，我为您提供以下建议：\n\n1. 您可以使用"数据查询"功能，通过院校名称、专业名称、分数区间等条件进行精确查询。\n\n2. 目前系统收录了：\n   • ${scoreData.length} 条录取分数数据\n   • ${enrollData.length} 条招生计划数据\n\n3. 常见问题我可以为您解答：\n   • 院校录取分数查询\n   • 综合成绩计算方式\n   • 志愿填报技巧\n   • 公费师范生政策\n   • 可报专业查询\n   • 学费信息\n   • 学校地址查询\n\n请尝试提出更具体的问题，我会尽力为您解答！`
}

// Start server
loadData()
app.listen(PORT, () => {
  console.log(`\n🚀 后端服务已启动: http://localhost:${PORT}`)
  console.log(`📊 数据查询API: http://localhost:${PORT}/api/query`)
  console.log(`🤖 智能问答API: http://localhost:${PORT}/api/chat\n`)
})
