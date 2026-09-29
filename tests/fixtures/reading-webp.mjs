// Two real 2x3 opaque images encoded with libwebp via Pillow; no authored mission imagery.
export const lossy=Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADwAQCdASoCAAMAAMASJZACdLoB+AAETAAA/vdZL/6TZ4mzxNnySP/n5l8oq9tgAAA=','base64');
export const lossless=Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAYAAAAfQsNIUsf+BiOh/AAA=','base64');
export const riff=(...chunks)=>{const bytes=Buffer.concat([Buffer.from('RIFF0000WEBP'),...chunks]);bytes.writeUInt32LE(bytes.length-8,4);return bytes;};
export const chunk=(tag,payload)=>{const b=Buffer.alloc(8+payload.length+(payload.length%2));b.write(tag,0,'ascii');b.writeUInt32LE(payload.length,4);payload.copy(b,8);return b;};
const canvas=Buffer.alloc(10);canvas.writeUIntLE(1,4,3);canvas.writeUIntLE(2,7,3);
export const extended=riff(chunk('VP8X',canvas),lossy.subarray(12));
const change=(source,fn)=>{const b=Buffer.from(source);fn(b);return b;};
const oversize=Buffer.alloc(262146);lossy.copy(oversize);oversize.writeUInt32LE(oversize.length-8,4);oversize.writeUInt32LE(oversize.length-20,16);
export const malformed=[
 ['WebP byte budget exceeded with coherent container lengths',oversize],
 ['bad RIFF',change(lossy,b=>b[0]=0)],['bad WEBP',change(lossy,b=>b[8]=0)],
 ['wrong file size',change(lossy,b=>b.writeUInt32LE(b.length,4))],['truncated',lossy.subarray(0,-1)],
 ['trailing bytes',Buffer.concat([lossy,Buffer.alloc(2)])],['chunk overflow',change(lossy,b=>b.writeUInt32LE(0xffffffff,16))],
 ['odd padding',change(lossless,b=>b[b.length-1]=1)],['zero chunk',riff(chunk('VP8 ',Buffer.alloc(0)))],
 ['unknown chunk',riff(lossy.subarray(12),chunk('XXXX',Buffer.alloc(2)))],
 ['duplicate frame',riff(lossy.subarray(12),lossy.subarray(12))],
 ['out of order extended',riff(lossy.subarray(12),chunk('VP8X',canvas))],
 ['extended without frame',riff(chunk('VP8X',canvas))],
 ['extended dimensions mismatch',change(extended,b=>b[24]=3)],
 ['animated feature',change(extended,b=>b[20]=2)],['alpha feature',change(extended,b=>b[20]=16)],
 ['metadata feature',change(extended,b=>b[20]=8)],['reserved field',change(extended,b=>b[23]=1)],
 ['inter frame',change(lossy,b=>b[20]|=1)],['hidden frame',change(lossy,b=>b[20]&=~16)],
 ['invalid version',change(lossy,b=>b[20]=(b[20]&~14)|8)],['bad VP8 signature',change(lossy,b=>b[23]=0)],
 ['scaled VP8',change(lossy,b=>b[27]|=64)],['VP8 width mismatch',change(lossy,b=>b[26]=4)],
 ['VP8 height mismatch',change(lossy,b=>b[28]=4)],['partition overflow',change(lossy,b=>b[22]=255)],
 ['VP8L signature',change(lossless,b=>b[20]=0)],['VP8L alpha',change(lossless,b=>b[24]|=16)],
 ['VP8L version',change(lossless,b=>b[24]|=32)],['VP8L width mismatch',change(lossless,b=>b[21]=3)],
 ['animation chunk',riff(chunk('ANIM',Buffer.alloc(6)),lossy.subarray(12))],
 ['metadata chunk',riff(lossy.subarray(12),chunk('EXIF',Buffer.alloc(4)))],
 ['alpha chunk',riff(chunk('ALPH',Buffer.alloc(4)),lossy.subarray(12))],
 ['short RIFF',Buffer.from('RIFF')],['short frame',riff(chunk('VP8 ',Buffer.alloc(8)))],
 ['short lossless',riff(chunk('VP8L',Buffer.alloc(4)))],
];
