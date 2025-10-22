;(function(){
  const KEY = 'meowmap-theme';
  const DEFAULT = 'minimal';
  const THEMES = ['minimal','neon','test','test2'];

  function setTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    try{ localStorage.setItem(KEY, t); }catch(e){ /* ignore */ }
    const logo = document.getElementById('logo');
    if(logo){
      logo.src = (t === 'neon' || t === 'test2') ? 'assets/logo1.png' : 'assets/Vector.png';
    }
  }
  function getTheme(){
    try{ return localStorage.getItem(KEY) || DEFAULT; }catch(e){ return DEFAULT; }
  }
  function nextTheme(t){
    const i = THEMES.indexOf(t);
    return THEMES[(i+1) % THEMES.length];
  }

  setTheme(getTheme());

  const btn = document.getElementById('themeToggle') || document.getElementById('logo');
  if(btn){
    btn.addEventListener('click', ()=> setTheme(nextTheme(getTheme())));
  }

})();
