# 🧠 Focus Coach Pro
> **Não gerencie tarefas. Gerencie sua energia e atenção.**

![Status](https://img.shields.io/badge/Status-Gold%20Master-success)
![AI Powered](https://img.shields.io/badge/AI-Gemini%20%7C%20Groq%20%7C%20OpenAI-blueviolet)
![Privacy](https://img.shields.io/badge/Data-Local%20Storage-blue)

---

## 🎯 O Problema (O Pitch)

A maioria dos aplicativos de produtividade falha porque atua como "baldes infinitos": eles permitem que você adicione 50 tarefas para hoje, criando ansiedade e a sensação de fracasso antes mesmo de começar.

O **Focus Coach Pro** não é uma To-Do List. É um **Sistema Operacional de Foco** baseado em neurociência e essencialismo.

**Ele resolve 3 dores críticas:**
1.  **Paralisia de Decisão:** "Tenho tanta coisa, por onde começo?" → *A IA organiza tudo automaticamente.*
2.  **Burnout por Excesso:** Tentar fazer tudo. → *O "Gatekeeper" bloqueia você de adicionar mais de 3 metas críticas por dia.*
3.  **Falta de Foco:** Interrupções constantes. → *O Timer Binaural blinda sua atenção baseada na sua energia atual.*

---

## ✨ Funcionalidades Principais

### 🤖 1. Magic Sort (Organização com IA)
Jogue suas ideias bagunçadas na Inbox e deixe a **Inteligência Artificial** (Gemini 1.5, GPT-4o ou Llama 3) processar tudo.
* Ela lê a tarefa.
* Decide se é **Urgente/Importante** (Matriz de Eisenhower).
* Classifica como **🔧 Manutenção** (Rotina) ou **🚀 Crescimento** (Metas).
* Move para o quadrante certo automaticamente.

### 🛡️ 2. O Gatekeeper (O Guardião)
O app atua como um coach severo. Se você tentar adicionar uma 4ª tarefa de "Crescimento" (Deep Work) no mesmo dia, o sistema **intervém e questiona sua intenção**, forçando o essencialismo.

### 🔋 3. Gestão de Energia
Não somos robôs. Antes de focar, o app pergunta: *"Como está sua bateria?"*.
* 🟢 **Alta:** Ativa modo **Deep Work** (50 min).
* 🔵 **Média:** Ativa modo **Padrão** (25 min).
* ⚪ **Baixa:** Ativa modo **Start** (15 min) para vencer a inércia.

### 🎧 4. Ambiente Imersivo
Sons de chuva, cafeteria ou fluxo (ruído marrom) integrados para isolamento acústico imediato.

### 📊 5. Analytics & Gamification
* **XP e Níveis:** Suba de nível focando (Iniciante → Lenda).
* **Gráficos:** Veja para onde sua vida está indo (Manutenção vs. Crescimento).

---

## 🚀 Quick Start (Como Rodar)

Este projeto é **Serverless e Client-Side First**. Não requer instalação de dependências complexas (Node/Python).

### Opção A: Rodar Localmente
1.  Clone este repositório:
    ```bash
    git clone [https://github.com/seu-usuario/focus-coach-pro.git](https://github.com/seu-usuario/focus-coach-pro.git)
    ```
2.  Abra o arquivo `index.html` no seu navegador.
3.  Pronto! ⚡

### Opção B: VS Code (Recomendado)
1.  Abra a pasta no VS Code.
2.  Instale a extensão **Live Server**.
3.  Clique em "Go Live".

---

## 🔑 Configuração da IA

Para usar o recurso "Magic Sort", você precisa de uma API Key (Gratuita).

1.  No app, clique no ícone de **Engrenagem (⚙️)**.
2.  Escolha o provedor (Recomendado: **Google Gemini**).
3.  Clique em "Obter Chave" ou acesse:
    * [Google AI Studio](https://aistudio.google.com/app/apikey)
    * [Groq Console](https://console.groq.com/keys)
4.  Cole a chave e clique em **Salvar**.
5.  *Nota: A chave é salva apenas no LocalStorage do seu navegador. 100% Privado.*

---

## 📖 Guia de Uso (O Fluxo Ideal)

### ☀️ Manhã: Planejamento
1.  Use o **Brain Dump (Tecla 'C')** para tirar tudo da cabeça.
2.  Clique em **"✨ Organizar"** para a IA priorizar.
3.  Garanta que você tenha no máximo **3 tarefas de Crescimento**.

### ⚡ Durante o Dia: Execução
1.  Escolha uma tarefa da Matriz.
2.  Clique no **Play**. Defina sua energia.
3.  Trabalhe até o timer apitar.

### 🌙 Noite: Shutdown
1.  Menu (⋮) -> **Encerrar Dia**.
2.  Veja suas vitórias e copie o resumo.
3.  Confirme o encerramento para limpar a mesa para o dia seguinte.

---

## 🛠️ Tecnologias

* **Core:** HTML5, CSS3, JavaScript (ES6+ Modules).
* **UI Framework:** Bootstrap 5.3 (Customizado).
* **Ícones:** Phosphor Icons.
* **Gráficos:** Chart.js.
* **IA Integration:** Fetch API (Google Gemini / OpenAI / Groq).
* **Arquitetura:** MVC (Model-View-Controller) desacoplado com Services.

---

## 🤝 Contribuição

Este projeto foi construído pensando em escalabilidade. Sinta-se à vontade para abrir Issues ou PRs.
Ideias para a v2.0:
* [ ] Modo PWA (Instalável no celular).
* [ ] Sincronização na Nuvem (Firebase).
* [ ] Integração com Google Calendar.

---

## 📄 Licença

Distribuído sob a licença MIT. Sinta-se livre para usar, modificar e vender, desde que mantenha os créditos.

---

<p align="center">Feito com 💙 e Foco.</p>
