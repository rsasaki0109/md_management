import {createDatabase,task} from './database.js';
import {filterDeadlines} from './calendar.js';
export const projectStages={idea:'未整理',active:'開発中',maintain:'保守中',paused:'保留'};
export const projectPriorities={high:'高',medium:'中',low:'低'};
export function validRepository(value){return typeof value==='string'&&!['.','..'].includes(value.split('/')[1])&&/^[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d_.-]+$/i.test(value);}
export function validateProject(p){
 if(!p||!validRepository(p.repository)||typeof p.description!=='string'||typeof p.language!=='string'||!Number.isInteger(p.stars)||p.stars<0||!Number.isInteger(p.openIssues)||p.openIssues<0||!(p.pushedAt===null||(typeof p.pushedAt==='string'&&!Number.isNaN(Date.parse(p.pushedAt))))||typeof p.syncedAt!=='string'||Number.isNaN(Date.parse(p.syncedAt))||!Object.hasOwn(projectStages,p.stage)||!Object.hasOwn(projectPriorities,p.priority)||typeof p.nextAction!=='string')throw Error('OSS プロジェクトの形式が正しくありません');
 return p;
}
export function repositorySnapshot(repo,now=new Date().toISOString()){
 const project={repository:repo.full_name,description:repo.description||'',language:repo.language||'',stars:repo.stargazers_count,openIssues:repo.open_issues_count,pushedAt:repo.pushed_at||null,syncedAt:now,stage:'idea',priority:'medium',nextAction:''};return validateProject(project);
}
export async function fetchRepositories(owner,{fetcher=fetch,signal}={}){
 if(!/^[a-z\d][a-z\d-]{0,38}$/i.test(owner))throw Error('GitHub のユーザー名を入力してください');
 const repos=[],seen=new Set();
 for(let page=1;page<=20;page++){
  const response=await fetcher('https://api.github.com/users/'+encodeURIComponent(owner)+'/repos?type=owner&sort=updated&per_page=100&page='+page,{signal,headers:{Accept:'application/vnd.github+json'}});
  if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub の利用制限です。時間を置いて再試行してください':response.status===404?'GitHub ユーザーが見つかりません':'GitHub から取得できませんでした');
  const data=await response.json();if(!Array.isArray(data))throw Error('GitHub の応答が正しくありません');
  for(const repo of data){if(repo.private||repo.fork||repo.archived||repo.owner?.login?.toLowerCase()!==owner.toLowerCase())continue;const snapshot=repositorySnapshot(repo);const key=snapshot.repository.toLowerCase();if(!seen.has(key)){repos.push(snapshot);seen.add(key);}}
  if(data.length<100)return repos;
 }
 throw Error('リポジトリ数が取得上限を超えました。今回は取り込みません');
}
export function mergeRepositories(pages,repositories,createPage,excluded=[]){
 const blocked=new Set(excluded.map(x=>x.toLowerCase())),seen=new Set();let created=0,updated=0,skipped=0;
 const snapshots=repositories.map(p=>validateProject(p));
 for(const snapshot of snapshots){const key=snapshot.repository.toLowerCase();if(seen.has(key)||blocked.has(key)){skipped++;continue;}seen.add(key);
  const existing=pages.find(p=>p.project?.repository.toLowerCase()===key);
  if(existing){existing.project={...snapshot,stage:existing.project.stage,priority:existing.project.priority,nextAction:existing.project.nextAction};updated++;}
  else{const p=createPage(snapshot);p.project=structuredClone(snapshot);pages.push(p);created++;}
 }
 return {created,updated,skipped};
}
export function filterProjects(pages,{query='',stage='all',priority='all'}={}){const q=query.trim().toLowerCase();const rank={high:0,medium:1,low:2};return pages.filter(p=>p.project&&(stage==='all'||p.project.stage===stage)&&(priority==='all'||p.project.priority===priority)&&[p.title,p.project.repository,p.project.description,p.project.nextAction].join(' ').toLowerCase().includes(q)).sort((a,b)=>rank[a.project.priority]-rank[b.project.priority]);}

export function projectTasks(pages,{query='',deadline='all',priority='all',projectPriority='all',projectId='all',completion='open',today}={}){
 const q=query.trim().toLowerCase(),rank={high:0,medium:1,low:2,none:3};
 const entries=pages.filter(p=>p.project&&(projectId==='all'||p.id===projectId)&&(projectPriority==='all'||p.project.priority===projectPriority)).flatMap(page=>(page.database?.rows||[]).filter(task=>(completion==='all'||(completion==='done'?task.status==='done':task.status!=='done'))&&(priority==='all'||task.priority===priority)&&[task.title,page.title,page.project.repository].join(' ').toLowerCase().includes(q)).map(task=>({page,task})));
 const visible=new Set(filterDeadlines(entries.map(e=>e.task),deadline,today));
 return entries.filter(e=>visible.has(e.task)).sort((a,b)=>(a.task.due||'9999-99-99').localeCompare(b.task.due||'9999-99-99')||(rank[a.task.priority]-rank[b.task.priority])||(rank[a.page.project.priority]-rank[b.page.project.priority]));
}

export function addNextActionTask(page){
 const title=page.project?.nextAction.trim();if(!title)return null;
 const existing=page.database?.rows.find(row=>row.status!=='done'&&row.title.trim()===title);if(existing)return existing;
 const row={...task(),title,priority:page.project.priority};page.database??=createDatabase();page.database.rows.push(row);return row;
}

export async function fetchProjectWork(repository,{fetcher=fetch,signal}={}){
 if(!validRepository(repository))throw Error('リポジトリ名が正しくありません');
 const response=await fetcher('https://api.github.com/repos/'+repository+'/issues?state=open&sort=updated&direction=desc&per_page=30',{signal,headers:{Accept:'application/vnd.github+json'}}).catch(()=>{throw Error('GitHub に接続できません。ネットワーク接続を確認してください');});
 if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub の利用制限です。時間を置いて再試行してください':response.status===404?'公開リポジトリが見つかりません':'GitHub から作業候補を取得できませんでした');
 const data=await response.json();if(!Array.isArray(data))throw Error('GitHub の応答が正しくありません');
 return data.filter(item=>Number.isSafeInteger(item.number)&&item.number>0&&typeof item.title==='string'&&item.title.trim()&&item.state==='open');
}
export function suggestProjectActions(page,items=[]){
 const rank={high:0,medium:1,low:2,none:3},repository=page.project.repository;
 const local=(page.database?.rows||[]).filter(row=>row.status!=='done'&&row.title.trim()).slice().sort((a,b)=>(a.status==='doing'?-1:0)-(b.status==='doing'?-1:0)||(a.due||'9999').localeCompare(b.due||'9999')||rank[a.priority]-rank[b.priority]).slice(0,3).map(row=>({action:row.title.trim(),reason:row.status==='doing'?'進行中のタスクを先に進めます':'このプロジェクトの未完了タスクです',done:'元のタスクの完了条件を確認して作業を終える',source:'ローカルタスク',url:null}));
 const evidence=items.flatMap(item=>item.progressEvidence?[item.progressEvidence]:[]);
 const remote=items.filter(item=>!item.progressEvidence).sort((a,b)=>Number(!a.labels?.some(l=>/bug/i.test(typeof l==='string'?l:l.name)))-Number(!b.labels?.some(l=>/bug/i.test(typeof l==='string'?l:l.name)))).slice(0,6).map(item=>{
  const pr=Boolean(item.pull_request),bug=item.labels?.some(l=>/bug/i.test(typeof l==='string'?l:l.name));
  return {action:(pr?'PR #': 'Issue #')+item.number+'「'+item.title.trim()+'」'+(pr?'の差分とテスト結果を確認し、レビュー指摘をまとめる':bug?'の再現手順を実行し、期待値と実際の挙動を記録する':'の要件を確認し、実装手順と確認項目を整理する'),reason:pr?'公開中の PR がレビュー候補です':bug?'bug ラベルのある未解決 Issue です':'未解決の Issue を具体的な作業に分解します',done:pr?'変更点・テスト結果・懸念点をレビュー用メモに残す':bug?'実行環境・再現手順・実行結果を開発メモに残す':'対応範囲と検証方法を開発メモに残す',source:(pr?'PR #':'Issue #')+item.number,url:'https://github.com/'+repository+(pr?'/pull/':'/issues/')+item.number};
 });
 const candidates=[...evidence,...local,...remote];if(candidates.length)return candidates.slice(0,6);
 return [{action:repository+' の README の導入手順をクリーンな環境で実行し、結果を記録する',reason:'未完了タスクや取得済みの Issue・PR がないため、導入確認を候補にしています',done:'環境・実行コマンド・成功結果または失敗箇所を開発メモに残す',source:'リポジトリ',url:'https://github.com/'+repository}];
}
