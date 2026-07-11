"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { IconPrinter } from "@tabler/icons-react"

type ReceiptItem = {
  id: string
  qty: number
  unit_price: number
  products: {
    name: string
  } | null
}

type ReceiptOrder = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  payment_method?: string
  payment_amount?: number
  change_amount?: number
  order_items: ReceiptItem[]
}

interface ReceiptProps {
  order: ReceiptOrder
}

export function Receipt({ order }: ReceiptProps) {
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col items-center">
      {/* Printable Receipt Wrapper */}
      <div
        id="receipt-print-area"
        className="w-full max-w-[320px] p-6 bg-white text-black border border-dashed border-gray-300 rounded shadow-sm text-xs font-mono"
      >
        <div className="text-center space-y-1 mb-4 border-b border-dashed pb-3">
          <h2 className="text-sm font-bold tracking-wider uppercase">POS GROSIR JASA</h2>
          <p className="text-[10px] text-gray-500">Jl. Raya Grosir No. 12, Jawa Timur</p>
          <p className="text-[10px] text-gray-500">Telp: 0812-3456-7890</p>
        </div>

        <div className="space-y-1 mb-3 text-[10px] text-gray-600">
          <div className="flex justify-between">
            <span>No. Nota:</span>
            <span className="font-bold">
              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tanggal:</span>
            <span>{new Date(order.created_at).toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between">
            <span>Pelanggan:</span>
            <span className="font-semibold">{order.customer_name}</span>
          </div>
        </div>

        {/* Item Table */}
        <div className="border-t border-b border-dashed py-2 mb-3">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-dashed">
                <th className="text-left pb-1">Nama Barang</th>
                <th className="text-right pb-1">Qty</th>
                <th className="text-right pb-1">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1">
                    <p className="font-semibold">{item.products?.name}</p>
                    <p className="text-[9px] text-gray-500">
                      {formatRupiah(item.unit_price)}/pcs
                    </p>
                  </td>
                  <td className="text-right py-1">
                    {item.qty}
                  </td>
                  <td className="text-right py-1 font-semibold">
                    {formatRupiah(item.unit_price * item.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations */}
        <div className="space-y-1.5 text-[10px] border-b border-dashed pb-3 mb-3">
          <div className="flex justify-between">
            <span>Total Item:</span>
            <span>{order.total_items} unit</span>
          </div>
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>{formatRupiah(order.total_price)}</span>
          </div>
          {order.payment_method && (
            <>
              <div className="flex justify-between">
                <span>Metode Bayar:</span>
                <span className="uppercase">{order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span>Bayar:</span>
                <span>{formatRupiah(order.payment_amount || 0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Kembalian:</span>
                <span>{formatRupiah(order.change_amount || 0)}</span>
              </div>
            </>
          )}
        </div>

        <div className="text-center text-[10px] text-gray-500 mt-4">
          <p>Terima Kasih Atas Kunjungan Anda</p>
          <p>Barang Yang Sudah Dibeli Tidak Dapat Ditukar</p>
        </div>
      </div>

      {/* Action Button */}
      <Button onClick={handlePrint} className="mt-4 w-full max-w-[320px]">
        <IconPrinter className="size-4 mr-2" /> Cetak Struk
      </Button>

      {/* Global CSS for Print Mode */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-print-area,
          #receipt-print-area * {
            visibility: visible;
          }
          #receipt-print-area {
            position: absolute;
            left: 50%;
            top: 50px;
            transform: translateX(-50%);
            border: none;
            box-shadow: none;
            width: 80mm; /* standard thermal printer size */
          }
        }
      `}</style>
    </div>
  )
}
