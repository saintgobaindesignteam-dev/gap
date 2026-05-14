// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://fakxnejeumtusaswclzy.supabase.co';
// PLEASE PASTE YOUR ANON KEY BELOW
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZha3huZWpldW10dXNhc3djbHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Nzc4MzgsImV4cCI6MjA5MjQ1MzgzOH0.U1F4s4Ko55HFPLasWEUgNmZTw-yHBPi5jOGLyJHVSwI';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.SG_Auth = {
  client: _supabase,

  async signUp(email, password) {
    return await _supabase.auth.signUp({ email, password });
  },

  async signIn(email, password) {
    return await _supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    return await _supabase.auth.signOut();
  },

  async getSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session;
  },

  onAuthStateChange(callback) {
    return _supabase.auth.onAuthStateChange(callback);
  }
};
