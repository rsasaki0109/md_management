import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','4','-i',resolve(root,'artifacts/demo-frames/frame-%03d.png'),'-filter_complex','fps=4,scale=1080:-2:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-loop','0',resolve(root,'assets/demo.gif')],{stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
