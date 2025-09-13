;(function(){
  const KEY = 'meowmap-theme';
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const DEFAULT = prefersDark ? 'amoled' : 'modern';
  const THEMES = ['minimal','modern','neon','paper','amoled','a11y'];

  function setTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    try{ localStorage.setItem(KEY, t); }catch(e){ /* ignore */ }
  }
  function getTheme(){
    try{ return localStorage.getItem(KEY) || DEFAULT; }catch(e){ return DEFAULT; }
  }
  function nextTheme(t){
    const i = THEMES.indexOf(t);
    return THEMES[(i+1) % THEMES.length];
  }

  const current = getTheme();
  setTheme(current);

  const btn = document.getElementById('themeToggle') || document.getElementById('logo');
  if(btn){
    btn.addEventListener('click', ()=> setTheme(nextTheme(getTheme())));
  }
  // Hotkey — T
  window.addEventListener('keydown', (e)=>{
    if(e.key && e.key.toLowerCase()==='t' && !e.metaKey && !e.ctrlKey && !e.altKey){
      setTheme(nextTheme(getTheme()));
    }
  });
})();


