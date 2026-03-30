export function useAuth() {
  const supabase = useSupabaseClient()

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    return data
  }

  async function createAccount(input: {
    name: string
    email: string
    phone: string
    password: string
    confirmPassword: string
  }) {
    if (input.password !== input.confirmPassword) {
      throw new Error('As senhas não conferem.')
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.name,
          phone: input.phone
        }
      }
    })

    if (error) throw error
    return data
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return {
    login,
    createAccount,
    logout
  }
}
