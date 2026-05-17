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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full flex flex-col items-center gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-2xl font-black text-white">Join Session</h3>
          <p className="text-gray-400 mt-1 text-sm">{sessionName}</p>
        </div>

        {/* QR Code */}
        {url && (
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={url} size={200} level="H" bgColor="#ffffff" fgColor="#000000" />
          </div>
        )}

        {/* Code display */}
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">Or enter this code</p>
          <div className="bg-gray-800 border border-gray-700 rounded-xl px-6 py-3">
            <span className="text-4xl font-black text-white tracking-widest">{code}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Scan the QR code or go to hoopup.app and enter the code
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
