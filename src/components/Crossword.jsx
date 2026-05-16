import { useState, useEffect, useRef } from 'react';

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const API_URL  = import.meta.env.VITE_API_URL || '';
const GSZ = 21;

// ─── normalise for comparison: ä≈a, ö≈o, ü≈u, ß≈s ───
function norm(ch) {
  return (ch ?? '').toLowerCase()
    .replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'s');
}
function letterMatch(answer, typed) {
  return norm(answer) === norm(typed);
}

// ─── crossword placement ───
function buildCrossword(wordObjs) {
  const G = Array.from({length:GSZ}, ()=>Array(GSZ).fill(null));
  const placed = [];

  const sorted = [...wordObjs]
    .filter(w => /^[a-zA-ZäöüÄÖÜß]+$/.test(w.word) && w.word.length >= 3)
    .sort((a,b) => b.word.length - a.word.length)
    .slice(0, 12);

  const canPlace = (word, r0, c0, dir) => {
    const [dr,dc] = dir==='across'?[0,1]:[1,0];
    const [pr,pc] = dir==='across'?[1,0]:[0,1];
    const len = word.length;
    if (r0+dr*(len-1)>=GSZ || c0+dc*(len-1)>=GSZ || r0<0 || c0<0) return false;
    const br=r0-dr, bc=c0-dc;
    if (br>=0&&bc>=0&&G[br][bc]) return false;
    const er=r0+dr*len, ec=c0+dc*len;
    if (er>=0&&er<GSZ&&ec>=0&&ec<GSZ&&G[er][ec]) return false;
    let cross = 0;
    for (let i=0;i<len;i++) {
      const r=r0+dr*i, c=c0+dc*i, cell=G[r][c];
      if (cell===null) {
        if (r-pr>=0&&c-pc>=0&&r-pr<GSZ&&c-pc<GSZ&&G[r-pr][c-pc]) return false;
        if (r+pr<GSZ&&c+pc<GSZ&&r+pr>=0&&c+pc>=0&&G[r+pr][c+pc]) return false;
      } else if (norm(cell)===norm(word[i])) {
        cross++;
      } else return false;
    }
    if (placed.length>0 && cross===0) return false;
    return cross+1;
  };

  const doPlace = (word, r0, c0, dir) => {
    const [dr,dc]=dir==='across'?[0,1]:[1,0];
    for (let i=0;i<word.length;i++) if(!G[r0+dr*i][c0+dc*i]) G[r0+dr*i][c0+dc*i]=word[i].toLowerCase();
  };

  // first word centred horizontally
  const first = sorted[0];
  const fr=Math.floor(GSZ/2), fc=Math.floor((GSZ-first.word.length)/2);
  doPlace(first.word, fr, fc, 'across');
  placed.push({...first, row:fr, col:fc, dir:'across'});

  for (const w of sorted.slice(1)) {
    let best=null, bestScore=0;
    for (const dir of ['down','across']) {
      for (let r=0;r<GSZ;r++) for (let c=0;c<GSZ;c++) {
        const score=canPlace(w.word, r, c, dir);
        if (score && score>bestScore) { bestScore=score; best={r,c,dir}; }
      }
    }
    if (best) {
      doPlace(w.word, best.r, best.c, best.dir);
      placed.push({...w, row:best.r, col:best.c, dir:best.dir});
    }
  }

  if (placed.length < 2) return null;

  // trim to content
  let minR=GSZ,maxR=0,minC=GSZ,maxC=0;
  for (let r=0;r<GSZ;r++) for (let c=0;c<GSZ;c++)
    if (G[r][c]) { minR=Math.min(minR,r); maxR=Math.max(maxR,r); minC=Math.min(minC,c); maxC=Math.max(maxC,c); }
  minR=Math.max(0,minR-1); minC=Math.max(0,minC-1);
  maxR=Math.min(GSZ-1,maxR+1); maxC=Math.min(GSZ-1,maxC+1);

  const grid = G.slice(minR,maxR+1).map(row=>row.slice(minC,maxC+1));
  const adj  = placed.map(p=>({...p, row:p.row-minR, col:p.col-minC}));
  const rows=maxR-minR+1, cols=maxC-minC+1;

  // number clues top-to-bottom, left-to-right
  const numGrid = Array.from({length:rows},()=>Array(cols).fill(0));
  let n=1;
  const ordered = [...adj].sort((a,b)=>a.row!==b.row?a.row-b.row:a.col-b.col);
  const numbered = ordered.map(p => {
    if (!numGrid[p.row][p.col]) numGrid[p.row][p.col]=n++;
    return {...p, num:numGrid[p.row][p.col]};
  });

  return { grid, placements:numbered, numGrid, rows, cols };
}

// ─── Groq clue generation ───
async function generateClues(words) {
  const list = words.map(w=>`- ${w.word} (${w.translation||''}): "${w.example||''}"`).join('\n');
  const prompt = `You're writing clues for a German vocabulary crossword for a B1+ English-speaking learner.

Each clue must be 12-20 words. Make them rich and context-aware: reference how the word is actually used, its meaning in context, a memorable image, or a usage hint that distinguishes it from similar words. You may hint at grammar (noun gender, common collocations, verb frame) but never state the German word itself.

If an example sentence is provided, use it as inspiration — paraphrase what the word means in that context. If the translation is provided, you may refer to the English meaning but make the clue about USAGE, not a dictionary definition.

Words:
${list}

Return ONLY a JSON array (no markdown, no code block):
[{"word":"exactword","clue":"your detailed clue here"}]`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${GROQ_KEY}`},
    body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],temperature:0.6,max_tokens:1800})
  });
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(match?match[0]:raw);
  return Object.fromEntries(arr.map(({word,clue})=>[word,clue]));
}

// ─── Component ───
export function Crossword({ userId }) {
  const [phase, setPhase]       = useState('loading');
  const [msg, setMsg]           = useState('Picking your toughest words…');
  const [cw, setCw]             = useState(null);
  const [userGrid, setUserGrid] = useState([]);
  const [selCell, setSelCell]   = useState(null);
  const [selDir, setSelDir]     = useState('across');
  const [correct, setCorrect]   = useState(new Set());
  const [revealed, setRevealed] = useState(new Set());
  // store a snapshot of userGrid before reveal so we can restore it
  const [preReveal, setPreReveal] = useState({});
  const refs = useRef({});

  useEffect(() => { init(); }, []);

  async function init() {
    setPhase('loading'); setMsg('Picking your toughest words…');
    setCorrect(new Set()); setRevealed(new Set()); setSelCell(null); setPreReveal({});
    try {
      const res  = await fetch(`${API_URL}/api/words${userId?`?userId=${encodeURIComponent(userId)}`:''}`);
      const all  = await res.json();
      const hard = all
        .filter(w=>w.word&&/^[a-zA-ZäöüÄÖÜß]+$/.test(w.word)&&w.word.length>=3&&w.word.length<=14)
        .sort((a,b)=>(a.retention??50)-(b.retention??50))
        .slice(0,12);
      if (hard.length<3) { setPhase('nowords'); return; }

      setMsg('Generating AI clues…');
      let clueMap={};
      try { clueMap=await generateClues(hard); } catch {}

      const words = hard.map(w=>({...w, clue:clueMap[w.word]||w.translation||'?'}));

      setMsg('Building crossword…');
      const result = buildCrossword(words);
      if (!result) { setPhase('error'); return; }

      setCw(result);
      setUserGrid(result.grid.map(row=>row.map(c=>c?'':null)));
      setPhase('ready');
    } catch(e) { console.error(e); setPhase('error'); }
  }

  // helpers
  function wordsAt(r, c) {
    if (!cw) return [];
    return cw.placements.reduce((acc,p,i)=>{
      const [dr,dc]=p.dir==='across'?[0,1]:[1,0];
      if (p.word.split('').some((_,j)=>p.row+dr*j===r&&p.col+dc*j===c)) acc.push({idx:i,dir:p.dir});
      return acc;
    },[]);
  }

  function wordIdxAt(r, c, dir) {
    if (!cw) return -1;
    return cw.placements.findIndex(p=>{
      if (p.dir!==dir) return false;
      const [dr,dc]=dir==='across'?[0,1]:[1,0];
      return p.word.split('').some((_,j)=>p.row+dr*j===r&&p.col+dc*j===c);
    });
  }

  function focus(r, c) {
    setTimeout(()=>refs.current[`${r}-${c}`]?.focus(),0);
  }

  function advance(r, c) {
    if (!cw) return;
    const [dr,dc]=selDir==='across'?[0,1]:[1,0];
    const nr=r+dr, nc=c+dc;
    if (nr>=0&&nr<cw.rows&&nc>=0&&nc<cw.cols&&cw.grid[nr]?.[nc]!==null) { setSelCell({r:nr,c:nc}); focus(nr,nc); }
  }

  function retreat(r, c) {
    if (!cw) return;
    const [dr,dc]=selDir==='across'?[0,1]:[1,0];
    const nr=r-dr, nc=c-dc;
    if (nr>=0&&nc>=0&&cw.grid[nr]?.[nc]!==null) { setSelCell({r:nr,c:nc}); focus(nr,nc); }
  }

  function checkAll(ng) {
    if (!cw) return;
    const newCorrect = new Set(correct);
    cw.placements.forEach((p,i)=>{
      if (correct.has(i)||revealed.has(i)) return;
      const [dr,dc]=p.dir==='across'?[0,1]:[1,0];
      if (p.word.split('').every((ch,j)=>{ const u=ng[p.row+dr*j]?.[p.col+dc*j]; return u&&letterMatch(ch,u); }))
        newCorrect.add(i);
    });
    setCorrect(newCorrect);
    if (newCorrect.size+revealed.size===cw.placements.length) setTimeout(()=>setPhase('complete'),400);
    return newCorrect;
  }

  function handleCellClick(r, c) {
    const ws = wordsAt(r,c);
    if (!ws.length) return;
    if (selCell?.r===r&&selCell?.c===c&&ws.length>1) {
      setSelDir(d=>d==='across'?'down':'across');
    } else {
      setSelCell({r,c});
      if (!ws.find(w=>w.dir===selDir)) setSelDir(ws[0].dir);
    }
    focus(r,c);
  }

  function handleChange(r, c, val) {
    const ch = val.replace(/[^a-zA-ZäöüÄÖÜß]/g,'').slice(-1);
    if (!ch) return;
    const ng = userGrid.map((row,ri)=>row.map((cell,ci)=>ri===r&&ci===c?ch:cell));
    setUserGrid(ng);
    checkAll(ng);
    advance(r,c);
  }

  function handleKeyDown(r, c, e) {
    if (e.key==='Backspace') {
      e.preventDefault();
      if (userGrid[r][c]) {
        setUserGrid(g=>g.map((row,ri)=>row.map((cell,ci)=>ri===r&&ci===c?'':cell)));
      } else retreat(r,c);
    }
    if (e.key==='ArrowRight') { e.preventDefault(); selDir==='across'?advance(r,c):setSelDir('across'); }
    if (e.key==='ArrowLeft')  { e.preventDefault(); selDir==='across'?retreat(r,c):setSelDir('across'); }
    if (e.key==='ArrowDown')  { e.preventDefault(); selDir==='down'?advance(r,c):setSelDir('down'); }
    if (e.key==='ArrowUp')    { e.preventDefault(); selDir==='down'?retreat(r,c):setSelDir('down'); }
  }

  function revealWord(idx) {
    const p = cw.placements[idx];
    const [dr,dc]=p.dir==='across'?[0,1]:[1,0];
    // snapshot current cells so we can restore on unreveal
    const snapshot = {};
    p.word.split('').forEach((_,j)=>{ snapshot[`${p.row+dr*j}-${p.col+dc*j}`] = userGrid[p.row+dr*j]?.[p.col+dc*j] ?? ''; });
    setPreReveal(prev=>({...prev, [idx]: snapshot}));
    setUserGrid(g=>{
      const ng=g.map(r=>[...r]);
      p.word.toLowerCase().split('').forEach((ch,j)=>{ ng[p.row+dr*j][p.col+dc*j]=ch; });
      return ng;
    });
    setRevealed(prev=>new Set([...prev,idx]));
  }

  function unrevealWord(idx) {
    const p = cw.placements[idx];
    const [dr,dc]=p.dir==='across'?[0,1]:[1,0];
    const snapshot = preReveal[idx] || {};
    setUserGrid(g=>{
      const ng=g.map(r=>[...r]);
      p.word.split('').forEach((_,j)=>{ ng[p.row+dr*j][p.col+dc*j] = snapshot[`${p.row+dr*j}-${p.col+dc*j}`] ?? ''; });
      return ng;
    });
    setRevealed(prev=>{ const s=new Set(prev); s.delete(idx); return s; });
    setPreReveal(prev=>{ const n={...prev}; delete n[idx]; return n; });
  }

  function selectWord(idx) {
    const p=cw.placements[idx];
    setSelCell({r:p.row,c:p.col}); setSelDir(p.dir); focus(p.row,p.col);
  }

  // ─── screens ───
  if (phase==='loading') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 20px',gap:16}}>
      <div className="cw-spinner" />
      <div style={{fontSize:14,color:'var(--ink-3)'}}>{msg}</div>
    </div>
  );
  if (phase==='nowords') return (
    <div style={{textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Not enough words yet</div>
      <p style={{fontSize:14,color:'var(--ink-3)'}}>Add at least 3 words to your deck — go to Explore to extract vocabulary from any German text.</p>
    </div>
  );
  if (phase==='error') return (
    <div style={{textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:16,fontWeight:600,marginBottom:12}}>Couldn't build the crossword</div>
      <button className="btn btn-primary btn-sm" onClick={init}>Try again</button>
    </div>
  );
  if (phase==='complete') return (
    <div style={{textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:52,marginBottom:16}}>🎉</div>
      <h2 style={{marginBottom:8}}>Puzzle complete!</h2>
      <p style={{color:'var(--ink-3)',marginBottom:28}}>
        {cw.placements.length} words · {correct.size} solved · {revealed.size} revealed
      </p>
      <button className="btn btn-primary btn-sm" onClick={init}>New puzzle</button>
    </div>
  );

  if (!cw) return null;

  const activeIdx = selCell ? wordIdxAt(selCell.r, selCell.c, selDir) : -1;
  const CELL = 34;

  const across = cw.placements.filter(p=>p.dir==='across').sort((a,b)=>a.num-b.num);
  const down   = cw.placements.filter(p=>p.dir==='down').sort((a,b)=>a.num-b.num);

  const cellState = (r, c) => {
    if (cw.grid[r][c]===null) return 'black';
    const ws = wordsAt(r,c);
    const locked = ws.some(w=>correct.has(w.idx)||revealed.has(w.idx));
    const isActive = selCell?.r===r&&selCell?.c===c;
    const inWord = ws.some(w=>w.idx===activeIdx&&w.dir===selDir);
    const isCorrect = ws.some(w=>correct.has(w.idx));
    const isRevealed = ws.some(w=>revealed.has(w.idx));
    return { locked, isActive, inWord, isCorrect, isRevealed };
  };

  return (
    <div className="cw-layout">
      {/* Grid */}
      <div style={{overflowX:'auto'}}>
        <div style={{
          display:'inline-grid',
          gridTemplateColumns:`repeat(${cw.cols},${CELL}px)`,
          gap:2, background:'#2d2459',
          border:'3px solid #2d2459', borderRadius:10,
          padding:2,
        }}>
          {cw.grid.map((row,r)=>row.map((cell,c)=>{
            const st = cellState(r,c);
            if (st==='black') return (
              <div key={`${r}-${c}`} style={{width:CELL,height:CELL,background:'#2d2459',borderRadius:3}} />
            );
            const {locked,isActive,inWord,isCorrect,isRevealed} = st;
            const num = cw.numGrid[r][c];
            let bg, color;
            if (isActive) { bg='#ffe04b'; color='#1a1440'; }
            else if (inWord) { bg='#fff9cc'; color='var(--ink)'; }
            else if (isCorrect) { bg='#b8f5d8'; color='#0d6e44'; }
            else if (isRevealed) { bg='#ffd4e8'; color='#b5006e'; }
            else { bg='#fff'; color='var(--ink)'; }
            return (
              <div key={`${r}-${c}`} onClick={()=>handleCellClick(r,c)}
                style={{width:CELL,height:CELL,background:bg,position:'relative',cursor:'pointer',borderRadius:3,
                  boxShadow: isActive ? '0 0 0 2px #f0b800 inset' : 'none',
                  transition:'background 0.15s',
                }}
              >
                {num>0 && <span style={{position:'absolute',top:1,left:2,fontSize:7,lineHeight:1,color:isActive?'#1a1440':'#8878cc',fontWeight:700,pointerEvents:'none'}}>{num}</span>}
                <input
                  ref={el=>{if(el)refs.current[`${r}-${c}`]=el;}}
                  value={userGrid[r]?.[c]??''}
                  onChange={e=>!locked&&handleChange(r,c,e.target.value)}
                  onKeyDown={e=>!locked&&handleKeyDown(r,c,e)}
                  onFocus={()=>setSelCell({r,c})}
                  readOnly={locked}
                  style={{
                    position:'absolute',inset:0,width:'100%',height:'100%',
                    border:'none',outline:'none',background:'transparent',
                    textAlign:'center',fontSize:15,fontWeight:700,
                    textTransform:'uppercase',caretColor:'transparent',color,
                    paddingTop:6,cursor:'pointer',
                  }}
                />
              </div>
            );
          }))}
        </div>
        <div style={{marginTop:8,fontSize:11,color:'var(--ink-4)',textAlign:'center'}}>
          Click to select · type to fill · click intersection again to switch direction
        </div>
      </div>

      {/* Clues */}
      <div className="cw-clues">
        {[['Across',across],['Down',down]].map(([label,list])=>(
          <div key={label}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--ink-4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8,paddingBottom:4,borderBottom:'1px solid var(--line)'}}>
              {label}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:1}}>
              {list.map(p=>{
                const idx=cw.placements.indexOf(p);
                const isSolved=correct.has(idx);
                const isRev=revealed.has(idx);
                const done=isSolved||isRev;
                const isAct=idx===activeIdx;
                return (
                  <div key={p.num} onClick={()=>!isSolved&&selectWord(idx)}
                    style={{
                      display:'flex',alignItems:'flex-start',gap:8,padding:'6px 8px',borderRadius:6,
                      cursor:isSolved?'default':'pointer',
                      background:isAct?'var(--violet-soft)':'transparent',
                      border:isAct?'0.5px solid var(--violet-line)':'0.5px solid transparent',
                    }}
                  >
                    <span style={{fontSize:11,fontWeight:700,color:'var(--violet)',minWidth:18,marginTop:1,flexShrink:0}}>{p.num}.</span>
                    <span style={{fontSize:13,color:'var(--ink-2)',flex:1,lineHeight:1.45,
                      textDecoration:isSolved?'line-through':'none',opacity:done?0.55:1}}>{p.clue}</span>
                    <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                      {isSolved && <span style={{color:'#0d6e44',fontSize:14}}>✓</span>}
                      {isRev && (
                        <button onClick={e=>{e.stopPropagation();unrevealWord(idx);}}
                          style={{fontSize:10,padding:'2px 6px',borderRadius:4,border:'0.5px solid #f9a8d4',background:'#fdf2f8',color:'#b5006e',cursor:'pointer',fontWeight:600}}>
                          Unreveal
                        </button>
                      )}
                      {!done && (
                        <button onClick={e=>{e.stopPropagation();revealWord(idx);}}
                          style={{fontSize:10,padding:'2px 6px',borderRadius:4,border:'0.5px solid var(--line)',background:'var(--bg-3)',color:'var(--ink-4)',cursor:'pointer'}}>
                          Reveal
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={init} style={{marginTop:12,alignSelf:'flex-start'}}>New puzzle</button>
      </div>
    </div>
  );
}
