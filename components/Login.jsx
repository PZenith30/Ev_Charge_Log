'use client';
import { useState } from 'react';
import Icon from './Icon';
import { Field } from './ui';
import { useStore } from './store';

export default function Login() {
  const { login } = useStore();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!login(user, pass)) setErr('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    else setErr('');
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark">
          <Icon name="bolt" viewBox="0 0 32 32" />
        </div>
        <h1>EV Charge Log</h1>
        <p className="sub">บันทึกและวิเคราะห์การชาร์จรถไฟฟ้าของคุณ</p>

        <div className="stack">
          <Field label="ชื่อผู้ใช้">
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              placeholder="Admin"
              spellCheck={false}
            />
          </Field>
          <Field label="รหัสผ่าน">
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••"
            />
          </Field>
        </div>

        <div className="login-err">{err}</div>
        <button className="btn btn-primary" style={{ width: '100%', padding: 10 }} type="submit">
          เข้าสู่ระบบ
        </button>
        <div className="login-hint">
          ทดลองใช้งาน — <b>Admin</b> / <b>Admin</b>
        </div>
      </form>
    </div>
  );
}
