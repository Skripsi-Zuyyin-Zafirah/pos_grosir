-- Create stock_mutations table
CREATE TABLE IF NOT EXISTS public.stock_mutations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    change_qty INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'initial', 'restock', 'sale', 'adjustment'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add column waktu_pengambilan to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS waktu_pengambilan INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE;

-- Trigger function to automatically log stock changes when product stock is updated
CREATE OR REPLACE FUNCTION public.log_stock_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_change_qty integer;
    v_type varchar(50);
    v_notes text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.stock <> 0 THEN
            INSERT INTO public.stock_mutations (product_id, change_qty, type, notes, created_at)
            VALUES (NEW.id, NEW.stock, 'initial', 'Stok awal saat pembuatan produk', NOW());
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.stock <> NEW.stock THEN
            v_change_qty := NEW.stock - OLD.stock;
            IF v_change_qty < 0 THEN
                v_type := 'adjustment';
                v_notes := 'Penyesuaian stok berkurang';
            ELSE
                v_type := 'restock';
                v_notes := 'Restok produk';
            END IF;
            
            INSERT INTO public.stock_mutations (product_id, change_qty, type, notes, created_at)
            VALUES (NEW.id, v_change_qty, v_type, v_notes, NOW());
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS tr_log_stock_mutation ON public.products;
CREATE TRIGGER tr_log_stock_mutation
AFTER INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.log_stock_mutation();
