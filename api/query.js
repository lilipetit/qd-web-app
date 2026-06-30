import { loadData } from './data-loader.js'

export default function handler(req, res) {
  const { scoreData, enrollData } = loadData()
  const { table, field, min, max, ...filters } = req.query

  if (table === 'score') {
    let results = [...scoreData]

    const textFields = ['院校代码', '院校名称', '专业名称']
    for (const f of textFields) {
      if (filters[f]) {
        results = results.filter(row => String(row[f] || '').includes(filters[f]))
      }
    }
    if (filters['层次']) results = results.filter(row => row['层次'] === filters['层次'])
    if (filters['学校类型']) results = results.filter(row => row['学校类型'] === filters['学校类型'])

    if (field && (min || max)) {
      results = results.filter(row => {
        const val = parseFloat(row[field])
        if (isNaN(val)) return false
        if (min && val < parseFloat(min)) return false
        if (max && val > parseFloat(max)) return false
        return true
      })
    }

    results.sort((a, b) => (parseFloat(b['最低分']) || 0) - (parseFloat(a['最低分']) || 0))
    const columns = ['院校代码', '层次', '院校名称', '学校类型', '专业名称', '录取数', '最高分', '最低分', '备注']
    return res.status(200).json({ columns, rows: results, total: results.length })
  }

  if (table === 'enroll') {
    let results = [...enrollData]
    const textFields = ['学校代码', '学校名称', '专业名字', '专业组号']
    for (const f of textFields) {
      if (filters[f]) {
        results = results.filter(row => String(row[f] || '').includes(filters[f]))
      }
    }
    const columns = ['学校代码', '学校名称', '学校地址', '专业组号', '专业名字', '学费', '备注']
    return res.status(200).json({ columns, rows: results, total: results.length })
  }

  return res.status(400).json({ error: '未知的数据表' })
}
