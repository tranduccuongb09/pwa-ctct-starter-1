// ======= CẤU HÌNH =======
const TOTAL_QUESTIONS = 30;            // số câu trong 1 lượt thi
const DURATION_MINUTES = 30;           // thời gian làm bài (phút)
const SHEET_ENDPOINT   = 'https://script.google.com/macros/s/AKfycbye5VmBGdZLHtAs9y8ni3IhacjgoZmEK-gfeVRcVknJkLksiZSGVdzMW6V2TXCN1H9Q1Q/exec'; // URL Web App Apps Script

// ======= TRẠNG THÁI =======
let questions = [];
let currentIndex = 0;
let selections = {};                   // {index: 'A'|'B'|'C'|'D'}
let timer, remainingSeconds;
let submitted = false;                 // chặn nộp trùng

// ======= HỖ TRỢ =======
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function pad(n){ return n<10? '0'+n : ''+n; }
function pickRandom(arr,n){ const cp=arr.slice(); shuffle(cp); return cp.slice(0,Math.min(n,cp.length)); }

// ======= RENDER CÂU HỎI (radio trái, căn đều) =======
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
      <span class="opt-text"><b>${key}.</b> ${q.options[key]}</span>
    `;
    optionsEl.appendChild(label);
  });

  // khôi phục lựa chọn đã có
  if (selections[currentIndex]) {
    const sel = document.querySelector(`input[name="ans"][value="${selections[currentIndex]}"]`);
    if (sel) sel.checked = true;
  }
  document.getElementById('progress').textContent = `${currentIndex+1}/${questions.length}`;
}

// ======= TIMER =======
function startTimer(){
  remainingSeconds = DURATION_MINUTES * 60;
  const timeEl = document.getElementById('time');
  const tick = () => {
    const m = Math.floor(remainingSeconds/60);
    const s = remainingSeconds%60;
    timeEl.textContent = `${pad(m)}:${pad(s)}`;
    remainingSeconds--;
    if (remainingSeconds < 0){
      clearInterval(timer);
      submitQuiz();
    }
  };
  tick();
  timer = setInterval(tick, 1000);
}

// ======= XẾP LOẠI =======
function classify(score, total){
  const r = score/total;
  if (r >= 0.9) return 'Giỏi';
  if (r >= 0.8) return 'Khá';
  if (r >= 0.6) return 'Đạt yêu cầu';
  return 'Chưa đạt';
}

// ======= MAIN =======
window.addEventListener('DOMContentLoaded', async () => {
  const startBtn   = document.getElementById('startBtn');
  const startCard  = document.getElementById('startCard');
  const quizBox    = document.getElementById('quizBox');
  const resultCard = document.getElementById('resultCard');

  // tải ngân hàng câu hỏi
  const res  = await fetch('data/questions.json');
  const bank = await res.json();
  questions  = pickRandom(bank, TOTAL_QUESTIONS);
  document.getElementById('progress').textContent = `0/${questions.length}`;

  // bắt đầu
  startBtn.addEventListener('click', () => {
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim();
    if (!name || !unit || !position) {
      alert('Vui lòng nhập Họ tên, Đơn vị và Chức vụ trước khi bắt đầu.');
      return;
    }
    startCard.hidden = true;
    quizBox.hidden   = false;
    renderQuestion();
    startTimer();
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

  // ======= NỘP BÀI =======
  async function submitQuiz(){
    if (submitted) return;                   // chống nộp trùng
    submitted = true;
    const submitBtnEl = document.getElementById('submitBtn');
    if (submitBtnEl) submitBtnEl.disabled = true;

    clearInterval(timer);
    const checked = document.querySelector('input[name="ans"]:checked');
    if (checked) selections[currentIndex] = checked.value;

    // tính điểm
    let score = 0;
    questions.forEach((q, idx) => { if (selections[idx] === q.answer) score++; });
    const total    = questions.length;
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim();

    // chi tiết từng câu
    const details = questions.map((q, idx) => {
      const chosen  = selections[idx] || null;
      const correct = q.answer;
      return { index: idx+1, question: q.question, chosen, correct, isCorrect: chosen === correct };
    });

    // hiển thị kết quả
    document.getElementById('resultText').textContent =
      `${name} - ${unit} (${position}): ${score}/${total} điểm`;
    document.getElementById('classification').textContent =
      'Xếp loại: ' + classify(score, total);
    document.getElementById('quizBox').hidden = true;
    resultCard.hidden = false;

    // id duy nhất cho lần nộp
    const submissionId = Date.now().toString(36) + Math.random().toString(36).slice(2,8);

    // gửi Google Sheet
    if (SHEET_ENDPOINT && SHEET_ENDPOINT.startsWith('https')) {
      try {
        await fetch(SHEET_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors', // đơn giản hóa CORS
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            submissionId,
            name, unit, position,
            score, total,
            details,
            timestamp: new Date().toISOString()
          })
        });
      } catch (e) {
        console.warn('Không gửi được Google Sheet:', e);
      }
    }
  }
});
