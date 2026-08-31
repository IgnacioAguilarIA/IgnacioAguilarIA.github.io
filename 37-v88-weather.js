/* Agenda FICH · V87 · Weather module
 * Isolated from calendar core: only owns the forecast card and its local cache.
 */
(function(){
  'use strict';
  const CFG={
    defaultCoords:{lat:-31.7413,lon:-60.5115,label:'Paraná, Entre Ríos'},
    cacheKey:'agendaWeatherV88',
    coordsKey:'agendaWeatherCoordsV88',
    ttlMs:30*60*1000,
    api:'https://api.open-meteo.com/v1/forecast'
  };
  const $=id=>document.getElementById(id);
  let lastForecast=null;
  let loading=false;

  function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
  function getCoords(){
    try{const x=JSON.parse(localStorage.getItem(CFG.coordsKey)||'null');if(Number.isFinite(x?.lat)&&Number.isFinite(x?.lon))return x}catch(_){ }
    return CFG.defaultCoords;
  }
  function saveCoords(c){try{localStorage.setItem(CFG.coordsKey,JSON.stringify(c))}catch(_){} }
  function getCache(){
    try{const x=JSON.parse(localStorage.getItem(CFG.cacheKey)||'null');if(x?.data)return x}catch(_){}
    return null;
  }
  function saveCache(obj){try{localStorage.setItem(CFG.cacheKey,JSON.stringify(obj))}catch(_){} }
  function fmtDay(iso){
    try{return new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(iso+'T12:00:00')).replace('.','').replace(/^./,c=>c.toUpperCase())}
    catch(_){return iso}
  }
  function weatherMeta(code){
    const c=Number(code);
    if(c===0)return ['☀️','Despejado'];
    if([1,2].includes(c))return ['🌤️','Parcialmente nublado'];
    if(c===3)return ['☁️','Nublado'];
    if([45,48].includes(c))return ['🌫️','Niebla'];
    if([51,53,55].includes(c))return ['🌦️','Llovizna'];
    if([56,57].includes(c))return ['🌧️','Llovizna helada'];
    if([61,63,65].includes(c))return ['🌧️','Lluvia'];
    if([66,67].includes(c))return ['🌧️','Lluvia helada'];
    if([71,73,75,77].includes(c))return ['🌨️','Nieve'];
    if([80,81,82].includes(c))return ['🌧️','Chubascos'];
    if([85,86].includes(c))return ['🌨️','Chubascos de nieve'];
    if([95,96,99].includes(c))return ['⛈️','Tormenta'];
    return ['🌦️','Condiciones variables'];
  }
  function agendaWeatherNotice(data){
    const d=data?.daily;if(!d?.time?.length)return;
    const dash=$('dashboard');if(!dash||!currentUser)return;
    let box=$('v88WeatherAgendaAlert');
    if(!box){
      box=document.createElement('section');box.id='v88WeatherAgendaAlert';box.className='v88-weather-alert';
      dash.insertBefore(box,dash.firstElementChild||null);
    }
    const rain=Number(d.precipitation_probability_max?.[0])||0;
    const sum=Number(d.precipitation_sum?.[0])||0;
    const [icon,label]=weatherMeta(d.weather_code?.[0]);
    const tmax=Number(d.temperature_2m_max?.[0]);const tmin=Number(d.temperature_2m_min?.[0]);
    let tone='normal',title='Condiciones de hoy',note=`${label} · ${Number.isFinite(tmin)?Math.round(tmin):'—'}° a ${Number.isFinite(tmax)?Math.round(tmax):'—'}°.`;
    if(rain>=70||sum>=5){tone='warn';title='🌧️ Atención con el clima de hoy';note=`Hay ${rain}% de probabilidad de precipitación${sum>0?` y hasta ${sum.toFixed(1)} mm estimados`:''}. Revisá las actividades que dependan del clima.`}
    else if(rain>=40||sum>0){tone='caution';title='🌦️ Posible lluvia hoy';note=`Hay ${rain}% de probabilidad de precipitación${sum>0?` · ${sum.toFixed(1)} mm estimados`:''}. Conviene tener una alternativa para actividades al aire libre.`}
    box.className=`v88-weather-alert ${tone}`;box.innerHTML=`<div class="v88-weather-alert-icon">${icon}</div><div class="v88-weather-alert-main"><strong>${esc(title)}</strong><span>📍 Paraná, Entre Ríos · ${esc(note)}</span></div><button type="button" class="v88-weather-alert-btn" id="v88WeatherGoCalendar">Ver pronóstico</button>`;
    $('v88WeatherGoCalendar')?.addEventListener('click',()=>{try{v32SetSection?.('calendar')}catch{};setTimeout(()=>$('calendarPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),120)},{once:true});
  }
  function setStatus(text){const el=$('v87WeatherStatus');if(el)el.textContent=text}
  function render(data,fromCache=false){
    const grid=$('v87WeatherGrid');if(!grid)return;
    const d=data?.daily;if(!d?.time?.length){grid.innerHTML='<div class="v87-weather-empty">No hay pronóstico disponible para esta ubicación.</div>';return;}
    lastForecast=data;
    const n=Math.min(7,d.time.length);
    grid.innerHTML='';
    for(let i=0;i<n;i++){
      const [icon,label]=weatherMeta(d.weather_code?.[i]);
      const rain=Math.round(Number(d.precipitation_probability_max?.[i])||0);
      const sum=Number(d.precipitation_sum?.[i])||0;
      const tmin=Math.round(Number(d.temperature_2m_min?.[i]));
      const tmax=Math.round(Number(d.temperature_2m_max?.[i]));
      const card=document.createElement('div');
      card.className='v87-weather-day'+(i===0?' today':'');
      card.innerHTML=`<div class="v87-weather-dayname">${esc(fmtDay(d.time[i]))}</div><div class="v87-weather-icon">${icon}</div><div class="v87-weather-label">${esc(label)}</div><div class="v87-weather-temp"><strong>${Number.isFinite(tmax)?tmax:'—'}°</strong><span>${Number.isFinite(tmin)?tmin:'—'}°</span></div><div class="v87-weather-rain">💧 ${rain}%${sum>0?' · '+sum.toFixed(1)+' mm':''}</div>`;
      grid.appendChild(card);
    }
    setStatus((fromCache?'Último pronóstico guardado · ':'')+'Datos meteorológicos para los próximos 7 días.');
    agendaWeatherNotice(data);
  }
  async function fetchForecast(coords){
    const u=new URL(CFG.api);
    u.searchParams.set('latitude',coords.lat);
    u.searchParams.set('longitude',coords.lon);
    u.searchParams.set('daily','weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum');
    u.searchParams.set('forecast_days','7');
    u.searchParams.set('timezone','auto');
    const res=await fetch(u.toString(),{cache:'no-store'});
    if(!res.ok)throw new Error('No se pudo obtener el pronóstico.');
    return await res.json();
  }
  async function loadWeather(force=false){
    if(loading)return;
    const coords=getCoords();
    const cached=getCache();
    if(!force && cached?.savedAt && Date.now()-cached.savedAt<CFG.ttlMs){render(cached.data,true);lastForecast=cached.data;return}
    if(!navigator.onLine){if(cached?.data)render(cached.data,true);else setStatus('Sin internet: configurá tu ubicación y conectate para cargar el pronóstico.');return}
    if(!coords){setStatus('Elegí “Usar mi ubicación” para ver el pronóstico.');return}
    loading=true;const refresh=$('v87WeatherRefreshBtn');if(refresh)refresh.disabled=true;setStatus('Cargando pronóstico…');
    try{const data=await fetchForecast(coords);saveCache({savedAt:Date.now(),data});render(data,false);lastForecast=data;}
    catch(e){if(cached?.data)render(cached.data,true);setStatus(cached?.data?'No se pudo actualizar; mostrando el último pronóstico guardado.':'No se pudo cargar el pronóstico. Revisá tu conexión.');}
    finally{loading=false;if(refresh)refresh.disabled=!navigator.onLine || !getCoords();}
  }
  function requestLocation(){
    if(!navigator.geolocation){setStatus('Tu navegador no permite obtener la ubicación.');return}
    setStatus('Solicitando ubicación…');
    navigator.geolocation.getCurrentPosition(
      pos=>{saveCoords({lat:Number(pos.coords.latitude),lon:Number(pos.coords.longitude),label:'Ubicación actual'});const r=$('v87WeatherRefreshBtn');if(r)r.disabled=!navigator.onLine;loadWeather(true)},
      ()=>setStatus('No se pudo obtener la ubicación. Podés intentarlo nuevamente.'),
      {enableHighAccuracy:false,timeout:10000,maximumAge:6*60*60*1000}
    );
  }
  function updateControls(){const r=$('v87WeatherRefreshBtn');if(r)r.disabled=loading||!navigator.onLine||!getCoords()}
  function init(){
    if(!$('v87WeatherCard'))return;
    $('v87WeatherLocationBtn')?.addEventListener('click',requestLocation);
    $('v87WeatherRefreshBtn')?.addEventListener('click',()=>loadWeather(true));
    const c=getCoords();
    if(c){$('v87WeatherLocationLabel').textContent=`📍 ${c.label||'Paraná, Entre Ríos'} · ${Number(c.lat).toFixed(3)}, ${Number(c.lon).toFixed(3)}`;loadWeather(false)}
    else {const cached=getCache();if(cached?.data)render(cached.data,true);setStatus('Elegí “Usar mi ubicación” para cargar el pronóstico.')}
    if(!localStorage.getItem(CFG.coordsKey)){saveCoords(CFG.defaultCoords)}
    window.addEventListener('online',()=>{updateControls();loadWeather(true)});
    window.addEventListener('offline',()=>{updateControls();const cached=getCache();if(cached?.data)render(cached.data,true);setStatus(cached?.data?'Sin conexión · mostrando último pronóstico guardado.':'Sin conexión.')});
    if(document.visibilityState==='visible')updateControls();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
