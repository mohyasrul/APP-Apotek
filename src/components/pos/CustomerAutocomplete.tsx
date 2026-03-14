import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Customer } from '../../lib/types';
import { MagnifyingGlass, User } from '@phosphor-icons/react';

type Props = {
  effectiveUserId: string | null;
  customerName: string;
  customerPhone: string;
  onSelectCustomer: (name: string, phone: string) => void;
};

export function CustomerAutocomplete({ effectiveUserId, customerName, customerPhone, onSelectCustomer }: Props) {
  const [query, setQuery] = useState(customerName);
  const [results, setResults] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchCustomers = useCallback(async (q: string) => {
    if (!effectiveUserId || q.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('user_id', effectiveUserId)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .order('name')
      .limit(5);
    setResults((data as Customer[]) || []);
  }, [effectiveUserId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchCustomers(query);
        setShowDropdown(true);
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchCustomers]);

  // Sync external changes
  useEffect(() => { setQuery(customerName); }, [customerName]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Data Pelanggan <span className="text-slate-400 normal-case font-normal">(opsional)</span>
      </p>
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            onSelectCustomer(e.target.value, customerPhone);
          }}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Cari atau ketik nama pelanggan..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {results.map(c => (
              <button
                key={c.id}
                type="button"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(c.name);
                  onSelectCustomer(c.name, c.phone || '');
                  setShowDropdown(false);
                }}
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <User weight="bold" className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="tel"
        value={customerPhone}
        onChange={e => onSelectCustomer(query, e.target.value)}
        placeholder="No. HP pelanggan (untuk kirim WA)"
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
    </div>
  );
}
