require('dotenv').config(); // 👈 .env dosyasını okumak için eklendi
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// --- ⚙️ AYARLAR (Çevresel Değişkenlerden Okunuyor) ---
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_NUMBER;
const groqKey = process.env.GROQ_API_KEY;
const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
const ngrokUrl = process.env.NGROK_URL;
const n8nUrl = process.env.N8N_URL || 'http://localhost:5678/webhook-test/calendar-add';

const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_KEY;
const supabase = createClient(sbUrl, sbKey);

const app = express();
const port = process.env.PORT || 3000;
const client = twilio(accountSid, authToken);
const openai = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ses dosyaları için klasör kontrolü ve statik servis
const audioDir = path.join(__dirname, 'public/audio');
if (!fs.existsSync(audioDir)){
    fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));

const callSessions = {}; 

// --- 🌐 ANA DİZİN ---
app.get('/', (req, res) => {
    res.send("<h1>🚀 KAIROS Sunucusu Aktif!</h1><p>Bağlantı başarılı, sistem aramaları bekliyor.</p>");
});

function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '90' + cleaned.substring(1);
    else if (cleaned.startsWith('5')) cleaned = '90' + cleaned;
    return '+' + cleaned;
}

function getNext7DaysContext() {
    const days = [];
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        days.push(`${d.toLocaleDateString('tr-TR', options)} -> ${d.toISOString().split('T')[0]}`);
    }
    return days.join('\n');
}

async function getOrCreateCustomer(phone, name) {
    try {
        const { data: existingCustomer } = await supabase.from('customers').select('id').eq('phone', phone).maybeSingle();
        if (existingCustomer) return existingCustomer.id;
        const { data: newCustomer, error } = await supabase.from('customers').insert([{ full_name: name, phone: phone }]).select().single();
        if (error) throw error;
        return newCustomer.id;
    } catch (error) {
        console.error("❌ Müşteri hatası:", error.message);
        return null;
    }
}

// --- 1. ARAMA BAŞLATMA ---
app.post('/make-call', async (req, res) => {
    let { phone, customerName, businessId } = req.body; 
    const formattedPhone = formatPhoneNumber(phone);
    console.log(`\n📞 Arama Talebi Geldi: ${formattedPhone}`);

    try {
        const { data: business, error } = await supabase.from('businesses').select('*').eq('id', businessId).single();
        if (error || !business) throw new Error("İşletme bulunamadı!");

        let servicesList = [];
        let servicesText = "Hizmet listesi şu an mevcut değil.";
        const rawServices = business.ai_services || business.ai_service; 

        if (rawServices) {
            try {
                servicesList = typeof rawServices === 'string' ? JSON.parse(rawServices) : rawServices;
                servicesText = servicesList.map(s => `- ${s.name} (${s.price} TL) [ID: ${s.id}]`).join('\n');
            } catch (e) { console.error("JSON Parse Hatası"); }
        }

        const customerId = await getOrCreateCustomer(formattedPhone, customerName);
        const welcomeMessage = `Merhaba ${customerName}, ${business.business_name}'den arıyorum. Size nasıl yardımcı olabilirim?`;
        
        const audioUrl = await textToSpeech(welcomeMessage);
        const startUrl = `${ngrokUrl}/twiml-start?audio=${encodeURIComponent(audioUrl || '')}&text=${encodeURIComponent(welcomeMessage)}`;

        console.log("☎️ Twilio Araması Tetikleniyor...");
        const call = await client.calls.create({ to: formattedPhone, from: twilioNumber, url: startUrl });

        callSessions[call.sid] = {
            businessId: business.id,
            customerId: customerId, 
            customerPhone: formattedPhone,
            customerName: customerName,
            businessName: business.business_name,
            servicesList: servicesList,
            messages: [
                { role: "system", content: `KİMLİK: ${business.business_name} asistanısın. HİZMETLER:\n${servicesText}\nTARİHLER:\n${getNext7DaysContext()}\nFORMAT: ||SAVE||YYYY-MM-DD HH:MM||SERVICE_ID||` },
                { role: "assistant", content: welcomeMessage }
            ]
        };

        res.json({ success: true, business: business.business_name });
    } catch (error) {
        console.error("❌ Hata:", error.message);
        res.json({ success: false, error: error.message });
    }
});

// --- YARDIMCI FONKSİYONLAR ---

async function triggerN8NCalendar(rawDateString, customerName, phone, businessName) {
    try {
        const trSaatiStr = rawDateString.replace(' ', 'T') + ':00+03:00';
        const baslangicObj = new Date(trSaatiStr);
        const bitisObj = new Date(baslangicObj.getTime() + 60 * 60 * 1000); 

        await axios.post(n8nUrl, {
            baslangic: baslangicObj.toISOString(),
            bitis: bitisObj.toISOString(),
            name: `Randevu: ${customerName}`,
            desc: `Müşteri: ${customerName}\nTel: ${phone}\nİşletme: ${businessName}`
        });
        return true;
    } catch (error) { console.error("❌ n8n Hatası"); return false; }
}

async function textToSpeech(text) {
    if (!elevenLabsKey) return null;
    try {
        const response = await axios({
            method: 'post', url: `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`,
            data: { text: text, model_id: "eleven_multilingual_v2" },
            headers: { 'xi-api-key': elevenLabsKey },
            responseType: 'arraybuffer'
        });
        const fileName = `${uuidv4()}.mp3`;
        fs.writeFileSync(path.join(audioDir, fileName), response.data);
        return `${ngrokUrl}/audio/${fileName}`;
    } catch (e) { return null; }
}

async function generateAIResponse(callSid, userSpeech) {
    try {
        const session = callSessions[callSid];
        if (!session) return { text: "Bağlantı koptu.", hangup: true };
        session.messages.push({ role: "user", content: userSpeech });

        const completion = await openai.chat.completions.create({
            messages: session.messages, model: "llama-3.3-70b-versatile"
        });

        let aiResponse = completion.choices[0].message.content;
        let shouldHangup = false; 

        const saveMatch = aiResponse.match(/\|\|SAVE\|\|(.*?)\|\|(.*?)\|\|/);
        if (saveMatch) {
            const rawDate = saveMatch[1].trim(); 
            const serviceId = saveMatch[2].trim();
            const service = session.servicesList.find(s => String(s.id) === String(serviceId));
            const foundPrice = service ? service.price : 0;

            await supabase.from('appointments').insert([{
                business_id: session.businessId,
                customer_name: session.customerName,
                customer_phone: session.customerPhone,
                date: rawDate.split(' ')[0],
                time: rawDate.split(' ')[1],
                service_id: serviceId,
                price: foundPrice,
                customer_id: session.customerId, 
                status: 'confirmed'
            }]);

            await triggerN8NCalendar(rawDate, session.customerName, session.customerPhone, session.businessName);
            aiResponse = aiResponse.replace(saveMatch[0], '').trim();
        } 

        if (aiResponse.includes("||HANGUP||")) {
            shouldHangup = true;
            aiResponse = aiResponse.replace("||HANGUP||", "").trim();
        }

        session.messages.push({ role: "assistant", content: aiResponse });
        return { text: aiResponse, hangup: shouldHangup };
    } catch (error) { return { text: "Tekrar eder misiniz?", hangup: false }; }
}

// --- WEBHOOKS ---
app.post('/twiml-start', (req, res) => {
    const { audio, text } = req.query;
    const twiml = new twilio.twiml.VoiceResponse();
    if (audio && audio !== 'undefined' && audio !== '') twiml.play(audio);
    else twiml.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, text);
    twiml.gather({ input: 'speech', action: `${ngrokUrl}/handle-response`, language: 'tr-TR', speechTimeout: 'auto' });
    res.type('text/xml').send(twiml.toString());
});

app.post('/handle-response', async (req, res) => {
    const { CallSid, SpeechResult } = req.body;
    const { text, hangup } = await generateAIResponse(CallSid, SpeechResult || "Duyamadım");
    const audioUrl = await textToSpeech(text);
    const twiml = new twilio.twiml.VoiceResponse();
    if (audioUrl) twiml.play(audioUrl);
    else twiml.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, text);
    
    if (hangup) twiml.hangup();
    else twiml.gather({ input: 'speech', action: `${ngrokUrl}/handle-response`, language: 'tr-TR' });
    res.type('text/xml').send(twiml.toString());
});

app.listen(port, () => console.log(`🚀 KAIROS AKTIF: http://localhost:${port}`));