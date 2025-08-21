#!/bin/bash
# ==========================================
# Cursor Automation Script - open-lovable4
# نشر تلقائي على Cloudflare Pages
# ==========================================

set -e  # إيقاف السكربت عند أي خطأ

# 1️⃣ تسجيل الدخول إلى GitHub (تأكد أنك فعلت OAuth أو token)
echo "🔑 تسجيل الدخول إلى GitHub..."
gh auth login

# 2️⃣ استنساخ المستودع
echo "📂 استنساخ مستودع open-lovable4..."
if [ -d "open-lovable4" ]; then
    echo "المجلد موجود بالفعل، تحديث المستودع..."
    cd open-lovable4
    git pull origin main
else
    git clone https://github.com/ai-hub-2/open-lovable4.git
    cd open-lovable4
fi

# 3️⃣ تثبيت التبعيات
echo "📦 تثبيت جميع التبعيات..."
npm install

# 4️⃣ إصلاح static export compatibility
echo "🔧 إصلاح static export compatibility..."
node fix-static-export.js

# 5️⃣ بناء المشروع
echo "🏗️ بناء المشروع..."
npm run build

# 6️⃣ التحقق من مجلد البناء
echo "🔍 التحقق من مجلد البناء..."
if [ ! -d "out" ]; then
    echo "❌ خطأ: مجلد 'out' غير موجود!"
    echo "تأكد من أن next.config.ts يحتوي على 'output: export'"
    exit 1
fi

echo "✅ مجلد البناء موجود: out/"

# 7️⃣ تسجيل الدخول إلى Cloudflare
echo "🌐 تسجيل الدخول إلى Cloudflare..."
wrangler login

# 8️⃣ نشر المشروع على Cloudflare Pages
echo "🚀 نشر المشروع على Cloudflare Pages..."
wrangler pages publish out --project-name=open-lovable4

# 9️⃣ التحقق من آخر نشر
echo "✅ التحقق من آخر نشر..."
wrangler pages deployments list --project-name=open-lovable4

echo "🎉 تم النشر بنجاح على Cloudflare Pages!"
echo "🌐 يمكنك الوصول للموقع من رابط Cloudflare Pages"