// συνθετικό .RSD κατά την περιγραφή (memotech Garmin_RSD_Format)
export function mkRsd(recs, zig=true){
  const B=[]; const vu=(v)=>{const o=[]; do{ let b=v%128; v=Math.floor(v/128); if(v>0) b|=128; o.push(b);}while(v>0); return o;};
  const u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]; const i32=(v)=>u32(v<0?v+4294967296:v);
  const f32=(v)=>{const b=new ArrayBuffer(4); new DataView(b).setFloat32(0,v,true); return [...new Uint8Array(b)];};
  const fld=(num,bytes)=>{ const L=bytes.length; return L<7?[...vu(num*8+L),...bytes]:[...vu(num*8+7),...vu(L),...bytes]; };
  const out=new Array(20480).fill(0);
  recs.forEach((r,k)=>{
    const dm=Math.round(r.d*1000), dv=zig?dm*2:dm;
    const body=[4,...fld(1,vu(dv)),...fld(9,i32(Math.round(r.lat*4294967296/360))),...fld(10,i32(Math.round(r.lon*4294967296/360))),...fld(11,f32(r.wt))];
    const st=[1,...fld(0,vu(2))];
    const head=[6,...fld(0,u32(3085556358)),...fld(1,st),...fld(2,u32(k)),...fld(3,u32(0)),...fld(4,[body.length&255,body.length>>8]),...fld(5,u32(k*1000))];
    const rec=[...head,0,0,0,0,...body]; const tr=[...u32(0xF98EACBC),...u32(rec.length+12),0,0,0,0];
    out.push(...rec,...tr); });
  return new Uint8Array(out).buffer; }
