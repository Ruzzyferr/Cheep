# 🔑 Environment Variables Setup Guide

## OpenAI API Kullanımı

### 1. .env Dosyası Oluştur

`Cheep-Scraper/` klasöründe `.env` dosyası oluşturun:

```bash
# Windows PowerShell veya Linux/Mac Terminal
cd Cheep-Scraper
touch .env  # Linux/Mac
# veya
New-Item .env  # Windows PowerShell
```

### 2. OpenAI API Key Alın

1. [OpenAI Platform](https://platform.openai.com/) üzerinden hesap oluşturun
2. [API Keys](https://platform.openai.com/api-keys) sayfasına gidin
3. "Create new secret key" butonuna tıklayın
4. Key'i kopyalayın (bir daha gösterilmeyecek!)

### 3. .env Dosyasını Düzenleyin

`.env` dosyasına şu satırı ekleyin:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Önemli:**
- `sk-your-actual-api-key-here` yerine gerçek API key'inizi yazın
- Key `sk-` ile başlamalı

### 4. Doğrulama

Script çalıştığında şu mesajı görmelisiniz:
```
✅ .env dosyası yüklendi: C:\Users\ruzzy\IdeaProjects\Cheep\Cheep-Scraper\.env
[Matcher] OpenAI API kullanılıyor - Model: gpt-4o-mini
```

---

## ⚙️ Seçenekler

### Sadece OpenAI Kullanmak İçin

```env
# .env dosyası
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Yapmanız gerekenler:**
- ✅ `OPENAI_API_KEY` set edin
- ❌ `OPENROUTER_API_KEY` set ETMEYİN
- ❌ `USE_OPENROUTER` set ETMEYİN (veya `false` yapın)

### Model Değiştirmek

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
LLM_MODEL=gpt-4o-mini  # veya gpt-4, gpt-3.5-turbo, vs.
```

### OpenRouter Kullanmak (Alternatif)

Eğer OpenRouter kullanmak istiyorsanız:

```env
# OpenAI yerine OpenRouter
OPENROUTER_API_KEY=sk-or-your-openrouter-key-here
USE_OPENROUTER=true
LLM_MODEL=openai/gpt-4o-mini
```

**Not:** OpenRouter kullanmak için `USE_OPENROUTER=true` veya `OPENROUTER_API_KEY` set edilmeli. Her ikisi de varsa OpenRouter önceliklidir.

---

## 🔒 Güvenlik

- ✅ `.env` dosyası `.gitignore`'da, Git'e commit edilmez
- ✅ API key'inizi asla kod içine yazmayın
- ✅ API key'inizi paylaşmayın
- ✅ API key'inizi GitHub'a yüklemeyin

---

## 🐛 Sorun Giderme

### "OPENAI_API_KEY veya OPENROUTER_API_KEY environment variable gerekli!" Hatası

**Çözüm:**
1. `.env` dosyasının `Cheep-Scraper/` klasöründe olduğundan emin olun
2. `.env` dosyasında `OPENAI_API_KEY=sk-...` formatının doğru olduğundan emin olun
3. Script'i yeniden çalıştırın

### OpenRouter kullanıyor ama OpenAI istiyorum

**Çözüm:**
1. `.env` dosyasından `OPENROUTER_API_KEY` satırını silin
2. `.env` dosyasından `USE_OPENROUTER=true` satırını silin (veya `false` yapın)
3. `OPENAI_API_KEY=sk-...` satırının olduğundan emin olun
4. Script'i yeniden çalıştırın

---

## 📝 Örnek .env Dosyası

```env
# OpenAI API Key
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Model (opsiyonel)
LLM_MODEL=gpt-4o-mini

# Auto-create subcategories (opsiyonel)
AUTO_CREATE_SUBCATEGORIES=false
```





