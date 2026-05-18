'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  code: string;
  sessionName: string;
  onClose: () => void;
}

export default function QRModal({ code, sessionName, onClose }: Props) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(`${window.location.origin}/session/${code}`);
  }, [code]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="max-w-sm w-full flex flex-col items-center gap-5 p-6 rounded-3xl"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="font-display text-3xl tracking-widest text-white">Join Session</h3>
          <p className="text-sm mt-1" style={{ color: '#8892A4' }}>{sessionName}</p>
        </div>

        {url && (
          <div className="p-4 rounded-2xl" style={{ background: '#fff' }}>
            <QRCodeSVG value={url} size={180} level="H" bgColor="#ffffff" fgColor="#08090E" />
          </div>
        )}

        <div className="text-center w-full">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#3D4557' }}>Or enter this code</p>
          <div
            className="rounded-2xl px-6 py-4 text-center"
            style={{ background: 'rgba(255,107,0,0.08)', border: '1.5px solid rgba(255,107,0,0.25)' }}
          >
            <span className="font-display text-5xl tracking-[0.3em]" style={{ color: 'var(--orange2)' }}>{code}</span>
          </div>
        </div>

        <p className="text-[10px] text-center" style={{ color: '#3D4557' }}>
          Scan the QR code or go to hoopup-gang.vercel.app and enter the code
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
