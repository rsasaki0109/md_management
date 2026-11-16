export async function setupOffline({canReload,notify}){
 const status=document.querySelector('#offline-status'),install=document.querySelector('#install-app'),update=document.querySelector('#update-app');
 let registration=null,deferredInstall=null,reloadOnChange=false,ready=false;
 function showStatus(){status.textContent=ready?(navigator.onLine?'オフライン起動 OK':'オフラインで編集中'):(navigator.onLine?'オフライン準備中':'オフライン未準備');}
 window.addEventListener('online',showStatus);window.addEventListener('offline',showStatus);
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;install.hidden=false;});
 window.addEventListener('appinstalled',()=>{deferredInstall=null;install.hidden=true;notify('アプリをインストールしました');});
 install.onclick=async()=>{if(!deferredInstall)return;const prompt=deferredInstall;deferredInstall=null;install.hidden=true;try{await prompt.prompt();await prompt.userChoice;}catch{notify('ブラウザのメニューからインストールできます');}};
 if(!('serviceWorker' in navigator)||!window.isSecureContext){status.textContent='オフライン起動は HTTPS または localhost で利用できます';return;}
 navigator.serviceWorker.addEventListener('controllerchange',()=>{ready=true;showStatus();if(reloadOnChange)window.location.reload();});
 showStatus();
 try{
  registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
  function showUpdate(){update.hidden=!registration.waiting;}
  showUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{showUpdate();if(worker.state==='redundant'&&!ready){status.textContent='オフライン準備に失敗。オンラインで再読み込みしてください';}});});
  navigator.serviceWorker.ready.then(()=>{ready=true;showStatus();showUpdate();});
  update.onclick=()=>{
   if(!registration.waiting)return;
   if(!canReload()){notify('未保存の内容をバックアップしてから更新してください');return;}
   update.disabled=true;reloadOnChange=true;const channel=new MessageChannel();
   const timeout=setTimeout(()=>{reloadOnChange=false;update.disabled=false;notify('更新できませんでした。オンラインで再読み込みしてください');},10000);
   channel.port1.onmessage=event=>{clearTimeout(timeout);channel.port1.close();if(!event.data.ok){reloadOnChange=false;update.disabled=false;notify('ほかの folia のタブを閉じてから更新してください');}};
   registration.waiting.postMessage({type:'ACTIVATE_UPDATE'},[channel.port2]);
  };
 }catch{status.textContent='オフライン準備に失敗。オンラインで再読み込みしてください';}
}
