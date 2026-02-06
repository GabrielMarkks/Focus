# 🧠 Focus Coach Pro
> **Não gerencie tarefas. Gerencie sua energia e atenção.**
> **O Sistema Operacional de Foco guiado por IA.**
> *Agora com Arquitetura Modular, Comandos de Voz e Agente Inteligente.*

![Status](https://img.shields.io/badge/Status-Stable%20v2.0-success)
![Architecture](https://img.shields.io/badge/Arch-MVC%20%2B%20ES6%20Modules-orange)
![AI Powered](https://img.shields.io/badge/AI-Gemini%20%7C%20Groq%20%7C%20OpenAI-blueviolet)

---

## 🎯 O Problema (O Pitch)

Ferramentas de produtividade tradicionais são passivas. Elas esperam que você faça tudo: planeje, priorize e execute. O resultado? Listas infinitas e ansiedade.

O **Focus Coach Pro** não é passivo. Ele é um **Agente Ativo**.
Ele ouve você, negocia suas prioridades, protege sua energia e blinda seu foco com neurociência aplicada.

**Diferenciais da v2.0:**
1.  **O Chat Faz, não só Fala:** A IA atua como um agente. Peça *"Adicione comprar café"* e ela executa a ação no app.
2.  **Captura Sem Atrito:** Fale com o app (Voz-para-Texto) para descarregar o cérebro instantaneamente.
3.  **Memória de Contexto:** O Coach lembra do que vocês conversaram nos últimos 30 minutos.

---

## ✨ Funcionalidades Principais

### 🤖 1. AI Agent & Coach (Chatbot Inteligente)
Converse com uma IA que conhece suas tarefas e seu propósito.
* **Contexto Real:** Ela sabe o que está na sua lista.
* **Comandos de Agente:** A IA pode manipular o app sozinha (ex: criar tarefas, reorganizar prioridades) enquanto conversa com você.
* **Memória de Curto Prazo:** Mantém o fio da meada da conversa para um coaching mais humano.

### 🎙️ 2. Captura de Voz (Voice-to-Text)
Integração nativa com a **Web Speech API**.
* Basta clicar no microfone e falar.
* Ideal para *Brain Dumps* rápidos sem digitar.

### 🧠 3. Magic Sort (Priorização Automática)
A IA analisa sua "Inbox" bagunçada e aplica a **Matriz de Eisenhower**:
* Classifica automaticamente: Importante vs. Urgente.
* Define o tipo: 🔧 Manutenção ou 🚀 Crescimento.

### 🛡️ 4. O Gatekeeper (O Guardião)
Evita o burnout antes que ele comece. O sistema **bloqueia** a adição de mais de 3 tarefas de "Alto Impacto" (Deep Work) no mesmo dia, forçando o essencialismo.

### 🔋 5. Gestão de Energia & Timer Binaural
Timer focado em ciclos ultradianos:
* 🟢 **Alta Energia:** 50 min (Deep Work).
* ⚪ **Baixa Energia:** 15 min (Start Rápido).
* 🎧 **Sons de Foco:** Ruído Marrom (Fluxo), Chuva ou Cafeteria integrados.

---

## 🛠️ Arquitetura Técnica (MVC)

Nesta versão 2.0, o projeto foi refatorado para **ES6 Modules**, garantindo escalabilidade e manutenção limpa:

/js ├── main.js 
# Entry Point (Inicialização e Bridge) ├── model.js 
# Gestão de Dados, LocalStorage e Regras de Negócio ├── view.js 
# Manipulação do DOM, Gráficos e UI ├── controller.js 
# Lógica de Controle e Event Listeners └── ai.js 
# Service Layer (Conexão com APIs Gemini/Groq/OpenAI)

* **Design Pattern:** Model-View-Controller (MVC).
* **Persistência:** LocalStorage (Client-side first).
* **API Layer:** Fetch API assíncrona com tratamento de erros robusto.

---

## 🚀 Como Rodar (Importante!)

Como o projeto agora usa **Módulos ES6** (`import`/`export`), você **não pode** apenas abrir o arquivo `index.html` clicando duas vezes (devido à política CORS dos navegadores para módulos locais).

### Pré-requisito
Você precisa de um servidor local simples.

#### Opção A: VS Code (Recomendado)
1.  Instale a extensão **Live Server**.
2.  Clique com o botão direito no `index.html`.
3.  Escolha **"Open with Live Server"**.

#### Opção B: Python
No terminal, na pasta do projeto:
```bash
python -m http.server 8000
# Acesse localhost:8000 no navegador

