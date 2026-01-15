const axios = require('axios');

// Senin n8n Webhook Adresin
const n8nUrl = 'http://localhost:5678/webhook-test/calendar-add';

async function testTimezone() {
    console.log("🚀 Saat Farkı Testi Başlatılıyor...");

    // 1. ADIM: Sanki AI bize "Yarın 14:00" demiş gibi bir tarih oluşturalım.
    // Bugünün tarihini alıp yarına çevirelim ki takvimde rahat gör.
    const bugun = new Date();
    const yarin = new Date(bugun);
    yarin.setDate(bugun.getDate() + 1);

    // Format: "YYYY-MM-DD"
    const yil = yarin.getFullYear();
    const ay = String(yarin.getMonth() + 1).padStart(2, '0');
    const gun = String(yarin.getDate()).padStart(2, '0');
    
    // AI'dan gelen ham veri (Simülasyon): "2026-01-11 14:00"
    const yapayZekaCiktisi = `${yil}-${ay}-${gun} 14:00`;
    
    console.log(`🤖 AI'dan Gelen Ham Veri: "${yapayZekaCiktisi}"`);

    // 2. ADIM: Server.js'deki Düzeltme Mantığı (+03:00 Ekleme)
    // "2026-01-11 14:00"  -->  "2026-01-11T14:00:00+03:00"
    const trSaatiStr = yapayZekaCiktisi.replace(' ', 'T') + ':00+03:00';
    
    const baslangicObj = new Date(trSaatiStr);
    const bitisObj = new Date(baslangicObj.getTime() + 60 * 60 * 1000); // 1 Saat Ekle

    // 3. ADIM: Google Takvim için UTC formatına (Z) çevir
    const googleStart = baslangicObj.toISOString();
    const googleEnd = bitisObj.toISOString();

    console.log(`🌍 Google'a Giden (UTC): ${googleStart}`);
    console.log(`✅ Beklenen Sonuç: Takvimde yarın tam 14:00'te görünmeli.`);

    const testVerisi = {
        baslangic: googleStart,
        bitis: googleEnd,
        name: "⏰ SAAT TESTİ (TR Modu)",
        desc: `Bu randevu tam 14:00'te olmalı.\nHam veri: ${yapayZekaCiktisi}`
    };

    try {
        const response = await axios.post(n8nUrl, testVerisi);
        console.log("✅ n8n Yanıt Verdi:", response.status);
        console.log("👉 Şimdi Google Takvimini aç ve yarına bak. Saat 14:00 mü?");
    } catch (error) {
        console.error("❌ Hata:", error.message);
    }
}

testTimezone();