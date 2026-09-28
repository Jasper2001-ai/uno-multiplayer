import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getDatabase,ref,set,get,onValue,update,runTransaction,onDisconnect} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// 1) Replace this config with your Firebase Web App config.
const firebaseConfig={apiKey:"YOUR_API_KEY",authDomain:"YOUR_PROJECT.firebaseapp.com",databaseURL:"https://YOUR_PROJECT-default-rtdb.firebaseio.com",projectId:"YOUR_PROJECT",storageBucket:"YOUR_PROJECT.firebasestorage.app",messagingSenderId:"YOUR_SENDER_ID",appId:"YOUR_APP_ID"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
let uid=null,myRoom=null,me=null,state=null,pendingWild=null;
const $=id=>document.getElementById(id),colors=["red","yellow","green","blue"];
function msg(x){$("status").textContent=x;$("gameStatus").textContent=x}
function deck(){let d=[],id=0;for(const c of colors){d.push({id:id++,c,n:"0"});for(let n=1;n<=9;n++){d.push({id:id++,c,n:String(n)},{id:id++,c,n:String(n)})}for(const n of ["skip","reverse","+2"]){d.push({id:id++,c,n},{id:id++,c,n})}}for(let i=0;i<4;i++){d.push({id:id++,c:"wild",n:"wild"},{id:id++,c:"wild",n:"+4"})}return d}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function deal(){let d=shuffle(deck()),hands={};state.players.forEach(p=>hands[p.id]=[]);for(let r=0;r<7;r++)state.players.forEach(p=>hands[p.id].push(d.pop()));let top=d.pop();while(top.c==="wild")d.unshift(top),top=d.pop();state.deck=d;state.discard=[top];state.turn=0;state.direction=1;state.currentColor=top.c;state.hands=hands}
function valid(c){const top=state.discard[state.discard.length-1];return c.c==="wild"||c.c===state.currentColor||c.n===top.n}
function cardLabel(c){return c.n==="skip"?"SKIP":c.n==="reverse"?"↔":c.n==="+2"?"+2":c.n==="+4"?"+4":c.n==="wild"?"WILD":c.n}
function nextIndex(i){return (i+state.direction+state.players.length)%state.players.length}
function advance(){state.turn=nextIndex(state.turn)}
async function save(){await set(ref(db,"rooms/"+myRoom),state)}
async function createRoom(){const name=$("name").value.trim();if(!name)return msg("Enter your name.");const code=Math.random().toString(36).slice(2,7).toUpperCase();me={id:uid,name};state={players:[me],hands:{},deck:[],discard:[],turn:0,direction:1,currentColor:null,started:false,uno:{}};await set(ref(db,"rooms/"+code),state);myRoom=code;listen()}
async function joinRoom(){const name=$("name").value.trim(),code=$("room").value.trim().toUpperCase();if(!name||!code)return msg("Enter your name and room code.");const snap=await get(ref(db,"rooms/"+code));if(!snap.exists())return msg("Room not found.");const s=snap.val();if((s.players||[]).length>=4)return msg("Room is full.");me={id:uid,name};s.players=[...(s.players||[]),me];if(!s.hands)s.hands={};await set(ref(db,"rooms/"+code),s);myRoom=code;listen()}
function listen(){onValue(ref(db,"rooms/"+myRoom),snap=>{if(!snap.exists()){location.reload();return}state=snap.val();$("lobby").hidden=true;$("game").hidden=false;$("roomCode").textContent=myRoom;render()})}
async function startGame(){if(state.players.length<2)return msg("Need at least 2 players.");deal();state.started=true;await save()}
async function play(cardIndex){if(!state.started)return;const pi=state.players.findIndex(p=>p.id===uid);if(pi!==state.turn)return msg("Wait for your turn.");const hand=state.hands[uid]||[],c=hand[cardIndex];if(!c||!valid(c))return msg("You can't play that card.");hand.splice(cardIndex,1);state.discard.push(c);state.currentColor=c.c==="wild"?null:c.c;if(hand.length===0){state.winner=uid;await save();return}let skip=false;if(c.n==="skip")skip=true;if(c.n==="reverse"){state.direction*=-1;if(state.players.length===2)skip=true}if(c.n==="+2")await drawFor(nextIndex(state.turn),2);if(c.n==="+4")await drawFor(nextIndex(state.turn),4);if(c.c==="wild"){pendingWild=c;$("colorModal").hidden=false;return}if(skip)advance();advance();await save()}
async function drawFor(pi,n){const p=state.players[pi],h=state.hands[p.id];for(let i=0;i<n;i++){if(!state.deck.length)reshuffle();h.push(state.deck.pop())}}
function reshuffle(){const top=state.discard.pop();state.deck=shuffle(state.discard);state.discard=[top]}
async function draw(){if(!state.started)return;const pi=state.players.findIndex(p=>p.id===uid);if(pi!==state.turn)return msg("Wait for your turn.");if(!state.deck.length)reshuffle();state.hands[uid].push(state.deck.pop());advance();await save()}
async function chooseColor(c){state.currentColor=c;$("colorModal").hidden=true;if(pendingWild?.n==="+4")advance();advance();pendingWild=null;await save()}
function render(){
 const top=state.discard?.[state.discard.length-1];
 const myIndex=state.players.findIndex(p=>p.id===uid);
 const turnPlayer=state.players[state.turn];
 $("turnRing").style.borderColor = myIndex===state.turn ? "#19ff67" : "#1594ff";
 $("myName").textContent=me?.name||"You";
 $("myTurn").textContent=myIndex===state.turn?"Your turn":"Waiting for your turn";
 $("top").textContent=top?cardLabel(top):"-";
 $("colorIndicator").textContent="COLOR: "+(state.currentColor?state.currentColor.toUpperCase():"—");
 $("gameStatus").textContent=state.winner?"Game over":(turnPlayer?turnPlayer.name+"'s turn":"Waiting...");
 const seats=["p2","p3","p4"];
 seats.forEach(id=>$(id).innerHTML="");
 const others=state.players.filter(p=>p.id!==uid).slice(0,3);
 others.forEach((p,i)=>{
   const el=$(seats[i]); const pi=state.players.findIndex(x=>x.id===p.id); const active=pi===state.turn;
   el.innerHTML=`<div class="player-chip"><div class="avatar ${active?'active':''}">${esc((p.name||"P").slice(0,3).toUpperCase())}</div><div class="player-name">${esc(p.name)}</div><div class="count-bubble">${(state.hands[p.id]||[]).length} cards</div><div class="back-row">${Array.from({length:Math.min((state.hands[p.id]||[]).length,5)},()=>'<span class="mini-back"></span>').join('')}</div></div>`;
 });
 const pile=$('pile');
 if(top){pile.className=`card card-center ${top.c}`;pile.textContent=cardLabel(top)}
 $("hand").innerHTML=(state.hands[uid]||[]).map((c,i)=>`<button class="playcard ${c.c}" data-i="${i}" ${!state.started||state.turn!==myIndex||!valid(c)?'disabled':''}>${cardLabel(c)}</button>`).join("");
 document.querySelectorAll(".playcard").forEach(b=>b.onclick=()=>play(+b.dataset.i));
 if(state.winner){const w=state.players.find(p=>p.id===state.winner);msg(`🏆 ${w?.name||'Player'} wins!`)}
 else if(!state.started&&state.players[0]?.id===uid)msg("You are host. Start the game when everyone has joined.");
 else if(!state.started)msg("Waiting for host to start.");
}
function esc(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
$("create").onclick=createRoom;$("join").onclick=joinRoom;$("draw").onclick=draw;$("uno").onclick=()=>msg("UNO call registered!");$("copy").onclick=async()=>navigator.clipboard?.writeText(location.href+"?room="+myRoom);$("leave").onclick=()=>location.reload();document.querySelectorAll(".colors button").forEach(b=>b.onclick=()=>chooseColor(b.dataset.c));
// Host can start with Ctrl+Enter; also add a visible Start button dynamically.
const start=document.createElement("button");start.textContent="Start Game";start.className="icon-btn";start.title="Start Game";start.onclick=startGame;document.querySelector(".gamebar").appendChild(start);
signInAnonymously(auth).catch(e=>msg("Firebase sign-in failed: "+e.message));onAuthStateChanged(auth,u=>{if(u)uid=u.uid});
