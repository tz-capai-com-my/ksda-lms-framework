// Restricted still-photo profile, shared by HTTP delivery and local import preparation.
// RIFF rules: https://developers.google.com/speed/webp/docs/riff_container
// A hash-bound approved asset is still required; header checks are not a pixel decoder.
export function validPhotoBytes(bytes:Uint8Array, mime:string, width:number, height:number):boolean {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192||bytes.length>10_485_760)return false;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const tag=(offset:number)=>String.fromCharCode(...bytes.subarray(offset,offset+4));
 const u24=(offset:number)=>bytes[offset]+bytes[offset+1]*256+bytes[offset+2]*65536;
 if(mime==='image/png')return bytes.length>=33 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)
  && view.getUint32(8)===13 && tag(12)==='IHDR' && view.getUint32(16)===width && view.getUint32(20)===height;
 if(mime!=='image/webp'||bytes.length<26||bytes.length>262_144||tag(0)!=='RIFF'||tag(8)!=='WEBP'||view.getUint32(4,true)!==bytes.length-8)return false;
 let offset=12,seenFrame=false,seenExtended=false;
 while(offset<bytes.length){
  if(offset+8>bytes.length)return false;
  const kind=tag(offset),size=view.getUint32(offset+4,true),start=offset+8,end=start+size,padded=end+(size%2);
  if(size===0||padded>bytes.length||(size%2&&bytes[end]!==0))return false;
  if(kind==='VP8X'){
   // Prepared photographs have no metadata, transparency or animation. Reject these
   // optional features instead of accepting a header we do not fully validate.
   if(offset!==12||seenExtended||seenFrame||size!==10||u24(start)!==0||bytes[start+3]!==0
    ||u24(start+4)+1!==width||u24(start+7)+1!==height)return false;
   seenExtended=true;
  }else if(kind==='VP8 '){
   if(seenFrame||size<10||(bytes[start]&1)!==0||((bytes[start]>>1)&7)>3||(bytes[start]&16)===0
    ||u24(start+3)!==0x2a019d||(view.getUint16(start+6,true)&0x3fff)!==width
    ||(view.getUint16(start+8,true)&0x3fff)!==height||(view.getUint16(start+6,true)&0xc000)!==0
    ||(view.getUint16(start+8,true)&0xc000)!==0||(u24(start)>>5)>size-10)return false;
   seenFrame=true;
  }else if(kind==='VP8L'){
   if(seenFrame||size<5||bytes[start]!==0x2f)return false;
   const bits=view.getUint32(start+1,true);
   if((bits>>>28)!==0||(bits&0x3fff)+1!==width||((bits>>>14)&0x3fff)+1!==height)return false;
   seenFrame=true;
  }else return false; // No unknown chunks, metadata, alpha or animated frame containers.
  offset=padded;
 }
 return offset===bytes.length&&seenFrame;
}
