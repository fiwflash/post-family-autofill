// popup.js

let pastedImageBase64 = null;
let savedRefCodes = [];
let selectedRefCode = '';
let recommendedPostcode = '';

// ==========================================
// ⚙️ TIMING SETTINGS
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

const PRESET_MULTIPLIERS = { fast: 0.5, normal: 1.0, safe: 1.5 };
let currentTimings = { ...DEFAULT_TIMINGS };

// ==========================================
// ⚙️ INITIALIZATION & SETTINGS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. โหลด API Key & Model
    chrome.storage.local.get(['geminiApiKey', 'selectedModel'], (result) => {
        if (result.geminiApiKey) {
            document.getElementById('apiKey').value = result.geminiApiKey;
            fetchAvailableModels(result.geminiApiKey, result.selectedModel);
        }
    });

    // 2. โหลด Referral Codes
    chrome.storage.local.get(['refCodes', 'recommendedPostcode'], (result) => {
        savedRefCodes = (result.refCodes || []).map(item => typeof item === 'string' ? { code: item, name: '' } : item);
        recommendedPostcode = result.recommendedPostcode || '';
        document.getElementById('recommendedPostcode').value = recommendedPostcode;
        chrome.storage.local.set({ refCodes: savedRefCodes });
        renderRefCodes();
    });

    // 3. โหลด Timings
    chrome.storage.local.get(['fillTimings'], (result) => {
        if (result.fillTimings) {
            currentTimings = { ...DEFAULT_TIMINGS, ...result.fillTimings };
        }
        loadTimingsIntoUI();
    });
});

// API Key & Model
document.getElementById('apiKey').addEventListener('input', (e) => {
    const key = e.target.value.trim();
    if (key) { chrome.storage.local.set({ geminiApiKey: key }); fetchAvailableModels(key); }
});
document.getElementById('modelSelect').addEventListener('change', (e) => chrome.storage.local.set({ selectedModel: e.target.value }));
document.getElementById('refreshModels').addEventListener('click', () => {
    const key = document.getElementById('apiKey').value.trim();
    if (key) fetchAvailableModels(key);
});

async function fetchAvailableModels(key, savedModel) {
    const select = document.getElementById('modelSelect');
    const statusDot = document.getElementById('modelStatus');
    select.innerHTML = '<option value="">⏳ กำลังโหลด...</option>';
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!response.ok) throw new Error("Invalid");
        const data = await response.json();
        let models = data.models.filter(m => {
            const nameLower = m.name.toLowerCase();
            return nameLower.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent') && !nameLower.includes('tts') && !nameLower.includes('embedding');
        });

        // บังคับ gemini-2.5-flash ให้อยู่บนสุดเสมอ
        const getPriority = (name) => {
            if (name.includes('2.5-flash')) return 9999;
            let s = 0;
            if (name.includes('3.8')) s += 380; else if (name.includes('3.6')) s += 360; else if (name.includes('3.5')) s += 350;
            else if (name.includes('3.')) s += 300; else if (name.includes('2.5')) s += 250; else if (name.includes('2.0')) s += 200;
            else if (name.includes('1.5')) s += 150;
            if (name.includes('flash') && !name.includes('pro')) s += 50;
            if (name.includes('preview')) s -= 10;
            return s;
        };
        models.sort((a, b) => getPriority(b.name) - getPriority(a.name));

        select.innerHTML = '';
        models.forEach(model => {
            const opt = document.createElement('option');
            opt.value = model.name;
            let displayName = (model.displayName || model.name.split('/')[1]).replace('models/', '');
            opt.innerText = `${model.name.includes('flash') ? '⚡' : '🧠'} ${displayName}`;
            if (model.name === savedModel) opt.selected = true;
            select.appendChild(opt);
        });

        if (!savedModel && select.options.length > 0) {
            select.options[0].selected = true;
            chrome.storage.local.set({ selectedModel: select.options[0].value });
        }
        statusDot.className = 'status-dot online';
    } catch (err) {
        select.innerHTML = '<option value="">❌ API Key ผิดพลาด</option>';
        statusDot.className = 'status-dot offline';
    }
}

// ==========================================
// ⚙️ SETTINGS MODAL LOGIC
// ==========================================
const modal = document.getElementById('settingsModal');

document.getElementById('settingsBtn').addEventListener('click', () => {
    loadTimingsIntoUI();
    modal.classList.add('open');
});

document.getElementById('closeModalBtnX').addEventListener('click', () => modal.classList.remove('open'));
document.getElementById('closeModalBtnFooter').addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

function loadTimingsIntoUI() {
    document.querySelectorAll('[data-timing]').forEach(el => {
        const key = el.dataset.timing;
        if (currentTimings[key] !== undefined) {
            el.value = (currentTimings[key] / 1000).toFixed(1);
        }
    });
    detectActivePreset();
}

function persistTimings() {
    chrome.storage.local.set({ fillTimings: currentTimings });
    detectActivePreset();
}

function readTimingsFromUI() {
    document.querySelectorAll('[data-timing]').forEach(el => {
        const key = el.dataset.timing;
        const val = parseFloat(el.value);
        if (!isNaN(val) && val >= 0) {
            currentTimings[key] = Math.round(val * 1000);
        }
    });
}

document.querySelectorAll('[data-timing]').forEach(el => {
    el.addEventListener('input', () => { readTimingsFromUI(); persistTimings(); });
    el.addEventListener('blur', () => {
        const key = el.dataset.timing;
        if (currentTimings[key] !== undefined) el.value = (currentTimings[key] / 1000).toFixed(1);
        readTimingsFromUI();
        persistTimings();
    });
});

document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
        const mult = PRESET_MULTIPLIERS[btn.dataset.preset];
        if (!mult) return;
        Object.keys(DEFAULT_TIMINGS).forEach(key => {
            currentTimings[key] = Math.round(DEFAULT_TIMINGS[key] * mult);
        });
        loadTimingsIntoUI();
        persistTimings();
    });
});

function detectActivePreset() {
    let matched = null;
    for (const [id, mult] of Object.entries(PRESET_MULTIPLIERS)) {
        let isMatch = true;
        for (const key of Object.keys(DEFAULT_TIMINGS)) {
            if (currentTimings[key] !== Math.round(DEFAULT_TIMINGS[key] * mult)) { isMatch = false; break; }
        }
        if (isMatch) { matched = id; break; }
    }
    document.querySelectorAll('.preset').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === matched);
    });
}

document.getElementById('resetTimingsBtn').addEventListener('click', () => {
    currentTimings = { ...DEFAULT_TIMINGS };
    loadTimingsIntoUI();
    persistTimings();
});

// ==========================================
// 🚀 STEP 1: OPEN URL & ACCEPT TERMS
// ==========================================
const SIGNUP_URL = "https://praisanee.my.site.com/postfamily/Signup";

// ฟังก์ชันกลางสำหรับการทำงานของ Step 1
async function executeStep1() {
    const status = document.getElementById('status');
    status.innerText = "กำลังเปิดหน้าเว็บ & ยอมรับข้อตกลง...";
    status.style.color = "#3b82f6";

    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        let targetTab = activeTab;

        if (!activeTab || !activeTab.url || !activeTab.url.startsWith("https://praisanee.my.site.com/postfamily/Signup")) {
            if (activeTab && activeTab.url && (activeTab.url === "chrome://newtab/" || activeTab.url === "about:blank")) {
                targetTab = await chrome.tabs.update(activeTab.id, { url: SIGNUP_URL });
            } else {
                targetTab = await chrome.tabs.create({ url: SIGNUP_URL });
            }

            await new Promise((resolve) => {
                const listener = (tabId, changeInfo) => {
                    if (tabId === targetTab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }, 10000);
            });

            await new Promise(r => setTimeout(r, 1500));
        }

        const sendStep1Message = () => {
            return new Promise((resolve) => {
                chrome.tabs.sendMessage(targetTab.id, { action: "fillStep1" }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response?.result || { success: true });
                    }
                });
            });
        };

        let res = await sendStep1Message();

        if (!res.success && res.error) {
            await new Promise(r => setTimeout(r, 1000));
            res = await sendStep1Message();
        }

        if (res.success) {
            status.innerText = "✅ ยอมรับข้อตกลง Step 1 เรียบร้อย!";
            status.style.color = "#16a34a";
        } else {
            status.innerText = `⚠️ ${res.message || res.error || "เกิดข้อผิดพลาดในการกด Step 1"}`;
            status.style.color = "#ef4444";
        }
    } catch (err) {
        console.error("Step 1 error:", err);
        status.innerText = `⚠️ เกิดข้อผิดพลาด: ${err.message}`;
        status.style.color = "#ef4444";
    }
}

// ผูก Event ให้กับทั้ง 2 ปุ่ม (แบบปลอดภัย ไม่พัง)
const btnStep1Main = document.getElementById('step1Btn');
if (btnStep1Main) btnStep1Main.addEventListener('click', executeStep1);

const btnStep1Review = document.getElementById('step1BtnReview');
if (btnStep1Review) btnStep1Review.addEventListener('click', executeStep1);

// ==========================================
// 🎁 REFERRAL CODE MANAGEMENT
// ==========================================
document.getElementById('addRefCodeBtn').addEventListener('click', () => {
    const codeInput = document.getElementById('newRefCodeInput');
    const nameInput = document.getElementById('newRefNameInput');
    const code = codeInput.value.trim();
    const name = nameInput.value.trim();

    if (code && !savedRefCodes.some(item => item.code === code)) {
        savedRefCodes.push({ code, name });
        chrome.storage.local.set({ refCodes: savedRefCodes }, () => {
            renderRefCodes();
            codeInput.value = '';
            nameInput.value = '';
        });
    }
});

function saveRecommendedPostcode() {
    recommendedPostcode = document.getElementById('recommendedPostcode').value.trim();
    chrome.storage.local.set({ recommendedPostcode });
}

document.getElementById('recommendedPostcode').addEventListener('blur', saveRecommendedPostcode);
document.getElementById('recommendedPostcode').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { saveRecommendedPostcode(); event.currentTarget.blur(); }
});

function renderRefCodes() {
    const container = document.getElementById('refCodeContainer');
    container.innerHTML = '';

    if (savedRefCodes.length === 0) {
        container.innerHTML = '<span style="font-size: 11px; color: #94a3b8; font-style: italic;">ยังไม่มีรหัสแนะนำ</span>';
        return;
    }

    savedRefCodes.forEach(item => {
        const tag = document.createElement('div');
        tag.className = `ref-tag ${selectedRefCode === item.code ? 'selected' : ''}`;
        tag.append(document.createTextNode(item.name || item.code));
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.type = 'button';
        delBtn.textContent = '×';
        tag.appendChild(delBtn);

        tag.addEventListener('click', (e) => {
            if (e.target === delBtn) return;
            selectedRefCode = selectedRefCode === item.code ? '' : item.code;
            renderRefCodes();
        });

        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            savedRefCodes = savedRefCodes.filter(ref => ref.code !== item.code);
            if (selectedRefCode === item.code) selectedRefCode = '';
            chrome.storage.local.set({ refCodes: savedRefCodes }, renderRefCodes);
        });

        container.appendChild(tag);
    });
}

// ==========================================
// 📸 PASTE & CLEAR LOGIC
// ==========================================
const pasteZone = document.getElementById('pasteZone');
const textInput = document.getElementById('textInput');

pasteZone.addEventListener('paste', (event) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = (e) => {
                pastedImageBase64 = e.target.result.split(',')[1];
                const container = document.getElementById('imagePreviewContainer');
                container.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${e.target.result}" style="height: 48px; border-radius: 4px; border: 1px solid #cbd5e1;">
                        <button id="removeImgBtn" style="position: absolute; top: -6px; right: -6px; background: white; border: 1px solid #e2e8f0; border-radius: 50%; cursor: pointer; font-size: 10px;">❌</button>
                    </div>
                `;
                container.style.display = 'block';
                document.getElementById('removeImgBtn').addEventListener('click', () => {
                    pastedImageBase64 = null;
                    container.style.display = 'none';
                    container.innerHTML = '';
                });
            };
            reader.readAsDataURL(file);
            event.preventDefault();
            break;
        }
    }
});

document.getElementById('clearInputBtn').addEventListener('click', () => {
    textInput.value = '';
    pastedImageBase64 = null;
    const container = document.getElementById('imagePreviewContainer');
    container.style.display = 'none';
    container.innerHTML = '';
});

// ==========================================
// 🔐 PASSWORD TOGGLE
// ==========================================
document.getElementById('togglePassword').addEventListener('click', () => {
    const input = document.getElementById('rev_password');
    if (input.type === 'password') {
        input.type = 'text';
        document.getElementById('togglePassword').innerText = '🙈';
    } else {
        input.type = 'password';
        document.getElementById('togglePassword').innerText = '👁️';
    }
});

// ==========================================
// 🧠 AI EXTRACTION (พร้อมระบบ Auto-Switch Model)
// ==========================================
document.getElementById('processBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const modelSelect = document.getElementById('modelSelect');
    const model = modelSelect.value;
    const status = document.getElementById('status');

    if (!apiKey || !model) {
        status.innerText = "⚠️ กรุณาใส่ API Key และเลือกโมเดล"; status.style.color = "#ef4444"; return;
    }

    const text = textInput.value.trim();
    if (!pastedImageBase64 && !text) {
        status.innerText = "⚠️ กรุณาแปะรูปภาพ หรือพิมพ์ข้อความ"; status.style.color = "#ef4444"; return;
    }

    status.innerText = "Gemini กำลังวิเคราะห์ข้อมูล..."; status.style.color = "#3b82f6";

    chrome.runtime.sendMessage(
        { action: "extractDataWithGemini", text: text, imageBase64: pastedImageBase64, model: model, apiKey: apiKey },
        (response) => {
            if (response && response.success) {
                populateReviewForm(response.data);
                document.getElementById('inputSection').classList.add('hidden');
                document.getElementById('reviewSection').classList.add('active');
                status.innerText = "✅ วิเคราะห์เสร็จสิ้น!"; status.style.color = "#16a34a";
            } else {
                const errorMsg = response ? response.error : "ไม่สามารถเชื่อมต่อได้";
                
                if (errorMsg.includes("high demand") || errorMsg.includes("Spikes in demand")) {
                    const topModelValue = modelSelect.options[0].value;
                    
                    if (model !== topModelValue && topModelValue !== "") {
                        modelSelect.value = topModelValue;
                        chrome.storage.local.set({ selectedModel: topModelValue });
                        
                        status.innerText = `⚠️ โมเดลมีผู้ใช้งานหนาแน่น ระบบสลับไปใช้ ${modelSelect.options[0].innerText} แทน...`;
                        status.style.color = "#f59e0b";
                        
                        setTimeout(() => {
                            document.getElementById('processBtn').click();
                        }, 1500);
                        return;
                    } else {
                        status.innerText = "⚠️ เซิร์ฟเวอร์ Gemini มีผู้ใช้งานหนาแน่น กรุณาลองใหม่ภายหลัง";
                        status.style.color = "#ef4444";
                        return;
                    }
                }

                status.innerText = "Error: " + errorMsg;
                status.style.color = "#ef4444";
            }
        }
    );
});

document.getElementById('skipToReviewBtn').addEventListener('click', () => {
    populateReviewForm({});
    document.getElementById('inputSection').classList.add('hidden');
    document.getElementById('reviewSection').classList.add('active');
    status.innerText = 'เข้าสู่หน้าตรวจสอบ'; status.style.color = "#3b82f6";
});

// ==========================================
// 📝 REVIEW FORM LOGIC
// ==========================================
function populateReviewForm(data) {
    document.getElementById('rev_referralCode').value = selectedRefCode || '';
    document.getElementById('rev_recommendedPostcode').value = recommendedPostcode;
    document.getElementById('rev_firstName').value = data.firstName || '';
    document.getElementById('rev_lastName').value = data.lastName || '';
    document.getElementById('rev_citizenId').value = data.citizenId || '';
    document.getElementById('rev_passport').value = data.passport || '';
    document.getElementById('rev_phone').value = data.phone || '';
    document.getElementById('rev_email').value = data.email || '';

    document.getElementById('rev_password').value = 'aaaa1111';
    document.getElementById('rev_password').type = 'password';
    document.getElementById('togglePassword').innerText = '👁️';

    if (data.dateOfBirth) {
        document.getElementById('rev_dob_day').value = data.dateOfBirth.day || '';
        document.getElementById('rev_dob_month').value = data.dateOfBirth.month || '';
        document.getElementById('rev_dob_year').value = data.dateOfBirth.year || '';
    } else {
        document.getElementById('rev_dob_day').value = '';
        document.getElementById('rev_dob_month').value = '';
        document.getElementById('rev_dob_year').value = '';
    }

    if (data.address) {
        document.getElementById('rev_houseNo').value = data.address.houseNo || '';
        document.getElementById('rev_moo').value = data.address.moo || '';
        document.getElementById('rev_soi').value = data.address.soi || '';
        document.getElementById('rev_road').value = data.address.road || '';
        document.getElementById('rev_subDistrict').value = data.address.subDistrict || '';
        document.getElementById('rev_district').value = data.address.district || '';
        document.getElementById('rev_province').value = data.address.province || '';
        document.getElementById('rev_postcode').value = data.address.postcode || '';
    } else {
        document.getElementById('rev_houseNo').value = '';
        document.getElementById('rev_moo').value = '';
        document.getElementById('rev_soi').value = '';
        document.getElementById('rev_road').value = '';
        document.getElementById('rev_subDistrict').value = '';
        document.getElementById('rev_district').value = '';
        document.getElementById('rev_province').value = '';
        document.getElementById('rev_postcode').value = '';
    }
}

function getReviewedData() {
    return {
        firstName: document.getElementById('rev_firstName').value,
        lastName: document.getElementById('rev_lastName').value,
        citizenId: document.getElementById('rev_citizenId').value,
        passport: document.getElementById('rev_passport').value,
        phone: document.getElementById('rev_phone').value,
        email: document.getElementById('rev_email').value,
        password: document.getElementById('rev_password').value,
        referralCode: document.getElementById('rev_referralCode').value.trim() || selectedRefCode,
        recommendedPostcode: document.getElementById('rev_recommendedPostcode').value.trim() || recommendedPostcode,
        dateOfBirth: {
            day: document.getElementById('rev_dob_day').value,
            month: document.getElementById('rev_dob_month').value,
            year: document.getElementById('rev_dob_year').value
        },
        address: {
            houseNo: document.getElementById('rev_houseNo').value,
            moo: document.getElementById('rev_moo').value,
            soi: document.getElementById('rev_soi').value,
            road: document.getElementById('rev_road').value,
            subDistrict: document.getElementById('rev_subDistrict').value,
            district: document.getElementById('rev_district').value,
            province: document.getElementById('rev_province').value,
            postcode: document.getElementById('rev_postcode').value
        }
    };
}

// ==========================================
// 🚀 AUTO-FILL EXECUTION
// ==========================================
document.getElementById('fillStep2Btn').addEventListener('click', () => {
    const data = getReviewedData();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fillStep2", data: data }, (response) => {
            if (chrome.runtime.lastError) {
                document.getElementById('status').innerText = "⚠️ กรุณาเปิดหน้าเว็บ POST Family ก่อน";
            } else {
                const referral = response?.result?.referralCode;
                if (referral) {
                    document.getElementById('status').innerText = referral.found
                        ? `หมายเลขสมาชิก: ส่ง ${referral.sent} → ได้ ${referral.valueAfterFill || 'ไม่มีค่า'}`
                        : `⚠️ ไม่พบช่องหมายเลขสมาชิก (ส่ง ${referral.sent})`;
                } else {
                    document.getElementById('status').innerText = "⚠️ ไม่มีหมายเลขสมาชิกที่ส่งไปกรอก";
                }
            }
        });
    });
});

document.getElementById('fillStep3Btn').addEventListener('click', () => {
    const data = getReviewedData();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fillStep3", data: data }, (response) => {
            if (chrome.runtime.lastError) {
                document.getElementById('status').innerText = "⚠️ กรุณาเปิดหน้าเว็บ POST Family ก่อน";
            } else {
                document.getElementById('status').innerText = "✅ กรอก Step 3 เรียบร้อย!";
            }
        });
    });
});

document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('inputSection').classList.remove('hidden');
    document.getElementById('reviewSection').classList.remove('active');
    document.getElementById('status').innerText = "พร้อมทำงาน!";
    document.getElementById('status').style.color = "#94a3b8";
});