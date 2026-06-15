# Complete Deployment Setup Guide

এই ফাইলটি তিনটি অংশে বিভক্ত:
1. Hostinger ওয়েবসাইট সেটআপ
2. Windows অ্যাপ প্যাকেজ তৈরি
3. Linux অ্যাপ প্যাকেজ তৈরি

---

## 1. Hostinger ওয়েবসাইট সেটআপ

### 1.1. পর্দা প্রস্তুতি
1. Node.js ইনস্টল করুন। Hostinger সার্ভারে Node.js সাপোর্ট আছে কিনা চেক করুন।
2. Git ইনস্টল থাকলে সুবিধা হবে।
3. আপনার প্রোজেক্ট ফোল্ডারটি Hostinger-এ আপলোড করুন বা Git রিপোজিটরি থেকে ক্লোন করুন।

### 1.2. Git এর মাধ্যমে ফাইল আপলোড
1. Hostinger-এ লগইন করুন।
2. hPanel-এ যান।
3. Advanced > Git-এ যান।
4. নতুন রিপোজিটরি তৈরি করুন বা আপনার রিপোজিটরি URL ব্যবহার করুন।
5. Destination path হিসাবে `public_html` বা আপনার পছন্দের ফোল্ডার দিন।
6. Deploy করুন।

### 1.3. ডিপেনডেন্সি ইনস্টল
Hostinger-এ টার্মিনাল বা SSH ব্যবহার করে:
```bash
cd /path/to/your/project
npm install
```

### 1.4. `.env` সেটআপ
Hostinger-এ `public_html` বা প্রোজেক্ট রুটে `.env` ফাইল তৈরি করুন।
নিম্নলিখিত কনফিগারেশন ব্যবহার করুন:
```env
DB_HOST=localhost
DB_NAME=u473489494_suitproepos
DB_USER=u473489494_suitproepos
DB_PASSWORD=Rum3l@1998
DB_PORT=3306
NEXT_PUBLIC_API_URL=https://epos.suitprolondon.com/
APP_SECURITY_KEY=5566
```
> `NODE_ENV` production mode should not be set inside `.env` for the Vite client build. Set it only in the shell when building or running the server.


### 1.5. ডাটাবেস তৈরি ও রিস্টোর
1. hPanel > Databases > MySQL Databases এ যান।
2. ডাটাবেস `u473489494_suitproepos` তৈরি করুন।
3. ইউজার `u473489494_suitproepos` এবং পাসওয়ার্ড `Rum3l@1998` সেট করুন।
4. phpMyAdmin এ যান, ডাটাবেস সিলেক্ট করুন।
5. `database_schema.sql` খুলুন ও সম্পাদিত SQL কোড কপি করে phpMyAdmin-এ পেস্ট করুন।
6. Execute করুন।

### 1.6. প্রোডাকশন বিল্ড
```bash
npm run build
```

### 1.7. ভেন্ডর/সার্ভার রান
Hostinger এ Node.js অ্যাপ ম্যানেজার ব্যবহার করলে:
- Entry point: `dist/server.cjs`
- Start command: `npm run start`
- Node version: 18+ বা 20+

যদি সরাসরি SSH চালাতে চান:
```bash
npm run build
npm run server
```

### 1.8. URL ও ব্যবস্থাপনা
- যদি Angular/Vite ফ্রন্ট-এ সার্ভার প্রিভিউ প্রয়োজন হয়, `npm run preview` ব্যবহার করতে পারেন।
- ব্রাউজারে ওয়েবসাইট খুলুন `https://your-domain.com`

### 1.9. সমস্যা হলে চেক করুন
- `.env` ফাইল পড়ছে কিনা
- `npm install` সম্পন্ন হয়েছে কিনা
- `npm run build` ত্রুটিমুক্ত হয়েছে কিনা
- সার্ভার `http://localhost:3000` এ চলছে কিনা

---

## 2. Windows অ্যাপ প্যাকেজ তৈরি

### 2.1. প্রয়োজনীয়তাসমূহ
- Windows এ Node.js ইনস্টল
- `npm install` চলতে হবে
- `electron` ও `electron-builder` ইনস্টল থাকতে হবে (এগুলা `package.json` এ আছে)

### 2.2. ইলেকট্রন ডেভ মোড
ডেভ মোডে অ্যাপ পরীক্ষা করতে:
```bash
npm run electron:dev
```

> নোট: এই কমান্ডটি `npm run dev` চালিয়ে Vite (`http://localhost:5173`) এবং ব্যাকএন্ড সার্ভার (`http://localhost:3000`) একসঙ্গে চালায়, তারপর Electron উইন্ডো খুলবে।

### 2.3. Windows বিল্ড
1. প্রথমে নিশ্চিত করুন `electron-builder` ইনস্টল আছে:
```bash
npm install
```
2. বিল্ড চালান:
```bash
npm run electron:build
```

### 2.4. বিল্ড শেষে ফাইল কোথায় থাকে
- সাধারণত `dist/` ফোল্ডারে বিল্ড তৈরি হয়
- যদি `electron-builder` কনফিগার করা থাকে তাহলে `.exe` বা পোর্টেবল ইনস্টলার তৈরি হবে

### 2.5. Windows ইনস্টলার বা এক্সিকিউটেবল চালানো
- `dist/` ফোল্ডারে যান
- তৈরি `.exe` ফাইল ডাবল ক্লিক করুন
- উইন্ডোজ অ্যাপ ইন্সটল বা রান করুন

### 2.6. Windows অ্যাপে ডিবাগ
- `npm run electron:dev` চালান
- টার্মিনালে কোন এরর দেখলে প্রথমে তা ঠিক করুন
- নিশ্চিত করুন `http://localhost:5173` এবং `http://localhost:3000` উভয় সার্ভার চলছে

---

## 3. Linux অ্যাপ প্যাকেজ তৈরি

### 3.1. প্রয়োজনীয়তা
- Linux-এ Node.js ও npm ইনস্টল
- `npm install` সফলভাবে চলতে হবে
- `electron`/`electron-builder` ইনস্টল থাকতে হবে

### 3.2. Linux ডেভ মোড
Linux-এ Electron অ্যাপ পরীক্ষা করতে:
```bash
npm run electron:dev
```

### 3.3. Linux বিল্ড
1. বিল্ড লঞ্চ করতে:
```bash
npm install
npm run electron:build
```

2. যদি Linux টার্গেট স্পেসিফিক প্যাকেজ দরকার হয়, `electron-builder` কনফিগার নিয়ে দেখুন।

### 3.4. Linux রিলিজ ফাইল
- বিল্ড শেষ হলে `dist/` ফোল্ডারে `.AppImage`, `.deb`, বা `.rpm` তৈরি হতে পারে
- উপযুক্ত ফাইল ব্যবহার করে ইন্সটল করুন

### 3.5. Linux এ চালানো
- যদি `.AppImage` হয়:
```bash
chmod +x path/to/file.AppImage
./path/to/file.AppImage
```
- যদি `.deb` হয়:
```bash
sudo dpkg -i path/to/package.deb
```
- যদি `.rpm` হয়:
```bash
sudo rpm -i path/to/package.rpm
```

### 3.6. Linux ডিবাগ
- টার্মিনালে `npm run electron:dev` চালিয়ে কোন ত্রুটি দেখুন
- নিশ্চিত করুন `X11` বা `Wayland` সাপোর্ট আছে

---

## 4. Git এবং প্রোজেক্ট প্রস্তুতি

### 4.1. Git ইনিশিয়ালাইজ
```bash
cd suit-pro-epos
git init
git add .
git commit -m "Initial setup"
```

### 4.2. GitHub / GitLab এ পুশ
```bash
git remote add origin https://github.com/username/repo.git
git branch -M main
git push -u origin main
```

### 4.3. Hostinger বা অন্য সার্ভারে ডেপ্লয়
- Hostinger Git সাপোর্ট থাকলে রিপোজিটরি URL ব্যবহার করুন
- অন্যথায় FTP বা File Manager থেকে প্রোজেক্ট ফাইল আপলোড করুন

---

## 5. সার্ভার ও অ্যাপ পরীক্ষার দ্রুত রেফারেন্স

- ওয়েব ডেভ: `npm run dev`
- ওয়েব প্রোডাকশন: `npm run build`
- ওয়েব প্রিভিউ: `npm run preview`
- Electron ডেভ: `npm run electron:dev`
- Electron বিল্ড: `npm run electron:build`
- ব্যাকএন্ড সার্ভার: `npm run server`

> নোট: Hostinger এ ডেপ্লয় করার সময় Node.js ভার্সন 18 বা 20+ সিলেক্ট করুন এবং `.env` কনফিগারেশন সঠিক আছে কিনা নিশ্চিত করুন।