import { loadData } from './data-loader.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message } = req.body
  const { scoreData, enrollData } = loadData()
  const reply = generateReply(message, scoreData, enrollData)
  return res.status(200).json({ reply })
}

function generateReply(msg, scoreData, enrollData) {
  const lowerMsg = msg.toLowerCase()

  if (lowerMsg.includes('院校') || lowerMsg.includes('学校') || lowerMsg.includes('大学')) {
    if (lowerMsg.includes('哪些') || lowerMsg.includes('可以报') || lowerMsg.includes('有哪些')) {
      const schoolNames = [...new Set(scoreData.map(s => s['院校名称']).filter(Boolean))]
      let reply = '根据数据，体育特长生可以报考以下院校：\n\n'
      schoolNames.slice(0, 25).forEach((name, i) => {
        const levels = [...new Set(scoreData.filter(s => s['院校名称'] === name).map(s => s['层次']))]
        reply += `${i + 1}. ${name}（${levels.join('/')}）\n`
      })
      if (schoolNames.length > 25) reply += `...等共 ${schoolNames.length} 所院校\n`
      reply += '\n如需查询具体院校的录取分数，请使用"数据查询"功能进行区间查询。'
      return reply
    }

    if (lowerMsg.includes('分数') || lowerMsg.includes('录取') || lowerMsg.includes('多少分')) {
      const patterns = [/(.+?)(?:大学|学院|学校)/]
      let foundSchool = null
      for (const pattern of patterns) {
        const match = msg.match(pattern)
        if (match) { foundSchool = match[0]; break }
      }
      if (foundSchool) {
        const records = scoreData.filter(r => String(r['院校名称'] || '').includes(foundSchool))
        if (records.length > 0) {
          let reply = `${foundSchool} 的录取数据如下：\n\n`
          records.forEach((r, i) => {
            reply += `${i + 1}. 专业：${r['专业名称']}\n   层次：${r['层次']} | 录取数：${r['录取数']}人\n   最高分：${r['最高分']} | 最低分：${r['最低分']}\n`
            if (r['备注']) reply += `   备注：${r['备注']}\n`
            reply += '\n'
          })
          return reply
        }
        return `抱歉，未找到"${foundSchool}"的录取数据。请确认院校名称是否正确。`
      }
      const scores = scoreData.map(r => parseFloat(r['最低分'])).filter(v => !isNaN(v))
      const minS = Math.min(...scores), maxS = Math.max(...scores)
      const avgS = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      return `根据历年录取数据，体育类录取分数概况：\n\n• 最低分范围：${minS} ~ ${maxS}\n• 平均最低分：${avgS}\n• 共收录 ${scoreData.length} 条录取记录\n\n建议使用"数据查询"功能，通过分数区间查询来筛选适合您的院校。`
    }
  }

  if (lowerMsg.includes('综合成绩') || lowerMsg.includes('怎么算') || lowerMsg.includes('计算')) {
    return `体育类综合成绩计算方式（以云南省为例）：\n\n综合成绩 = 文化成绩 ÷ 高考文化满分 × 30 + 专业成绩 ÷ 专业统考满分 × 70\n\n说明：\n• 文化成绩占30%权重\n• 体育专业统考成绩占70%权重\n• 不同院校可能有不同的计算方式，具体以各院校招生简章为准\n\n注意：部分院校（如云南大学足球项目）的公式为：\n综合成绩 = 文化成绩÷文化满分×30 + 足球专项成绩×2.5÷专业统考满分×70\n\n建议在填报志愿前仔细查看目标院校的招生章程。`
  }

  if (lowerMsg.includes('志愿') || lowerMsg.includes('填报') || lowerMsg.includes('技巧') || lowerMsg.includes('策略')) {
    return `体育特长生志愿填报技巧：\n\n1.【了解规则】熟悉平行志愿投档规则，了解综合成绩计算方式\n\n2.【合理定位】根据自己的综合成绩排名选择院校，参考历年录取最低分\n\n3.【梯度填报】\n   - 冲一冲：选择分数略高于自己成绩的院校\n   - 稳一稳：选择与自己成绩相当的院校\n   - 保一保：选择录取分数低于自己成绩的院校\n\n4.【注意事项】关注院校专项要求、公费师范生定向要求、学费和办学地点等`
  }

  if (lowerMsg.includes('公费师范') || lowerMsg.includes('师范') || lowerMsg.includes('定向')) {
    const records = scoreData.filter(r => String(r['备注'] || '').includes('定向') || String(r['专业名称'] || '').includes('师范'))
    let reply = '关于公费师范生/定向招生：\n\n'
    if (records.length > 0) {
      reply += '根据数据，以下院校有公费师范生/定向招生：\n\n'
      records.slice(0, 10).forEach((r, i) => {
        reply += `${i + 1}. ${r['院校名称']} - ${r['专业名称']}\n   录取数：${r['录取数']}人 | 最低分：${r['最低分']}\n`
        if (r['备注']) reply += `   备注：${r['备注']}\n\n`
      })
    }
    reply += '公费师范生注意事项：\n• 入学前需签订定向就业协议\n• 毕业后须到指定地区从事教育工作\n• 请仔细考虑定向任教地区是否符合个人发展意愿'
    return reply
  }

  if (lowerMsg.includes('专业') && (lowerMsg.includes('哪些') || lowerMsg.includes('有什么'))) {
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
    const seen = new Set()
    const tuitionInfo = []
    enrollData.forEach(r => {
      const key = `${r['学校名称']}-${r['学费']}`
      if (r['学费'] && !seen.has(key)) { seen.add(key); tuitionInfo.push({ name: r['学校名称'], fee: r['学费'] }) }
    })
    let reply = '部分院校体育类专业学费信息：\n\n'
    tuitionInfo.slice(0, 20).forEach(t => { reply += `• ${t.name}：${t.fee}\n` })
    reply += '\n注：具体学费以各院校当年招生简章为准。'
    return reply
  }

  if (lowerMsg.includes('你好') || lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('在吗')) {
    return '您好！我是高考志愿填报助手（体育特长生版），很高兴为您服务！\n\n我可以帮您：\n• 查询院校录取分数信息\n• 了解体育类招生专业\n• 解答志愿填报相关问题\n• 提供报考建议和策略\n\n请问您想了解什么？'
  }

  if (lowerMsg.includes('谢谢') || lowerMsg.includes('感谢')) {
    return '不客气！如果还有其他问题，随时可以问我。祝您志愿填报顺利，金榜题名！🎓'
  }

  return `感谢您的提问！关于"${msg}"，建议您：\n\n1. 使用"数据查询"功能，通过院校名称、专业名称、分数区间等条件进行精确查询\n\n2. 目前系统收录了：\n   • ${scoreData.length} 条录取分数数据\n   • ${enrollData.length} 条招生计划数据\n\n3. 常见问题我可以解答：院校录取分数、综合成绩计算、志愿填报技巧、公费师范生政策、可报专业、学费信息等\n\n请尝试提出更具体的问题！`
}
