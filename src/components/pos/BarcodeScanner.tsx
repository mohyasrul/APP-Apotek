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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Scanner Barcode">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2"><Camera weight="fill" className="w-5 h-5 text-indigo-600" /><h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Scan Barcode</h3></div>
          <button onClick={stopScanner} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"><X weight="bold" className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div id="barcode-reader" ref={initScanner} className="rounded-xl overflow-hidden" />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">Arahkan kamera ke barcode obat</p>
        </div>
      </div>
    </div>
  );
}
