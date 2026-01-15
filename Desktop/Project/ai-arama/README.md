# KAIROS: Intelligent Voice Assistant Platform 📞

**KAIROS** is a production-grade B2B autonomous voice reservation platform developed as a **Generative AI** course project. It bridges the gap between traditional PSTN (Public Switched Telephone Network) and state-of-the-art Generative AI to provide businesses with a seamless, 24/7 automated scheduling agent.

---

##  Business Value Proposition

In traditional service industries, missed calls equal lost revenue. KAIROS ensures **zero missed appointments** by providing:

* **Instant Scalability:** Handle multiple customer inquiries simultaneously.
* **Cost Efficiency:** Reduces the need for dedicated administrative staff for booking.
* **Enhanced CX:** Human-like interaction with zero wait times.

##  System Architecture & Workflow

The system orchestrates a complex "Speech-to-Intent-to-Action" pipeline with ultra-low latency:

1. **Ingress:** Twilio captures the call and establishes a webhook connection via an Ngrok tunnel to the Express server.
2. **Cognitive Layer:** User speech is processed by **Llama 3.3-70B** via **Groq LPU**. The model is injected with real-time business context (services, pricing, availability) fetched from **Supabase**.
3. **Validation Engine:** A custom **Regex-based Syntax Firewall** parses the AI output to ensure data integrity before any database operation.
4. **Synthesis:** High-fidelity Turkish audio is generated using **ElevenLabs Multilingual v2**.
5. **Persistence & Automation:** Confirmed appointments are saved to **PostgreSQL (Supabase)** and synced to **Google Calendar** via an **n8n** workflow.

##  Technical Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Runtime** | Node.js / Express.js | Core API Orchestration |
| **Telephony** | Twilio Voice API | Global PSTN Connectivity |
| **LLM Inference** | Groq (Llama 3.3 70B) | High-speed NLU (<500ms TTFT) |
| **Voice Synthesis** | ElevenLabs | Human-like TTS (Turkish Optimized) |
| **Database** | Supabase (PostgreSQL) | Persistence & Real-time Client Sync |
| **Automation** | n8n | External API Integrations (Google Cal) |

##  Key Engineering Features

- **Deterministic Data Extraction:** Uses custom Regex parsing to extract structured reservation data from unstructured AI dialogue.
- **Low-Latency Interaction:** Optimized to maintain natural conversational flow under 1 second of total response time.
- **Dynamic Context Injection:** Real-time business services and pricing are injected directly from Supabase into the LLM context.
- **Automated Scheduling:** Fully integrated with Google Calendar for instant appointment booking.

##  Security & Ethical Design

* **Data Minimization:** Follows privacy principles by capturing only essential metadata (Name, Phone, Service).
* **Transparency:** Built-in protocol to identify the assistant as an AI at the start of every session.
* **Environment Security:** All sensitive credentials are managed via `dotenv` and excluded from version control.

##  Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/batuhansisman/Kairos_Intelligent_Voice_Assistant_Platform.git
cd Kairos_Intelligent_Voice_Assistant_Platform
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
NGROK_URL=your_current_ngrok_url
N8N_URL=your_n8n_webhook_url
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_NUMBER=your_twilio_number
GROQ_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
```

### 4. Start the server
```bash
node server.js
```

##  Contributor

* **Lead Developer:** Batuhan Şişman

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
