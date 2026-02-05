const AI_Manager = {
    // Prompt do Sistema (A "personalidade" do Coach)
    SYSTEM_PROMPT: `
        Você é um assistente de produtividade especializado na Matriz de Eisenhower.
        Sua tarefa é analisar uma lista de tarefas e classificá-las.
        
        Regras de Saída (OBRIGATÓRIO):
        1. Retorne APENAS um Array JSON válido.
        2. Não use Markdown (sem \`\`\`json).
        3. Não dê explicações.
        
        Formato do Objeto JSON:
        {
            "id": (mantenha o id original),
            "importante": (boolean),
            "urgente": (boolean),
            "tipo": ("manutencao" ou "crescimento")
        }
    `,

    // Roteador de Chamadas
    async classificar(provider, apiKey, tarefas) {
        if (!apiKey) throw new Error("API Key não informada.");
        
        const payload = {
            tarefas: tarefas.map(t => ({ id: t.id, texto: t.texto }))
        };

        console.log(`🤖 Iniciando IA via: ${provider}`);

        switch (provider) {
            case 'gemini':
                return await this.callGemini(apiKey, payload);
            case 'openai':
                return await this.callOpenAI(apiKey, payload);
            case 'groq':
                return await this.callGroq(apiKey, payload);
            default:
                throw new Error("Provedor de IA desconhecido.");
        }
    },

    // --- ADAPTER: GOOGLE GEMINI ---
    async callGemini(apiKey, payload) {
        // Tenta primeiro o 1.5 Flash (Rápido), se falhar, o código captura
        const model = "gemini-1.5-flash"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const body = {
            contents: [{
                parts: [{ text: this.SYSTEM_PROMPT + "\nTarefas para analisar:\n" + JSON.stringify(payload) }]
            }]
        };

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Gemini Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return this.parseResponse(text);
    },

    // --- ADAPTER: OPENAI (GPT-3.5/4o) ---
    async callOpenAI(apiKey, payload) {
        const url = "https://api.openai.com/v1/chat/completions";
        
        const body = {
            model: "gpt-4o-mini", // Modelo rápido e barato
            messages: [
                { role: "system", content: this.SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify(payload) }
            ],
            temperature: 0.3
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`OpenAI Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return this.parseResponse(data.choices[0].message.content);
    },

    // --- ADAPTER: GROQ (Llama 3 - Ultra Rápido e Grátis no momento) ---
    async callGroq(apiKey, payload) {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        
        const body = {
            model: "llama3-70b-8192", // Modelo muito inteligente e rápido
            messages: [
                { role: "system", content: this.SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify(payload) }
            ],
            temperature: 0.1
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Groq Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return this.parseResponse(data.choices[0].message.content);
    },

    // --- UTIL: Limpeza e Parse do JSON ---
    parseResponse(text) {
        try {
            // Remove blocos de código Markdown se a IA mandar (ex: ```json ... ```)
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Tenta encontrar o início e fim do array
            const start = clean.indexOf('[');
            const end = clean.lastIndexOf(']');
            
            if (start !== -1 && end !== -1) {
                clean = clean.substring(start, end + 1);
            }
            
            return JSON.parse(clean);
        } catch (e) {
            console.error("Falha ao fazer parse:", text);
            throw new Error("A IA não retornou um formato válido. Tente novamente.");
        }
    }
};