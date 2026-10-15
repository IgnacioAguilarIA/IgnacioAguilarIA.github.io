(function(){
  'use strict';

  const $=(id)=>document.getElementById(id);
  const text=(value)=>String(value??'').trim();
  const FORMATS=['ean_13','ean_8','upc_a','upc_e'];
  let root=null, video=null, statusNode=null, input=null, lookupButton=null, cameraButton=null, stopButton=null;
  let stream=null, detector=null, frameId=0, frameKind='raf', detecting=false, lookupBusy=false, lookupToken=0;

  function normalizeCode(value){
    const raw=String(value??'').trim();
    if(!raw||/[^0-9\s-]/.test(raw))return '';
    const digits=raw.replace(/[\s-]/g,'');
    return [8,12,13,14].includes(digits.length)?digits:'';
  }

  function checksumValid(value){
    const code=normalizeCode(value);
    if(!code)return false;
    let sum=0, weight=3;
    for(let i=code.length-2;i>=0;i--){sum+=Number(code[i])*weight;weight=weight===3?1:3;}
    return ((10-(sum%10))%10)===Number(code[code.length-1]);
  }

  function missingNutrition(food){
    return Array.isArray(food?.nutritionMissing)?food.nutritionMissing.map(String).filter(Boolean):[];
  }

  function setStatus(message,state='info'){
    if(!statusNode)return;
    statusNode.textContent=message||'';
    statusNode.dataset.state=state;
  }

  function normalizeCodeFromUI(value){
    const code=normalizeCode(value);
    if(!code){
      setStatus('Ingresá un código EAN/UPC de 8, 12, 13 o 14 dígitos. También podés buscar el producto por nombre.','error');
      input?.focus();
      return '';
    }
    return code;
  }

  async function lookupCode(rawCode,origin='manual'){
    if(lookupBusy)return false;
    const code=normalizeCodeFromUI(rawCode);
    if(!code)return false;
    const token=++lookupToken;
    lookupBusy=true;
    if(lookupButton)lookupButton.disabled=true;
    if(cameraButton)cameraButton.disabled=true;
    const checkNote=checksumValid(code)?'':' El dígito verificador no coincide con el estándar habitual; revisaré el código igualmente.';
    setStatus(`Buscando el código ${code} en Open Food Facts…${checkNote}`,'loading');
    try{
      const getProduct=window.AgendaFoodCatalog?.getProductDetails||window.AgendaFoodCatalogOFF?.getProductDetails;
      if(typeof getProduct!=='function')throw new Error('El catálogo externo todavía no está disponible. Podés buscar por nombre.');
      const product=await getProduct(code);
      if(token!==lookupToken)return false;
      if(!product){
        setStatus(`No encontré un producto para ${code}, o el servicio externo no respondió. Probá buscar por nombre o cargar el alimento manualmente.`,'error');
        return false;
      }
      const normalized={...product,id:String(product.id||product.code||code),code:String(product.code||product.id||code),source:product.source||'Open Food Facts'};
      const select=window.AgendaFoodCatalog?.select;
      if(typeof select!=='function')throw new Error('El selector de alimentos todavía no está listo.');
      select(normalized);
      const missing=missingNutrition(normalized);
      const prefix=origin==='camera'?'Código escaneado. ':'Código consultado. ';
      const completeness=missing.length?` Atención: faltan datos de ${missing.join(', ')}; revisá la etiqueta antes de confirmar.`:' Revisá igualmente que la información coincida con el envase.';
      setStatus(`${prefix}Encontré «${text(normalized.name)||'producto'}» (${code}).${completeness}`,missing.length?'warning':'success');
      return true;
    }catch(error){
      if(token!==lookupToken)return false;
      console.warn('Búsqueda por código de barras:',error);
      setStatus(`No se pudo consultar el código ${code}. Revisá la conexión y probá de nuevo; la búsqueda por nombre sigue disponible.`,'error');
      return false;
    }finally{
      if(token===lookupToken){lookupBusy=false;if(lookupButton)lookupButton.disabled=false;if(cameraButton)cameraButton.disabled=false;}
    }
  }

  function stopCamera(updateMessage=false){
    if(frameId){
      if(frameKind==='raf'&&typeof window.cancelAnimationFrame==='function')window.cancelAnimationFrame(frameId);
      else window.clearTimeout(frameId);
      frameId=0;
    }
    detecting=false;
    if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
    if(video){video.pause?.();video.srcObject=null;video.hidden=true;}
    if(stopButton)stopButton.hidden=true;
    if(cameraButton)cameraButton.hidden=false;
    detector=null;
    if(updateMessage)setStatus('Cámara detenida. Podés volver a escanear o ingresar el código manualmente.','info');
  }

  function scheduleFrame(callback){
    if(typeof window.requestAnimationFrame==='function'){frameKind='raf';frameId=window.requestAnimationFrame(callback);}
    else{frameKind='timeout';frameId=window.setTimeout(callback,250);}
  }

  async function scanFrame(){
    if(!stream||!video||!detector||detecting)return;
    detecting=true;
    try{
      if(video.readyState>=2){
        const found=await detector.detect(video);
        const hit=Array.isArray(found)?found.find(item=>text(item?.rawValue)):null;
        if(hit){
          const code=text(hit.rawValue);
          stopCamera(false);
          await lookupCode(code,'camera');
          return;
        }
      }
    }catch(error){
      console.warn('No se pudo leer el código desde la cámara:',error);
      stopCamera(false);
      setStatus('No se pudo leer el código con la cámara. Probá mejorar la luz o ingresá los números manualmente.','error');
      return;
    }finally{detecting=false;}
    if(stream)scheduleFrame(scanFrame);
  }

  async function startCamera(){
    if(stream)return;
    if(typeof window.BarcodeDetector!=='function'){
      setStatus('Este navegador no ofrece lector de códigos compatible. Podés ingresar el EAN/UPC manualmente abajo.','warning');
      input?.focus();
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia){
      setStatus('La cámara no está disponible en este contexto. Abrí la app mediante HTTPS o localhost, o ingresá el código manualmente.','warning');
      input?.focus();
      return;
    }
    try{
      setStatus('Solicitando acceso a la cámara…','loading');
      let formats=FORMATS;
      if(typeof window.BarcodeDetector.getSupportedFormats==='function'){
        try{const supported=await window.BarcodeDetector.getSupportedFormats();const filtered=FORMATS.filter(format=>supported.includes(format));if(filtered.length)formats=filtered;}catch{}
      }
      try{detector=new window.BarcodeDetector({formats});}catch{detector=new window.BarcodeDetector();}
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      if(!video)throw new Error('No se encontró la vista de cámara.');
      video.srcObject=stream;video.hidden=false;
      await video.play();
      if(cameraButton)cameraButton.hidden=true;
      if(stopButton)stopButton.hidden=false;
      setStatus('Apuntá la cámara al código de barras y mantenelo dentro del encuadre.','loading');
      scheduleFrame(scanFrame);
    }catch(error){
      stopCamera(false);
      const name=String(error?.name||'');
      const message=name==='NotAllowedError'?'No se concedió permiso para usar la cámara. Podés habilitarlo en el navegador o escribir el código manualmente.':name==='NotFoundError'?'No se encontró una cámara disponible. Podés ingresar el código manualmente.':'No se pudo iniciar la cámara. Comprobá los permisos y probá el ingreso manual.';
      setStatus(message,'error');
    }
  }

  function buildUI(){
    const catalog=$('nutritionFoodCatalog');
    if(!catalog||$('nutritionBarcodeScanner'))return;
    root=document.createElement('section');
    root.id='nutritionBarcodeScanner';
    root.className='nutrition-barcode-scanner';
    root.innerHTML=`
      <div class="nutrition-barcode-head">
        <div><strong>Buscar por código de barras</strong><small>Escaneá el envase si tu navegador admite la cámara, o escribí el código.</small></div>
        <button type="button" id="nutritionBarcodeToggle" class="nutrition-barcode-toggle" aria-expanded="false" aria-controls="nutritionBarcodePanel">Escanear / ingresar código</button>
      </div>
      <div id="nutritionBarcodePanel" class="nutrition-barcode-panel" hidden>
        <form id="nutritionBarcodeForm" class="nutrition-barcode-form" novalidate>
          <label for="nutritionBarcodeInput">Código EAN / UPC</label>
          <input id="nutritionBarcodeInput" type="text" inputmode="numeric" autocomplete="off" enterkeyhint="search" maxlength="24" placeholder="Ej.: 4006381333931" aria-describedby="nutritionBarcodeHelp"/>
          <button type="submit" id="nutritionBarcodeLookup" class="nutrition-barcode-primary">Buscar código</button>
        </form>
        <small id="nutritionBarcodeHelp" class="nutrition-barcode-help">Se consultará Open Food Facts. Antes de guardar el producto, revisá los nutrientes y la porción con la etiqueta del envase.</small>
        <div class="nutrition-barcode-camera-actions"><button type="button" id="nutritionBarcodeStartCamera" class="nutrition-barcode-secondary">Usar cámara</button><button type="button" id="nutritionBarcodeStopCamera" class="nutrition-barcode-secondary" hidden>Detener cámara</button></div>
        <video id="nutritionBarcodeVideo" class="nutrition-barcode-video" playsinline muted hidden aria-label="Vista de la cámara para leer el código de barras"></video>
        <p id="nutritionBarcodeStatus" class="nutrition-barcode-status" role="status" aria-live="polite"></p>
      </div>`;
    const anchor=catalog.querySelector('.nutrition-food-catalog-head')||catalog.firstElementChild;
    if(anchor)catalog.insertBefore(root,anchor);else catalog.appendChild(root);
    video=$('nutritionBarcodeVideo');statusNode=$('nutritionBarcodeStatus');input=$('nutritionBarcodeInput');lookupButton=$('nutritionBarcodeLookup');cameraButton=$('nutritionBarcodeStartCamera');stopButton=$('nutritionBarcodeStopCamera');

    const toggle=$('nutritionBarcodeToggle'),panel=$('nutritionBarcodePanel'),form=$('nutritionBarcodeForm');
    toggle?.addEventListener('click',()=>{
      const opening=panel.hidden;
      panel.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));
      if(opening){setStatus('Escribí los dígitos o usá la cámara si está disponible.','info');input?.focus();}
      else stopCamera(true);
    });
    form?.addEventListener('submit',event=>{event.preventDefault();if(!lookupBusy)lookupCode(input?.value,'manual');});
    cameraButton?.addEventListener('click',startCamera);
    stopButton?.addEventListener('click',()=>stopCamera(true));
    $('nutritionFoodCatalogToggle')?.addEventListener('click',()=>window.setTimeout(()=>{if($('nutritionFoodCatalog')?.hidden)stopCamera(false);},0));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel&&!panel.hidden){stopCamera(false);panel.hidden=true;toggle?.setAttribute('aria-expanded','false');toggle?.focus();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&stream){stopCamera(false);setStatus('La cámara se detuvo porque la página pasó a segundo plano. Podés volver a iniciarla o ingresar el código manualmente.','info');}});
    window.addEventListener?.('beforeunload',()=>stopCamera(false));
  }

  window.AgendaNutritionBarcode={normalizeCode,checksumValid,missingNutrition,lookupCode,stopCamera};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildUI,{once:true});else buildUI();
})();
