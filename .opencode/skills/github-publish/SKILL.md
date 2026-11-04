---
name: GitHub Publish
description: Use this skill when the user wants to publish, push, or upload a local project to GitHub for the first time. Covers git init, .gitignore creation, README generation, GitHub repo creation guidance, and first push. Also handles cases where the project is already a git repo but has no remote.
---

# GitHub Publish — เผยแพร่โปรเจกต์ขึ้น GitHub

สกิลนี้ช่วยผู้ใช้นำโปรเจกต์ที่อยู่ในเครื่อง publish ขึ้น GitHub ครั้งแรก ครอบคลุมทุกขั้นตอนตั้งแต่ต้นจนจบ

## ขั้นตอนการทำงาน

### Step 1 — สำรวจโปรเจกต์

- ใช้ `glob` ดูไฟล์ทั้งหมดในโฟลเดอร์โปรเจกต์ (หรือ `shell` รัน `Get-ChildItem -Force` บน Windows)
- อ่านไฟล์หลักๆ เพื่อเข้าใจว่าโปรเจกต์ทำอะไร (เช่น `package.json`, `manifest.json`, `index.html`, `main.py` ฯลฯ)
- ระบุประเภทโปรเจกต์ (web app, Chrome extension, Python script, etc.)
- ตรวจ `.gitignore`, `README*`, และว่ามี `.git` อยู่แล้วหรือไม่

### Step 2 — ถามข้อมูลจากผู้ใช้

ใช้เครื่องมือ `question` ถามข้อมูลที่จำเป็น:

- ชื่อ repository — เสนอชื่อที่เหมาะสมให้เลือก 2-3 ตัวเลือก
- Public หรือ Private — แนะนำ Public ถ้าเป็น Portfolio
- GitHub username — ถ้ายังไม่ทราบ (อาจดูจาก git config หรือชื่อ user ในเครื่อง)

### Step 3 — ตรวจสอบ Prerequisites

รันคำสั่งเหล่านี้เพื่อเช็คสถานะ:

```bash
git --version        # มี git หรือยัง
git status           # เป็น git repo อยู่แล้วหรือยัง
git config user.name
git config user.email
git remote -v        # มี remote อยู่แล้วหรือยัง
```

กรณีที่ต้องจัดการ:

- ถ้ายังไม่มี git → รัน `git init`
- ถ้ายังไม่มี `user.name` / `user.email` → ตั้งค่าให้ (ใช้ GitHub username + `<username>@users.noreply.github.com`)
- ถ้ามี remote อยู่แล้ว → ถามผู้ใช้ว่าต้องการ push ไปที่ remote เดิมหรือเพิ่มใหม่
- ห้าม force push หรือเขียนทับ remote ที่มีอยู่โดยไม่ได้รับอนุญาต

### Step 4 — สร้าง .gitignore

สร้างไฟล์ `.gitignore` ที่เหมาะกับประเภทโปรเจกต์:

หลักการ:

- ไฟล์ backup (`.bak`, `.tmp`, `.swp`) → ignore
- ไฟล์ archive (`.rar`, `.zip`, `.7z`) → ignore
- OS files (`Thumbs.db`, `.DS_Store`) → ignore
- Dependencies (`node_modules/`, `venv/`, `__pycache__/`) → ignore
- Build output (`dist/`, `build/`) → ignore ตามความเหมาะสม
- Secrets (`.env`, API keys) → ignore
- ไฟล์ที่เป็น source code จริงๆ → **อย่า** ignore

สำคัญ: ดูจากไฟล์ที่มีอยู่จริงในโปรเจกต์แล้วตัดสินใจ ไม่ใช่ใส่ทุกอย่างแบบ generic ถ้ามี `.gitignore` อยู่แล้วให้ปรับเพิ่ม ไม่ใช่เขียนทับ

### Step 5 — สร้าง README.md

เขียน `README.md` ที่ครอบคลุม โดยอ่านจาก source code จริง

โครงสร้าง README ที่ดี:

```markdown
# ชื่อโปรเจกต์

คำอธิบายสั้นๆ 1-2 บรรทัด

## ✨ ฟีเจอร์หลัก
- รายการฟีเจอร์ที่สำคัญ

## 📥 วิธีติดตั้ง
ขั้นตอนการติดตั้ง (clone, install dependencies, etc.)

## 🚀 วิธีใช้งาน
อธิบายการใช้งานทีละขั้นตอน

## 📁 โครงสร้างไฟล์
อธิบายไฟล์สำคัญ

## ⚙️ เทคโนโลยีที่ใช้
Tech stack

## 📝 หมายเหตุ
ข้อควรทราบ เช่น ต้องมี API key, ข้อจำกัด
```

หลักการ:

- เขียนภาษาเดียวกับที่โปรเจกต์ใช้ (ถ้า UI เป็นภาษาไทย → README เป็นไทย)
- อ่าน source code ให้เข้าใจจริงๆ ก่อนเขียน อย่าเดา
- ใส่ badge ที่เหมาะสม (ถ้ามี)
- ถ้ามี README อยู่แล้ว ให้ปรับปรุงของเดิมแทนการเขียนทับทั้งไฟล์

### Step 6 — Commit

```bash
git add -A
git status          # แสดงให้ผู้ใช้เห็นว่าไฟล์ไหนจะถูก commit
git commit -m "Initial commit: <ชื่อโปรเจกต์>"
```

- ตรวจสอบว่า `.gitignore` ทำงานถูกต้อง (ไฟล์ที่ไม่ต้องการถูก exclude แล้ว)
- ตรวจว่าไม่มี secret หลุดเข้า staging (`.env`, API key, token)
- แจ้งผู้ใช้ว่ามีกี่ไฟล์ที่จะ commit

### Step 7 — สร้าง Repository บน GitHub

เช็คว่ามี `gh` CLI หรือไม่:

```bash
gh --version
gh auth status
```

ถ้ามี `gh` CLI และ login แล้ว:

```bash
gh repo create <repo-name> --public --source=. --push
```

ถ้าไม่มี `gh` CLI (หรือยังไม่ login):

แนะนำผู้ใช้ทำเอง:

1. เปิด <https://github.com/new>
2. กรอก Repository name
3. เลือก Public/Private
4. **อย่าติ๊ก** Add README, .gitignore, หรือ License (เพราะเรามี commit แล้ว)
5. กด Create repository

ถ้าต้อง login `gh` ให้ผู้ใช้รัน `gh auth login` เองใน terminal (เป็น interactive flow)

### Step 8 — เชื่อมต่อ Remote และ Push

```bash
git branch -M main
git remote add origin https://github.com/<username>/<repo-name>.git
```

**สำคัญ:** การ push อาจต้องทำผ่าน terminal ของผู้ใช้โดยตรง เนื่องจาก Git Credential Manager ต้องแสดง popup login ซึ่งไม่สามารถทำงานได้จาก background task

แนะนำให้ผู้ใช้เปิด PowerShell แล้วรัน:

```powershell
cd "<project-path>"; git push -u origin main
```

ถ้ามีหน้าต่าง login ขึ้นมา → เลือก "Sign in with your browser" → login → Authorize

หมายเหตุ: ถ้า `gh repo create --source=. --push` สำเร็จใน Step 7 แล้ว ไม่ต้อง `git remote add` / push ซ้ำ

### Step 9 — ยืนยันผลลัพธ์

เมื่อ push สำเร็จแล้ว:

- แสดงลิงก์ไปยัง repo: `https://github.com/<username>/<repo-name>`
- สรุปสิ่งที่ทำทั้งหมดเป็นตาราง (repo name, visibility, branch, จำนวนไฟล์, commit hash)
- ตรวจ `git status` และ `git remote -v` ให้ผู้ใช้เห็นว่าทุกอย่างเรียบร้อย

## สถานการณ์พิเศษ

### โปรเจกต์ที่เป็น git repo อยู่แล้วแต่ไม่มี remote

- ข้ามขั้นตอน `git init`
- เช็คว่ามี commit อยู่แล้วหรือยัง
- ถ้ามี commit อยู่แล้ว ให้เพิ่ม README แล้ว commit เพิ่ม
- ถ้ามี commit อยู่แล้วและต้องการ push ประวัติเดิมทั้งหมด ให้ข้ามการสร้าง commit ใหม่ถ้าไม่จำเป็น

### โปรเจกต์ที่มี remote อยู่แล้ว

- แจ้งผู้ใช้ว่ามี remote อยู่แล้ว
- ถามว่าต้องการ push ไป remote เดิม หรือเพิ่ม remote ใหม่
- อย่าเปลี่ยน `origin` โดยไม่ถาม

### Commit เพิ่มเติม (ไม่ใช่ครั้งแรก)

ถ้าผู้ใช้แค่ต้องการ push งานเพิ่ม ไม่ต้องทำขั้นตอน init / .gitignore / README ใหม่

```bash
git add -A
git status
git commit -m "<message>"
git push
```

## ข้อควรระวัง

- อย่า commit ไฟล์ secret หรือ API key ตรวจ `git status` ก่อน commit ทุกครั้ง
- อย่ารันคำสั่ง interactive (`gh auth login`, credential prompt) ใน background task ที่ผู้ใช้มองไม่เห็น
- อย่า force push, rewrite history, หรือลบ remote โดยไม่ได้รับอนุญาต
- ถ้าไม่แน่ใจชื่อ repo หรือ visibility ให้ถามก่อนสร้าง repository สาธารณะ
