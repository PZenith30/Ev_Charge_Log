'use client';
/**
 * ผู้ช่วย AI — ปุ่มลอย + แผงแชท เรียกได้จากทุกหน้า
 *
 * คำตอบมาแบบสตรีม อ่านจาก response.body ทีละชิ้นแล้วต่อเข้าข้อความล่าสุด
 * บทสนทนาเก็บใน localStorage แยกตามผู้ใช้ ไม่เก็บลง Supabase จึงไม่ต้องเพิ่มตาราง
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { buildContext } from '@/lib/aiContext';
import Icon from './Icon';
import { useStore } from './store';

const SUGGESTIONS = [
  'สรุปการชาร์จช่วงที่เลือกให้หน่อย',
  'ค่าใช้จ่ายเฉลี่ยต่อกิโลเมตรเท่าไหร่',
  'ชาร์จที่ไหนคุ้มที่สุด',
  'Efficiency ช่วงนี้ดีขึ้นหรือแย่ลง',
];

const chatKey = (userId) => `evlog.chat.${userId || 'anon'}`;
const shareKey = 'evlog.chatShareData';

export default function ChatWidget() {
  const store = useStore();
  const { user, chatOpen, setChatOpen, toast, t } = store;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareData, setShareData] = useState(true);
  const [diag, setDiag] = useState('');       // ผลตรวจการตั้งค่า แสดงเมื่อกดปุ่มเท่านั้น
  const [diagBusy, setDiagBusy] = useState(false);
  const abortRef = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  /* ---------- โหลด/บันทึกบทสนทนาของผู้ใช้คนนี้ ---------- */
  useEffect(() => {
    try {
      setMessages(JSON.parse(localStorage.getItem(chatKey(user?.id)) || '[]'));
      setShareData(localStorage.getItem(shareKey) !== '0');
    } catch {
      setMessages([]);
    }
  }, [user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(chatKey(user?.id), JSON.stringify(messages.slice(-40)));
    } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
  }, [messages, user?.id]);

  // เลื่อนลงล่างสุดทุกครั้งที่มีข้อความใหม่หรือมีตัวอักษรไหลเข้ามา
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, chatOpen]);

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 60);
  }, [chatOpen]);

  // ยกเลิกคำขอที่ค้างอยู่เมื่อคอมโพเนนต์ถูกถอด
  useEffect(() => () => abortRef.current?.abort(), []);

  function toggleShare(next) {
    setShareData(next);
    try {
      localStorage.setItem(shareKey, next ? '1' : '0');
    } catch { /* ไม่เป็นไร */ }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  function clearChat() {
    stop();
    setMessages([]);
    setDiag('');
  }

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || busy) return;

    const history = [...messages.filter((m) => !m.error), { role: 'user', text: question }];
    setMessages([...history, { role: 'model', text: '' }]);
    setInput('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    /** เขียนทับข้อความสุดท้าย (ฟองของ AI ที่กำลังพิมพ์อยู่) */
    const setLast = (patch) =>
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
        return copy;
      });

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, text: m.text })),
          context: shareData ? buildContext(store) : null,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `เรียกผู้ช่วยไม่สำเร็จ (HTTP ${res.status})`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += value;
        setLast({ text: acc });
      }
      if (!acc.trim()) setLast({ text: 'ผู้ช่วยไม่ได้ตอบอะไรกลับมา ลองถามใหม่อีกครั้ง', error: true });
    } catch (e) {
      if (e.name === 'AbortError') {
        // กดหยุด — เก็บข้อความที่ไหลมาแล้วไว้ ถ้ายังไม่ทันได้อะไรเลยก็ถอดฟองเปล่าออก
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === 'model' && !last.text) copy.pop();
          return copy;
        });
      } else {
        setLast({ text: e.message, error: true });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  /**
   * ตรวจการตั้งค่า AI — ถาม GET /api/chat ว่าคีย์ใช้ได้ไหมและเห็นรุ่นอะไรบ้าง
   * มีปุ่มนี้เพราะ endpoint บังคับแนบ token จึงเปิด URL ตรงๆ ในเบราว์เซอร์ไม่ได้
   * และผู้ใช้ไม่ควรต้องวางโค้ดใน DevTools ซึ่งเป็นช่องทางที่มิจฉาชีพชอบหลอกให้ทำ
   */
  async function runDiagnostics() {
    setDiagBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');

      const res = await fetch('/api/chat', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({ error: `อ่านผลไม่ได้ (HTTP ${res.status})` }));
      setDiag(JSON.stringify(json, null, 2));
    } catch (e) {
      setDiag(`ตรวจไม่สำเร็จ: ${e.message}`);
    } finally {
      setDiagBusy(false);
    }
  }

  async function copyDiag() {
    try {
      await navigator.clipboard.writeText(diag);
      toast('คัดลอกผลตรวจแล้ว');
    } catch {
      toast('คัดลอกไม่ได้ — ลากคลุมข้อความแล้วคัดลอกเองได้', true);
    }
  }

  if (!chatOpen) {
    return (
      // ไอคอนเปล่าเดาไม่ออกว่าเป็นแชท จึงมีป้ายกำกับติดไว้ตลอด
      <button type="button" className="fab fab-chat" onClick={() => setChatOpen(true)} title={t('ถามผู้ช่วย AI')}>
        <Icon name="sparkle" />
        <span>{t('แชทกับ AI')}</span>
      </button>
    );
  }

  const hasError = messages.some((m) => m.error);

  return (
    <div className="chat-panel" role="dialog" aria-label={t('ผู้ช่วย AI')}>
      <div className="chat-head">
        <span className="ic"><Icon name="sparkle" /></span>
        <div className="t">
          <b>{t('ผู้ช่วย AI')}</b>
          <span>{t('รู้จักเว็ปนี้และข้อมูลการชาร์จของคุณ')}</span>
        </div>
        {messages.length ? (
          <button type="button" className="btn btn-icon btn-ghost" onClick={clearChat} title={t('ล้างบทสนทนา')}>
            <Icon name="trash" />
          </button>
        ) : null}
        <button type="button" className="btn btn-icon btn-ghost" onClick={() => setChatOpen(false)} title={t('ปิด')}>
          <Icon name="x" />
        </button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {!messages.length ? (
          <div>
            <p className="chat-intro">
              {t('ถามอะไรก็ได้เกี่ยวกับการชาร์จรถของคุณ หรือวิธีใช้เว็ปนี้')}
              <br />
              {t('คำถามและข้อมูลสรุปจะถูกส่งไปประมวลผลที่ Google (Gemini) ปิดการส่งข้อมูลได้ที่ด้านล่าง')}
            </p>
            <div className="chat-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-msg ${m.error ? 'err' : m.role === 'user' ? 'me' : 'ai'}`}
          >
            {m.text}
            {busy && i === messages.length - 1 && m.role === 'model' ? <span className="chat-caret" /> : null}
          </div>
        ))}

        {/* ขึ้นเฉพาะตอนตอบไม่สำเร็จ จะได้ไม่รกเวลาใช้งานปกติ */}
        {hasError && !busy ? (
          <div className="chat-diag">
            <button type="button" className="btn btn-sm" onClick={runDiagnostics} disabled={diagBusy}>
              <Icon name={diagBusy ? 'clock' : 'settings'} />
              {diagBusy ? 'กำลังตรวจ…' : 'ตรวจการตั้งค่า AI'}
            </button>
            {diag ? (
              <>
                <pre>{diag}</pre>
                <button type="button" className="btn btn-sm btn-ghost" onClick={copyDiag}>
                  <Icon name="copy" />{t('คัดลอกผลตรวจ')}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="chat-foot">
        <div className="chat-input">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={t('พิมพ์คำถาม… (Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่)')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          {busy ? (
            <button type="button" className="chat-send" onClick={stop} title={t('หยุด')}>
              <Icon name="stop" />
            </button>
          ) : (
            <button type="button" className="chat-send" onClick={() => send()} disabled={!input.trim()} title={t('ส่ง')}>
              <Icon name="send" />
            </button>
          )}
        </div>
        <label className="chat-share">
          <input type="checkbox" checked={shareData} onChange={(e) => toggleShare(e.target.checked)} />
          {t('ส่งข้อมูลการชาร์จของฉันให้ AI (ปิดแล้วจะตอบได้แค่วิธีใช้เว็ป)')}
        </label>
      </div>
    </div>
  );
}
