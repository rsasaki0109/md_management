// In-memory history. Navigation and save timestamps do not create undo steps.
export class History {
  constructor(value, {limit=50, delay=800}={}) {
    this.limit=Math.max(2,limit); this.delay=delay;
    this.reset(value);
  }
  reset(value){this.entries=[this.snapshot(value)];this.index=0;this.group=null;this.time=0;}
  snapshot(value, focus=null) {
    return {value:structuredClone(value),focus:structuredClone(focus),key:JSON.stringify({pages:value.pages.map(({updatedAt,...page})=>page),trash:value.trash||[]})};
  }
  record(value, {group=null, now=Date.now(), focus=null}={}) {
    const next=this.snapshot(value,focus);
    const current=this.entries[this.index];
    if(next.key===current.key) {
      if(value.activeId!==current.value.activeId){current.value.activeId=value.activeId;current.focus=null;this.group=null;}
      return;
    }
    const merge=group!==null && group===this.group && now-this.time<this.delay && this.index===this.entries.length-1 && this.index>0;
    this.entries.splice(this.index+1);
    if(merge) this.entries[this.index]=next;
    else {this.entries.push(next);if(this.entries.length>this.limit)this.entries.shift();this.index=this.entries.length-1;}
    this.group=group;this.time=now;
  }
  get canUndo(){return this.index>0;}
  get canRedo(){return this.index<this.entries.length-1;}
  step(direction){
    if(direction<0?!this.canUndo:!this.canRedo)return null;
    this.index+=direction<0?-1:1;this.group=null;
    return structuredClone(this.entries[this.index]);
  }
}
export function markdownShortcut(text) {
  const shortcuts={'#':'h1','##':'h2','-':'bullet','*':'bullet','[]':'todo','[ ]':'todo','- [ ]':'todo','[x]':'todo','- [x]':'todo','>':'quote','```':'code','---':'divider'};
  return Object.hasOwn(shortcuts,text) ? {type:shortcuts[text],checked:text.includes('[x]')} : null;
}
