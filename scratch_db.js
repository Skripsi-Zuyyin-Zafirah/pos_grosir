import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Resetting staff status to idle where they are not packing any active order...');
  
  // 1. Fetch active orders with status = 'diproses'
  const { data: activeOrders, error: oErr } = await supabase
    .from('orders')
    .select('staff_id')
    .eq('status', 'diproses');
    
  if (oErr) {
    console.error('Error fetching active orders:', oErr);
    return;
  }
  
  const busyStaffIds = new Set(activeOrders.map(o => o.staff_id).filter(id => id !== null));
  console.log('Busy staff IDs from active orders:', Array.from(busyStaffIds));
  
  // 2. Fetch all staff members
  const { data: staffList, error: sErr } = await supabase
    .from('staff')
    .select('id, name, status');
    
  if (sErr) {
    console.error('Error fetching staff list:', sErr);
    return;
  }
  
  // 3. For each staff member, if they are marked as 'sibuk' but not in busyStaffIds, set them to 'idle'
  for (const staff of staffList) {
    if (staff.status === 'sibuk' && !busyStaffIds.has(staff.id)) {
      console.log(`Resetting ${staff.name} to idle...`);
      const { error: uErr } = await supabase
        .from('staff')
        .update({ status: 'idle' })
        .eq('id', staff.id);
      if (uErr) {
        console.error(`Failed to update ${staff.name}:`, uErr);
      } else {
        console.log(`${staff.name} is now idle.`);
      }
    }
  }
  console.log('Reset complete!');
}
run();
