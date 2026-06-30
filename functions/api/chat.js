export async function onRequestPost(context) {
  const { request, env } = context
  
  try {
    const body = await request.json()
    const message = body.message
    
    const botId = env.COZE_BOT_ID || '7657117728641417222'
    const apiToken = env.COZE_API_TOKEN || 'cztei_hVm7A1eSadC5fwI9CR5FdMzgJRci16mT6DuGo7b3Wce3uClpsPr9tZrzZQ5q2s4eT'
    const apiBase = env.COZE_API_BASE || 'https://api.coze.cn'

    console.log('Calling Coze v3 API, bot:', botId, 'message:', message)
    
    // 发起对话
    const chatResponse = await fetch(`${apiBase}/v3/chat`, {
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
          { role: 'user', content: message, content_type: 'text' }
        ]
      })
    })

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      console.error('Coze API error:', chatResponse.status, errorText)
      return new Response(JSON.stringify({ error: '智能体服务错误', details: errorText }), 
        { status: 500, headers: { 'Content-Type': 'application/json' }})
    }

    const chatData = await chatResponse.json()
    console.log('Coze chat response:', JSON.stringify(chatData).substring(0, 300))

    if (chatData.code !== 0) {
      return new Response(JSON.stringify({ error: '智能体返回错误', msg: chatData.msg }), 
        { status: 500, headers: { 'Content-Type': 'application/json' }})
    }

    // 如果已完成，直接返回
    if (chatData.data && chatData.data.status === 'completed' && chatData.data.usage && chatData.data.usage.token_count > 0) {
      const reply = await getAssistantMessage(apiBase, apiToken, chatData.data.id, chatData.data.conversation_id)
      return new Response(JSON.stringify({ reply: reply || '抱歉，未获取到回答。' }), 
        { status: 200, headers: { 'Content-Type': 'application/json' }})
    }

    // 否则轮询等待结果
    const chatId = chatData.data?.id
    const conversationId = chatData.data?.conversation_id

    if (!chatId || !conversationId) {
      return new Response(JSON.stringify({ error: '智能体返回数据格式异常', data: chatData }), 
        { status: 500, headers: { 'Content-Type': 'application/json' }})
    }

    let reply = ''
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const retrieveResponse = await fetch(`${apiBase}/v3/chat/retrieve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ conversation_id: conversationId, chat_id: chatId })
      })

      if (retrieveResponse.ok) {
        const retrieveData = await retrieveResponse.json()
        console.log(`Poll ${i+1}:`, retrieveData.data?.status)
        
        if (retrieveData.data?.status === 'completed') {
          reply = await getAssistantMessage(apiBase, apiToken, chatId, conversationId)
          break
        }
      }
    }

    return new Response(JSON.stringify({ reply: reply || '抱歉，智能体响应超时，请稍后重试。' }), 
      { status: reply ? 200 : 504, headers: { 'Content-Type': 'application/json' }})

  } catch (error) {
    console.error('Coze API failed:', error.message)
    return new Response(JSON.stringify({ error: '智能体服务暂时不可用', details: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' }})
  }
}

async function getAssistantMessage(apiBase, apiToken, chatId, conversationId) {
  try {
    const msgResponse = await fetch(`${apiBase}/v3/chat/message/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    })
    // 使用 retrieve 接口获取消息
    const retrieveResp = await fetch(`${apiBase}/v3/chat/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ conversation_id: conversationId, chat_id: chatId })
    })
    if (retrieveResp.ok) {
      const retrieveData = await retrieveResp.json()
      if (retrieveData.data?.answer) {
        return retrieveData.data.answer
      }
    }
    // 尝试 message list
    const listResp = await fetch(`${apiBase}/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiToken}` }
    })
    if (listResp.ok) {
      const listData = await listResp.json()
      const assistantMsg = (listData.data || []).find(m => m.role === 'assistant' && m.type === 'answer')
      if (assistantMsg?.content) return assistantMsg.content
    }
    return ''
  } catch (e) {
    console.error('Get message failed:', e.message)
    return ''
  }
}
