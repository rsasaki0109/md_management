import {statuses} from './database.js';
// Mutate only after a confirmed drop. Preserve item identity and all properties.
export function reorderItems(items,sourceId,targetId=null,position='before'){
 if(!['before','after'].includes(position))return false;
 const from=items.findIndex(item=>item.id===sourceId),target=targetId===null?items.length:items.findIndex(item=>item.id===targetId);
 if(from<0||target<0||sourceId===targetId)return false;
 let to=targetId===null?items.length:target+(position==='after'?1:0);
 if(from<to)to--;
 if(from===to)return false;
 const [item]=items.splice(from,1);items.splice(to,0,item);return true;
}
export function moveTask(db,id,status,{targetId=null,position='before',reorder=true}={}){
 const row=db.rows.find(r=>r.id===id);
 if(!row||!Object.hasOwn(statuses,status)||!['before','after'].includes(position))return false;
 if(targetId!==null&&!db.rows.some(r=>r.id===targetId&&r.status===status))return false;
 const changed=row.status!==status;
 const moved=reorder&&reorderItems(db.rows,id,targetId,position);row.status=status;
 return changed||moved;
}
