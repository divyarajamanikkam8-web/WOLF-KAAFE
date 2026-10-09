import { supabase } from '../lib/supabase';
export const signIn = (email: string, password: string) =>
  supabase?.auth.signInWithPassword({ email: email.trim(), password });
export const signUp = (email: string, password: string, fullName: string, phone: string) => supabase?.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } });
export const signOut = () => supabase?.auth.signOut();
export async function getProfileRole(userId: string): Promise<'customer' | 'admin' | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) throw error;
  return data.role === 'admin' ? 'admin' : data.role === 'customer' ? 'customer' : null;
}
