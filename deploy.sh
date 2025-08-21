#!/bin/bash
# ==========================================
# Cursor Automation Script - open-lovable4
# نشر تلقائي على Cloudflare Pages
# ==========================================

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

# 4️⃣ بناء المشروع
echo "🏗️ بناء المشروع..."
npm run build

# 5️⃣ إعداد متغيرات البيئة (إذا موجودة)
# مثال: wrangler secret put VARIABLE_NAME
# echo "🔧 إعداد المتغيرات البيئية..."
# wrangler secret put VARIABLE_NAME

# 6️⃣ ربط Cloudflare Pages (تأكد أنك فعلت الحساب)
echo "🌐 نشر المشروع على Cloudflare Pages..."
# هنا يستخدم wrangler لنشر المشروع
wrangler pages publish out --project-name=open-lovable4

# 7️⃣ التحقق من آخر نشر
echo "✅ التحقق من آخر نشر..."
wrangler pages deployments list --project-name=open-lovable4

echo "🎉 تم النشر بنجاح على Cloudflare Pages!"