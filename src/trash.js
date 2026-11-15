import {descendants,page,uid} from './model.js';
export function moveToTrash(state,id,now=new Date().toISOString()){
 const root=state.pages.find(p=>p.id===id);if(!root)throw Error('ページが見つかりません');
 const ids=descendants(state.pages,id),pages=structuredClone(state.pages.filter(p=>ids.has(p.id)));
 const entry={id:uid(),rootId:id,originalParentId:root.parentId,deletedAt:now,pages};
 pages.find(p=>p.id===id).parentId=null;
 state.trash??=[];state.trash.unshift(entry);state.pages=state.pages.filter(p=>!ids.has(p.id));
 if(!state.pages.length)state.pages=[page()];
 if(!state.pages.some(p=>p.id===state.activeId))state.activeId=state.pages[0].id;
 return entry;
}
export function restoreFromTrash(state,id){
 const entry=state.trash?.find(e=>e.id===id);if(!entry)throw Error('ゴミ箱のページが見つかりません');
 const ids=new Set(state.pages.map(p=>p.id)),blockIds=new Set(state.pages.flatMap(p=>p.blocks.map(b=>b.id)));
 if(entry.pages.some(p=>ids.has(p.id)||p.blocks.some(b=>blockIds.has(b.id))))throw Error('同じ ID のページがあるため復元できません');
 const pages=structuredClone(entry.pages),root=pages.find(p=>p.id===entry.rootId);
 root.parentId=ids.has(entry.originalParentId)?entry.originalParentId:null;
 state.pages.push(...pages);state.trash=state.trash.filter(e=>e.id!==id);state.activeId=root.id;
 return root;
}
export function permanentlyDelete(state,id){
 if(id===undefined)state.trash=[];
 else {if(!state.trash?.some(e=>e.id===id))throw Error('ゴミ箱のページが見つかりません');state.trash=state.trash.filter(e=>e.id!==id);}
}
export const trashCount=state=>(state.trash||[]).reduce((count,entry)=>count+entry.pages.length,0);
