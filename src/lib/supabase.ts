import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://peagkvkhhsbdytevnhia.supabase.co";
const SUPABASE_KEY = "sb_secret_Q0zxaI4Myb6lY0IWZKgjLw_pXGH5zXj";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
