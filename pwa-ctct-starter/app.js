// ======= CẤU HÌNH =======
const TOTAL_QUESTIONS = 30;
const DURATION_MINUTES = 30; // 30 phút
const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbye5VmBGdZLHtAs9y8ni3IhacjgoZmEK-gfeVRcVknJkLksiZSGVdzMW6V2TXCN1H9Q1Q/exec'; // Thay bằng URL Web App Apps Script

// ======= TRẠNG THÁI =======
let questions = [];
let currentIndex = 0;
let selections = {}; // {index: 'A'|'B'|'C'|'D'}
let timer, remainingSeconds;

// ======= HỖ TRỢ =======
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function pad(n){ return n<10? '0'+n : ''+n; }

function pickRandom(arr, n){
  const copy = arr.slice();
  shuffle(copy);
  return copy.slice(0, Math.min(n, copy.length));
}

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
  // Restore selection
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
  // Nút bắt đầu
  const startBtn = document.getElementById('startBtn');
  const startCard = document.getElementById('startCard');
  const quizBox  = document.getElementById('quizBox');
  const resultCard = document.getElementById('resultCard');

  // Tải câu hỏi
  const res = await fetch('data/questions.json');
  const bank = await res.json();

  // Lấy ngẫu nhiên TOTAL_QUESTIONS câu
  questions = pickRandom(bank, TOTAL_QUESTIONS);
  document.getElementById('progress').textContent = `0/${questions.length}`;

  startBtn.addEventListener('click', () => {
    const name = document.getElementById('fullname').value.trim();
    const unit = document.getElementById('unit').value.trim();
    if (!name || !unit) {
      alert('Vui lòng nhập Họ tên và Đơn vị trước khi bắt đầu.');
      return;
    }
    startCard.hidden = true;
    quizBox.hidden = false;
    renderQuestion();
    startTimer();
  });

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

  async function submitQuiz(){
    clearInterval(timer);
    // Lưu lựa chọn cuối
    const checked = document.querySelector('input[name="ans"]:checked');
    if (checked) selections[currentIndex] = checked.value;

    // Tính điểm
    let score = 0;
    questions.forEach((q, idx) => {
      if (selections[idx] === q.answer) score++;
    });
    const total = questions.length;
    const name = document.getElementById('fullname').value.trim();
    const unit = document.getElementById('unit').value.trim();

    // Hiển thị
    const resultText = document.getElementById('resultText');
    resultText.textContent = `${name} - ${unit}: ${score}/${total} điểm`;
    document.getElementById('classification').textContent = 'Xếp loại: ' + classify(score, total);
    quizBox.hidden = true;
    resultCard.hidden = false;

    // Gửi Google Sheet (Apps Script)
    if (SHEET_ENDPOINT && SHEET_ENDPOINT.startsWith('https')) {
      try {
        await fetch(SHEET_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors', // đơn giản cho demo
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            name, unit, score, total,
            timestamp: new Date().toISOString()
          })
        });
      } catch (e) {
        console.warn('Không gửi được Google Sheet:', e);
      }
    }
  }
});
