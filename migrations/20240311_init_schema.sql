-- Tabel Pengguna & Toko
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  pharmacy_name TEXT NOT NULL,
  pharmacy_address TEXT,
  role TEXT DEFAULT 'owner', -- 'owner' atau 'cashier'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Master Obat
CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT, -- 'bebas', 'keras', 'resep', 'alkes'
  barcode TEXT,
  buy_price NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  stock INTEGER DEFAULT 0,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Transaksi (Header)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL,
  payment_method TEXT, -- 'cash', 'qris', 'transfer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Detail Transaksi (Items)
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price_at_transaction NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Create Policies (User only sees their own pharmacy's data)
CREATE POLICY "Users can only see and update their own profile" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage medicines of their pharmacy" ON medicines
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage transactions of their pharmacy" ON transactions
  FOR ALL USING (auth.uid() = user_id);

-- Untuk transaction_items, kita join ke transactions untuk verify user
CREATE POLICY "Users can manage transaction items of their pharmacy" ON transaction_items
  FOR ALL USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE user_id = auth.uid()
    )
  );
