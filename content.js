// content.js

// ==========================================
// ⚙️ TIMING SETTINGS (โหลดจาก chrome.storage)
// ==========================================
const DEFAULT_TIMINGS = {
  checkboxClickWait: 500,
  acceptBtnWait: 500,
  dropdownOpenWait: 1500,
  dropdownSelectWait: 1500,
  provinceLoadWait: 1500,
  districtLoadWait: 1500,
  subDistrictLoadWait: 1500,
  passportRadioWait: 300,
  referralVerifyWait: 100,
  dropdownNotFoundWait: 500,
  dropdownForceCloseWait: 500
};

let TIMINGS = { ...DEFAULT_TIMINGS };
let timingsLoaded = false;

chrome.storage.local.get(['fillTimings'], (result) => {
  if (result.fillTimings) {
    TIMINGS = { ...DEFAULT_TIMINGS, ...result.fillTimings };
  }
  timingsLoaded = true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.fillTimings) {
    TIMINGS = { ...DEFAULT_TIMINGS, ...(changes.fillTimings.newValue || {}) };
    timingsLoaded = true;
  }
});

function waitForTimings() {
  if (timingsLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => (timingsLoaded ? resolve() : setTimeout(check, 10));
    check();
  });
}

// ==========================================
// MESSAGE HANDLER
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fillStep1") {
    fillStep1().then(result => sendResponse({ status: "done", result }));
  } else if (request.action === "fillStep2") {
    fillStep2(request.data).then(result => sendResponse({ status: "done", result }));
  } else if (request.action === "fillStep3") {
    fillStep3(request.data).then(() => sendResponse({ status: "done" }));
  }
  return true;
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------
async function waitUntil(conditionFn, timeoutMs, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = conditionFn();
    if (result) return result;
    await sleep(intervalMs);
  }
  return null;
}

async function fillStep1() {
  await waitForTimings();
  console.log("เริ่มดำเนินการ Step 1 (ยอมรับเงื่อนไข)...");

  let checkbox = document.querySelector('div[role="checkbox"][aria-label*="ข้าพเจ้าได้อ่านรายละเอียด"]');
  if (!checkbox) {
    checkbox = document.querySelector('.consent.q-checkbox, .q-checkbox');
  }

  if (checkbox) {
    const isChecked = checkbox.getAttribute('aria-checked') === 'true' ||
                      checkbox.classList.contains('q-checkbox__inner--truthy') ||
                      checkbox.querySelector('.q-checkbox__inner--truthy');
    if (!isChecked) {
      checkbox.click();
      await sleep(TIMINGS.checkboxClickWait);
    }
  }

  let acceptBtn = null;
  const spans = document.querySelectorAll('span, button');
  for (const el of spans) {
    if (el.innerText && el.innerText.trim() === 'ยอมรับข้อตกลง') {
      acceptBtn = el.closest('button') || el;
      break;
    }
  }

  if (acceptBtn) {
    acceptBtn.click();
    await sleep(TIMINGS.acceptBtnWait);
    return { success: true, message: "ติ๊กถูกและกดยอมรับข้อตกลงเรียบร้อย" };
  } else {
    return { success: false, message: "ไม่พบปุ่มยอมรับข้อตกลง" };
  }
}

function setInputValue(element, value) {
  if (!element || value === undefined || value === null || value === '') return;
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
  return hiddenInputName ? document.querySelector(`input[name="${hiddenInputName}"]:not([type="hidden"])`) : null;
}

function formatReferralCode(value) {
  const code = String(value || '').trim();
  return /^THP-/i.test(code) ? code : `THP-${code}`;
}

function convertMonthToThai(monthStr) {
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const num = parseInt(monthStr, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return months[num - 1];
  }
  return monthStr;
}

// ---------------------------------------------------------
// 🌟 ฟังก์ชันสำหรับรายการสั้น (วัน, เดือน)
// ---------------------------------------------------------
async function selectQuasarByLabel(labelText, valueToSelect, maxRetries = 3) {
  if (!valueToSelect) return true;
  const targetStr = String(valueToSelect).trim();
  const targetNum = parseInt(targetStr, 10);
  const isNumeric = !isNaN(targetNum) && /^\d+$/.test(targetStr);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let targetLabel = null;
    for (let div of document.querySelectorAll('.q-field__label')) {
      if (div.innerText.includes(labelText)) { targetLabel = div; break; }
    }
    if (!targetLabel) return false;
    
    const qField = targetLabel.closest('.q-field');
    if (!qField) return false;
    const nativeDiv = qField.querySelector('.q-field__native');
    if (!nativeDiv) return false;

    if ((nativeDiv.innerText || '').trim().includes(targetStr)) return true;

    const openMenus = Array.from(document.querySelectorAll('.q-menu')).filter(m => m.offsetHeight > 0);
    if (openMenus.length > 0) {
      document.body.click();
      await sleep(300);
    }

    qField.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(200);
    nativeDiv.click();
    
    const targetMenu = await waitUntil(() => {
      const menus = document.querySelectorAll('.q-menu');
      for (let m of menus) {
        if (m.offsetWidth > 0 && m.offsetHeight > 0) return m;
      }
      return null;
    }, TIMINGS.dropdownOpenWait || 1500);

    if (!targetMenu) continue; 

    let matchedOption = null;
    const options = targetMenu.querySelectorAll('.q-item');
    for (let opt of options) {
      const optText = opt.innerText.trim();
      if (isNumeric) {
        const m = optText.match(/\d+/);
        if (m && parseInt(m[0], 10) === targetNum) { matchedOption = opt; break; }
      } else if (optText.includes(targetStr)) {
        matchedOption = opt; break;
      }
    }

    if (matchedOption) {
      matchedOption.click();
      const success = await waitUntil(() => {
        const menuStillOpen = document.querySelector('.q-menu.q-position-engine') && document.querySelector('.q-menu.q-position-engine').offsetHeight > 0;
        const newText = (nativeDiv.innerText || '').trim();
        return !menuStillOpen && newText.includes(targetStr);
      }, TIMINGS.dropdownSelectWait || 1500);

      if (success) return true;
      document.body.click(); 
      await sleep(300);
    }
  }
  return false;
}

// ---------------------------------------------------------
// 🌟 ฟังก์ชันสำหรับรายการยาวๆ (ปีเกิด, จังหวัด, อำเภอ, ตำบล) ใช้ Scroll หา
// ---------------------------------------------------------
async function selectQuasarByScroll(labelText, valueToSelect, maxRetries = 3) {
  if (!valueToSelect) return true;
  const targetStr = String(valueToSelect).trim();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let targetLabel = null;
    for (let div of document.querySelectorAll('.q-field__label')) {
      if (div.innerText.includes(labelText)) { targetLabel = div; break; }
    }
    if (!targetLabel) return false;
    
    const qField = targetLabel.closest('.q-field');
    if (!qField) return false;
    const nativeDiv = qField.querySelector('.q-field__native');
    if (!nativeDiv) return false;

    if ((nativeDiv.innerText || '').trim().includes(targetStr)) return true;

    // ล้างเมนูเก่า
    const openMenus = Array.from(document.querySelectorAll('.q-menu')).filter(m => m.offsetHeight > 0);
    if (openMenus.length > 0) {
      document.body.click();
      await sleep(300);
    }

    // เปิด Dropdown
    qField.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(200);
    nativeDiv.click();
    
    const targetMenu = await waitUntil(() => {
      const menus = document.querySelectorAll('.q-menu');
      for (let m of menus) {
        if (m.offsetWidth > 0 && m.offsetHeight > 0) return m;
      }
      return null;
    }, TIMINGS.dropdownOpenWait || 1500);

    if (!targetMenu) continue;

    await sleep(300); // รอ Animation

    // 🌟 กฎเหล็ก: Scroll กลับไปบนสุดก่อน
    targetMenu.scrollTop = 0;
    await sleep(300);
    
    let foundOption = null;
    
    // หาในรอบแรก
    const firstBatch = targetMenu.querySelectorAll('.q-item');
    for (let opt of firstBatch) {
      if (opt.innerText.trim().includes(targetStr)) { foundOption = opt; break; }
    }

    // ถ้ายังไม่เจอ ค่อยไล่ Scroll ลงมาหา
    if (!foundOption) {
      for (let scrollCount = 0; scrollCount < 50; scrollCount++) {
        targetMenu.scrollTop += 300;
        await sleep(150); 
        
        const options = targetMenu.querySelectorAll('.q-item');
        for (let opt of options) {
          if (opt.innerText.trim().includes(targetStr)) { foundOption = opt; break; }
        }

        if (foundOption) break;

        if (targetMenu.scrollTop + targetMenu.clientHeight >= targetMenu.scrollHeight - 10) break;
      }
    }

    // ถ้าเจอ ให้คลิก
    if (foundOption) {
      foundOption.click();
      
      const success = await waitUntil(() => {
        const newText = (nativeDiv.innerText || '').trim();
        return newText.includes(targetStr);
      }, TIMINGS.dropdownSelectWait || 1500);

      if (success) {
        console.log(`✅ [Scroll] เลือก "${targetStr}" ในช่อง "${labelText}" สำเร็จ`);
        return true;
      }
    }

    console.warn(`[Attempt ${attempt}] Scroll หา "${targetStr}" ไม่เจอ`);
    document.body.click(); 
    await sleep(300);
  }
  return false;
}

// ---------------------------------------------------------
// Main Functions
// ---------------------------------------------------------

async function fillStep2(data) {
  await waitForTimings();
  console.log("เริ่มกรอก Step 2...");
  const result = {};

  if (data.firstName) {
    setInputValue(document.querySelector('input[aria-label="ชื่อจริง (ไม่ต้องใส่คำนำหน้าชื่อ) *"]'), data.firstName);
  }
  
  const lastNameInput = document.querySelector('input[aria-label="นามสกุล *"]');
  if (lastNameInput) {
    setInputValue(lastNameInput, data.lastName);
    await sleep(400); // รอให้ฟอร์มตรวจสอบนามสกุลเสร็จก่อน
  }

  // 🌟 จัดการวัน เดือน ปี
  if (data.dateOfBirth) {
    if (data.dateOfBirth.day) {
      const cleanDay = parseInt(data.dateOfBirth.day, 10).toString();
      await selectQuasarByLabel('วัน *', cleanDay);
      await sleep(400); 
    }
    
    if (data.dateOfBirth.month) {
      const thaiMonth = convertMonthToThai(data.dateOfBirth.month);
      await selectQuasarByLabel('เดือน *', thaiMonth);
      await sleep(400); 
    }
    
    if (data.dateOfBirth.year) {
      await selectQuasarByScroll('ปีเกิด *', data.dateOfBirth.year);
      await sleep(400);
    }
  }

  if (data.citizenId) {
    setInputValue(document.querySelector('input[aria-label="รหัสบัตรประชาชน / Passport No.*"]'), data.citizenId);
  } else if (data.passport) {
    const passportRadio = document.querySelector('input[type="radio"][value="passport"]');
    if (passportRadio) passportRadio.click();
    await sleep(TIMINGS.passportRadioWait);
    setInputValue(document.querySelector('input[aria-label="รหัสบัตรประชาชน / Passport No.*"]'), data.passport);
  }

  if (data.phone) {
    setInputValue(document.querySelector('input[aria-label="เบอร์โทรศัพท์ *"]'), data.phone);
  }
  if (data.email) {
    setInputValue(document.querySelector('input[aria-label="อีเมล (ถ้ามี)"]'), data.email);
  }

  if (data.referralCode) {
    const refInput = document.querySelector('input[aria-label="หมายเลขสมาชิกที่แนะนำ"]') || findQuasarInput('หมายเลขสมาชิกที่แนะนำ', 'Signup:loginForm:j_id58');
    const formattedReferralCode = formatReferralCode(data.referralCode);
    if (refInput) {
      setInputValue(refInput, formattedReferralCode);
      await sleep(TIMINGS.referralVerifyWait);
    }
    result.referralCode = { sent: formattedReferralCode, found: Boolean(refInput), valueAfterFill: refInput?.value || '' };
  }

  if (data.recommendedPostcode) {
    const postcodeInput = document.querySelector('input[aria-label="รหัสไปรษณีย์ที่แนะนำ"]') || findQuasarInput('รหัสไปรษณีย์ที่แนะนำ', 'Signup:loginForm:j_id59');
    if (postcodeInput) setInputValue(postcodeInput, data.recommendedPostcode);
    result.recommendedPostcode = { sent: data.recommendedPostcode, found: Boolean(postcodeInput), valueAfterFill: postcodeInput?.value || '' };
  }

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
  await waitForTimings();
  console.log("เริ่มกรอก Step 3...");
  const addr = data.address;
  if (!addr) return;

  // 🌟 เปลี่ยนมาใช้ selectQuasarByScroll เพื่อแก้ปัญหา Virtual Scroll
  if (addr.province) {
    const success = await selectQuasarByScroll('จังหวัด *', addr.province);
    if (success) await sleep(TIMINGS.provinceLoadWait);
  }
  if (addr.district) {
    const success = await selectQuasarByScroll('เขต / อำเภอ *', addr.district);
    if (success) await sleep(TIMINGS.districtLoadWait);
  }
  if (addr.subDistrict) {
    await selectQuasarByScroll('แขวง / ตำบล *', addr.subDistrict);
    await sleep(TIMINGS.subDistrictLoadWait);
  }

  if (addr.postcode) setInputValue(document.querySelector('input[aria-label="รหัสไปรษณีย์ *"]'), addr.postcode);
  if (addr.houseNo) setInputValue(document.querySelector('input[aria-label="บ้านเลขที่ *"]'), addr.houseNo);
  if (addr.moo) setInputValue(document.querySelector('input[aria-label="หมู่บ้าน / อาคาร"]'), addr.moo);
  if (addr.soi) setInputValue(document.querySelector('input[aria-label="ซอย"]'), addr.soi);
  if (addr.road) setInputValue(document.querySelector('input[aria-label="ถนน"]'), addr.road);

  console.log("กรอก Step 3 เสร็จสิ้น");
}