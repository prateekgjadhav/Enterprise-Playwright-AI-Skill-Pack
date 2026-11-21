(function(){
  document.querySelectorAll('article table').forEach(function(t){
    var w=document.createElement('div'); w.className='table-wrap'; t.parentNode.insertBefore(w,t); w.appendChild(t);
  });
  var toc=document.getElementById('toc'), btn=document.getElementById('menuBtn');
  btn.addEventListener('click',function(){ var o=toc.classList.toggle('open'); btn.setAttribute('aria-expanded',o); });
  toc.addEventListener('click',function(e){ if(e.target.tagName==='A'){ toc.classList.remove('open'); btn.setAttribute('aria-expanded','false'); } });
  var links={}; toc.querySelectorAll('a').forEach(function(a){ links[a.getAttribute('href').slice(1)]=a; });
  var heads=[].slice.call(document.querySelectorAll('article h1[id], article h2[id]'));
  var ticking=false;
  function markActive(){
    ticking=false; var line=window.innerHeight*0.25, cur=heads[0];
    for(var i=0;i<heads.length;i++){ if(heads[i].getBoundingClientRect().top<=line){ cur=heads[i]; } else { break; } }
    Object.keys(links).forEach(function(k){ links[k].classList.remove('active'); });
    if(cur && links[cur.id]){ links[cur.id].classList.add('active'); }
  }
  window.addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(markActive); } },{passive:true});
  markActive();
  var tb=document.getElementById('themeBtn'), root=document.documentElement, modes=['auto','light','dark'];
  function apply(m){ if(m==='auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme',m); tb.textContent='Theme: '+m; }
  var saved='auto'; try{ saved=localStorage.getItem('aqp-guide-theme')||'auto'; }catch(e){}
  apply(saved);
  tb.addEventListener('click',function(){ var m=modes[(modes.indexOf(tb.textContent.replace('Theme: ',''))+1)%3]; apply(m); try{ localStorage.setItem('aqp-guide-theme',m); }catch(e){} });

  // Skill browser
  var data=JSON.parse(document.getElementById('files-data').textContent);
  var picker=document.getElementById('picker'), code=document.querySelector('#fileText code'), pathEl=document.getElementById('filePath');
  var pre=document.getElementById('fileText'), st=document.getElementById('copyStatus'), current=null, buttons=[], byTitle={};
  data.groups.forEach(function(g){
    var h=document.createElement('p'); h.className='group'; h.textContent=g.label; picker.appendChild(h);
    g.files.forEach(function(f){
      var b=document.createElement('button'); b.type='button'; b.className='pick'; b.textContent=f.title;
      b.addEventListener('click',function(){ show(f,b); }); picker.appendChild(b);
      var item={b:b,f:f}; buttons.push(item); byTitle[f.title]=item;
    });
  });
  function show(f,b){
    current=f; code.textContent=f.content; pathEl.textContent=f.path; st.textContent='';
    buttons.forEach(function(x){ if(x.b===b){ x.b.setAttribute('aria-current','true'); } else { x.b.removeAttribute('aria-current'); } });
    pre.scrollTop=0;
  }
  if(buttons.length) show(buttons[0].f,buttons[0].b);

  // Skill names in the tables open that skill's file
  var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function openFile(title){
    var item=byTitle[title]; if(!item) return false;
    show(item.f,item.b);
    picker.scrollTop=Math.max(0,item.b.offsetTop-48);
    document.getElementById('files').scrollIntoView({behavior:reduce?'auto':'smooth', block:'start'});
    pre.focus({preventScroll:true});
    return true;
  }
  document.querySelectorAll('article td code').forEach(function(c){
    var t=c.textContent; if(!byTitle[t] || c.closest('a')) return;
    var a=document.createElement('a'); a.href='#files'; a.className='sk'; a.setAttribute('data-file',t);
    c.parentNode.insertBefore(a,c); a.appendChild(c);
  });
  document.addEventListener('click',function(e){
    var a=e.target.closest ? e.target.closest('a[data-file]') : null; if(!a) return;
    if(openFile(a.getAttribute('data-file'))) e.preventDefault();
  });

  function selectAll(){ var r=document.createRange(); r.selectNodeContents(code); var s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  document.getElementById('copyBtn').addEventListener('click',function(){
    if(!current) return;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(current.content).then(function(){ st.textContent='Copied '+current.path+'.'; },
        function(){ selectAll(); st.textContent='Text selected. Press Ctrl+C (or ⌘C) to copy.'; });
    } else { selectAll(); st.textContent='Text selected. Press Ctrl+C (or ⌘C) to copy.'; }
  });
})();
(function(){
  document.querySelectorAll('.prompt-copy').forEach(function(b){
    b.addEventListener('click',function(){
      var pre=document.getElementById(b.getAttribute('data-target')), st=b.nextElementSibling, text=pre.textContent;
      function sel(){ var r=document.createRange(); r.selectNodeContents(pre); var s=window.getSelection(); s.removeAllRanges(); s.addRange(r); st.textContent='Text selected. Press Ctrl+C (or ⌘C) to copy.'; }
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ st.textContent='Copied.'; }, sel); } else { sel(); }
    });
  });
})();
