# 🚀 دليل النشر على Cloudflare Pages

## 📋 **الطريقة المختارة: Git Integration (الأفضل والأضمن)**

### ✨ **المميزات:**
- ✅ نشر تلقائي عند كل commit
- ✅ لا حاجة لـ CLI
- ✅ إدارة أفضل للإصدارات
- ✅ rollback سهل
- ✅ preview deployments

---

## 🛠️ **الإعداد الأولي (مرة واحدة فقط)**

### 1️⃣ **إنشاء مشروع Cloudflare Pages:**

1. اذهب إلى [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. اختر **Pages** من القائمة الجانبية
3. اضغط **Create a project**
4. اختر **Connect to Git**
5. اختر GitHub واختر مستودع `open-lovable4`

### 2️⃣ **إعدادات البناء:**

```
Build command: npm run build
Build output directory: .next
Root directory: /
Node.js version: 18
```

### 3️⃣ **إعداد Environment Variables:**

إذا كنت تحتاج متغيرات بيئية، أضفها في:
- **Environment variables** tab
- أو استخدم **Secrets** للمعلومات الحساسة

---

## 🔄 **النشر التلقائي**

### **عند كل push إلى main:**
1. GitHub Actions يعمل تلقائياً
2. يبني المشروع
3. ينشر على Cloudflare Pages
4. يرسل إشعار بالنجاح

### **عند كل Pull Request:**
1. يتم إنشاء preview deployment
2. يمكنك اختبار التغييرات
3. عند merge يتم النشر على production

---

## 🚀 **النشر اليدوي (اختياري)**

### **بناء وتصدير:**
```bash
npm run build
```

### **نشر preview:**
```bash
npm run deploy:preview
```

### **نشر production:**
```bash
npm run deploy:production
```

---

## 📁 **ملفات النشر المهمة**

- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `wrangler.toml` - إعدادات Cloudflare
- `next.config.ts` - إعدادات Next.js للتصدير
- `package.json` - scripts النشر

---

## 🔧 **استكشاف الأخطاء**

### **مشكلة في البناء:**
```bash
npm run clean
npm run build:clean
```

### **مشكلة في النشر:**
1. تحقق من GitHub Actions logs
2. تأكد من صحة API tokens
3. تحقق من إعدادات المشروع في Cloudflare

---

## 📊 **مراقبة النشر**

### **في Cloudflare Dashboard:**
- Pages > open-lovable4 > Deployments
- يمكنك رؤية جميع الإصدارات
- إمكانية rollback لأي إصدار

### **في GitHub:**
- Actions tab
- يمكنك رؤية سجل النشر
- تفاصيل كل خطوة

---

## 🎯 **الخطوات التالية**

1. **ارفع الكود إلى GitHub:**
   ```bash
   git add .
   git commit -m "🚀 إعداد النشر التلقائي على Cloudflare Pages"
   git push origin main
   ```

2. **أنشئ مشروع Cloudflare Pages** (كما هو موضح أعلاه)

3. **أضف Secrets في GitHub:**
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

4. **استمتع بالنشر التلقائي! 🎉**

---

## 📞 **الدعم**

إذا واجهت أي مشكلة:
1. تحقق من GitHub Actions logs
2. راجع إعدادات Cloudflare Pages
3. تأكد من صحة API tokens
4. تحقق من `next.config.ts`

**النشر التلقائي سيعمل من الآن فصاعداً! 🚀**