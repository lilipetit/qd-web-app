import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('query')
  // Query states
  const [queryTable, setQueryTable] = useState('score')
  const [filters, setFilters] = useState({})
  const [scoreMin, setScoreMin] = useState('')
  const [scoreMax, setScoreMax] = useState('')
  const [scoreField, setScoreField] = useState('最低分')
  const [results, setResults] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // Matched enrollment data when clicking school name
  const [matchedEnroll, setMatchedEnroll] = useState([])
  const [matchedSchoolName, setMatchedSchoolName] = useState('')
  const [enrollLoading, setEnrollLoading] = useState(false)

  // Chat states
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '您好！我是高考志愿填报助手（体育特长生版），我可以帮您解答关于体育类志愿填报的相关问题，例如：\n• 如何查询院校录取分数？\n• 体育特长生可以报考哪些类型的院校？\n• 志愿填报有哪些注意事项？\n• 综合成绩如何计算？\n\n请问您有什么想了解的？' }
  ])
  const [inputMsg, setInputMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleQuery = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('table', queryTable)
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v)
      })
      if (queryTable === 'score' && (scoreMin || scoreMax)) {
        params.set('field', scoreField)
        if (scoreMin) params.set('min', scoreMin)
        if (scoreMax) params.set('max', scoreMax)
      }
      const res = await fetch(`/api/query?${params.toString()}`)
      const data = await res.json()
      if (data.columns) setColumns(data.columns)
      setResults(data.rows || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
      alert('查询失败，请检查后端服务是否启动')
    }
    setLoading(false)
  }

  const handleReset = () => {
    setFilters({})
    setScoreMin('')
    setScoreMax('')
    setScoreField('最低分')
    setResults([])
    setColumns([])
    setTotal(0)
    setMatchedEnroll([])
    setMatchedSchoolName('')
  }

  // Handle clicking on school name to match enrollment data
  const handleSchoolClick = async (schoolName) => {
    if (!schoolName) return
    setEnrollLoading(true)
    setMatchedSchoolName(schoolName)
    try {
      const params = new URLSearchParams()
      params.set('table', 'enroll')
      params.set('学校名称', schoolName)
      const res = await fetch(`/api/query?${params.toString()}`)
      const data = await res.json()
      setMatchedEnroll(data.rows || [])
    } catch (err) {
      console.error(err)
      setMatchedEnroll([])
    }
    setEnrollLoading(false)
  }

  const handleSendMessage = async () => {
    if (!inputMsg.trim()) return
    const userMsg = { role: 'user', content: inputMsg }
    setMessages(prev => [...prev, userMsg])
    setInputMsg('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMsg, history: messages })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，服务暂时不可用，请稍后重试。' }])
    }
    setChatLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const scoreColumns = ['院校代码', '层次', '院校名称', '学校类型', '专业名称', '录取数', '最高分', '最低分', '备注']
  const enrollColumns = ['学校代码', '学校名称', '学校地址', '专业组号', '专业名字', '学费', '备注']

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🏅 高考志愿填报助手</h1>
          <p className="subtitle">体育特长生专用版 | 基于历年录取数据智能查询</p>
        </div>
      </header>

      <nav className="tabs">
        <button className={activeTab === 'query' ? 'tab active' : 'tab'} onClick={() => setActiveTab('query')}>
          📊 数据查询
        </button>
        <button className={activeTab === 'chat' ? 'tab active' : 'tab'} onClick={() => setActiveTab('chat')}>
          🤖 智能问答
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'query' && (
          <div className="query-section">
            <div className="filter-panel">
              <h3>查询条件</h3>
              <div className="filter-row">
                <label>数据表：</label>
                <select value={queryTable} onChange={e => { setQueryTable(e.target.value); handleReset() }}>
                  <option value="score">录取分数数据</option>
                  <option value="enroll">招生数据</option>
                </select>
              </div>

              {queryTable === 'score' && (
                <>
                  <div className="filter-grid">
                    <div className="filter-item">
                      <label>院校代码</label>
                      <input value={filters['院校代码'] || ''} onChange={e => setFilters({...filters, '院校代码': e.target.value})} placeholder="输入院校代码" />
                    </div>
                    <div className="filter-item">
                      <label>院校名称</label>
                      <input value={filters['院校名称'] || ''} onChange={e => setFilters({...filters, '院校名称': e.target.value})} placeholder="输入院校名称" />
                    </div>
                    <div className="filter-item">
                      <label>层次</label>
                      <select value={filters['层次'] || ''} onChange={e => setFilters({...filters, '层次': e.target.value})}>
                        <option value="">全部</option>
                        <option value="本科">本科</option>
                        <option value="专科">专科</option>
                      </select>
                    </div>
                    <div className="filter-item">
                      <label>学校类型</label>
                      <select value={filters['学校类型'] || ''} onChange={e => setFilters({...filters, '学校类型': e.target.value})}>
                        <option value="">全部</option>
                        <option value="公办">公办</option>
                        <option value="民办">民办</option>
                      </select>
                    </div>
                    <div className="filter-item">
                      <label>专业名称</label>
                      <input value={filters['专业名称'] || ''} onChange={e => setFilters({...filters, '专业名称': e.target.value})} placeholder="输入专业名称" />
                    </div>
                  </div>
                  <div className="range-query">
                    <h4>分数区间查询</h4>
                    <div className="range-row">
                      <label>查询字段：</label>
                      <select value={scoreField} onChange={e => setScoreField(e.target.value)}>
                        <option value="最低分">最低分</option>
                        <option value="最高分">最高分</option>
                      </select>
                      <label>最低值：</label>
                      <input type="number" step="0.01" value={scoreMin} onChange={e => setScoreMin(e.target.value)} placeholder="如: 80" />
                      <label>最高值：</label>
                      <input type="number" step="0.01" value={scoreMax} onChange={e => setScoreMax(e.target.value)} placeholder="如: 100" />
                    </div>
                    <p className="hint">💡 区间查询将返回符合条件的所有记录行及其全部字段信息</p>
                  </div>
                </>
              )}

              {queryTable === 'enroll' && (
                <div className="filter-grid">
                  <div className="filter-item">
                    <label>学校代码</label>
                    <input value={filters['学校代码'] || ''} onChange={e => setFilters({...filters, '学校代码': e.target.value})} placeholder="输入学校代码" />
                  </div>
                  <div className="filter-item">
                    <label>学校名称</label>
                    <input value={filters['学校名称'] || ''} onChange={e => setFilters({...filters, '学校名称': e.target.value})} placeholder="输入学校名称" />
                  </div>
                  <div className="filter-item">
                    <label>专业名字</label>
                    <input value={filters['专业名字'] || ''} onChange={e => setFilters({...filters, '专业名字': e.target.value})} placeholder="输入专业名称" />
                  </div>
                  <div className="filter-item">
                    <label>专业组号</label>
                    <input value={filters['专业组号'] || ''} onChange={e => setFilters({...filters, '专业组号': e.target.value})} placeholder="输入专业组号" />
                  </div>
                </div>
              )}

              <div className="btn-row">
                <button className="btn btn-primary" onClick={handleQuery} disabled={loading}>
                  {loading ? '查询中...' : '🔍 查询'}
                </button>
                <button className="btn btn-secondary" onClick={handleReset}>🔄 重置</button>
              </div>
            </div>

            <div className="result-panel">
              <div className="result-header">
                <h3>查询结果</h3>
                <span className="result-count">共 {total} 条记录</span>
              </div>
              {results.length > 0 ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        {columns.map(col => <th key={col}>{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, idx) => (
                        <tr key={idx}>
                          {columns.map(col => (
                            <td key={col}>
                              {col === '院校名称' && queryTable === 'score' ? (
                                <a
                                  className="school-link"
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); handleSchoolClick(row[col]) }}
                                  title={`点击查看「${row[col]}」的招生数据`}
                                >
                                  {row[col] ?? '-'}
                                </a>
                              ) : (
                                row[col] ?? '-'
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>📋 请输入查询条件后点击查询按钮</p>
                </div>
              )}
            </div>

            {/* Matched enrollment data panel */}
            {(matchedEnroll.length > 0 || (matchedSchoolName && !enrollLoading)) && (
              <div className="result-panel matched-panel">
                <div className="result-header">
                  <h3>🔗 「{matchedSchoolName}」招生数据匹配结果</h3>
                  <span className="result-count">共匹配到 {matchedEnroll.length} 条记录</span>
                </div>
                {matchedEnroll.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          {['学校代码', '学校名称', '学校地址', '专业组号', '专业名字', '学费', '备注'].map(col => <th key={col}>{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {matchedEnroll.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row['学校代码'] ?? '-'}</td>
                            <td>{row['学校名称'] ?? '-'}</td>
                            <td>{row['学校地址'] ?? '-'}</td>
                            <td>{row['专业组号'] ?? '-'}</td>
                            <td>{row['专业名字'] ?? '-'}</td>
                            <td>{row['学费'] ?? '-'}</td>
                            <td className="remark-cell">{row['备注'] ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="no-match">
                    <p>⚠️ 在招生数据表中未找到「{matchedSchoolName}」的匹配记录</p>
                  </div>
                )}
              </div>
            )}
            {enrollLoading && (
              <div className="result-panel matched-panel">
                <div className="result-header">
                  <h3>🔗 正在匹配「{matchedSchoolName}」的招生数据...</h3>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-section">
            <div className="chat-container">
              <div className="chat-messages">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'assistant' ? '🤖' : '👤'}
                    </div>
                    <div className="message-content">
                      {msg.content.split('\n').map((line, i) => (
                        <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="message assistant">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content typing">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input">
                <textarea
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入您的问题，按 Enter 发送..."
                  rows={2}
                />
                <button onClick={handleSendMessage} disabled={chatLoading || !inputMsg.trim()}>
                  发送
                </button>
              </div>
            </div>
            <div className="quick-questions">
              <h4>快捷问题：</h4>
              {[
                '体育特长生可以报考哪些院校？',
                '综合成绩怎么计算？',
                '志愿填报有什么技巧？',
                '公费师范生有哪些要求？'
              ].map((q, i) => (
                <button key={i} className="quick-btn" onClick={() => { setInputMsg(q) }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
