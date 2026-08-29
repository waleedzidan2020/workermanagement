function base64UrlToUint8Array(value){
  const pad='='.repeat((4-value.length%4)%4);
  const base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(base64);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}

function arrayBufferToBase64Url(value){
  const bytes=new Uint8Array(value);
  let binary='';
  bytes.forEach(b=>binary+=String.fromCharCode(b));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function prepareCreationOptions(options){
  const result=structuredClone(options);
  result.challenge=base64UrlToUint8Array(result.challenge);
  result.user.id=base64UrlToUint8Array(result.user.id);
  if(result.excludeCredentials){
    result.excludeCredentials=result.excludeCredentials.map(x=>({...x,id:base64UrlToUint8Array(x.id)}));
  }
  return result;
}

function prepareAssertionOptions(options){
  const result=structuredClone(options);
  result.challenge=base64UrlToUint8Array(result.challenge);
  if(result.allowCredentials){
    result.allowCredentials=result.allowCredentials.map(x=>({...x,id:base64UrlToUint8Array(x.id)}));
  }
  return result;
}

function serializeRegistrationCredential(credential){
  return {
    id:credential.id,
    rawId:arrayBufferToBase64Url(credential.rawId),
    type:credential.type,
    response:{
      attestationObject:arrayBufferToBase64Url(credential.response.attestationObject),
      clientDataJson:arrayBufferToBase64Url(credential.response.clientDataJSON),
      transports:credential.response.getTransports?credential.response.getTransports():[]
    },
    extensions:credential.getClientExtensionResults?credential.getClientExtensionResults():{}
  };
}

function serializeAssertionCredential(credential){
  return {
    id:credential.id,
    rawId:arrayBufferToBase64Url(credential.rawId),
    type:credential.type,
    response:{
      authenticatorData:arrayBufferToBase64Url(credential.response.authenticatorData),
      clientDataJson:arrayBufferToBase64Url(credential.response.clientDataJSON),
      signature:arrayBufferToBase64Url(credential.response.signature),
      userHandle:credential.response.userHandle?arrayBufferToBase64Url(credential.response.userHandle):null
    },
    extensions:credential.getClientExtensionResults?credential.getClientExtensionResults():{}
  };
}

function webAuthnSupported(){
  return !!(window.PublicKeyCredential&&navigator.credentials);
}
