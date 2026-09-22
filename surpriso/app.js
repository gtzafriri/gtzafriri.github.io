import {resultsView} from './results-view.js';
import {createApiClient} from './api-client.js';
const root=document.getElementById('app');
let round=null,statistics=null,view='attract',guess='',busy=false,message='',error='',sound=false,audioContext,roundNumber=0;
let config={quoteCount:77,sourceCount:61,scoringReady:true};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let playerStorage;try{playerStorage=window.localStorage;}catch{}
const request=createApiClient({apiOrigin:document.querySelector('meta[name="surpriso-api"]')?.content??'',storage:playerStorage});
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
let themePreference;try{themePreference=playerStorage?.getItem('surpriso-theme');}catch{}
if(!['light','dark'].includes(themePreference))themePreference=null;
function syncThemeButton(){
  const button=root.querySelector('[data-action="theme"]');if(!button)return;
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  button.textContent=next==='dark'?'Dark mode':'Light mode';
  button.setAttribute('aria-label',`Switch to ${next} mode`);
}
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#111827':'#ffffff';
  syncThemeButton();
}
function toggleTheme(){
  themePreference=document.documentElement.dataset.theme==='dark'?'light':'dark';
  try{playerStorage?.setItem('surpriso-theme',themePreference);}catch{}
  applyTheme(themePreference);
}
systemTheme.addEventListener('change',event=>{if(!themePreference)applyTheme(event.matches?'dark':'light');});
window.addEventListener('storage',event=>{
  if(event.key!==null&&event.key!=='surpriso-theme')return;
  themePreference=['light','dark'].includes(event.newValue)?event.newValue:null;
  applyTheme(themePreference||(systemTheme.matches?'dark':'light'));
});
applyTheme(themePreference||(systemTheme.matches?'dark':'light'));
async function action(status,work){
  if(busy)return false;busy=true;error='';message=status;render();
  try{await work();return true;}catch(e){error=e.name==='TimeoutError'?'That took too long. Try again; your round is saved.':e.message;if(round)try{await restoreRound(round.id);}catch{}return false;}
  finally{busy=false;render();}
}
function rememberRound(){try{sessionStorage.setItem('surpriso-fixed-v1-round',JSON.stringify({id:round.id,number:roundNumber}));}catch{}}
async function restoreRound(id){const data=await request(`/api/rounds/${id}`);round=data.round;statistics=data.statistics??null;view=round.status==='playing'?'play':'result';}
async function startRound(){return action('Starting your quote…',async()=>{const data=await request('/api/rounds',{});round=data.round;statistics=null;guess='';view='play';roundNumber++;rememberRound();await fetchClue();});}
async function fetchClue(){
  const data=await request(`/api/rounds/${round.id}/reveal`,{mode:'subtle',expectedReveals:round.revealed});
  round=data.round;view='play';message=`Revealed: ${data.revealedWord} (+${round.lastClueBits.toFixed(2)} bits).`;tone();
}
async function reveal(){
  if(!round||round.status!=='playing')throw Error('Start a round first.');
  return action('Revealing your next clue…',fetchClue);
}
async function submitGuess(answer,giveUp=false){
  if(!round||round.status!=='playing')throw Error('There is no active round.');
  if(!giveUp&&(typeof answer!=='string'||!answer.trim()||answer.length>120))throw Error('Enter a film, show, or person.');
  if(!giveUp)guess=answer;
  return action('Checking your answer…',async()=>{const data=await request(`/api/rounds/${round.id}/guess`,giveUp?{giveUp:true}:{answer});round=data.round;statistics=data.statistics;view='result';message='';tone(round.status==='won');});
}
async function retryResults(){return action('Loading player results…',async()=>{const data=await request(`/api/rounds/${round.id}/results`,{});round=data.round;statistics=data.statistics;message='';});}
function tone(won=false){if(!sound)return;try{audioContext??=new AudioContext();audioContext.resume();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.frequency.setValueAtTime(won?660:300,audioContext.currentTime);gain.gain.setValueAtTime(.025,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.14);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.16);}catch{}}
function feedback(){return error?`<p class="model-error" role="alert">${esc(error)}</p>`:busy?`<p class="model-feedback" role="status">${esc(message)}</p>`:'';}
function render(focus=false){
  root.innerHTML=`<a class="skip" href="#main">Skip to game</a><div class="shell"><header class="topbar"><a class="wordmark" href="#" aria-label="Surpriso home">Surpriso</a><div class="top-actions"><button class="quiet" data-action="rules">How to play</button><button class="quiet" data-action="sound" aria-label="${sound?'Mute':'Enable'} game sound" aria-pressed="${sound}">Sound ${sound?'on':'off'}</button><button class="quiet" data-action="theme">Dark mode</button></div></header><main id="main" class="main" aria-busy="${busy}">${view==='attract'?attract():view==='result'?result():play()}</main><footer class="footer"><span>${config.quoteCount} quotes · ${config.sourceCount} sources</span><button class="quiet" data-action="scoring">About the scoring</button></footer></div><dialog class="dialog" aria-labelledby="dialog-title"></dialog>`;
  syncThemeButton();root.querySelector('[data-action="theme"]').onclick=toggleTheme;
  root.querySelector('.wordmark').onclick=e=>{e.preventDefault();leaveRound(()=>{view='attract';render(true);});};
  root.querySelector('[data-action="rules"]').onclick=()=>showInfo('rules');
  root.querySelector('[data-action="scoring"]').onclick=()=>showInfo('scoring');
  root.querySelector('[data-action="sound"]').onclick=()=>{sound=!sound;tone();render();};
  root.querySelector('[data-action="start"]')?.addEventListener('click',startRound);
  root.querySelector('[data-action="next"]')?.addEventListener('click',startRound);
  root.querySelector('[data-action="new"]')?.addEventListener('click',()=>leaveRound(startRound));
  root.querySelector('[data-action="reveal"]')?.addEventListener('click',reveal);
  root.querySelector('[data-action="guess"]')?.addEventListener('click',()=>{if(!busy){view='guess';error='';render();root.querySelector('#guess').focus();}});
  root.querySelector('[data-action="back"]')?.addEventListener('click',()=>{view='play';error='';render();});
  root.querySelector('[data-action="giveup"]')?.addEventListener('click',()=>confirm('Reveal the answer?','This counts as an incorrect attempt.','Reveal answer',()=>submitGuess('',true)));
  root.querySelector('[data-action="retry-results"]')?.addEventListener('click',retryResults);
  const input=root.querySelector('#guess');if(input)input.oninput=()=>{guess=input.value;};
  const form=root.querySelector('.guess-box');if(form)form.onsubmit=e=>{e.preventDefault();submitGuess(guess);};
  if(busy)root.querySelectorAll('main button,main input').forEach(element=>element.disabled=true);
  if(focus){root.querySelector('h1')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function attract(){return `<div class="start-screen"><h1 tabindex="-1">Guess the quote.</h1><p class="intro">Reveal words one at a time, then name the film, TV show, or person behind them.</p><p class="intro">Use as little information as possible. See how you compare after you answer.</p><button class="primary" data-action="start">Start game</button>${feedback()}</div>`;}
function board(){return `<section class="quote-panel" aria-label="The quote"><div class="panel-label"><span>${round.answerType==='person'?'Person':'Film or TV show'}</span><span>${round.revealed} / ${round.total} words revealed</span></div><div class="quote-words">${round.board.map(cell=>cell.text!==null?`<span class="quote-token">${esc(cell.text)}</span>`:`<span class="quote-token"><span class="sr-only">Hidden word, ${cell.length} letters.</span><span class="hidden-word" aria-hidden="true" style="width:${cell.length}ch"></span></span>`).join('')}</div></section>`;}
function score(){return `<section class="score-panel" aria-label="Score"><div class="score-top"><span>Clue bits used</span><strong>${round.bits.toFixed(2)}</strong></div><p class="score-note">${round.lastClueBits===null?'Every word has a fixed bit cost. Lower is better.':`Last word: +${round.lastClueBits.toFixed(2)} bits. Lower total is better.`}</p></section>`;}
function play(){const guessing=view==='guess',full=round.revealed===round.total;return `<div class="play-wrap"><div class="play-top"><span class="round-id">Round ${roundNumber}</span><button class="quiet" data-action="new">New quote ↻</button></div><h1 class="play-heading" tabindex="-1">${guessing?'Your guess':'Guess the quote'}</h1><div class="play-layout"><div>${board()}${guessing?'':score()}</div><div class="control-side">${guessing?guessForm():`<div class="controls"><button class="primary" data-action="reveal" ${full?'disabled':''}>${full?'All words revealed':'Reveal a word'}</button><button class="secondary" data-action="guess">${round.answerType==='person'?'Guess the person':'Guess the source'}</button></div>${busy?'':`<p class="game-message" role="status">${esc(message||(full?'The whole quote is here. Make your guess.':'Words stay in their original quote order.'))}</p>`}${feedback()}<div class="bottom-actions"><span></span><button class="quiet" data-action="giveup">Reveal answer & end round</button></div>`}</div></div></div>`;}
function guessForm(){return `<form class="guess-box"><label for="guess">${round.answerType==='person'?'Know who said this?':"Know where it's from?"}</label><input id="guess" autocomplete="off" maxlength="120" placeholder="${round.answerType==='person'?'Name the person…':'Name the film or TV show…'}" value="${esc(guess)}" required aria-describedby="guess-hint"><p class="form-hint" id="guess-hint">One final guess. You can go back for more clues.</p><button class="primary" type="submit">Submit guess</button>${feedback()}</form><div class="bottom-actions"><button class="quiet" data-action="back">← Back to clues</button></div>`;}
function result(){const won=round.status==='won',gaveUp=round.status==='revealed';return `<div class="play-wrap result"><div class="play-top"><span class="round-id">Round ${roundNumber}</span></div><h1 class="result-heading" tabindex="-1">${won?'Correct!':gaveUp?'The answer':'Not quite.'}</h1><p class="result-lead">${won?`${round.bits.toFixed(2)} bits · ${round.revealed} of ${round.total} words revealed.`:gaveUp?'Here’s the full quote and its source.':'Here’s where the quote comes from.'}</p><section class="quote-panel"><blockquote class="full-quote">${esc(round.quote)}</blockquote><div class="credit"><strong>${esc(round.source)}</strong><p>${esc(round.by)}</p>${round.status==='lost'&&guess?`<p>Your guess: ${esc(guess)}</p>`:''}<a class="reference" href="${esc(round.referenceUrl)}" target="_blank" rel="noopener noreferrer">Quote reference ↗</a></div></section>${resultsView(round,statistics)}${feedback()}<button class="primary" data-action="next">Next quote</button></div>`;}
function wireDialog(dialog){dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}};dialog.showModal();}
function showInfo(kind){const dialog=root.querySelector('dialog');dialog.innerHTML=`<button class="dialog-close" aria-label="Close dialog">×</button><h2 id="dialog-title">${kind==='rules'?'How to play':'About the score'}</h2>${kind==='rules'?`<h3>Reveal a word</h3><p>Each quote starts with its lowest-cost word revealed. Its bits count toward your score. Reveal a word always uses Subtle: the remaining word with the lowest bit cost. Words appear in their original positions; blanks show their lengths.</p><h3>Guess the source</h3><p>Name the film or show for “Know where it’s from?” Name the real person for “Know who said this?” Common abbreviations and franchise titles are accepted. You get one final guess.</p><h3>Use fewer bits</h3><p>Every revealed word adds its fixed bit cost. Guess the source using as few bits as you can. A word’s cost measures how unexpected it is to the model, not how useful it is to you.</p>`:`<h3>Clue surprisal</h3><p>Each word has a fixed cost, calculated in advance from how unexpected it is to a language model when all words are hidden. The model sees the word lengths, positions, and whether the source is a person, film, or show. A word’s cost stays the same as you reveal more clues.</p><p>The reference model is Qwen3.5 9B. The cost is −log₂ P(word), including punctuation and the end-of-answer token. All 495 word costs are already calculated, so there is no model processing while you play. This measures model surprisal, not human difficulty.</p>`}<h3>Compare with other players</h3><p>A correct answer shows the bit totals of other correct answers to that quote, with your result marked. A wrong answer shows the percentage of players who got it right.</p><p>Only your first completed attempt per quote and scoring version counts. Revealing the answer counts as a miss; abandoning a round does not count. Practice results can be compared but won’t change the distribution. Sample sizes are shown, and new quotes start with no results.</p><p>No sign-in is needed. Local storage remembers this browser’s player history. Switching browsers or clearing site data starts a new history.</p><h3>The collection</h3><p>${config.quoteCount} familiar quotes from ${config.sourceCount} films, TV shows, and public figures. Quote references appear after you answer.</p><button class="primary" data-close>Got it</button>`;wireDialog(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();}
function confirm(title,copy,label,action){const dialog=root.querySelector('dialog');dialog.innerHTML=`<button class="dialog-close" aria-label="Close dialog">×</button><h2 id="dialog-title">${esc(title)}</h2><p>${esc(copy)}</p><div class="dialog-actions"><button class="quiet" data-cancel>Keep playing</button><button class="primary" data-confirm>${esc(label)}</button></div>`;wireDialog(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-confirm]').onclick=action;}
function leaveRound(action){if(busy)return;if(round?.status==='playing'&&round.revealed&&view!=='attract')confirm('Leave this quote?','This unfinished round won’t count in player results.','Leave round',action);else action();}
function visibleState(){return !round||view==='attract'?{screen:'start',quoteCount:config.quoteCount,sourceCount:config.sourceCount}:{screen:view,...round,statistics:round.status==='playing'?null:statistics};}
function registerTools(){
  if(!document.modelContext?.registerTool)return;
  const lifecycle=new AbortController(),empty={type:'object',properties:{},additionalProperties:false};
  const tools=[
    {name:'read_quote_game',description:'Read the visible quote, clues and score; after answering, includes real player results. Never returns hidden words or the answer during play.',inputSchema:empty,annotations:{readOnlyHint:true},execute:()=>visibleState()},
    {name:'start_quote_round',description:'Start a quote with its lowest-cost word already revealed and counted in the score. Does not abandon an active round.',inputSchema:empty,execute:async()=>{if(round?.status==='playing'&&view!=='attract')throw Error('Finish the active round first.');if(!await startRound())throw Error(error);return visibleState();}},
    {name:'reveal_quote_word',description:'Reveal the remaining word with the lowest fixed bit cost (Subtle). Adds its precomputed bit cost.',inputSchema:empty,execute:async()=>{if(!await reveal())throw Error(error);return visibleState();}},
    {name:'submit_quote_guess',description:'Commit one final guess and record the first attempt for real community statistics.',inputSchema:{type:'object',properties:{answer:{type:'string',minLength:1,maxLength:120}},required:['answer'],additionalProperties:false},execute:async input=>{if(!await submitGuess(input.answer))throw Error(error);return visibleState();}}
  ];
  for(const tool of tools)try{void Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
async function boot(){
  busy=true;message='Loading your game…';render();registerTools();
  try{config=await request('/api/config');}catch{}
  try{const saved=JSON.parse(sessionStorage.getItem('surpriso-fixed-v1-round')||'null');if(saved?.id){roundNumber=saved.number||1;await restoreRound(saved.id);}}catch{try{sessionStorage.removeItem('surpriso-fixed-v1-round');}catch{}}
  busy=false;message='Words stay in their original quote order.';render();
}
void boot();
