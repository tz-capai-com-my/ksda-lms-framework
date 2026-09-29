import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {videoLink,canvaVideoEmbed} from '../app/learn/video-links.ts';
const watch='https://www.canva.com/design/ExampleDesign/view';
test('configured video links default empty and never turn arbitrary URLs into frames',async()=>{
 assert.deepEqual(JSON.parse(await readFile(new URL('../content/ksda/topic-video-links.json',import.meta.url),'utf8')),{});
 assert.equal(videoLink('https://videos.example.org/topic-one'),'https://videos.example.org/topic-one');
 assert.equal(canvaVideoEmbed('https://videos.example.org/topic-one'),null);
 assert.equal(canvaVideoEmbed(watch+'?autoplay=1#page=3'),watch+'?embed');
 assert.equal(canvaVideoEmbed('https://canva.link/Example'),null);
 for(const value of [null,{},'', 'javascript:alert(1)','data:text/html,example','http://videos.example.org/topic', 'https://user:password@www.canva.com/design/ExampleDesign/view','https://www.canva.com:8443/design/ExampleDesign/view']){
  assert.equal(videoLink(value),null);assert.equal(canvaVideoEmbed(value),null);
 }
 for(const value of ['https://www.canva.com.evil.invalid/design/ExampleDesign/view','https://www.canva.com/design/ExampleDesign/edit','https://www.canva.com/other/view'])assert.equal(canvaVideoEmbed(value),null);
});
