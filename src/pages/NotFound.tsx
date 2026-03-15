import { useNavigate } from "react-router-dom";
import { MapPinArea } from "@phosphor-icons/react";

export default function NotFound() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-10 rounded-3xl shadow-soft border border-gray-100 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center mx-auto mb-6">
          <MapPinArea weight="fill" className="w-10 h-10" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-lg font-semibold text-gray-600 mb-3">Halaman Tidak Ditemukan</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        >
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
}
