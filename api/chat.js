export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message } = req.body
  
  // 从环境变量获取 Coze 配置
  const botId = process.env.COZE_BOT_ID || '7657117728641417222'
  const apiToken = process.env.COZE_API_TOKEN || 'cztei_hVm7A1eSadC5fwI9CR5FdMzgJRci16mT6DuGo7b3Wce3uClpsPr9tZrzZQ5q2s4eT'
  const apiBase = process.env.COZE_API_BASE || 'https://api.coze.cn'

  try {
    console.log('Calling Coze API with bot:', botId)
    
    // 调用 Coze v3 API 发起对话
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
      const errorText = await response.text()
      console.error('Coze API error:', response.status, errorText)
      throw new Error(`Coze API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Coze response status:', data.data?.status)
    
    // v3 API 返回的是异步响应，需要等待处理完成
    // 如果是 in_progress，需要轮询获取结果
    let reply = ''
    
    if (data.data && data.data.status === 'completed') {
      // 直接获取消息
      if (data.data.messages && data.data.messages.length > 0) {
        const assistantMsg = data.data.messages.find(m => m.role === 'assistant')
        if (assistantMsg && assistantMsg.content) {
          reply = assistantMsg.content
        }
      }
    } else if (data.data && data.data.id) {
      // 需要轮询获取结果
      const conversationId = data.data.id
      const maxAttempts = 30
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const statusResponse = await fetch(`${apiBase}/v3/chat/retrieve?conversation_id=${conversationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`
          }
        })
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          if (statusData.data && statusData.data.messages && statusData.data.messages.length > 0) {
            const assistantMsg = statusData.data.messages.find(m => m.role === 'assistant')
            if (assistantMsg && assistantMsg.content) {
              reply = assistantMsg.content
              break
            }
          }
          
          if (statusData.data && statusData.data.status === 'completed') {
            break
          }
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
