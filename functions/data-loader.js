import XLSX from 'xlsx'
import path from 'path'

let scoreData = null
let enrollData = null

export function loadData() {
  if (scoreData && enrollData) return { scoreData, enrollData }

  const scoreFile = path.join(process.cwd(), '体育类录取分数.xlsx')
  const scoreWb = XLSX.readFile(scoreFile)
  scoreData = XLSX.utils.sheet_to_json(scoreWb.Sheets[scoreWb.SheetNames[0]])

  const enrollFile = path.join(process.cwd(), '体育类招生数据.xlsx')
  const enrollWb = XLSX.readFile(enrollFile)
  enrollData = XLSX.utils.sheet_to_json(enrollWb.Sheets[enrollWb.SheetNames[0]])

  return { scoreData, enrollData }
}
