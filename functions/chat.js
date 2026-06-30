export async function onRequestPost(context) {
  const { request, env } = context
  
  try {
    // 解析请求体
    const body = await request.json()
    const message = body.message
    
    // 从环境变量获取 Coze 配置
    const botId = env.COZE_BOT_ID || '7657117728641417222'
    const apiToken = env.COZE_API_TOKEN || 'cztei_hVm7A1eSadC5fwI9CR5FdMzgJRci16mT6DuGo7b3Wce3uClpsPr9tZrzZQ5q2s4eT'
    const apiBase = env.COZE_API_BASE || 'https://api.coze.cn'

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
      return new Response(JSON.stringify({ 
        error: '智能体服务暂时不可用',
        details: errorText 
      }), { status: 500, headers: { 'Content-Type': 'application/json' }})
    }

    const data = await response.json()
    console.log('Coze response status:', data.data?.status)
    
    // v3 API 返回的是异步响应，需要等待处理完成
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

    return new Response(JSON.stringify({ reply }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Coze API call failed:', error.message)
    return new Response(JSON.stringify({ 
      error: '智能体服务暂时不可用',
      details: error.message 
    }), { status: 500, headers: { 'Content-Type': 'application/json' }})
  }
}
