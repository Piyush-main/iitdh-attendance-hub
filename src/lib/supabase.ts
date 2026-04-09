import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://peagkvkhhsbdytevnhia.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYWdrdmtoaHNiZHl0ZXZuaGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTU3MDUsImV4cCI6MjA4NjY3MTcwNX0.ah3IW3O8AJG_Aki0jKmeRkhcU_8dsKNGG3LazFFJIJ4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
