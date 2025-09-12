// ======= CẤU HÌNH =======
const TOTAL_QUESTIONS = 30;              // số câu trong 1 lượt thi
const DURATION_MINUTES = 30;             // thời gian làm bài (phút)
const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx4LbL2Q57bk7nCb4ngkg0thQS8EDJWH30qnr0WF7NUV6xxzSQKwfCjrpXSc2mZuar0mg/exec'; // URL Web App Apps Script

// ======= TRẠNG THÁI =======
let questions = [];
let currentIndex = 0;
let selections = {};  // {index: 'A'|'B'|'C'|'D'}
let timer, remainingSeconds;
let submitted = false; // chặn nộp trùng

// ======= HỖ TRỢ =======
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function pad(n){ return n<10? '0'+n : ''+n; }
function pickRandom(arr, n){ const copy = arr.slice(); shuffle(copy); return copy.slice(0, Math.min(n, copy.length)); }

function renderQuestion(){
  const q = questions[currentIndex];
  document.getElementById('qTitle').textContent = `Câu ${currentIndex+1}`;
  document.getElementById('qText').textContent = q.question;

  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';
  ['A','B','C','D'].forEach(key => {
    const id = `opt_${key}`;
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="ans" value="${key}" id="${id}"> ${q.options[key]}`;
    optionsEl.appendChild(label);
  });

  // Khôi phục lựa chọn cũ (nếu có)
  if (selections[currentIndex]) {
    const selected = document.querySelector(`input[name="ans"][value="${selections[currentIndex]}"]`);
    if (selected) selected.checked = true;
  }

  document.getElementById('progress').textContent = `${currentIndex+1}/${questions.length}`;
}

function startTimer(){
  remainingSeconds = DURATION_MINUTES * 60;
  const timeEl = document.getElementById('time');

  function tick(){
    const m = Math.floor(remainingSeconds/60);
    const s = remainingSeconds%60;
    timeEl.textContent = `${pad(m)}:${pad(s)}`;
    remainingSeconds--;
    if(remainingSeconds < 0){
      clearInterval(timer);
      submitQuiz();
    }
  }

  tick();
  timer = setInterval(tick, 1000);
}

function classify(score, total){
  const ratio = score/total;
  if (ratio >= 0.9) return 'Giỏi';
  if (ratio >= 0.8) return 'Khá';
  if (ratio >= 0.6) return 'Đạt yêu cầu';
  return 'Chưa đạt';
}

// ======= SỰ KIỆN =======
window.addEventListener('DOMContentLoaded', async () => {
  const startBtn   = document.getElementById('startBtn');
  const startCard  = document.getElementById('startCard');
  const quizBox    = document.getElementById('quizBox');
  const resultCard = document.getElementById('resultCard');

  // Tải ngân hàng câu hỏi
  const res  = await fetch('data/questions.json');
  const bank = await res.json();
  questions  = pickRandom(bank, TOTAL_QUESTIONS);
  document.getElementById('progress').textContent = `0/${questions.length}`;

  // Bắt đầu làm bài
  startBtn.addEventListener('click', () => {
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim(); // trường mới

    if (!name || !unit || !position) {
      alert('Vui lòng nhập Họ tên, Đơn vị và Chức vụ trước khi bắt đầu.');
      return;
    }

    startCard.hidden = true;
    quizBox.hidden   = false;
    renderQuestion();
    startTimer();
  });

  // Điều hướng
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
    if (submitted) return;              // chống nộp trùng
    submitted = true;
    const submitBtnEl = document.getElementById('submitBtn');
    if (submitBtnEl) submitBtnEl.disabled = true;

    clearInterval(timer);

    // Lưu lựa chọn đang tick dở
    const checked = document.querySelector('input[name="ans"]:checked');
    if (checked) selections[currentIndex] = checked.value;

    // Tính điểm
    let score = 0;
    questions.forEach((q, idx) => { if (selections[idx] === q.answer) score++; });
    const total    = questions.length;
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim();

    // Chuẩn bị chi tiết từng câu
    const details = questions.map((q, idx) => {
      const chosen  = selections[idx] || null;
      const correct = q.answer;
      return { index: idx + 1, question: q.question, chosen, correct, isCorrect: chosen === correct };
    });

    // Hiển thị kết quả
    document.getElementById('resultText').textContent =
      `${name} - ${unit} (${position}): ${score}/${total} điểm`;
    document.getElementById('classification').textContent =
      'Xếp loại: ' + classify(score, total);
    quizBox.hidden   = true;
    resultCard.hidden = false;

    // Mã submission duy nhất để ghép 2 sheet & chống đúp
    const submissionId =
      Date.now().toString(36) + Math.random().toString(36).slice(2,8);

    // Gửi Google Sheet
    if (SHEET_ENDPOINT && SHEET_ENDPOINT.startsWith('https')) {
      try {
        await fetch(SHEET_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors', // đơn giản hoá CORS cho demo
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
