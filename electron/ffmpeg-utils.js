import { spawn } from 'node:child_process';

let detectedEncodersCache = null;

export async function detectHardwareEncoders(ffmpegPath) {
  if (detectedEncodersCache) return detectedEncodersCache;
  const encoders = await execCollect(ffmpegPath, ['-hide_banner', '-encoders']);
  const hw = {
    h264_nvenc: /\bh264_nvenc\b/.test(encoders),
    hevc_nvenc: /\bhevc_nvenc\b/.test(encoders),
    h264_qsv: /\bh264_qsv\b/.test(encoders),
    hevc_qsv: /\bhevc_qsv\b/.test(encoders),
    h264_amf: /\bh264_amf\b/.test(encoders),
    hevc_amf: /\bhevc_amf\b/.test(encoders)
  };
  detectedEncodersCache = hw;
  return hw;
}

export function pickBestH264Encoder(hw) {
  if (hw.h264_nvenc) return 'h264_nvenc';
  if (hw.h264_qsv) return 'h264_qsv';
  if (hw.h264_amf) return 'h264_amf';
  return 'libx264';
}

export function buildTranscodeArgs({ input, output, width, height, fps, crf = 18, preset = 'p5', videoCodec }) {
  const args = ['-y', '-i', input];
  if (fps) {
    args.push('-r', String(fps));
  }
  if (width && height) {
    args.push('-vf', `scale=${width}:${height}:flags=lanczos`);
  }
  args.push('-c:v', videoCodec);
  if (videoCodec === 'libx264') {
    args.push('-preset', 'medium', '-crf', String(crf));
  } else if (videoCodec.endsWith('_nvenc')) {
    // NVIDIA presets: p1(최속)~p7(최고품질)
    args.push('-preset', preset, '-b:v', '0', '-cq', String(19));
  } else if (videoCodec.endsWith('_qsv')) {
    args.push('-global_quality', String(23));
  } else if (videoCodec.endsWith('_amf')) {
    args.push('-quality', 'quality');
  }
  args.push('-c:a', 'aac', '-b:a', '160k', output);
  return args;
}

export function parseFfmpegProgress(line) {
  // Try to parse time=00:00:12.34 fps=...
  const m = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/.exec(line);
  if (!m) return null;
  const [ , hh, mm, ss, cs ] = m;
  const seconds = Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(cs) / 100;
  return { currentSeconds: seconds };
}

function execCollect(cmd, args) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (out += d.toString()));
    proc.on('close', () => resolve(out));
  });
}


