/* eslint-disable */
// Preload for the stream-airtable-to-r2 regression test: stubs pg, Airtable, the download and
// lib-storage so the REAL script runs end to end in a child process with no network. The scenario
// comes from STUB_SCENARIO; what happened is written as JSON to STUB_OUT when the process exits.
//   error-halfway  every video download dies after two chunks (TypeError: terminated, ETIMEDOUT)
//   recover        the first video download dies, the retry (fresh URL) succeeds
//   stall          the video download sends one chunk and then nothing
import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const scenario = process.env.STUB_SCENARIO ?? 'error-halfway';
const state = { uploads: [], aborts: [], deletes: [], updates: [], recordFetches: 0, downloads: 0 };
const CHUNK = 1024;
const VIDEO_BYTES = 8 * CHUNK;
const PIC_BYTES = 2 * CHUNK;

const registryRows = [
  {
    id: 'r1',
    name: 'Ada Lovelace',
    instagram_username: '@ada',
    normalized_instagram: 'ada',
    profile_pic_url: 'https://pub-x.r2.dev/creator-registry/r1/profile-old.jpg',
    intro_videos: [],
  },
  {
    id: 'r2',
    name: 'Grace Hopper',
    instagram_username: null,
    normalized_instagram: null,
    profile_pic_url: null,
    intro_videos: [],
  },
];
pg.Client.prototype.connect = async function () {};
pg.Client.prototype.end = async function () {};
pg.Client.prototype.query = async function (sql, params) {
  if (sql.includes('information_schema.columns')) {
    return {
      rows: [
        { column_name: 'profile_pic_url', data_type: 'text' },
        { column_name: 'intro_videos', data_type: 'jsonb' },
        { column_name: 'instagram_username', data_type: 'text' },
        { column_name: 'normalized_instagram', data_type: 'text' },
      ],
    };
  }
  if (sql.startsWith('SELECT id, name')) return { rows: registryRows };
  if (sql.startsWith('UPDATE creator_registry')) {
    state.updates.push({
      column: sql.includes('intro_videos') ? 'intro_videos' : 'profile_pic_url',
      id: params[1],
      value: params[0],
    });
    return { rowCount: 1 };
  }
  if (sql.includes('COUNT(*)::int AS total'))
    return { rows: [{ total: 2, pics_in_r2: 1, with_intro_videos: 0, intro_videos_total: 0 }] };
  throw new Error('unexpected sql ' + sql);
};

Upload.prototype.done = async function () {
  const entry = { key: this.params.Key, bytes: 0, completed: false };
  state.uploads.push(entry);
  for await (const chunk of this.params.Body) entry.bytes += chunk.length;
  entry.completed = true;
  return { Key: this.params.Key };
};
Upload.prototype.abort = async function () {
  state.aborts.push(this.params.Key);
};
S3Client.prototype.send = async function (command) {
  if (command.constructor.name === 'DeleteObjectCommand') state.deletes.push(command.input.Key);
  return {};
};

const schema = {
  tables: [
    {
      id: 'tblA',
      name: 'UGC',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: 'IG', type: 'singleLineText' },
        { name: 'Profile Pic', type: 'multipleAttachments' },
        { name: "Creator's Intro", type: 'multipleAttachments' },
      ],
    },
  ],
};
const video = (url) => ({
  id: 'attV',
  url,
  type: 'video/mp4',
  filename: 'intro.mp4',
  size: VIDEO_BYTES,
});
const recordA = (url) => ({
  id: 'recA',
  fields: { Name: 'Ada Lovelace', IG: 'ada', "Creator's Intro": [video(url)] },
});
const recordB = {
  id: 'recB',
  fields: {
    Name: 'Grace Hopper',
    'Profile Pic': [
      { id: 'attP', url: 'https://dl.airtable.com/pic.jpg', type: 'image/jpeg', size: PIC_BYTES },
    ],
  },
};

function body(total, { dieAfter = null, stallAfter = null } = {}) {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (dieAfter !== null && sent >= dieAfter) {
        const cause = Object.assign(new Error('read ETIMEDOUT'), { code: 'ETIMEDOUT' });
        controller.error(Object.assign(new TypeError('terminated'), { cause }));
        return;
      }
      if (stallAfter !== null && sent >= stallAfter) return new Promise(() => {});
      if (sent >= total) return controller.close();
      const n = Math.min(CHUNK, total - sent);
      controller.enqueue(new Uint8Array(n));
      sent += n;
    },
  });
}

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/meta/bases/')) return new Response(JSON.stringify(schema), { status: 200 });
  if (/\/v0\/appA\/tblA\/recA$/.test(u)) {
    state.recordFetches += 1;
    return new Response(
      JSON.stringify(recordA(`https://dl.airtable.com/video-fresh-${state.recordFetches}.mp4`)),
      { status: 200 },
    );
  }
  if (u.startsWith('https://api.airtable.com/v0/appA/tblA')) {
    return new Response(
      JSON.stringify({ records: [recordA('https://dl.airtable.com/video-stale.mp4'), recordB] }),
      { status: 200 },
    );
  }
  if (u.endsWith('pic.jpg')) {
    state.downloads += 1;
    return new Response(body(PIC_BYTES), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
  }
  if (u.includes('/video-')) {
    state.downloads += 1;
    const headers = { 'content-type': 'video/mp4' };
    if (scenario === 'stall')
      return new Response(body(VIDEO_BYTES, { stallAfter: CHUNK }), { status: 200, headers });
    if (scenario === 'recover' && u.includes('fresh'))
      return new Response(body(VIDEO_BYTES), { status: 200, headers });
    return new Response(body(VIDEO_BYTES, { dieAfter: 2 * CHUNK }), { status: 200, headers });
  }
  throw new Error('unexpected fetch ' + u);
};

process.on('exit', () => {
  writeFileSync(process.env.STUB_OUT, JSON.stringify(state));
});
