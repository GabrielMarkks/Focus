// ⚠️ Substitua com as suas credenciais reais do Supabase
const supabaseUrl = 'https://qtrfoswdsjkqtevhmjhb.supabase.co';
const supabaseKey = 'sb_publishable_rT9D5F__QobktiqvtpH4hQ_BlqsOu0f';

// Inicializa a conexão e exporta para o resto do app usar
export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);