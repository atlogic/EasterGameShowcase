import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer } from 'lucide-react';

interface PrintPageProps {
  onBack: () => void;
}

export const PrintPage: React.FC<PrintPageProps> = ({ onBack }) => {
  // Generate 30 numbered QR codes
  const qrCodes = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8 print:hidden">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft size={20} /> Powrót
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg"
          >
            <Printer size={20} /> Drukuj arkusz QR
          </button>
        </div>

        <div className="text-center mb-12 print:mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Arkusz Kodów QR (1-30)</h1>
          <p className="text-gray-600 mt-2">Wytnij kody i rozmieść je w ogrodzie zgodnie z planem gry.</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6 print:gap-4">
          {qrCodes.map((num) => (
            <div key={num} className="border-2 border-gray-200 rounded-xl p-4 flex flex-col items-center space-y-2 break-inside-avoid shadow-sm">
              <div className="text-xl font-black text-green-600">#{num}</div>
              <div className="bg-white p-2 border border-gray-100 rounded-lg">
                <QRCodeSVG value={`egg_hunt_qr_${num}`} size={100} />
              </div>
              <div className="text-[10px] text-gray-400 font-mono">ID: {num}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-2xl border-2 border-blue-100 print:hidden">
          <h3 className="font-bold text-blue-800 mb-2">Instrukcja:</h3>
          <p className="text-sm text-blue-700">
            Aplikacja automatycznie przypisuje Twój pierwszy punkt do kodu #1, drugi do kodu #2 i tak dalej. 
            Wydrukuj ten arkusz raz i miej zapas kodów na każdą okazję!
          </p>
        </div>
      </div>
    </div>
  );
};
