export function createApiClient({apiOrigin='',storage,fetcher=fetch,cryptoProvider=crypto}={}){
  let guestToken;
  function token(){
    if(guestToken)return guestToken;
    try{guestToken=storage?.getItem('surpriso-player-v1');}catch{}
    if(!/^[a-f0-9]{64}$/.test(guestToken??'')){
      guestToken=Array.from(cryptoProvider.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
      try{storage?.setItem('surpriso-player-v1',guestToken);}catch{}
    }
    return guestToken;
  }
  return async function request(path,body){
    if(!path.startsWith('/api/'))throw Error('Invalid game request.');
    const headers={...(body===undefined?{}:{'Content-Type':'application/json'}),...(apiOrigin?{Authorization:`Bearer ${token()}`}:{})};
    const response=await fetcher(apiOrigin+path,{method:body===undefined?'GET':'POST',credentials:apiOrigin?'omit':'same-origin',headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    let data;try{data=await response.json();}catch{throw Error('The game is temporarily unavailable. Please try again.');}
    if(!response.ok)throw Error(data.error||'That action could not finish. Please try again.');return data;
  };
}
