# native-host — ตัวอ่านบัตรประชาชน (Native Messaging host)

โปรแกรมช่วยสำหรับ extension **"POST Family AutoFill"** ใช้สำหรับอ่านข้อมูลจาก
**บัตรประชาชนไทย** ผ่านเครื่องอ่านสมาร์ทการ์ด (PC/SC) เช่น `SCR33xx V2.0 USB SC Reader`

- **`postfamily_card_reader.exe`** — host ตัวหลัก (Chrome เรียกผ่าน stdin/stdout เงียบ ๆ ไม่มีหน้าต่าง)
- **`register.exe`** — ตัวติดตั้ง GUI (ดับเบิลคลิก → กรอก ID → ลงทะเบียน) ไม่ต้องใช้ PowerShell/admin

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `main.go` | host ตัวหลัก — อ่านบัตรผ่าน APDU → ตอบ JSON |
| `cmd/register/main.go` | source ของ `register.exe` (GUI ลงทะเบียน) |
| `go.mod` / `go.sum` | Go module + dependencies |
| `register.exe` *(build)* | ดับเบิลคลิกเพื่อลงทะเบียน |
| `postfamily_card_reader.exe` *(build)* | host ที่ Chrome เรียก |

## Build (เครื่อง dev — ต้องมี Go toolchain)

ติดตั้ง Go จาก https://go.dev/dl/ แล้วรัน:

```powershell
go build -ldflags "-H windowsgui" -o postfamily_card_reader.exe
go build -ldflags "-H windowsgui" -o register.exe ./cmd/register
```

`-H windowsgui` = ไม่มีหน้าต่าง console (เงียบสนิท ไม่ flash หน้าต่างดำ)

## ติดตั้งที่เครื่องทำงาน (ไม่ต้อง admin / ไม่ต้อง PowerShell)

1. copy **2 ไฟล์** ไปวางในโฟลเดอร์เดียวกัน (ที่ไหนก็ได้): `register.exe` + `postfamily_card_reader.exe`
2. **ดับเบิลคลิก `register.exe`** → วาง Extension ID (จาก `chrome://extensions` → โหมดนักพัฒนา) → OK
3. reload extension ที่ `chrome://extensions`

`register.exe` จะเขียน registry ที่:

```
HKCU\Software\Google\Chrome\NativeMessagingHosts\postfamily_card_reader
```

(ระดับผู้ใช้ HKCU — ไม่ต้อง admin) และสร้าง `postfamily_card_reader.json` (host manifest) ในโฟลเดอร์เดียวกัน

## ตรวจเครื่องอ่าน

เสียบ reader แล้วรันคำสั่ง built-in ใน Windows:

```
certutil -scinfo
```

ต้องเห็น reader + บัตร (Windows โหลด CCID driver ในตัวให้เอง ไม่ต้องลง driver เพิ่ม)
