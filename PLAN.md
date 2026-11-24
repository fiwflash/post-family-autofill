# 📋 PLAN: อ่านบัตรประชาชนผ่านเครื่องอ่านบัตร (SCR33xx)

> วันที่: 2026-11-24
> สถานะ: ✅ เสร็จสมบูรณ์ (implement + เทสต์อ่านบัตรจริง)
> Backup อ้างอิง: `backup/2026-11-24_v1.0_pre-card-reader/`

## ความคืบหน้า

- [x] เขียน host (Go) → build `.exe` + เทสต์อ่านบัตรจริงได้ ✅
- [x] `manifest.json` เพิ่ม `nativeMessaging`
- [x] `popup.html` เพิ่มปุ่มไอคอนการ์ด "อ่านบัตร"
- [x] `popup.js` เพิ่ม handler → `populateReviewForm`
- [x] `register.exe` (GUI ลงทะเบียน — ไม่ต้อง PowerShell/admin)
- [x] เทสต์เต็ม flow ใน Chrome ✅

## 1. โจทย์

เพิ่มความสามารถให้ extension **อ่านข้อมูลจากบัตรประชาชนไทย** ผ่านเครื่องอ่านสมาร์ทการ์ด
`SCR33xx V2.0 USB SC Reader` (Identiv/SCM SCR3310v2.0 series) แล้วกรอกข้อมูลลง
**แบบฟอร์มตรวจสอบ (Review Form)** โดยตรง โดยไม่ต้องใช้ Gemini / แปะรูป

- ปุ่มใหม่ **`🪪 อ่านบัตร`** อยู่ข้างปุ่ม `🗑️ ล้าง` ใน card "📄 ข้อมูลนำเข้า" (หน้าแรก)
- กดปุ่มเดียว → ข้อมูลเด้งเข้าแบบฟอร์มตรวจสอบเลย

## 2. ข้อจำกัดทางเทคนิค (ทำไมต้องมี Native Messaging host)

Chrome extension **ไม่มี API คุยกับเครื่องอ่านสมาร์ทการ์ด (PC/SC)** และ reader
`SCR33xx` เป็นอุปกรณ์ CCID ที่ Windows ครอบผ่านไดรเวอร์ USB CCID ไว้ ทำให้
WebUSB/WebHID ใช้ไม่ได้เช่นกัน

→ ทางเดียวที่ใช้ได้จริงคือ **Native Messaging host** (โปรแกรมช่วยตัวเล็ก)
ที่ติดตั้งครั้งเดียว แล้ว Chrome เรียกขึ้นมาเองเงียบ ๆ ในเบื้องหลังเมื่อกดปุ่ม
(ไม่มีหน้าต่าง ไม่ต้องเปิดเอง)

## 3. สถาปัตยกรรม

```
[Side panel] กด "อ่านบัตร"
   └─ chrome.runtime.sendNativeMessage("postfamily_card_reader", {command:"read"})
        └─ host (Go) : EstablishContext → ListReaders → Connect
              → SELECT AID → READ BINARY (CID/ชื่อไทย/วันเกิด/ที่อยู่) → GET RESPONSE
              → decode TIS-620 → parse → stdout JSON
        └─ popup.js : populateReviewForm(data) → หน้าตรวจสอบ
```

## 4. ไฟล์ที่ต้องเพิ่ม / แก้

| ไฟล์ | สถานะ | รายละเอียด |
|---|---|---|
| `native-host/go.mod` | ใหม่ | module + deps (`github.com/ebfe/scard`, `golang.org/x/text`, `ncruces/zenity`) |
| `native-host/main.go` | ใหม่ | native messaging host: อ่าน stdin JSON → อ่านบัตร → เขียน stdout JSON |
| `native-host/cmd/register/main.go` | ใหม่ | `register.exe` — GUI ลงทะเบียน (ดับเบิลคลิก → กรอก ID → เขียน HKCU) |
| `manifest.json` | แก้ | เพิ่ม `"nativeMessaging"` ใน `permissions` |
| `popup.html` | แก้ | เพิ่มปุ่มไอคอนการ์ด "อ่านบัตร" ข้าง `🗑️ ล้าง` |
| `popup.js` | แก้ | handler กดปุ่ม → sendNativeMessage → populateReviewForm |

หมายเหตุ: `.exe` ที่ build ได้ควรเพิ่มใน `.gitignore`; source (`*.go`, `go.mod`) เก็บใน repo

## 5. รายละเอียด Native Messaging host (Go)

### 5.1 Protocol (มาตรฐาน Chrome Native Messaging)

- **รับจาก stdin:** 4-byte little-endian ความยาว + UTF-8 JSON `{"command":"read"}`
- **ตอบกลับ stdout:** 4-byte LE + JSON
  - สำเร็จ: `{"success":true,"data":{...}}`
  - ล้ม: `{"success":false,"error":"..."}`
    (เช่น "ไม่พบเครื่องอ่าน", "ไม่พบการ์ด", "การ์ดไม่ใช่บัตรประชาชน")

### 5.2 ลำดับ APDU ที่ใช้ (ยืนยันจาก reference แล้ว)

```
SELECT      : 00 A4 04 00 08 A0 00 00 00 54 48 00 01
CID         : 80 B0 00 04 02 00 0D   → 00 C0 00 00 0D
ชื่อไทย       : 80 B0 00 11 02 00 64   → 00 C0 00 00 64
วันเกิด      : 80 B0 00 D9 02 00 08   → 00 C0 00 00 08   (รูปแบบ "25351126")
ที่อยู่       : 80 B0 15 79 02 00 64   → 00 C0 00 00 64   (คั่นด้วย `#`)
```

> หมายเหตุ: prefix ของ GET RESPONSE มี 2 แบบ — ปกติ `00 C0 00 00`;
> ถ้า ATR ขึ้นต้น `3B 67` ใช้ `00 C0 00 01` (บัตรไทยรุ่นใหม่) — host ต้องเช็ค ATR อัตโนมัติ

### 5.3 การ decode

- ข้อความภาษาไทยเป็น TIS-620 → decode ด้วย `charmap.Windows874` (จาก `golang.org/x/text`)
- ตัวอักษร `#` ในข้อมูล → ช่องว่าง

### 5.4 Output ที่ host ส่งให้ extension

```json
{
  "firstName": "…", "lastName": "…",
  "citizenId": "1234567890123",
  "dateOfBirth": { "day": "26", "month": "11", "year": "2535" },
  "address": {
    "houseNo": "704/82", "moo": "", "soi": "", "road": "",
    "subDistrict": "…", "district": "…", "province": "…"
  }
}
```

- **วันเกิด** "25351126" → `year=2535, month=11, day=26` (พ.ศ. ตรงกับที่ฟอร์มต้องการ)
- **ชื่อไทย** ตัดคำนำหน้า (นาย/นาง/นางสาว) ออก — เพราะช่อง "ชื่อจริง" ระบุไม่ให้ใส่
- **ไม่ต้องอ่านรูป** — ฟอร์มไม่มีช่องรูป (เร็วขึ้น)

### 5.5 การทำงานแบบเงียบ (on-demand, ไม่มีหน้าต่าง)

- host เป็น **stdio process แบบ on-demand**: Chrome เรียกเฉพาะตอนกดปุ่ม "อ่านบัตร" → อ่าน (1–3 วิ) → ปิดตัวเอง ไม่มี process ค้าง
- build ด้วย `go build -ldflags "-H windowsgui"` → `.exe` ไม่มีหน้าต่าง console (ไม่ flash หน้าต่างดำ) ขณะที่ยังสื่อสารผ่าน stdin/stdout ได้ตามปกติ
- **ไม่มีไอคอน taskbar / tray icon / หน้าต่าง** ใด ๆ
- status (กำลังอ่าน / สำเร็จ / ผิดพลาด) แสดงที่แถบสถานะของ side panel (`#status`) — ไม่โผล่ที่ taskbar ของ Windows

## 6. การ mapping ข้อมูลบัตร → ฟอร์ม

| ข้อมูลจากบัตร | ช่องฟอร์ม (id) |
|---|---|
| ชื่อ (ไทย, ตัดคำนำหน้า) | `rev_firstName` |
| นามสกุล (ไทย) | `rev_lastName` |
| เลขบัตร 13 หลัก | `rev_citizenId` |
| วันเกิด (พ.ศ.) | `rev_dob_day` / `rev_dob_month` / `rev_dob_year` |
| บ้านเลขที่ | `rev_houseNo` |
| หมู่ | `rev_moo` |
| ซอย | `rev_soi` |
| ถนน | `rev_road` |
| ตำบล/แขวง | `rev_subDistrict` |
| อำเภอ/เขต | `rev_district` |
| จังหวัด | `rev_province` |

**บัตรไม่มี → กรอกเองเหมือนเดิม:** เบอร์โทร, Email, password, referral, รหัสไปรษณีย์ (postcode)

**คำนำหน้า (นาย/นาง/นางสาว):** ตัดทิ้ง (ช่อง "ชื่อจริง" ระบุไม่ต้องใส่คำนำหน้า)

## 7. การติดตั้ง (2 เครื่อง — ไม่ต้อง admin / ไม่ต้อง PowerShell ที่เครื่องทำงาน)

**ข้อจำกัดที่เครื่องทำงาน:** ลงโปรแกรมไม่ได้ (ติด admin) + **เปิด PowerShell ไม่ได้**
→ ทางออกคือ **`register.exe`** (GUI): ดับเบิลคลิก → กรอก Extension ID → เขียน registry (HKCU) ให้เอง
ไม่ต้อง PowerShell / regedit / admin

### เครื่อง dev (เครื่องนี้ — build + ทดสอบ)

1. ลง Go toolchain — https://go.dev/dl/ (หรือ `winget install GoLang.Go`)
2. build host: `go build -ldflags "-H windowsgui" -o postfamily_card_reader.exe`
3. build register: `go build -ldflags "-H windowsgui" -o register.exe ./cmd/register`
4. ดู extension ID จาก `chrome://extensions` (โหมดนักพัฒนา)
5. ดับเบิลคลิก `register.exe` → ใส่ ID → reload → ทดสอบอ่านบัตร

### เครื่องที่ทำงาน (ใช้จริง — ไม่ต้อง admin ไม่ต้อง PowerShell)

1. copy **2 ไฟล์** ไปวางในโฟลเดอร์เดียวกัน (ที่ไหนก็ได้ที่ผู้ใช้เขียนได้):
   - `postfamily_card_reader.exe` (host)
   - `register.exe` (ตัวติดตั้ง)
2. ดับเบิลคลิก `register.exe` → วาง Extension ID ของเครื่องทำงาน → OK
3. ตรวจ reader: เสียบ reader → รัน `certutil -scinfo` (คำสั่ง built-in) ต้องเห็น reader + บัตร
4. โหลด extension แบบ unpacked (ทำอยู่แล้ว) → Reload

> ทั้งหมดบนเครื่องทำงาน = copy 2 ไฟล์ + ดับเบิลคลิก `register.exe` + คำสั่ง built-in — ไม่มี PowerShell, ไม่มี regedit, ไม่ต้อง admin

## 8. ความเสี่ยง / จุดต้องทดสอบกับบัตรจริง

| จุดเสี่ยง | วิธีรับมือ |
|---|---|
| **การ parse ที่อยู่** (สตริงคั่น `#` → แยกบ้านเลขที่/หมู่/ซอย/ถนน/ตำบล/อำเภอ/จังหวัด) — ยากสุด | เติมเท่าที่แยกได้ แล้วให้แก้ในแบบฟอร์มตรวจสอบ (มีอยู่แล้ว); ต้องเทสต์กับบัตรจริง |
| ไดรเวอร์ SCR33xx — ปกติ Windows มี in-box CCID driver โหลดเองไม่ต้อง admin; ถ้าเครื่องนี้ต้องลง vendor driver จะติด admin | ตรวจก่อนบนเครื่องทำงาน: `certutil -scinfo` ต้องเห็น reader + บัตร |
| นโยบาย Chrome ระดับองค์กรปิด native messaging / Smart Card service ถูกปิด | ทดสอบที่เครื่อง dev ก่อน แล้วบนเครื่องทำงานรัน `certutil -scinfo` + ลองกดปุ่มอ่านบัตรดู |
| prefix GET RESPONSE ต่างตาม ATR | เช็ค ATR อัตโนมัติใน host |
| Extension ID เปลี่ยนถ้าย้ายโฟลเดอร์ | อ่าน ID จริงจาก chrome://extensions ใส่ใน register.exe |

## 9. ขั้นตอนดำเนินการ (ทำเสร็จแล้ว ✅)

1. ✅ ติดตั้ง Go + โครง native-host → build ได้ exe
2. ✅ เขียน host → เทสต์อ่านบัตรจริงได้ (ชื่อ/เลขบัตร/วันเกิด/ที่อยู่ ครบ)
3. ✅ ลงทะเบียน host (`register.exe`) + แก้ manifest → `sendNativeMessage` ได้ JSON กลับ
4. ✅ ปุ่ม + UI ใน popup → กด "อ่านบัตร" → ข้อมูลลงแบบฟอร์มตรวจสอบ
5. ✅ ทดสอบเต็ม flow ใน Chrome

## 10. แหล่งอ้างอิง

- Go PC/SC: https://github.com/ebfe/scard
- ตัวอย่าง Go อ่านบัตร ปชช.: https://gist.github.com/pallat/6674a085965db7d12265e72ddb3a8488
- APDU + ตัวอย่าง Python: https://gist.github.com/bouroo/8b34daf5b7deed57ea54819ff7aeef6e
- Go library อ่านบัตร ปชช. (อ้างอิง): https://github.com/gogetth/sscard
- APDU command บัตร ปชช.: https://github.com/Napat/ThaiNationalIDCard/blob/master/APDU.md
