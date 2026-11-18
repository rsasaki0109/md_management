const joinable=new Set(['text','h1','h2','bullet','todo','quote']);
// Retain the left block's identity and formatting; return the join caret.
export function joinAdjacent(blocks,id,direction){
 if(direction!=='backward'&&direction!=='forward')return null;
 const current=blocks.findIndex(b=>b.id===id),leftIndex=direction==='backward'?current-1:current;
 if(current<0||leftIndex<0||leftIndex+1>=blocks.length)return null;
 const left=blocks[leftIndex],right=blocks[leftIndex+1];
 if(!joinable.has(left.type)||!joinable.has(right.type))return null;
 const offset=left.text.length;left.text+=right.text;blocks.splice(leftIndex+1,1);
 return {id:left.id,offset};
}

export function duplicateBlock(blocks,id){
 const index=blocks.findIndex(b=>b.id===id);if(index<0)return null;
 const copy={...structuredClone(blocks[index]),id:crypto.randomUUID()};
 blocks.splice(index+1,0,copy);return copy;
}
