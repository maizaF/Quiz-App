const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

function scrollToId(id){ document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); }
function decodeHTML(str){ const d=document.createElement('div'); d.innerHTML=str; return d.textContent; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

const LS_USERS = 'mfq_users_v1';
const LS_SESSION = 'mfq_session_v1';
const LS_SCORES = 'mfq_scores_v1';

const Stats = {
  get users(){ return (JSON.parse(localStorage.getItem(LS_USERS))||[]).length; },
  get attempts(){ return (JSON.parse(localStorage.getItem(LS_SCORES))||[]).length; },
  get perfects(){ return (JSON.parse(localStorage.getItem(LS_SCORES))||[]).filter(s=>s.score===s.total).length; }
}

function updateStats(){
  $('#statUsers').textContent = Stats.users;
  $('#statQuizzes').textContent = Stats.attempts;
  $('#statPerfects').textContent = Stats.perfects;
}

let authMode = 'signup';

function openAuth(mode='signup'){
  authMode = mode;
  $('#authTitle').textContent = mode==='signup' ? 'Create your account' : 'Welcome back';
  $('#authActionBtn').textContent = mode==='signup' ? 'Sign up' : 'Log in';
  $('#authHint').innerHTML = mode==='signup'
    ? "Already have an account? <a href='#' onclick=\"switchAuthMode('login');return false;\">Log in</a>"
    : "New here? <a href='#' onclick=\"switchAuthMode('signup');return false;\">Sign up</a>";
  $('#authModal').classList.add('show');
}

function closeAuth(){ $('#authModal').classList.remove('show'); }
function switchAuthMode(m){ closeAuth(); openAuth(m); }

function getUsers(){ return JSON.parse(localStorage.getItem(LS_USERS)) || []; }
function setUsers(arr){ localStorage.setItem(LS_USERS, JSON.stringify(arr)); updateStats(); }

function setSession(obj){ localStorage.setItem(LS_SESSION, JSON.stringify(obj)); renderUser(); }
function getSession(){ try{ return JSON.parse(localStorage.getItem(LS_SESSION)) }catch{ return null } }
function clearSession(){ localStorage.removeItem(LS_SESSION); renderUser(); }

function renderUser(){
  const s = getSession();
  $('#userPill').textContent = s ? s.name : 'Guest';
}

$('#loginBtn').addEventListener('click', ()=>openAuth('login'));
$('#signupBtn').addEventListener('click', ()=>openAuth('signup'));

$('#authActionBtn').addEventListener('click', ()=>{
  const name = $('#authName').value.trim();
  const email = $('#authEmail').value.trim().toLowerCase();
  const pass = $('#authPass').value;
  if(!email || !pass || !name && authMode==='signup') return alert('Please fill all fields');
  const users = getUsers();
  if(authMode==='signup'){
    if(users.some(u=>u.email===email)) return alert('Account already exists');
    users.push({name,email,pass}); setUsers(users); setSession({name,email}); closeAuth();
  } else {
    const u = users.find(u=>u.email===email && u.pass===pass);
    if(!u) return alert('Invalid credentials');
    setSession({name:u.name,email:u.email}); closeAuth();
  }
});

function sendContact(){
  const name=$('#cName').value.trim(); 
  const email=$('#cEmail').value.trim();
  const msg=$('#cMsg').value.trim();

  if(!name || !email || !msg) {
    return alert("Please fill all fields");
  }

  alert("Thanks, " + name + "! We’ll reach out to you at " + email + ".");
  
  $('#cName').value='';
  $('#cEmail').value='';
  $('#cMsg').value='';
}

const categorySel = $('#category');
const difficultySel = $('#difficulty');
const amountInp = $('#amount');
const qTimerInp = $('#qTimer');
const startBtn = $('#startBtn');
const resetBtn = $('#resetBtn');
const nextBtn = $('#nextBtn');
const quitBtn = $('#quitBtn');

const qMeta = $('#qMeta');
const questionEl = $('#question');
const optionsEl = $('#options');
const progressFill = $('#progressFill');
const timerEl = $('#timer');
const scoreList = $('#scoreList');
const leaderList = $('#leaderList');

const state = { running:false, questions:[], index:0, correct:0, timer:null, timeLeft:0, perQuestion:25, chosen:{category:'any', difficulty:'any', amount:10} };

function loadScores(){ try{ return JSON.parse(localStorage.getItem(LS_SCORES))||[] }catch{ return [] } }
function saveScore(entry){ const all=loadScores(); all.unshift(entry); localStorage.setItem(LS_SCORES, JSON.stringify(all.slice(0,100))); updateStats(); }
function clearScores(){ localStorage.removeItem(LS_SCORES); renderPreviousScores(); renderLeaderboard(); updateStats(); }

function renderPreviousScores(){
  const all = loadScores();
  scoreList.innerHTML='';
  if(!all.length){ scoreList.innerHTML='<li>No previous scores yet.</li>'; return; }
  const me = getSession()?.email;
  const mine = me ? all.filter(s=>s.email===me) : all;
  (mine.slice(0,8)).forEach(s=>{
    const li=document.createElement('li');
    li.innerHTML = `<strong>${s.score}/${s.total}</strong> — <span class='muted'>${s.difficulty||'any'}</span> · <span class='muted'>${s.categoryName||'Any'}</span><br><span class='muted'>${new Date(s.when).toLocaleString()}</span>`;
    scoreList.appendChild(li);
  })
}

function renderLeaderboard(){
  const all = loadScores();
  leaderList.innerHTML='';
  if(!all.length){ leaderList.innerHTML='<li>No scores yet.</li>'; return; }
  const agg = {};
  for(const s of all){
    const key = s.email||'guest';
    const pct = s.total? s.score/s.total : 0;
    if(!agg[key] || pct>agg[key].pct || (pct===agg[key].pct && s.when>agg[key].when)){
      agg[key] = {name:s.name||'Guest', email:key, pct, score:s.score, total:s.total, when:s.when};
    }
  }
  const list = Object.values(agg).sort((a,b)=>b.pct-a.pct || b.when-a.when).slice(0,10);
  list.forEach((r,i)=>{
    const li=document.createElement('li');
    const pct = Math.round(r.pct*100);
    li.innerHTML = `#${i+1} <strong>${r.name}</strong> — ${pct}% (${r.score}/${r.total})`;
    leaderList.appendChild(li);
  })
}

async function initCategories(){
  categorySel.innerHTML = '<option value="any">Any Category</option>';
  try{
    const res = await fetch('https://opentdb.com/api_category.php');
    const data = await res.json();
    data.trivia_categories.forEach(cat=>{
      const opt=document.createElement('option'); opt.value=cat.id; opt.textContent=cat.name; categorySel.appendChild(opt);
    })
  } catch(e) {
    const opt=document.createElement('option'); opt.value='any'; opt.textContent='(Failed to load — Any)'; categorySel.appendChild(opt);
  }
}

function buildApiUrl({category,difficulty,amount}){
  const p = new URLSearchParams();
  p.set('amount', amount);
  if(category!=='any') p.set('category', category);
  if(difficulty!=='any') p.set('difficulty', difficulty);
  p.set('type','multiple');
  return `https://opentdb.com/api.php?${p.toString()}`;
}

async function startQuiz(){
  state.running=true; state.index=0; state.correct=0;
  state.perQuestion = Math.max(10, Math.min(90, parseInt(qTimerInp.value)||25));
  state.chosen = { category:categorySel.value, difficulty:difficultySel.value, amount: Math.max(5, Math.min(25, parseInt(amountInp.value)||10)) };

  const url = buildApiUrl(state.chosen);
  qMeta.textContent = 'Fetching questions…';
  const data = await fetch(url).then(r=>r.json()).catch(()=>null);
  if(!data || data.response_code!==0 || !data.results?.length){
    qMeta.textContent = 'Failed to load questions. Try different filters.'; return;
  }
  state.questions = data.results.map(q=>({
    category:q.category,
    difficulty:q.difficulty,
    question:decodeHTML(q.question),
    correct:decodeHTML(q.correct_answer),
    options: shuffle([q.correct_answer, ...q.incorrect_answers].map(decodeHTML))
  }));
  quitBtn.style.display='inline-block'; nextBtn.style.display='none';
  renderQuestion();
}

function renderQuestion(){
  const i=state.index, q=state.questions[i], total=state.questions.length;
  qMeta.textContent = `${q.category} • ${q.difficulty.toUpperCase()} • Q ${i+1} of ${total}`;
  questionEl.textContent = q.question; optionsEl.innerHTML='';
  q.options.forEach(text=>{
    const b=document.createElement('button'); b.className='option'; b.textContent=text; b.addEventListener('click',()=>handleAnswer(b,text===q.correct)); optionsEl.appendChild(b);
  })
  updateProgress(); startTimer();
}
function updateProgress(){ progressFill.style.width = `${Math.round((state.index)/(state.questions.length)*100)}%`; }
function startTimer(){ stopTimer(); state.timeLeft=state.perQuestion; timerEl.textContent=formatTime(state.timeLeft); state.timer=setInterval(()=>{ state.timeLeft-=1; timerEl.textContent=formatTime(Math.max(0,state.timeLeft)); if(state.timeLeft<=0){ stopTimer(); lockOptions(); revealCorrect(); nextBtn.style.display='inline-block'; } },1000); }
function stopTimer(){ if(state.timer){ clearInterval(state.timer); state.timer=null; } }
function formatTime(s){ s=Math.max(0,s|0); const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}` }
function lockOptions(){ $$('.option',optionsEl).forEach(b=>b.disabled=true); }
function revealCorrect(){ const c=state.questions[state.index].correct; $$('.option',optionsEl).forEach(b=>{ if(b.textContent===c) b.classList.add('correct'); }) }
function handleAnswer(btn,isCorrect){ if($$('.option',optionsEl)[0]?.disabled) return; stopTimer(); lockOptions(); if(isCorrect){ state.correct+=1; btn.classList.add('correct'); } else { btn.classList.add('wrong'); revealCorrect(); } nextBtn.style.display='inline-block'; }
function nextQuestion(){ nextBtn.style.display='none'; state.index+=1; if(state.index>=state.questions.length){ finishQuiz(); } else { renderQuestion(); } }
function quitQuiz(){ if(!state.running) return; stopTimer(); finishQuiz(true); }

function finishQuiz(quit=false){
  state.running=false; stopTimer();
  const total=state.questions.length, score=state.correct;
  progressFill.style.width='100%';
  questionEl.innerHTML = `<div style="text-align:center"><div style="font-size:40px;font-weight:800">${score} / ${total}</div><div class='muted'>${quit?'Quiz ended early': score===total?'Perfect!': score===0?'Tough round!':'Nice work!'}</div></div>`;
  optionsEl.innerHTML=''; nextBtn.style.display='none'; quitBtn.style.display='none';
  const sess=getSession();
  const entry = { user: sess?.name||'Guest', email: sess?.email||'guest', score, total, categoryName: state.questions?.[0]?.category||'Any', difficulty: state.chosen.difficulty, when: Date.now() };
  saveScore(entry); renderPreviousScores(); renderLeaderboard(); updateStats();
}

startBtn.addEventListener('click', startQuiz);
nextBtn.addEventListener('click', nextQuestion);
quitBtn.addEventListener('click', quitQuiz);
resetBtn.addEventListener('click', ()=>{ if(confirm('Clear previous scores on this device?')) clearScores(); });

$('#year').textContent = new Date().getFullYear();
renderUser(); updateStats();
initCategories().then(()=>{ renderPreviousScores(); renderLeaderboard(); });

window.scrollToId = scrollToId;
window.sendContact = sendContact;
window.switchAuthMode = switchAuthMode;
window.closeAuth = closeAuth;