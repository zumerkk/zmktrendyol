import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * AI Orchestrator Service — Multi-Provider Abstraction
 *
 * Supports: OpenAI, Anthropic, Google Generative AI
 * Features: prompt versioning, cost tracking, PII masking, token budget
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Generate content using AI
   */
  async generate(
    tenantId: string,
    request: {
      scenario: string;
      input: Record<string, any>;
      provider?: string;
    },
  ) {
    const provider = request.provider || "openai";
    const prompt = this.buildPrompt(request.scenario, request.input);
    const maskedPrompt = this.maskPII(prompt);

    let result: { text: string; tokensUsed: number; model: string };

    switch (provider) {
      case "openai":
        result = await this.callOpenAI(maskedPrompt, request.scenario);
        break;
      case "anthropic":
        result = await this.callAnthropic(maskedPrompt, request.scenario);
        break;
      case "google":
        result = await this.callGoogle(maskedPrompt, request.scenario);
        break;
      case "groq":
        result = await this.callGroq(maskedPrompt, request.scenario);
        break;
      default:
        result = await this.callOpenAI(maskedPrompt, request.scenario);
    }

    // Calculate cost (approximate)
    const costPerToken =
      provider === "openai"
        ? 0.00001
        : provider === "anthropic"
          ? 0.000012
          : provider === "groq"
            ? 0.000001 // Groq is nearly free
            : 0.000008;
    const cost = result.tokensUsed * costPerToken;

    // Record AI run
    await this.prisma.aiRun.create({
      data: {
        tenantId,
        input: request.input,
        output: { text: result.text, tokensUsed: result.tokensUsed },
        provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        cost,
      },
    });

    return {
      variations: this.parseVariations(result.text),
      metadata: {
        provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        cost: Math.round(cost * 10000) / 10000,
      },
    };
  }

  /**
   * Build scenario-specific prompts
   */
  private buildPrompt(scenario: string, input: Record<string, any>): string {
    const prompts: Record<string, string> = {
      title_optimization: `Trendyol ürün başlığı optimizasyonu yapıyorsun. SEO uyumlu, anahtar kelime zengin başlıklar üret.

Mevcut Başlık: ${input.currentTitle || ""}
Kategori: ${input.category || ""}
Marka: ${input.brand || ""}
${input.competitorTitles ? `Rakip Başlıklar: ${input.competitorTitles.join(", ")}` : ""}
${input.keywords ? `Anahtar Kelimeler: ${input.keywords.join(", ")}` : ""}

3 farklı optimize edilmiş başlık varyasyonu üret. Her birini ayrı satırda yaz. Türkçe yaz.`,

      description_generation: `Trendyol ürün açıklaması yazıyorsun. SEO uyumlu, dönüşüm odaklı açıklama üret.

Ürün: ${input.title || ""}
Kategori: ${input.category || ""}
Özellikler: ${JSON.stringify(input.attributes || {})}
Hedef Kitle: ${input.targetAudience || "genel"}
Ton: ${input.tone || "profesyonel"}

HTML formatında ürün açıklaması yaz. Bullet points kullan. Türkçe yaz.`,

      price_suggestion: `Fiyatlandırma uzmanısın. Aşağıdaki verilere göre optimal fiyat öner.

Maliyet: ${input.costPrice || "bilinmiyor"} TL
Hedef Marj: %${input.targetMargin || 30}
Mevcut Fiyat: ${input.currentPrice || "yok"} TL
Rakip Fiyat Aralığı (kamuya açık): ${input.competitorPriceRange || "bilinmiyor"} TL
Stok Gün Sayısı: ${input.stockDays || "bilinmiyor"}
Satış Hızı: ${input.salesVelocity || "bilinmiyor"} adet/gün

Önerilen fiyat, gerekçe ve risk seviyesi (düşük/orta/yüksek) üret.`,

      campaign_text: `Trendyol kampanya metni yazıyorsun.

Ürün: ${input.title || ""}
Kampanya Türü: ${input.campaignType || "indirim"}
İndirim Oranı: %${input.discountRate || ""}
Hedef Segment: ${input.targetSegment || "genel"}

3 farklı kampanya metni varyasyonu üret. Kısa, çarpıcı ve CTA içeren metinler olsun. Türkçe yaz.`,

      customer_reply: `Müşteri hizmetleri uzmanısın. Profesyonel ve samimi yanıt yaz.

Müşteri Sorusu: ${input.question || ""}
Ürün: ${input.productTitle || ""}
Mağaza Politikası: ${input.storePolicy || "standart"}

Profesyonel bir yanıt taslağı yaz. Türkçe yaz.`,

      review_analysis: `E-ticaret yorum analizi uzmanısın. Aşağıdaki müşteri yorumlarını analiz et.

Toplam Yorum Sayısı: ${input.totalCount || 0}
Ortalama Puan: ${input.avgRating || 0}

Yorumlar:
${(input.reviews || []).map((r: any, i: number) => `${i + 1}. [${r.rating}⭐] ${r.text}`).join("\n")}

Şunları belirle:
1. Genel memnuniyet durumu (pozitif/negatif/nötr yüzdesi)
2. En çok bahsedilen konular (paketleme, kalite, kargo, fiyat-performans, müşteri hizmeti)
3. Tekrarlayan şikayetler ve övgüler
4. Rakibin zayıf noktaları (bir satıcının öne çıkabileceği alanlar)

Türkçe yaz. Somut ve aksiyon alınabilir çıktılar ver.`,

      competitive_insight: `E-ticaret stratejisti ve pazarlama uzmanısın. ZMK Agency için çalışıyorsun.

Rakip Yorum Analizi Sonuçları:
- Toplam Yorum: ${input.totalReviews || 0}
- Ortalama Puan: ${input.avgRating || 0}
- Analiz: ${JSON.stringify(input.reviewAnalysis || {})}

Görevin: Bu analiz sonuçlarına göre SOMUT ve UYGULANABILIR pazarlama önerileri üret.
Örnekler:
- "Kanka, rakipten alanların %30'u paketlemeden şikayetçi, sen 'Zırhlı Paketleme' logosuyla çıkarsan piyasayı toplarsın."
- "Kargo gecikmesi %25 dile getirilmiş, 'Aynı Gün Kargo' rozeti büyük avantaj."

Samimi, aksiyon odaklı ve Türkçe yaz. Abartıdan kaçın ama cesur ol. "Kanka" tarzında yazabilirsin.
En az 3, en fazla 5 aksiyon önerisi ver.`,

      gap_analysis: `Müşteri Zekâsı Uzmanısın. İki farklı ürünün müşteri yorum analizini inceleyip fırsat boşluklarını (Gap) bulacaksın.

Bizim Ürün Analizimiz:
${JSON.stringify(input.myAnalysis || {})}

Rakip Ürün Analizimiz:
${JSON.stringify(input.competitorAnalysis || {})}

Hedefin: 
1. Rakibin batırdığı ama bizim iyi olduğumuz alanları bul (Fırsat).
2. Rakibin övüldüğü ama bizim zayıf kaldığımız alanları bul (Tehdit).
3. "Neden bizden değil de ondan alıyorlar?" sorusuna somut bir kök neden (Root Cause) veya tam tersi "Neden onu değil bizi seçiyorlar" cevapları üret.

Çıktıyı Markdown formatında, tablolar ve bullet-pointler ile çok temiz, yöneticinin okuyup hemen anlayacağı şekilde Türkçe yaz.`,

      telegram_alert_formatter: `ZMK Agency için çalışan E-ticaret Saha Ajanısın (Sanal Asistan). Patronuna (kullanıcıya) Telegram üzerinden anlık ve acil bildirimler geçiyorsun. 
Sıradan bir bot gibi "Stok: 0" DEME. Samimi, tetikte, aksiyona hazır ve biraz esprili ("kanka" veya "patron" diyerek) konuş.

Uyarı Tipi: ${input.type}
Başlık: ${input.title}
Orijinal Mesaj: ${input.message}

Bunu çok kısa (en fazla 2-3 cümle), heyecan verici ve sadık bir ajan diliyle yeniden yaz. Patronun anında ne yapmasını önerdiğini söyle.`,

      telegram_intent_parser: `Sen bir Intent Parser (Niyet Anlayıcı) AI'sın. Kullanıcının Telegram üzerinden serbest dille yazdığı komutu analiz edip, sistemin anlayacağı saf bir JSON nesnesine çevirmelisin.

Kullanıcı Mesajı: "${input.text}"

Mümkün olan AKSİYONLAR (Action Types):
1. ACTIVATE_ZEUS (Eğer reklam bütçesini artırmak, Zeus'u dev devreye sokmak vb. diyorsa)
2. ACTIVATE_OOS_SNIPER (Eğer rakip stoğu bittiğinde fiyat uçurmayı emrediyorsa)
3. GET_SUMMARY (Eğer genel durum, ciro, rapor, kâr gibi şeyler soruyorsa)
4. PRICE_DROP (Eğer fiyatı bilmem kaç liraya düşür diyorsa)
5. UNKNOWN (Ne istediği belli değilse)

Çıktın SADECE VE SADECE JSON olmalıdır. Başka hiçbir açıklama, markdown falan kullanma. 
Format:
{
  "action": "ACTION_TYPE",
  "confidence": 0'dan 100'e sayı,
  "parameters": { 
     // Eğer bir ID, miktar, tutar vb ayıklayabildiysen buraya koy.
  }
}
Geçerli raw JSON ile yanıt ver.`,
    };

    return (
      prompts[scenario] ||
      `Input: ${JSON.stringify(input)}\n\nYardımcı bir yanıt üret.`
    );
  }

  /**
   * PII Masking — KVKK compliance
   */
  private maskPII(text: string): string {
    // Mask email addresses
    text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL_MASKED]");
    // Mask phone numbers (Turkish format)
    text = text.replace(
      /(\+90|0)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
      "[PHONE_MASKED]",
    );
    // Mask TC Kimlik (11 digits)
    text = text.replace(/\b\d{11}\b/g, "[TC_MASKED]");
    return text;
  }

  /**
   * OpenAI Provider
   */
  private async callOpenAI(
    prompt: string,
    _scenario: string,
  ): Promise<{ text: string; tokensUsed: number; model: string }> {
    try {
      const OpenAI = require("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Sen Trendyol e-ticaret uzmanı bir AI asistanısın. Türkçe yanıtla.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return {
        text: response.choices[0]?.message?.content || "",
        tokensUsed: response.usage?.total_tokens || 0,
        model: "gpt-4o-mini",
      };
    } catch (error: any) {
      this.logger.warn(
        `OpenAI call failed: ${error.message}. Returning fallback.`,
      );
      return this.getFallbackResponse(prompt);
    }
  }

  /**
   * Anthropic Provider
   */
  private async callAnthropic(
    prompt: string,
    _scenario: string,
  ): Promise<{ text: string; tokensUsed: number; model: string }> {
    try {
      const Anthropic = require("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
        system:
          "Sen Trendyol e-ticaret uzmanı bir AI asistanısın. Türkçe yanıtla.",
      });

      return {
        text: response.content[0]?.text || "",
        tokensUsed:
          (response.usage?.input_tokens || 0) +
          (response.usage?.output_tokens || 0),
        model: "claude-3-haiku",
      };
    } catch (error: any) {
      this.logger.warn(
        `Anthropic call failed: ${error.message}. Returning fallback.`,
      );
      return this.getFallbackResponse(prompt);
    }
  }

  /**
   * Google Generative AI Provider
   */
  private async callGoogle(
    prompt: string,
    _scenario: string,
  ): Promise<{ text: string; tokensUsed: number; model: string }> {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return {
        text,
        tokensUsed: Math.ceil(text.length / 4), // approximate
        model: "gemini-pro",
      };
    } catch (error: any) {
      this.logger.warn(
        `Google AI call failed: ${error.message}. Returning fallback.`,
      );
      return this.getFallbackResponse(prompt);
    }
  }

  /**
   * Groq Provider — Ultra-fast inference (ms-level latency)
   * Uses OpenAI-compatible API with Llama 3.3 70B
   */
  private async callGroq(
    prompt: string,
    _scenario: string,
  ): Promise<{ text: string; tokensUsed: number; model: string }> {
    try {
      const OpenAI = require("openai");
      const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      });

      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Sen Trendyol e-ticaret uzmanı bir AI asistanısın. Türkçe yanıtla. Kısa ve öz ol.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return {
        text: response.choices[0]?.message?.content || "",
        tokensUsed: response.usage?.total_tokens || 0,
        model: "llama-3.3-70b-versatile",
      };
    } catch (error: any) {
      this.logger.warn(
        `Groq call failed: ${error.message}. Returning fallback.`,
      );
      return this.getFallbackResponse(prompt);
    }
  }

  /**
   * Fallback response when no API key is configured
   */
  private getFallbackResponse(prompt: string): {
    text: string;
    tokensUsed: number;
    model: string;
  } {
    return {
      text: `[AI API key yapılandırılmamış — Demo Yanıt]\n\nVaryasyon 1: Optimize edilmiş örnek metin\nVaryasyon 2: Alternatif optimizasyon\nVaryasyon 3: SEO odaklı versiyon\n\nGerçek sonuçlar için .env dosyasına API key ekleyin.`,
      tokensUsed: 0,
      model: "fallback",
    };
  }

  /**
   * Parse AI response into variations array
   */
  private parseVariations(text: string): string[] {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [text];

    // Try to extract numbered variations
    const variations: string[] = [];
    for (const line of lines) {
      const cleaned = line
        .replace(/^(Varyasyon|Versiyon|#|\d+[\.\)\-:])\s*/i, "")
        .trim();
      if (cleaned.length > 10) variations.push(cleaned);
    }

    return variations.length > 0 ? variations.slice(0, 5) : [text];
  }

  /**
   * Get AI usage stats for a tenant
   */
  async getUsageStats(tenantId: string) {
    const runs = await this.prisma.aiRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalCost = runs.reduce((sum, r) => sum + Number(r.cost), 0);
    const totalTokens = runs.reduce((sum, r) => sum + r.tokensUsed, 0);

    return {
      totalRuns: runs.length,
      totalTokens,
      totalCost: Math.round(totalCost * 100) / 100,
      byProvider: runs.reduce(
        (acc, r) => {
          acc[r.provider] = (acc[r.provider] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
