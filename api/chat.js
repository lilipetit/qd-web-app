export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message } = req.body
  
  // 从环境变量获取 Coze 配置
  const botId = process.env.COZE_BOT_ID || '7657117728641417222'
  const apiToken = process.env.COZE_API_TOKEN || 'cztei_hgndI9CXmJgy0wlTucuaArUvhOuPEIv7p9y1RwY3lPSCpTMkBiElaW8ElxFhg2LiJ'
  const apiBase = process.env.COZE_API_BASE || 'https://api.coze.cn'

  try {
    // 调用 Coze API
    const response = await fetch(`${apiBase}/v3/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: 'user_' + Date.now(),
        stream: false,
        additional_messages: [
          {
            role: 'user',
            content: message,
            content_type: 'text'
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Coze API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // 提取回复内容
    let reply = ''
    if (data.data && data.data.messages && data.data.messages.length > 0) {
      const lastMessage = data.data.messages[data.data.messages.length - 1]
      reply = lastMessage.content || ''
    } else if (data.answer) {
      reply = data.answer
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
