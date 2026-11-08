const { loadCatalog, exportCatalog, saveCategory, deleteCategory, saveTrack, deleteTrack } = window.BeatlineDB;
const { groupedCategories, eligibleTracks } = window.BeatlineFilters;

const root = document.getElementById('app');
const audio = document.getElementById('songAudio');
const fixedDatabase = window.BEATLINE_SUPABASE;
const state = {
  page:document.body.dataset.startPage==='admin'?'admin':'home', adminTab:'musicas', config:{count:8,lives:3,infiniteLives:false,infiniteSongs:false,categories:[],excludedCategories:[],filterMode:'include'},
  connection:fixedDatabase, connected:false, connectionError:'', categories:[], tracks:[],
  authStatus:document.body.dataset.startPage==='admin'?'checking':'none', authError:'', authBusy:false, adminEmail:'',
  adminEditing:null, adminFilter:'all', adminSearch:'', activeForm:false, loading:false, toast:'', modal:'',
  bulk:{rows:[],running:false,extracting:false,processed:0,total:0,note:'',nextId:1},
  queue:[], sessionTracks:[], remainingSongs:[], timeline:[], wrong:[], refSong:null, round:0, correct:0, livesRemaining:3,
  selectedSlot:null, reveal:null, endAfterReveal:false, endReason:'', playing:false,
  playedSeconds:0, totalSeconds:0, muted:false
};
const path = {
  music:'<path d="m9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  play:'<polygon points="6 3 20 12 6 21 6 3"/>', pause:'<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  heart:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  list:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  check:'<path d="M20 6 9 17l-5-5"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  rotate:'<path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6"/>',
  headphones:'<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="2" y="13" width="5" height="8" rx="2"/><rect x="17" y="13" width="5" height="8" rx="2"/>',
  arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>', chevron:'<path d="m9 18 6-6-6-6"/>',
  drag:'<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit:'<path d="M12 20h9M16 4l4 4L9 19l-5 1 1-5z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 10v7m4-7v7"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  album:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="m4 4 6 6"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  tag:'<path d="M2 12V3h9l11 11-8 8L3 11z"/><circle cx="7" cy="7" r="1"/>',
  trophy:'<path d="M7 3h10v8a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 16v5m-5 0h10"/>',
  warning:'<path d="M12 3 2 21h20L12 3zM12 10v4m0 3v.01"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  filter:'<path d="M3 5h18l-7 8v7l-4-2v-5z"/>',
  speaker:'<path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
  mute:'<path d="M11 5 6 9H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
};
function icon(name,cls=''){return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path[name]||path.music}</svg>`;}
const h = (s='') => String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attr = h;
const cats = () => state.categories;
const catalog = () => state.tracks;
function selectedCatNames(ids){return (ids||[]).map(id=>cats().find(c=>c.id===id)?.name).filter(Boolean);}
function logo(){return `<button class="logo" data-action="nav-home" aria-label="Página inicial"><span class="logo-burst">${icon('music')}</span><span class="logo-word">BEAT<span>//</span>LINE</span></button>`;}
function navbar(){return `<header class="topbar">${logo()}<div class="topbar-right">${state.page==='admin'&&state.authStatus==='authorized'?`<span class="admin-session-email" title="Administrador conectado">${icon('check')} ADMINISTRADOR</span><button class="admin-signout" data-action="admin-logout">SAIR</button>`:''}<button class="icon-btn" data-action="nav-home" title="Home" aria-label="Home">${icon('home')}</button></div></header>`;}
function renderHome(){return `<section class="screen home"><div class="home-copy"><span class="eyebrow">A LINHA DO TEMPO VIROU UM JOGO</span><h1 class="hero-title"><span class="hero-top">BEAT</span><span class="hero-bottom">LINE!</span></h1><p class="hero-sub">Ouviu o hit? Agora encaixa ele na história da música.</p><div class="home-actions"><button class="primary-btn big" data-action="nav-config">${icon('play')} JOGAR AGORA ${icon('arrow')}</button></div></div><div class="home-art" aria-hidden="true"><div class="art-checker"></div><div class="art-cyan"></div><div class="record"><div class="record-center"></div><div class="record-label">BL<span style="color:#fff">//</span></div></div><span class="art-sticker star">WOW!</span><span class="art-sticker tag">PLAY IT!</span><span class="art-squiggle">↝</span></div><div class="home-foot"><span class="foot-icon">${icon('headphones')}</span><span class="foot-icon">${icon('drag')}</span><span class="foot-icon">${icon('check')}</span><span>OUÇA · POSICIONE · REVELE</span></div></section>`;}
function counter(label,key,number,ic){
  const isLives=key==='lives';
  const infinite=isLives?state.config.infiniteLives:state.config.infiniteSongs;
  const amount=isLives?`<input class="counter-number life-input" id="lifeCount" type="number" inputmode="numeric" min="0" step="1" value="${number}" aria-label="Quantidade de vidas" ${infinite?'disabled':''}>`:`<span class="counter-number">${infinite?'∞':number}</span>`;
  const toggle=isLives?'toggle-infinite-lives':'toggle-infinite-songs';
  return `<div class="counter-box ${isLives?'pink':''}"><div class="counter-label">${icon(ic)} ${label}</div><div class="counter-controls"><button class="stepper" data-action="dec-${key}" aria-label="Diminuir ${label}" ${infinite?'disabled':''}>${icon('minus')}</button>${amount}<button class="stepper" data-action="inc-${key}" aria-label="Aumentar ${label}" ${infinite?'disabled':''}>${icon('plus')}</button></div><button class="infinite-toggle ${infinite?'active':''}" data-action="${toggle}" aria-pressed="${infinite}">∞ ${label} INFINITAS ${infinite?'✓':''}</button></div>`;
}
function categoryChip(cat){
  const id=String(cat.id);
  const included=state.config.categories.includes(id);
  const excluded=state.config.excludedCategories.includes(id);
  const selected=included?'include':excluded?'exclude':'neutral';
  return `<button class="cat-chip ${selected}" data-action="select-category" data-id="${attr(id)}" aria-pressed="${included||excluded}" title="${included?'Incluída':excluded?'Excluída':'Sem filtro'}: ${attr(cat.name)}">${included?icon('check'):excluded?icon('x'):''}${h(cat.name)}</button>`;
}
function renderConfig(){
  const total=eligibleTracks(catalog(),cats(),state.config.categories,state.config.excludedCategories).length;
  const all=state.config.categories.length===0&&state.config.excludedCategories.length===0;
  const mode=state.config.filterMode;
  return `<section class="screen config-screen"><div class="config-illustration"><div class="screen-kicker">01 / O AQUECIMENTO</div><h1 class="section-title">MONTE <br>SEU <br><em>MIX!</em></h1><div class="config-graphic">${icon('headphones')}</div></div><div class="config-panel"><h2 class="panel-title">${icon('settings')} CONFIGURE A PARTIDA</h2><div class="config-counters">${counter('MÚSICAS','count',state.config.count,'music')}${counter('VIDAS','lives',state.config.lives,'heart')}</div><div class="field-label">${icon('tag')} FILTROS DA PLAYLIST</div><div class="filter-toolbar"><div class="filter-mode-toggle" role="group" aria-label="Modo de seleção das categorias"><button class="filter-mode-btn include ${mode==='include'?'active':''}" data-action="filter-mode" data-mode="include" aria-pressed="${mode==='include'}">${icon('plus')} INCLUIR</button><button class="filter-mode-btn exclude ${mode==='exclude'?'active':''}" data-action="filter-mode" data-mode="exclude" aria-pressed="${mode==='exclude'}">${icon('minus')} EXCLUIR</button></div><button class="filter-reset" data-action="select-all" ${all?'disabled':''}>${icon('rotate')} LIMPAR</button></div><p class="filter-explanation">Escolha <strong>INCLUIR</strong> ou <strong>EXCLUIR</strong> e toque nas categorias. <strong>OU</strong> dentro de cada grupo, <strong>E</strong> entre grupos. As exclusões sempre prevalecem.</p><div class="filter-groups">${groupedCategories(cats()).map(group=>`<div class="filter-group"><div class="filter-group-heading">${group.name}</div><div class="chip-wrap">${group.categories.map(categoryChip).join('')}</div></div>`).join('')}</div><div class="filter-status" aria-live="polite"><span>${all?'TODAS AS CATEGORIAS':`${state.config.categories.length} INCLUÍDA(S) · ${state.config.excludedCategories.length} EXCLUÍDA(S)`}</span><strong>${state.connected?`${total} MÚSICAS DISPONÍVEIS`:'CARREGANDO CATÁLOGO'}</strong></div><div class="config-bottom"><div class="config-hint">${state.config.infiniteSongs?'MODO INFINITO · MÚSICAS RECICLADAS APÓS ESGOTAR O CATÁLOGO':'PLAYLIST AUTOMÁTICA · CATÁLOGO MUSICAL<br>1 música-base extra'}</div><button class="primary-btn" data-action="start-game">COMEÇAR ${icon('arrow')}</button></div></div></section>`;
}
const wave = Array.from({length:25},(_,i)=>`<span style="--h:${8+((i*13+i*i*7)%34)}px;--d:${-((i*71)%100)/100}s"></span>`).join('');
function lifeHtml(){
  if(state.config.infiniteLives)return `<div class="life-row infinite-lives" title="Vidas infinitas">${icon('heart','heart-fill')} <strong>∞</strong></div>`;
  const n=state.config.lives,remaining=Math.max(0,state.livesRemaining);
  if(n===0)return `<div class="life-row"><span class="life-zero">${icon('heart')} 0</span></div>`;
  // Nunca criar milhares de ícones SVG quando o jogador selecionar muitas vidas.
  if(n>8)return `<div class="life-row numeric-lives" title="${remaining} de ${n} vidas restantes">${icon('heart','heart-fill')} <strong>${remaining} / ${n}</strong></div>`;
  return `<div class="life-row" title="Vidas restantes">${Array.from({length:n},(_,i)=>icon('heart',i<remaining?'heart-fill':'empty')).join('')}</div>`;
}
function timelineHtml(){return state.timeline.map((song,index)=>`${slotHtml(index)}<article class="timeline-card" data-before="${index}"><span class="track-id">● #${String(index+1).padStart(2,'0')}</span><strong class="timeline-title">${h(song.title)}</strong><span class="timeline-year">${h(song.release_year)}</span></article>`).join('')+slotHtml(state.timeline.length);}
function slotHtml(index){const chosen=state.selectedSlot===index;const song=chosen?currentSong():null;return `<button class="slot ${chosen?'selected':''}" data-action="slot" data-slot="${index}" aria-label="Colocar música na posição ${index+1}" title="${chosen?'Arraste para mudar a posição (ou toque em outro espaço)':'Posição '+(index+1)}">${song?`<span class="slot-mini-meta">♪ SUA FAIXA ↔</span><strong class="slot-mini-title">${h(song.title)}</strong><span class="slot-mini-artist">${h(song.artist||'')}</span>`:''}</button>`;}
function secondsLabel(seconds){const x=Math.max(0,Math.floor(seconds||0));return `${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`;}
function currentSong(){return state.queue[state.round];}
function renderGame(){const song=currentSong();if(!song)return '';return `<section class="screen game-screen"><div class="game-head"><div class="game-head-left"><span class="game-stage-label">PLAYLIST EM ANDAMENTO</span><span class="round-pill">${String(state.round+1).padStart(2,'0')} / ${state.config.infiniteSongs?'∞':String(state.queue.length).padStart(2,'0')}</span></div><div class="game-head-right">${lifeHtml()}<button class="icon-btn" data-action="request-home" title="Sair da partida">${icon('close')}</button></div></div><div class="board"><div class="board-top"><strong>↳ LINHA DO TEMPO</strong><span>ANTES ← &nbsp; / &nbsp; → DEPOIS</span></div><div class="timeline-scroller"><div class="timeline-row">${timelineHtml()}</div></div>${state.wrong.length?`<button class="missed-stack" data-action="show-wrong"><span>✕ ERROS · ${state.wrong.length}</span><strong>${h(state.wrong.at(-1).title)}</strong><em>${h(state.wrong.at(-1).release_year)}</em></button>`:''}<div class="board-footer"><span>${icon('drag')} ARRASTE A FAIXA OU TOQUE NO ESPAÇO · ROLE COM MOUSE / TOUCHPAD</span><span>♫ &nbsp; ORDEM CRONOLÓGICA</span></div></div><div class="play-area"><div class="now-card"><div class="grab-area" id="grabSong" role="button" tabindex="0" aria-label="Arraste a música para a linha do tempo"><span class="album-icon">${icon('album')}</span><div class="now-info"><div class="now-label">▶ SUA PRÓXIMA FAIXA</div><div class="now-title">${h(song.title)}</div><div class="now-artist">${h(song.artist||'ARTISTA NÃO INFORMADO')}</div></div></div><span class="grab-indicator">${icon('drag')}</span></div><div class="player-box"><div class="player-upper"><div class="player-controls"><button class="play-btn" data-action="play" aria-label="${state.playing?'Pausar':'Reproduzir'}">${icon(state.playing?'pause':'play')}</button><button class="restart-btn" data-action="restart-audio" title="Reiniciar áudio" aria-label="Reiniciar">${icon('rotate')}</button></div><div class="waveform ${state.playing?'playing':''}">${wave}</div></div><div class="progress-line"><div class="progress-bar" style="width:${state.totalSeconds>0?Math.min(100,Math.round(state.playedSeconds/state.totalSeconds*100)):0}%"></div><input class="progress-seek" id="audioSeek" type="range" min="0" max="${state.totalSeconds||0}" step="0.1" value="${Math.min(state.playedSeconds,state.totalSeconds)||0}" aria-label="Avançar ou retroceder a música" title="Arraste para escolher o trecho"></div><div class="time-labels"><span>${secondsLabel(state.playedSeconds)}</span><span>${secondsLabel(state.totalSeconds)}</span></div></div><div class="submit-box"><button class="submit-btn" data-action="confirm" ${state.selectedSlot===null?'disabled':''}>${icon('check')} CONFIRMAR</button>${state.wrong.length?`<div class="wrong-bubble">${icon('x')} ${state.wrong.length} ERRO(S)<button data-action="show-wrong" title="Ver músicas erradas">${icon('list')}</button></div>`:''}</div></div>${state.reveal?renderReveal():''}</section>`;}
function renderReveal(){const r=state.reveal;return `<div class="result-shade"><div class="result-box ${r.correct?'':'wrong'}"><div class="result-icon">${icon(r.correct?'check':'x')}</div><h2 class="result-title">${r.correct?'NA MOSCA!':'FORA DO TOM!'}</h2><div class="result-track">${h(r.song.title)}</div><div class="result-year">${h(r.song.release_year)}</div><button class="primary-btn" data-action="next-round">${state.endAfterReveal?'VER RESULTADO':'PRÓXIMA FAIXA'} ${icon('arrow')}</button></div></div>`;}
function renderEnd(){const completed=state.endReason==='complete';return `<section class="screen end-screen"><div class="end-left"><div class="screen-kicker">FIM DA TRANSMISSÃO</div><h1 class="section-title">${completed?'SEU MIX<br><em>FECHOU!</em>':'FIM DE<br><em>JOGO!</em>'}</h1><p class="hero-sub">${completed?'Você chegou ao fim da playlist.':'As chances acabaram. Hora de uma revanche?'}</p></div><div class="end-card"><div class="end-score"><div class="score-number">${state.correct}</div><div class="score-caption">ACERTOS<br>DE ${state.round+1}<br>FAIXAS JOGADAS</div>${icon('trophy','end-trophy')}</div><div class="end-actions"><button class="pink-btn" data-action="retry">${icon('rotate')} JOGAR DE NOVO</button><button class="primary-btn" data-action="nav-config">${icon('settings')} NOVA PARTIDA</button><button class="secondary-btn" data-action="nav-home">${icon('home')} HOME</button></div>${state.wrong.length?`<div class="missed-items"><details><summary>${state.wrong.length} MÚSICA(S) FORA DA LINHA</summary>${state.wrong.map(s=>`<div>✕ ${h(s.title)} · ${h(s.release_year)}</div>`).join('')}</details></div>`:''}</div></section>`;}
function adminSidebar(){let menu=[['musicas','music','Músicas'],['categorias','tag','Categorias'],['importar','upload','Importar em lote']];return `<aside class="admin-side"><h1>BACK<span>STAGE</span></h1><nav class="side-nav">${menu.map(([key,ic,label])=>`<button class="side-item ${state.adminTab===key?'active':''}" data-action="admin-tab" data-tab="${key}" title="${label}">${icon(ic)} ${label}</button>`).join('')}</nav><div class="side-note">BEAT//LINE<br>PAINEL DE CONTROLE<br>CATÁLOGO MUSICAL</div></aside>`;}
function songsAdmin(){
  const query = (state.adminSearch || '').trim().toLowerCase();
  const arr = state.tracks.filter(t => {
    const matchCat = state.adminFilter === 'all' || t.category_ids.includes(state.adminFilter);
    if (!matchCat) return false;
    if (!query) return true;
    const matchTitle = (t.title || '').toLowerCase().includes(query);
    const matchArtist = (t.artist || '').toLowerCase().includes(query);
    const matchYear = String(t.release_year || '').includes(query);
    return matchTitle || matchArtist || matchYear;
  });
  let editing=state.adminEditing&&state.adminEditing!=='new'?state.tracks.find(x=>x.id===state.adminEditing):null;
  const form=state.activeForm?`<form class="admin-form" id="trackForm"><div class="panel-title">${icon('music')} ${editing?'EDITAR':'NOVA'} MÚSICA</div><div class="form-grid"><label class="form-label">NOME DA MÚSICA<input class="form-input" name="title" required maxlength="140" value="${attr(editing?.title||'')}" placeholder="Ex.: Nome da faixa"></label><label class="form-label">ARTISTA (OPCIONAL)<input class="form-input" name="artist" maxlength="140" value="${attr(editing?.artist||'')}" placeholder="Nome do artista"></label><label class="form-label">ANO DE LANÇAMENTO<input class="form-input" name="release_year" type="number" min="1900" max="2100" required value="${attr(editing?.release_year||'')}"></label><label class="form-label">ARQUIVO MP3<input class="form-input" type="file" accept="audio/mpeg,.mp3" name="mp3" ${editing?'':'required'}><span class="form-help">${editing?'Vazio = manter MP3 atual.':'O áudio será enviado diretamente ao Supabase Storage.'}</span></label></div><div class="form-label">CATEGORIAS</div><div class="checkbox-grid">${state.categories.map(c=>`<label class="check-cat"><input name="category_id" type="checkbox" value="${attr(c.id)}" ${editing?.category_ids.includes(c.id)?'checked':''}>${h(c.name)}</label>`).join('')||'<span class="form-help">Cadastre uma categoria antes de adicionar músicas.</span>'}</div><div class="form-buttons"><button class="small-action" type="submit" ${state.categories.length===0?'disabled':''}>${icon('check')} SALVAR MÚSICA</button><button class="small-action neutral" type="button" data-action="cancel-form">CANCELAR</button></div></form>`:'';
  return `<div class="admin-titlebar"><div><h2>ARQUIVO MUSICAL</h2><small>${arr.length === state.tracks.length ? `${state.tracks.length} MÚSICAS CADASTRADAS` : `${arr.length} DE ${state.tracks.length} MÚSICAS ENCONTRADAS`}</small></div><div class="admin-title-actions"><button class="small-action neutral" data-action="export-csv" ${!state.connected||state.loading?'disabled':''} title="Exportar todas as músicas cadastradas em CSV">${icon('download')} EXPORTAR CSV</button><button class="small-action" data-action="new-track" ${!state.connected?'disabled':''}>${icon('plus')} ADICIONAR</button></div></div>${form}<div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap"><div style="flex:1;min-width:240px;position:relative;display:flex;align-items:center"><span style="position:absolute;left:12px;pointer-events:none;opacity:0.6;display:flex">${icon('search')}</span><input class="form-input" id="adminSearch" type="search" placeholder="Buscar por música, artista ou ano..." value="${attr(state.adminSearch||'')}" style="padding-left:36px;padding-right:32px;min-height:38px;width:100%">${state.adminSearch?`<button type="button" data-action="clear-admin-search" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;opacity:0.6;padding:4px;display:flex;align-items:center" title="Limpar busca">${icon('close')}</button>`:''}</div><div style="display:flex;gap:8px;align-items:center"><span class="pill">${icon('filter')} FILTRO</span><select class="form-input" style="min-height:38px;max-width:230px" id="adminFilter"><option value="all">TODAS AS CATEGORIAS</option>${state.categories.map(c=>`<option value="${attr(c.id)}" ${state.adminFilter===c.id?'selected':''}>${h(c.name)}</option>`).join('')}</select></div></div>${!state.connected?emptyAdmin('Não foi possível carregar as músicas. Tente novamente.'):(arr.length?`<div class="admin-list">${arr.map(t=>`<div class="admin-item"><div class="admin-item-left"><span class="admin-dot">${icon('music')}</span><div style="min-width:0"><div class="admin-item-name">${h(t.title)}</div><div class="admin-item-meta">${h(t.artist||'ARTISTA NÃO INFORMADO')} · ${h(t.release_year)}</div><div class="tag-list">${selectedCatNames(t.category_ids).map(c=>`<span class="tag">${h(c)}</span>`).join('')}</div></div></div><div class="admin-item-actions"><button class="mini-btn" data-action="edit-track" data-id="${attr(t.id)}" title="Editar">${icon('edit')}</button><button class="mini-btn danger" data-action="delete-track" data-id="${attr(t.id)}" title="Excluir">${icon('trash')}</button></div></div>`).join('')}</div>`:emptyAdmin(query||state.adminFilter!=='all'?'Nenhuma música encontrada com os filtros aplicados.':'Nenhuma música encontrada. Cadastre categorias e depois faça upload de seus MP3s.'))}`;
}
function emptyAdmin(message){return `<div class="empty-panel">${icon('album')}${h(message)}</div>`;}
function categoriesAdmin(){const editing=state.adminEditing&&state.adminEditing!=='new'?state.categories.find(c=>c.id===state.adminEditing):null;return `<div class="admin-titlebar"><div><h2>ESTAÇÕES MUSICAIS</h2><small>${state.categories.length} CATEGORIAS</small></div><button class="small-action" data-action="new-category" ${!state.connected?'disabled':''}>${icon('plus')} CRIAR</button></div>${state.activeForm?`<form class="admin-form pink" id="categoryForm"><div class="panel-title">${icon('tag')} ${editing?'EDITAR':'NOVA'} CATEGORIA</div><div class="form-grid"><label class="form-label">NOME<input class="form-input" name="name" required maxlength="40" value="${attr(editing?.name||'')}" placeholder="Ex.: ROCK 90"></label><label class="form-label">COR DE DESTAQUE<input class="form-input" type="color" name="color" value="${attr(editing?.color||'#c7f456')}"></label></div><div class="form-buttons"><button class="small-action" type="submit">${icon('check')} SALVAR</button><button class="small-action neutral" type="button" data-action="cancel-form">CANCELAR</button></div></form>`:''}${!state.connected?emptyAdmin('Não foi possível carregar as categorias. Tente novamente.'):(state.categories.length?`<div class="admin-list">${state.categories.map(c=>{let count=state.tracks.filter(t=>t.category_ids.includes(c.id)).length;return `<div class="admin-item"><div class="admin-item-left"><span class="admin-dot" style="background:${/^#[a-fA-F0-9]{6}$/.test(c.color)?c.color:'#c7f456'}">${icon('tag')}</span><div><div class="admin-item-name">${h(c.name)}</div><div class="admin-item-meta">${count} MÚSICAS</div></div></div><div class="admin-item-actions"><button class="mini-btn" data-action="show-cat-tracks" data-id="${attr(c.id)}" title="Ver músicas">${icon('list')}</button><button class="mini-btn" data-action="edit-category" data-id="${attr(c.id)}" title="Editar">${icon('edit')}</button><button class="mini-btn danger" data-action="delete-category" data-id="${attr(c.id)}" title="Excluir">${icon('trash')}</button></div></div>`}).join('')}</div>`:emptyAdmin('Ainda não existem categorias. Crie a primeira para começar.'))}`;}
function renderAdminLogin(){
  const checking=state.authStatus==='checking';
  return `<section class="screen admin-login-screen"><div class="admin-login-card"><div class="login-stamp">${icon('database')} ÁREA RESTRITA</div><h1>BACK<span>STAGE</span></h1><p>${checking?'Verificando sua sessão de administrador…':'Entre com a conta Supabase Auth autorizada para administrar a AltiGames.'}</p>${checking?'<div class="admin-login-loading"><div class="spinner"></div>VALIDANDO ACESSO…</div>':`<form id="adminLoginForm" class="admin-login-form"><label class="form-label">E-MAIL<input class="form-input" type="email" name="email" autocomplete="username" required placeholder="seu@email.com" maxlength="254"></label><label class="form-label">SENHA<input class="form-input" type="password" name="password" autocomplete="current-password" required placeholder="Sua senha"></label><button class="primary-btn" type="submit" ${state.authBusy?'disabled':''}>${icon('check')} ${state.authBusy?'ENTRANDO…':'ENTRAR NO PAINEL'}</button></form>`}${state.authError?`<div class="admin-login-error" role="alert">${icon('warning')} ${h(state.authError)}</div>`:''}<a class="admin-login-back" href="index.html">${icon('home')} VOLTAR AO JOGO</a></div></section>`;
}
function renderAdmin(){
  if(state.authStatus!=='authorized')return renderAdminLogin();
  return `<section class="screen admin-screen">${adminSidebar()}<main class="admin-main">${state.connectionError?`<div class="catalog-error">${icon('warning')} Não foi possível carregar o catálogo. <button data-action="retry-catalog">TENTAR NOVAMENTE</button></div>`:''}${state.adminTab==='categorias'?categoriesAdmin():state.adminTab==='importar'?renderBulkAdmin():songsAdmin()}</main></section>`;
}
async function loginAdministrator(form){
  if(state.authBusy)return;
  const data=new FormData(form);
  const email=String(data.get('email')||'').trim();
  const password=String(data.get('password')||'');
  state.authBusy=true;state.authError='';render();
  try {
    state.adminEmail=await window.BeatlineAuth.signIn(email,password);
    state.authStatus='authorized';
  } catch (err) {
    state.authStatus='login';
    state.authError=err.message||'Não foi possível entrar. Tente novamente.';
  } finally {state.authBusy=false;render();}
}

function renderModal(){if(!state.modal)return '';let isExit=state.modal==='exit';return `<div class="modal-cover"><div class="modal-card"><h2>${isExit?'SAIR DA PARTIDA?':'CONFIRMAR EXCLUSÃO?'}</h2><p>${isExit?'O progresso desta partida será perdido.':'Essa ação não pode ser desfeita. Os vínculos com as categorias serão removidos.'}</p><div class="modal-actions"><button class="small-action neutral" data-action="cancel-modal">CANCELAR</button><button class="small-action" data-action="approve-modal">${icon(isExit?'home':'trash')} CONFIRMAR</button></div></div></div>`;}
function render(){
  const previousScroll=state.page==='admin'?(root.querySelector('.admin-main')?.scrollTop||0):0;
  const timelineScroll=root.querySelector('.timeline-scroller')?.scrollLeft ?? 0;
  const configScroll=root.querySelector('.config-panel')?.scrollTop||0;
  const activeId=document.activeElement?.id;
  const selStart=document.activeElement?.selectionStart;
  const selEnd=document.activeElement?.selectionEnd;
  root.innerHTML=`<div class="shell">${navbar()}${state.page==='home'?renderHome():state.page==='config'?renderConfig():state.page==='game'?renderGame():state.page==='end'?renderEnd():renderAdmin()}<div class="footer-strip"></div>${renderModal()}${state.loading?`<div class="loading-overlay"><div><div class="spinner"></div>PROCESSANDO...</div></div>`:''}${state.toast?`<div class="toast">${h(state.toast)}</div>`:''}</div>`;
  if(activeId){
    const el=root.querySelector('#'+activeId);
    if(el){
      el.focus();
      if(typeof selStart==='number'&&typeof selEnd==='number'){try{el.setSelectionRange(selStart,selEnd);}catch(_){}}
    }
  }
  const main=root.querySelector('.admin-main');if(main)main.scrollTop=previousScroll;
  const scroller=root.querySelector('.timeline-scroller');if(scroller){scroller.scrollLeft=timelineScroll;requestAnimationFrame(()=>{if(scroller.isConnected)scroller.scrollLeft=timelineScroll;});}
  const panel=root.querySelector('.config-panel');if(panel)panel.scrollTop=configScroll;
}
let toastTimer;
function toast(message){state.toast=String(message);render();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{state.toast='';render();},4200);}
function navigate(page){if(state.page==='game'&&page!=='game'&&!state.reveal&&state.queue.length){state.modal='exit';render();return;}stopAudio();state.page=page;state.modal='';state.reveal=null;render();}
let audioRequestVersion=0;
function stopAudio(){audioRequestVersion++;audio.pause();audio.removeAttribute('src');audio.load();state.playing=false;state.playedSeconds=0;state.totalSeconds=0;}
function refreshPlayer(){
  if(state.page!=='game')return;
  const percent=state.totalSeconds>0?Math.min(100,state.playedSeconds/state.totalSeconds*100):0;
  const bar=root.querySelector('.progress-bar');if(bar)bar.style.width=`${percent}%`;
  const seek=root.querySelector('#audioSeek');
  if(seek){seek.max=String(state.totalSeconds||0);if(!seek.matches(':active'))seek.value=String(Math.min(state.playedSeconds,state.totalSeconds)||0);}
  const labels=root.querySelectorAll('.time-labels span');
  if(labels.length===2){labels[0].textContent=secondsLabel(state.playedSeconds);labels[1].textContent=secondsLabel(state.totalSeconds);}
  const btn=root.querySelector('[data-action="play"]');
  if(btn){btn.innerHTML=icon(state.playing?'pause':'play');btn.setAttribute('aria-label',state.playing?'Pausar':'Reproduzir');}
  root.querySelector('.waveform')?.classList.toggle('playing',state.playing);
}
function seekAudio(value){
  const duration=Number.isFinite(audio.duration)?audio.duration:state.totalSeconds;
  if(!Number.isFinite(duration)||duration<=0)return;
  const time=Math.max(0,Math.min(duration,Number(value)||0));
  audio.currentTime=time;
  state.playedSeconds=time;
  refreshPlayer();
}
function setAudioSrc(){if(!state.connected)return;const song=currentSong();if(!song)return;audioRequestVersion++;const base=window.BEATLINE_MEDIA.publicBase.replace(/\/+$/,'');audio.src=`${base}/${song.file_path.split('/').map(encodeURIComponent).join('/')}`;audio.load();state.totalSeconds=0;state.playedSeconds=0;}
async function togglePlay(){
  if(state.reveal)return;
  if(!audio.getAttribute('src'))setAudioSrc();
  if(state.playing){audio.pause();state.playing=false;refreshPlayer();return;}
  const requestVersion=audioRequestVersion;
  try{const playing=audio.play();state.playing=true;refreshPlayer();await playing;}
  catch(err){
    // Não reportar como falha do MP3 uma reprodução interrompida ao avançar a rodada.
    if(requestVersion!==audioRequestVersion||err.name==='AbortError'||state.reveal||state.page!=='game')return;
    state.playing=false;refreshPlayer();toast(`Não foi possível tocar o MP3: ${err.message}`);
  }
}
function restartAudio(){
  if(!audio.getAttribute('src'))setAudioSrc();
  audio.currentTime=0;state.playedSeconds=0;
  if(!state.playing)togglePlay();else refreshPlayer();
}
audio.addEventListener('timeupdate',()=>{state.playedSeconds=audio.currentTime||0;refreshPlayer();});
audio.addEventListener('loadedmetadata',()=>{state.totalSeconds=Number.isFinite(audio.duration)?audio.duration:0;refreshPlayer();});
audio.addEventListener('ended',()=>{state.playing=false;refreshPlayer();});
audio.addEventListener('error',()=>{if(state.page==='game'&&audio.getAttribute('src'))toast('Falha ao carregar o MP3 no Cloudflare R2.');});
function shuffle(a){let arr=[...a];for(let i=arr.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
// Em modo infinito, nenhuma faixa se repete antes de todas as elegíveis serem usadas.
// Ao acabar o catálogo, embaralhamos novamente e evitamos repetir imediatamente a última.
function nextInfiniteSong(){
  if(!state.remainingSongs.length){
    state.remainingSongs=shuffle(state.sessionTracks);
    const previous=state.queue.at(-1);
    if(state.remainingSongs.length>1&&state.remainingSongs[0].id===previous?.id){
      const other=state.remainingSongs.findIndex(track=>track.id!==previous.id);
      if(other>0)[state.remainingSongs[0],state.remainingSongs[other]]=[state.remainingSongs[other],state.remainingSongs[0]];
    }
  }
  return state.remainingSongs.shift();
}
function startGame(){
  if(!state.connected){toast(state.connectionError?'Não foi possível carregar as músicas. Atualize a página.':'Carregando músicas. Aguarde um instante.');return;}
  const eligible=eligibleTracks(catalog(),cats(),state.config.categories,state.config.excludedCategories);
  const required=state.config.infiniteSongs?2:state.config.count+1;
  if(eligible.length<required){toast(`São necessárias ${required} músicas na seleção (incluindo a música-base). Encontradas: ${eligible.length}.`);return;}
  stopAudio();
  const songs=shuffle(eligible);
  state.refSong=songs[0];state.timeline=[songs[0]];
  state.sessionTracks=state.config.infiniteSongs?[...eligible]:[];
  state.queue=state.config.infiniteSongs?[songs[1]]:songs.slice(1,state.config.count+1);
  state.remainingSongs=state.config.infiniteSongs?songs.slice(2):[];
  state.round=0;state.correct=0;state.wrong=[];state.livesRemaining=state.config.lives;
  state.selectedSlot=null;state.reveal=null;state.endAfterReveal=false;state.endReason='';state.page='game';
  render();setAudioSrc();togglePlay();
}
function confirmSlot(){if(state.selectedSlot===null||state.reveal)return;const index=state.selectedSlot,song=currentSong();const left=state.timeline[index-1],right=state.timeline[index];const okay=(!left||song.release_year>=left.release_year)&&(!right||song.release_year<=right.release_year);if(okay){state.timeline.splice(index,0,song);state.correct++;}else{state.wrong.push(song);if(!state.config.infiniteLives)state.livesRemaining=Math.max(0,state.livesRemaining-1);}const outOfLives=!okay&&!state.config.infiniteLives&&(state.config.lives===0||state.livesRemaining===0);state.endAfterReveal=outOfLives||(!state.config.infiniteSongs&&state.round===state.queue.length-1);if(state.endAfterReveal)state.endReason=outOfLives?'lives':'complete';state.reveal={correct:okay,song};audio.pause();state.playing=false;render();}
function nextRound(){
  if(state.endAfterReveal){stopAudio();state.page='end';state.reveal=null;render();return;}
  stopAudio();
  if(state.config.infiniteSongs&&state.round+1>=state.queue.length)state.queue.push(nextInfiniteSong());
  state.round++;state.selectedSlot=null;state.reveal=null;
  render();setAudioSrc();togglePlay();
}
async function reloadCatalog(){state.loading=true;render();try{const {categories,tracks}=await loadCatalog(state.connection);state.categories=categories;state.tracks=tracks;state.connected=true;state.connectionError='';state.config.categories=state.config.categories.filter(id=>categories.some(c=>String(c.id)===id));state.config.excludedCategories=state.config.excludedCategories.filter(id=>categories.some(c=>String(c.id)===id));}catch(e){state.connected=false;state.connectionError=e.message||String(e);state.categories=[];state.tracks=[];throw e;}finally{state.loading=false;render();}}
function setAdminTab(tab){state.page='admin';state.adminTab=tab;state.adminEditing=null;state.activeForm=false;render();}
async function downloadMusicCSV(){
  if(!state.connected)throw new Error('O catálogo não está disponível para exportação.');
  // A consulta é feita novamente ao Supabase, sem usar o filtro da tela nem o cache local.
  const {tracks, categories, relationships}=await exportCatalog(state.connection);
  if(!tracks.length){toast('Nenhuma música cadastrada para exportar.');return;}
  const categoryNames=new Map(categories.map(category=>[category.id,category.name]));
  const grouped=new Map();
  for(const relation of relationships){
    if(!grouped.has(relation.track_id))grouped.set(relation.track_id,[]);
    const name=categoryNames.get(relation.category_id);
    if(name)grouped.get(relation.track_id).push(name);
  }
  const safeCell=value=>{
    let text=String(value??'');
    // Impede que valores de título, artista e categoria sejam executados como fórmula no Excel.
    if(/^[\s\uFEFF]*[=+\-@]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  const columns=['Música','Artista','Ano','Categorias','Arquivo MP3 (Storage)','ID'];
  const lines=[columns.map(safeCell).join(';')];
  for(const track of tracks.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR')||a.artist.localeCompare(b.artist,'pt-BR'))){
    const categoryText=[...new Set(grouped.get(track.id)||[])].sort((a,b)=>a.localeCompare(b,'pt-BR')).join(' | ');
    lines.push([track.title,track.artist,track.release_year,categoryText,track.file_path,track.id].map(safeCell).join(';'));
  }
  const blob=new Blob(['\uFEFF',lines.join('\r\n'),'\r\n'],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`beatline-musicas-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  toast(`${tracks.length} música(s) exportada(s) em CSV.`);
}

function editingTrack(id){state.adminEditing=id;state.activeForm=true;state.adminTab='musicas';render();root.querySelector('#trackForm')?.scrollIntoView({block:'nearest'});}
function editingCategory(id){state.adminEditing=id;state.activeForm=true;state.adminTab='categorias';render();}
async function saveTrackForm(form){const fd=new FormData(form);const ids=fd.getAll('category_id').map(String);if(!ids.length)throw new Error('Selecione ao menos uma categoria.');const editing=state.adminEditing!=='new'?state.tracks.find(t=>t.id===state.adminEditing):null;const file=fd.get('mp3');const hasFile=file instanceof File && file.size>0;if(!editing&&!hasFile)throw new Error('Selecione um arquivo MP3.');if(hasFile&&!(file.name.toLowerCase().endsWith('.mp3')||file.type==='audio/mpeg'))throw new Error('Somente arquivos MP3 são permitidos.');const payload={title:String(fd.get('title')).trim(),artist:String(fd.get('artist')||'').trim(),release_year:Number(fd.get('release_year'))};if(payload.release_year<1900||payload.release_year>2100)throw new Error('Ano inválido.');await saveTrack(state.connection,{payload,file:hasFile?file:null,ids,previous:editing});await reloadCatalog();state.adminEditing=null;state.activeForm=false;state.adminTab='musicas';render();toast(editing?'Música atualizada.':'MP3 enviado e música cadastrada.');}
async function saveCategoryForm(form){const fd=new FormData(form);const editing=state.adminEditing!=='new'?state.categories.find(c=>c.id===state.adminEditing):null;await saveCategory(state.connection,{name:String(fd.get('name')).trim().toUpperCase(),color:String(fd.get('color'))},editing);await reloadCatalog();state.adminEditing=null;state.activeForm=false;state.adminTab='categorias';render();toast(editing?'Categoria atualizada.':'Categoria criada.');}
function handleAction(el){const act=el.dataset.action,id=el.dataset.id;
if(act==='admin-logout'){window.BeatlineAuth?.signOut().catch(()=>{});state.authStatus='login';state.adminEmail='';state.authError='';state.activeForm=false;state.adminEditing=null;state.bulk.rows=[];render();return;}
if(document.body.dataset.startPage==='admin'&&state.authStatus!=='authorized'&&act!=='nav-home')return;
if(act?.startsWith('bulk-')){handleBulkAction(el);return;}if(act==='nav-home'){if(state.page==='game'){state.modal='exit';render();}else if(document.body.dataset.startPage==='admin') window.location.href='index.html';else navigate('home');}
else if(act==='nav-config'){if(document.body.dataset.startPage==='admin')window.location.href='index.html#config';else navigate('config');}
else if(act==='dec-count'||act==='inc-count'){state.config.count=Math.max(1,Math.min(30,state.config.count+(act==='inc-count'?1:-1)));render();}
else if(act==='dec-lives'||act==='inc-lives'){if(!state.config.infiniteLives)state.config.lives=Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,state.config.lives+(act==='inc-lives'?1:-1)));render();}
else if(act==='toggle-infinite-lives'){state.config.infiniteLives=!state.config.infiniteLives;render();}
else if(act==='toggle-infinite-songs'){state.config.infiniteSongs=!state.config.infiniteSongs;render();}
else if(act==='select-all'){state.config.categories=[];state.config.excludedCategories=[];render();}
else if(act==='filter-mode'){state.config.filterMode=el.dataset.mode==='exclude'?'exclude':'include';render();}
else if(act==='select-category'){
  const mode=state.config.filterMode;
  const key=mode==='exclude'?'excludedCategories':'categories';
  const opposite=mode==='exclude'?'categories':'excludedCategories';
  state.config[key]=state.config[key].includes(id)?state.config[key].filter(x=>x!==id):[...state.config[key],id];
  state.config[opposite]=state.config[opposite].filter(x=>x!==id);
  render();
}
else if(act==='start-game'||act==='retry')startGame();
else if(act==='slot'){state.selectedSlot=Number(el.dataset.slot);render();}
else if(act==='play')togglePlay();
else if(act==='restart-audio')restartAudio();
else if(act==='confirm')confirmSlot();
else if(act==='next-round')nextRound();
else if(act==='request-home'){state.modal='exit';render();}
else if(act==='show-wrong'){toast(state.wrong.map(s=>`${s.title} · ${s.release_year}`).join('\n'));}
else if(act==='cancel-modal'){state.modal='';render();}
else if(act==='approve-modal'){if(state.modal==='exit'){stopAudio();state.queue=[];state.modal='';state.page='home';render();return;}if(state.modal.startsWith('delete-track:')){const trackId=state.modal.split(':')[1];state.modal='';withLoading(async()=>{await deleteTrack(state.connection,state.tracks.find(t=>t.id===trackId));await reloadCatalog();toast('Música excluída.');});}else if(state.modal.startsWith('delete-category:')){const categoryId=state.modal.split(':')[1];state.modal='';withLoading(async()=>{await deleteCategory(state.connection,categoryId);await reloadCatalog();toast('Categoria excluída.');});}else if(state.modal.startsWith('bulk-delete-track:')){const trackId=state.modal.split(':')[1];state.modal='';deleteBulkTrack(trackId);}}
else if(act==='admin-tab')setAdminTab(el.dataset.tab);
else if(act==='clear-admin-search'){state.adminSearch='';render();}
else if(act==='cancel-form'){state.activeForm=false;state.adminEditing=null;render();}
else if(act==='export-csv')withLoading(downloadMusicCSV);
else if(act==='new-track')editingTrack('new');
else if(act==='edit-track')editingTrack(id);
else if(act==='delete-track'){state.modal=`delete-track:${id}`;render();}
else if(act==='new-category')editingCategory('new');
else if(act==='edit-category')editingCategory(id);
else if(act==='delete-category'){state.modal=`delete-category:${id}`;render();}
else if(act==='show-cat-tracks'){state.adminTab='musicas';state.adminFilter=id;state.activeForm=false;render();}
else if(act==='retry-catalog'){withLoading(()=>reloadCatalog());}}
async function withLoading(fn){state.loading=true;render();try{await fn();}catch(err){toast(err.message||'Erro inesperado.');}finally{state.loading=false;render();}}
root.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(btn&&!btn.disabled)handleAction(btn);});
root.addEventListener('change',e=>{if(document.body.dataset.startPage==='admin'&&state.authStatus!=='authorized')return;if(e.target.id==='adminFilter'){state.adminFilter=e.target.value;render();}else if(e.target.id==='lifeCount'){const value=Number(e.target.value);if(e.target.value.trim()!==''&&Number.isSafeInteger(value)&&value>=0){state.config.lives=value;}else{toast('Informe um número inteiro de vidas igual ou maior que zero.');}render();}else if(e.target.id==='bulkFileInput'||e.target.id==='bulkFolderInput'){addBulkFiles(Array.from(e.target.files||[]));e.target.value='';}});
root.addEventListener('input',e=>{if(e.target.id==='audioSeek')seekAudio(e.target.value);else if(e.target.id==='adminSearch'){state.adminSearch=e.target.value;render();}else if(e.target.matches('[data-bulk-field]'))editBulkField(e.target);});
root.addEventListener('dragover',e=>{if(document.body.dataset.startPage==='admin'&&state.authStatus!=='authorized')return;if(e.target.closest('.bulk-dropzone')){e.preventDefault();e.dataTransfer.dropEffect='copy';e.target.closest('.bulk-dropzone').classList.add('is-over');}});
root.addEventListener('dragleave',e=>{if(e.target.closest('.bulk-dropzone')&&!e.relatedTarget?.closest?.('.bulk-dropzone'))e.target.closest('.bulk-dropzone').classList.remove('is-over');});
root.addEventListener('drop',e=>{if(document.body.dataset.startPage==='admin'&&state.authStatus!=='authorized')return;const zone=e.target.closest('.bulk-dropzone');if(zone){e.preventDefault();zone.classList.remove('is-over');addBulkFiles(Array.from(e.dataTransfer.files||[]));}});
root.addEventListener('submit',e=>{e.preventDefault();const form=e.target;if(form.id==='adminLoginForm'){loginAdministrator(form);return;}if(document.body.dataset.startPage==='admin'&&state.authStatus!=='authorized')return;if(form.id==='trackForm')withLoading(()=>saveTrackForm(form));else if(form.id==='categoryForm')withLoading(()=>saveCategoryForm(form));});
// A roda do mouse (deltaY) e o gesto vertical de dois dedos no touchpad
// movem a linha do tempo na horizontal. Gestos horizontais já são nativos.
root.addEventListener('wheel',e=>{
  const scroller=e.target.closest('.timeline-scroller');
  if(!scroller||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
  const maxScroll=Math.max(0,scroller.scrollWidth-scroller.clientWidth);
  if(maxScroll===0)return;
  const unit=e.deltaMode===1?16:e.deltaMode===2?scroller.clientWidth:1;
  const amount=e.deltaY*unit;
  const next=Math.max(0,Math.min(maxScroll,scroller.scrollLeft+amount));
  if(next!==scroller.scrollLeft){e.preventDefault();scroller.scrollLeft=next;}
},{passive:false});
// Arraste por mouse, toque ou caneta. O cartão rosa já posicionado continua movível
// até CONFIRMAR. Soltar sobre uma carta existente escolhe o lado mais próximo.
let pointerDrag=null;
function targetSlot(x,y){
  const target=document.elementFromPoint(x,y);
  if(!target)return null;
  const slot=target.closest('.slot');
  if(slot)return Number(slot.dataset.slot);
  const card=target.closest('.timeline-card');
  if(card){
    const rect=card.getBoundingClientRect();
    const before=Number(card.dataset.before);
    return x<rect.left+rect.width/2?before:before+1;
  }
  return null;
}
function highlightSlot(slot){
  root.querySelectorAll('.slot.dragover').forEach(element=>element.classList.remove('dragover'));
  if(slot!==null)root.querySelector(`.slot[data-slot="${slot}"]`)?.classList.add('dragover');
}
root.addEventListener('pointerdown',e=>{
  if(e.button!==0||state.page!=='game'||state.reveal)return;
  const el=e.target.closest('#grabSong, .slot.selected');
  if(!el)return;
  pointerDrag={id:e.pointerId,startX:e.clientX,startY:e.clientY,ghost:null,fromTimeline:el.classList.contains('selected'),scrollStart:root.querySelector('.timeline-scroller')?.scrollLeft ?? 0};
  el.setPointerCapture?.(e.pointerId);
});
root.addEventListener('pointermove',e=>{
  if(!pointerDrag||pointerDrag.id!==e.pointerId)return;
  const drag=pointerDrag;
  if(!drag.ghost){
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<9)return;
    drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';
    drag.ghost.textContent=currentSong()?.title||'FAIXA';
    document.body.appendChild(drag.ghost);
  }
  e.preventDefault();
  drag.ghost.style.left=`${e.clientX}px`;drag.ghost.style.top=`${e.clientY}px`;
  const scroller=root.querySelector('.timeline-scroller');
  if(scroller && !drag.fromTimeline){
    const rect=scroller.getBoundingClientRect();
    if(e.clientY>=rect.top&&e.clientY<=rect.bottom){
      if(e.clientX>rect.right-36)scroller.scrollLeft+=17;
      else if(e.clientX<rect.left+36)scroller.scrollLeft-=17;
    }
  }
  highlightSlot(targetSlot(e.clientX,e.clientY));
});
function finishPointer(e){
  if(!pointerDrag||pointerDrag.id!==e.pointerId)return;
  const drag=pointerDrag;
  const dragged=Boolean(drag.ghost);
  const slot=e.type==='pointercancel'?null:targetSlot(e.clientX,e.clientY);
  drag.ghost?.remove();pointerDrag=null;
  highlightSlot(null);
  if(dragged&&slot!==null){
    const scroller=root.querySelector('.timeline-scroller');
    const keepScroll=drag.fromTimeline ? drag.scrollStart : scroller?.scrollLeft;
    state.selectedSlot=slot;
    render();
    const updated=root.querySelector('.timeline-scroller');
    if(updated && keepScroll!=null){updated.scrollLeft=keepScroll;requestAnimationFrame(()=>{if(updated.isConnected)updated.scrollLeft=keepScroll;});}
  }
}
root.addEventListener('pointerup',finishPointer);
root.addEventListener('pointercancel',finishPointer);
root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.id==='grabSong'){e.preventDefault();toast('Toque em um dos espaços (+) da linha do tempo para selecionar a posição.');}});
render();
if(document.body.dataset.startPage==='admin'){
  // Somente o painel exige login; as partidas seguem abertas ao público.
  window.BeatlineAuth.restoreAdministrator().then(allowed=>{
    state.authStatus=allowed?'authorized':'login';
    render();
  }).catch(()=>{state.authStatus='login';render();});
}
if(location.hash==='#config'&&document.body.dataset.startPage!=='admin')navigate('config');
reloadCatalog().catch(()=>toast('Não foi possível carregar o catálogo. Tente novamente mais tarde.'));
