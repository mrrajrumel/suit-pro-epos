# Dev Mode Check

## 0. প্রাথমিক সেটআপ - নতুন PC তে সব কিছু ইনস্টল করুন

### প্রয়োজনীয় সফটওয়্যার ইনস্টলেশন

#### ধাপ ১: Git ইনস্টল করুন
1. যান: **https://git-scm.com/download/win**
2. সর্বশেষ Windows installer ডাউনলোড করুন
3. `.exe` ফাইল চালান এবং সব ডিফল্ট সেটিংস দিয়ে Next ক্লিক করুন
4. PowerShell/CMD এ এটি রান করে চেক করুন:
   ```bash
   git --version
   ```
   যদি version দেখায়, Git ইনস্টল হয়েছে ✓

#### ধাপ ২: Node.js এবং npm ইনস্টল করুন
1. যান: **https://nodejs.org/** (LTS version ডাউনলোড করুন)
2. `.msi` installer চালান এবং সব ডিফল্ট সেটিংস দিয়ে Next ক্লিক করুন
3. PowerShell/CMD এ এটি রান করে চেক করুন:
   ```bash
   node --version
   npm --version
   ```
   যদি উভয়ের version দেখায়, সফলভাবে ইনস্টল হয়েছে ✓

---

## 1. Website Setup (Step by Step)

### প্রয়োজনীয়তা
- ✓ **Git** ইনস্টল থাকতে হবে (উপরের ধাপ ১ দেখুন)
- ✓ **Node.js এবং npm** ইনস্টল থাকতে হবে (উপরের ধাপ ২ দেখুন)
- কাজের ডিরেক্টরিতে `package.json` থাকা দরকার

### ইনিশিয়াল সেটআপ
1. **রিপোজিটরি ক্লোন করুন GitHub থেকে:**
   ```bash
   git clone https://github.com/mrrajrumel/suit-pro-epos.git suit-pro-epos
   cd suit-pro-epos
   ```
   
   > নোট: `>>` বা অন্য কোনো প্রম্পট চরিত্র কখনোই লিখবেন না। উপরের কমান্ডগুলো সরাসরি লিখুন বা পেস্ট করুন।
   
2. ডিপেনডেন্সি ইনস্টল করুন:
   ```bash
   npm install
   ```
   
3. `.env` ফাইল চেক করুন (ইতিমধ্যে `.env.example` আছে):
   ```bash
   cp .env.example .env
   ```
   প্রয়োজন অনুযায়ী `.env` ফাইল এডিট করুন।

### ওয়েব ডেভ সার্ভার চালানো
- ওয়েব ডেভ মোড চালাতে:
  ```bash
  npm run dev
  ```
- এই কমান্ডটি একই সাথে:
  1. `server.ts` ব্যাকএন্ড সার্ভার চালায় (`http://localhost:3000`) এবং
  2. Vite ক্লায়েন্ট ডেভ সার্ভার চালায় (`http://localhost:5173`).

### ব্রাউজারে চেক
- ব্রাউজারে খুলুন:
  ```text
  http://localhost:5173
  ```
- যদি `/api/` রিকোয়েস্ট ফেইল করে, নিশ্চিত করুন `npm run dev` চালানো হয়েছে, শুধু `vite` নয়।
- যদি Vite অন্য পোর্ট দেখায়, টার্মিনালে `Local:` বা `Network:` লাইন দেখুন।

### সফলতা চিহ্ন
- React অ্যাপ ব্রাউজারে লোড হচ্ছে
- টার্মিনালে `vite v...` এবং `Local: http://localhost:5173` মেসেজ আছে
- পাশাপাশি `server.ts` ব্যাকএন্ড `http://localhost:3000` চলছে
- ফাইল পরিবর্তনে ব্রাউজার স্বয়ংক্রিয় আপডেট হচ্ছে

### প্রোডাকশন বিল্ড তৈরি
- ওয়েব প্রোডাকশন বিল্ড তৈরি করতে:
  ```bash
  npm run build
  ```
- বিল্ড সফল হলে `dist/` ফোল্ডার তৈরি হবে।

### প্রিভিউ
- প্রিভিউ করতে:
  ```bash
  npm run preview
  ```
- তারপর ব্রাউজারে খুলুন `http://localhost:4173` বা টার্মিনালে দেখানো পোর্ট

## 3. Application Setup (Electron Desktop App)

### Electron ডেভ মোড
- Electron ডেভ মোড চালাতে:
  ```bash
  npm run electron:dev
  ```

### কি হয়
- এটি একই সাথে দুটি প্রক্রিয়া চালায়:
  1. `npm run dev` — Vite ক্লায়েন্ট সার্ভার এবং ব্যাকএন্ড সার্ভার চালায়
  2. `wait-on http://localhost:5173 && electron .` — Vite UI লোড হয়ে গেলে Electron উইন্ডো খুলবে

### চেকের বিষয়
- একটি Electron উইন্ডো খোলে
- অ্যাপ UI লোড হয়
- টার্মিনালে `http://localhost:5173` এবং `http://localhost:3000` সার্ভারগুলো চলছে কিনা দেখুন
- ফাইল পরিবর্তনে Electron ভিউ আপডেট হচ্ছে কিনা

### Electron রিলিজ তৈরি
- অ্যাপ প্যাকেজ বানাতে:
  ```bash
  npm run electron:build
  ```
- এটি `electron-builder` ব্যবহার করে ইনস্টলার বা এক্সিকিউটেবল বানায়

### অ্যাপ বিল্ড করলে কি দেখবেন
- `dist/` বা `build/` ফোল্ডারে প্যাকেজ তৈরি হবে
- উইন্ডোজ/ম্যাক ইন্সটলার বা পোর্টেবল এক্সিকিউটেবল তৈরি হতে পারে

## 4. Backend / Server Setup

### সার্ভার আলাদাভাবে চালানো
- ব্যাকএন্ড সার্ভার চালাতে:
  ```bash
  npm run server
  ```

### কি চেক করবেন
- সার্ভার `http://localhost:3000` এ এক্সেসযোগ্য
- ব্রাউজারে বা Postman/Insomnia এ GET/POST রিকোয়েস্ট পাঠিয়ে দেখুন

## 5. Quick Setup Summary

- ওয়েব ডেভ: `npm install` → `npm run dev` → `http://localhost:5173`
- ব্যাকএন্ড সার্ভার: `http://localhost:3000` (same command starts both backend and frontend)
- ওয়েব প্রোডাকশন বিল্ড: `npm run build`
- ওয়েব প্রিভিউ: `npm run preview`
- Electron ডেভ: `npm run electron:dev`
- Electron বিল্ড: `npm run electron:build`

## 6. ট্রাবলশুটিং
### Windows PowerShell Execution Policy Error
**সমস্যা:** `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled`

**সমাধান:**
1. PowerShell কে **Administrator** হিসেবে খুলুন (ডান ক্লিক > Run as administrator)
2. এই কমান্ড চালান:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. `Y` দিয়ে confirm করুন
4. এখন `npm` কমান্ড চলবে

### অন্যান্য সমস্যা- যদি `vite` কমান্ড না পড়ে, `npm install` আবার চালান
- যদি `electron` না থেকে থাকে, `npm install` নিশ্চিত করুন
- পোর্ট কনফ্লিক্ট হলে অন্য ব্রাউজারে বা টার্মিনালে `localhost:5173` এবং `localhost:3000` চেক করুন

> নোট: `npm run electron:dev` কাজ না করলে প্রথমে `npm run dev` চালান, এরপর অন্য টার্মিনালে `electron .` চালিয়ে দেখুন।