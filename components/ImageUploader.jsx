'use client';
/** แนบรูป (สลิปธนาคาร / สกรีนช็อตจากแอปชาร์จ) — ย่อขนาดแล้วเก็บลง IndexedDB */
import { useEffect, useRef, useState } from 'react';
import { addImageFiles, imgDel, imgMany } from '@/lib/storage';
import Icon from './Icon';
import { useStore } from './store';

/** max = จำนวนรูปสูงสุด (ค่าเริ่มต้นไม่จำกัด) · ครบแล้วปุ่มเพิ่มจะซ่อน */
export default function ImageUploader({ imageIds = [], onChange, max = Infinity, hint }) {
  const { setLightbox, toast, t } = useStore();
  const [recs, setRecs] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const key = imageIds.join(',');

  useEffect(() => {
    let alive = true;
    imgMany(imageIds)
      .then((r) => { if (alive) setRecs(r); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function handleFiles(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const added = await addImageFiles(files);
      if (added.length) {
        // ถ้าเกินโควตา ให้เก็บใบล่าสุดตามจำนวนที่กำหนด
        const next = [...imageIds, ...added.map((a) => a.id)];
        onChange(Number.isFinite(max) ? next.slice(-max) : next);
        toast(`แนบรูปแล้ว ${added.length} ไฟล์`);
      } else {
        toast('ไม่พบไฟล์รูปที่แนบได้', true);
      }
    } catch {
      toast('แนบรูปไม่สำเร็จ', true);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  function remove(id) {
    imgDel(id).catch(() => {});
    onChange(imageIds.filter((x) => x !== id));
  }

  return (
    <>
      <div className="thumbs">
        {recs.map((r) => (
          <div className="thumb" key={r.id}>
            {/* รูปเก็บเป็น data: URL ใน IndexedDB จึงใช้ <img> ตรงๆ แทน next/image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.dataUrl} alt={r.name || 'รูปแนบ'} onClick={() => setLightbox(r.dataUrl)} />
            <button type="button" className="del" onClick={() => remove(r.id)} aria-label={t('ลบรูป')}>
              ×
            </button>
          </div>
        ))}
        {recs.length < max ? (
          <button
            type="button"
            className="uploader"
            onClick={() => inputRef.current?.click()}
            title={hint || 'แนบรูป'}
            disabled={busy}
          >
            <Icon name={busy ? 'clock' : 'camera'} />
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max !== 1}
        hidden
        onChange={handleFiles}
      />
    </>
  );
}
