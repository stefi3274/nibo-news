/* Configuration Supabase — Nibo News */
const SUPABASE_URL = "https://darzhfamxnycdglcglgg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhcnpoZmFteG55Y2RnbGNnbGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDUzNjcsImV4cCI6MjA5NTkyMTM2N30.uHMDHR4df8oYGIqLonLwAgEDzzdu1s7yj7VWtp3KUBQ";
const SLUG = "nibo";

let DB = null;
let PRET = false;
try {
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    DB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    PRET = true;
  }
} catch (e) { console.warn("Supabase non initialisé", e); }

// Récupère l'id de l'entreprise Nibo
let _entId = null;
async function entrepriseId() {
  if (_entId) return _entId;
  if (!DB) return null;
  const { data } = await DB.from("entreprises").select("id").eq("slug", SLUG).maybeSingle();
  _entId = data ? data.id : null;
  return _entId;
}
