(function(){
  'use strict';

  /*
   * Adaptador aislado para Open Food Facts.
   *
   * La búsqueda por texto se hace contra el endpoint legacy de búsqueda de
   * Open Food Facts, porque /api/v2/search no admite texto libre.
   * Se usa el endpoint legacy /cgi/search.pl, que sigue siendo el endpoint
   * documentado para búsquedas de texto. Los datos relevantes para la comida
   * se solicitan en la misma respuesta para evitar una segunda consulta lenta.
   */
  const CFG={
    enabled:true,
    searchUrl:'https://world.openfoodfacts.org/cgi/search.pl',
    smartSearchUrl:'https://search.openfoodfacts.org/search',
    productBaseUrl:'https://world.openfoodfacts.org/api/v2/product',
    cachePrefix:'agendaFoodOFF:',
    cacheTtlMs:24*60*60*1000,
    pageSize:10,
    requestTimeoutMs:8000
  };

  function text(v){return String(v??'').trim()}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function firstNonEmpty(...values){for(const value of values){const s=text(value);if(s)return s}return ''}

  function energyKcal(product){
    const n=product?.nutriments||{};
    if(Number.isFinite(Number(n['energy-kcal_100g'])))return num(n['energy-kcal_100g']);
    if(Number.isFinite(Number(n['energy-kcal'])))return num(n['energy-kcal']);
    if(Number.isFinite(Number(n['energy_100g'])))return num(n['energy_100g'])/4.184;
    if(Number.isFinite(Number(n['energy-kj_100g'])))return num(n['energy-kj_100g'])/4.184;
    return 0;
  }

  function normalizeProduct(product){
    if(!product||typeof product!=='object')return null;
    const declaredServing=num(product.serving_quantity);
    const name=firstNonEmpty(product.product_name_es,product.product_name,product.abbreviated_product_name_es,product.abbreviated_product_name,product.generic_name_es,product.generic_name);
    const code=firstNonEmpty(product.code,product._id,product.id,product.gtin,product.barcode);
    if(!name&&!code)return null;

    const ingredients=firstNonEmpty(product.ingredients_text_es,product.ingredients_text);
    const categories=Array.isArray(product.categories_tags_es)?product.categories_tags_es.join(', '):firstNonEmpty(product.categories);
    const labels=Array.isArray(product.labels_tags_es)?product.labels_tags_es.join(', '):firstNonEmpty(product.labels);
    const countries=Array.isArray(product.countries_tags_es)?product.countries_tags_es.join(', '):firstNonEmpty(product.countries);

    return {
      id:code,
      code:code,
      name:name||'Alimento',
      brand:firstNonEmpty(product.brands,product.brand),
      quantity:firstNonEmpty(product.quantity),
      servingSize:firstNonEmpty(product.serving_size),
      quantityBase:100,
      servingQuantity:declaredServing>0?declaredServing:null,
      unit:'g',
      calories:energyKcal(product),
      protein:num(product.nutriments?.proteins_100g),
      carbs:num(product.nutriments?.carbohydrates_100g),
      fat:num(product.nutriments?.fat_100g),
      ingredients,
      categories,
      labels,
      countries,
      nutriScore:firstNonEmpty(product.nutriscore_grade,product.nutrition_grades),
      novaGroup:num(product.nova_group)||null,
      imageUrl:firstNonEmpty(product.image_front_url,product.image_url),
      source:'Open Food Facts'
    };
  }

  function cacheKey(q){return CFG.cachePrefix+encodeURIComponent(text(q).toLowerCase())}
  function cacheRead(q){
    try{
      const raw=localStorage.getItem(cacheKey(q));
      if(!raw)return null;
      const item=JSON.parse(raw);
      if(!item||Date.now()-num(item.savedAt)>CFG.cacheTtlMs)return null;
      return Array.isArray(item.results)?item.results:null;
    }catch{return null}
  }
  function cacheWrite(q,results){
    try{localStorage.setItem(cacheKey(q),JSON.stringify({savedAt:Date.now(),results}))}catch{}
  }

  async function fetchJson(url,options={}){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),CFG.requestTimeoutMs);
    try{
      const res=await fetch(url,{...options,signal:controller.signal,mode:'cors',cache:'no-store',headers:{Accept:'application/json',...(options.headers||{})}});
      if(!res.ok)throw new Error('HTTP '+res.status);
      return await res.json();
    }finally{clearTimeout(timeout)}
  }

  function normalizedName(v){
    return text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }

  function resultScore(item,query){
    const q=normalizedName(query);
    const name=normalizedName(item?.product_name_es||item?.product_name||item?.name||'');
    if(!q||!name)return 0;
    if(name===q)return 1000;
    if(name.startsWith(q+' '))return 900;
    if(name.includes(' '+q+' '))return 800;
    if(name.includes(q))return 700;
    const words=q.split(' ').filter(Boolean);
    const hits=words.filter(w=>name.includes(w)).length;
    return hits?500+(hits/words.length)*100:0;
  }

  function sortRelevant(products,query){
    return [...products].sort((a,b)=>resultScore(b,query)-resultScore(a,query));
  }

  async function searchSmart(q,exact=true){
    const url=new URL(CFG.smartSearchUrl);
    const clean=text(q).replace(/\"/g,'');
    url.searchParams.set('q',exact?`\"${clean}\"`:clean);
    url.searchParams.set('page','1');
    url.searchParams.set('page_size',String(Math.max(CFG.pageSize,15)));
    url.searchParams.set('langs','es,en');
    const data=await fetchJson(url.toString());
    const hits=Array.isArray(data?.hits)?data.hits:[];
    return hits.map(hit=>hit?.result||hit?._source||hit).filter(Boolean);
  }

  async function searchLegacy(q){
    const url=new URL(CFG.searchUrl);
    url.searchParams.set('action','process');
    url.searchParams.set('search_terms',q);
    url.searchParams.set('search_simple','1');
    url.searchParams.set('json','1');
    url.searchParams.set('page_size',String(CFG.pageSize));
    url.searchParams.set('page','1');
    url.searchParams.set('lc','es');
    url.searchParams.set('fields','code,product_name,product_name_es,abbreviated_product_name,abbreviated_product_name_es,generic_name,generic_name_es,brands,quantity,serving_size,serving_quantity,nutriments,ingredients_text,ingredients_text_es,categories,categories_tags_es,labels,labels_tags_es,countries,countries_tags_es,nutriscore_grade,nutrition_grades,nova_group,image_front_url,image_url');
    const data=await fetchJson(url.toString());
    return Array.isArray(data?.products)?data.products:[];
  }

  async function getProductDetails(code){
    const barcode=text(code); if(!barcode)return null;
    const url=new URL(`${CFG.productBaseUrl}/${encodeURIComponent(barcode)}`);
    url.searchParams.set('fields','code,product_name,product_name_es,abbreviated_product_name,abbreviated_product_name_es,generic_name,generic_name_es,brands,quantity,serving_size,serving_quantity,nutriments,ingredients_text,ingredients_text_es,categories,categories_tags_es,labels,labels_tags_es,countries,countries_tags_es,nutriscore_grade,nutrition_grades,nova_group,image_front_url,image_url');
    try{
      const data=await fetchJson(url.toString());
      return Number(data?.status)===1&&data?.product?normalizeProduct(data.product):null;
    }catch(err){
      console.warn('Open Food Facts: no se pudieron ampliar los datos del producto',err);
      return null;
    }
  }

  async function search(query){
    const q=text(query);
    if(!CFG.enabled||!q)return [];

    const cached=cacheRead(q);
    if(cached)return cached;

    let products=[];
    try{
      products=await searchSmart(q,true);
      if(!products.length)products=await searchSmart(q,false);
    }catch(err){
      console.warn('Open Food Facts: búsqueda inteligente no disponible, usando búsqueda clásica',err);
      products=await searchLegacy(q);
    }
    if(!products.length){
      products=await searchLegacy(q);
    }

    let results=products.map(normalizeProduct).filter(Boolean);
    results=sortRelevant(results,q).slice(0,CFG.pageSize);
    cacheWrite(q,results);
    return results;
  }

  window.AgendaFoodCatalogConfig=CFG;
  window.AgendaFoodCatalogOFF={normalize:normalizeProduct,search,getProductDetails};

  /*
   * El catálogo 47 puede estar esperando DOMContentLoaded cuando este archivo 48
   * se ejecuta. Por eso instalamos el adaptador inmediatamente y dejamos que 47
   * conserve estas funciones cuando termine de inicializar su UI.
   */
  const catalog=window.AgendaFoodCatalog||{};
  catalog.search=search;
  catalog.getProductDetails=getProductDetails;
  catalog.openFoodFactsReady=true;
  window.AgendaFoodCatalog=catalog;
})();
