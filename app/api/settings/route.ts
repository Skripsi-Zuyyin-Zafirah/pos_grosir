import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { type ECTParams } from "@/lib/ect/calculate"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")

    const params: ECTParams = {
      t_base: 2.0,
      t_pick: 1.5,
      t_pack: 0.2,
    }

    if (settings) {
      settings.forEach((s) => {
        if (s.key === "t_base") params.t_base = Number(s.value)
        if (s.key === "t_pick") params.t_pick = Number(s.value)
        if (s.key === "t_pack") params.t_pack = Number(s.value)
      })
    }

    return NextResponse.json(params)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
