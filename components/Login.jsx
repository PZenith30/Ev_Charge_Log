'use client';
/** เข้าสู่ระบบด้วย Supabase Auth — อีเมล + รหัสผ่าน พร้อมสมัครสมาชิกและลืมรหัสผ่าน */
import { useState } from 'react';
import Icon from './Icon';
import { Field, PasswordInput } from './ui';
import { useStore } from './store';

const MODES = {
  signin: { title: 'เข้าสู่ระบบ', sub: 'บันทึกและวิเคราะห์การชาร์จรถไฟฟ้าของคุณ', submit: 'เข้าสู่ระบบ' },
  signup: { title: 'สมัครสมาชิก', sub: 'สร้างบัญชีใหม่เพื่อเริ่มบันทึกการชาร์จ', submit: 'สมัครสมาชิก' },
  reset: { title: 'ลืมรหัสผ่าน', sub: 'กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสใหม่ให้', submit: 'ส่งลิงก์ตั้งรหัสใหม่' },
};

export default function Login() {
  const { signIn, signUp, resetPassword } = useStore();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  function go(next) {
    setMode(next);
    setErr('');
    setOk('');
    setPass('');
    setPass2('');
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setOk('');

    if (!email.trim()) return setErr('กรุณากรอกอีเมล');
    if (mode !== 'reset' && !pass) return setErr('กรุณากรอกรหัสผ่าน');
    if (mode === 'signup') {
      if (pass.length < 6) return setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      if (pass !== pass2) return setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const error = await signIn(email, pass);
        if (error) setErr(error);
        // สำเร็จ — onAuthStateChange จะพาเข้าแอปเอง
      } else if (mode === 'signup') {
        const res = await signUp(email, pass);
        if (res.error) setErr(res.error);
        else if (res.needsConfirm) {
          setOk(`ส่งลิงก์ยืนยันไปที่ ${email.trim()} แล้ว — เปิดอีเมลแล้วกดยืนยันก่อนเข้าสู่ระบบ`);
          setMode('signin');
          setPass('');
          setPass2('');
        }
      } else {
        const error = await resetPassword(email);
        if (error) setErr(error);
        else setOk(`ส่งลิงก์ตั้งรหัสใหม่ไปที่ ${email.trim()} แล้ว`);
      }
    } finally {
      setBusy(false);
    }
  }

  const meta = MODES[mode];

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        {/* โลโก้จริงแทนไอคอนสายฟ้าเดิม ใช้ <img> ไม่ใช่ next/image เพราะเป็นไฟล์นิ่งขนาดคงที่ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login-mark" src="/icon-192.png" alt="" width="52" height="52" />
        <div className="login-brand">KiloEV</div>
        <h1>{meta.title}</h1>
        <p className="sub">{meta.sub}</p>

        <div className="stack">
          <Field label="อีเมล">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              spellCheck={false}
              autoCapitalize="none"
              required
            />
          </Field>

          {mode !== 'reset' ? (
            <Field label="รหัสผ่าน" help={mode === 'signup' ? 'อย่างน้อย 6 ตัวอักษร' : null}>
              <PasswordInput
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </Field>
          ) : null}

          {mode === 'signup' ? (
            <Field label="ยืนยันรหัสผ่าน">
              <PasswordInput
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          ) : null}
        </div>

        {err ? <div className="login-err">{err}</div> : null}
        {ok ? (
          <div className="alert" style={{ marginTop: 12, background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <Icon name="check" style={{ color: 'var(--accent-text)' }} />
            <div className="t2" style={{ color: 'var(--accent-text)', marginTop: 0 }}>{ok}</div>
          </div>
        ) : null}

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: 10, marginTop: err || ok ? 12 : 20 }}
          type="submit"
          disabled={busy}
        >
          {busy ? 'กำลังดำเนินการ…' : meta.submit}
        </button>

        <div className="rowflex" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          {mode === 'signin' ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('reset')}>
                ลืมรหัสผ่าน?
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('signup')}>
                ยังไม่มีบัญชี? สมัคร
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('signin')}>
              ← กลับไปหน้าเข้าสู่ระบบ
            </button>
          )}
        </div>

        <div className="login-hint">ข้อมูลของคุณถูกเก็บบน Supabase และเห็นได้เฉพาะบัญชีนี้</div>
      </form>
    </div>
  );
}
