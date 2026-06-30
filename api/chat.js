export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message } = req.body
  
  // 从环境变量获取 Coze 配置
  const botId = process.env.COZE_BOT_ID || '7657117728641417222'
  const apiToken = process.env.COZE_API_TOKEN || 'cztei_hgndI9CXmJgy0wlTucuaArUvhOuPEIv7p9y1RwY3lPSCpTMkBiElaW8ElxFhg2LiJ'
  const apiBase = process.env.COZE_API_BASE || 'https://api.coze.cn'

  try {
    console.log('Calling Coze API with bot:', botId)
    
    // 使用流式模式直接获取回复
    const response = await fetch(`${apiBase}/open_api/v2/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        conversation_id: '',
        bot_id: botId,
        user: 'user_' + Date.now(),
        query: message,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Coze API error:', response.status, errorText)
      throw new Error(`Coze API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Coze response:', JSON.stringify(data).substring(0, 500))
    
    // 提取回复内容
    let reply = ''
    if (data.msg === 'success' && data.data && data.data.answer) {
      reply = data.data.answer
    } else if (data.answer) {
      reply = data.answer
    } else if (data.messages && data.messages.length > 0) {
      const lastMessage = data.messages[data.messages.length - 1]
      reply = lastMessage.content || lastMessage.answer || ''
    } else {
      reply = '抱歉，智能体暂时无法回答，请稍后重试。'
    }

    return res.status(200).json({ reply })
  } catch (error) {
    console.error('Coze API call failed:', error.message)
    return res.status(500).json({ 
      error: '智能体服务暂时不可用',
      details: error.message 
    })
  }
}
