const DEVICE_DB_NAME='WorkerDeviceDB';
const DEVICE_DB_VERSION=1;
const DEVICE_STORE='deviceCredentials';

function deviceCryptoSupported(){
  return !!(window.crypto&&crypto.subtle&&window.indexedDB&&window.TextEncoder);
}

function openDeviceDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DEVICE_DB_NAME,DEVICE_DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(DEVICE_STORE))db.createObjectStore(DEVICE_STORE,{keyPath:'deviceId'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('IndexedDB unavailable'));
  });
}

async function withDeviceStore(mode,action){
  const db=await openDeviceDb();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(DEVICE_STORE,mode);
      const store=tx.objectStore(DEVICE_STORE);
      let result;
      try{result=action(store);}catch(e){reject(e);return;}
      tx.oncomplete=()=>resolve(result?.result);
      tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
      tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
    });
  }finally{db.close();}
}

async function generateAndStoreDeviceCredential(deviceId){
  if(!deviceCryptoSupported())throw new Error('DEVICE_CRYPTO_UNSUPPORTED');
  const pair=await crypto.subtle.generateKey(
    {name:'ECDSA',namedCurve:'P-256'},
    false,
    ['sign','verify']
  );
  if(pair.privateKey.extractable)throw new Error('PRIVATE_KEY_MUST_BE_NON_EXTRACTABLE');
  const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
  if(publicKey.d)throw new Error('PRIVATE_KEY_EXPORT_DETECTED');
  await withDeviceStore('readwrite',store=>store.put({
    deviceId,
    privateKey:pair.privateKey,
    createdAt:new Date().toISOString()
  }));
  return {kty:publicKey.kty,crv:publicKey.crv,x:publicKey.x,y:publicKey.y};
}

async function getDeviceCredential(deviceId){
  if(!deviceCryptoSupported())return null;
  const db=await openDeviceDb();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(DEVICE_STORE,'readonly');
      const request=tx.objectStore(DEVICE_STORE).get(deviceId);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error('Unable to read device credential'));
    });
  }finally{db.close();}
}

async function deleteDeviceCredential(deviceId){
  if(!window.indexedDB)return;
  await withDeviceStore('readwrite',store=>store.delete(deviceId));
}

async function deleteOtherDeviceCredentials(deviceId){
  if(!window.indexedDB)return;
  const db=await openDeviceDb();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DEVICE_STORE,'readwrite');
      const store=tx.objectStore(DEVICE_STORE);
      const request=store.openCursor();
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor)return;
        if(cursor.value?.deviceId!==deviceId)cursor.delete();
        cursor.continue();
      };
      request.onerror=()=>reject(request.error||new Error('Unable to clean device credentials'));
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Unable to clean device credentials'));
    });
  }finally{db.close();}
}

function toBase64Url(bytes){
  let binary='';
  const arr=new Uint8Array(bytes);
  for(let i=0;i<arr.length;i++)binary+=String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function signDevicePayload(deviceId,dataToSign){
  const credential=await getDeviceCredential(deviceId);
  if(!credential?.privateKey)throw new Error('DEVICE_KEY_MISSING');
  if(credential.privateKey.extractable)throw new Error('INVALID_DEVICE_KEY');
  const data=new TextEncoder().encode(dataToSign);
  const signature=await crypto.subtle.sign(
    {name:'ECDSA',hash:'SHA-256'},
    credential.privateKey,
    data
  );
  return toBase64Url(signature);
}
