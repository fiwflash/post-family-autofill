// content.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fillStep1") {
    fillStep1().then(result => sendResponse({ status: "done", result }));
  } else if (request.action === "fillStep2") {
    fillStep2(request.data).then(result => sendResponse({ status: "done", result }));
  } else if (request.action === "fillStep3") {
    fillStep3(request.data).then(() => sendResponse({ status: "done" }));
  }
  return true; // Keep channel open for async response
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------

async function fillStep1() {
  console.log("เริ่มดำเนินการ Step 1 (ยอมรับเงื่อนไข)...");
  
  // 1. ติ๊กถูกที่ Checkbox ความยินยอม / เงื่อนไข
  // พยายามหาจาก aria-label หรือ class consent / q-checkbox
  let checkbox = document.querySelector('div[role="checkbox"][aria-label*="ข้าพเจ้าได้อ่านรายละเอียด"]');
  if (!checkbox) {
    checkbox = document.querySelector('.consent.q-checkbox, .q-checkbox');
  }

  if (checkbox) {
    const isChecked = checkbox.getAttribute('aria-checked') === 'true' || 
                      checkbox.classList.contains('q-checkbox__inner--truthy') ||
                      checkbox.querySelector('.q-checkbox__inner--truthy');
    if (!isChecked) {
      console.log("กำลังคลิกติ๊กถูกเงื่อนไข...");
      checkbox.click();
      await sleep(500);
    } else {
      console.log("ติ๊กถูกอยู่แล้ว");
    }
  } else {
    console.warn("ไม่พบ Checkbox เงื่อนไข");
  }

  // 2. กดปุ่ม 'ยอมรับข้อตกลง'
  let acceptBtn = null;
  const spans = document.querySelectorAll('span, button');
  for (const el of spans) {
    if (el.innerText && el.innerText.trim() === 'ยอมรับข้อตกลง') {
      acceptBtn = el.closest('button') || el;
      break;
    }
  }

  if (acceptBtn) {
    console.log("กำลังกดปุ่ม ยอมรับข้อตกลง...");
    acceptBtn.click();
    await sleep(500);
    return { success: true, message: "ติ๊กถูกและกดยอมรับข้อตกลงเรียบร้อย" };
  } else {
    console.warn("ไม่พบปุ่ม ยอมรับข้อตกลง");
    return { success: false, message: "ไม่พบปุ่มยอมรับข้อตกลง" };
  }
}

function setInputValue(element, value) {
  if (!element || value === undefined || value === null || value === '') return;
  
  // สำหรับ Input ทั่วไป
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  nativeInputValueSetter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function findQuasarInput(labelText, hiddenInputName) {
  const labels = document.querySelectorAll('.q-field__label');
  for (const label of labels) {
    if (!label.innerText.includes(labelText)) continue;

    const field = label.closest('.q-field');
    const input = field?.querySelector('input.q-field__native:not([type="hidden"]), input:not([type="hidden"])');
    if (input) return input;
  }

  return hiddenInputName
    ? document.querySelector(`input[name="${hiddenInputName}"]:not([type="hidden"])`)
    : null;
}

function formatReferralCode(value) {
  const code = String(value || '').trim();
  return /^THP-/i.test(code) ? code : `THP-${code}`;
}

// แปลงเลขเดือน (05) เป็นชื่อเดือนภาษาไทย (พฤษภาคม)
function convertMonthToThai(monthStr) {
    const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    // ตัดศูนย์นำหน้าออกถ้ามี (เช่น "05" -> 5)
    const num = parseInt(monthStr, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
        return months[num - 1];
    }
    return monthStr; // ถ้าเป็นชื่อเดือนอยู่แล้วให้ใช้ค่าเดิม
}

// ---------------------------------------------------------
// 🌟 ฟังก์ชันจัดการ Quasar Dropdown (แบบแม่นยำสูง)
// ---------------------------------------------------------
async function selectQuasarByLabel(labelText, valueToSelect) {
    if (!valueToSelect) return false;

    console.log(`🔍 กำลังมองหา Dropdown: "${labelText}" เพื่อเลือก "${valueToSelect}"`);

    // 1. หา Element ที่มีข้อความ Label ตรงกับที่ต้องการ
    let targetLabel = null;
    const labelDivs = document.querySelectorAll('.q-field__label');
    for (let div of labelDivs) {
        if (div.innerText.includes(labelText)) {
            targetLabel = div;
            break;
        }
    }

    if (!targetLabel) {
        console.warn(`❌ ไม่พบ Label: "${labelText}"`);
        return false;
    }

    const qField = targetLabel.closest('.q-field');
    const nativeDiv = qField?.querySelector('.q-field__native');
    
    if (!nativeDiv) {
        console.warn(`❌ ไม่พบ .q-field__native สำหรับ: "${labelText}"`);
        return false;
    }

    // 2. คลิกเปิด Dropdown
    nativeDiv.click();
    await sleep(800); // รอให้ Dropdown เปิดและ Animation เสร็จสิ้น

    // 3. หา Menu ที่เปิดอยู่
    const menus = document.querySelectorAll('.q-menu');
    let targetMenu = null;
    for (let menu of menus) {
        if (menu.offsetWidth > 0 && menu.offsetHeight > 0) {
            targetMenu = menu;
            break;
        }
    }

    if (!targetMenu) {
        console.warn(`❌ Dropdown ไม่เปิดขึ้นมา`);
        return false;
    }

    // 4. ค้นหา Option ที่ตรงกับค่า
    const options = targetMenu.querySelectorAll('.q-item');
    let matchedOption = null;
    const targetStr = valueToSelect.toString().trim();
    
    for (let opt of options) {
        const optText = opt.innerText.trim();
        
        // กรณีที่ 1: ข้อความตรงกันเป๊ะๆ
        if (optText === targetStr) {
            matchedOption = opt;
            break;
        }
        
        // กรณีที่ 2: ถ้าค้นหาตัวเลข (เช่น "18") ให้เช็กว่าตัวเลขใน Option ตรงกันเป๊ะไหม (ป้องกัน 1 ไป match 18)
        if (/^\d+$/.test(targetStr)) {
            const optNumMatch = optText.match(/\d+/); 
            if (optNumMatch && optNumMatch[0] === targetStr) {
                matchedOption = opt;
                break;
            }
        }
        
        // กรณีที่ 3: ชื่อเดือน (เช่น "พฤษภาคม") ให้ใช้ includes
        if (!/^\d+$/.test(targetStr) && optText.includes(targetStr)) {
            matchedOption = opt;
            break;
        }
    }

    if (!matchedOption) {
        console.warn(`❌ ไม่พบตัวเลือก "${valueToSelect}" ใน Dropdown: "${labelText}"`);
        document.body.click(); // ปิด Dropdown
        await sleep(500);
        return false;
    }

    // 5. คลิกเลือก Option
    console.log(`✅ เลือกค่า "${valueToSelect}" ใน "${labelText}"`);
    matchedOption.click();
    await sleep(1000); // รอให้ Animation ปิด Dropdown
    
    // บังคับปิด Dropdown ถ้าค้าง
    if (document.querySelector('.q-menu.q-position-engine')) {
        document.body.click();
        await sleep(500);
    }

    return true;
}

// ---------------------------------------------------------
// Main Functions
// ---------------------------------------------------------

async function fillStep2(data) {
  console.log("เริ่มกรอก Step 2...");
  const result = {};

  // 1. ชื่อจริง และนามสกุล
  if (data.firstName) {
      setInputValue(document.querySelector('input[aria-label="ชื่อจริง (ไม่ต้องใส่คำนำหน้าชื่อ) *"]'), data.firstName);
  }
  
  const lastNameInput = document.querySelector('input[aria-label="นามสกุล *"]');
  if (lastNameInput) setInputValue(lastNameInput, data.lastName);

  // 2. วันเกิด (วัน, เดือน, ปี)
  if (data.dateOfBirth) {
    if (data.dateOfBirth.day) {
        await selectQuasarByLabel('วัน *', data.dateOfBirth.day);
    }
    if (data.dateOfBirth.month) {
        const thaiMonth = convertMonthToThai(data.dateOfBirth.month);
        await selectQuasarByLabel('เดือน *', thaiMonth);
    }
    if (data.dateOfBirth.year) {
        await selectQuasarByLabel('ปีเกิด *', data.dateOfBirth.year);
    }
  }

  // 3. เลขบัตรประชาชน หรือ Passport
  if (data.citizenId) {
      setInputValue(document.querySelector('input[aria-label="รหัสบัตรประชาชน / Passport No.*"]'), data.citizenId);
  } else if (data.passport) {
      // ถ้าเป็น Passport ต้องคลิก Radio Button เลือก Passport ก่อน (ถ้ามี)
      const passportRadio = document.querySelector('input[type="radio"][value="passport"]');
      if (passportRadio) passportRadio.click();
      await sleep(300);
      setInputValue(document.querySelector('input[aria-label="รหัสบัตรประชาชน / Passport No.*"]'), data.passport);
  }

  // 4. เบอร์โทรศัพท์
  if (data.phone) {
      setInputValue(document.querySelector('input[aria-label="เบอร์โทรศัพท์ *"]'), data.phone);
  }
  
  // 5. Email (ถ้ามี)
  if (data.email) {
      setInputValue(document.querySelector('input[aria-label="อีเมล (ถ้ามี)"]'), data.email);
  }

  // 6. ข้อมูลแนะนำในฟอร์มเดียวกับ Step 2
  if (data.referralCode) {
      const refInput = document.querySelector('input[aria-label="หมายเลขสมาชิกที่แนะนำ"]')
        || findQuasarInput('หมายเลขสมาชิกที่แนะนำ', 'Signup:loginForm:j_id58');
      const formattedReferralCode = formatReferralCode(data.referralCode);
      if (refInput) {
          setInputValue(refInput, formattedReferralCode);
          await sleep(100);
      }
      result.referralCode = {
          sent: formattedReferralCode,
          found: Boolean(refInput),
          valueAfterFill: refInput?.value || ''
      };
  }

  if (data.recommendedPostcode) {
      const postcodeInput = document.querySelector('input[aria-label="รหัสไปรษณีย์ที่แนะนำ"]')
        || findQuasarInput('รหัสไปรษณีย์ที่แนะนำ', 'Signup:loginForm:j_id59');
      if (postcodeInput) setInputValue(postcodeInput, data.recommendedPostcode);
      result.recommendedPostcode = {
          sent: data.recommendedPostcode,
          found: Boolean(postcodeInput),
          valueAfterFill: postcodeInput?.value || ''
      };
  }

  // 7. รหัสผ่าน และ ยืนยันรหัสผ่าน
  if (data.password) {
      const passInput = document.querySelector('input[aria-label="รหัสผ่าน *"]');
      const confirmPassInput = document.querySelector('input[aria-label="ยืนยันรหัสผ่าน *"]');
      
      if (passInput) setInputValue(passInput, data.password);
      if (confirmPassInput) setInputValue(confirmPassInput, data.password);
  }

  console.log("กรอก Step 2 เสร็จสิ้น");
  return result;
}

async function fillStep3(data) {
  console.log("เริ่มกรอก Step 3...");
  const addr = data.address;
  if (!addr) return;

  // 1. จังหวัด
  if (addr.province) {
    const success = await selectQuasarByLabel('จังหวัด *', addr.province);
    if (success) await sleep(1500); // รอให้อำเภอโหลด
  }
  
  // 2. อำเภอ / เขต
  if (addr.district) {
    const success = await selectQuasarByLabel('เขต / อำเภอ *', addr.district);
    if (success) await sleep(1500); // รอให้ตำบลโหลด
  }
  
  // 3. ตำบล / แขวง
  if (addr.subDistrict) {
    await selectQuasarByLabel('แขวง / ตำบล *', addr.subDistrict);
    await sleep(1500); // รอให้รหัสไปรษณีย์อัปเดต
  }

  // 4. ที่อยู่เพิ่มเติม (Input ธรรมดา)
  if (addr.postcode) setInputValue(document.querySelector('input[aria-label="รหัสไปรษณีย์ *"]'), addr.postcode);
  if (addr.houseNo) setInputValue(document.querySelector('input[aria-label="บ้านเลขที่ *"]'), addr.houseNo);
  if (addr.moo) setInputValue(document.querySelector('input[aria-label="หมู่บ้าน / อาคาร"]'), addr.moo);
  if (addr.soi) setInputValue(document.querySelector('input[aria-label="ซอย"]'), addr.soi);
  if (addr.road) setInputValue(document.querySelector('input[aria-label="ถนน"]'), addr.road);

  console.log("กรอก Step 3 เสร็จสิ้น");
}
