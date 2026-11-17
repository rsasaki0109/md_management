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
