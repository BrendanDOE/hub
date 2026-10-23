const FIELDS = {ID:'number',Subject:'subject',Requester:'requester','Assigned to':'assignedTo',Status:'status','Due date':'dueDate',Created:'createdAt',Updated:'updatedAt',Location:'location',Priority:'priority','Job type':'jobType',Department:'department',Description:'description','Artwork type':'artworkType',Copies:'copies','Finished size':'finishedSize','Paper weight':'paperWeight',Colour:'colour'};
const collator = new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
export function sortJobs(rows,column,direction='asc') {
  if(!column)return rows;
  const value=j=>column==='Attachments'?(j.attachments||[]).map(f=>f.name).join(', '):j[FIELDS[column]];
  return [...rows].sort((a,b)=>{
    const av=value(a),bv=value(b),ae=av===undefined || av===null || av==='',be=bv===undefined || bv===null || bv==='';
    if(ae || be)return ae===be?0:ae?1:-1;
    return collator.compare(String(av),String(bv))*(direction==='desc'?-1:1);
  });
}
const KEY='hub.jobs.list-table.v1';
export const clampWidth=value=>Math.max(80,Math.min(800,Number(value)||160));
export class JobsTable {
  constructor(root,options) {
    this.root=root;this.options=options;this.widths={};this.sort={column:null,direction:'asc'};
    try {const saved=JSON.parse(localStorage.getItem(KEY)); if(saved && typeof saved==='object'){
      if(saved.widths && typeof saved.widths==='object')for(const [key,value] of Object.entries(saved.widths)){if(Number.isFinite(value))this.widths[key]=clampWidth(value);}
      if((FIELDS[saved.sort?.column] || saved.sort?.column==='Attachments') && ['asc','desc'].includes(saved.sort.direction))this.sort=saved.sort;
    }} catch {}
    root.addEventListener('pointerdown',e=>this.start(e));
    window.addEventListener('pointermove',e=>this.move(e),{passive:false});
    window.addEventListener('pointerup',e=>this.end(e));
    window.addEventListener('pointercancel',()=>this.cancel());
    window.addEventListener('blur',()=>this.cancel());
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && this.resize){e.preventDefault();this.cancel();}});
    root.addEventListener('click',e=>{
      if(e.target.closest('[data-resize-column]') || this.resize)return;
      const header=e.target.closest('[data-sort-column]');if(header)this.toggleSort(header.dataset.sortColumn);
    });
    root.addEventListener('keydown',e=>{
      const handle=e.target.closest('[data-resize-column]');
      if(handle && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
        e.preventDefault(); const column=handle.dataset.resizeColumn;
        const width=e.key==='Home'?80:e.key==='End'?800:this.width(column)+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?20:10);
        this.widths[column]=clampWidth(width);this.apply(column,this.widths[column]);this.save();return;
      }
      if(e.target.matches('[data-sort-column]') && ['Enter',' '].includes(e.key)){e.preventDefault();this.toggleSort(e.target.dataset.sortColumn);}
    });
  }
  width(column) {return this.widths[column] || ({Subject:280,Description:320,Attachments:240,'Artwork type':240}[column] || 160);}
  sorted(rows) {return sortJobs(rows,this.sort.column,this.sort.direction);}
  toggleSort(column) {
    this.sort={column,direction:this.sort.column===column && this.sort.direction==='asc'?'desc':'asc'};
    this.save();this.options.render();
    [...this.root.querySelectorAll('[data-sort-column]')].find(el=>el.dataset.sortColumn===column)?.focus();
  }
  start(e) {
    const handle=e.target.closest('[data-resize-column]');if(!handle || e.button!==0 || e.isPrimary===false)return;
    e.preventDefault();e.stopPropagation();
    const column=handle.dataset.resizeColumn;
    this.resize={column,startX:e.clientX,startWidth:this.width(column),width:this.width(column),pointerId:e.pointerId,handle};
    handle.setPointerCapture?.(e.pointerId);this.options.onActive(true);document.body.classList.add('is-job-column-resizing');
  }
  move(e) {
    const r=this.resize;if(!r || e.pointerId!==r.pointerId)return;
    e.preventDefault();r.width=clampWidth(r.startWidth+e.clientX-r.startX);this.apply(r.column,r.width);
  }
  apply(column,width) {
    const table=this.root.querySelector('.jobs-table--list');if(!table)return;
    const cols=[...table.querySelectorAll('col[data-column-width]')];
    cols.find(c=>c.dataset.columnWidth===column)?.style.setProperty('width',width+'px');
    table.style.width=cols.reduce((sum,c)=>sum+parseFloat(c.style.width),0)+'px';
    const handle=[...table.querySelectorAll('[data-resize-column]')].find(c=>c.dataset.resizeColumn===column);
    handle?.setAttribute('aria-valuenow',String(width));
  }
  end(e) {
    const r=this.resize;if(!r || e.pointerId!==r.pointerId)return;
    this.widths[r.column]=r.width;this.save();this.clear();
  }
  cancel() {if(this.resize)this.apply(this.resize.column,this.resize.startWidth);this.clear();}
  clear() {
    const r=this.resize;this.resize=null;
    if(r?.handle.hasPointerCapture?.(r.pointerId))r.handle.releasePointerCapture(r.pointerId);
    document.body.classList.remove('is-job-column-resizing');this.options.onActive(false);
  }
  save() {try{localStorage.setItem(KEY,JSON.stringify({widths:this.widths,sort:this.sort}));}catch{this.options.onStorageError?.();}}
}
