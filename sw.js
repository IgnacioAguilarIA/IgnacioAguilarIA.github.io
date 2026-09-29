const CACHE='agenda-fich-v98-shell-v1';
const ASSETS=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/00-inline-style-00.css",
  "./css/01-v22-top-search-style.css",
  "./css/02-v16-settings-style.css",
  "./css/03-v15-final-fixes.css",
  "./css/04-v22-search-fix.css",
  "./css/05-v21-clean-import-style.css",
  "./css/06-v22-focus-remove.css",
  "./css/07-v23-search-professional.css",
  "./css/08-v24-upgrades.css",
  "./css/09-v25-upgrades-style.css",
  "./css/10-v26-final-mobile-fix.css",
  "./css/11-v27-polish.css",
  "./css/12-v28-workout-mode-style.css",
  "./css/13-v31-persistent-training-css.css",
  "./css/14-v32-final-layout.css",
  "./css/15-final-single-floating-nav.css",
  "./css/16-v33-section-isolation.css",
  "./css/17-v44-home-only-fix.css",
  "./css/18-v48-training-actuals-style.css",
  "./css/19-v49-training-cancel-comparison.css",
  "./css/20-v54-template-style.css",
  "./css/21-v57-focus-task-style.css",
  "./css/22-v58-training-input-fix.css",
  "./css/23-v58-persistence-fix-style.css",
  "./css/24-v59-training-editor-style.css",
  "./css/25-v60-training-fixes.css",
  "./css/26-v61-training-series-fix.css",
  "./css/27-v62-productivity-style.css",
  "./css/28-v63-progress-metric-style.css",
  "./css/29-v78-training-finish-style.css",
  "./css/30-agenda-structure-guard.css",
  "./css/31-v33-upgrades-style.css",
  "./css/32-v34-upgrades-style.css",
  "./css/33-v35-upgrades-style.css",
  "./css/34-v36-enhancements-style.css",
  "./css/35-v37-advanced-style.css",
  "./css/36-v38-productivity-style.css",
  "./css/37-v39-sync-style.css",
  "./css/38-v40-smart-style.css",
  "./css/39-v41-productivity-style.css",
  "./css/40-v42-desktop-nav-enhancement.css",
  "./css/41-v44-suite-style.css",
  "./css/42-v45-productivity-style.css",
  "./css/43-v46-timeblock-style.css",
  "./css/44-v47-training-reps-style.css",
  "./css/45-v50-upgrades-style.css",
  "./css/46-v51-training-insights-style.css",
  "./css/47-v52-training-progress-style.css",
  "./css/48-v52-dashboard-style.css",
  "./css/49-v43-planner-style.css",
  "./css/50-v52-workout-enhanced-style.css",
  "./css/51-v53-home-planning-style.css",
  "./css/52-v55-upgrades-style.css",
  "./css/53-v56-focus-insights-style.css",
  "./css/54-v64-stability-hardening.css",
  "./css/55-v87-personal-suite.css",
  "./css/57-v93-training-insights.css",
  "./css/58-v94-rest-tracking.css",
  "./css/59-v96-training-final.css",
  "./css/60-agenda-final-enhancements.css",
  "./js/00-v58-persistence-fix-note.js",
  "./js/01-v59-training-editor-fix.js",
  "./js/02-v61-training-series-fix-script.js",
  "./js/03-inline-script-03.js",
  "./js/04-inline-script-04.js",
  "./js/05-v25-upgrades-script.js",
  "./js/06-v27-search-portrait-fix.js",
  "./js/07-v31-training-persistence.js",
  "./js/08-v32-section-controller.js",
  "./js/09-v32-training-guard.js",
  "./js/10-v33-upgrades-script.js",
  "./js/11-v34-upgrades-script.js",
  "./js/12-v35-upgrades-script.js",
  "./js/13-v36-enhancements-script.js",
  "./js/14-v37-advanced-script.js",
  "./js/15-v38-productivity-script.js",
  "./js/16-v39-real-sync.js",
  "./js/17-v40-smart-and-offline.js",
  "./js/18-v41-action-center.js",
  "./js/19-v42-desktop-nav-script.js",
  "./js/20-v44-suite-script.js",
  "./js/21-v45-productivity-script.js",
  "./js/22-v46-timeblock-script.js",
  "./js/23-v50-workflow-upgrades.js",
  "./js/24-v51-training-insights-script.js",
  "./js/25-v52-training-progress-script.js",
  "./js/26-v52-dashboard-script.js",
  "./js/27-v43-planner-script.js",
  "./js/28-v52-workout-enhancements-script.js",
  "./js/29-v53-planning-script.js",
  "./js/30-v54-template-script.js",
  "./js/31-v55-planning-upgrades.js",
  "./js/32-v56-focus-insights-script.js",
  "./js/33-v57-focus-task-script.js",
  "./js/34-v62-productivity-script.js",
  "./js/35-v64-stability-hardening-script.js",
  "./js/36-v87-personal-suite.js",
  "./js/38-v93-training-insights.js",
  "./js/39-v94-rest-tracking.js",
  "./js/40-v96-training-final.js",
  "./js/41-agenda-final-enhancements.js"
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(ASSETS.map(url=>cache.add(url)))) .then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('agenda-fich-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(req);
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
      return response;
    }catch(_){
      const cached=await caches.match(req);
      return cached||new Response('Sin conexión',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
