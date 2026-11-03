# 📮 POST Family AutoFill (Chrome Extension)

> ส่วนขยาย Google Chrome สำหรับช่วยกรอกข้อมูลสมัครสมาชิก **POST Family (ไปรษณีย์ไทย)** อัตโนมัติ โดยใช้ขุมพลัง AI (Google Gemini API) ในการวิเคราะห์และสกัดข้อมูลจากรูปหรือข้อความที่มีข้อมูลจำเป็นต้องกรอก

---

## ✨ ฟีเจอร์หลัก (Key Features)

- 📑 **ทางลัดเริ่มต้น Step 1**: คลิกเดียวเพื่อเปิดหน้าลงทะเบียน POST Family พร้อมติ๊กยอมรับเงื่อนไขและกดยอมรับข้อตกลงอัตโนมัติ
- 🧠 **วิเคราะห์ข้อมูลด้วย Gemini AI**: สกัดข้อมูลที่จำเป็นต้องกรอก เช่น ชื่อ-นามสกุล, ว/ด/ป เกิด, เบอร์โทร, ที่อยู่ ฯลฯ จากรูปหรือข้อความที่มีข้อมูลสำหรับการสมัคร POST Family
- 🎁 **ระบบจัดการ Referral Code Bank**: บันทึกและเลือกแท็ก "หมายเลขสมาชิกที่แนะนำ" และ "รหัสไปรษณีย์ที่แนะนำ" ได้สะดวกรวดเร็ว
- 📝 **หน้าต่างตรวจสอบข้อมูล (Review Form)**: ตรวจทานหรือแก้ไขข้อมูลก่อนสั่งกรอกลงในเว็บ
- ⚡ **รองรับ Quasar Framework**: ระบบคลิกเลือก Dropdown อัตโนมัติสำหรับ วัน/เดือน/ปีเกิด และ ตำบล/อำเภอ/จังหวัด ที่ใช้ Quasar บนเว็บไซต์ได้อย่างแม่นยำ

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
post-family-autofill/
├── manifest.json       # ไฟล์การตั้งค่า Extension (Manifest V3)
├── background.js       # Service worker จัดการ Side Panel และ Gemini API Call
├── content.js          # สคริปต์กรอกฟอร์มอัตโนมัติบนหน้าเว็บ POST Family
├── popup.html          # หน้าตาอินเทอร์เฟซ Side Panel
├── popup.js            # ตรรกะการทำงาน UI, จัดการ Clipboard, แท็กรหัสแนะนำ และเชื่อมต่อ Content Script
├── icon16.png          # ไอคอนขนาด 16x16
├── icon48.png          # ไอคอนขนาด 48x48
├── icon128.png         # ไอคอนขนาด 128x128
├── .gitignore          # ละเว้นไฟล์ที่ไม่จำเป็น
└── README.md           # เอกสารแนะนำการติดตั้งและใช้งาน
```

---

## 📥 วิธีติดตั้งใช้งานในเครื่อง (Installation)

1. Clone หรือ Download โปรเจกต์นี้ลงเครื่อง:
   ```bash
   git clone https://github.com/fiwflash/post-family-autofill.git
   ```
2. เปิด Google Chrome แล้วเข้าไปที่ URL:
   ```text
   chrome://extensions/
   ```
3. เปิดสวิตช์ **โหมดนักพัฒนาซอฟต์แวร์ (Developer mode)** ที่มุมขวาบน
4. คลิกปุ่ม **โหลดส่วนขยายที่คลายการบีบอัดแล้ว (Load unpacked)**
5. เลือกโฟลเดอร์ `post-family-autofill`

---

## 🚀 วิธีใช้งาน (Usage)

1. **ตั้งค่า API Key**: เปิด Side Panel ของ Extension แล้วใส่ **Gemini API Key** ของคุณ (สามารถขอรับได้ฟรีที่ [Google AI Studio](https://aistudio.google.com/))
2. **Step 1**: กดปุ่ม **"📑 เปิดเว็บ & กดยอมรับข้อตกลง (Step 1)"** เพื่อเปิดหน้าเว็บและผ่านหน้าข้อกำหนดเงื่อนไข
3. **วิเคราะห์ข้อมูล**: แปะรูปที่มีข้อมูลที่จำเป็นต้องกรอกสำหรับการสมัคร POST Family (Ctrl+V) หรือข้อความลงในช่อง "ข้อมูลนำเข้า" แล้วกด **"✨ วิเคราะห์ข้อมูล"**
4. **ตรวจสอบ & กรอกข้อมูล**:
   - กด **"🔵 กรอกข้อมูล Step 2"** สำหรับกรอกชื่อ, วันเกิด, เบอร์โทร, รหัสสมาชิกแนะนำ และข้อมูลส่วนตัวอื่นที่ต้องใช้สมัคร
   - กด **"🟢 กรอกข้อมูล Step 3"** สำหรับกรอกที่อยู่ (เลือกจังหวัด อำเภอ ตำบล อัตโนมัติ)

---

## 📝 หมายเหตุ

- ใช้เฉพาะรูปหรือข้อความที่มีข้อมูลที่จำเป็นต้องกรอกสำหรับการสมัคร POST Family ไม่ควรอัปโหลดเอกสารที่ระบุตัวตนโดยตรง
- ต้องมี Gemini API Key จาก [Google AI Studio](https://aistudio.google.com/)

---

## ⚙️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Chrome Extension Manifest V3** (Side Panel API, Content Scripts, Service Worker)
- **Google Gemini API** (`@google/genai` via REST API)
- **HTML5 / CSS3 / Vanilla JavaScript**
