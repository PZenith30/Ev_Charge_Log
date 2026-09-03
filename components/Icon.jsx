/**
 * ชุดไอคอน SVG แบบ sprite — วาด <IconSprite/> ครั้งเดียวที่ root
 * แล้วเรียกใช้ที่ไหนก็ได้ด้วย <Icon name="bolt" />
 * สีและความหนาเส้นควบคุมจาก CSS (stroke:currentColor) ทำให้เข้าธีมอัตโนมัติ
 */
export function IconSprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <symbol id="i-bolt" viewBox="0 0 32 32"><path d="M18 3 8 18h6l-1 11 11-15h-6z" /></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></symbol>
      <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" /><rect x="3" y="8" width="18" height="11" rx="2.5" /><path d="M16.5 13.5h.01" /></symbol>
      <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></symbol>
      <symbol id="i-car" viewBox="0 0 24 24"><path d="M5 17h14M6.5 17v2M17.5 17v2" /><path d="M3.5 17v-4.2L5.6 7.3A2 2 0 0 1 7.5 6h9a2 2 0 0 1 1.9 1.3l2.1 5.5V17z" /><path d="M3.5 12.8h17M7 14.6h1.5M16 14.6h1.5" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
      <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21" /><path d="M7 15l3.5-4 3 2.5L20 7" /></symbol>
      <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M19.1 4.9l-1.5 1.5M6.4 17.6l-1.5 1.5" /></symbol>
      <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></symbol>
      <symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" /><path d="M14.5 6.5 17.5 9.5" /></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V5h5v2M6 7l1 13h10l1-13M10 11v6M14 11v6" /></symbol>
      <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.7" /><path d="M3.5 17.5 9 12.5l4 3.5 3-2.5 4.5 4" /></symbol>
      <symbol id="i-camera" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 19h16" /></symbol>
      <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4 19h16" /></symbol>
      <symbol id="i-print" viewBox="0 0 24 24"><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></symbol>
      <symbol id="i-logout" viewBox="0 0 24 24"><path d="M14 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" /><path d="M17 8.5 20.5 12 17 15.5M20 12H9.5" /></symbol>
      <symbol id="i-battery" viewBox="0 0 24 24"><rect x="2" y="7" width="17" height="10" rx="2.5" /><path d="M21.5 10.5v3" /><path d="M5.5 10v4M9 10v4" /></symbol>
      <symbol id="i-road" viewBox="0 0 24 24"><path d="M6 3 4 21M18 3l2 18M12 4v3M12 11v3M12 18v3" /></symbol>
      <symbol id="i-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.5 9.5c0-1-1.1-1.6-2.5-1.6s-2.5.7-2.5 1.8 1 1.5 2.5 1.8 2.7.7 2.7 1.9-1.2 1.8-2.7 1.8-2.6-.6-2.6-1.6" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5.3l3.4 2" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 16.5h.01" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5" /></symbol>
      <symbol id="i-gauge" viewBox="0 0 24 24"><path d="M4 18a9 9 0 1 1 16 0" /><path d="M12 18l4-5.5" /></symbol>
      <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.4 5.5 3 13v5.5A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5V13l-2.4-7.5A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.9 1.5z" /></symbol>
      <symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.4-.6L3 21l1.8-5.2A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" /><path d="M8.8 11.5h.01M12.5 11.5h.01M16.2 11.5h.01" /></symbol>
      <symbol id="i-send" viewBox="0 0 24 24"><path d="M20.5 3.5 10.5 13.5" /><path d="M20.5 3.5 14 21l-3.5-7.5L3 10z" /></symbol>
      <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></symbol>
      <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></symbol>
      <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></symbol>
      <symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
      <symbol id="i-map-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></symbol>
      <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.8 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.8-3.8-9S9.5 5.7 12 3z" /></symbol>
      <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1.03z" /></symbol>
      <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-13.7-5.2L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 13.7 5.2L21 15" /><path d="M21 20v-5h-5" /></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></symbol>
      <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M10.7 6.2A10.4 10.4 0 0 1 12 6c6.4 0 10 6 10 6a18.4 18.4 0 0 1-3.1 3.8M6.4 6.5A17.9 17.9 0 0 0 2 12s3.6 6 10 6a10.3 10.3 0 0 0 4.3-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></symbol>
      <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2.5" /><path d="M16 5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16" /></symbol>
    </svg>
  );
}

export default function Icon({ name, ...rest }) {
  return (
    <svg aria-hidden="true" {...rest}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
