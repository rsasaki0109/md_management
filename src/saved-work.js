import {inspectWorkEvidence,progressReference} from './work-evidence.js';
import {contextFromCandidate,validateTaskContext} from './task-context.js';
export async function checkSavedWork(context,{fetcher=fetch,signal}={}){
 validateTaskContext(context);
 const source=context.url?.match(/^https:\/\/github\.com\/([a-z\d-]+\/[a-z\d_.-]+)\/issues\/(\d+)$/i);
 if(!source||!context.draft)throw Error('この作業は最新の進捗照合に対応していません');
 const [,repository,number]=source;
 const response=await fetcher('https://api.github.com/repos/'+repository+'/issues/'+number,{signal,headers:{Accept:'application/vnd.github+json'}}).catch(()=>{throw Error('GitHub に接続できません。保存した根拠はそのままです');});
 if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub の利用制限です。時間を置いて再試行してください':'最新の Issue を取得できませんでした');
 const item=await response.json();if(item.number!==Number(number)||typeof item.title!=='string'||typeof item.body!=='string'||!['open','closed'].includes(item.state)||item.pull_request)throw Error('GitHub の応答が正しくありません');
 if(item.state==='closed')return {status:'closed',message:'Issue は閉じられています。保存した作業の完了条件は Issue を開いて確認してください'};
 if(!progressReference(repository,item))return {status:'unverified',message:'本文の進捗または検証台帳へのリンクが見つからず、照合できませんでした'};
 const result=await inspectWorkEvidence(repository,[item],{fetcher,signal});
 if(result.warnings.length)return {status:'unverified',message:result.warnings.join('。')+'。保存した根拠はそのままです'};
 const candidate=result.items[0].progressEvidence;
 if(candidate)return {status:'needed',message:'現在も本文と台帳に差があります。最新の本文から修正案を作り直しました',context:contextFromCandidate(candidate)};
 return {status:'aligned',message:'最新の本文と台帳の件数は一致しています。根拠リンクなどの完了条件を確認してから、タスクを完了にしてください'};
}
