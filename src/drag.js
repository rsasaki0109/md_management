// Accept only a drag begun by this exact component instance. External text,
// other pages, stale drags and other component types cannot mutate its items.
export function createDragScope(kind,owner){
 const mime='application/x-folia-'+kind;let current=null;
 return {
  start(id,event){
   current=null;
   if(!event.dataTransfer)return false;
   current={id,owner,token:crypto.randomUUID()};
   event.dataTransfer.setData(mime,JSON.stringify(current));event.dataTransfer.effectAllowed='move';return true;
  },
  matches(event){return current!==null&&!!event.dataTransfer&&Array.from(event.dataTransfer.types).includes(mime);},
  read(event){
   if(!this.matches(event))return null;
   try{const value=JSON.parse(event.dataTransfer.getData(mime));return value.token===current.token&&value.owner===owner&&value.id===current.id?value.id:null;}catch{return null;}
  },
  end(){current=null;}
 };
}
export function dropPosition(element,event){const rect=element.getBoundingClientRect();return event.clientY<rect.top+rect.height/2?'before':'after';}
export function clearDropHints(root){for(const node of root.querySelectorAll('.drop-before,.drop-after,.drag-source,.drop-column'))node.classList.remove('drop-before','drop-after','drag-source','drop-column');}
