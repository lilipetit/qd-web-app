export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message } = req.body
  
  // 从环境变量获取 Coze 配置
  const botId = process.env.COZE_BOT_ID || '7657117728641417222'
  const apiToken = process.env.COZE_API_TOKEN || 'cztei_hgndI9CXmJgy0wlTucuaArUvhOuPEIv7p9y1RwY3lPSCpTMkBiElaW8ElxFhg2LiJ'
  const apiBase = process.env.COZE_API_BASE || 'https://api.coze.cn'

  try {
    // 步骤1: 创建对话
    const createResponse = await fetch(`${apiBase}/v3/chat`, {
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

    if (!createResponse.ok) {
      throw new Error(`Create chat failed: ${createResponse.status} ${createResponse.statusText}`)
    }

    const createData = await createResponse.json()
    
    if (!createData.data || !createData.data.id) {
      throw new Error('Invalid response from Coze API')
    }

    const conversationId = createData.data.id
    
    // 步骤2: 等待并获取回复（最多等待30秒）
    let reply = ''
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
      
      // 查询对话状态
      const statusResponse = await fetch(`${apiBase}/v3/chat/retrieve?conversation_id=${conversationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      })
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        
        // 检查是否有回复
        if (statusData.data && statusData.data.messages && statusData.data.messages.length > 0) {
          const lastMessage = statusData.data.messages[statusData.data.messages.length - 1]
          if (lastMessage.role === 'assistant' && lastMessage.content) {
            reply = lastMessage.content
            break
          }
        }
        
        // 如果状态是 completed，停止等待
        if (statusData.data && statusData.data.status === 'completed') {
          break
        }
      }
    }

    if (!reply) {
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
