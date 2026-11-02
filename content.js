// content.js

// ==========================================
// ⚙️ TIMING SETTINGS (โหลดจาก chrome.storage)
// ==========================================
const DEFAULT_TIMINGS = {
  checkboxClickWait: 500,
  acceptBtnWait: 500,
  dropdownOpenWait: 800, // จะถูกใช้เป็น Timeout สูงสุดแทน
  dropdownSelectWait: 1000, // จะถูกใช้เป็น Timeout สูงสุดแทน
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

// Helper: รอจนกว่าเงื่อนไขจะเป็นจริง (Dynamic Wait แทน sleep ตายตัว)
async function waitUntil(conditionFn, timeoutMs, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = conditionFn();
    if (result) return result;
    await sleep(intervalMs);
  }
  return null;
}

// ---------------------------------------------------------
// 🌟 Quasar Dropdown (Robust & Resilient Version)
// ---------------------------------------------------------
async function selectQuasarByLabel(labelText, valueToSelect, maxRetries = 3) {
  if (!valueToSelect) return true;

  const targetStr = String(valueToSelect).trim();
  const targetNum = parseInt(targetStr, 10);
  const isNumeric = !isNaN(targetNum) && /^\d+$/.test(targetStr);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 1. หา Element เป้าหมาย
    let targetLabel = null;
    for (let div of document.querySelectorAll('.q-field__label')) {
      if (div.innerText.includes(labelText)) { targetLabel = div; break; }
    }
    if (!targetLabel) return false;
    const qField = targetLabel.closest('.q-field');
    const nativeDiv = qField?.querySelector('.q-field__native');
    if (!nativeDiv) return false;

    // 2. ถ้ามีค่าเดิมอยู่แล้ว ให้ผ่านเลย
    const currentText = (nativeDiv.innerText || '').trim();
    if (currentText.includes(targetStr) || targetStr.includes(currentText)) {
      return true;
    }

    // 3. เคลียร์เมนูเก่าที่อาจค้างอยู่
    document.body.click();
    await sleep(100);

    // 4. คลิกเปิด Dropdown
    nativeDiv.click();

    // 5. รอเมนูเปิด (Dynamic Wait)
    const targetMenu = await waitUntil(() => {
      const menus = document.querySelectorAll('.q-menu');
      for (let m of menus) {
        if (m.offsetWidth > 0 && m.offsetHeight > 0) return m;
      }
      return null;
    }, TIMINGS.dropdownOpenWait);

    if (!targetMenu) {
      console.warn(`[Attempt ${attempt}] Dropdown "${labelText}" ไม่เปิด`);
      continue; // ลองใหม่
    }

    // 6. ค้นหา Option ที่ต้องการ
    let matchedOption = null;
    const options = targetMenu.querySelectorAll('.q-item');
    for (let opt of options) {
      const optText = opt.innerText.trim();
      if (isNumeric) {
        const optNumMatch = optText.match(/\d+/);
        if (optNumMatch && parseInt(optNumMatch[0], 10) === targetNum) {
          matchedOption = opt; break;
        }
      } else if (optText.includes(targetStr)) {
        matchedOption = opt; break;
      }
    }

    // 7. ถ้าเจอใน DOM ให้คลิก (พร้อมป้องกัน Virtual Scroll)
    if (matchedOption) {
      // เลื่อนหน้าจอไปหา
      matchedOption.scrollIntoView({ block: 'center' });
      await sleep(150); // รอให้ scroll และ DOM นิ่ง

      // ⚠️ สำคัญ: ค้นหา Option ใหม่อีกครั้ง เพราะ scrollIntoView อาจทำให้ DOM ถูก Re-render
      let freshOptions = targetMenu.querySelectorAll('.q-item');
      let freshMatched = null;
      for (let opt of freshOptions) {
        const optText = opt.innerText.trim();
        if (isNumeric) {
          const m = optText.match(/\d+/);
          if (m && parseInt(m[0], 10) === targetNum) { freshMatched = opt; break; }
        } else if (optText.includes(targetStr)) {
          freshMatched = opt; break;
        }
      }

      if (freshMatched) {
        freshMatched.click();
      } else {
        matchedOption.click(); // fallback
      }

      // 8. รอให้เมนูปิดและเช็คว่าค่าถูกใส่จริง
      const success = await waitUntil(() => {
        const menuStillOpen = document.querySelector('.q-menu.q-position-engine') && document.querySelector('.q-menu.q-position-engine').offsetHeight > 0;
        const newText = (nativeDiv.innerText || '').trim();
        const isValueCorrect = isNumeric ? newText.includes(targetNum.toString()) : newText.includes(targetStr);
        return !menuStillOpen && isValueCorrect;
      }, TIMINGS.dropdownSelectWait);

      if (success) {
        return true; // สำเร็จ!
      } else {
        console.warn(`[Attempt ${attempt}] เลือก "${valueToSelect}" แล้วค่าไม่ถูกต้อง (ค่าที่ได้: "${nativeDiv.innerText}")`);
        document.body.click(); // ปิดเมนูที่ค้าง
        await sleep(200);
        // ไปต่อ Loop ถัดไป (Retry)
      }
    } else {
      // 9. ถ้าไม่เจอใน DOM (Virtual Scroll) ใช้ Keyboard พิมพ์ค้นหา
      const innerInput = qField.querySelector('input.q-field__native');
      const focusTarget = innerInput || nativeDiv;
      focusTarget.focus();
      
      for (let char of targetStr) {
        focusTarget.dispatchEvent(new KeyboardEvent('keydown', { key: char, keyCode: char.charCodeAt(0), bubbles: true }));
        focusTarget.dispatchEvent(new KeyboardEvent('keyup', { key: char, keyCode: char.charCodeAt(0), bubbles: true }));
        await sleep(50);
      }
      await sleep(200);

      focusTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      focusTarget.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));

      const success = await waitUntil(() => {
        const newText = (nativeDiv.innerText || '').trim();
        return isNumeric ? newText.includes(targetNum.toString()) : newText.includes(targetStr);
      }, TIMINGS.dropdownSelectWait);

      if (success) return true;
      
      console.warn(`[Attempt ${attempt}] Keyboard fallback ล้มเหลวสำหรับ "${valueToSelect}"`);
      document.body.click();
      await sleep(200);
    }
  }

  console.error(`❌ ล้มเหลวในการเลือก "${valueToSelect}" ในช่อง "${labelText}" หลังจากลอง ${maxRetries} ครั้ง`);
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
  if (lastNameInput) setInputValue(lastNameInput, data.lastName);

  // 🌟 จัดการวัน เดือน ปี (เพิ่ม Delay ให้ Vue.js ประมวลผล)
  if (data.dateOfBirth) {
    if (data.dateOfBirth.day) {
      const cleanDay = parseInt(data.dateOfBirth.day, 10).toString();
      await selectQuasarByLabel('วัน *', cleanDay);
      await sleep(400); // รอให้ Vue อัปเดต State
    }
    if (data.dateOfBirth.month) {
      const thaiMonth = convertMonthToThai(data.dateOfBirth.month);
      await selectQuasarByLabel('เดือน *', thaiMonth);
      await sleep(400); // รอให้ Vue อัปเดต State
    }
    if (data.dateOfBirth.year) {
      await selectQuasarByLabel('ปีเกิด *', data.dateOfBirth.year);
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

// (คงโค้ด fillStep3 เดิมไว้ตามที่คุณต้องการ)
async function fillStep3(data) {
  await waitForTimings();
  console.log("เริ่มกรอก Step 3...");
  const addr = data.address;
  if (!addr) return;

  if (addr.province) {
    const success = await selectQuasarByLabel('จังหวัด *', addr.province);
    if (success) await sleep(TIMINGS.provinceLoadWait);
  }
  if (addr.district) {
    const success = await selectQuasarByLabel('เขต / อำเภอ *', addr.district);
    if (success) await sleep(TIMINGS.districtLoadWait);
  }
  if (addr.subDistrict) {
    await selectQuasarByLabel('แขวง / ตำบล *', addr.subDistrict);
    await sleep(TIMINGS.subDistrictLoadWait);
  }

  if (addr.postcode) setInputValue(document.querySelector('input[aria-label="รหัสไปรษณีย์ *"]'), addr.postcode);
  if (addr.houseNo) setInputValue(document.querySelector('input[aria-label="บ้านเลขที่ *"]'), addr.houseNo);
  if (addr.moo) setInputValue(document.querySelector('input[aria-label="หมู่บ้าน / อาคาร"]'), addr.moo);
  if (addr.soi) setInputValue(document.querySelector('input[aria-label="ซอย"]'), addr.soi);
  if (addr.road) setInputValue(document.querySelector('input[aria-label="ถนน"]'), addr.road);

  console.log("กรอก Step 3 เสร็จสิ้น");
}