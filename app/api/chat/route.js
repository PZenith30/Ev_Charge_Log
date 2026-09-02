/**
 * ผู้ช่วย AI — เรียก Gemini ฝั่ง server แล้วสตรีมคำตอบกลับไปทีละชิ้น
 *
 * ทำไมต้องผ่าน Route Handler
 *  - คีย์อยู่ฝั่ง server ไม่หลุดไปกับโค้ดหน้าเว็ป (ตัวแปรจึงไม่มี NEXT_PUBLIC_)
 *  - ตรวจว่าเป็นผู้ใช้ที่ล็อกอินจริงก่อนเรียก Gemini ไม่งั้นใครก็ยิงจนโควตาฟรีหมดได้
 *  - แปลง SSE ของ Gemini เป็นสตรีมข้อความธรรมดา ฝั่งเบราว์เซอร์อ่านง่ายกว่ามาก
 *
 * เรื่องชื่อโมเดล: Google เปลี่ยน/ปลดชื่อรุ่นอยู่เรื่อยๆ และแต่ละบัญชีเห็นไม่เหมือนกัน
 * โค้ดนี้จึงไม่ยึดชื่อตายตัว แต่ถามรายชื่อจาก API แล้วเลือกรุ่นที่ใช้ได้จริงให้เอง
 * ถ้าอยากบังคับรุ่นเองก็ตั้ง GEMINI_MODEL ได้
 */
import { createClient } from '@supabase/supabase-js';
import { buildSystemInstruction } from '@/lib/aiPrompt';
import { GEMINI_BASE as BASE, keyFormatWarning, listUsableModels, pickModel } from '@/lib/aiModels';

const MAX_MESSAGES = 20;      // เก็บบทสนทนาย้อนหลังเท่านี้ กันไม่ให้ token บาน
const MAX_CHARS = 4000;       // ความยาวข้อความเดียวสูงสุด
const TIMEOUT_MS = 30000;

/** จำรุ่นที่ใช้ได้และวิธีเรียก (สตรีม/ไม่สตรีม) ไว้ตลอดอายุ instance จะได้ไม่ต้องถามซ้ำ */
let cached = null;

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

  try {
    // ลำดับการเลือกรุ่น: ที่ตั้งไว้เอง > ที่เคยใช้ได้ > ถามรายชื่อจาก API
    let model = (process.env.GEMINI_MODEL || '').trim() || cached?.model;
    let stream = cached ? cached.stream : true;

    if (!model) {
      const listed = await listUsableModels(key);
      model = pickModel(listed.models);
      if (!model) {
        // ข้อความจาก Google คือสิ่งเดียวที่บอกได้ว่าคีย์ผิด API ไม่ได้เปิด หรือคีย์ถูกจำกัด
        const hint = keyFormatWarning(process.env.GEMINI_API_KEY);
        const reason =
          listed.error ? listed.error
          : listed.all.length ? `คีย์เห็น ${listed.all.length} โมเดล แต่ไม่มีตัวไหนใช้กับงานแชทได้`
          : 'คีย์ใช้ได้แต่ไม่เห็นโมเดลใดเลย';
        return fail(
          'BAD_KEY',
          `เรียกผู้ช่วยไม่ได้ — ${reason}${hint ? ` (ข้อสังเกต: ${hint})` : ''}`,
          502,
          { detail: listed.raw || null, googleStatus: listed.status, allModels: listed.all }
        );
      }
      // ถ้า metadata ไม่ได้ประกาศว่าสตรีมได้ ก็ยังลองสตรีมก่อน แล้วค่อยถอยถ้าไม่ผ่าน
      stream = listed.streamable.length === 0 || listed.streamable.includes(model);
      cached = { model, stream };
    }

    let res = await callGemini(model, stream);

    // โมเดลนี้อาจไม่รองรับสตรีม — ลองแบบไม่สตรีมก่อนจะยอมแพ้
    if (!res.ok && stream) {
      stream = false;
      res = await callGemini(model, false);
      if (res.ok) cached = { model, stream: false };
    }

    // ยังไม่ผ่าน อาจเป็นเพราะชื่อรุ่นใช้ไม่ได้ ลองหาตัวแทนแล้วยิงใหม่ครั้งเดียว
    if (res.status === 404) {
      const listed = await listUsableModels(key);
      const alt = pickModel(listed.models);
      if (alt && alt !== model) {
        model = alt;
        stream = listed.streamable.length === 0 || listed.streamable.includes(alt);
        res = await callGemini(alt, stream);
        if (!res.ok && stream) {
          stream = false;
          res = await callGemini(alt, false);
        }
        if (res.ok) cached = { model, stream };
      } else {
        return fail(
          'BAD_MODEL',
          listed.models.length
            ? `ไม่พบโมเดล "${model}" — รุ่นที่บัญชีคุณใช้ได้: ${listed.models.slice(0, 8).join(', ')}`
            : `ไม่พบโมเดล "${model}" และดึงรายชื่อรุ่นไม่สำเร็จ — ${listed.error || 'ไม่ทราบสาเหตุ'}`,
          502,
          { available: listed.models }
        );
      }
    }

    if (!res.ok || (stream && !res.body)) {
      let detail = '';
      try {
        detail = (await res.json())?.error?.message || '';
      } catch { /* อ่าน body ไม่ได้ก็ไม่เป็นไร */ }

      if (res.status === 400 && /api key/i.test(detail)) {
        return fail('BAD_KEY', 'คีย์ Gemini ไม่ถูกต้อง — ตรวจค่า GEMINI_API_KEY แล้ว Redeploy', 502);
      }
      if (res.status === 401 || res.status === 403) {
        return fail('BAD_KEY', 'Gemini ปฏิเสธคีย์ — ตรวจว่าเปิดใช้งาน Generative Language API แล้ว', 502);
      }
      if (res.status === 429) {
        return fail('QUOTA', 'โควตา Gemini เต็มชั่วคราว รอสักครู่แล้วลองใหม่', 429);
      }
      return fail('UPSTREAM', `Gemini ตอบผิดพลาด (HTTP ${res.status})${detail ? ` — ${detail}` : ''}`, 502);
    }

    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',                    // กัน proxy บางตัวหน่วงสตรีมไว้จนไม่เห็นทยอยพิมพ์
      'X-Gemini-Model': model,                      // ดูได้ใน DevTools ว่าใช้รุ่นไหนอยู่
      'X-Gemini-Stream': stream ? '1' : '0',
    };

    if (stream) return new Response(toPlainTextStream(res.body), { headers });

    // โหมดไม่สตรีม — คำตอบมาเป็น JSON ก้อนเดียว ส่งกลับเป็นข้อความล้วนเหมือนกัน
    // ฝั่งเบราว์เซอร์อ่านด้วยโค้ดชุดเดิม ต่างแค่ได้ทั้งหมดทีเดียวไม่ทยอยขึ้น
    const json = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts || [])
      .map((p) => p?.text || '')
      .join('');
    const blocked = json?.promptFeedback?.blockReason;
    return new Response(
      text || (blocked ? `คำถามนี้ถูกระบบความปลอดภัยของ Gemini ปฏิเสธ (${blocked})` : 'ผู้ช่วยไม่ได้ตอบอะไรกลับมา'),
      { headers }
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
  return Response.json({
    สถานะคีย์: listed.error ? 'มีปัญหา' : 'ใช้ได้',
    ปัญหาที่พบ: listed.error || null,
    ข้อความจาก_Google: listed.raw || null,
    HTTP: listed.status,
    // ไม่แสดงคีย์เต็ม แสดงแค่พอให้ตรวจว่าคัดลอกมาถูกตัว
    คีย์: `${raw.slice(0, 6)}…${raw.slice(-4)} (ยาว ${raw.length} ตัว)`,
    ข้อสังเกตเรื่องรูปแบบคีย์: keyFormatWarning(raw) || 'ปกติ',
    ตั้งค่าไว้: (process.env.GEMINI_MODEL || '').trim() || '(ไม่ได้ตั้ง — ให้ระบบเลือกเอง)',
    กำลังใช้: (process.env.GEMINI_MODEL || '').trim() || cached?.model || pickModel(listed.models) || null,
    วิธีเรียก: cached ? (cached.stream ? 'สตรีม' : 'ไม่สตรีม') : '(ยังไม่เคยเรียก)',
    รุ่นที่ประกาศว่าสตรีมได้: listed.streamable,
    รุ่นที่แชทได้: listed.models,
    รุ่นทั้งหมดที่คีย์นี้เห็น: listed.all,
  });
}
