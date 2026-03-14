import { useNavigate } from "react-router-dom";
import { MapPinArea } from "@phosphor-icons/react";

export default function NotFound() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-10 rounded-3xl shadow-soft border border-slate-100 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MapPinArea weight="fill" className="w-10 h-10" />
        </div>
        <h1 className="text-6xl font-bold text-slate-800 mb-2">404</h1>
        <h2 className="text-xl font-bold text-slate-600 mb-3">Halaman Tidak Ditemukan</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        >
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
}
