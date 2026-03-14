import { useRef } from 'react';
import { Camera, X } from '@phosphor-icons/react';
import { toast } from 'sonner';

type Props = {
  onScanned: (barcode: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onScanned, onClose }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    onClose();
  };

  // Start scanner on mount
  const initScanner = async (element: HTMLDivElement | null) => {
    if (!element || scannerRef.current) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(element.id);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText) => {
          stopScanner();
          onScanned(decodedText);
        },
        () => {}
      );
    } catch (err: unknown) {
      toast.error('Gagal mengakses kamera: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Scanner Barcode">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2"><Camera weight="fill" className="w-5 h-5 text-blue-500" /><h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Scan Barcode</h3></div>
          <button onClick={stopScanner} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X weight="bold" className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div id="barcode-reader" ref={initScanner} className="rounded-2xl overflow-hidden" />
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3">Arahkan kamera ke barcode obat</p>
        </div>
      </div>
    </div>
  );
}
