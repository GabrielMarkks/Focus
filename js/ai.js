export const AI_Manager = {
    // Prompt para Classificação
    SYSTEM_PROMPT_SORT: `
        Você é um especialista em produtividade (Matriz Eisenhower).
        Analise a lista de tarefas.
        Retorne APENAS um Array JSON válido (sem markdown, sem explicações).
        Estrutura: [{"id": "string", "importante": bool, "urgente": bool, "tipo": "manutencao"|"crescimento"}]
    `,

    async classificar(provider, apiKey, tarefas) {
        const cleanKey = apiKey ? apiKey.trim() : "";
        if (!cleanKey) throw new Error("API Key não informada.");

        const payload = { tarefas: tarefas.map(t => ({ id: String(t.id), texto: t.texto })) };
        console.log(`🤖 Classificando via: ${provider}`);

        if (provider === 'gemini') return await this.callGemini(cleanKey, payload, 'sort');
        if (provider === 'openai') return await this.callOpenAI(cleanKey, payload, 'sort');
        if (provider === 'groq') return await this.callGroq(cleanKey, payload, 'sort');
    },

    async chat(provider, apiKey, userMessage, context, history) {
        const cleanKey = apiKey ? apiKey.trim() : "";
        if (!cleanKey) throw new Error("API Key não informada.");

        const historyText = history.map(h =>
            `${h.role === 'user' ? 'USUÁRIO' : 'COACH'}: ${h.content}`
        ).join('\n');

        // PROMPT REFORÇADO ("HARD SYSTEM PROMPT")
        const prompt = `
            JAILBREAK INSTRUCTION: Você é um Agente de Software (Focus Coach).
            
            ESTADO ATUAL DO APP:
            - Meta Semanal Atual: "${context.metaSemanal || '(Vazio)'}"
            - Tarefas: ${context.tarefas.map(t => t.texto).join(', ')}
            
            HISTÓRICO:
            ${historyText}
            
            USUÁRIO DISSE: "${userMessage}"
            
            SUAS FERRAMENTAS (OBRIGATÓRIO USAR QUANDO SOLICITADO):
            1. [SET_GOAL: Texto da Meta] -> Use IMEDIATAMENTE se o usuário pedir para "definir meta", "mudar foco da semana" ou "colocar X na meta". NÃO DISCUTA. EXECUTE.
            2. [ADD: Texto da Tarefa] -> Use se o usuário pedir para adicionar tarefa.
            3. [ORGANIZE] -> Use se o usuário pedir para organizar.
            
            REGRAS DE COMPORTAMENTO:
            - Se o usuário der uma ordem direta ("Mude a meta para X"), obedeça e use a ferramenta [SET_GOAL: X]. Não questione.
            - Se o usuário pedir conselho, aí sim seja um coach estoico.
            - Responda curto.
        `;

        console.log(`💬 Chat via: ${provider}`);

        if (provider === 'gemini') return await this.callGemini(cleanKey, { prompt }, 'chat');
        if (provider === 'openai') return await this.callOpenAI(cleanKey, { prompt }, 'chat');
        if (provider === 'groq') return await this.callGroq(cleanKey, { prompt }, 'chat');
    },

    // --- ADAPTERS ---
    async callGemini(apiKey, data, mode) {
        const model = "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        let textToSend = mode === 'sort' ? (this.SYSTEM_PROMPT_SORT + "\nTarefas:\n" + JSON.stringify(data)) : data.prompt;

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: textToSend }] }] }) });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Erro Gemini");
        }
        const resData = await response.json();
        const text = resData.candidates[0].content.parts[0].text;
        return mode === 'sort' ? this.parseJSON(text) : text;
    },

    async callOpenAI(apiKey, data, mode) {
        const url = "https://api.openai.com/v1/chat/completions";
        let messages = mode === 'sort' ?
            [{ role: "system", content: this.SYSTEM_PROMPT_SORT }, { role: "user", content: JSON.stringify(data) }] :
            [{ role: "user", content: data.prompt }];

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.3 })
        });

        if (!response.ok) throw new Error("Erro OpenAI");
        const resData = await response.json();
        return mode === 'sort' ? this.parseJSON(resData.choices[0].message.content) : resData.choices[0].message.content;
    },

    async callGroq(apiKey, data, mode) {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        let messages = mode === 'sort' ?
            [{ role: "system", content: this.SYSTEM_PROMPT_SORT }, { role: "user", content: JSON.stringify(data) }] :
            [{ role: "user", content: data.prompt }];

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, temperature: 0.1 })
        });

        if (!response.ok) throw new Error("Erro Groq");
        const resData = await response.json();
        return mode === 'sort' ? this.parseJSON(resData.choices[0].message.content) : resData.choices[0].message.content;
    },

    parseJSON(text) {
        try {
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = clean.indexOf('[');
            const end = clean.lastIndexOf(']');
            if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
            return JSON.parse(clean);
        } catch (e) { throw new Error("Formato inválido da IA."); }
    }
};