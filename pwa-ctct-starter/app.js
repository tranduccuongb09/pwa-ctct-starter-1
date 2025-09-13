// ======= CẤU HÌNH =======
const SHEET_API = 'https://script.google.com/macros/s/AKfycbyZW2QdOTOkqHaFSNdaYEQtqaGmVk2b7ZzpDbqbNTDsYTFtR0MJmFGBCZ3Jbu--376GhA/exec'; // <— dán URL /exec sau khi Deploy
const QUESTIONS_API = `${SHEET_API}?action=questions`;      // GET câu hỏi
const TOTAL_QUESTIONS = 30;                                  // số câu lấy cho mỗi đề
const DURATION_MINUTES = 30;                                 // thời gian làm bài
// Danh sách tài liệu PDF Drive (đặt trong materials.html cũng đọc biến này nếu cùng file)
const MATERIALS = [
  // { title: 'Giáo trình CTĐ, CTCT - Chương 1', url: 'https://drive.google.com/file/d/xxx/preview' },
];

// ======= TRẠNG THÁI =======
let bank = [];
let questions = [];
let selections = {};  // { idx: 'A'|'B'|'C'|'D' }
let currentIndex = 0;
let timer, remainingSeconds;
let submitted = false;

// ======= HỖ TRỢ =======
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function pickRandom(arr, n){ const cp=arr.slice(); shuffle(cp); return cp.slice(0, Math.min(n, cp.length)); }
function pad(n){ return n<10? '0'+n : ''+n; }

// ======= TẢI CÂU HỎI TỪ APPS SCRIPT =======
async function loadQuestions() {
  const res = await fetch(QUESTIONS_API, { cache: 'no-store' });
  const data = await res.json();
  bank = Array.isArray(data.questions) ? data.questions : [];
  if (bank.length === 0) throw new Error('Không có câu hỏi nào trong Google Sheets.');
  questions = pickRandom(bank, TOTAL_QUESTIONS);
  document.getElementById('progress').textContent = `0/${questions.length}`;
}

// ======= RENDER =======
function renderQuestion(){
  const q = questions[currentIndex];
  document.getElementById('qTitle').textContent = `Câu ${currentIndex+1}`;
  document.getElementById('qText').textContent  = q.question;

  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';
  ['A','B','C','D'].forEach(key => {
    const id = `opt_${currentIndex}_${key}`;
    const label = document.createElement('label');
    label.className = 'option';
    label.setAttribute('for', id);
    label.innerHTML = `
      <input type="radio" id="${id}" name="ans" value="${key}">
      <span class="opt-text"><b>${key}.</b> ${q.options[key] || ''}</span>
    `;
    optionsEl.appendChild(label);
  });
  if (selections[currentIndex]) {
    const sel = document.querySelector(`input[name="ans"][value="${selections[currentIndex]}"]`);
    if (sel) sel.checked = true;
  }
  document.getElementById('progress').textContent = `${currentIndex+1}/${questions.length}`;
}

function startTimer(){
  remainingSeconds = DURATION_MINUTES * 60;
  const timeEl = document.getElementById('time');
  const tick = () => {
    const m = Math.floor(remainingSeconds/60), s = remainingSeconds%60;
    timeEl.textContent = `${pad(m)}:${pad(s)}`;
    remainingSeconds--;
    if (remainingSeconds < 0){ clearInterval(timer); submitQuiz(); }
  };
  tick(); timer = setInterval(tick, 1000);
}

function classify(score,total){
  const r=score/total;
  if(r>=0.9) return 'Giỏi';
  if(r>=0.8) return 'Khá';
  if(r>=0.6) return 'Đạt yêu cầu';
  return 'Chưa đạt';
}

// ======= MAIN =======
window.addEventListener('DOMContentLoaded', async () => {
  const startBtn   = document.getElementById('startBtn');
  const startCard  = document.getElementById('startCard');
  const quizBox    = document.getElementById('quizBox');
  const resultCard = document.getElementById('resultCard');

  // tải ngân hàng câu hỏi từ Sheets
  try { await loadQuestions(); } 
  catch(e){ alert(e.message || 'Lỗi tải câu hỏi'); return; }

  // bắt đầu
  startBtn.addEventListener('click', () => {
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim();
    if (!name || !unit || !position) { alert('Nhập Họ tên, Đơn vị, Chức vụ trước khi bắt đầu.'); return; }
    startCard.hidden = true; quizBox.hidden = false;
    renderQuestion(); startTimer();
  });

  // điều hướng
  document.getElementById('nextBtn').addEventListener('click', () => {
    const checked = document.querySelector('input[name="ans"]:checked');
    if (checked) selections[currentIndex] = checked.value;
    if (currentIndex < questions.length-1){ currentIndex++; renderQuestion(); }
  });
  document.getElementById('prevBtn').addEventListener('click', () => {
    const checked = document.querySelector('input[name="ans"]:checked');
    if (checked) selections[currentIndex] = checked.value;
    if (currentIndex > 0){ currentIndex--; renderQuestion(); }
  });
  document.getElementById('submitBtn').addEventListener('click', submitQuiz);

  // ======= NỘP =======
  async function submitQuiz(){
    if (submitted) return;
    submitted = true;
    const btn = document.getElementById('submitBtn'); if (btn) btn.disabled = true;

    clearInterval(timer);
    const checked = document.querySelector('input[name="ans"]:checked');
    if (checked) selections[currentIndex] = checked.value;

    let score = 0;
    questions.forEach((q, idx) => { if (selections[idx] === q.answer) score++; });
    const total    = questions.length;
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim();

    const details = questions.map((q, idx) => {
      const chosen = selections[idx] || '';
      return {
        index: idx+1,
        question: q.question,
        chosen,
        correct: q.answer,
        isCorrect: chosen === q.answer
      };
    });

    document.getElementById('resultText').textContent =
      `${name} - ${unit} (${position}): ${score}/${total} điểm`;
    document.getElementById('classification').textContent = 'Xếp loại: ' + classify(score,total);
    quizBox.hidden = true; resultCard.hidden = false;

    // MÃ ĐỀ (mỗi lượt nộp sinh 1 mã)
    const examCode = Date.now().toString(36) + Math.random().toString(36).slice(2,8);

    // Gửi về Sheets
    try{
      await fetch(SHEET_API, {
        method:'POST', mode:'no-cors',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ examCode, name, unit, position, score, total, details, timestamp:new Date().toISOString() })
      });
    }catch(err){ console.warn('Không gửi được điểm về Sheets:', err); }
  }
});
