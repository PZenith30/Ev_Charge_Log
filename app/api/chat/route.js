/**
 * ผู้ช่วย AI — เรียก Gemini ฝั่ง server แล้วสตรีมคำตอบกลับไปทีละชิ้น
 *
 * ทำไมต้องผ่าน Route Handler
 *  - คีย์อยู่ฝั่ง server ไม่หลุดไปกับโค้ดหน้าเว็ป (ตัวแปรจึงไม่มี NEXT_PUBLIC_)
 *  - ตรวจว่าเป็นผู้ใช้ที่ล็อกอินจริงก่อนเรียก Gemini ไม่งั้นใครก็ยิงจนโควตาฟรีหมดได้
 *  - แปลง SSE ของ Gemini เป็นสตรีมข้อความธรรมดา ฝั่งเบราว์เซอร์อ่านง่ายกว่ามาก
 *
 * เรื่องการเลือกรุ่น: Google เปลี่ยน/ปลดชื่อรุ่นอยู่เรื่อยๆ แต่ละบัญชีเห็นไม่เหมือนกัน
 * และบางรุ่นรองรับเฉพาะ endpoint อื่น (เช่น Interactions API) ทั้งที่อยู่ในรายชื่อ
 * โค้ดนี้จึงไล่ลองทีละรุ่นจนกว่าจะเจอตัวที่ตอบได้จริง แล้วจำไว้ใช้ครั้งต่อไป
 */
import { createClient } from '@supabase/supabase-js';
import { buildSystemInstruction } from '@/lib/aiPrompt';
import {
  GEMINI_BASE as BASE, explainGoogleError, isFatalError, isModelUnusable,
  keyFormatWarning, listUsableModels, rankModels,
} from '@/lib/aiModels';

// ต้องเผื่อเวลาไว้ให้กรณีต้องไล่ลองหลายรุ่นในคำขอแรก
export const maxDuration = 60;

const MAX_MESSAGES = 20;   // เก็บบทสนทนาย้อนหลังเท่านี้ กันไม่ให้ token บาน
const MAX_CHARS = 4000;    // ความยาวข้อความเดียวสูงสุด
const TIMEOUT_MS = 20000;
const MAX_CANDIDATES = 4;  // ไล่ลองมากสุดกี่รุ่นก่อนยอมแพ้

/** จำรุ่นที่ตอบได้จริงและวิธีเรียก ไว้ตลอดอายุ instance จะได้ไม่ต้องไล่ลองใหม่ */
let known = null;      // { model, stream }
let rankedCache = null; // รายชื่อรุ่นเรียงตามความเหมาะสม

const fail = (code, error, status, extra = {}) => Response.json({ code, error, ...extra }, { status });

/** ตรวจว่าคนเรียกคือผู้ใช้ที่ล็อกอินจริง — คืน user หรือ null */
async function verifyUser(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase.auth.getUser(token);
    return error ? null : data?.user || null;
  } catch {
    return null;
  }
}

/**
 * แปลงสตรีม SSE ของ Gemini เป็นข้อความธรรมดา
 * Gemini ส่งมาเป็นบรรทัด "data: {...}" ทีละก้อน เราดึงเฉพาะ text ออกมาต่อกัน
 */
function toPlainTextStream(upstream) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // ประมวลผลเป็นบรรทัด เก็บเศษที่ยังไม่ครบบรรทัดไว้รอบถัดไป
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              const parts = json?.candidates?.[0]?.content?.parts || [];
              for (const p of parts) {
                if (p?.text) controller.enqueue(encoder.encode(p.text));
              }
            } catch {
              // ก้อนที่แกะไม่ได้ให้ข้ามไป ดีกว่าตัดสตรีมทิ้งทั้งอัน
            }
          }
        }
      } catch {
        controller.enqueue(encoder.encode('\n\n(การเชื่อมต่อขาดกลางคัน ลองถามใหม่อีกครั้ง)'));
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

export async function POST(request) {
  const user = await verifyUser(request);
  if (!user) return fail('UNAUTHORIZED', 'ต้องเข้าสู่ระบบก่อนใช้ผู้ช่วย AI', 401);

  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return fail('NO_KEY', 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์', 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('BAD_REQUEST', 'รูปแบบคำขอไม่ถูกต้อง', 400);
  }

  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const messages = incoming
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text.slice(0, MAX_CHARS) }],
    }));

  if (!messages.length) return fail('BAD_REQUEST', 'ไม่มีข้อความให้ตอบ', 400);

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemInstruction(body?.context || null) }] },
    contents: messages,
    generationConfig: {
      temperature: 0.3,   // ต่ำไว้เพราะงานนี้ต้องแม่นเรื่องตัวเลข
      maxOutputTokens: 1200,
    },
  });

  /** เรียกโมเดล — wantStream=false จะได้คำตอบเป็น JSON ก้อนเดียว */
  const callGemini = (model, wantStream) =>
    fetch(
      `${BASE}/models/${encodeURIComponent(model)}:` +
        (wantStream ? 'streamGenerateContent?alt=sse&' : 'generateContent?') +
        `key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: payload,
      }
    );

  /** อ่านข้อความ error จาก response โดยไม่ให้พังถ้า body ไม่ใช่ JSON */
  const errorOf = async (res) => {
    try {
      return (await res.json())?.error?.message || '';
    } catch {
      return '';
    }
  };

  try {
    // เรียงลำดับผู้สมัคร: ที่บังคับไว้ > ที่เคยตอบได้ > ที่เหลือเรียงตามคะแนน
    const forced = (process.env.GEMINI_MODEL || '').trim();
    let listed = null;

    if (!rankedCache) {
      listed = await listUsableModels(key);
      rankedCache = rankModels(listed.models);
    }

    const candidates = [];
    for (const name of [forced, known?.model, ...rankedCache]) {
      if (name && !candidates.includes(name)) candidates.push(name);
    }

    if (!candidates.length) {
      const hint = keyFormatWarning(process.env.GEMINI_API_KEY);
      const reason =
        listed?.error ? listed.error
        : listed?.all?.length ? `คีย์เห็น ${listed.all.length} โมเดล แต่ไม่มีตัวไหนใช้กับงานแชทได้`
        : 'คีย์ใช้ได้แต่ไม่เห็นโมเดลใดเลย';
      return fail('BAD_KEY', `เรียกผู้ช่วยไม่ได้ — ${reason}${hint ? ` (ข้อสังเกต: ${hint})` : ''}`, 502, {
        detail: listed?.raw || null,
        googleStatus: listed?.status ?? null,
        allModels: listed?.all || [],
      });
    }

    let lastStatus = 0;
    let lastDetail = '';
    const tried = [];

    // ไล่ลองทีละรุ่น แต่ละรุ่นลองสตรีมก่อนแล้วค่อยถอยเป็นไม่สตรีม
    for (const model of candidates.slice(0, MAX_CANDIDATES)) {
      // รุ่นที่เคยตอบได้แล้วรู้อยู่ว่าต้องใช้วิธีไหน ก็ไม่ต้องลองซ้ำอีกแบบ
      const modes = known?.model === model ? [known.stream] : [true, false];

      for (const stream of modes) {
        const res = await callGemini(model, stream);

        if (res.ok && (!stream || res.body)) {
          known = { model, stream };
          const headers = {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',            // กัน proxy บางตัวหน่วงสตรีมจนไม่เห็นทยอยพิมพ์
            'X-Gemini-Model': model,
            'X-Gemini-Stream': stream ? '1' : '0',
          };
          if (stream) return new Response(toPlainTextStream(res.body), { headers });

          // โหมดไม่สตรีม — คำตอบมาเป็น JSON ก้อนเดียว ส่งกลับเป็นข้อความล้วนเหมือนกัน
          const json = await res.json();
          const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('');
          const blocked = json?.promptFeedback?.blockReason;
          return new Response(
            text || (blocked
              ? `คำถามนี้ถูกระบบความปลอดภัยของ Gemini ปฏิเสธ (${blocked})`
              : 'ผู้ช่วยไม่ได้ตอบอะไรกลับมา'),
            { headers }
          );
        }

        lastStatus = res.status;
        lastDetail = await errorOf(res);
        tried.push(`${model}${stream ? ' (สตรีม)' : ''}: HTTP ${res.status}`);

        // คีย์ผิด สิทธิ์ไม่พอ หรือโควตาหมด — ลองรุ่นอื่นไปก็ไม่ช่วย
        if (isFatalError(res.status, lastDetail)) {
          const code = res.status === 429 ? 'QUOTA' : 'BAD_KEY';
          return fail(code, explainGoogleError(res.status, lastDetail), res.status === 429 ? 429 : 502);
        }
        // รุ่นนี้ใช้กับ endpoint นี้ไม่ได้ ข้ามไปรุ่นถัดไปเลย ไม่ต้องลองอีกโหมด
        if (isModelUnusable(res.status, lastDetail)) break;
      }
    }

    return fail(
      'BAD_MODEL',
      `ลองแล้ว ${tried.length} วิธีแต่ไม่มีรุ่นไหนตอบได้ — ${explainGoogleError(lastStatus, lastDetail)}`,
      502,
      { tried, candidates: candidates.slice(0, MAX_CANDIDATES) }
    );
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return fail(
      'UPSTREAM',
      timedOut ? 'Gemini ตอบช้าเกินไป ลองถามใหม่อีกครั้ง' : 'เชื่อมต่อ Gemini ไม่ได้',
      504
    );
  }
}

/** ดูว่ารุ่นไหนใช้ได้บ้าง — เปิดใน DevTools หรือเรียกจากหน้าเว็ปเพื่อวินิจฉัย */
export async function GET(request) {
  const user = await verifyUser(request);
  if (!user) return fail('UNAUTHORIZED', 'ต้องเข้าสู่ระบบก่อน', 401);

  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return fail('NO_KEY', 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์', 503);

  const listed = await listUsableModels(key);
  const raw = process.env.GEMINI_API_KEY || '';
  const ranked = rankModels(listed.models);

  return Response.json({
    สถานะคีย์: listed.error ? 'มีปัญหา' : 'ใช้ได้',
    ปัญหาที่พบ: listed.error || null,
    ข้อความจาก_Google: listed.raw || null,
    HTTP: listed.status,
    // ไม่แสดงคีย์เต็ม แสดงแค่พอให้ตรวจว่าคัดลอกมาถูกตัว
    คีย์: `${raw.slice(0, 6)}…${raw.slice(-4)} (ยาว ${raw.length} ตัว)`,
    ข้อสังเกตเรื่องรูปแบบคีย์: keyFormatWarning(raw) || 'ปกติ',
    บังคับรุ่นไว้: (process.env.GEMINI_MODEL || '').trim() || '(ไม่ได้ตั้ง — ให้ระบบเลือกเอง)',
    รุ่นที่ใช้ได้จริงล่าสุด: known ? `${known.model} (${known.stream ? 'สตรีม' : 'ไม่สตรีม'})` : '(ยังไม่เคยเรียกสำเร็จ)',
    ลำดับที่จะลอง: ranked.slice(0, MAX_CANDIDATES),
    รุ่นที่ประกาศว่าสตรีมได้: listed.streamable,
    รุ่นทั้งหมดที่คีย์นี้เห็น: listed.all,
  });
}
