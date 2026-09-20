// Supabase 專案連線設定（僅使用可公開的 anon/publishable key，安全性由資料表的 RLS 政策控管）
const SUPABASE_URL = 'https://dhqubtrujbuocbwmdoav.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y6LV1hOQHPjoQWxdrUFiPg_0unV2Gio';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
