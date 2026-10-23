/** Pointer-based dragging stays independent of the Hub's native file importer. */
export const compareJobOrder = (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.number - a.number;
export class JobsDrag {
  constructor(root, options) {
    this.root = root;
    this.options = options;
    for (const method of ['down','move','up','cancel','frame','key']) this[method] = this[method].bind(this);
    root.addEventListener('pointerdown', this.down);
    root.addEventListener('dragstart', e => { if(e.target.closest('.job-card')) e.preventDefault(); });
    window.addEventListener('pointermove', this.move, {passive:false});
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.cancel);
    window.addEventListener('blur', this.cancel);
    document.addEventListener('keydown', this.key);
  }
  down(e) {
    const card=e.target.closest('.job-card');
    if(!card || e.button!==0 || e.isPrimary===false || e.target.closest('button,a,input,select,textarea') || !this.options.canStart() || this.session) return;
    const job=this.options.items().find(j=>j.id===card.dataset.job);
    if(!job)return;
    const rect=card.getBoundingClientRect();
    this.session={card,job,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,rect,active:false};
    card.setPointerCapture?.(e.pointerId);
  }
  move(e) {
    const s=this.session;
    if(!s || e.pointerId!==s.pointerId || s.settling)return;
    s.x=e.clientX; s.y=e.clientY;
    if(!s.active && Math.hypot(s.x-s.startX,s.y-s.startY)<6)return;
    e.preventDefault();
    if(!s.active)this.start();
  }
  start() {
    const s=this.session; s.active=true;
    this.options.onActive(s.job.id);
    document.body.classList.add('is-job-dragging');
    s.ghost=s.card.cloneNode(true);
    s.ghost.classList.add('job-drag-ghost'); s.ghost.removeAttribute('data-job');
    s.ghost.setAttribute('aria-hidden','true'); s.ghost.inert=true;
    Object.assign(s.ghost.style,{width:s.rect.width+'px',height:s.rect.height+'px'});
    s.drawX=s.rect.left; s.drawY=s.rect.top;
    s.ghost.style.transform=`translate3d(${s.drawX}px,${s.drawY}px,0)`;
    document.body.append(s.ghost);
    s.slot=document.createElement('div'); s.slot.className='job-drop-slot'; s.slot.setAttribute('aria-hidden','true'); s.slot.style.height=s.rect.height+'px';
    s.card.before(s.slot); s.card.classList.add('is-pointer-dragging');
    this.root.classList.add('has-job-drag');
    this.raf=requestAnimationFrame(this.frame);
  }
  updateTarget() {
    const s=this.session;
    const lane=document.elementFromPoint(s.x,s.y)?.closest('.job-lane');
    const valid=lane && this.root.contains(lane);
    s.target=valid?lane:null;
    this.root.querySelectorAll('.job-lane').forEach(el=>el.classList.toggle('is-drop-target',el===s.target));
    if(!valid) { s.slot.hidden=true; return; }
    s.slot.hidden=false;
    const list=lane.querySelector('.job-lane-cards');
    // Match the board's due-date order exactly, so the landing slot never lies.
    const next=[...list.querySelectorAll('.job-card:not(.is-pointer-dragging)')].find(card=>{
      const job=this.options.items().find(j=>j.id===card.dataset.job);
      return job && compareJobOrder(s.job,job)<0;
    });
    if(s.slot.parentElement===list && s.slot.nextElementSibling===(next||null))return;
    const cards=[...this.root.querySelectorAll('.job-card:not(.is-pointer-dragging)')];
    const before=new Map(cards.map(card=>[card,card.getBoundingClientRect()]));
    list.insertBefore(s.slot,next||null);
    if(!this.reduced()) for(const card of cards){
      const old=before.get(card), rect=card.getBoundingClientRect();
      const x=old.left-rect.left, y=old.top-rect.top;
      if(x || y) {card.getAnimations().forEach(a=>a.cancel());card.animate([{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],{duration:190,easing:'cubic-bezier(.2,.8,.2,1)'});}
    }
  }
  reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  frame(time) {
    const s=this.session; if(!s?.active || s.settling)return;
    const dt=Math.min(40,Math.max(1,time-(s.lastTime||time-16)));s.lastTime=time;
    const board=this.root.querySelector('.jobs-board'), r=board.getBoundingClientRect();
    const edge=(v,min,max)=>v<min+48?-Math.min(16,(min+48-v)*.3):v>max-48?Math.min(16,(v-max+48)*.3):0;
    if(s.y>=r.top && s.y<=r.bottom && s.x>=r.left && s.x<=r.right)board.scrollLeft+=edge(s.x,r.left,r.right)*dt/16;
    window.scrollBy(0,edge(s.y,0,window.innerHeight)*dt/16);
    this.updateTarget();
    const factor=this.reduced()?1:1-Math.exp(-dt/45);
    s.drawX+=(s.x-s.offsetX-s.drawX)*factor; s.drawY+=(s.y-s.offsetY-s.drawY)*factor;
    s.ghost.style.transform=`translate3d(${s.drawX}px,${s.drawY}px,0)`;
    this.raf=requestAnimationFrame(this.frame);
  }
  async up(e) {
    const s=this.session;if(!s || e.pointerId!==s.pointerId || s.settling)return;
    if(!s.active){this.cleanup();return;}
    s.x=e.clientX;s.y=e.clientY;this.updateTarget();
    const status=s.target?.dataset.status;
    const target=status?s.slot.getBoundingClientRect():s.rect;
    s.settling=true;cancelAnimationFrame(this.raf);
    const animation=s.ghost.animate([
      {transform:`translate3d(${s.drawX}px,${s.drawY}px,0)`,width:s.rect.width+'px',opacity:.9},
      {transform:`translate3d(${target.left}px,${target.top}px,0)`,width:target.width+'px',opacity:1}
    ],{duration:this.reduced()?0:220,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
    try { await animation.finished; } catch {}
    if(this.session!==s)return;
    this.cleanup();
    if(status) await this.options.onDrop(s.job,status);
  }
  key(e) {if(e.key==='Escape' && this.session){e.preventDefault();this.cancel();}}
  cancel(e) {if(e?.pointerId!==undefined && e.pointerId!==this.session?.pointerId)return;this.cleanup();}
  cleanup() {
    cancelAnimationFrame(this.raf);const s=this.session;if(!s)return;
    this.session=null;
    s.ghost?.getAnimations().forEach(a=>a.cancel());s.ghost?.remove();s.slot?.remove();
    s.card.classList.remove('is-pointer-dragging');
    if(s.card.hasPointerCapture?.(s.pointerId))s.card.releasePointerCapture(s.pointerId);
    document.body.classList.remove('is-job-dragging');this.root.classList.remove('has-job-drag');
    this.root.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));
    this.options.onActive(null);
  }
}
