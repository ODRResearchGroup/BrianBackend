import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export type CompressedMedia = {
  body: Buffer;
  contentType: "image/webp" | "audio/mp4";
  extension: "webp" | "m4a";
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
]);

export function isSupportedMediaType(contentType: string): boolean {
  return IMAGE_TYPES.has(contentType) || AUDIO_TYPES.has(contentType);
}

export async function compressMedia(
  input: Buffer,
  contentType: string,
): Promise<CompressedMedia> {
  if (IMAGE_TYPES.has(contentType)) {
    const body = await compressImage(input);
    return { body, contentType: "image/webp", extension: "webp" };
  }

  if (AUDIO_TYPES.has(contentType)) {
    return compressAudio(input);
  }

  throw new Error(`Unsupported media type: ${contentType}`);
}

async function compressImage(input: Buffer): Promise<Buffer> {
  try {
    return await encodeImage(input);
  } catch (sharpError) {
    try {
      const repaired = await repairImageWithFfmpeg(input);
      return await encodeImage(repaired);
    } catch (repairError) {
      throw new Error("Image could not be decoded or repaired", {
        cause: { sharpError, repairError },
      });
    }
  }
}

async function encodeImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

async function repairImageWithFfmpeg(input: Buffer): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error("FFmpeg is not available for image repair");
  }

  const directory = await mkdtemp(join(tmpdir(), "brian-image-"));
  const inputPath = join(directory, "input");
  const outputPath = join(directory, "repaired.png");

  try {
    await writeFile(inputPath, input);
    await execFileAsync(ffmpegPath, [
      "-y",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-f",
      "image2",
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function compressAudio(input: Buffer): Promise<CompressedMedia> {
  if (!ffmpegPath) {
    throw new Error("FFmpeg is not available in this deployment");
  }

  const directory = await mkdtemp(join(tmpdir(), "brian-media-"));
  const inputPath = join(directory, "input");
  const outputPath = join(directory, "output.m4a");

  try {
    await writeFile(inputPath, input);
    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    return {
      body: await readFile(outputPath),
      contentType: "audio/mp4",
      extension: "m4a",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
